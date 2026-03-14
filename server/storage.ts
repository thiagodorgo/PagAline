import { db } from "../db";
import { eq } from "drizzle-orm";
import {
  bills, categories, settings,
  type Bill, type InsertBill, type UpdateBill,
  type Category, type InsertCategory,
  type Settings, type UpdateSettings
} from "@shared/schema";

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

  resetAll(): Promise<void>;
}

const DEFAULT_CATEGORIES = ['Casa', 'Transporte', 'Educação', 'Saúde', 'Lazer', 'Impostos', 'Outros'];

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
  }
}

export const storage = new DatabaseStorage();
