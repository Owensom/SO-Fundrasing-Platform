import type { NextApiRequest, NextApiResponse } from "next";
import { db } from "../../../../src/server/db";
import type { PublicRaffleResponse } from "../../../../src/types/raffles";

type ErrorResponse = {
  error: string;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<PublicRaffleResponse | ErrorResponse>,
) {
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
        r.start_number,
        r.end_number,
        r.currency,
        r.ticket_price,
        r.image_url,
        r.is_active
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
        coalesce(rc.sort_order, 0) as sort_order
      from raffle_colours rc
      where rc.raffle_id = $1
      order by coalesce(rc.sort_order, 0), rc.name
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
        coalesce(ro.is_active, true) as is_active,
        coalesce(ro.sort_order, 0) as sort_order
      from raffle_offers ro
      where ro.raffle_id = $1
      order by coalesce(ro.sort_order, 0), ro.quantity
      `,
      [raffle.id],
    );

    const reservedResult = await db.query(
      `
      select
        colour,
        ticket_number
      from raffle_ticket_reservations
      where raffle_id = $1
        and expires_at > now()
      `,
      [raffle.id],
    );

    const soldResult = await db.query(
      `
      select
        colour,
        ticket_number
      from raffle_ticket_sales
      where raffle_id = $1
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
        startNumber: Number(raffle.start_number),
        endNumber: Number(raffle.end_number),
        currency: raffle.currency,
        ticketPrice: Number(raffle.ticket_price),
        isActive: Boolean(raffle.is_active),
        is_active: Boolean(raffle.is_active),
        colours: coloursResult.rows.map((row) => ({
          id: row.id,
          name: row.name,
          hex: row.hex,
          sortOrder: Number(row.sort_order),
        })),
        offers: offersResult.rows.map((row) => ({
          id: row.id,
          label: row.label,
          quantity: Number(row.quantity),
          price: Number(row.price),
          isActive: Boolean(row.is_active),
          sortOrder: Number(row.sort_order),
        })),
        reservedTickets: reservedResult.rows.map((row) => ({
          colour: row.colour,
          number: Number(row.ticket_number),
        })),
        soldTickets: soldResult.rows.map((row) => ({
          colour: row.colour,
          number: Number(row.ticket_number),
        })),
      },
    });
  } catch (error) {
    console.error("GET /api/public/raffles/[slug] failed", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}
