import { pgTable, serial, varchar, integer, date, real, timestamp } from "drizzle-orm/pg-core";
import { kidsTable } from "./kids";
import { foodsTable } from "./foods";
import { mealTypesTable } from "./meal-types";

export const parentMealPlansTable = pgTable("parent_meal_plans", {
  id: serial("id").primaryKey(),
  kidId: integer("kid_id").notNull().references(() => kidsTable.id, { onDelete: "cascade" }),
  mealTypeId: integer("meal_type_id").notNull().references(() => mealTypesTable.id),
  date: date("date").notNull(),
  status: varchar("status", { length: 20 }).notNull().default("planned"),
  ateStatus: varchar("ate_status", { length: 10 }).notNull().default("unknown"),
  portionPercent: integer("portion_percent"),
  totalCalories: real("total_calories").default(0),
  totalCarbs: real("total_carbs").default(0),
  totalFat: real("total_fat").default(0),
  totalProtein: real("total_protein").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const parentMealPlanFoodsTable = pgTable("parent_meal_plan_foods", {
  id: serial("id").primaryKey(),
  mealPlanId: integer("meal_plan_id").notNull().references(() => parentMealPlansTable.id, { onDelete: "cascade" }),
  foodId: integer("food_id").notNull().references(() => foodsTable.id),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type ParentMealPlan = typeof parentMealPlansTable.$inferSelect;
export type InsertParentMealPlan = typeof parentMealPlansTable.$inferInsert;
export type ParentMealPlanFood = typeof parentMealPlanFoodsTable.$inferSelect;
