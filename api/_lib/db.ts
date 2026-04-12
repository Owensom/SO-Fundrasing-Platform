import { Pool, type PoolClient, type QueryResult, type QueryResultRow } from "pg";

declare global {
  // eslint-disable-next-line no-var
  var __platformPgPool: Pool | undefined;
}

function getDatabaseUrl(): string {
  const value = process.env.DATABASE_URL;

  if (!value || !value.trim()) {
    throw new Error("DATABASE_URL is not configured.");
  }

  const trimmed = value.trim();

  if (
    trimmed.startsWith('"') ||
    trimmed.endsWith('"') ||
    trimmed.startsWith("'") ||
    trimmed.endsWith("'")
  ) {
    throw new Error(
      "DATABASE_URL appears to include quotes. Remove surrounding quotes in Vercel environment variables."
    );
  }

  if (
    !trimmed.startsWith("postgres://") &&
    !trimmed.startsWith("postgresql://")
  ) {
    throw new Error(
      "DATABASE_URL must start with postgres:// or postgresql://"
    );
  }

  return trimmed;
}

function getPool(): Pool {
  const connectionString = getDatabaseUrl();

  if (!globalThis.__platformPgPool) {
    globalThis.__platformPgPool = new Pool({
      connectionString,
      ssl:
        connectionString.includes("localhost") ||
        connectionString.includes("127.0.0.1")
          ? false
          : { rejectUnauthorized: false },
    });
  }

  return globalThis.__platformPgPool;
}

export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: unknown[] = []
): Promise<QueryResult<T>> {
  return getPool().query<T>(text, params);
}

export async function withTransaction<T>(
  callback: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await getPool().connect();

  try {
    await client.query("begin");
    const result = await callback(client);
    await client.query("commit");
    return result;
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}
