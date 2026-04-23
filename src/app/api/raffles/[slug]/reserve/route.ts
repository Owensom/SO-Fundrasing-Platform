import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { query } from "@/lib/db";
import { getRaffleBySlug } from "@/lib/raffles";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const body = await request.json();

    const tenantSlug = String(body.tenantSlug || "").trim();
    const buyerName = String(body.buyerName || "").trim();
    const buyerEmail = String(body.buyerEmail || "").trim();
    const selectedTickets = Array.isArray(body.selectedTickets)
      ? body.selectedTickets
      : [];

    console.log("RESERVE INPUT", {
      tenantSlug,
      slug: params.slug,
      buyerName,
      buyerEmail,
      selectedTickets,
    });

    if (!tenantSlug || !params.slug) {
      return NextResponse.json(
        { ok: false, error: "Missing tenant or slug" },
        { status: 400 }
      );
    }

    if (!selectedTickets.length) {
      return NextResponse.json(
        { ok: false, error: "No tickets selected" },
        { status: 400 }
      );
    }

    const raffle = await getRaffleBySlug(tenantSlug, params.slug);

    if (!raffle) {
      return NextResponse.json(
        { ok: false, error: "Raffle not found" },
        { status: 404 }
      );
    }

    const reservationToken = crypto.randomUUID();
    const reservationGroupId = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    let inserted = 0;

    for (const t of selectedTickets) {
      const ticketNumber = Number(t.ticket_number);
      const colour = t.colour || null;

      if (!Number.isInteger(ticketNumber)) continue;

      try {
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
            ticketNumber,
            colour,
            buyerName,
            buyerEmail,
            expiresAt,
          ]
        );

        inserted++;
      } catch (err) {
        console.error("INSERT FAILED", err);
      }
    }

    console.log("RESERVE RESULT", { inserted });

    if (inserted === 0) {
      return NextResponse.json(
        { ok: false, error: "Failed to reserve tickets" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      reservationToken,
      raffleId: raffle.id,
      expiresAt,
    });
  } catch (err) {
    console.error("RESERVE ERROR", err);

    return NextResponse.json(
      { ok: false, error: "Server error" },
      { status: 500 }
    );
  }
}
