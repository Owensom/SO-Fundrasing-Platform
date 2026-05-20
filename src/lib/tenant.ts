import { cookies, headers } from "next/headers";

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

const TENANT_COOKIE_NAME = "so_tenant_slug";

function normalizeHostname(hostname: string) {
  return hostname.split(":")[0].toLowerCase();
}

function normalizeTenantSlug(value: string | null | undefined) {
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

  // Temporary migration/testing rule:
  // map the main Vercel project hostname to demo-a unless a tenant cookie is used.
  if (hostname === "so-fundraising-platform.vercel.app") {
    return {
      kind: "tenant",
      hostname,
      tenantSlug: "demo-a",
    };
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

  const cookieTenantSlug = normalizeTenantSlug(
    cookies().get(TENANT_COOKIE_NAME)?.value,
  );

  if (
    cookieTenantSlug &&
    hostname === "so-fundraising-platform.vercel.app"
  ) {
    return cookieTenantSlug;
  }

  return extractTenantSlugFromHost(host) || "";
}

export function getTenantSlugFromRequest(
  request: Request | { headers: Headers },
): string {
  const host = request.headers.get("host");
  return extractTenantSlugFromHost(host) || "";
}

export { TENANT_COOKIE_NAME, normalizeTenantSlug };
