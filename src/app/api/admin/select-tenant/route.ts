import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { normalizeTenantSlug, TENANT_COOKIE_NAME } from "@/lib/tenant";

export const dynamic = "force-dynamic";

type AdminSessionLike = {
  user?: {
    tenantSlugs?: unknown;
  } | null;
} | null;

function safeCallbackUrl(value: string | null | undefined) {
  const clean = String(value || "").trim();

  if (!clean || !clean.startsWith("/") || clean.startsWith("//")) {
    return "/admin";
  }

  if (clean.startsWith("/admin/login")) return "/admin";
  if (clean.startsWith("/admin/select-tenant")) return "/admin";

  return clean;
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

function getSessionTenantSlugs(session: AdminSessionLike) {
  const tenantSlugs = session?.user?.tenantSlugs;

  if (!Array.isArray(tenantSlugs)) {
    return [];
  }

  return tenantSlugs
    .map((value) => normalizeTenantSlug(String(value)))
    .filter(Boolean);
}

export async function GET(req: Request) {
  const session = (await auth()) as AdminSessionLike;

  if (!session?.user) {
    return NextResponse.redirect(new URL("/admin/login", req.url));
  }

  const url = new URL(req.url);
  const tenantSlug = normalizeTenantSlug(url.searchParams.get("tenant"));
  const callbackUrl = safeCallbackUrl(url.searchParams.get("callbackUrl"));
  const sessionTenantSlugs = getSessionTenantSlugs(session);

  if (!tenantSlug || !sessionTenantSlugs.includes(tenantSlug)) {
    return NextResponse.redirect(
      new URL("/admin/select-tenant?error=tenant_access_denied", req.url),
    );
  }

  const response = NextResponse.redirect(new URL(callbackUrl, req.url));
  setTenantCookie(response, tenantSlug);

  return response;
}

export async function POST(req: Request) {
  const session = (await auth()) as AdminSessionLike;

  if (!session?.user) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized" },
      { status: 401 },
    );
  }

  const formData = await req.formData();
  const tenantSlug = normalizeTenantSlug(
    String(formData.get("tenantSlug") || ""),
  );
  const callbackUrl = safeCallbackUrl(String(formData.get("callbackUrl") || ""));
  const sessionTenantSlugs = getSessionTenantSlugs(session);

  if (!tenantSlug || !sessionTenantSlugs.includes(tenantSlug)) {
    return NextResponse.redirect(
      new URL("/admin/select-tenant?error=tenant_access_denied", req.url),
    );
  }

  const response = NextResponse.redirect(new URL(callbackUrl, req.url));
  setTenantCookie(response, tenantSlug);

  return response;
}
