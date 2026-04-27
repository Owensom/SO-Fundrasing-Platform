import { query } from "@/lib/db";

// --------------------------------------------
// TYPES
// --------------------------------------------

type Ticket = {
  ticket_number: number;
  colour?: string;
};

type Offer = {
  id?: string;
  label: string;
  price: number;
  quantity?: number;
  tickets?: number;
  is_active?: boolean;
  sort_order?: number;
};

type Prize = {
  id?: string;
  title?: string;
  name?: string;
  description?: string;
  isPublic?: boolean;
  is_public?: boolean;
  position?: number;
  sortOrder?: number;
  sort_order?: number;
};

type RaffleConfig = {
  startNumber?: number;
  endNumber?: number;
  numbersPerColour?: number;
  colourCount?: number;
  colours?: string[];
  offers?: Offer[];
  prizes?: Prize[];
  sold?: Ticket[];
  reserved?: Ticket[];
};

type CreateRaffleInput = {
  tenant_slug: string;
  title: string;
  slug: string;
  description?: string;
  image_url?: string;
  currency: "GBP" | "USD" | "EUR";
  ticket_price: number;
  total_tickets: number;
  sold_tickets: number;
  status: "draft" | "published" | "closed" | "drawn";

  startNumber?: number;
  endNumber?: number;
  numbersPerColour?: number;
  colourCount?: number;
  colours?: string[];
  offers?: Offer[];
  prizes?: Prize[];

  sold?: Ticket[];
  reserved?: Ticket[];
};

// --------------------------------------------
// HELPERS
// --------------------------------------------

function toFiniteNumber(value: unknown, fallback: number) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map(String);
}

function normalizeOffers(value: unknown): Offer[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item, index) => {
      if (!item || typeof item !== "object") return null;

      const offer = item as Record<string, unknown>;

      const label =
        typeof offer.label === "string" ? offer.label.trim() : "";

      if (!label) return null;

      const price = toFiniteNumber(offer.price, 0);
      const quantity = toFiniteNumber(
        offer.quantity ?? offer.tickets,
        0,
      );

      if (price <= 0 || quantity <= 0) return null;

      return {
        id:
          typeof offer.id === "string"
            ? offer.id
            : `offer-${index + 1}`,
        label,
        price,
        quantity,
        tickets: quantity,
        is_active:
          offer.is_active !== false && offer.isActive !== false,
        sort_order: toFiniteNumber(
          offer.sort_order ?? offer.sortOrder,
          index,
        ),
      };
    })
    .filter(Boolean) as Offer[];
}

function normalizePrizes(value: unknown): Prize[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item, index) => {
      if (!item || typeof item !== "object") return null;

      const prize = item as Record<string, unknown>;

      const title =
        typeof prize.title === "string" && prize.title.trim()
          ? prize.title.trim()
          : typeof prize.name === "string" && prize.name.trim()
            ? prize.name.trim()
            : "";

      if (!title) return null;

      return {
        id:
          typeof prize.id === "string"
            ? prize.id
            : `prize-${index + 1}`,
        title,
        name: title,
        description:
          typeof prize.description === "string"
            ? prize.description
            : "",
        isPublic:
          prize.isPublic === false || prize.is_public === false
            ? false
            : true,
        is_public:
          prize.isPublic === false || prize.is_public === false
            ? false
            : true,
        position: toFiniteNumber(prize.position, index + 1),
        sortOrder: index,
        sort_order: index,
      };
    })
    .filter(Boolean) as Prize[];
}

function normalizeTickets(value: unknown): Ticket[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => {
      if (!item || typeof item !== "object") return null;

      const ticket = item as Record<string, unknown>;

      return {
        ticket_number: toFiniteNumber(ticket.ticket_number, 0),
        colour:
          typeof ticket.colour === "string"
            ? ticket.colour
            : undefined,
      };
    })
    .filter((t) => t && t.ticket_number > 0) as Ticket[];
}

// --------------------------------------------
// CONFIG BUILDER
// --------------------------------------------

function buildConfig(input: CreateRaffleInput): RaffleConfig {
  return {
    startNumber: toFiniteNumber(input.startNumber, 0),
    endNumber: toFiniteNumber(input.endNumber, 0),
    numbersPerColour: toFiniteNumber(input.numbersPerColour, 0),
    colourCount: toFiniteNumber(input.colourCount, 0),
    colours: toStringArray(input.colours),
    offers: normalizeOffers(input.offers),
    prizes: normalizePrizes(input.prizes), // ✅ KEY FIX
    sold: normalizeTickets(input.sold),
    reserved: normalizeTickets(input.reserved),
  };
}

// --------------------------------------------
// CREATE
// --------------------------------------------

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
      gen_random_uuid()::text,
      $1, $2, $3, $4, $5, $6,
      $7, $8, $9, $10,
      $11::jsonb,
      now(),
      now()
    )
    returning *
    `,
    [
      input.tenant_slug,
      input.title,
      input.slug,
      input.description || "",
      input.image_url || "",
      input.currency,
      Math.round(input.ticket_price * 100),
      input.total_tickets,
      input.sold_tickets,
      input.status,
      JSON.stringify(config),
    ],
  );

  return result[0];
}

// --------------------------------------------
// LIST
// --------------------------------------------

export async function listRaffles(tenantSlug: string) {
  return await query(
    `
    select *
    from raffles
    where tenant_slug = $1
    order by created_at desc
    `,
    [tenantSlug],
  );
}
