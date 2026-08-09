/**
 * Push notification subscription management
 * Handles permission requests, service worker registration, and push subscription storage
 */

const PUSH_TABLE = "user_push_subscriptions";

export interface PushSubscriptionData {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

export interface PushNotificationState {
  enabled: boolean;
  permission: NotificationPermission | "unsupported";
  subscription: PushSubscriptionData | null;
}

/**
 * Check if push notifications are supported
 */
export function isPushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

/**
 * Get current notification permission status
 */
export function getNotificationPermission(): NotificationPermission | "unsupported" {
  if (!isPushSupported()) return "unsupported";
  return Notification.permission;
}

/**
 * Request notification permission from the user
 */
export async function requestNotificationPermission(): Promise<NotificationPermission | "unsupported"> {
  if (!isPushSupported()) {
    return "unsupported";
  }

  try {
    const permission = await Notification.requestPermission();
    return permission;
  } catch (error) {
    console.error("Error requesting notification permission:", error);
    return "denied";
  }
}

/**
 * Register service worker and get push subscription
 */
export async function getPushSubscription(): Promise<PushSubscriptionData | null> {
  if (!isPushSupported()) {
    return null;
  }

  try {
    // Wait for service worker to be ready
    const registration = await navigator.serviceWorker.ready;
    
    // Get existing subscription or create new one
    let subscription = await registration.pushManager.getSubscription();
    
    if (!subscription) {
      // Create a new subscription
      // Note: In production, you would use your actual VAPID public key
      // For now, we'll use a placeholder - this needs to be configured
      const vapidPublicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY || "";
      
      if (!vapidPublicKey) {
        console.warn("VAPID public key not configured. Push notifications will not work.");
        return null;
      }

      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) as BufferSource,
      });
    }

    // Extract subscription data
    const subscriptionData = subscription.toJSON() as {
      endpoint: string;
      keys: {
        p256dh: string;
        auth: string;
      };
    };

    return {
      endpoint: subscriptionData.endpoint,
      keys: {
        p256dh: subscriptionData.keys.p256dh,
        auth: subscriptionData.keys.auth,
      },
    };
  } catch (error) {
    console.error("Error getting push subscription:", error);
    return null;
  }
}

/**
 * Save push subscription to Supabase
 */
export async function savePushSubscription(
  userId: string,
  subscription: PushSubscriptionData
): Promise<void> {
  const { supabase } = await import("./supabase");
  
  if (!supabase) {
    console.warn("Supabase not configured");
    return;
  }

  const { error } = await supabase.from(PUSH_TABLE).upsert(
    {
      user_id: userId,
      endpoint: subscription.endpoint,
      keys: subscription.keys,
      enabled: true,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );

  if (error) {
    console.error("Error saving push subscription:", error);
    throw error;
  }
}

/**
 * Remove push subscription from Supabase
 */
export async function removePushSubscription(userId: string): Promise<void> {
  const { supabase } = await import("./supabase");
  
  if (!supabase) {
    return;
  }

  // First, get the subscription to unsubscribe from it
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    
    if (subscription) {
      await subscription.unsubscribe();
    }
  } catch (error) {
    console.error("Error unsubscribing from push:", error);
  }

  // Remove from database
  const { error } = await supabase
    .from(PUSH_TABLE)
    .delete()
    .eq("user_id", userId);

  if (error) {
    console.error("Error removing push subscription:", error);
    throw error;
  }
}

/**
 * Load push subscription status from Supabase
 */
export async function loadPushSubscription(userId: string): Promise<PushNotificationState> {
  const { supabase } = await import("./supabase");
  
  if (!supabase || !isPushSupported()) {
    return {
      enabled: false,
      permission: "unsupported",
      subscription: null,
    };
  }

  try {
    const { data, error } = await supabase
      .from(PUSH_TABLE)
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    if (error) {
      console.error("Error loading push subscription:", error);
      return {
        enabled: false,
        permission: Notification.permission,
        subscription: null,
      };
    }

    return {
      enabled: data?.enabled ?? false,
      permission: Notification.permission,
      subscription: data?.endpoint
        ? {
            endpoint: data.endpoint,
            keys: data.keys as { p256dh: string; auth: string },
          }
        : null,
    };
  } catch (error) {
    console.error("Error loading push subscription:", error);
    return {
      enabled: false,
      permission: Notification.permission,
      subscription: null,
    };
  }
}

/**
 * Send a test notification
 */
export async function sendTestNotification(): Promise<void> {
  if (!isPushSupported()) {
    throw new Error("Push notifications not supported");
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    
    // Show a local notification for testing
    await registration.showNotification("One Stop Planner", {
      body: "🔔 Test notification - push notifications are working!",
      icon: "/vite.svg",
      badge: "/vite.svg",
      tag: "test-notification",
    });
  } catch (error) {
    console.error("Error sending test notification:", error);
    throw error;
  }
}

/**
 * Convert VAPID key from base64 to Uint8Array
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, "+")
    .replace(/_/g, "/");

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}