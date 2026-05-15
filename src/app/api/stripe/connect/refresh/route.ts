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

export async function GET(request: Request) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.redirect(
        new URL("/admin/login", getBaseUrl(request)),
      );
    }

    const tenantSlug = await getTenantSlugFromHeaders();

    const result = await query(
      `
        SELECT stripe_connect_account_id
        FROM tenants
        WHERE slug = $1
        LIMIT 1
      `,
      [tenantSlug],
    );

    const accountId = result.rows[0]?.stripe_connect_account_id as
      | string
      | null
      | undefined;

    if (!accountId) {
      return NextResponse.redirect(
        new URL("/api/admin/stripe/connect/create", getBaseUrl(request)),
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
