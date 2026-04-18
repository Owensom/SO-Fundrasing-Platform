import type { NextApiRequest, NextApiResponse } from "next";
import { db } from "../../../../src/server/db";

type RawColour =
  | string
  | {
      id?: string;
      name?: string;
      label?: string;
      value?: string;
      hex?: string | null;
      sortOrder?: number;
    };

type RawOffer = {
  id?: string;
  label?: string;
  quantity?: number;
  price?: number;
  priceCents?: number;
  isActive?: boolean;
  sortOrder?: number;
};

type ConfigJson = {
  startNumber?: number;
  endNumber?: number;
  colours?: RawColour[];
  offers?: RawOffer[];
};

async function tableExists(tableName: string) {
  const result = await db.query(
    `
    select exists (
      select 1
      from information_schema.tables
      where table_schema = 'public'
        and table_name = $1
    ) as exists
    `,
    [tableName],
  );

  return Boolean(result.rows[0]?.exists);
}

function titleCase(value: string) {
  return value
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function normaliseHex(value?: string | null) {
  if (!value) return null;
  const hex = String(value).trim().toLowerCase();
  return /^#?[0-9a-f]{6}$/i.test(hex) ? (hex.startsWith("#") ? hex : `#${hex}`) : null;
}

function nameFromHex(hex?: string | null) {
  const value = normaliseHex(hex);
  if (!value) return null;

  const known: Record<string, string> = {
    "#dc2626": "Red",
    "#ef4444": "Red",
    "#b91c1c": "Red",
    "#2563eb": "Blue",
    "#3b82f6": "Blue",
    "#1d4ed8": "Blue",
    "#16a34a": "Green",
    "#22c55e": "Green",
    "#15803d": "Green",
    "#eab308": "Yellow",
    "#facc15": "Yellow",
    "#ca8a04": "Yellow",
    "#f97316": "Orange",
    "#ea580c": "Orange",
    "#fb923c": "Orange",
    "#9333ea": "Purple",
    "#a855f7": "Purple",
    "#7e22ce": "Purple",
    "#ec4899": "Pink",
    "#db2777": "Pink",
    "#f472b6": "Pink",
    "#111827": "Black",
    "#000000": "Black",
    "#ffffff": "White",
    "#f8fafc": "White",
    "#e5e7eb": "Grey",
    "#9ca3af": "Grey",
    "#6b7280": "Grey",
  };

  return known[value] ?? null;
}

function deriveDisplayColourName(colour: RawColour, index: number) {
  if (typeof colour === "string") {
    const asHexName = nameFromHex(colour);
    if (asHexName) return asHexName;
    return titleCase(colour);
  }

  const explicit = colour?.name || colour?.label || colour?.value;

  if (explicit && !/^#?[0-9a-f]{6}$/i.test(String(explicit).trim())) {
    return titleCase(String(explicit));
  }

  const fromId = colour?.id ? titleCase(String(colour.id)) : null;
  const fromHex = nameFromHex(colour?.hex ?? (typeof explicit === "string" ? explicit : null));

  return fromHex || fromId || `Colour ${index + 1}`;
}

function deriveColourId(colour: RawColour, index: number) {
  if (typeof colour === "string") {
    const hex = normaliseHex(colour);
    return hex ?? colour;
  }

  return (
    colour?.id ??
    normaliseHex(colour?.hex ?? null) ??
    colour?.value ??
    colour?.name ??
    `colour-${index}`
  );
}

function deriveColourHex(colour: RawColour) {
  if (typeof colour === "string") {
    return normaliseHex(colour);
  }

  return normaliseHex(colour?.hex ?? null) ?? normaliseHex(colour?.value ?? null);
}

function normaliseColour(colour: RawColour, index: number) {
  return {
    id: String(deriveColourId(colour, index)),
    name: deriveDisplayColourName(colour, index),
    hex: deriveColourHex(colour),
    sortOrder:
      typeof colour === "string"
        ? index
        : Number(colour?.sortOrder ?? index),
  };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const slugParam = req.query.slug;
  const slug = Array.isArray(slugParam) ? slugParam[0] : slugParam;

  if (!slug) {
    return res.status(400).json({ error: "Missing slug" });
  }

  try {
    const raffleResult = await db.query(
      `
      select
        r.id::text,
        r.slug,
        r.title,
        r.description,
        r.image_url,
        r.ticket_price_cents,
        r.currency,
        r.status,
        r.config_json
      from raffles r
      where r.slug = $1
      limit 1
      `,
      [slug],
    );

    if (raffleResult.rowCount === 0) {
      return res.status(404).json({ error: "Raffle not found" });
    }

    const raffle = raffleResult.rows[0];
    const config = (raffle.config_json ?? {}) as ConfigJson;

    const startNumber = Number(config.startNumber ?? 1);
    const endNumber = Number(config.endNumber ?? 1);

    const colours = Array.isArray(config.colours)
      ? config.colours.map((colour, index) => normaliseColour(colour, index))
      : [];

    const offers = Array.isArray(config.offers)
      ? config.offers.map((offer, index) => ({
          id: offer.id ?? `${raffle.id}-offer-${index}`,
          label: String(offer.label ?? `Offer ${index + 1}`),
          quantity: Number(offer.quantity ?? 0),
          price:
            typeof offer.price === "number"
              ? offer.price
              : Number((offer.priceCents ?? 0) / 100),
          isActive: Boolean(offer.isActive ?? true),
          sortOrder: Number(offer.sortOrder ?? index),
        }))
      : [];

    let reservedTickets: Array<{ colour: string; number: number }> = [];
    let soldTickets: Array<{ colour: string; number: number }> = [];

    const hasReservationsTable = await tableExists("raffle_ticket_reservations");
    const hasSalesTable = await tableExists("raffle_ticket_sales");

    if (hasReservationsTable) {
      const reservedResult = await db.query(
        `
        select
          colour,
          ticket_number
        from raffle_ticket_reservations
        where raffle_id = $1
          and expires_at > now()
        `,
        [raffle.id],
      );

      reservedTickets = reservedResult.rows.map((row) => ({
        colour: String(row.colour),
        number: Number(row.ticket_number),
      }));
    }

    if (hasSalesTable) {
      const soldResult = await db.query(
        `
        select
          colour,
          ticket_number
        from raffle_ticket_sales
        where raffle_id = $1
        `,
        [raffle.id],
      );

      soldTickets = soldResult.rows.map((row) => ({
        colour: String(row.colour),
        number: Number(row.ticket_number),
      }));
    }

    const status = String(raffle.status ?? "").toLowerCase();
    const isPublicStatus =
      status === "active" ||
      status === "published" ||
      status === "completed";

    return res.status(200).json({
      ok: true,
      raffle: {
        id: raffle.id,
        slug: raffle.slug,
        title: raffle.title,
        description: raffle.description ?? null,
        imageUrl: raffle.image_url ?? null,
        image_url: raffle.image_url ?? null,
        startNumber,
        endNumber,
        currency: raffle.currency,
        ticketPrice: Number(raffle.ticket_price_cents ?? 0) / 100,
        status,
        isActive: isPublicStatus,
        is_active: isPublicStatus,
        colours,
        offers,
        reservedTickets,
        soldTickets,
      },
    });
  } catch (error) {
    console.error("GET /api/public/raffles/[slug] failed", error);

    return res.status(500).json({
      error: "Internal server error",
      details: error instanceof Error ? error.message : String(error),
    });
  }
}
