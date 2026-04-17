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

function toNumber(value: unknown, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

function normalizeOffers(value: unknown) {
  if (!Array.isArray(value)) return [];

  return value
    .map((item, index) => {
      if (!item || typeof item !== "object") return null;

      const offer = item as Record<string, unknown>;
      const label = typeof offer.label === "string" ? offer.label.trim() : "";
      const quantity = toNumber(offer.quantity ?? offer.tickets, 0);
      const price = toNumber(offer.price, 0);

      if (!label || quantity <= 0 || price < 0) return null;

      return {
        id:
          typeof offer.id === "string" && offer.id.trim()
            ? offer.id
            : `offer-${index}`,
        label,
        quantity,
        tickets: quantity,
        price,
        is_active:
          typeof offer.is_active === "boolean" ? offer.is_active : true,
        sort_order: toNumber(offer.sort_order, index),
      };
    })
    .filter(
      (
        item,
      ): item is {
        id: string;
        label: string;
        quantity: number;
        tickets: number;
        price: number;
        is_active: boolean;
        sort_order: number;
      } => item !== null,
    );
}

function normalizeTickets(value: unknown) {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => {
      if (!item || typeof item !== "object") return null;

      const ticket = item as Record<string, unknown>;
      const colour =
        typeof ticket.colour === "string" ? ticket.colour.trim() : "";
      const number = toNumber(ticket.number, NaN);

      if (!colour || !Number.isFinite(number)) return null;

      return { colour, number };
    })
    .filter(
      (item): item is { colour: string; number: number } => item !== null,
    );
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  try {
    const tenantSlug =
      typeof req.query.tenantSlug === "string"
        ? req.query.tenantSlug
        : typeof req.body?.tenantSlug === "string"
          ? req.body.tenantSlug
          : "demo-a";

    if (req.method === "GET") {
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
          status: item.status,
          config: (item as any).config_json || {},
          createdAt: item.created_at,
          updatedAt: item.updated_at,
        })),
      });
    }

    if (req.method === "POST") {
      const body = req.body ?? {};

      const created = await createRaffle({
        tenant_slug: tenantSlug,
        title: String(body.title || "").trim(),
        slug: String(body.slug || "").trim(),
        description: String(body.description || ""),
        image_url: String(body.imageUrl || body.heroImageUrl || ""),
        currency: normalizeCurrency(body.currency),
        ticket_price: toNumber(body.ticketPrice, 0),
        total_tickets: toNumber(body.totalTickets, 0),
        sold_tickets: toNumber(body.soldTickets, 0),
        status: String(body.status || "draft") as RaffleStatus,

        startNumber: toNumber(body.startNumber, 0),
        endNumber: toNumber(body.endNumber, 0),
        numbersPerColour: toNumber(body.numbersPerColour, 0),
        colourCount: toNumber(body.colourCount, 0),
        colours: toStringArray(body.colours),
        offers: normalizeOffers(body.offers),
        sold: normalizeTickets(body.sold),
        reserved: normalizeTickets(body.reserved),
      });

      return res.status(201).json({ raffle: created });
    }

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
        image_url: String(body.imageUrl || body.heroImageUrl || ""),
        currency: normalizeCurrency(body.currency),
        ticket_price: toNumber(body.ticketPrice, 0),
        total_tickets: toNumber(body.totalTickets, 0),
        sold_tickets: toNumber(body.soldTickets, 0),
        status: String(body.status || "draft") as RaffleStatus,

        startNumber: toNumber(body.startNumber, 0),
        endNumber: toNumber(body.endNumber, 0),
        numbersPerColour: toNumber(body.numbersPerColour, 0),
        colourCount: toNumber(body.colourCount, 0),
        colours: toStringArray(body.colours),
        offers: normalizeOffers(body.offers),
        sold: normalizeTickets(body.sold),
        reserved: normalizeTickets(body.reserved),
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
