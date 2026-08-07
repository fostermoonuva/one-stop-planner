import { useState, useEffect } from "react";
import { Dumbbell, Utensils, ChevronLeft, ChevronRight, Plus, Play, MoreHorizontal } from "lucide-react";
import type { CalMeal, CalWorkout, ActiveWO, MealType } from "../app/App";
import { uid, dKey, addDays, isToday, t2m, m2d, fmtT, todayDate, MF } from "../app/App";

// ─── Types ────────────────────────────────────────────────────────────────────
type FitnessTab = "workouts" | "nutrition";

interface FitnessViewProps {
  selectedDate: Date;
  setSelectedDate: (d: Date) => void;
  calMeals: CalMeal[];
  calWorkouts: CalWorkout[];
  activeWorkout: ActiveWO | null;
  onModal: (m: "meal" | "startWorkout") => void;
  onResumeWorkout: () => void;
  onDetail: (kind: "meal" | "workout", id: string) => void;
}

// ─── Fitness Summary Banner ───────────────────────────────────────────────────
function FitnessSummaryBanner({ 
  selectedDate, 
  calMeals, 
  calWorkouts, 
  activeWorkout, 
  onResumeWorkout 
}: {
  selectedDate: Date;
  calMeals: CalMeal[];
  calWorkouts: CalWorkout[];
  activeWorkout: ActiveWO | null;
  onResumeWorkout: () => void;
}) {
  const dateStr = dKey(selectedDate);
  const isCurrentDay = isToday(selectedDate);
  
  // Workout info
  const todaysWorkouts = calWorkouts.filter(w => w.date === dateStr);
  const latestWorkout = todaysWorkouts.length > 0 ? todaysWorkouts[todaysWorkouts.length - 1] : null;
  const workoutDuration = latestWorkout ? t2m(latestWorkout.endTime) - t2m(latestWorkout.startTime) : 0;
  
  // Nutrition info
  const todaysMeals = calMeals.filter(m => m.date === dateStr);
  const totalCal = todaysMeals.reduce((a, m) => a + m.calories, 0);
  const totalPro = todaysMeals.reduce((a, m) => a + m.protein, 0);
  const totalCarb = todaysMeals.reduce((a, m) => a + m.carbs, 0);
  const totalFat = todaysMeals.reduce((a, m) => a + m.fat, 0);
  
  // Targets (can be made configurable later)
  const CAL_TARGET = 2000;
  const PRO_TARGET = 150;
  const CARB_TARGET = 200;
  const FAT_TARGET = 65;
  
  const calPercent = Math.min((totalCal / CAL_TARGET) * 100, 100);
  const proPercent = Math.min((totalPro / PRO_TARGET) * 100, 100);
  const carbPercent = Math.min((totalCarb / CARB_TARGET) * 100, 100);
  const fatPercent = Math.min((totalFat / FAT_TARGET) * 100, 100);

  return (
    <div className="rounded-2xl p-4 space-y-3" style={{ backgroundColor: "rgba(255,255,255,.7)", backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)", border: "1px solid rgba(255,255,255,.6)" }}>
      {/* Workout Section */}
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: activeWorkout ? "rgba(244,63,94,.2)" : latestWorkout ? "rgba(244,63,94,.1)" : "rgba(0,0,0,.04)" }}>
          <Dumbbell size={18} style={{ color: "#F43F5E" }} />
        </div>
        <div className="flex-1 min-w-0">
          <p style={{ fontSize: 9, fontWeight: 700, color: "#78716C", letterSpacing: "0.08em", textTransform: "uppercase" }}>Workout</p>
          {activeWorkout ? (
            <button onClick={onResumeWorkout} className="w-full text-left">
              <p className="text-stone-900 font-bold text-sm truncate">{activeWorkout.name}</p>
              <p style={{ fontSize: 10, color: "rgba(244,63,94,.7)" }}>In Progress · tap to resume</p>
            </button>
          ) : latestWorkout ? (
            <div>
              <p className="text-stone-900 font-bold text-sm truncate">{latestWorkout.name}</p>
              <p style={{ fontSize: 10, color: "#78716C" }}>{isCurrentDay ? "Today" : `${MF[selectedDate.getMonth()].slice(0,3)} ${selectedDate.getDate()}`} · {workoutDuration}m</p>
            </div>
          ) : (
            <p style={{ fontSize: 12, color: "#78716C" }}>No workout {isCurrentDay ? "yet" : "this day"}</p>
          )}
        </div>
      </div>

      {/* Nutrition Section */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <Utensils size={14} style={{ color: "#FB923C" }} />
          <p style={{ fontSize: 9, fontWeight: 700, color: "#78716C", letterSpacing: "0.08em", textTransform: "uppercase" }}>Nutrition</p>
          {isCurrentDay && <span className="font-bold" style={{ fontSize: 13, color: "#FB923C" }}>{totalCal} kcal</span>}
        </div>
        
        {/* Macro Rings */}
        <div className="grid grid-cols-4 gap-2">
          {[
            { label: "Cal", current: totalCal, target: CAL_TARGET, unit: "", color: "#FB923C" },
            { label: "Protein", current: totalPro, target: PRO_TARGET, unit: "g", color: "#38BDF8" },
            { label: "Carbs", current: totalCarb, target: CARB_TARGET, unit: "g", color: "#818CF8" },
            { label: "Fat", current: totalFat, target: FAT_TARGET, unit: "g", color: "#F472B6" },
          ].map(macro => {
            const percent = Math.min((macro.current / macro.target) * 100, 100);
            const circumference = 2 * Math.PI * 18;
            const strokeDashoffset = circumference - (percent / 100) * circumference;
            
            return (
              <div key={macro.label} className="flex flex-col items-center gap-1">
                <div className="relative w-12 h-12">
                  <svg className="w-12 h-12 -rotate-90">
                    <circle
                      cx="24" cy="24" r="18"
                      fill="none"
                      stroke="rgba(0,0,0,.06)"
                      strokeWidth="3"
                    />
                    <circle
                      cx="24" cy="24" r="18"
                      fill="none"
                      stroke={macro.color}
                      strokeWidth="3"
                      strokeDasharray={circumference}
                      strokeDashoffset={strokeDashoffset}
                      strokeLinecap="round"
                      style={{ transition: "stroke-dashoffset 0.5s ease" }}
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span style={{ fontSize: 9, fontWeight: 700, color: "#1C1917" }}>{Math.round(percent)}%</span>
                  </div>
                </div>
                <span style={{ fontSize: 9, color: "#78716C", fontWeight: 600 }}>{macro.label}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Workouts Sub-View ────────────────────────────────────────────────────────
function WorkoutsSubView({ 
  calWorkouts, 
  activeWorkout, 
  onModal, 
  onResumeWorkout, 
  onDetail 
}: {
  calWorkouts: CalWorkout[];
  activeWorkout: ActiveWO | null;
  onModal: (m: "startWorkout") => void;
  onResumeWorkout: () => void;
  onDetail: (kind: "workout", id: string) => void;
}) {
  const sorted = [...calWorkouts].sort((a, b) => {
    if (b.date !== a.date) return b.date.localeCompare(a.date);
    return b.startTime.localeCompare(a.startTime);
  });

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="px-5 pt-10 pb-4 flex-shrink-0 flex items-end justify-between">
        <div>
          <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#78716C" }}>Training</p>
          <h1 className="text-stone-900 font-bold" style={{ fontSize: 22 }}>Workouts</h1>
        </div>
        <button onClick={() => onModal("startWorkout")}
          className="flex items-center gap-2 px-4 py-2.5 rounded-full font-bold text-sm"
          style={{ background: "linear-gradient(135deg,#F43F5E,#f97316)", color: "#fff" }}>
          <Play size={13} fill="currentColor" /> Start
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-28 space-y-3" style={{ scrollbarWidth: "none" }}>
        {/* Active workout banner */}
        {activeWorkout && (
          <button onClick={onResumeWorkout} className="w-full rounded-2xl p-4 text-left"
            style={{ backgroundColor: "rgba(244,63,94,.1)", outline: "1.5px solid rgba(244,63,94,.3)" }}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: "rgba(244,63,94,.2)" }}>
                <Dumbbell size={18} style={{ color: "#F43F5E" }} />
              </div>
              <div className="flex-1 min-w-0">
                <p style={{ fontSize: 9, fontWeight: 700, color: "#F43F5E", letterSpacing: "0.08em", textTransform: "uppercase" }}>In Progress</p>
                <p className="text-stone-900 font-bold text-sm truncate">{activeWorkout.name}</p>
                <p style={{ fontSize: 10, color: "rgba(244,63,94,.7)" }}>{activeWorkout.exercises.length} exercises · tap to resume</p>
              </div>
              <WorkoutElapsed startedAt={activeWorkout.startedAt} />
            </div>
          </button>
        )}

        {/* Empty state */}
        {sorted.length === 0 && !activeWorkout && (
          <div className="flex flex-col items-center justify-center h-64 gap-4">
            <div className="w-20 h-20 rounded-full flex items-center justify-center"
              style={{ backgroundColor: "rgba(244,63,94,.08)", outline: "1px solid rgba(244,63,94,.15)" }}>
              <Dumbbell size={32} style={{ color: "rgba(244,63,94,.4)" }} />
            </div>
            <div className="text-center">
              <p className="text-stone-900 font-semibold text-sm">No workouts yet</p>
              <p style={{ fontSize: 12, color: "#78716C", marginTop: 4 }}>Start your first session to track progress</p>
            </div>
            <button onClick={() => onModal("startWorkout")}
              className="px-8 py-3 rounded-full font-bold text-sm"
              style={{ background: "linear-gradient(135deg,#F43F5E,#f97316)", color: "#fff" }}>
              Start First Workout
            </button>
          </div>
        )}

        {sorted.length > 0 && (
          <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#78716C" }}>History</p>
        )}
        {sorted.map(w => {
          const totalSets = w.exercises.reduce((a, e) => a + e.sets.length, 0);
          const doneSets  = w.exercises.reduce((a, e) => a + e.sets.filter(s => s.done).length, 0);
          const volume    = w.exercises.reduce((a, e) => a + e.sets.filter(s=>s.done).reduce((b,s)=>b+s.wt*s.reps,0), 0);
          const dur       = t2m(w.endTime) - t2m(w.startTime);
          const dateObj   = new Date(w.date + "T00:00:00");
          const label     = isToday(dateObj) ? "Today" : `${MF[dateObj.getMonth()].slice(0,3)} ${dateObj.getDate()}`;
          return (
            <div key={w.id} onClick={() => onDetail("workout", w.id)} className="rounded-2xl p-4" style={{ backgroundColor: "rgba(255,255,255,.7)", backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)", border: "1px solid rgba(255,255,255,.6)", cursor: "pointer" }}>
              <div className="flex items-start justify-between mb-3">
              <div className="flex-1 min-w-0">
                <p className="text-stone-900 font-bold text-sm truncate">{w.name}</p>
                <p style={{ fontSize: 10, color: "#78716C", marginTop: 1 }}>{label} · {m2d(t2m(w.startTime))} – {m2d(t2m(w.endTime))}</p>
              </div>
                <div className="rounded-xl px-2.5 py-1 ml-2 flex-shrink-0" style={{ backgroundColor: "rgba(244,63,94,.12)" }}>
                  <p style={{ fontSize: 10, fontWeight: 700, color: "#F43F5E" }}>{dur}m</p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { l: "Exercises", v: w.exercises.length, c: "#818CF8" },
                  { l: "Sets Done",  v: `${doneSets}/${totalSets}`, c: "#38BDF8" },
                  { l: "Volume",     v: `${volume}lb`, c: "#F43F5E" },
                ].map(s => (
                  <div key={s.l} className="rounded-xl py-2 text-center" style={{ backgroundColor: "rgba(255,255,255,.04)" }}>
                  <p style={{ color: s.c, fontWeight: 700, fontSize: 12 }}>{s.v}</p>
                  <p style={{ color: "#78716C", fontSize: 9 }}>{s.l}</p>
                  </div>
                ))}
              </div>
              {w.exercises.length > 0 && (
                <div className="mt-3 space-y-1">
                  {w.exercises.slice(0, 3).map(ex => (
                    <div key={ex.id} className="flex items-center justify-between">
                      <p style={{ fontSize: 11, color: "#78716C" }}>{ex.name}</p>
                      <p style={{ fontSize: 10, color: "#78716C" }}>{ex.sets.length} sets</p>
                    </div>
                  ))}
                  {w.exercises.length > 3 && (
                    <p style={{ fontSize: 10, color: "#78716C" }}>+{w.exercises.length - 3} more</p>
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

function WorkoutElapsed({ startedAt }: { startedAt: string }) {
  const [, tick] = useState(0);
  useEffect(() => { const id = setInterval(() => tick(t => t + 1), 1000); return () => clearInterval(id); }, []);
  const secs = Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000);
  return <span className="text-sm font-mono font-bold" style={{ color: "#F43F5E" }}>{fmtT(Math.max(0, secs))}</span>;
}

// ─── Nutrition Sub-View ───────────────────────────────────────────────────────
function NutritionSubView({ 
  selectedDate, 
  setSelectedDate, 
  calMeals, 
  onModal, 
  onDetail 
}: {
  selectedDate: Date;
  setSelectedDate: (d: Date) => void;
  calMeals: CalMeal[];
  onModal: (m: "meal") => void;
  onDetail: (kind: "meal", id: string) => void;
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
          <div className="rounded-2xl p-4" style={{ backgroundColor: "rgba(255,255,255,.7)", backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)", border: "1px solid rgba(255,255,255,.6)" }}>
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
                <div key={m.id} onClick={() => onDetail("meal", m.id)} className="rounded-2xl p-3.5 mb-2 flex items-start justify-between" style={{ backgroundColor: "rgba(255,255,255,.7)", backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)", border: "1px solid rgba(255,255,255,.6)", cursor: "pointer" }}>
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

// ─── Main Fitness View ────────────────────────────────────────────────────────
export default function FitnessView({ 
  selectedDate, 
  setSelectedDate, 
  calMeals, 
  calWorkouts, 
  activeWorkout, 
  onModal, 
  onResumeWorkout, 
  onDetail 
}: FitnessViewProps) {
  const [activeTab, setActiveTab] = useState<FitnessTab>("workouts");

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header with tab toggle */}
      <div className="px-5 pt-10 pb-3 flex-shrink-0">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#78716C" }}>Fitness</p>
            <h1 className="text-stone-900 font-bold" style={{ fontSize: 22 }}>Your Fitness</h1>
          </div>
        </div>
        
        {/* Tab Toggle */}
        <div className="flex rounded-xl p-1" style={{ backgroundColor: "rgba(0,0,0,.06)" }}>
          <button
            onClick={() => setActiveTab("workouts")}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg font-bold text-sm transition-all"
            style={{
              backgroundColor: activeTab === "workouts" ? "#fff" : "transparent",
              color: activeTab === "workouts" ? "#1C1917" : "#78716C",
              boxShadow: activeTab === "workouts" ? "0 1px 3px rgba(0,0,0,.1)" : "none"
            }}>
            <Dumbbell size={16} />
            Workouts
          </button>
          <button
            onClick={() => setActiveTab("nutrition")}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg font-bold text-sm transition-all"
            style={{
              backgroundColor: activeTab === "nutrition" ? "#fff" : "transparent",
              color: activeTab === "nutrition" ? "#1C1917" : "#78716C",
              boxShadow: activeTab === "nutrition" ? "0 1px 3px rgba(0,0,0,.1)" : "none"
            }}>
            <Utensils size={16} />
            Nutrition & Meals
          </button>
        </div>
      </div>

      {/* Summary Banner */}
      <div className="px-4 flex-shrink-0">
        <FitnessSummaryBanner 
          selectedDate={selectedDate}
          calMeals={calMeals}
          calWorkouts={calWorkouts}
          activeWorkout={activeWorkout}
          onResumeWorkout={onResumeWorkout}
        />
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-hidden mt-3">
        {activeTab === "workouts" ? (
          <WorkoutsSubView 
            calWorkouts={calWorkouts}
            activeWorkout={activeWorkout}
            onModal={onModal}
            onResumeWorkout={onResumeWorkout}
            onDetail={onDetail}
          />
        ) : (
          <NutritionSubView 
            selectedDate={selectedDate}
            setSelectedDate={setSelectedDate}
            calMeals={calMeals}
            onModal={onModal}
            onDetail={onDetail}
          />
        )}
      </div>
    </div>
  );
}