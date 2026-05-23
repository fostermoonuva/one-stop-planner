import { useState, useRef, useEffect } from "react";
import {
  Home, BarChart3, Utensils, Target,
  Plus, X, Check, ChevronLeft, ChevronRight,
  Dumbbell, Settings, Trash2,
  Play, MoreHorizontal, Calendar,
} from "lucide-react";
import { AccountMenu } from "../components/AccountMenu";
import type { PlannerDataPayload } from "../lib/plannerStorage";
import {
  loadPlannerData,
  readLegacyLocalPlanner,
  readLocalPlannerBackup,
  savePlannerData,
  writeLocalPlannerBackup,
} from "../lib/plannerStorage";

export interface AppProps {
  userId: string;
  username: string;
  onSignOut: () => void | Promise<void>;
}

// ─── Types ────────────────────────────────────────────────────────────────────
type Screen     = "today" | "workout" | "month" | "meal" | "goals";
type TodayTab   = "all" | "events" | "tasks" | "goals" | "active";
type ModalKind  = "event" | "task" | "meal" | "goal" | "startWorkout" | "groups";
type DetailKind = "event" | "task" | "goal" | "meal" | "workout";
type MealType  = "breakfast" | "lunch" | "dinner" | "snack";
type GoalUnit  = "minutes" | "times";

interface Subtask    { id: string; title: string; dueDate: string; done: boolean; }
interface Group      { id: string; name: string; color: string; }
interface CalEvent   { id: string; title: string; startDate: string; endDate: string; startTime: string; endTime: string; groupId: string; notes: string; repeatDays: number[]; }
interface CalTask    { id: string; title: string; dueDate: string; dueTime: string; groupId: string; notes: string; done: boolean; repeatDays: number[]; subtasks: Subtask[]; }
interface CalMeal    { id: string; name: string; description: string; mealType: MealType; date: string; time: string; calories: number; protein: number; carbs: number; fat: number; }
interface WSet       { wt: number; reps: number; done: boolean; }
interface WExercise  { id: string; name: string; sets: WSet[]; }
interface CalWorkout { id: string; name: string; date: string; startTime: string; endTime: string; exercises: WExercise[]; }
interface CalGoal    { id: string; title: string; days: number[]; amount: number; unit: GoalUnit; groupId: string; }
interface GoalLog    { id: string; goalId: string; date: string; }
interface ActiveWO   { name: string; startedAt: string; exercises: WExercise[]; }
interface TLItem     { id: string; title: string; startMin: number; endMin: number; type: string; color: string; subtitle?: string; done?: boolean; }
interface LayItem extends TLItem { col: number; totalCols: number; }

// ─── Constants ────────────────────────────────────────────────────────────────
const DS = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
const DF = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
const MF = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const TL_START = 6 * 60, TL_END = 23 * 60, TL_H = TL_END - TL_START;
const PCOLORS = ["#818CF8","#38BDF8","#C084FC","#34D399","#FB923C","#F472B6","#EF4444","#FBBF24","#10B981","#06B6D4","#8B5CF6","#F43F5E"];
const DEFAULT_GROUPS: Group[] = [
  { id:"g1", name:"School",   color:"#818CF8" },
  { id:"g2", name:"Work",     color:"#38BDF8" },
  { id:"g3", name:"Personal", color:"#C084FC" },
  { id:"g4", name:"Fitness",  color:"#34D399" },
  { id:"g5", name:"Food",     color:"#FB923C" },
  { id:"g6", name:"Wellness", color:"#F472B6" },
];
// ─── Helpers ──────────────────────────────────────────────────────────────────
const todayDate  = () => { const n = new Date(); n.setHours(0,0,0,0); return n; };
const dKey    = (d: Date) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
const addDays = (d: Date, n: number) => { const r = new Date(d); r.setDate(d.getDate() + n); return r; };
const isToday = (d: Date) => dKey(d) === dKey(todayDate());
const t2m     = (t: string) => { if (!t) return 0; const [h, m] = t.split(":").map(Number); return h * 60 + m; };
const m2d     = (m: number) => { const h = Math.floor(m/60), mn = m%60, ap = h>=12?"PM":"AM", hr = h>12?h-12:h===0?12:h; return `${hr}${mn?":"+String(mn).padStart(2,"0"):""} ${ap}`; };
const fmtT    = (s: number) => `${String(Math.floor(s/60)).padStart(2,"0")}:${String(s%60).padStart(2,"0")}`;
const uid     = () => Math.random().toString(36).slice(2, 9);
const nowHHMM = () => { const d = new Date(); return `${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`; };

const eventApplies = (e: CalEvent, d: Date) => {
  const k = dKey(d), dow = d.getDay();
  if (e.repeatDays.length > 0) return k >= e.startDate && (!e.endDate || k <= e.endDate) && e.repeatDays.includes(dow);
  return k >= e.startDate && k <= e.endDate;
};
const taskApplies = (t: CalTask, d: Date) => {
  const k = dKey(d), dow = d.getDay();
  if (t.repeatDays.length > 0) return k >= t.dueDate && t.repeatDays.includes(dow);
  return t.dueDate === k;
};
const goalApplies = (g: CalGoal, d: Date) => g.days.includes(d.getDay());

const gColor = (groups: Group[], id: string) => groups.find(g => g.id === id)?.color ?? "#6366F1";
const gName  = (groups: Group[], id: string) => groups.find(g => g.id === id)?.name ?? "None";

const fmtDateStr = (s: string) => {
  const d = new Date(s + "T00:00:00");
  return `${DF[d.getDay()]}, ${MF[d.getMonth()].slice(0, 3)} ${d.getDate()}, ${d.getFullYear()}`;
};

const dayCount = (date: Date, ev: CalEvent[], ta: CalTask[]) =>
  ev.filter(e => eventApplies(e, date)).length + ta.filter(t => taskApplies(t, date)).length;

// ─── Layout Algorithm ─────────────────────────────────────────────────────────
function computeLayout(items: TLItem[]): LayItem[] {
  if (!items.length) return [];
  const sorted = [...items].sort((a, b) => a.startMin - b.startMin);
  const res: LayItem[] = sorted.map(x => ({ ...x, col: 0, totalCols: 1 }));
  const colEnds: number[] = [];
  for (const r of res) {
    let placed = false;
    for (let c = 0; c < colEnds.length; c++) {
      if (colEnds[c] <= r.startMin) { r.col = c; colEnds[c] = r.endMin; placed = true; break; }
    }
    if (!placed) { r.col = colEnds.length; colEnds.push(r.endMin); }
  }
  for (const r of res) {
    const mx = res.reduce((m, q) => (q !== r && q.startMin < r.endMin && q.endMin > r.startMin) ? Math.max(m, q.col + 1) : m, r.col + 1);
    r.totalCols = mx;
  }
  return res;
}

// ─── Shared Small Components ──────────────────────────────────────────────────
const inputCls = "w-full rounded-xl px-4 py-3 text-white text-sm outline-none";
const inputSty = { backgroundColor: "rgba(255,255,255,.07)", caretColor: "#6366F1" } as React.CSSProperties;
const labelSty = { color: "#4E4E72", fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" as const };
const cardSty  = { backgroundColor: "rgba(255,255,255,.05)" } as React.CSSProperties;

function DaySelector({ selected, onChange }: { selected: number[]; onChange: (d: number[]) => void }) {
  const toggle = (i: number) => onChange(selected.includes(i) ? selected.filter(x => x !== i) : [...selected, i]);
  return (
    <div className="flex gap-1.5">
      {["S","M","T","W","T","F","S"].map((d, i) => (
        <button key={i} onClick={() => toggle(i)} className="flex-1 h-8 rounded-lg text-xs font-bold"
          style={{ backgroundColor: selected.includes(i) ? "rgba(99,102,241,.25)" : "rgba(255,255,255,.06)",
            color: selected.includes(i) ? "#818CF8" : "#4E4E72",
            outline: selected.includes(i) ? "1px solid rgba(99,102,241,.45)" : "none" }}>
          {d}
        </button>
      ))}
    </div>
  );
}

function GroupPicker({ groups, selected, onChange }: { groups: Group[]; selected: string; onChange: (id: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      <button onClick={() => onChange("")} className="px-3 py-1.5 rounded-xl text-xs font-semibold"
        style={{ backgroundColor: !selected ? "rgba(99,102,241,.2)" : "rgba(255,255,255,.06)", color: !selected ? "#818CF8" : "#4E4E72" }}>
        None
      </button>
      {groups.map(g => (
        <button key={g.id} onClick={() => onChange(g.id)} className="px-3 py-1.5 rounded-xl text-xs font-semibold"
          style={{ backgroundColor: selected === g.id ? `${g.color}22` : "rgba(255,255,255,.06)",
            color: selected === g.id ? g.color : "#4E4E72",
            outline: selected === g.id ? `1px solid ${g.color}50` : "none" }}>
          {g.name}
        </button>
      ))}
    </div>
  );
}

function ModalShell({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="absolute inset-0 z-50 flex items-end" style={{ backgroundColor: "rgba(0,0,0,.72)", backdropFilter: "blur(10px)" }} onClick={onClose}>
      <div className="w-full rounded-t-3xl" style={{ backgroundColor: "#181824" }} onClick={e => e.stopPropagation()}>
        <div className="flex justify-center pt-3">
          <div className="w-10 h-1 rounded-full" style={{ backgroundColor: "rgba(255,255,255,.14)" }} />
        </div>
        <div className="flex items-center justify-between px-5 pt-3 pb-3">
          <h2 className="text-white font-bold text-base">{title}</h2>
          <button onClick={onClose} className="w-7 h-7 rounded-full flex items-center justify-center"
            style={{ backgroundColor: "rgba(255,255,255,.1)" }}>
            <X size={13} className="text-white" />
          </button>
        </div>
        <div className="px-5 pb-8 overflow-y-auto space-y-4" style={{ maxHeight: "82vh", scrollbarWidth: "none" }}>
          {children}
        </div>
      </div>
    </div>
  );
}

function InfoRow({ icon, label, children }: { icon: string; label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl px-4 py-3" style={{ backgroundColor: "rgba(255,255,255,.04)" }}>
      <div className="flex items-start gap-3">
        <span style={{ fontSize: 14, lineHeight: 1 }}>{icon}</span>
        <div>
          <p style={{ fontSize: 9, fontWeight: 700, color: "#4E4E72", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 2 }}>{label}</p>
          <p className="text-white text-sm" style={{ lineHeight: 1.5 }}>{children}</p>
        </div>
      </div>
    </div>
  );
}

// ─── Timeline Renderer ────────────────────────────────────────────────────────
function Timeline({ items, nowMin, onItemClick }: { items: TLItem[]; nowMin?: number; onItemClick?: (id: string, type: string) => void; }) {
  const laidOut = computeLayout(items);
  const HOURS = Array.from({ length: TL_END / 60 - TL_START / 60 + 1 }, (_, i) => i + TL_START / 60);

  return (
    <div className="relative" style={{ height: TL_H, minHeight: TL_H }}>
      {HOURS.map(h => (
        <div key={h} className="absolute left-0 right-0 flex items-start gap-2" style={{ top: (h - TL_START / 60) * 60 }}>
          <span className="w-11 text-right flex-shrink-0 leading-none" style={{ fontSize: 9, color: "#3A3A5A", fontWeight: 600, paddingTop: 1 }}>
            {h === 12 ? "12 PM" : h > 12 ? `${h-12} PM` : h === 0 ? "12 AM" : `${h} AM`}
          </span>
          <div className="flex-1 border-t" style={{ borderColor: "rgba(255,255,255,.04)", marginTop: 4 }} />
        </div>
      ))}
      {nowMin !== undefined && nowMin >= TL_START && nowMin <= TL_END && (
        <div className="absolute left-0 right-0 flex items-center z-20" style={{ top: nowMin - TL_START }}>
          <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ marginLeft: 38, backgroundColor: "#6366F1" }} />
          <div className="flex-1 h-px" style={{ backgroundColor: "#6366F1" }} />
        </div>
      )}
      {laidOut.map(item => {
        const top = item.startMin - TL_START;
        const height = Math.max(item.endMin - item.startMin, 26);
        const isTask = item.type === "task";
        const isSolid = item.type === "event" || item.type === "workout";
        return (
          <div key={item.id} onClick={onItemClick ? () => onItemClick(item.id, item.type) : undefined}
            style={{
              position: "absolute", top, height,
              left: `calc(44px + ${item.col / item.totalCols} * (100% - 44px))`,
              width: `calc(${1 / item.totalCols} * (100% - 44px) - 3px)`,
              backgroundColor: isSolid ? `${item.color}1E` : "transparent",
              border: !isSolid ? `1.5px solid ${item.color}55` : "none",
              borderLeft: `3px solid ${item.color}`,
              borderRadius: 10,
              opacity: item.done ? 0.45 : 1,
              overflow: "hidden",
              cursor: onItemClick ? "pointer" : "default",
            }}>
            <div className="flex items-center h-full px-2 py-1 gap-1.5">
              {isTask && (
                <div className="w-4 h-4 rounded-full border flex-shrink-0 flex items-center justify-center"
                  style={{ borderColor: item.color, backgroundColor: item.done ? item.color : "transparent" }}>
                  {item.done && <Check size={8} className="text-white" />}
                </div>
              )}
              <div className="flex flex-col justify-center flex-1 min-w-0">
                <p className="text-xs font-semibold leading-tight truncate"
                  style={{ color: item.done ? item.color : "#EEEEF8", textDecoration: item.done ? "line-through" : "none" }}>
                  {item.title}
                </p>
                {height > 32 && item.subtitle && (
                  <p style={{ fontSize: 9, color: item.color, opacity: 0.72, lineHeight: 1.3 }}>{item.subtitle}</p>
                )}
                {height > 44 && (
                  <p style={{ fontSize: 9, color: "#4A4A6A" }}>{m2d(item.startMin)} – {m2d(item.endMin)}</p>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Week Strip ───────────────────────────────────────────────────────────────
function WeekStrip({ selectedDate, onNavigate }: { selectedDate: Date; onNavigate: (d: Date) => void }) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(selectedDate, i - 3));
  return (
    <div className="flex items-center px-3 pb-3 gap-1">
      {days.map((day, i) => {
        const isSel = dKey(day) === dKey(selectedDate);
        const isTod = isToday(day);
        return (
          <button key={i} onClick={() => onNavigate(day)} className="flex-1 flex flex-col items-center gap-1">
            <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase",
              color: isSel ? "#EEEEF8" : "#3A3A5A" }}>
              {DS[day.getDay()]}
            </span>
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold"
              style={{
                backgroundColor: isSel ? "#6366F1" : isTod ? "rgba(99,102,241,.15)" : "transparent",
                color: isSel ? "#fff" : isTod ? "#818CF8" : "#585878",
                outline: isTod && !isSel ? "1px solid rgba(99,102,241,.45)" : "none",
              }}>
              {day.getDate()}
            </div>
            <div className="h-1.5 flex items-center justify-center">
              {isSel && <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" />}
            </div>
          </button>
        );
      })}
    </div>
  );
}

// ─── Today View ───────────────────────────────────────────────────────────────
function TodayView({
  selectedDate, setSelectedDate, todayTab, setTodayTab,
  calEvents, calTasks, calWorkouts, calGoals,
  groups, activeWorkout, onModal, setCalTasks,
  goalLogs, toggleGoalLog, onDetail, username, onAccountClick,
}: {
  selectedDate: Date; setSelectedDate: (d: Date) => void;
  todayTab: TodayTab; setTodayTab: (t: TodayTab) => void;
  calEvents: CalEvent[]; calTasks: CalTask[];
  calWorkouts: CalWorkout[]; calGoals: CalGoal[];
  groups: Group[]; activeWorkout: ActiveWO | null;
  onModal: (m: ModalKind) => void;
  setCalTasks: React.Dispatch<React.SetStateAction<CalTask[]>>;
  goalLogs: GoalLog[];
  toggleGoalLog: (goalId: string, date: Date) => void;
  onDetail: (kind: DetailKind, id: string) => void;
  username: string;
  onAccountClick: () => void;
}) {
  const tlRef = useRef<HTMLDivElement>(null);
  const now = new Date();
  const NowMin = now.getHours() * 60 + now.getMinutes();

  useEffect(() => {
    if (tlRef.current && (todayTab === "all" || todayTab === "events" || todayTab === "tasks")) {
      tlRef.current.scrollTop = Math.max(0, NowMin - TL_START - 120);
    }
  }, [todayTab, selectedDate]);

  const eventsOnDay   = calEvents.filter(e => eventApplies(e, selectedDate));
  const workoutsOnDay = calWorkouts.filter(w => w.date === dKey(selectedDate));
  const timedTasks    = calTasks.filter(t => taskApplies(t, selectedDate) && t.dueTime);
  const untimedTasks  = calTasks.filter(t => taskApplies(t, selectedDate) && !t.dueTime);
  const todaysGoals   = calGoals.filter(g => goalApplies(g, selectedDate));

  const buildTLItems = (tab: TodayTab): TLItem[] => {
    const items: TLItem[] = [];
    if (tab === "all" || tab === "events") {
      eventsOnDay.forEach(e => {
        const sM = t2m(e.startTime), eM = t2m(e.endTime) || sM + 60;
        items.push({ id: e.id, title: e.title, startMin: sM, endMin: Math.max(eM, sM + 30), type: "event", color: gColor(groups, e.groupId), subtitle: e.notes ? e.notes.split("\n")[0] : gName(groups, e.groupId) || undefined });
      });
    }
    if (tab === "all" || tab === "tasks") {
      timedTasks.forEach(t => {
        const sM = t2m(t.dueTime);
        items.push({ id: t.id, title: t.title, startMin: sM, endMin: sM + 30, type: "task", color: gColor(groups, t.groupId), done: t.done });
      });
    }
    if (tab === "events") {
      workoutsOnDay.forEach(w => {
        const sM = t2m(w.startTime), eM = t2m(w.endTime) || sM + 60;
        items.push({ id: w.id, title: w.name, startMin: sM, endMin: Math.max(eM, sM + 30), type: "workout", color: "#34D399", subtitle: `${w.exercises.length} exercise${w.exercises.length !== 1 ? "s" : ""}` });
      });
    }
    return items;
  };

  const toggleTask = (id: string) =>
    setCalTasks(prev => prev.map(t => t.id === id ? { ...t, done: !t.done } : t));

  const totalCount = eventsOnDay.length + timedTasks.length + untimedTasks.length + todaysGoals.length + workoutsOnDay.length + (activeWorkout ? 1 : 0);
  const tabs: { id: TodayTab; label: string; count: number }[] = [
    { id: "all",    label: "All",    count: totalCount },
    { id: "events", label: "Events", count: eventsOnDay.length },
    { id: "tasks",  label: "Tasks",  count: timedTasks.length + untimedTasks.length },
    { id: "goals",  label: "Goals",  count: todaysGoals.length },
    { id: "active", label: "Active", count: workoutsOnDay.length + (activeWorkout ? 1 : 0) },
  ];

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-5 pt-10 pb-2 flex-shrink-0 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button onClick={() => setSelectedDate(addDays(selectedDate, -1))}
            className="w-8 h-8 rounded-full flex items-center justify-center"
            style={{ backgroundColor: "rgba(255,255,255,.06)" }}>
            <ChevronLeft size={15} style={{ color: "#7878A4" }} />
          </button>
          <div className="text-center">
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
              className="px-3 py-1 rounded-full text-xs font-bold"
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

      {/* Week strip */}
      <div className="flex-shrink-0">
        <WeekStrip selectedDate={selectedDate} onNavigate={setSelectedDate} />
      </div>

      {/* Filter tabs */}
      <div className="flex-shrink-0 flex overflow-x-auto border-b" style={{ borderColor: "rgba(255,255,255,.06)", scrollbarWidth: "none" }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTodayTab(t.id)}
            className="flex-shrink-0 py-2.5 px-3 text-xs font-bold transition-colors whitespace-nowrap"
            style={{
              color: todayTab === t.id ? "#EEEEF8" : "#4E4E72",
              borderBottom: todayTab === t.id ? "2px solid #6366F1" : "2px solid transparent",
            }}>
            {t.label}
            {t.count > 0 && (
              <span className="ml-1 text-[9px] px-1.5 rounded-full inline-block"
                style={{ backgroundColor: "rgba(99,102,241,.25)", color: "#818CF8", lineHeight: "16px" }}>
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div ref={tlRef} className="flex-1 overflow-y-auto pb-28 px-4 pt-2" style={{ scrollbarWidth: "none" }}>

        {/* ── All (combined) ── */}
        {todayTab === "all" && (
          <>
            {totalCount === 0 && (
              <div className="flex flex-col items-center justify-center h-48 gap-3 pointer-events-none">
                <p style={{ fontSize: 13, color: "#3A3A5A" }}>Nothing scheduled — tap + to add</p>
              </div>
            )}

            {/* Timeline: events + timed tasks */}
            {(eventsOnDay.length > 0 || timedTasks.length > 0) && (
              <Timeline items={buildTLItems("all")} nowMin={isToday(selectedDate) ? NowMin : undefined}
                onItemClick={(id, type) => onDetail(type === "event" ? "event" : "task", id)} />
            )}

            {/* Untimed tasks */}
            {untimedTasks.length > 0 && (
              <div className="mt-4 space-y-2">
                <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#3A3A5A" }}>Due Today</p>
                {untimedTasks.map(t => (
                  <div key={t.id} onClick={() => onDetail("task", t.id)}
                    className="w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-left" style={{ ...cardSty, cursor: "pointer" }}>
                    <button onClick={e => { e.stopPropagation(); toggleTask(t.id); }}
                      className="w-5 h-5 rounded-full border flex items-center justify-center flex-shrink-0"
                      style={{ borderColor: gColor(groups, t.groupId), backgroundColor: t.done ? gColor(groups, t.groupId) : "transparent" }}>
                      {t.done && <Check size={10} className="text-white" />}
                    </button>
                    <p className="text-sm font-medium flex-1"
                      style={{ textDecoration: t.done ? "line-through" : "none", color: t.done ? "#4E4E72" : "#EEEEF8" }}>
                      {t.title}
                    </p>
                    {t.groupId && <span className="text-[9px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: `${gColor(groups, t.groupId)}20`, color: gColor(groups, t.groupId) }}>
                      {gName(groups, t.groupId)}
                    </span>}
                  </div>
                ))}
              </div>
            )}

            {/* Goals */}
            {todaysGoals.length > 0 && (
              <div className="mt-4 space-y-2">
                <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#3A3A5A" }}>Goals</p>
                {todaysGoals.map(g => {
                  const c = gColor(groups, g.groupId);
                  const logged = goalLogs.some(l => l.goalId === g.id && l.date === dKey(selectedDate));
                  return (
                    <div key={g.id} onClick={() => onDetail("goal", g.id)}
                      className="rounded-2xl p-4 flex items-center justify-between" style={{ ...cardSty, opacity: logged ? 0.7 : 1, cursor: "pointer" }}>
                      <div className="flex-1 min-w-0">
                        <p className="text-white font-semibold text-sm" style={{ textDecoration: logged ? "line-through" : "none" }}>{g.title}</p>
                        <p style={{ fontSize: 10, color: c, marginTop: 2 }}>{g.amount} {g.unit} · {g.days.map(d => DS[d]).join(", ")}</p>
                      </div>
                      <button onClick={e => { e.stopPropagation(); toggleGoalLog(g.id, selectedDate); }}
                        className="w-9 h-9 rounded-full border-2 flex items-center justify-center flex-shrink-0 ml-3"
                        style={{ borderColor: c, backgroundColor: logged ? c : "transparent" }}>
                        {logged ? <Check size={14} className="text-white" /> : <div className="w-3 h-3 rounded-full" style={{ backgroundColor: `${c}40` }} />}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Workouts */}
            {(activeWorkout || workoutsOnDay.length > 0) && (
              <div className="mt-4 space-y-2">
                <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#3A3A5A" }}>Active</p>
                {activeWorkout && (
                  <div className="rounded-2xl p-4" style={{ backgroundColor: "rgba(52,211,153,.1)", outline: "1px solid rgba(52,211,153,.25)" }}>
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full flex items-center justify-center" style={{ backgroundColor: "rgba(52,211,153,.2)" }}>
                        <Dumbbell size={16} style={{ color: "#34D399" }} />
                      </div>
                      <div className="flex-1">
                        <p className="text-white font-bold text-sm">{activeWorkout.name}</p>
                        <p style={{ fontSize: 10, color: "#34D399" }}>In progress · {activeWorkout.exercises.length} exercises</p>
                      </div>
                      <WorkoutElapsed startedAt={activeWorkout.startedAt} />
                    </div>
                  </div>
                )}
                {workoutsOnDay.map(w => (
                  <div key={w.id} onClick={() => onDetail("workout", w.id)} className="rounded-2xl p-4" style={{ ...cardSty, cursor: "pointer" }}>
                    <div className="flex items-center justify-between">
                      <p className="text-white font-semibold text-sm">{w.name}</p>
                      <p style={{ fontSize: 10, color: "#34D399" }}>{m2d(t2m(w.startTime))} – {m2d(t2m(w.endTime))}</p>
                    </div>
                    <p style={{ fontSize: 10, color: "#4E4E72", marginTop: 4 }}>{w.exercises.length} exercises · {w.exercises.reduce((a, e) => a + e.sets.filter(s => s.done).length, 0)} sets</p>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* ── Events ── */}
        {(todayTab === "events" || todayTab === "tasks") && (
          <>
            {todayTab === "events" && eventsOnDay.length === 0 && workoutsOnDay.length === 0 && (
              <div className="flex flex-col items-center justify-center h-48 gap-3 pointer-events-none">
                <Calendar size={28} style={{ color: "#2A2A45" }} />
                <p style={{ fontSize: 13, color: "#3A3A5A" }}>No events — tap + to add one</p>
              </div>
            )}
            {todayTab === "tasks" && timedTasks.length === 0 && untimedTasks.length === 0 && (
              <div className="flex flex-col items-center justify-center h-48 gap-3 pointer-events-none">
                <Check size={28} style={{ color: "#2A2A45" }} />
                <p style={{ fontSize: 13, color: "#3A3A5A" }}>No tasks — tap + to add one</p>
              </div>
            )}
            {todayTab === "tasks" && untimedTasks.length > 0 && (
              <div className="mb-4 space-y-2">
                <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#3A3A5A" }}>Due Today</p>
                {untimedTasks.map(t => (
                  <div key={t.id} onClick={() => onDetail("task", t.id)}
                    className="w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-left" style={{ ...cardSty, cursor: "pointer" }}>
                    <button onClick={e => { e.stopPropagation(); toggleTask(t.id); }}
                      className="w-5 h-5 rounded-full border flex items-center justify-center flex-shrink-0"
                      style={{ borderColor: gColor(groups, t.groupId), backgroundColor: t.done ? gColor(groups, t.groupId) : "transparent" }}>
                      {t.done && <Check size={10} className="text-white" />}
                    </button>
                    <p className="text-sm font-medium flex-1"
                      style={{ textDecoration: t.done ? "line-through" : "none", color: t.done ? "#4E4E72" : "#EEEEF8" }}>
                      {t.title}
                    </p>
                    {t.groupId && <span className="text-[9px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: `${gColor(groups, t.groupId)}20`, color: gColor(groups, t.groupId) }}>
                      {gName(groups, t.groupId)}
                    </span>}
                  </div>
                ))}
              </div>
            )}
            <Timeline items={buildTLItems(todayTab)} nowMin={isToday(selectedDate) ? NowMin : undefined}
              onItemClick={(id, type) => onDetail(type === "event" ? "event" : "task", id)} />
          </>
        )}

        {/* ── Goals ── */}
        {todayTab === "goals" && (
          <div className="pt-1 space-y-2">
            {todaysGoals.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 gap-3">
                <Target size={28} style={{ color: "#2A2A45" }} />
                <p style={{ fontSize: 13, color: "#3A3A5A" }}>No goals for {DF[selectedDate.getDay()]} — tap + to add</p>
              </div>
            ) : todaysGoals.map(g => {
              const c = gColor(groups, g.groupId);
              const logged = goalLogs.some(l => l.goalId === g.id && l.date === dKey(selectedDate));
              return (
                <div key={g.id} onClick={() => onDetail("goal", g.id)}
                  className="rounded-2xl p-4 flex items-center justify-between" style={{ ...cardSty, opacity: logged ? 0.7 : 1, cursor: "pointer" }}>
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-semibold text-sm" style={{ textDecoration: logged ? "line-through" : "none" }}>{g.title}</p>
                    <p style={{ fontSize: 10, color: c, marginTop: 2 }}>{g.amount} {g.unit} · {g.days.map(d => DS[d]).join(", ")}</p>
                  </div>
                  <button onClick={e => { e.stopPropagation(); toggleGoalLog(g.id, selectedDate); }}
                    className="w-10 h-10 rounded-full border-2 flex items-center justify-center flex-shrink-0 ml-3"
                    style={{ borderColor: c, backgroundColor: logged ? c : "transparent" }}>
                    {logged ? <Check size={16} className="text-white" /> : <div className="w-4 h-4 rounded-full" style={{ backgroundColor: `${c}40` }} />}
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* ── Active ── */}
        {todayTab === "active" && (
          <div className="pt-1 space-y-3">
            {activeWorkout ? (
              <div className="rounded-2xl p-4" style={{ backgroundColor: "rgba(52,211,153,.1)", outline: "1px solid rgba(52,211,153,.25)" }}>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center">
                    <Dumbbell size={18} style={{ color: "#34D399" }} />
                  </div>
                  <div className="flex-1">
                    <p className="text-white font-bold text-sm">{activeWorkout.name}</p>
                    <p style={{ fontSize: 10, color: "#34D399" }}>In progress · {activeWorkout.exercises.length} exercises</p>
                  </div>
                  <WorkoutElapsed startedAt={activeWorkout.startedAt} />
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-48 gap-4">
                <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{ backgroundColor: "rgba(52,211,153,.1)" }}>
                  <Dumbbell size={28} style={{ color: "#34D399" }} />
                </div>
                <p style={{ fontSize: 13, color: "#4E4E72" }}>No active workout</p>
                <button onClick={() => onModal("startWorkout")}
                  className="px-6 py-2.5 rounded-full font-bold text-sm"
                  style={{ backgroundColor: "rgba(52,211,153,.2)", color: "#34D399" }}>
                  Start Workout
                </button>
              </div>
            )}
            {workoutsOnDay.map(w => (
              <div key={w.id} onClick={() => onDetail("workout", w.id)} className="rounded-2xl p-4" style={{ ...cardSty, cursor: "pointer" }}>
                <div className="flex items-center justify-between">
                  <p className="text-white font-semibold text-sm">{w.name}</p>
                  <p style={{ fontSize: 10, color: "#34D399" }}>{m2d(t2m(w.startTime))} – {m2d(t2m(w.endTime))}</p>
                </div>
                <p style={{ fontSize: 10, color: "#4E4E72", marginTop: 4 }}>{w.exercises.length} exercises · {w.exercises.reduce((a, e) => a + e.sets.filter(s => s.done).length, 0)} sets completed</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// Workout elapsed timer
function WorkoutElapsed({ startedAt }: { startedAt: string }) {
  const [, tick] = useState(0);
  useEffect(() => { const id = setInterval(() => tick(t => t + 1), 1000); return () => clearInterval(id); }, []);
  const secs = Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000);
  return <span className="text-sm font-mono font-bold" style={{ color: "#34D399" }}>{fmtT(Math.max(0, secs))}</span>;
}

// ─── Workout Screen ───────────────────────────────────────────────────────────
function WorkoutScreen({
  calWorkouts, activeWorkout, onModal, onResumeWorkout, onDetail,
}: {
  calWorkouts: CalWorkout[];
  activeWorkout: ActiveWO | null;
  onModal: (m: ModalKind) => void;
  onResumeWorkout: () => void;
  onDetail: (kind: DetailKind, id: string) => void;
}) {
  const sorted = [...calWorkouts].sort((a, b) => {
    if (b.date !== a.date) return b.date.localeCompare(a.date);
    return b.startTime.localeCompare(a.startTime);
  });

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="px-5 pt-10 pb-4 flex-shrink-0 flex items-end justify-between">
        <div>
          <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#4E4E72" }}>Training</p>
          <h1 className="text-white font-bold" style={{ fontSize: 22 }}>Workouts</h1>
        </div>
        <button onClick={() => onModal("startWorkout")}
          className="flex items-center gap-2 px-4 py-2.5 rounded-full font-bold text-sm"
          style={{ background: "linear-gradient(135deg,#34D399,#10B981)", color: "#fff" }}>
          <Play size={13} fill="currentColor" /> Start
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-28 space-y-3" style={{ scrollbarWidth: "none" }}>
        {/* Active workout banner */}
        {activeWorkout && (
          <button onClick={onResumeWorkout} className="w-full rounded-2xl p-4 text-left"
            style={{ backgroundColor: "rgba(52,211,153,.1)", outline: "1.5px solid rgba(52,211,153,.3)" }}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: "rgba(52,211,153,.2)" }}>
                <Dumbbell size={18} style={{ color: "#34D399" }} />
              </div>
              <div className="flex-1 min-w-0">
                <p style={{ fontSize: 9, fontWeight: 700, color: "#34D399", letterSpacing: "0.08em", textTransform: "uppercase" }}>In Progress</p>
                <p className="text-white font-bold text-sm truncate">{activeWorkout.name}</p>
                <p style={{ fontSize: 10, color: "rgba(52,211,153,.7)" }}>{activeWorkout.exercises.length} exercises · tap to resume</p>
              </div>
              <WorkoutElapsed startedAt={activeWorkout.startedAt} />
            </div>
          </button>
        )}

        {/* Empty state */}
        {sorted.length === 0 && !activeWorkout && (
          <div className="flex flex-col items-center justify-center h-64 gap-4">
            <div className="w-20 h-20 rounded-full flex items-center justify-center"
              style={{ backgroundColor: "rgba(52,211,153,.08)", outline: "1px solid rgba(52,211,153,.15)" }}>
              <Dumbbell size={32} style={{ color: "rgba(52,211,153,.4)" }} />
            </div>
            <div className="text-center">
              <p className="text-white font-semibold text-sm">No workouts yet</p>
              <p style={{ fontSize: 12, color: "#3A3A5A", marginTop: 4 }}>Start your first session to track progress</p>
            </div>
            <button onClick={() => onModal("startWorkout")}
              className="px-8 py-3 rounded-full font-bold text-sm"
              style={{ background: "linear-gradient(135deg,#34D399,#10B981)", color: "#fff" }}>
              Start First Workout
            </button>
          </div>
        )}

        {sorted.length > 0 && (
          <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#3A3A5A" }}>History</p>
        )}
        {sorted.map(w => {
          const totalSets = w.exercises.reduce((a, e) => a + e.sets.length, 0);
          const doneSets  = w.exercises.reduce((a, e) => a + e.sets.filter(s => s.done).length, 0);
          const volume    = w.exercises.reduce((a, e) => a + e.sets.filter(s=>s.done).reduce((b,s)=>b+s.wt*s.reps,0), 0);
          const dur       = t2m(w.endTime) - t2m(w.startTime);
          const dateObj   = new Date(w.date + "T00:00:00");
          const label     = isToday(dateObj) ? "Today" : `${MF[dateObj.getMonth()].slice(0,3)} ${dateObj.getDate()}`;
          return (
            <div key={w.id} onClick={() => onDetail("workout", w.id)} className="rounded-2xl p-4" style={{ ...cardSty, cursor: "pointer" }}>
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1 min-w-0">
                  <p className="text-white font-bold text-sm truncate">{w.name}</p>
                  <p style={{ fontSize: 10, color: "#4E4E72", marginTop: 1 }}>{label} · {m2d(t2m(w.startTime))} – {m2d(t2m(w.endTime))}</p>
                </div>
                <div className="rounded-xl px-2.5 py-1 ml-2 flex-shrink-0" style={{ backgroundColor: "rgba(52,211,153,.12)" }}>
                  <p style={{ fontSize: 10, fontWeight: 700, color: "#34D399" }}>{dur}m</p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { l: "Exercises", v: w.exercises.length, c: "#818CF8" },
                  { l: "Sets Done",  v: `${doneSets}/${totalSets}`, c: "#38BDF8" },
                  { l: "Volume",     v: `${volume}lb`, c: "#34D399" },
                ].map(s => (
                  <div key={s.l} className="rounded-xl py-2 text-center" style={{ backgroundColor: "rgba(255,255,255,.04)" }}>
                    <p style={{ color: s.c, fontWeight: 700, fontSize: 12 }}>{s.v}</p>
                    <p style={{ color: "#4E4E72", fontSize: 9 }}>{s.l}</p>
                  </div>
                ))}
              </div>
              {w.exercises.length > 0 && (
                <div className="mt-3 space-y-1">
                  {w.exercises.slice(0, 3).map(ex => (
                    <div key={ex.id} className="flex items-center justify-between">
                      <p style={{ fontSize: 11, color: "#5A5A80" }}>{ex.name}</p>
                      <p style={{ fontSize: 10, color: "#3A3A5A" }}>{ex.sets.length} sets</p>
                    </div>
                  ))}
                  {w.exercises.length > 3 && (
                    <p style={{ fontSize: 10, color: "#3A3A5A" }}>+{w.exercises.length - 3} more</p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Month View ───────────────────────────────────────────────────────────────
function MonthView({ selectedDate, setSelectedDate, calEvents, calTasks }: {
  selectedDate: Date; setSelectedDate: (d: Date) => void;
  calEvents: CalEvent[]; calTasks: CalTask[];
}) {
  const [viewDate, setViewDate] = useState(new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1));
  const year = viewDate.getFullYear(), month = viewDate.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [...Array(firstDay).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  while (cells.length % 7 !== 0) cells.push(null);

  const wlFor = (day: number) => {
    const d = new Date(year, month, day);
    const n = dayCount(d, calEvents, calTasks);
    return n === 0 ? null : n <= 2 ? "#22C55E" : n <= 4 ? "#EAB308" : n <= 6 ? "#F97316" : "#EF4444";
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="px-5 pt-10 pb-3 flex-shrink-0 flex items-end justify-between">
        <div>
          <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#4E4E72" }}>Month</p>
          <h1 className="text-white font-bold" style={{ fontSize: 18 }}>{MF[month]} {year}</h1>
        </div>
        <div className="flex gap-1.5 mb-1">
          {[{ Icon: ChevronLeft, delta: -1 }, { Icon: ChevronRight, delta: 1 }].map(({ Icon, delta }) => (
            <button key={delta} onClick={() => setViewDate(new Date(year, month + delta, 1))}
              className="w-8 h-8 rounded-full flex items-center justify-center"
              style={{ backgroundColor: "rgba(255,255,255,.06)" }}>
              <Icon size={14} style={{ color: "#7878A4" }} />
            </button>
          ))}
        </div>
      </div>
      <div className="px-5 pb-2 flex-shrink-0 flex gap-3">
        {[["Light","#22C55E"],["Moderate","#EAB308"],["Busy","#F97316"],["Overloaded","#EF4444"]].map(([l,c]) => (
          <div key={l} className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: c }} />
            <span style={{ fontSize: 8, color: "#4E4E72", fontWeight: 600 }}>{l}</span>
          </div>
        ))}
      </div>
      <div className="px-4 pb-1 flex-shrink-0 grid grid-cols-7 gap-1">
        {["S","M","T","W","T","F","S"].map((d, i) => (
          <div key={i} className="text-center" style={{ fontSize: 9, fontWeight: 700, color: "#3A3A5A" }}>{d}</div>
        ))}
      </div>
      <div className="flex-1 overflow-y-auto px-4 pb-24" style={{ scrollbarWidth: "none" }}>
        <div className="grid grid-cols-7 gap-1">
          {cells.map((day, i) => {
            if (!day) return <div key={i} className="aspect-square" />;
            const d = new Date(year, month, day);
            const isSel = dKey(d) === dKey(selectedDate);
            const isTod = isToday(d);
            const wl = wlFor(day);
            const isPast = dKey(d) < dKey(todayDate());
            return (
              <button key={i} onClick={() => setSelectedDate(d)}
                className="aspect-square rounded-xl flex flex-col items-center justify-center"
                style={{ backgroundColor: wl ? `${wl}25` : "rgba(255,255,255,.02)", outline: isSel ? "2px solid #6366F1" : isTod && !isSel ? "1px solid rgba(99,102,241,.4)" : "none" }}>
                <span style={{ fontSize: 13, fontWeight: isSel || isTod ? 700 : 500, color: isSel ? "#818CF8" : isPast ? "rgba(238,238,248,.35)" : "#EEEEF8" }}>
                  {day}
                </span>
                {wl && <div className="w-1 h-1 rounded-full mt-0.5" style={{ backgroundColor: wl }} />}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Meal View ────────────────────────────────────────────────────────────────
function MealView({ selectedDate, setSelectedDate, calMeals, onModal, onDetail }: {
  selectedDate: Date; setSelectedDate: (d: Date) => void; calMeals: CalMeal[]; onModal: (m: ModalKind) => void;
  onDetail: (kind: DetailKind, id: string) => void;
}) {
  const todayMeals = calMeals.filter(m => m.date === dKey(selectedDate));
  const totCal  = todayMeals.reduce((a, m) => a + m.calories, 0);
  const totPro  = todayMeals.reduce((a, m) => a + m.protein, 0);
  const totCarb = todayMeals.reduce((a, m) => a + m.carbs, 0);
  const totFat  = todayMeals.reduce((a, m) => a + m.fat, 0);
  const MEAL_TYPES: MealType[] = ["breakfast", "lunch", "dinner", "snack"];
  const MEAL_ICONS: Record<MealType, string> = { breakfast: "🌅", lunch: "🌤", dinner: "🌙", snack: "🍎" };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="px-5 pt-10 pb-3 flex-shrink-0 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button onClick={() => setSelectedDate(addDays(selectedDate, -1))}
            className="w-8 h-8 rounded-full flex items-center justify-center" style={{ backgroundColor: "rgba(255,255,255,.06)" }}>
            <ChevronLeft size={14} style={{ color: "#7878A4" }} />
          </button>
          <div>
            <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#4E4E72" }}>Nutrition</p>
            <h1 className="text-white font-bold" style={{ fontSize: 18 }}>{MF[selectedDate.getMonth()].slice(0,3)} {selectedDate.getDate()}</h1>
          </div>
          <button onClick={() => setSelectedDate(addDays(selectedDate, 1))}
            className="w-8 h-8 rounded-full flex items-center justify-center" style={{ backgroundColor: "rgba(255,255,255,.06)" }}>
            <ChevronRight size={14} style={{ color: "#7878A4" }} />
          </button>
        </div>
        <button onClick={() => onModal("meal")}
          className="w-9 h-9 rounded-full flex items-center justify-center"
          style={{ background: "linear-gradient(135deg,#FB923C,#F97316)" }}>
          <Plus size={18} className="text-white" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto px-4 pb-28 space-y-4" style={{ scrollbarWidth: "none" }}>
        {todayMeals.length > 0 && (
          <div className="rounded-2xl p-4" style={cardSty}>
            <div className="flex items-center justify-between mb-3">
              <p className="text-white font-bold text-sm">Today's Total</p>
              <p className="font-bold" style={{ color: "#FB923C", fontSize: 15 }}>{totCal} kcal</p>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {[{ l:"Protein", v:totPro, c:"#38BDF8" }, { l:"Carbs", v:totCarb, c:"#818CF8" }, { l:"Fat", v:totFat, c:"#F472B6" }].map(n => (
                <div key={n.l} className="rounded-xl py-2.5 text-center" style={{ backgroundColor: "rgba(255,255,255,.04)" }}>
                  <p className="font-bold leading-none" style={{ color: n.c, fontSize: 16 }}>{n.v}g</p>
                  <p style={{ fontSize: 10, color: "#4E4E72", marginTop: 2 }}>{n.l}</p>
                </div>
              ))}
            </div>
          </div>
        )}
        {MEAL_TYPES.map(type => {
          const meals = todayMeals.filter(m => m.mealType === type);
          return (
            <div key={type}>
              <div className="flex items-center gap-2 mb-2">
                <span>{MEAL_ICONS[type]}</span>
                <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "capitalize", color: "#4E4E72" }}>{type}</p>
                {meals.length > 0 && <span style={{ fontSize: 9, color: "#FB923C" }}>{meals.reduce((a,m)=>a+m.calories,0)} cal</span>}
              </div>
              {meals.length > 0 ? meals.map(m => (
                <div key={m.id} onClick={() => onDetail("meal", m.id)} className="rounded-2xl p-3.5 mb-2 flex items-start justify-between" style={{ ...cardSty, cursor: "pointer" }}>
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-semibold text-sm">{m.name}</p>
                    {m.description && <p style={{ fontSize: 11, color: "#5A5A80", marginTop: 2 }}>{m.description}</p>}
                    <div className="flex gap-2 mt-1.5">
                      {[{l:"P",v:m.protein,c:"#38BDF8"},{l:"C",v:m.carbs,c:"#818CF8"},{l:"F",v:m.fat,c:"#F472B6"}].map(n=>(
                        <span key={n.l} style={{ fontSize: 9, color: n.c, fontWeight: 700 }}>{n.l}: {n.v}g</span>
                      ))}
                    </div>
                  </div>
                  <span className="font-bold flex-shrink-0" style={{ color: "#FB923C", fontSize: 14 }}>{m.calories}</span>
                </div>
              )) : (
                <button onClick={() => onModal("meal")}
                  className="w-full rounded-xl py-3 border border-dashed text-xs font-semibold"
                  style={{ borderColor: "rgba(255,255,255,.1)", color: "#3A3A5A" }}>
                  + Log {type}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Goals View ───────────────────────────────────────────────────────────────
function GoalsView({ calGoals, groups, onModal, goalLogs, toggleGoalLog, onDetail }: {
  calGoals: CalGoal[]; groups: Group[]; onModal: (m: ModalKind) => void;
  goalLogs: GoalLog[]; toggleGoalLog: (goalId: string, date: Date) => void;
  onDetail: (kind: DetailKind, id: string) => void;
}) {
  const today = todayDate();
  // Build last 7 days for the streak dots
  const last7 = Array.from({ length: 7 }, (_, i) => addDays(today, i - 6));

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="px-5 pt-10 pb-3 flex-shrink-0 flex items-end justify-between">
        <div>
          <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#4E4E72" }}>Goals & Habits</p>
          <h1 className="text-white font-bold" style={{ fontSize: 18 }}>Your Goals</h1>
        </div>
        <div className="flex gap-2 mb-1">
          <button onClick={() => onModal("groups")} className="w-8 h-8 rounded-full flex items-center justify-center"
            style={{ backgroundColor: "rgba(255,255,255,.06)" }}>
            <Settings size={14} style={{ color: "#7878A4" }} />
          </button>
          <button onClick={() => onModal("goal")} className="w-8 h-8 rounded-full flex items-center justify-center"
            style={{ backgroundColor: "rgba(99,102,241,.2)" }}>
            <Plus size={16} style={{ color: "#818CF8" }} />
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-4 pb-28 space-y-3" style={{ scrollbarWidth: "none" }}>
        {calGoals.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 gap-3">
            <Target size={32} style={{ color: "#3A3A5A" }} />
            <p style={{ fontSize: 13, color: "#3A3A5A" }}>No goals yet</p>
            <button onClick={() => onModal("goal")} className="px-5 py-2 rounded-full font-bold text-sm"
              style={{ backgroundColor: "rgba(99,102,241,.2)", color: "#818CF8" }}>
              Add your first goal
            </button>
          </div>
        ) : calGoals.map(g => {
          const c = gColor(groups, g.groupId);
          const todayLogged = goalLogs.some(l => l.goalId === g.id && l.date === dKey(today));
          return (
            <div key={g.id} onClick={() => onDetail("goal", g.id)} className="rounded-2xl p-4" style={{ ...cardSty, cursor: "pointer" }}>
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1 min-w-0">
                  <p className="text-white font-semibold text-sm">{g.title}</p>
                  <p style={{ fontSize: 10, color: c, marginTop: 2 }}>{g.amount} {g.unit} · {g.days.map(d => DS[d]).join(", ")}</p>
                </div>
                <div className="flex items-center gap-2 ml-2 flex-shrink-0">
                  {g.groupId && <span className="text-[9px] font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: `${c}20`, color: c }}>{gName(groups, g.groupId)}</span>}
                  {goalApplies(g, today) && (
                    <button onClick={e => { e.stopPropagation(); toggleGoalLog(g.id, today); }}
                      className="w-8 h-8 rounded-full border-2 flex items-center justify-center"
                      style={{ borderColor: c, backgroundColor: todayLogged ? c : "transparent" }}>
                      {todayLogged ? <Check size={13} className="text-white" /> : <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: `${c}40` }} />}
                    </button>
                  )}
                </div>
              </div>
              {/* 7-day streak dots */}
              <div className="flex gap-1 mt-3">
                {last7.map(day => {
                  const applies = goalApplies(g, day);
                  const logged = applies && goalLogs.some(l => l.goalId === g.id && l.date === dKey(day));
                  const isT = dKey(day) === dKey(today);
                  return (
                    <div key={dKey(day)} className="flex-1 flex flex-col items-center gap-1">
                      <div className="w-full h-1.5 rounded-full" style={{
                        backgroundColor: logged ? c : applies ? `${c}25` : "rgba(255,255,255,.04)",
                        outline: isT && applies ? `1px solid ${c}70` : "none",
                      }} />
                      <span style={{ fontSize: 7, color: isT ? c : "#3A3A5A", fontWeight: isT ? 700 : 500 }}>{DS[day.getDay()]}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
        <div className="mt-4">
          <div className="flex items-center justify-between mb-2">
            <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#3A3A5A" }}>Groups</p>
            <button onClick={() => onModal("groups")} style={{ fontSize: 11, color: "#6366F1", fontWeight: 600 }}>Manage</button>
          </div>
          <div className="flex flex-wrap gap-2">
            {groups.map(g => (
              <div key={g.id} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full"
                style={{ backgroundColor: `${g.color}18`, outline: `1px solid ${g.color}30` }}>
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: g.color }} />
                <span className="text-xs font-semibold" style={{ color: g.color }}>{g.name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Active Workout Overlay ───────────────────────────────────────────────────
function WorkoutOverlay({ activeWorkout, setActiveWorkout, onComplete, onCancel }: {
  activeWorkout: ActiveWO; setActiveWorkout: (w: ActiveWO | null) => void;
  onComplete: () => void; onCancel: () => void;
}) {
  const [, tick] = useState(0);
  const [newExName, setNewExName] = useState("");
  const [showExInput, setShowExInput] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const exRef = useRef<HTMLInputElement>(null);

  useEffect(() => { const id = setInterval(() => tick(t => t + 1), 1000); return () => clearInterval(id); }, []);
  useEffect(() => { if (showExInput) exRef.current?.focus(); }, [showExInput]);

  const elapsed = Math.floor((Date.now() - new Date(activeWorkout.startedAt).getTime()) / 1000);

  const addEx = () => {
    if (!newExName.trim()) return;
    setActiveWorkout({ ...activeWorkout, exercises: [...activeWorkout.exercises, { id: uid(), name: newExName.trim(), sets: [] }] });
    setNewExName(""); setShowExInput(false);
  };

  const addSet = (exId: string) =>
    setActiveWorkout({
      ...activeWorkout,
      exercises: activeWorkout.exercises.map(ex => {
        if (ex.id !== exId) return ex;
        const prev = ex.sets[ex.sets.length - 1];
        return { ...ex, sets: [...ex.sets, { wt: prev?.wt ?? 0, reps: prev?.reps ?? 0, done: false }] };
      }),
    });

  const updateSet = (exId: string, si: number, field: "wt" | "reps", val: number) =>
    setActiveWorkout({
      ...activeWorkout,
      exercises: activeWorkout.exercises.map(ex =>
        ex.id !== exId ? ex : { ...ex, sets: ex.sets.map((s, i) => i !== si ? s : { ...s, [field]: val }) }
      ),
    });

  const toggleSet = (exId: string, si: number) =>
    setActiveWorkout({
      ...activeWorkout,
      exercises: activeWorkout.exercises.map(ex =>
        ex.id !== exId ? ex : { ...ex, sets: ex.sets.map((s, i) => i !== si ? s : { ...s, done: !s.done }) }
      ),
    });

  const doneSets  = activeWorkout.exercises.reduce((a, e) => a + e.sets.filter(s => s.done).length, 0);
  const totalSets = activeWorkout.exercises.reduce((a, e) => a + e.sets.length, 0);

  return (
    <div className="absolute inset-0 z-50 flex flex-col" style={{ backgroundColor: "#0B0B10" }}>
      <div className="px-5 pt-10 pb-3 flex-shrink-0">
        <div className="flex items-start justify-between mb-3">
          <div>
            <p style={{ fontSize: 10, fontWeight: 700, color: "#34D399", letterSpacing: "0.1em", textTransform: "uppercase" }}>Active Workout</p>
            <h1 className="text-white font-bold leading-tight" style={{ fontSize: 18 }}>{activeWorkout.name}</h1>
          </div>
          <div className="rounded-2xl px-3 py-2.5 text-center" style={{ backgroundColor: "rgba(52,211,153,.12)" }}>
            <p className="font-mono font-bold leading-none" style={{ color: "#34D399", fontSize: 20 }}>{fmtT(Math.max(0, elapsed))}</p>
            <p style={{ fontSize: 9, color: "rgba(52,211,153,.5)", fontWeight: 600, marginTop: 2 }}>elapsed</p>
          </div>
        </div>
        {totalSets > 0 && (
          <div className="grid grid-cols-3 gap-2">
            {[
              { l: "Sets", v: `${doneSets}/${totalSets}`, c: "#818CF8" },
              { l: "Exercises", v: `${activeWorkout.exercises.length}`, c: "#38BDF8" },
              { l: "Volume", v: `${activeWorkout.exercises.reduce((a, e) => a + e.sets.filter(s=>s.done).reduce((b,s)=>b+s.wt*s.reps,0),0)} lb`, c: "#34D399" },
            ].map(s => (
              <div key={s.l} className="rounded-xl py-2 text-center" style={{ backgroundColor: "rgba(255,255,255,.04)" }}>
                <p style={{ color: s.c, fontWeight: 700, fontSize: 13 }}>{s.v}</p>
                <p style={{ color: "#4E4E72", fontSize: 9 }}>{s.l}</p>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="flex-1 overflow-y-auto px-4 pb-32 space-y-3" style={{ scrollbarWidth: "none" }}>
        {activeWorkout.exercises.length === 0 && !showExInput && (
          <div className="flex flex-col items-center justify-center h-48 gap-3">
            <p style={{ fontSize: 13, color: "#3A3A5A" }}>Add your first exercise</p>
          </div>
        )}
        {activeWorkout.exercises.map(ex => (
          <div key={ex.id} className="rounded-2xl p-4" style={cardSty}>
            <div className="flex items-center justify-between mb-3">
              <p className="text-white font-bold text-sm">{ex.name}</p>
              <button><MoreHorizontal size={16} style={{ color: "#3A3A5A" }} /></button>
            </div>
            {ex.sets.length > 0 && (
              <div className="grid grid-cols-4 gap-2 mb-2 px-1">
                {["Set","lbs","Reps","✓"].map(h => (
                  <p key={h} style={{ fontSize: 9, color: "#3A3A5A", fontWeight: 700, textTransform: "uppercase", textAlign: "center" }}>{h}</p>
                ))}
              </div>
            )}
            <div className="space-y-1.5">
              {ex.sets.map((s, si) => (
                <div key={si} className="grid grid-cols-4 gap-2 items-center py-2 px-1 rounded-xl"
                  style={{ backgroundColor: s.done ? "rgba(52,211,153,.1)" : "rgba(255,255,255,.03)" }}>
                  <p style={{ color: s.done ? "#34D399" : "#5A5A80", fontWeight: 700, fontSize: 13, textAlign: "center" }}>{si + 1}</p>
                  <input type="number" value={s.wt || ""} onChange={e => updateSet(ex.id, si, "wt", Number(e.target.value))}
                    className="text-white font-bold text-sm text-center rounded-lg py-1 outline-none"
                    style={{ backgroundColor: "rgba(255,255,255,.06)", width: "100%" }} placeholder="0" />
                  <input type="number" value={s.reps || ""} onChange={e => updateSet(ex.id, si, "reps", Number(e.target.value))}
                    className="text-white font-bold text-sm text-center rounded-lg py-1 outline-none"
                    style={{ backgroundColor: "rgba(255,255,255,.06)", width: "100%" }} placeholder="0" />
                  <button onClick={() => toggleSet(ex.id, si)}
                    className="w-7 h-7 rounded-full flex items-center justify-center mx-auto"
                    style={{ backgroundColor: s.done ? "#34D399" : "rgba(255,255,255,.08)" }}>
                    {s.done ? <Check size={12} className="text-white" /> : <span style={{ width: 8, height: 8, borderRadius: 99, border: "1.5px solid #3A3A5E", display: "block" }} />}
                  </button>
                </div>
              ))}
              <button onClick={() => addSet(ex.id)}
                className="w-full py-2 rounded-xl border border-dashed text-xs font-semibold"
                style={{ borderColor: "rgba(255,255,255,.1)", color: "#4E4E72" }}>
                + Add Set
              </button>
            </div>
          </div>
        ))}
        {showExInput ? (
          <div className="rounded-2xl p-4 space-y-3" style={cardSty}>
            <input ref={exRef} value={newExName} onChange={e => setNewExName(e.target.value)}
              className={inputCls} style={inputSty} placeholder="Exercise name (e.g. Bench Press)"
              onKeyDown={e => { if (e.key === "Enter") addEx(); if (e.key === "Escape") setShowExInput(false); }} />
            <div className="flex gap-2">
              <button onClick={addEx} className="flex-1 py-2.5 rounded-xl font-bold text-sm text-white"
                style={{ backgroundColor: "#6366F1" }}>Add</button>
              <button onClick={() => { setShowExInput(false); setNewExName(""); }}
                className="flex-1 py-2.5 rounded-xl font-bold text-sm"
                style={{ backgroundColor: "rgba(255,255,255,.07)", color: "#7878A4" }}>Cancel</button>
            </div>
          </div>
        ) : (
          <button onClick={() => setShowExInput(true)}
            className="w-full py-3.5 rounded-2xl border border-dashed font-semibold text-sm"
            style={{ borderColor: "rgba(255,255,255,.1)", color: "#5A5A80", backgroundColor: "rgba(255,255,255,.03)" }}>
            + Add Exercise
          </button>
        )}
      </div>
      <div className="absolute bottom-0 left-0 right-0 px-4 pb-8 pt-3 space-y-2"
        style={{ background: "linear-gradient(to top, #0B0B10 60%, transparent)" }}>
        <button onClick={onComplete}
          className="w-full py-4 rounded-2xl text-white font-bold text-base"
          style={{ backgroundColor: "#34D399" }}>
          Finish Workout
        </button>
        {confirmCancel ? (
          <div className="flex gap-2">
            <button onClick={onCancel} className="flex-1 py-3 rounded-2xl font-bold text-sm"
              style={{ backgroundColor: "rgba(239,68,68,.2)", color: "#EF4444" }}>Cancel Workout</button>
            <button onClick={() => setConfirmCancel(false)} className="flex-1 py-3 rounded-2xl font-bold text-sm"
              style={{ backgroundColor: "rgba(255,255,255,.07)", color: "#7878A4" }}>Keep Going</button>
          </div>
        ) : (
          <button onClick={() => setConfirmCancel(true)} className="w-full py-2 text-sm font-semibold"
            style={{ color: "#4E4E72" }}>
            Cancel workout
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Event Modal ──────────────────────────────────────────────────────────────
function EventModal({ groups, selectedDate, onAdd, onClose }: { groups: Group[]; selectedDate: Date; onAdd: (e: CalEvent) => void; onClose: () => void }) {
  const [title, setTitle] = useState("");
  const [startDate, setStartDate] = useState(dKey(selectedDate));
  const [endDate, setEndDate] = useState(dKey(selectedDate));
  const [startTime, setStartTime] = useState(nowHHMM());
  const [endTime, setEndTime] = useState(() => {
    const d = new Date(); d.setHours(d.getHours() + 1);
    return `${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
  });
  const [repeatDays, setRepeatDays] = useState<number[]>([]);
  const [groupId, setGroupId] = useState("");
  const [notes, setNotes] = useState("");

  const submit = () => {
    if (!title.trim()) return;
    onAdd({ id: uid(), title: title.trim(), startDate, endDate, startTime, endTime, groupId, notes, repeatDays });
    onClose();
  };

  return (
    <ModalShell title="New Event" onClose={onClose}>
      <input className={inputCls} style={inputSty} placeholder="Event name" value={title} onChange={e => setTitle(e.target.value)} autoFocus />
      <div><p className="mb-1.5" style={labelSty}>Start Date</p>
        <input type="date" className={inputCls} style={inputSty} value={startDate} onChange={e => setStartDate(e.target.value)} /></div>
      <div className="grid grid-cols-2 gap-3">
        {[{ l:"Start Time", v:startTime, s:setStartTime }, { l:"End Time", v:endTime, s:setEndTime }].map(f => (
          <div key={f.l}><p className="mb-1.5" style={labelSty}>{f.l}</p>
            <input type="time" className={inputCls} style={inputSty} value={f.v} onChange={e => f.s(e.target.value)} /></div>
        ))}
      </div>
      <div><p className="mb-1.5" style={labelSty}>Repeat on</p>
        <DaySelector selected={repeatDays} onChange={days => {
          if (days.length > 0 && repeatDays.length === 0) setEndDate("");
          if (days.length === 0 && repeatDays.length > 0) setEndDate(startDate);
          setRepeatDays(days);
        }} />
      </div>
      {repeatDays.length > 0 ? (
        <div><p className="mb-1.5" style={labelSty}>Repeat Until (optional)</p>
          <input type="date" className={inputCls} style={inputSty} value={endDate} onChange={e => setEndDate(e.target.value)}
            placeholder="No end date" /></div>
      ) : (
        <div><p className="mb-1.5" style={labelSty}>End Date</p>
          <input type="date" className={inputCls} style={inputSty} value={endDate} onChange={e => setEndDate(e.target.value)} /></div>
      )}
      <div><p className="mb-1.5" style={labelSty}>Group</p><GroupPicker groups={groups} selected={groupId} onChange={setGroupId} /></div>
      <div><p className="mb-1.5" style={labelSty}>Notes</p>
        <textarea className={inputCls} style={{ ...inputSty, resize: "none" } as React.CSSProperties} rows={3} placeholder="Additional notes..." value={notes} onChange={e => setNotes(e.target.value)} /></div>
      <button onClick={submit} className="w-full py-4 rounded-2xl font-bold text-sm"
        style={{ backgroundColor: title.trim() ? "#6366F1" : "rgba(99,102,241,.3)", color: title.trim() ? "#fff" : "#6366F1" }}>
        {title.trim() ? "Add Event" : "Enter a name to continue"}
      </button>
    </ModalShell>
  );
}

// ─── Task Modal ───────────────────────────────────────────────────────────────
function TaskModal({ groups, selectedDate, onAdd, onClose }: { groups: Group[]; selectedDate: Date; onAdd: (t: CalTask) => void; onClose: () => void }) {
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState(dKey(selectedDate));
  const [dueTime, setDueTime] = useState("");
  const [repeatDays, setRepeatDays] = useState<number[]>([]);
  const [groupId, setGroupId] = useState("");
  const [notes, setNotes] = useState("");

  const submit = () => {
    if (!title.trim()) return;
    onAdd({ id: uid(), title: title.trim(), dueDate, dueTime, groupId, notes, repeatDays, done: false, subtasks: [] });
    onClose();
  };

  return (
    <ModalShell title="New Task" onClose={onClose}>
      <input className={inputCls} style={inputSty} placeholder="Task name" value={title} onChange={e => setTitle(e.target.value)} autoFocus />
      <div><p className="mb-1.5" style={labelSty}>Due Date</p>
        <input type="date" className={inputCls} style={inputSty} value={dueDate} onChange={e => setDueDate(e.target.value)} /></div>
      <div><p className="mb-1.5" style={labelSty}>Due Time (optional)</p>
        <input type="time" className={inputCls} style={inputSty} value={dueTime} onChange={e => setDueTime(e.target.value)} /></div>
      <div><p className="mb-1.5" style={labelSty}>Repeat on</p><DaySelector selected={repeatDays} onChange={setRepeatDays} /></div>
      <div><p className="mb-1.5" style={labelSty}>Group</p><GroupPicker groups={groups} selected={groupId} onChange={setGroupId} /></div>
      <div><p className="mb-1.5" style={labelSty}>Notes</p>
        <textarea className={inputCls} style={{ ...inputSty, resize: "none" } as React.CSSProperties} rows={2} placeholder="Additional notes..." value={notes} onChange={e => setNotes(e.target.value)} /></div>
      <button onClick={submit} className="w-full py-4 rounded-2xl font-bold text-sm"
        style={{ backgroundColor: title.trim() ? "#6366F1" : "rgba(99,102,241,.3)", color: title.trim() ? "#fff" : "#6366F1" }}>
        {title.trim() ? "Add Task" : "Enter a name to continue"}
      </button>
    </ModalShell>
  );
}

// ─── Meal Modal ───────────────────────────────────────────────────────────────
function MealModal({ selectedDate, onAdd, onClose }: { selectedDate: Date; onAdd: (m: CalMeal) => void; onClose: () => void }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [mealType, setMealType] = useState<MealType>("breakfast");
  const [date, setDate] = useState(dKey(selectedDate));
  const [time, setTime] = useState(nowHHMM());
  const [calories, setCalories] = useState("");
  const [protein, setProtein] = useState("");
  const [carbs, setCarbs] = useState("");
  const [fat, setFat] = useState("");

  const submit = () => {
    if (!name.trim()) return;
    onAdd({ id: uid(), name: name.trim(), description, mealType, date, time, calories: Number(calories)||0, protein: Number(protein)||0, carbs: Number(carbs)||0, fat: Number(fat)||0 });
    onClose();
  };

  const MEAL_TYPES: MealType[] = ["breakfast", "lunch", "dinner", "snack"];
  return (
    <ModalShell title="Log Meal" onClose={onClose}>
      <input className={inputCls} style={inputSty} placeholder="Meal name" value={name} onChange={e => setName(e.target.value)} autoFocus />
      <textarea className={inputCls} style={{ ...inputSty, resize: "none" } as React.CSSProperties} rows={2} placeholder="Description (optional)" value={description} onChange={e => setDescription(e.target.value)} />
      <div><p className="mb-1.5" style={labelSty}>Meal Type</p>
        <div className="grid grid-cols-4 gap-2">
          {MEAL_TYPES.map(t => (
            <button key={t} onClick={() => setMealType(t)} className="py-2.5 rounded-xl text-xs font-bold capitalize"
              style={{ backgroundColor: mealType === t ? "rgba(251,146,60,.2)" : "rgba(255,255,255,.06)", color: mealType === t ? "#FB923C" : "#4E4E72", outline: mealType === t ? "1px solid rgba(251,146,60,.4)" : "none" }}>
              {t}
            </button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div><p className="mb-1.5" style={labelSty}>Date</p><input type="date" className={inputCls} style={inputSty} value={date} onChange={e => setDate(e.target.value)} /></div>
        <div><p className="mb-1.5" style={labelSty}>Time</p><input type="time" className={inputCls} style={inputSty} value={time} onChange={e => setTime(e.target.value)} /></div>
      </div>
      <div><p className="mb-1.5" style={labelSty}>Calories</p>
        <input type="number" className={inputCls} style={inputSty} placeholder="0" value={calories} onChange={e => setCalories(e.target.value)} /></div>
      <div className="grid grid-cols-3 gap-2">
        {[{ l:"Protein (g)", v:protein, s:setProtein, c:"#38BDF8" }, { l:"Carbs (g)", v:carbs, s:setCarbs, c:"#818CF8" }, { l:"Fat (g)", v:fat, s:setFat, c:"#F472B6" }].map(f => (
          <div key={f.l}><p className="mb-1.5" style={{ ...labelSty, color: f.c }}>{f.l}</p>
            <input type="number" className={inputCls} style={{ ...inputSty, outline: `1px solid ${f.c}30` } as React.CSSProperties} placeholder="0" value={f.v} onChange={e => f.s(e.target.value)} /></div>
        ))}
      </div>
      <button onClick={submit} className="w-full py-4 rounded-2xl text-white font-bold text-sm" style={{ backgroundColor: "#FB923C" }}>Log Meal</button>
    </ModalShell>
  );
}

// ─── Goal Modal ───────────────────────────────────────────────────────────────
function GoalModal({ groups, onAdd, onClose }: { groups: Group[]; onAdd: (g: CalGoal) => void; onClose: () => void }) {
  const [title, setTitle] = useState("");
  const [days, setDays] = useState<number[]>([]);
  const [amount, setAmount] = useState("1");
  const [unit, setUnit] = useState<GoalUnit>("times");
  const [groupId, setGroupId] = useState("");

  const submit = () => {
    if (!title.trim() || !days.length) return;
    onAdd({ id: uid(), title: title.trim(), days, amount: Number(amount) || 1, unit, groupId });
    onClose();
  };

  return (
    <ModalShell title="New Goal" onClose={onClose}>
      <input className={inputCls} style={inputSty} placeholder="What's your goal?" value={title} onChange={e => setTitle(e.target.value)} autoFocus />
      <div><p className="mb-1.5" style={labelSty}>Days</p><DaySelector selected={days} onChange={setDays} /></div>
      <div className="grid grid-cols-2 gap-3">
        <div><p className="mb-1.5" style={labelSty}>Amount</p>
          <input type="number" className={inputCls} style={inputSty} placeholder="1" value={amount} onChange={e => setAmount(e.target.value)} min="1" /></div>
        <div><p className="mb-1.5" style={labelSty}>Unit</p>
          <div className="flex gap-2">
            {(["times","minutes"] as GoalUnit[]).map(u => (
              <button key={u} onClick={() => setUnit(u)} className="flex-1 py-3 rounded-xl text-xs font-bold capitalize"
                style={{ backgroundColor: unit === u ? "rgba(99,102,241,.2)" : "rgba(255,255,255,.06)", color: unit === u ? "#818CF8" : "#4E4E72", outline: unit === u ? "1px solid rgba(99,102,241,.4)" : "none" }}>
                {u}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div><p className="mb-1.5" style={labelSty}>Group (optional)</p><GroupPicker groups={groups} selected={groupId} onChange={setGroupId} /></div>
      <button onClick={submit} className="w-full py-4 rounded-2xl font-bold text-sm"
        style={{ backgroundColor: title.trim() && days.length ? "#6366F1" : "rgba(99,102,241,.3)", color: title.trim() && days.length ? "#fff" : "#6366F1" }}>
        {!title.trim() ? "Enter a goal name" : !days.length ? "Select at least one day" : "Create Goal"}
      </button>
    </ModalShell>
  );
}

// ─── Start Workout Modal ──────────────────────────────────────────────────────
function StartWorkoutModal({ onStart, onClose }: { onStart: (name: string) => void; onClose: () => void }) {
  const [name, setName] = useState("");
  return (
    <ModalShell title="Start Workout" onClose={onClose}>
      <input className={inputCls} style={inputSty} placeholder="Workout name (e.g. Push Day)" value={name} onChange={e => setName(e.target.value)} autoFocus
        onKeyDown={e => { if (e.key === "Enter" && name.trim()) { onStart(name.trim()); onClose(); } }} />
      <button onClick={() => { if (name.trim()) { onStart(name.trim()); onClose(); } }}
        className="w-full py-4 rounded-2xl text-white font-bold text-base flex items-center justify-center gap-2"
        style={{ backgroundColor: name.trim() ? "#34D399" : "rgba(52,211,153,.3)", color: name.trim() ? "#fff" : "#34D399" }}>
        <Play size={18} fill="currentColor" /> Start Workout
      </button>
    </ModalShell>
  );
}

// ─── Groups Modal ─────────────────────────────────────────────────────────────
function GroupsModal({ groups, setGroups, onClose }: { groups: Group[]; setGroups: (g: Group[]) => void; onClose: () => void }) {
  const [newName, setNewName] = useState("");
  const [selColor, setSelColor] = useState(PCOLORS[0]);
  const [adding, setAdding] = useState(false);

  const addGroup = () => {
    if (!newName.trim()) return;
    setGroups([...groups, { id: uid(), name: newName.trim(), color: selColor }]);
    setNewName(""); setAdding(false);
  };

  return (
    <ModalShell title="Groups" onClose={onClose}>
      <div className="space-y-2">
        {groups.map(g => (
          <div key={g.id} className="flex items-center gap-3 rounded-xl px-3 py-3" style={cardSty}>
            <div className="w-8 h-8 rounded-full flex-shrink-0" style={{ backgroundColor: `${g.color}25`, outline: `2px solid ${g.color}` }} />
            <p className="flex-1 text-white font-semibold text-sm">{g.name}</p>
            <button onClick={() => setGroups(groups.filter(x => x.id !== g.id))}
              className="w-7 h-7 rounded-full flex items-center justify-center"
              style={{ backgroundColor: "rgba(239,68,68,.15)" }}>
              <Trash2 size={12} style={{ color: "#EF4444" }} />
            </button>
          </div>
        ))}
      </div>
      {adding ? (
        <div className="rounded-2xl p-4 space-y-3" style={cardSty}>
          <input className={inputCls} style={inputSty} placeholder="Group name" value={newName} onChange={e => setNewName(e.target.value)} autoFocus />
          <div><p className="mb-2" style={labelSty}>Color</p>
            <div className="flex flex-wrap gap-2">
              {PCOLORS.map(c => (
                <button key={c} onClick={() => setSelColor(c)} className="w-8 h-8 rounded-full"
                  style={{ backgroundColor: c, outline: selColor === c ? "3px solid white" : "none", outlineOffset: 2 }} />
              ))}
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={addGroup} className="flex-1 py-2.5 rounded-xl font-bold text-white text-sm" style={{ backgroundColor: selColor }}>Add</button>
            <button onClick={() => { setAdding(false); setNewName(""); }} className="flex-1 py-2.5 rounded-xl font-bold text-sm" style={{ backgroundColor: "rgba(255,255,255,.07)", color: "#7878A4" }}>Cancel</button>
          </div>
        </div>
      ) : (
        <button onClick={() => setAdding(true)} className="w-full py-3.5 rounded-2xl border border-dashed font-semibold text-sm"
          style={{ borderColor: "rgba(255,255,255,.12)", color: "#5A5A80" }}>
          + New Group
        </button>
      )}
    </ModalShell>
  );
}

// ─── Edit Forms (used inside DetailModal) ────────────────────────────────────
function EventEditForm({ event, groups, onSave, onCancel }: { event: CalEvent; groups: Group[]; onSave: (e: CalEvent) => void; onCancel: () => void }) {
  const [title, setTitle] = useState(event.title);
  const [startDate, setStartDate] = useState(event.startDate);
  const [endDate, setEndDate] = useState(event.endDate);
  const [startTime, setStartTime] = useState(event.startTime);
  const [endTime, setEndTime] = useState(event.endTime);
  const [repeatDays, setRepeatDays] = useState(event.repeatDays);
  const [groupId, setGroupId] = useState(event.groupId);
  const [notes, setNotes] = useState(event.notes);
  return (
    <div className="space-y-4 pt-2">
      <input className={inputCls} style={inputSty} value={title} onChange={e => setTitle(e.target.value)} />
      <div><p className="mb-1.5" style={labelSty}>Start Date</p>
        <input type="date" className={inputCls} style={inputSty} value={startDate} onChange={e => setStartDate(e.target.value)} /></div>
      <div className="grid grid-cols-2 gap-3">
        <div><p className="mb-1.5" style={labelSty}>Start Time</p><input type="time" className={inputCls} style={inputSty} value={startTime} onChange={e => setStartTime(e.target.value)} /></div>
        <div><p className="mb-1.5" style={labelSty}>End Time</p><input type="time" className={inputCls} style={inputSty} value={endTime} onChange={e => setEndTime(e.target.value)} /></div>
      </div>
      <div><p className="mb-1.5" style={labelSty}>Repeat on</p>
        <DaySelector selected={repeatDays} onChange={days => {
          if (days.length > 0 && repeatDays.length === 0) setEndDate("");
          if (days.length === 0 && repeatDays.length > 0) setEndDate(startDate);
          setRepeatDays(days);
        }} />
      </div>
      {repeatDays.length > 0 ? (
        <div><p className="mb-1.5" style={labelSty}>Repeat Until (optional)</p>
          <input type="date" className={inputCls} style={inputSty} value={endDate} onChange={e => setEndDate(e.target.value)} /></div>
      ) : (
        <div><p className="mb-1.5" style={labelSty}>End Date</p>
          <input type="date" className={inputCls} style={inputSty} value={endDate} onChange={e => setEndDate(e.target.value)} /></div>
      )}
      <div><p className="mb-1.5" style={labelSty}>Group</p><GroupPicker groups={groups} selected={groupId} onChange={setGroupId} /></div>
      <div><p className="mb-1.5" style={labelSty}>Notes</p>
        <textarea className={inputCls} style={{ ...inputSty, resize: "none" } as React.CSSProperties} rows={3} value={notes} onChange={e => setNotes(e.target.value)} /></div>
      <div className="flex gap-2">
        <button onClick={() => onSave({ ...event, title, startDate, endDate, startTime, endTime, repeatDays, groupId, notes })}
          className="flex-1 py-3.5 rounded-2xl font-bold text-sm text-white" style={{ backgroundColor: "#6366F1" }}>Save</button>
        <button onClick={onCancel} className="flex-1 py-3.5 rounded-2xl font-bold text-sm"
          style={{ backgroundColor: "rgba(255,255,255,.07)", color: "#7878A4" }}>Cancel</button>
      </div>
    </div>
  );
}

function TaskEditForm({ task, groups, onSave, onCancel }: { task: CalTask; groups: Group[]; onSave: (t: CalTask) => void; onCancel: () => void }) {
  const [title, setTitle] = useState(task.title);
  const [dueDate, setDueDate] = useState(task.dueDate);
  const [dueTime, setDueTime] = useState(task.dueTime);
  const [repeatDays, setRepeatDays] = useState(task.repeatDays);
  const [groupId, setGroupId] = useState(task.groupId);
  const [notes, setNotes] = useState(task.notes);
  const [subtasks, setSubtasks] = useState<Subtask[]>(task.subtasks || []);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState("");
  const [newSubtaskDate, setNewSubtaskDate] = useState("");

  const addSubtask = () => {
    if (!newSubtaskTitle.trim()) return;
    setSubtasks([...subtasks, { id: uid(), title: newSubtaskTitle.trim(), dueDate: newSubtaskDate || dueDate, done: false }]);
    setNewSubtaskTitle("");
    setNewSubtaskDate("");
  };

  const toggleSubtask = (id: string) => {
    setSubtasks(subtasks.map(st => st.id === id ? { ...st, done: !st.done } : st));
  };

  const deleteSubtask = (id: string) => {
    setSubtasks(subtasks.filter(st => st.id !== id));
  };

  return (
    <div className="space-y-4 pt-2">
      <input className={inputCls} style={inputSty} value={title} onChange={e => setTitle(e.target.value)} />
      <div><p className="mb-1.5" style={labelSty}>Due Date</p>
        <input type="date" className={inputCls} style={inputSty} value={dueDate} onChange={e => setDueDate(e.target.value)} /></div>
      <div><p className="mb-1.5" style={labelSty}>Due Time (optional)</p>
        <input type="time" className={inputCls} style={inputSty} value={dueTime} onChange={e => setDueTime(e.target.value)} /></div>
      <div><p className="mb-1.5" style={labelSty}>Repeat on</p><DaySelector selected={repeatDays} onChange={setRepeatDays} /></div>
      <div><p className="mb-1.5" style={labelSty}>Group</p><GroupPicker groups={groups} selected={groupId} onChange={setGroupId} /></div>
      <div><p className="mb-1.5" style={labelSty}>Notes</p>
        <textarea className={inputCls} style={{ ...inputSty, resize: "none" } as React.CSSProperties} rows={2} value={notes} onChange={e => setNotes(e.target.value)} /></div>

      <div>
        <p className="mb-1.5" style={labelSty}>Subtasks</p>
        {subtasks.length > 0 && (
          <div className="space-y-1.5 mb-2">
            {subtasks.map(st => (
              <div key={st.id} className="flex items-center gap-2 p-2 rounded-lg" style={{ backgroundColor: "rgba(255,255,255,.04)" }}>
                <button onClick={() => toggleSubtask(st.id)} className="w-4 h-4 rounded border flex items-center justify-center flex-shrink-0"
                  style={{ borderColor: "#6366F1", backgroundColor: st.done ? "#6366F1" : "transparent" }}>
                  {st.done && <Check size={10} className="text-white" />}
                </button>
                <span className="flex-1 text-xs" style={{ color: st.done ? "#7878A4" : "#EEEEF8", textDecoration: st.done ? "line-through" : "none" }}>
                  {st.title} {st.dueDate && st.dueDate !== dueDate && <span style={{ color: "#4E4E72" }}>({st.dueDate})</span>}
                </span>
                <button onClick={() => deleteSubtask(st.id)}>
                  <X size={12} style={{ color: "#4E4E72" }} />
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="space-y-2">
          <input className={inputCls} style={{ ...inputSty, fontSize: 12 }} placeholder="Subtask name" value={newSubtaskTitle} onChange={e => setNewSubtaskTitle(e.target.value)}
            onKeyDown={e => e.key === "Enter" && addSubtask()} />
          <div className="grid grid-cols-2 gap-2">
            <input type="date" className={inputCls} style={{ ...inputSty, fontSize: 12 }} placeholder="Due date (optional)" value={newSubtaskDate} onChange={e => setNewSubtaskDate(e.target.value)} />
            <button onClick={addSubtask} className="py-2 rounded-xl font-bold text-xs text-white" style={{ backgroundColor: "#6366F1" }}>Add Subtask</button>
          </div>
        </div>
      </div>

      <div className="flex gap-2">
        <button onClick={() => onSave({ ...task, title, dueDate, dueTime, repeatDays, groupId, notes, subtasks })}
          className="flex-1 py-3.5 rounded-2xl font-bold text-sm text-white" style={{ backgroundColor: "#6366F1" }}>Save</button>
        <button onClick={onCancel} className="flex-1 py-3.5 rounded-2xl font-bold text-sm"
          style={{ backgroundColor: "rgba(255,255,255,.07)", color: "#7878A4" }}>Cancel</button>
      </div>
    </div>
  );
}

function GoalEditForm({ goal, groups, onSave, onCancel }: { goal: CalGoal; groups: Group[]; onSave: (g: CalGoal) => void; onCancel: () => void }) {
  const [title, setTitle] = useState(goal.title);
  const [days, setDays] = useState(goal.days);
  const [amount, setAmount] = useState(String(goal.amount));
  const [unit, setUnit] = useState<GoalUnit>(goal.unit);
  const [groupId, setGroupId] = useState(goal.groupId);
  return (
    <div className="space-y-4 pt-2">
      <input className={inputCls} style={inputSty} value={title} onChange={e => setTitle(e.target.value)} />
      <div><p className="mb-1.5" style={labelSty}>Days</p><DaySelector selected={days} onChange={setDays} /></div>
      <div className="grid grid-cols-2 gap-3">
        <div><p className="mb-1.5" style={labelSty}>Amount</p>
          <input type="number" className={inputCls} style={inputSty} value={amount} onChange={e => setAmount(e.target.value)} min="1" /></div>
        <div><p className="mb-1.5" style={labelSty}>Unit</p>
          <div className="flex gap-2">
            {(["times","minutes"] as GoalUnit[]).map(u => (
              <button key={u} onClick={() => setUnit(u)} className="flex-1 py-3 rounded-xl text-xs font-bold capitalize"
                style={{ backgroundColor: unit === u ? "rgba(99,102,241,.2)" : "rgba(255,255,255,.06)", color: unit === u ? "#818CF8" : "#4E4E72" }}>
                {u}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div><p className="mb-1.5" style={labelSty}>Group</p><GroupPicker groups={groups} selected={groupId} onChange={setGroupId} /></div>
      <div className="flex gap-2">
        <button onClick={() => onSave({ ...goal, title, days, amount: Number(amount) || 1, unit, groupId })}
          className="flex-1 py-3.5 rounded-2xl font-bold text-sm text-white" style={{ backgroundColor: "#6366F1" }}>Save</button>
        <button onClick={onCancel} className="flex-1 py-3.5 rounded-2xl font-bold text-sm"
          style={{ backgroundColor: "rgba(255,255,255,.07)", color: "#7878A4" }}>Cancel</button>
      </div>
    </div>
  );
}

function MealEditForm({ meal, onSave, onCancel }: { meal: CalMeal; onSave: (m: CalMeal) => void; onCancel: () => void }) {
  const [name, setName] = useState(meal.name);
  const [description, setDescription] = useState(meal.description);
  const [mealType, setMealType] = useState<MealType>(meal.mealType);
  const [date, setDate] = useState(meal.date);
  const [time, setTime] = useState(meal.time);
  const [calories, setCalories] = useState(String(meal.calories));
  const [protein, setProtein] = useState(String(meal.protein));
  const [carbs, setCarbs] = useState(String(meal.carbs));
  const [fat, setFat] = useState(String(meal.fat));
  const MEAL_TYPES: MealType[] = ["breakfast", "lunch", "dinner", "snack"];
  return (
    <div className="space-y-4 pt-2">
      <input className={inputCls} style={inputSty} value={name} onChange={e => setName(e.target.value)} />
      <textarea className={inputCls} style={{ ...inputSty, resize: "none" } as React.CSSProperties} rows={2} value={description} onChange={e => setDescription(e.target.value)} placeholder="Description (optional)" />
      <div><p className="mb-1.5" style={labelSty}>Meal Type</p>
        <div className="grid grid-cols-4 gap-2">
          {MEAL_TYPES.map(t => (
            <button key={t} onClick={() => setMealType(t)} className="py-2.5 rounded-xl text-xs font-bold capitalize"
              style={{ backgroundColor: mealType === t ? "rgba(251,146,60,.2)" : "rgba(255,255,255,.06)", color: mealType === t ? "#FB923C" : "#4E4E72" }}>
              {t}
            </button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div><p className="mb-1.5" style={labelSty}>Date</p><input type="date" className={inputCls} style={inputSty} value={date} onChange={e => setDate(e.target.value)} /></div>
        <div><p className="mb-1.5" style={labelSty}>Time</p><input type="time" className={inputCls} style={inputSty} value={time} onChange={e => setTime(e.target.value)} /></div>
      </div>
      <div><p className="mb-1.5" style={labelSty}>Calories</p>
        <input type="number" className={inputCls} style={inputSty} value={calories} onChange={e => setCalories(e.target.value)} /></div>
      <div className="grid grid-cols-3 gap-2">
        {[{l:"Protein (g)",v:protein,s:setProtein,c:"#38BDF8"},{l:"Carbs (g)",v:carbs,s:setCarbs,c:"#818CF8"},{l:"Fat (g)",v:fat,s:setFat,c:"#F472B6"}].map(f => (
          <div key={f.l}><p className="mb-1.5" style={{ ...labelSty, color: f.c }}>{f.l}</p>
            <input type="number" className={inputCls} style={{ ...inputSty, outline: `1px solid ${f.c}30` } as React.CSSProperties} value={f.v} onChange={e => f.s(e.target.value)} /></div>
        ))}
      </div>
      <div className="flex gap-2">
        <button onClick={() => onSave({ ...meal, name, description, mealType, date, time, calories: Number(calories)||0, protein: Number(protein)||0, carbs: Number(carbs)||0, fat: Number(fat)||0 })}
          className="flex-1 py-3.5 rounded-2xl font-bold text-sm text-white" style={{ backgroundColor: "#FB923C" }}>Save</button>
        <button onClick={onCancel} className="flex-1 py-3.5 rounded-2xl font-bold text-sm"
          style={{ backgroundColor: "rgba(255,255,255,.07)", color: "#7878A4" }}>Cancel</button>
      </div>
    </div>
  );
}

// ─── Detail Modal ─────────────────────────────────────────────────────────────
function DetailModal({
  kind, id, groups, selectedDate, goalLogs, toggleGoalLog,
  calEvents, calTasks, calGoals, calMeals, calWorkouts,
  onClose, onUpdateEvent, onUpdateTask, onUpdateGoal, onUpdateMeal,
  onDeleteEvent, onDeleteTask, onDeleteGoal, onDeleteMeal, onDeleteWorkout,
  onTaskToggle,
}: {
  kind: DetailKind; id: string;
  groups: Group[]; selectedDate: Date;
  goalLogs: GoalLog[]; toggleGoalLog: (goalId: string, date: Date) => void;
  calEvents: CalEvent[]; calTasks: CalTask[]; calGoals: CalGoal[]; calMeals: CalMeal[]; calWorkouts: CalWorkout[];
  onClose: () => void;
  onUpdateEvent: (e: CalEvent) => void; onUpdateTask: (t: CalTask) => void;
  onUpdateGoal: (g: CalGoal) => void;  onUpdateMeal: (m: CalMeal) => void;
  onDeleteEvent: (id: string) => void; onDeleteTask: (id: string) => void;
  onDeleteGoal: (id: string) => void;  onDeleteMeal: (id: string) => void; onDeleteWorkout: (id: string) => void;
  onTaskToggle: (id: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const event   = kind === "event"   ? calEvents.find(x => x.id === id)   : undefined;
  const task    = kind === "task"    ? calTasks.find(x => x.id === id)    : undefined;
  const goal    = kind === "goal"    ? calGoals.find(x => x.id === id)    : undefined;
  const meal    = kind === "meal"    ? calMeals.find(x => x.id === id)    : undefined;
  const workout = kind === "workout" ? calWorkouts.find(x => x.id === id) : undefined;

  if (!event && !task && !goal && !meal && !workout) return null;

  const handleDelete = () => {
    if (kind === "event")   onDeleteEvent(id);
    if (kind === "task")    onDeleteTask(id);
    if (kind === "goal")    onDeleteGoal(id);
    if (kind === "meal")    onDeleteMeal(id);
    if (kind === "workout") onDeleteWorkout(id);
    onClose();
  };

  const title = event?.title ?? task?.title ?? goal?.title ?? meal?.name ?? workout?.name ?? "";
  const color = event ? gColor(groups, event.groupId) : task ? gColor(groups, task.groupId) : goal ? gColor(groups, goal.groupId) : meal ? "#FB923C" : "#34D399";
  const kindLabel = kind === "event" ? "Event" : kind === "task" ? "Task" : kind === "goal" ? "Goal" : kind === "meal" ? "Meal" : "Workout";

  return (
    <div className="absolute inset-0 z-50 flex items-end"
      style={{ backgroundColor: "rgba(0,0,0,.72)", backdropFilter: "blur(10px)" }} onClick={onClose}>
      <div className="w-full rounded-t-3xl" style={{ backgroundColor: "#181824" }} onClick={e => e.stopPropagation()}>
        <div className="flex justify-center pt-3">
          <div className="w-10 h-1 rounded-full" style={{ backgroundColor: "rgba(255,255,255,.14)" }} />
        </div>
        <div className="px-5 pt-3 pb-3">
          <div className="flex items-start gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                <span style={{ fontSize: 9, fontWeight: 700, color: "#4E4E72", textTransform: "uppercase", letterSpacing: "0.1em" }}>{kindLabel}</span>
              </div>
              <h2 className="text-white font-bold leading-snug" style={{ fontSize: 18 }}>{title}</h2>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0 pt-1">
              {!confirmDelete ? (
                <button onClick={() => setConfirmDelete(true)} className="w-8 h-8 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: "rgba(239,68,68,.15)" }}>
                  <Trash2 size={13} style={{ color: "#EF4444" }} />
                </button>
              ) : (
                <div className="flex gap-1.5">
                  <button onClick={handleDelete} className="px-3 py-1.5 rounded-full text-xs font-bold"
                    style={{ backgroundColor: "rgba(239,68,68,.2)", color: "#EF4444" }}>Delete</button>
                  <button onClick={() => setConfirmDelete(false)} className="px-3 py-1.5 rounded-full text-xs font-bold"
                    style={{ backgroundColor: "rgba(255,255,255,.08)", color: "#7878A4" }}>Keep</button>
                </div>
              )}
              <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center"
                style={{ backgroundColor: "rgba(255,255,255,.1)" }}>
                <X size={13} className="text-white" />
              </button>
            </div>
          </div>
        </div>

        <div className="px-5 pb-8 overflow-y-auto space-y-3" style={{ maxHeight: "72vh", scrollbarWidth: "none" }}>
          {editing ? (
            <>
              {event   && <EventEditForm event={event}   groups={groups} onSave={e => { onUpdateEvent(e); setEditing(false); }} onCancel={() => setEditing(false)} />}
              {task    && <TaskEditForm  task={task}     groups={groups} onSave={t => { onUpdateTask(t);  setEditing(false); }} onCancel={() => setEditing(false)} />}
              {goal    && <GoalEditForm  goal={goal}     groups={groups} onSave={g => { onUpdateGoal(g);  setEditing(false); }} onCancel={() => setEditing(false)} />}
              {meal    && <MealEditForm  meal={meal}                     onSave={m => { onUpdateMeal(m);  setEditing(false); }} onCancel={() => setEditing(false)} />}
            </>
          ) : (
            <>
              {/* ── Event view ── */}
              {event && (
                <>
                  {event.groupId && <div><span className="px-3 py-1.5 rounded-full text-xs font-bold" style={{ backgroundColor: `${color}20`, color }}>{gName(groups, event.groupId)}</span></div>}
                  <InfoRow icon="🗓" label="Date">
                    {event.repeatDays.length > 0
                      ? `Starts ${fmtDateStr(event.startDate)}${event.endDate ? ` · until ${fmtDateStr(event.endDate)}` : ""}`
                      : event.startDate === event.endDate ? fmtDateStr(event.startDate) : `${fmtDateStr(event.startDate)} → ${fmtDateStr(event.endDate)}`}
                  </InfoRow>
                  {event.startTime && <InfoRow icon="🕐" label="Time">{m2d(t2m(event.startTime))} – {m2d(t2m(event.endTime))}</InfoRow>}
                  {event.repeatDays.length > 0 && <InfoRow icon="🔁" label="Repeats">{event.repeatDays.map(d => DS[d]).join(", ")}{!event.endDate ? " (no end)" : ""}</InfoRow>}
                  {event.notes && <InfoRow icon="📝" label="Notes">{event.notes}</InfoRow>}
                </>
              )}

              {/* ── Task view ── */}
              {task && (
                <>
                  <button onClick={() => onTaskToggle(task.id)}
                    className="w-full flex items-center gap-3 rounded-2xl px-4 py-3.5"
                    style={{ backgroundColor: task.done ? `${gColor(groups, task.groupId)}15` : "rgba(255,255,255,.06)", outline: task.done ? `1px solid ${gColor(groups, task.groupId)}40` : "none" }}>
                    <div className="w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0"
                      style={{ borderColor: gColor(groups, task.groupId), backgroundColor: task.done ? gColor(groups, task.groupId) : "transparent" }}>
                      {task.done && <Check size={12} className="text-white" />}
                    </div>
                    <span className="text-sm font-semibold flex-1 text-left"
                      style={{ color: task.done ? "#7878A4" : "#EEEEF8", textDecoration: task.done ? "line-through" : "none" }}>
                      {task.done ? "Done — tap to undo" : "Mark as done"}
                    </span>
                  </button>
                  {task.groupId && <div><span className="px-3 py-1.5 rounded-full text-xs font-bold" style={{ backgroundColor: `${gColor(groups, task.groupId)}20`, color: gColor(groups, task.groupId) }}>{gName(groups, task.groupId)}</span></div>}
                  <InfoRow icon="📅" label="Due">{fmtDateStr(task.dueDate)}{task.dueTime ? ` at ${m2d(t2m(task.dueTime))}` : ""}</InfoRow>
                  {task.repeatDays.length > 0 && <InfoRow icon="🔁" label="Repeats">{task.repeatDays.map(d => DS[d]).join(", ")}</InfoRow>}
                  {task.notes && <InfoRow icon="📝" label="Notes">{task.notes}</InfoRow>}

                  {task.subtasks && task.subtasks.length > 0 && (
                    <div>
                      <p className="mb-2" style={{ ...labelSty, fontSize: 9 }}>Subtasks ({task.subtasks.filter(st => st.done).length}/{task.subtasks.length})</p>
                      <div className="space-y-2">
                        {task.subtasks.map(st => (
                          <div key={st.id} className="flex items-start gap-2.5 p-3 rounded-xl" style={{ backgroundColor: "rgba(255,255,255,.04)" }}>
                            <button onClick={() => {
                              const updated = { ...task, subtasks: task.subtasks.map(s => s.id === st.id ? { ...s, done: !s.done } : s) };
                              onUpdateTask(updated);
                            }}
                              className="w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 mt-0.5"
                              style={{ borderColor: gColor(groups, task.groupId), backgroundColor: st.done ? gColor(groups, task.groupId) : "transparent" }}>
                              {st.done && <Check size={10} className="text-white" />}
                            </button>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm" style={{ color: st.done ? "#7878A4" : "#EEEEF8", textDecoration: st.done ? "line-through" : "none" }}>
                                {st.title}
                              </p>
                              {st.dueDate && (
                                <p className="text-xs mt-0.5" style={{ color: "#4E4E72" }}>
                                  {fmtDateStr(st.dueDate)}
                                </p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* ── Goal view ── */}
              {goal && (
                <>
                  {goal.groupId && <div><span className="px-3 py-1.5 rounded-full text-xs font-bold" style={{ backgroundColor: `${color}20`, color }}>{gName(groups, goal.groupId)}</span></div>}
                  <InfoRow icon="📊" label="Target">{goal.amount} {goal.unit}</InfoRow>
                  <InfoRow icon="📅" label="Schedule">{goal.days.map(d => DF[d]).join(", ")}</InfoRow>
                  {goalApplies(goal, selectedDate) && (() => {
                    const logged = goalLogs.some(l => l.goalId === goal.id && l.date === dKey(selectedDate));
                    return (
                      <button onClick={() => toggleGoalLog(goal.id, selectedDate)}
                        className="w-full flex items-center gap-3 rounded-2xl px-4 py-3.5"
                        style={{ backgroundColor: logged ? `${color}15` : "rgba(255,255,255,.06)", outline: logged ? `1px solid ${color}40` : "none" }}>
                        <div className="w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0"
                          style={{ borderColor: color, backgroundColor: logged ? color : "transparent" }}>
                          {logged && <Check size={12} className="text-white" />}
                        </div>
                        <span className="text-sm font-semibold" style={{ color: logged ? "#7878A4" : "#EEEEF8" }}>
                          {logged ? `Logged for ${MF[selectedDate.getMonth()].slice(0,3)} ${selectedDate.getDate()} — tap to undo` : `Log for ${MF[selectedDate.getMonth()].slice(0,3)} ${selectedDate.getDate()}`}
                        </span>
                      </button>
                    );
                  })()}
                </>
              )}

              {/* ── Meal view ── */}
              {meal && (
                <>
                  <div><span className="px-3 py-1.5 rounded-full text-xs font-bold capitalize" style={{ backgroundColor: "rgba(251,146,60,.15)", color: "#FB923C" }}>{meal.mealType}</span></div>
                  <InfoRow icon="🗓" label="Date">{fmtDateStr(meal.date)}{meal.time ? ` at ${m2d(t2m(meal.time))}` : ""}</InfoRow>
                  <InfoRow icon="🔥" label="Calories">{meal.calories} kcal</InfoRow>
                  <div className="grid grid-cols-3 gap-2">
                    {[{l:"Protein",v:meal.protein,c:"#38BDF8"},{l:"Carbs",v:meal.carbs,c:"#818CF8"},{l:"Fat",v:meal.fat,c:"#F472B6"}].map(n => (
                      <div key={n.l} className="rounded-xl py-2.5 text-center" style={{ backgroundColor: "rgba(255,255,255,.04)" }}>
                        <p className="font-bold" style={{ color: n.c, fontSize: 15 }}>{n.v}g</p>
                        <p style={{ fontSize: 10, color: "#4E4E72" }}>{n.l}</p>
                      </div>
                    ))}
                  </div>
                  {meal.description && <InfoRow icon="📝" label="Notes">{meal.description}</InfoRow>}
                </>
              )}

              {/* ── Workout view ── */}
              {workout && (
                <>
                  <InfoRow icon="🗓" label="Date">{fmtDateStr(workout.date)}</InfoRow>
                  <InfoRow icon="🕐" label="Time">{m2d(t2m(workout.startTime))} – {m2d(t2m(workout.endTime))}</InfoRow>
                  <InfoRow icon="⏱" label="Duration">{t2m(workout.endTime) - t2m(workout.startTime)} min</InfoRow>
                  {workout.exercises.length > 0 && (
                    <div>
                      <p className="mb-2" style={labelSty}>Exercises</p>
                      <div className="space-y-1.5">
                        {workout.exercises.map(ex => (
                          <div key={ex.id} className="rounded-xl px-3 py-2.5 flex items-center justify-between" style={{ backgroundColor: "rgba(255,255,255,.04)" }}>
                            <p className="text-white text-sm font-medium">{ex.name}</p>
                            <p style={{ fontSize: 11, color: "#4E4E72" }}>{ex.sets.length} sets · {ex.sets.filter(s => s.done).length} done</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}

              {kind !== "workout" && (
                <button onClick={() => setEditing(true)}
                  className="w-full py-3.5 rounded-2xl font-bold text-sm"
                  style={{ backgroundColor: "rgba(99,102,241,.12)", color: "#818CF8", outline: "1px solid rgba(99,102,241,.25)" }}>
                  Edit
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Add Menu ─────────────────────────────────────────────────────────────────
function AddMenu({ onSelect, onClose }: { onSelect: (m: ModalKind) => void; onClose: () => void }) {
  const opts: { icon: React.ElementType; label: string; m: ModalKind; c: string }[] = [
    { icon: Calendar, label: "Event",   m: "event",        c: "#38BDF8" },
    { icon: Check,    label: "Task",    m: "task",         c: "#818CF8" },
    { icon: Utensils, label: "Meal",    m: "meal",         c: "#FB923C" },
    { icon: Dumbbell, label: "Workout", m: "startWorkout", c: "#34D399" },
    { icon: Target,   label: "Goal",    m: "goal",         c: "#F472B6" },
  ];
  return (
    <div className="absolute inset-0 z-40 flex items-end"
      style={{ backgroundColor: "rgba(0,0,0,.6)", backdropFilter: "blur(8px)" }} onClick={onClose}>
      <div className="w-full px-4 pb-24" onClick={e => e.stopPropagation()}>
        <div className="grid grid-cols-5 gap-2 mb-3">
          {opts.map(o => (
            <button key={o.label} onClick={() => { onSelect(o.m); onClose(); }}
              className="flex flex-col items-center gap-2 py-4 rounded-2xl"
              style={{ backgroundColor: "rgba(255,255,255,.09)" }}>
              <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: `${o.c}20` }}>
                <o.icon size={18} style={{ color: o.c }} />
              </div>
              <span className="text-white font-semibold" style={{ fontSize: 10 }}>{o.label}</span>
            </button>
          ))}
        </div>
        <button onClick={onClose} className="w-full py-3.5 rounded-2xl font-bold text-sm"
          style={{ backgroundColor: "rgba(255,255,255,.09)", color: "#7878A4" }}>
          Cancel
        </button>
      </div>
    </div>
  );
}

// ─── Bottom Nav ───────────────────────────────────────────────────────────────
function BottomNav({ screen, onChange }: { screen: Screen; onChange: (s: Screen) => void }) {
  const items: { id: Screen; icon: React.ElementType; label: string }[] = [
    { id: "today",   icon: Home,      label: "Today"   },
    { id: "month",   icon: BarChart3, label: "Month"   },
    { id: "workout", icon: Dumbbell,  label: "Workout" },
    { id: "meal",    icon: Utensils,  label: "Meal"    },
    { id: "goals",   icon: Target,    label: "Goals"   },
  ];
  return (
    <div className="absolute bottom-0 left-0 right-0 px-3 pb-5 pt-3"
      style={{ background: "linear-gradient(to top, #0B0B10 65%, transparent)" }}>
      <div className="flex items-center justify-around rounded-2xl px-1 py-1.5"
        style={{ backgroundColor: "rgba(255,255,255,.07)" }}>
        {items.map(item => {
          const active = screen === item.id;
          return (
            <button key={item.id} onClick={() => onChange(item.id)}
              className="flex flex-col items-center gap-1 px-3 py-2 rounded-xl"
              style={{ backgroundColor: active ? "rgba(99,102,241,.25)" : "transparent" }}>
              <item.icon size={18} style={{ color: active ? "#818CF8" : "#3A3A5E" }} />
              <span style={{ fontSize: 9, fontWeight: 700, color: active ? "#818CF8" : "#3A3A5E" }}>{item.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function applyPlannerPayload(
  data: PlannerDataPayload,
  apply: {
    setCalEvents: (v: CalEvent[]) => void;
    setCalTasks: (v: CalTask[]) => void;
    setCalMeals: (v: CalMeal[]) => void;
    setCalWorkouts: (v: CalWorkout[]) => void;
    setCalGoals: (v: CalGoal[]) => void;
    setGoalLogs: (v: GoalLog[]) => void;
    setGroups: (v: Group[]) => void;
    setActiveWorkout: (v: ActiveWO | null) => void;
    setShowWorkoutOverlay: (v: boolean) => void;
  },
) {
  if (Array.isArray(data.calEvents)) apply.setCalEvents(data.calEvents as CalEvent[]);
  if (Array.isArray(data.calTasks)) {
    apply.setCalTasks((data.calTasks as CalTask[]).map((t) => ({ ...t, subtasks: t.subtasks || [] })));
  }
  if (Array.isArray(data.calMeals)) apply.setCalMeals(data.calMeals as CalMeal[]);
  if (Array.isArray(data.calWorkouts)) apply.setCalWorkouts(data.calWorkouts as CalWorkout[]);
  if (Array.isArray(data.calGoals)) apply.setCalGoals(data.calGoals as CalGoal[]);
  if (Array.isArray(data.goalLogs)) apply.setGoalLogs(data.goalLogs as GoalLog[]);
  if (Array.isArray(data.groups)) apply.setGroups(data.groups as Group[]);
  if (data.activeWorkout) {
    apply.setActiveWorkout(data.activeWorkout as ActiveWO);
    apply.setShowWorkoutOverlay(true);
  }
}

// ─── App ──────────────────────────────────────────────────────────────────────
export default function App({ userId, username, onSignOut }: AppProps) {
  const [screen, setScreen]       = useState<Screen>("today");
  const [todayTab, setTodayTab]   = useState<TodayTab>("all");
  const [modal, setModal]         = useState<ModalKind | null>(null);
  const [addOpen, setAddOpen]     = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date>(todayDate);
  const [showWorkoutOverlay, setShowWorkoutOverlay] = useState(false);
  const [detailItem, setDetailItem] = useState<{ kind: DetailKind; id: string } | null>(null);
  const [accountOpen, setAccountOpen] = useState(false);
  const [syncStatus, setSyncStatus] = useState<"idle" | "saving" | "error">("idle");

  const [calEvents,   setCalEvents]   = useState<CalEvent[]>([]);
  const [calTasks,    setCalTasks]    = useState<CalTask[]>([]);
  const [calMeals,    setCalMeals]    = useState<CalMeal[]>([]);
  const [calWorkouts, setCalWorkouts] = useState<CalWorkout[]>([]);
  const [calGoals,    setCalGoals]    = useState<CalGoal[]>([]);
  const [goalLogs,    setGoalLogs]    = useState<GoalLog[]>([]);
  const [groups,      setGroups]      = useState<Group[]>(DEFAULT_GROUPS);
  const [activeWorkout, setActiveWorkout] = useState<ActiveWO | null>(null);
  const [loaded, setLoaded] = useState(false);

  // ── Load planner data for this account ──
  useEffect(() => {
    let cancelled = false;
    setLoaded(false);

    (async () => {
      const apply = {
        setCalEvents, setCalTasks, setCalMeals, setCalWorkouts, setCalGoals,
        setGoalLogs, setGroups, setActiveWorkout, setShowWorkoutOverlay,
      };

      try {
        let payload = await loadPlannerData(userId);
        if (!payload) {
          payload = readLocalPlannerBackup(userId) ?? readLegacyLocalPlanner();
          if (payload) await savePlannerData(userId, payload);
        }
        if (!cancelled && payload) applyPlannerPayload(payload, apply);
      } catch {
        const fallback = readLocalPlannerBackup(userId) ?? readLegacyLocalPlanner();
        if (!cancelled && fallback) applyPlannerPayload(fallback, apply);
        if (!cancelled) setSyncStatus("error");
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();

    return () => { cancelled = true; };
  }, [userId]);

  // ── Auto-save to cloud (debounced) + local backup ──
  useEffect(() => {
    if (!loaded) return;

    const payload: PlannerDataPayload = {
      calEvents, calTasks, calMeals, calWorkouts, calGoals, goalLogs, groups, activeWorkout,
    };
    writeLocalPlannerBackup(userId, payload);

    const timer = window.setTimeout(() => {
      setSyncStatus("saving");
      savePlannerData(userId, payload)
        .then(() => setSyncStatus("idle"))
        .catch(() => setSyncStatus("error"));
    }, 700);

    return () => window.clearTimeout(timer);
  }, [loaded, userId, calEvents, calTasks, calMeals, calWorkouts, calGoals, goalLogs, groups, activeWorkout]);

  const openModal = (m: ModalKind) => { setModal(m); setAddOpen(false); };

  const startWorkout = (name: string) => {
    setActiveWorkout({ name, startedAt: new Date().toISOString(), exercises: [] });
    setShowWorkoutOverlay(true);
    setModal(null);
  };

  const completeWorkout = () => {
    if (!activeWorkout) return;
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    const startedAt = new Date(activeWorkout.startedAt);
    const startTime = `${pad(startedAt.getHours())}:${pad(startedAt.getMinutes())}`;
    const endTime   = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
    setCalWorkouts(prev => [...prev, {
      id: uid(), name: activeWorkout.name,
      date: dKey(startedAt), startTime, endTime,
      exercises: activeWorkout.exercises,
    }]);
    setActiveWorkout(null);
    setShowWorkoutOverlay(false);
    setScreen("workout");
  };

  const cancelWorkout = () => {
    setActiveWorkout(null);
    setShowWorkoutOverlay(false);
  };

  const toggleGoalLog = (goalId: string, date: Date) => {
    const dateStr = dKey(date);
    setGoalLogs(prev => {
      const exists = prev.find(l => l.goalId === goalId && l.date === dateStr);
      if (exists) return prev.filter(l => !(l.goalId === goalId && l.date === dateStr));
      return [...prev, { id: uid(), goalId, date: dateStr }];
    });
  };

  const openDetail = (kind: DetailKind, id: string) => setDetailItem({ kind, id });
  const closeDetail = () => setDetailItem(null);

  const updateEvent   = (e: CalEvent)   => setCalEvents(p => p.map(x => x.id === e.id ? e : x));
  const updateTask    = (t: CalTask)    => setCalTasks(p => p.map(x => x.id === t.id ? t : x));
  const updateGoal    = (g: CalGoal)    => setCalGoals(p => p.map(x => x.id === g.id ? g : x));
  const updateMeal    = (m: CalMeal)    => setCalMeals(p => p.map(x => x.id === m.id ? m : x));

  const deleteEvent   = (id: string) => setCalEvents(p => p.filter(x => x.id !== id));
  const deleteTask    = (id: string) => setCalTasks(p => p.filter(x => x.id !== id));
  const deleteGoal    = (id: string) => setCalGoals(p => p.filter(x => x.id !== id));
  const deleteMeal    = (id: string) => setCalMeals(p => p.filter(x => x.id !== id));
  const deleteWorkout = (id: string) => setCalWorkouts(p => p.filter(x => x.id !== id));

  // Auto-navigate to the right place after adding so users see their new item
  const handleAddEvent = (e: CalEvent) => {
    setCalEvents(p => [...p, e]);
    setScreen("today");
    setTodayTab("all");
  };
  const handleAddTask = (t: CalTask) => {
    setCalTasks(p => [...p, t]);
    setScreen("today");
    setTodayTab("all");
    // Navigate to the task's due date so user sees it
    setSelectedDate(new Date(t.dueDate + "T00:00:00"));
  };
  const handleAddGoal = (g: CalGoal) => {
    setCalGoals(p => [...p, g]);
    setScreen("goals");
  };

  const sharedProps = { selectedDate, setSelectedDate, calEvents, calTasks, calWorkouts, calGoals, groups };

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "#05050A", fontFamily: "'Inter', sans-serif" }}>
      <div className="relative w-full max-w-sm overflow-hidden"
        style={{ height: "100dvh", maxHeight: 900, backgroundColor: "#0B0B10", boxShadow: "0 0 100px rgba(0,0,0,.9)" }}>

        <div className="absolute inset-0 overflow-hidden">
          {screen === "today"   && <TodayView {...sharedProps} todayTab={todayTab} setTodayTab={setTodayTab} activeWorkout={activeWorkout} onModal={openModal} setCalTasks={setCalTasks} goalLogs={goalLogs} toggleGoalLog={toggleGoalLog} onDetail={openDetail} username={username} onAccountClick={() => setAccountOpen(true)} />}
          {screen === "workout" && <WorkoutScreen calWorkouts={calWorkouts} activeWorkout={activeWorkout} onModal={openModal} onResumeWorkout={() => setShowWorkoutOverlay(true)} onDetail={openDetail} />}
          {screen === "month"   && <MonthView {...sharedProps} />}
          {screen === "meal"    && <MealView selectedDate={selectedDate} setSelectedDate={setSelectedDate} calMeals={calMeals} onModal={openModal} onDetail={openDetail} />}
          {screen === "goals"   && <GoalsView calGoals={calGoals} groups={groups} onModal={openModal} goalLogs={goalLogs} toggleGoalLog={toggleGoalLog} onDetail={openDetail} />}
        </div>

        {/* FAB */}
        {!addOpen && !modal && !showWorkoutOverlay && (
          <button onClick={() => setAddOpen(true)}
            className="absolute right-5 z-30 rounded-full flex items-center justify-center"
            style={{ bottom: 82, width: 50, height: 50, background: "linear-gradient(135deg,#6366F1,#8B5CF6)", boxShadow: "0 8px 24px rgba(99,102,241,.45)" }}>
            <Plus size={20} className="text-white" />
          </button>
        )}

        <BottomNav screen={screen} onChange={setScreen} />

        {addOpen && <AddMenu onSelect={openModal} onClose={() => setAddOpen(false)} />}
        {showWorkoutOverlay && activeWorkout && (
          <WorkoutOverlay activeWorkout={activeWorkout} setActiveWorkout={setActiveWorkout} onComplete={completeWorkout} onCancel={cancelWorkout} />
        )}

        {detailItem && (
          <DetailModal
            kind={detailItem.kind} id={detailItem.id}
            groups={groups} selectedDate={selectedDate}
            goalLogs={goalLogs} toggleGoalLog={toggleGoalLog}
            calEvents={calEvents} calTasks={calTasks} calGoals={calGoals} calMeals={calMeals} calWorkouts={calWorkouts}
            onClose={closeDetail}
            onUpdateEvent={updateEvent} onUpdateTask={updateTask} onUpdateGoal={updateGoal} onUpdateMeal={updateMeal}
            onDeleteEvent={deleteEvent} onDeleteTask={deleteTask} onDeleteGoal={deleteGoal} onDeleteMeal={deleteMeal} onDeleteWorkout={deleteWorkout}
            onTaskToggle={id => setCalTasks(p => p.map(t => t.id === id ? { ...t, done: !t.done } : t))}
          />
        )}

        {modal === "event"        && <EventModal        groups={groups} selectedDate={selectedDate} onAdd={handleAddEvent}                         onClose={() => setModal(null)} />}
        {modal === "task"         && <TaskModal         groups={groups} selectedDate={selectedDate} onAdd={handleAddTask}                          onClose={() => setModal(null)} />}
        {modal === "meal"         && <MealModal         selectedDate={selectedDate}                 onAdd={m => setCalMeals(p => [...p, m])}       onClose={() => setModal(null)} />}
        {modal === "goal"         && <GoalModal         groups={groups}                             onAdd={handleAddGoal}                          onClose={() => setModal(null)} />}
        {modal === "startWorkout" && <StartWorkoutModal                                             onStart={startWorkout}                         onClose={() => setModal(null)} />}
        {modal === "groups"       && <GroupsModal       groups={groups} setGroups={setGroups}                                                      onClose={() => setModal(null)} />}

        {accountOpen && (
          <AccountMenu
            username={username}
            syncStatus={syncStatus}
            onSignOut={onSignOut}
            onClose={() => setAccountOpen(false)}
          />
        )}
      </div>
    </div>
  );
}
