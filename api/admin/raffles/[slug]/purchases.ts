import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  getAdminRaffleBySlug,
  listPurchasesForRaffle,
} from "../../../_lib/raffles-repo";
import { resolveTenantSlug } from "../../../_lib/tenant";

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
    const slug = req.query.slug;

    if (typeof slug !== "string" || !slug.trim()) {
      return res.status(400).json({ error: "Invalid raffle slug." });
    }

    const raffle = await getAdminRaffleBySlug(tenantSlug, slug);

    if (!raffle) {
      return res.status(404).json({ error: "Raffle not found." });
    }

    const purchases = await listPurchasesForRaffle(tenantSlug, slug);

    const soldTickets = purchases.reduce(
      (total, purchase) =>
        purchase.paymentStatus === "paid" ? total + purchase.quantity : total,
      0
    );

    const summary = {
      totalTickets: raffle.totalTickets,
      soldTickets,
      remainingTickets: Math.max(raffle.totalTickets - soldTickets, 0),
      purchaseCount: purchases.length,
    };

    return res.status(200).json({
      raffle,
      purchases,
      summary,
    });
  } catch (error) {
    console.error("GET /api/admin/raffles/[slug]/purchases failed", error);

    return res.status(500).json({
      error: error instanceof Error ? error.message : "Internal server error.",
    });
  }
}
