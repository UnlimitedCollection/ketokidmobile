import { useState, useEffect, useMemo } from "react";
import { api, type LogData, type WeightRecord } from "@/lib/api";
import { AppHeader } from "@/components/header";
import { BottomNav } from "@/components/bottom-nav";

export default function LogPage() {
  const [logData, setLogData] = useState<LogData | null>(null);
  const [weightData, setWeightData] = useState<WeightRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setError(null);
    Promise.all([
      api.getLog(),
      api.getWeightHistory().catch(() => []),
    ]).then(([log, weight]) => {
      setLogData(log);
      setWeightData(weight);
    }).catch(() => {
      setError("Failed to load log data. Please try again.");
    }).finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-surface pb-32">
      <AppHeader />
      <main className="max-w-2xl mx-auto px-6 py-8">
        <h2 className="text-[2rem] font-bold tracking-tight leading-none mb-1">Log</h2>
        <p className="text-on-surface-variant font-medium mb-8">Compliance overview & weight tracking</p>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-8 h-8 border-3 border-primary/20 border-t-primary rounded-full animate-spin" />
          </div>
        ) : error ? (
          <div className="text-center py-16">
            <span className="material-symbols-outlined text-red-400 text-5xl mb-3">error</span>
            <p className="text-on-surface-variant font-medium mb-4">{error}</p>
            <button
              onClick={() => { setLoading(true); setError(null); Promise.all([api.getLog(), api.getWeightHistory().catch(() => [])]).then(([log, weight]) => { setLogData(log); setWeightData(weight); }).catch(() => setError("Failed to load log data. Please try again.")).finally(() => setLoading(false)); }}
              className="text-primary font-bold"
            >
              Retry
            </button>
          </div>
        ) : (
          <>
            <StatCards summary={logData?.summary} />
            <ComplianceHeatmap dailyBreakdown={logData?.dailyBreakdown || []} />
            <WeightTracker records={weightData} />
          </>
        )}
      </main>
      <BottomNav />
    </div>
  );
}

function StatCards({ summary }: { summary?: LogData["summary"] | null }) {
  const stats = [
    {
      label: "DAYS TRACKED",
      value: summary?.daysTracked ?? 0,
      bg: "bg-green-50",
      text: "text-on-surface",
    },
    {
      label: "FULL COMPLIANCE",
      value: summary?.fullCompliance ?? 0,
      bg: "bg-white",
      text: "text-green-600",
    },
    {
      label: "PARTIAL DAYS",
      value: summary?.partialDays ?? 0,
      bg: "bg-amber-50",
      text: "text-on-surface",
    },
    {
      label: "MISSED DAYS",
      value: summary?.missedDays ?? 0,
      bg: "bg-red-50",
      text: "text-red-800",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 mb-8">
      {stats.map((s) => (
        <div key={s.label} className={`${s.bg} rounded-2xl p-4 border border-outline-variant/10`}>
          <p className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant mb-1">{s.label}</p>
          <p className={`text-3xl font-bold ${s.text}`}>{s.value}</p>
        </div>
      ))}
    </div>
  );
}

function ComplianceHeatmap({ dailyBreakdown }: { dailyBreakdown: LogData["dailyBreakdown"] }) {
  const [tooltip, setTooltip] = useState<{ date: string; status: string; x: number; y: number } | null>(null);

  const { weeks, monthLabels } = useMemo(() => {
    const today = new Date();
    const startDate = new Date();
    startDate.setDate(today.getDate() - 59); // 60-day inclusive window matching backend

    const dayOfWeek = startDate.getDay();
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    startDate.setDate(startDate.getDate() + mondayOffset);

    const statusMap = new Map<string, string>();
    for (const d of dailyBreakdown) {
      statusMap.set(d.date, d.status);
    }

    const weeks: { date: Date; dateStr: string; status: string; isInRange: boolean }[][] = [];
    let currentWeek: typeof weeks[0] = [];
    const monthLabelsSet = new Map<number, string>();

    const cursor = new Date(startDate);
    while (cursor <= today || currentWeek.length > 0) {
      const dateStr = cursor.toISOString().split("T")[0];
      const isInRange = cursor <= today;
      const isFuture = cursor > today;

      if (!isFuture) {
        currentWeek.push({
          date: new Date(cursor),
          dateStr,
          status: statusMap.get(dateStr) || "no-data",
          isInRange,
        });
      }

      if (cursor.getDay() === 0 || isFuture) {
        if (currentWeek.length > 0) {
          weeks.push(currentWeek);
          currentWeek = [];
        }
        if (isFuture) break;
      }

      if (cursor.getDate() === 1 || (weeks.length === 0 && currentWeek.length === 1)) {
        monthLabelsSet.set(weeks.length, cursor.toLocaleDateString("en-US", { month: "long", year: "numeric" }));
      }

      cursor.setDate(cursor.getDate() + 1);
    }

    if (currentWeek.length > 0) {
      weeks.push(currentWeek);
    }

    const monthLabels: { weekIndex: number; label: string }[] = [];
    for (const [idx, label] of monthLabelsSet) {
      monthLabels.push({ weekIndex: idx, label });
    }

    return { weeks, monthLabels };
  }, [dailyBreakdown]);

  const statusColor: Record<string, string> = {
    "no-data": "bg-slate-100",
    missed: "bg-red-400",
    partial: "bg-amber-400",
    full: "bg-green-500",
  };

  const statusLabel: Record<string, string> = {
    "no-data": "No data",
    missed: "Missed",
    partial: "Partial",
    full: "Full compliance",
  };

  const dayLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  function handleCellInteraction(e: React.MouseEvent | React.TouchEvent, cell: typeof weeks[0][0]) {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setTooltip({
      date: new Date(cell.dateStr + "T12:00:00").toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
      }),
      status: statusLabel[cell.status],
      x: rect.left + rect.width / 2,
      y: rect.top - 8,
    });
  }

  return (
    <div className="bg-surface-container-lowest rounded-2xl p-5 border border-outline-variant/10 mb-8">
      <div className="flex items-center gap-2 mb-1">
        <span className="material-symbols-outlined text-on-surface text-xl">grid_view</span>
        <h3 className="font-bold text-lg text-on-surface">Compliance Heatmap</h3>
      </div>
      <p className="text-sm text-on-surface-variant mb-4">
        Daily meal completion over the last 2 months. Hover a cell for details.
      </p>

      <div className="flex items-center gap-4 mb-5 flex-wrap">
        {Object.entries(statusColor).map(([key, color]) => (
          <div key={key} className="flex items-center gap-1.5">
            <div className={`w-3 h-3 rounded-sm ${color}`} />
            <span className="text-xs text-on-surface-variant font-medium">{statusLabel[key]}</span>
          </div>
        ))}
      </div>

      {monthLabels.map((ml, mIdx) => {
        const nextMonthStart = monthLabels[mIdx + 1]?.weekIndex ?? weeks.length;
        const monthWeeks = weeks.slice(ml.weekIndex, nextMonthStart);

        return (
          <div key={ml.label} className="mb-4">
            <p className="text-sm font-bold text-center text-on-surface mb-2">{ml.label}</p>
            <div className="grid grid-cols-7 gap-1 mb-1">
              {dayLabels.map((d) => (
                <div key={d} className="text-[10px] font-bold text-on-surface-variant text-center">{d}</div>
              ))}
            </div>
            {monthWeeks.map((week, wIdx) => {
              const paddedWeek = [...week];
              if (wIdx === 0 && paddedWeek.length < 7) {
                const startDay = paddedWeek[0]?.date.getDay();
                const mondayBasedStart = startDay === 0 ? 6 : startDay - 1;
                const padding = Array(mondayBasedStart).fill(null);
                paddedWeek.unshift(...padding);
              }

              return (
                <div key={wIdx} className="grid grid-cols-7 gap-1 mb-1">
                  {paddedWeek.map((cell, cIdx) =>
                    cell === null ? (
                      <div key={`empty-${cIdx}`} className="aspect-square rounded-md" />
                    ) : (
                      <div
                        key={cell.dateStr}
                        className={`aspect-square rounded-md cursor-pointer transition-transform hover:scale-110 ${statusColor[cell.status]}`}
                        onMouseEnter={(e) => handleCellInteraction(e, cell)}
                        onMouseLeave={() => setTooltip(null)}
                        onTouchStart={(e) => handleCellInteraction(e, cell)}
                      />
                    )
                  )}
                </div>
              );
            })}
          </div>
        );
      })}

      {tooltip && (
        <div
          className="fixed z-[100] bg-on-surface text-surface text-xs font-medium px-3 py-1.5 rounded-lg shadow-lg pointer-events-none transform -translate-x-1/2 -translate-y-full"
          style={{ left: tooltip.x, top: tooltip.y }}
        >
          {tooltip.date} — {tooltip.status}
        </div>
      )}
    </div>
  );
}

function WeightTracker({ records }: { records: WeightRecord[] }) {
  if (records.length === 0) {
    return (
      <div className="bg-surface-container-lowest rounded-2xl p-5 border border-outline-variant/10">
        <div className="flex items-center gap-2 mb-1">
          <span className="material-symbols-outlined text-on-surface text-xl">monitor_weight</span>
          <h3 className="font-bold text-lg text-on-surface">Weight Tracker</h3>
        </div>
        <div className="text-center py-10">
          <span className="material-symbols-outlined text-outline text-4xl mb-2">scale</span>
          <p className="text-on-surface-variant text-sm font-medium">No weight records yet</p>
        </div>
      </div>
    );
  }

  const weights = records.map((r) => r.weight);
  const minWeight = Math.floor(Math.min(...weights) * 10) / 10 - 0.5;
  const maxWeight = Math.ceil(Math.max(...weights) * 10) / 10 + 0.5;
  const range = maxWeight - minWeight || 1;

  const chartWidth = 600;
  const chartHeight = 200;
  const padding = { top: 20, right: 20, bottom: 40, left: 50 };
  const innerWidth = chartWidth - padding.left - padding.right;
  const innerHeight = chartHeight - padding.top - padding.bottom;

  const points = records.map((r, i) => ({
    x: padding.left + (records.length > 1 ? (i / (records.length - 1)) * innerWidth : innerWidth / 2),
    y: padding.top + innerHeight - ((r.weight - minWeight) / range) * innerHeight,
    weight: r.weight,
    date: r.date,
  }));

  function smoothPath(pts: typeof points): string {
    if (pts.length < 2) return "";
    let d = `M ${pts[0].x} ${pts[0].y}`;
    for (let i = 1; i < pts.length; i++) {
      const prev = pts[i - 1];
      const curr = pts[i];
      const cpx1 = prev.x + (curr.x - prev.x) / 3;
      const cpx2 = prev.x + (2 * (curr.x - prev.x)) / 3;
      d += ` C ${cpx1} ${prev.y}, ${cpx2} ${curr.y}, ${curr.x} ${curr.y}`;
    }
    return d;
  }

  const yTicks = 5;
  const yLabels = Array.from({ length: yTicks }, (_, i) => {
    const val = minWeight + (range / (yTicks - 1)) * i;
    return { val: Math.round(val * 100) / 100, y: padding.top + innerHeight - (i / (yTicks - 1)) * innerHeight };
  });

  const xTickCount = Math.min(records.length, 8);
  const xTicks = xTickCount <= 1
    ? [{ label: new Date(records[0].date + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" }), x: points[0].x }]
    : Array.from({ length: xTickCount }, (_, i) => {
        const idx = Math.round((i / (xTickCount - 1)) * (records.length - 1));
        return {
          label: new Date(records[idx].date + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" }),
          x: points[idx].x,
        };
      });

  return (
    <div className="bg-surface-container-lowest rounded-2xl p-5 border border-outline-variant/10">
      <div className="flex items-center gap-2 mb-1">
        <span className="material-symbols-outlined text-on-surface text-xl">monitor_weight</span>
        <h3 className="font-bold text-lg text-on-surface">Weight Tracker</h3>
      </div>
      <p className="text-sm text-on-surface-variant mb-4">Weight progress over time (kg)</p>

      <div className="w-full overflow-x-auto">
        <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="w-full h-auto" preserveAspectRatio="xMidYMid meet">
          {yLabels.map((yl) => (
            <g key={yl.val}>
              <line x1={padding.left} y1={yl.y} x2={chartWidth - padding.right} y2={yl.y} stroke="#e2e8f0" strokeWidth="0.5" />
              <text x={padding.left - 8} y={yl.y + 3} textAnchor="end" className="text-[9px] fill-slate-400">{yl.val}</text>
            </g>
          ))}

          {xTicks.map((xt, i) => (
            <text key={i} x={xt.x} y={chartHeight - 8} textAnchor="middle" className="text-[9px] fill-slate-400">{xt.label}</text>
          ))}

          <path d={smoothPath(points)} fill="none" stroke="#4AADE8" strokeWidth="2.5" strokeLinecap="round" />

          {points.map((p, i) => (
            <circle key={i} cx={p.x} cy={p.y} r="3.5" fill="#4AADE8" stroke="white" strokeWidth="1.5">
              <title>{`${new Date(p.date + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}: ${p.weight} kg`}</title>
            </circle>
          ))}
        </svg>
      </div>
    </div>
  );
}
