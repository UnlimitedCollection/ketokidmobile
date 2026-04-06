import { useMemo, useState } from "react";
import { useParams, useLocation } from "wouter";
import {
  useGetKid,
  useGetKidMealHistory,
  useGetKidKetoneReadings,
  useGetKidAssignedMealPlan,
  type LibraryMealPlanItem,
  type MealDay,
} from "@workspace/api-client-react";
import { DayHoverPopup } from "@/components/day-hover-popup";
import {
  LineChart, Line, BarChart, Bar, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ReferenceLine, ReferenceArea, Legend,
} from "recharts";
import { format, parseISO, startOfMonth, subMonths, eachDayOfInterval, endOfMonth, getDay } from "date-fns";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Loader2, User, Scale, Flame, BarChart2, LayoutGrid, TrendingUp } from "lucide-react";

const KETONE_THERAPEUTIC_LOW = 1.5;
const KETONE_THERAPEUTIC_HIGH = 6.0;
const KETONE_CHART_MAX = 10;

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function getComplianceColor(rate: number | undefined): string {
  if (rate === undefined) return "bg-slate-100";
  if (rate === 0) return "bg-red-400";
  if (rate < 1) return "bg-amber-400";
  return "bg-green-500";
}

const DIET_TYPE_LABELS: Record<string, string> = {
  classic: "Classic Ketogenic",
  mad: "Modified Atkins",
  mct: "MCT Diet",
  lowgi: "Low GI Diet",
};

function ComplianceCalendarMonth({
  month,
  completionMap,
}: {
  month: Date;
  completionMap: Map<string, MealDay>;
}) {
  const [hovered, setHovered] = useState<{ day: MealDay; x: number; y: number } | null>(null);
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
              className={`aspect-square rounded-sm ${color} cursor-default transition-opacity hover:opacity-80`}
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
    </div>
  );
}

export default function KidAnalyticsPage() {
  const { id } = useParams();
  const kidId = parseInt(id || "0", 10);
  const [, setLocation] = useLocation();

  const { data: profile, isLoading: profileLoading } = useGetKid(kidId);
  const { data: mealHistory, isLoading: historyLoading } = useGetKidMealHistory(kidId);
  const { data: ketoneReadings, isLoading: ketonesLoading } = useGetKidKetoneReadings(kidId);
  const { data: rawAssigned } = useGetKidAssignedMealPlan(kidId);

  const isLoading = profileLoading || historyLoading || ketonesLoading;

  const assignedPlan = rawAssigned && typeof rawAssigned === "object" ? rawAssigned : undefined;

  const chronologicalHistory = useMemo(
    () => (mealHistory ? [...mealHistory].reverse() : []),
    [mealHistory]
  );

  const last30History = useMemo(
    () => chronologicalHistory.slice(-30),
    [chronologicalHistory]
  );

  const nutritionTrendData = useMemo(
    () =>
      last30History.map((d) => ({
        date: format(parseISO(d.date), "MMM d"),
        calories: Math.round(d.totalCalories ?? 0),
        carbs: Math.round(d.totalCarbs ?? 0),
        fat: Math.round(d.totalFat ?? 0),
        protein: Math.round(d.totalProtein ?? 0),
      })),
    [last30History]
  );

  const complianceTrendData = useMemo(
    () =>
      last30History.map((d) => ({
        date: format(parseISO(d.date), "MMM d"),
        compliance: Math.round(d.completionRate * 100),
      })),
    [last30History]
  );

  const completionMap = useMemo(() => {
    const map = new Map<string, MealDay>();
    mealHistory?.forEach((d) => map.set(d.date, d));
    return map;
  }, [mealHistory]);

  const today = new Date();
  const calendarMonths = [subMonths(today, 1), today];

  const ketoneChartData = useMemo(
    () =>
      ketoneReadings
        ? [...ketoneReadings]
            .reverse()
            .map((r) => ({
              date: format(parseISO(r.date), "MMM d"),
              value: r.value,
            }))
        : [],
    [ketoneReadings]
  );

  const plannedTotals = useMemo(() => {
    return (assignedPlan?.items ?? []).reduce(
      (acc: { calories: number; carbs: number; fat: number; protein: number }, item: LibraryMealPlanItem) => ({
        calories: acc.calories + (item.calories ?? 0),
        carbs: acc.carbs + (item.carbs ?? 0),
        fat: acc.fat + (item.fat ?? 0),
        protein: acc.protein + (item.protein ?? 0),
      }),
      { calories: 0, carbs: 0, fat: 0, protein: 0 }
    );
  }, [assignedPlan]);

  const todayStr = format(today, "yyyy-MM-dd");
  const todayRecord = mealHistory?.find((d) => d.date === todayStr) ?? null;
  const actualTotals = todayRecord
    ? {
        calories: todayRecord.totalCalories ?? 0,
        carbs: todayRecord.totalCarbs ?? 0,
        fat: todayRecord.totalFat ?? 0,
        protein: todayRecord.totalProtein ?? 0,
      }
    : null;

  const macroComparisonData = [
    { macro: "Calories", planned: Math.round(plannedTotals.calories), actual: actualTotals ? Math.round(actualTotals.calories) : 0 },
    { macro: "Carbs (g)", planned: Math.round(plannedTotals.carbs), actual: actualTotals ? Math.round(actualTotals.carbs) : 0 },
    { macro: "Fat (g)", planned: Math.round(plannedTotals.fat), actual: actualTotals ? Math.round(actualTotals.fat) : 0 },
    { macro: "Protein (g)", planned: Math.round(plannedTotals.protein), actual: actualTotals ? Math.round(actualTotals.protein) : 0 },
  ];

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

  const { kid, recentWeights } = profile;

  const weightChartData = recentWeights;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row gap-6">
        <Card className="flex-1 rounded-2xl border-slate-200 shadow-sm overflow-hidden bg-white">
          <div className="h-2 w-full bg-gradient-to-r from-primary to-secondary" />
          <div className="p-6 flex flex-col md:flex-row gap-6 items-start md:items-center">
            <div className="h-16 w-16 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 border border-blue-100">
              <User className="h-8 w-8" />
            </div>
            <div className="flex-1">
              <div className="flex items-start justify-between">
                <div>
                  <h1 className="text-2xl font-bold text-slate-900">{kid.name}</h1>
                  <div className="flex items-center gap-3 mt-1 text-slate-500 text-sm">
                    <span className="text-slate-500 font-medium">PHN No.</span><span className="font-mono bg-slate-100 px-2 py-0.5 rounded">{kid.kidCode}</span>
                    <span>{kid.ageMonths} months old</span>
                    <span className="capitalize">{kid.gender}</span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">Analytics Overview</p>
                </div>
                <div className="flex items-start gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="rounded-lg gap-1.5"
                    onClick={() => setLocation(`/kids/${kidId}`)}
                  >
                    <ArrowLeft className="h-3.5 w-3.5" /> Back to Profile
                  </Button>
                  <div className="flex flex-col items-end gap-2 ml-2">
                    <Badge variant="secondary" className="bg-primary/10 text-primary hover:bg-primary/20 text-sm py-1 px-3">
                      {DIET_TYPE_LABELS[kid.dietType] || kid.dietType}{kid.dietSubCategory ? ` (${kid.dietSubCategory})` : ""}
                    </Badge>
                  </div>
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
              <p className="font-semibold text-slate-800">{kid.currentWeight ? `${kid.currentWeight} kg` : "--"}</p>
            </div>
            <div>
              <p className="text-slate-500 font-medium">DOB</p>
              <p className="font-semibold text-slate-800">{format(parseISO(kid.dateOfBirth), "MMM d, yyyy")}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Charts grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* 1. Weight History */}
        <Card className="rounded-2xl shadow-sm border-slate-200">
          <CardHeader className="flex flex-row items-center gap-2 pb-2">
            <Scale className="h-5 w-5 text-primary shrink-0" />
            <div>
              <CardTitle className="text-base">Weight History</CardTitle>
              <CardDescription>Weight trajectory over all recorded readings</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="pt-2">
            {weightChartData.length < 2 ? (
              <div className="h-[220px] flex flex-col items-center justify-center text-slate-400 border-2 border-dashed border-slate-200 rounded-xl">
                <Scale className="h-8 w-8 mb-2 opacity-40" />
                <p className="text-sm">Not enough weight data.</p>
              </div>
            ) : (
              <div className="h-[220px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={weightChartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                    <XAxis
                      dataKey="date"
                      tickFormatter={(d) => format(parseISO(d), "MMM d")}
                      tick={{ fontSize: 10, fill: "#94a3b8" }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 10, fill: "#94a3b8" }}
                      tickLine={false}
                      axisLine={false}
                      domain={["dataMin - 1", "dataMax + 1"]}
                      unit=" kg"
                    />
                    <Tooltip
                      contentStyle={{ borderRadius: "10px", border: "none", boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)", fontSize: "12px" }}
                      labelFormatter={(d) => format(parseISO(d as string), "MMM d, yyyy")}
                      formatter={(v: number) => [`${v} kg`, "Weight"]}
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
          </CardContent>
        </Card>

        {/* 2. Ketone Readings */}
        <Card className="rounded-2xl shadow-sm border-slate-200">
          <CardHeader className="flex flex-row items-center gap-2 pb-2">
            <Flame className="h-5 w-5 text-emerald-600 shrink-0" />
            <div>
              <CardTitle className="text-base">Ketone Readings</CardTitle>
              <CardDescription>Blood/urine ketone values over time (mmol/L)</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="pt-2">
            <div className="flex items-center gap-4 mb-3 text-xs text-slate-600">
              {[
                { label: "Low (<1.5)", color: "bg-blue-200" },
                { label: "Optimal (1.5–6)", color: "bg-emerald-200" },
                { label: "High (>6)", color: "bg-red-200" },
              ].map((l) => (
                <span key={l.label} className="flex items-center gap-1.5">
                  <span className={`w-3 h-3 rounded-sm ${l.color}`} />
                  {l.label}
                </span>
              ))}
            </div>
            {ketoneChartData.length < 2 ? (
              <div className="h-[200px] flex flex-col items-center justify-center text-slate-400 border-2 border-dashed border-slate-200 rounded-xl">
                <Flame className="h-8 w-8 mb-2 opacity-40" />
                <p className="text-sm">Add at least 2 readings to see trend.</p>
              </div>
            ) : (
              <div className="h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={ketoneChartData} margin={{ top: 4, right: 16, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#94a3b8" }} tickLine={false} axisLine={false} />
                    <YAxis
                      tick={{ fontSize: 10, fill: "#94a3b8" }}
                      tickLine={false}
                      axisLine={false}
                      domain={[0, KETONE_CHART_MAX]}
                    />
                    <Tooltip
                      contentStyle={{ borderRadius: "10px", border: "none", boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)", fontSize: "12px" }}
                      formatter={(v: number) => [`${v} mmol/L`, "Ketones"]}
                    />
                    {/* Color bands: Low / Optimal / High */}
                    <ReferenceArea y1={0} y2={KETONE_THERAPEUTIC_LOW} fill="#bfdbfe" fillOpacity={0.35} />
                    <ReferenceArea y1={KETONE_THERAPEUTIC_LOW} y2={KETONE_THERAPEUTIC_HIGH} fill="#a7f3d0" fillOpacity={0.35} />
                    <ReferenceArea y1={KETONE_THERAPEUTIC_HIGH} y2={KETONE_CHART_MAX} fill="#fecaca" fillOpacity={0.35} />
                    <Line
                      type="monotone"
                      dataKey="value"
                      stroke="#10b981"
                      strokeWidth={2.5}
                      dot={{ r: 4, fill: "#10b981", strokeWidth: 2, stroke: "#fff" }}
                      activeDot={{ r: 6 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 3. Meal Compliance Over Time */}
        <Card className="rounded-2xl shadow-sm border-slate-200">
          <CardHeader className="flex flex-row items-center gap-2 pb-2">
            <BarChart2 className="h-5 w-5 text-primary shrink-0" />
            <div>
              <CardTitle className="text-base">Meal Compliance Over Time</CardTitle>
              <CardDescription>Daily meal completion percentage — last 30 days</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="pt-2">
            {complianceTrendData.length < 2 ? (
              <div className="h-[220px] flex flex-col items-center justify-center text-slate-400 border-2 border-dashed border-slate-200 rounded-xl">
                <BarChart2 className="h-8 w-8 mb-2 opacity-40" />
                <p className="text-sm">No compliance data yet.</p>
              </div>
            ) : (
              <div className="h-[220px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={complianceTrendData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="complianceGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#004ac6" stopOpacity={0.15} />
                        <stop offset="95%" stopColor="#004ac6" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#94a3b8" }} tickLine={false} axisLine={false} />
                    <YAxis
                      tick={{ fontSize: 10, fill: "#94a3b8" }}
                      tickLine={false}
                      axisLine={false}
                      domain={[0, 100]}
                      tickFormatter={(v) => `${v}%`}
                    />
                    <Tooltip
                      contentStyle={{ borderRadius: "10px", border: "none", boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)", fontSize: "12px" }}
                      formatter={(v: number) => [`${v}%`, "Compliance"]}
                    />
                    <Area
                      type="monotone"
                      dataKey="compliance"
                      stroke="#004ac6"
                      strokeWidth={2.5}
                      fill="url(#complianceGrad)"
                      dot={{ r: 3, fill: "#004ac6", strokeWidth: 0 }}
                      activeDot={{ r: 5 }}
                      connectNulls
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 4. Planned vs Actual Macros */}
        <Card className="rounded-2xl shadow-sm border-slate-200">
          <CardHeader className="flex flex-row items-center gap-2 pb-2">
            <TrendingUp className="h-5 w-5 text-primary shrink-0" />
            <div>
              <CardTitle className="text-base">Planned vs Actual Macros</CardTitle>
              <CardDescription>
                {assignedPlan ? `Today's intake vs. assigned plan: ${assignedPlan.name}` : "Today's intake vs. prescribed targets"}
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="pt-2">
            {!assignedPlan && !actualTotals ? (
              <div className="h-[220px] flex flex-col items-center justify-center text-slate-400 border-2 border-dashed border-slate-200 rounded-xl">
                <TrendingUp className="h-8 w-8 mb-2 opacity-40" />
                <p className="text-sm">No plan or meal data available.</p>
              </div>
            ) : (
              <div className="h-[220px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={macroComparisonData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                    <XAxis dataKey="macro" tick={{ fontSize: 10, fill: "#94a3b8" }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} tickLine={false} axisLine={false} />
                    <Tooltip
                      contentStyle={{ borderRadius: "10px", border: "none", boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)", fontSize: "12px" }}
                    />
                    <Legend iconType="square" iconSize={10} wrapperStyle={{ fontSize: "11px" }} />
                    <Bar dataKey="planned" name="Planned" fill="#0ea5e9" radius={[4, 4, 0, 0]} fillOpacity={0.85} />
                    <Bar dataKey="actual" name="Actual (today)" fill="#10b981" radius={[4, 4, 0, 0]} fillOpacity={0.85} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 5. Nutrition Trends (full width) */}
        <Card className="rounded-2xl shadow-sm border-slate-200 lg:col-span-2">
          <CardHeader className="flex flex-row items-center gap-2 pb-2">
            <BarChart2 className="h-5 w-5 text-indigo-600 shrink-0" />
            <div>
              <CardTitle className="text-base">Nutrition Trends</CardTitle>
              <CardDescription>Daily macro intake over the last 30 days</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="pt-2">
            {nutritionTrendData.length < 2 ? (
              <div className="h-[200px] flex flex-col items-center justify-center text-slate-400 border-2 border-dashed border-slate-200 rounded-xl">
                <BarChart2 className="h-8 w-8 mb-2 opacity-40" />
                <p className="text-sm">Not enough nutrition data to display chart.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {(
                  [
                    { key: "calories" as const, label: "Calories", unit: "kcal", color: "#6366f1" },
                    { key: "fat" as const, label: "Fat", unit: "g", color: "#0ea5e9" },
                    { key: "protein" as const, label: "Protein", unit: "g", color: "#10b981" },
                    { key: "carbs" as const, label: "Carbs", unit: "g", color: "#f59e0b" },
                  ] as const
                ).map(({ key, label, unit, color }) => (
                  <div key={key}>
                    <p className="text-xs font-semibold text-slate-600 mb-2">{label}</p>
                    <ResponsiveContainer width="100%" height={130}>
                      <LineChart data={nutritionTrendData} margin={{ top: 2, right: 4, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                        <XAxis dataKey="date" tick={{ fontSize: 9, fill: "#94a3b8" }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                        <YAxis tick={{ fontSize: 9, fill: "#94a3b8" }} tickLine={false} axisLine={false} />
                        <Tooltip
                          contentStyle={{ borderRadius: "10px", border: "none", boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)", fontSize: "11px" }}
                          formatter={(v: number) => [`${v}${unit}`, label]}
                        />
                        <Line
                          type="monotone"
                          dataKey={key}
                          stroke={color}
                          strokeWidth={2}
                          dot={false}
                          activeDot={{ r: 4 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* 6. Compliance Heatmap (full width) */}
        <Card className="rounded-2xl shadow-sm border-slate-200 lg:col-span-2">
          <CardHeader className="flex flex-row items-center gap-2 pb-2">
            <LayoutGrid className="h-5 w-5 text-primary shrink-0" />
            <div>
              <CardTitle className="text-base">Compliance Heatmap</CardTitle>
              <CardDescription>Daily meal completion over the last 2 months. Hover a cell for details.</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="pt-2">
            <div className="flex items-center gap-4 mb-5 text-xs text-slate-600">
              {[
                { label: "No data", color: "bg-slate-100" },
                { label: "Missed", color: "bg-red-400" },
                { label: "Partial", color: "bg-amber-400" },
                { label: "Full", color: "bg-green-500" },
              ].map((l) => (
                <span key={l.label} className="flex items-center gap-1.5">
                  <span className={`w-3 h-3 rounded-sm ${l.color}`} />
                  {l.label}
                </span>
              ))}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {calendarMonths.map((month) => (
                <ComplianceCalendarMonth
                  key={format(month, "yyyy-MM")}
                  month={month}
                  completionMap={completionMap}
                />
              ))}
            </div>
          </CardContent>
        </Card>

      </div>
    </div>
  );
}
