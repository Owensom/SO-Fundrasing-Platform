import type { VercelRequest, VercelResponse } from "@vercel/node";
import { listAdminRaffles, resolveTenantSlug } from "../../_lib/raffles-repo";

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
    const raffles = await listAdminRaffles(tenantSlug);

    return res.status(200).json({
      raffles,
    });
  } catch (error) {
    console.error("GET /api/admin/raffles failed", error);
    return res.status(500).json({ error: "Internal server error." });
  }
}
