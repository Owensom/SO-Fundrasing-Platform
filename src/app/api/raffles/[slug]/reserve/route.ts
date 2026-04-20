import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/neon";

export const runtime = "nodejs";

type RaffleRow = {
  id: string;
  tenant_slug: string;
  slug: string;
  title: string;
  currency: string | null;
  ticket_price_cents: number;
  total_tickets: number;
  sold_tickets: number;
  status: string;
  config_json: {
    startNumber?: number;
    endNumber?: number;
    colours?: string[];
    sold?: Array<{ colour: string; number: number }>;
    reserved?: Array<{ colour: string; number: number }>;
  } | null;
};

type ReservationRow = {
  ticket_number: number;
  colour: string | null;
};

function makeUuid() {
  return crypto.randomUUID();
}

function normalizeColour(value: unknown): string {
  return typeof value === "string" && value.trim() ? value.trim() : "default";
}

function normalizeSelectedTickets(value: unknown) {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const row = item as Record<string, unknown>;
      const ticketNumber = Number(row.ticket_number ?? row.number);
      const colour = normalizeColour(row.colour);

      if (!Number.isInteger(ticketNumber) || ticketNumber <= 0) return null;

      return {
        ticket_number: ticketNumber,
        colour,
      };
    })
    .filter(Boolean) as Array<{ ticket_number: number; colour: string }>;
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ slug: string }> },
) {
  try {
    const { slug } = await context.params;
    const body = await request.json();

    const buyerName =
      typeof body.buyerName === "string" ? body.buyerName.trim() : "";
    const buyerEmail =
      typeof body.buyerEmail === "string" ? body.buyerEmail.trim() : "";
    const selectedTickets = normalizeSelectedTickets(body.selectedTickets);

    if (!buyerName) {
      return NextResponse.json(
        { ok: false, error: "Buyer name is required" },
        { status: 400 },
      );
    }

    if (!buyerEmail) {
      return NextResponse.json(
        { ok: false, error: "Buyer email is required" },
        { status: 400 },
      );
    }

    if (!selectedTickets.length) {
      return NextResponse.json(
        { ok: false, error: "At least one ticket must be selected" },
        { status: 400 },
      );
    }

    const raffleRows = await sql`
      select
        id,
        tenant_slug,
        slug,
        title,
        currency,
        ticket_price_cents,
        total_tickets,
        sold_tickets,
        status,
        config_json
      from raffles
      where slug = ${slug}
      limit 1
    `;

    const raffle = raffleRows[0] as RaffleRow | undefined;

    if (!raffle) {
      return NextResponse.json(
        { ok: false, error: "Raffle not found" },
        { status: 404 },
      );
    }

    if (raffle.status !== "published") {
      return NextResponse.json(
        { ok: false, error: "Raffle is not published" },
        { status: 400 },
      );
    }

    const ticketPriceCents = Number(raffle.ticket_price_cents || 0);
    if (ticketPriceCents <= 0) {
      return NextResponse.json(
        { ok: false, error: "Invalid raffle ticket price" },
        { status: 400 },
      );
    }

    const startNumber = Number(raffle.config_json?.startNumber || 1);
    const endNumber =
      Number(raffle.config_json?.endNumber || raffle.total_tickets || 0) ||
      raffle.total_tickets;

    for (const ticket of selectedTickets) {
      if (
        !Number.isInteger(ticket.ticket_number) ||
        ticket.ticket_number < startNumber ||
        ticket.ticket_number > endNumber
      ) {
        return NextResponse.json(
          {
            ok: false,
            error: `Ticket ${ticket.ticket_number} is outside the allowed range`,
          },
          { status: 400 },
        );
      }
    }

    const duplicateCheck = new Set<string>();
    for (const ticket of selectedTickets) {
      const key = `${ticket.colour}::${ticket.ticket_number}`;
      if (duplicateCheck.has(key)) {
        return NextResponse.json(
          {
            ok: false,
            error: `Duplicate ticket selection: ${ticket.ticket_number} (${ticket.colour})`,
          },
          { status: 400 },
        );
      }
      duplicateCheck.add(key);
    }

    const existingReservations = (await sql`
      select ticket_number, colour
      from raffle_ticket_reservations
      where raffle_id = ${raffle.id}
        and status = 'reserved'
        and expires_at > now()
    `) as ReservationRow[];

    const existingSales = (await sql`
      select ticket_number, colour
      from raffle_ticket_sales
      where raffle_id = ${raffle.id}
    `) as ReservationRow[];

    const reservedKeys = new Set(
      existingReservations.map((row) => `${row.colour || "default"}::${row.ticket_number}`),
    );
    const soldKeys = new Set(
      existingSales.map((row) => `${row.colour || "default"}::${row.ticket_number}`),
    );

    for (const ticket of selectedTickets) {
      const key = `${ticket.colour}::${ticket.ticket_number}`;

      if (reservedKeys.has(key)) {
        return NextResponse.json(
          {
            ok: false,
            error: `Ticket ${ticket.ticket_number} (${ticket.colour}) is already reserved`,
          },
          { status: 409 },
        );
      }

      if (soldKeys.has(key)) {
        return NextResponse.json(
          {
            ok: false,
            error: `Ticket ${ticket.ticket_number} (${ticket.colour}) is already sold`,
          },
          { status: 409 },
        );
      }
    }

    const reservationToken = makeUuid();
    const reservationGroupId = makeUuid();

    for (const ticket of selectedTickets) {
      await sql`
        insert into raffle_ticket_reservations (
          id,
          reservation_group_id,
          raffle_id,
          colour,
          ticket_number,
          buyer_name,
          buyer_email,
          expires_at,
          reservation_token,
          unit_price_cents,
          checkout_session_id,
          payment_id,
          status
        ) values (
          ${makeUuid()}::uuid,
          ${reservationGroupId}::uuid,
          ${raffle.id},
          ${ticket.colour},
          ${ticket.ticket_number},
          ${buyerName},
          ${buyerEmail},
          now() + interval '15 minutes',
          ${reservationToken},
          ${ticketPriceCents},
          null,
          null,
          'reserved'
        )
      `;
    }

    return NextResponse.json({
      ok: true,
      reservationToken,
      raffleId: raffle.id,
      currency: (raffle.currency || "GBP").toUpperCase(),
      ticketPriceCents,
      quantity: selectedTickets.length,
      totalAmountCents: selectedTickets.length * ticketPriceCents,
      expiresInMinutes: 15,
      selectedTickets,
    });
  } catch (error) {
    console.error("reserve route error", error);
    return NextResponse.json(
      { ok: false, error: "Failed to reserve tickets" },
      { status: 500 },
    );
  }
}
