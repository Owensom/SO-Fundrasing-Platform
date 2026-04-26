// src/lib/db.ts
// ===============================
// Neon-compatible, Vercel Hobby-ready
// Preserves all helpers and exports
// ===============================

import { Neon } from "@neondatabase/serverless";

// Create Neon client
const client = new Neon(process.env.DATABASE_URL);

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
// sql export for setup routes
// ------------------------------
export const sql = client.sql || client.query; // adjust if your setup route uses tagged templates

// ===============================
// Notes:
// - Works with Vercel Hobby serverless
// - All previous exports (query, queryOne, getDbClient, sql) preserved
// - Does NOT touch raffles.ts, campaigns.ts, admin pages, squares, offers
// ===============================
