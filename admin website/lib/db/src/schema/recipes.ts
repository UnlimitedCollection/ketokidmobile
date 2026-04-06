import { pgTable, serial, varchar, text, real, timestamp, integer } from "drizzle-orm/pg-core";
import { doctorsTable } from "./doctors";

export const recipesTable = pgTable("recipes", {
  id: serial("id").primaryKey(),
  doctorId: integer("doctor_id").notNull().references(() => doctorsTable.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 200 }).notNull(),
  description: text("description").default(""),
  category: varchar("category", { length: 100 }).notNull().default("General"),
  imageUrl: text("image_url").default(""),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const recipeIngredientsTable = pgTable("recipe_ingredients", {
  id: serial("id").primaryKey(),
  recipeId: integer("recipe_id").notNull().references(() => recipesTable.id, { onDelete: "cascade" }),
  foodName: varchar("food_name", { length: 200 }).notNull(),
  portionGrams: real("portion_grams").notNull().default(100),
  unit: varchar("unit", { length: 50 }).notNull().default("g"),
  carbs: real("carbs").notNull().default(0),
  fat: real("fat").notNull().default(0),
  protein: real("protein").notNull().default(0),
  calories: real("calories").notNull().default(0),
});

export type Recipe = typeof recipesTable.$inferSelect;
export type InsertRecipe = typeof recipesTable.$inferInsert;
export type RecipeIngredient = typeof recipeIngredientsTable.$inferSelect;
export type InsertRecipeIngredient = typeof recipeIngredientsTable.$inferInsert;
