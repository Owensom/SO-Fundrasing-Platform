import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { extractTenantSlugFromHost } from "@/lib/tenant";

export default auth((req) => {
  const pathname = req.nextUrl.pathname;
  const host =
    req.headers.get("x-forwarded-host") || req.headers.get("host") || "";
  const tenantSlug = extractTenantSlugFromHost(host);
  const isLoggedIn = !!req.auth;

  const isAdminPath = pathname.startsWith("/admin");
  const isAdminApiPath = pathname.startsWith("/api/admin");
  const isPublicAdminPath =
    pathname === "/admin/login" || pathname === "/admin/setup";

  if (!isAdminPath && !isAdminApiPath) {
    return NextResponse.next();
  }

  if (isPublicAdminPath) {
    return NextResponse.next();
  }

  if (!isLoggedIn) {
    if (isAdminApiPath) {
      return NextResponse.json(
        { ok: false, error: "Unauthenticated" },
        { status: 401 },
      );
    }

    const loginUrl = new URL("/admin/login", req.url);
    loginUrl.searchParams.set("callbackUrl", pathname);

    return NextResponse.redirect(loginUrl);
  }

  const sessionTenantSlugs = Array.isArray(req.auth?.user?.tenantSlugs)
    ? req.auth!.user!.tenantSlugs
    : [];

  if (!sessionTenantSlugs.includes(tenantSlug)) {
    if (isAdminApiPath) {
      return NextResponse.json(
        { ok: false, error: "Forbidden" },
        { status: 403 },
      );
    }

    const forbiddenUrl = new URL("/admin/login", req.url);
    forbiddenUrl.searchParams.set("error", "tenant_access_denied");

    return NextResponse.redirect(forbiddenUrl);
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};
