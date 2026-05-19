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

async function requireCurrentTenantAccess() {
  const session = await auth();

  if (!session?.user) {
    return {
      ok: false as const,
      response: NextResponse.json(
        { ok: false, error: "unauthenticated" },
        { status: 401 },
      ),
    };
  }

  const tenantSlug = await getTenantSlugFromHeaders();

  const sessionTenantSlugs = Array.isArray(session.user.tenantSlugs)
    ? session.user.tenantSlugs.map((value) => String(value))
    : [];

  if (!tenantSlug || !sessionTenantSlugs.includes(tenantSlug)) {
    return {
      ok: false as const,
      response: NextResponse.json(
        { ok: false, error: "tenant_access_denied" },
        { status: 403 },
      ),
    };
  }

  return {
    ok: true as const,
    tenantSlug,
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

async function saveStripeConnectAccountId(
  tenantSlug: string,
  stripeConnectAccountId: string,
) {
  await query(
    `
      insert into tenant_settings (
        tenant_slug,
        stripe_connect_account_id
      )
      values ($1, $2)
      on conflict (tenant_slug)
      do update set
        stripe_connect_account_id = excluded.stripe_connect_account_id,
        updated_at = now()
    `,
    [tenantSlug, stripeConnectAccountId],
  );

  await query(
    `
      update tenants
      set
        stripe_connect_account_id = $1,
        updated_at = now()
      where slug = $2
    `,
    [stripeConnectAccountId, tenantSlug],
  );
}

export async function GET(request: Request) {
  try {
    if (!process.env.STRIPE_SECRET_KEY) {
      return NextResponse.json(
        {
          ok: false,
          error: "missing_stripe_secret_key",
        },
        { status: 500 },
      );
    }

    const access = await requireCurrentTenantAccess();

    if (!access.ok) {
      return access.response;
    }

    const { tenantSlug } = access;

    const settings = await getTenantSettings(tenantSlug);
    const storedTenantConnectAccountId =
      await getTenantStoredStripeConnectAccountId(tenantSlug);

    let stripeConnectAccountId =
      settings?.stripe_connect_account_id?.trim() ||
      storedTenantConnectAccountId ||
      "";

    if (!stripeConnectAccountId) {
      const account = await stripe.accounts.create({
        type: "express",
        country: "GB",
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

    await saveStripeConnectAccountId(tenantSlug, stripeConnectAccountId);

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

    return NextResponse.json(
      {
        ok: false,
        error: "stripe_connect_onboarding_failed",
      },
      { status: 500 },
    );
  }
}
