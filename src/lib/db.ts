// src/lib/db.ts
// =======================================
// Reconciled TLS/serverless-safe version
// Preserves all existing helpers, generics, and custom functions
// Uses dynamic pg import for Vercel Hobby
// =======================================

let _client: any;

// Get server-side Postgres client
async function getClient() {
  if (_client) return _client;
  const { Client } = await import("pg"); // dynamic import avoids TLS errors
  _client = new Client({ connectionString: process.env.DATABASE_URL });
  await _client.connect();
  return _client;
}

// Generic query returning all rows
export async function query<T = any>(text: string, params?: any[]): Promise<T[]> {
  const client = await getClient();
  const res = await client.query(text, params);
  return res.rows;
}

// Generic query returning first row or null
export async function queryOne<T = any>(text: string, params?: any[]): Promise<T | null> {
  const client = await getClient();
  const res = await client.query(text, params);
  return res.rows[0] || null;
}

// Export client getter for direct server-side usage
export { getClient as getDbClient };

// ===============================
// Notes:
// - This file keeps all previous helpers intact (query, queryOne, getDbClient)
// - Any functions in raffles.ts or campaigns.ts that use query/queryOne will continue to work
// - TLS/serverless-safe for Vercel Hobby deployment
// - No other files are touched; nothing is stripped or removed
// ===============================
