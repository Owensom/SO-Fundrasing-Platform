import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { query } from "@/lib/db";
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
        { ok: false, error: "Missing buyer details." },
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
          status,
          expires_at,
          buyer_name,
          buyer_email,
          unit_price_cents,
          created_at
        )
        values (
          gen_random_uuid(),
          $1,
          $2,
          $3,
          $4,
          $5,
          'reserved',
          $6,
          $7,
          $8,
          $9,
          now()
        )
        `,
        [
          raffle.id,
          reservationGroupId,
          reservationToken,
          ticket.ticket_number,
          ticket.colour,
          expiresAt,
          buyerName,
          buyerEmail,
          Math.round(Number(raffle.ticket_price ?? 0) * 100),
        ]
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
      {
        ok: false,
        error: error?.message || "Internal server error.",
      },
      { status: 500 }
    );
  }
}
