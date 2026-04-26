// src/lib/db.ts
// =======================================
// TLS-safe dynamic import for pg
// Restores original helpers: query, queryOne, getDbClient
// Uses process.env.DATABASE_URL directly
// =======================================

let _client: any;

async function getClient() {
  if (_client) return _client;
  const { Client } = await import("pg");
  _client = new Client({ connectionString: process.env.DATABASE_URL });
  await _client.connect();
  return _client;
}

// Query helper returning all rows
export async function query(text: string, params?: any[]) {
  const client = await getClient();
  const res = await client.query(text, params);
  return res.rows;
}

// Query helper returning first row or null
export async function queryOne(text: string, params?: any[]) {
  const client = await getClient();
  const res = await client.query(text, params);
  return res.rows[0] || null;
}

// Export client getter in case some modules need it
export { getClient as getDbClient };
