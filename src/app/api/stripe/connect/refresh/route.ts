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

    const result = (await query(
      `
        SELECT
          COALESCE(
            ts.stripe_connect_account_id,
            t.stripe_connect_account_id
          ) AS stripe_connect_account_id
        FROM tenants t
        LEFT JOIN tenant_settings ts
          ON ts.tenant_slug = t.slug
        WHERE t.slug = $1
        LIMIT 1
      `,
      [tenantSlug],
    )) as ConnectAccountRow[];

    const accountId = result[0]?.stripe_connect_account_id || null;

    if (!accountId) {
      return NextResponse.redirect(
        new URL("/api/stripe/connect/create", baseUrl),
      );
    }

    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${baseUrl}/api/stripe/connect/refresh`,
      return_url: `${baseUrl}/admin/settings/billing?stripe_connect=return`,
      type: "account_onboarding",
    });

    return NextResponse.redirect(accountLink.url);
  } catch (error) {
    console.error("Stripe Connect refresh error:", error);

    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Unable to refresh Stripe Connect onboarding.",
      },
      { status: 500 },
    );
  }
}
