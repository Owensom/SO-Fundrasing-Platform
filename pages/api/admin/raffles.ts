import type { NextApiRequest, NextApiResponse } from "next";
import {
  createRaffle,
  listRaffles,
  updateRaffle,
  type CreateRaffleInput,
  type UpdateRaffleInput,
} from "../../../api/_lib/raffles-repo";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    if (req.method === "GET") {
      const items = await listRaffles();

      const raffles = items.map((item) => ({
        id: item.id,
        tenantSlug: "demo-a",
        slug: item.slug,
        title: item.title,
        description: item.description,
        imageUrl: item.image_url || null,
        ticketPrice: item.ticket_price ?? 0,
        totalTickets: item.max_tickets ?? 0,
        soldTickets: 0,
        remainingTickets: item.max_tickets ?? 0,
        isSoldOut: false,
        status: item.is_active ? "published" : "draft",
        createdAt: item.created_at,
        updatedAt: item.created_at,
      }));

      return res.status(200).json({ raffles });
    }

    if (req.method === "POST") {
      const body = req.body ?? {};

      const input: CreateRaffleInput = {
        title: String(body.title || "").trim(),
        slug: String(body.slug || "").trim(),
        description: String(body.description || ""),
        image_url: String(body.heroImageUrl || body.imageUrl || ""),
        draw_at: null,
        ticket_price:
          body.ticketPrice == null ? null : Number(body.ticketPrice),
        max_tickets:
          body.totalTickets == null ? null : Number(body.totalTickets),
        is_active:
          String(body.status || "published") === "published" ||
          body.is_active === true,
        available_colours: Array.isArray(body.colours)
          ? body.colours.map((c: any) => String(c.name || c).trim()).filter(Boolean)
          : Array.isArray(body.available_colours)
          ? body.available_colours.map((c: any) => String(c).trim()).filter(Boolean)
          : [],
        offers: Array.isArray(body.offers)
          ? body.offers.map((offer: any, index: number) => ({
              label: String(offer.label || offer.name || "").trim(),
              price:
                offer.price != null
                  ? Number(offer.price)
                  : Number(offer.priceCents || 0) / 100,
              tickets:
                offer.tickets != null
                  ? Number(offer.tickets)
                  : Number(offer.entryCount || 0),
              is_active:
                offer.is_active != null
                  ? Boolean(offer.is_active)
                  : Boolean(offer.isActive ?? true),
              sort_order:
                offer.sort_order != null
                  ? Number(offer.sort_order)
                  : offer.sortOrder != null
                  ? Number(offer.sortOrder)
                  : index,
            }))
          : [],
      };

      if (!input.title) {
        return res.status(400).json({ error: "Title is required" });
      }

      if (!input.slug) {
        return res.status(400).json({ error: "Slug is required" });
      }

      const created = await createRaffle(input);

      return res.status(201).json({
        raffle: {
          id: created.id,
          title: created.title,
          slug: created.slug,
          description: created.description,
          status: created.is_active ? "published" : "draft",
          heroImageUrl: created.image_url || "",
          raffleConfig: {
            singleTicketPriceCents: Math.round((created.ticket_price ?? 0) * 100),
            totalTickets: created.max_tickets ?? 0,
            soldTickets: 0,
            backgroundImageUrl: "",
            currencyCode: "GBP",
            colourSelectionMode: "both",
            numberSelectionMode: "none",
            numberRangeStart: null,
            numberRangeEnd: null,
            colours: (created.available_colours || []).map((name) => ({
              name,
              hex: "#3B82F6",
            })),
          },
          offers: created.offers.map((offer) => ({
            id: offer.id,
            name: offer.label,
            priceCents: Math.round(offer.price * 100),
            entryCount: offer.tickets,
            sortOrder: offer.sort_order,
            isActive: offer.is_active,
          })),
        },
      });
    }

    if (req.method === "PUT") {
      const body = req.body ?? {};
      const id = String(body.id || "").trim();

      if (!id) {
        return res.status(400).json({ error: "Missing raffle id" });
      }

      const input: UpdateRaffleInput = {
        title: String(body.title || "").trim(),
        slug: String(body.slug || "").trim(),
        description: String(body.description || ""),
        image_url: String(body.heroImageUrl || body.imageUrl || ""),
        draw_at: null,
        ticket_price:
          body.ticketPrice == null ? null : Number(body.ticketPrice),
        max_tickets:
          body.totalTickets == null ? null : Number(body.totalTickets),
        is_active:
          String(body.status || "published") === "published" ||
          body.is_active === true,
        available_colours: Array.isArray(body.colours)
          ? body.colours.map((c: any) => String(c.name || c).trim()).filter(Boolean)
          : Array.isArray(body.available_colours)
          ? body.available_colours.map((c: any) => String(c).trim()).filter(Boolean)
          : [],
        offers: Array.isArray(body.offers)
          ? body.offers.map((offer: any, index: number) => ({
              label: String(offer.label || offer.name || "").trim(),
              price:
                offer.price != null
                  ? Number(offer.price)
                  : Number(offer.priceCents || 0) / 100,
              tickets:
                offer.tickets != null
                  ? Number(offer.tickets)
                  : Number(offer.entryCount || 0),
              is_active:
                offer.is_active != null
                  ? Boolean(offer.is_active)
                  : Boolean(offer.isActive ?? true),
              sort_order:
                offer.sort_order != null
                  ? Number(offer.sort_order)
                  : offer.sortOrder != null
                  ? Number(offer.sortOrder)
                  : index,
            }))
          : [],
      };

      if (!input.title) {
        return res.status(400).json({ error: "Title is required" });
      }

      if (!input.slug) {
        return res.status(400).json({ error: "Slug is required" });
      }

      const updated = await updateRaffle(id, input);

      if (!updated) {
        return res.status(404).json({ error: "Raffle not found" });
      }

      return res.status(200).json({
        raffle: {
          id: updated.id,
          title: updated.title,
          slug: updated.slug,
          description: updated.description,
          status: updated.is_active ? "published" : "draft",
          heroImageUrl: updated.image_url || "",
          raffleConfig: {
            singleTicketPriceCents: Math.round((updated.ticket_price ?? 0) * 100),
            totalTickets: updated.max_tickets ?? 0,
            soldTickets: 0,
            backgroundImageUrl: "",
            currencyCode: "GBP",
            colourSelectionMode: "both",
            numberSelectionMode: "none",
            numberRangeStart: null,
            numberRangeEnd: null,
            colours: (updated.available_colours || []).map((name) => ({
              name,
              hex: "#3B82F6",
            })),
          },
          offers: updated.offers.map((offer) => ({
            id: offer.id,
            name: offer.label,
            priceCents: Math.round(offer.price * 100),
            entryCount: offer.tickets,
            sortOrder: offer.sort_order,
            isActive: offer.is_active,
          })),
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
