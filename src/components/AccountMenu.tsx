import { LogOut, X, Moon, Bell } from "lucide-react";
import { useState, useEffect } from "react";

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

  useEffect(() => {
    if (notificationSettings) {
      setLocalSettings(notificationSettings);
    }
  }, [notificationSettings]);

  const handleSave = async () => {
    if (!onSaveNotificationSettings) return;
    setSaving(true);
    try {
      await onSaveNotificationSettings(localSettings);
    } finally {
      setSaving(false);
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
        <div className="flex justify-center pt-2 mb-4">
          <div className="w-10 h-1 rounded-full dark:bg-white/10 bg-black/15" />
        </div>
        <div className="flex items-center justify-between mb-5">
          <h2 className="dark:text-slate-50 text-slate-900 font-bold text-base">Account</h2>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center dark:bg-white/10 bg-black/8"
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
