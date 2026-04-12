import type { VercelRequest, VercelResponse } from "@vercel/node";
import { resolveTenantSlug } from "../../_lib/raffles-repo";

export default function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const tenantSlug = resolveTenantSlug(req);

    return res.status(200).json({
      ok: true,
      slug: req.query.slug ?? null,
      tenantSlug,
    });
  } catch (error) {
    return res.status(500).json({
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
}
