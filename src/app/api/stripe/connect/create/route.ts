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

async function getTenant() {
  const tenantSlug = await getTenantSlugFromHeaders();

  const result = await query(
    `
      SELECT
        id,
        slug,
        name,
        stripe_connect_account_id
      FROM tenants
      WHERE slug = $1
      LIMIT 1
    `,
    [tenantSlug],
  );

  return result.rows[0] || null;
}

export async function GET(request: Request) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.redirect(
        new URL("/admin/login", getBaseUrl(request)),
      );
    }

    if (!process.env.STRIPE_SECRET_KEY) {
      return NextResponse.json(
        { ok: false, error: "Missing STRIPE_SECRET_KEY." },
        { status: 500 },
      );
    }

    const tenant = await getTenant();

    if (!tenant) {
      return NextResponse.json(
        { ok: false, error: "Tenant not found." },
        { status: 404 },
      );
    }

    let accountId = tenant.stripe_connect_account_id as string | null;

    if (!accountId) {
      const account = await stripe.accounts.create({
        type: "express",
        country: "GB",
        default_currency: "gbp",
        business_type: "company",
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
        business_profile: {
          name: tenant.name || tenant.slug,
          product_description: "Fundraising campaign payments",
        },
        metadata: {
          tenant_id: tenant.id,
          tenant_slug: tenant.slug,
          platform: "so-fundraising-platform",
        },
      });

      accountId = account.id;

      await query(
        `
          UPDATE tenants
          SET
            stripe_connect_account_id = $1,
            stripe_connect_country = $2,
            stripe_connect_default_currency = $3,
            stripe_connect_charges_enabled = $4,
            stripe_connect_payouts_enabled = $5,
            stripe_connect_details_submitted = $6,
            stripe_connect_onboarding_complete = $7,
            stripe_connect_last_synced_at = NOW()
          WHERE id = $8
        `,
        [
          account.id,
          account.country || "GB",
          account.default_currency || "gbp",
          Boolean(account.charges_enabled),
          Boolean(account.payouts_enabled),
          Boolean(account.details_submitted),
          Boolean(account.details_submitted && account.charges_enabled),
          tenant.id,
        ],
      );
    }

    const baseUrl = getBaseUrl(request);

    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${baseUrl}/api/admin/stripe/connect/refresh`,
      return_url: `${baseUrl}/admin/billing?stripe_connect=return`,
      type: "account_onboarding",
    });

    return NextResponse.redirect(accountLink.url);
  } catch (error) {
    console.error("Stripe Connect create error:", error);

    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Unable to start Stripe Connect onboarding.",
      },
      { status: 500 },
    );
  }
}
