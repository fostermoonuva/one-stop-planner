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
}

const TABLE = "planner_data";

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
