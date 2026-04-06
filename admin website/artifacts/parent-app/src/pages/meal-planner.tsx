import { useState, useEffect, useCallback, useRef } from "react";
import { useLocation, useParams } from "wouter";
import { api, type FoodItem } from "@/lib/api";
import { PageHeader } from "@/components/header";

const KPI_FILTERS = [
  { key: "carbs", label: "Carbs", icon: "grain", color: "secondary" },
  { key: "fat", label: "Fat", icon: "water_drop", color: "primary" },
  { key: "protein", label: "Protein", icon: "fitness_center", color: "tertiary" },
  { key: "calories", label: "Calories", icon: "local_fire_department", color: "on-surface" },
];

export default function MealPlannerPage() {
  const params = useParams<{ mealTypeId: string }>();
  const mealTypeId = Number(params.mealTypeId);
  const [, setLocation] = useLocation();

  const [activeKpi, setActiveKpi] = useState("carbs");
  const [foods, setFoods] = useState<FoodItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [mealName, setMealName] = useState("Meal Plan");

  const loadFoods = useCallback(async () => {
    try {
      setLoading(true);
      const f = await api.getFoods(activeKpi);
      setFoods(f);
    } catch {
    } finally {
      setLoading(false);
    }
  }, [activeKpi]);

  useEffect(() => { loadFoods(); }, [loadFoods]);

  useEffect(() => {
    api.getDashboard().then((d) => {
      const mt = d.todayMeals.find((m) => m.mealTypeId === mealTypeId);
      if (mt) {
        setMealName(`${mt.mealTypeName} Meal Plan`);
        if (mt.foods.length > 0) {
          setSelectedIds(new Set(mt.foods.map((f) => f.foodId)));
        }
      }
    }).catch(() => {});
  }, [mealTypeId]);

  const toggleSelect = (foodId: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(foodId)) next.delete(foodId);
      else next.add(foodId);
      return next;
    });
  };

  const handleLongPressStart = (foodId: number) => {
    longPressTimer.current = setTimeout(() => {
      toggleSelect(foodId);
    }, 500);
  };

  const handleLongPressEnd = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const handleTap = (foodId: number) => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    if (selectedIds.size > 0) {
      toggleSelect(foodId);
    } else {
      setExpandedId(expandedId === foodId ? null : foodId);
    }
  };

  const handleSave = async () => {
    if (selectedIds.size === 0) return;
    setSaving(true);
    try {
      const dashboard = await api.getDashboard();
      const existing = dashboard.todayMeals.find((m) => m.mealTypeId === mealTypeId);
      if (existing?.mealPlanId) {
        await api.updateMealPlan(existing.mealPlanId, Array.from(selectedIds));
      } else {
        await api.saveMealPlan(mealTypeId, Array.from(selectedIds));
      }
      setLocation("/");
    } catch {
    } finally {
      setSaving(false);
    }
  };

  const activeFilter = KPI_FILTERS.find((f) => f.key === activeKpi)!;
  const today = new Date();
  const dayName = today.toLocaleDateString("en-US", { weekday: "long" }).toUpperCase();
  const dateStr = today.toLocaleDateString("en-GB");

  return (
    <div className="min-h-screen bg-surface pb-32">
      <PageHeader
        title={mealName}
        subtitle="Manage your child's daily nutrition"
        onBack={() => setLocation("/")}
      />

      <main className="px-6 max-w-2xl mx-auto space-y-8 pt-24">
        <section className="relative overflow-hidden rounded-[2.5rem] bg-primary-container text-white shadow-2xl shadow-green-200/40 py-6 px-8">
          <div className="relative z-10 flex flex-col h-full">
            <div className="flex justify-between items-center">
              <div>
                <p className="font-bold text-[11px] opacity-90 uppercase tracking-[0.15em]">
                  OVERALL DAILY PROGRESS
                </p>
                <h2 className="text-[42px] font-extrabold tracking-tight leading-[1.1]">
                  {mealName.replace(" Meal Plan", "")}<br />Progress
                </h2>
                <p className="text-lg font-medium opacity-90 leading-tight max-w-[190px]">
                  {selectedIds.size > 0
                    ? `${selectedIds.size} food${selectedIds.size > 1 ? "s" : ""} selected`
                    : "Select foods below"}
                </p>
              </div>
              <div className="relative flex-shrink-0 flex items-center justify-center w-[120px] h-[120px] -mr-2">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="40" fill="transparent" stroke="rgba(255,255,255,0.2)" strokeWidth="10" />
                  <circle
                    cx="50" cy="50" r="40" fill="transparent" stroke="white" strokeWidth="10"
                    strokeLinecap="round"
                    strokeDasharray="251.32"
                    strokeDashoffset={`${251.32 * (1 - Math.min(selectedIds.size * 0.2, 1))}`}
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-2xl font-black">{Math.min(selectedIds.size * 20, 100)}%</span>
                  <span className="text-[9px] font-bold tracking-widest opacity-80 uppercase -mt-0.5">DONE</span>
                </div>
              </div>
            </div>
            <div className="flex flex-col items-end w-full mt-6">
              <span className="text-xl font-bold tracking-[0.1em] opacity-90 uppercase">{dayName}</span>
              <span className="font-black tracking-tight leading-none mt-1">{dateStr}</span>
            </div>
          </div>
          <div className="absolute -top-24 -right-24 w-64 h-64 bg-white/10 rounded-full blur-[80px]" />
        </section>

        <section className="grid grid-cols-2 gap-4">
          {KPI_FILTERS.map((kpi) => {
            const isActive = activeKpi === kpi.key;
            return (
              <button
                key={kpi.key}
                onClick={() => setActiveKpi(kpi.key)}
                className={`p-5 rounded-[20px] flex flex-col justify-between aspect-square transition-all duration-200 ${
                  isActive
                    ? "bg-secondary text-white shadow-[0_4px_20px_rgba(0,88,190,0.2)] ring-2 ring-secondary ring-offset-2"
                    : "bg-white shadow-[0_4px_20px_rgba(0,0,0,0.04)] opacity-60"
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    isActive ? "bg-white/20 text-white" : `bg-${kpi.color}/10 text-${kpi.color}`
                  }`}>
                    <span className="material-symbols-filled text-xl">{kpi.icon}</span>
                  </div>
                  <span className={`text-[10px] font-bold uppercase tracking-widest mt-1 ${
                    isActive ? "text-white" : `text-${kpi.color}`
                  }`}>
                    {kpi.label}
                  </span>
                </div>
                <div className="flex-1 flex items-center justify-center">
                  <span className={`font-bold text-4xl ${isActive ? "text-white" : "text-on-surface"}`}>
                    {selectedIds.size > 0
                      ? (() => {
                          const selected = foods.filter((f) => selectedIds.has(f.id));
                          const total = selected.reduce((sum, f) => sum + (f[kpi.key as keyof FoodItem] as number || 0), 0);
                          return kpi.key === "calories" ? Math.round(total) : `${Math.round(total * 10) / 10}g`;
                        })()
                      : "—"}
                  </span>
                </div>
              </button>
            );
          })}
        </section>

        <section className="space-y-6">
          <div className="flex items-center justify-between px-2">
            <h3 className="text-xl font-bold text-on-surface">Choose The Meal</h3>
            {selectedIds.size > 0 && (
              <span className="text-sm font-bold text-primary">
                {selectedIds.size} selected
              </span>
            )}
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-8 h-8 border-3 border-primary/20 border-t-primary rounded-full animate-spin" />
            </div>
          ) : foods.length === 0 ? (
            <div className="text-center py-16">
              <span className="material-symbols-outlined text-outline text-5xl mb-3">no_food</span>
              <p className="text-on-surface-variant font-medium">No foods available for {activeFilter.label}</p>
            </div>
          ) : (
            <div className="space-y-6">
              {foods.map((food) => (
                <FoodCard
                  key={food.id}
                  food={food}
                  isSelected={selectedIds.has(food.id)}
                  isExpanded={expandedId === food.id}
                  onTap={() => handleTap(food.id)}
                  onLongPressStart={() => handleLongPressStart(food.id)}
                  onLongPressEnd={handleLongPressEnd}
                  onSelect={() => toggleSelect(food.id)}
                />
              ))}
            </div>
          )}
        </section>
      </main>

      {selectedIds.size > 0 && (
        <div className="fixed bottom-0 left-0 w-full z-50 px-6 pb-8 pt-4 bg-gradient-to-t from-surface via-surface to-transparent">
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full bg-primary text-on-primary py-4 rounded-full font-bold text-lg shadow-lg shadow-green-900/20 active:scale-[0.98] transition-all disabled:opacity-50"
          >
            {saving ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Saving...
              </span>
            ) : (
              `Save Today Plan (${selectedIds.size} items)`
            )}
          </button>
        </div>
      )}
    </div>
  );
}

function FoodCard({ food, isSelected, isExpanded, onTap, onLongPressStart, onLongPressEnd, onSelect }: {
  food: FoodItem;
  isSelected: boolean;
  isExpanded: boolean;
  onTap: () => void;
  onLongPressStart: () => void;
  onLongPressEnd: () => void;
  onSelect: () => void;
}) {
  const imgSrc = food.imageUrl || `https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600&h=340&fit=crop`;

  return (
    <div
      className={`bg-white rounded-[2rem] overflow-hidden shadow-[0_8px_30px_rgba(0,0,0,0.04)] transition-all duration-300 select-none ${
        isSelected ? "ring-3 ring-primary ring-offset-2 shadow-[0_8px_30px_rgba(0,110,47,0.15)]" : ""
      }`}
      onClick={onTap}
      onTouchStart={onLongPressStart}
      onTouchEnd={onLongPressEnd}
      onTouchCancel={onLongPressEnd}
      onMouseDown={onLongPressStart}
      onMouseUp={onLongPressEnd}
      onMouseLeave={onLongPressEnd}
    >
      <div className="relative w-full aspect-[16/9] overflow-hidden">
        <img
          alt={food.name}
          className="w-full h-full object-cover"
          src={imgSrc}
          draggable={false}
        />
        <div className="absolute top-4 left-4">
          <span className="px-3 py-1 bg-white/90 backdrop-blur-md text-primary text-[10px] font-bold uppercase tracking-wider rounded-full border border-green-100">
            {food.category || food.indicator || "Food"}
          </span>
        </div>
        {isSelected && (
          <div className="absolute top-4 right-4 w-8 h-8 bg-primary rounded-full flex items-center justify-center shadow-lg">
            <span className="material-symbols-outlined text-white text-lg">check</span>
          </div>
        )}
      </div>
      <div className="p-6 flex items-center justify-between">
        <div>
          <h4 className="text-xl font-bold text-on-surface">{food.name}</h4>
          {isExpanded && food.description && (
            <p className="text-sm text-on-surface-variant mt-2 leading-relaxed">
              {food.description}
            </p>
          )}
        </div>
        <div className="bg-secondary rounded-full px-4 py-2 flex flex-col items-center justify-center text-white min-w-[80px]">
          <span className="text-[8px] font-bold opacity-80 uppercase leading-none">QTY</span>
          <span className="text-xs font-black leading-tight whitespace-nowrap">
            {food.quantity || `${food.servingSize ?? 1} ${(food.servingUnit ?? "serve").toUpperCase()}`}
          </span>
        </div>
      </div>
      {isExpanded && !isSelected && (
        <div className="px-6 pb-4">
          <button
            onClick={(e) => { e.stopPropagation(); onSelect(); }}
            className="w-full py-2.5 rounded-xl bg-primary/5 text-primary text-sm font-bold hover:bg-primary/10 transition-colors"
          >
            Select Food
          </button>
        </div>
      )}
    </div>
  );
}
