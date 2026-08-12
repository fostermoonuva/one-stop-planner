// Vercel Cron Job: Send pending push notifications
// Triggered every minute via vercel.json cron configuration
// Query: SELECT * FROM alert_notifications WHERE sent = false AND alert_timestamp BETWEEN NOW() AND NOW() + interval '1 minute'

import { createClient } from '@supabase/supabase-js';
import webpush from 'web-push';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials');
  return;
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const vapidPublicKey = process.env.VITE_VAPID_PUBLIC_KEY || process.env.VAPID_PUBLIC_KEY;
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;

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
function buildTitle(itemType, entityTitle) {
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
function buildBody(itemType, alert) {
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

export default async function handler(req, res) {
  // Only allow GET requests (Vercel Cron uses GET)
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // ─── Strict Exact-Time Query ─────────────────────────────────────────────
    // Only select items where alertTimestamp falls within the narrow window
    // between now and now + 1 minute, AND that are un-sent.
    // This prevents re-dispatching stale alerts on every cron ping.
    const now = new Date();
    const windowEnd = new Date(now.getTime() + 60 * 1000); // now + 1 minute

    const { data: pendingAlerts, error: queryError } = await supabase
      .from('alert_notifications')
      .select('*')
      .eq('sent', false)
      .gte('alert_timestamp', now.toISOString())
      .lte('alert_timestamp', windowEnd.toISOString())
      .order('alert_timestamp', { ascending: true })
      .limit(100); // Process in batches

    if (queryError) {
      console.error('Error querying pending alerts:', queryError);
      return res.status(500).json({ error: 'Failed to query alerts', details: queryError.message });
    }

    if (!pendingAlerts || pendingAlerts.length === 0) {
      return res.status(200).json({ success: true, message: 'No pending alerts', processed: 0 });
    }

    console.log(`Processing ${pendingAlerts.length} pending alerts`);

    let successCount = 0;
    let errorCount = 0;

    // Process each alert
    for (const alert of pendingAlerts) {
      try {
        // Get user's active push subscriptions
        const { data: subscriptions, error: subError } = await supabase
          .from('user_push_subscriptions')
          .select('*')
          .eq('user_id', alert.user_id)
          .eq('enabled', true);

        if (subError) {
          console.error(`Error fetching subscriptions for user ${alert.user_id}:`, subError);
          errorCount++;
          continue;
        }

        if (!subscriptions || subscriptions.length === 0) {
          // No active subscriptions, mark as sent anyway
          await markAsSent(supabase, alert.id, 'No active subscriptions');
          successCount++;
          continue;
        }

        // Build context-aware notification payload
        const title = buildTitle(alert.item_type, alert.title);
        const body = buildBody(alert.item_type, alert);

        const payload = JSON.stringify({
          title,
          body,
          icon: '/vite.svg',
          badge: '/vite.svg',
          data: {
            deepLink: alert.deep_link,
            alertId: alert.id,
            itemType: alert.item_type,
            itemId: alert.item_id,
          },
        });

        // Send push notification to all active subscriptions
        const pushPromises = subscriptions.map(sub =>
          sendPushNotification(supabase, sub, payload, alert)
        );

        const results = await Promise.allSettled(pushPromises);
        const hasSuccess = results.some(r => r.status === 'fulfilled' && r.value === true);

        if (hasSuccess) {
          // ─── Sent Flag ─────────────────────────────────────────────────────
          // Immediately update the record upon successful dispatch so subsequent
          // cron pings ignore this alert.
          await markAsSent(supabase, alert.id);
          successCount++;
        } else {
          const errors = results.filter(r => r.status === 'rejected').map(r => r.reason);
          // Even on failure to a *specific* endpoint, mark as sent to avoid
          // duplicate retries on every ping. The error is recorded for visibility.
          await markAsSent(supabase, alert.id, errors.join('; '));
          errorCount++;
        }

      } catch (error) {
        console.error(`Error processing alert ${alert.id}:`, error);
        errorCount++;
      }
    }

    return res.status(200).json({
      success: true,
      message: `Processed ${pendingAlerts.length} alerts`,
      processed: pendingAlerts.length,
      sent: successCount,
      errors: errorCount
    });

  } catch (error) {
    console.error('Cron job error:', error);
    return res.status(500).json({ error: 'Internal server error', details: error.message });
  }
}

// Helper function to send a single push notification using web-push
async function sendPushNotification(supabase, subscription, payload, alert) {
  try {
    if (!vapidPublicKey || !vapidPrivateKey) {
      throw new Error('Missing VAPID keys');
    }

    const pushConfig = {
      endpoint: subscription.endpoint,
      keys: subscription.keys || { p256dh: subscription.p256dh, auth: subscription.auth },
    };

    // Send push notification using Web Push protocol
    await webpush.sendNotification(pushConfig, payload, {
      TTL: 86400, // 24 hours
      urgency: 'normal',
    });

    return true;

  } catch (error) {
    console.error(`Failed to send push to subscription ${subscription.id || subscription.endpoint}:`, error);

    // If subscription is invalid (410 Gone / 404 Not Found), delete it
    if (error.statusCode === 410 || error.statusCode === 404) {
      await supabase
        .from('user_push_subscriptions')
        .delete()
        .eq('endpoint', subscription.endpoint);
    }

    throw error;
  }
}

// Helper function to mark alert as sent
async function markAsSent(supabase, alertId, error = null) {
  const updateData = {
    sent: true,
    sent_at: new Date().toISOString()
  };

  if (error) {
    updateData.error = error;
  }

  const { error: updateError } = await supabase
    .from('alert_notifications')
    .update(updateData)
    .eq('id', alertId);

  if (updateError) {
    console.error(`Failed to mark alert ${alertId} as sent:`, updateError);
  }
}