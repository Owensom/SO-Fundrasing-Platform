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
      tickets: Number(item?.tickets),
      price: Number(item?.price),
      sort_order:
        item?.sort_order !== undefined ? Number(item.sort_order) : index,
      active: item?.active !== undefined ? Boolean(item.active) : true,
    }))
    .filter((offer) => offer.tickets > 0 && offer.price > 0);

  const seen = new Set<number>();

  for (const offer of offers) {
    if (!Number.isInteger(offer.tickets)) {
      throw new Error("Each offer.tickets must be a whole number");
    }

    if (!Number.isFinite(offer.price)) {
      throw new Error("Each offer.price must be a valid number");
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

    const title = String(body.title ?? "").trim();
    const slug = String(body.slug ?? "").trim() || slugify(title);
    const description = String(body.description ?? "").trim();
    const imageUrl = body.image_url ? String(body.image_url) : null;
    const primaryColor = String(body.primary_color ?? "#111111");
    const secondaryColor = String(body.secondary_color ?? "#ffffff");
    const minNumber = Number(body.min_number ?? 1);
    const maxNumber = Number(body.max_number ?? 9999);
    const ticketPrice = Number(body.ticket_price ?? 0);
    const offers = normalizeOffers(body.offers);

    if (!title) {
      return res.status(400).json({ error: "Title is required" });
    }

    if (!slug) {
      return res.status(400).json({ error: "Slug is required" });
    }

    if (!Number.isFinite(ticketPrice) || ticketPrice <= 0) {
      return res
        .status(400)
        .json({ error: "ticket_price must be greater than 0" });
    }

    if (
      !Number.isInteger(minNumber) ||
      !Number.isInteger(maxNumber) ||
      minNumber <= 0 ||
      maxNumber <= 0 ||
      minNumber >= maxNumber
    ) {
      return res.status(400).json({ error: "Invalid number range" });
    }

    await client.query("BEGIN");

    const raffleResult = await client.query(
      `
      INSERT INTO raffles (
        title,
        slug,
        description,
        image_url,
        primary_color,
        secondary_color,
        min_number,
        max_number,
        ticket_price,
        created_at,
        updated_at
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,NOW(),NOW())
      RETURNING *
      `,
      [
        title,
        slug,
        description,
        imageUrl,
        primaryColor,
        secondaryColor,
        minNumber,
        maxNumber,
        ticketPrice,
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
          price,
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
          offer.price,
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
        price,
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
