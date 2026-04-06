import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { usePrint } from "@/hooks/usePrint";
import { PrintLayout } from "@/components/print-layout";
import { PrintButton } from "@/components/print-button";
import { PrintFilterDialog, type PrintFilterResult } from "@/components/print-filter-dialog";
import { DayHoverPopup } from "@/components/day-hover-popup";
import { DayAnalyticsDialog } from "@/components/day-analytics-dialog";
import { useParams, Link, useLocation } from "wouter";
import { useGetKid, useAddWeightRecord, useDeleteWeightRecord, useUpdateKidMedical, useUpdateKid, useDeleteKid, useGetKidMealHistory, useGetKidKetoneReadings, useAddKetoneReading, useDeleteKetoneReading, useGetKidMealLogs, useAddMealLog, useDeleteMealLog, useGetKidMealLog, useGetKidAssignedMealPlan, useGetFoods, useUpdateMealLogImage, useListMealTypes, getGetKidQueryKey, getGetKidMedicalQueryKey, type WeightRecordResponse, type LibraryMealPlanDetail, type LibraryMealPlanItem, type MedicalSettingsRequest, type UpdateKidRequest, type MealDay } from "@workspace/api-client-react";
import { useUpload } from "@workspace/object-storage-web";
import { z } from "zod";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { format, parseISO, startOfMonth, subMonths, eachDayOfInterval, endOfMonth, getDay } from "date-fns";
import { 
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, 
  ResponsiveContainer, ReferenceLine, Legend, Cell
} from "recharts";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { useCanWrite } from "@/hooks/useRole";
import { Activity, User, Scale, Calendar, FileText, Trash2, Settings, Plus, Loader2, BarChart2, TrendingUp, Flame, FlaskConical, AlertTriangle, ClipboardList, CheckCircle2, Circle, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, Coffee, Sun, Moon, LayoutGrid, Camera, ImageIcon, X, Pencil, LineChart as LineChartIcon, UtensilsCrossed, Zap, Filter } from "lucide-react";
import { getMealTypesForDiet } from "@/lib/keto-meal-types";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

export default function KidProfilePage() {
  const { id } = useParams();
  const kidId = parseInt(id || "0", 10);
  const [, setLocation] = useLocation();
  const { data: profile, isLoading } = useGetKid(kidId);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { printRef, handlePrint, isPrinting, onDataReady, cancelPrint } = usePrint("Patient Report", true);
  const [printFilterOpen, setPrintFilterOpen] = useState(false);
  const [printSections, setPrintSections] = useState<Set<string>>(new Set());
  const [printDateRange, setPrintDateRange] = useState<{ start: string; end: string } | undefined>();

  const PROFILE_PRINT_SECTIONS = useMemo(() => [
    { id: "weight", label: "Weight History", defaultChecked: true },
    { id: "medical", label: "Medical Controls", defaultChecked: true },
    { id: "meals", label: "Meal History", defaultChecked: true },
    { id: "ketone", label: "Ketone Readings", defaultChecked: true },
    { id: "mealplan", label: "Meal Plan", defaultChecked: true },
    { id: "compliance", label: "Compliance Calendar", defaultChecked: true },
  ], []);

  const handlePrintFilterConfirm = useCallback((result: PrintFilterResult) => {
    setPrintSections(new Set(result.selectedIds));
    setPrintDateRange(result.dateRange);
    handlePrint();
  }, [handlePrint]);

  const canWrite = useCanWrite();

  const deleteKidMutation = useDeleteKid({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["/api/kids"] });
        toast({ title: "Patient removed", description: "The patient record has been deleted." });
        setLocation("/kids");
      },
      onError: () => toast({ title: "Failed to delete patient", variant: "destructive" }),
    }
  });

  if (isLoading) {
    return (
      <div className="h-[80vh] flex items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  if (!profile) {
    return <div className="text-center py-20 text-slate-500">Patient not found.</div>;
  }

  const { kid, medical, recentWeights } = profile;

  return (
    <PrintLayout innerRef={printRef} className="space-y-6">
      {/* Edit Kid Dialog */}
      <EditKidDialog kidId={kidId} kid={kid} open={editOpen} onOpenChange={setEditOpen} />

      {/* Delete Confirmation */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Patient Record</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete <strong>{kid.name}</strong> and all associated data including weight records, meal logs, ketone readings, and notes. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteKidMutation.mutate({ kidId })}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteKidMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete Patient
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <PrintFilterDialog
        open={printFilterOpen}
        onOpenChange={setPrintFilterOpen}
        title="Print Patient Report"
        description="Choose which sections and date range to include in the printed report."
        options={PROFILE_PRINT_SECTIONS}
        showDateRange
        onConfirm={handlePrintFilterConfirm}
      />

      {/* Header Profile Card */}
      <div className="flex flex-col lg:flex-row gap-6">
        <Card className="flex-1 rounded-2xl border-slate-200 shadow-sm overflow-hidden bg-white">
          <div className="h-2 w-full bg-gradient-to-r from-primary to-secondary" />
          <div className="p-6 flex flex-col md:flex-row gap-6 items-start md:items-center">
            <div className="h-20 w-20 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 border border-blue-100">
              <User className="h-10 w-10" />
            </div>
            <div className="flex-1">
              <div className="flex items-start justify-between">
                <div>
                  <h1 className="text-2xl font-bold text-slate-900">{kid.name}</h1>
                  <div className="flex items-center gap-3 mt-1 text-slate-500 text-sm">
                    <span className="text-slate-500 font-medium">PHN No.</span><span className="font-mono bg-slate-100 px-2 py-0.5 rounded">{kid.kidCode}</span>
                    <span>{kid.ageMonths} months old</span>
                    <span className="capitalize">{kid.gender}</span>
                    <Badge variant="secondary" className="bg-primary/10 text-primary hover:bg-primary/20 text-sm py-1 px-3">
                      {kid.dietType === "classic" ? "Classic Ketogenic" : kid.dietType === "mad" ? "Modified Atkins" : kid.dietType === "mct" ? "MCT Diet" : "Low GI Diet"}{kid.dietSubCategory ? ` (${kid.dietSubCategory})` : ""}
                    </Badge>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  {isPrinting && (
                    <span className="no-print flex items-center gap-1.5 text-xs text-slate-400">
                      Preparing report…
                      <button onClick={cancelPrint} className="text-slate-400 hover:text-slate-600 underline underline-offset-2">Cancel</button>
                    </span>
                  )}
                  <PrintButton onPrint={() => setPrintFilterOpen(true)} />
                  <Button size="sm" variant="outline" className="no-print rounded-lg gap-1.5 text-primary border-primary/30 hover:bg-primary/5" onClick={() => setLocation(`/kids/${kidId}/analytics`)}>
                    <LineChartIcon className="h-3.5 w-3.5" /> Analysis
                  </Button>
                  {canWrite && (
                    <>
                      <Button size="sm" variant="outline" className="no-print rounded-lg gap-1.5" onClick={() => setEditOpen(true)}>
                        <Pencil className="h-3.5 w-3.5" /> Edit
                      </Button>
                      <Button size="sm" variant="outline" className="no-print rounded-lg gap-1.5 text-destructive border-destructive/30 hover:bg-destructive/10" onClick={() => setDeleteOpen(true)}>
                        <Trash2 className="h-3.5 w-3.5" /> Delete
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
          <div className="bg-slate-50 border-t border-slate-100 p-4 px-6 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-slate-500 font-medium">Parent/Guardian</p>
              <p className="font-semibold text-slate-800">{kid.parentName}</p>
            </div>
            <div>
              <p className="text-slate-500 font-medium">Contact</p>
              <p className="font-semibold text-slate-800">{kid.parentContact}</p>
            </div>
            <div>
              <p className="text-slate-500 font-medium">Current Weight</p>
              <p className="font-semibold text-slate-800">{kid.currentWeight ? `${kid.currentWeight} kg` : '--'}</p>
            </div>
            <div>
              <p className="text-slate-500 font-medium">DOB</p>
              <p className="font-semibold text-slate-800">{format(parseISO(kid.dateOfBirth), 'MMM d, yyyy')}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Tabs Section — hidden in print (print-section below is shown instead) */}
      <Tabs defaultValue="overview" className="w-full no-print">
        <TabsList className="no-print bg-white border border-slate-200 p-1 rounded-xl h-auto mb-6 flex flex-wrap shadow-sm">
          <TabsTrigger value="overview" className="rounded-lg data-[state=active]:bg-primary data-[state=active]:text-white py-2.5 px-4 flex items-center gap-2 transition-all">
            <Activity className="h-4 w-4" /> Overview
          </TabsTrigger>
          <TabsTrigger value="medical" className="rounded-lg data-[state=active]:bg-primary data-[state=active]:text-white py-2.5 px-4 flex items-center gap-2 transition-all">
            <Settings className="h-4 w-4" /> Medical Controls
          </TabsTrigger>
          <TabsTrigger value="meals" className="rounded-lg data-[state=active]:bg-primary data-[state=active]:text-white py-2.5 px-4 flex items-center gap-2 transition-all">
            <Calendar className="h-4 w-4" /> Meal History
          </TabsTrigger>
          <TabsTrigger value="ketones" className="rounded-lg data-[state=active]:bg-primary data-[state=active]:text-white py-2.5 px-4 flex items-center gap-2 transition-all">
            <Flame className="h-4 w-4" /> Ketones
          </TabsTrigger>
          <TabsTrigger value="mealplan" className="rounded-lg data-[state=active]:bg-primary data-[state=active]:text-white py-2.5 px-4 flex items-center gap-2 transition-all">
            <ClipboardList className="h-4 w-4" />Meal Plan
          </TabsTrigger>
          <TabsTrigger value="compliance" className="rounded-lg data-[state=active]:bg-primary data-[state=active]:text-white py-2.5 px-4 flex items-center gap-2 transition-all">
            <LayoutGrid className="h-4 w-4" /> Compliance
          </TabsTrigger>
          <TabsTrigger value="side-effects" className="rounded-lg data-[state=active]:bg-primary data-[state=active]:text-white py-2.5 px-4 flex items-center gap-2 transition-all">
            <AlertTriangle className="h-4 w-4" /> Side Effects
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="focus-visible:outline-none">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-2 rounded-2xl shadow-sm border-slate-200">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <div>
                  <CardTitle className="text-lg">Weight History</CardTitle>
                  <CardDescription>Track patient's weight trajectory over time</CardDescription>
                </div>
                {canWrite && <AddWeightDialog kidId={kidId} lastWeight={recentWeights[recentWeights.length - 1]?.weight} />}
              </CardHeader>
              <CardContent className="pt-4">
                {recentWeights.length < 2 ? (
                  <div className="h-[300px] flex flex-col items-center justify-center text-slate-400 border-2 border-dashed border-slate-200 rounded-xl">
                    <Scale className="h-8 w-8 mb-2 opacity-50" />
                    <p>Not enough weight data to display chart.</p>
                  </div>
                ) : (
                  <div className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={recentWeights}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                        <XAxis 
                          dataKey="date" 
                          tickFormatter={(date) => format(parseISO(date), 'MMM d')}
                          stroke="#94a3b8"
                          fontSize={12}
                          tickMargin={10}
                        />
                        <YAxis 
                          stroke="#94a3b8" 
                          fontSize={12}
                          tickMargin={10}
                          domain={['dataMin - 1', 'dataMax + 1']}
                        />
                        <Tooltip 
                          contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                          labelFormatter={(date) => format(parseISO(date as string), 'MMM d, yyyy')}
                        />
                        <Line 
                          type="monotone" 
                          dataKey="weight" 
                          stroke="#0ea5e9" 
                          strokeWidth={3}
                          dot={{ r: 4, fill: "#0ea5e9", strokeWidth: 2, stroke: "#fff" }}
                          activeDot={{ r: 6, fill: "#0d9488", strokeWidth: 0 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}
                {recentWeights.length > 0 && (
                  <WeightReadingsList kidId={kidId} weights={recentWeights} canWrite={canWrite} />
                )}
              </CardContent>
            </Card>

            <Card className="rounded-2xl shadow-sm border-slate-200">
              <CardHeader className="pb-4">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Activity className="h-5 w-5 text-primary" />
                  Recent Activity
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  <div>
                    <h4 className="text-sm font-semibold text-slate-900 mb-3">Latest Meal Completion</h4>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-500">Today</span>
                        <span className="font-bold text-slate-800">{Math.round(kid.mealCompletionRate * 100)}%</span>
                      </div>
                      <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-primary rounded-full transition-all" 
                          style={{ width: `${Math.round(kid.mealCompletionRate * 100)}%` }} 
                        />
                      </div>
                    </div>
                  </div>
                  
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="medical" className="focus-visible:outline-none">
          <MedicalSettingsForm kidId={kidId} initialData={medical} lastWeight={recentWeights.length > 0 ? recentWeights[recentWeights.length - 1].weight : undefined} />
        </TabsContent>

        <TabsContent value="meals" className="focus-visible:outline-none">
          <MealHistoryTab kidId={kidId} medical={medical} />
        </TabsContent>

        <TabsContent value="ketones" className="focus-visible:outline-none">
          <KetoneTab kidId={kidId} />
        </TabsContent>

        <TabsContent value="mealplan" className="focus-visible:outline-none">
          <MealPlanTab kidId={kidId} medical={medical} />
        </TabsContent>

        <TabsContent value="compliance" className="focus-visible:outline-none">
          <ComplianceTab kidId={kidId} />
        </TabsContent>

        <TabsContent value="side-effects" className="focus-visible:outline-none">
          <SideEffectsTab kidId={kidId} canWrite={canWrite} />
        </TabsContent>
      </Tabs>

      {isPrinting && (
        <div className="hidden print-section space-y-6">
          {printDateRange && (printDateRange.start || printDateRange.end) && (
            <p className="text-xs text-slate-500 italic">
              Date range: {printDateRange.start || "—"} to {printDateRange.end || "—"}
            </p>
          )}
          {printSections.has("weight") && (
            <>
              <hr className="border-slate-300 my-4" />
              <h2 className="text-lg font-bold text-slate-800">Weight History</h2>
              {(() => {
                const filtered = printDateRange ? recentWeights.filter((w) => {
                  if (printDateRange.start && w.date < printDateRange.start) return false;
                  if (printDateRange.end && w.date > printDateRange.end) return false;
                  return true;
                }) : recentWeights;
                return filtered.length === 0 ? (
                  <p className="text-sm text-slate-400 italic">No weight records.</p>
                ) : (
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr className="bg-slate-100">
                        <th className="text-left py-1.5 px-3 font-semibold text-slate-600">Date</th>
                        <th className="text-right py-1.5 px-3 font-semibold text-slate-600">Weight (kg)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...filtered].reverse().map((w, i) => (
                        <tr key={i} className="border-b border-slate-100">
                          <td className="py-1.5 px-3 text-slate-700">{w.date}</td>
                          <td className="py-1.5 px-3 text-right text-slate-700">{w.weight}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                );
              })()}
            </>
          )}
          {printSections.has("medical") && (
            <>
              <hr className="border-slate-300 my-4" />
              <h2 className="text-lg font-bold text-slate-800">Medical Controls</h2>
              <MedicalSummaryPrint data={medical} />
            </>
          )}
          {printSections.has("meals") && (
            <>
              <hr className="border-slate-300 my-4" />
              <h2 className="text-lg font-bold text-slate-800">Meal History</h2>
              <MealHistoryTab kidId={kidId} medical={medical} />
            </>
          )}
          {printSections.has("ketone") && (
            <>
              <hr className="border-slate-300 my-4" />
              <h2 className="text-lg font-bold text-slate-800">Ketone Readings</h2>
              <KetoneTab kidId={kidId} />
            </>
          )}
          {printSections.has("mealplan") && (
            <>
              <hr className="border-slate-300 my-4" />
              <h2 className="text-lg font-bold text-slate-800">Assigned Meal Plan</h2>
              <MealPlanPrintSection kidId={kidId} medical={medical} />
            </>
          )}
          {printSections.has("compliance") && (
            <>
              <hr className="border-slate-300 my-4" />
              <h2 className="text-lg font-bold text-slate-800">Compliance Calendar</h2>
              <ComplianceTab kidId={kidId} />
            </>
          )}
          <PrintReadySignal kidId={kidId} onReady={onDataReady} />
        </div>
      )}
    </PrintLayout>
  );
}

/**
 * Read-only medical settings summary for print output.
 * Replaces MedicalSettingsForm which uses hidden interactive controls.
 */
function MedicalSummaryPrint({ data }: { data: MedicalSettings }) {
  const rows: { label: string; value: string }[] = [
    { label: "Diet Type", value: data.dietType === "classic" ? `Classic Ketogenic${data.dietSubCategory ? ` (${data.dietSubCategory})` : ""}` : data.dietType === "mad" ? "Modified Atkins" : data.dietType === "mct" ? "MCT Diet" : "Low GI Diet" },
    { label: "Daily Calories", value: `${data.dailyCalories} kcal` },
    { label: "Daily Carbs", value: `${data.dailyCarbs} g` },
    { label: "Daily Fat", value: `${data.dailyFat} g` },
    { label: "Daily Protein", value: `${data.dailyProtein} g` },
    { label: "Show All Foods", value: data.showAllFoods ? "Yes" : "No" },
    { label: "Show All Recipes", value: data.showAllRecipes ? "Yes" : "No" },
  ];
  return (
    <table className="w-full text-sm border-collapse">
      <tbody>
        {rows.map((row) => (
          <tr key={row.label} className="border-b border-slate-100">
            <td className="py-1.5 px-3 font-semibold text-slate-600 w-40">{row.label}</td>
            <td className="py-1.5 px-3 text-slate-800">{row.value}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/**
 * Mounts inside the print-only section. Watches global query fetch count and
 * signals readiness once all in-flight queries have settled.
 */
function PrintReadySignal({ kidId, onReady }: { kidId: number; onReady: (status: "loading" | "ready" | "error", msg?: string) => void }) {
  const { isLoading: kidLoading, isError: kidError } = useGetKid(kidId);
  const { isLoading: mealHistoryLoading, isError: mealHistoryError } = useGetKidMealHistory(kidId);
  const { isLoading: ketoneLoading, isError: ketoneError } = useGetKidKetoneReadings(kidId);
  const { isLoading: assignedPlanLoading, isError: assignedPlanError } = useGetKidAssignedMealPlan(kidId);

  const isLoading = kidLoading || mealHistoryLoading || ketoneLoading || assignedPlanLoading;
  const hasError = kidError || mealHistoryError || ketoneError || assignedPlanError;

  const signaled = useRef(false);

  useEffect(() => {
    if (signaled.current) return;
    if (!isLoading) {
      signaled.current = true;
      if (hasError) {
        onReady("error", "Some report sections could not be loaded. The report may be incomplete.");
      } else {
        onReady("ready");
      }
    }
  }, [isLoading, hasError, onReady]);

  return null;
}

// Sub-components

type KidData = {
  name: string;
  dateOfBirth: string;
  gender?: string;
  parentName: string;
  parentContact: string;
  dietType: string;
  dietSubCategory?: string | null;
};

const CLASSIC_RATIOS = ["2:1", "2.5:1", "3:1", "3.5:1", "4:1"];

const NON_CLASSIC_OPTIONS = [
  { value: "mad", label: "Modified Atkins Diet" },
  { value: "mct", label: "MCT Diet" },
  { value: "lowgi", label: "Low GI Diet" },
];

function getDietCombinedValue(dietType: string, dietSubCategory?: string) {
  if (dietType === "classic") return `classic|${dietSubCategory ?? "4:1"}`;
  return dietType;
}

function parseDietCombinedValue(combined: string): { dietType: string; dietSubCategory?: string } {
  if (combined.startsWith("classic|")) {
    return { dietType: "classic", dietSubCategory: combined.slice(8) };
  }
  return { dietType: combined, dietSubCategory: undefined };
}

function getDietDisplayLabel(dietType: string, dietSubCategory?: string) {
  if (dietType === "classic") return `Classic Ketogenic Diet (${dietSubCategory ?? "4:1"})`;
  const opt = NON_CLASSIC_OPTIONS.find(o => o.value === dietType);
  return opt?.label ?? dietType;
}

const editKidSchema = z.object({
  name: z.string().min(1, "Name is required"),
  dateOfBirth: z.string().min(1, "Date of birth is required"),
  gender: z.enum(["male", "female"]),
  parentName: z.string().min(1, "Parent name is required"),
  parentContact: z.string().min(1, "Contact is required"),
  dietType: z.enum(["classic", "mad", "mct", "lowgi"]),
  dietSubCategory: z.string().optional(),
});

function EditKidDialog({ kidId, kid, open, onOpenChange }: { kidId: number; kid: KidData; open: boolean; onOpenChange: (v: boolean) => void }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const form = useForm<z.infer<typeof editKidSchema>>({
    resolver: zodResolver(editKidSchema),
    defaultValues: {
      name: kid.name,
      dateOfBirth: kid.dateOfBirth,
      gender: (kid.gender ?? "male") as "male" | "female",
      parentName: kid.parentName,
      parentContact: kid.parentContact,
      dietType: (kid.dietType ?? "classic") as "classic" | "mad" | "mct" | "lowgi",
      dietSubCategory: kid.dietSubCategory ?? undefined,
    },
  });

  const watchedDietType = useWatch({ control: form.control, name: "dietType" });
  const watchedDietSubCategory = useWatch({ control: form.control, name: "dietSubCategory" });
  const combinedDietValue = getDietCombinedValue(watchedDietType, watchedDietSubCategory ?? undefined);

  useEffect(() => {
    if (open) {
      form.reset({
        name: kid.name,
        dateOfBirth: kid.dateOfBirth,
        gender: (kid.gender ?? "male") as "male" | "female",
        parentName: kid.parentName,
        parentContact: kid.parentContact,
        dietType: (kid.dietType ?? "classic") as "classic" | "mad" | "mct" | "lowgi",
        dietSubCategory: kid.dietSubCategory ?? undefined,
      });
    }
  }, [open, kid]);

  const mutation = useUpdateKid({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: [`/api/kids/${kidId}`] });
        queryClient.invalidateQueries({ queryKey: ["/api/kids"] });
        onOpenChange(false);
        toast({ title: "Patient updated", description: "Patient information has been saved." });
      },
      onError: () => toast({ title: "Failed to update patient", variant: "destructive" }),
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg rounded-2xl">
        <DialogHeader>
          <DialogTitle>Edit Patient Information</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((d) => mutation.mutate({ kidId, data: d as UpdateKidRequest }))} className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="name" render={({ field }) => (
                <FormItem className="col-span-2">
                  <FormLabel>Full Name</FormLabel>
                  <FormControl><Input className="rounded-xl" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="dateOfBirth" render={({ field }) => (
                <FormItem>
                  <FormLabel>Date of Birth</FormLabel>
                  <FormControl><Input type="date" className="rounded-xl" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="gender" render={({ field }) => (
                <FormItem>
                  <FormLabel>Gender</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="male">Male</SelectItem>
                      <SelectItem value="female">Female</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="dietType" render={() => (
                <FormItem className="col-span-2">
                  <FormLabel>Diet Type</FormLabel>
                  <Select
                    value={combinedDietValue}
                    onValueChange={(v) => {
                      const parsed = parseDietCombinedValue(v);
                      form.setValue("dietType", parsed.dietType as "classic" | "mad" | "mct" | "lowgi");
                      form.setValue("dietSubCategory", parsed.dietSubCategory);
                    }}
                  >
                    <FormControl>
                      <SelectTrigger className="rounded-xl">
                        <SelectValue placeholder="Select diet type">
                          {getDietDisplayLabel(watchedDietType, watchedDietSubCategory ?? undefined)}
                        </SelectValue>
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectGroup>
                        <SelectLabel>Classic Ketogenic Diet</SelectLabel>
                        {CLASSIC_RATIOS.map(r => (
                          <SelectItem key={r} value={`classic|${r}`} className="pl-6">
                            Classic Ketogenic Diet - {r}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                      {NON_CLASSIC_OPTIONS.map(o => (
                        <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="parentName" render={({ field }) => (
                <FormItem>
                  <FormLabel>Parent/Guardian Name</FormLabel>
                  <FormControl><Input className="rounded-xl" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="parentContact" render={({ field }) => (
                <FormItem className="col-span-2">
                  <FormLabel>Parent Contact</FormLabel>
                  <FormControl><Input className="rounded-xl" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="rounded-xl">Cancel</Button>
              <Button type="submit" disabled={mutation.isPending} className="rounded-xl px-8 shadow-md">
                {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Changes
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

const weightSchema = z.object({
  weight: z.coerce.number().positive("Weight must be positive"),
  date: z.string(),
  note: z.string().optional(),
});

function AddWeightDialog({ kidId, lastWeight }: { kidId: number; lastWeight?: number }) {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  const form = useForm<z.infer<typeof weightSchema>>({
    resolver: zodResolver(weightSchema),
    defaultValues: {
      weight: lastWeight,
      date: format(new Date(), 'yyyy-MM-dd'),
      note: ""
    }
  });

  useEffect(() => {
    if (open) {
      form.reset({ weight: lastWeight, date: format(new Date(), 'yyyy-MM-dd'), note: "" });
    }
  }, [open, lastWeight]);

  const mutation = useAddWeightRecord({
    mutation: {
      onSuccess: (data: WeightRecordResponse) => {
        queryClient.invalidateQueries({ queryKey: getGetKidQueryKey(kidId) });
        queryClient.invalidateQueries({ queryKey: getGetKidMedicalQueryKey(kidId) });
        setOpen(false);
        if (data.macrosRecalculated) {
          toast({ title: "Weight Saved", description: "Calories and macros have been auto-recalculated based on the new weight." });
        } else {
          toast({ title: "Success", description: "Weight record added." });
        }
      }
    }
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="rounded-lg bg-primary hover:bg-primary/90 text-white shadow-sm hover-elevate">
          <Plus className="h-4 w-4 mr-1" /> Add Reading
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md rounded-2xl">
        <DialogHeader>
          <DialogTitle>Add Weight Reading</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((d) => mutation.mutate({ kidId, data: d }))} className="space-y-4 pt-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="weight" render={({ field }) => (
                <FormItem>
                  <FormLabel>Weight (kg)</FormLabel>
                  <FormControl>
                    <Input type="number" step="0.1" placeholder="0.0" className="rounded-xl" {...field} />
                  </FormControl>
                  {lastWeight !== undefined && (
                    <p className="text-[11px] text-slate-400 mt-0.5">Last recorded: {lastWeight} kg</p>
                  )}
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="date" render={({ field }) => (
                <FormItem>
                  <FormLabel>Date</FormLabel>
                  <FormControl>
                    <Input type="date" className="rounded-xl" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>
            <FormField control={form.control} name="note" render={({ field }) => (
              <FormItem>
                <FormLabel>Clinical Note (Optional)</FormLabel>
                <FormControl>
                  <Textarea placeholder="Any observations..." className="resize-none rounded-xl" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <div className="flex justify-end pt-4">
              <Button type="submit" disabled={mutation.isPending} className="rounded-xl px-8 shadow-md">
                {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Reading
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function WeightReadingsList({ kidId, weights, canWrite }: { kidId: number; weights: Array<{ id: number; weight: number; date: string; note?: string | null }>; canWrite: boolean }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const deleteWeight = useDeleteWeightRecord();
  const [confirmId, setConfirmId] = useState<number | null>(null);

  async function onDelete(id: number) {
    try {
      await deleteWeight.mutateAsync({ kidId, recordId: id });
      queryClient.invalidateQueries({ queryKey: [`/api/kids/${kidId}`] });
      toast({ title: "Weight record deleted" });
    } catch {
      toast({ title: "Failed to delete", variant: "destructive" });
    } finally {
      setConfirmId(null);
    }
  }

  return (
    <>
      <div className="mt-4 max-h-[200px] overflow-y-auto rounded-xl border border-slate-200">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50/80">
              <TableHead className="text-xs">Date</TableHead>
              <TableHead className="text-xs">Weight</TableHead>
              <TableHead className="text-xs">Note</TableHead>
              {canWrite && <TableHead className="text-xs w-10"></TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {weights.map((w) => (
              <TableRow key={w.id} className="hover:bg-slate-50/50 transition-colors">
                <TableCell className="text-sm text-slate-800">{format(parseISO(w.date), 'MMM d, yyyy')}</TableCell>
                <TableCell className="text-sm font-bold text-slate-900">{w.weight} <span className="text-xs text-slate-400 font-normal">kg</span></TableCell>
                <TableCell className="text-sm text-slate-500">{w.note || "—"}</TableCell>
                {canWrite && (
                  <TableCell>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-destructive" onClick={() => setConfirmId(w.id)} disabled={deleteWeight.isPending}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <AlertDialog open={confirmId !== null} onOpenChange={(open) => { if (!open) setConfirmId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete weight record?</AlertDialogTitle>
            <AlertDialogDescription>This will permanently remove this weight reading. This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => confirmId && onDelete(confirmId)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

const medicalSchema = z.object({
  dietType: z.enum(["classic", "mad", "mct", "lowgi"]),
  dietSubCategory: z.string().optional(),
  dailyCalories: z.coerce.number().min(0).max(3000),
  dailyCarbs: z.coerce.number().min(0),
  dailyFat: z.coerce.number().min(0),
  dailyProtein: z.coerce.number().min(0),
  showAllFoods: z.boolean(),
  showAllRecipes: z.boolean(),
});

type MedicalSettings = {
  dietType: string;
  dietSubCategory?: string | null;
  ketoRatio: number;
  dailyCalories: number;
  dailyCarbs: number;
  dailyFat: number;
  dailyProtein: number;
  showAllFoods: boolean;
  showAllRecipes: boolean;
};

function computeKetoMacros(weightKg: number, ratio: number) {
  let calories: number;
  if (weightKg <= 10) {
    calories = Math.round(110 * weightKg);
  } else if (weightKg <= 20) {
    calories = Math.round(110 * 10 + 70 * (weightKg - 10));
  } else {
    calories = Math.round(110 * 10 + 70 * 10 + 30 * (weightKg - 20));
  }
  const energyPerUnit = ratio * 9 + 4;
  const units = energyPerUnit > 0 ? calories / energyPerUnit : 0;
  const protein = Math.round(weightKg);
  const carbs = Math.max(0, Math.round(units - protein));
  const fat = Math.round(units * ratio);
  return { calories, fat, protein, carbs };
}

function MedicalSettingsForm({ kidId, initialData, lastWeight }: { kidId: number, initialData: MedicalSettings, lastWeight?: number }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const canWrite = useCanWrite();
  
  const form = useForm<z.infer<typeof medicalSchema>>({
    resolver: zodResolver(medicalSchema),
    defaultValues: {
      dietType: (initialData.dietType ?? "classic") as "classic" | "mad" | "mct" | "lowgi",
      dietSubCategory: initialData.dietSubCategory ?? undefined,
      dailyCalories: initialData.dailyCalories,
      dailyCarbs: initialData.dailyCarbs,
      dailyFat: initialData.dailyFat,
      dailyProtein: initialData.dailyProtein,
      showAllFoods: initialData.showAllFoods,
      showAllRecipes: initialData.showAllRecipes,
    }
  });

  const watchedFat     = useWatch({ control: form.control, name: "dailyFat" });
  const watchedProtein = useWatch({ control: form.control, name: "dailyProtein" });
  const watchedCarbs   = useWatch({ control: form.control, name: "dailyCarbs" });
  const watchedMedDietType = useWatch({ control: form.control, name: "dietType" });
  const watchedMedDietSubCategory = useWatch({ control: form.control, name: "dietSubCategory" });
  const combinedMedDietValue = getDietCombinedValue(watchedMedDietType, watchedMedDietSubCategory ?? undefined);

  const isClassicKeto = watchedMedDietType === "classic";

  const fatMax = isClassicKeto ? 200 : 100;
  const carbsMax = isClassicKeto ? 80 : 300;

  const parsedRatio = useMemo(() => {
    if (!isClassicKeto || !watchedMedDietSubCategory) return null;
    const match = watchedMedDietSubCategory.match(/^(\d+(?:\.\d+)?)/);
    if (!match) return null;
    const r = parseFloat(match[1]);
    return isNaN(r) || r <= 0 ? null : r;
  }, [isClassicKeto, watchedMedDietSubCategory]);

  const FALLBACK_WEIGHT = 20;
  const effectiveWeight = (lastWeight !== undefined && lastWeight > 0) ? lastWeight : FALLBACK_WEIGHT;

  const prevDietTypeRef = useRef(watchedMedDietType);
  const prevSubCategoryRef = useRef(watchedMedDietSubCategory);

  useEffect(() => {
    const dietChanged = prevDietTypeRef.current !== watchedMedDietType;
    const subCategoryChanged = prevSubCategoryRef.current !== watchedMedDietSubCategory;
    prevDietTypeRef.current = watchedMedDietType;
    prevSubCategoryRef.current = watchedMedDietSubCategory;

    if (!dietChanged && !subCategoryChanged) return;

    if (isClassicKeto) {
      if (parsedRatio === null) return;
      const { calories, fat, protein, carbs } = computeKetoMacros(effectiveWeight, parsedRatio);
      form.setValue("dailyCalories", Math.min(calories, 2200), { shouldDirty: true });
      form.setValue("dailyFat", Math.min(fat, fatMax), { shouldDirty: true });
      form.setValue("dailyProtein", Math.min(protein, 50), { shouldDirty: true });
      form.setValue("dailyCarbs", Math.min(carbs, carbsMax), { shouldDirty: true });
    } else if (dietChanged) {
      if (watchedMedDietType === "mad") {
        form.setValue("dailyCalories", 1500, { shouldDirty: true });
        form.setValue("dailyFat", 65, { shouldDirty: true });
        form.setValue("dailyProtein", 30, { shouldDirty: true });
        form.setValue("dailyCarbs", 20, { shouldDirty: true });
      } else if (watchedMedDietType === "mct") {
        form.setValue("dailyCalories", 1400, { shouldDirty: true });
        form.setValue("dailyFat", 70, { shouldDirty: true });
        form.setValue("dailyProtein", 25, { shouldDirty: true });
        form.setValue("dailyCarbs", 30, { shouldDirty: true });
      } else if (watchedMedDietType === "lowgi") {
        form.setValue("dailyCalories", 1600, { shouldDirty: true });
        form.setValue("dailyFat", 50, { shouldDirty: true });
        form.setValue("dailyProtein", 30, { shouldDirty: true });
        form.setValue("dailyCarbs", 60, { shouldDirty: true });
      }
    }
  }, [watchedMedDietType, watchedMedDietSubCategory, parsedRatio, effectiveWeight, fatMax, carbsMax]);

  const calculatedRatio = useMemo(() => {
    const f = Number(watchedFat) || 0;
    const p = Number(watchedProtein) || 0;
    const c = Number(watchedCarbs) || 0;
    const denominator = p + c;
    if (denominator === 0) return null;
    return (f / denominator).toFixed(2);
  }, [watchedFat, watchedProtein, watchedCarbs]);

  const mutation = useUpdateKidMedical({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: [`/api/kids/${kidId}`] });
        toast({ title: "Settings Saved", description: "Medical controls updated successfully." });
      }
    }
  });

  return (
    <Card className="rounded-2xl shadow-sm border-slate-200">
      <CardHeader className="border-b border-slate-100 bg-slate-50/50 rounded-t-2xl pb-4">
        <CardTitle className="text-lg">Dietary Prescriptions</CardTitle>
        <CardDescription>Configure macros and app visibility for this patient.</CardDescription>
      </CardHeader>
      <CardContent className="pt-6">
        <Form {...form}>
          <form onSubmit={form.handleSubmit((d) => mutation.mutate({ kidId, data: d as MedicalSettingsRequest }))} className="space-y-8">
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Macros */}
              <div className="space-y-5">
                <h3 className="font-semibold text-slate-900 border-b pb-2">Macros & Targets</h3>
                
                <FormField control={form.control} name="dietType" render={() => (
                  <FormItem>
                    <FormLabel>Diet Type</FormLabel>
                    <Select
                      value={combinedMedDietValue}
                      onValueChange={(v) => {
                        const parsed = parseDietCombinedValue(v);
                        form.setValue("dietType", parsed.dietType as "classic" | "mad" | "mct" | "lowgi", { shouldValidate: true, shouldDirty: true });
                        form.setValue("dietSubCategory", parsed.dietSubCategory, { shouldValidate: true, shouldDirty: true });
                      }}
                    >
                      <FormControl>
                        <SelectTrigger className="rounded-xl">
                          <SelectValue placeholder="Select diet type">
                            {getDietDisplayLabel(watchedMedDietType, watchedMedDietSubCategory ?? undefined)}
                          </SelectValue>
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectGroup>
                          <SelectLabel>Classic Ketogenic Diet</SelectLabel>
                          {CLASSIC_RATIOS.map(r => (
                            <SelectItem key={r} value={`classic|${r}`} className="pl-6">
                              Classic Ketogenic Diet - {r}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                        {NON_CLASSIC_OPTIONS.map(o => (
                          <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />


                {/* Macro Sliders */}
                <div className="space-y-5 pt-2">
                  <FormField control={form.control} name="dailyCalories" render={({ field }) => (
                    <FormItem>
                      <div className="flex items-center justify-between mb-1">
                        <FormLabel className="text-sm font-medium text-slate-700">Daily Calories</FormLabel>
                        <span className="text-sm font-bold text-primary tabular-nums">{Number(field.value) || 0} kcal</span>
                      </div>
                      <FormControl>
                        <Slider
                          min={0} max={2200} step={10}
                          value={[Number(field.value) || 0]}
                          onValueChange={(vals) => field.onChange(vals[0])}
                          className="py-1"
                        />
                      </FormControl>
                      <div className="flex justify-between text-[10px] text-slate-400 mt-0.5">
                        <span>0 kcal</span><span>2200 kcal</span>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )} />

                  <FormField control={form.control} name="dailyFat" render={({ field }) => (
                    <FormItem>
                      <div className="flex items-center justify-between mb-1">
                        <FormLabel className="text-sm font-medium text-slate-700">Daily Fat</FormLabel>
                        <span className="text-sm font-bold text-primary tabular-nums">{Number(field.value) || 0} g</span>
                      </div>
                      <FormControl>
                        <Slider
                          min={0} max={fatMax} step={1}
                          value={[Math.min(Number(field.value) || 0, fatMax)]}
                          onValueChange={(vals) => field.onChange(vals[0])}
                          className="py-1"
                        />
                      </FormControl>
                      <div className="flex justify-between text-[10px] text-slate-400 mt-0.5">
                        <span>0 g</span><span>{fatMax} g</span>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )} />

                  <FormField control={form.control} name="dailyProtein" render={({ field }) => (
                    <FormItem>
                      <div className="flex items-center justify-between mb-1">
                        <FormLabel className="text-sm font-medium text-slate-700">Daily Protein</FormLabel>
                        <span className="text-sm font-bold text-primary tabular-nums">{Number(field.value) || 0} g</span>
                      </div>
                      <FormControl>
                        <Slider
                          min={0} max={50} step={1}
                          value={[Number(field.value) || 0]}
                          onValueChange={(vals) => field.onChange(vals[0])}
                          className="py-1"
                        />
                      </FormControl>
                      <div className="flex justify-between text-[10px] text-slate-400 mt-0.5">
                        <span>0 g</span><span>50 g</span>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )} />

                  <FormField control={form.control} name="dailyCarbs" render={({ field }) => (
                    <FormItem>
                      <div className="flex items-center justify-between mb-1">
                        <FormLabel className="text-sm font-medium text-slate-700">Daily Carbs</FormLabel>
                        <span className="text-sm font-bold text-primary tabular-nums">{Number(field.value) || 0} g</span>
                      </div>
                      <FormControl>
                        <Slider
                          min={0} max={carbsMax} step={1}
                          value={[Math.min(Number(field.value) || 0, carbsMax)]}
                          onValueChange={(vals) => field.onChange(vals[0])}
                          className="py-1"
                        />
                      </FormControl>
                      <div className="flex justify-between text-[10px] text-slate-400 mt-0.5">
                        <span>0 g</span><span>{carbsMax} g</span>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>

                {/* Live Keto Ratio Calculator */}
                <div className="rounded-xl bg-blue-50 border border-blue-100 p-4">
                  <p className="text-xs font-semibold text-blue-700 uppercase tracking-wider mb-1">Calculated Keto Ratio</p>
                  <p className="text-2xl font-black text-blue-900 tabular-nums">
                    {calculatedRatio !== null ? `${calculatedRatio}:1` : "—"}
                  </p>
                  <p className="text-[11px] text-blue-500 mt-0.5">
                    fat ÷ (protein + carbs) based on macros above
                  </p>
                </div>
              </div>

              {/* Visibility */}
              <div className="space-y-5">
                <h3 className="font-semibold text-slate-900 border-b pb-2">Patient App Visibility</h3>
                <p className="text-sm text-slate-500">Control what content the parent can access in their application.</p>
                
                <FormField control={form.control} name="showAllFoods" render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-xl border border-slate-200 p-4 bg-slate-50 shadow-sm">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base font-semibold text-slate-800">Show All Foods</FormLabel>
                      <CardDescription>Allow parent to see foods outside prescribed diet.</CardDescription>
                    </div>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                  </FormItem>
                )} />

                <FormField control={form.control} name="showAllRecipes" render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-xl border border-slate-200 p-4 bg-slate-50 shadow-sm">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base font-semibold text-slate-800">Show All Recipes</FormLabel>
                      <CardDescription>Allow parent to see recipes outside prescribed diet.</CardDescription>
                    </div>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                  </FormItem>
                )} />

                {canWrite && (
                  <div className="flex justify-end pt-4">
                    <Button type="submit" disabled={mutation.isPending} className="rounded-xl px-8 shadow-md">
                      {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Save Medical Controls
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}

const KETONE_LOW = 0.5;
const KETONE_THERAPEUTIC_LOW = 1.5;
const KETONE_THERAPEUTIC_HIGH = 6.0;
const KETONE_HIGH = 8.0;

function getKetoneStatus(value: number): { label: string; color: string; bg: string } {
  if (value < KETONE_LOW) return { label: "Below Range", color: "text-slate-500", bg: "bg-slate-100" };
  if (value < KETONE_THERAPEUTIC_LOW) return { label: "Sub-therapeutic", color: "text-orange-600", bg: "bg-orange-50" };
  if (value <= KETONE_THERAPEUTIC_HIGH) return { label: "Therapeutic", color: "text-emerald-700", bg: "bg-emerald-50" };
  if (value <= KETONE_HIGH) return { label: "High", color: "text-amber-700", bg: "bg-amber-50" };
  return { label: "Dangerously High", color: "text-red-700", bg: "bg-red-50" };
}

const URINE_VALUES = ["-2", "-1.5", "-1", "-0.5", "0", "0.5", "1", "1.5", "2"] as const;

const ketoneFormSchema = z.object({
  value: z.coerce.number(),
  date: z.string().min(1, "Date required"),
  readingType: z.enum(["blood", "urine"]),
  notes: z.string().optional(),
}).refine((data) => {
  if (isNaN(data.value)) return false;
  if (data.readingType === "blood") {
    return data.value >= 0 && data.value <= 30;
  }
  return URINE_VALUES.includes(String(data.value) as typeof URINE_VALUES[number]);
}, {
  message: "Invalid value for the selected reading type",
  path: ["value"],
});

function KetoneTab({ kidId }: { kidId: number }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const canWrite = useCanWrite();
  const { data: readings, isLoading } = useGetKidKetoneReadings(kidId);
  const addReading = useAddKetoneReading();
  const deleteReading = useDeleteKetoneReading();

  const [filterType, setFilterType] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterDateFrom, setFilterDateFrom] = useState<string>("");
  const [filterDateTo, setFilterDateTo] = useState<string>("");

  const hasActiveFilters = filterType !== "all" || filterStatus !== "all" || filterDateFrom !== "" || filterDateTo !== "";

  const filteredReadings = useMemo(() => {
    if (!readings) return readings;
    return readings.filter((r) => {
      if (filterType !== "all" && r.readingType !== filterType) return false;
      if (filterStatus !== "all") {
        const status = getKetoneStatus(r.value);
        if (status.label !== filterStatus) return false;
      }
      if (filterDateFrom) {
        const from = new Date(filterDateFrom);
        const readingDate = parseISO(r.date);
        if (readingDate < from) return false;
      }
      if (filterDateTo) {
        const to = new Date(filterDateTo + "T23:59:59");
        const readingDate = parseISO(r.date);
        if (readingDate > to) return false;
      }
      return true;
    });
  }, [readings, filterType, filterStatus, filterDateFrom, filterDateTo]);

  const clearFilters = () => {
    setFilterType("all");
    setFilterStatus("all");
    setFilterDateFrom("");
    setFilterDateTo("");
  };

  const form = useForm({
    resolver: zodResolver(ketoneFormSchema),
    defaultValues: {
      value: "" as unknown as number,
      date: new Date().toISOString().split("T")[0],
      readingType: "blood" as const,
      notes: "",
    },
  });

  const readingType = form.watch("readingType");

  async function onSubmit(values: z.infer<typeof ketoneFormSchema>) {
    try {
      await addReading.mutateAsync({ kidId, data: { value: values.value, date: values.date, readingType: values.readingType, notes: values.notes || undefined } });
      queryClient.invalidateQueries({ queryKey: [`/api/kids/${kidId}/ketones`] });
      toast({ title: "Ketone reading added" });
      form.reset({ value: "" as unknown as number, date: new Date().toISOString().split("T")[0], readingType: "blood", notes: "" });
    } catch {
      toast({ title: "Failed to add reading", variant: "destructive" });
    }
  }

  async function onDelete(id: number) {
    try {
      await deleteReading.mutateAsync({ kidId, readingId: id });
      queryClient.invalidateQueries({ queryKey: [`/api/kids/${kidId}/ketones`] });
      toast({ title: "Reading deleted" });
    } catch {
      toast({ title: "Failed to delete", variant: "destructive" });
    }
  }

  const chartData = readings ? [...readings].reverse().map(r => ({
    date: format(parseISO(r.date), 'MMM d'),
    value: r.value,
    type: r.readingType,
  })) : [];

  const latest = readings?.[0];

  return (
    <div className="space-y-6">
      {/* Status + Latest Reading */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="rounded-2xl border-slate-200 shadow-sm bg-white">
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-3">
              <div className="h-11 w-11 rounded-xl bg-emerald-50 flex items-center justify-center">
                <Flame className="h-6 w-6 text-emerald-600" />
              </div>
              <div>
                <div className="text-xs text-slate-400 font-medium uppercase tracking-wide">Latest</div>
                {latest ? (
                  <>
                    <div className="text-2xl font-bold text-slate-900">{latest.value} <span className="text-sm font-normal text-slate-500">{latest.unit}</span></div>
                    <div className={`text-xs font-semibold px-2 py-0.5 rounded-full inline-block mt-0.5 ${getKetoneStatus(latest.value).bg} ${getKetoneStatus(latest.value).color}`}>
                      {getKetoneStatus(latest.value).label}
                    </div>
                  </>
                ) : (
                  <div className="text-sm text-slate-400 mt-1">No readings yet</div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-slate-200 shadow-sm bg-white">
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-3">
              <div className="h-11 w-11 rounded-xl bg-blue-50 flex items-center justify-center">
                <FlaskConical className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <div className="text-xs text-slate-400 font-medium uppercase tracking-wide">Therapeutic Range</div>
                <div className="text-xl font-bold text-slate-800">1.5 – 6.0 <span className="text-sm font-normal text-slate-500">mmol/L</span></div>
                <div className="text-xs text-slate-400">Blood ketone target</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-slate-200 shadow-sm bg-white">
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-3">
              <div className="h-11 w-11 rounded-xl bg-amber-50 flex items-center justify-center">
                <AlertTriangle className="h-6 w-6 text-amber-600" />
              </div>
              <div>
                <div className="text-xs text-slate-400 font-medium uppercase tracking-wide">Total Readings</div>
                <div className="text-2xl font-bold text-slate-900">{readings?.length ?? 0}</div>
                {readings && readings.filter(r => r.value > KETONE_HIGH).length > 0 && (
                  <div className="text-xs font-semibold text-red-600">{readings.filter(r => r.value > KETONE_HIGH).length} dangerously high</div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chart */}
        <Card className="lg:col-span-2 rounded-2xl border-slate-200 shadow-sm bg-white">
          <CardHeader className="border-b border-slate-100 pb-3">
            <CardTitle className="text-base">Ketone Trend</CardTitle>
            <CardDescription>Blood/urine ketone readings over time (mmol/L)</CardDescription>
          </CardHeader>
          <CardContent className="pt-4">
            {chartData.length < 2 ? (
              <div className="h-48 flex items-center justify-center text-slate-400 border-2 border-dashed border-slate-200 rounded-xl">
                <p>Add at least 2 readings to see the trend chart.</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="#94a3b8" tickLine={false} />
                  <YAxis tick={{ fontSize: 10 }} stroke="#94a3b8" tickLine={false} domain={[0, 'dataMax + 1']} />
                  <Tooltip
                    contentStyle={{ borderRadius: '10px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontSize: '12px' }}
                    formatter={(val: number) => [`${val} mmol/L`, "Ketones"]}
                  />
                  <ReferenceLine y={KETONE_THERAPEUTIC_LOW} stroke="#f59e0b" strokeDasharray="4 3" label={{ value: 'Min', position: 'right', fontSize: 9 }} />
                  <ReferenceLine y={KETONE_THERAPEUTIC_HIGH} stroke="#ef4444" strokeDasharray="4 3" label={{ value: 'Max', position: 'right', fontSize: 9 }} />
                  <Line type="monotone" dataKey="value" stroke="#10b981" strokeWidth={2.5} dot={{ fill: "#10b981", r: 4 }} activeDot={{ r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Add Reading Form */}
        {canWrite && (
          <Card className="rounded-2xl border-slate-200 shadow-sm bg-white">
          <CardHeader className="border-b border-slate-100 pb-3">
            <CardTitle className="text-base flex items-center gap-2"><Plus className="h-4 w-4" /> Log Reading</CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField control={form.control} name="readingType" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Type</FormLabel>
                    <Select value={field.value} onValueChange={(v) => { field.onChange(v); form.setValue("value", NaN as unknown as number); }}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="blood">Blood</SelectItem>
                        <SelectItem value="urine">Urine</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="value" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Value {readingType === "blood" ? "(mmol/L)" : ""}</FormLabel>
                    {readingType === "urine" ? (
                      <Select value={String(field.value)} onValueChange={(v) => field.onChange(Number(v))}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select value" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {URINE_VALUES.map((v) => (
                            <SelectItem key={v} value={v}>{v}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <FormControl>
                        <Input type="number" step="0.1" placeholder="e.g. 2.5" {...field} />
                      </FormControl>
                    )}
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="date" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="notes" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes <span className="text-slate-400 font-normal">(optional)</span></FormLabel>
                    <FormControl>
                      <Textarea placeholder="e.g. morning reading, fasting" rows={2} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <Button type="submit" className="w-full" disabled={addReading.isPending}>
                  {addReading.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null} Log Reading
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
        )}
      </div>

      {/* Readings Table */}
      <Card className="rounded-2xl border-slate-200 shadow-sm overflow-hidden bg-white">
        <CardHeader className="border-b border-slate-100 bg-slate-50/50 pb-3">
          <CardTitle className="text-base">Reading History</CardTitle>
        </CardHeader>
        <div className="flex flex-wrap items-center gap-2 px-4 py-3 border-b border-slate-100 bg-white">
          <Filter className="h-4 w-4 text-slate-400 shrink-0" />
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="h-8 w-[120px] rounded-full text-xs border-slate-200 bg-slate-50 hover:bg-slate-100">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="blood">Blood</SelectItem>
              <SelectItem value="urine">Urine</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="h-8 w-[160px] rounded-full text-xs border-slate-200 bg-slate-50 hover:bg-slate-100">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="Below Range">Below Range</SelectItem>
              <SelectItem value="Sub-therapeutic">Sub-therapeutic</SelectItem>
              <SelectItem value="Therapeutic">Therapeutic</SelectItem>
              <SelectItem value="High">High</SelectItem>
              <SelectItem value="Dangerously High">Dangerously High</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex items-center gap-1.5">
            <Input
              type="date"
              value={filterDateFrom}
              onChange={(e) => setFilterDateFrom(e.target.value)}
              className="h-8 w-[130px] rounded-full text-xs border-slate-200 bg-slate-50"
              placeholder="From"
            />
            <span className="text-xs text-slate-400">to</span>
            <Input
              type="date"
              value={filterDateTo}
              onChange={(e) => setFilterDateTo(e.target.value)}
              className="h-8 w-[130px] rounded-full text-xs border-slate-200 bg-slate-50"
              placeholder="To"
            />
          </div>
          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters} className="h-8 rounded-full text-xs text-slate-500 hover:text-slate-700 px-3">
              <X className="h-3 w-3 mr-1" /> Clear
            </Button>
          )}
        </div>
        {isLoading ? (
          <div className="p-8 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" /></div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-slate-50 border-b border-slate-200">
                <TableRow>
                  <TableHead className="font-semibold text-slate-600">Date</TableHead>
                  <TableHead className="font-semibold text-slate-600">Value</TableHead>
                  <TableHead className="font-semibold text-slate-600">Type</TableHead>
                  <TableHead className="font-semibold text-slate-600">Status</TableHead>
                  <TableHead className="font-semibold text-slate-600">Notes</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {!filteredReadings || filteredReadings.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-slate-500">
                      {hasActiveFilters ? "No readings match the current filters." : "No ketone readings recorded."}
                    </TableCell>
                  </TableRow>
                ) : filteredReadings.map((r) => {
                  const status = getKetoneStatus(r.value);
                  return (
                    <TableRow key={r.id} className="hover:bg-slate-50/50 transition-colors">
                      <TableCell className="font-medium text-slate-800">{format(parseISO(r.date), 'MMM d, yyyy')}</TableCell>
                      <TableCell className="font-bold text-slate-900">{r.value} <span className="text-xs text-slate-400 font-normal">{r.unit}</span></TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize text-slate-600">{r.readingType}</Badge>
                      </TableCell>
                      <TableCell>
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${status.bg} ${status.color}`}>{status.label}</span>
                      </TableCell>
                      <TableCell className="text-sm text-slate-500">{r.notes || "—"}</TableCell>
                      <TableCell>
                        {canWrite && (
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-destructive" onClick={() => onDelete(r.id)} disabled={deleteReading.isPending}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>
    </div>
  );
}

type MedicalData = {
  dailyCalories?: number;
  dailyCarbs?: number;
  dailyFat?: number;
  dailyProtein?: number;
};

const KNOWN_MEAL_LABELS: Record<string, { icon: string }> = {
  breakfast: { icon: "🌅" },
  lunch: { icon: "☀️" },
  dinner: { icon: "🌙" },
};

function getMealLabel(name: string) {
  return KNOWN_MEAL_LABELS[name.toLowerCase()] ?? { icon: "🍽️" };
}

function MealPhotoUpload({ kidId, log }: { kidId: number; log: { id: number; imageUrl?: string | null } }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const updateImage = useUpdateMealLogImage();
  const { uploadFile, isUploading } = useUpload({
    onSuccess: async (response) => {
      await updateImage.mutateAsync({ kidId, logId: log.id, data: { imageUrl: response.objectPath } });
      queryClient.invalidateQueries({ queryKey: [`/api/kids/${kidId}/meal-logs`] });
      toast({ title: "Photo attached" });
    },
    onError: () => {
      toast({ title: "Upload failed", variant: "destructive" });
    },
  });

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) uploadFile(file);
    e.target.value = "";
  }

  async function handleRemove() {
    await updateImage.mutateAsync({ kidId, logId: log.id, data: { imageUrl: null } });
    queryClient.invalidateQueries({ queryKey: [`/api/kids/${kidId}/meal-logs`] });
    toast({ title: "Photo removed" });
  }

  const isBusy = isUploading || updateImage.isPending;

  return (
    <div className="flex items-center gap-2 mt-1">
      {log.imageUrl ? (
        <>
          <a href={`/api/storage${log.imageUrl}`} target="_blank" rel="noopener noreferrer">
            <img
              src={`/api/storage${log.imageUrl}`}
              alt="meal photo"
              className="h-10 w-10 object-cover rounded-lg border border-slate-200 cursor-pointer hover:opacity-80 transition-opacity"
            />
          </a>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-slate-400 hover:text-destructive"
            disabled={isBusy}
            onClick={handleRemove}
          >
            <X className="h-3 w-3" />
          </Button>
        </>
      ) : null}
      <Button
        variant="ghost"
        size="sm"
        className="h-7 text-xs text-slate-400 hover:text-primary gap-1 px-2"
        disabled={isBusy}
        onClick={() => fileRef.current?.click()}
      >
        {isBusy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Camera className="h-3 w-3" />}
        {log.imageUrl ? "Change" : "Add Photo"}
      </Button>
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
    </div>
  );
}

function MealDayDetailDialog({ kidId, date, onClose }: { kidId: number; date: string; onClose: () => void }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const canWrite = useCanWrite();
  const { data: logs, isLoading } = useGetKidMealLogs(kidId, { date });
  const { data: mealTypesData } = useListMealTypes();
  const mealTypeNames = useMemo(() => (mealTypesData ?? []).map((mt) => mt.name), [mealTypesData]);
  const addLog = useAddMealLog();
  const deleteLog = useDeleteMealLog();
  const [mealType, setMealType] = useState("");
  const [isCompleted, setIsCompleted] = useState(true);
  const [calories, setCalories] = useState("");
  const [carbs, setCarbs] = useState("");
  const [fat, setFat] = useState("");
  const [protein, setProtein] = useState("");
  const [notes, setNotes] = useState("");

  async function handleAdd() {
    try {
      await addLog.mutateAsync({ kidId, data: {
        date,
        mealType,
        isCompleted,
        calories: calories ? parseFloat(calories) : undefined,
        carbs: carbs ? parseFloat(carbs) : undefined,
        fat: fat ? parseFloat(fat) : undefined,
        protein: protein ? parseFloat(protein) : undefined,
        notes: notes || undefined,
      }});
      queryClient.invalidateQueries({ queryKey: [`/api/kids/${kidId}/meal-logs`] });
      toast({ title: "Meal logged" });
      setCalories(""); setCarbs(""); setFat(""); setProtein(""); setNotes("");
    } catch {
      toast({ title: "Failed to add", variant: "destructive" });
    }
  }

  async function handleDelete(logId: number) {
    try {
      await deleteLog.mutateAsync({ kidId, logId });
      queryClient.invalidateQueries({ queryKey: [`/api/kids/${kidId}/meal-logs`] });
      toast({ title: "Meal log deleted" });
    } catch {
      toast({ title: "Failed to delete", variant: "destructive" });
    }
  }

  const displayDate = date ? format(parseISO(date), 'EEEE, MMM d, yyyy') : "";

  return (
    <Dialog open={true} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" /> Meal Breakdown — {displayDate}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {/* Existing logs */}
          {isLoading ? (
            <div className="py-4 text-center"><Loader2 className="h-5 w-5 animate-spin mx-auto text-primary" /></div>
          ) : (
            <div className="space-y-2">
              {mealTypeNames.map((typeName) => {
                const entry = logs?.find(l => l.mealType.toLowerCase() === typeName.toLowerCase());
                const meta = getMealLabel(typeName);
                return (
                  <div key={typeName} className={`p-3 rounded-xl border ${entry ? (entry.isCompleted ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50') : 'border-slate-200 bg-slate-50'}`}>
                    <div className="flex items-center gap-3">
                      <span className="text-xl">{meta.icon}</span>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm text-slate-800">{typeName}</span>
                          {entry ? (
                            <Badge className={`text-xs ${entry.isCompleted ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                              {entry.isCompleted ? '✓ Completed' : '✗ Missed'}
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-xs text-slate-400">Not logged</Badge>
                          )}
                        </div>
                        {entry && (entry.calories || entry.carbs || entry.fat || entry.protein) ? (
                          <div className="text-xs text-slate-500 mt-0.5">
                            {entry.calories ? `${Math.round(entry.calories)} kcal` : ''}
                            {entry.fat ? ` · F: ${Math.round(entry.fat)}g` : ''}
                            {entry.protein ? ` · P: ${Math.round(entry.protein)}g` : ''}
                            {entry.carbs ? ` · C: ${Math.round(entry.carbs)}g` : ''}
                          </div>
                        ) : null}
                        {entry?.notes && <div className="text-xs text-slate-400 mt-0.5 italic">{entry.notes}</div>}
                      </div>
                      {entry && canWrite && (
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-destructive" onClick={() => handleDelete(entry.id)} disabled={deleteLog.isPending}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                    {entry && <MealPhotoUpload kidId={kidId} log={entry} />}
                  </div>
                );
              })}
            </div>
          )}

          {/* Add meal log form */}
          {canWrite && <div className="border-t border-slate-200 pt-4">
            <p className="text-sm font-semibold text-slate-700 mb-3">Log a Meal</p>
            <div className="grid grid-cols-2 gap-2 mb-3">
              <div>
                <label className="text-xs font-medium text-slate-600 mb-1 block">Meal Type</label>
                <Select value={mealType || undefined} onValueChange={(v) => setMealType(v)}>
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue placeholder="Select…" />
                  </SelectTrigger>
                  <SelectContent>
                    {mealTypeNames.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600 mb-1 block">Status</label>
                <Select value={isCompleted ? "completed" : "missed"} onValueChange={(v) => setIsCompleted(v === "completed")}>
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="missed">Missed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-4 gap-2 mb-3">
              <div>
                <label className="text-xs font-medium text-slate-600 mb-1 block">Cal</label>
                <Input type="number" placeholder="0" value={calories} onChange={e => setCalories(e.target.value)} className="h-9 text-sm" />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600 mb-1 block">Fat (g)</label>
                <Input type="number" placeholder="0" value={fat} onChange={e => setFat(e.target.value)} className="h-9 text-sm" />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600 mb-1 block">Protein (g)</label>
                <Input type="number" placeholder="0" value={protein} onChange={e => setProtein(e.target.value)} className="h-9 text-sm" />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600 mb-1 block">Carbs (g)</label>
                <Input type="number" placeholder="0" value={carbs} onChange={e => setCarbs(e.target.value)} className="h-9 text-sm" />
              </div>
            </div>
            <Input placeholder="Notes (optional)" value={notes} onChange={e => setNotes(e.target.value)} className="mb-3 h-9 text-sm" />
            <Button onClick={handleAdd} className="w-full" size="sm" disabled={addLog.isPending}>
              {addLog.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null} Save Meal Log
            </Button>
          </div>}
        </div>
      </DialogContent>
    </Dialog>
  );
}

const KNOWN_SLOT_STYLES: Record<string, { icon: string; color: string }> = {
  breakfast: { icon: "🌅", color: "text-amber-700 bg-amber-50 border-amber-200" },
  lunch: { icon: "☀️", color: "text-blue-700 bg-blue-50 border-blue-200" },
  dinner: { icon: "🌙", color: "text-violet-700 bg-violet-50 border-violet-200" },
};
const DEFAULT_SLOT_STYLE = { icon: "🍽️", color: "text-slate-700 bg-slate-50 border-slate-200" };

function getSlotStyle(name: string) {
  return KNOWN_SLOT_STYLES[name.toLowerCase()] ?? DEFAULT_SLOT_STYLE;
}

function MealDayAccordion({ kidId, date, onManage }: { kidId: number; date: string; onManage: () => void }) {
  const { data, isLoading } = useGetKidMealLog(kidId, { date });
  const { data: mealLogs } = useGetKidMealLogs(kidId, { date });
  const { data: mealTypesData } = useListMealTypes();
  const mealTypeNames = useMemo(() => (mealTypesData ?? []).map((mt) => mt.name), [mealTypesData]);

  if (isLoading) {
    return (
      <div className="px-4 pb-4 pt-2">
        <div className="flex items-center justify-center py-6 text-slate-400">
          <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading food entries...
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 pb-4 pt-1 bg-slate-50/60 border-t border-slate-100">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
        {mealTypeNames.map((typeName) => {
          const { icon, color } = getSlotStyle(typeName);
          const foods = data?.meals?.[typeName.toLowerCase()] ?? data?.meals?.[typeName] ?? [];
          const slotCalories = foods.reduce((s: number, f: any) => s + (f.calories ?? 0), 0);
          const logEntry = mealLogs?.find(l => l.mealType.toLowerCase() === typeName.toLowerCase());
          const imageUrl = logEntry?.imageUrl;
          return (
            <div key={typeName} className={`rounded-xl border p-3 ${color}`}>
              <div className="flex items-center justify-between mb-2">
                <span className="font-semibold text-sm flex items-center gap-1.5">
                  <span>{icon}</span> {typeName}
                </span>
                <div className="flex items-center gap-2">
                  {imageUrl && (
                    <a href={`/api/storage${imageUrl}`} target="_blank" rel="noopener noreferrer" title="View meal photo">
                      <img
                        src={`/api/storage${imageUrl}`}
                        alt="meal photo"
                        className="h-8 w-8 object-cover rounded-lg border border-white/50 hover:opacity-80 transition-opacity cursor-pointer shadow-sm"
                      />
                    </a>
                  )}
                  {foods.length > 0 && (
                    <span className="text-xs font-mono opacity-75">{Math.round(slotCalories)} kcal</span>
                  )}
                </div>
              </div>
              {foods.length === 0 ? (
                <p className="text-xs opacity-60 italic">Not logged</p>
              ) : (
                <ul className="space-y-1.5">
                  {foods.map((food) => (
                    <li key={food.id} className="text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{food.foodName}</span>
                        <span className="opacity-70 ml-2 shrink-0">{food.quantity}{food.unit}</span>
                      </div>
                      <div className="opacity-60 font-mono mt-0.5">
                        {Math.round(food.calories ?? 0)} kcal · F {Math.round(food.fat ?? 0)}g · P {Math.round(food.protein ?? 0)}g · C {Math.round(food.carbs ?? 0)}g
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>
      <div className="mt-3 flex justify-end">
        <Button variant="ghost" size="sm" className="text-xs text-slate-500 hover:text-primary h-7 px-2" onClick={onManage}>
          Manage Completion Records
        </Button>
      </div>
    </div>
  );
}

const MEAL_LOG_PAGE_SIZE = 10;

function MealHistoryTab({ kidId, medical }: { kidId: number; medical: MedicalData }) {
  const { data: rawHistory, isLoading } = useGetKidMealHistory(kidId);
  const [chartView, setChartView] = useState<"7d" | "30d">("7d");
  const [expandedDate, setExpandedDate] = useState<string | null>(null);
  const [detailDate, setDetailDate] = useState<string | null>(null);
  const [logPage, setLogPage] = useState(1);

  // Reset to page 1 whenever the patient changes
  useEffect(() => {
    setLogPage(1);
    setExpandedDate(null);
  }, [kidId]);

  if (isLoading) return <div className="p-8 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" /></div>;

  // History from API is newest-first; reverse for chronological chart display
  const chronological = rawHistory ? [...rawHistory].reverse() : [];
  const chartData = chartView === "7d" ? chronological.slice(-7) : chronological.slice(-30);

  const chartDataFormatted = chartData.map(d => ({
    date: format(parseISO(d.date), 'MMM d'),
    calories: Math.round(d.totalCalories ?? 0),
    carbs: Math.round(d.totalCarbs ?? 0),
    fat: Math.round(d.totalFat ?? 0),
    protein: Math.round(d.totalProtein ?? 0),
  }));

  const targets = {
    calories: medical?.dailyCalories ?? 0,
    carbs: medical?.dailyCarbs ?? 0,
    fat: medical?.dailyFat ?? 0,
    protein: medical?.dailyProtein ?? 0,
  };

  const macroCharts = [
    { key: "calories" as const, label: "Calories", unit: "kcal", color: "#6366f1", target: targets.calories },
    { key: "carbs" as const, label: "Carbs", unit: "g", color: "#f59e0b", target: targets.carbs },
    { key: "fat" as const, label: "Fat", unit: "g", color: "#0ea5e9", target: targets.fat },
    { key: "protein" as const, label: "Protein", unit: "g", color: "#10b981", target: targets.protein },
  ];

  const totalLogPages = rawHistory ? Math.max(1, Math.ceil(rawHistory.length / MEAL_LOG_PAGE_SIZE)) : 1;
  // Clamp current page to valid range in case history length changed
  const safePage = Math.min(logPage, totalLogPages);
  const pagedHistory = rawHistory
    ? rawHistory.slice((safePage - 1) * MEAL_LOG_PAGE_SIZE, safePage * MEAL_LOG_PAGE_SIZE)
    : [];

  function toggleDay(date: string) {
    setExpandedDate(prev => prev === date ? null : date);
  }

  return (
    <div className="space-y-6">
      {/* Meal History Accordion List */}
      <Card className="rounded-2xl shadow-sm border-slate-200 overflow-hidden bg-white">
        <CardHeader className="border-b border-slate-100 bg-slate-50/50 pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-slate-500" /> Daily Meal Log
          </CardTitle>
          <CardDescription className="text-xs">Click any day to expand per-meal food breakdown</CardDescription>
        </CardHeader>
        <div className="divide-y divide-slate-100">
          {!rawHistory || rawHistory.length === 0 ? (
            <div className="py-10 text-center text-slate-500 text-sm">No meal history recorded.</div>
          ) : pagedHistory.map((day) => {
            const isExpanded = expandedDate === day.date;
            return (
              <div key={day.date} className="bg-white hover:bg-slate-50/40 transition-colors">
                {/* Row header */}
                <button
                  className="w-full text-left px-4 py-3 flex items-center gap-3 focus:outline-none"
                  onClick={() => toggleDay(day.date)}
                  aria-expanded={isExpanded}
                >
                  <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-2 items-center text-sm">
                    <div>
                      <div className="font-semibold text-slate-800">{format(parseISO(day.date), 'EEE, MMM d')}</div>
                      <div className="text-xs text-slate-400">{format(parseISO(day.date), 'yyyy')}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${day.completionRate < 0.5 ? 'bg-destructive' : day.completionRate < 0.8 ? 'bg-orange-500' : 'bg-green-500'}`}
                          style={{ width: `${Math.round(day.completionRate * 100)}%` }}
                        />
                      </div>
                      <span className="font-medium text-slate-700">{Math.round(day.completionRate * 100)}%</span>
                    </div>
                    <div className="text-slate-600 hidden md:block">
                      <span className="text-green-600 font-semibold">{day.completedMeals}</span>/{day.totalMeals} meals
                      {day.missedMeals > 0 && <span className="text-destructive ml-1 text-xs">({day.missedMeals} missed)</span>}
                    </div>
                    <div className="text-slate-500 hidden md:block text-xs font-mono">
                      {Math.round(day.totalCalories ?? 0)} kcal · F{Math.round(day.totalFat ?? 0)} P{Math.round(day.totalProtein ?? 0)} C{Math.round(day.totalCarbs ?? 0)}
                    </div>
                  </div>
                  <div className="shrink-0 text-slate-400">
                    {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </div>
                </button>

                {/* Accordion detail */}
                {isExpanded && (
                  <MealDayAccordion
                    kidId={kidId}
                    date={day.date}
                    onManage={() => setDetailDate(day.date)}
                  />
                )}
              </div>
            );
          })}
        </div>
        {totalLogPages > 1 && (
          <div className="flex items-center justify-center gap-2 py-3 border-t border-slate-100 bg-slate-50/50">
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-xs"
              disabled={safePage === 1}
              onClick={() => { setLogPage(p => Math.max(1, p - 1)); setExpandedDate(null); }}
            >
              <ChevronLeft className="h-3.5 w-3.5 mr-1" /> Previous
            </Button>
            {Array.from({ length: totalLogPages }, (_, i) => i + 1).map(page => (
              <Button
                key={page}
                size="sm"
                variant={page === safePage ? "default" : "ghost"}
                className="h-7 w-7 p-0 text-xs"
                onClick={() => { setLogPage(page); setExpandedDate(null); }}
              >
                {page}
              </Button>
            ))}
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-xs"
              disabled={safePage === totalLogPages}
              onClick={() => { setLogPage(p => Math.min(totalLogPages, p + 1)); setExpandedDate(null); }}
            >
              Next <ChevronRight className="h-3.5 w-3.5 ml-1" />
            </Button>
          </div>
        )}
      </Card>

      {/* Nutrition Charts Section */}
      <Card className="rounded-2xl shadow-sm border-slate-200 bg-white">
        <CardHeader className="flex flex-row items-center justify-between pb-2 border-b border-slate-100">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <BarChart2 className="h-5 w-5 text-primary" /> Nutrition Trends
            </CardTitle>
            <CardDescription>Daily intake vs. prescribed targets (dashed line)</CardDescription>
          </div>
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
            <Button
              size="sm"
              variant={chartView === "7d" ? "default" : "ghost"}
              onClick={() => setChartView("7d")}
              className="h-7 px-3 rounded-md text-xs"
            >7 Days</Button>
            <Button
              size="sm"
              variant={chartView === "30d" ? "default" : "ghost"}
              onClick={() => setChartView("30d")}
              className="h-7 px-3 rounded-md text-xs"
            >30 Days</Button>
          </div>
        </CardHeader>
        <CardContent className="pt-4">
          {chartDataFormatted.length < 2 ? (
            <div className="h-40 flex items-center justify-center text-slate-400 border-2 border-dashed border-slate-200 rounded-xl">
              <p>Not enough data to display charts.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {macroCharts.map(({ key, label, unit, color, target }) => (
                <div key={key}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-semibold text-slate-700">{label}</span>
                    <span className="text-xs text-slate-400">Target: <span className="font-semibold text-slate-600">{target}{unit}</span></span>
                  </div>
                  <ResponsiveContainer width="100%" height={140}>
                    <BarChart data={chartDataFormatted} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                      <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="#94a3b8" tickLine={false} />
                      <YAxis tick={{ fontSize: 10 }} stroke="#94a3b8" tickLine={false} />
                      <Tooltip
                        contentStyle={{ borderRadius: '10px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontSize: '12px' }}
                        formatter={(val: number) => [`${val}${unit}`, label]}
                      />
                      <Bar dataKey={key} fill={color} radius={[3, 3, 0, 0]} fillOpacity={0.85} />
                      {target > 0 && (
                        <ReferenceLine y={target} stroke={color} strokeDasharray="4 3" strokeWidth={1.5} />
                      )}
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {detailDate && <MealDayDetailDialog kidId={kidId} date={detailDate} onClose={() => setDetailDate(null)} />}
    </div>
  );
}

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function getComplianceColor(rate: number | undefined): string {
  if (rate === undefined) return "bg-slate-100";
  if (rate === 0) return "bg-red-400";
  if (rate < 1) return "bg-amber-400";
  return "bg-green-500";
}

function ComplianceCalendarMonth({
  month,
  completionMap,
  kidId,
}: {
  month: Date;
  completionMap: Map<string, MealDay>;
  kidId: number;
}) {
  const [hovered, setHovered] = useState<{ day: MealDay; x: number; y: number } | null>(null);
  const [analyticsDate, setAnalyticsDate] = useState<string | null>(null);
  const firstDay = startOfMonth(month);
  const lastDay = endOfMonth(month);
  const days = eachDayOfInterval({ start: firstDay, end: lastDay });

  const startDow = getDay(firstDay);
  const leadingBlanks = startDow === 0 ? 6 : startDow - 1;

  return (
    <div>
      <p className="text-sm font-bold text-slate-700 mb-3 text-center">
        {format(month, "MMMM yyyy")}
      </p>
      <div className="grid grid-cols-7 gap-1 text-center mb-1">
        {DAY_LABELS.map((d) => (
          <span key={d} className="text-[10px] font-semibold text-slate-400">{d}</span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: leadingBlanks }).map((_, i) => (
          <div key={`blank-${i}`} />
        ))}
        {days.map((day) => {
          const dateKey = format(day, "yyyy-MM-dd");
          const mealDay = completionMap.get(dateKey);
          const rate = mealDay?.completionRate;
          const color = getComplianceColor(rate);
          return (
            <div
              key={dateKey}
              role="button"
              tabIndex={0}
              aria-label={`${format(day, "EEEE, MMM d")} — ${rate !== undefined ? `${Math.round(rate * 100)}% compliance` : "no data"}`}
              className={`aspect-square rounded-sm ${color} cursor-pointer transition-opacity hover:opacity-80 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1`}
              onClick={() => setAnalyticsDate(dateKey)}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setAnalyticsDate(dateKey); } }}
              onMouseEnter={(e) => {
                const dayData: MealDay = mealDay ?? {
                  date: dateKey,
                  completionRate: 0,
                  totalMeals: 0,
                  completedMeals: 0,
                  missedMeals: 0,
                  isFilled: false,
                };
                setHovered({ day: dayData, x: e.clientX, y: e.clientY });
              }}
              onMouseMove={(e) => {
                if (hovered) setHovered((prev) => prev ? { ...prev, x: e.clientX, y: e.clientY } : null);
              }}
              onMouseLeave={() => setHovered(null)}
            />
          );
        })}
      </div>
      {hovered && <DayHoverPopup day={hovered.day} x={hovered.x} y={hovered.y} />}
      {analyticsDate && (
        <DayAnalyticsDialog kidId={kidId} date={analyticsDate} onClose={() => setAnalyticsDate(null)} />
      )}
    </div>
  );
}

function ComplianceTab({ kidId }: { kidId: number }) {
  const { data: rawHistory, isLoading } = useGetKidMealHistory(kidId);

  const completionMap = useMemo(() => {
    const map = new Map<string, MealDay>();
    rawHistory?.forEach((d) => map.set(d.date, d));
    return map;
  }, [rawHistory]);

  const today = new Date();
  const months = [subMonths(today, 1), today];

  const totalDays = rawHistory?.length ?? 0;
  const fullDays = rawHistory?.filter((d) => d.completionRate === 1).length ?? 0;
  const partialDays = rawHistory?.filter((d) => d.completionRate > 0 && d.completionRate < 1).length ?? 0;
  const missedDays = rawHistory?.filter((d) => d.completionRate === 0).length ?? 0;

  if (isLoading) {
    return (
      <div className="p-8 text-center">
        <Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Days Tracked", value: totalDays, color: "text-slate-800",  bg: "bg-slate-50" },
          { label: "Full Compliance", value: fullDays, color: "text-green-700", bg: "bg-green-50" },
          { label: "Partial Days",  value: partialDays, color: "text-amber-700", bg: "bg-amber-50" },
          { label: "Missed Days",   value: missedDays, color: "text-red-700",   bg: "bg-red-50"   },
        ].map((s) => (
          <div key={s.label} className={`rounded-2xl border border-slate-200 shadow-sm p-4 ${s.bg}`}>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">{s.label}</p>
            <p className={`text-3xl font-black ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Legend */}
      <Card className="rounded-2xl shadow-sm border-slate-200 bg-white">
        <CardHeader className="border-b border-slate-100 pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <LayoutGrid className="h-4 w-4 text-primary" /> Compliance Heatmap
          </CardTitle>
          <CardDescription>Daily meal completion over the last 2 months. Hover a cell for details.</CardDescription>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="flex items-center gap-4 mb-5 text-xs text-slate-600">
            {[
              { label: "No data",  color: "bg-slate-100" },
              { label: "Missed",   color: "bg-red-400"   },
              { label: "Partial",  color: "bg-amber-400" },
              { label: "Full",     color: "bg-green-500" },
            ].map((l) => (
              <span key={l.label} className="flex items-center gap-1.5">
                <span className={`w-3 h-3 rounded-sm ${l.color}`} />
                {l.label}
              </span>
            ))}
          </div>

          {totalDays === 0 && (
            <p className="text-xs text-slate-400 mb-4 italic">No meal data recorded yet. Days appear grey until logs are submitted.</p>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {months.map((month) => (
              <ComplianceCalendarMonth
                key={format(month, "yyyy-MM")}
                month={month}
                completionMap={completionMap}
                kidId={kidId}
              />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Meal Plan Tab ─────────────────────────────────────────────────────────────

const KNOWN_PLAN_STYLES: Record<string, { icon: typeof Coffee; color: string }> = {
  breakfast: { icon: Coffee, color: "text-amber-600 bg-amber-50 border-amber-100" },
  lunch: { icon: Sun, color: "text-blue-600 bg-blue-50 border-blue-100" },
  snack: { icon: UtensilsCrossed, color: "text-green-600 bg-green-50 border-green-100" },
  dinner: { icon: Moon, color: "text-indigo-600 bg-indigo-50 border-indigo-100" },
};
const DEFAULT_PLAN_STYLE = { icon: UtensilsCrossed, color: "text-slate-600 bg-slate-50 border-slate-100" };

function getPlanStyle(name: string) {
  return KNOWN_PLAN_STYLES[name.toLowerCase()] ?? DEFAULT_PLAN_STYLE;
}

function MealPlanTab({ kidId, medical }: { kidId: number; medical: MedicalSettings }) {
  const mealTypeNames = useMemo(() => getMealTypesForDiet(medical.dietType), [medical.dietType]);
  const [expandedMeal, setExpandedMeal] = useState<string | null>(null);

  const { data: rawAssigned, isLoading: assignedLoading } = useGetKidAssignedMealPlan(kidId);
  const { data: mealHistory } = useGetKidMealHistory(kidId);

  const plan: LibraryMealPlanDetail | undefined =
    rawAssigned && typeof rawAssigned === "object" ? rawAssigned : undefined;

  const todayStr = format(new Date(), "yyyy-MM-dd");
  const todayRecord = mealHistory?.find((d) => d.date === todayStr) ?? null;

  const getMealItems = (mealType: string): LibraryMealPlanItem[] =>
    plan?.items?.filter((i: LibraryMealPlanItem) => i.mealType.toLowerCase() === mealType.toLowerCase()) ?? [];

  // Planned daily macro totals from the assigned plan items
  const plannedTotals = (plan?.items ?? []).reduce(
    (acc, item: LibraryMealPlanItem) => ({
      calories: acc.calories + (item.calories ?? 0),
      carbs: acc.carbs + (item.carbs ?? 0),
      fat: acc.fat + (item.fat ?? 0),
      protein: acc.protein + (item.protein ?? 0),
    }),
    { calories: 0, carbs: 0, fat: 0, protein: 0 }
  );

  // Today's actual macro totals from meal history
  const actualTotals = todayRecord
    ? {
        calories: todayRecord.totalCalories ?? 0,
        carbs: todayRecord.totalCarbs ?? 0,
        fat: todayRecord.totalFat ?? 0,
        protein: todayRecord.totalProtein ?? 0,
      }
    : null;

  return (
    <div className="space-y-4">
      {/* Daily Macro Target KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {([
          { label: "Daily Calories", value: Math.round(medical.dailyCalories), unit: "kcal", icon: Flame, color: "text-orange-600", bg: "bg-orange-50", border: "border-orange-100" },
          { label: "Daily Fat", value: medical.dailyFat, unit: "g", icon: Zap, color: "text-blue-600", bg: "bg-blue-50", border: "border-blue-100" },
          { label: "Daily Protein", value: medical.dailyProtein, unit: "g", icon: TrendingUp, color: "text-green-600", bg: "bg-green-50", border: "border-green-100" },
          { label: "Daily Carbs", value: medical.dailyCarbs, unit: "g", icon: Activity, color: "text-yellow-600", bg: "bg-yellow-50", border: "border-yellow-100" },
        ] as const).map(({ label, value, unit, icon: KpiIcon, color, bg, border }) => (
          <Card key={label} className={`rounded-xl ${border} shadow-sm`}>
            <CardContent className="py-3 px-4 flex items-center gap-3">
              <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${bg} ${color} shrink-0`}>
                <KpiIcon className="h-4 w-4" />
              </div>
              <div>
                <p className="text-xs text-slate-500 font-medium">{label}</p>
                <p className={`text-lg font-bold ${color}`}>
                  {typeof value === "number" && value % 1 !== 0 ? value.toFixed(1) : value}
                  <span className="text-xs font-normal text-slate-400 ml-1">{unit}</span>
                </p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Plan detail */}
      {assignedLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : (
        <>
          {plan && (
            <Card className="rounded-2xl border-slate-200 shadow-sm">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">{plan.name}</CardTitle>
                </div>
                {plan.description && (
                  <CardDescription>{plan.description}</CardDescription>
                )}
              </CardHeader>

              {/* Planned vs Actual macro comparison */}
              <CardContent className="pt-0">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
                  Today's Compliance — {format(new Date(), "MMM d, yyyy")}
                </p>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-xs text-slate-500 border-b border-slate-100">
                        <th className="text-left pb-2 font-medium">Macro</th>
                        <th className="text-right pb-2 font-medium">Planned</th>
                        <th className="text-right pb-2 font-medium">Actual (today)</th>
                        <th className="text-right pb-2 font-medium">% of Plan</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {(
                        [
                          { label: "Calories", planned: plannedTotals.calories, actual: actualTotals?.calories, unit: "kcal", color: "text-orange-600" },
                          { label: "Carbs", planned: plannedTotals.carbs, actual: actualTotals?.carbs, unit: "g", color: "text-yellow-600" },
                          { label: "Fat", planned: plannedTotals.fat, actual: actualTotals?.fat, unit: "g", color: "text-blue-600" },
                          { label: "Protein", planned: plannedTotals.protein, actual: actualTotals?.protein, unit: "g", color: "text-green-600" },
                        ] as const
                      ).map(({ label, planned, actual, unit, color }) => {
                        const pct = planned > 0 && actual !== undefined ? Math.round((actual / planned) * 100) : null;
                        const pctColor =
                          pct === null ? "text-slate-300" :
                          pct >= 90 && pct <= 110 ? "text-green-600" :
                          pct >= 75 ? "text-yellow-600" : "text-red-500";
                        return (
                          <tr key={label} className="py-2">
                            <td className={`py-2 font-medium ${color}`}>{label}</td>
                            <td className="py-2 text-right text-slate-700">
                              {label === "Calories" ? Math.round(planned) : planned.toFixed(1)} {unit}
                            </td>
                            <td className="py-2 text-right text-slate-700">
                              {actual !== undefined
                                ? `${label === "Calories" ? Math.round(actual) : actual.toFixed(1)} ${unit}`
                                : <span className="text-slate-300 text-xs italic">no data</span>}
                            </td>
                            <td className={`py-2 text-right font-semibold ${pctColor}`}>
                              {pct !== null ? `${pct}%` : "—"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                {!actualTotals && (
                  <p className="text-xs text-slate-400 mt-2 italic">No meal logs recorded today — actual intake will appear once the patient logs meals.</p>
                )}
              </CardContent>
            </Card>
          )}

          {!plan && (
            <p className="text-sm text-slate-400 text-center py-2">No meal plan assigned — showing empty meal slots for the patient's diet type.</p>
          )}

          {/* Meal sections — read-only view */}
          {mealTypeNames.map((mealTypeName) => {
            const { icon: Icon, color } = getPlanStyle(mealTypeName);
            const items = getMealItems(mealTypeName);
            const mealCals = items.reduce((a: number, i: LibraryMealPlanItem) => a + (i.calories ?? 0), 0);
            const isExpanded = expandedMeal === mealTypeName;
            return (
              <Card key={mealTypeName} className="border border-slate-200">
                <CardHeader className="py-3 px-4">
                  <button
                    className="flex items-center gap-3 w-full text-left"
                    onClick={() => setExpandedMeal(isExpanded ? null : mealTypeName)}
                  >
                    <div className={`flex h-8 w-8 items-center justify-center rounded-lg border ${color}`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-slate-800 text-sm">{mealTypeName}</p>
                      <p className="text-xs text-slate-400">
                        {items.length} item{items.length !== 1 ? "s" : ""} · {Math.round(mealCals)} kcal
                      </p>
                    </div>
                    {isExpanded ? (
                      <ChevronUp className="h-4 w-4 text-slate-400" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-slate-400" />
                    )}
                  </button>
                </CardHeader>
                {isExpanded && (
                  <CardContent className="pt-0 px-4 pb-4">
                    {items.length === 0 ? (
                      <p className="text-xs text-slate-400 text-center py-3">No foods in this meal</p>
                    ) : (
                      <div className="space-y-2">
                        {items.map((item: LibraryMealPlanItem) => (
                          <div
                            key={item.id}
                            className="flex items-center px-3 py-2 bg-white rounded-lg border border-slate-100"
                          >
                            <div className="flex-1">
                              <p className="text-sm font-medium text-slate-800">{item.foodName}</p>
                              <p className="text-xs text-slate-400">
                                {item.portionGrams}{item.unit} · {Math.round(item.calories ?? 0)} kcal ·{" "}
                                C:{(item.carbs ?? 0).toFixed(1)}g · F:{(item.fat ?? 0).toFixed(1)}g · P:{(item.protein ?? 0).toFixed(1)}g
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                )}
              </Card>
            );
          })}
        </>
      )}

    </div>
  );
}

/**
 * Read-only print version of the assigned meal plan.
 * Shows all meal type sections expanded with all items — no interactive buttons.
 */
function MealPlanPrintSection({ kidId, medical }: { kidId: number; medical: MedicalSettings }) {
  const { data: rawAssigned, isLoading: assignedLoading } = useGetKidAssignedMealPlan(kidId);
  const mealTypeNames = useMemo(() => getMealTypesForDiet(medical.dietType), [medical.dietType]);

  const plan: LibraryMealPlanDetail | undefined =
    rawAssigned && typeof rawAssigned === "object" ? rawAssigned : undefined;

  const getMealItems = (mealType: string): LibraryMealPlanItem[] =>
    plan?.items?.filter((i: LibraryMealPlanItem) => i.mealType.toLowerCase() === mealType.toLowerCase()) ?? [];

  if (assignedLoading) return <p className="text-xs text-slate-400 italic">Loading meal plan…</p>;

  return (
    <div className="space-y-3">
      <div className="flex gap-4 text-xs text-slate-600 mb-2">
        <span><strong>{Math.round(medical.dailyCalories)}</strong> kcal target</span>
        <span><strong>{medical.dailyFat % 1 !== 0 ? medical.dailyFat.toFixed(1) : medical.dailyFat}</strong>g fat</span>
        <span><strong>{medical.dailyProtein % 1 !== 0 ? medical.dailyProtein.toFixed(1) : medical.dailyProtein}</strong>g protein</span>
        <span><strong>{medical.dailyCarbs % 1 !== 0 ? medical.dailyCarbs.toFixed(1) : medical.dailyCarbs}</strong>g carbs</span>
      </div>
      {plan ? (
        <>
          <p className="text-sm font-semibold text-slate-700">{plan.name}</p>
          {plan.description && <p className="text-xs text-slate-500">{plan.description}</p>}
        </>
      ) : (
        <p className="text-xs text-slate-400 italic">No meal plan assigned.</p>
      )}
      {mealTypeNames.map((mealTypeName) => {
        const items = getMealItems(mealTypeName);
        const mealCals = items.reduce((a: number, i: LibraryMealPlanItem) => a + (i.calories ?? 0), 0);
        return (
          <div key={mealTypeName}>
            <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1">
              {mealTypeName} — {Math.round(mealCals)} kcal
            </p>
            {items.length === 0 ? (
              <p className="text-xs text-slate-400 italic pl-2">No items</p>
            ) : (
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50">
                    <th className="text-left py-1 px-2 font-medium text-slate-500">Food</th>
                    <th className="text-right py-1 px-2 font-medium text-slate-500">Portion</th>
                    <th className="text-right py-1 px-2 font-medium text-slate-500">Cal</th>
                    <th className="text-right py-1 px-2 font-medium text-slate-500">C (g)</th>
                    <th className="text-right py-1 px-2 font-medium text-slate-500">F (g)</th>
                    <th className="text-right py-1 px-2 font-medium text-slate-500">P (g)</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item: LibraryMealPlanItem) => (
                    <tr key={item.id} className="border-b border-slate-100">
                      <td className="py-1 px-2 text-slate-800 font-medium">{item.foodName}</td>
                      <td className="py-1 px-2 text-right text-slate-600">{item.portionGrams}{item.unit}</td>
                      <td className="py-1 px-2 text-right text-slate-600">{Math.round(item.calories ?? 0)}</td>
                      <td className="py-1 px-2 text-right text-slate-600">{(item.carbs ?? 0).toFixed(1)}</td>
                      <td className="py-1 px-2 text-right text-slate-600">{(item.fat ?? 0).toFixed(1)}</td>
                      <td className="py-1 px-2 text-right text-slate-600">{(item.protein ?? 0).toFixed(1)}</td>
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

// ── Side Effects Tab ─────────────────────────────────────────────────────────

type SideEffectItem = {
  id: number;
  name: string;
  isSeeded: boolean;
  createdAt: string;
};

type KidSideEffectItem = {
  id: number;
  kidId: number;
  sideEffectId: number | null;
  name: string;
  isCustom: boolean;
  createdAt: string;
};

function SideEffectsTab({ kidId, canWrite }: { kidId: number; canWrite: boolean }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [customInput, setCustomInput] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [togglingId, setTogglingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const { data: allEffects = [], isLoading: loadingAll } = useQuery<SideEffectItem[]>({
    queryKey: ["/api/side-effects"],
    queryFn: async () => {
      const res = await fetch("/api/side-effects", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch side effects");
      return res.json();
    },
  });

  const { data: kidEffects = [], isLoading: loadingKid } = useQuery<KidSideEffectItem[]>({
    queryKey: ["/api/kids", kidId, "side-effects"],
    queryFn: async () => {
      const res = await fetch(`/api/kids/${kidId}/side-effects`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch kid side effects");
      return res.json();
    },
  });

  const selectedIds = new Set(kidEffects.map((e) => e.sideEffectId).filter(Boolean) as number[]);

  async function toggleEffect(sideEffectId: number) {
    if (!canWrite) return;
    setTogglingId(sideEffectId);
    try {
      const res = await fetch(`/api/kids/${kidId}/side-effects`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sideEffectId }),
      });
      if (!res.ok) throw new Error("Toggle failed");
      queryClient.invalidateQueries({ queryKey: ["/api/kids", kidId, "side-effects"] });
    } catch {
      toast({ title: "Failed to update side effect", variant: "destructive" });
    } finally {
      setTogglingId(null);
    }
  }

  async function addCustomEffect() {
    const name = customInput.trim();
    if (!name) return;
    setIsAdding(true);
    try {
      const res = await fetch(`/api/kids/${kidId}/side-effects`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customName: name }),
      });
      if (res.status === 409) {
        toast({ title: "Already selected", description: "This side effect is already added." });
        setCustomInput("");
        return;
      }
      if (!res.ok) throw new Error("Add failed");
      setCustomInput("");
      queryClient.invalidateQueries({ queryKey: ["/api/kids", kidId, "side-effects"] });
      queryClient.invalidateQueries({ queryKey: ["/api/side-effects"] });
      toast({ title: "Side effect added" });
    } catch {
      toast({ title: "Failed to add side effect", variant: "destructive" });
    } finally {
      setIsAdding(false);
    }
  }

  async function deleteEffect(sideEffectId: number) {
    if (!canWrite) return;
    if (!confirm("Delete this custom side effect? It will be removed from all patients.")) return;
    setDeletingId(sideEffectId);
    try {
      const res = await fetch(`/api/side-effects/${sideEffectId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Delete failed");
      queryClient.invalidateQueries({ queryKey: ["/api/side-effects"] });
      queryClient.invalidateQueries({ queryKey: ["/api/kids", kidId, "side-effects"] });
      toast({ title: "Side effect deleted" });
    } catch {
      toast({ title: "Failed to delete side effect", variant: "destructive" });
    } finally {
      setDeletingId(null);
    }
  }

  const isLoading = loadingAll || loadingKid;

  if (isLoading) {
    return (
      <div className="p-8 text-center">
        <Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" />
      </div>
    );
  }

  const selectedCount = selectedIds.size;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <div className="rounded-2xl border border-slate-200 shadow-sm p-4 bg-slate-50">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Total Options</p>
          <p className="text-3xl font-black text-slate-800">{allEffects.length}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 shadow-sm p-4 bg-red-50">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Reported Effects</p>
          <p className="text-3xl font-black text-red-700">{selectedCount}</p>
        </div>
      </div>

      <Card className="rounded-2xl shadow-sm border-slate-200">
        <CardHeader className="border-b border-slate-100 pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-primary" /> Predefined Side Effects
          </CardTitle>
          <CardDescription>Select all side effects currently observed for this patient.</CardDescription>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {allEffects.map((effect) => {
              const checked = selectedIds.has(effect.id);
              const toggling = togglingId === effect.id;
              const deleting = deletingId === effect.id;
              return (
                <div key={effect.id} className="relative group">
                  <button
                    onClick={() => toggleEffect(effect.id)}
                    disabled={!canWrite || toggling || deleting}
                    className={`w-full flex items-center gap-3 rounded-xl border px-4 py-3 text-left transition-all text-sm font-medium
                      ${checked
                        ? "border-primary bg-primary/5 text-primary"
                        : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"
                      }
                      ${!canWrite ? "cursor-default opacity-70" : "cursor-pointer"}
                      ${!effect.isSeeded && canWrite ? "pr-10" : ""}
                    `}
                  >
                    {toggling ? (
                      <Loader2 className="h-4 w-4 animate-spin shrink-0" />
                    ) : checked ? (
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" />
                    ) : (
                      <Circle className="h-4 w-4 shrink-0 text-slate-400" />
                    )}
                    <span className="truncate">{effect.name}</span>
                  </button>
                  {!effect.isSeeded && canWrite && (
                    <button
                      onClick={(e) => { e.stopPropagation(); deleteEffect(effect.id); }}
                      disabled={deleting || toggling}
                      title="Delete custom side effect"
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
                    >
                      {deleting ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="h-3.5 w-3.5" />
                      )}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {canWrite && (
        <Card className="rounded-2xl shadow-sm border-slate-200">
          <CardHeader className="border-b border-slate-100 pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Plus className="h-4 w-4 text-primary" /> Add Custom Side Effect
            </CardTitle>
            <CardDescription>
              Add a side effect not listed above. It will be added to the global list and selected for this patient.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="flex gap-3">
              <Input
                placeholder="e.g. Rash, Insomnia..."
                value={customInput}
                onChange={(e) => setCustomInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") addCustomEffect(); }}
                className="flex-1 rounded-xl"
                disabled={isAdding}
              />
              <Button
                onClick={addCustomEffect}
                disabled={!customInput.trim() || isAdding}
                className="rounded-xl"
              >
                {isAdding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Add
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

