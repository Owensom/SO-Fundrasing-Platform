import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { getRaffleById } from "@/lib/raffles";
import { query, queryOne } from "@/lib/db";
import { getBestPriceForQuantity, normalizeOffers } from "@/lib/pricing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2023-10-16",
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const raffleId = body.raffleId;
    const reservationToken = body.reservationToken;

    if (!raffleId || !reservationToken) {
      return NextResponse.json(
        { ok: false, error: "Missing raffleId or reservationToken" },
        { status: 400 }
      );
    }

    const raffle = await getRaffleById(raffleId);

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

    const reservations = await query(
      `
      select *
      from raffle_ticket_reservations
      where raffle_id = $1
        and reservation_token = $2
        and expires_at > now()
      `,
      [raffleId, reservationToken]
    );

    if (!reservations.length) {
      return NextResponse.json(
        { ok: false, error: "Reservation expired" },
        { status: 400 }
      );
    }

    const reservationCount = await queryOne<{ count: number }>(
      `
      select count(*)::int as count
      from raffle_ticket_reservations
      where raffle_id = $1
        and reservation_token = $2
        and expires_at > now()
      `,
      [raffleId, reservationToken]
    );

    const quantity = reservationCount?.count || 0;

    if (quantity <= 0) {
      return NextResponse.json(
        { ok: false, error: "Invalid quantity" },
        { status: 400 }
      );
    }

    const singlePrice = Math.round(Number(raffle.ticket_price) * 100);

    const offers = normalizeOffers(
      (raffle.config_json as any)?.offers || []
    );

    const pricing = getBestPriceForQuantity({
      quantity,
      single_ticket_price_cents: singlePrice,
      offers,
    });

    const subtotal = pricing.subtotal_cents;
    const platformFee = Math.round(subtotal * 0.1);

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: raffle.currency.toLowerCase(),
            product_data: {
              name: raffle.title,
            },
            unit_amount: subtotal,
          },
        },
      ],
      success_url: `${request.nextUrl.origin}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${request.nextUrl.origin}/r/${raffle.slug}`,
      metadata: {
        raffle_id: raffleId,
        reservation_token: reservationToken,
        platform_fee_cents: String(platformFee),
      },
    });

    return NextResponse.json({
      ok: true,
      url: session.url,
    });
  } catch (err: any) {
    console.error("checkout error", err);

    return NextResponse.json(
      { ok: false, error: err.message },
      { status: 500 }
    );
  }
}
