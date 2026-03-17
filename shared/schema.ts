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

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  displayName: text("display_name").notNull(),
  avatarUrl: text("avatar_url"),
  isAdmin: boolean("is_admin").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
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
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  passwordHash: true,
  createdAt: true,
  avatarUrl: true,
});
export const updateUserProfileSchema = z.object({
  displayName: z.string().trim().min(1).max(80).optional(),
  avatarUrl: z.string().trim().min(1).nullable().optional(),
});
export const createUserCredentialsSchema = z.object({
  username: z.string().trim().min(3).max(40).regex(/^[a-zA-Z0-9._-]+$/),
  password: z.string().min(4).max(128),
  isAdmin: z.boolean().optional(),
});
export const loginSchema = z.object({
  username: z.string().trim().min(1),
  password: z.string().min(1),
});

export type Bill = typeof bills.$inferSelect;
export type InsertBill = z.infer<typeof insertBillSchema>;
export type UpdateBill = z.infer<typeof updateBillSchema>;
export type Category = typeof categories.$inferSelect;
export type InsertCategory = z.infer<typeof insertCategorySchema>;
export type Settings = typeof settings.$inferSelect;
export type UpdateSettings = z.infer<typeof updateSettingsSchema>;
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type UpdateUserProfile = z.infer<typeof updateUserProfileSchema>;
export type CreateUserCredentials = z.infer<typeof createUserCredentialsSchema>;
export type LoginCredentials = z.infer<typeof loginSchema>;
