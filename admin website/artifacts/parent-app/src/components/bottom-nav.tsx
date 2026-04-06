import { useLocation } from "wouter";

const NAV_ITEMS = [
  { path: "/", icon: "home_health", activeIcon: "home_health", label: "Home" },
  { path: "/log", icon: "insert_chart", activeIcon: "insert_chart", label: "Log" },
  { path: "/history", icon: "history", activeIcon: "history", label: "History" },
  { path: "/profile", icon: "person", activeIcon: "person", label: "Profile" },
];

export function BottomNav() {
  const [location, setLocation] = useLocation();

  const currentPath = location === "/" ? "/" : `/${location.split("/")[1]}`;

  return (
    <nav className="fixed bottom-0 left-0 w-full z-50 rounded-t-[2.5rem] bg-white/80 backdrop-blur-xl shadow-[0_-4px_40px_rgba(0,110,47,0.06)] flex justify-around items-center px-4 pb-6 pt-3">
      {NAV_ITEMS.map((item) => {
        const isActive = currentPath === item.path;
        return (
          <button
            key={item.path}
            onClick={() => setLocation(item.path)}
            className={`flex flex-col items-center justify-center px-5 py-2 rounded-full transition-all active:scale-90 duration-150 ${
              isActive
                ? "bg-green-100 text-green-800"
                : "text-slate-400 hover:text-green-600"
            }`}
          >
            <span
              className={isActive ? "material-symbols-filled" : "material-symbols-outlined"}
            >
              {isActive ? item.activeIcon : item.icon}
            </span>
            <span className="text-[11px] font-semibold uppercase tracking-wider mt-1">
              {item.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
