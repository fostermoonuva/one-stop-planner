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
    const now = new Date().toISOString();

    // 1. Fetch active push subscriptions
    const { data: subscriptions, error: subError } = await supabase
      .from('user_push_subscriptions')
      .select('*')
      .eq('enabled', true);

    if (subError) throw new Error("Database error: " + subError.message);
    if (!subscriptions || subscriptions.length === 0) {
      return res.status(200).json({ success: true, message: 'No active subscriptions found', sent: 0 });
    }

    // 2. Fetch due events that haven't been notified yet
    const { data: events, error: eventError } = await supabase
      .from('events')
      .select('*')
      .lte('alert_timestamp', now)
      .or('alert_sent.is.null,alert_sent.eq.false');

    if (eventError) throw new Error("Database error: " + eventError.message);

    let sentCount = 0;
    const dueItems: { title: string; body: string }[] = [];

    // Format events into payloads
    if (events && events.length > 0) {
      for (const item of events) {
        dueItems.push({
          title: item.title ? `Event: ${item.title}` : 'Upcoming Event',
          body: item.start_time || item.startTime ? `Starts at ${item.start_time || item.startTime}` : 'Scheduled event reminder'
        });
      }
    }

    // Default fallback item if no specific items exist
    if (dueItems.length === 0) {
      dueItems.push({
        title: 'One Stop Planner',
        body: 'Scheduled planner update'
      });
    }

    // 3. Dispatch to registered devices
    for (const item of dueItems) {
      const payload = JSON.stringify({
        title: item.title,
        body: item.body,
        icon: '/vite.svg',
        url: '/'
      });

      for (const sub of subscriptions) {
        try {
          await webpush.sendNotification({
            endpoint: sub.endpoint,
            keys: sub.keys || { p256dh: sub.p256dh, auth: sub.auth }
          }, payload);
          sentCount++;
        } catch (err: any) {
          console.error(`Failed to send to ${sub.endpoint}:`, err?.message || err);
          if (err.statusCode === 410 || err.statusCode === 404) {
            await supabase.from('user_push_subscriptions').delete().eq('endpoint', sub.endpoint);
          }
        }
      }
    }

    // 4. Mark due events as notified to prevent re-sending on subsequent cron runs
    if (events && events.length > 0) {
      const eventIds = events.map((e: any) => e.id);
      const { error: updateError } = await supabase
        .from('events')
        .update({ alert_sent: true })
        .in('id', eventIds);

      if (updateError) {
        console.error("Failed to mark events as sent:", updateError.message);
      }
    }

    return res.status(200).json({
      success: true,
      notificationsSent: sentCount,
      timestamp: now
    });
  } catch (error: any) {
    console.error("Scheduled Dispatch Error:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
}