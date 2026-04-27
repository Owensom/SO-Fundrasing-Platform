import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { getRaffleById } from "@/lib/raffles";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2023-10-16",
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const raffleId = String(body.raffleId || "").trim();
    const reservationToken = String(body.reservationToken || "").trim();
    const coverFees = Boolean(body.coverFees);

    if (!raffleId || !reservationToken) {
      return NextResponse.json(
        { ok: false, error: "Missing checkout data" },
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

    const ticketPriceCents = Number(raffle.ticket_price_cents || 0);

    if (!Number.isFinite(ticketPriceCents) || ticketPriceCents <= 0) {
      return NextResponse.json(
        { ok: false, error: "Invalid ticket price" },
        { status: 400 }
      );
    }

    // Quantity comes from reservation (safe assumption)
    // You can improve later by counting reserved tickets
    const quantity = Number(body.quantity || 1);

    const baseAmount = ticketPriceCents * quantity;

    const fee = coverFees ? Math.round(baseAmount * 0.1) : 0;
    const totalAmount = baseAmount + fee;

    const origin = req.nextUrl.origin;

    const successUrl = `${origin}/api/stripe/success?session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = `${origin}/r/${raffle.slug}`;

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "payment",

      line_items: [
        {
          price_data: {
            currency: raffle.currency.toLowerCase(),
            product_data: {
              name: raffle.title,
            },
            unit_amount: totalAmount,
          },
          quantity: 1,
        },
      ],

      success_url: successUrl,
      cancel_url: cancelUrl,

      metadata: {
        raffle_id: raffle.id,
        tenant_slug: raffle.tenant_slug,
        reservation_token: reservationToken,
        quantity: String(quantity),
      },
    });

    return NextResponse.json({
      ok: true,
      url: session.url,
    });
  } catch (err: any) {
    console.error("Stripe checkout error:", err);

    return NextResponse.json(
      { ok: false, error: err.message || "Checkout failed" },
      { status: 500 }
    );
  }
}
