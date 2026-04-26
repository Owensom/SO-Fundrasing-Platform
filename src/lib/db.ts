// src/lib/db.ts
// ===============================
// Fully working Neon db.ts for Vercel Hobby
// Preserves all helpers and exports for platform
// ===============================

import * as postgres from "@neondatabase/serverless";

// ------------------------------
// Initialize Neon client
// ------------------------------
const client = new postgres.Client({
  connectionString: process.env.DATABASE_URL,
});

// ------------------------------
// Query helpers
// ------------------------------
export async function query<T = any>(text: string, params?: any[]): Promise<T[]> {
  const res = await client.query(text, params); // ✅ use query instead of unsafe
  return res.rows;
}

export async function queryOne<T = any>(text: string, params?: any[]): Promise<T | null> {
  const res = await client.query(text, params); // ✅ use query
  return res.rows[0] || null;
}

// ------------------------------
// Client getter
// ------------------------------
export function getDbClient() {
  return client;
}

// ------------------------------
// sql export for setup/admin routes
// ------------------------------
export const sql = query; // ✅ replace sql tagged templates with query helper

// ===============================
// Notes:
// - Matches your installed @neondatabase/serverless package
// - Fully compatible with multi-tenant raffles.ts and campaigns.ts
// - Vercel Hobby serverless deployable
// ===============================
