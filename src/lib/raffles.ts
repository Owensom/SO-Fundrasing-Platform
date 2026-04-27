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
    row?.config_json && typeof row.config_json === "object"
      ? row.config_json
      : {};

  const colours = Array.isArray(rawConfig.colours)
    ? rawConfig.colours
    : [];

  const offers = Array.isArray(rawConfig.offers)
    ? rawConfig.offers
    : [];

  const prizes = Array.isArray(rawConfig.prizes)
    ? rawConfig.prizes
    : [];

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

async function getCurrentConfig(
  id: string,
  tenantSlug: string
): Promise<RaffleConfig> {
  const row = await queryOne<{ config_json: any }>(
    "SELECT config_json FROM raffles WHERE id = $1 AND tenant_slug = $2",
    [id, tenantSlug]
  );

  const rawConfig =
    row?.config_json && typeof row.config_json === "object"
      ? row.config_json
      : {};

  return {
    ...rawConfig,
    colours: Array.isArray(rawConfig.colours)
      ? rawConfig.colours
      : [],
    offers: Array.isArray(rawConfig.offers)
      ? rawConfig.offers
      : [],
    prizes: Array.isArray(rawConfig.prizes)
      ? rawConfig.prizes
      : [],
    image_position: normaliseImagePosition(rawConfig.image_position),
  };
}

async function updateConfigJson(
  id: string,
  tenantSlug: string,
  nextConfig: RaffleConfig
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
    [JSON.stringify(nextConfig), id, tenantSlug]
  );
}

export async function getRaffleById(
  id: string
): Promise<Raffle | null> {
  const row = await queryOne<any>(
    "SELECT * FROM raffles WHERE id = $1",
    [id]
  );

  return row ? normaliseRaffle(row) : null;
}

export async function getRaffleBySlug(
  tenantSlugOrSlug: string,
  maybeSlug?: string
): Promise<Raffle | null> {
  const row = maybeSlug
    ? await queryOne<any>(
        "SELECT * FROM raffles WHERE tenant_slug = $1 AND slug = $2",
        [tenantSlugOrSlug, maybeSlug]
      )
    : await queryOne<any>(
        "SELECT * FROM raffles WHERE slug = $1",
        [tenantSlugOrSlug]
      );

  return row ? normaliseRaffle(row) : null;
}

export async function deleteRaffle(
  id: string,
  tenantSlug: string
): Promise<void> {
  await query(
    "DELETE FROM raffles WHERE id = $1 AND tenant_slug = $2",
    [id, tenantSlug]
  );
}

/**
 * 🔥 CRITICAL FIX: MERGES config_json instead of overwriting
 */
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
  }>
): Promise<Raffle> {
  const existing = await getRaffleById(id);

  if (!existing || existing.tenant_slug !== tenantSlug) {
    throw new Error("Raffle not found");
  }

  const safeFields = { ...fields };

  // ✅ THIS IS THE FIX
  if (safeFields.config_json) {
    safeFields.config_json = {
      ...existing.config_json,
      ...safeFields.config_json,
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
    ([key, value]) =>
      allowed.includes(key as any) && value !== undefined
  );

  if (entries.length === 0) return existing;

  const setClause = entries
    .map(([key], i) =>
      key === "config_json"
        ? `${key} = $${i + 1}::jsonb`
        : `${key} = $${i + 1}`
    )
    .join(", ");

  const values = entries.map(([key, value]) =>
    key === "config_json" ? JSON.stringify(value) : value
  );

  const row = await queryOne<any>(
    `
    UPDATE raffles
    SET ${setClause}, updated_at = NOW()
    WHERE id = $${entries.length + 1}
      AND tenant_slug = $${entries.length + 2}
    RETURNING *
    `,
    [...values, id, tenantSlug]
  );

  if (!row) throw new Error("Raffle not updated");

  return normaliseRaffle(row);
}

/**
 * Dedicated image position updater
 */
export async function updateRaffleImagePosition(
  id: string,
  tenantSlug: string,
  imagePosition: unknown
): Promise<void> {
  const config = await getCurrentConfig(id, tenantSlug);

  await updateConfigJson(id, tenantSlug, {
    ...config,
    image_position: normaliseImagePosition(imagePosition),
  });
}
