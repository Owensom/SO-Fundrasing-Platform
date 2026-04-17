import type { NextApiRequest, NextApiResponse } from "next";
import { getRaffleBySlug } from "../../api/_lib/raffles-repo";

type Offer = {
  id?: string;
  label: string;
  price: number;
  quantity: number;
};

type TicketRef = {
  colour: string;
  number: number;
};

type PublicRaffleResponse = {
  id: string;
  tenantSlug: string;
  slug: string;
  title: string;
  description: string;
  imageUrl: string | null;
  currency: "GBP" | "USD" | "EUR";
  ticketPrice: number;
  totalTickets: number;
  soldTickets: number;
  remainingTickets: number;
  status: "draft" | "published" | "closed";
  createdAt: string;
  updatedAt: string;
  startNumber: number;
  endNumber: number;
  numbersPerColour: number;
  colourCount: number;
  colours: string[];
  offers: Offer[];
  sold: TicketRef[];
  reserved: TicketRef[];
};

function normalizeCurrency(value: unknown): "GBP" | "USD" | "EUR" {
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

function toOffers(value: unknown): Offer[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item, index) => {
      if (!item || typeof item !== "object") return null;

      const offer = item as Record<string, unknown>;
      const label = typeof offer.label === "string" ? offer.label : "";
      const quantity = toNumber(offer.quantity, 0);
      const price = toNumber(offer.price, 0);

      if (!label.trim() || quantity <= 0 || price < 0) return null;

      return {
        id:
          typeof offer.id === "string" && offer.id.trim()
            ? offer.id
            : `offer-${index}`,
        label: label.trim(),
        quantity,
        price,
      };
    })
    .filter((item): item is Offer => Boolean(item));
}

function toTickets(value: unknown): TicketRef[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => {
      if (!item || typeof item !== "object") return null;

      const ticket = item as Record<string, unknown>;
      const colour = typeof ticket.colour === "string" ? ticket.colour : "";
      const number = toNumber(ticket.number, NaN);

      if (!colour || !Number.isFinite(number)) return null;

      return { colour, number };
    })
    .filter((item): item is TicketRef => Boolean(item));
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  try {
    if (req.method !== "GET") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const slug =
      typeof req.query.slug === "string" ? req.query.slug.trim() : "";

    const tenantSlug =
      typeof req.query.tenantSlug === "string"
        ? req.query.tenantSlug
        : "demo-a";

    if (!slug) {
      return res.status(400).json({ error: "Missing slug" });
    }

    const raffle = await getRaffleBySlug(tenantSlug, slug);

    if (!raffle) {
      return res.status(404).json({ error: "Raffle not found" });
    }

    const config =
      raffle && typeof (raffle as any).config_json === "object" && (raffle as any).config_json
        ? ((raffle as any).config_json as Record<string, unknown>)
        : {};

    const startNumber = toNumber(config.startNumber, 1);
    const endNumber = toNumber(config.endNumber, 0);
    const colours = toStringArray(config.colours);
    const offers = toOffers(config.offers);
    const sold = toTickets(config.sold);
    const reserved = toTickets(config.reserved);

    const numbersPerColour =
      endNumber >= startNumber ? endNumber - startNumber + 1 : 0;

    const item: PublicRaffleResponse = {
      id: String((raffle as any).id ?? ""),
      tenantSlug: String((raffle as any).tenant_slug ?? tenantSlug),
      slug: String((raffle as any).slug ?? slug),
      title: String((raffle as any).title ?? ""),
      description: String((raffle as any).description ?? ""),
      imageUrl:
        typeof (raffle as any).image_url === "string"
          ? (raffle as any).image_url
          : null,
      currency: normalizeCurrency((raffle as any).currency),
      ticketPrice: toNumber((raffle as any).ticket_price, 0),
      totalTickets: toNumber((raffle as any).total_tickets, 0),
      soldTickets: toNumber((raffle as any).sold_tickets, 0),
      remainingTickets: toNumber((raffle as any).remaining_tickets, 0),
      status: ((raffle as any).status || "draft") as
        | "draft"
        | "published"
        | "closed",
      createdAt: String((raffle as any).created_at ?? ""),
      updatedAt: String((raffle as any).updated_at ?? ""),
      startNumber,
      endNumber,
      numbersPerColour,
      colourCount: colours.length,
      colours,
      offers,
      sold,
      reserved,
    };

    return res.status(200).json({ item });
  } catch (error: any) {
    return res.status(500).json({
      error: error?.message || "Internal server error",
    });
  }
}
