import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { api, type DashboardData, type TodayMeal } from "@/lib/api";
import { AppHeader } from "@/components/header";
import { BottomNav } from "@/components/bottom-nav";

const MEAL_ICONS: Record<string, string> = {
  breakfast: "light_mode",
  lunch: "sunny",
  dinner: "dark_mode",
  snack: "cookie",
};

const MEAL_COLORS: Record<string, string> = {
  breakfast: "text-primary",
  lunch: "text-secondary",
  dinner: "text-tertiary",
  snack: "text-primary-fixed-dim",
};

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good Morning";
  if (h < 17) return "Good Afternoon";
  return "Good Evening";
}

export default function DashboardPage() {
  const { child } = useAuth();
  const [, setLocation] = useLocation();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadDashboard = useCallback(async () => {
    try {
      setLoading(true);
      const d = await api.getDashboard();
      setData(d);
    } catch (err: any) {
      setError(err.message || "Failed to load dashboard");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadDashboard(); }, [loadDashboard]);

  if (loading) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-3 border-primary/20 border-t-primary rounded-full animate-spin" />
          <p className="text-sm font-medium text-on-surface-variant">Loading...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center px-8">
        <div className="text-center">
          <span className="material-symbols-outlined text-error text-5xl mb-4">error</span>
          <p className="text-lg font-bold text-on-surface mb-2">Something went wrong</p>
          <p className="text-sm text-on-surface-variant mb-6">{error}</p>
          <button onClick={loadDashboard} className="bg-primary text-on-primary px-6 py-3 rounded-full font-bold">
            Try Again
          </button>
        </div>
      </div>
    );
  }

  const { dailyProgress, todayMeals } = data;

  return (
    <div className="min-h-screen bg-surface pb-32">
      <AppHeader />
      <main className="max-w-2xl mx-auto px-6 py-8">
        <section className="mb-10">
          <h2 className="text-[2rem] font-bold tracking-tight leading-none mb-1">
            {getGreeting()}, {child?.parentName?.split(" ")[0] || "Parent"}
          </h2>
          <p className="text-on-surface-variant font-medium">Today's Nutrition Overview</p>
        </section>

        <section className="mb-8">
          <div className="bg-gradient-to-br from-primary to-primary-container p-8 rounded-lg shadow-lg text-on-primary flex items-center justify-between relative overflow-hidden">
            <div className="z-10">
              <p className="text-xs uppercase tracking-widest opacity-90 mb-2 font-bold">
                Overall Daily Progress
              </p>
              <p className="text-[2.5rem] font-bold leading-tight">
                {dailyProgress.overallPercent >= 70 ? "Great job!" : "Keep going!"}
                <br />
                <span className="opacity-80 font-medium text-2xl">
                  {dailyProgress.overallPercent >= 70 ? "On track today" : "Almost there"}
                </span>
              </p>
            </div>
            <div className="relative z-10 flex flex-col items-center">
              <div className="relative w-32 h-32 flex items-center justify-center">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 128 128">
                  <circle cx="64" cy="64" r="56" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="12" />
                  <circle
                    cx="64" cy="64" r="56" fill="none" stroke="currentColor" strokeWidth="12"
                    strokeLinecap="round" className="text-white"
                    strokeDasharray={`${2 * Math.PI * 56}`}
                    strokeDashoffset={`${2 * Math.PI * 56 * (1 - dailyProgress.overallPercent / 100)}`}
                  />
                </svg>
                <span className="absolute text-2xl font-bold">{dailyProgress.overallPercent}%</span>
              </div>
              <span className="text-xs mt-2 uppercase tracking-tighter font-semibold">Done</span>
            </div>
            <div className="absolute -bottom-10 -right-10 w-48 h-48 bg-white/10 rounded-full blur-3xl" />
          </div>
        </section>

        <section className="grid grid-cols-2 gap-4 mb-10">
          <KpiCard
            icon="grain" label="Carbs" color="secondary"
            current={dailyProgress.carbsConsumed} target={dailyProgress.carbsTarget} unit="g"
          />
          <KpiCard
            icon="water_drop" label="Fat" color="primary"
            current={dailyProgress.fatConsumed} target={dailyProgress.fatTarget} unit="g"
          />
          <KpiCard
            icon="fitness_center" label="Protein" color="tertiary"
            current={dailyProgress.proteinConsumed} target={dailyProgress.proteinTarget} unit="g"
          />
          <KpiCard
            icon="local_fire_department" label="Calories" color="on-surface"
            current={dailyProgress.caloriesConsumed} target={dailyProgress.caloriesTarget} unit=" kcal"
          />
        </section>

        <section className="mb-10">
          <h3 className="text-xl font-bold mb-6">Today's Meal Tasks</h3>
          <div className="space-y-4">
            {todayMeals.map((meal) => (
              <MealCard
                key={meal.mealTypeId}
                meal={meal}
                allMeals={todayMeals}
                onRefresh={loadDashboard}
                onPlan={() => setLocation(`/plan/${meal.mealTypeId}`)}
              />
            ))}
          </div>
        </section>

        <div className="flex flex-col gap-4 mb-16">
          <button
            onClick={() => setLocation("/history")}
            className="bg-transparent text-primary py-4 rounded-full font-bold text-lg hover:bg-primary/5 active:scale-95 transition-all"
          >
            View History
          </button>
        </div>
      </main>
      <BottomNav />
    </div>
  );
}

function KpiCard({ icon, label, color, current, target, unit }: {
  icon: string; label: string; color: string;
  current: number; target: number; unit: string;
}) {
  const pct = target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0;
  return (
    <div className="bg-surface-container-lowest p-5 rounded-lg border border-outline-variant/10">
      <div className="flex justify-between items-start mb-4">
        <div className={`w-10 h-10 rounded-full bg-${color}/10 flex items-center justify-center text-${color}`}>
          <span className="material-symbols-outlined">{icon}</span>
        </div>
        <span className={`text-xs font-bold text-${color} uppercase`}>{label}</span>
      </div>
      <p className="text-2xl font-bold">
        {current}<span className="text-sm font-medium text-on-surface-variant">/{target}{unit}</span>
      </p>
      <div className="w-full bg-surface-container-high h-1.5 rounded-full mt-3 overflow-hidden">
        <div className={`bg-${color} h-full rounded-full transition-all duration-500`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function MealCard({ meal, allMeals, onRefresh, onPlan }: {
  meal: TodayMeal;
  allMeals: TodayMeal[];
  onRefresh: () => void;
  onPlan: () => void;
}) {
  const [eatExpanded, setEatExpanded] = useState(meal.ateStatus === "yes");
  const [copyOpen, setCopyOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmNoOpen, setConfirmNoOpen] = useState(false);

  const mealKey = meal.mealTypeName.toLowerCase();
  const icon = MEAL_ICONS[mealKey] || "restaurant";
  const colorClass = MEAL_COLORS[mealKey] || "text-primary";

  const handleEat = async (ate: "yes" | "no") => {
    if (!meal.mealPlanId) return;
    setSaving(true);
    try {
      if (ate === "yes") {
        setEatExpanded(true);
      } else {
        await api.updateEatStatus(meal.mealPlanId, "no");
        setEatExpanded(false);
        onRefresh();
      }
    } catch {}
    setSaving(false);
  };

  const handlePortion = async (pct: number) => {
    if (!meal.mealPlanId) return;
    setSaving(true);
    try {
      await api.updateEatStatus(meal.mealPlanId, "yes", pct);
      onRefresh();
    } catch {}
    setSaving(false);
  };

  const handleCopy = async (targetMealTypeId: number) => {
    setSaving(true);
    try {
      await api.copyMeal(meal.mealTypeId, targetMealTypeId);
      setCopyOpen(false);
      onRefresh();
    } catch {}
    setSaving(false);
  };

  if (meal.status === "empty") {
    return (
      <button
        onClick={onPlan}
        className="w-full text-left p-5 rounded-lg flex items-center justify-between transition-all hover:bg-surface-container active:scale-[0.98] group bg-surface-container"
      >
        <div className="flex items-center gap-4">
          <div className={`w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-sm ${colorClass}`}>
            <span className="material-symbols-outlined">{icon}</span>
          </div>
          <div>
            <h4 className="font-bold text-lg leading-none">{meal.mealTypeName}</h4>
            <p className="text-xs text-on-surface-variant mt-1">Tap to plan this meal</p>
          </div>
        </div>
        <span className="material-symbols-outlined text-outline-variant group-hover:text-primary transition-colors">
          chevron_right
        </span>
      </button>
    );
  }

  return (
    <div className="p-5 rounded-lg transition-all bg-surface-container">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-4">
          <div className={`w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-sm ${colorClass}`}>
            <span className="material-symbols-outlined">{icon}</span>
          </div>
          <div>
            <h4 className="font-bold text-lg leading-none">{meal.mealTypeName}</h4>
            <p className="text-xs text-on-surface-variant mt-1">
              {meal.status === "not_involved"
                ? "Not eaten today"
                : meal.status === "consumed"
                ? `Consumed ${meal.portionPercent ?? 0}%`
                : "Did the child eat?"}
            </p>
          </div>
        </div>
        {meal.status === "planned" && (
          <div className="flex bg-surface-container-high p-1 rounded-full w-28 h-10">
            <button
              onClick={() => handleEat("yes")}
              className={`flex-1 text-sm font-bold rounded-full transition-all ${
                eatExpanded ? "bg-white text-primary shadow-sm" : "text-on-surface-variant"
              }`}
            >
              Yes
            </button>
            <button
              onClick={() => setConfirmNoOpen(true)}
              className={`flex-1 text-sm font-bold rounded-full transition-all ${
                meal.ateStatus === "no" ? "bg-white text-error shadow-sm" : "text-on-surface-variant"
              }`}
            >
              No
            </button>
          </div>
        )}
        {meal.status === "consumed" && (
          <div className="bg-primary/10 text-primary px-3 py-1 rounded-full text-xs font-bold">
            ✓ Eaten
          </div>
        )}
        {meal.status === "not_involved" && (
          <div className="bg-surface-container-high text-on-surface-variant px-3 py-1 rounded-full text-xs font-bold">
            Skipped
          </div>
        )}
      </div>

      {eatExpanded && meal.status === "planned" && (
        <div className="border-t border-outline-variant/20 pt-4 mt-4">
          <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider mb-3">
            Portion Consumed
          </p>
          <div className="flex justify-between">
            {[0, 25, 50, 75, 100].map((pct) => (
              <button
                key={pct}
                onClick={() => handlePortion(pct)}
                disabled={saving}
                className={`w-12 h-12 rounded-full text-xs font-bold transition-all flex items-center justify-center ${
                  meal.portionPercent === pct
                    ? "bg-primary text-white shadow-md shadow-primary/20"
                    : "bg-white border border-gray-300 text-on-surface"
                }`}
              >
                {pct}%
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="mt-4 flex justify-end border-t border-outline-variant/10 pt-3 gap-2">
        <button
          onClick={onPlan}
          className="flex items-center gap-1.5 text-primary text-xs font-bold hover:bg-primary/5 px-3 py-1.5 rounded-full transition-colors"
        >
          <span className="material-symbols-outlined text-sm">edit</span>
          Edit
        </button>
        <div className="relative">
          <button
            onClick={() => setCopyOpen(!copyOpen)}
            className="flex items-center gap-1.5 text-primary text-xs font-bold hover:bg-primary/5 px-3 py-1.5 rounded-full transition-colors"
          >
            <span className="material-symbols-outlined text-sm">content_copy</span>
            Copy
          </button>
          {copyOpen && (
            <div className="absolute right-0 bottom-full mb-2 bg-white rounded-2xl shadow-xl border border-outline-variant/20 p-2 min-w-[160px] z-20">
              {allMeals
                .filter((m) => m.mealTypeId !== meal.mealTypeId)
                .map((m) => (
                  <button
                    key={m.mealTypeId}
                    onClick={() => handleCopy(m.mealTypeId)}
                    disabled={saving}
                    className="w-full text-left px-4 py-2.5 rounded-xl text-sm font-medium text-on-surface hover:bg-surface-container transition-colors"
                  >
                    Copy to {m.mealTypeName}
                  </button>
                ))}
            </div>
          )}
        </div>
      </div>

      {confirmNoOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setConfirmNoOpen(false)}>
          <div className="bg-surface rounded-3xl shadow-2xl p-6 w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-error/10 rounded-full flex items-center justify-center">
                <span className="material-symbols-outlined text-error">warning</span>
              </div>
              <h3 className="text-lg font-bold text-on-surface">Mark as Not Eaten?</h3>
            </div>
            <p className="text-sm text-on-surface-variant mb-6">
              This action cannot be reversed. The meal will be permanently marked as not eaten.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmNoOpen(false)}
                className="flex-1 py-3 rounded-full text-sm font-bold border border-outline-variant/30 text-on-surface hover:bg-surface-container transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setConfirmNoOpen(false);
                  handleEat("no");
                }}
                disabled={saving}
                className="flex-1 py-3 rounded-full text-sm font-bold bg-error text-white hover:bg-error/90 transition-colors shadow-md shadow-error/20"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
