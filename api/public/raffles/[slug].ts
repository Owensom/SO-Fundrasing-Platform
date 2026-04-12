import type { VercelRequest, VercelResponse } from "@vercel/node";

export default function handler(req: VercelRequest, res: VercelResponse) {
  return res.status(200).json({
    ok: true,
    slug: req.query.slug ?? null,
    tenantSlug:
      typeof req.headers["x-tenant-slug"] === "string"
        ? req.headers["x-tenant-slug"]
        : typeof req.query.tenantSlug === "string"
        ? req.query.tenantSlug
        : "demo-a",
  });
}
