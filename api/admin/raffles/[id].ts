import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL || process.env.DATABASE_URL,
});

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizeOffers(input: unknown) {
  if (!Array.isArray(input)) return [];

  const offers = input
    .map((item: any, index: number) => ({
      label: typeof item?.label === "string" ? item.label.trim() : null,
      ticket_quantity: Number(item?.ticket_quantity ?? item?.tickets),
      price_cents: Number(item?.price_cents),
      sort_order:
        item?.sort_order !== undefined ? Number(item.sort_order) : index,
      is_active: item?.is_active !== undefined ? Boolean(item.is_active) : true,
    }))
    .filter(
      (offer) => offer.ticket_quantity > 0 && offer.price_cents > 0
    );

  const seen = new Set<number>();

  for (const offer of offers) {
    if (!Number.isInteger(offer.ticket_quantity)) {
      throw new Error("Each offer.ticket_quantity must be a whole number");
    }

    if (!Number.isInteger(offer.price_cents) || offer.price_cents <= 0) {
      throw new Error("Each offer.price_cents must be a positive integer");
    }

    if (seen.has(offer.ticket_quantity)) {
      throw new Error(
        `Duplicate offer for ${offer.ticket_quantity} tickets`
      );
    }

    seen.add(offer.ticket_quantity);
  }

  return offers.sort((a, b) => a.sort_order - b.sort_order);
}

export default async function handler(req: any, res: any) {
  if (req.method !== "PUT") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { id } = req.query;

  if (!id) {
    return res.status(400).json({ error: "Missing raffle id" });
  }

  const client = await pool.connect();

  try {
    const body =
      typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};

    const tenantSlug = String(body.tenant_slug ?? "").trim();
    const title = String(body.title ?? "").trim();
    const slug = String(body.slug ?? "").trim() || slugify(title);
    const description = String(body.description ?? "").trim();
    const imageUrl = body.image_url ? String(body.image_url) : null;
    const ticketPriceCents = Number(body.ticket_price_cents ?? 0);
    const totalTickets = Number(body.total_tickets ?? 0);
    const status = String(body.status ?? "draft").trim();
    const offers = normalizeOffers(body.offers);

    if (!tenantSlug) {
      return res.status(400).json({ error: "tenant_slug is required" });
    }

    if (!title) {
      return res.status(400).json({ error: "title is required" });
    }

    if (!slug) {
      return res.status(400).json({ error: "slug is required" });
    }

    if (!Number.isInteger(ticketPriceCents) || ticketPriceCents <= 0) {
      return res
        .status(400)
        .json({ error: "ticket_price_cents must be a positive integer" });
    }

    if (!Number.isInteger(totalTickets) || totalTickets <= 0) {
      return res
        .status(400)
        .json({ error: "total_tickets must be a positive integer" });
    }

    await client.query("BEGIN");

    const raffleResult = await client.query(
      `
      UPDATE raffles
      SET
        tenant_slug = $1,
        slug = $2,
        title = $3,
        description = $4,
        image_url = $5,
        ticket_price_cents = $6,
        total_tickets = $7,
        status = $8,
        updated_at = NOW()
      WHERE id = $9
      RETURNING *
      `,
      [
        tenantSlug,
        slug,
        title,
        description,
        imageUrl,
        ticketPriceCents,
        totalTickets,
        status,
        id,
      ]
    );

    const raffle = raffleResult.rows[0];

    if (!raffle) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Raffle not found" });
    }

    await client.query(`DELETE FROM raffle_offers WHERE campaign_id = $1`, [id]);

    for (const offer of offers) {
      await client.query(
        `
        INSERT INTO raffle_offers (
          campaign_id,
          label,
          ticket_quantity,
          price_cents,
          sort_order,
          is_active,
          created_at,
          updated_at
        )
        VALUES ($1,$2,$3,$4,$5,$6,NOW(),NOW())
        `,
        [
          id,
          offer.label,
          offer.ticket_quantity,
          offer.price_cents,
          offer.sort_order,
          offer.is_active,
        ]
      );
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
      [id]
    );

    await client.query("COMMIT");

    return res.status(200).json({
      raffle: {
        ...raffle,
        offers: offersResult.rows,
      },
    });
  } catch (error: any) {
    await client.query("ROLLBACK");
    return res.status(500).json({
      error: error?.message || "Failed to update raffle",
    });
  } finally {
    client.release();
  }
}
