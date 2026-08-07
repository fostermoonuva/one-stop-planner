import {
  Dumbbell, Utensils,
  Check, Calendar, Target, Play,
  ChevronLeft, ChevronRight,
} from "lucide-react";
import type {
  CalEvent, CalTask, CalMeal, CalWorkout, CalGoal, GoalLog,
  Group, ActiveWO, Subtask, ModalKind, DetailKind,
} from "../app/App";
import {
  dKey, isToday, t2m, m2d, addDays, todayDate,
  eventApplies, taskApplies, goalApplies,
  gColor, gName, subtaskStats,
  DS, DF, MF,
  cardSty,
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
  onModal: (m: ModalKind) => void;
  setCalTasks: React.Dispatch<React.SetStateAction<CalTask[]>>;
  goalLogs: GoalLog[];
  toggleGoalLog: (goalId: string, date: Date) => void;
  onDetail: (kind: DetailKind, id: string) => void;
  username: string;
  onAccountClick: () => void;
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
          fill="none" stroke="rgba(255,255,255,.06)" strokeWidth="3.5"
        />
        <path
          d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
          fill="none" stroke={color} strokeWidth="3.5"
          strokeDasharray={`${pct},100`} strokeLinecap="round"
        />
        <text x="18" y="20.5" fontSize="7" textAnchor="middle"
          fill="#fff" fontWeight={700}>{pct}%</text>
      </svg>
      <p style={{ fontSize: 11, color: "#9CA3AF", marginTop: 6, fontWeight: 700 }}>{label}</p>
      <p style={{ fontSize: 11, color: "#4E4E72", marginTop: 2 }}>{subtitle}</p>
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
        <span style={{ fontSize: 10, color: "#4E4E72", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em" }}>{label}</span>
        <span style={{ fontSize: 11, color: "#9CA3AF", fontWeight: 700 }}>{value}{target > 0 ? ` / ${target}` : ""}</span>
      </div>
      <div className="h-2 rounded-full" style={{ backgroundColor: "rgba(255,255,255,.06)" }}>
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
  onModal, setCalTasks,
  goalLogs, toggleGoalLog,
  onDetail, username, onAccountClick,
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
      type: "workout" as const, color: "#F43F5E", done: false,
    })),
    ...timedTasks.filter(t => !t.done).map(t => ({
      id: t.id, title: t.title,
      startMin: t2m(t.dueTime), endMin: t2m(t.dueTime) + 30,
      type: "task" as const, color: gColor(groups, t.groupId), done: t.done,
    })),
  ].sort((a, b) => a.startMin - b.startMin);

  const nextItem = upcoming.find(item => item.startMin >= NowMin) ?? upcoming[0];

  // ── Today's Highlights: remaining uncompleted items ───────────────────────────
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
            className="w-8 h-8 rounded-full flex items-center justify-center"
            style={{ backgroundColor: "rgba(255,255,255,.06)" }}>
            <ChevronLeft size={15} style={{ color: "#7878A4" }} />
          </button>
          <div>
            <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#4E4E72" }}>
              {DF[selectedDate.getDay()]}
            </p>
            <h1 className="text-white font-bold leading-none" style={{ fontSize: 20 }}>
              {MF[selectedDate.getMonth()]} {selectedDate.getDate()}
            </h1>
          </div>
          <button onClick={() => setSelectedDate(addDays(selectedDate, 1))}
            className="w-8 h-8 rounded-full flex items-center justify-center"
            style={{ backgroundColor: "rgba(255,255,255,.06)" }}>
            <ChevronRight size={15} style={{ color: "#7878A4" }} />
          </button>
        </div>
        <div className="flex items-center gap-2">
          {!isToday(selectedDate) && (
            <button onClick={() => setSelectedDate(todayDate())}
              className="px-3 py-1.5 rounded-full text-xs font-bold"
              style={{ backgroundColor: "rgba(99,102,241,.2)", color: "#818CF8" }}>
              Today
            </button>
          )}
          <button
            type="button"
            onClick={onAccountClick}
            className="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold"
            style={{ fontSize: 11, background: "linear-gradient(135deg,#6366F1,#8B5CF6)" }}
            title={`@${username}`}>
            {username.slice(0, 2).toUpperCase()}
          </button>
        </div>
      </div>

      {/* Greeting */}
      <div className="px-5 pb-1 flex-shrink-0">
        <p className="text-white font-bold" style={{ fontSize: 18 }}>
          {greeting}, {username}
        </p>
      </div>

      {/* ── Metric Rings ── */}
      <div className="px-4 pb-2 flex-shrink-0">
        <div className="flex items-center gap-4 px-1">
          <ProgressRing pct={tasksPct} color="#6366F1" label="Tasks" subtitle={`${completedTasks}/${totalTasks}`} />
          <ProgressRing pct={goalsPct} color="#8B5CF6" label="Goals" subtitle={`${completedGoals}/${activeGoals}`} />
          <ProgressRing pct={eventsPct} color="#F97316" label="Events" subtitle={`${passedEvents}/${eventCount}`} />
        </div>
      </div>

      {/* ── Two-Column Dashboard ── */}
      <div className="flex-1 overflow-y-auto px-4 pb-24 space-y-4" style={{ scrollbarWidth: "none" }}>
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">

          {/* ── Left Column (Main Focus) ── */}
          <div className="lg:col-span-3 space-y-4">

            {/* Up Next Card */}
            <div className="rounded-2xl p-4" style={cardSty}>
              <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#4E4E72" }}>
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
                    <p className="text-white font-semibold text-sm truncate">{nextItem.title}</p>
                    <p style={{ fontSize: 11, color: "#4E4E72", marginTop: 2 }}>
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
                  <Calendar size={24} style={{ color: "#2A2A45" }} />
                  <p style={{ fontSize: 12, color: "#3A3A5A" }}>Nothing coming up next</p>
                </div>
              )}
            </div>

            {/* Today's Highlights */}
            <div className="rounded-2xl p-4" style={cardSty}>
              <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#4E4E72" }}>
                Today's Highlights
              </p>
              {(remainingTasks.length === 0 && remainingEvents.length === 0 && remainingWorkouts.length === 0 && remainingGoals.length === 0) ? (
                <div className="mt-3 flex flex-col items-center justify-center h-20 gap-2">
                  <Check size={20} style={{ color: "#F43F5E" }} />
                  <p style={{ fontSize: 12, color: "#F43F5E", fontWeight: 600 }}>All caught up!</p>
                </div>
              ) : (
                <div className="mt-2 space-y-2">
                  {/* Remaining tasks */}
                  {remainingTasks.map(t => (
                    <div key={t.id} onClick={() => onDetail("task", t.id)}
                      className="w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-left"
                      style={{ ...cardSty, cursor: "pointer" }}>
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
                        <p className="text-sm font-medium"
                          style={{ color: "#EEEEF8" }}>{t.title}</p>
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
                      className="w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-left"
                      style={{ ...cardSty, cursor: "pointer" }}>
                      <div className="w-4 h-4 rounded-full flex-shrink-0"
                        style={{ backgroundColor: gColor(groups, e.groupId) }} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium" style={{ color: "#EEEEF8" }}>{e.title}</p>
                        <p style={{ fontSize: 10, color: "#4E4E72", marginTop: 1 }}>
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
                      className="w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-left"
                      style={{ ...cardSty, cursor: "pointer" }}>
                      <div className="w-4 h-4 rounded-full flex-shrink-0" style={{ backgroundColor: "#F43F5E" }} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium" style={{ color: "#EEEEF8" }}>{w.name}</p>
                        <p style={{ fontSize: 10, color: "#4E4E72", marginTop: 1 }}>
                          {m2d(t2m(w.startTime))} – {m2d(t2m(w.endTime))}
                        </p>
                      </div>
                    </div>
                  ))}

                  {/* Remaining goals */}
                  {remainingGoals.map(g => (
                    <div key={g.id} onClick={() => onDetail("goal", g.id)}
                      className="w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-left"
                      style={{ ...cardSty, cursor: "pointer" }}>
                      <Target size={14} style={{ color: gColor(groups, g.groupId) }} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium" style={{ color: "#EEEEF8" }}>{g.title}</p>
                        <p style={{ fontSize: 10, color: "#4E4E72", marginTop: 1 }}>
                          {g.amount} {g.unit} · {g.days.map(d => DS[d]).join(", ")}
                        </p>
                      </div>
                      <button
                        onClick={e => { e.stopPropagation(); toggleGoalLog(g.id, selectedDate); }}
                        className="w-6 h-6 rounded-full border flex items-center justify-center flex-shrink-0"
                        style={{ borderColor: gColor(groups, g.groupId) }}>
                        <Check size={10} className="text-white" style={{ display: "none" }} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Quick Action Bar */}
            <div className="grid grid-cols-4 gap-2">
              {[
                { label: "Task",   icon: Check,    m: "task" as ModalKind,        c: "#6366F1" },
                { label: "Event",  icon: Calendar, m: "event" as ModalKind,       c: "#38BDF8" },
                { label: "Workout",icon: Dumbbell,  m: "startWorkout" as ModalKind,c: "#F43F5E" },
                { label: "Meal",   icon: Utensils,  m: "meal" as ModalKind,        c: "#FB923C" },
              ].map(o => (
                <button
                  key={o.label}
                  onClick={() => onModal(o.m)}
                  className="flex flex-col items-center gap-2 py-3.5 rounded-2xl"
                  style={{ backgroundColor: "rgba(255,255,255,.06)" }}>
                  <div className="w-9 h-9 rounded-full flex items-center justify-center"
                    style={{ backgroundColor: `${o.c}20` }}>
                    <o.icon size={17} style={{ color: o.c }} />
                  </div>
                  <span className="text-white font-semibold" style={{ fontSize: 10 }}>{o.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* ── Right Column (Life Snapshot) ── */}
          <div className="lg:col-span-2 space-y-4">

            {/* Fitness & Nutrition */}
            <div className="rounded-2xl p-4" style={cardSty}>
              <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#4E4E72" }}>
                Fitness & Nutrition
              </p>

              {/* Workout */}
              <div className="mt-3">
                {activeWorkout ? (
                  <div className="rounded-xl p-3 flex items-center gap-3"
                    style={{ backgroundColor: "rgba(244,63,94,.1)", outline: "1px solid rgba(244,63,94,.25)" }}>
                    <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: "rgba(244,63,94,.2)" }}>
                      <Dumbbell size={14} style={{ color: "#F43F5E" }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-semibold text-sm truncate">{activeWorkout.name}</p>
                      <p style={{ fontSize: 10, color: "#F43F5E" }}>In progress · {activeWorkout.exercises.length} exercises</p>
                    </div>
                    <Play size={12} style={{ color: "#F43F5E" }} />
                  </div>
                ) : todaysWorkout && !activeWorkout && (
                  <div className="rounded-xl p-3 flex items-center gap-3" style={{ backgroundColor: "rgba(244,63,94,.08)" }}>
                    <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: "rgba(244,63,94,.15)" }}>
                      <Dumbbell size={14} style={{ color: "#F43F5E" }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-semibold text-sm truncate">
                        {workoutsOnDay.length > 0 ? workoutsOnDay[0].name : "No workout today"}
                      </p>
                      {workoutsOnDay.length > 0 && (
                        <p style={{ fontSize: 10, color: "#4E4E72" }}>
                          {m2d(t2m(workoutsOnDay[0].startTime))} – {m2d(t2m(workoutsOnDay[0].endTime))}
                        </p>
                      )}
                    </div>
                  </div>
                )}
                {!activeWorkout && workoutsOnDay.length === 0 && (
                  <div className="rounded-xl p-3 flex items-center gap-3" style={{ backgroundColor: "rgba(244,63,94,.05)" }}>
                    <Dumbbell size={14} style={{ color: "#F43F5E" }} />
                    <span style={{ fontSize: 12, color: "#4E4E72" }}>No workout logged for today</span>
                  </div>
                )}
              </div>

              {/* Nutrition bars */}
              <div className="mt-4 space-y-3">
                <MacroBar label="Calories" value={totCal} target={CAL_TARGET} color="#FB923C" />
                <MacroBar label="Protein"  value={totPro}  target={PRO_TARGET}  color="#38BDF8" />
                <MacroBar label="Carbs"    value={totCarb} target={CARB_TARGET} color="#818CF8" />
                <MacroBar label="Fat"      value={totFat}  target={FAT_TARGET}  color="#F472B6" />
              </div>
            </div>

            {/* Habit Streaks */}
            <div className="rounded-2xl p-4" style={cardSty}>
              <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#4E4E72" }}>
                Habit Streaks
              </p>
              {todayGoalsWithStreak.length === 0 ? (
                <div className="mt-3 flex flex-col items-center justify-center h-20 gap-2">
                  <Target size={20} style={{ color: "#2A2A45" }} />
                  <p style={{ fontSize: 12, color: "#3A3A5A" }}>No daily goals for today</p>
                </div>
              ) : (
                <div className="mt-2 space-y-2">
                  {todayGoalsWithStreak.map(({ goal, streak }) => {
                    const c = gColor(groups, goal.groupId);
                    const logged = goalLogs.some(l => l.goalId === goal.id && l.date === dKey(selectedDate));
                    return (
                      <div key={goal.id} onClick={() => onDetail("goal", goal.id)}
                        className="flex items-center justify-between rounded-xl px-3 py-2.5"
                        style={{ ...cardSty, cursor: "pointer", opacity: logged ? 0.7 : 1 }}>
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-6 h-6 rounded-full flex-shrink-0" style={{ backgroundColor: `${c}25` }} />
                          <div className="flex-1 min-w-0">
                            <p className="text-white font-semibold text-sm truncate"
                              style={{ textDecoration: logged ? "line-through" : "none" }}>{goal.title}</p>
                            <p style={{ fontSize: 10, color: "#4E4E72", marginTop: 1 }}>
                              {goal.amount} {goal.unit}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {streak > 0 && (
                            <span className="text-xs font-bold" style={{ color: "#FBBF24" }}>
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
