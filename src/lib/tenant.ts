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

function normalizeHostname(hostname: string) {
  return hostname.split(":")[0].toLowerCase();
}

export function resolveTenantFromHost(hostHeader: string | null | undefined): ResolvedTenant {
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
    const subdomain = parts[0];

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
