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
  details?: string;
};

type RawColour =
  | string
  | {
      id?: string;
      name?: string;
      label?: string;
      value?: string;
      hex?: string | null;
      sortOrder?: number;
    };

type RawOffer = {
  id?: string;
  label?: string;
  quantity?: number;
  price?: number;
  priceCents?: number;
  isActive?: boolean;
  sortOrder?: number;
};

type ConfigJson = {
  startNumber?: number;
  endNumber?: number;
  colours?: RawColour[];
  offers?: RawOffer[];
};

function makeTicketKey(colour: string, number: number) {
  return `${colour}::${number}`;
}

function titleCase(value: string) {
  return value
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function normaliseHex(value?: string | null) {
  if (!value) return null;
  const hex = String(value).trim().toLowerCase();
  return /^#?[0-9a-f]{6}$/i.test(hex) ? (hex.startsWith("#") ? hex : `#${hex}`) : null;
}

function nameFromHex(hex?: string | null) {
  const value = normaliseHex(hex);
  if (!value) return null;

  const known: Record<string, string> = {
    "#dc2626": "Red",
    "#ef4444": "Red",
    "#b91c1c": "Red",
    "#2563eb": "Blue",
    "#3b82f6": "Blue",
    "#1d4ed8": "Blue",
    "#16a34a": "Green",
    "#22c55e": "Green",
    "#15803d": "Green",
    "#eab308": "Yellow",
    "#facc15": "Yellow",
    "#ca8a04": "Yellow",
    "#f97316": "Orange",
    "#ea580c": "Orange",
    "#fb923c": "Orange",
    "#9333ea": "Purple",
    "#a855f7": "Purple",
    "#7e22ce": "Purple",
    "#ec4899": "Pink",
    "#db2777": "Pink",
    "#f472b6": "Pink",
    "#111827": "Black",
    "#000000": "Black",
    "#ffffff": "White",
    "#f8fafc": "White",
    "#e5e7eb": "Grey",
    "#9ca3af": "Grey",
    "#6b7280": "Grey",
  };

  return known[value] ?? null;
}

function normaliseColourName(colour: RawColour, index: number) {
  if (typeof colour === "string") {
    const asHexName = nameFromHex(colour);
    if (asHexName) return asHexName;
    return titleCase(colour);
  }

  const explicit =
    colour?.name ||
    colour?.label ||
    colour?.value;

  if (explicit && !/^#?[0-9a-f]{6}$/i.test(String(explicit).trim())) {
    return titleCase(String(explicit));
  }

  const fromId = colour?.id ? titleCase(String(colour.id)) : null;
  const fromHex = nameFromHex(colour?.hex ?? (typeof explicit === "string" ? explicit : null));

  return fromHex || fromId || `Colour ${index + 1}`;
}

async function tableExists(
  client: { query: (sql: string, params?: unknown[]) => Promise<any> },
  tableName: string,
) {
  const result = await client.query(
    `
    select exists (
      select 1
      from information_schema.tables
      where table_schema = 'public'
        and table_name = $1
    ) as exists
    `,
    [tableName],
  );

  return Boolean(result.rows[0]?.exists);
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ReserveTicketsResponse | ErrorResponse>,
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const slugParam = req.query.slug;
  const slug = Array.isArray(slugParam) ? slugParam[0] : slugParam;

  if (!slug) {
    return res.status(400).json({ error: "Missing slug" });
  }

  const body = req.body as ReserveTicketsRequest | undefined;
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

    const hasReservationsTable = await tableExists(client, "raffle_ticket_reservations");
    const hasSalesTable = await tableExists(client, "raffle_ticket_sales");

    if (!hasReservationsTable) {
      await client.query("rollback");
      return res.status(500).json({
        error: "Reservation table is missing",
        details: "raffle_ticket_reservations does not exist",
      });
    }

    if (!hasSalesTable) {
      await client.query("rollback");
      return res.status(500).json({
        error: "Sales table is missing",
        details: "raffle_ticket_sales does not exist",
      });
    }

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
        ticket_price_cents,
        currency,
        status,
        config_json
      from raffles
      where slug = $1
      limit 1
      `,
      [slug],
    );

    if (raffleResult.rowCount === 0) {
      await client.query("rollback");
      return res.status(404).json({ error: "Raffle not found" });
    }

    const raffle = raffleResult.rows[0];
    const config = (raffle.config_json ?? {}) as ConfigJson;

    const startNumber = Number(config.startNumber ?? 1);
    const endNumber = Number(config.endNumber ?? 1);

    const allowedColours = new Set<string>(
      Array.isArray(config.colours)
        ? config.colours.map((colour, index) => normaliseColourName(colour, index))
        : [],
    );

    const offers: RaffleOffer[] = Array.isArray(config.offers)
      ? config.offers.map((offer, index) => ({
          id: String(offer.id ?? `offer-${index}`),
          label: String(offer.label ?? `Offer ${index + 1}`),
          quantity: Number(offer.quantity ?? 0),
          price:
            typeof offer.price === "number"
              ? offer.price
              : Number((offer.priceCents ?? 0) / 100),
          isActive: Boolean(offer.isActive ?? true),
          sortOrder: Number(offer.sortOrder ?? index),
        }))
      : [];

    for (const ticket of cleanTickets) {
      if (allowedColours.size > 0 && !allowedColours.has(ticket.colour)) {
        await client.query("rollback");
        return res.status(400).json({
          error: `Invalid colour: ${ticket.colour}`,
        });
      }

      if (ticket.number < startNumber || ticket.number > endNumber) {
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
      [raffle.id],
    );

    const reservedResult = await client.query(
      `
      select colour, ticket_number
      from raffle_ticket_reservations
      where raffle_id = $1
        and expires_at > now()
      `,
      [raffle.id],
    );

    const unavailable = new Set<string>();

    for (const row of soldResult.rows) {
      unavailable.add(makeTicketKey(String(row.colour), Number(row.ticket_number)));
    }

    for (const row of reservedResult.rows) {
      unavailable.add(makeTicketKey(String(row.colour), Number(row.ticket_number)));
    }

    for (const ticket of cleanTickets) {
      if (unavailable.has(makeTicketKey(ticket.colour, ticket.number))) {
        await client.query("rollback");
        return res.status(409).json({
          error: `Ticket ${ticket.colour} #${ticket.number} is no longer available`,
        });
      }
    }

    const pricing = getBestPrice(
      cleanTickets.length,
      Number(raffle.ticket_price_cents ?? 0) / 100,
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
          raffle.id,
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
    try {
      await client.query("rollback");
    } catch {}

    console.error("POST /api/public/raffles/[slug]/reserve failed", error);

    return res.status(500).json({
      error: "Internal server error",
      details: error instanceof Error ? error.message : String(error),
    });
  } finally {
    client.release();
  }
}
