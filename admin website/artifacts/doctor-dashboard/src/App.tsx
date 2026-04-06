import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useGetMe } from "@workspace/api-client-react";
import { Loader2 } from "lucide-react";
import { useEffect } from "react";
import { useIsAdmin } from "@/hooks/useRole";

// Components
import { AppLayout } from "@/components/layout";
import NotFound from "@/pages/not-found";

// Pages
import LoginPage from "@/pages/login";
import DashboardPage from "@/pages/dashboard";
import KidsListPage from "@/pages/kids-list";
import KidProfilePage from "@/pages/kid-profile";
import AddKidPage from "@/pages/add-kid";
import FoodsPage from "@/pages/foods";
import TokensPage from "@/pages/tokens";
import SettingsPage from "@/pages/settings";
import UsersPage from "@/pages/users";
import SetPasswordPage from "@/pages/set-password";
import AnalyticsPage from "@/pages/analytics";
import KidAnalyticsPage from "@/pages/kid-analytics";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
    },
  },
});

function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const [, setLocation] = useLocation();
  const { data: user, isLoading, error } = useGetMe();

  useEffect(() => {
    if (!isLoading && (error || !user)) {
      setLocation("/login");
    } else if (!isLoading && user && user.mustChangePassword) {
      setLocation("/set-password");
    }
  }, [user, isLoading, error, setLocation]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  if (!user || user.mustChangePassword) return null;

  return (
    <AppLayout>
      <Component />
    </AppLayout>
  );
}

function AdminRoute({ component: Component }: { component: React.ComponentType }) {
  const [, setLocation] = useLocation();
  const { data: user, isLoading, error } = useGetMe();
  const isAdmin = useIsAdmin();

  useEffect(() => {
    if (!isLoading && (error || !user)) {
      setLocation("/login");
    } else if (!isLoading && user && user.mustChangePassword) {
      setLocation("/set-password");
    } else if (!isLoading && user && !isAdmin) {
      setLocation("/");
    }
  }, [user, isLoading, error, isAdmin, setLocation]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  if (!user || user.mustChangePassword || !isAdmin) return null;

  return (
    <AppLayout>
      <Component />
    </AppLayout>
  );
}

function RedirectTo({ to }: { to: string }) {
  const [, setLocation] = useLocation();
  useEffect(() => { setLocation(to); }, [to, setLocation]);
  return null;
}

function Router() {
  return (
    <Switch>
      <Route path="/login" component={LoginPage} />
      <Route path="/" component={() => <ProtectedRoute component={DashboardPage} />} />
      <Route path="/kids" component={() => <ProtectedRoute component={KidsListPage} />} />
      <Route path="/kids/new" component={() => <AdminRoute component={AddKidPage} />} />
      <Route path="/kids/:id/analytics" component={() => <ProtectedRoute component={KidAnalyticsPage} />} />
      <Route path="/kids/:id" component={() => <ProtectedRoute component={KidProfilePage} />} />
      <Route path="/foods" component={() => <ProtectedRoute component={FoodsPage} />} />
      <Route path="/tokens" component={() => <ProtectedRoute component={TokensPage} />} />
      <Route path="/settings" component={() => <ProtectedRoute component={SettingsPage} />} />
      <Route path="/analytics" component={() => <ProtectedRoute component={AnalyticsPage} />} />
      <Route path="/users" component={() => <AdminRoute component={UsersPage} />} />
      <Route path="/set-password" component={SetPasswordPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}
