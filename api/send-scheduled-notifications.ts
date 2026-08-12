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

// ─── Context-Aware Payload Helpers ────────────────────────────────────────────

/**
 * Build a context-aware notification title based on the item type.
 * Events → "Upcoming Event: {title}", Goals → "Goal Reminder: {title}", Tasks → "Task Due: {title}".
 */
function buildTitle(itemType: string, entityTitle: string): string {
  switch (itemType) {
    case 'event':
      return `Upcoming Event: ${entityTitle}`;
    case 'goal':
      return `Goal Reminder: ${entityTitle}`;
    case 'task':
      return `Task Due: ${entityTitle}`;
    default:
      return entityTitle || 'One Stop Planner';
  }
}

/**
 * Build a context-aware notification body based on the item type.
 * Events → "Starts at {startTime} ({alertTimingText})", Goals → "Time to check in on your goal!", Tasks → "Due at {dueTime}".
 */
function buildBody(itemType: string, alert: any): string {
  switch (itemType) {
    case 'event':
      // alert.body may already contain "Starts at {startTime} ({alertTimingText})" or just the time info.
      if (alert.body && !alert.body.startsWith('Starts at')) {
        return `Starts at ${alert.body}`;
      }
      return alert.body || 'Upcoming event';
    case 'goal':
      return 'Time to check in on your goal!';
    case 'task':
      if (alert.body && !alert.body.startsWith('Due at')) {
        return `Due at ${alert.body}`;
      }
      return alert.body || 'Task is due';
    default:
      return alert.body || 'You have an upcoming item due soon!';
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    // 1. Fetch due, un-sent alerts within the narrow window.
    //    Only select items where alertTimestamp falls within [now, now + 1 minute],
    //    or un-sent items where sent = false and alertTimestamp <= now.
    const now = new Date();
    const windowEnd = new Date(now.getTime() + 60 * 1000); // now + 1 minute

    const { data: dueAlerts, error: alertError } = await supabase
      .from('alert_notifications')
      .select('*')
      .eq('sent', false)
      .lte('alert_timestamp', windowEnd.toISOString())
      .order('alert_timestamp', { ascending: true })
      .limit(100);

    if (alertError) throw new Error("Database error: " + alertError.message);
    if (!dueAlerts || dueAlerts.length === 0) {
      return res.status(200).json({ success: true, message: 'No due alerts', sent: 0 });
    }

    // 2. Group alerts by user so we can fetch each user's subscriptions once.
    const alertsByUser = new Map<string, any[]>();
    for (const alert of dueAlerts) {
      if (!alertsByUser.has(alert.user_id)) {
        alertsByUser.set(alert.user_id, []);
      }
      alertsByUser.get(alert.user_id)!.push(alert);
    }

    // 3. Fetch all active push subscriptions.
    const { data: subscriptions, error: subError } = await supabase
      .from('user_push_subscriptions')
      .select('*')
      .eq('enabled', true);

    if (subError) throw new Error("Database error: " + subError.message);
    if (!subscriptions || subscriptions.length === 0) {
      return res.status(200).json({ success: true, message: 'No active subscriptions found', sent: 0 });
    }

    const subsByUser = new Map<string, any[]>();
    for (const sub of subscriptions) {
      if (!subsByUser.has(sub.user_id)) {
        subsByUser.set(sub.user_id, []);
      }
      subsByUser.get(sub.user_id)!.push(sub);
    }

    let sentCount = 0;

    // 4. Dispatch notifications for each due alert.
    for (const [userId, userAlerts] of alertsByUser) {
      const userSubs = subsByUser.get(userId) || [];
      if (userSubs.length === 0) continue;

      for (const alert of userAlerts) {
        const title = buildTitle(alert.item_type, alert.title);
        const body = buildBody(alert.item_type, alert);

        const payload = JSON.stringify({
          title,
          body,
          icon: '/vite.svg',
          url: alert.deep_link || '/',
          data: {
            deepLink: alert.deep_link,
            alertId: alert.id,
            itemType: alert.item_type,
            itemId: alert.item_id,
          },
        });

        let dispatched = false;

        for (const sub of userSubs) {
          const pushConfig = {
            endpoint: sub.endpoint,
            keys: sub.keys || { p256dh: sub.p256dh, auth: sub.auth },
          };

          try {
            await webpush.sendNotification(pushConfig, payload);
            dispatched = true;
            sentCount++;
          } catch (err: any) {
            console.error(`Failed to send to ${sub.endpoint}:`, err);
            if (err.statusCode === 410 || err.statusCode === 404) {
              // Clean up expired subscriptions
              await supabase.from('user_push_subscriptions').delete().eq('endpoint', sub.endpoint);
            }
          }
        }

        // 5. Immediately mark the alert as sent so subsequent cron pings ignore it.
        if (dispatched) {
          await supabase
            .from('alert_notifications')
            .update({ sent: true, sent_at: new Date().toISOString() })
            .eq('id', alert.id);
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