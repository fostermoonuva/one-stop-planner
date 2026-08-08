import {
  Dumbbell, Wallet,
  Check, Calendar, Target, Play,
  ChevronLeft, ChevronRight,
} from "lucide-react";
import type {
  CalEvent, CalTask, CalMeal, CalWorkout, CalGoal, GoalLog,
  Group, ActiveWO, Subtask, DetailKind,
} from "../app/App";
import type { BudgetCategory, BudgetTransaction } from "./BudgetView";
import {
  dKey, isToday, t2m, m2d, addDays, todayDate,
  eventApplies, taskApplies, goalApplies,
  gColor, gName, subtaskStats,
  DS, DF, MF,
} from "../app/App";

// ─── Props ─────────────────────────────────────────────────────────────────────

export interface ExecutiveCommandCenterProps {
  selectedDate: Date;
  setSelectedDate: (d: Date) => void;
  calEvents: CalEvent[];
  calTasks: CalTask[];
  calWorkouts: CalWorkout[];
  calGoals: CalGoal[];
  calMeals: CalMeal[];
  groups: Group[];
  activeWorkout: ActiveWO | null;
  setCalTasks: React.Dispatch<React.SetStateAction<CalTask[]>>;
  goalLogs: GoalLog[];
  toggleGoalLog: (goalId: string, date: Date) => void;
  onDetail: (kind: DetailKind, id: string) => void;
  username: string;
  budgetCategories: BudgetCategory[];
  budgetTransactions: BudgetTransaction[];
}

// ─── Progress Ring ─────────────────────────────────────────────────────────────

function ProgressRing({ pct, color, label, subtitle }: {
  pct: number; color: string; label: string; subtitle: string;
}) {
  return (
    <div className="flex flex-col items-center" style={{ width: 88 }}>
      <svg viewBox="0 0 36 36" style={{ width: 56, height: 56 }}>
        <path
          d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
          fill="none" stroke="rgba(0,0,0,.08)" strokeWidth="3.5"
          className="dark:stroke-white/10"
        />
        <path
          d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
          fill="none" stroke={color} strokeWidth="3.5"
          strokeDasharray={`${pct},100`} strokeLinecap="round"
        />
        <text x="18" y="20.5" fontSize="7" textAnchor="middle"
          className="dark:fill-stone-100" fill="#1C1917" fontWeight={700}>{pct}%</text>
      </svg>
      <p className="dark:text-stone-400" style={{ fontSize: 11, color: "#78716C", marginTop: 6, fontWeight: 700 }}>{label}</p>
      <p className="dark:text-stone-500" style={{ fontSize: 11, color: "#78716C", marginTop: 2 }}>{subtitle}</p>
    </div>
  );
}

// ─── Streak helper ─────────────────────────────────────────────────────────────

function calculateStreak(goal: CalGoal, goalLogs: GoalLog[], today: Date): number {
  let streak = 0;
  const current = new Date(today);
  current.setHours(0, 0, 0, 0);
  for (let i = 0; i < 365; i++) {
    if (goalApplies(goal, current)) {
      const dateStr = dKey(current);
      const logged = goalLogs.some(l => l.goalId === goal.id && l.date === dateStr);
      if (logged) {
        streak++;
      } else {
        break;
      }
    }
    current.setDate(current.getDate() - 1);
  }
  return streak;
}

// ─── Macro Target Bar ──────────────────────────────────────────────────────────

function MacroBar({ label, value, target, color }: {
  label: string; value: number; target: number; color: string;
}) {
  const pct = target > 0 ? Math.min(100, Math.round((value / target) * 100)) : 0;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="dark:text-stone-400" style={{ fontSize: 10, color: "#78716C", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em" }}>{label}</span>
        <span className="dark:text-stone-300" style={{ fontSize: 11, color: "#78716C", fontWeight: 700 }}>{value}{target > 0 ? ` / ${target}` : ""}</span>
      </div>
      <div className="h-2 rounded-full dark:bg-white/10" style={{ backgroundColor: "rgba(0,0,0,.06)" }}>
        <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: color, minWidth: 2 }} />
      </div>
    </div>
  );
}

// ─── Subtask badge (inline, self-contained) ────────────────────────────────────

function SubtaskBadge({ subtasks, accentColor = "#6366F1" }: {
  subtasks: Subtask[] | undefined; accentColor?: string;
}) {
  const stats = subtaskStats(subtasks);
  if (!stats) return null;
  return (
    <span className="text-[9px] font-bold px-2 py-0.5 rounded-full flex-shrink-0"
      style={{ backgroundColor: `${accentColor}20`, color: accentColor }}>
      {stats.done}/{stats.total}
    </span>
  );
}

// ─── Executive Command Center ──────────────────────────────────────────────────

export default function ExecutiveCommandCenter({
  selectedDate, setSelectedDate,
  calEvents, calTasks, calWorkouts, calGoals, calMeals,
  groups, activeWorkout,
  setCalTasks,
  goalLogs, toggleGoalLog,
  onDetail, username,
  budgetCategories, budgetTransactions,
}: ExecutiveCommandCenterProps) {
  const now = new Date();
  const NowMin = now.getHours() * 60 + now.getMinutes();

  // ── Today's items ────────────────────────────────────────────────────────────
  const eventsOnDay   = calEvents.filter(e => eventApplies(e, selectedDate));
  const workoutsOnDay = calWorkouts.filter(w => w.date === dKey(selectedDate));
  const timedTasks    = calTasks.filter(t => taskApplies(t, selectedDate) && t.dueTime);
  const untimedTasks  = calTasks.filter(t => taskApplies(t, selectedDate) && !t.dueTime);
  const todaysGoals   = calGoals.filter(g => goalApplies(g, selectedDate));
  const todaysMeals   = calMeals.filter(m => m.date === dKey(selectedDate));

  // ── Metric ring calculations ─────────────────────────────────────────────────
  const totalTasks = timedTasks.length + untimedTasks.length;
  const completedTasks = timedTasks.concat(untimedTasks).filter(t => t.done).length;
  const tasksPct = totalTasks === 0 ? 0 : Math.round((completedTasks / totalTasks) * 100);

  const activeGoals = todaysGoals.length;
  const completedGoals = todaysGoals.filter(g =>
    goalLogs.some(l => l.goalId === g.id && l.date === dKey(selectedDate))
  ).length;
  const goalsPct = activeGoals === 0 ? 0 : Math.round((completedGoals / activeGoals) * 100);

  const eventCount = eventsOnDay.length + workoutsOnDay.length;
  const passedEvents =
    eventsOnDay.filter(e => t2m(e.endTime) && isToday(selectedDate) ? t2m(e.endTime) <= NowMin : false).length +
    workoutsOnDay.filter(w => t2m(w.endTime) && isToday(selectedDate) ? t2m(w.endTime) <= NowMin : false).length;
  const eventsPct = eventCount === 0 ? 0 : Math.round((passedEvents / eventCount) * 100);

  // ── Up Next: immediate next event or high-priority task ──────────────────────
  type UpcomingItem = {
    id: string; title: string; startMin: number; endMin: number;
    type: "event" | "task" | "workout"; color: string; done: boolean;
  };
  const upcoming: UpcomingItem[] = [
    ...eventsOnDay.map(e => ({
      id: e.id, title: e.title,
      startMin: t2m(e.startTime), endMin: t2m(e.endTime) || t2m(e.startTime) + 60,
      type: "event" as const, color: gColor(groups, e.groupId), done: false,
    })),
    ...workoutsOnDay.map(w => ({
      id: w.id, title: w.name,
      startMin: t2m(w.startTime), endMin: t2m(w.endTime) || t2m(w.startTime) + 60,
      type: "workout" as const, color: "#F97316", done: false,
    })),
    ...timedTasks.filter(t => !t.done).map(t => ({
      id: t.id, title: t.title,
      startMin: t2m(t.dueTime), endMin: t2m(t.dueTime) + 30,
      type: "task" as const, color: gColor(groups, t.groupId), done: t.done,
    })),
  ].sort((a, b) => a.startMin - b.startMin);

  const nextItem = upcoming.find(item => item.startMin >= NowMin) ?? upcoming[0];

  // ── Today's Highlights: remaining uncompleted items ────────────────────────────
  const remainingTasks = [...timedTasks.filter(t => !t.done), ...untimedTasks.filter(t => !t.done)];
  const remainingEvents = eventsOnDay.filter(e => {
    if (!isToday(selectedDate)) return true;
    const endM = t2m(e.endTime);
    return !endM || endM > NowMin;
  });
  const remainingWorkouts = workoutsOnDay.filter(w => {
    if (!isToday(selectedDate)) return true;
    const endM = t2m(w.endTime);
    return !endM || endM > NowMin;
  });
  const remainingGoals = todaysGoals.filter(g =>
    !goalLogs.some(l => l.goalId === g.id && l.date === dKey(selectedDate))
  );

  // ── Fitness & Nutrition ──────────────────────────────────────────────────────
  const todaysWorkout = activeWorkout ?? (workoutsOnDay.length > 0 ? workoutsOnDay[0] : null);
  const totCal  = todaysMeals.reduce((a, m) => a + m.calories, 0);
  const totPro  = todaysMeals.reduce((a, m) => a + m.protein, 0);
  const totCarb = todaysMeals.reduce((a, m) => a + m.carbs, 0);
  const totFat  = todaysMeals.reduce((a, m) => a + m.fat, 0);

  const CAL_TARGET = 2000, PRO_TARGET = 150, CARB_TARGET = 250, FAT_TARGET = 70;

  // ── Budget Calculations ──────────────────────────────────────────────────────
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const monthBudgetTransactions = budgetTransactions.filter(t => t.date.startsWith(currentMonth));
  
  const categorySpending = budgetCategories.map(cat => {
    const spent = monthBudgetTransactions
      .filter(t => t.categoryId === cat.id && t.type === "expense")
      .reduce((sum, t) => sum + t.amount, 0);
    const remaining = Math.max(0, cat.monthlyCap - spent);
    const percent = cat.monthlyCap > 0 ? Math.min((spent / cat.monthlyCap) * 100, 100) : 0;
    return { ...cat, spent, remaining, percent };
  });

  const totalBudget = budgetCategories.reduce((sum, cat) => sum + cat.monthlyCap, 0);
  const totalSpent = categorySpending.reduce((sum, cat) => sum + cat.spent, 0);
  const totalRemaining = totalBudget - totalSpent;

  // ── Habit Streaks ────────────────────────────────────────────────────────────
  const todayGoalsWithStreak = todaysGoals.map(g => ({
    goal: g,
    streak: calculateStreak(g, goalLogs, selectedDate),
  }));

  // ── Toggle task ──────────────────────────────────────────────────────────────
  const toggleTask = (id: string) =>
    setCalTasks(prev => prev.map(t => t.id === id ? { ...t, done: !t.done } : t));

  // ── Greeting ─────────────────────────────────────────────────────────────────
  const hour = now.getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* ── Header ── */}
      <div className="px-5 pt-10 pb-2 flex-shrink-0 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button onClick={() => setSelectedDate(addDays(selectedDate, -1))}
            className="w-8 h-8 rounded-full flex items-center justify-center dark:bg-white/10 bg-black/5"
            style={{ backgroundColor: "rgba(0,0,0,.06)" }}>
            <ChevronLeft size={15} className="dark:text-stone-400" style={{ color: "#78716C" }} />
          </button>
          <div>
            <p className="dark:text-stone-400" style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#78716C" }}>
              {DF[selectedDate.getDay()]}
            </p>
            <h1 className="text-stone-900 dark:text-stone-100 font-bold leading-none" style={{ fontSize: 20 }}>
              {MF[selectedDate.getMonth()]} {selectedDate.getDate()}
            </h1>
          </div>
          <button onClick={() => setSelectedDate(addDays(selectedDate, 1))}
            className="w-8 h-8 rounded-full flex items-center justify-center dark:bg-white/10 bg-black/5"
            style={{ backgroundColor: "rgba(0,0,0,.06)" }}>
            <ChevronRight size={15} className="dark:text-stone-400" style={{ color: "#78716C" }} />
          </button>
        </div>
        <div className="flex items-center gap-2">
          {!isToday(selectedDate) && (
            <button onClick={() => setSelectedDate(todayDate())}
              className="px-3 py-1.5 rounded-full text-xs font-bold dark:bg-indigo-500/20"
              style={{ backgroundColor: "rgba(99,102,241,.15)", color: "#6366F1" }}>
              Today
            </button>
          )}
        </div>
      </div>

      {/* Greeting */}
      <div className="px-5 pb-1 flex-shrink-0">
        <p className="text-stone-900 dark:text-stone-100 font-bold" style={{ fontSize: 18 }}>
          {greeting}, {username}
        </p>
      </div>

      {/* ── Metric Rings ── */}
      <div className="px-4 pb-2 flex-shrink-0">
        <div className="flex items-center gap-4 px-1">
          <ProgressRing pct={tasksPct} color="#10B981" label="Tasks" subtitle={`${completedTasks}/${totalTasks}`} />
          <ProgressRing pct={goalsPct} color="#6366F1" label="Goals" subtitle={`${completedGoals}/${activeGoals}`} />
          <ProgressRing pct={eventsPct} color="#F97316" label="Events" subtitle={`${passedEvents}/${eventCount}`} />
        </div>
      </div>

      {/* ── Two-Column Dashboard ── */}
      <div className="flex-1 overflow-y-auto px-4 pb-24 space-y-4" style={{ scrollbarWidth: "none" }}>
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">

          {/* ── Left Column (Main Focus) ── */}
          <div className="lg:col-span-3 space-y-4">

            {/* Up Next Card */}
            <div className="rounded-2xl p-4 glass-card-interactive">
              <p className="dark:text-stone-400" style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#78716C" }}>
                Up Next
              </p>
              {nextItem ? (
                <div className="mt-2 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center"
                    style={{ backgroundColor: `${nextItem.color}20` }}>
                    {nextItem.type === "event" ? (
                      <Calendar size={15} style={{ color: nextItem.color }} />
                    ) : nextItem.type === "workout" ? (
                      <Dumbbell size={15} style={{ color: nextItem.color }} />
                    ) : (
                      <Check size={15} style={{ color: nextItem.color }} />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-stone-900 dark:text-stone-100">{nextItem.title}</p>
                    <p className="text-stone-500 dark:text-stone-400" style={{ fontSize: 11, marginTop: 2 }}>
                      {m2d(nextItem.startMin)} – {m2d(nextItem.endMin)} · {nextItem.type}
                    </p>
                  </div>
                  <button
                    onClick={() => onDetail(nextItem.type === "event" ? "event" : nextItem.type === "workout" ? "workout" : "task", nextItem.id)}
                    className="px-2.5 py-1.5 rounded-xl text-xs font-bold"
                    style={{ backgroundColor: `${nextItem.color}20`, color: nextItem.color }}>
                    Open
                  </button>
                </div>
              ) : (
                <div className="mt-3 flex flex-col items-center justify-center h-24 gap-2">
                  <Calendar size={24} className="text-stone-500 dark:text-stone-400" style={{ color: "#78716C" }} />
                  <p className="text-stone-500 dark:text-stone-400" style={{ fontSize: 12 }}>Nothing coming up next</p>
                </div>
              )}
            </div>

            {/* Today's Highlights */}
            <div className="rounded-2xl p-4 glass-card">
              <p className="dark:text-stone-400" style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#78716C" }}>
                Today's Highlights
              </p>
              {(remainingTasks.length === 0 && remainingEvents.length === 0 && remainingWorkouts.length === 0 && remainingGoals.length === 0) ? (
                <div className="mt-3 flex flex-col items-center justify-center h-20 gap-2">
                  <Check size={20} style={{ color: "#10B981" }} />
                  <p style={{ fontSize: 12, color: "#10B981", fontWeight: 600 }}>All caught up!</p>
                </div>
              ) : (
                <div className="mt-2 space-y-2">
                  {/* Remaining tasks */}
                  {remainingTasks.map(t => (
                    <div key={t.id} onClick={() => onDetail("task", t.id)}
                      className="w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-left glass-card-interactive"
                      style={{ cursor: "pointer" }}>
                      <button
                        onClick={e => { e.stopPropagation(); toggleTask(t.id); }}
                        className="w-4 h-4 rounded-full border flex items-center justify-center flex-shrink-0"
                        style={{
                          borderColor: gColor(groups, t.groupId),
                          backgroundColor: t.done ? gColor(groups, t.groupId) : "transparent",
                        }}>
                        {t.done && <Check size={10} className="text-white" />}
                      </button>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-stone-900 dark:text-stone-100"
                          style={{ textDecoration: t.done ? "line-through" : "none" }}>{t.title}</p>
                      </div>
                      <SubtaskBadge subtasks={t.subtasks} accentColor={gColor(groups, t.groupId)} />
                      {t.groupId && (
                        <span className="text-[9px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0"
                          style={{ backgroundColor: `${gColor(groups, t.groupId)}20`, color: gColor(groups, t.groupId) }}>
                          {gName(groups, t.groupId)}
                        </span>
                      )}
                    </div>
                  ))}

                  {/* Remaining events */}
                  {remainingEvents.map(e => (
                    <div key={e.id} onClick={() => onDetail("event", e.id)}
                      className="w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-left glass-card-interactive"
                      style={{ cursor: "pointer" }}>
                      <div className="w-4 h-4 rounded-full flex-shrink-0"
                        style={{ backgroundColor: gColor(groups, e.groupId) }} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-stone-900 dark:text-stone-100">{e.title}</p>
                        <p className="text-stone-500 dark:text-stone-400" style={{ fontSize: 10, marginTop: 1 }}>
                          {m2d(t2m(e.startTime))} – {m2d(t2m(e.endTime))}
                        </p>
                      </div>
                      {e.groupId && (
                        <span className="text-[9px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0"
                          style={{ backgroundColor: `${gColor(groups, e.groupId)}20`, color: gColor(groups, e.groupId) }}>
                          {gName(groups, e.groupId)}
                        </span>
                      )}
                    </div>
                  ))}

                  {/* Remaining workouts */}
                  {remainingWorkouts.map(w => (
                    <div key={w.id} onClick={() => onDetail("workout", w.id)}
                      className="w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-left glass-card-interactive"
                      style={{ cursor: "pointer" }}>
                      <div className="w-4 h-4 rounded-full flex-shrink-0" style={{ backgroundColor: "#F97316" }} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-stone-900 dark:text-stone-100">{w.name}</p>
                        <p className="text-stone-500 dark:text-stone-400" style={{ fontSize: 10, marginTop: 1 }}>
                          {m2d(t2m(w.startTime))} – {m2d(t2m(w.endTime))}
                        </p>
                      </div>
                    </div>
                  ))}

                  {/* Remaining goals */}
                  {remainingGoals.map(g => (
                    <div key={g.id} onClick={() => onDetail("goal", g.id)}
                      className="w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-left glass-card-interactive"
                      style={{ cursor: "pointer" }}>
                      <Target size={14} style={{ color: gColor(groups, g.groupId) }} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-stone-900 dark:text-stone-100">{g.title}</p>
                        <p className="text-stone-500 dark:text-stone-400" style={{ fontSize: 10, marginTop: 1 }}>
                          {g.amount} {g.unit} · {g.days.map(d => DS[d]).join(", ")}
                        </p>
                      </div>
                      <button
                        onClick={e => { e.stopPropagation(); toggleGoalLog(g.id, selectedDate); }}
                        className="w-6 h-6 rounded-full border-2 flex items-center justify-center"
                        style={{ borderColor: gColor(groups, g.groupId) }}>
                        <Check size={10} className="text-white" style={{ display: "none" }} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Budget Highlights */}
            <div className="rounded-2xl p-4 glass-card">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Wallet size={14} style={{ color: "#6366F1" }} />
                  <p className="dark:text-stone-400" style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#78716C" }}>
                    Budget This Month
                  </p>
                </div>
              </div>

              {/* Summary */}
              <div className="grid grid-cols-3 gap-2 mb-3">
                <div className="rounded-xl p-2.5" style={{ backgroundColor: "rgba(0,0,0,.03)" }}>
                  <p className="text-stone-500 dark:text-stone-400" style={{ fontSize: 9, marginBottom: 2 }}>Budget</p>
                  <p className="font-bold" style={{ color: "#6366F1", fontSize: 14 }}>${totalBudget.toFixed(0)}</p>
                </div>
                <div className="rounded-xl p-2.5" style={{ backgroundColor: "rgba(0,0,0,.03)" }}>
                  <p className="text-stone-500 dark:text-stone-400" style={{ fontSize: 9, marginBottom: 2 }}>Spent</p>
                  <p className="font-bold" style={{ color: "#F43F5E", fontSize: 14 }}>${totalSpent.toFixed(0)}</p>
                </div>
                <div className="rounded-xl p-2.5" style={{ backgroundColor: "rgba(0,0,0,.03)" }}>
                  <p className="text-stone-500 dark:text-stone-400" style={{ fontSize: 9, marginBottom: 2 }}>Left</p>
                  <p className="font-bold" style={{ color: totalRemaining >= 0 ? "#10B981" : "#EF4444", fontSize: 14 }}>${totalRemaining.toFixed(0)}</p>
                </div>
              </div>

              {/* Category Breakdown */}
              {budgetCategories.length === 0 ? (
                <div className="text-center py-4">
                  <Wallet size={24} style={{ color: "#3A3A5A", marginBottom: 6 }} />
                  <p className="text-stone-500 dark:text-stone-400" style={{ fontSize: 11 }}>No budget categories yet</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {categorySpending.map(cat => (
                    <div key={cat.id} className="rounded-xl p-2.5" style={{ backgroundColor: "rgba(0,0,0,.03)" }}>
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2">
                          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: cat.color }} />
                          <span className="text-stone-900 dark:text-stone-100 text-xs font-semibold">{cat.name}</span>
                        </div>
                        <span className="text-stone-500 dark:text-stone-400 text-xs font-bold">
                          ${cat.spent.toFixed(0)} / ${cat.monthlyCap.toFixed(0)}
                        </span>
                      </div>
                      <div className="w-full h-1.5 rounded-full" style={{ backgroundColor: "rgba(0,0,0,.06)" }}>
                        <div
                          className="h-1.5 rounded-full transition-all"
                          style={{
                            width: `${cat.percent}%`,
                            backgroundColor: cat.spent > cat.monthlyCap ? "#EF4444" : cat.color
                          }}
                        />
                      </div>
                      <p className="text-right mt-1 text-stone-500 dark:text-stone-400" style={{ fontSize: 9 }}>
                        {cat.remaining >= 0 ? `${cat.remaining.toFixed(0)} left` : `${Math.abs(cat.remaining).toFixed(0)} over`}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* ── Right Column (Life Snapshot) ── */}
          <div className="lg:col-span-2 space-y-4">

            {/* Fitness & Nutrition */}
            <div className="rounded-2xl p-4 glass-card">
              <p className="dark:text-stone-400" style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#78716C" }}>
                Fitness & Nutrition
              </p>

              {/* Workout */}
              <div className="mt-3">
                {activeWorkout ? (
                  <div className="rounded-xl p-3 flex items-center gap-3"
                    style={{ backgroundColor: "rgba(249,115,22,.1)", outline: "1px solid rgba(249,115,22,.25)" }}>
                    <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: "rgba(249,115,22,.2)" }}>
                      <Dumbbell size={14} style={{ color: "#F97316" }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-stone-900 dark:text-stone-100 font-semibold text-sm truncate">{activeWorkout.name}</p>
                      <p style={{ fontSize: 10, color: "#F97316" }}>In progress · {activeWorkout.exercises.length} exercises</p>
                    </div>
                    <Play size={12} style={{ color: "#F97316" }} />
                  </div>
                ) : todaysWorkout && !activeWorkout && (
                  <div className="rounded-xl p-3 flex items-center gap-3" style={{ backgroundColor: "rgba(249,115,22,.08)" }}>
                    <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: "rgba(249,115,22,.15)" }}>
                      <Dumbbell size={14} style={{ color: "#F97316" }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-stone-900 dark:text-stone-100 font-semibold text-sm truncate">
                        {workoutsOnDay.length > 0 ? workoutsOnDay[0].name : "No workout today"}
                      </p>
                      {workoutsOnDay.length > 0 && (
                        <p className="text-stone-500 dark:text-stone-400" style={{ fontSize: 10 }}>
                          {m2d(t2m(workoutsOnDay[0].startTime))} – {m2d(t2m(workoutsOnDay[0].endTime))}
                        </p>
                      )}
                    </div>
                  </div>
                )}
                {!activeWorkout && workoutsOnDay.length === 0 && (
                  <div className="rounded-xl p-3 flex items-center gap-3" style={{ backgroundColor: "rgba(249,115,22,.05)" }}>
                    <Dumbbell size={14} style={{ color: "#F97316" }} />
                    <span className="text-stone-500 dark:text-stone-400" style={{ fontSize: 12 }}>No workout logged for today</span>
                  </div>
                )}
              </div>

              {/* Nutrition bars */}
              <div className="mt-4 space-y-3">
                <MacroBar label="Calories" value={totCal} target={CAL_TARGET} color="#F59E0B" />
                <MacroBar label="Protein"  value={totPro}  target={PRO_TARGET}  color="#3B82F6" />
                <MacroBar label="Carbs"    value={totCarb} target={CARB_TARGET} color="#6366F1" />
                <MacroBar label="Fat"      value={totFat}  target={FAT_TARGET}  color="#EC4899" />
              </div>
            </div>

            {/* Habit Streaks */}
            <div className="rounded-2xl p-4 glass-card">
              <p className="dark:text-stone-400" style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#78716C" }}>
                Habit Streaks
              </p>
              {todayGoalsWithStreak.length === 0 ? (
                <div className="mt-3 flex flex-col items-center justify-center h-20 gap-2">
                  <Target size={20} className="text-stone-500 dark:text-stone-400" style={{ color: "#78716C" }} />
                  <p className="text-stone-500 dark:text-stone-400" style={{ fontSize: 12 }}>No daily goals for today</p>
                </div>
              ) : (
                <div className="mt-2 space-y-2">
                  {todayGoalsWithStreak.map(({ goal, streak }) => {
                    const c = gColor(groups, goal.groupId);
                    const logged = goalLogs.some(l => l.goalId === goal.id && l.date === dKey(selectedDate));
                    return (
                       <div key={goal.id} onClick={() => onDetail("goal", goal.id)}
                         className="flex items-center justify-between rounded-xl px-3 py-2.5 glass-card-interactive"
                         style={{ cursor: "pointer", opacity: logged ? 0.7 : 1 }}>
                         <div className="flex items-center gap-2.5 min-w-0">
                           <div className="w-6 h-6 rounded-full flex-shrink-0" style={{ backgroundColor: `${c}25` }} />
                           <div className="flex-1 min-w-0">
                             <p className="text-stone-900 dark:text-stone-100 font-semibold text-sm truncate"
                               style={{ textDecoration: logged ? "line-through" : "none" }}>{goal.title}</p>
                             <p className="text-stone-500 dark:text-stone-400" style={{ fontSize: 10, marginTop: 1 }}>
                               {goal.amount} {goal.unit}
                             </p>
                           </div>
                         </div>
                         <div className="flex items-center gap-2 flex-shrink-0">
                           {streak > 0 && (
                             <span className="text-xs font-bold" style={{ color: "#F59E0B" }}>
                               🔥 {streak} Day{streak !== 1 ? "s" : ""}
                             </span>
                           )}
                           <button
                             onClick={e => { e.stopPropagation(); toggleGoalLog(goal.id, selectedDate); }}
                             className="w-6 h-6 rounded-full border-2 flex items-center justify-center"
                             style={{ borderColor: c, backgroundColor: logged ? c : "transparent" }}>
                             {logged && <Check size={10} className="text-white" />}
                           </button>
                         </div>
                       </div>
                     );
                  })}
                </div>
              )}
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
