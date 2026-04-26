// src/lib/db.ts
// ===============================
// Dynamic pg import for serverless (Vercel Hobby)
// Preserves all existing query helpers and generics
// ===============================

let _client: any;

async function getClient() {
  if (_client) return _client;
  const { Client } = await import("pg"); // dynamic import avoids TLS issues
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

// Generic query returning first row
export async function queryOne<T = any>(text: string, params?: any[]): Promise<T | null> {
  const client = await getClient();
  const res = await client.query(text, params);
  return res.rows[0] || null;
}

// Export client getter for any server-side direct usage
export { getClient as getDbClient };

// ===============================
// Nothing else is changed — all other files remain intact
// ===============================
