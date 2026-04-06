import { useGetLibraryMealPlans, getGetLibraryMealPlanQueryOptions } from "@workspace/api-client-react";
import type { LibraryMealPlanItem } from "@workspace/api-client-react";
import { useQueries } from "@tanstack/react-query";
import { useEffect } from "react";

type ReadyStatus = "loading" | "ready" | "error";
interface Props {
  onReady?: (status: ReadyStatus, error?: string) => void;
  filterIds?: number[];
}

export function MealPlanPrintReport({ onReady, filterIds }: Props) {
  const { data: allPlans, isLoading: listLoading, isError: listError } = useGetLibraryMealPlans();

  const plans = filterIds === undefined
    ? allPlans
    : (allPlans ?? []).filter((p) => filterIds.includes(p.id));
  const ids = plans?.map((p) => p.id) ?? [];

  const detailQueries = useQueries({
    queries: ids.map((id) => ({
      ...getGetLibraryMealPlanQueryOptions(id),
    })),
  });

  const allReady = !listLoading && !listError && ids.length > 0 && detailQueries.every((q) => q.isSuccess);
  const emptyReady = !listLoading && !listError && ids.length === 0;
  const anyError = listError || detailQueries.some((q) => q.isError);

  useEffect(() => {
    if (!listLoading && anyError) {
      onReady?.("error", "Failed to load meal plan data. The report may be incomplete.");
    } else if (allReady || emptyReady) {
      onReady?.("ready");
    }
    // Do not call onReady while still loading
  }, [listLoading, allReady, emptyReady, anyError, onReady]);

  if (listLoading) {
    return <p className="text-xs text-slate-400 italic">Loading meal plans…</p>;
  }

  if (!plans || plans.length === 0) {
    return <p className="text-slate-400 text-sm">No meal plans found.</p>;
  }

  if (!allReady) {
    return <p className="text-xs text-slate-400 italic">Loading plan details…</p>;
  }

  return (
    <div>
      {detailQueries.map((q, i) => {
        const plan = plans[i];
        const detail = q.data;
        const items: LibraryMealPlanItem[] = detail?.items ?? [];
        const totalCalories = items.reduce((s, item) => s + (item.calories ?? 0), 0);
        const totalCarbs = items.reduce((s, item) => s + (item.carbs ?? 0), 0);
        const totalFat = items.reduce((s, item) => s + (item.fat ?? 0), 0);
        const totalProtein = items.reduce((s, item) => s + (item.protein ?? 0), 0);

        const mealGroups = items.reduce<Record<string, LibraryMealPlanItem[]>>((acc, item) => {
          const key = item.mealType;
          if (!acc[key]) acc[key] = [];
          acc[key].push(item);
          return acc;
        }, {});

        return (
          <div key={ids[i]} className="mb-8 break-inside-avoid">
            <div className="flex items-start justify-between mb-1 border-b border-slate-200 pb-2">
              <div>
                <h3 className="text-base font-bold text-slate-900">{plan.name}</h3>
                {plan.description && (
                  <p className="text-xs text-slate-500 mt-0.5">{plan.description}</p>
                )}
              </div>
              {items.length > 0 && (
                <div className="flex gap-4 text-xs text-slate-600 text-right shrink-0 ml-4">
                  <span><strong>{Math.round(totalCalories)}</strong> kcal</span>
                  <span><strong>{totalCarbs.toFixed(1)}</strong>g carbs</span>
                  <span><strong>{totalFat.toFixed(1)}</strong>g fat</span>
                  <span><strong>{totalProtein.toFixed(1)}</strong>g protein</span>
                </div>
              )}
            </div>

            {items.length === 0 ? (
              <p className="text-xs text-slate-400 italic">No items in this plan.</p>
            ) : (
              <div className="space-y-3">
                {Object.entries(mealGroups).map(([mealType, mealItems]) => (
                  <div key={mealType}>
                    <p className="text-xs font-semibold text-slate-700 uppercase tracking-wide mb-1">{mealType}</p>
                    <table className="w-full text-xs border-collapse">
                      <thead>
                        <tr className="bg-slate-50">
                          <th className="text-left py-1 px-2 font-semibold text-slate-500">Food</th>
                          <th className="text-right py-1 px-2 font-semibold text-slate-500">Amount</th>
                          <th className="text-right py-1 px-2 font-semibold text-slate-500">Cal</th>
                          <th className="text-right py-1 px-2 font-semibold text-slate-500">Carbs</th>
                          <th className="text-right py-1 px-2 font-semibold text-slate-500">Fat</th>
                          <th className="text-right py-1 px-2 font-semibold text-slate-500">Protein</th>
                        </tr>
                      </thead>
                      <tbody>
                        {mealItems.map((item) => (
                          <tr key={item.id} className="border-b border-slate-100">
                            <td className="py-1 px-2 text-slate-800">{item.foodName}</td>
                            <td className="py-1 px-2 text-right text-slate-600">{item.portionGrams}g</td>
                            <td className="py-1 px-2 text-right text-slate-600">{item.calories != null ? Math.round(item.calories) : "—"}</td>
                            <td className="py-1 px-2 text-right text-slate-600">{item.carbs != null ? item.carbs.toFixed(1) + "g" : "—"}</td>
                            <td className="py-1 px-2 text-right text-slate-600">{item.fat != null ? item.fat.toFixed(1) + "g" : "—"}</td>
                            <td className="py-1 px-2 text-right text-slate-600">{item.protein != null ? item.protein.toFixed(1) + "g" : "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
