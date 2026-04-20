import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

function getStripe() {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error("STRIPE_SECRET_KEY is required");
  }
  return new Stripe(process.env.STRIPE_SECRET_KEY);
}

export async function GET(req: NextRequest) {
  try {
    const sessionId = req.nextUrl.searchParams.get("session_id");

    if (!sessionId) {
      return NextResponse.json(
        { ok: false, error: "Missing session_id" },
        { status: 400 }
      );
    }

    const stripe = getStripe();

    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ["payment_intent"],
    });

    return NextResponse.json({
      ok: true,
      amount: session.amount_total
        ? session.amount_total / 100
        : 0,
      currency: session.currency,
      status: session.payment_status,
      email: session.customer_details?.email,
      name: session.customer_details?.name,
      reservation_token: session.metadata?.reservation_token,
    });
  } catch (err) {
    console.error("session api error", err);

    return NextResponse.json(
      { ok: false, error: "Failed to fetch session" },
      { status: 500 }
    );
  }
}
