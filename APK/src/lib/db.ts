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

type BillRow = {
  id: string;
  description: string;
  amount: number;
  due_date: string;
  category: string;
  status: string;
  notes: string | null;
  image_url: string | null;
  paid_date: string | null;
  created_at: string;
};

type CategoryRow = {
  id: string;
  name: string;
};

type SettingsRow = {
  id: string;
  user_name: string;
  user_plan: string;
  custom_photo_url: string | null;
  monthly_goal: number;
};

const DB_NAME = 'pagaline.db';
const DB_VERSION = 1;
const DEFAULT_SETTINGS: Settings = {
  id: 'default',
  userName: 'Aline Silva',
  userPlan: 'Plano Premium',
  customPhotoUrl: null,
  monthlyGoal: 5000,
};
const DEFAULT_CATEGORIES = ['Casa', 'Transporte', 'Educação', 'Saúde', 'Lazer', 'Impostos', 'Outros'];
const schema = `
CREATE TABLE IF NOT EXISTS bills (
  id TEXT PRIMARY KEY,
  description TEXT NOT NULL,
  amount REAL NOT NULL,
  due_date TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'Outros',
  status TEXT NOT NULL DEFAULT 'pending',
  notes TEXT,
  image_url TEXT,
  paid_date TEXT,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE
);
CREATE TABLE IF NOT EXISTS settings (
  id TEXT PRIMARY KEY DEFAULT 'default',
  user_name TEXT NOT NULL DEFAULT 'Aline Silva',
  user_plan TEXT NOT NULL DEFAULT 'Plano Premium',
  custom_photo_url TEXT,
  monthly_goal REAL NOT NULL DEFAULT 5000
);
`;

let sqlite: SQLiteConnection | null = null;
let database: SQLiteDBConnection | null = null;

function getConnection(): SQLiteConnection {
  if (!sqlite) {
    sqlite = new SQLiteConnection(CapacitorSQLite);
  }
  return sqlite;
}

async function openDatabase(
  databaseName: string,
  encrypted: boolean,
  mode: 'no encryption' | 'encryption' | 'secret',
  version: number,
): Promise<SQLiteDBConnection> {
  const connection = getConnection();
  const consistency = await connection.checkConnectionsConsistency();
  const hasConnection = (await connection.isConnection(databaseName, false)).result;

  if (consistency.result && hasConnection) {
    const existing = await connection.retrieveConnection(databaseName, false);
    await existing.open();
    return existing;
  }

  const created = await connection.createConnection(databaseName, encrypted, mode, version, false);
  await created.open();
  return created;
}

function assertDatabase(): SQLiteDBConnection {
  if (!database) {
    throw new Error('Banco de dados não inicializado.');
  }
  return database;
}

function mapBill(row: BillRow): Bill {
  return {
    id: row.id,
    description: row.description,
    amount: Number(row.amount),
    dueDate: row.due_date,
    category: row.category,
    status: row.status,
    notes: row.notes,
    imageUrl: row.image_url,
    paidDate: row.paid_date,
    createdAt: row.created_at,
  };
}

function mapCategory(row: CategoryRow): Category {
  return {
    id: row.id,
    name: row.name,
  };
}

function mapSettings(row: SettingsRow): Settings {
  return {
    id: row.id,
    userName: row.user_name,
    userPlan: row.user_plan,
    customPhotoUrl: row.custom_photo_url,
    monthlyGoal: Number(row.monthly_goal),
  };
}

async function queryRows<T>(statement: string, values: unknown[] = []): Promise<T[]> {
  const result = await assertDatabase().query(statement, values);
  return (result.values ?? []) as T[];
}

async function run(statement: string, values: unknown[] = []): Promise<void> {
  await assertDatabase().run(statement, values);
  if (Capacitor.getPlatform() === 'web') {
    await getConnection().saveToStore(DB_NAME);
  }
}

async function ensureSettingsSingleton(): Promise<void> {
  const rows = await queryRows<SettingsRow>('SELECT * FROM settings WHERE id = ?', ['default']);
  if (rows.length === 0) {
    await run(
      'INSERT INTO settings (id, user_name, user_plan, custom_photo_url, monthly_goal) VALUES (?, ?, ?, ?, ?)',
      [
        DEFAULT_SETTINGS.id,
        DEFAULT_SETTINGS.userName,
        DEFAULT_SETTINGS.userPlan,
        DEFAULT_SETTINGS.customPhotoUrl,
        DEFAULT_SETTINGS.monthlyGoal,
      ],
    );
  }
}

export async function initDatabase(): Promise<void> {
  if (Capacitor.getPlatform() === 'web') {
    await CapacitorSQLite.initWebStore();
  }

  database = await openDatabase(DB_NAME, false, 'no encryption', DB_VERSION);
  await database.execute(schema);
}

export async function seedDefaults(): Promise<void> {
  const categoryCount = await queryRows<{ total: number }>('SELECT COUNT(*) as total FROM categories');
  if ((categoryCount[0]?.total ?? 0) === 0) {
    for (const categoryName of DEFAULT_CATEGORIES) {
      await run('INSERT INTO categories (id, name) VALUES (?, ?)', [uuidv4(), categoryName]);
    }
  }

  await ensureSettingsSingleton();
}

export async function getBills(): Promise<Bill[]> {
  const rows = await queryRows<BillRow>('SELECT * FROM bills ORDER BY due_date ASC');
  return rows.map(mapBill);
}

export async function getBill(id: string): Promise<Bill | undefined> {
  const rows = await queryRows<BillRow>('SELECT * FROM bills WHERE id = ?', [id]);
  return rows[0] ? mapBill(rows[0]) : undefined;
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

  await run(
    `INSERT INTO bills (id, description, amount, due_date, category, status, notes, image_url, paid_date, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      bill.id,
      bill.description,
      bill.amount,
      bill.dueDate,
      bill.category,
      bill.status,
      bill.notes,
      bill.imageUrl,
      bill.paidDate,
      bill.createdAt,
    ],
  );

  return bill;
}

export async function updateBill(id: string, data: Partial<InsertBill>): Promise<Bill> {
  const current = await getBill(id);
  if (!current) {
    throw new Error('Conta não encontrada.');
  }

  const fields: string[] = [];
  const values: unknown[] = [];

  if (data.description !== undefined) {
    fields.push('description = ?');
    values.push(data.description);
  }
  if (data.amount !== undefined) {
    fields.push('amount = ?');
    values.push(data.amount);
  }
  if (data.dueDate !== undefined) {
    fields.push('due_date = ?');
    values.push(data.dueDate);
  }
  if (data.category !== undefined) {
    fields.push('category = ?');
    values.push(data.category);
  }
  if (data.status !== undefined) {
    fields.push('status = ?');
    values.push(data.status);
  }
  if (data.notes !== undefined) {
    fields.push('notes = ?');
    values.push(data.notes);
  }
  if (data.imageUrl !== undefined) {
    fields.push('image_url = ?');
    values.push(data.imageUrl);
  }
  if (data.paidDate !== undefined) {
    fields.push('paid_date = ?');
    values.push(data.paidDate);
  }

  if (fields.length > 0) {
    values.push(id);
    await run(`UPDATE bills SET ${fields.join(', ')} WHERE id = ?`, values);
  }

  return (await getBill(id)) ?? current;
}

export async function deleteBill(id: string): Promise<void> {
  await run('DELETE FROM bills WHERE id = ?', [id]);
}

export async function markBillPaid(id: string): Promise<Bill> {
  const paidAt = new Date().toISOString();
  await run('UPDATE bills SET status = ?, paid_date = ? WHERE id = ?', ['paid', paidAt, id]);
  const updated = await getBill(id);
  if (!updated) {
    throw new Error('Conta não encontrada.');
  }
  return updated;
}

export async function markMultipleBillsPaid(ids: string[]): Promise<void> {
  for (const id of ids) {
    await markBillPaid(id);
  }
}

export async function getCategories(): Promise<Category[]> {
  const rows = await queryRows<CategoryRow>('SELECT * FROM categories ORDER BY name ASC');
  return rows.map(mapCategory);
}

export async function createCategory(name: string): Promise<Category> {
  const normalized = name.trim();
  if (!normalized) {
    throw new Error('Informe um nome de categoria.');
  }

  const existing = await queryRows<CategoryRow>('SELECT * FROM categories WHERE lower(name) = lower(?)', [normalized]);
  if (existing.length > 0) {
    throw new Error('Categoria já existe.');
  }

  const category: Category = {
    id: uuidv4(),
    name: normalized,
  };
  await run('INSERT INTO categories (id, name) VALUES (?, ?)', [category.id, category.name]);
  return category;
}

export async function deleteCategory(id: string): Promise<void> {
  await run('DELETE FROM categories WHERE id = ?', [id]);
}

export async function getSettings(): Promise<Settings> {
  await ensureSettingsSingleton();
  const rows = await queryRows<SettingsRow>('SELECT * FROM settings WHERE id = ?', ['default']);
  if (!rows[0]) {
    throw new Error('Configurações não encontradas.');
  }
  return mapSettings(rows[0]);
}

export async function updateSettings(data: Partial<Settings>): Promise<Settings> {
  await ensureSettingsSingleton();

  const fields: string[] = [];
  const values: unknown[] = [];

  if (data.userName !== undefined) {
    fields.push('user_name = ?');
    values.push(data.userName);
  }
  if (data.userPlan !== undefined) {
    fields.push('user_plan = ?');
    values.push(data.userPlan);
  }
  if (data.customPhotoUrl !== undefined) {
    fields.push('custom_photo_url = ?');
    values.push(data.customPhotoUrl);
  }
  if (data.monthlyGoal !== undefined) {
    fields.push('monthly_goal = ?');
    values.push(data.monthlyGoal);
  }

  if (fields.length > 0) {
    values.push('default');
    await run(`UPDATE settings SET ${fields.join(', ')} WHERE id = ?`, values);
  }

  return getSettings();
}

export async function resetAll(): Promise<void> {
  await run('DELETE FROM bills');
  await run('DELETE FROM categories');
  await run('DELETE FROM settings');
  await seedDefaults();
}
