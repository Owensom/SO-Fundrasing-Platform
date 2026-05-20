import { headers } from "next/headers";

export type ResolvedTenant =
  | {
      kind: "root";
      hostname: string;
      tenantSlug: null;
    }
  | {
      kind: "tenant";
      hostname: string;
      tenantSlug: string;
    };

export const TENANT_COOKIE_NAME = "so_tenant_slug";

function normalizeHostname(hostname: string) {
  return hostname.split(":")[0].toLowerCase();
}

export function normalizeTenantSlug(value: string | null | undefined) {
  const clean = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "");

  if (!/^[a-z0-9][a-z0-9-]{1,58}[a-z0-9]$/.test(clean)) {
    return "";
  }

  return clean;
}

function getCookieValue(cookieHeader: string | null | undefined, name: string) {
  const cookies = String(cookieHeader || "")
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean);

  for (const cookie of cookies) {
    const [key, ...rest] = cookie.split("=");

    if (key === name) {
      return decodeURIComponent(rest.join("=") || "");
    }
  }

  return "";
}

function isMainVercelHost(hostname: string) {
  return hostname === "so-fundraising-platform.vercel.app";
}

export function resolveTenantFromHost(
  hostHeader: string | null | undefined,
): ResolvedTenant {
  const hostname = normalizeHostname(hostHeader || "");

  if (!hostname) {
    return {
      kind: "root",
      hostname: "",
      tenantSlug: null,
    };
  }

  if (hostname === "localhost" || hostname === "127.0.0.1") {
    return {
      kind: "root",
      hostname,
      tenantSlug: null,
    };
  }

  // Temporary migration/testing rule:
  // the main Vercel project hostname falls back to demo-a unless a tenant
  // cookie is set by login/registration.
  if (isMainVercelHost(hostname)) {
    return {
      kind: "tenant",
      hostname,
      tenantSlug: "demo-a",
    };
  }

  const parts = hostname.split(".");

  if (parts.length >= 3) {
    const subdomain = normalizeTenantSlug(parts[0]);

    if (subdomain && subdomain !== "www") {
      return {
        kind: "tenant",
        hostname,
        tenantSlug: subdomain,
      };
    }
  }

  return {
    kind: "root",
    hostname,
    tenantSlug: null,
  };
}

export function extractTenantSlugFromHost(
  hostHeader: string | null | undefined,
): string | null {
  const resolved = resolveTenantFromHost(hostHeader);
  return resolved.kind === "tenant" ? resolved.tenantSlug : null;
}

export function getTenantSlugFromHeaders(): string {
  const headerStore = headers();
  const host = headerStore.get("host");
  const hostname = normalizeHostname(host || "");

  if (isMainVercelHost(hostname)) {
    const cookieTenantSlug = normalizeTenantSlug(
      getCookieValue(headerStore.get("cookie"), TENANT_COOKIE_NAME),
    );

    if (cookieTenantSlug) {
      return cookieTenantSlug;
    }
  }

  return extractTenantSlugFromHost(host) || "";
}

export function getTenantSlugFromRequest(
  request: Request | { headers: Headers },
): string {
  const host = request.headers.get("host");
  const hostname = normalizeHostname(host || "");

  if (isMainVercelHost(hostname)) {
    const cookieTenantSlug = normalizeTenantSlug(
      getCookieValue(request.headers.get("cookie"), TENANT_COOKIE_NAME),
    );

    if (cookieTenantSlug) {
      return cookieTenantSlug;
    }
  }

  return extractTenantSlugFromHost(host) || "";
}
