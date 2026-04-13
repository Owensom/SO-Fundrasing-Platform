import type { VercelRequest, VercelResponse } from "@vercel/node";

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  const headerTenant = req.headers["x-tenant-slug"];
  const queryTenant = req.query.tenantSlug;

  const tenantSlug =
    typeof headerTenant === "string" && headerTenant.trim()
      ? headerTenant.trim()
      : typeof queryTenant === "string" && queryTenant.trim()
      ? queryTenant.trim()
      : "demo-a";

  return res.status(200).json({
    ok: true,
    route: "admin raffle purchases",
    slug: req.query.slug ?? null,
    tenantSlug,
  });
}
