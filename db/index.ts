import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "@shared/schema";

const connectionString = process.env.DATABASE_URL;
const hasDiscreteConfig =
  !!process.env.PGHOST &&
  !!process.env.PGDATABASE &&
  !!process.env.PGUSER &&
  !!process.env.PGPASSWORD;
const shouldUseSsl =
  process.env.PGSSLMODE === "require" ||
  process.env.PGSSLMODE === "verify-ca" ||
  process.env.PGSSLMODE === "verify-full";

if (!connectionString && !hasDiscreteConfig) {
  throw new Error("DATABASE_URL or PGHOST/PGDATABASE/PGUSER/PGPASSWORD must be set.");
}

export const pool = new pg.Pool({
  ...(connectionString
    ? { connectionString }
    : {
        host: process.env.PGHOST,
        port: Number.parseInt(process.env.PGPORT ?? "5432", 10),
        database: process.env.PGDATABASE,
        user: process.env.PGUSER,
        password: process.env.PGPASSWORD,
      }),
  ...(shouldUseSsl ? { ssl: { rejectUnauthorized: false } } : {}),
});

export const db = drizzle(pool, { schema });
