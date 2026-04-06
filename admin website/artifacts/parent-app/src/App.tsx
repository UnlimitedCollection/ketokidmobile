import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { useEffect, useState } from "react";
import SplashScreen from "@/components/splash-screen";

import LoginPage from "@/pages/login";
import DashboardPage from "@/pages/dashboard";
import MealPlannerPage from "@/pages/meal-planner";
import HistoryPage from "@/pages/history";
import LogPage from "@/pages/log";
import ProfilePage from "@/pages/profile";

function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const [, setLocation] = useLocation();
  const { isAuthenticated, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      setLocation("/login");
    }
  }, [isAuthenticated, isLoading, setLocation]);

  if (isLoading || !isAuthenticated) return null;

  return <Component />;
}

function PublicRoute({ component: Component }: { component: React.ComponentType }) {
  const [, setLocation] = useLocation();
  const { isAuthenticated, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      setLocation("/");
    }
  }, [isAuthenticated, isLoading, setLocation]);

  if (isLoading || isAuthenticated) return null;

  return <Component />;
}

function AppContent() {
  const { isLoading } = useAuth();
  const [showSplash, setShowSplash] = useState(true);
  const [minTimeElapsed, setMinTimeElapsed] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setMinTimeElapsed(true);
    }, 2000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!isLoading && minTimeElapsed) {
      setShowSplash(false);
    }
  }, [isLoading, minTimeElapsed]);

  return (
    <>
      <SplashScreen isVisible={showSplash} />
      <Switch>
        <Route path="/login" component={() => <PublicRoute component={LoginPage} />} />
        <Route path="/" component={() => <ProtectedRoute component={DashboardPage} />} />
        <Route path="/plan/:mealTypeId" component={() => <ProtectedRoute component={MealPlannerPage} />} />
        <Route path="/log" component={() => <ProtectedRoute component={LogPage} />} />
        <Route path="/history" component={() => <ProtectedRoute component={HistoryPage} />} />
        <Route path="/profile" component={() => <ProtectedRoute component={ProfilePage} />} />
      </Switch>
    </>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <WouterRouter base={import.meta.env.BASE_URL?.replace(/\/$/, "") || ""}>
        <AppContent />
      </WouterRouter>
    </AuthProvider>
  );
}
