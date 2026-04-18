import type { NextApiRequest, NextApiResponse } from "next";
import { db } from "../../../../src/server/db";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const slugParam = req.query.slug;
  const slug = Array.isArray(slugParam) ? slugParam[0] : slugParam;

  if (!slug) {
    return res.status(400).json({ error: "Missing slug" });
  }

  try {
    const result = await db.query(
      `
      select
        id::text,
        slug,
        title,
        description,
        image_url,
        ticket_price_cents,
        total_tickets,
        sold_tickets,
        status,
        currency,
        config_json
      from raffles
      where slug = $1
      limit 1
      `,
      [slug],
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Raffle not found" });
    }

    return res.status(200).json({
      ok: true,
      raffle: result.rows[0],
    });
  } catch (error) {
    return res.status(500).json({
      error: "Internal server error",
      details: error instanceof Error ? error.message : String(error),
    });
  }
}
