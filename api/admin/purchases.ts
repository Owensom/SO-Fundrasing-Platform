import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getRaffleStore, type Purchase, type Raffle } from "../_lib/rafflestore";

function sendJson(
  res: VercelResponse,
  status: number,
  payload: unknown
): VercelResponse {
  res.status(status).setHeader("Content-Type", "application/json");
  return res.send(JSON.stringify(payload));
}

function readTenantId(req: VercelRequest): string {
  const headerTenant = req.headers["x-tenant-id"];

  if (typeof headerTenant === "string" && headerTenant.trim()) {
    return headerTenant.trim();
  }

  return "demo-a";
}

export default function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return sendJson(res, 405, { message: "Method not allowed" });
  }

  const tenantId = readTenantId(req);
  const store = getRaffleStore();

  const raffleMap = new Map<string, Raffle>();
  store.raffles.forEach((raffle) => {
    if (raffle.tenantId === tenantId) {
      raffleMap.set(raffle.id, raffle);
    }
  });

  const purchases = store.purchases
    .filter((purchase: Purchase) => purchase.tenantId === tenantId)
    .sort((a: Purchase, b: Purchase) => b.createdAt.localeCompare(a.createdAt))
    .map((purchase: Purchase) => ({
      ...purchase,
      raffleTitle: raffleMap.get(purchase.raffleId)?.title || purchase.raffleSlug,
    }));

  return sendJson(res, 200, { purchases });
}
