import type { VercelRequest, VercelResponse } from '@vercel/node';
import webpush from 'web-push';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

const vapidPublicKey = process.env.VITE_VAPID_PUBLIC_KEY!;
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY!;

if (vapidPublicKey && vapidPrivateKey) {
  webpush.setVapidDetails(
    'mailto:notifications@one-stop-planner.com',
    vapidPublicKey,
    vapidPrivateKey
  );
}

interface PushItem {
  id: string;
  user_id?: string;
  item_type?: string;
  item_id?: string;
  title?: string;
  start_time?: string;
  startTime?: string;
  due_time?: string;
  dueTime?: string;
  deep_link?: string;
  [key: string]: unknown;
}

/**
 * Query a planner item table for rows whose alert time is due and that have
 * not yet been dispatched. Safely tolerates both snake_case and camelCase
 * column naming so we don't break if a table uses one convention or the other.
 */
async function queryDueItems(table: string, userId: string): Promise<PushItem[]> {
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from(table)
    .select('*')
    .eq('user_id', userId)
    .or(`alert_timestamp.lte.${now},alertTimestamp.lte.${now}`)
    .or('alert_sent.is.null,alert_sent.eq.false');

  if (error) {
    // The table or one of the alert columns may not exist yet (older schema).
    // Log and continue with the other item types rather than failing the run.
    console.error(`Error fetching due items from ${table}:`, error);
    return [];
  }

  return (data || []) as PushItem[];
}

/**
 * Build the push payload for a due item based on its type.
 */
function buildPayload(item: PushItem): { title: string; body: string } | null {
  const itemType = item.item_type || 'event';
  const title = item.title || 'Reminder';

  switch (itemType) {
    case 'goal':
      return {
        title: `Goal Reminder: ${title}`,
        body: 'Time to check in on your goal!',
      };
    case 'task':
      return {
        title: `Task Due: ${title}`,
        body: `Due at ${item.due_time || item.dueTime || 'scheduled time'}`,
      };
    case 'event':
    default:
      return {
        title: `Event: ${title}`,
        body: `Starts at ${item.start_time || item.startTime || 'scheduled time'}`,
      };
  }
}

/**
 * Mark an item as sent after a successful dispatch so duplicate cron runs
 * never resend the same notification.
 */
async function markItemSent(table: string, id: string): Promise<void> {
  try {
    await supabase
      .from(table)
      .update({ alert_sent: true, sent_at: new Date().toISOString() })
      .eq('id', id);
  } catch (err) {
    console.error(`Failed to mark item ${id} as sent in ${table}:`, err);
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    // 1. Fetch active push subscriptions
    const { data: subscriptions, error: subError } = await supabase
      .from('user_push_subscriptions')
      .select('*')
      .eq('enabled', true);

    if (subError) throw new Error("Database error: " + subError.message);
    if (!subscriptions || subscriptions.length === 0) {
      return res.status(200).json({ success: true, message: 'No active subscriptions found', sent: 0 });
    }

    let sentCount = 0;

    // 2. Dispatch notifications to active endpoints
    for (const sub of subscriptions) {
      const pushConfig = {
        endpoint: sub.endpoint,
        keys: sub.keys || { p256dh: sub.p256dh, auth: sub.auth }
      };

      const userId = sub.user_id ?? '';

      // 3. Fetch all types of due, unsent notifications for this user
      const [dueEvents, dueGoals, dueTasks] = await Promise.all([
        queryDueItems('events', userId),
        queryDueItems('goals', userId),
        queryDueItems('tasks', userId),
      ]);

      const dueItems: PushItem[] = [
        ...dueEvents.map((e) => ({ ...e, item_type: 'event' })),
        ...dueGoals.map((g) => ({ ...g, item_type: 'goal' })),
        ...dueTasks.map((t) => ({ ...t, item_type: 'task' })),
      ];

      for (const item of dueItems) {
        const payload = buildPayload(item);
        if (!payload) continue;

        const fullPayload = JSON.stringify({
          title: payload.title,
          body: payload.body,
          icon: '/vite.svg',
          url: item.deep_link || '/',
        });

        const sourceTable = item.item_type === 'goal' ? 'goals' : item.item_type === 'task' ? 'tasks' : 'events';

        try {
          await webpush.sendNotification(pushConfig, fullPayload);
          sentCount++;
          await markItemSent(sourceTable, item.id);
        } catch (err: any) {
          console.error(`Failed to send notification to ${sub.endpoint}:`, err);
        }
      }
    }

    return res.status(200).json({
      success: true,
      notificationsSent: sentCount,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error("Scheduled Dispatch Error:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
}