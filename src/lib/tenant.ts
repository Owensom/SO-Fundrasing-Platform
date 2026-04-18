import { headers } from "next/headers";

const DEFAULT_TENANT_SLUG = "default";

function cleanHost(input: string): string {
  return input.split(":")[0].trim().toLowerCase();
}

function getRootDomain(): string {
  return (process.env.ROOT_DOMAIN || "").trim().toLowerCase();
}

export function extractTenantSlugFromHost(host: string): string {
  const cleanedHost = cleanHost(host);
  if (!cleanedHost) {
    return DEFAULT_TENANT_SLUG;
  }

  const rootDomain = getRootDomain();

  if (cleanedHost === "localhost" || cleanedHost.endsWith(".localhost")) {
    const parts = cleanedHost.split(".").filter(Boolean);

    if (parts.length >= 2) {
      return parts[0];
    }

    return DEFAULT_TENANT_SLUG;
  }

  if (
    cleanedHost.endsWith(".vercel.app") ||
    cleanedHost.endsWith(".now.sh")
  ) {
    const parts = cleanedHost.split(".").filter(Boolean);

    if (parts.length >= 3) {
      return parts[0];
    }

    return DEFAULT_TENANT_SLUG;
  }

  if (rootDomain) {
    if (cleanedHost === rootDomain) {
      return DEFAULT_TENANT_SLUG;
    }

    if (cleanedHost.endsWith(`.${rootDomain}`)) {
      const subdomain = cleanedHost.slice(0, -(rootDomain.length + 1)).trim();
      const firstPart = subdomain.split(".").filter(Boolean)[0];

      if (firstPart) {
        return firstPart;
      }
    }
  }

  return DEFAULT_TENANT_SLUG;
}

export async function getTenantSlugFromHeaders(): Promise<string> {
  const h = await headers();
  const forwardedHost = h.get("x-forwarded-host");
  const host = h.get("host");
  return extractTenantSlugFromHost(forwardedHost || host || "");
}

export function getTenantSlugFromRequest(request: Request): string {
  const forwardedHost = request.headers.get("x-forwarded-host");
  const host = request.headers.get("host");
  return extractTenantSlugFromHost(forwardedHost || host || "");
}
