import type { VercelRequest, VercelResponse } from "@vercel/node";

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  const tenantSlugHeader = req.headers["x-tenant-slug"];
  const tenantSlugQuery = req.query.tenantSlug;
  const tenantSlug =
    typeof tenantSlugHeader === "string" && tenantSlugHeader.trim()
      ? tenantSlugHeader.trim()
      : typeof tenantSlugQuery === "string" && tenantSlugQuery.trim()
      ? tenantSlugQuery.trim()
      : "demo-a";

  return res.status(200).json({
    ok: true,
    route: "public raffle slug",
    slug: req.query.slug ?? null,
    tenantSlug,
  });
}
