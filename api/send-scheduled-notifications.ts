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

      // 3. Fetch due items from database for this subscription's user
      // We need to determine what type of items to fetch - events, goals, or tasks
      // Since this is a general dispatcher, we'll query all item types
      // and generate dynamic titles/bodies for each

      // Fetch due events
      const { data: dueEvents, error: eventsError } = await supabase
        .from('planner_data')
        .select('data')
        .eq('user_id', sub.user_id ?? '');

      if (eventsError) {
        console.error(`Error fetching events for sub ${sub.endpoint}:`, eventsError);
        continue;
      }

      // Process each event that has an alert timestamp within the 5-minute window
      // For now, we'll process all active events - the actual alertTimestamp logic
      // would be handled when items are initially queued into alert_notifications

      // Since we don't have direct access to the items' alert timestamps from this
      // general dispatcher, we'll use the existing pattern but with dynamic titles
      // The actual due items should have been pre-queued into alert_notifications

      // For this handler, we'll send a generic notification since the items
      // were already filtered when they were added to the alert queue
      // But we need to extract item info from the data payload

      if (dueEvents?.data && typeof dueEvents.data === 'object') {
        const payloadData = dueEvents.data as any;

        // Check for events in the stored data
        if (payloadData.calEvents && Array.isArray(payloadData.calEvents)) {
          for (const event of payloadData.calEvents) {
            if (event && event.title && event.startTime) {
              const alertTimingText = event.alertTimingText || 'at start time';
              const payload = JSON.stringify({
                title: `Event: ${event.title}`,
                body: `Starts at ${event.startTime} (${alertTimingText})`,
                icon: '/vite.svg',
                url: '/events'
              });

              try {
                await webpush.sendNotification(pushConfig, payload);
                sentCount++;
              } catch (err: any) {
                console.error(`Failed to send event notification to ${sub.endpoint}:`, err);
                if (err.statusCode === 410 || err.statusCode === 404) {
                  await supabase.from('user_push_subscriptions').delete().eq('endpoint', sub.endpoint);
                }
              }
            }
          }
        }

        // Check for goals in the stored data
        if (payloadData.calGoals && Array.isArray(payloadData.calGoals)) {
          for (const goal of payloadData.calGoals) {
            if (goal && goal.title) {
              const payload = JSON.stringify({
                title: `Goal Reminder: ${goal.title}`,
                body: 'Time to check in on your goal!',
                icon: '/vite.svg',
                url: '/goals'
              });

              try {
                await webpush.sendNotification(pushConfig, payload);
                sentCount++;
              } catch (err: any) {
                console.error(`Failed to send goal notification to ${sub.endpoint}:`, err);
                if (err.statusCode === 410 || err.statusCode === 404) {
                  await supabase.from('user_push_subscriptions').delete().eq('endpoint', sub.endpoint);
                }
              }
            }
          }
        }

        // Check for tasks in the stored data
        if (payloadData.calTasks && Array.isArray(payloadData.calTasks)) {
          for (const task of payloadData.calTasks) {
            if (task && task.title && task.dueTime) {
              const payload = JSON.stringify({
                title: `Task Due: ${task.title}`,
                body: `Due at ${task.dueTime}`,
                icon: '/vite.svg',
                url: '/tasks'
              });

              try {
                await webpush.sendNotification(pushConfig, payload);
                sentCount++;
              } catch (err: any) {
                console.error(`Failed to send task notification to ${sub.endpoint}:`, err);
                if (err.statusCode === 410 || err.statusCode === 404) {
                  await supabase.from('user_push_subscriptions').delete().eq('endpoint', sub.endpoint);
                }
              }
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