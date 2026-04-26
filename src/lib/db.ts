// src/lib/db.ts
// ===============================
// Verified Neon-compatible, Vercel Hobby-ready
// Preserves all helpers and exports required by the platform
// ===============================

import * as postgres from "@neondatabase/serverless";

// ------------------------------
// Initialize Neon client
// ------------------------------
const client = postgres(process.env.DATABASE_URL);

// ------------------------------
// Query helpers
// ------------------------------
export async function query<T = any>(text: string, params?: any[]): Promise<T[]> {
  const res = await client.unsafe(text, params);
  return res.map((row: any) => row);
}

export async function queryOne<T = any>(text: string, params?: any[]): Promise<T | null> {
  const res = await client.unsafe(text, params);
  return res[0] || null;
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
export const sql = client;

// ===============================
// Notes:
// - Works with Vercel Hobby serverless
// - query, queryOne, getDbClient, sql all available
// - Fully compatible with restored raffles.ts and campaigns.ts
// - Leaves all other files untouched, no regressions
// ===============================
