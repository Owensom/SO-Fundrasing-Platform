import type { VercelRequest, VercelResponse } from "@vercel/node";

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed." });
  }

  const envValue = process.env.DATABASE_URL ?? "";

  return res.status(200).json({
    ok: true,
    nodeEnv: process.env.NODE_ENV ?? null,
    databaseUrlPresent: Boolean(envValue),
    databaseUrlStartsCorrectly:
      envValue.startsWith("postgres://") ||
      envValue.startsWith("postgresql://"),
    databaseUrlLength: envValue.length,
    databaseUrlHasQuotes:
      envValue.startsWith('"') ||
      envValue.endsWith('"') ||
      envValue.startsWith("'") ||
      envValue.endsWith("'"),
  });
}
