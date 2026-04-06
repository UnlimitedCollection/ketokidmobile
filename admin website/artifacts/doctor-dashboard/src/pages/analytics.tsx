import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, AlertTriangle, TrendingUp, Users, CheckCircle2, Activity, Eye } from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { PatientOverviewModal } from "./patient-overview-modal";

const CLASSIC_RATIO_COLORS: Record<string, string> = {
  "2:1":   "#93c5fd",
  "2.5:1": "#3b82f6",
  "3:1":   "#1d4ed8",
  "3.5:1": "#1e3a8a",
  "4:1":   "#172554",
};
const RISK_COLORS: Record<string, string> = {
  high: "#ae0010",
  moderate: "#b45309",
  good: "#0a7c42",
};

type AnalyticsData = {
  weeklyCompliance: { week: string; compliance: number | null; filled: number; total: number }[];
  classicDistribution: { ratio: string; label: string; count: number }[];
  patientCompliance: {
    id: number;
    name: string;
    dietType: string;
    gender: string;
    complianceRate: number | null;
    filledDays: number;
    totalDays: number;
    risk: "high" | "moderate" | "good";
    hasSideEffects: boolean;
    sideEffectNames: string[];
  }[];
  ketoneDistribution: { low: number; optimal: number; high: number; total: number };
  weightTrend: { month: string; label: string; avgWeight: number; count: number }[];
  genderDistribution: { gender: string; count: number }[];
};

function KpiCard({
  label,
  value,
  sub,
  icon: Icon,
  accent,
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ElementType;
  accent: string;
}) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 flex items-start gap-4">
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${accent}`}>
        <Icon className="w-6 h-6" />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-0.5">{label}</p>
        <p className="text-2xl font-black text-slate-900 leading-none">{value}</p>
        {sub && <p className="text-xs text-slate-400 mt-1">{sub}</p>}
      </div>
    </div>
  );
}

const KETONE_DATA = (d: AnalyticsData["ketoneDistribution"]) => [
  { label: "Low (<1.0)", value: d.low, color: "#2563eb" },
  { label: "Optimal (1–3)", value: d.optimal, color: "#0a7c42" },
  { label: "High (>3.0)", value: d.high, color: "#ae0010" },
];

export default function AnalyticsPage() {
  const [selectedPatientId, setSelectedPatientId] = useState<number | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  function openModal(id: number) {
    setSelectedPatientId(id);
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setSelectedPatientId(null);
  }

  const { data, isLoading, isError } = useQuery<AnalyticsData>({
    queryKey: ["/api/analytics/population"],
    queryFn: async () => {
      const res = await fetch("/api/analytics/population", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load analytics");
      return res.json();
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3 text-slate-500">
        <AlertTriangle className="h-8 w-8 text-amber-400" />
        <p className="font-semibold">Failed to load analytics</p>
      </div>
    );
  }

  const totalKids = data.patientCompliance.length;
  const tracked = data.patientCompliance.filter((p) => p.complianceRate !== null);
  const avgCompliance =
    tracked.length > 0
      ? Math.round(tracked.reduce((s, p) => s + (p.complianceRate ?? 0), 0) / tracked.length)
      : null;

  const ketoneData = KETONE_DATA(data.ketoneDistribution);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black text-slate-900 tracking-tight">Patient Analytics</h1>
        <p className="text-sm text-slate-500 mt-1">Population-level trends, compliance, and clinical behaviour across all patients.</p>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <KpiCard
          label="Total Patients"
          value={totalKids}
          sub="enrolled in programme"
          icon={Users}
          accent="bg-blue-50 text-blue-600"
        />
        <KpiCard
          label="Avg Compliance"
          value={avgCompliance !== null ? `${avgCompliance}%` : "—"}
          sub="meal-day fill rate"
          icon={CheckCircle2}
          accent={avgCompliance !== null && avgCompliance >= 80 ? "bg-green-50 text-green-600" : "bg-amber-50 text-amber-600"}
        />
        <KpiCard
          label="Ketone Readings"
          value={data.ketoneDistribution.total}
          sub="last 30 days"
          icon={Activity}
          accent="bg-violet-50 text-violet-600"
        />
      </div>

      {/* Compliance trend + Diet Type pie */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <h2 className="font-bold text-slate-800 mb-1">Weekly Meal Compliance</h2>
          <p className="text-xs text-slate-400 mb-4">% of meal-days fully completed, across all patients, last 8 weeks</p>
          {data.weeklyCompliance.every((w) => w.compliance === null) ? (
            <div className="h-48 flex items-center justify-center text-slate-400 text-sm">No meal-day data yet</div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={data.weeklyCompliance}>
                <defs>
                  <linearGradient id="compGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#004ac6" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#004ac6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="week" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                <YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`} tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                <Tooltip
                  formatter={(v: number) => [`${v}%`, "Compliance"]}
                  contentStyle={{ borderRadius: 10, border: "1px solid #e2e8f0", fontSize: 12 }}
                />
                <Area
                  type="monotone"
                  dataKey="compliance"
                  stroke="#004ac6"
                  strokeWidth={2.5}
                  fill="url(#compGrad)"
                  connectNulls
                  dot={{ r: 4, fill: "#004ac6", strokeWidth: 0 }}
                  activeDot={{ r: 5 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <h2 className="font-bold text-slate-800 mb-1">Classic Distribution</h2>
          <p className="text-xs text-slate-400 mb-4">Patients across classic ratios</p>
          {data.classicDistribution.every((p) => p.count === 0) ? (
            <div className="h-48 flex items-center justify-center text-slate-400 text-sm">No classic ratio data available</div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={160}>
                <PieChart>
                  <Pie
                    data={data.classicDistribution}
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={70}
                    dataKey="count"
                    nameKey="label"
                    paddingAngle={3}
                  >
                    {data.classicDistribution.map((d) => (
                      <Cell key={d.ratio} fill={CLASSIC_RATIO_COLORS[d.ratio] || "#999"} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(v: number, name: string) => [v, name]}
                    contentStyle={{ borderRadius: 10, border: "1px solid #e2e8f0", fontSize: 12 }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="grid grid-cols-2 gap-1 mt-2">
                {data.classicDistribution.map((d) => (
                  <div key={d.ratio} className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: CLASSIC_RATIO_COLORS[d.ratio] || "#999" }} />
                    <span className="text-xs text-slate-600">{d.label}: <strong>{d.count}</strong></span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Ketone distribution + Weight trend */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <h2 className="font-bold text-slate-800 mb-1">Ketone Status Distribution</h2>
          <p className="text-xs text-slate-400 mb-4">Readings from last 30 days, grouped by therapeutic range</p>
          {data.ketoneDistribution.total === 0 ? (
            <div className="h-48 flex items-center justify-center text-slate-400 text-sm">No ketone readings in last 30 days</div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={ketoneData} barSize={40}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip contentStyle={{ borderRadius: 10, border: "1px solid #e2e8f0", fontSize: 12 }} />
                  <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                    {ketoneData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <div className="flex gap-4 mt-3 justify-center">
                {ketoneData.map((k) => (
                  <div key={k.label} className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: k.color }} />
                    <span className="text-xs text-slate-600">{k.label.split(" ")[0]}: <strong>{k.value}</strong></span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <h2 className="font-bold text-slate-800 mb-1">Average Weight Trend</h2>
          <p className="text-xs text-slate-400 mb-4">Population average weight per month (last 6 months)</p>
          {data.weightTrend.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-slate-400 text-sm">No weight records in range</div>
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={data.weightTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} unit=" kg" />
                <Tooltip
                  formatter={(v: number) => [`${v} kg`, "Avg Weight"]}
                  contentStyle={{ borderRadius: 10, border: "1px solid #e2e8f0", fontSize: 12 }}
                />
                <Line
                  type="monotone"
                  dataKey="avgWeight"
                  stroke="#0a7c42"
                  strokeWidth={2.5}
                  dot={{ r: 4, fill: "#0a7c42", strokeWidth: 0 }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Patient compliance table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="font-bold text-slate-800">Patient Compliance Overview</h2>
            <p className="text-xs text-slate-400 mt-0.5">All patients sorted by compliance rate (lowest first)</p>
          </div>
          <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-3 py-1 rounded-full">{totalKids} patients</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Patient</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Diet Type</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Days Tracked</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Compliance</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Side Effect</th>
                <th className="text-center px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Profile</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {data.patientCompliance.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-3 font-medium text-slate-800">{p.name}</td>
                  <td className="px-4 py-3 text-center">
                    <span className="text-xs font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">{p.dietType === "classic" ? "Classic" : p.dietType === "mad" ? "MAD" : p.dietType === "mct" ? "MCT" : "Low GI"}</span>
                  </td>
                  <td className="px-4 py-3 text-center text-slate-500">
                    {p.filledDays}/{p.totalDays}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {p.complianceRate !== null ? (
                      <div className="flex items-center gap-2 justify-center">
                        <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${p.complianceRate}%`,
                              backgroundColor: RISK_COLORS[p.risk],
                            }}
                          />
                        </div>
                        <span className="text-sm font-bold" style={{ color: RISK_COLORS[p.risk] }}>
                          {p.complianceRate}%
                        </span>
                      </div>
                    ) : (
                      <span className="text-slate-400 text-xs">No data</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {p.hasSideEffects ? (
                      <div className="flex flex-wrap gap-1 justify-center">
                        {p.sideEffectNames.map((name) => (
                          <span
                            key={name}
                            className="text-xs font-semibold px-2 py-0.5 rounded-full border bg-destructive/10 text-destructive border-destructive/20"
                          >
                            {name}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full border bg-green-50 text-green-700 border-green-200">
                        Absent
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-3">
                    <div className="flex justify-center">
                      <button
                        onClick={() => openModal(p.id)}
                        className="text-blue-600 hover:text-blue-800 transition-colors"
                        aria-label="View patient overview"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <PatientOverviewModal
        patientId={selectedPatientId}
        open={modalOpen}
        onClose={closeModal}
      />
    </div>
  );
}
