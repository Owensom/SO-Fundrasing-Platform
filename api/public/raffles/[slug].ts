import { getStore } from "../../_lib/store";

export default function handler(req: any, res: any) {
  const { slug } = req.query;

  if (!slug) {
    return res.status(400).json({ error: "Missing slug" });
  }

  const store = getStore();

  const tenant = store.tenants.find((t: any) => t.slug === slug);

  if (!tenant) {
    return res.status(404).json({ error: "Tenant not found" });
  }

  const raffles = store.raffles.filter(
    (r: any) => r.tenantId === tenant.id
  );

  res.json(raffles);
}
