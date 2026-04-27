import { query } from "@/lib/db";

/* =========================
   TYPES
========================= */

export type RaffleConfig = {
  startNumber?: number;
  endNumber?: number;
  numbersPerColour?: number;
  colourCount?: number;
  colours?: string[];

  offers?: any[];

  // ✅ ADDED
  prizes?: Array<{
    id?: string;
    title?: string;
    name?: string;
    description?: string;
    isPublic?: boolean;
    is_public?: boolean;
    position?: number;
    sortOrder?: number;
    sort_order?: number;
  }>;

  sold?: any[];
  reserved?: any[];
};

export type CreateRaffleInput = {
  tenant_slug: string;
  title: string;
  slug: string;
  description?: string;
  image_url?: string;
  currency: "GBP" | "EUR" | "USD";
  ticket_price: number;
  total_tickets: number;
  sold_tickets: number;
  status: "draft" | "published" | "closed" | "drawn";

  startNumber?: number;
  endNumber?: number;
  numbersPerColour?: number;
  colourCount?: number;

  colours?: string[];
  offers?: any[];

  // ✅ ADDED
  prizes?: Array<{
    id?: string;
    title?: string;
    name?: string;
    description?: string;
    isPublic?: boolean;
    is_public?: boolean;
    position?: number;
    sortOrder?: number;
    sort_order?: number;
  }>;

  sold?: any[];
  reserved?: any[];
};

/* =========================
   HELPERS
========================= */

function toFiniteNumber(value: any, fallback: number) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function toStringArray(value: any): string[] {
  if (!Array.isArray(value)) return [];
  return value.map(String).filter(Boolean);
}

function normalizeOffers(value: any) {
  if (!Array.isArray(value)) return [];
  return value;
}

function normalizeTickets(value: any) {
  if (!Array.isArray(value)) return [];
  return value;
}

/* =========================
   ✅ NEW: NORMALIZE PRIZES
========================= */

function normalizePrizes(value: any) {
  if (!Array.isArray(value)) return [];

  return value
    .map((item, index) => {
      if (!item || typeof item !== "object") return null;

      const title =
        item.title?.trim?.() ||
        item.name?.trim?.() ||
        "";

      if (!title) return null;

      return {
        id: item.id || `prize-${index + 1}`,
        title,
        name: title,
        description: item.description || "",
        isPublic: item.isPublic !== false && item.is_public !== false,
        is_public: item.isPublic !== false && item.is_public !== false,
        position: toFiniteNumber(item.position, index + 1),
        sortOrder: index,
        sort_order: index,
      };
    })
    .filter(Boolean);
}

/* =========================
   BUILD CONFIG
========================= */

function buildConfig(input: CreateRaffleInput): RaffleConfig {
  return {
    startNumber: toFiniteNumber(input.startNumber, 0),
    endNumber: toFiniteNumber(input.endNumber, 0),
    numbersPerColour: toFiniteNumber(input.numbersPerColour, 0),
    colourCount: toFiniteNumber(input.colourCount, 0),
    colours: toStringArray(input.colours),
    offers: normalizeOffers(input.offers),

    // ✅ KEY LINE (fixes your error)
    prizes: normalizePrizes(input.prizes),

    sold: normalizeTickets(input.sold),
    reserved: normalizeTickets(input.reserved),
  };
}

/* =========================
   CREATE RAFFLE
========================= */

export async function createRaffle(input: CreateRaffleInput) {
  const config = buildConfig(input);

  const result = await query(
    `
    insert into raffles (
      id,
      tenant_slug,
      title,
      slug,
      description,
      image_url,
      currency,
      ticket_price_cents,
      total_tickets,
      sold_tickets,
      status,
      config_json,
      created_at,
      updated_at
    )
    values (
      gen_random_uuid(),
      $1,$2,$3,$4,$5,$6,
      $7,$8,$9,$10,$11
