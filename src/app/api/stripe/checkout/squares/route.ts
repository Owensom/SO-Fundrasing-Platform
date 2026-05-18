import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { query, queryOne } from "@/lib/db";
import { getTenantSlugFromRequest } from "@/lib/tenant";
import { getTenantSettings } from "@/lib/tenant-settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2023-10-16",
});

type TenantConnectStatus = {
  stripe_connect_account_id: string | null;
  stripe_connect_onboarding_complete: boolean | null;
  stripe_connect_charges_enabled: boolean | null;
  stripe_connect_payouts_enabled: boolean | null;
  stripe_connect_details_submitted: boolean | null;
};

type VerifiedSquaresCheckoutRow = {
  game_id: string;
  tenant_slug: string;
  slug: string;
  title: string;
  currency: string | null;
  price_per_square_cents: number | null;
  status: string | null;
  reservation_token: string;
  payment_status: string | null;
  squares: number[] | null;
};

function safePercent(value: unknown) {
  const number = Number(value);

  if (!Number.isFinite(number) || number < 0) {
    return 0;
  }

  return Math.min(100, number);
}

function calculateApplicationFeeAmount(params: {
  totalAmountCents: number;
  platformFeePercent: number;
}) {
  const totalAmountCents = Math.max(0, Math.round(params.totalAmountCents));
  const platformFeePercent = safePercent(params.platformFeePercent);

  if (!totalAmountCents || !platformFeePercent) {
    return 0;
  }

  return Math.max(
    0,
    Math.round(totalAmountCents * (platformFeePercent / 100)),
  );
}

function getUsableConnectAccountId(params: {
  settingsAccountId?: string | null;
  connectStatus?: TenantConnectStatus | null;
}) {
  const settingsAccountId = String(params.settingsAccountId || "").trim();
  const statusAccountId = String(
    params.connectStatus?.stripe_connect_account_id || "",
  ).trim();

  const accountId = settingsAccountId || statusAccountId;

  if (!accountId || !accountId.startsWith("acct_")) {
    return "";
  }

  return accountId;
}

function isConnectReady(connectStatus: TenantConnectStatus | null) {
  if (!connectStatus?.stripe_connect_account_id) {
    return false;
  }

  return Boolean(
    connectStatus.stripe_connect_onboarding_complete &&
      connectStatus.stripe_connect_charges_enabled &&
      connectStatus.stripe_connect_payouts_enabled &&
      connectStatus.stripe_connect_details_submitted,
  );
}

async function getTenantConnectStatus(
  tenantSlug: string,
): Promise<TenantConnectStatus | null> {
  const rows = await query<TenantConnectStatus>(
    `
      select
        stripe_connect_account_id,
        stripe_connect_onboarding_complete,
        stripe_connect_charges_enabled,
        stripe_connect_payouts_enabled,
        stripe_connect_details_submitted
      from tenants
      where slug = $1
      limit 1
    `,
    [tenantSlug],
  );

  return rows[0] || null;
}

async function getVerifiedSquaresCheckout(input: {
  tenantSlug: string;
  gameId: string;
  reservationToken: string;
}) {
  return queryOne<VerifiedSquaresCheckoutRow>(
    `
      select
        sg.id as game_id,
        sg.tenant_slug,
        sg.slug,
        sg.title,
        sg.currency,
        sg.price_per_square_cents,
        sg.status,
        sr.reservation_token,
        sr.payment_status,
        sr.squares
      from squares_games sg
      inner join squares_reservations sr
        on sr.game_id = sg.id
      where sg.tenant_slug = $1
        and sg.id = $2
        and sr.reservation_token = $3
      limit 1
    `,
    [input.tenantSlug, input.gameId, input.reservationToken],
  );
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const tenantSlug = getTenantSlugFromRequest(req);

    if (!tenantSlug) {
      return NextResponse.json(
        { ok: false, error: "Tenant not found" },
        { status: 404 },
      );
    }

    const gameId = String(body.gameId || "").trim();
    const reservationToken = String(body.reservationToken || "").trim();
    const coverFees = Boolean(body.coverFees);

    if (!gameId || !reservationToken) {
      return NextResponse.json(
        { ok: false, error: "Missing checkout data" },
        { status: 400 },
      );
    }

    const checkout = await getVerifiedSquaresCheckout({
      tenantSlug,
      gameId,
      reservationToken,
    });

    if (!checkout) {
      return NextResponse.json(
        { ok: false, error: "Reservation not found" },
        { status: 404 },
      );
    }

    if (checkout.status !== "published") {
      return NextResponse.json(
        { ok: false, error: "Squares game is not available" },
        { status: 400 },
      );
    }

    if (checkout.payment_status !== "reserved") {
      return NextResponse.json(
        { ok: false, error: "Reservation is not available" },
        { status: 400 },
      );
    }

    const squares = Array.isArray(checkout.squares)
      ? checkout.squares
          .map((square) => Number(square))
          .filter((square) => Number.isInteger(square) && square > 0)
      : [];

    const quantity = squares.length;

    if (quantity <= 0) {
      return NextResponse.json(
        { ok: false, error: "No squares reserved" },
        { status: 400 },
      );
    }

    const pricePerSquareCents = Number(checkout.price_per_square_cents || 0);

    if (!Number.isFinite(pricePerSquareCents) || pricePerSquareCents <= 0) {
      return NextResponse.json(
        { ok: false, error: "Invalid square price" },
        { status: 400 },
      );
    }

    const baseAmount = pricePerSquareCents * quantity;
    const supporterContributionCents = coverFees
      ? Math.round(baseAmount * 0.1)
      : 0;
    const totalAmount = baseAmount + supporterContributionCents;

    const tenantSettings = await getTenantSettings(tenantSlug);
    const connectStatus = await getTenantConnectStatus(tenantSlug);

    const connectAccountId = getUsableConnectAccountId({
      settingsAccountId: tenantSettings?.stripe_connect_account_id,
      connectStatus,
    });

    const platformCommissionCents = calculateApplicationFeeAmount({
      totalAmountCents: baseAmount,
      platformFeePercent: tenantSettings?.platform_fee_percent ?? 0,
    });

    const platformFeeCents =
      platformCommissionCents + supporterContributionCents;

    const netAmountCents = Math.max(totalAmount - platformFeeCents, 0);

    const shouldUseConnectRouting =
      Boolean(connectAccountId) &&
      isConnectReady(connectStatus) &&
      platformCommissionCents > 0 &&
      platformCommissionCents < totalAmount;

    const origin = req.nextUrl.origin;
    const successUrl = `${origin}/api/stripe/success?session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = `${origin}/s/${checkout.slug}`;

    const squaresJson = JSON.stringify(squares);

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "payment",

      line_items: [
        {
          price_data: {
            currency: String(checkout.currency || "GBP").toLowerCase(),
            product_data: {
              name: checkout.title || "Squares Game",
              description: `${quantity} square${quantity === 1 ? "" : "s"}`,
            },
            unit_amount: totalAmount,
          },
          quantity: 1,
        },
      ],

      ...(shouldUseConnectRouting
        ? {
            payment_intent_data: {
              application_fee_amount: platformCommissionCents,
              transfer_data: {
                destination: connectAccountId,
              },
            },
          }
        : {}),

      success_url: successUrl,
      cancel_url: cancelUrl,

      metadata: {
        type: "squares",
        game_id: checkout.game_id,
        squares_game_id: checkout.game_id,
        game_title: checkout.title || "Squares Game",
        tenant_slug: tenantSlug,
        reservation_token: reservationToken,
        quantity: String(quantity),

        platform_fee_cents: String(platformFeeCents),
        platform_commission_cents: String(platformCommissionCents),
        supporter_contribution_cents: String(supporterContributionCents),
        net_amount_cents: String(netAmountCents),

        stripe_connect_routed: shouldUseConnectRouting ? "true" : "false",
        stripe_connect_account_id: shouldUseConnectRouting
          ? connectAccountId
          : "",
        platform_fee_percent: String(
          tenantSettings?.platform_fee_percent ?? "",
        ),
        application_fee_amount: shouldUseConnectRouting
          ? String(platformCommissionCents)
          : "0",

        squares_json: squaresJson,
        squares: squaresJson,
      },
    });

    if (session.id) {
      await query(
        `
          update squares_reservations
          set stripe_checkout_session_id = $1
          where reservation_token = $2
            and game_id = $3
        `,
        [session.id, reservationToken, checkout.game_id],
      );
    }

    return NextResponse.json({
      ok: true,
      url: session.url,
    });
  } catch (err: any) {
    console.error("Stripe squares checkout error:", err);

    return NextResponse.json(
      { ok: false, error: err?.message || "Checkout failed" },
      { status: 500 },
    );
  }
}
