import type { NextApiRequest, NextApiResponse } from "next";
import { getRaffleById } from "../../../api/_lib/raffles-repo";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    if (req.method !== "GET") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const id = typeof req.query.id === "string" ? req.query.id : "";

    if (!id) {
      return res.status(400).json({ error: "Missing raffle id" });
    }

    const raffle = await getRaffleById(id);

    if (!raffle) {
      return res.status(404).json({ error: "Raffle not found" });
    }

    return res.status(200).json({
      raffle: {
        id: raffle.id,
        title: raffle.title,
        slug: raffle.slug,
        description: raffle.description,
        status: raffle.is_active ? "published" : "draft",
        heroImageUrl: raffle.image_url || "",
        raffleConfig: {
          singleTicketPriceCents: Math.round((raffle.ticket_price ?? 0) * 100),
          totalTickets: raffle.max_tickets ?? 0,
          soldTickets: 0,
          backgroundImageUrl: "",
          currencyCode: "GBP",
          colourSelectionMode: "both",
          numberSelectionMode: "none",
          numberRangeStart: null,
          numberRangeEnd: null,
          colours: (raffle.available_colours || []).map((name) => ({
            name,
            hex: "#3B82F6",
          })),
        },
        offers: raffle.offers.map((offer) => ({
          id: offer.id,
          name: offer.label,
          priceCents: Math.round(offer.price * 100),
          entryCount: offer.tickets,
          sortOrder: offer.sort_order,
          isActive: offer.is_active,
        })),
      },
    });
  } catch (error: any) {
    return res.status(500).json({
      error: error?.message || "Internal server error",
    });
  }
}
