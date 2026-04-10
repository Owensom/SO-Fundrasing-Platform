import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  getAdminRaffleBySlug,
  listPurchasesForRaffle,
  resolveTenantSlug,
} from "../../../_lib/raffles-repo";

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
    const raffle = await getAdminRaffleBySlug(tenantSlug, slug);

    if (!raffle) {
      return res.status(404).json({ error: "Raffle not found." });
    }

    const purchases = await listPurchasesForRaffle(tenantSlug, slug);

    return res.status(200).json({
      raffle,
      purchases,
      summary: {
        soldTickets: raffle.soldTickets,
        remainingTickets: raffle.remainingTickets,
        totalTickets: raffle.totalTickets,
        purchaseCount: purchases.length,
      },
    });
  } catch (error) {
    console.error("GET /api/admin/raffles/[slug]/purchases failed", error);
    return res.status(500).json({ error: "Internal server error." });
  }
}
