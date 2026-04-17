import { Pool } from "pg";

declare global {
  // eslint-disable-next-line no-var
  var __rafflePool: Pool | undefined;
}

export const db =
  global.__rafflePool ??
  new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl:
      process.env.NODE_ENV === "production"
        ? { rejectUnauthorized: false }
        : false,
  });

if (process.env.NODE_ENV !== "production") {
  global.__rafflePool = db;
}
