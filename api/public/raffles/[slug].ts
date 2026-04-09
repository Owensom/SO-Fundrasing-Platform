import { tenants, raffleEvents } from "../../_lib/store";

export default function handler(req: any, res: any) {
  try {
    const slug = String(req.query.slug || "");

    if (!slug) {
      return res.status(400).json({ error: "Missing slug" });
    }

    const tenant = tenants.find((t: any) => t.slug === slug);

    if (!tenant) {
      return res.status(404).json({ error: "Tenant not found" });
    }

    const raffles = raffleEvents.filter(
      (r: any) => r.tenantId === tenant.id
    );

    return res.status(200).json({
      tenant,
      raffles,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Server crash" });
  }
}
