import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { query } from "@/lib/db";
import { getTenantSettings } from "@/lib/tenant-settings";
import {
  getAuctionWinningBidPaymentByToken,
  isAuctionWinningBidPayable,
  markAuctionWinningBidCheckoutStarted,
} from "../../../../../../api/_lib/auctions-repo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

type TenantConnectStatus = {
  stripe_connect_account_id: string | null;
  stripe_connect_onboarding_complete: boolean | null;
  stripe_connect_charges_enabled: boolean | null;
  stripe_connect_payouts_enabled: boolean | null;
  stripe_connect_details_submitted: boolean | null;
};

function cleanText(value: unknown) {
  return String(value || "").trim();
}

function safePercent(value: unknown) {
  const number = Number(value);

  if (!Number.isFinite(number) || number < 0) {
    return 0;
  }

  return Math.min(100, number);
}

function calculatePlatformCommissionCents(params: {
  amountCents: number;
  platformFeePercent: number;
}) {
  const amountCents = Math.max(0, Math.round(params.amountCents || 0));
  const platformFeePercent = safePercent(params.platformFeePercent);

  if (!amountCents || !platformFeePercent) {
    return 0;
  }

  return Math.max(0, Math.round(amountCents * (platformFeePercent / 100)));
}

function getBaseUrl(request: NextRequest) {
  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.VERCEL_PROJECT_PRODUCTION_URL ||
    request.nextUrl.origin;

  return appUrl.startsWith("http") ? appUrl : `https://${appUrl}`;
}

function getTokenFromRequest(request: NextRequest, body?: Record<string, unknown>) {
  return cleanText(
    request.nextUrl.searchParams.get("token") ||
      body?.token ||
      body?.paymentToken ||
      body?.payment_token ||
      "",
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

async function createAuctionWinningBidCheckoutSession(params: {
  request: NextRequest;
  token: string;
}) {
  const payment = await getAuctionWinningBidPaymentByToken(params.token);

  if (!payment) {
    return {
      ok: false as const,
      status: 404,
      error: "Auction payment link not found.",
      redirectUrl: "",
    };
  }

  const baseUrl = getBaseUrl(params.request);
  const auctionUrl = `${baseUrl}/a/${encodeURIComponent(payment.auction_slug)}`;

  if (!isAuctionWinningBidPayable(payment)) {
    return {
      ok: false as const,
      status: 400,
      error:
        payment.payment_status === "paid"
          ? "This auction item has already been paid."
          : "This auction item is not available for payment.",
      redirectUrl: `${auctionUrl}?payment=not-available`,
    };
  }

  const amountCents = Math.max(0, Math.round(Number(payment.amount_cents || 0)));

  if (!amountCents) {
    return {
      ok: false as const,
      status: 400,
      error: "Invalid auction payment amount.",
      redirectUrl: `${auctionUrl}?payment=invalid`,
    };
  }

  const tenantSettings = await getTenantSettings(payment.tenant_slug);
  const connectStatus = await getTenantConnectStatus(payment.tenant_slug);

  const platformCommissionCents = calculatePlatformCommissionCents({
    amountCents,
    platformFeePercent: tenantSettings?.platform_fee_percent ?? 0,
  });

  const connectAccountId = getUsableConnectAccountId({
    settingsAccountId: tenantSettings?.stripe_connect_account_id,
    connectStatus,
  });

  const shouldUseConnectRouting =
    Boolean(connectAccountId) && isConnectReady(connectStatus);

  const shouldApplyApplicationFee =
    shouldUseConnectRouting &&
    platformCommissionCents > 0 &&
    platformCommissionCents < amountCents;

  const paymentIntentData = shouldUseConnectRouting
    ? {
        transfer_data: {
          destination: connectAccountId,
        },
        ...(shouldApplyApplicationFee
          ? {
              application_fee_amount: platformCommissionCents,
            }
          : {}),
      }
    : undefined;

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    payment_method_types: ["card"],
    customer_email: payment.bidder_email || undefined,
    client_reference_id: payment.bid_id,

    line_items: [
      {
        price_data: {
          currency: String(payment.currency || "GBP").toLowerCase(),
          product_data: {
            name: payment.item_title,
            description: `${payment.auction_title} · winning auction bid`,
          },
          unit_amount: amountCents,
        },
        quantity: 1,
      },
    ],

    ...(paymentIntentData
      ? {
          payment_intent_data: paymentIntentData,
        }
      : {}),

    metadata: {
      type: "auction_winning_bid",
      kind: "auction_winning_bid",

      tenant_slug: payment.tenant_slug,
      tenantSlug: payment.tenant_slug,

      auction_id: payment.auction_id,
      auctionId: payment.auction_id,
      auction_slug: payment.auction_slug,
      auctionSlug: payment.auction_slug,
      auction_title: payment.auction_title,

      auction_item_id: payment.item_id,
      auctionItemId: payment.item_id,
      item_id: payment.item_id,
      itemId: payment.item_id,
      item_title: payment.item_title,

      auction_bid_id: payment.bid_id,
      auctionBidId: payment.bid_id,
      bid_id: payment.bid_id,
      bidId: payment.bid_id,

      payment_token: payment.payment_token,
      paymentToken: payment.payment_token,

      bidder_name: payment.bidder_name,
      bidder_email: payment.bidder_email,

      base_amount_cents: String(amountCents),
      ticket_subtotal_cents: String(amountCents),
      tenant_target_amount_cents: String(amountCents),
      net_amount_cents: String(amountCents),

      platform_commission_cents: String(platformCommissionCents),
      tier_platform_commission_cents: String(platformCommissionCents),
      platform_fee_cents: String(platformCommissionCents),

      donor_fee_cents: "0",
      supporter_contribution_cents: "0",
      buyer_fee_cents: "0",
      donor_covered_fees: "false",

      application_fee_amount: shouldApplyApplicationFee
        ? String(platformCommissionCents)
        : "0",
      application_fee_amount_cents: shouldApplyApplicationFee
        ? String(platformCommissionCents)
        : "0",

      stripe_connect_routed: shouldUseConnectRouting ? "true" : "false",
      stripe_connect_account_id: shouldUseConnectRouting
        ? connectAccountId
        : "",
      platform_fee_percent: String(tenantSettings?.platform_fee_percent ?? ""),
    },

    success_url: `${auctionUrl}?auctionPayment=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${auctionUrl}?auctionPayment=cancelled`,
  });

  if (!session.url) {
    return {
      ok: false as const,
      status: 500,
      error: "Stripe did not return a checkout URL.",
      redirectUrl: `${auctionUrl}?payment=failed`,
    };
  }

  await markAuctionWinningBidCheckoutStarted({
    bidId: payment.bid_id,
    stripeCheckoutSessionId: session.id,
  });

  return {
    ok: true as const,
    url: session.url,
  };
}

export async function GET(request: NextRequest) {
  try {
    const token = getTokenFromRequest(request);

    if (!token) {
      return NextResponse.json(
        { ok: false, error: "Missing auction payment token" },
        { status: 400 },
      );
    }

    const result = await createAuctionWinningBidCheckoutSession({
      request,
      token,
    });

    if (!result.ok) {
      if (result.redirectUrl) {
        return NextResponse.redirect(result.redirectUrl, { status: 303 });
      }

      return NextResponse.json(
        { ok: false, error: result.error },
        { status: result.status },
      );
    }

    return NextResponse.redirect(result.url, { status: 303 });
  } catch (error: any) {
    console.error("GET auction winning bid checkout failed", error);

    return NextResponse.json(
      {
        ok: false,
        error: error?.message || "Auction checkout failed",
      },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const token = getTokenFromRequest(request, body);

    if (!token) {
      return NextResponse.json(
        { ok: false, error: "Missing auction payment token" },
        { status: 400 },
      );
    }

    const result = await createAuctionWinningBidCheckoutSession({
      request,
      token,
    });

    if (!result.ok) {
      return NextResponse.json(
        { ok: false, error: result.error },
        { status: result.status },
      );
    }

    return NextResponse.json({
      ok: true,
      url: result.url,
    });
  } catch (error: any) {
    console.error("POST auction winning bid checkout failed", error);

    return NextResponse.json(
      {
        ok: false,
        error: error?.message || "Auction checkout failed",
      },
      { status: 500 },
    );
  }
}
