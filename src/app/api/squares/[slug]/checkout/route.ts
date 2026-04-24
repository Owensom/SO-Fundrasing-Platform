import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import {
  getSquaresGameByTenantAndSlug,
  getSquaresReservationByToken,
  markSquaresReservationCheckoutSession,
} from "../../../../../../api/_lib/squares-repo";
import { getTenantSlugFromRequest } from "@/lib/tenant";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2023-10-16",
});

function calculatePlatformFee(subtotalCents: number) {
  const platformFeePercent = Number(process.env.PLATFORM_FEE_PERCENT ?? 10);

  if (!Number.isFinite(platformFeePercent) || platformFeePercent < 0) {
    return Math.round(subtotalCents * 0.1);
  }

  return Math.round(subtotalCents * (platformFeePercent / 100));
}

export async function POST(
  request: NextRequest,
  { params }: { params: { slug: string } },
) {
  const tenantSlug = getTenantSlugFromRequest(request);

  if (!tenantSlug) {
    return NextResponse.json(
      { ok: false, error: "Tenant not found" },
      { status: 404 },
    );
  }

  try {
    const body = await request.json();

    const reservationToken =
      typeof body.reservationToken === "string"
        ? body.reservationToken.trim()
        : "";

    const donorCoveredFees = body.coverFees === true;

    if (!reservationToken) {
      return NextResponse.json(
        { ok: false, error: "Missing reservation token." },
        { status: 400 },
      );
    }

    const game = await getSquaresGameByTenantAndSlug(tenantSlug, params.slug);

    if (!game || game.status !== "published") {
      return NextResponse.json(
        { ok: false, error: "Squares game is not available." },
        { status: 400 },
      );
    }

    const reservation = await getSquaresReservationByToken(reservationToken);

    if (
      !reservation ||
      reservation.tenant_slug !== tenantSlug ||
      reservation.game_id !== game.id ||
      reservation.payment_status !== "reserved"
    ) {
      return NextResponse.json(
        { ok: false, error: "Reservation not found." },
        { status: 404 },
      );
    }

    if (new Date(reservation.expires_at).getTime() <= Date.now()) {
      return NextResponse.json(
        { ok: false, error: "Reservation expired." },
        { status: 400 },
      );
    }

    const quantity = reservation.squares.length;

    if (quantity <= 0) {
      return NextResponse.json(
        { ok: false, error: "No squares reserved." },
        { status: 400 },
      );
    }

    const squareSubtotalCents = quantity * game.price_per_square_cents;

    const platformFeeCents = calculatePlatformFee(squareSubtotalCents);
    const donorFeeCents = donorCoveredFees ? platformFeeCents : 0;
    const grossAmountCents = squareSubtotalCents + donorFeeCents;

    const netAmountCents = donorCoveredFees
      ? squareSubtotalCents
      : Math.max(squareSubtotalCents - platformFeeCents, 0);

    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;

    const successUrl =
      typeof body.successUrl === "string" && body.successUrl.trim()
        ? body.successUrl.trim()
        : `${baseUrl}/success`;

    const cancelUrl =
      typeof body.cancelUrl === "string" && body.cancelUrl.trim()
        ? body.cancelUrl.trim()
        : `${baseUrl}/s/${game.slug}`;

    const feeDescription = donorCoveredFees
      ? ` | Donor covered platform fee: ${(donorFeeCents / 100).toFixed(2)} ${
          game.currency
        }`
      : "";

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: String(game.currency ?? "GBP").toLowerCase(),
            product_data: {
              name: game.title,
              description: `${quantity} square${
                quantity > 1 ? "s" : ""
              }${feeDescription}`,
            },
            unit_amount: grossAmountCents,
          },
          quantity: 1,
        },
      ],
      customer_email: reservation.customer_email || undefined,
      metadata: {
        type: "squares",
        squares_game_id: game.id,
        game_id: game.id,
        reservation_token: reservationToken,
        tenant_slug: tenantSlug,

        square_quantity: String(quantity),
        price_per_square_cents: String(game.price_per_square_cents),

        square_subtotal_cents: String(squareSubtotalCents),
        subtotal_cents: String(squareSubtotalCents),
        gross_amount_cents: String(grossAmountCents),

        platform_fee_cents: String(platformFeeCents),
        donor_covered_fees: donorCoveredFees ? "true" : "false",
        donor_fee_cents: String(donorFeeCents),
        net_amount_cents: String(netAmountCents),

        squares_json: JSON.stringify(reservation.squares),
      },
      success_url: `${successUrl}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancelUrl,
    });

    if (session.id) {
      await markSquaresReservationCheckoutSession(reservationToken, session.id);
    }

    if (!session.url) {
      return NextResponse.json(
        { ok: false, error: "Stripe session created but no checkout URL." },
        { status: 500 },
      );
    }

    return NextResponse.json({
      ok: true,
      url: session.url,
      pricing: {
        quantity,
        square_subtotal_cents: squareSubtotalCents,
        gross_amount_cents: grossAmountCents,
        platform_fee_cents: platformFeeCents,
        donor_covered_fees: donorCoveredFees,
        donor_fee_cents: donorFeeCents,
        net_amount_cents: netAmountCents,
      },
    });
  } catch (error: any) {
    console.error("squares checkout error", error);

    return NextResponse.json(
      { ok: false, error: error?.message || "Internal server error." },
      { status: 500 },
    );
  }
}
