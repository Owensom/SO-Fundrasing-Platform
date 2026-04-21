import { NextRequest, NextResponse } from "next/server";
import { query, queryOne } from "@/lib/db";
import { getRaffleBySlug } from "@/lib/raffles";

type ReserveBody = {
  tenantSlug?: string;
  quantity?: number;
  selectedTickets?: Array<{
    ticket_number?: number;
    colour?: string | null;
  }>;
};

type ReservedOrSoldRow = {
  ticket_number: number;
  colour: string | null;
};

type InsertedReservationRow = {
  id: string;
  reservation_token: string;
  expires_at: string;
};

function normalizeSelectedTickets(
  value: unknown
): Array<{ ticket_number: number; colour: string | null }> {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => {
      if (!item || typeof item !== "object") return null;

      const row = item as Record<string, unknown>;
      const ticketNumber = Number(row.ticket_number);
      const colour =
        typeof row.colour === "string" && row.colour.trim()
          ? row.colour.trim()
          : null;

      if (!Number.isInteger(ticketNumber)) return null;

      return {
        ticket_number: ticketNumber,
        colour,
      };
    })
    .filter(Boolean) as Array<{ ticket_number: number; colour: string | null }>;
}

function hasDuplicateTickets(
  tickets: Array<{ ticket_number: number; colour: string | null }>
) {
  const seen = new Set<string>();

  for (const ticket of tickets) {
    const key = `${ticket.ticket_number}::${ticket.colour ?? ""}`;
    if (seen.has(key)) return true;
    seen.add(key);
  }

  return false;
}

export async function POST(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const body = (await request.json()) as ReserveBody;

    const tenantSlug =
      typeof body.tenantSlug === "string" ? body.tenantSlug.trim() : "";
    const slug = params.slug;

    if (!tenantSlug || !slug) {
      return NextResponse.json(
        { ok: false, error: "Missing tenant or raffle slug." },
        { status: 400 }
      );
    }

    const raffle = await getRaffleBySlug(tenantSlug, slug);

    if (!raffle || raffle.status !== "published") {
      return NextResponse.json(
        { ok: false, error: "This raffle is not open for reservations." },
        { status: 400 }
      );
    }

    const selectedTickets = normalizeSelectedTickets(body.selectedTickets);
    const quantity =
      typeof body.quantity === "number" ? Math.max(0, Math.floor(body.quantity)) : 0;

    if (selectedTickets.length === 0 && quantity <= 0) {
      return NextResponse.json(
        { ok: false, error: "No tickets selected." },
        { status: 400 }
      );
    }

    if (selectedTickets.length > 0 && hasDuplicateTickets(selectedTickets)) {
      return NextResponse.json(
        { ok: false, error: "Duplicate tickets selected." },
        { status: 400 }
      );
    }

    if (selectedTickets.length > 0 && quantity > 0 && selectedTickets.length !== quantity) {
      return NextResponse.json(
        { ok: false, error: "Selected ticket count does not match quantity." },
        { status: 400 }
      );
    }

    const requestedQuantity =
      selectedTickets.length > 0 ? selectedTickets.length : quantity;

    if (requestedQuantity <= 0) {
      return NextResponse.json(
        { ok: false, error: "Invalid quantity." },
        { status: 400 }
      );
    }

    const remainingTickets = Math.max(
      Number(raffle.total_tickets) - Number(raffle.sold_tickets),
      0
    );

    if (requestedQuantity > remainingTickets) {
      return NextResponse.json(
        { ok: false, error: "Not enough tickets remaining." },
        { status: 400 }
      );
    }

    if (selectedTickets.length > 0) {
      const valuesSql = selectedTickets
        .map((_, index) => {
          const base = index * 2;
          return `($${base + 2}, $${base + 3})`;
        })
        .join(", ");

      const soldOrReserved = await query<ReservedOrSoldRow>(
        `
        with requested(ticket_number, colour) as (
          values ${valuesSql}
        )
        select ticket_number, colour
        from (
          select rtr.ticket_number, rtr.colour
          from raffle_ticket_reservations rtr
          where rtr.raffle_id = $1
            and rtr.expires_at > now()

          union all

          select rts.ticket_number, rts.colour
          from raffle_ticket_sales rts
          where rts.raffle_id = $1
        ) taken
        inner join requested req
          on req.ticket_number = taken.ticket_number
         and coalesce(req.colour, '') = coalesce(taken.colour, '')
        `,
        [
          raffle.id,
          ...selectedTickets.flatMap((ticket) => [
            ticket.ticket_number,
            ticket.colour,
          ]),
        ]
      );

      if (soldOrReserved.length > 0) {
        return NextResponse.json(
          {
            ok: false,
            error: "One or more selected tickets are no longer available.",
            unavailable: soldOrReserved,
          },
          { status: 409 }
        );
      }
    }

    const reservation = await queryOne<InsertedReservationRow>(
      `
      insert into raffle_ticket_reservations (
        id,
        raffle_id,
        reservation_token,
        quantity,
        expires_at,
        created_at
      )
      values (
        gen_random_uuid()::text,
        $1,
        gen_random_uuid()::text,
        $2,
        now() + interval '15 minutes',
        now()
      )
      returning id, reservation_token, expires_at
      `,
      [raffle.id, requestedQuantity]
    );

    if (!reservation) {
      return NextResponse.json(
        { ok: false, error: "Failed to create reservation." },
        { status: 500 }
      );
    }

    if (selectedTickets.length > 0) {
      for (const ticket of selectedTickets) {
        await query(
          `
          insert into raffle_ticket_reservations_tickets (
            id,
            reservation_id,
            raffle_id,
            ticket_number,
            colour,
            created_at
          )
          values (
            gen_random_uuid()::text,
            $1,
            $2,
            $3,
            $4,
            now()
          )
          `,
          [
            reservation.id,
            raffle.id,
            ticket.ticket_number,
            ticket.colour,
          ]
        );
      }
    }

    return NextResponse.json({
      ok: true,
      reservationToken: reservation.reservation_token,
      expiresAt: reservation.expires_at,
      quantity: requestedQuantity,
      selectedTickets,
    });
  } catch (error) {
    console.error("raffle reserve error", error);

    return NextResponse.json(
      { ok: false, error: "Internal server error." },
      { status: 500 }
    );
  }
}
