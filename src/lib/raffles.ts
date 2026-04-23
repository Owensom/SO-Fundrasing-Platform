import crypto from "crypto";
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

export type RaffleStatus = "draft" | "published" | "closed" | "drawn";

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
  status: RaffleStatus;
  config_json: RaffleConfig | null;
  winner_ticket_number: number | null;
  winner_colour: string | null;
  winner_sale_id: string | null;
  drawn_at: string | null;
  drawn_by: string | null;
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
  status: RaffleStatus;
  config_json: RaffleConfig;
  winner_ticket_number: number | null;
  winner_colour: string | null;
  winner_sale_id: string | null;
  drawn_at: string | null;
  drawn_by: string | null;
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
  status?: RaffleStatus;
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

export type SoldTicketForDraw = {
  sale_id: string;
  ticket_number: number;
  colour: string | null;
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
      const quantity = toFiniteNumber(offer.quantity ?? offer.tickets, 0);
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
    .filter(Boolean);
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
    .filter(Boolean);
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

const RAFFLE_SELECT = `
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
  winner_ticket_number,
  winner_colour,
  winner_sale_id,
  drawn_at,
  drawn_by,
  created_at,
  updated_at
`;

export async function getRaffleById(id: string): Promise<RaffleDetails | null> {
  const raffle = await queryOne<RaffleRow>(
    `
    select ${RAFFLE_SELECT}
    from raffles
    where id = $1
    `,
    [id]
  );

  if (!raffle) return null;

  return {
    ...raffle,
    ticket_price: raffle.ticket_price_cents / 100,
    offers: normalizeOffers(raffle.config_json?.offers),
  } as any;
}

export async function getSoldTicketsForDraw(
  raffleId: string
): Promise<SoldTicketForDraw[]> {
  return query<SoldTicketForDraw>(
    `
    select id as sale_id, ticket_number, colour
    from raffle_ticket_sales
    where raffle_id = $1
    `,
    [raffleId]
  );
}

export async function closeRaffle(id: string) {
  return queryOne(
    `
    update raffles
    set status = 'closed', updated_at = now()
    where id = $1
    returning *
    `,
    [id]
  );
}

export async function setRaffleWinner(args: {
  raffleId: string;
  ticketNumber: number;
  colour: string | null;
  saleId: string;
  drawnBy: string | null;
}) {
  return queryOne(
    `
    update raffles
    set
      status = 'drawn',
      winner_ticket_number = $2,
      winner_colour = $3,
      winner_sale_id = $4,
      drawn_at = now(),
      drawn_by = $5,
      updated_at = now()
    where id = $1
    returning *
    `,
    [
      args.raffleId,
      args.ticketNumber,
      args.colour,
      args.saleId,
      args.drawnBy,
    ]
  );
}

//
// 🧨 DELETE RAFFLE (NEW)
//
export async function deleteRaffle(id: string): Promise<boolean> {
  const deleted = await queryOne<{ id: string }>(
    `
    delete from raffles
    where id = $1
      and status in ('draft', 'closed', 'drawn')
    returning id
    `,
    [id]
  );

  return Boolean(deleted);
}
