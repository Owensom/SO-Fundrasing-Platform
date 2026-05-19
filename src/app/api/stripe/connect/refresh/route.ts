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

async function requireCurrentTenantAccess() {
  const session = await auth();

  if (!session?.user) {
    return {
      ok: false as const,
      response: NextResponse.redirect(
        new URL("/admin/login?error=unauthenticated", "https://placeholder.local"),
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
      response: NextResponse.redirect(
        new URL(
          "/admin/login?error=tenant_access_denied",
          "https://placeholder.local",
        ),
      ),
    };
  }

  return {
    ok: true as const,
    tenantSlug,
  };
}

async function getStripeConnectAccountId(tenantSlug: string) {
  const result = (await query(
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

  return String(result[0]?.stripe_connect_account_id || "").trim();
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

    const access = await requireCurrentTenantAccess();

    if (!access.ok) {
      const redirectUrl = new URL(access.response.headers.get("location") || "/", baseUrl);
      return NextResponse.redirect(redirectUrl, 303);
    }

    const { tenantSlug } = access;
    const accountId = await getStripeConnectAccountId(tenantSlug);

    if (!accountId) {
      return NextResponse.redirect(
        new URL("/api/admin/stripe/connect/onboard", baseUrl),
        303,
      );
    }

    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${baseUrl}/api/admin/stripe/connect/refresh`,
      return_url: `${baseUrl}/admin/settings/billing?stripe_connect=return`,
      type: "account_onboarding",
    });

    return NextResponse.redirect(accountLink.url, 303);
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
