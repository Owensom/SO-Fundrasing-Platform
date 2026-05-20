import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import {
  getSquaresGameByTenantAndSlug,
  getSquaresReservationByToken,
  markSquaresReservationCheckoutSession,
} from "../../../../../../api/_lib/squares-repo";
import { getTenantSlugFromRequest } from "@/lib/tenant";
import {
  buildPaymentSummary,
  createStripeCheckoutSession,
  getPlatformFeePercent,
  getTenantFinanceSettings,
} from "@/lib/payments";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2023-10-16",
});

type SquaresCheckoutPaymentSummary = {
  squareSubtotalCents: number;
  amountTotalCents: number;
  buyerContributionCents: number;
  platformCommissionCents: number;
  stripeProcessingCoverCents: number;
  applicationFeeCents: number;
  tenantNetCents: number;
};

function cleanText(value: unknown) {
  return String(value || "").trim();
}

function truthy(value: unknown) {
  return value === true || value === "true" || value === "yes" || value === "1";
}

function safeMoneyCents(value: unknown) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return 0;
  }

  return Math.max(0, Math.round(number));
}

function normaliseSquaresPaymentSummary(input: {
  squareSubtotalCents: number;
  coverFees: boolean;
  platformFeePercent: number;
}): SquaresCheckoutPaymentSummary {
  const paymentSummary = buildPaymentSummary({
    ticketTotalCents: input.squareSubtotalCents,
    coverFees: input.coverFees,
    platformFeePercent: input.platformFeePercent,
  });

  const squareSubtotalCents = safeMoneyCents(paymentSummary.ticketTotalCents);
  const amountTotalCents = safeMoneyCents(paymentSummary.amountTotalCents);

  const buyerContributionCents = safeMoneyCents(
    paymentSummary.buyerContributionCents,
  );

  const platformCommissionCents = safeMoneyCents(
    paymentSummary.platformCommissionCents,
  );

  const stripeProcessingCoverCents = Math.max(
    buyerContributionCents - platformCommissionCents,
    0,
  );

  const applicationFeeCents =
    input.coverFees && buyerContributionCents > 0
      ? buyerContributionCents
      : platformCommissionCents;

  const tenantNetCents = Math.max(amountTotalCents - applicationFeeCents, 0);

  return {
    squareSubtotalCents,
    amountTotalCents,
    buyerContributionCents,
    platformCommissionCents,
    stripeProcessingCoverCents,
    applicationFeeCents,
    tenantNetCents,
  };
}

function squaresCheckoutMetadata(input: {
  tenantSlug: string;
  game: {
    id: string;
    slug: string;
    title: string;
    currency: string;
    price_per_square_cents: number;
  };
  reservationToken: string;
  quantity: number;
  squares: number[];
  coverFees: boolean;
  platformFeePercent: number;
  paymentSummary: SquaresCheckoutPaymentSummary;
}) {
  return {
    type: "squares",
    tenant_slug: input.tenantSlug,

    squares_game_id: input.game.id,
    game_id: input.game.id,
    gameId: input.game.id,
    game_slug: input.game.slug,
    game_title: input.game.title,

    reservation_token: input.reservationToken,
    reservationToken: input.reservationToken,

    square_quantity: String(input.quantity),
    price_per_square_cents: String(input.game.price_per_square_cents),

    cover_fees: input.coverFees ? "true" : "false",
    buyer_requested_cover_fees: input.coverFees ? "true" : "false",
    buyer_fee_contributions_enabled:
      input.paymentSummary.buyerContributionCents > 0 ? "true" : "false",
    donor_covered_fees:
      input.paymentSummary.buyerContributionCents > 0 ? "true" : "false",

    buyer_contribution_cents: String(
      input.paymentSummary.buyerContributionCents,
    ),
    supporter_contribution_cents: String(
      input.paymentSummary.buyerContributionCents,
    ),
    donor_fee_cents: String(input.paymentSummary.buyerContributionCents),
    buyer_fee_cents: String(input.paymentSummary.buyerContributionCents),

    platform_fee_percent: String(input.platformFeePercent),
    tier_platform_commission_cents: String(
      input.paymentSummary.platformCommissionCents,
    ),
    platform_commission_cents: String(
      input.paymentSummary.platformCommissionCents,
    ),
    platform_fee_cents: String(input.paymentSummary.platformCommissionCents),

    stripe_processing_cover_cents: String(
      input.paymentSummary.stripeProcessingCoverCents,
    ),

    application_fee_amount: String(input.paymentSummary.applicationFeeCents),
    application_fee_amount_cents: String(
      input.paymentSummary.applicationFeeCents,
    ),
    application_fee_includes_supporter_cover:
      input.paymentSummary.buyerContributionCents > 0 ? "true" : "false",

    square_subtotal_cents: String(input.paymentSummary.squareSubtotalCents),
    subtotal_cents: String(input.paymentSummary.squareSubtotalCents),
    ticket_subtotal_cents: String(input.paymentSummary.squareSubtotalCents),
    base_amount_cents: String(input.paymentSummary.squareSubtotalCents),
    tenant_target_amount_cents: String(input.paymentSummary.squareSubtotalCents),

    gross_amount_cents: String(input.paymentSummary.amountTotalCents),
    amount_total_cents: String(input.paymentSummary.amountTotalCents),
    checkout_total_cents: String(input.paymentSummary.amountTotalCents),

    net_amount_cents: String(input.paymentSummary.tenantNetCents),
    tenant_net_after_application_fee_cents: String(
      input.paymentSummary.tenantNetCents,
    ),

    squares_json: JSON.stringify(input.squares),
  };
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

    const reservationToken = cleanText(body.reservationToken);
    const donorCoveredFees = truthy(body.coverFees);

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

    if (squareSubtotalCents <= 0) {
      return NextResponse.json(
        { ok: false, error: "Invalid checkout total." },
        { status: 400 },
      );
    }

    const finance = await getTenantFinanceSettings(tenantSlug);
    const platformFeePercent = getPlatformFeePercent(finance);

    const paymentSummary = normaliseSquaresPaymentSummary({
      squareSubtotalCents,
      coverFees: donorCoveredFees,
      platformFeePercent,
    });

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

    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [
      {
        quantity: 1,
        price_data: {
          currency: String(game.currency ?? "GBP").toLowerCase(),
          unit_amount: squareSubtotalCents,
          product_data: {
            name: game.title,
            description: `${quantity} square${quantity > 1 ? "s" : ""}`,
          },
        },
      },
    ];

    if (paymentSummary.buyerContributionCents > 0) {
      lineItems.push({
        quantity: 1,
        price_data: {
          currency: String(game.currency ?? "GBP").toLowerCase(),
          unit_amount: paymentSummary.buyerContributionCents,
          product_data: {
            name: `${game.title} — Cover processing costs`,
            description:
              "Optional contribution to help cover platform and payment processing costs.",
          },
        },
      });
    }

    const session = await createStripeCheckoutSession({
      stripe,
      buyerEmail: reservation.customer_email || "",
      successUrl: `${successUrl}?session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl,
      lineItems,
      finance,
      applicationFeeCents: paymentSummary.applicationFeeCents,
      metadata: squaresCheckoutMetadata({
        tenantSlug,
        game,
        reservationToken,
        quantity,
        squares: reservation.squares,
        coverFees: donorCoveredFees,
        platformFeePercent,
        paymentSummary,
      }),
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
        square_subtotal_cents: paymentSummary.squareSubtotalCents,
        gross_amount_cents: paymentSummary.amountTotalCents,
        platform_fee_cents: paymentSummary.platformCommissionCents,
        donor_covered_fees: paymentSummary.buyerContributionCents > 0,
        donor_fee_cents: paymentSummary.buyerContributionCents,
        stripe_processing_cover_cents:
          paymentSummary.stripeProcessingCoverCents,
        application_fee_cents: paymentSummary.applicationFeeCents,
        net_amount_cents: paymentSummary.tenantNetCents,
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
