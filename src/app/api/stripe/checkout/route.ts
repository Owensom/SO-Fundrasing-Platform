import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { query, queryOne } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2023-10-16",
});

type ReservationRow = {
  raffle_id: string;
  reservation_token: string;
  buyer_email: string | null;
  buyer_name: string | null;
  ticket_count: string | number;
};

type RaffleRow = {
  id: string;
  tenant_slug: string;
  slug: string;
  title: string;
  currency: string | null;
  ticket_price_cents: number | null;
};

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const reservationToken = String(
      body.reservationToken ?? body.reservation_token ?? "",
    ).trim();

    const raffleId = String(body.raffleId ?? body.raffle_id ?? "").trim();
    const coverFees = Boolean(body.coverFees ?? body.cover_fees ?? false);

    if (!reservationToken) {
      return NextResponse.json(
        { ok: false, error: "Reservation token is required" },
        { status: 400 },
      );
    }

    const reservation = await queryOne<ReservationRow>(
      `
      select
        raffle_id,
        reservation_token,
        max(buyer_email) as buyer_email,
        max(buyer_name) as buyer_name,
        count(*) as ticket_count
      from raffle_ticket_reservations
      where reservation_token = $1
        and status = 'reserved'
        and expires_at > now()
      group by raffle_id, reservation_token
      `,
      [reservationToken],
    );

    if (!reservation) {
      return NextResponse.json(
        { ok: false, error: "Reservation not found or expired" },
        { status: 404 },
      );
    }

    if (raffleId && reservation.raffle_id !== raffleId) {
      return NextResponse.json(
        { ok: false, error: "Reservation does not match raffle" },
        { status: 400 },
      );
    }

    const raffle = await queryOne<RaffleRow>(
      `
      select
        id,
        tenant_slug,
        slug,
        title,
        currency,
        ticket_price_cents
      from raffles
      where id = $1
      limit 1
      `,
      [reservation.raffle_id],
    );

    if (!raffle) {
      return NextResponse.json(
        { ok: false, error: "Raffle not found" },
        { status: 404 },
      );
    }

    const quantity = Number(reservation.ticket_count || 0);
    const singlePriceCents = Number(raffle.ticket_price_cents || 0);

    if (!Number.isFinite(quantity) || quantity <= 0) {
      return NextResponse.json(
        { ok: false, error: "No reserved tickets found" },
        { status: 400 },
      );
    }

    if (!Number.isFinite(singlePriceCents) || singlePriceCents <= 0) {
      return NextResponse.json(
        { ok: false, error: "Invalid ticket price" },
        { status: 400 },
      );
    }

    const ticketAmountCents = singlePriceCents * quantity;
    const feeAmountCents = coverFees ? Math.round(ticketAmountCents * 0.1) : 0;
    const totalAmountCents = ticketAmountCents + feeAmountCents;

    const origin = req.nextUrl.origin;

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "payment",
      customer_email: reservation.buyer_email || undefined,
      line_items: [
        {
          price_data: {
            currency: String(raffle.currency || "GBP").toLowerCase(),
            product_data: {
              name: raffle.title,
              description: `${quantity} raffle ticket${quantity === 1 ? "" : "s"}`,
            },
            unit_amount: totalAmountCents,
          },
          quantity: 1,
        },
      ],
      success_url: `${origin}/api/stripe/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/r/${raffle.slug}`,
      metadata: {
        raffle_id: raffle.id,
        tenant_slug: raffle.tenant_slug,
        reservation_token: reservationToken,
        quantity: String(quantity),
        cover_fees: String(coverFees),
      },
    });

    return NextResponse.json({
      ok: true,
      url: session.url,
      checkoutUrl: session.url,
      sessionId: session.id,
    });
  } catch (err: any) {
    console.error("Stripe checkout error:", err);

    return NextResponse.json(
      { ok: false, error: err?.message || "Checkout failed" },
      { status: 500 },
    );
  }
}
