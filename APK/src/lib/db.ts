import { Capacitor } from '@capacitor/core';
import {
  CapacitorSQLite,
  SQLiteConnection,
  type SQLiteDBConnection,
} from '@capacitor-community/sqlite';
import { v4 as uuidv4 } from 'uuid';

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

export interface Settings {
  id: string;
  userName: string;
  userPlan: string;
  customPhotoUrl?: string | null;
  monthlyGoal: number;
}

export type InsertBill = Omit<Bill, 'id' | 'createdAt'>;

const DB_NAME = 'pagaline.db';
const DB_VERSION = 1;
const BILLS_STORE = 'bills';
const CATEGORIES_STORE = 'categories';
const SETTINGS_STORE = 'settings';

const DEFAULT_SETTINGS: Settings = {
  id: 'default',
  userName: 'Aline Silva',
  userPlan: 'Plano Premium',
  customPhotoUrl: null,
  monthlyGoal: 5000,
};

const DEFAULT_CATEGORIES = ['Casa', 'Transporte', 'Educação', 'Saúde', 'Lazer', 'Impostos', 'Outros'];

let databasePromise: Promise<IDBDatabase> | null = null;

function ensureIndexedDb(): IDBFactory {
  if (typeof indexedDB === 'undefined') {
    throw new Error('IndexedDB não está disponível neste ambiente.');
  }

  return indexedDB;
}

function promisifyRequest<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Falha ao acessar o banco local.'));
  });
}

function waitForTransaction(transaction: IDBTransaction): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error('Falha ao concluir a transação.'));
    transaction.onabort = () => reject(transaction.error ?? new Error('A transação foi abortada.'));
  });
}

async function getDatabase(): Promise<IDBDatabase> {
  if (!databasePromise) {
    databasePromise = new Promise<IDBDatabase>((resolve, reject) => {
      const request = ensureIndexedDb().open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = () => {
        const database = request.result;

        if (!database.objectStoreNames.contains(BILLS_STORE)) {
          database.createObjectStore(BILLS_STORE, { keyPath: 'id' });
        }

        if (!database.objectStoreNames.contains(CATEGORIES_STORE)) {
          database.createObjectStore(CATEGORIES_STORE, { keyPath: 'id' });
        }

        if (!database.objectStoreNames.contains(SETTINGS_STORE)) {
          database.createObjectStore(SETTINGS_STORE, { keyPath: 'id' });
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error('Falha ao abrir o banco local.'));
    });
  }

  return databasePromise;
}

async function getAll<T>(storeName: string): Promise<T[]> {
  const database = await getDatabase();
  const transaction = database.transaction(storeName, 'readonly');
  const store = transaction.objectStore(storeName);
  const result = await promisifyRequest(store.getAll() as IDBRequest<T[]>);
  await waitForTransaction(transaction);
  return result;
}

async function getById<T>(storeName: string, id: string): Promise<T | undefined> {
  const database = await getDatabase();
  const transaction = database.transaction(storeName, 'readonly');
  const store = transaction.objectStore(storeName);
  const result = await promisifyRequest(store.get(id) as IDBRequest<T | undefined>);
  await waitForTransaction(transaction);
  return result;
}

async function putValue(storeName: string, value: unknown): Promise<void> {
  const database = await getDatabase();
  const transaction = database.transaction(storeName, 'readwrite');
  transaction.objectStore(storeName).put(value);
  await waitForTransaction(transaction);
}

async function deleteValue(storeName: string, id: string): Promise<void> {
  const database = await getDatabase();
  const transaction = database.transaction(storeName, 'readwrite');
  transaction.objectStore(storeName).delete(id);
  await waitForTransaction(transaction);
}

async function clearStore(storeName: string): Promise<void> {
  const database = await getDatabase();
  const transaction = database.transaction(storeName, 'readwrite');
  transaction.objectStore(storeName).clear();
  await waitForTransaction(transaction);
}

export async function initDatabase(): Promise<void> {
  await getDatabase();
}

export async function seedDefaults(): Promise<void> {
  const categories = await getAll<Category>(CATEGORIES_STORE);
  if (categories.length === 0) {
    for (const name of DEFAULT_CATEGORIES) {
      await putValue(CATEGORIES_STORE, { id: uuidv4(), name } satisfies Category);
    }
  }

  const settings = await getById<Settings>(SETTINGS_STORE, DEFAULT_SETTINGS.id);
  if (!settings) {
    await putValue(SETTINGS_STORE, DEFAULT_SETTINGS);
  }
}

export async function getBills(): Promise<Bill[]> {
  const bills = await getAll<Bill>(BILLS_STORE);
  return bills.sort((left, right) => left.dueDate.localeCompare(right.dueDate));
}

export async function getBill(id: string): Promise<Bill | undefined> {
  return getById<Bill>(BILLS_STORE, id);
}

export async function createBill(data: InsertBill): Promise<Bill> {
  const bill: Bill = {
    id: uuidv4(),
    createdAt: new Date().toISOString(),
    description: data.description,
    amount: data.amount,
    dueDate: data.dueDate,
    category: data.category || 'Outros',
    status: data.status || 'pending',
    notes: data.notes ?? null,
    imageUrl: data.imageUrl ?? null,
    paidDate: data.paidDate ?? null,
  };

  await putValue(BILLS_STORE, bill);
  return bill;
}

export async function updateBill(id: string, data: Partial<InsertBill>): Promise<Bill> {
  const current = await getBill(id);
  if (!current) {
    throw new Error('Conta não encontrada.');
  }

  const updated: Bill = {
    ...current,
    ...(data.description !== undefined ? { description: data.description } : {}),
    ...(data.amount !== undefined ? { amount: data.amount } : {}),
    ...(data.dueDate !== undefined ? { dueDate: data.dueDate } : {}),
    ...(data.category !== undefined ? { category: data.category } : {}),
    ...(data.status !== undefined ? { status: data.status } : {}),
    ...(data.notes !== undefined ? { notes: data.notes } : {}),
    ...(data.imageUrl !== undefined ? { imageUrl: data.imageUrl } : {}),
    ...(data.paidDate !== undefined ? { paidDate: data.paidDate } : {}),
  };

  await putValue(BILLS_STORE, updated);
  return updated;
}

export async function deleteBill(id: string): Promise<void> {
  await deleteValue(BILLS_STORE, id);
}

export async function markBillPaid(id: string): Promise<Bill> {
  const current = await getBill(id);
  if (!current) {
    throw new Error('Conta não encontrada.');
  }

  const updated: Bill = {
    ...current,
    status: 'paid',
    paidDate: new Date().toISOString(),
  };

  await putValue(BILLS_STORE, updated);
  return updated;
}

export async function markMultipleBillsPaid(ids: string[]): Promise<void> {
  for (const id of ids) {
    const current = await getBill(id);
    if (current) {
      await putValue(BILLS_STORE, {
        ...current,
        status: 'paid',
        paidDate: new Date().toISOString(),
      } satisfies Bill);
    }
  }
}

export async function getCategories(): Promise<Category[]> {
  const categories = await getAll<Category>(CATEGORIES_STORE);
  return categories.sort((left, right) => left.name.localeCompare(right.name));
}

export async function createCategory(name: string): Promise<Category> {
  const normalized = name.trim();
  if (!normalized) {
    throw new Error('Informe um nome de categoria.');
  }

  const categories = await getAll<Category>(CATEGORIES_STORE);
  const alreadyExists = categories.some((category) => category.name.toLowerCase() === normalized.toLowerCase());
  if (alreadyExists) {
    throw new Error('Categoria já existe.');
  }

  const category: Category = {
    id: uuidv4(),
    name: normalized,
  };

  await putValue(CATEGORIES_STORE, category);
  return category;
}

export async function deleteCategory(id: string): Promise<void> {
  await deleteValue(CATEGORIES_STORE, id);
}

export async function getSettings(): Promise<Settings> {
  await seedDefaults();
  const settings = await getById<Settings>(SETTINGS_STORE, DEFAULT_SETTINGS.id);
  if (!settings) {
    throw new Error('Configurações não encontradas.');
  }

  return settings;
}

export async function updateSettings(data: Partial<Settings>): Promise<Settings> {
  const current = await getSettings();
  const updated: Settings = {
    ...current,
    ...(data.userName !== undefined ? { userName: data.userName } : {}),
    ...(data.userPlan !== undefined ? { userPlan: data.userPlan } : {}),
    ...(data.customPhotoUrl !== undefined ? { customPhotoUrl: data.customPhotoUrl } : {}),
    ...(data.monthlyGoal !== undefined ? { monthlyGoal: data.monthlyGoal } : {}),
  };

  await putValue(SETTINGS_STORE, updated);
  return updated;
}

export async function resetAll(): Promise<void> {
  await Promise.all([
    clearStore(BILLS_STORE),
    clearStore(CATEGORIES_STORE),
    clearStore(SETTINGS_STORE),
  ]);
  await seedDefaults();
}
