import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { PrintButton } from "@/components/print-button";
import { RecipePrintReport } from "@/components/recipe-print-report";
import { usePrint } from "@/hooks/usePrint";
import { usePagination } from "@/hooks/usePagination";
import { PrintLayout } from "@/components/print-layout";
import { PrintFilterDialog, type PrintFilterResult } from "@/components/print-filter-dialog";
import {
  useListRecipes,
  useCreateRecipe,
  useUpdateRecipe,
  useDeleteRecipe,
  useGetRecipe,
  useGetFoods,
  getListRecipesQueryKey,
} from "@workspace/api-client-react";
import type { RecipeDetail, Food } from "@workspace/api-client-react";
import {
  Loader2,
  ChefHat,
  Plus,
  Pencil,
  Trash2,
  ChevronLeft,
  ChevronRight,
  X,
  Flame,
  Droplets,
  Beef,
  Wheat,
  Info,
  Eye,
  ImagePlus,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useCanWrite } from "@/hooks/useRole";
import { useUpload } from "@workspace/object-storage-web";

const BLUE  = "#004ac6";
const GREEN = "#0a7c42";
const RED   = "#ae0010";
const AMBER = "#855300";


interface IngredientRow {
  foodName: string;
  portionGrams: number | "";
  matchedFood: Food | null;
}

const emptyRow = (): IngredientRow => ({
  foodName: "",
  portionGrams: "",
  matchedFood: null,
});

function computeMacroPreview(food: Food | null, portionGrams: number | "") {
  if (!food || !portionGrams) return null;
  const ratio = Number(portionGrams) / 100;
  return {
    fat:      Math.round(food.fat      * ratio * 100) / 100,
    protein:  Math.round(food.protein  * ratio * 100) / 100,
    carbs:    Math.round(food.carbs    * ratio * 100) / 100,
    calories: Math.round(food.calories * ratio * 100) / 100,
  };
}

function FoodAutocomplete({
  value,
  onSelect,
  allFoods,
}: {
  value: string;
  onSelect: (foodName: string, food: Food | null) => void;
  allFoods: Food[];
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(value);
  const containerRef = useRef<HTMLDivElement>(null);

  const suggestions = query.length >= 1
    ? allFoods.filter((f) =>
        f.name.toLowerCase().includes(query.toLowerCase()) && f.isActive
      ).slice(0, 8)
    : [];

  useEffect(() => { setQuery(value); }, [value]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    setQuery(v);
    setOpen(true);
    const exact = allFoods.find((f) => f.name.toLowerCase() === v.toLowerCase());
    onSelect(v, exact ?? null);
  };

  const handlePick = (food: Food) => {
    setQuery(food.name);
    setOpen(false);
    onSelect(food.name, food);
  };

  return (
    <div ref={containerRef} className="relative w-full">
      <input
        value={query}
        onChange={handleChange}
        onFocus={() => setOpen(true)}
        placeholder="Type food name…"
        className="w-full border-0 bg-transparent outline-none text-slate-800 placeholder:text-slate-300 text-xs"
      />
      {open && suggestions.length > 0 && (
        <div className="absolute left-0 top-full mt-1 z-50 bg-white border border-slate-200 rounded-lg shadow-xl w-52 max-h-40 overflow-y-auto">
          {suggestions.map((food) => (
            <button
              key={food.id}
              type="button"
              onClick={() => handlePick(food)}
              className="w-full text-left px-3 py-2 text-xs hover:bg-blue-50 text-slate-700 border-b border-slate-50 last:border-0 flex items-center justify-between"
            >
              <span className="font-medium">{food.name}</span>
              <span className="text-slate-400 text-[10px]">{food.category}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function NutriBadge({
  label,
  value,
  unit = "g",
  color,
  icon,
}: {
  label: string;
  value: number;
  unit?: string;
  color: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center px-3 py-2 rounded-xl" style={{ background: `${color}12` }}>
      <div style={{ color }} className="mb-0.5">{icon}</div>
      <span className="text-xs font-bold" style={{ color }}>{value.toFixed(1)}{unit}</span>
      <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wide">{label}</span>
    </div>
  );
}

function RecipeForm({
  initial,
  onClose,
  onSaved,
  recipeId,
}: {
  initial?: RecipeDetail | null;
  onClose: () => void;
  onSaved: () => void;
  recipeId?: number;
}) {
  const createRecipe = useCreateRecipe();
  const updateRecipe = useUpdateRecipe();
  const { data: allFoods = [] } = useGetFoods();

  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [imageUrl, setImageUrl] = useState(initial?.imageUrl ?? "");
  const [imagePreview, setImagePreview] = useState<string | null>(
    initial?.imageUrl ? `/api/storage${initial.imageUrl}` : null
  );
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { uploadFile, isUploading } = useUpload({
    onSuccess: (response) => {
      setImageUrl(response.objectPath);
      setImagePreview(`/api/storage${response.objectPath}`);
    },
  });
  const [ingredients, setIngredients] = useState<IngredientRow[]>(
    initial?.ingredients?.length
      ? initial.ingredients.map((i) => ({
          foodName: i.foodName,
          portionGrams: i.portionGrams,
          matchedFood: null,
        }))
      : [emptyRow()]
  );
  const [error, setError] = useState("");
  const [initialLoaded, setInitialLoaded] = useState(!!initial);

  useEffect(() => {
    if (initial && !initialLoaded) {
      setName(initial.name ?? "");
      setDescription(initial.description ?? "");
      setImageUrl(initial.imageUrl ?? "");
      setImagePreview(initial.imageUrl ? `/api/storage${initial.imageUrl}` : null);
      setIngredients(
        initial.ingredients?.length
          ? initial.ingredients.map((i) => ({
              foodName: i.foodName,
              portionGrams: i.portionGrams,
              matchedFood: null,
            }))
          : [emptyRow()]
      );
      setInitialLoaded(true);
    }
  }, [initial, initialLoaded]);

  const updateIngFood = (idx: number, foodName: string, food: Food | null) => {
    setIngredients((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], foodName, matchedFood: food };
      return next;
    });
  };

  const updateIngPortion = (idx: number, value: string) => {
    setIngredients((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], portionGrams: value === "" ? "" : Number(value) };
      return next;
    });
  };

  const addRow = () => setIngredients((prev) => [...prev, emptyRow()]);
  const removeRow = (idx: number) => setIngredients((prev) => prev.filter((_, i) => i !== idx));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { setError("Recipe name is required."); return; }
    const validIngs = ingredients.filter((i) => i.foodName.trim());
    const ingPayload = validIngs.map((i) => ({
      foodName: i.foodName.trim(),
      portionGrams: Number(i.portionGrams) || 100,
    }));

    const payload = {
      name: name.trim(),
      description: description.trim() || undefined,
      imageUrl: imageUrl,
      ingredients: ingPayload,
    };

    if (recipeId) {
      updateRecipe.mutate(
        { recipeId, data: payload },
        { onSuccess: onSaved, onError: (err: unknown) => setError((err as { data?: { message?: string } })?.data?.message ?? "Save failed") }
      );
    } else {
      createRecipe.mutate(
        { data: payload },
        { onSuccess: onSaved, onError: (err: unknown) => setError((err as { data?: { message?: string } })?.data?.message ?? "Save failed") }
      );
    }
  };

  const isPending = createRecipe.isPending || updateRecipe.isPending;

  const liveTotal = ingredients.reduce((acc, row) => {
    const m = computeMacroPreview(row.matchedFood, row.portionGrams);
    if (!m) return acc;
    return {
      fat: acc.fat + m.fat,
      protein: acc.protein + m.protein,
      carbs: acc.carbs + m.carbs,
      calories: acc.calories + m.calories,
    };
  }, { fat: 0, protein: 0, carbs: 0, calories: 0 });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-2 py-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="text-lg font-bold text-slate-900">{recipeId ? "Edit Recipe" : "New Recipe"}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-6 py-4">
          <form id="recipe-form" onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">Recipe Name*</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Keto Egg Muffins"
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-300"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={1000}
                rows={4}
                placeholder="Brief description or preparation notes…"
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 resize-none focus:outline-none focus:ring-2 focus:ring-blue-300"
              />
              <p className="text-xs text-slate-400 text-right mt-1">{description.length} / 1000</p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">Recipe Image (optional)</label>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) uploadFile(file);
                  e.target.value = "";
                }}
              />
              {imagePreview ? (
                <div className="flex items-center gap-3 rounded-xl border border-slate-200 p-3">
                  <img
                    src={imagePreview}
                    alt="Recipe preview"
                    className="h-16 w-16 rounded-lg object-cover border border-slate-200"
                  />
                  <div className="flex flex-col gap-1.5">
                    <button
                      type="button"
                      disabled={isUploading}
                      onClick={() => fileInputRef.current?.click()}
                      className="flex items-center gap-1 text-xs font-semibold text-blue-600 hover:underline disabled:opacity-50"
                    >
                      {isUploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ImagePlus className="h-3.5 w-3.5" />}
                      Change
                    </button>
                    <button
                      type="button"
                      className="flex items-center gap-1 text-xs font-semibold text-slate-400 hover:text-red-500"
                      onClick={() => {
                        setImageUrl("");
                        setImagePreview(null);
                      }}
                    >
                      <X className="h-3.5 w-3.5" />
                      Remove
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  disabled={isUploading}
                  onClick={() => fileInputRef.current?.click()}
                  className="flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-200 p-6 text-slate-400 transition-colors hover:border-blue-300 hover:text-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isUploading ? (
                    <Loader2 className="h-6 w-6 animate-spin" />
                  ) : (
                    <ImagePlus className="h-6 w-6" />
                  )}
                  <span className="text-sm">{isUploading ? "Uploading..." : "Click to upload image"}</span>
                </button>
              )}
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Ingredients</label>
                  <span
                    className="flex items-center gap-1 text-[10px] font-medium text-slate-400"
                    title="Macros are calculated automatically from the food database (per-100g values)"
                  >
                    <Info className="h-3 w-3" />
                    Macros auto-calculated
                  </span>
                </div>
                <button
                  type="button"
                  onClick={addRow}
                  className="text-xs text-blue-600 font-semibold hover:underline flex items-center gap-1"
                >
                  <Plus className="h-3.5 w-3.5" /> Add row
                </button>
              </div>

              <div className="rounded-xl border border-slate-200 overflow-visible">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-3 py-2 text-left font-semibold text-slate-500 uppercase tracking-wide">Food Name</th>
                      <th className="px-2 py-2 text-left font-semibold text-slate-500 uppercase tracking-wide w-16">grams</th>
                      <th className="px-2 py-2 text-left font-semibold text-slate-500 uppercase tracking-wide w-20">Fat</th>
                      <th className="px-2 py-2 text-left font-semibold text-slate-500 uppercase tracking-wide w-20">Prot</th>
                      <th className="px-2 py-2 text-left font-semibold text-slate-500 uppercase tracking-wide w-20">Carb</th>
                      <th className="px-2 py-2 text-left font-semibold text-slate-500 uppercase tracking-wide w-20">Kcal</th>
                      <th className="px-2 py-2 w-8"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {ingredients.map((row, idx) => {
                      const preview = computeMacroPreview(row.matchedFood, row.portionGrams);
                      const hasMatch = row.matchedFood !== null;
                      const hasText = row.foodName.trim().length > 0;
                      return (
                        <tr key={idx} className="border-t border-slate-100">
                          <td className="px-3 py-1.5 relative">
                            <FoodAutocomplete
                              value={row.foodName}
                              onSelect={(name, food) => updateIngFood(idx, name, food)}
                              allFoods={allFoods}
                            />
                            {hasText && !hasMatch && (
                              <span className="text-[9px] text-amber-500 block mt-0.5">Not in food DB — macros = 0</span>
                            )}
                          </td>
                          <td className="px-2 py-1.5 w-16">
                            <input
                              type="number"
                              value={row.portionGrams}
                              onChange={(e) => updateIngPortion(idx, e.target.value)}
                              placeholder="100"
                              className="w-full border-0 bg-transparent outline-none text-slate-800 text-xs"
                            />
                          </td>
                          {(["fat", "protein", "carbs", "calories"] as const).map((field) => (
                            <td key={field} className="px-2 py-1.5 w-20 text-slate-400 text-xs">
                              {preview ? (
                                <span className={hasMatch ? "text-slate-700 font-medium" : "text-slate-300"}>
                                  {preview[field].toFixed(1)}
                                </span>
                              ) : (
                                <span className="text-slate-200">—</span>
                              )}
                            </td>
                          ))}
                          <td className="px-2 py-1.5 w-8">
                            <button type="button" onClick={() => removeRow(idx)} className="text-slate-300 hover:text-red-400">
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {ingredients.some((r) => r.matchedFood) && (
                <div className="mt-2 flex gap-4 px-3 text-xs text-slate-500 font-semibold">
                  <span>Preview totals:</span>
                  <span style={{ color: GREEN }}>Fat {liveTotal.fat.toFixed(1)}g</span>
                  <span style={{ color: BLUE }}>Prot {liveTotal.protein.toFixed(1)}g</span>
                  <span style={{ color: RED }}>Carb {liveTotal.carbs.toFixed(1)}g</span>
                  <span style={{ color: AMBER }}>Kcal {liveTotal.calories.toFixed(0)}</span>
                  <span className="text-slate-300 font-normal text-[10px] self-end">Final values computed on save</span>
                </div>
              )}
            </div>

            {error && <p className="text-sm text-red-600 font-medium">{error}</p>}
          </form>
        </div>

        <div className="px-6 py-4 border-t border-slate-100 flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="recipe-form"
            disabled={isPending}
            className="flex-1 px-4 py-2.5 bg-[#004ac6] text-white rounded-xl text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ChefHat className="h-4 w-4" />}
            {recipeId ? "Save Changes" : "Create Recipe"}
          </button>
        </div>
      </div>
    </div>
  );
}

function RecipeDetailPanel({
  recipeId,
  onClose,
  onEdit,
  canWrite,
}: {
  recipeId: number;
  onClose: () => void;
  onEdit: () => void;
  canWrite: boolean;
}) {
  const { data: recipe, isLoading } = useGetRecipe(recipeId);

  if (isLoading || !recipe) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
        <Loader2 className="h-8 w-8 animate-spin text-white" />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 px-2 py-4 sm:px-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div>
            <h2 className="text-base font-bold text-slate-900">{recipe.name}</h2>
          </div>
          <div className="flex items-center gap-2">
            {canWrite && (
              <button
                onClick={onEdit}
                className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg"
              >
                <Pencil className="h-4 w-4" />
              </button>
            )}
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="overflow-y-auto flex-1 px-6 py-4 space-y-4">
          {recipe.imageUrl && (
            <img
              src={`/api/storage${recipe.imageUrl}`}
              alt={recipe.name}
              className="w-full h-48 object-cover rounded-xl border border-slate-200"
            />
          )}

          {recipe.description && (
            <p className="text-sm text-slate-600">{recipe.description}</p>
          )}

          <div className="grid grid-cols-4 gap-2">
            <NutriBadge label="Calories" value={recipe.totalCalories} unit="kcal" color={AMBER} icon={<Flame className="h-4 w-4" />} />
            <NutriBadge label="Fat" value={recipe.totalFat} color={GREEN} icon={<Droplets className="h-4 w-4" />} />
            <NutriBadge label="Protein" value={recipe.totalProtein} color={BLUE} icon={<Beef className="h-4 w-4" />} />
            <NutriBadge label="Carbs" value={recipe.totalCarbs} color={RED} icon={<Wheat className="h-4 w-4" />} />
          </div>

          {recipe.ingredients.length > 0 && (
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Ingredients</h3>
              <div className="rounded-xl border border-slate-100 overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50">
                    <tr>
                      {["Name", "Amount", "Fat", "Prot", "Carb", "Kcal"].map((h) => (
                        <th key={h} className="px-3 py-2 text-left font-semibold text-slate-500">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {recipe.ingredients.map((ing) => (
                      <tr key={ing.id} className="border-t border-slate-100">
                        <td className="px-3 py-2 font-medium text-slate-700">{ing.foodName}</td>
                        <td className="px-3 py-2 text-slate-500">{ing.portionGrams}{ing.unit}</td>
                        <td className="px-3 py-2 text-slate-500">{ing.fat.toFixed(1)}g</td>
                        <td className="px-3 py-2 text-slate-500">{ing.protein.toFixed(1)}g</td>
                        <td className="px-3 py-2 text-slate-500">{ing.carbs.toFixed(1)}g</td>
                        <td className="px-3 py-2 text-slate-500">{ing.calories.toFixed(0)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function RecipesPage() {
  const queryClient = useQueryClient();
  const { data: recipes, isLoading } = useListRecipes();
  const deleteRecipe = useDeleteRecipe();

  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [viewId, setViewId] = useState<number | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const { printRef, handlePrint, isPrinting, onDataReady, printError, cancelPrint } = usePrint("Recipe Library Report", true);
  const [printFilterOpen, setPrintFilterOpen] = useState(false);
  const [selectedPrintRecipeIds, setSelectedPrintRecipeIds] = useState<number[] | null>(null);
  const [printSelectedSections, setPrintSelectedSections] = useState<Set<string>>(new Set(["recipe-list", "summary"]));
  const [printDateRange, setPrintDateRange] = useState<{ start: string; end: string } | undefined>(undefined);

  const RECIPES_PRINT_SECTIONS = useMemo(() => [
    { id: "summary",     label: "Library Summary",    defaultChecked: true },
    { id: "recipe-list", label: "Recipe Details",      defaultChecked: true },
  ], []);

  const recipeEntities = useMemo(
    () => (recipes ?? []).map((r) => ({ id: String(r.id), label: r.name, sublabel: `${(r as RecipeDetail).ingredients?.length ?? 0} ingredients` })),
    [recipes]
  );

  const handlePrintFilterConfirm = useCallback((result: PrintFilterResult) => {
    setPrintSelectedSections(new Set(result.selectedIds));
    setSelectedPrintRecipeIds(result.selectedEntityIds.map(Number));
    setPrintDateRange(result.dateRange);
    handlePrint();
  }, [handlePrint]);

  const printedRecipes = useMemo(() => {
    if (!recipes) return [];
    let result = selectedPrintRecipeIds === null ? recipes : recipes.filter(r => selectedPrintRecipeIds.includes(r.id));
    if (printDateRange) {
      result = result.filter(r => {
        const date = (r as RecipeDetail).createdAt?.slice(0, 10);
        if (!date) return true;
        if (printDateRange.start && date < printDateRange.start) return false;
        if (printDateRange.end && date > printDateRange.end) return false;
        return true;
      });
    }
    return result;
  }, [recipes, selectedPrintRecipeIds, printDateRange]);

  const { data: editRecipe } = useGetRecipe(editId ?? 0, {
    query: { enabled: editId !== null },
  });

  const canWrite = useCanWrite();

  const invalidate = () => queryClient.invalidateQueries({ queryKey: getListRecipesQueryKey() });

  const handleDelete = (id: number) => {
    deleteRecipe.mutate({ recipeId: id }, {
      onSuccess: () => {
        setConfirmDelete(null);
        invalidate();
      },
    });
  };

  const filtered = (recipes ?? []).filter((r) => {
    return !search || r.name.toLowerCase().includes(search.toLowerCase());
  });

  const sorted = [...filtered].sort((a, b) =>
    new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );

  const pagination = usePagination({
    totalItems: sorted.length,
    pageSize: 25,
    resetDeps: [search],
  });

  const paginatedRecipes = sorted.slice(pagination.startIndex, pagination.endIndex);

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString(undefined, {
      year: "numeric", month: "short", day: "numeric",
    });
  }

  return (
    <PrintLayout innerRef={printRef} className="space-y-6 pb-10">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-900">Recipe Library</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Build and manage your keto-friendly recipe collection — macros auto-calculated from the food database
          </p>
        </div>
        <div className="flex items-center gap-2">
          {printError && (
            <span className="no-print text-xs text-red-500">{printError}</span>
          )}
          {isPrinting && !printError && (
            <span className="no-print flex items-center gap-1.5 text-xs text-slate-400">
              Preparing report…
              <button onClick={cancelPrint} className="text-slate-400 hover:text-slate-600 underline underline-offset-2">Cancel</button>
            </span>
          )}
          <PrintButton onPrint={() => setPrintFilterOpen(true)} />
          {canWrite && (
            <button
              onClick={() => { setEditId(null); setShowForm(true); }}
              className="no-print flex items-center gap-2 bg-[#004ac6] text-white px-5 py-2.5 rounded-full text-sm font-semibold hover:bg-blue-700 transition-all active:scale-95"
            >
              <Plus className="h-4 w-4" />
              New Recipe
            </button>
          )}
        </div>
      </div>

      <PrintFilterDialog
        open={printFilterOpen}
        onOpenChange={setPrintFilterOpen}
        title="Print Recipe Library"
        description="Choose which sections and recipes to include in the report."
        options={RECIPES_PRINT_SECTIONS}
        showDateRange
        entities={recipeEntities}
        entityLabel="Recipes to Include"
        onConfirm={handlePrintFilterConfirm}
      />

      <div className="no-print grid grid-cols-1 sm:grid-cols-2 gap-4">
        {[
          { label: "Total Recipes",  value: (recipes ?? []).length,      color: BLUE  },
          { label: "Avg Ingredients",
            value: (recipes ?? []).length
              ? Math.round((recipes ?? []).reduce((s, r) => s + ((r as RecipeDetail).ingredients?.length ?? 0), 0) / (recipes ?? []).length)
              : 0,
            color: AMBER },
        ].map((stat) => (
          <div key={stat.label} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 flex items-center gap-4">
            <div
              className="w-11 h-11 rounded-full flex items-center justify-center shrink-0"
              style={{ background: `${stat.color}18` }}
            >
              <ChefHat className="h-5 w-5" style={{ color: stat.color }} />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{stat.label}</p>
              <p className="text-2xl font-black text-slate-900">{stat.value}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="no-print bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-100 flex-wrap">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search recipes…"
            className="flex-1 min-w-48 border border-slate-200 rounded-xl px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
          />
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
          </div>
        ) : sorted.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400 gap-3">
            <ChefHat className="h-10 w-10 opacity-30" />
            <p className="text-sm font-medium">
              {search ? "No recipes match your search" : "No recipes yet"}
            </p>
            {!search && (
              <p className="text-xs">Click "New Recipe" to create your first one</p>
            )}
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {paginatedRecipes.map((r) => (
              <div
                key={r.id}
                className="flex items-center gap-4 px-6 py-4 hover:bg-slate-50 cursor-pointer group transition-colors"
                onClick={() => setViewId(r.id)}
              >
                {(r as RecipeDetail).imageUrl ? (
                  <img
                    src={`/api/storage${(r as RecipeDetail).imageUrl}`}
                    alt={r.name}
                    className="w-10 h-10 rounded-xl object-cover shrink-0 border border-slate-200"
                  />
                ) : (
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                    style={{ background: `${BLUE}14` }}
                  >
                    <ChefHat className="h-5 w-5" style={{ color: BLUE }} />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-slate-900 truncate">{r.name}</p>
                  <div className="flex items-center gap-3 mt-0.5">
                    <span className="text-xs text-slate-400">
                      {(r as RecipeDetail).ingredients?.length ?? 0} ingredients
                    </span>
                    <span className="text-xs text-slate-300">•</span>
                    <span className="text-xs text-slate-400">Updated {formatDate(r.updatedAt)}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <div className="flex items-center gap-2 text-xs font-semibold">
                    <span style={{ color: AMBER }}>{(r as RecipeDetail).totalCalories?.toFixed(0) ?? "–"} kcal</span>
                    <span style={{ color: GREEN }}>{(r as RecipeDetail).totalFat?.toFixed(1) ?? "–"}g fat</span>
                  </div>

                  {canWrite && (
                    <button
                      onClick={(e) => { e.stopPropagation(); setEditId(r.id); setShowForm(true); }}
                      className="no-print p-1.5 text-slate-300 hover:text-blue-600 hover:bg-blue-50 rounded-lg opacity-0 group-hover:opacity-100 transition"
                      title="Edit"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                  )}
                  <button
                    onClick={(e) => { e.stopPropagation(); setViewId(r.id); }}
                    className="no-print p-1.5 text-slate-300 hover:text-blue-600 hover:bg-blue-50 rounded-lg opacity-0 group-hover:opacity-100 transition"
                    title="View details"
                  >
                    <Eye className="h-4 w-4" />
                  </button>
                  {canWrite && (
                    <button
                      onClick={(e) => { e.stopPropagation(); setConfirmDelete(r.id); }}
                      className="no-print p-1.5 text-slate-300 hover:text-red-600 hover:bg-red-50 rounded-lg opacity-0 group-hover:opacity-100 transition"
                      title="Delete"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                  <ChevronRight className="no-print h-4 w-4 text-slate-300 group-hover:text-slate-500 transition" />
                </div>
              </div>
            ))}
          </div>
        )}
        {sorted.length > 0 && (
          <div className="no-print flex items-center justify-between px-6 py-3 border-t border-slate-100">
            <p className="text-sm text-slate-500">
              Showing {pagination.rangeStart}–{pagination.rangeEnd} of {sorted.length}
            </p>
            {pagination.totalPages > 1 && (
              <div className="flex items-center gap-2">
                <button
                  disabled={!pagination.hasPrev}
                  onClick={pagination.goPrev}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="h-3.5 w-3.5" /> Previous
                </button>
                <span className="text-xs text-slate-500">
                  Page {pagination.currentPage} of {pagination.totalPages}
                </span>
                <button
                  disabled={!pagination.hasNext}
                  onClick={pagination.goNext}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Next <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {showForm && (
        <RecipeForm
          initial={editId !== null ? (editRecipe ?? null) : null}
          recipeId={editId ?? undefined}
          onClose={() => { setShowForm(false); setEditId(null); }}
          onSaved={() => { setShowForm(false); setEditId(null); invalidate(); }}
        />
      )}

      {viewId !== null && (
        <RecipeDetailPanel
          recipeId={viewId}
          onClose={() => setViewId(null)}
          onEdit={() => { setEditId(viewId); setViewId(null); setShowForm(true); }}
          canWrite={canWrite}
        />
      )}

      {isPrinting && (
        <div className="hidden print-section space-y-4">
          {printSelectedSections.has("summary") && (
            <div>
              <h2 className="text-base font-bold text-slate-800 mb-2">Recipe Library — Summary</h2>
              <table className="w-full text-xs border-collapse max-w-xs">
                <tbody>
                  <tr className="border-b border-slate-100">
                    <td className="py-1 px-2 font-semibold text-slate-600">Total Recipes</td>
                    <td className="py-1 px-2 text-slate-800">{printedRecipes.length}</td>
                  </tr>
                  <tr className="border-b border-slate-100">
                    <td className="py-1 px-2 font-semibold text-slate-600">Avg Ingredients</td>
                    <td className="py-1 px-2 text-slate-800">
                      {printedRecipes.length
                        ? Math.round(printedRecipes.reduce((s, r) => s + ((r as RecipeDetail).ingredients?.length ?? 0), 0) / printedRecipes.length)
                        : "—"}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
          <div className={printSelectedSections.has("recipe-list") ? undefined : "hidden"}>
            {printSelectedSections.has("recipe-list") && (
              <h2 className="text-base font-bold text-slate-800 mb-2">
                Recipe Details ({printedRecipes.length})
              </h2>
            )}
            <RecipePrintReport onReady={onDataReady} filterIds={printedRecipes.map(r => r.id)} />
          </div>
        </div>
      )}

      {confirmDelete !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 text-center">
            <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
              <Trash2 className="h-6 w-6 text-red-600" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-2">Delete Recipe?</h3>
            <p className="text-sm text-slate-500 mb-6">This will permanently remove the recipe and all its ingredients.</p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmDelete(null)}
                className="flex-1 px-4 py-2 border border-slate-200 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(confirmDelete)}
                disabled={deleteRecipe.isPending}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-xl text-sm font-semibold hover:bg-red-700 disabled:opacity-50"
              >
                {deleteRecipe.isPending ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </PrintLayout>
  );
}
