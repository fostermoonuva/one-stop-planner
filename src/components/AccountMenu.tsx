import { LogOut, X, Moon, Bell, ChevronLeft } from "lucide-react";
import { useState, useEffect } from "react";
import {
  isPushSupported,
  getNotificationPermission,
  getPushSubscription,
  savePushSubscription,
  removePushSubscription,
  loadPushSubscription,
  sendTestNotification,
  type PushNotificationState,
} from "../lib/pushNotifications";

export type EventAlertOption = "none" | "at_time" | "5min" | "15min" | "30min" | "1hour" | "1day";
export type TaskAlertOption = "none" | "at_due" | "15min" | "1hour" | "9am_due_date";

export interface NotificationSettings {
  eventDefaultAlert: EventAlertOption;
  taskDefaultAlert: TaskAlertOption;
  goalDailyReminderTime: string | null;
  budgetAlert80Percent: boolean;
  budgetAlertUpcomingBills: boolean;
}

export interface AccountMenuProps {
  username: string;
  syncStatus: "idle" | "saving" | "error";
  onSignOut: () => void;
  onClose: () => void;
  darkMode: boolean;
  onToggleDarkMode: () => void;
  notificationSettings?: NotificationSettings | null;
  onSaveNotificationSettings?: (settings: NotificationSettings) => Promise<void> | void;
  userId: string;
}

const EVENT_ALERT_OPTIONS: { value: EventAlertOption; label: string }[] = [
  { value: "none", label: "None" },
  { value: "at_time", label: "At time of event" },
  { value: "5min", label: "5 mins before" },
  { value: "15min", label: "15 mins before" },
  { value: "30min", label: "30 mins before" },
  { value: "1hour", label: "1 hour before" },
  { value: "1day", label: "1 day before" },
];

const TASK_ALERT_OPTIONS: { value: TaskAlertOption; label: string }[] = [
  { value: "none", label: "None" },
  { value: "at_due", label: "At due time" },
  { value: "15min", label: "15 mins before" },
  { value: "1hour", label: "1 hour before" },
  { value: "9am_due_date", label: "9:00 AM on due date" },
];

export function AccountMenu({
  username,
  syncStatus,
  onSignOut,
  onClose,
  darkMode,
  onToggleDarkMode,
  notificationSettings,
  onSaveNotificationSettings,
  userId,
}: AccountMenuProps) {
  const initials = username.slice(0, 2).toUpperCase();
  const [showNotifications, setShowNotifications] = useState(false);
  const [saving, setSaving] = useState(false);
  const [localSettings, setLocalSettings] = useState<NotificationSettings>({
    eventDefaultAlert: "15min",
    taskDefaultAlert: "15min",
    goalDailyReminderTime: null,
    budgetAlert80Percent: true,
    budgetAlertUpcomingBills: true,
  });

  // Push notification state
  const [pushState, setPushState] = useState<PushNotificationState>({
    enabled: false,
    permission: "unsupported",
    subscription: null,
  });
  const [pushLoading, setPushLoading] = useState(false);
  const [pushError, setPushError] = useState<string | null>(null);
  const [testNotificationSent, setTestNotificationSent] = useState(false);

  useEffect(() => {
    if (notificationSettings) {
      setLocalSettings(notificationSettings);
    }
  }, [notificationSettings]);

  // Load push notification state
  useEffect(() => {
    if (!userId || !isPushSupported()) {
      setPushState({
        enabled: false,
        permission: "unsupported",
        subscription: null,
      });
      return;
    }

    // Load subscription from Supabase and check current permission
    loadPushSubscription(userId).then((state) => {
      // If browser permission is granted, ensure toggle is not locked
      if (Notification.permission === "granted") {
        setPushState({
          ...state,
          permission: "granted",
        });
      } else {
        setPushState(state);
      }
    });
  }, [userId]);

  const handleSave = async () => {
    if (!onSaveNotificationSettings) return;
    setSaving(true);
    try {
      await onSaveNotificationSettings(localSettings);
    } finally {
      setSaving(false);
    }
  };

  const handlePushToggle = async () => {
    if (!isPushSupported()) {
      setPushError("Push notifications are not supported in this browser");
      return;
    }

    setPushLoading(true);
    setPushError(null);
    setTestNotificationSent(false);

    try {
      // If already enabled, disable it
      if (pushState.enabled) {
        await removePushSubscription(userId);
        setPushState({
          enabled: false,
          permission: getNotificationPermission(),
          subscription: null,
        });
        setPushLoading(false);
        return;
      }

      // iOS Safari requirement: Request permission IMMEDIATELY in response to user gesture
      // This must happen before any async database operations
      let permission = Notification.permission;
      if (permission === "default") {
        permission = await Notification.requestPermission();
      }

      if (permission === "granted") {
        // Permission granted - now proceed with async operations
        // Get push subscription (this will create one if it doesn't exist)
        const subscription = await getPushSubscription();

        // Save to Supabase
        await savePushSubscription(userId, subscription);
        
        setPushState({
          enabled: true,
          permission: "granted",
          subscription,
        });
      } else if (permission === "denied") {
        // Permission denied - likely iOS blocking
        setPushError(
          "Notifications blocked by iOS. Please go to iPhone Settings > One Stop Planner > Notifications and allow notifications."
        );
        setPushState({
          ...pushState,
          permission: "denied",
          enabled: false,
        });
      } else {
        // Default (not prompted)
        setPushError("Notification permission was not granted");
      }
    } catch (error) {
      console.error("Error toggling push notifications:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to enable push notifications. Please try again.";
      setPushError(errorMessage);
    } finally {
      setPushLoading(false);
    }
  };

  const handleTestNotification = async () => {
    if (!pushState.enabled) return;

    setPushLoading(true);
    setPushError(null);
    try {
      await sendTestNotification();
      setTestNotificationSent(true);
      setTimeout(() => setTestNotificationSent(false), 3000);
    } catch (error) {
      console.error("Error sending test notification:", error);
      setPushError("Failed to send test notification");
    } finally {
      setPushLoading(false);
    }
  };

  return (
    <div
      className="absolute inset-0 z-50 flex items-end"
      style={{ backgroundColor: "rgba(0,0,0,.5)", backdropFilter: "blur(10px)" }}
      onClick={onClose}
    >
      <div
        className="w-full rounded-t-3xl px-5 pb-8 pt-3 glass-modal"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Mobile back button + header */}
        <div className="flex items-center justify-between mb-5">
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center dark:bg-white/10 bg-black/8 hover:scale-110 transition-transform"
            aria-label="Back to app"
          >
            <ChevronLeft size={20} className="dark:text-slate-400 text-slate-700" />
          </button>
          <h2 className="dark:text-slate-50 text-slate-900 font-bold text-base">Account Settings</h2>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center dark:bg-white/10 bg-black/8"
            aria-label="Close"
          >
            <X size={14} className="dark:text-slate-400 text-slate-700" />
          </button>
        </div>

        <div className="flex items-center gap-3 rounded-2xl px-4 py-4 mb-4 glass-card">
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold"
            style={{ background: "linear-gradient(135deg,#6366F1,#8B5CF6)" }}
          >
            {initials}
          </div>
          <div>
            <p className="dark:text-stone-100 text-stone-900 font-semibold">@{username}</p>
            <p style={{ fontSize: 11, color: syncStatus === "error" ? "#EF4444" : darkMode ? "#78716C" : "#78716C" }}>
              {syncStatus === "saving"
                ? "Saving…"
                : syncStatus === "error"
                  ? "Could not sync — will retry"
                  : "Synced to your account"}
            </p>
          </div>
        </div>

        {/* Push Notifications Section */}
        {isPushSupported() && (
          <div className="rounded-2xl p-4 mb-3 dark:bg-white/5 bg-black/3">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Bell size={16} className="dark:text-indigo-400 text-indigo-600" />
                <span className="text-sm font-bold dark:text-slate-200 text-slate-800">
                  Push Notifications
                </span>
              </div>
              <button
                type="button"
                onClick={handlePushToggle}
                disabled={pushLoading}
                className={`relative w-12 h-7 rounded-full transition-colors ${
                  pushState.enabled
                    ? "bg-indigo-600"
                    : pushState.permission === "denied"
                    ? "bg-red-500/50"
                    : "dark:bg-white/10 bg-black/10"
                }`}
              >
                <div
                  className="absolute top-1 w-5 h-5 rounded-full bg-white shadow-sm transition-transform"
                  style={{
                    transform: pushState.enabled ? "translateX(22px)" : "translateX(4px)",
                  }}
                />
              </button>
            </div>

            {/* iOS Permission Error Banner */}
            {pushError && (
              <div className="rounded-xl p-3 mb-2 dark:bg-red-500/10 bg-red-500/10 border dark:border-red-500/30 border-red-500/30">
                <p className="text-xs dark:text-red-400 text-red-700 leading-relaxed">
                  {pushError}
                </p>
              </div>
            )}

            {/* Test Notification Button */}
            {pushState.enabled && (
              <button
                type="button"
                onClick={handleTestNotification}
                disabled={pushLoading}
                className="w-full py-2.5 rounded-xl text-xs font-bold dark:bg-indigo-500/20 bg-indigo-500/15 dark:text-indigo-400 text-indigo-600 hover:dark:bg-indigo-500/30 hover:bg-indigo-500/25 transition-colors disabled:opacity-50"
              >
                {testNotificationSent ? "✓ Test notification sent!" : pushLoading ? "Sending..." : "Send Test Notification"}
              </button>
            )}

            {/* Permission status hint */}
            {!pushState.enabled && pushState.permission !== "denied" && (
              <p className="text-[10px] dark:text-slate-500 text-slate-500 mt-1.5">
                {pushState.permission === "granted"
                  ? "Permission granted but not subscribed"
                  : "Tap to enable push notifications"}
              </p>
            )}

            {/* Graceful fallback for non-PWA contexts */}
            {!pushState.enabled && typeof window !== "undefined" && !("Notification" in window) && (
              <p className="text-[10px] dark:text-amber-400 text-amber-700 mt-1.5 italic">
                To enable notifications on iOS, please add this app to your Home Screen first.
              </p>
            )}
          </div>
        )}

        <button
          type="button"
          onClick={() => setShowNotifications(!showNotifications)}
          className="w-full flex items-center justify-between py-3.5 rounded-2xl font-bold text-sm mb-2 dark:bg-indigo-500/20 bg-indigo-500/15 dark:text-indigo-400 text-indigo-600"
        >
          <span className="flex items-center gap-2">
            <Bell size={16} />
            Default Alert Rules
          </span>
          <span style={{ fontSize: 10 }}>{showNotifications ? "▲" : "▼"}</span>
        </button>

        {showNotifications && (
          <div className="rounded-2xl p-4 mb-3 space-y-4 dark:bg-white/5 bg-black/3">
            <div>
              <p className="mb-2 text-xs font-bold uppercase tracking-wider dark:text-slate-400 text-slate-600">
                Events Default
              </p>
              <select
                value={localSettings.eventDefaultAlert}
                onChange={(e) => setLocalSettings({ ...localSettings, eventDefaultAlert: e.target.value as EventAlertOption })}
                className="w-full rounded-xl px-3 py-2.5 text-sm dark:bg-stone-900/60 bg-white/80 dark:text-slate-50 text-slate-900 border dark:border-stone-700 border-slate-200"
              >
                {EVENT_ALERT_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <p className="mb-2 text-xs font-bold uppercase tracking-wider dark:text-slate-400 text-slate-600">
                Tasks Default
              </p>
              <select
                value={localSettings.taskDefaultAlert}
                onChange={(e) => setLocalSettings({ ...localSettings, taskDefaultAlert: e.target.value as TaskAlertOption })}
                className="w-full rounded-xl px-3 py-2.5 text-sm dark:bg-stone-900/60 bg-white/80 dark:text-slate-50 text-slate-900 border dark:border-stone-700 border-slate-200"
              >
                {TASK_ALERT_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <p className="mb-2 text-xs font-bold uppercase tracking-wider dark:text-slate-400 text-slate-600">
                Goals / Habits Daily Reminder
              </p>
              <input
                type="time"
                value={localSettings.goalDailyReminderTime || ""}
                onChange={(e) => setLocalSettings({ ...localSettings, goalDailyReminderTime: e.target.value || null })}
                className="w-full rounded-xl px-3 py-2.5 text-sm dark:bg-stone-900/60 bg-white/80 dark:text-slate-50 text-slate-900 border dark:border-stone-700 border-slate-200"
              />
              {localSettings.goalDailyReminderTime && (
                <p className="mt-1 text-[10px] dark:text-slate-500 text-slate-500">
                  Remind me daily at {localSettings.goalDailyReminderTime}
                </p>
              )}
            </div>

            <div className="space-y-2.5">
              <p className="mb-2 text-xs font-bold uppercase tracking-wider dark:text-slate-400 text-slate-600">
                Budget Alerts
              </p>
              <label className="flex items-center justify-between cursor-pointer">
                <span className="text-sm dark:text-slate-300 text-slate-700">
                  Alert when approaching 80% of category limit
                </span>
                <div className="relative">
                  <input
                    type="checkbox"
                    checked={localSettings.budgetAlert80Percent}
                    onChange={(e) => setLocalSettings({ ...localSettings, budgetAlert80Percent: e.target.checked })}
                    className="sr-only"
                  />
                  <div
                    className="w-10 h-6 rounded-full transition-colors"
                    style={{ backgroundColor: localSettings.budgetAlert80Percent ? "#6366F1" : "rgba(255,255,255,.2)" }}
                  >
                    <div
                      className="w-4 h-4 rounded-full bg-white shadow-sm transition-transform"
                      style={{ transform: localSettings.budgetAlert80Percent ? "translateX(20px)" : "translateX(4px)", marginTop: 4 }}
                    />
                  </div>
                </div>
              </label>

              <label className="flex items-center justify-between cursor-pointer">
                <span className="text-sm dark:text-slate-300 text-slate-700">
                  Alert on upcoming recurring bills/subscriptions (1 day before)
                </span>
                <div className="relative">
                  <input
                    type="checkbox"
                    checked={localSettings.budgetAlertUpcomingBills}
                    onChange={(e) => setLocalSettings({ ...localSettings, budgetAlertUpcomingBills: e.target.checked })}
                    className="sr-only"
                  />
                  <div
                    className="w-10 h-6 rounded-full transition-colors"
                    style={{ backgroundColor: localSettings.budgetAlertUpcomingBills ? "#6366F1" : "rgba(255,255,255,.2)" }}
                  >
                    <div
                      className="w-4 h-4 rounded-full bg-white shadow-sm transition-transform"
                      style={{ transform: localSettings.budgetAlertUpcomingBills ? "translateX(20px)" : "translateX(4px)", marginTop: 4 }}
                    />
                  </div>
                </div>
              </label>
            </div>

            {onSaveNotificationSettings && (
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="w-full py-3 rounded-2xl font-bold text-sm text-white disabled:opacity-50"
                style={{ backgroundColor: "#6366F1" }}
              >
                {saving ? "Saving…" : "Save Preferences"}
              </button>
            )}
          </div>
        )}

        <button
          type="button"
          onClick={onToggleDarkMode}
          className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl font-bold text-sm mb-2 dark:bg-indigo-500/20 bg-indigo-500/15 dark:text-indigo-400 text-indigo-600"
        >
          <Moon size={16} />
          {darkMode ? "Light Mode" : "Dark Mode"}
        </button>

        {/* Bottom navigation hint for mobile */}
        <div className="mt-4 pt-3 border-t dark:border-white/10 border-black/10">
          <p className="text-[10px] text-center dark:text-slate-500 text-slate-500">
            Tap outside or use the back button to return to the app
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            onSignOut();
            onClose();
          }}
          className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl font-bold text-sm dark:bg-red-500/20 bg-red-500/15 dark:text-red-400 text-red-600"
        >
          <LogOut size={16} />
          Sign out
        </button>
      </div>
    </div>
  );
}
