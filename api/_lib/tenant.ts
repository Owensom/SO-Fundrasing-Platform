type HeaderValue = string | string[] | undefined;

type RequestLike = {
  headers: Record<string, HeaderValue>;
};

function firstHeader(value: HeaderValue): string {
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }

  return typeof value === "string" ? value : "";
}

function parseHost(host: string): string {
  return host.split(":")[0].trim().toLowerCase();
}

export function resolveTenantSlug(req: RequestLike): string {
  const headerTenant = firstHeader(req.headers["x-tenant-slug"]).trim();
  if (headerTenant) {
    return headerTenant.toLowerCase();
  }

  const host = parseHost(firstHeader(req.headers.host));
  if (!host) {
    return "default";
  }

  const parts = host.split(".").filter(Boolean);

  if (parts.length >= 3) {
    return parts[0];
  }

  return "default";
}
