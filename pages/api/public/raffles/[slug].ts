import type { NextApiRequest, NextApiResponse } from "next";
import { db } from "../../../../src/server/db";

type ConfigJson = {
  startNumber?: number;
  endNumber?: number;
  colours?: Array<{
    id?: string;
    name: string;
    hex?: string | null;
    sortOrder?: number;
  }>;
  offers?: Array<{
    id?: string;
    label: string;
    quantity: number;
    price?: number;
    priceCents?: number;
    isActive?: boolean;
    sortOrder?: number;
  }>;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const slugParam = req.query.slug;
  const slug = Array.isArray(slugParam) ? slugParam[0] : slugParam;

  if (!slug) {
    return res.status(400).json({ error: "Missing slug" });
  }

  try {
    const raffleResult = await db.query(
      `
      select
        r.id::text,
        r.slug,
        r.title,
        r.description,
        r.image_url,
        r.ticket_price_cents,
        r.currency,
        r.status,
        r.config_json
      from raffles r
      where r.slug = $1
      limit 1
      `,
      [slug],
    );

    if (raffleResult.rowCount === 0) {
      return res.status(404).json({ error: "Raffle not found" });
    }

    const raffle = raffleResult.rows[0];
    const config = (raffle.config_json ?? {}) as ConfigJson;

    const startNumber = Number(config.startNumber ?? 1);
    const endNumber = Number(config.endNumber ?? 1);

    const colours = Array.isArray(config.colours)
      ? config.colours.map((colour, index) => ({
          id: colour.id ?? `${raffle.id}-${index}`,
          name: colour.name,
          hex: colour.hex ?? null,
          sortOrder: Number(colour.sortOrder ?? index),
        }))
      : [];

    const offers = Array.isArray(config.offers)
      ? config.offers.map((offer, index) => ({
          id: offer.id ?? `${raffle.id}-offer-${index}`,
          label: offer.label,
          quantity: Number(offer.quantity ?? 0),
          price:
            typeof offer.price === "number"
              ? offer.price
              : Number((offer.priceCents ?? 0) / 100),
          isActive: Boolean(offer.isActive ?? true),
          sortOrder: Number(offer.sortOrder ?? index),
        }))
      : [];

    const reservedResult = await db.query(
      `
      select
        colour,
        "ticketNumber" as "ticketNumber"
      from raffle_ticket_reservations
      where "raffleId" = $1
        and "expiresAt" > now()
      `,
      [raffle.id],
    );

    const soldResult = await db.query(
      `
      select
        colour,
        "ticketNumber" as "ticketNumber"
      from raffle_ticket_sales
      where "raffleId" = $1
      `,
      [raffle.id],
    );

    return res.status(200).json({
      ok: true,
      raffle: {
        id: raffle.id,
        slug: raffle.slug,
        title: raffle.title,
        description: raffle.description ?? null,
        imageUrl: raffle.image_url ?? null,
        image_url: raffle.image_url ?? null,
        startNumber,
        endNumber,
        currency: raffle.currency,
        ticketPrice: Number(raffle.ticket_price_cents) / 100,
        isActive: raffle.status === "active",
        is_active: raffle.status === "active",
        colours,
        offers,
        reservedTickets: reservedResult.rows.map((row) => ({
          colour: row.colour,
          number: Number(row.ticketNumber),
        })),
        soldTickets: soldResult.rows.map((row) => ({
          colour: row.colour,
          number: Number(row.ticketNumber),
        })),
      },
    });
  } catch (error) {
    console.error("GET /api/public/raffles/[slug] failed", error);

    return res.status(500).json({
      error: "Internal server error",
      details: error instanceof Error ? error.message : String(error),
    });
  }
}
