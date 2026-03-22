import { create } from 'zustand';
import type { Bill, Category, InsertBill, Settings } from './db';
import {
  createBill,
  createCategory,
  deleteBill as deleteBillFromDb,
  deleteCategory as deleteCategoryFromDb,
  getBills,
  getCategories,
  getSettings,
  markBillPaid,
  markMultipleBillsPaid,
  resetAll,
  updateBill as updateBillInDb,
  updateSettings as updateSettingsInDb,
} from './db';

export type { Bill, Category, InsertBill, Settings } from './db';

interface AppState {
  bills: Bill[];
  categories: Category[];
  settings: Settings | null;
  isLoading: boolean;

  fetchBills(): Promise<void>;
  addBill(bill: InsertBill): Promise<void>;
  updateBill(id: string, data: Partial<InsertBill>): Promise<void>;
  markAsPaid(id: string): Promise<void>;
  markMultipleAsPaid(ids: string[]): Promise<void>;
  deleteBill(id: string): Promise<void>;

  fetchCategories(): Promise<void>;
  addCategory(name: string): Promise<void>;
  deleteCategory(id: string): Promise<void>;

  fetchSettings(): Promise<void>;
  updateSettings(data: Partial<Settings>): Promise<void>;

  resetData(): Promise<void>;
}

export const useStore = create<AppState>()((set, get) => ({
  bills: [],
  categories: [],
  settings: null,
  isLoading: true,

  async fetchBills() {
    set({ isLoading: true });
    const bills = await getBills();
    set({ bills, isLoading: false });
  },

  async addBill(bill) {
    await createBill(bill);
    await get().fetchBills();
  },

  async updateBill(id, data) {
    await updateBillInDb(id, data);
    await get().fetchBills();
  },

  async markAsPaid(id) {
    await markBillPaid(id);
    await get().fetchBills();
  },

  async markMultipleAsPaid(ids) {
    await markMultipleBillsPaid(ids);
    await get().fetchBills();
  },

  async deleteBill(id) {
    await deleteBillFromDb(id);
    await get().fetchBills();
  },

  async fetchCategories() {
    const categories = await getCategories();
    set({ categories });
  },

  async addCategory(name) {
    await createCategory(name);
    await get().fetchCategories();
  },

  async deleteCategory(id) {
    await deleteCategoryFromDb(id);
    await get().fetchCategories();
  },

  async fetchSettings() {
    const settings = await getSettings();
    set({ settings });
  },

  async updateSettings(data) {
    const settings = await updateSettingsInDb(data);
    set({ settings });
  },

  async resetData() {
    await resetAll();
    await Promise.all([get().fetchBills(), get().fetchCategories(), get().fetchSettings()]);
  },
}));
