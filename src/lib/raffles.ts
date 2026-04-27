import { query, queryOne } from "@/lib/db";

export type RaffleCurrency = "GBP" | "EUR" | "USD";
export type RaffleStatus = "draft" | "published" | "closed" | "drawn";
export type ImagePosition = "center" | "top" | "bottom" | "left" | "right";

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
  image_position?: ImagePosition;
  sold?: any[];
  reserved?: any[];
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

function normaliseImagePosition(value: unknown): ImagePosition {
  const clean = String(value ?? "").trim().toLowerCase();

  if (
    clean === "center" ||
    clean === "top" ||
    clean === "bottom" ||
    clean === "left" ||
    clean === "right"
  ) {
    return clean;
  }

  return "center";
}

function normaliseRaffle(row: any): Raffle {
  const rawConfig =
    row?.config_json && typeof row.config_json === "object" ? row.config_json : {};

  const colours = Array.isArray(rawConfig.colours) ? rawConfig.colours : [];
  const offers = Array.isArray(rawConfig.offers) ? rawConfig.offers : [];
  const prizes = Array.isArray(rawConfig.prizes) ? rawConfig.prizes : [];

  const config: RaffleConfig = {
    ...rawConfig,
    colours,
    offers,
    prizes,
    image_position: normaliseImagePosition(rawConfig.image_position),
  };

  return {
    ...row,
    description: row.description ?? "",
    image_url: row.image_url ?? "",
    currency: (row.currency || "GBP") as RaffleCurrency,
    status: (row.status || "draft") as RaffleStatus,
    config_json: config,
    colours,
    offers,
    prizes,
  };
}

async function getCurrentConfig(id: string, tenantSlug: string): Promise<RaffleConfig> {
  const row = await queryOne<{ config_json: any }>(
    "SELECT config_json FROM raffles WHERE id = $1 AND tenant_slug = $2",
    [id, tenantSlug],
  );

  const rawConfig =
    row?.config_json && typeof row.config_json === "object" ? row.config_json : {};

  return {
    ...rawConfig,
    colours: Array.isArray(rawConfig.colours) ? rawConfig.colours : [],
    offers: Array.isArray(rawConfig.offers) ? rawConfig.offers : [],
    prizes: Array.isArray(rawConfig.prizes) ? rawConfig.prizes : [],
    image_position: normaliseImagePosition(rawConfig.image_position),
  };
}

async function updateConfigJson(
  id: string,
  tenantSlug: string,
  nextConfig: RaffleConfig,
): Promise<void> {
  await query(
    `
    UPDATE raffles
    SET
      config_json = $1::jsonb,
      updated_at = NOW()
    WHERE id = $2
      AND tenant_slug = $3
    `,
    [JSON.stringify(nextConfig), id, tenantSlug],
  );
}

export async function getRaffleById(id: string): Promise<Raffle | null> {
  const row = await queryOne<any>("SELECT * FROM raffles WHERE id = $1", [id]);
  return row ? normaliseRaffle(row) : null;
}

export async function getRaffleBySlug(
  tenantSlugOrSlug: string,
  maybeSlug?: string,
): Promise<Raffle | null> {
  const row = maybeSlug
    ? await queryOne<any>(
        "SELECT * FROM raffles WHERE tenant_slug = $1 AND slug = $2",
        [tenantSlugOrSlug, maybeSlug],
      )
    : await queryOne<any>("SELECT * FROM raffles WHERE slug = $1", [
        tenantSlugOrSlug,
      ]);

  return row ? normaliseRaffle(row) : null;
}

export async function deleteRaffle(id: string, tenantSlug: string): Promise<void> {
  await query("DELETE FROM raffles WHERE id = $1 AND tenant_slug = $2", [
    id,
    tenantSlug,
  ]);
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
    config_json: RaffleConfig;
  }>,
): Promise<Raffle> {
  const existing = await getRaffleById(id);

  if (!existing || existing.tenant_slug !== tenantSlug) {
    throw new Error("Raffle not found");
  }

  const safeFields = { ...fields };

  if (safeFields.config_json) {
    safeFields.config_json = {
      ...existing.config_json,
      ...safeFields.config_json,
      colours: Array.isArray(safeFields.config_json.colours)
        ? safeFields.config_json.colours
        : existing.config_json.colours,
      offers: Array.isArray(safeFields.config_json.offers)
        ? safeFields.config_json.offers
        : existing.config_json.offers,
      prizes: Array.isArray(safeFields.config_json.prizes)
        ? safeFields.config_json.prizes
        : existing.config_json.prizes,
      image_position: normaliseImagePosition(
        safeFields.config_json.image_position ??
          existing.config_json.image_position,
      ),
    };
  }

  const allowed = [
    "title",
    "slug",
    "description",
    "image_url",
    "ticket_price_cents",
    "total_tickets",
    "sold_tickets",
    "status",
    "currency",
    "config_json",
  ] as const;

  const entries = Object.entries(safeFields).filter(
    ([key, value]) => allowed.includes(key as any) && value !== undefined,
  );

  if (entries.length === 0) {
    return existing;
  }

  const setClause = entries
    .map(([key], index) =>
      key === "config_json"
        ? `${key} = $${index + 1}::jsonb`
        : `${key} = $${index + 1}`,
    )
    .join(", ");

  const values = entries.map(([key, value]) =>
    key === "config_json" ? JSON.stringify(value) : value,
  );

  const row = await queryOne<any>(
    `UPDATE raffles
     SET ${setClause}, updated_at = NOW()
     WHERE id = $${entries.length + 1}
       AND tenant_slug = $${entries.length + 2}
     RETURNING *`,
    [...values, id, tenantSlug],
  );

  if (!row) throw new Error("Raffle not found or not updated");

  return normaliseRaffle(row);
}

export async function updateRaffleImagePosition(
  id: string,
  tenantSlug: string,
  imagePosition: unknown,
): Promise<ImagePosition> {
  const config = await getCurrentConfig(id, tenantSlug);
  const nextImagePosition = normaliseImagePosition(imagePosition);

  await updateConfigJson(id, tenantSlug, {
    ...config,
    image_position: nextImagePosition,
  });

  return nextImagePosition;
}

export async function updateRaffleOffers(
  id: string,
  tenantSlug: string,
  offers: RaffleOffer[],
): Promise<RaffleOffer[]> {
  const config = await getCurrentConfig(id, tenantSlug);

  const normalisedOffers = offers.map((offer, index) => ({
    id: offer.id || `offer-${index + 1}`,
    label: offer.label,
    price: Number(offer.price || 0),
    quantity: Number(offer.quantity ?? offer.tickets ?? 1),
    tickets: Number(offer.tickets ?? offer.quantity ?? 1),
    isActive: offer.isActive ?? offer.is_active ?? true,
    is_active: offer.is_active ?? offer.isActive ?? true,
    sortOrder: offer.sortOrder ?? offer.sort_order ?? index,
    sort_order: offer.sort_order ?? offer.sortOrder ?? index,
  }));

  await updateConfigJson(id, tenantSlug, {
    ...config,
    offers: normalisedOffers,
  });

  return normalisedOffers;
}

export async function updateRaffleColours(
  id: string,
  tenantSlug: string,
  colours: RaffleColour[],
): Promise<RaffleColour[]> {
  const config = await getCurrentConfig(id, tenantSlug);

  const normalisedColours = colours.map((colour, index) => ({
    id: colour.id || `colour-${index + 1}`,
    name: colour.name,
    hex: colour.hex,
    sortOrder: colour.sortOrder ?? colour.sort_order ?? index,
    sort_order: colour.sort_order ?? colour.sortOrder ?? index,
  }));

  await updateConfigJson(id, tenantSlug, {
    ...config,
    colours: normalisedColours,
  });

  return normalisedColours;
}

export async function updateRafflePrizes(
  id: string,
  tenantSlug: string,
  prizes: RafflePrize[],
): Promise<RafflePrize[]> {
  const config = await getCurrentConfig(id, tenantSlug);

  const normalisedPrizes = prizes.map((prize, index) => ({
    id: prize.id || `prize-${index + 1}`,
    title: prize.title ?? prize.name ?? `Prize ${index + 1}`,
    name: prize.name ?? prize.title ?? `Prize ${index + 1}`,
    description: prize.description ?? "",
    isPublic: prize.isPublic ?? prize.is_public ?? true,
    is_public: prize.is_public ?? prize.isPublic ?? true,
    position: prize.position ?? index + 1,
    sortOrder: prize.sortOrder ?? prize.sort_order ?? index,
    sort_order: prize.sort_order ?? prize.sortOrder ?? index,
  }));

  await updateConfigJson(id, tenantSlug, {
    ...config,
    prizes: normalisedPrizes,
  });

  return normalisedPrizes;
}

export function mapTickets(tickets: any[], colours?: RaffleColour[]): any[] {
  return tickets.map((ticket) => {
    const colourMatch = colours?.find((colour) => {
      return (
        colour.id === ticket.colour_id ||
        colour.hex === ticket.colour ||
        colour.name === ticket.colour
      );
    });

    return {
      ticket_number: ticket.ticket_number,
      colour: ticket.colour || colourMatch?.hex || "#000000",
      label: colourMatch?.name || ticket.label || ticket.colour || "Unknown",
    };
  });
}
