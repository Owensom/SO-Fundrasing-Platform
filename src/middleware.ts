import { NextRequest, NextResponse } from "next/server";
import { extractTenantSlugFromHost } from "@/lib/tenant";

function getSessionTenantSlugs(request: NextRequest): string[] {
  const raw = request.headers.get("x-tenant-slugs");

  if (!raw) return [];

  return raw
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const host = request.headers.get("host");
  const tenantSlug = extractTenantSlugFromHost(host) || "";

  const isAdminPath = pathname === "/admin" || pathname.startsWith("/admin/");
  const isAdminApiPath =
    pathname === "/api/admin" || pathname.startsWith("/api/admin/");

  // ✅ CRITICAL FIX — allow login + setup pages through
  const isPublicAdminPath =
    pathname.startsWith("/admin/login") ||
    pathname.startsWith("/admin/setup");

  if (isPublicAdminPath) {
    return NextResponse.next();
  }

  if (!isAdminPath && !isAdminApiPath) {
    return NextResponse.next();
  }

  if (!tenantSlug) {
    if (isAdminApiPath) {
      return NextResponse.json(
        { ok: false, error: "Tenant not found" },
        { status: 404 },
      );
    }

    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.searchParams.set("error", "tenant_not_found");
    return NextResponse.redirect(url);
  }

  const sessionTenantSlugs = getSessionTenantSlugs(request);

  if (!sessionTenantSlugs.includes(tenantSlug)) {
    if (isAdminApiPath) {
      return NextResponse.json(
        { ok: false, error: "Forbidden" },
        { status: 403 },
      );
    }

    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/admin/login";
    loginUrl.searchParams.set("error", "tenant_access_denied");
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};
