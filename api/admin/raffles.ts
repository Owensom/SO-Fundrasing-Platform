import { Pool } from "pg";
import crypto from "crypto";

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

function generateId() {
  return crypto.randomUUID();
}

function normalizeOffers(input: unknown) {
  if (!Array.isArray(input)) return [];

  const offers = input
    .map((item: any, index: number) => ({
      label: typeof item?.label === "string" ? item.label.trim() : null,
      tickets: Number(item?.tickets),
      price_cents: Number(item?.price_cents),
      sort_order:
        item?.sort_order !== undefined ? Number(item.sort_order) : index,
      active: item?.active !== undefined ? Boolean(item.active) : true,
    }))
    .filter((offer) => offer.tickets > 0 && offer.price_cents > 0);

  const seen = new Set<number>();

  for (const offer of offers) {
    if (!Number.isInteger(offer.tickets)) {
      throw new Error("Each offer.tickets must be a whole number");
    }

    if (!Number.isInteger(offer.price_cents) || offer.price_cents <= 0) {
      throw new Error("Each offer.price_cents must be a positive integer");
    }

    if (seen.has(offer.tickets)) {
      throw new Error(`Duplicate offer for ${offer.tickets} tickets`);
    }

    seen.add(offer.tickets);
  }

  return offers.sort((a, b) => a.sort_order - b.sort_order);
}

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const client = await pool.connect();

  try {
    const body =
      typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};

    const id = generateId();
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
      INSERT INTO raffles (
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
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,NOW(),NOW())
      RETURNING *
      `,
      [
        id,
        tenantSlug,
        slug,
        title,
        description,
        imageUrl,
        ticketPriceCents,
        totalTickets,
        0,
        status,
      ]
    );

    const raffle = raffleResult.rows[0];

    for (const offer of offers) {
      await client.query(
        `
        INSERT INTO raffle_offers (
          raffle_id,
          label,
          tickets,
          price_cents,
          sort_order,
          active,
          created_at,
          updated_at
        )
        VALUES ($1,$2,$3,$4,$5,$6,NOW(),NOW())
        `,
        [
          raffle.id,
          offer.label,
          offer.tickets,
          offer.price_cents,
          offer.sort_order,
          offer.active,
        ]
      );
    }

    const offersResult = await client.query(
      `
      SELECT
        id,
        label,
        tickets,
        price_cents,
        sort_order,
        active
      FROM raffle_offers
      WHERE raffle_id = $1
      ORDER BY sort_order ASC, tickets ASC
      `,
      [raffle.id]
    );

    await client.query("COMMIT");

    return res.status(201).json({
      raffle: {
        ...raffle,
        offers: offersResult.rows,
      },
    });
  } catch (error: any) {
    await client.query("ROLLBACK");
    return res.status(500).json({
      error: error?.message || "Failed to create raffle",
    });
  } finally {
    client.release();
  }
}
