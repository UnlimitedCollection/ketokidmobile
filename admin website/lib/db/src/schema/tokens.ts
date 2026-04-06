import { pgTable, serial, varchar, timestamp, integer } from "drizzle-orm/pg-core";
import { kidsTable } from "./kids";

export const parentTokensTable = pgTable("parent_tokens", {
  id: serial("id").primaryKey(),
  kidId: integer("kid_id").notNull().references(() => kidsTable.id, { onDelete: "cascade" }).unique(),
  token: varchar("token", { length: 64 }).notNull().unique(),
  status: varchar("status", { length: 20 }).notNull().default("active"),
  expiresAt: timestamp("expires_at").notNull(),
  usedAt: timestamp("used_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  revokedAt: timestamp("revoked_at"),
});

export type ParentToken = typeof parentTokensTable.$inferSelect;
export type InsertParentToken = typeof parentTokensTable.$inferInsert;
