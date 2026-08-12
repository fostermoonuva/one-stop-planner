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

      // 3. Fetch due notifications from alert_notifications queue
      const now = new Date().toISOString();
      
      const { data: dueEvents, error: eventsError } = await supabase
        .from('alert_notifications')
        .select('*')
        .lte('alert_timestamp', now)
        .or('sent.is.null,sent.eq.false')
        .eq('user_id', sub.user_id ?? '');

      if (eventsError) {
        console.error(`Error fetching events for sub ${sub.endpoint}:`, eventsError);
        continue;
      }

      // Process each due notification from the alert queue
      // Each dueEvents entry is an alert_notifications row with title, body, deep_link
      if (dueEvents && Array.isArray(dueEvents)) {
        for (const notification of dueEvents) {
          if (notification && notification.title && notification.body) {
            const payload = JSON.stringify({
              title: notification.title,
              body: notification.body,
              icon: '/vite.svg',
              url: notification.deep_link
            });

            try {
              await webpush.sendNotification(pushConfig, payload);
              sentCount++;
              // Mark as sent in the database
              await supabase
                .from('alert_notifications')
                .update({ sent: true, sent_at: new Date().toISOString() })
                .eq('id', notification.id);
            } catch (err: any) {
              console.error(`Failed to send notification to ${sub.endpoint}:`, err);
            }
          }
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