import type { VercelRequest, VercelResponse } from "@vercel/node";

function resolveTenantSlug(req: VercelRequest): string {
  const headerTenant = req.headers["x-tenant-slug"];
  const queryTenant = req.query.tenantSlug;

  if (typeof headerTenant === "string" && headerTenant.trim()) {
    return headerTenant.trim();
  }

  if (typeof queryTenant === "string" && queryTenant.trim()) {
    return queryTenant.trim();
  }

  return "demo-a";
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  const tenantSlug = resolveTenantSlug(req);
  const slug = req.query.slug;

  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed." });
  }

  if (typeof slug !== "string" || !slug.trim()) {
    return res.status(400).json({ error: "Invalid raffle slug." });
  }

  try {
    const repo = await import("../../_lib/raffles-repo");

    return res.status(200).json({
      ok: true,
      tenantSlug,
      slug,
      repoLoaded: true,
      exports: Object.keys(repo),
    });
  } catch (error) {
    return res.status(500).json({
      error: error instanceof Error ? error.message : "Unknown import error",
      tenantSlug,
      slug,
      repoLoaded: false,
    });
  }
}
