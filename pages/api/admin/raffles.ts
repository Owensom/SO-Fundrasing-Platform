import type { NextApiRequest, NextApiResponse } from "next";
import {
  createRaffle,
  listRaffles,
  updateRaffle,
} from "../../../api/_lib/raffles-repo";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    const tenantSlug =
      typeof req.query.tenantSlug === "string"
        ? req.query.tenantSlug
        : "demo-a";

    // ✅ GET = LIST (NO ID REQUIRED)
    if (req.method === "GET") {
      const raffles = await listRaffles(tenantSlug);

      return res.status(200).json({
        raffles: raffles.map((item) => ({
          id: item.id,
          slug: item.slug,
          title: item.title,
          description: item.description,
          imageUrl: item.image_url || null,
          ticketPrice: item.ticket_price,
          totalTickets: item.total_tickets,
          soldTickets: item.sold_tickets,
          remainingTickets: item.remaining_tickets,
          status: item.status,
        })),
      });
    }

    // ✅ POST = CREATE
    if (req.method === "POST") {
      const body = req.body ?? {};

      const created = await createRaffle({
        tenant_slug: tenantSlug,
        title: String(body.title || "").trim(),
        slug: String(body.slug || "").trim(),
        description: String(body.description || ""),
        image_url: String(body.imageUrl || ""),
        ticket_price: Number(body.ticketPrice || 0),
        total_tickets: Number(body.totalTickets || 0),
        sold_tickets: 0,
        status: "draft",
      });

      return res.status(201).json({ raffle: created });
    }

    // ✅ PUT = UPDATE (ID REQUIRED HERE ONLY)
    if (req.method === "PUT") {
      const body = req.body ?? {};
      const id = String(body.id || "").trim();

      if (!id) {
        return res.status(400).json({ error: "Missing raffle id" });
      }

      const updated = await updateRaffle(id, {
        tenant_slug: tenantSlug,
        title: String(body.title || "").trim(),
        slug: String(body.slug || "").trim(),
        description: String(body.description || ""),
        image_url: String(body.imageUrl || ""),
        ticket_price: Number(body.ticketPrice || 0),
        total_tickets: Number(body.totalTickets || 0),
        sold_tickets: Number(body.soldTickets || 0),
        status: String(body.status || "draft") as
          | "draft"
          | "published"
          | "closed",
      });

      if (!updated) {
        return res.status(404).json({ error: "Raffle not found" });
      }

      return res.status(200).json({ raffle: updated });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (error: any) {
    return res.status(500).json({
      error: error?.message || "Internal server error",
    });
  }
}
