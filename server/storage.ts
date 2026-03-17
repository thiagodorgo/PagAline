import { db } from "../db";
import { and, eq, gt, isNull } from "drizzle-orm";
import crypto from "crypto";
import {
  bills, categories, settings, users, deviceLoginTokens,
  type Bill, type InsertBill, type UpdateBill,
  type Category, type InsertCategory,
  type Settings, type UpdateSettings,
  type User,
} from "@shared/schema";
import { hashPassword } from "./auth";

export interface IStorage {
  getBills(): Promise<Bill[]>;
  getBill(id: string): Promise<Bill | undefined>;
  createBill(bill: InsertBill): Promise<Bill>;
  updateBill(id: string, bill: UpdateBill): Promise<Bill | undefined>;
  deleteBill(id: string): Promise<void>;
  markBillPaid(id: string): Promise<Bill | undefined>;
  markMultipleBillsPaid(ids: string[]): Promise<void>;

  getCategories(): Promise<Category[]>;
  createCategory(category: InsertCategory): Promise<Category>;
  deleteCategory(id: string): Promise<void>;

  getSettings(): Promise<Settings>;
  updateSettings(s: UpdateSettings): Promise<Settings>;

  getUsers(): Promise<User[]>;
  getUserById(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(input: { username: string; password: string; isAdmin?: boolean; displayName?: string }): Promise<User>;
  updateUser(id: string, data: Partial<Pick<User, "displayName" | "avatarUrl" | "isAdmin">>): Promise<User | undefined>;
  createDeviceLoginToken(userId: string): Promise<{ token: string; expiresAt: Date }>;
  consumeDeviceLoginToken(token: string): Promise<User | undefined>;

  resetAll(): Promise<void>;
  seedDefaults(): Promise<void>;
}

const DEFAULT_CATEGORIES = ['Casa', 'Transporte', 'Educação', 'Saúde', 'Lazer', 'Impostos', 'Outros'];
const DEFAULT_USERS = [
  { username: "thiago", password: "2101", displayName: "Thiago", isAdmin: true },
  { username: "aline", password: "1523", displayName: "Aline", isAdmin: false },
] as const;

export class DatabaseStorage implements IStorage {
  async getBills(): Promise<Bill[]> {
    return db.select().from(bills);
  }

  async getBill(id: string): Promise<Bill | undefined> {
    const [bill] = await db.select().from(bills).where(eq(bills.id, id));
    return bill;
  }

  async createBill(bill: InsertBill): Promise<Bill> {
    const [created] = await db.insert(bills).values(bill).returning();
    return created;
  }

  async updateBill(id: string, data: UpdateBill): Promise<Bill | undefined> {
    const [updated] = await db.update(bills).set(data).where(eq(bills.id, id)).returning();
    return updated;
  }

  async deleteBill(id: string): Promise<void> {
    await db.delete(bills).where(eq(bills.id, id));
  }

  async markBillPaid(id: string): Promise<Bill | undefined> {
    const [updated] = await db
      .update(bills)
      .set({ status: "paid", paidDate: new Date() })
      .where(eq(bills.id, id))
      .returning();
    return updated;
  }

  async markMultipleBillsPaid(ids: string[]): Promise<void> {
    for (const id of ids) {
      await db.update(bills).set({ status: "paid", paidDate: new Date() }).where(eq(bills.id, id));
    }
  }

  async getCategories(): Promise<Category[]> {
    return db.select().from(categories);
  }

  async createCategory(category: InsertCategory): Promise<Category> {
    const [created] = await db.insert(categories).values(category).returning();
    return created;
  }

  async deleteCategory(id: string): Promise<void> {
    await db.delete(categories).where(eq(categories.id, id));
  }

  async getSettings(): Promise<Settings> {
    const [s] = await db.select().from(settings);
    if (s) return s;
    const [created] = await db.insert(settings).values({ id: "default" }).returning();
    return created;
  }

  async updateSettings(data: UpdateSettings): Promise<Settings> {
    const existing = await this.getSettings();
    const [updated] = await db.update(settings).set(data).where(eq(settings.id, existing.id)).returning();
    return updated;
  }

  async getUsers(): Promise<User[]> {
    return db.select().from(users);
  }

  async getUserById(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async createUser(input: { username: string; password: string; isAdmin?: boolean; displayName?: string }): Promise<User> {
    const [created] = await db.insert(users).values({
      username: input.username,
      passwordHash: hashPassword(input.password),
      displayName: input.displayName ?? input.username,
      isAdmin: input.isAdmin ?? false,
    }).returning();
    return created;
  }

  async updateUser(id: string, data: Partial<Pick<User, "displayName" | "avatarUrl" | "isAdmin">>): Promise<User | undefined> {
    const [updated] = await db.update(users).set(data).where(eq(users.id, id)).returning();
    return updated;
  }

  async createDeviceLoginToken(userId: string): Promise<{ token: string; expiresAt: Date }> {
    const token = crypto.randomBytes(24).toString("hex");
    const expiresAt = new Date(Date.now() + 1000 * 60 * 10);

    await db.insert(deviceLoginTokens).values({
      token,
      userId,
      expiresAt,
    });

    return { token, expiresAt };
  }

  async consumeDeviceLoginToken(token: string): Promise<User | undefined> {
    const now = new Date();
    const [deviceToken] = await db
      .select()
      .from(deviceLoginTokens)
      .where(and(
        eq(deviceLoginTokens.token, token),
        isNull(deviceLoginTokens.usedAt),
        gt(deviceLoginTokens.expiresAt, now),
      ));

    if (!deviceToken) {
      return undefined;
    }

    await db
      .update(deviceLoginTokens)
      .set({ usedAt: now })
      .where(eq(deviceLoginTokens.id, deviceToken.id));

    return this.getUserById(deviceToken.userId);
  }

  async resetAll(): Promise<void> {
    await db.delete(bills);
    await db.delete(categories);
    for (const name of DEFAULT_CATEGORIES) {
      await db.insert(categories).values({ name }).onConflictDoNothing();
    }
    await db.update(settings).set({
      userName: "Aline Silva",
      userPlan: "Plano Premium",
      customPhotoUrl: null,
      monthlyGoal: 5000,
    }).where(eq(settings.id, "default"));
  }

  async seedDefaults(): Promise<void> {
    const cats = await this.getCategories();
    if (cats.length === 0) {
      for (const name of DEFAULT_CATEGORIES) {
        await db.insert(categories).values({ name }).onConflictDoNothing();
      }
    }
    const [s] = await db.select().from(settings);
    if (!s) {
      await db.insert(settings).values({ id: "default" }).onConflictDoNothing();
    }

    for (const user of DEFAULT_USERS) {
      const existingUser = await this.getUserByUsername(user.username);
      if (!existingUser) {
        await this.createUser(user);
      }
    }
  }
}

export const storage = new DatabaseStorage();
