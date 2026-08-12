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

      const payload = JSON.stringify({
        title: 'One Stop Planner',
        body: 'You have upcoming scheduled items due soon!',
        icon: '/vite.svg',
        url: '/'
      });

      try {
        await webpush.sendNotification(pushConfig, payload);
        sentCount++;
      } catch (err: any) {
        console.error(`Failed to send to ${sub.endpoint}:`, err);
        if (err.statusCode === 410 || err.statusCode === 404) {
          // Clean up expired subscriptions
          await supabase.from('user_push_subscriptions').delete().eq('endpoint', sub.endpoint);
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