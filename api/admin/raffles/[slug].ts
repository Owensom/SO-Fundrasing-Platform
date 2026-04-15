import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL || process.env.DATABASE_URL,
});

export default async function handler(req: any, res: any) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { slug } = req.query;

  if (!slug) {
    return res.status(400).json({ error: "Missing raffle slug" });
  }

  const client = await pool.connect();

  try {
    const raffleResult = await client.query(
      `
      SELECT
        id,
        title,
        slug,
        description,
        image_url,
        primary_color,
        secondary_color,
        min_number,
        max_number,
        ticket_price
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
        tickets,
        price,
        sort_order,
        active
      FROM raffle_offers
      WHERE raffle_id = $1
        AND active = TRUE
      ORDER BY sort_order ASC, tickets ASC
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
      error: error?.message || "Failed to fetch raffle",
    });
  } finally {
    client.release();
  }
}
