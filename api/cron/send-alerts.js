// Vercel Cron Job: Send pending push notifications
// Triggered every minute via vercel.json cron configuration
// Query: SELECT * FROM alert_notifications WHERE alert_timestamp <= NOW() AND sent = false

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials');
  return;
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

export default async function handler(req, res) {
  // Only allow GET requests (Vercel Cron uses GET)
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Query pending alerts that need to be sent
    const { data: pendingAlerts, error: queryError } = await supabase
      .from('alert_notifications')
      .select('*')
      .lte('alert_timestamp', new Date().toISOString())
      .eq('sent', false)
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
        // Get user's push subscriptions
        const { data: subscriptions, error: subError } = await supabase
          .from('push_subscriptions')
          .select('*')
          .eq('user_id', alert.user_id)
          .eq('is_active', true);

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

        // Send push notification to all active subscriptions
        const pushPromises = subscriptions.map(sub => 
          sendPushNotification(supabase, sub, alert)
        );

        const results = await Promise.allSettled(pushPromises);
        const hasSuccess = results.some(r => r.status === 'fulfilled' && r.value === true);

        if (hasSuccess) {
          await markAsSent(supabase, alert.id);
          successCount++;
        } else {
          const errors = results.filter(r => r.status === 'rejected').map(r => r.reason);
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
      success: successCount,
      errors: errorCount
    });

  } catch (error) {
    console.error('Cron job error:', error);
    return res.status(500).json({ error: 'Internal server error', details: error.message });
  }
}

// Helper function to send a single push notification
async function sendPushNotification(supabase, subscription, alert) {
  try {
    // Get VAPID keys from environment
    const vapidPublicKey = process.env.VAPID_PUBLIC_KEY;
    const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;

    if (!vapidPublicKey || !vapidPrivateKey) {
      throw new Error('Missing VAPID keys');
    }

    // Prepare push payload
    const payload = JSON.stringify({
      title: alert.title,
      body: alert.body,
      icon: '/icon-192.png',
      badge: '/badge-72.png',
      data: {
        deepLink: alert.deep_link,
        alertId: alert.id,
        itemType: alert.item_type,
        itemId: alert.item_id
      }
    });

    // Send push notification using Web Push protocol
    const response = await fetch(subscription.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'TTL': '86400', // 24 hours
        'Urgency': 'normal'
      },
      body: payload
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Push failed: ${response.status} ${response.statusText} - ${errorText}`);
    }

    return true;

  } catch (error) {
    console.error(`Failed to send push to subscription ${subscription.id}:`, error);
    
    // If subscription is invalid (410 Gone), deactivate it
    if (error.message.includes('410') || error.message.includes('404')) {
      await supabase
        .from('push_subscriptions')
        .update({ is_active: false })
        .eq('id', subscription.id);
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
