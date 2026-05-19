import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getTenantSlugFromHeaders } from "@/lib/tenant";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
    return false;
  }

  const tenantSlug = await getTenantSlugFromHeaders();

  const sessionTenantSlugs = Array.isArray(session.user.tenantSlugs)
    ? session.user.tenantSlugs.map((value) => String(value))
    : [];

  return Boolean(tenantSlug && sessionTenantSlugs.includes(tenantSlug));
}

export async function GET(request: Request) {
  const baseUrl = getBaseUrl(request);
  const hasAccess = await requireCurrentTenantAccess();

  if (!hasAccess) {
    return NextResponse.redirect(
      new URL("/admin/login?error=tenant_access_denied", baseUrl),
      303,
    );
  }

  return NextResponse.redirect(
    new URL("/api/admin/stripe/connect/onboard", baseUrl),
    303,
  );
}
