const API_BASE = "/api/parent";

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(res.status, body.message || res.statusText);
  }
  if (res.status === 204) return null as T;
  return res.json();
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export interface ChildInfo {
  id: number;
  name: string;
  kidCode: string;
  dateOfBirth: string;
  gender: string;
  dietType: string;
  dietSubCategory: string | null;
  ketoRatio: string | null;
  dailyCalories: number | null;
  dailyCarbs: number | null;
  dailyFat: number | null;
  dailyProtein: number | null;
  parentName: string;
}

export interface MealTypeInfo {
  id: number;
  name: string;
  sortOrder: number;
  icon: string;
}

export interface DashboardData {
  child: ChildInfo;
  mealTypes: MealTypeInfo[];
  todayMeals: TodayMeal[];
  dailyProgress: {
    carbsConsumed: number;
    carbsTarget: number;
    fatConsumed: number;
    fatTarget: number;
    proteinConsumed: number;
    proteinTarget: number;
    caloriesConsumed: number;
    caloriesTarget: number;
    overallPercent: number;
  };
}

export interface TodayMeal {
  mealTypeId: number;
  mealTypeName: string;
  status: "empty" | "planned" | "consumed" | "not_involved";
  mealPlanId: number | null;
  foods: MealFood[];
  ateStatus: "unknown" | "yes" | "no";
  portionPercent: number | null;
}

export interface MealFood {
  id: number;
  foodId: number;
  foodName: string;
  foodImage: string | null;
  category: string | null;
  quantity: string | null;
  carbs: number;
  fat: number;
  protein: number;
  calories: number;
}

export interface FoodItem {
  id: number;
  name: string;
  category: string | null;
  carbs: number;
  fat: number;
  protein: number;
  calories: number;
  imageUrl: string | null;
  description: string | null;
  indicator: string | null;
  quantity: string | null;
}

export interface HistoryDay {
  date: string;
  meals: TodayMeal[];
  dailyProgress: {
    carbsConsumed: number;
    carbsTarget: number;
    fatConsumed: number;
    fatTarget: number;
    proteinConsumed: number;
    proteinTarget: number;
    caloriesConsumed: number;
    caloriesTarget: number;
  };
}

export const api = {
  login: (token: string) =>
    apiFetch<{ success: boolean; child: ChildInfo }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ token }),
    }),

  logout: () =>
    apiFetch<void>("/auth/logout", { method: "POST" }),

  getDashboard: () =>
    apiFetch<DashboardData>("/dashboard"),

  getFoods: (kpiFilter: string) =>
    apiFetch<FoodItem[]>(`/foods?kpi=${kpiFilter}`),

  saveMealPlan: (mealTypeId: number, foodIds: number[]) =>
    apiFetch<{ mealPlanId: number }>("/meal-plans", {
      method: "POST",
      body: JSON.stringify({ mealTypeId, foodIds }),
    }),

  updateMealPlan: (mealPlanId: number, foodIds: number[]) =>
    apiFetch<void>(`/meal-plans/${mealPlanId}`, {
      method: "PUT",
      body: JSON.stringify({ foodIds }),
    }),

  copyMeal: (sourceMealTypeId: number, targetMealTypeId: number) =>
    apiFetch<{ mealPlanId: number }>("/meal-plans/copy", {
      method: "POST",
      body: JSON.stringify({ sourceMealTypeId, targetMealTypeId }),
    }),

  updateEatStatus: (mealPlanId: number, ateStatus: "yes" | "no", portionPercent?: number) =>
    apiFetch<void>(`/meal-plans/${mealPlanId}/eat-status`, {
      method: "PUT",
      body: JSON.stringify({ ateStatus, portionPercent }),
    }),

  getHistory: (days?: number) =>
    apiFetch<HistoryDay[]>(`/history?days=${days || 7}`),
};
