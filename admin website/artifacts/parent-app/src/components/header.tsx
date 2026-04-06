import { useState, useEffect, useCallback, useRef } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { api, type DashboardData } from "@/lib/api";
import { NotificationsPanel, useNotificationCount } from "@/components/notifications-panel";

export function AppHeader() {
  const { child } = useAuth();
  const [, setLocation] = useLocation();
  const [showNotifications, setShowNotifications] = useState(false);
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const bellRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    api.getDashboard().then(setDashboardData).catch(() => {});
  }, []);

  const notificationCount = useNotificationCount(dashboardData);

  const toggleNotifications = useCallback(() => {
    setShowNotifications((prev) => !prev);
  }, []);

  const closeNotifications = useCallback(() => {
    setShowNotifications(false);
  }, []);

  return (
    <header className="bg-white/90 backdrop-blur-xl sticky top-0 z-50 shadow-sm shadow-green-900/5 flex justify-between items-center px-6 h-16 w-full">
      <div className="flex items-center gap-3">
        <h1 className="font-bold tracking-tight text-on-background text-xl">
          KetoKid Care
        </h1>
      </div>
      <div className="flex items-center gap-4">
        <button
          ref={bellRef}
          onClick={toggleNotifications}
          className="text-slate-500 hover:bg-green-50 transition-colors active:scale-95 duration-200 p-2 rounded-full relative"
        >
          <span className="material-symbols-outlined">notifications</span>
          {notificationCount > 0 && (
            <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-red-500 rounded-full ring-2 ring-white" />
          )}
        </button>
        <button
          onClick={() => setLocation("/profile")}
          className="w-10 h-10 rounded-full overflow-hidden bg-primary/10 flex items-center justify-center text-primary font-bold hover:ring-2 hover:ring-primary/30 active:scale-95 transition-all duration-200 cursor-pointer"
        >
          {child?.name?.charAt(0) || "P"}
        </button>
      </div>
      {showNotifications && (
        <NotificationsPanel data={dashboardData} onClose={closeNotifications} excludeRef={bellRef} />
      )}
    </header>
  );
}

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  onBack?: () => void;
}

export function PageHeader({ title, subtitle, onBack }: PageHeaderProps) {
  return (
    <header className="fixed top-0 w-full z-50 bg-white/95 backdrop-blur-xl shadow-sm h-auto flex flex-col items-start justify-center px-6 py-5">
      <div className="flex items-center gap-4 w-full">
        {onBack && (
          <button
            onClick={onBack}
            className="flex items-center justify-center w-10 h-10 -ml-2 rounded-full hover:bg-slate-100 transition-colors duration-200"
          >
            <span className="material-symbols-outlined text-on-background text-2xl">
              chevron_left
            </span>
          </button>
        )}
        <div>
          <h1 className="font-bold text-2xl text-on-background tracking-tight">
            {title}
          </h1>
          {subtitle && (
            <p className="text-sm text-on-surface-variant font-medium mt-1">
              {subtitle}
            </p>
          )}
        </div>
      </div>
    </header>
  );
}
