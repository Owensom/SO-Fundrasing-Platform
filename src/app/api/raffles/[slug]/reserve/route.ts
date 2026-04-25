import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { getRaffleBySlug } from "@/lib/raffles";
import { getTenantSlugFromHeaders } from "@/lib/tenant";
import { query } from "@/lib/db";

export async function POST(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const body = await request.json();

    const tenantSlug = await getTenantSlugFromHeaders();

    if (!tenantSlug) {
      return NextResponse.json(
        { ok: false, error: "Tenant not found" },
        { status: 400 }
      );
    }

    const raffle = await getRaffleBySlug(params.slug, tenantSlug);

    if (!raffle) {
      return NextResponse.json(
        { ok: false, error: "Raffle not found" },
        { status: 404 }
      );
    }

    // 🔒 LOCK PURCHASES
    if (raffle.status !== "published") {
      return NextResponse.json(
        { ok: false, error: "Raffle is closed" },
        { status: 400 }
      );
    }

    const ticketNumbers: number[] = body.ticketNumbers || [];

    if (!ticketNumbers.length) {
      return NextResponse.json(
        { ok: false, error: "No tickets selected" },
        { status: 400 }
      );
    }

    const reservationToken = crypto.randomUUID();

    for (const ticketNumber of ticketNumbers) {
      await query(
        `
        insert into raffle_ticket_reservations (
          raffle_id,
          ticket_number,
          status,
          reservation_token,
          created_at
        )
        values ($1, $2, 'reserved', $3, now())
        `,
        [raffle.id, ticketNumber, reservationToken]
      );
    }

    return NextResponse.json({
      ok: true,
      reservationToken,
    });
  } catch (error: any) {
    console.error(error);

    return NextResponse.json(
      { ok: false, error: "Reservation failed" },
      { status: 500 }
    );
  }
}
