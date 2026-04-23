import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { getRaffleById } from "@/lib/raffles";
import { query } from "@/lib/db";
import { getBestPriceForQuantity, normalizeOffers } from "@/lib/pricing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2023-10-16",
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const reservationToken = String(body.reservationToken || "").trim();
    const raffleId = String(body.raffleId || "").trim();

    if (!reservationToken || !raffleId) {
      return NextResponse.json(
        { ok: false, error: "Missing reservationToken or raffleId" },
        { status: 400 }
      );
    }

    // ✅ STRICT MATCH (this fixes your bug)
    const reservations = await query(
      `
      select *
      from raffle_ticket_reservations
      where reservation_token = $1
        and raffle_id = $2
      `,
      [reservationToken, raffleId]
    );

    if (!reservations.length) {
      return NextResponse.json(
        {
          ok: false,
          error: "Reservation not found.",
          debug: {
            reservationToken,
            raffleId,
          },
        },
        { status: 404 }
      );
    }

    const validReservations = reservations.filter(
      (r: any) => new Date(r.expires_at).getTime() > Date.now()
    );

    if (!validReservations.length) {
      return NextResponse.json(
        { ok: false, error: "Reservation expired." },
        { status: 400 }
      );
    }

    const raffle = await getRaffleById(raffleId);

    if (!raffle || raffle.status !== "published") {
      return NextResponse.json(
        { ok: false, error: "Raffle not available." },
        { status: 400 }
      );
    }

    const quantity = validReservations.length;

    const singlePriceCents = Math.round(
      Number(raffle.ticket_price || 0) * 100
    );

    const offers = normalizeOffers(raffle.config_json?.offers || []);

    const pricing = getBestPriceForQuantity({
      quantity,
      single_ticket_price_cents: singlePriceCents,
      offers,
    });

    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin;

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: raffle.currency.toLowerCase(),
            product_data: {
              name: raffle.title,
              description: `${quantity} tickets`,
            },
            unit_amount: pricing.subtotal_cents,
          },
          quantity: 1,
        },
      ],
      metadata: {
        raffle_id: raffleId,
        reservation_token: reservationToken,
      },
      success_url: `${baseUrl}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/r/${raffle.slug}`,
    });

    const checkoutUrl =
      session.url ||
      `https://checkout.stripe.com/c/pay/${session.id}`;

    return NextResponse.json({
      ok: true,
      url: checkoutUrl,
    });
  } catch (err: any) {
    console.error(err);

    return NextResponse.json(
      { ok: false, error: err.message },
      { status: 500 }
    );
  }
}
