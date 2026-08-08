import { supabase } from "./supabase";

export interface PlannerDataPayload {
  calEvents: unknown[];
  calTasks: unknown[];
  calMeals: unknown[];
  calWorkouts: unknown[];
  calGoals: unknown[];
  goalLogs: unknown[];
  groups: unknown[];
  activeWorkout: unknown | null;
  budgetCategories: unknown[];
  budgetTransactions: unknown[];
  accounts: unknown[];
}

export type EventAlertOption = "none" | "at_time" | "5min" | "15min" | "30min" | "1hour" | "1day";
export type TaskAlertOption = "none" | "at_due" | "15min" | "1hour" | "9am_due_date";

export interface NotificationSettings {
  eventDefaultAlert: EventAlertOption;
  taskDefaultAlert: TaskAlertOption;
  goalDailyReminderTime: string | null;
  budgetAlert80Percent: boolean;
  budgetAlertUpcomingBills: boolean;
}

const TABLE = "planner_data";
const NOTIFICATION_TABLE = "user_notification_settings";

export async function loadPlannerData(userId: string): Promise<PlannerDataPayload | null> {
  if (!supabase) return null;

  const { data, error } = await supabase
    .from(TABLE)
    .select("data")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;
  if (!data?.data || typeof data.data !== "object") return null;
  return data.data as PlannerDataPayload;
}

export async function savePlannerData(userId: string, payload: PlannerDataPayload): Promise<void> {
  if (!supabase) return;

  const { error } = await supabase.from(TABLE).upsert(
    {
      user_id: userId,
      data: payload,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );

  if (error) throw error;
}

export function readLocalPlannerBackup(userId: string): PlannerDataPayload | null {
  try {
    const raw = localStorage.getItem(`lifeplanner_v2:${userId}`);
    if (!raw) return null;
    return JSON.parse(raw) as PlannerDataPayload;
  } catch {
    return null;
  }
}

export function writeLocalPlannerBackup(userId: string, payload: PlannerDataPayload): void {
  try {
    localStorage.setItem(`lifeplanner_v2:${userId}`, JSON.stringify(payload));
  } catch {
    /* quota */
  }
}

/** Legacy key from before auth — migrate once on first cloud login */
export function readLegacyLocalPlanner(): PlannerDataPayload | null {
  try {
    const raw = localStorage.getItem("lifeplanner_v2");
    if (!raw) return null;
    return JSON.parse(raw) as PlannerDataPayload;
  } catch {
    return null;
  }
}

export async function loadNotificationSettings(userId: string): Promise<NotificationSettings | null> {
  if (!supabase) return null;

  const { data, error } = await supabase
    .from(NOTIFICATION_TABLE)
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  return {
    eventDefaultAlert: (data.event_default_alert as EventAlertOption) || "15min",
    taskDefaultAlert: (data.task_default_alert as TaskAlertOption) || "15min",
    goalDailyReminderTime: data.goal_daily_reminder_time || null,
    budgetAlert80Percent: data.budget_alert_80_percent ?? true,
    budgetAlertUpcomingBills: data.budget_alert_upcoming_bills ?? true,
  };
}

export async function saveNotificationSettings(userId: string, settings: NotificationSettings): Promise<void> {
  if (!supabase) return;

  const { error } = await supabase.from(NOTIFICATION_TABLE).upsert(
    {
      user_id: userId,
      event_default_alert: settings.eventDefaultAlert,
      task_default_alert: settings.taskDefaultAlert,
      goal_daily_reminder_time: settings.goalDailyReminderTime,
      budget_alert_80_percent: settings.budgetAlert80Percent,
      budget_alert_upcoming_bills: settings.budgetAlertUpcomingBills,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );

  if (error) throw error;
}
