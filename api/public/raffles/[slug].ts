import type { VercelRequest, VercelResponse } from "@vercel/node";
import { tenants, raffleEvents } from "../../_lib/store";

export default function handler(req: VercelRequest, res: VercelResponse) {
  const slug = String(req.query.slug || "");

  const tenant = tenants.find(
    (t) => t.slug === slug && t.isActive
  );

  if (!tenant) {
    return res.status(404).json({ error: "Tenant not found" });
  }

  const raffles = raffleEvents.filter(
    (e) => e.tenantId === tenant.id
  );

  return res.json({
    tenant: {
      id: tenant.id,
      name: tenant.name,
      slug: tenant.slug,
    },
    raffles,
  });
}
