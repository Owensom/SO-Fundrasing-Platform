// src/lib/db.ts
// ===============================
// Neon database helpers
// Web/Vercel compatible
// ===============================

import { Pool } from "@neondatabase/serverless";

let pool: Pool | null = null;

function getPool() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not set");
  }

  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
    });
  }

  return pool;
}

export async function query<T = any>(
  text: string,
  params?: any[],
): Promise<T[]> {
  const result = await getPool().query(text, params);
  return result.rows as T[];
}

export async function queryOne<T = any>(
  text: string,
  params?: any[],
): Promise<T | null> {
  const result = await getPool().query(text, params);
  return (result.rows[0] as T) || null;
}

export function getDbClient() {
  return getPool();
}

export const sql = query;
