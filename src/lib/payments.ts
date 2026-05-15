import Stripe from "stripe";
import { query } from "@/lib/db";

export type TenantFinanceSettings = {
  tenant_slug: string;
  stripe_connect_account_id: string | null;
  stripe_connect_charges_enabled: boolean | null;
  stripe_connect_payouts_enabled: boolean | null;
  stripe_connect_details_submitted: boolean | null;
  stripe_connect_onboarding_complete: boolean | null;
  platform_fee_percent: number | string | null;
  subscription_tier: string | null;
};

export type CheckoutMetadata = Record<string, string | number | boolean | null>;

export type BuildCheckoutSessionInput = {
  stripe: Stripe;
  buyerEmail: string;
  successUrl: string;
  cancelUrl: string;
  lineItems: Stripe.Checkout.SessionCreateParams.LineItem[];
  metadata: CheckoutMetadata;
  finance: TenantFinanceSettings | null;
  applicationFeeCents: number;
};

export function cleanPaymentText(value: unknown) {
  return String(value || "").trim();
}

export function safePaymentPercent(value: unknown, fallback = 0) {
  const number = Number(value);

  if (!Number.isFinite(number) || number < 0) {
    return fallback;
  }

  return Math.min(100, Number(number.toFixed(2)));
}

export function calculateBuyerContributionCents(subtotalCents: number) {
  if (!subtotalCents || subtotalCents <= 0) {
    return 0;
  }

  return Math.max(0, Math.ceil(subtotalCents * 0.02 + 20));
}

export function calculateApplicationFeeCents(
  subtotalCents: number,
  platformFeePercent: number,
) {
  if (!subtotalCents || subtotalCents <= 0 || platformFeePercent <= 0) {
    return 0;
  }

  return Math.max(0, Math.ceil(subtotalCents * (platformFeePercent / 100)));
}

export function canUseStripeConnectDestination(
  finance: TenantFinanceSettings | null,
) {
  return Boolean(
    finance?.stripe_connect_account_id &&
      finance.stripe_connect_charges_enabled &&
      finance.stripe_connect_payouts_enabled &&
      finance.stripe_connect_details_submitted &&
      finance.stripe_connect_onboarding_complete,
  );
}

export function normaliseStripeMetadata(metadata: CheckoutMetadata) {
  return Object.fromEntries(
    Object.entries(metadata).map(([key, value]) => [
      key,
      value === null || value === undefined ? "" : String(value),
    ]),
  ) as Stripe.MetadataParam;
}

export async function getTenantFinanceSettings(
  tenantSlug: string,
): Promise<TenantFinanceSettings | null> {
  const rows = (await query(
    `
      select
        t.slug as tenant_slug,
        coalesce(
          nullif(ts.stripe_connect_account_id, ''),
          nullif(t.stripe_connect_account_id, '')
        ) as stripe_connect_account_id,
        t.stripe_connect_charges_enabled,
        t.stripe_connect_payouts_enabled,
        t.stripe_connect_details_submitted,
        t.stripe_connect_onboarding_complete,
        ts.platform_fee_percent,
        ts.subscription_tier
      from tenants t
      left join tenant_settings ts
        on ts.tenant_slug = t.slug
      where t.slug = $1
      limit 1
    `,
    [tenantSlug],
  )) as TenantFinanceSettings[];

  return rows[0] || null;
}

export function buildStripeCheckoutSessionParams(
  input: Omit<BuildCheckoutSessionInput, "stripe">,
): Stripe.Checkout.SessionCreateParams {
  const useConnect = canUseStripeConnectDestination(input.finance);
  const destination = input.finance?.stripe_connect_account_id || "";

  const metadata = normaliseStripeMetadata({
    ...input.metadata,
    stripe_connect_enabled: useConnect,
    stripe_connect_account_id: destination,
    application_fee_cents: input.applicationFeeCents,
  });

  const params: Stripe.Checkout.SessionCreateParams = {
    mode: "payment",
    customer_email: input.buyerEmail,
    success_url: input.successUrl,
    cancel_url: input.cancelUrl,
    line_items: input.lineItems,
    metadata,
  };

  if (useConnect && destination) {
    params.payment_intent_data = {
      application_fee_amount: Math.max(0, Math.floor(input.applicationFeeCents)),
      transfer_data: {
        destination,
      },
      metadata,
    };
  }

  return params;
}

export async function createStripeCheckoutSession(
  input: BuildCheckoutSessionInput,
) {
  return input.stripe.checkout.sessions.create(
    buildStripeCheckoutSessionParams(input),
  );
}

export function getPlatformFeePercent(finance: TenantFinanceSettings | null) {
  return safePaymentPercent(finance?.platform_fee_percent, 0);
}

export function buildPaymentSummary(input: {
  ticketTotalCents: number;
  coverFees: boolean;
  platformFeePercent: number;
}) {
  const buyerContributionCents = input.coverFees
    ? calculateBuyerContributionCents(input.ticketTotalCents)
    : 0;

  const applicationFeeCents = calculateApplicationFeeCents(
    input.ticketTotalCents,
    input.platformFeePercent,
  );

  const amountTotalCents = input.ticketTotalCents + buyerContributionCents;

  return {
    ticketTotalCents: input.ticketTotalCents,
    buyerContributionCents,
    applicationFeeCents,
    amountTotalCents,
  };
}
