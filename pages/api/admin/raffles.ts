import type { NextApiRequest, NextApiResponse } from "next";

type RaffleRecord = {
  id: string;
  tenantSlug: string;
  slug: string;
  title: string;
  description: string;
  status: string;
  heroImageUrl: string;
  raffleConfig: {
    singleTicketPriceCents: number;
    totalTickets: number;
    soldTickets: number;
    backgroundImageUrl: string;
    currencyCode: "GBP" | "USD" | "EUR";
    colourSelectionMode: "manual" | "automatic" | "both";
    numberSelectionMode: "none" | "manual" | "automatic" | "both";
    numberRangeStart: number | null;
    numberRangeEnd: number | null;
    colours: Array<{ name: string; hex: string }>;
  };
  createdAt: string;
  updatedAt: string;
};

declare global {
  // eslint-disable-next-line no-var
  var __raffles_store__: RaffleRecord[] | undefined;
}

function getStore(): RaffleRecord[] {
  if (!global.__raffles_store__) {
    global.__raffles_store__ = [];
  }
  return global.__raffles_store__;
}

function mapListItem(raffle: RaffleRecord) {
  const totalTickets = raffle.raffleConfig.totalTickets;
  const soldTickets = raffle.raffleConfig.soldTickets;

  return {
    id: raffle.id,
    tenantSlug: raffle.tenantSlug,
    slug: raffle.slug,
    title: raffle.title,
    description: raffle.description,
    imageUrl: raffle.heroImageUrl || null,
    ticketPrice: raffle.raffleConfig.singleTicketPriceCents / 100,
    totalTickets,
    soldTickets,
    remainingTickets: Math.max(totalTickets - soldTickets, 0),
    isSoldOut: soldTickets >= totalTickets,
    status: raffle.status,
    createdAt: raffle.createdAt,
    updatedAt: raffle.updatedAt,
  };
}

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const store = getStore();

  if (req.method === "GET") {
    const tenantSlug =
      typeof req.query.tenantSlug === "string" ? req.query.tenantSlug : "";

    const raffles = tenantSlug
      ? store.filter((r) => r.tenantSlug === tenantSlug)
      : store;

    return res.status(200).json({
      raffles: raffles.map(mapListItem),
    });
  }

  if (req.method === "POST") {
    const body = req.body ?? {};

    if (!body.title || !String(body.title).trim()) {
      return res.status(400).json({ error: "Title is required" });
    }

    if (!body.slug || !String(body.slug).trim()) {
      return res.status(400).json({ error: "Slug is required" });
    }

    const now = new Date().toISOString();

    const record: RaffleRecord = {
      id: crypto.randomUUID(),
      tenantSlug: String(body.tenantSlug || "demo-a"),
      slug: String(body.slug).trim(),
      title: String(body.title).trim(),
      description: String(body.description || ""),
      status: String(body.status || "published"),
      heroImageUrl: String(body.heroImageUrl || ""),
      raffleConfig: {
        singleTicketPriceCents: Math.round(Number(body.ticketPrice || 0) * 100),
        totalTickets: Number(body.totalTickets || 0),
        soldTickets: Number(body.soldTickets || 0),
        backgroundImageUrl: String(body.backgroundImageUrl || ""),
        currencyCode: body.currencyCode || "GBP",
        colourSelectionMode: body.colourSelectionMode || "both",
        numberSelectionMode: body.numberSelectionMode || "none",
        numberRangeStart:
          body.numberRangeStart == null ? null : Number(body.numberRangeStart),
        numberRangeEnd:
          body.numberRangeEnd == null ? null : Number(body.numberRangeEnd),
        colours: Array.isArray(body.colours) ? body.colours : [],
      },
      createdAt: now,
      updatedAt: now,
    };

    store.push(record);

    return res.status(201).json({
      raffle: record,
    });
  }

  if (req.method === "PUT") {
    const body = req.body ?? {};
    const id = String(body.id || "");

    const index = store.findIndex((r) => r.id === id);
    if (index === -1) {
      return res.status(404).json({ error: "Raffle not found" });
    }

    const existing = store[index];

    const updated: RaffleRecord = {
      ...existing,
      tenantSlug: String(body.tenantSlug || existing.tenantSlug),
      slug: String(body.slug || existing.slug).trim(),
      title: String(body.title || existing.title).trim(),
      description: String(body.description || existing.description),
      status: String(body.status || existing.status),
      heroImageUrl: String(body.heroImageUrl || ""),
      raffleConfig: {
        singleTicketPriceCents: Math.round(
          Number(body.ticketPrice ?? existing.raffleConfig.singleTicketPriceCents / 100) * 100
        ),
        totalTickets: Number(body.totalTickets ?? existing.raffleConfig.totalTickets),
        soldTickets: Number(body.soldTickets ?? existing.raffleConfig.soldTickets),
        backgroundImageUrl: String(
          body.backgroundImageUrl ?? existing.raffleConfig.backgroundImageUrl
        ),
        currencyCode: body.currencyCode || existing.raffleConfig.currencyCode,
        colourSelectionMode:
          body.colourSelectionMode || existing.raffleConfig.colourSelectionMode,
        numberSelectionMode:
          body.numberSelectionMode || existing.raffleConfig.numberSelectionMode,
        numberRangeStart:
          body.numberRangeStart == null
            ? null
            : Number(body.numberRangeStart),
        numberRangeEnd:
          body.numberRangeEnd == null
            ? null
            : Number(body.numberRangeEnd),
        colours: Array.isArray(body.colours)
          ? body.colours
          : existing.raffleConfig.colours,
      },
      updatedAt: new Date().toISOString(),
    };

    store[index] = updated;

    return res.status(200).json({
      raffle: updated,
    });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
