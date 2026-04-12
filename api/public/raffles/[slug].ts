import type { VercelRequest, VercelResponse } from "@vercel/node";
import { resolveTenantSlug } from "../../_lib/tenant";

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  return res.status(200).json({
    ok: true,
    route: "public raffle slug",
    slug: req.query.slug ?? null,
    tenantSlug: resolveTenantSlug(req),
  });
}
