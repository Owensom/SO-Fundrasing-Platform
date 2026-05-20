import { NextResponse } from "next/server";
import Stripe from "stripe";
import { auth } from "@/auth";
import { query } from "@/lib/db";
import { getTenantSlugFromHeaders } from "@/lib/tenant";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
  apiVersion: "2023-10-16",
});

type ConnectAccountRow = {
  settings_stripe_connect_account_id: string | null;
  tenant_stripe_connect_account_id: string | null;
};

function getBaseUrl(request: Request) {
  const envUrl =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXTAUTH_URL ||
    process.env.VERCEL_PROJECT_PRODUCTION_URL ||
    process.env.VERCEL_URL ||
    "";

  if (envUrl) {
    return envUrl.startsWith("http") ? envUrl : `https://${envUrl}`;
  }

  return new URL(request.url).origin;
}

function billingStatusRedirect(request: Request, status: string) {
  return NextResponse.redirect(
    new URL(`/admin/settings/billing?stripe_status=${status}`, request.url),
    { status: 303 },
  );
}

async function requireCurrentTenantAccess() {
  const session = await auth();

  if (!session?.user) {
    return null;
  }

  const tenantSlug = await getTenantSlugFromHeaders();

  const sessionTenantSlugs = Array.isArray(session.user.tenantSlugs)
    ? session.user.tenantSlugs.map((value) => String(value))
    : [];

  if (!tenantSlug || !sessionTenantSlugs.includes(tenantSlug)) {
    return null;
  }

  return tenantSlug;
}

async function getStripeConnectAccountId(tenantSlug: string) {
  const rows = (await query(
    `
      select
        ts.stripe_connect_account_id as settings_stripe_connect_account_id,
        t.stripe_connect_account_id as tenant_stripe_connect_account_id
      from tenants t
      left join tenant_settings ts
        on ts.tenant_slug = t.slug
      where t.slug = $1
      limit 1
    `,
    [tenantSlug],
  )) as ConnectAccountRow[];

  const settingsAccountId = String(
    rows[0]?.settings_stripe_connect_account_id || "",
  ).trim();

  const tenantAccountId = String(
    rows[0]?.tenant_stripe_connect_account_id || "",
  ).trim();

  return settingsAccountId || tenantAccountId;
}

async function saveStripeConnectStatus({
  tenantSlug,
  account,
}: {
  tenantSlug: string;
  account: Stripe.Account;
}) {
  await query(
    `
      update tenants
      set
        stripe_connect_account_id = $1,
        stripe_connect_charges_enabled = $2,
        stripe_connect_payouts_enabled = $3,
        stripe_connect_details_submitted = $4,
        stripe_connect_onboarding_complete = $5,
        stripe_connect_country = $6,
        stripe_connect_default_currency = $7,
        stripe_connect_last_synced_at = now(),
        updated_at = now()
      where slug = $8
    `,
    [
      account.id,
      Boolean(account.charges_enabled),
      Boolean(account.payouts_enabled),
      Boolean(account.details_submitted),
      Boolean(account.details_submitted && account.charges_enabled),
      account.country || null,
      account.default_currency || null,
      tenantSlug,
    ],
  );

  await query(
    `
      insert into tenant_settings (
        tenant_slug,
        subscription_tier,
        platform_fee_percent,
        stripe_customer_id,
        stripe_subscription_id,
        stripe_connect_account_id,
        subscription_status,
        buyer_fee_contributions_enabled,
        crm_enabled,
        auctions_enabled,
        reserved_seating_enabled,
        finance_dashboard_enabled,
        white_label_enabled,
        custom_domain_enabled
      )
      values (
        $1, 'community', 7, null, null, $2, 'active',
        false, false, false, false, false, false, false
      )
      on conflict (tenant_slug)
      do update set
        stripe_connect_account_id = excluded.stripe_connect_account_id,
        updated_at = now()
    `,
    [tenantSlug, account.id],
  );
}

export async function GET(request: Request) {
  const baseUrl = getBaseUrl(request);

  try {
    if (!process.env.STRIPE_SECRET_KEY) {
      return billingStatusRedirect(request, "missing_secret");
    }

    const tenantSlug = await requireCurrentTenantAccess();

    if (!tenantSlug) {
      return NextResponse.redirect(
        new URL("/admin/login?error=tenant_access_denied", baseUrl),
        { status: 303 },
      );
    }

    const accountId = await getStripeConnectAccountId(tenantSlug);

    if (!accountId) {
      return billingStatusRedirect(request, "missing");
    }

    const account = await stripe.accounts.retrieve(accountId);

    await saveStripeConnectStatus({
      tenantSlug,
      account,
    });

    return billingStatusRedirect(request, "refreshed");
  } catch (error) {
    console.error("Stripe Connect status refresh error:", error);

    return billingStatusRedirect(request, "failed");
  }
}
