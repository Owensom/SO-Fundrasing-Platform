import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { query, queryOne } from "@/lib/db";
import { getRaffleBySlug } from "../../../../../../api/_lib/raffles-repo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ReserveBody = {
  tenantSlug?: string;
  buyerName?: string;
  buyerEmail?: string;
  quantity?: number;
  selectedTickets?: Array<{
    number?: number;
    ticket_number?: number;
    colour?: string | null;
  }>;
};

type ReservedOrSoldRow = {
  ticket_number: number;
  colour: string | null;
};

type InsertedCountRow = {
  count: string | number;
};

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function normalizeSelectedTickets(
  value: unknown
): Array<{ ticket_number: number; colour: string | null }> {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => {
      if (!item || typeof item !== "object") return null;

      const row = item as Record<string, unknown>;

      const ticketNumber = Number(row.ticket_number ?? row.number ?? null);

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
    const buyerName =
      typeof body.buyerName === "string" ? body.buyerName.trim() : "";
    const buyerEmail =
      typeof body.buyerEmail === "string" ? body.buyerEmail.trim() : "";
    const slug = params.slug;

    if (!tenantSlug || !slug) {
      return NextResponse.json(
        { ok: false, error: "Missing tenant or raffle slug." },
        { status: 400 }
      );
    }

    if (!buyerName || !buyerEmail) {
      return NextResponse.json(
        { ok: false, error: "Name and email are required." },
        { status: 400 }
      );
    }

    if (!isValidEmail(buyerEmail)) {
      return NextResponse.json(
        { ok: false, error: "Enter a valid email address." },
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
      typeof body.quantity === "number"
        ? Math.max(0, Math.floor(body.quantity))
        : 0;

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

    if (
      selectedTickets.length > 0 &&
      quantity > 0 &&
      selectedTickets.length !== quantity
    ) {
      return NextResponse.json(
        { ok: false, error: "Selected ticket count does not match quantity." },
        { status: 400 }
      );
    }

    const requestedQuantity =
      selectedTickets.length > 0 ? selectedTickets.length : quantity;

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
          select ticket_number, colour
          from raffle_ticket_reservations
          where raffle_id = $1
            and status = 'reserved'
            and expires_at > now()

          union all

          select ticket_number, colour
          from raffle_ticket_sales
          where raffle_id = $1
        ) taken
        inner join requested req
          on req.ticket_number = taken.ticket_number
         and coalesce(req.colour, '') = coalesce(taken.colour, '')
        `,
        [
          raffle.id,
          ...selectedTickets.flatMap((t) => [t.ticket_number, t.colour]),
        ]
      );

      if (soldOrReserved.length > 0) {
        return NextResponse.json(
          {
            ok: false,
            error: "One or more selected tickets are no longer available.",
          },
          { status: 409 }
        );
      }
    }

    const reservationGroupId = crypto.randomUUID();
    const reservationToken = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

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
          buyer_name,
          buyer_email,
          status,
          expires_at,
          created_at
        )
        values (
          gen_random_uuid()::text,
          $1,
          $2,
          $3,
          $4,
          $5,
          $6,
          $7,
          'reserved',
          $8,
          now()
        )
        `,
        [
          raffle.id,
          reservationGroupId,
          reservationToken,
          ticket.ticket_number,
          ticket.colour,
          buyerName,
          buyerEmail,
          expiresAt,
        ]
      );
    }

    const insertedCount = await queryOne<InsertedCountRow>(
      `
      select count(*)::int as count
      from raffle_ticket_reservations
      where reservation_token = $1
        and raffle_id = $2
      `,
      [reservationToken, raffle.id]
    );

    const count = Number(insertedCount?.count ?? 0);

    if (!Number.isFinite(count) || count !== selectedTickets.length) {
      const latestReservations = await query(
        `
        select
          reservation_token,
          raffle_id,
          buyer_email,
          created_at
        from raffle_ticket_reservations
        order by created_at desc
        limit 3
        `
      );

      return NextResponse.json(
        {
          ok: false,
          error:
            `Reservation insert verification failed | expected=${selectedTickets.length} | actual=${count} | raffleId=${raffle.id} | token=${reservationToken}` +
            (latestReservations[0]
              ? ` | latest raffleId=${String((latestReservations[0] as any).raffle_id)} | latest token=${String((latestReservations[0] as any).reservation_token)}`
              : ""),
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      reservationToken,
      expiresAt: expiresAt.toISOString(),
      raffleId: raffle.id,
    });
  } catch (error: any) {
    console.error("raffle reserve error", error);

    return NextResponse.json(
      { ok: false, error: error?.message || "Internal server error." },
      { status: 500 }
    );
  }
}
