import { raffleEvents, tenants } from "../../_lib/store";

export default function handler(req: any, res: any) {
  try {
    const slug = String(req.query.slug || "");

    if (!slug) {
      return res.status(400).json({ error: "Missing slug" });
    }

    const tenant = tenants.find((t) => t.slug === slug && t.isActive);

    if (!tenant) {
      return res.status(404).json({ error: "Tenant not found" });
    }

    const raffles = raffleEvents.filter((event) => event.tenantId === tenant.id);

    return res.status(200).json({
      tenant: {
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
      },
      raffles,
    });
  } catch (error) {
    console.error("Public raffle route crashed:", error);
    return res.status(500).json({
      error: "Route crashed",
      detail: error instanceof Error ? error.message : "Unknown error",
    });
  }
}
