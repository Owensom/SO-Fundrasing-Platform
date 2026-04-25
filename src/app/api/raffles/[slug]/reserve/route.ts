import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { getRaffleBySlug } from "@/lib/raffles";
import { query } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2023-10-16",
});

export async function POST(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const body = await request.json();

    const raffle = await getRaffleBySlug(params.slug);

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

    const reservationToken = body.reservationToken;

    if (!reservationToken) {
      return NextResponse.json(
        { ok: false, error: "Missing reservation token" },
        { status: 400 }
      );
    }

    const reservations = await query<{
      ticket_number: number;
    }>(
      `
      select ticket_number
      from raffle_ticket_reservations
      where raffle_id = $1
        and reservation_token = $2
        and status = 'reserved'
      `,
      [raffle.id, reservationToken]
    );

    if (!reservations.length) {
      return NextResponse.json(
        { ok: false, error: "No reserved tickets found" },
        { status: 400 }
      );
    }

    const ticketCount = reservations.length;

    const unitAmount = Math.round(raffle.ticket_price * 100);
    const grossAmount = unitAmount * ticketCount;

    const platformFee = Math.round(grossAmount * 0.1); // 10% example
    const netAmount = grossAmount - platformFee;

    const successUrl =
      body.successUrl ||
      `${request.nextUrl.origin}/r/${raffle.slug}?success=1`;

    const cancelUrl =
      body.cancelUrl || `${request.nextUrl.origin}/r/${raffle.slug}`;

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [
        {
          quantity: ticketCount,
          price_data: {
            currency: raffle.currency.toLowerCase(),
            product_data: {
              name: raffle.title,
            },
            unit_amount: unitAmount,
          },
        },
      ],
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        raffle_id: raffle.id,
        reservation_token: reservationToken,
        tenant_slug: raffle.tenant_slug,
        platform_fee_cents: String(platformFee),
        net_amount_cents: String(netAmount),
      },
    });

    return NextResponse.json({
      ok: true,
      url: session.url,
    });
  } catch (error: any) {
    console.error("Checkout error:", error);

    return NextResponse.json(
      { ok: false, error: error?.message || "Checkout failed" },
      { status: 500 }
    );
  }
}
