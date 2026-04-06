import { boolean, pgTable, serial, text, timestamp, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const doctorsTable = pgTable("doctors", {
  id: serial("id").primaryKey(),
  username: varchar("username", { length: 100 }).notNull().unique(),
  password: text("password").notNull(),
  name: varchar("name", { length: 200 }).notNull(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  designation: varchar("designation", { length: 200 }),
  profilePhoto: text("profile_photo"),
  mobile: varchar("mobile", { length: 20 }),
  role: varchar("role", { length: 20 }).notNull().default("admin"),
  mustChangePassword: boolean("must_change_password").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertDoctorSchema = createInsertSchema(doctorsTable).omit({ id: true, createdAt: true });
export type InsertDoctor = z.infer<typeof insertDoctorSchema>;
export type Doctor = typeof doctorsTable.$inferSelect;
