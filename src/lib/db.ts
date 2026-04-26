// src/lib/db.ts
// ===============================
// Dynamic pg import for serverless (Vercel Hobby)
// Preserves all existing helpers and TypeScript generics
// Uses process.env.DATABASE_URL
// ===============================

let _client: any;

// Get the server-side Postgres client
async function getClient() {
  if (_client) return _client;
  const { Client } = await import("pg"); // dynamic import to avoid TLS issues in serverless
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

// Generic query returning the first row or null
export async function queryOne<T = any>(text: string, params?: any[]): Promise<T | null> {
  const client = await getClient();
  const res = await client.query(text, params);
  return res.rows[0] || null;
}

// Export client getter for direct server usage
export { getClient as getDbClient };

// ===============================
// No other changes to your repo needed
// All existing exports in raffles.ts, campaigns.ts, pages, admin routes remain intact
// ===============================
