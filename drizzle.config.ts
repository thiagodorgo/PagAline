import { defineConfig } from "drizzle-kit";

const connectionUrl = process.env.DATABASE_URL;
const hasDiscreteConfig =
  !!process.env.PGHOST &&
  !!process.env.PGDATABASE &&
  !!process.env.PGUSER &&
  !!process.env.PGPASSWORD;

if (!connectionUrl && !hasDiscreteConfig) {
  throw new Error("DATABASE_URL or PGHOST/PGDATABASE/PGUSER/PGPASSWORD must be set");
}

const databaseUrl =
  connectionUrl ??
  `postgresql://${encodeURIComponent(process.env.PGUSER!)}:${encodeURIComponent(process.env.PGPASSWORD!)}@${process.env.PGHOST!}:${process.env.PGPORT ?? "5432"}/${process.env.PGDATABASE!}${process.env.PGSSLMODE ? `?sslmode=${encodeURIComponent(process.env.PGSSLMODE)}` : ""}`;

export default defineConfig({
  out: "./migrations",
  schema: "./shared/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: databaseUrl,
  },
});
