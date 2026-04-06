import { pgTable, serial, text, timestamp, varchar, integer, real, date, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { doctorsTable } from "./doctors";

export const kidsTable = pgTable("kids", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 200 }).notNull(),
  kidCode: varchar("kid_code", { length: 50 }).notNull().unique(),
  dateOfBirth: date("date_of_birth").notNull(),
  gender: varchar("gender", { length: 10 }).notNull(),
  parentName: varchar("parent_name", { length: 200 }).notNull(),
  parentContact: varchar("parent_contact", { length: 100 }).notNull(),
  dietType: varchar("diet_type", { length: 30 }).notNull().default("classic"),
  dietSubCategory: varchar("diet_sub_category", { length: 20 }),
  doctorId: integer("doctor_id").references(() => doctorsTable.id),
  currentMealPlanId: integer("current_meal_plan_id").references(() => libraryMealPlansTable.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const medicalSettingsTable = pgTable("medical_settings", {
  id: serial("id").primaryKey(),
  kidId: integer("kid_id").notNull().references(() => kidsTable.id),
  dietType: varchar("diet_type", { length: 30 }).notNull().default("classic"),
  dietSubCategory: varchar("diet_sub_category", { length: 20 }),
  ketoRatio: real("keto_ratio").notNull().default(3),
  dailyCalories: real("daily_calories").notNull().default(1200),
  dailyCarbs: real("daily_carbs").notNull().default(20),
  dailyFat: real("daily_fat").notNull().default(100),
  dailyProtein: real("daily_protein").notNull().default(40),
  showAllFoods: boolean("show_all_foods").notNull().default(true),
  showAllRecipes: boolean("show_all_recipes").notNull().default(true),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const weightRecordsTable = pgTable("weight_records", {
  id: serial("id").primaryKey(),
  kidId: integer("kid_id").notNull().references(() => kidsTable.id),
  weight: real("weight").notNull(),
  date: date("date").notNull(),
  note: text("note"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const mealDaysTable = pgTable("meal_days", {
  id: serial("id").primaryKey(),
  kidId: integer("kid_id").notNull().references(() => kidsTable.id),
  date: date("date").notNull(),
  totalMeals: integer("total_meals").notNull().default(5),
  completedMeals: integer("completed_meals").notNull().default(0),
  missedMeals: integer("missed_meals").notNull().default(0),
  isFilled: boolean("is_filled").notNull().default(false),
  totalCalories: real("total_calories").default(0),
  totalCarbs: real("total_carbs").default(0),
  totalFat: real("total_fat").default(0),
  totalProtein: real("total_protein").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const notesTable = pgTable("notes", {
  id: serial("id").primaryKey(),
  kidId: integer("kid_id").notNull().references(() => kidsTable.id),
  doctorId: integer("doctor_id").references(() => doctorsTable.id),
  doctorName: varchar("doctor_name", { length: 200 }).notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const mealLogsTable = pgTable("meal_logs", {
  id: serial("id").primaryKey(),
  kidId: integer("kid_id").notNull().references(() => kidsTable.id),
  date: date("date").notNull(),
  mealType: varchar("meal_type", { length: 50 }).notNull(),
  isCompleted: boolean("is_completed").notNull().default(false),
  calories: real("calories").default(0),
  carbs: real("carbs").default(0),
  fat: real("fat").default(0),
  protein: real("protein").default(0),
  notes: text("notes"),
  imageUrl: text("image_url"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const ketoneReadingsTable = pgTable("ketone_readings", {
  id: serial("id").primaryKey(),
  kidId: integer("kid_id").notNull().references(() => kidsTable.id),
  value: real("value").notNull(),
  unit: varchar("unit", { length: 20 }).notNull().default("mmol/L"),
  readingType: varchar("reading_type", { length: 20 }).notNull().default("blood"),
  date: date("date").notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const mealPlansTable = pgTable("meal_plans", {
  id: serial("id").primaryKey(),
  kidId: integer("kid_id").notNull().references(() => kidsTable.id),
  name: varchar("name", { length: 200 }).notNull(),
  description: text("description").default(""),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const mealPlanItemsTable = pgTable("meal_plan_items", {
  id: serial("id").primaryKey(),
  planId: integer("plan_id").notNull().references(() => mealPlansTable.id),
  mealType: varchar("meal_type", { length: 50 }).notNull(),
  foodId: integer("food_id").notNull(),
  foodName: varchar("food_name", { length: 200 }).notNull(),
  portionGrams: real("portion_grams").notNull().default(100),
  calories: real("calories").default(0),
  carbs: real("carbs").default(0),
  fat: real("fat").default(0),
  protein: real("protein").default(0),
  notes: text("notes").default(""),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ─── Library Meal Plans (doctor-level shared plans) ────────────────────────────

export const libraryMealPlansTable = pgTable("library_meal_plans", {
  id: serial("id").primaryKey(),
  doctorId: integer("doctor_id").references(() => doctorsTable.id),
  name: varchar("name", { length: 200 }).notNull(),
  description: text("description").default(""),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const libraryMealPlanItemsTable = pgTable("library_meal_plan_items", {
  id: serial("id").primaryKey(),
  planId: integer("plan_id").notNull().references(() => libraryMealPlansTable.id),
  mealType: varchar("meal_type", { length: 50 }).notNull(),
  foodName: varchar("food_name", { length: 200 }).notNull(),
  portionGrams: real("portion_grams").notNull().default(100),
  unit: varchar("unit", { length: 50 }).notNull().default("g"),
  calories: real("calories").default(0),
  carbs: real("carbs").default(0),
  fat: real("fat").default(0),
  protein: real("protein").default(0),
  notes: text("notes").default(""),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const mealEntriesTable = pgTable("meal_entries", {
  id: serial("id").primaryKey(),
  kidId: integer("kid_id").notNull().references(() => kidsTable.id),
  date: date("date").notNull(),
  mealType: varchar("meal_type", { length: 50 }).notNull(),
  foodName: varchar("food_name", { length: 200 }).notNull(),
  quantity: real("quantity").notNull().default(1),
  unit: varchar("unit", { length: 50 }).notNull().default("g"),
  calories: real("calories").default(0),
  carbs: real("carbs").default(0),
  fat: real("fat").default(0),
  protein: real("protein").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const mealPlanAssignmentHistoryTable = pgTable("meal_plan_assignment_history", {
  id: serial("id").primaryKey(),
  kidId: integer("kid_id").notNull().references(() => kidsTable.id, { onDelete: "cascade" }),
  planId: integer("plan_id"),
  planName: varchar("plan_name", { length: 200 }),
  doctorId: integer("doctor_id").references(() => doctorsTable.id),
  doctorName: varchar("doctor_name", { length: 200 }).notNull(),
  action: varchar("action", { length: 20 }).notNull(),
  assignedAt: timestamp("assigned_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const sideEffectsTable = pgTable("side_effects", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 200 }).notNull().unique(),
  isSeeded: boolean("is_seeded").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const kidSideEffectsTable = pgTable("kid_side_effects", {
  id: serial("id").primaryKey(),
  kidId: integer("kid_id").notNull().references(() => kidsTable.id, { onDelete: "cascade" }),
  sideEffectId: integer("side_effect_id").references(() => sideEffectsTable.id, { onDelete: "cascade" }),
  customName: varchar("custom_name", { length: 200 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertKidSchema = createInsertSchema(kidsTable).omit({ id: true, createdAt: true });
export type InsertKid = z.infer<typeof insertKidSchema>;
export type Kid = typeof kidsTable.$inferSelect;

export const insertWeightRecordSchema = createInsertSchema(weightRecordsTable).omit({ id: true, createdAt: true });
export type InsertWeightRecord = z.infer<typeof insertWeightRecordSchema>;
export type WeightRecord = typeof weightRecordsTable.$inferSelect;

export const insertNoteSchema = createInsertSchema(notesTable).omit({ id: true, createdAt: true });
export type InsertNote = z.infer<typeof insertNoteSchema>;
export type Note = typeof notesTable.$inferSelect;

export type SideEffect = typeof sideEffectsTable.$inferSelect;
export type KidSideEffect = typeof kidSideEffectsTable.$inferSelect;
