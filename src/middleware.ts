import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { extractTenantSlugFromHost } from "@/lib/tenant";

export default auth((req) => {
  const { pathname } = req.nextUrl;

  const isAdminPath = pathname === "/admin" || pathname.startsWith("/admin/");
  const isAdminApiPath =
    pathname === "/api/admin" || pathname.startsWith("/api/admin/");

  const isPublicAdminPage =
    pathname.startsWith("/admin/login") ||
    pathname.startsWith("/admin/setup");

  const isPublicAdminApi =
    pathname === "/api/admin/setup" ||
    pathname.startsWith("/api/admin/setup/");

  if (isPublicAdminPage || isPublicAdminApi) {
    return NextResponse.next();
  }

  if (!isAdminPath && !isAdminApiPath) {
    return NextResponse.next();
  }

  const host = req.headers.get("host");
  const tenantSlug = extractTenantSlugFromHost(host) || "";

  if (!tenantSlug) {
    if (isAdminApiPath) {
      return NextResponse.json(
        { ok: false, error: "Tenant not found" },
        { status: 404 },
      );
    }

    const url = req.nextUrl.clone();
    url.pathname = "/";
    url.searchParams.set("error", "tenant_not_found");
    return NextResponse.redirect(url);
  }

  // Only require that a user is logged in here.
  // Tenant membership is enforced inside the actual admin pages/APIs.
  if (!req.auth?.user) {
    if (isAdminApiPath) {
      return NextResponse.json(
        { ok: false, error: "Unauthorized" },
        { status: 401 },
      );
    }

    const loginUrl = req.nextUrl.clone();
    loginUrl.pathname = "/admin/login";
    loginUrl.searchParams.set("error", "tenant_access_denied");
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};
