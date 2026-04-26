// src/lib/db.ts
// ===============================
// Neon client with named exports for full backend compatibility
// Preserves all existing connection logic and multi-tenant safety
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
  const res = await client.query(text, params); // Use client.query instead of unsafe
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
// SQL helper for legacy / setup routes
// ------------------------------
export const sql = query;

// ------------------------------
// Named exports ensure all dependent files (raffles.ts, campaigns.ts, admin routes) compile
// ===============================
