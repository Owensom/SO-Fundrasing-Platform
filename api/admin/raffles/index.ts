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
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed." });
  }

  const tenantSlug = resolveTenantSlug(req);

  try {
    const repo = await import("../../_lib/raffles-repo.js");
    const raffles = await repo.listAdminRaffles(tenantSlug);

    return res.status(200).json({
      raffles,
    });
  } catch (error) {
    console.error("GET /api/admin/raffles failed", error);

    return res.status(500).json({
      error: error instanceof Error ? error.message : "Unknown runtime error",
      tenantSlug,
    });
  }
}
