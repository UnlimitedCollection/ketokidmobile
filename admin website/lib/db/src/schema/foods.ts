import { pgTable, serial, varchar, text, real, boolean, timestamp } from "drizzle-orm/pg-core";

export const foodsTable = pgTable("foods", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 200 }).notNull(),
  category: varchar("category", { length: 100 }).notNull(),
  carbs: real("carbs").notNull().default(0),
  fat: real("fat").notNull().default(0),
  protein: real("protein").notNull().default(0),
  calories: real("calories").notNull().default(0),
  imageUrl: text("image_url").default(""),
  description: text("description").default(""),
  indicator: varchar("indicator", { length: 50 }).default("vegi"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type Food = typeof foodsTable.$inferSelect;
export type InsertFood = typeof foodsTable.$inferInsert;
