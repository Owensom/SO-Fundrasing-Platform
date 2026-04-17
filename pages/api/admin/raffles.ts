import type { NextApiRequest, NextApiResponse } from "next";
import {
  createRaffle,
  listRaffles,
  updateRaffle,
} from "../../../api/_lib/raffles-repo";

type RaffleStatus = "draft" | "published" | "closed";
type CurrencyCode = "GBP" | "USD" | "EUR";

function normalizeCurrency(value: unknown): CurrencyCode {
  if (value === "USD" || value === "EUR") return value;
  return "GBP";
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    if (req.method === "GET") {
      const tenantSlug =
        typeof req.query.tenantSlug === "string" ? req.query.tenantSlug : "demo-a";

      const raffles = await listRaffles(tenantSlug);

      return res.status(200).json({
        raffles: raffles.map((item) => ({
          id: item.id,
          tenantSlug: item.tenant_slug,
          slug: item.slug,
          title: item.title,
          description: item.description,
          imageUrl: item.image_url || null,
          currency: normalizeCurrency((item as any).currency),
          ticketPrice: item.ticket_price,
          totalTickets: item.total_tickets,
          soldTickets: item.sold_tickets,
          remainingTickets: item.remaining_tickets,
          isSoldOut: item.remaining_tickets <= 0,
          status: item.status,
          createdAt: item.created_at,
          updatedAt: item.updated_at,
        })),
      });
    }

    if (req.method === "POST") {
      const body = req.body ?? {};

      const created = await createRaffle({
        tenant_slug: String(body.tenantSlug || "demo-a"),
        title: String(body.title || "").trim(),
        slug: String(body.slug || "").trim(),
        description: String(body.description || ""),
        image_url: String(body.heroImageUrl || body.imageUrl || ""),
        currency: normalizeCurrency(body.currency),
        ticket_price: Number(body.ticketPrice || 0),
        total_tickets: Number(body.totalTickets || 0),
        sold_tickets: Number(body.soldTickets || 0),
        status: String(body.status || "published") as RaffleStatus,
      } as any);

      return res.status(201).json({
        raffle: {
          ...created,
          currency: normalizeCurrency((created as any).currency ?? body.currency),
        },
      });
    }

    if (req.method === "PUT") {
      const body = req.body ?? {};
      const id = String(body.id || "").trim();

      if (!id) {
        return res.status(400).json({ error: "Missing raffle id" });
      }

      const updated = await updateRaffle(
        id,
        {
          tenant_slug: String(body.tenantSlug || "demo-a"),
          title: String(body.title || "").trim(),
          slug: String(body.slug || "").trim(),
          description: String(body.description || ""),
          image_url: String(body.heroImageUrl || body.imageUrl || ""),
          currency: normalizeCurrency(body.currency),
          ticket_price: Number(body.ticketPrice || 0),
          total_tickets: Number(body.totalTickets || 0),
          sold_tickets: Number(body.soldTickets || 0),
          status: String(body.status || "published") as RaffleStatus,
        } as any
      );

      if (!updated) {
        return res.status(404).json({ error: "Raffle not found" });
      }

      return res.status(200).json({
        raffle: {
          ...updated,
          currency: normalizeCurrency((updated as any).currency ?? body.currency),
        },
      });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (error: any) {
    return res.status(500).json({
      error: error?.message || "Internal server error",
    });
  }
}
