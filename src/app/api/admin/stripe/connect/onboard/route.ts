import { NextResponse } from "next/server";
import Stripe from "stripe";
import { auth } from "@/auth";
import { query } from "@/lib/db";
import { getTenantSlugFromHeaders } from "@/lib/tenant";
import { getTenantSettings } from "@/lib/tenant-settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
  apiVersion: "2023-10-16",
});

type TenantConnectRow = {
  stripe_connect_account_id: string | null;
};

function getBaseUrl(request: Request) {
  const envUrl =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXTAUTH_URL ||
    process.env.VERCEL_PROJECT_PRODUCTION_URL ||
    "";

  if (envUrl) {
    return envUrl.startsWith("http") ? envUrl : `https://${envUrl}`;
  }

  const url = new URL(request.url);
  return `${url.protocol}//${url.host}`;
}

function billingRedirect(request: Request, status: string) {
  return NextResponse.redirect(
    new URL(`/admin/settings/billing?stripe_connect=${status}`, request.url),
    { status: 303 },
  );
}

async function requireCurrentTenantAccess(request: Request) {
  const session = await auth();

  if (!session?.user) {
    return {
      ok: false as const,
      response: NextResponse.redirect(new URL("/admin/login", request.url), {
        status: 303,
      }),
    };
  }

  const tenantSlug = await getTenantSlugFromHeaders();

  const sessionTenantSlugs = Array.isArray(session.user.tenantSlugs)
    ? session.user.tenantSlugs.map((value) => String(value))
    : [];

  if (!tenantSlug || !sessionTenantSlugs.includes(tenantSlug)) {
    return {
      ok: false as const,
      response: NextResponse.redirect(
        new URL("/admin/login?error=tenant_access_denied", request.url),
        { status: 303 },
      ),
    };
  }

  return {
    ok: true as const,
    tenantSlug,
    email: session.user.email || null,
  };
}

async function getTenantStoredStripeConnectAccountId(tenantSlug: string) {
  const rows = await query<TenantConnectRow>(
    `
      select stripe_connect_account_id
      from tenants
      where slug = $1
      limit 1
    `,
    [tenantSlug],
  );

  return String(rows[0]?.stripe_connect_account_id || "").trim();
}

async function saveStripeConnectAccount(
  tenantSlug: string,
  account: Stripe.Account,
) {
  const stripeConnectAccountId = String(account.id || "").trim();

  if (!stripeConnectAccountId) {
    throw new Error("Missing Stripe Connect account ID.");
  }

  await query(
    `
      update tenants
      set
        stripe_connect_account_id = $1,
        stripe_connect_onboarding_complete = $2,
        stripe_connect_charges_enabled = $3,
        stripe_connect_payouts_enabled = $4,
        stripe_connect_details_submitted = $5,
        stripe_connect_country = $6,
        stripe_connect_default_currency = $7,
        stripe_connect_last_synced_at = now(),
        updated_at = now()
      where slug = $8
    `,
    [
      stripeConnectAccountId,
      Boolean(account.details_submitted),
      Boolean(account.charges_enabled),
      Boolean(account.payouts_enabled),
      Boolean(account.details_submitted),
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
    [tenantSlug, stripeConnectAccountId],
  );
}

export async function GET(request: Request) {
  try {
    if (!process.env.STRIPE_SECRET_KEY) {
      return billingRedirect(request, "missing_secret");
    }

    const access = await requireCurrentTenantAccess(request);

    if (!access.ok) {
      return access.response;
    }

    const { tenantSlug, email } = access;

    const settings = await getTenantSettings(tenantSlug);
    const storedTenantConnectAccountId =
      await getTenantStoredStripeConnectAccountId(tenantSlug);

    let stripeConnectAccountId =
      settings?.stripe_connect_account_id?.trim() ||
      storedTenantConnectAccountId ||
      "";

    let account: Stripe.Account;

    if (stripeConnectAccountId) {
      account = await stripe.accounts.retrieve(stripeConnectAccountId);
    } else {
      account = await stripe.accounts.create({
        type: "express",
        country: "GB",
        email: email || undefined,
        capabilities: {
          card_payments: {
            requested: true,
          },
          transfers: {
            requested: true,
          },
        },
        metadata: {
          tenant_slug: tenantSlug,
          platform: "so-foundation-platform",
        },
      });

      stripeConnectAccountId = account.id;
    }

    await saveStripeConnectAccount(tenantSlug, account);

    const baseUrl = getBaseUrl(request);

    const accountLink = await stripe.accountLinks.create({
      account: stripeConnectAccountId,
      refresh_url: `${baseUrl}/api/admin/stripe/connect/onboard`,
      return_url: `${baseUrl}/admin/settings/billing?stripe_connect=returned`,
      type: "account_onboarding",
    });

    return NextResponse.redirect(accountLink.url, 303);
  } catch (error) {
    console.error("Stripe Connect onboarding failed:", error);

    return billingRedirect(request, "failed");
  }
}
