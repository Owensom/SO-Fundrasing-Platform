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
  selectedTickets?: Array<{
    number?: number;
    ticket_number?: number;
    colour?: string | null;
  }>;
};

type CountRow = {
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

    if (!tenantSlug || !params.slug) {
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

    const selectedTickets = normalizeSelectedTickets(body.selectedTickets);

    if (!selectedTickets.length) {
      return NextResponse.json(
        { ok: false, error: "No tickets selected." },
        { status: 400 }
      );
    }

    const raffle = await getRaffleBySlug(tenantSlug, params.slug);

    if (!raffle || raffle.status !== "published") {
      return NextResponse.json(
        { ok: false, error: "This raffle is not open for reservations." },
        { status: 400 }
      );
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
          expiresAt.toISOString(),
        ]
      );
    }

    const verify = await queryOne<CountRow>(
      `
      select count(*)::int as count
      from raffle_ticket_reservations
      where raffle_id = $1
        and reservation_token = $2
      `,
      [raffle.id, reservationToken]
    );

    const insertedCount = Number(verify?.count ?? 0);

    if (insertedCount !== selectedTickets.length) {
      return NextResponse.json(
        {
          ok: false,
          error: `RESERVE VERIFY FAILED | raffleId=${raffle.id} | token=${reservationToken} | expected=${selectedTickets.length} | actual=${insertedCount}`,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      reservationToken,
      raffleId: raffle.id,
      expiresAt: expiresAt.toISOString(),
      debug: `RESERVE VERIFIED | raffleId=${raffle.id} | token=${reservationToken} | count=${insertedCount}`,
    });
  } catch (error: any) {
    console.error("raffle reserve error", error);

    return NextResponse.json(
      { ok: false, error: error?.message || "Internal server error." },
      { status: 500 }
    );
  }
}
