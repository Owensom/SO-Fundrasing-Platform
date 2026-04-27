import { query, queryOne } from "@/lib/db";

/* =========================
   TYPES
========================= */

export type RaffleCurrency = "GBP" | "EUR" | "USD";
export type RaffleStatus = "draft" | "published" | "closed" | "drawn";

export type RaffleColour = {
  id?: string;
  name: string;
  hex: string;
  sortOrder?: number;
  sort_order?: number;
};

export type RaffleOffer = {
  id?: string;
  label: string;
  price: number;
  quantity?: number;
  tickets?: number;
  isActive?: boolean;
  is_active?: boolean;
  sortOrder?: number;
  sort_order?: number;
};

export type RafflePrize = {
  id?: string;
  name?: string;
  title?: string;
  description?: string;
  isPublic?: boolean;
  is_public?: boolean;
  position?: number;
  sortOrder?: number;
  sort_order?: number;
};

export type RaffleConfig = {
  colours: RaffleColour[];
  offers: RaffleOffer[];
  prizes: RafflePrize[];
  sold?: any[];
  reserved?: any[];
  image_position?: string; // ✅ REQUIRED
  [key: string]: any;
};

export type Raffle = {
  id: string;
  tenant_slug: string;
  title: string;
  slug: string;
  description?: string | null;
  image_url?: string | null;
  ticket_price_cents: number;
  total_tickets: number;
  sold_tickets: number;
  status: RaffleStatus;
  currency: RaffleCurrency;
  config_json: RaffleConfig;
  offers: RaffleOffer[];
  colours: RaffleColour[];
  prizes: RafflePrize[];
};

/* =========================
   HELPERS
========================= */

function normaliseRaffle(row: any): Raffle {
  const rawConfig =
    row?.config_json && typeof row.config_json === "object"
      ? row.config_json
      : {};

  const config: RaffleConfig = {
    colours: Array.isArray(rawConfig.colours) ? rawConfig.colours : [],
    offers: Array.isArray(rawConfig.offers) ? rawConfig.offers : [],
    prizes: Array.isArray(rawConfig.prizes) ? rawConfig.prizes : [],
    image_position: rawConfig.image_position || "center", // ✅ FIX
    ...rawConfig,
  };

  return {
    ...row,
    description: row.description ?? "",
    image_url: row.image_url ?? "",
    currency: (row.currency || "GBP") as RaffleCurrency,
    status: (row.status || "draft") as RaffleStatus,
    config_json: config,
    colours: config.colours,
    offers: config.offers,
    prizes: config.prizes,
  };
}

async function getCurrentConfig(
  id: string,
  tenantSlug: string
): Promise<RaffleConfig> {
  const row = await queryOne<{ config_json: any }>(
    "SELECT config_json FROM raffles WHERE id = $1 AND tenant_slug = $2",
    [id, tenantSlug]
  );

  const raw =
    row?.config_json && typeof row.config_json === "object"
      ? row.config_json
      : {};

  return {
    colours: Array.isArray(raw.colours) ? raw.colours : [],
    offers: Array.isArray(raw.offers) ? raw.offers : [],
    prizes: Array.isArray(raw.prizes) ? raw.prizes : [],
    image_position: raw.image_position || "center", // ✅ FIX
    ...raw,
  };
}

async function updateConfigJson(
  id: string,
  tenantSlug: string,
  nextConfig: RaffleConfig
) {
  await query(
    `UPDATE raffles 
     SET config_json = $1, updated_at = NOW()
     WHERE id = $2 AND tenant_slug = $3`,
    [nextConfig, id, tenantSlug]
  );
}

/* =========================
   CORE
========================= */

export async function getRaffleById(id: string): Promise<Raffle | null> {
  const row = await queryOne<any>(
    "SELECT * FROM raffles WHERE id = $1",
    [id]
  );
  return row ? normaliseRaffle(row) : null;
}

export async function getRaffleBySlug(
  tenantOrSlug: string,
  maybeSlug?: string
): Promise<Raffle | null> {
  const row = maybeSlug
    ? await queryOne<any>(
        "SELECT * FROM raffles WHERE tenant_slug = $1 AND slug = $2",
        [tenantOrSlug, maybeSlug]
      )
    : await queryOne<any>(
        "SELECT * FROM raffles WHERE slug = $1",
        [tenantOrSlug]
      );

  return row ? normaliseRaffle(row) : null;
}

export async function updateRaffle(
  id: string,
  tenantSlug: string,
  fields: Partial<{
    title: string;
    slug: string;
    description: string;
    image_url: string;
    ticket_price_cents: number;
    total_tickets: number;
    sold_tickets: number;
    status: RaffleStatus;
    currency: RaffleCurrency;
  }>
): Promise<Raffle> {
  const keys = Object.keys(fields);
  if (keys.length === 0) {
    const existing = await getRaffleById(id);
    if (!existing) throw new Error("Not found");
    return existing;
  }

  const set = keys.map((k, i) => `${k} = $${i + 1}`).join(", ");
  const values = Object.values(fields);

  const row = await queryOne<any>(
    `UPDATE raffles 
     SET ${set}, updated_at = NOW()
     WHERE id = $${keys.length + 1}
       AND tenant_slug = $${keys.length + 2}
     RETURNING *`,
    [...values, id, tenantSlug]
  );

  if (!row) throw new Error("Update failed");

  return normaliseRaffle(row);
}

/* =========================
   OFFERS
========================= */

export async function updateRaffleOffers(
  id: string,
  tenantSlug: string,
  offers: RaffleOffer[]
) {
  const config = await getCurrentConfig(id, tenantSlug);

  const clean = offers.map((o, i) => ({
    id: o.id || `offer-${i + 1}`,
    label: o.label,
    price: Number(o.price),
    quantity: Number(o.quantity ?? o.tickets ?? 1),
    tickets: Number(o.tickets ?? o.quantity ?? 1),
    isActive: o.isActive ?? o.is_active ?? true,
    is_active: o.is_active ?? o.isActive ?? true,
    sortOrder: i,
    sort_order: i,
  }));

  await updateConfigJson(id, tenantSlug, {
    ...config,
    offers: clean,
  });

  return clean;
}

/* =========================
   COLOURS
========================= */

export async function updateRaffleColours(
  id: string,
  tenantSlug: string,
  colours: RaffleColour[]
) {
  const config = await getCurrentConfig(id, tenantSlug);

  const clean = colours.map((c, i) => ({
    id: c.id || `colour-${i + 1}`,
    name: c.name,
    hex: c.hex,
    sortOrder: i,
    sort_order: i,
  }));

  await updateConfigJson(id, tenantSlug, {
    ...config,
    colours: clean,
  });

  return clean;
}

/* =========================
   IMAGE POSITION (CRITICAL FIX)
========================= */

export async function updateRaffleImagePosition(
  id: string,
  tenantSlug: string,
  position: string
) {
  const config = await getCurrentConfig(id, tenantSlug);

  await updateConfigJson(id, tenantSlug, {
    ...config,
    image_position: position, // ✅ THIS FIXES YOUR ISSUE
  });
}

/* =========================
   PRIZES
========================= */

export async function updateRafflePrizes(
  id: string,
  tenantSlug: string,
  prizes: RafflePrize[]
) {
  const config = await getCurrentConfig(id, tenantSlug);

  const clean = prizes.map((p, i) => ({
    id: p.id || `prize-${i + 1}`,
    title: p.title ?? p.name ?? `Prize ${i + 1}`,
    name: p.name ?? p.title ?? `Prize ${i + 1}`,
    description: p.description ?? "",
    isPublic: p.isPublic ?? p.is_public ?? true,
    is_public: p.is_public ?? p.isPublic ?? true,
    position: p.position ?? i + 1,
    sortOrder: i,
    sort_order: i,
  }));

  await updateConfigJson(id, tenantSlug, {
    ...config,
    prizes: clean,
  });

  return clean;
}

/* =========================
   TICKET MAPPING (REQUIRED)
========================= */

export function mapTickets(tickets: any[], colours?: RaffleColour[]) {
  return tickets.map((ticket) => {
    const match = colours?.find(
      (c) =>
        c.id === ticket.colour_id ||
        c.name === ticket.colour ||
        c.hex === ticket.colour
    );

    return {
      ticket_number: ticket.ticket_number,
      colour: ticket.colour || match?.hex || "#000",
      label: match?.name || ticket.colour || "Unknown",
    };
  });
}
