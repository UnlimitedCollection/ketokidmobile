import { useListRecipes, useGetRecipe } from "@workspace/api-client-react";
import { useQueries } from "@tanstack/react-query";
import { getGetRecipeQueryOptions } from "@workspace/api-client-react";
import { useEffect } from "react";

type ReadyStatus = "loading" | "ready" | "error";
interface Props {
  onReady?: (status: ReadyStatus, error?: string) => void;
  filterIds?: number[];
}

export function RecipePrintReport({ onReady, filterIds }: Props) {
  const { data: allRecipes, isLoading: listLoading, isError: listError } = useListRecipes();

  const recipes = filterIds === undefined
    ? allRecipes
    : (allRecipes ?? []).filter((r) => filterIds.includes(r.id));
  const ids = recipes?.map((r) => r.id) ?? [];

  const detailQueries = useQueries({
    queries: ids.map((id) => ({
      ...getGetRecipeQueryOptions(id),
    })),
  });

  const allReady = !listLoading && !listError && ids.length > 0 && detailQueries.every((q) => q.isSuccess);
  const emptyReady = !listLoading && !listError && ids.length === 0;
  const anyError = listError || detailQueries.some((q) => q.isError);

  useEffect(() => {
    if (!listLoading && anyError) {
      onReady?.("error", "Failed to load recipe data. The report may be incomplete.");
    } else if (allReady || emptyReady) {
      onReady?.("ready");
    }
    // Do not call onReady while still loading
  }, [listLoading, allReady, emptyReady, anyError, onReady]);

  if (listLoading) {
    return <p className="text-xs text-slate-400 italic">Loading recipes…</p>;
  }

  if (!recipes || recipes.length === 0) {
    return <p className="text-slate-400 text-sm">No recipes found.</p>;
  }

  if (!allReady) {
    return <p className="text-xs text-slate-400 italic">Loading recipe details…</p>;
  }

  return (
    <div className="space-y-2">
      {detailQueries.map((q, i) => {
        const recipe = q.data;
        if (!recipe) return null;
        return (
          <div key={ids[i]} className="mb-6 break-inside-avoid">
            <div className="flex items-start justify-between mb-1">
              <div>
                <h3 className="text-base font-bold text-slate-900">{recipe.name}</h3>
                {recipe.category && (
                  <span className="text-xs text-slate-500 uppercase tracking-wide">{recipe.category}</span>
                )}
              </div>
              <div className="flex gap-4 text-xs text-slate-600 text-right shrink-0 ml-4">
                <span><strong>{Math.round(recipe.totalCalories)}</strong> kcal</span>
                <span><strong>{recipe.totalCarbs.toFixed(1)}</strong>g carbs</span>
                <span><strong>{recipe.totalFat.toFixed(1)}</strong>g fat</span>
                <span><strong>{recipe.totalProtein.toFixed(1)}</strong>g protein</span>
              </div>
            </div>
            {recipe.description && (
              <p className="text-xs text-slate-500 mb-2">{recipe.description}</p>
            )}
            {recipe.ingredients && recipe.ingredients.length > 0 && (
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100">
                    <th className="text-left py-1 px-2 font-semibold text-slate-600">Ingredient</th>
                    <th className="text-right py-1 px-2 font-semibold text-slate-600">Amount</th>
                    <th className="text-right py-1 px-2 font-semibold text-slate-600">Cal</th>
                    <th className="text-right py-1 px-2 font-semibold text-slate-600">Carbs</th>
                    <th className="text-right py-1 px-2 font-semibold text-slate-600">Fat</th>
                    <th className="text-right py-1 px-2 font-semibold text-slate-600">Protein</th>
                  </tr>
                </thead>
                <tbody>
                  {recipe.ingredients.map((ing) => (
                    <tr key={ing.id} className="border-b border-slate-100">
                      <td className="py-1 px-2 text-slate-800">{ing.foodName}</td>
                      <td className="py-1 px-2 text-right text-slate-600">{ing.portionGrams}g</td>
                      <td className="py-1 px-2 text-right text-slate-600">{Math.round(ing.calories)}</td>
                      <td className="py-1 px-2 text-right text-slate-600">{ing.carbs.toFixed(1)}g</td>
                      <td className="py-1 px-2 text-right text-slate-600">{ing.fat.toFixed(1)}g</td>
                      <td className="py-1 px-2 text-right text-slate-600">{ing.protein.toFixed(1)}g</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        );
      })}
    </div>
  );
}
