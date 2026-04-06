import { Link, useLocation } from "wouter";
import { useGetMe, useDoctorLogout } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useIsAdmin, useIsModerator } from "@/hooks/useRole";

function IconDashboard() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 24 24">
      <path d="M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z"/>
    </svg>
  );
}
function IconChildren() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 24 24">
      <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/>
    </svg>
  );
}
function IconAnalysis() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 24 24">
      <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM9 17H7v-7h2v7zm4 0h-2V7h2v10zm4 0h-2v-4h2v4z"/>
    </svg>
  );
}
function IconVisibility() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 24 24">
      <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/>
    </svg>
  );
}
function IconNotes() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 24 24">
      <path d="M19 3h-4.18C14.4 1.84 13.3 1 12 1c-1.3 0-2.4.84-2.82 2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 0c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm2 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z"/>
    </svg>
  );
}
function IconSettings() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 24 24">
      <path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"/>
    </svg>
  );
}
function IconLogout() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 24 24">
      <path d="M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.58L17 17l5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z"/>
    </svg>
  );
}

function IconAccount() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" fill="currentColor" viewBox="0 0 24 24">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"/>
    </svg>
  );
}

function IconKey() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 24 24">
      <path d="M12.65 10C11.83 7.67 9.61 6 7 6c-3.31 0-6 2.69-6 6s2.69 6 6 6c2.61 0 4.83-1.67 5.65-4H17v4h4v-4h2v-4H12.65zM7 14c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2z"/>
    </svg>
  );
}
function IconUsers() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 24 24">
      <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
    </svg>
  );
}

const BASE_NAV_ITEMS = [
  { title: "Dashboard",   url: "/",           icon: IconDashboard  },
  { title: "Children",    url: "/kids",       icon: IconChildren   },
  { title: "Analytics",   url: "/analytics",  icon: IconAnalysis   },
  { title: "Foods",       url: "/foods",      icon: IconVisibility },
];

const ADMIN_NAV_ITEMS = [
  ...BASE_NAV_ITEMS,
  { title: "Tokens",      url: "/tokens",   icon: IconKey        },
  { title: "User Management", url: "/users", icon: IconUsers },
];

function isNavActive(url: string, location: string): boolean {
  if (url === "/") return location === "/";
  const base = url.split("?")[0];
  return location === base || location.startsWith(base + "/");
}

function AppSidebar() {
  const [location, setLocation] = useLocation();
  const { data: user } = useGetMe();
  const logout = useDoctorLogout();
  const queryClient = useQueryClient();
  const isAdmin = useIsAdmin();
  const isModerator = useIsModerator();

  const navItems = isAdmin ? ADMIN_NAV_ITEMS : BASE_NAV_ITEMS;

  const handleNavClick = (item: typeof BASE_NAV_ITEMS[0]) => {
    setLocation(item.url);
  };

  const handleLogout = () => {
    logout.mutate(undefined, {
      onSuccess: () => {
        queryClient.clear();
        window.location.href = "/login";
      }
    });
  };

  const initials = user?.name
    ? user.name.split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase()
    : "DR";

  const role = user?.role as string | undefined;

  return (
    <aside className="fixed left-0 top-0 h-full w-64 bg-slate-50 border-r border-slate-200 flex flex-col py-6 z-50 shrink-0">
      <div className="px-6 mb-8">
        <h1 className="text-xl font-black text-blue-800 tracking-tighter">KetoKid Care</h1>
      </div>

      <div className="px-4 mb-8">
        <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-100">
          <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-sm shrink-0">
            {initials}
          </div>
          <div className="overflow-hidden flex-1 min-w-0">
            <p className="text-sm font-bold text-slate-800 truncate">
              {user?.name ? user.name.split(" ").slice(-1)[0] : "User"}
            </p>
            <div className="flex items-center gap-1.5 mt-0.5">
              <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold truncate">
                {user?.designation || "Pediatric Neurology"}
              </p>
              {role && (
                <span className={`shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded-full
                  ${role === "admin"
                    ? "bg-blue-100 text-blue-700 uppercase tracking-wider"
                    : "bg-amber-100 text-amber-700"
                  }`}>
                  {role === "admin" ? "Admin" : "Moderator – View Only"}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      <nav className="flex-1 px-3 space-y-0.5">
        {navItems.map((item) => {
          const active = isNavActive(item.url, location);
          return (
            <button
              key={item.title}
              onClick={() => handleNavClick(item)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all text-left
                ${active
                  ? "text-blue-700 font-bold border-r-4 border-blue-600 bg-blue-50"
                  : "text-slate-600 hover:text-blue-600 hover:bg-slate-100 font-medium"
                }`}
            >
              <item.icon />
              <span>{item.title}</span>
            </button>
          );
        })}
      </nav>

      <div className="px-3 pt-4 mt-4 border-t border-slate-200 space-y-0.5">
        {!isModerator && (
          <Link
            href="/settings"
            className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium w-full text-left transition-all
              ${isNavActive("/settings", location)
                ? "text-blue-700 font-bold border-r-4 border-blue-600 bg-blue-50"
                : "text-slate-600 hover:text-blue-600 hover:bg-slate-100"
              }`}
          >
            <IconSettings />
            <span>Settings</span>
          </Link>
        )}
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-2 text-slate-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all text-sm font-medium w-full text-left"
        >
          <IconLogout />
          <span>Logout</span>
        </button>
      </div>
    </aside>
  );
}

function ProfileDropdown() {
  const [, setLocation] = useLocation();
  const [open, setOpen] = useState(false);
  const { data: user } = useGetMe();
  const logout = useDoctorLogout();
  const queryClient = useQueryClient();
  const isModerator = useIsModerator();

  const handleLogout = () => {
    setOpen(false);
    logout.mutate(undefined, {
      onSuccess: () => {
        queryClient.clear();
        window.location.href = "/login";
      }
    });
  };

  const initials = user?.name
    ? user.name.split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase()
    : "DR";

  const role = user?.role as string | undefined;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className="p-2 text-slate-500 hover:bg-slate-50 rounded-full transition-colors" aria-label="Profile menu">
          <IconAccount />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 p-0 rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
        <div className="px-4 py-4 border-b border-slate-100 bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-sm shrink-0">
              {initials}
            </div>
            <div className="overflow-hidden flex-1 min-w-0">
              <p className="text-sm font-bold text-slate-800 truncate">
                {user?.name ? user.name.split(" ").slice(-1)[0] : "User"}
              </p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold truncate">
                  {user?.designation || "Pediatric Neurology"}
                </p>
                {role && (
                  <span className={`shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded-full
                    ${role === "admin"
                      ? "bg-blue-100 text-blue-700 uppercase tracking-wider"
                      : "bg-amber-100 text-amber-700"
                    }`}>
                    {role === "admin" ? "Admin" : "Moderator – View Only"}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
        <div className="py-1">
          {!isModerator && (
            <button
              className="w-full text-left px-4 py-2.5 hover:bg-slate-50 transition-colors flex items-center gap-3 text-sm font-medium text-slate-700"
              onClick={() => { setOpen(false); setLocation("/settings"); }}
            >
              <IconSettings />
              <span>Settings</span>
            </button>
          )}
          <button
            className="w-full text-left px-4 py-2.5 hover:bg-red-50 transition-colors flex items-center gap-3 text-sm font-medium text-slate-600 hover:text-red-600"
            onClick={handleLogout}
          >
            <IconLogout />
            <span>Logout</span>
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function AppHeader() {
  return (
    <header className="app-shell-header sticky top-0 w-full z-40 bg-white/90 backdrop-blur-md flex items-center gap-4 px-8 py-3 shadow-sm border-b border-slate-200">
      <div className="flex-1" />
      <div className="flex items-center gap-1">
        <ProfileDropdown />
      </div>
    </header>
  );
}

export function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-[#f7f9fb]">
      <AppSidebar />
      <div className="flex flex-col flex-1 ml-64 min-w-0">
        <AppHeader />
        <main className="flex-1 overflow-auto p-8 md:p-10">
          <div className="mx-auto max-w-7xl w-full">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
