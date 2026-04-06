import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { api, type HistoryDay } from "@/lib/api";
import { AppHeader } from "@/components/header";
import { BottomNav } from "@/components/bottom-nav";

export default function HistoryPage() {
  const [, setLocation] = useLocation();
  const [history, setHistory] = useState<HistoryDay[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getHistory(14).then(setHistory).catch(() => {}).finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-surface pb-32">
      <AppHeader />
      <main className="max-w-2xl mx-auto px-6 py-8">
        <h2 className="text-[2rem] font-bold tracking-tight leading-none mb-1">Meal History</h2>
        <p className="text-on-surface-variant font-medium mb-8">Review past meal plans and nutrition</p>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-8 h-8 border-3 border-primary/20 border-t-primary rounded-full animate-spin" />
          </div>
        ) : history.length === 0 ? (
          <div className="text-center py-16">
            <span className="material-symbols-outlined text-outline text-5xl mb-3">event_busy</span>
            <p className="text-on-surface-variant font-medium">No meal history yet</p>
            <button
              onClick={() => setLocation("/")}
              className="mt-4 text-primary font-bold"
            >
              Start planning meals
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            {history.map((day) => (
              <HistoryDayCard key={day.date} day={day} />
            ))}
          </div>
        )}
      </main>
      <BottomNav />
    </div>
  );
}

function HistoryDayCard({ day }: { day: HistoryDay }) {
  const date = new Date(day.date);
  const isToday = new Date().toDateString() === date.toDateString();
  const dayLabel = isToday ? "Today" : date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  });

  return (
    <div className="bg-surface-container-lowest rounded-lg p-5 border border-outline-variant/10">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold text-lg text-on-surface">{dayLabel}</h3>
        {isToday && (
          <span className="bg-primary/10 text-primary px-3 py-1 rounded-full text-xs font-bold">
            Today
          </span>
        )}
      </div>

      <div className="grid grid-cols-4 gap-2 mb-4">
        <MiniKpi label="Carbs" current={day.dailyProgress.carbsConsumed} target={day.dailyProgress.carbsTarget} unit="g" />
        <MiniKpi label="Fat" current={day.dailyProgress.fatConsumed} target={day.dailyProgress.fatTarget} unit="g" />
        <MiniKpi label="Protein" current={day.dailyProgress.proteinConsumed} target={day.dailyProgress.proteinTarget} unit="g" />
        <MiniKpi label="Cal" current={day.dailyProgress.caloriesConsumed} target={day.dailyProgress.caloriesTarget} unit="" />
      </div>

      <div className="space-y-2">
        {day.meals.map((meal) => (
          <div key={meal.mealTypeId} className="flex items-center justify-between py-2">
            <div className="flex items-center gap-3">
              <span className={`w-2 h-2 rounded-full ${
                meal.status === "consumed" ? "bg-primary" :
                meal.status === "planned" ? "bg-secondary" :
                meal.status === "not_involved" ? "bg-surface-container-high" :
                "bg-outline-variant"
              }`} />
              <span className="text-sm font-medium text-on-surface">{meal.mealTypeName}</span>
            </div>
            <span className={`text-xs font-bold capitalize ${
              meal.status === "consumed" ? "text-primary" :
              meal.status === "planned" ? "text-secondary" :
              meal.status === "not_involved" ? "text-on-surface-variant" :
              "text-outline"
            }`}>
              {meal.status === "not_involved" ? "Skipped" :
               meal.status === "consumed" ? `Eaten ${meal.portionPercent ?? 0}%` :
               meal.status === "planned" ? "Planned" : "Empty"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function MiniKpi({ label, current, target, unit }: { label: string; current: number; target: number; unit: string }) {
  return (
    <div className="text-center">
      <p className="text-[10px] font-bold text-on-surface-variant uppercase">{label}</p>
      <p className="text-sm font-bold text-on-surface">{current}<span className="text-on-surface-variant font-normal">/{target}{unit}</span></p>
    </div>
  );
}
