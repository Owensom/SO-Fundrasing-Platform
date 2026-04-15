import type { VercelRequest, VercelResponse } from "@vercel/node";
import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL || process.env.DATABASE_URL,
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const slug = String(req.query.slug || "").trim();

  if (!slug) {
    return res.status(400).json({ error: "Missing slug" });
  }

  const client = await pool.connect();

  try {
    const raffleResult = await client.query(
      `
      SELECT
        id,
        tenant_slug,
        slug,
        title,
        description,
        image_url,
        ticket_price_cents,
        total_tickets,
        sold_tickets,
        status,
        created_at,
        updated_at
      FROM raffles
      WHERE slug = $1
      LIMIT 1
      `,
      [slug]
    );

    const raffle = raffleResult.rows[0];

    if (!raffle) {
      return res.status(404).json({ error: "Raffle not found" });
    }

    const offersResult = await client.query(
      `
      SELECT
        id,
        label,
        ticket_quantity,
        price_cents,
        sort_order,
        is_active
      FROM raffle_offers
      WHERE campaign_id = $1
      ORDER BY sort_order ASC, ticket_quantity ASC
      `,
      [raffle.id]
    );

    return res.status(200).json({
      raffle: {
        ...raffle,
        offers: offersResult.rows,
      },
    });
  } catch (error: any) {
    return res.status(500).json({
      error: error?.message || "Failed to load raffle details",
    });
  } finally {
    client.release();
  }
}
