import { NextRequest, NextResponse } from "next/server";
import { getRaffleBySlug } from "@/lib/raffles";
import { query } from "@/lib/db";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2022-11-15" });

export const runtime = "edge";

export async function POST(req: NextRequest) {
  const params = await req.json();
  const tenantSlug = params.tenantSlug;

  // Fetch the raffle (multi-tenant)
  const raffle = await getRaffleBySlug(tenantSlug, params.slug);

  if (!raffle) {
    return NextResponse.json({ ok: false, error: "Raffle not found" }, { status: 404 });
  }

  // ✅ SAFEST FIX: Use existing ticket_price_cents property
  const singlePriceCents = raffle.ticket_price_cents;

  if (!Number.isFinite(singlePriceCents) || singlePriceCents <= 0) {
    return NextResponse.json({ ok: false, error: "Invalid ticket price" }, { status: 400 });
  }

  // Calculate total price
  const quantity = Number(params.quantity) || 1;
  const totalAmountCents = singlePriceCents * quantity;

  // Create Stripe checkout session
  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: raffle.currency.toLowerCase(),
            product_data: { name: raffle.title },
            unit_amount: totalAmountCents,
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: `${params.successUrl}`,
      cancel_url: `${params.cancelUrl}`,
      metadata: {
        raffle_id: raffle.id,
        tenant_slug: tenantSlug,
        quantity: String(quantity),
      },
    });

    return NextResponse.json({ ok: true, sessionId: session.id });
  } catch (err: any) {
    console.error("Stripe checkout error:", err);
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
