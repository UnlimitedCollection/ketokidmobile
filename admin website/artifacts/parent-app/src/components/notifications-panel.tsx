import { useEffect, useRef, type RefObject } from "react";
import type { DashboardData } from "@/lib/api";

interface NotificationItem {
  id: string;
  icon: string;
  title: string;
  message: string;
  color: string;
  pending: boolean;
}

function deriveNotifications(data: DashboardData | null): NotificationItem[] {
  if (!data) return [];

  const items: NotificationItem[] = [];

  const emptyMeals = data.todayMeals.filter(
    (m) => m.status === "empty" && m.mealTypeName !== "snack"
  );
  for (const meal of emptyMeals) {
    items.push({
      id: `empty-${meal.mealTypeId}`,
      icon: "restaurant",
      title: `${meal.mealTypeName} not planned`,
      message: `You haven't planned ${meal.mealTypeName} yet today. Tap to add foods.`,
      color: "text-amber-600",
      pending: true,
    });
  }

  const unknownMeals = data.todayMeals.filter(
    (m) => m.status === "planned" && m.ateStatus === "unknown"
  );
  for (const meal of unknownMeals) {
    items.push({
      id: `unlogged-${meal.mealTypeId}`,
      icon: "pending_actions",
      title: `Log ${meal.mealTypeName}`,
      message: `${meal.mealTypeName} is planned but not logged yet. Did your child eat it?`,
      color: "text-blue-600",
      pending: true,
    });
  }

  const { dailyProgress } = data;
  if (dailyProgress.caloriesTarget > 0) {
    const pct = dailyProgress.overallPercent;
    if (pct >= 100) {
      items.push({
        id: "target-met",
        icon: "celebration",
        title: "Daily target reached!",
        message: "Great job — all nutrition targets have been met for today.",
        color: "text-green-600",
        pending: false,
      });
    } else if (pct >= 75) {
      items.push({
        id: "almost-there",
        icon: "trending_up",
        title: "Almost there!",
        message: `${pct}% of daily nutrition targets reached. Keep going!`,
        color: "text-green-600",
        pending: false,
      });
    }
  }

  if (dailyProgress.carbsTarget > 0 && dailyProgress.carbsConsumed > dailyProgress.carbsTarget) {
    items.push({
      id: "carbs-over",
      icon: "warning",
      title: "Carbs over target",
      message: `Carb intake (${dailyProgress.carbsConsumed.toFixed(1)}g) has exceeded the daily limit of ${dailyProgress.carbsTarget}g.`,
      color: "text-red-600",
      pending: true,
    });
  }

  if (items.length === 0) {
    items.push({
      id: "all-good",
      icon: "check_circle",
      title: "You're all set!",
      message: "No pending items right now. Everything looks good.",
      color: "text-green-600",
      pending: false,
    });
  }

  return items;
}

interface NotificationsPanelProps {
  data: DashboardData | null;
  onClose: () => void;
  excludeRef?: RefObject<HTMLElement | null>;
}

export function NotificationsPanel({ data, onClose, excludeRef }: NotificationsPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node;
      if (excludeRef?.current?.contains(target)) return;
      if (panelRef.current && !panelRef.current.contains(target)) {
        onClose();
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onClose, excludeRef]);

  const notifications = deriveNotifications(data);

  return (
    <div
      ref={panelRef}
      className="absolute right-4 top-14 w-80 max-h-96 overflow-y-auto bg-white rounded-2xl shadow-xl border border-slate-200 z-[100] animate-in fade-in slide-in-from-top-2 duration-200"
    >
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <h3 className="font-bold text-base text-on-background">Notifications</h3>
        <button
          onClick={onClose}
          className="p-1 rounded-full hover:bg-slate-100 transition-colors"
        >
          <span className="material-symbols-outlined text-slate-400 text-xl">close</span>
        </button>
      </div>
      <div className="px-2 pb-2">
        {notifications.map((n) => (
          <div
            key={n.id}
            className="flex items-start gap-3 px-3 py-3 rounded-xl hover:bg-slate-50 transition-colors"
          >
            <span className={`material-symbols-outlined ${n.color} text-xl mt-0.5 shrink-0`}>
              {n.icon}
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-on-background leading-tight">{n.title}</p>
              <p className="text-xs text-on-surface-variant mt-0.5 leading-snug">{n.message}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function useNotificationCount(data: DashboardData | null): number {
  if (!data) return 0;
  const notifications = deriveNotifications(data);
  return notifications.filter((n) => n.pending).length;
}
