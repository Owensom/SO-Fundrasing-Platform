import type { VercelRequest, VercelResponse } from "@vercel/node";

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed." });
  }

  try {
    const dbModule = await import("../_lib/db");
    const result = await dbModule.query<{ now: string }>(
      "select now()::text as now"
    );

    return res.status(200).json({
      ok: true,
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
