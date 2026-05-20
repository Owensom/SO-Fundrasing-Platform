import { NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  extractTenantSlugFromHost,
  normalizeTenantSlug,
  TENANT_COOKIE_NAME,
} from "@/lib/tenant";

function hostnameFromHost(host: string | null) {
  return String(host || "").split(":")[0].toLowerCase();
}

function isMainVercelHost(host: string | null) {
  return hostnameFromHost(host) === "so-fundraising-platform.vercel.app";
}

function setTenantCookie(response: NextResponse, tenantSlug: string) {
  response.cookies.set(TENANT_COOKIE_NAME, tenantSlug, {
    path: "/",
    sameSite: "lax",
    secure: true,
    httpOnly: false,
    maxAge: 60 * 60 * 24 * 30,
  });
}

function safeCallbackPath(req: Parameters<Parameters<typeof auth>[0]>[0]) {
  const path = `${req.nextUrl.pathname}${req.nextUrl.search || ""}`;

  if (!path.startsWith("/") || path.startsWith("//")) {
    return "/admin";
  }

  if (path.startsWith("/admin/login")) {
    return "/admin";
  }

  return path;
}

export default auth((req) => {
  const { pathname } = req.nextUrl;

  const isAdminPath = pathname === "/admin" || pathname.startsWith("/admin/");
  const isAdminApiPath =
    pathname === "/api/admin" || pathname.startsWith("/api/admin/");

  const isTenantSelectPage = pathname === "/admin/select-tenant";
  const isTenantSelectApi = pathname === "/api/admin/select-tenant";

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
  const mainVercelHost = isMainVercelHost(host);

  const hostTenantSlug = mainVercelHost
    ? ""
    : extractTenantSlugFromHost(host) || "";

  const cookieTenantSlug = normalizeTenantSlug(
    req.cookies.get(TENANT_COOKIE_NAME)?.value,
  );

  const queryTenantSlug = normalizeTenantSlug(
    req.nextUrl.searchParams.get("tenant"),
  );

  if (isPublicAdminPage || isPublicAdminApi) {
    const response = NextResponse.next();

    if (mainVercelHost && queryTenantSlug) {
      setTenantCookie(response, queryTenantSlug);
    }

    return response;
  }

  if (!isAdminPath && !isAdminApiPath) {
    return NextResponse.next();
  }

  const sessionTenantSlugs = Array.isArray(req.auth?.user?.tenantSlugs)
    ? req.auth.user.tenantSlugs
        .map((value) => normalizeTenantSlug(String(value)))
        .filter(Boolean)
    : [];

  if (isTenantSelectPage || isTenantSelectApi) {
    if (!req.auth?.user) {
      if (isTenantSelectApi) {
        return NextResponse.json(
          { ok: false, error: "Unauthorized" },
          { status: 401 },
        );
      }

      const loginUrl = req.nextUrl.clone();
      loginUrl.pathname = "/admin/login";
      loginUrl.searchParams.set("callbackUrl", "/admin/select-tenant");

      return NextResponse.redirect(new URL(loginUrl.toString(), req.url));
    }

    return NextResponse.next();
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

    if (mainVercelHost && (queryTenantSlug || cookieTenantSlug)) {
      loginUrl.searchParams.set(
        "tenant",
        queryTenantSlug || cookieTenantSlug,
      );
    }

    loginUrl.searchParams.set("callbackUrl", safeCallbackPath(req));

    return NextResponse.redirect(new URL(loginUrl.toString(), req.url));
  }

  if (
    mainVercelHost &&
    !queryTenantSlug &&
    !cookieTenantSlug &&
    sessionTenantSlugs.length > 1
  ) {
    if (isAdminApiPath) {
      return NextResponse.json(
        {
          ok: false,
          error: "Tenant selection required",
        },
        { status: 409 },
      );
    }

    const selectUrl = req.nextUrl.clone();
    selectUrl.pathname = "/admin/select-tenant";
    selectUrl.searchParams.set("callbackUrl", safeCallbackPath(req));

    return NextResponse.redirect(new URL(selectUrl.toString(), req.url));
  }

  const tenantSlug = mainVercelHost
    ? queryTenantSlug ||
      cookieTenantSlug ||
      (sessionTenantSlugs.length === 1 ? sessionTenantSlugs[0] : "")
    : hostTenantSlug;

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

  if (!sessionTenantSlugs.includes(tenantSlug)) {
    if (isAdminApiPath) {
      return NextResponse.json(
        { ok: false, error: "Tenant access denied" },
        { status: 403 },
      );
    }

    if (mainVercelHost && sessionTenantSlugs.length > 1) {
      const selectUrl = req.nextUrl.clone();
      selectUrl.pathname = "/admin/select-tenant";
      selectUrl.searchParams.set("error", "tenant_access_denied");
      selectUrl.searchParams.set("callbackUrl", "/admin");

      return NextResponse.redirect(new URL(selectUrl.toString(), req.url));
    }

    const loginUrl = req.nextUrl.clone();
    loginUrl.pathname = "/admin/login";
    loginUrl.searchParams.set("error", "tenant_access_denied");

    if (mainVercelHost && tenantSlug) {
      loginUrl.searchParams.set("tenant", tenantSlug);
    }

    return NextResponse.redirect(new URL(loginUrl.toString(), req.url));
  }

  if (mainVercelHost && tenantSlug && cookieTenantSlug !== tenantSlug) {
    const redirectUrl = req.nextUrl.clone();
    const response = NextResponse.redirect(
      new URL(redirectUrl.toString(), req.url),
    );

    setTenantCookie(response, tenantSlug);

    return response;
  }

  const response = NextResponse.next();

  if (mainVercelHost && tenantSlug) {
    setTenantCookie(response, tenantSlug);
  }

  return response;
});

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};
