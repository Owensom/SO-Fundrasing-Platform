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

    const result = await dbModule.query<{
      id: string;
      tenant_slug: string;
      slug: string;
      title: string;
      status: string;
    }>(`
      select id, tenant_slug, slug, title, status
      from raffles
      order by created_at desc
      limit 10
    `);

    return res.status(200).json({
      ok: true,
      count: result.rows.length,
      raffles: result.rows,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown raffles error.";

    return res.status(500).json({
      ok: false,
      error: message,
    });
  }
}
