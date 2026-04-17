import { query, queryOne } from "./db";

type CurrencyCode = "GBP" | "USD" | "EUR";

type RaffleConfig = {
  startNumber?: number;
  endNumber?: number;
  numbersPerColour?: number;
  colourCount?: number;
  colours?: string[];
  offers?: Array<{
    id?: string;
    label: string;
    price: number;
    quantity?: number;
    tickets?: number;
    is_active?: boolean;
    sort_order?: number;
  }>;
  sold?: Array<{
    colour: string;
    number: number;
  }>;
  reserved?: Array<{
    colour: string;
    number: number;
  }>;
};

export type RaffleRow = {
  id: string;
  tenant_slug: string;
  slug: string;
  title: string;
  description: string;
  image_url: string | null;
  currency: CurrencyCode | null;
  ticket_price_cents: number;
  total_tickets: number;
  sold_tickets: number;
  status: "draft" | "published" | "closed";
  config_json: RaffleConfig | null;
  created_at: string;
  updated_at: string;
};

export type RaffleSummary = {
  id: string;
  tenant_slug: string;
  slug: string;
  title: string;
  description: string;
  image_url: string;
  currency: CurrencyCode;
  ticket_price: number;
  total_tickets: number;
  sold_tickets: number;
  remaining_tickets: number;
  status: "draft" | "published" | "closed";
  config_json: RaffleConfig;
  created_at: string;
  updated_at: string;
};

export type RaffleDetails = RaffleSummary & {
  offers: Array<{
    id?: string;
    label: string;
    price: number;
    quantity: number;
    is_active: boolean;
    sort_order: number;
  }>;
};

export type CreateRaffleInput = {
  tenant_slug: string;
  title: string;
  slug: string;
  description?: string;
  image_url?: string;
  currency?: CurrencyCode;
  ticket_price?: number | null;
  total_tickets?: number | null;
  sold_tickets?: number | null;
  status?: "draft" | "published" | "closed";
  startNumber?: number | null;
  endNumber?: number | null;
  numbersPerColour?: number | null;
  colourCount?: number | null;
  colours?: string[];
  offers?: Array<{
    id?: string;
    label: string;
    price: number;
    quantity?: number;
    tickets?: number;
    is_active?: boolean;
    sort_order?: number;
  }>;
  sold?: Array<{
    colour: string;
    number: number;
  }>;
  reserved?: Array<{
    colour: string;
    number: number;
  }>;
};

export type UpdateRaffleInput = CreateRaffleInput;

export type Purchase = {
  id: string;
  raffle_id: string;
  buyer_name: string;
  buyer_email: string;
  quantity: number;
  total_price: number;
  created_at: string;
};

function normalizeCurrency(value: unknown): CurrencyCode {
  if (value === "USD" || value === "EUR") return value;
  return "GBP";
}

function toFiniteNumber(value: unknown, fallback = 0) {
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
      const quantity = toFiniteNumber(
        offer.quantity ?? offer.tickets,
        0,
      );
      const price = toFiniteNumber(offer.price, 0);
      const is_active =
        typeof offer.is_active === "boolean" ? offer.is_active : true;
      const sort_order = toFiniteNumber(offer.sort_order, index);

      if (!label || quantity <= 0 || price < 0) return null;

      return {
        id:
          typeof offer.id === "string" && offer.id.trim()
            ? offer.id
            : undefined,
        label,
        price,
        quantity,
        tickets: quantity,
        is_active,
        sort_order,
      };
    })
    .filter(Boolean) as Array<{
    id?: string;
    label: string;
    price: number;
    quantity: number;
    tickets: number;
    is_active: boolean;
    sort_order: number;
  }>;
}

function normalizeTickets(value: unknown) {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => {
      if (!item || typeof item !== "object") return null;

      const ticket = item as Record<string, unknown>;
      const colour =
        typeof ticket.colour === "string" ? ticket.colour.trim() : "";
      const number = toFiniteNumber(ticket.number, NaN);

      if (!colour || !Number.isFinite(number)) return null;

      return { colour, number };
    })
    .filter(Boolean) as Array<{ colour: string; number: number }>;
}

function buildConfig(input: CreateRaffleInput): RaffleConfig {
  return {
    startNumber: toFiniteNumber(input.startNumber, 0),
    endNumber: toFiniteNumber(input.endNumber, 0),
    numbersPerColour: toFiniteNumber(input.numbersPerColour, 0),
    colourCount: toFiniteNumber(input.colourCount, 0),
    colours: toStringArray(input.colours),
    offers: normalizeOffers(input.offers),
    sold: normalizeTickets(input.sold),
    reserved: normalizeTickets(input.reserved),
  };
}

function toRaffleSummary(row: RaffleRow): RaffleSummary {
  return {
    id: row.id,
    tenant_slug: row.tenant_slug,
    slug: row.slug,
    title: row.title,
    description: row.description ?? "",
    image_url: row.image_url ?? "",
    currency: normalizeCurrency(row.currency),
    ticket_price: Number(row.ticket_price_cents) / 100,
    total_tickets: Number(row.total_tickets),
    sold_tickets: Number(row.sold_tickets),
    remaining_tickets: Math.max(
      Number(row.total_tickets) - Number(row.sold_tickets),
      0
    ),
    status: row.status,
    config_json:
      row.config_json && typeof row.config_json === "object"
        ? row.config_json
        : {},
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function toRaffleDetails(row: RaffleRow): RaffleDetails {
  const summary = toRaffleSummary(row);
  const offers = normalizeOffers(summary.config_json.offers).map((offer) => ({
    id: offer.id,
    label: offer.label,
    price: offer.price,
    quantity: offer.quantity,
    is_active: offer.is_active,
    sort_order: offer.sort_order,
  }));

  return {
    ...summary,
    offers,
  };
}

export async function listRaffles(
  tenantSlug?: string
): Promise<RaffleSummary[]> {
  const rows = tenantSlug
    ? await query<RaffleRow>(
        `
        select
          id,
          tenant_slug,
          slug,
          title,
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
        from raffles
        where tenant_slug = $1
        order by created_at desc
        `,
        [tenantSlug]
      )
    : await query<RaffleRow>(
        `
        select
          id,
          tenant_slug,
          slug,
          title,
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
        from raffles
        order by created_at desc
        `
      );

  return rows.map(toRaffleSummary);
}

export async function getRaffleById(id: string): Promise<RaffleDetails | null> {
  const raffle = await queryOne<RaffleRow>(
    `
    select
      id,
      tenant_slug,
      slug,
      title,
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
    from raffles
    where id = $1
    `,
    [id]
  );

  if (!raffle) return null;

  return toRaffleDetails(raffle);
}

export async function getRaffleBySlug(
  tenantSlug: string,
  slug: string
): Promise<RaffleDetails | null> {
  const raffle = await queryOne<RaffleRow>(
    `
    select
      id,
      tenant_slug,
      slug,
      title,
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
    from raffles
    where tenant_slug = $1
      and slug = $2
    `,
    [tenantSlug, slug]
  );

  if (!raffle) return null;

  return toRaffleDetails(raffle);
}

export async function createRaffle(
  input: CreateRaffleInput
): Promise<RaffleDetails> {
  const config = buildConfig(input);

  const raffle = await queryOne<RaffleRow>(
    `
    insert into raffles (
      id,
      tenant_slug,
      slug,
      title,
      description,
      image_url,
      currency,
      ticket_price_cents,
      total_tickets,
      sold_tickets,
      status,
      config_json
    )
    values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::jsonb)
    returning
      id,
      tenant_slug,
      slug,
      title,
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
    `,
    [
      crypto.randomUUID(),
      input.tenant_slug,
      input.slug,
      input.title,
      input.description ?? "",
      input.image_url ?? "",
      normalizeCurrency(input.currency),
      input.ticket_price != null ? Math.round(input.ticket_price * 100) : 0,
      input.total_tickets ?? 0,
      input.sold_tickets ?? 0,
      input.status ?? "published",
      JSON.stringify(config),
    ]
  );

  if (!raffle) {
    throw new Error("Failed to create raffle");
  }

  return toRaffleDetails(raffle);
}

export async function updateRaffle(
  id: string,
  input: UpdateRaffleInput
): Promise<RaffleDetails | null> {
  const config = buildConfig(input);

  const updated = await queryOne<RaffleRow>(
    `
    update raffles
    set
      tenant_slug = $2,
      slug = $3,
      title = $4,
      description = $5,
      image_url = $6,
      currency = $7,
      ticket_price_cents = $8,
      total_tickets = $9,
      sold_tickets = $10,
      status = $11,
      config_json = $12::jsonb,
      updated_at = now()
    where id = $1
       or (tenant_slug = $2 and slug = $3)
    returning
      id,
      tenant_slug,
      slug,
      title,
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
    `,
    [
      id,
      input.tenant_slug,
      input.slug,
      input.title,
      input.description ?? "",
      input.image_url ?? "",
      normalizeCurrency(input.currency),
      input.ticket_price != null ? Math.round(input.ticket_price * 100) : 0,
      input.total_tickets ?? 0,
      input.sold_tickets ?? 0,
      input.status ?? "published",
      JSON.stringify(config),
    ]
  );

  if (!updated) return null;

  return toRaffleDetails(updated);
}

export async function listPurchasesByRaffleId(
  _raffleId: string
): Promise<Purchase[]> {
  return [];
}
