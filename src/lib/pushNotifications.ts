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

// Cached service worker registration so subscribe() can run synchronously
// within a user gesture handler without awaiting navigator.serviceWorker.ready
let cachedRegistration: ServiceWorkerRegistration | null = null;

/**
 * Build a diagnostic string from any thrown value so callers can surface
 * the exact exception details in error toasts.
 */
export function formatErrorDetail(error: any): string {
  if (typeof error === "string") return error;
  if (error?.message) return error.message;
  if (typeof error === "object" && error !== null) {
    try {
      return JSON.stringify(error);
    } catch {
      return String(error);
    }
  }
  return String(error);
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
 * Get the VAPID public key from environment variables
 */
export function getVapidPublicKey(): string {
  return import.meta.env.VITE_VAPID_PUBLIC_KEY || "";
}

/**
 * Register the service worker for push notifications.
 * Should be called once when the app loads so the registration is cached
 * and available synchronously during user gesture handlers.
 */
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!isPushSupported()) return null;

  try {
    const registration = await navigator.serviceWorker.register("/sw.js");
    cachedRegistration = registration;
    console.log("✅ Service worker registered:", registration.scope);
    return registration;
  } catch (error) {
    console.error("❌ Service worker registration failed:", error);
    return null;
  }
}

/**
 * Request notification permission from the user.
 * IMPORTANT: Must be called synchronously within a user gesture handler (iOS requirement).
 */
export async function requestNotificationPermission(): Promise<NotificationPermission | "unsupported"> {
  if (!isPushSupported()) {
    return "unsupported";
  }

  try {
    const permission = await Notification.requestPermission();
    return permission;
  } catch (error: any) {
    console.error("Error requesting notification permission:", error);
    throw new Error(
      `requestNotificationPermission failed: ${formatErrorDetail(error)}`
    );
  }
}

/**
 * Subscribe to push notifications.
 * IMPORTANT: Must be called within a user gesture handler before any async backend queries.
 * Uses the cached service worker registration when available so subscribe() runs
 * synchronously in the gesture context on iOS.
 */
export async function subscribeToPush(): Promise<PushSubscriptionData> {
  if (!isPushSupported()) {
    throw new Error("Push notifications not supported in this browser");
  }

  const vapidPublicKey = getVapidPublicKey();
  if (!vapidPublicKey) {
    throw new Error("Configuration Error: VAPID Public Key missing");
  }

  try {
    // Use cached registration if available, otherwise wait for ready
    const registration = cachedRegistration ?? (await navigator.serviceWorker.ready);

    // IMPORTANT: Call pushManager.subscribe() IMMEDIATELY within the user gesture.
    // Do NOT await getSubscription() first — that async gap breaks the synchronous
    // gesture context on iOS and causes "Failed to enable push notifications".
    const vapidKeyArray = urlBase64ToUint8Array(vapidPublicKey);

    let subscription: PushSubscription;
    try {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: vapidKeyArray.buffer as ArrayBuffer,
      });
    } catch (subscribeError: any) {
      // Fallback: if subscribe() fails because a subscription already exists,
      // retrieve the existing one instead of throwing.
      let existing: PushSubscription | null = null;
      try {
        existing = await registration.pushManager.getSubscription();
      } catch (getSubscriptionError: any) {
        throw new Error(
          `pushManager.subscribe() failed: ${formatErrorDetail(
            subscribeError
          )}; getSubscription() also failed: ${formatErrorDetail(
            getSubscriptionError
          )}`
        );
      }
      if (!existing) {
        throw new Error(
          `pushManager.subscribe() failed: ${formatErrorDetail(subscribeError)}`
        );
      }
      subscription = existing;
    }

    // Extract subscription data
    const subscriptionData = subscription.toJSON() as {
      endpoint: string;
      keys: {
        p256dh: string;
        auth: string;
      };
    };

    if (!subscriptionData.endpoint || !subscriptionData.keys) {
      throw new Error("Invalid subscription data: missing endpoint or keys");
    }

    return {
      endpoint: subscriptionData.endpoint,
      keys: {
        p256dh: subscriptionData.keys.p256dh,
        auth: subscriptionData.keys.auth,
      },
    };
  } catch (error: any) {
    console.error("❌ Error subscribing to push:", error);
    throw new Error(`subscribeToPush failed: ${formatErrorDetail(error)}`);
  }
}

/**
 * Get existing push subscription (without creating a new one)
 */
export async function getPushSubscription(): Promise<PushSubscriptionData | null> {
  if (!isPushSupported()) {
    return null;
  }

  try {
    const registration = cachedRegistration ?? (await navigator.serviceWorker.ready);
    const subscription = await registration.pushManager.getSubscription();

    if (!subscription) return null;

    const subscriptionData = subscription.toJSON() as {
      endpoint: string;
      keys: {
        p256dh: string;
        auth: string;
      };
    };

    if (!subscriptionData.endpoint || !subscriptionData.keys) {
      return null;
    }

    return {
      endpoint: subscriptionData.endpoint,
      keys: {
        p256dh: subscriptionData.keys.p256dh,
        auth: subscriptionData.keys.auth,
      },
    };
  } catch (error) {
    console.error("❌ Error getting push subscription:", error);
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

  const endpoint = subscription.endpoint;
  const p256dh = subscription.keys?.p256dh;
  const auth = subscription.keys?.auth;

  if (!endpoint) {
    throw new Error("Invalid push subscription: Missing endpoint URL.");
  }

  // Try explicit upsert matching the endpoint column
  const { error } = await supabase
    .from(PUSH_TABLE)
    .upsert({
      user_id: userId,
      endpoint: endpoint,
      p256dh: p256dh,
      auth: auth,
      enabled: true,
      keys: subscription.keys,
      updated_at: new Date().toISOString()
    }, { onConflict: 'endpoint' });

  // Fallback: If PostgREST upsert fails on conflict constraint match, do a manual SELECT -> UPDATE / INSERT
  if (error) {
    console.warn("Upsert failed, falling back to query-check logic:", error.message);
    
    const { data: existing } = await supabase
      .from(PUSH_TABLE)
      .select('id')
      .eq('endpoint', endpoint)
      .maybeSingle();

    if (existing) {
      const { error: updateError } = await supabase
        .from(PUSH_TABLE)
        .update({
          user_id: userId,
          p256dh: p256dh,
          auth: auth,
          enabled: true,
          keys: subscription.keys,
          updated_at: new Date().toISOString()
        })
        .eq('id', existing.id);

      if (updateError) throw new Error("savePushSubscription update failed: " + updateError.message);
    } else {
      const { error: insertError } = await supabase
        .from(PUSH_TABLE)
        .insert({
          user_id: userId,
          endpoint: endpoint,
          p256dh: p256dh,
          auth: auth,
          enabled: true,
          keys: subscription.keys
        });

      if (insertError) throw new Error("savePushSubscription insert failed: " + insertError.message);
    }
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
  let unsubscribeError: unknown = null;
  try {
    const registration = cachedRegistration ?? (await navigator.serviceWorker.ready);
    const subscription = await registration.pushManager.getSubscription();
    
    if (subscription) {
      await subscription.unsubscribe();
    }
  } catch (error) {
    unsubscribeError = error;
    console.error("Error unsubscribing from push:", error);
  }

  // Remove from database
  const { error } = await supabase
    .from(PUSH_TABLE)
    .delete()
    .eq("user_id", userId);

  if (error) {
    console.error("Error removing push subscription:", error);
    throw new Error(`removePushSubscription failed: ${formatErrorDetail(error)}`);
  }

  // Surface any unsubscribe error AFTER the DB cleanup has been attempted
  if (unsubscribeError) {
    throw new Error(
      `removePushSubscription unsubscribe failed: ${formatErrorDetail(unsubscribeError)}`
    );
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
    const registration = cachedRegistration ?? (await navigator.serviceWorker.ready);
    
    // Show a local notification for testing
    await registration.showNotification("One Stop Planner", {
      body: "🔔 Test notification - push notifications are working!",
      icon: "/vite.svg",
      badge: "/vite.svg",
      tag: "test-notification",
    });
  } catch (error: any) {
    console.error("Error sending test notification:", error);
    throw new Error(`sendTestNotification failed: ${formatErrorDetail(error)}`);
  }
}

/**
 * Convert VAPID key from base64 to Uint8Array
 */
export function urlBase64ToUint8Array(base64String: string): Uint8Array {
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