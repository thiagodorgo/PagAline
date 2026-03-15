import { sql } from "drizzle-orm";
import { pgTable, text, varchar, doublePrecision, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const bills = pgTable("bills", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  description: text("description").notNull(),
  amount: doublePrecision("amount").notNull(),
  dueDate: timestamp("due_date").notNull(),
  category: text("category").notNull().default("Outros"),
  status: text("status").notNull().default("pending"),
  notes: text("notes"),
  imageUrl: text("image_url"),
  paidDate: timestamp("paid_date"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const categories = pgTable("categories", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull().unique(),
});

export const settings = pgTable("settings", {
  id: varchar("id").primaryKey().default(sql`'default'`),
  userName: text("user_name").notNull().default("Aline Silva"),
  userPlan: text("user_plan").notNull().default("Plano Premium"),
  customPhotoUrl: text("custom_photo_url"),
  monthlyGoal: doublePrecision("monthly_goal").notNull().default(5000),
});

const billSchemaRefinements = {
  dueDate: () => z.coerce.date(),
  paidDate: () => z.coerce.date(),
  createdAt: () => z.coerce.date(),
};

export const insertBillSchema = createInsertSchema(bills, billSchemaRefinements).omit({ id: true, createdAt: true });
export const updateBillSchema = createInsertSchema(bills, billSchemaRefinements).omit({ id: true, createdAt: true }).partial();

export const insertCategorySchema = createInsertSchema(categories).omit({ id: true });
export const updateSettingsSchema = createInsertSchema(settings).omit({ id: true }).partial();

export type Bill = typeof bills.$inferSelect;
export type InsertBill = z.infer<typeof insertBillSchema>;
export type UpdateBill = z.infer<typeof updateBillSchema>;
export type Category = typeof categories.$inferSelect;
export type InsertCategory = z.infer<typeof insertCategorySchema>;
export type Settings = typeof settings.$inferSelect;
export type UpdateSettings = z.infer<typeof updateSettingsSchema>;
