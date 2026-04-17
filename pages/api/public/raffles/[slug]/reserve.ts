import { randomUUID } from "crypto";
import type { NextApiRequest, NextApiResponse } from "next";
import { getBestPrice } from "../../../../../src/lib/rafflePricing";
import { db } from "../../../../../src/server/db";
import type {
  RaffleOffer,
  ReserveTicketsRequest,
  ReserveTicketsResponse,
  TicketSelection,
} from "../../../../../src/types/raffles";

type ErrorResponse = {
  error: string;
};

function makeTicketKey(colour: string, number: number) {
  return `${colour}::${number}`;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ReserveTicketsResponse | ErrorResponse>,
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const raffleIdParam = req.query.raffleId;
  const raffleId = Array.isArray(raffleIdParam) ? raffleIdParam[0] : raffleIdParam;

  if (!raffleId) {
    return res.status(400).json({ error: "Missing raffle id" });
  }

  const body = req.body as ReserveTicketsRequest;
  const buyerName = body?.buyerName?.trim();
  const buyerEmail = body?.buyerEmail?.trim().toLowerCase();
  const tickets = Array.isArray(body?.tickets) ? body.tickets : [];

  if (!buyerName) {
    return res.status(400).json({ error: "Buyer name is required" });
  }

  if (!buyerEmail) {
    return res.status(400).json({ error: "Buyer email is required" });
  }

  if (tickets.length === 0) {
    return res.status(400).json({ error: "At least one ticket is required" });
  }

  const dedupedMap = new Map<string, TicketSelection>();
  for (const ticket of tickets) {
    if (!ticket?.colour || !Number.isInteger(ticket?.number)) {
      return res.status(400).json({ error: "Invalid ticket selection" });
    }

    dedupedMap.set(makeTicketKey(ticket.colour, ticket.number), {
      colour: ticket.colour,
      number: ticket.number,
    });
  }

  const cleanTickets = Array.from(dedupedMap.values());

  const client = await db.connect();

  try {
    await client.query("begin");

    await client.query(`
      delete from raffle_ticket_reservations
      where expires_at <= now()
    `);

    const raffleResult = await client.query(
      `
      select
        id::text,
        slug,
        title,
        start_number,
        end_number,
        currency,
        ticket_price
      from raffles
      where id = $1
      limit 1
      `,
      [raffleId],
    );

    if (raffleResult.rowCount === 0) {
      await client.query("rollback");
      return res.status(404).json({ error: "Raffle not found" });
    }

    const raffle = raffleResult.rows[0];

    const coloursResult = await client.query(
      `
      select name
      from raffle_colours
      where raffle_id = $1
      `,
      [raffleId],
    );

    const allowedColours = new Set<string>(coloursResult.rows.map((row) => row.name));

    for (const ticket of cleanTickets) {
      if (!allowedColours.has(ticket.colour)) {
        await client.query("rollback");
        return res.status(400).json({ error: `Invalid colour: ${ticket.colour}` });
      }

      if (
        ticket.number < Number(raffle.start_number) ||
        ticket.number > Number(raffle.end_number)
      ) {
        await client.query("rollback");
        return res.status(400).json({
          error: `Ticket ${ticket.number} is outside the valid range`,
        });
      }
    }

    const soldResult = await client.query(
      `
      select colour, ticket_number
      from raffle_ticket_sales
      where raffle_id = $1
      `,
      [raffleId],
    );

    const reservedResult = await client.query(
      `
      select colour, ticket_number
      from raffle_ticket_reservations
      where raffle_id = $1
        and expires_at > now()
      `,
      [raffleId],
    );

    const unavailable = new Set<string>();

    for (const row of soldResult.rows) {
      unavailable.add(makeTicketKey(row.colour, Number(row.ticket_number)));
    }

    for (const row of reservedResult.rows) {
      unavailable.add(makeTicketKey(row.colour, Number(row.ticket_number)));
    }

    for (const ticket of cleanTickets) {
      if (unavailable.has(makeTicketKey(ticket.colour, ticket.number))) {
        await client.query("rollback");
        return res.status(409).json({
          error: `Ticket ${ticket.colour} #${ticket.number} is no longer available`,
        });
      }
    }

    const offersResult = await client.query(
      `
      select
        id::text,
        label,
        quantity,
        price,
        coalesce(is_active, true) as is_active,
        coalesce(sort_order, 0) as sort_order
      from raffle_offers
      where raffle_id = $1
      `,
      [raffleId],
    );

    const offers: RaffleOffer[] = offersResult.rows.map((row) => ({
      id: row.id,
      label: row.label,
      quantity: Number(row.quantity),
      price: Number(row.price),
      isActive: Boolean(row.is_active),
      sortOrder: Number(row.sort_order),
    }));

    const pricing = getBestPrice(
      cleanTickets.length,
      Number(raffle.ticket_price),
      offers,
    );

    const reservationGroupId = randomUUID();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    for (const ticket of cleanTickets) {
      await client.query(
        `
        insert into raffle_ticket_reservations (
          id,
          reservation_group_id,
          raffle_id,
          colour,
          ticket_number,
          buyer_name,
          buyer_email,
          expires_at
        )
        values ($1, $2, $3, $4, $5, $6, $7, $8)
        `,
        [
          randomUUID(),
          reservationGroupId,
          raffleId,
          ticket.colour,
          ticket.number,
          buyerName,
          buyerEmail,
          expiresAt.toISOString(),
        ],
      );
    }

    await client.query("commit");

    return res.status(200).json({
      ok: true,
      reservationGroupId,
      expiresAt: expiresAt.toISOString(),
      checkoutDraft: {
        raffleId: raffle.id,
        raffleSlug: raffle.slug,
        raffleTitle: raffle.title,
        buyerName,
        buyerEmail,
        tickets: cleanTickets,
        quantity: cleanTickets.length,
        currency: raffle.currency,
        subtotal: pricing.subtotal,
        discount: pricing.discount,
        total: pricing.total,
        pricingBreakdown: {
          singlesCount: pricing.singlesCount,
          singlesTotal: pricing.singlesTotal,
          appliedOffers: pricing.appliedOffers,
        },
      },
    });
  } catch (error) {
    await client.query("rollback");
    console.error("POST /api/public/raffles/[raffleId]/reserve failed", error);
    return res.status(500).json({ error: "Internal server error" });
  } finally {
    client.release();
  }
}
