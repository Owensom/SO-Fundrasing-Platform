// src/lib/db.ts
// ===============================
// Neon-compatible database client
// Preserves all helpers and exports
// Works on Vercel Hobby serverless
// ===============================

import { createClient } from "@neondatabase/serverless";

// ------------------------------
// Neon client
// ------------------------------
const client = createClient({
  connectionString: process.env.DATABASE_URL,
});

// ------------------------------
// Query helpers
// ------------------------------
export async function query<T = any>(text: string, params?: any[]): Promise<T[]> {
  const res = await client.query(text, params);
  return res.rows;
}

export async function queryOne<T = any>(text: string, params?: any[]): Promise<T | null> {
  const res = await client.query(text, params);
  return res.rows[0] || null;
}

// ------------------------------
// Client getter
// ------------------------------
export function getDbClient() {
  return client;
}

// ------------------------------
// sql export (if your routes use it)
// ------------------------------
export const sql = client.sql || client.query; // adapt if your code uses sql tagged templates

// ===============================
// Notes:
// - Keep all previous exports intact
// - Works directly with Neon, no dynamic pg import required
// - All existing routes, admin actions, tenant pages, and API calls remain unchanged
// ===============================
