// src/lib/db.ts
// Dynamic pg import for serverless (Vercel Hobby)
// Preserves all helpers and TypeScript generics

let _client: any;

async function getClient() {
  if (_client) return _client;
  const { Client } = await import("pg");
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

// Export client getter
export { getClient as getDbClient };
