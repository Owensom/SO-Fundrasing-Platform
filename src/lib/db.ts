// src/lib/db.ts
import { env } from "@/env.mjs";

let _client: any;

export async function getDbClient() {
  if (_client) return _client;

  // Dynamic import avoids bundling Node-only 'pg' in client code
  const { Client } = await import("pg");

  _client = new Client({
    connectionString: env.DATABASE_URL,
  });

  await _client.connect();
  return _client;
}
