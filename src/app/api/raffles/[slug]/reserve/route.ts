import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { query } from "@/lib/db";
import { getRaffleBySlug } from "@/lib/raffles";

type ReserveBody = {
  tenantSlug?: string;
  quantity?: number;
  buyerName?: string;
  buyerEmail?: string;
  tickets?: Array<{
    number?: number;
    colour?: string | null;
  }>;
  selectedTickets?: Array<{
    ticket_number?: number;
    colour?: string | null;
  }>;
};

type TakenRow = {
  ticket_number: number;
  colour: string | null;
};

function normalizeSelectedTickets(
  body: ReserveBody
): Array<{ ticket_number: number; colour: string | null }> {
  const fromTickets = Array.isArray(body.tickets) ? body.tickets : [];
  const fromSelectedTickets = Array.isArray(body.selectedTickets)
    ? body.selectedTickets
    : [];

  const normalizedFromTickets = fromTickets
    .map((item) => {
      if (!item || typeof item !== "object") return null;

      const ticketNumber = Number(item.number);
      const colour =
        typeof item.colour === "string" && item.colour.trim()
          ? item.colour.trim()
          : null;

      if (!Number.isInteger(ticketNumber)) return null;

      return {
        ticket_number: ticketNumber,
        colour,
      };
    })
    .filter(Boolean) as Array<{ ticket_number: number; colour: string | null }>;

  const normalizedFromSelectedTickets = fromSelectedTickets
    .map((item) => {
      if (!item || typeof item !== "object") return null;

      const ticketNumber = Number(item.ticket_number);
      const colour =
        typeof item.colour === "string" && item.colour.trim()
          ? item.colour.trim()
          : null;

      if (!Number.isInteger(ticketNumber)) return null;

      return {
        ticket_number: ticketNumber,
        colour,
      };
    })
    .filter(Boolean) as Array<{ ticket_number: number; colour: string | null }>;

  return normalizedFromTickets.length > 0
    ? normalizedFromTickets
    : normalizedFromSelectedTickets;
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
    const buyerName =
      typeof body.buyerName === "string" ? body.buyerName.trim() : "";
    const buyerEmail =
      typeof body.buyerEmail === "string" ? body.buyerEmail.trim() : "";

    if (!tenantSlug || !slug) {
      return NextResponse.json(
        { ok: false, error: "Missing tenant or raffle slug." },
        { status: 400 }
      );
    }

    if (!buyerName) {
      return NextResponse.json(
        { ok: false, error: "Buyer name is required." },
        { status: 400 }
      );
    }

    if (!buyerEmail) {
      return NextResponse.json(
        { ok: false, error: "Buyer email is required." },
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

    const selectedTickets = normalizeSelectedTickets(body);
    const quantity =
      typeof body.quantity === "number"
        ? Math.max(0, Math.floor(body.quantity))
        : 0;

    if (selectedTickets.length === 0 && quantity <= 0) {
      return NextResponse.json(
        { ok: false, error: "No tickets selected." },
        { status: 400 }
      );
    }

    if (selectedTickets.length === 0) {
      return NextResponse.json(
        { ok: false, error: "Ticket selection is required." },
        { status: 400 }
      );
    }

    if (hasDuplicateTickets(selectedTickets)) {
      return NextResponse.json(
        { ok: false, error: "Duplicate tickets selected." },
        { status: 400 }
      );
    }

    if (quantity > 0 && selectedTickets.length !== quantity) {
      return NextResponse.json(
        { ok: false, error: "Selected ticket count does not match quantity." },
        { status: 400 }
      );
    }

    const requestedQuantity = selectedTickets.length;

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

    const valuesSql = selectedTickets
      .map((_, index) => {
        const base = index * 2;
        return `($${base + 2}, $${base + 3})`;
      })
      .join(", ");

    const taken = await query<TakenRow>(
      `
      with requested(ticket_number, colour) as (
        values ${valuesSql}
      ),
      typed as (
        select
          ticket_number::int as ticket_number,
          colour::text as colour
        from requested
      )
      select taken.ticket_number, taken.colour
      from (
        select rtr.ticket_number, rtr.colour
        from raffle_ticket_reservations rtr
        where rtr.raffle_id = $1
          and rtr.status = 'reserved'
          and rtr.expires_at > now()

        union all

        select rts.ticket_number, rts.colour
        from raffle_ticket_sales rts
        where rts.raffle_id = $1
      ) taken
      inner join typed req
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

    if (taken.length > 0) {
      return NextResponse.json(
        {
          ok: false,
          error: "One or more selected tickets are no longer available.",
          unavailable: taken,
        },
        { status: 409 }
      );
    }

    const reservationToken = crypto.randomUUID();
    const reservationGroupId = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
    const unitPriceCents = Math.round(Number(raffle.ticket_price) * 100);

    for (const ticket of selectedTickets) {
      await query(
        `
        insert into raffle_ticket_reservations (
          id,
          raffle_id,
          reservation_group_id,
          reservation_token,
          ticket_number,
          colour,
          buyer_email,
          buyer_name,
          unit_price_cents,
          status,
          created_at,
          expires_at
        )
        values (
          $1,
          $2,
          $3,
          $4,
          $5,
          $6,
          $7,
          $8,
          $9,
          'reserved',
          now(),
          $10::timestamptz
        )
        `,
        [
          crypto.randomUUID(),
          raffle.id,
          reservationGroupId,
          reservationToken,
          ticket.ticket_number,
          ticket.colour ?? "default",
          buyerEmail,
          buyerName,
          unitPriceCents,
          expiresAt,
        ]
      );
    }

    return NextResponse.json({
      ok: true,
      reservationToken,
      reservationGroupId,
      expiresAt,
      quantity: requestedQuantity,
      selectedTickets,
    });
  } catch (error: any) {
    console.error("raffle reserve error", error);

    return NextResponse.json(
      {
        ok: false,
        error: error?.message || "Internal server error.",
        detail: error?.detail || null,
        code: error?.code || null,
        constraint: error?.constraint || null,
      },
      { status: 500 }
    );
  }
}
