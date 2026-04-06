export type KetoDietType = "classic" | "mad" | "mct" | "lowgi";

export const KETO_DIET_MEAL_TYPES: Record<KetoDietType, string[]> = {
  classic: ["Breakfast", "Lunch", "Dinner"],
  mad: ["Breakfast", "Lunch", "Dinner"],
  mct: ["Breakfast", "Lunch", "Snack", "Dinner"],
  lowgi: ["Breakfast", "Lunch", "Dinner"],
};

export const DEFAULT_MEAL_TYPES = ["Breakfast", "Lunch", "Dinner"];

export function getMealTypesForDiet(dietType: string): string[] {
  const normalized = dietType.toLowerCase() as KetoDietType;
  return KETO_DIET_MEAL_TYPES[normalized] ?? DEFAULT_MEAL_TYPES;
}
