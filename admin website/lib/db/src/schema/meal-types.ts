import { pgTable, serial, varchar, timestamp, integer, primaryKey } from "drizzle-orm/pg-core";
import { recipesTable } from "./recipes";

export const mealTypesTable = pgTable("meal_types", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 100 }).notNull().unique(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const mealTypeRecipesTable = pgTable("meal_type_recipes", {
  mealTypeId: integer("meal_type_id").notNull().references(() => mealTypesTable.id, { onDelete: "cascade" }),
  recipeId: integer("recipe_id").notNull().references(() => recipesTable.id, { onDelete: "cascade" }),
}, (t) => [
  primaryKey({ columns: [t.mealTypeId, t.recipeId] }),
]);

export type MealType = typeof mealTypesTable.$inferSelect;
export type InsertMealType = typeof mealTypesTable.$inferInsert;
export type MealTypeRecipe = typeof mealTypeRecipesTable.$inferSelect;
