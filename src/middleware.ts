import { NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  extractTenantSlugFromHost,
  normalizeTenantSlug,
  TENANT_COOKIE_NAME,
} from "@/lib/tenant";

export default auth((req) => {
  const { pathname } = req.nextUrl;

  const isAdminPath = pathname === "/admin" || pathname.startsWith("/admin/");
  const isAdminApiPath =
    pathname === "/api/admin" || pathname.startsWith("/api/admin/");

  const isPublicAdminPage =
    pathname.startsWith("/admin/login") ||
    pathname.startsWith("/admin/register") ||
    pathname.startsWith("/admin/setup");

  const isPublicAdminApi =
    pathname === "/api/admin/register" ||
    pathname.startsWith("/api/admin/register/") ||
    pathname === "/api/admin/setup" ||
    pathname.startsWith("/api/admin/setup/");

  const host = req.headers.get("host");
  const hostTenantSlug = extractTenantSlugFromHost(host) || "";
  const cookieTenantSlug = normalizeTenantSlug(
    req.cookies.get(TENANT_COOKIE_NAME)?.value,
  );

  const queryTenantSlug = normalizeTenantSlug(
    req.nextUrl.searchParams.get("tenant"),
  );

  const isMainVercelHost =
    String(host || "")
      .split(":")[0]
      .toLowerCase() === "so-fundraising-platform.vercel.app";

  const tenantSlug =
    isMainVercelHost && (queryTenantSlug || cookieTenantSlug)
      ? queryTenantSlug || cookieTenantSlug
      : hostTenantSlug;

  if (isPublicAdminPage || isPublicAdminApi) {
    const response = NextResponse.next();

    if (queryTenantSlug && isMainVercelHost) {
      response.cookies.set(TENANT_COOKIE_NAME, queryTenantSlug, {
        path: "/",
        sameSite: "lax",
        secure: true,
        httpOnly: false,
        maxAge: 60 * 60 * 24 * 30,
      });
    }

    return response;
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

    const url = req.nextUrl.clone();
    url.pathname = "/";
    url.searchParams.set("error", "tenant_not_found");

    return NextResponse.redirect(new URL(url.toString(), req.url));
  }

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
    loginUrl.searchParams.set("tenant", tenantSlug);

    return NextResponse.redirect(new URL(loginUrl.toString(), req.url));
  }

  const sessionTenantSlugs = Array.isArray(req.auth.user.tenantSlugs)
    ? req.auth.user.tenantSlugs.map((value) => String(value))
    : [];

  if (!sessionTenantSlugs.includes(tenantSlug)) {
    if (isAdminApiPath) {
      return NextResponse.json(
        { ok: false, error: "Tenant access denied" },
        { status: 403 },
      );
    }

    const loginUrl = req.nextUrl.clone();
    loginUrl.pathname = "/admin/login";
    loginUrl.searchParams.set("error", "tenant_access_denied");
    loginUrl.searchParams.set("tenant", tenantSlug);

    return NextResponse.redirect(new URL(loginUrl.toString(), req.url));
  }

  const response = NextResponse.next();

  if (isMainVercelHost && tenantSlug) {
    response.cookies.set(TENANT_COOKIE_NAME, tenantSlug, {
      path: "/",
      sameSite: "lax",
      secure: true,
      httpOnly: false,
      maxAge: 60 * 60 * 24 * 30,
    });
  }

  return response;
});

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};
