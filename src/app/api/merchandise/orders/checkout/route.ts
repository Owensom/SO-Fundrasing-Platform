import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { query, queryOne } from "@/lib/db";
import { getTenantSettings } from "@/lib/tenant-settings";
import {
  checkSubscriptionCapability,
  normaliseSubscriptionTier,
} from "@/lib/subscription-capabilities";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

const STRIPE_STANDARD_UK_PERCENT = 0.015;
const STRIPE_STANDARD_UK_FIXED_CENTS = 20;

type CheckoutPayload = {
  tenantSlug?: unknown;
  orderId?: unknown;
  orderReference?: unknown;
  coverFees?: unknown;
  cover_fees?: unknown;
  donorCoveredFees?: unknown;
  donor_covered_fees?: unknown;
  buyerCoversFees?: unknown;
  buyer_covers_fees?: unknown;
};

type TenantConnectStatus = {
  stripe_connect_account_id: string | null;
  stripe_connect_onboarding_complete: boolean | null;
  stripe_connect_charges_enabled: boolean | null;
  stripe_connect_payouts_enabled: boolean | null;
  stripe_connect_details_submitted: boolean | null;
};

type TenantSettingsForCheckout = {
  subscription_tier?: string | null;
  subscription_status?: string | null;
  platform_owner_bypass?: boolean | null;
  platform_fee_percent?: number | string | null;
  stripe_connect_account_id?: string | null;
  buyer_fee_contributions_enabled?: boolean | null;
};

type MerchandiseOrder = {
  id: string;
  tenant_slug: string;
  order_reference: string;
  status: string;
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  subtotal_cents: number;
  platform_fee_cents: number;
  stripe_fee_cents: number;
  total_cents: number;
  currency: string;
  stripe_checkout_session_id: string | null;
};

type MerchandiseOrderItem = {
  id: string;
  tenant_slug: string;
  order_id: string;
  product_id: string;
  product_title: string;
  product_slug: string;
  option_label: string | null;
  quantity: number;
  unit_price_cents: number;
  line_total_cents: number;
  currency: string;
  linked_event_id: string | null;
  fulfilment_method: string | null;
  fulfilment_note: string | null;
};

function cleanText(value: unknown, fallback = "") {
  const clean = String(value ?? "").trim();
  return clean || fallback;
}

function boolValue(value: unknown) {
  if (typeof value === "boolean") return value;

  const clean = String(value ?? "").trim().toLowerCase();

  return clean === "true" || clean === "1" || clean === "yes" || clean === "on";
}

function safePercent(value: unknown) {
  const number = Number(value);

  if (!Number.isFinite(number) || number < 0) {
    return 0;
  }

  return Math.min(100, number);
}

function calculatePlatformCommissionCents(params: {
  subtotalCents: number;
  platformFeePercent: number;
}) {
  const subtotalCents = Math.max(0, Math.round(params.subtotalCents || 0));
  const platformFeePercent = safePercent(params.platformFeePercent);

  if (!subtotalCents || !platformFeePercent) {
    return 0;
  }

  return Math.max(0, Math.round(subtotalCents * (platformFeePercent / 100)));
}

function calculateSupporterCoverFeeCents(params: {
  subtotalCents: number;
  platformCommissionCents: number;
}) {
  const subtotalCents = Math.max(0, Math.round(params.subtotalCents || 0));
  const platformCommissionCents = Math.max(
    0,
    Math.round(params.platformCommissionCents || 0),
  );

  if (!subtotalCents && !platformCommissionCents) {
    return 0;
  }

  const grossAmountCents = Math.ceil(
    (subtotalCents +
      platformCommissionCents +
      STRIPE_STANDARD_UK_FIXED_CENTS) /
      (1 - STRIPE_STANDARD_UK_PERCENT),
  );

  return Math.max(grossAmountCents - subtotalCents, 0);
}

function getBaseUrl(request: NextRequest) {
  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.VERCEL_PROJECT_PRODUCTION_URL ||
    request.nextUrl.origin;

  return appUrl.startsWith("http") ? appUrl : `https://${appUrl}`;
}

function getUsableConnectAccountId(params: {
  settingsAccountId?: string | null;
  connectStatus?: TenantConnectStatus | null;
}) {
  const settingsAccountId = cleanText(params.settingsAccountId);
  const statusAccountId = cleanText(
    params.connectStatus?.stripe_connect_account_id,
  );

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

function buildStripeDescription(params: {
  items: MerchandiseOrderItem[];
  supporterContributionCents: number;
}) {
  const itemCount = params.items.reduce(
    (total, item) => total + Number(item.quantity || 0),
    0,
  );

  const firstItem = params.items[0];

  const suffix =
    params.supporterContributionCents > 0
      ? " · includes a contribution towards platform/payment costs"
      : "";

  if (!firstItem) {
    return `Merchandise order${suffix}`;
  }

  if (params.items.length === 1) {
    return `${itemCount} × ${firstItem.product_title}${
      firstItem.option_label ? ` · ${firstItem.option_label}` : ""
    }${suffix}`;
  }

  return `${itemCount} merchandise item${itemCount === 1 ? "" : "s"} across ${
    params.items.length
  } product line${params.items.length === 1 ? "" : "s"}${suffix}`;
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

async function getPendingOrder(params: {
  tenantSlug: string;
  orderId: string;
  orderReference: string;
}) {
  return queryOne<MerchandiseOrder>(
    `
      select
        id::text,
        tenant_slug,
        order_reference,
        status,
        customer_name,
        customer_email,
        customer_phone,
        subtotal_cents,
        platform_fee_cents,
        stripe_fee_cents,
        total_cents,
        currency,
        stripe_checkout_session_id
      from merchandise_orders
      where tenant_slug = $1
        and (
          ($2 <> '' and id::text = $2)
          or
          ($3 <> '' and order_reference = $3)
        )
      limit 1
    `,
    [params.tenantSlug, params.orderId, params.orderReference],
  );
}

async function getOrderItems(params: { tenantSlug: string; orderId: string }) {
  return query<MerchandiseOrderItem>(
    `
      select
        id::text,
        tenant_slug,
        order_id::text,
        product_id,
        product_title,
        product_slug,
        option_label,
        quantity,
        unit_price_cents,
        line_total_cents,
        currency,
        linked_event_id::text,
        fulfilment_method,
        fulfilment_note
      from merchandise_order_items
      where tenant_slug = $1
        and order_id = $2::uuid
      order by created_at asc
    `,
    [params.tenantSlug, params.orderId],
  );
}

async function markOrderCheckoutSession(params: {
  tenantSlug: string;
  orderId: string;
  stripeCheckoutSessionId: string;
  platformFeeCents: number;
  totalCents: number;
}) {
  await query(
    `
      update merchandise_orders
      set
        stripe_checkout_session_id = $3,
        platform_fee_cents = $4,
        total_cents = $5,
        status = 'checkout_started',
        updated_at = now()
      where tenant_slug = $1
        and id = $2::uuid
        and status <> 'paid'
    `,
    [
      params.tenantSlug,
      params.orderId,
      params.stripeCheckoutSessionId,
      params.platformFeeCents,
      params.totalCents,
    ],
  );
}

export async function POST(request: NextRequest) {
  try {
    let payload: CheckoutPayload;

    try {
      payload = (await request.json()) as CheckoutPayload;
    } catch {
      return NextResponse.json(
        {
          ok: false,
          error: "Invalid checkout request. Please refresh and try again.",
        },
        { status: 400 },
      );
    }

    const tenantSlug = cleanText(payload.tenantSlug);
    const orderId = cleanText(payload.orderId);
    const orderReference = cleanText(payload.orderReference);

    if (!tenantSlug) {
      return NextResponse.json(
        {
          ok: false,
          error: "Missing shop details.",
        },
        { status: 400 },
      );
    }

    if (!orderId && !orderReference) {
      return NextResponse.json(
        {
          ok: false,
          error: "Missing order details.",
        },
        { status: 400 },
      );
    }

    const tenantSettings = (await getTenantSettings(
      tenantSlug,
    )) as TenantSettingsForCheckout | null;

    if (!tenantSettings) {
      return NextResponse.json(
        {
          ok: false,
          error: "This shop is not available.",
        },
        { status: 404 },
      );
    }

    const subscriptionTier = normaliseSubscriptionTier(
      tenantSettings.subscription_tier,
    );

    const merchandiseCapability = checkSubscriptionCapability(
      {
        subscription_tier: subscriptionTier,
        subscription_status: cleanText(
          tenantSettings.subscription_status,
          "active",
        ),
        platform_owner_bypass: Boolean(tenantSettings.platform_owner_bypass),
      },
      "merchandise",
    );

    if (!merchandiseCapability.allowed) {
      return NextResponse.json(
        {
          ok: false,
          error: "Merchandise checkout is not available for this shop.",
        },
        { status: 403 },
      );
    }

    const order = await getPendingOrder({
      tenantSlug,
      orderId,
      orderReference,
    });

    if (!order) {
      return NextResponse.json(
        {
          ok: false,
          error: "Merchandise order not found.",
        },
        { status: 404 },
      );
    }

    if (order.tenant_slug !== tenantSlug) {
      return NextResponse.json(
        {
          ok: false,
          error: "Merchandise order not found.",
        },
        { status: 404 },
      );
    }

    if (order.status === "paid") {
      return NextResponse.json(
        {
          ok: false,
          error: "This order has already been paid.",
        },
        { status: 409 },
      );
    }

    if (order.status !== "checkout_started" && order.status !== "draft") {
      return NextResponse.json(
        {
          ok: false,
          error: "This order is not ready for checkout.",
        },
        { status: 400 },
      );
    }

    if (!cleanText(order.customer_email) || !cleanText(order.customer_name)) {
      return NextResponse.json(
        {
          ok: false,
          error: "This order is missing buyer details.",
        },
        { status: 400 },
      );
    }

    const items = await getOrderItems({
      tenantSlug,
      orderId: order.id,
    });

    if (items.length === 0) {
      return NextResponse.json(
        {
          ok: false,
          error: "This order has no merchandise items.",
        },
        { status: 400 },
      );
    }

    const currency = cleanText(order.currency || items[0]?.currency || "GBP")
      .toUpperCase()
      .slice(0, 3);

    const calculatedSubtotalCents = items.reduce(
      (total, item) => total + Number(item.line_total_cents || 0),
      0,
    );

    const subtotalCents =
      calculatedSubtotalCents > 0
        ? calculatedSubtotalCents
        : Number(order.subtotal_cents || 0);

    if (!subtotalCents || subtotalCents <= 0) {
      return NextResponse.json(
        {
          ok: false,
          error: "This order has an invalid total.",
        },
        { status: 400 },
      );
    }

    const buyerFeeContributionsEnabled = Boolean(
      tenantSettings.buyer_fee_contributions_enabled,
    );

    const requestedCoverFees = boolValue(
      payload.coverFees ??
        payload.cover_fees ??
        payload.donorCoveredFees ??
        payload.donor_covered_fees ??
        payload.buyerCoversFees ??
        payload.buyer_covers_fees,
    );

    const platformCommissionCents = calculatePlatformCommissionCents({
      subtotalCents,
      platformFeePercent: Number(tenantSettings.platform_fee_percent ?? 0),
    });

    const supporterContributionCents =
      requestedCoverFees && buyerFeeContributionsEnabled
        ? calculateSupporterCoverFeeCents({
            subtotalCents,
            platformCommissionCents,
          })
        : 0;

    const totalCents = subtotalCents + supporterContributionCents;

    const stripeProcessingCoverCents = Math.max(
      supporterContributionCents - platformCommissionCents,
      0,
    );

    const applicationFeeAmountCents =
      supporterContributionCents > 0
        ? supporterContributionCents
        : platformCommissionCents;

    const tenantTargetAmountCents = subtotalCents;

    const tenantNetAfterApplicationFeeCents = Math.max(
      totalCents - applicationFeeAmountCents,
      0,
    );

    const connectStatus = await getTenantConnectStatus(tenantSlug);

    const connectAccountId = getUsableConnectAccountId({
      settingsAccountId: tenantSettings.stripe_connect_account_id,
      connectStatus,
    });

    const shouldUseConnectRouting =
      Boolean(connectAccountId) && isConnectReady(connectStatus);

    const shouldApplyApplicationFee =
      shouldUseConnectRouting &&
      applicationFeeAmountCents > 0 &&
      applicationFeeAmountCents < totalCents;

    const paymentIntentData = shouldUseConnectRouting
      ? {
          transfer_data: {
            destination: connectAccountId,
          },
          ...(shouldApplyApplicationFee
            ? {
                application_fee_amount: applicationFeeAmountCents,
              }
            : {}),
        }
      : undefined;

    const baseUrl = getBaseUrl(request);

    const successUrl = `${baseUrl}/m/${encodeURIComponent(
      tenantSlug,
    )}/basket?merchandise=success&merchandise_success=true&order_reference=${encodeURIComponent(
      order.order_reference,
    )}&session_id={CHECKOUT_SESSION_ID}`;

    const cancelUrl = `${baseUrl}/m/${encodeURIComponent(
      tenantSlug,
    )}/basket?merchandise=cancelled&checkout=cancelled&order_reference=${encodeURIComponent(
      order.order_reference,
    )}`;

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      customer_email: cleanText(order.customer_email),
      client_reference_id: order.id,

      line_items: [
        {
          price_data: {
            currency: currency.toLowerCase(),
            product_data: {
              name: `Merchandise order ${order.order_reference}`,
              description: buildStripeDescription({
                items,
                supporterContributionCents,
              }),
            },
            unit_amount: totalCents,
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
        type: "merchandise",
        kind: "merchandise",

        tenant_slug: tenantSlug,
        tenantSlug,

        merchandise_order_id: order.id,
        merchandiseOrderId: order.id,

        merchandise_order_reference: order.order_reference,
        merchandiseOrderReference: order.order_reference,

        customer_name: cleanText(order.customer_name),
        customer_email: cleanText(order.customer_email),

        item_count: String(
          items.reduce((total, item) => total + Number(item.quantity || 0), 0),
        ),

        subtotal_cents: String(subtotalCents),
        checkout_total_cents: String(totalCents),
        total_cents: String(totalCents),
        gross_amount_cents: String(totalCents),

        base_amount_cents: String(subtotalCents),
        ticket_subtotal_cents: String(subtotalCents),
        tenant_target_amount_cents: String(tenantTargetAmountCents),
        net_amount_cents: String(tenantTargetAmountCents),

        platform_commission_cents: String(platformCommissionCents),
        tier_platform_commission_cents: String(platformCommissionCents),
        platform_fee_cents: String(platformCommissionCents),

        stripe_processing_cover_cents: String(stripeProcessingCoverCents),
        supporter_contribution_cents: String(supporterContributionCents),
        donor_fee_cents: String(supporterContributionCents),
        buyer_fee_cents: String(supporterContributionCents),

        buyer_fee_contributions_enabled: buyerFeeContributionsEnabled
          ? "true"
          : "false",
        buyer_requested_cover_fees: requestedCoverFees ? "true" : "false",
        donor_covered_fees: supporterContributionCents > 0 ? "true" : "false",

        application_fee_amount: shouldApplyApplicationFee
          ? String(applicationFeeAmountCents)
          : "0",
        application_fee_amount_cents: shouldApplyApplicationFee
          ? String(applicationFeeAmountCents)
          : "0",

        application_fee_includes_supporter_cover:
          supporterContributionCents > 0 ? "true" : "false",

        tenant_net_after_application_fee_cents: String(
          tenantNetAfterApplicationFeeCents,
        ),

        stripe_fee_estimate_model: "uk_standard_card_1_5_percent_plus_20p",

        stripe_connect_routed: shouldUseConnectRouting ? "true" : "false",
        stripe_connect_account_id: shouldUseConnectRouting
          ? connectAccountId
          : "",
        platform_fee_percent: String(tenantSettings.platform_fee_percent ?? ""),
      },

      success_url: successUrl,
      cancel_url: cancelUrl,
    });

    if (!session.url) {
      return NextResponse.json(
        {
          ok: false,
          error: "Stripe did not return a checkout URL.",
        },
        { status: 500 },
      );
    }

    await markOrderCheckoutSession({
      tenantSlug,
      orderId: order.id,
      stripeCheckoutSessionId: session.id,
      platformFeeCents: platformCommissionCents,
      totalCents,
    });

    return NextResponse.json({
      ok: true,
      url: session.url,
      sessionId: session.id,
      order: {
        id: order.id,
        orderReference: order.order_reference,
        status: "checkout_started",
        subtotalCents,
        totalCents,
        platformFeeCents: platformCommissionCents,
        supporterContributionCents,
        currency,
      },
    });
  } catch (error: any) {
    console.error("POST merchandise order checkout failed", error);

    return NextResponse.json(
      {
        ok: false,
        error: error?.message || "Merchandise checkout failed.",
      },
      { status: 500 },
    );
  }
}
