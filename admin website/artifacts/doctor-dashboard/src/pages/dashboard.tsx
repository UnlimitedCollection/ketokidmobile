import { useGetDashboardStats, useGetDashboardRecentActivity } from "@workspace/api-client-react";
import { useCanWrite } from "@/hooks/useRole";
import { Link, useLocation } from "wouter";
import { Loader2, AlertTriangle } from "lucide-react";
import { PrintButton } from "@/components/print-button";
import { PrintLayout } from "@/components/print-layout";
import { usePrint } from "@/hooks/usePrint";
import { PrintFilterDialog, type PrintFilterResult } from "@/components/print-filter-dialog";
import { useState, useCallback } from "react";
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip,
  LineChart, Line, XAxis, YAxis, CartesianGrid
} from "recharts";

const CLASSIC_RATIO_COLORS: Record<string, string> = {
  "2:1":   "#93c5fd",
  "2.5:1": "#3b82f6",
  "3:1":   "#1d4ed8",
  "3.5:1": "#1e3a8a",
  "4:1":   "#172554",
};
const BLUE  = "#004ac6";
const AMBER = "#855300";
const RED   = "#ae0010";
const GREEN = "#0a7c42";

const WEEK_DATA = [
  { day: "Mon", compliance: 78, weight: 0.2 },
  { day: "Tue", compliance: 82, weight: 0.1 },
  { day: "Wed", compliance: 75, weight: 0.3 },
  { day: "Thu", compliance: 88, weight: 0.15 },
  { day: "Fri", compliance: 85, weight: 0.2 },
  { day: "Sat", compliance: 91, weight: 0.25 },
  { day: "Sun", compliance: 87, weight: 0.1 },
];

const QUICK_ACTIONS = [
  { label: "Search Child",   icon: "🔍", href: "/kids?search=" },
  { label: "Add New Child",  icon: "➕", href: "/kids/new" },
  { label: "Log Reading",    icon: "📊", href: "/kids" },
  { label: "View Analytics", icon: "📈", href: "/analytics" },
];

function activityColor(type: string) {
  if (type === "note") return BLUE;
  if (type === "weight") return GREEN;
  return AMBER;
}

function formatRelativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hr ago`;
  return `${Math.floor(hrs / 24)} days ago`;
}

function KpiCard({
  label, value, sub, icon, accent, badge,
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon: string;
  accent?: string;
  badge?: string;
}) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 flex flex-col gap-3">
      <div className="flex items-start justify-between">
        <div className="flex flex-col gap-1">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{label}</p>
          <p className="text-3xl font-black text-slate-900">{value}</p>
          {sub && <p className="text-xs text-slate-400">{sub}</p>}
        </div>
        <div
          className="w-11 h-11 rounded-full flex items-center justify-center text-xl"
          style={{ background: accent ? `${accent}18` : "#f1f5f9" }}
        >
          {icon}
        </div>
      </div>
      {badge && (
        <span
          className="self-start px-2.5 py-0.5 rounded-full text-xs font-bold uppercase"
          style={{ background: `${RED}20`, color: RED }}
        >
          {badge}
        </span>
      )}
    </div>
  );
}

const DASHBOARD_PRINT_SECTIONS = [
  { id: "kpi",             label: "KPI Summary Cards",          defaultChecked: true },
  { id: "dietType",        label: "Classic Distribution Chart", defaultChecked: true },
  { id: "trend",           label: "Compliance & Weight Trend",  defaultChecked: true },
  { id: "activity",        label: "Recent Activity",            defaultChecked: true },
];

export default function DashboardPage() {
  const [, navigate] = useLocation();
  const canWrite = useCanWrite();
  const { data: stats, isLoading, error } = useGetDashboardStats();
  const { data: recentActivity, isLoading: activityLoading } = useGetDashboardRecentActivity();
  const { printRef, handlePrint } = usePrint("Clinical Overview Report");
  const [printFilterOpen, setPrintFilterOpen] = useState(false);
  const [printSections, setPrintSections] = useState<Set<string>>(new Set(DASHBOARD_PRINT_SECTIONS.map(s => s.id)));

  const handlePrintFilterConfirm = useCallback((result: PrintFilterResult) => {
    setPrintSections(new Set(result.selectedIds));
    handlePrint();
  }, [handlePrint]);

  const now = new Date();
  const timeStr = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  if (isLoading) {
    return (
      <div className="h-[80vh] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-blue-600">
          <Loader2 className="h-10 w-10 animate-spin" />
          <p className="text-sm font-medium text-slate-500">Loading clinical overview…</p>
        </div>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 p-12 text-center">
        <AlertTriangle className="h-10 w-10 text-red-600" />
        <h3 className="text-lg font-bold text-slate-800">Failed to load dashboard</h3>
        <p className="text-sm text-slate-500">Please check your connection or try logging in again.</p>
      </div>
    );
  }

  const classicData = stats.classicDistribution ?? [];
  const totalClassic = classicData.reduce((s, p) => s + p.count, 0);

  return (
    <PrintLayout innerRef={printRef} className="space-y-8 pb-10">
      <PrintFilterDialog
        open={printFilterOpen}
        onOpenChange={setPrintFilterOpen}
        title="Print Clinical Overview"
        description="Choose which sections to include in the printed report."
        options={DASHBOARD_PRINT_SECTIONS}
        onConfirm={handlePrintFilterConfirm}
      />

      <div className="no-print flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-900">Clinical Overview</h1>
          <p className="text-sm text-slate-500 mt-0.5">Daily status for Pediatric Ketogenic Therapy</p>
        </div>
        <div className="flex items-center gap-2">
          <p className="text-xs text-slate-400 mt-1 font-medium">
            Last Updated: Today, {timeStr}
          </p>
          <PrintButton onPrint={() => setPrintFilterOpen(true)} />
        </div>
      </div>

      <div className="no-print space-y-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
          <KpiCard label="Total Children"    value={stats.totalChildren}                  icon="👧" accent={BLUE}  />
          <KpiCard label="Unfilled Records"  value={stats.last24hUnfilledMealRecords} sub={`All-time: ${stats.unfilledMealRecords}`} icon="📋" accent={AMBER} />
          <KpiCard label="Registered Doctors" value={stats.totalDoctors ?? 0}             icon="🩺" accent={GREEN} />
          <KpiCard label="Active Tokens"     value={stats.tokenSummary?.active ?? 0} sub={`${stats.tokenSummary?.total ?? 0} total`} icon="🔑" accent={RED} />
        </div>

        <div className="grid grid-cols-2 xl:grid-cols-4 gap-5">
          <KpiCard label="Classic Ketogenic Diet Children"          value={stats.classicChildren ?? 0} icon="🥗" accent={BLUE}  />
          <KpiCard label="Modified Atkins Diet (MAD) Children"      value={stats.madChildren ?? 0}     icon="🍽️" accent={GREEN} />
          <KpiCard label="MCT (Medium Chain Triglyceride) Children" value={stats.mctChildren ?? 0}     icon="💧" accent={AMBER} />
          <KpiCard label="Low Glycemic Index (Low GI) Children"     value={stats.lowgiChildren ?? 0}   icon="🌿" accent={RED}   />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
            <h2 className="font-bold text-slate-800 mb-1">Classic Distribution</h2>
            <p className="text-xs text-slate-400 mb-4">Patients across classic ratios</p>
            {classicData.every((d) => d.count === 0) ? (
              <p className="text-sm text-slate-400 py-8 text-center">No classic ratio data available</p>
            ) : (
              <div className="flex items-center gap-6">
                <div className="relative w-44 h-44 shrink-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={classicData} cx="50%" cy="50%" innerRadius={52} outerRadius={72} paddingAngle={4} dataKey="count" nameKey="label" strokeWidth={0}>
                        {classicData.map((d) => <Cell key={d.ratio} fill={CLASSIC_RATIO_COLORS[d.ratio] || "#999"} />)}
                      </Pie>
                      <RechartsTooltip contentStyle={{ borderRadius: "8px", border: "none", boxShadow: "0 4px 12px rgba(0,0,0,.12)" }} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <p className="text-2xl font-black text-slate-900">{totalClassic}</p>
                    <p className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">Total</p>
                  </div>
                </div>
                <ul className="flex flex-col gap-2">
                  {classicData.map((d) => (
                    <li key={d.ratio} className="flex items-center gap-2 text-sm">
                      <span className="w-3 h-3 rounded-full shrink-0" style={{ background: CLASSIC_RATIO_COLORS[d.ratio] || "#999" }} />
                      <span className="text-slate-600 font-medium">{d.label}</span>
                      <span className="ml-auto font-bold text-slate-800">{d.count}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
            <h2 className="font-bold text-slate-800 mb-1">Compliance & Weight Trend</h2>
            <p className="text-xs text-slate-400 mb-4">Weekly overview (illustrative)</p>
            <div className="flex items-center gap-4 mb-3">
              <span className="flex items-center gap-1.5 text-xs text-slate-600 font-medium">
                <span className="w-6 border-t-2 border-blue-600 inline-block" /> Compliance
              </span>
              <span className="flex items-center gap-1.5 text-xs text-slate-600 font-medium">
                <span className="w-6 border-t-2 border-dashed border-amber-700 inline-block" /> Weight Δ
              </span>
            </div>
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={WEEK_DATA} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="day" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                <RechartsTooltip contentStyle={{ borderRadius: "8px", border: "none", boxShadow: "0 4px 12px rgba(0,0,0,.12)" }} />
                <Line type="monotone" dataKey="compliance" stroke={BLUE}  strokeWidth={2.5} dot={false} />
                <Line type="monotone" dataKey="weight"     stroke={AMBER} strokeWidth={2.5} dot={false} strokeDasharray="5 4" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {canWrite && (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
              <h2 className="font-bold text-slate-800 mb-4">Quick Actions</h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {QUICK_ACTIONS.map((qa) => (
                  <button key={qa.label} className="flex flex-col items-center gap-2 group cursor-pointer" onClick={() => navigate(qa.href)}>
                    <div className="w-14 h-14 rounded-full bg-slate-100 group-hover:bg-blue-600 flex items-center justify-center text-2xl transition-colors">{qa.icon}</div>
                    <span className="text-xs font-semibold text-slate-600 group-hover:text-blue-600 transition-colors text-center">{qa.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
            <h2 className="font-bold text-slate-800 mb-4">Recent Activity</h2>
            {activityLoading ? (
              <div className="flex items-center justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></div>
            ) : !Array.isArray(recentActivity) || recentActivity.length === 0 ? (
              <p className="text-sm text-slate-400 py-8 text-center">No recent activity</p>
            ) : (
              <ul className="flex flex-col gap-4">
                {recentActivity.map((a, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <span className="mt-1 w-2.5 h-2.5 rounded-full shrink-0" style={{ background: activityColor(a.type) }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-800">{a.title}</p>
                      <p className="text-xs text-slate-500 truncate">{a.description}</p>
                      <Link href={`/kids/${a.kidId}`} className="text-[11px] text-blue-500 hover:underline">{a.kidName}</Link>
                    </div>
                    <span className="text-[11px] text-slate-400 whitespace-nowrap shrink-0">{formatRelativeTime(a.timestamp)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      {/* Print-only content */}
      <div className="hidden print-section space-y-6">
        <div>
          <h1 className="text-xl font-black text-slate-900">Clinical Overview</h1>
          <p className="text-xs text-slate-500">Pediatric Ketogenic Therapy — {new Date().toLocaleDateString()}</p>
        </div>

        {printSections.has("kpi") && (
          <div>
            <h2 className="text-sm font-bold text-slate-800 mb-2">KPI Summary</h2>
            <table className="w-full text-xs border-collapse">
              <tbody>
                <tr className="border-b border-slate-100">
                  <td className="py-1 px-2 font-semibold text-slate-600 w-1/2">Total Children</td>
                  <td className="py-1 px-2 text-slate-800 font-bold">{stats.totalChildren}</td>
                </tr>
                <tr className="border-b border-slate-100">
                  <td className="py-1 px-2 font-semibold text-slate-600">Unfilled Records (24h)</td>
                  <td className="py-1 px-2 text-slate-800 font-bold">{stats.last24hUnfilledMealRecords}</td>
                </tr>
                <tr className="border-b border-slate-100">
                  <td className="py-1 px-2 font-semibold text-slate-600">Registered Doctors</td>
                  <td className="py-1 px-2 text-slate-800">{stats.totalDoctors ?? 0}</td>
                </tr>
                <tr className="border-b border-slate-100">
                  <td className="py-1 px-2 font-semibold text-slate-600">Active Tokens</td>
                  <td className="py-1 px-2 text-slate-800">{stats.tokenSummary?.active ?? 0} / {stats.tokenSummary?.total ?? 0}</td>
                </tr>
                <tr className="border-b border-slate-100">
                  <td className="py-1 px-2 font-semibold text-slate-600">Classic Ketogenic Diet Children</td>
                  <td className="py-1 px-2 text-slate-800 font-bold">{stats.classicChildren ?? 0}</td>
                </tr>
                <tr className="border-b border-slate-100">
                  <td className="py-1 px-2 font-semibold text-slate-600">Modified Atkins Diet (MAD) Children</td>
                  <td className="py-1 px-2 text-slate-800 font-bold">{stats.madChildren ?? 0}</td>
                </tr>
                <tr className="border-b border-slate-100">
                  <td className="py-1 px-2 font-semibold text-slate-600">MCT Diet Children</td>
                  <td className="py-1 px-2 text-slate-800 font-bold">{stats.mctChildren ?? 0}</td>
                </tr>
                <tr>
                  <td className="py-1 px-2 font-semibold text-slate-600">Low Glycemic Index (Low GI) Children</td>
                  <td className="py-1 px-2 text-slate-800 font-bold">{stats.lowgiChildren ?? 0}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}

        {printSections.has("dietType") && classicData.some((d) => d.count > 0) && (
          <div>
            <h2 className="text-sm font-bold text-slate-800 mb-2">Classic Distribution</h2>
            <table className="w-full text-xs border-collapse max-w-xs">
              <thead>
                <tr className="bg-slate-100">
                  <th className="text-left py-1 px-2 font-semibold text-slate-600">Ratio</th>
                  <th className="text-left py-1 px-2 font-semibold text-slate-600">Count</th>
                  <th className="text-left py-1 px-2 font-semibold text-slate-600">%</th>
                </tr>
              </thead>
              <tbody>
                {classicData.map((d) => (
                  <tr key={d.ratio} className="border-b border-slate-100">
                    <td className="py-1 px-2 text-slate-700">{d.label}</td>
                    <td className="py-1 px-2 text-slate-800 font-bold">{d.count}</td>
                    <td className="py-1 px-2 text-slate-600">{totalClassic > 0 ? ((d.count / totalClassic) * 100).toFixed(1) : "0"}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {printSections.has("trend") && (
          <div>
            <h2 className="text-sm font-bold text-slate-800 mb-2">Compliance & Weight Trend (Weekly)</h2>
            <table className="w-full text-xs border-collapse max-w-sm">
              <thead>
                <tr className="bg-slate-100">
                  <th className="text-left py-1 px-2 font-semibold text-slate-600">Day</th>
                  <th className="text-left py-1 px-2 font-semibold text-slate-600">Compliance %</th>
                  <th className="text-left py-1 px-2 font-semibold text-slate-600">Weight Δ</th>
                </tr>
              </thead>
              <tbody>
                {WEEK_DATA.map((d) => (
                  <tr key={d.day} className="border-b border-slate-100">
                    <td className="py-1 px-2 text-slate-700">{d.day}</td>
                    <td className="py-1 px-2 text-slate-800">{d.compliance}%</td>
                    <td className="py-1 px-2 text-slate-600">{d.weight}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {printSections.has("activity") && Array.isArray(recentActivity) && recentActivity.length > 0 && (
          <div>
            <h2 className="text-sm font-bold text-slate-800 mb-2">Recent Activity</h2>
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100">
                  <th className="text-left py-1.5 px-2 font-semibold text-slate-600">Event</th>
                  <th className="text-left py-1.5 px-2 font-semibold text-slate-600">Patient</th>
                  <th className="text-left py-1.5 px-2 font-semibold text-slate-600">Description</th>
                  <th className="text-left py-1.5 px-2 font-semibold text-slate-600">When</th>
                </tr>
              </thead>
              <tbody>
                {recentActivity.map((a, i) => (
                  <tr key={i} className="border-b border-slate-100">
                    <td className="py-1.5 px-2 text-slate-800 font-medium capitalize">{a.title}</td>
                    <td className="py-1.5 px-2 text-slate-600">{a.kidName}</td>
                    <td className="py-1.5 px-2 text-slate-500">{a.description}</td>
                    <td className="py-1.5 px-2 text-slate-400 whitespace-nowrap">{formatRelativeTime(a.timestamp)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </PrintLayout>
  );
}
