import type { VercelRequest, VercelResponse } from "@vercel/node";
import { listAdminRaffles } from "../../_lib/raffles-repo";
import { resolveTenantSlug } from "../../_lib/tenant";

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  try {
    if (req.method !== "GET") {
      res.setHeader("Allow", "GET");
      return res.status(405).json({ error: "Method not allowed." });
    }

    const tenantSlug = resolveTenantSlug(req);
    const raffles = await listAdminRaffles(tenantSlug);

    return res.status(200).json({ raffles });
  } catch (error) {
    console.error("GET /api/admin/raffles failed", error);

    return res.status(500).json({
      error: error instanceof Error ? error.message : "Internal server error.",
    });
  }
}
