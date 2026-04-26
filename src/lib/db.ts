// src/lib/db.ts
let _client: any;

export async function getDbClient() {
  if (_client) return _client;

  // Dynamic import for server-only Node pg
  const { Client } = await import("pg");

  _client = new Client({
    connectionString: process.env.DATABASE_URL, // use Vercel env variable directly
  });

  await _client.connect();
  return _client;
}
