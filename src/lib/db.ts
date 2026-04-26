// src/lib/db.ts
// =======================================
// Changes: Removed reference to non-existent `env.mjs`
// Use process.env.DATABASE_URL directly
// Added dynamic import of 'pg' for server-only use
// =======================================
let _client: any;

export async function getDbClient() {
  if (_client) return _client;

  // Dynamic import avoids bundling Node-only 'pg' in client code (fix TLS error)
  const { Client } = await import("pg");

  _client = new Client({
    connectionString: process.env.DATABASE_URL, // Vercel env variable
  });

  await _client.connect();
  return _client;
}
