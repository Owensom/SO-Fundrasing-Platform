import type { NextApiRequest, NextApiResponse } from "next";

declare global {
  // eslint-disable-next-line no-var
  var __raffles_store__:
    | Array<{
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
      }>
    | undefined;
}

function getStore() {
  if (!global.__raffles_store__) {
    global.__raffles_store__ = [];
  }
  return global.__raffles_store__;
}

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const id = typeof req.query.id === "string" ? req.query.id : "";
  if (!id) {
    return res.status(400).json({ error: "Missing raffle id" });
  }

  const store = getStore();
  const raffle = store.find((r) => r.id === id);

  if (!raffle) {
    return res.status(404).json({ error: "Raffle not found" });
  }

  return res.status(200).json({ raffle });
}
