import type { NextApiRequest, NextApiResponse } from "next";
import { db } from "../../../../src/server/db";

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
        r."startNumber" as "startNumber",
        r."endNumber" as "endNumber",
        r.currency,
        r."ticketPrice" as "ticketPrice",
        r."imageUrl" as "imageUrl",
        r."isActive" as "isActive"
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

    const coloursResult = await db.query(
      `
      select
        rc.id::text,
        rc.name,
        rc.hex,
        coalesce(rc."sortOrder", 0) as "sortOrder"
      from raffle_colours rc
      where rc."raffleId" = $1
      order by coalesce(rc."sortOrder", 0), rc.name
      `,
      [raffle.id],
    );

    const offersResult = await db.query(
      `
      select
        ro.id::text,
        ro.label,
        ro.quantity,
        ro.price,
        coalesce(ro."isActive", true) as "isActive",
        coalesce(ro."sortOrder", 0) as "sortOrder"
      from raffle_offers ro
      where ro."raffleId" = $1
      order by coalesce(ro."sortOrder", 0), ro.quantity
      `,
      [raffle.id],
    );

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
        imageUrl: raffle.imageUrl ?? null,
        image_url: raffle.imageUrl ?? null,
        startNumber: Number(raffle.startNumber),
        endNumber: Number(raffle.endNumber),
        currency: raffle.currency,
        ticketPrice: Number(raffle.ticketPrice),
        isActive: Boolean(raffle.isActive),
        is_active: Boolean(raffle.isActive),
        colours: coloursResult.rows.map((row) => ({
          id: row.id,
          name: row.name,
          hex: row.hex,
          sortOrder: Number(row.sortOrder),
        })),
        offers: offersResult.rows.map((row) => ({
          id: row.id,
          label: row.label,
          quantity: Number(row.quantity),
          price: Number(row.price),
          isActive: Boolean(row.isActive),
          sortOrder: Number(row.sortOrder),
        })),
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
