import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2023-10-16",
});

export async function GET(request: NextRequest) {
  try {
    const sessionId = request.nextUrl.searchParams.get("session_id");

    if (!sessionId) {
      return NextResponse.redirect(new URL("/", request.url), { status: 303 });
    }

    const session = await stripe.checkout.sessions.retrieve(sessionId);

    const tenantSlug = String(
      session.metadata?.tenant_slug ?? session.metadata?.tenantSlug ?? "",
    ).trim();

    const raffleSlug = String(
      session.metadata?.raffle_slug ?? session.metadata?.raffleSlug ?? "",
    ).trim();

    const squaresSlug = String(
      session.metadata?.squares_slug ??
        session.metadata?.squaresSlug ??
        session.metadata?.game_slug ??
        session.metadata?.gameSlug ??
        "",
    ).trim();

    const eventSlug = String(
      session.metadata?.event_slug ?? session.metadata?.eventSlug ?? "",
    ).trim();

    if (raffleSlug) {
      return NextResponse.redirect(
        new URL(`/r/${raffleSlug}?payment=success`, request.url),
        { status: 303 },
      );
    }

    if (squaresSlug) {
      return NextResponse.redirect(
        new URL(`/s/${squaresSlug}?payment=success`, request.url),
        { status: 303 },
      );
    }

    if (eventSlug) {
      return NextResponse.redirect(
        new URL(`/e/${eventSlug}?payment=success`, request.url),
        { status: 303 },
      );
    }

    if (tenantSlug) {
      return NextResponse.redirect(
        new URL(`/c/${tenantSlug}?payment=success`, request.url),
        { status: 303 },
      );
    }

    return NextResponse.redirect(new URL("/", request.url), { status: 303 });
  } catch (err) {
    console.error("Stripe success error:", err);

    return NextResponse.redirect(new URL("/", request.url), { status: 303 });
  }
}
