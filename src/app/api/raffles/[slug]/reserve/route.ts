import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { getRaffleBySlug } from "@/lib/raffles";
import { getTenantSlugFromHeaders } from "@/lib/tenant";
import { query } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const { slug } = await params;
    const body = await request.json();

    const tenantSlug =
      getTenantSlugFromHeaders() ||
      String(body.tenantSlug ?? body.tenant_slug ?? "").trim();

    if (!tenantSlug) {
      return NextResponse.json(
        { ok: false, error: "Tenant not found" },
        { status: 400 },
      );
    }

    const raffle = await getRaffleBySlug(tenantSlug, slug);

    if (!raffle) {
      return NextResponse.json(
        { ok: false, error: "Raffle not found" },
        { status: 404 },
      );
    }

    if (raffle.status !== "published") {
      return NextResponse.json(
        { ok: false, error: "Raffle is closed" },
        { status: 400 },
      );
    }

    const buyerName = String(body.buyerName ?? body.buyer_name ?? "").trim();
    const buyerEmail = String(body.buyerEmail ?? body.buyer_email ?? "").trim();

    const selectedTickets = Array.isArray(body.selectedTickets)
      ? body.selectedTickets
      : Array.isArray(body.tickets)
        ? body.tickets
        : Array.isArray(body.ticketNumbers)
          ? body.ticketNumbers.map((ticketNumber: unknown) => ({
              ticket_number: ticketNumber,
              colour: "",
            }))
          : [];

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
        { ok: false, error: "No tickets selected" },
        { status: 400 },
      );
    }

    const reservationToken = crypto.randomUUID();
    const reservationGroupId = reservationToken;
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    for (const ticket of selectedTickets) {
      const ticketNumber = Number(ticket.ticket_number ?? ticket.number);
      const colour = String(ticket.colour ?? "").trim();

      if (!Number.isFinite(ticketNumber) || ticketNumber <= 0) continue;

      await query(
        `
        insert into raffle_ticket_reservations (
          raffle_id,
          ticket_number,
          colour,
          buyer_name,
          buyer_email,
          status,
          reservation_token,
          reservation_group_id,
          expires_at,
          created_at
        )
        values ($1, $2, $3, $4, $5, 'reserved', $6, $7, $8, now())
        `,
        [
          raffle.id,
          ticketNumber,
          colour,
          buyerName,
          buyerEmail,
          reservationToken,
          reservationGroupId,
          expiresAt,
        ],
      );
    }

    return NextResponse.json({
      ok: true,
      reservationToken,
      reservation_token: reservationToken,
      expiresAt: expiresAt.toISOString(),
      expires_at: expiresAt.toISOString(),
    });
  } catch (error: any) {
    console.error("reserve error", error);

    return NextResponse.json(
      { ok: false, error: error?.message || "Reservation failed" },
      { status: 500 },
    );
  }
}
