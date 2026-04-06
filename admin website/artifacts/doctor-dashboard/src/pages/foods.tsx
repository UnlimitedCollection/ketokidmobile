import { useState, useMemo, useRef, useCallback } from "react";
import { usePrint } from "@/hooks/usePrint";
import { usePagination } from "@/hooks/usePagination";
import { PrintLayout } from "@/components/print-layout";
import { PrintButton } from "@/components/print-button";
import { PrintFilterDialog, type PrintFilterResult } from "@/components/print-filter-dialog";
import { useUpload } from "@workspace/object-storage-web";
import { useGetFoods, useCreateFood, useUpdateFood, useDeleteFood } from "@workspace/api-client-react";
import type { CreateFoodRequest, UpdateFoodRequest } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { getGetFoodsQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { useCanWrite } from "@/hooks/useRole";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Loader2, Plus, Search, Pencil, Trash2, Flame, Apple, Eye, EyeOff, ImageUp, X, ChevronLeft, ChevronRight } from "lucide-react";

type FoodFormData = {
  name: string;
  category: string;
  carbs: number;
  fat: number;
  protein: number;
  calories: number;
  description: string;
  imageUrl: string;
  isActive: boolean;
};

const CATEGORIES = ["Carb", "Fat", "Protein"];

const BLANK_FORM: FoodFormData = {
  name: "",
  category: "Carb",
  carbs: 0,
  fat: 0,
  protein: 0,
  calories: 0,
  description: "",
  imageUrl: "",
  isActive: true,
};

export default function FoodsPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [showInactive, setShowInactive] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [form, setForm] = useState<FoodFormData>(BLANK_FORM);
  const [togglingId, setTogglingId] = useState<number | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [viewingFood, setViewingFood] = useState<null | {
    id: number;
    name: string;
    category: string;
    carbs: number;
    fat: number;
    protein: number;
    calories: number;
    description?: string | null;
    imageUrl?: string | null;
    isActive?: boolean | null;
  }>(null);

  const { uploadFile, isUploading } = useUpload({
    onSuccess: (response) => {
      handleFormChange("imageUrl", response.objectPath);
      setImagePreview(`/api/storage${response.objectPath}`);
    },
    onError: () => {
      toast({ title: "Image upload failed", variant: "destructive" });
    },
  });

  const { data: foods, isLoading } = useGetFoods();
  const createFood = useCreateFood();
  const updateFood = useUpdateFood();
  const deleteFood = useDeleteFood();

  const filteredFoods = useMemo(() => {
    if (!foods) return [];
    return foods.filter((f) => {
      const matchesSearch = !search || f.name.toLowerCase().includes(search.toLowerCase());
      const matchesCategory = categoryFilter === "all" || f.category === categoryFilter;
      const matchesActive = showInactive ? true : f.isActive !== false;
      return matchesSearch && matchesCategory && matchesActive;
    });
  }, [foods, search, categoryFilter, showInactive]);

  const pagination = usePagination({
    totalItems: filteredFoods.length,
    pageSize: 25,
    resetDeps: [search, categoryFilter, showInactive],
  });

  const paginatedFoods = useMemo(
    () => filteredFoods.slice(pagination.startIndex, pagination.endIndex),
    [filteredFoods, pagination.startIndex, pagination.endIndex]
  );

  const inactiveCount = useMemo(() => {
    if (!foods) return 0;
    return foods.filter((f) => f.isActive === false).length;
  }, [foods]);

  function openAdd() {
    setEditingId(null);
    setForm(BLANK_FORM);
    setImagePreview(null);
    setDialogOpen(true);
  }

  function openEdit(food: { id: number; name: string; category: string; carbs: number; fat: number; protein: number; calories: number; description?: string | null; imageUrl?: string | null; isActive?: boolean | null }) {
    setEditingId(food.id);
    const imageUrl = food.imageUrl ?? "";
    setForm({
      name: food.name,
      category: food.category,
      carbs: food.carbs,
      fat: food.fat,
      protein: food.protein,
      calories: food.calories,
      description: food.description ?? "",
      imageUrl,
      isActive: food.isActive !== false,
    });
    setImagePreview(imageUrl ? (imageUrl.startsWith("/objects/") ? `/api/storage${imageUrl}` : imageUrl) : null);
    setDialogOpen(true);
  }

  function openDelete(id: number) {
    setDeletingId(id);
    setDeleteDialogOpen(true);
  }

  function handleFormChange(field: keyof FoodFormData, value: string | number | boolean) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function handleToggleActive(food: { id: number; isActive?: boolean | null }) {
    const newActive = food.isActive === false ? true : false;
    setTogglingId(food.id);
    updateFood.mutate(
      { foodId: food.id, data: { isActive: newActive } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetFoodsQueryKey() });
          toast({ title: newActive ? "Food marked as active" : "Food marked as inactive" });
        },
        onError: () => toast({ title: "Failed to update food status", variant: "destructive" }),
        onSettled: () => setTogglingId(null),
      }
    );
  }

  function handleSubmit() {
    if (!form.name.trim()) {
      toast({ title: "Name required", variant: "destructive" });
      return;
    }

    if (editingId !== null) {
      const body: UpdateFoodRequest = {
        name: form.name,
        category: form.category,
        carbs: Number(form.carbs),
        fat: Number(form.fat),
        protein: Number(form.protein),
        calories: Number(form.calories),
        description: form.description,
        imageUrl: form.imageUrl || undefined,
        isActive: form.isActive,
      };
      updateFood.mutate(
        { foodId: editingId, data: body },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: getGetFoodsQueryKey() });
            toast({ title: "Food updated successfully" });
            setDialogOpen(false);
          },
          onError: () => toast({ title: "Failed to update food", variant: "destructive" }),
        }
      );
    } else {
      const body: CreateFoodRequest = {
        name: form.name,
        category: form.category,
        carbs: Number(form.carbs),
        fat: Number(form.fat),
        protein: Number(form.protein),
        calories: Number(form.calories),
        description: form.description,
        imageUrl: form.imageUrl || undefined,
      };
      createFood.mutate(
        { data: body },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: getGetFoodsQueryKey() });
            toast({ title: "Food added successfully" });
            setDialogOpen(false);
          },
          onError: () => toast({ title: "Failed to add food", variant: "destructive" }),
        }
      );
    }
  }

  function handleDelete() {
    if (deletingId === null) return;
    deleteFood.mutate(
      { foodId: deletingId },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetFoodsQueryKey() });
          toast({ title: "Food deleted" });
          setDeleteDialogOpen(false);
          setDeletingId(null);
        },
        onError: () => toast({ title: "Failed to delete food", variant: "destructive" }),
      }
    );
  }

  const isMutating = createFood.isPending || updateFood.isPending || isUploading;
  const canWrite = useCanWrite();
  const { printRef, handlePrint } = usePrint("Food Library Report");
  const [printFilterOpen, setPrintFilterOpen] = useState(false);
  const [printSelectedCategories, setPrintSelectedCategories] = useState<Set<string>>(new Set(CATEGORIES));
  const [printSelectedSections, setPrintSelectedSections] = useState<Set<string>>(new Set(["food-list", "stats"]));

  const FOODS_PRINT_SECTIONS = useMemo(() => [
    { id: "stats",     label: "Summary Statistics", defaultChecked: true },
    { id: "food-list", label: "Food List Table",    defaultChecked: true },
  ], []);

  const categoryEntities = useMemo(
    () => CATEGORIES.map((cat) => ({ id: cat, label: cat })),
    []
  );

  const handlePrintFilterConfirm = useCallback((result: PrintFilterResult) => {
    setPrintSelectedSections(new Set(result.selectedIds));
    setPrintSelectedCategories(new Set(result.selectedEntityIds));
    handlePrint();
  }, [handlePrint]);

  const printFoods = useMemo(() => {
    if (!foods) return [];
    return foods.filter(f => printSelectedCategories.has(f.category));
  }, [foods, printSelectedCategories]);

  return (
    <PrintLayout innerRef={printRef} className="space-y-6 p-6">
      <PrintFilterDialog
        open={printFilterOpen}
        onOpenChange={setPrintFilterOpen}
        title="Print Food Library"
        description="Choose which sections and categories to include."
        options={FOODS_PRINT_SECTIONS}
        entities={categoryEntities}
        entityLabel="Food Categories"
        onConfirm={handlePrintFilterConfirm}
      />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Food Library</h1>
          <p className="text-sm text-slate-500 mt-1">
            Manage the approved food database used in keto meal planning
          </p>
        </div>
        <div className="flex items-center gap-2">
          <PrintButton onPrint={() => setPrintFilterOpen(true)} />
          {canWrite && (
            <Button onClick={openAdd} className="no-print gap-2">
              <Plus className="h-4 w-4" />
              Add Food
            </Button>
          )}
        </div>
      </div>

      {/* Stats Row */}
      {foods && (
        <div className="no-print grid grid-cols-2 sm:grid-cols-2 gap-4">
          <Card className="border-0 shadow-sm">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Apple className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-900">{foods.filter(f => f.isActive !== false).length}</p>
                  <p className="text-xs text-slate-500">Active Foods</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-100 text-blue-600">
                  <Flame className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-900">{CATEGORIES.length}</p>
                  <p className="text-xs text-slate-500">Categories</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters — interactive table (hidden in print, replaced by print-only table below) */}
      <Card className="no-print border-0 shadow-sm">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Food Library</CardTitle>
            {inactiveCount > 0 && (
              <button
                onClick={() => setShowInactive(!showInactive)}
                className={`no-print flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border transition-colors ${showInactive ? "bg-slate-700 text-white border-slate-700" : "bg-white text-slate-500 border-slate-200 hover:bg-slate-50"}`}
              >
                <EyeOff className="h-3.5 w-3.5" />
                {showInactive ? `Hide inactive (${inactiveCount})` : `Show ${inactiveCount} inactive`}
              </button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="no-print flex flex-col sm:flex-row gap-3 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search foods..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {CATEGORIES.map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {cat}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : filteredFoods.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-400">
              <Apple className="h-12 w-12 mb-3 opacity-30" />
              <p className="text-sm">No foods found</p>
              {search && <p className="text-xs mt-1">Try adjusting your search</p>}
            </div>
          ) : (
            <div className="rounded-md border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50">
                    <TableHead className="font-semibold">Name</TableHead>
                    <TableHead className="font-semibold">Macro Type</TableHead>
                    <TableHead className="font-semibold text-right">Calories</TableHead>
                    <TableHead className="font-semibold text-right">Carbs (g)</TableHead>
                    <TableHead className="font-semibold text-right">Fat (g)</TableHead>
                    <TableHead className="font-semibold text-right">Protein (g)</TableHead>
                    <TableHead className="font-semibold text-center">Active</TableHead>
                    <TableHead className="no-print w-20"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedFoods.map((food) => {
                    const isInactive = food.isActive === false;
                    const categoryStyle: Record<string, string> = {
                      Carb:     "bg-green-50 text-green-700 border-green-200",
                      Fat:      "bg-amber-50 text-amber-700 border-amber-200",
                      Protein:  "bg-rose-50 text-rose-700 border-rose-200",
                    };
                    return (
                      <TableRow
                        key={food.id}
                        className={`hover:bg-slate-50/50 transition-colors ${isInactive ? "opacity-50" : ""}`}
                      >
                        <TableCell>
                          <div>
                            <p className={`font-medium ${isInactive ? "text-slate-400 line-through" : "text-slate-900"}`}>{food.name}</p>
                            {food.description && (
                              <p className="text-xs text-slate-400 mt-0.5 line-clamp-1">{food.description}</p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={`text-xs font-semibold border ${categoryStyle[food.category] ?? "bg-slate-50 text-slate-600 border-slate-200"}`}>
                            {food.category}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-medium">{Math.round(food.calories)}</TableCell>
                        <TableCell className="text-right text-slate-600">{food.carbs.toFixed(1)}</TableCell>
                        <TableCell className="text-right text-slate-600">{food.fat.toFixed(1)}</TableCell>
                        <TableCell className="text-right text-slate-600">{food.protein.toFixed(1)}</TableCell>
                        <TableCell className="text-center">
                          {togglingId === food.id ? (
                            <Loader2 className="h-4 w-4 animate-spin mx-auto text-slate-400" />
                          ) : (
                            <Switch
                              checked={food.isActive !== false}
                              onCheckedChange={canWrite ? () => handleToggleActive(food) : undefined}
                              disabled={!canWrite}
                              aria-label={`Toggle ${food.name} active status`}
                              className="data-[state=checked]:bg-green-500"
                            />
                          )}
                        </TableCell>
                        <TableCell className="no-print">
                          <div className="flex items-center justify-end gap-1">
                            {canWrite && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-slate-500 hover:text-primary"
                                onClick={() => openEdit(food)}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-slate-500 hover:text-primary"
                              onClick={() => setViewingFood(food)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            {canWrite && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-slate-500 hover:text-destructive"
                                onClick={() => openDelete(food.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
          {filteredFoods.length > 0 && (
            <div className="flex items-center justify-between mt-3">
              <p className="text-xs text-slate-400">
                Showing {pagination.rangeStart}–{pagination.rangeEnd} of {filteredFoods.length} foods
                {!showInactive && inactiveCount > 0 && ` (${inactiveCount} inactive hidden)`}
              </p>
              {pagination.totalPages > 1 && (
                <div className="no-print flex items-center gap-2">
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
        </CardContent>
      </Card>

      {/* Print-only: filtered foods based on dialog selection */}
      <div className="hidden print-section space-y-4">
        {printSelectedSections.has("stats") && foods && (
          <div>
            <h2 className="text-base font-bold text-slate-800 mb-2">Food Library — Summary</h2>
            <table className="w-full text-xs border-collapse max-w-xs">
              <tbody>
                <tr className="border-b border-slate-100">
                  <td className="py-1 px-2 font-semibold text-slate-600">Total Foods</td>
                  <td className="py-1 px-2 text-slate-800">{printFoods.length}</td>
                </tr>
                <tr className="border-b border-slate-100">
                  <td className="py-1 px-2 font-semibold text-slate-600">Active</td>
                  <td className="py-1 px-2 text-slate-800">{printFoods.filter(f => f.isActive !== false).length}</td>
                </tr>
                <tr className="border-b border-slate-100">
                  <td className="py-1 px-2 font-semibold text-slate-600">Categories</td>
                  <td className="py-1 px-2 text-slate-800">{[...printSelectedCategories].join(", ")}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
        {printSelectedSections.has("food-list") && printFoods.length > 0 && (
          <div>
            <h2 className="text-base font-bold text-slate-800 mb-2">
              Food List ({printFoods.length} items — {[...printSelectedCategories].join(", ")})
            </h2>
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100">
                  <th className="text-left py-1.5 px-2 font-semibold text-slate-600">Name</th>
                  <th className="text-left py-1.5 px-2 font-semibold text-slate-600">Category</th>
                  <th className="text-right py-1.5 px-2 font-semibold text-slate-600">Cal</th>
                  <th className="text-right py-1.5 px-2 font-semibold text-slate-600">Carbs (g)</th>
                  <th className="text-right py-1.5 px-2 font-semibold text-slate-600">Fat (g)</th>
                  <th className="text-right py-1.5 px-2 font-semibold text-slate-600">Protein (g)</th>
                  <th className="text-center py-1.5 px-2 font-semibold text-slate-600">Active</th>
                </tr>
              </thead>
              <tbody>
                {printFoods.map((food) => (
                  <tr key={food.id} className={`border-b border-slate-100 ${food.isActive === false ? "opacity-60" : ""}`}>
                    <td className="py-1.5 px-2 text-slate-800 font-medium">{food.name}</td>
                    <td className="py-1.5 px-2 text-slate-600">{food.category ?? "—"}</td>
                    <td className="py-1.5 px-2 text-right text-slate-600">{food.calories != null ? Math.round(food.calories) : "—"}</td>
                    <td className="py-1.5 px-2 text-right text-slate-600">{food.carbs != null ? food.carbs.toFixed(1) : "—"}</td>
                    <td className="py-1.5 px-2 text-right text-slate-600">{food.fat != null ? food.fat.toFixed(1) : "—"}</td>
                    <td className="py-1.5 px-2 text-right text-slate-600">{food.protein != null ? food.protein.toFixed(1) : "—"}</td>
                    <td className="py-1.5 px-2 text-center text-slate-600">{food.isActive === false ? "No" : "Yes"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId !== null ? "Edit Food" : "Add New Food"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 space-y-1.5">
                <Label htmlFor="food-name">Food Name *</Label>
                <Input
                  id="food-name"
                  placeholder="e.g. Avocado"
                  value={form.name}
                  onChange={(e) => handleFormChange("name", e.target.value)}
                />
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label>Category</Label>
                <Select value={form.category} onValueChange={(v) => handleFormChange("category", v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((cat) => (
                      <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="food-calories">Calories (kcal)</Label>
                <Input
                  id="food-calories"
                  type="number"
                  min={0}
                  value={form.calories}
                  onChange={(e) => handleFormChange("calories", parseFloat(e.target.value) || 0)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="food-carbs">Carbs (g per 100g)</Label>
                <Input
                  id="food-carbs"
                  type="number"
                  min={0}
                  step={0.1}
                  value={form.carbs}
                  onChange={(e) => handleFormChange("carbs", parseFloat(e.target.value) || 0)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="food-fat">Fat (g per 100g)</Label>
                <Input
                  id="food-fat"
                  type="number"
                  min={0}
                  step={0.1}
                  value={form.fat}
                  onChange={(e) => handleFormChange("fat", parseFloat(e.target.value) || 0)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="food-protein">Protein (g per 100g)</Label>
                <Input
                  id="food-protein"
                  type="number"
                  min={0}
                  step={0.1}
                  value={form.protein}
                  onChange={(e) => handleFormChange("protein", parseFloat(e.target.value) || 0)}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="food-desc">Description</Label>
              <Textarea
                id="food-desc"
                placeholder="Brief description of the food item"
                value={form.description}
                maxLength={1000}
                onChange={(e) => handleFormChange("description", e.target.value)}
                className="resize-none rounded-xl"
                rows={4}
              />
              <p className="text-xs text-slate-400 text-right">{form.description.length} / 1000</p>
            </div>

            <div className="space-y-1.5">
              <Label>Food Image (optional)</Label>
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
                <div className="flex items-center gap-3 rounded-lg border border-slate-200 p-3">
                  <img
                    src={imagePreview}
                    alt="Food preview"
                    className="h-16 w-16 rounded-md object-cover border border-slate-200"
                  />
                  <div className="flex flex-col gap-1.5">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={isUploading}
                      onClick={() => fileInputRef.current?.click()}
                    >
                      {isUploading ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <ImageUp className="h-3.5 w-3.5 mr-1" />}
                      Change
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-slate-400 hover:text-destructive"
                      onClick={() => {
                        handleFormChange("imageUrl", "");
                        setImagePreview(null);
                      }}
                    >
                      <X className="h-3.5 w-3.5 mr-1" />
                      Remove
                    </Button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  disabled={isUploading}
                  onClick={() => fileInputRef.current?.click()}
                  className="flex w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-slate-200 p-6 text-slate-400 transition-colors hover:border-primary/50 hover:text-primary disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isUploading ? (
                    <Loader2 className="h-6 w-6 animate-spin" />
                  ) : (
                    <ImageUp className="h-6 w-6" />
                  )}
                  <span className="text-sm">{isUploading ? "Uploading..." : "Click to upload image"}</span>
                </button>
              )}
            </div>

            {editingId !== null && (
              <div className="flex items-center justify-between rounded-lg border border-slate-200 px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-slate-800">Active in Food Library</p>
                  <p className="text-xs text-slate-500">Inactive foods are hidden from meal planning</p>
                </div>
                <Switch
                  checked={form.isActive}
                  onCheckedChange={(v) => handleFormChange("isActive", v)}
                  className="data-[state=checked]:bg-green-500"
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={isMutating}>
              {isMutating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editingId !== null ? "Save Changes" : "Add Food"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Food Details */}
      <Dialog open={viewingFood !== null} onOpenChange={(open) => { if (!open) setViewingFood(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Food Details</DialogTitle>
          </DialogHeader>
          {viewingFood && (
            <div className="space-y-4">
              {viewingFood.imageUrl && (
                <div className="flex justify-center">
                  <img
                    src={viewingFood.imageUrl.startsWith("/objects/") ? `/api/storage${viewingFood.imageUrl}` : viewingFood.imageUrl}
                    alt={viewingFood.name}
                    className="h-40 w-40 rounded-lg object-cover border"
                  />
                </div>
              )}
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Name</p>
                <p className="font-semibold text-base">{viewingFood.name}</p>
              </div>
              {viewingFood.description && (
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Description</p>
                  <p className="text-sm">{viewingFood.description}</p>
                </div>
              )}
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Macro Type</p>
                <Badge variant="outline">{viewingFood.category}</Badge>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-md border p-3 text-center">
                  <p className="text-xs text-muted-foreground">Calories</p>
                  <p className="font-semibold">{viewingFood.calories}</p>
                </div>
                <div className="rounded-md border p-3 text-center">
                  <p className="text-xs text-muted-foreground">Carbs (g)</p>
                  <p className="font-semibold">{viewingFood.carbs}</p>
                </div>
                <div className="rounded-md border p-3 text-center">
                  <p className="text-xs text-muted-foreground">Fat (g)</p>
                  <p className="font-semibold">{viewingFood.fat}</p>
                </div>
                <div className="rounded-md border p-3 text-center">
                  <p className="text-xs text-muted-foreground">Protein (g)</p>
                  <p className="font-semibold">{viewingFood.protein}</p>
                </div>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Status</p>
                <Badge variant={viewingFood.isActive !== false ? "default" : "secondary"}>
                  {viewingFood.isActive !== false ? "Active" : "Inactive"}
                </Badge>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewingFood(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Food Item</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove this food from the database. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteFood.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PrintLayout>
  );
}
