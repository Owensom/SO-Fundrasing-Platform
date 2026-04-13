import type { VercelRequest, VercelResponse } from "@vercel/node";

function resolveTenantSlug(req: VercelRequest): string {
  const headerTenant = req.headers["x-tenant-slug"];
  const queryTenant = req.query.tenantSlug;

  if (typeof headerTenant === "string" && headerTenant.trim()) {
    return headerTenant.trim();
  }

  if (typeof queryTenant === "string" && queryTenant.trim()) {
    return queryTenant.trim();
  }

  return "demo-a";
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed." });
  }

  const tenantSlug = resolveTenantSlug(req);
  const slug = req.query.slug;

  if (typeof slug !== "string" || !slug.trim()) {
    return res.status(400).json({ error: "Invalid raffle slug." });
  }

  try {
    const repo = await import("../../../_lib/raffles-repo.js");

    const raffle = await repo.getAdminRaffleBySlug(tenantSlug, slug);

    if (!raffle) {
      return res.status(404).json({ error: "Raffle not found." });
    }

    const purchases = await repo.listPurchasesForRaffle(tenantSlug, slug);

    const soldTickets = purchases.reduce((total: number, purchase: any) => {
      return purchase.paymentStatus === "paid"
        ? total + purchase.quantity
        : total;
    }, 0);

    return res.status(200).json({
      raffle,
      purchases,
      summary: {
        totalTickets: raffle.totalTickets,
        soldTickets,
        remainingTickets: Math.max(raffle.totalTickets - soldTickets, 0),
        purchaseCount: purchases.length,
      },
    });
  } catch (error) {
    return res.status(500).json({
      error: error instanceof Error ? error.message : "Unknown runtime error",
      tenantSlug,
      slug,
    });
  }
}
