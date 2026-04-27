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

    const tenantSlug = String(session.metadata?.tenant_slug ?? "").trim();

    // ✅ redirect back to tenant campaign page
    if (tenantSlug) {
      return NextResponse.redirect(
        new URL(`/c/${tenantSlug}`, request.url),
        { status: 303 }
      );
    }

    return NextResponse.redirect(new URL("/", request.url), { status: 303 });
  } catch (err) {
    console.error("Stripe success error:", err);

    return NextResponse.redirect(new URL("/", request.url), { status: 303 });
  }
}
