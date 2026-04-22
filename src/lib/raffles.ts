import { query, queryOne } from "./db";

/* ================= TYPES ================= */

type CurrencyCode = "GBP" | "USD" | "EUR";

type RaffleConfig = {
  startNumber?: number;
  endNumber?: number;
  colours?: string[];
  offers?: Array<{
    id?: string;
    label?: string;
    price?: number;
    quantity?: number;
    tickets?: number;
    is_active?: boolean;
    sort_order?: number;
  }>;
  sold?: any[];
  reserved?: any[];
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
  status: "draft" | "published" | "closed" | "drawn";
  config_json: RaffleConfig | null;
  winner_ticket_number: number | null;
  winner_colour: string | null;
  winner_sale_id: string | null;
  drawn_at: string | null;
  drawn_by: string | null;
  created_at: string;
  updated_at: string;
};

export type NormalizedOffer = {
  id?: string;
  label: string;
  price: number;
  quantity: number;
  is_active: boolean;
  sort_order: number;
};

export type RaffleDetails = {
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
  status: "draft" | "published" | "closed" | "drawn";
  config_json: RaffleConfig;
  offers: NormalizedOffer[];
  winner_ticket_number: number | null;
  winner_colour: string | null;
  winner_sale_id: string | null;
  drawn_at: string | null;
  drawn_by: string | null;
  created_at: string;
  updated_at: string;
};

export type SoldTicketForDraw = {
  sale_id: string;
  ticket_number: number;
  colour: string | null;
};

/* ================= HELPERS ================= */

function normalizeCurrency(value: unknown): CurrencyCode {
  if (value === "USD" || value === "EUR") return value;
  return "GBP";
}

function toFiniteNumber(value: unknown, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function normalizeOffers(value: unknown): NormalizedOffer[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item, index) => {
      if (!item || typeof item !== "object") return null;

      const offer = item as Record<string, unknown>;
      const label = typeof offer.label === "string" ? offer.label.trim() : "";
      const quantity = toFiniteNumber(offer.quantity ?? offer.tickets, 0);
      const price = toFiniteNumber(offer.price, 0);
      const is_active =
        typeof offer.is_active === "boolean" ? offer.is_active : true;
      const sort_order = toFiniteNumber(offer.sort_order, index);

      if (!label || quantity <= 0 || price < 0) return null;

      return {
        id:
          typeof offer.id === "string" && offer.id.trim()
            ? offer.id.trim()
            : undefined,
        label,
        price,
        quantity,
        is_active,
        sort_order,
      };
    })
    .filter(Boolean) as NormalizedOffer[];
}

function toRaffle(row: RaffleRow): RaffleDetails {
  const config =
    row.config_json && typeof row.config_json === "object"
      ? row.config_json
      : {};

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
    config_json: config,
    offers: normalizeOffers(config.offers),
    winner_ticket_number: row.winner_ticket_number,
    winner_colour: row.winner_colour,
    winner_sale_id: row.winner_sale_id,
    drawn_at: row.drawn_at,
    drawn_by: row.drawn_by,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

/* ================= READ ================= */

export async function getRaffleById(
  id: string
): Promise<RaffleDetails | null> {
  const row = await queryOne<RaffleRow>(
    `
    select *
    from raffles
    where id = $1
    `,
    [id]
  );

  return row ? toRaffle(row) : null;
}

export async function getRaffleBySlug(
  tenantSlug: string,
  slug: string
): Promise<RaffleDetails | null> {
  const row = await queryOne<RaffleRow>(
    `
    select *
    from raffles
    where tenant_slug = $1
      and slug = $2
    `,
    [tenantSlug, slug]
  );

  return row ? toRaffle(row) : null;
}

export async function listRaffles(
  tenantSlug?: string
): Promise<RaffleDetails[]> {
  const rows = tenantSlug
    ? await query<RaffleRow>(
        `
        select *
        from raffles
        where tenant_slug = $1
        order by created_at desc
        `,
        [tenantSlug]
      )
    : await query<RaffleRow>(
        `
        select *
        from raffles
        order by created_at desc
        `
      );

  return rows.map(toRaffle);
}

/* ================= CLOSE ================= */

export async function closeRaffle(
  raffleId: string
): Promise<RaffleDetails | null> {
  const row = await queryOne<RaffleRow>(
    `
    update raffles
    set status = 'closed',
        updated_at = now()
    where id = $1
      and status = 'published'
    returning *
    `,
    [raffleId]
  );

  return row ? toRaffle(row) : null;
}

/* ================= DRAW ================= */

export async function getSoldTicketsForDraw(
  raffleId: string
): Promise<SoldTicketForDraw[]> {
  return query<SoldTicketForDraw>(
    `
    select
      ticket_number::text as sale_id,
      ticket_number,
      null::text as colour
    from raffle_ticket_sales
    where raffle_id = $1
    order by ticket_number asc
    `,
    [raffleId]
  );
}

export async function setRaffleWinner(params: {
  raffleId: string;
  ticketNumber: number;
  colour: string | null;
  saleId: string;
  drawnBy: string | null;
}): Promise<RaffleDetails | null> {
  const row = await queryOne<RaffleRow>(
    `
    update raffles
    set
      winner_ticket_number = $2,
      winner_colour = $3,
      winner_sale_id = $4,
      drawn_at = now(),
      drawn_by = $5,
      status = 'drawn',
      updated_at = now()
    where id = $1
      and status = 'closed'
      and drawn_at is null
    returning *
    `,
    [
      params.raffleId,
      params.ticketNumber,
      params.colour,
      params.saleId,
      params.drawnBy,
    ]
  );

  return row ? toRaffle(row) : null;
}
