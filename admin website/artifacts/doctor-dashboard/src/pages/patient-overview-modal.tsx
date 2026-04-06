import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { X, Loader2, AlertTriangle, CalendarDays } from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";

type PatientOverview = {
  id: number;
  name: string;
  phn: string;
  dietType: string;
  dietSubCategory: string | null;
  dateOfBirth: string;
  gender: string;
  parentName: string;
  parentContact: string;
  hasSideEffects: boolean;
  mealCompletionRate: number;
  ketoRatio: number | null;
  dailyCalories: number | null;
  weightChange: number | null;
  daysOnCurrentDiet: number | null;
  weightHistory: { date: string; weight: number }[];
};

function getDietLabel(dietType: string, subCategory: string | null): string {
  if (dietType === "classic") {
    return subCategory ? `Classic Ketogenic (${subCategory})` : "Classic Ketogenic";
  }
  if (dietType === "mad") return "Modified Atkins Diet";
  if (dietType === "mct") return "MCT Diet";
  if (dietType === "lowgi") return "Low GI Diet";
  return dietType;
}

function calcAge(dateOfBirth: string): number {
  const today = new Date();
  const dob = new Date(dateOfBirth);
  let age = today.getFullYear() - dob.getFullYear();
  if (
    today.getMonth() < dob.getMonth() ||
    (today.getMonth() === dob.getMonth() && today.getDate() < dob.getDate())
  ) {
    age--;
  }
  return age;
}

function KpiMiniCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent: string;
}) {
  return (
    <div className={`rounded-xl p-4 flex flex-col gap-1 ${accent}`}>
      <p className="text-xs font-semibold uppercase tracking-wider opacity-70">{label}</p>
      <p className="text-xl font-black">{value}</p>
    </div>
  );
}

export function PatientOverviewModal({
  patientId,
  open,
  onClose,
}: {
  patientId: number | null;
  open: boolean;
  onClose: () => void;
}) {
  const { data, isLoading, isError } = useQuery<PatientOverview>({
    queryKey: ["/api/kids", patientId, "overview"],
    queryFn: async () => {
      const res = await fetch(`/api/kids/${patientId}/overview`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load patient overview");
      return res.json();
    },
    enabled: open && patientId !== null,
  });

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      aria-modal="true"
      role="dialog"
    >
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative z-10 bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {isLoading && (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        )}
        {isError && (
          <div className="flex flex-col items-center justify-center gap-3 h-64 text-slate-500">
            <AlertTriangle className="h-8 w-8 text-amber-400" />
            <p className="font-semibold">Failed to load patient overview</p>
          </div>
        )}
        {data && (
          <>
            <div className="flex items-start justify-between px-6 pt-6 pb-4 border-b border-slate-100">
              <div className="flex-1 min-w-0">
                <h2 className="text-xl font-black text-slate-900 leading-tight">Patient Overview</h2>
                <p className="text-lg font-bold text-slate-800 mt-1">{data.name}</p>
                <p className="text-sm text-slate-500 mt-0.5">PHN: {data.phn}</p>
                <span className="inline-block mt-2 text-xs font-semibold px-3 py-1 rounded-full bg-blue-100 text-blue-700">
                  {getDietLabel(data.dietType, data.dietSubCategory)}
                </span>
              </div>
              <button
                onClick={onClose}
                className="ml-4 shrink-0 w-8 h-8 flex items-center justify-center rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="px-6 py-5 space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Personal Information</p>
                  <dl className="space-y-2.5">
                    <div className="flex justify-between text-sm">
                      <dt className="text-slate-500">Age</dt>
                      <dd className="font-semibold text-slate-800">{calcAge(data.dateOfBirth)} years</dd>
                    </div>
                    <div className="flex justify-between text-sm">
                      <dt className="text-slate-500">Gender</dt>
                      <dd className="font-semibold text-slate-800">{data.gender}</dd>
                    </div>
                    <div className="flex justify-between text-sm">
                      <dt className="text-slate-500">Date of Birth</dt>
                      <dd className="font-semibold text-slate-800">
                        {new Date(data.dateOfBirth).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
                      </dd>
                    </div>
                    <div className="flex justify-between text-sm items-center">
                      <dt className="text-slate-500">Side Effects</dt>
                      <dd>
                        {data.hasSideEffects ? (
                          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-200">Present</span>
                        ) : (
                          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-green-50 text-green-700 border border-green-200">Absent</span>
                        )}
                      </dd>
                    </div>
                  </dl>
                </div>

                <div>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Contact Information</p>
                  <dl className="space-y-2.5">
                    <div className="flex justify-between text-sm">
                      <dt className="text-slate-500">Parent / Guardian</dt>
                      <dd className="font-semibold text-slate-800">{data.parentName}</dd>
                    </div>
                    <div className="flex justify-between text-sm">
                      <dt className="text-slate-500">Contact No.</dt>
                      <dd className="font-semibold text-slate-800">{data.parentContact}</dd>
                    </div>
                  </dl>
                </div>
              </div>

              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Clinical KPIs</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <KpiMiniCard
                    label="Meal Completion"
                    value={`${data.mealCompletionRate}%`}
                    accent="bg-blue-50 text-blue-800"
                  />
                  <KpiMiniCard
                    label="Keto Ratio"
                    value={data.ketoRatio !== null ? `${data.ketoRatio}:1` : "—"}
                    accent="bg-violet-50 text-violet-800"
                  />
                  <KpiMiniCard
                    label="Daily Calories"
                    value={data.dailyCalories !== null ? `${Math.round(data.dailyCalories)} kcal` : "—"}
                    accent="bg-amber-50 text-amber-800"
                  />
                  <KpiMiniCard
                    label="Weight Change"
                    value={
                      data.weightChange !== null
                        ? `${data.weightChange > 0 ? "+" : ""}${data.weightChange} kg`
                        : "—"
                    }
                    accent={
                      data.weightChange === null
                        ? "bg-slate-50 text-slate-700"
                        : data.weightChange < 0
                        ? "bg-green-50 text-green-800"
                        : "bg-red-50 text-red-800"
                    }
                  />
                </div>
              </div>

              {data.daysOnCurrentDiet !== null && (
                <div className="flex items-center gap-3 bg-slate-50 rounded-xl px-4 py-3">
                  <CalendarDays className="w-5 h-5 text-slate-400 shrink-0" />
                  <span className="text-sm text-slate-600">
                    On current diet for{" "}
                    <strong className="text-slate-900">{data.daysOnCurrentDiet}</strong>{" "}
                    day{data.daysOnCurrentDiet !== 1 ? "s" : ""}
                  </span>
                </div>
              )}

              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Weight Trend</p>
                {data.weightHistory.length === 0 ? (
                  <div className="h-36 flex items-center justify-center text-slate-400 text-sm bg-slate-50 rounded-xl">
                    No weight records yet
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={160}>
                    <LineChart data={data.weightHistory}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis
                        dataKey="date"
                        tick={{ fontSize: 10, fill: "#94a3b8" }}
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={(v: string) => {
                          const d = new Date(v);
                          return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
                        }}
                      />
                      <YAxis
                        tick={{ fontSize: 10, fill: "#94a3b8" }}
                        axisLine={false}
                        tickLine={false}
                        unit=" kg"
                        width={50}
                      />
                      <Tooltip
                        formatter={(v: number) => [`${v} kg`, "Weight"]}
                        labelFormatter={(label: string) => {
                          const d = new Date(label);
                          return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
                        }}
                        contentStyle={{ borderRadius: 10, border: "1px solid #e2e8f0", fontSize: 12 }}
                      />
                      <Line
                        type="monotone"
                        dataKey="weight"
                        stroke="#004ac6"
                        strokeWidth={2.5}
                        dot={{ r: 4, fill: "#004ac6", strokeWidth: 0 }}
                        activeDot={{ r: 5 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
