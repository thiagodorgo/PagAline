import { create } from 'zustand';

export type BillStatus = 'pending' | 'paid' | 'overdue';

export interface Bill {
  id: string;
  description: string;
  amount: number;
  dueDate: string;
  category: string;
  status: string;
  notes?: string | null;
  imageUrl?: string | null;
  paidDate?: string | null;
  createdAt: string;
}

export interface Category {
  id: string;
  name: string;
}

export interface UserSettings {
  id: string;
  userName: string;
  userPlan: string;
  customPhotoUrl?: string | null;
  monthlyGoal: number;
}

export interface AuthUser {
  id: string;
  username: string;
  displayName: string;
  avatarUrl?: string | null;
  isAdmin: boolean;
}

interface AppState {
  bills: Bill[];
  categories: Category[];
  settings: UserSettings | null;
  currentUser: AuthUser | null;
  users: AuthUser[];
  authReady: boolean;
  isLoading: boolean;

  fetchCurrentUser: () => Promise<void>;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  updateCurrentUser: (data: Partial<Pick<AuthUser, "displayName" | "avatarUrl">>) => Promise<void>;
  fetchUsers: () => Promise<void>;
  createUser: (data: { username: string; password: string; isAdmin?: boolean }) => Promise<void>;
  createDeviceLoginToken: () => Promise<{ token: string; expiresAt: string; url: string }>;
  redeemDeviceLoginToken: (token: string) => Promise<void>;

  fetchBills: () => Promise<void>;
  addBill: (bill: Omit<Bill, 'id' | 'createdAt'>) => Promise<void>;
  updateBill: (id: string, bill: Partial<Bill>) => Promise<void>;
  markAsPaid: (id: string) => Promise<void>;
  markMultipleAsPaid: (ids: string[]) => Promise<void>;
  deleteBill: (id: string) => Promise<void>;

  fetchCategories: () => Promise<void>;
  addCategory: (name: string) => Promise<void>;
  deleteCategory: (id: string) => Promise<void>;

  fetchSettings: () => Promise<void>;
  updateSettings: (data: Partial<UserSettings>) => Promise<void>;

  resetData: () => Promise<void>;
}

async function api(url: string, options?: RequestInit) {
  const res = await fetch(url, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    credentials: 'include',
  });
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(text);
  }
  if (res.status === 204) return null;
  return res.json();
}

export const useStore = create<AppState>()((set, get) => ({
  bills: [],
  categories: [],
  settings: null,
  currentUser: null,
  users: [],
  authReady: false,
  isLoading: true,

  fetchCurrentUser: async () => {
    const res = await fetch('/api/me', { credentials: 'include' });
    if (res.status === 401) {
      set({ currentUser: null, authReady: true });
      return;
    }

    if (!res.ok) {
      const text = await res.text().catch(() => res.statusText);
      throw new Error(text);
    }

    const currentUser = await res.json();
    set({ currentUser, authReady: true });
  },

  login: async (username, password) => {
    const currentUser = await api('/api/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
    set({ currentUser, authReady: true });
  },

  logout: async () => {
    await api('/api/logout', { method: 'POST' });
    set({
      currentUser: null,
      users: [],
      bills: [],
      categories: [],
      settings: null,
      isLoading: false,
      authReady: true,
    });
  },

  updateCurrentUser: async (data) => {
    const currentUser = await api('/api/me', {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
    set({ currentUser });
  },

  fetchUsers: async () => {
    const users = await api('/api/admin/users');
    set({ users });
  },

  createUser: async (data) => {
    const created = await api('/api/admin/users', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    set((state) => ({ users: [...state.users, created] }));
  },

  createDeviceLoginToken: async () => {
    return api('/api/device-login-token', {
      method: 'POST',
    });
  },

  redeemDeviceLoginToken: async (token) => {
    const currentUser = await api('/api/device-login/redeem', {
      method: 'POST',
      body: JSON.stringify({ token }),
    });
    set({ currentUser, authReady: true });
  },

  fetchBills: async () => {
    const bills = await api('/api/bills');
    set({ bills, isLoading: false });
  },

  addBill: async (billData) => {
    const bill = await api('/api/bills', {
      method: 'POST',
      body: JSON.stringify(billData),
    });
    set((state) => ({ bills: [...state.bills, bill] }));
  },

  updateBill: async (id, data) => {
    const updated = await api(`/api/bills/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
    set((state) => ({
      bills: state.bills.map((b) => (b.id === id ? updated : b)),
    }));
  },

  markAsPaid: async (id) => {
    const updated = await api(`/api/bills/${id}/pay`, { method: 'POST' });
    set((state) => ({
      bills: state.bills.map((b) => (b.id === id ? updated : b)),
    }));
  },

  markMultipleAsPaid: async (ids) => {
    await api('/api/bills/pay-multiple', {
      method: 'POST',
      body: JSON.stringify({ ids }),
    });
    set((state) => ({
      bills: state.bills.map((b) =>
        ids.includes(b.id)
          ? { ...b, status: 'paid', paidDate: new Date().toISOString() }
          : b
      ),
    }));
  },

  deleteBill: async (id) => {
    await api(`/api/bills/${id}`, { method: 'DELETE' });
    set((state) => ({ bills: state.bills.filter((b) => b.id !== id) }));
  },

  fetchCategories: async () => {
    const categories = await api('/api/categories');
    set({ categories });
  },

  addCategory: async (name) => {
    const cat = await api('/api/categories', {
      method: 'POST',
      body: JSON.stringify({ name }),
    });
    set((state) => ({ categories: [...state.categories, cat] }));
  },

  deleteCategory: async (id) => {
    await api(`/api/categories/${id}`, { method: 'DELETE' });
    set((state) => ({
      categories: state.categories.filter((c) => c.id !== id),
    }));
  },

  fetchSettings: async () => {
    const settings = await api('/api/settings');
    set({ settings });
  },

  updateSettings: async (data) => {
    const updated = await api('/api/settings', {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
    set({ settings: updated });
  },

  resetData: async () => {
    await api('/api/reset', { method: 'POST' });
    await get().fetchBills();
    await get().fetchCategories();
    await get().fetchSettings();
  },
}));
