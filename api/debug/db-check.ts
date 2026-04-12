import type { VercelRequest, VercelResponse } from "@vercel/node";
import { query } from "../_lib/db";

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed." });
  }

  try {
    const envValue = process.env.DATABASE_URL ?? "";
    const maskedUrl =
      envValue.length > 20
        ? `${envValue.slice(0, 18)}...`
        : envValue || "(missing)";

    const result = await query<{ now: string }>("select now()::text as now");

    return res.status(200).json({
      ok: true,
      databaseUrlPresent: Boolean(envValue),
      databaseUrlStartsCorrectly:
        envValue.startsWith("postgres://") ||
        envValue.startsWith("postgresql://"),
      maskedUrl,
      serverTime: result.rows[0]?.now ?? null,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown database error.";

    return res.status(500).json({
      ok: false,
      error: message,
    });
  }
}
