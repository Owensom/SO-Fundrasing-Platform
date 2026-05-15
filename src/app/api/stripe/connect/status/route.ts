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
  stripe_connect_account_id: string | null;
};

function getBaseUrl(request: Request) {
  const envUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXTAUTH_URL ||
    process.env.VERCEL_URL;

  if (envUrl) {
    return envUrl.startsWith("http") ? envUrl : `https://${envUrl}`;
  }

  return new URL(request.url).origin;
}

async function requireTenantSlug() {
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

export async function GET(request: Request) {
  const baseUrl = getBaseUrl(request);

  try {
    if (!process.env.STRIPE_SECRET_KEY) {
      return NextResponse.json(
        { ok: false, error: "Missing STRIPE_SECRET_KEY." },
        { status: 500 },
      );
    }

    const tenantSlug = await requireTenantSlug();

    if (!tenantSlug) {
      return NextResponse.redirect(
        new URL("/admin/login?error=tenant_access_denied", baseUrl),
      );
    }

    const rows = (await query(
      `
        select
          coalesce(
            ts.stripe_connect_account_id,
            t.stripe_connect_account_id
          ) as stripe_connect_account_id
        from tenants t
        left join tenant_settings ts
          on ts.tenant_slug = t.slug
        where t.slug = $1
        limit 1
      `,
      [tenantSlug],
    )) as ConnectAccountRow[];

    const accountId = rows[0]?.stripe_connect_account_id || null;

    if (!accountId) {
      return NextResponse.redirect(
        new URL("/admin/settings/billing?stripe_status=missing", baseUrl),
      );
    }

    const account = await stripe.accounts.retrieve(accountId);

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
          stripe_connect_last_synced_at = now()
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

    return NextResponse.redirect(
      new URL("/admin/settings/billing?stripe_status=refreshed", baseUrl),
    );
  } catch (error) {
    console.error("Stripe Connect status refresh error:", error);

    return NextResponse.redirect(
      new URL("/admin/settings/billing?stripe_status=failed", baseUrl),
    );
  }
}
