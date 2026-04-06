import { useAuth } from "@/hooks/useAuth";

export function AppHeader() {
  const { child } = useAuth();

  return (
    <header className="bg-white/90 backdrop-blur-xl sticky top-0 z-50 shadow-sm shadow-green-900/5 flex justify-between items-center px-6 h-16 w-full">
      <div className="flex items-center gap-3">
        <h1 className="font-bold tracking-tight text-on-background text-xl">
          KetoKid Care
        </h1>
      </div>
      <div className="flex items-center gap-4">
        <button className="text-slate-500 hover:bg-green-50 transition-colors active:scale-95 duration-200 p-2 rounded-full relative">
          <span className="material-symbols-outlined">notifications</span>
        </button>
        <div className="w-10 h-10 rounded-full overflow-hidden bg-primary/10 flex items-center justify-center text-primary font-bold">
          {child?.name?.charAt(0) || "P"}
        </div>
      </div>
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
