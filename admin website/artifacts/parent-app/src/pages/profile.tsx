import { useAuth } from "@/hooks/useAuth";
import { AppHeader } from "@/components/header";
import { BottomNav } from "@/components/bottom-nav";

export default function ProfilePage() {
  const { child, logout } = useAuth();

  return (
    <div className="min-h-screen bg-surface pb-32">
      <AppHeader />
      <main className="max-w-2xl mx-auto px-6 py-8">
        <h2 className="text-[2rem] font-bold tracking-tight leading-none mb-1">Profile</h2>
        <p className="text-on-surface-variant font-medium mb-8">Account and child information</p>

        <section className="bg-surface-container-lowest rounded-lg p-6 border border-outline-variant/10 mb-6">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary to-primary-container flex items-center justify-center text-white text-2xl font-bold shadow-lg">
              {child?.name?.charAt(0) || "K"}
            </div>
            <div>
              <h3 className="text-xl font-bold text-on-surface">{child?.name || "Child"}</h3>
              <p className="text-sm text-on-surface-variant">Code: {child?.kidCode || "—"}</p>
            </div>
          </div>

          <div className="space-y-4">
            <InfoRow label="Date of Birth" value={child?.dateOfBirth ? new Date(child.dateOfBirth).toLocaleDateString() : "—"} />
            <InfoRow label="Gender" value={child?.gender || "—"} />
            <InfoRow label="Diet Type" value={child?.dietType ? child.dietType.charAt(0).toUpperCase() + child.dietType.slice(1) : "—"} />
            {child?.dietSubCategory && (
              <InfoRow label="Sub Category" value={child.dietSubCategory} />
            )}
            {child?.ketoRatio && (
              <InfoRow label="Keto Ratio" value={child.ketoRatio} />
            )}
          </div>
        </section>

        <section className="bg-surface-container-lowest rounded-lg p-6 border border-outline-variant/10 mb-6">
          <h3 className="font-bold text-lg text-on-surface mb-4">Nutrition Targets</h3>
          <div className="grid grid-cols-2 gap-4">
            <TargetCard label="Daily Calories" value={child?.dailyCalories ? `${child.dailyCalories} kcal` : "—"} icon="local_fire_department" />
            <TargetCard label="Daily Carbs" value={child?.dailyCarbs ? `${child.dailyCarbs}g` : "—"} icon="grain" />
            <TargetCard label="Daily Fat" value={child?.dailyFat ? `${child.dailyFat}g` : "—"} icon="water_drop" />
            <TargetCard label="Daily Protein" value={child?.dailyProtein ? `${child.dailyProtein}g` : "—"} icon="fitness_center" />
          </div>
        </section>

        <section className="bg-surface-container-lowest rounded-lg p-6 border border-outline-variant/10 mb-6">
          <h3 className="font-bold text-lg text-on-surface mb-4">Parent Information</h3>
          <InfoRow label="Parent Name" value={child?.parentName || "—"} />
        </section>

        <button
          onClick={logout}
          className="w-full py-4 rounded-full font-bold text-lg text-error hover:bg-error/5 active:scale-[0.98] transition-all"
        >
          Log Out
        </button>
      </main>
      <BottomNav />
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-2">
      <span className="text-sm text-on-surface-variant">{label}</span>
      <span className="text-sm font-bold text-on-surface">{value}</span>
    </div>
  );
}

function TargetCard({ label, value, icon }: { label: string; value: string; icon: string }) {
  return (
    <div className="bg-surface-container-low rounded-xl p-4 text-center">
      <span className="material-symbols-outlined text-primary text-xl mb-2">{icon}</span>
      <p className="text-[10px] font-bold text-on-surface-variant uppercase">{label}</p>
      <p className="text-lg font-bold text-on-surface mt-1">{value}</p>
    </div>
  );
}
