import { query, queryOne } from "./db";
import { normaliseColours } from "./normalise-colours";

export type RaffleOfferRow = {
  id: string;
  raffle_id: string;
  label: string;
  price: string | number;
  ticket_count: number;
  is_active: boolean;
  sort_order: number;
};

export type RaffleRow = {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  image_url: string | null;
  draw_at: string | null;
  ticket_price: string | number | null;
  max_tickets: number | null;
  is_active: boolean;
  available_colours: string[] | null;
  created_at: string;
};

export type PurchaseRow = {
  id: string;
  raffle_id: string;
  buyer_name: string;
  buyer_email: string;
  quantity: number;
  total_price: string | number;
  selected_colour: string | null;
  selected_numbers: number[] | null;
  created_at: string;
};

export type RaffleOffer = {
  id: string;
  label: string;
  price: number;
  tickets: number;
  is_active: boolean;
  sort_order: number;
};

export type RaffleSummary = {
  id: string;
  title: string;
  slug: string;
  description: string;
  image_url: string;
  draw_at: string | null;
  ticket_price: number | null;
  max_tickets: number | null;
  is_active: boolean;
  available_colours: string[];
  created_at: string;
};

export type RaffleDetails = RaffleSummary & {
  offers: RaffleOffer[];
};

export type Purchase = {
  id: string;
  raffle_id: string;
  buyer_name: string;
  buyer_email: string;
  quantity: number;
  total_price: number;
  selected_colour: string | null;
  selected_numbers: number[];
  created_at: string;
};

export type CreateRaffleInput = {
  title: string;
  slug: string;
  description?: string;
  image_url?: string;
  draw_at?: string | null;
  ticket_price?: number | null;
  max_tickets?: number | null;
  is_active?: boolean;
  available_colours?: string[];
  offers?: Array<{
    label: string;
    price: number;
    tickets: number;
    is_active?: boolean;
    sort_order?: number;
  }>;
};

export type UpdateRaffleInput = CreateRaffleInput;

function toOffer(row: RaffleOfferRow): RaffleOffer {
  return {
    id: row.id,
    label: row.label,
    price: Number(row.price),
    tickets: Number(row.ticket_count),
    is_active: Boolean(row.is_active),
    sort_order: Number(row.sort_order ?? 0),
  };
}

function toRaffleSummary(row: RaffleRow): RaffleSummary {
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    description: row.description ?? "",
    image_url: row.image_url ?? "",
    draw_at: row.draw_at ?? null,
    ticket_price:
      row.ticket_price === null || row.ticket_price === undefined
        ? null
        : Number(row.ticket_price),
    max_tickets:
      row.max_tickets === null || row.max_tickets === undefined
        ? null
        : Number(row.max_tickets),
    is_active: Boolean(row.is_active),
    available_colours: normaliseColours(row.available_colours ?? []),
    created_at: row.created_at,
  };
}

function toPurchase(row: PurchaseRow): Purchase {
  return {
    id: row.id,
    raffle_id: row.raffle_id,
    buyer_name: row.buyer_name,
    buyer_email: row.buyer_email,
    quantity: Number(row.quantity),
    total_price: Number(row.total_price),
    selected_colour: row.selected_colour ?? null,
    selected_numbers: Array.isArray(row.selected_numbers)
      ? row.selected_numbers.map(Number)
      : [],
    created_at: row.created_at,
  };
}

export async function listRaffles(): Promise<RaffleSummary[]> {
  const rows = await query<RaffleRow>(
    `
    select
      id,
      title,
      slug,
      description,
      image_url,
      draw_at,
      ticket_price,
      max_tickets,
      is_active,
      available_colours,
      created_at
    from raffles
    order by created_at desc
    `,
  );

  return rows.map(toRaffleSummary);
}

export async function getRaffleById(id: string): Promise<RaffleDetails | null> {
  const raffle = await queryOne<RaffleRow>(
    `
    select
      id,
      title,
      slug,
      description,
      image_url,
      draw_at,
      ticket_price,
      max_tickets,
      is_active,
      available_colours,
      created_at
    from raffles
    where id = $1
    `,
    [id],
  );

  if (!raffle) return null;

  const offers = await query<RaffleOfferRow>(
    `
    select
      id,
      raffle_id,
      label,
      price,
      ticket_count,
      is_active,
      sort_order
    from raffle_offers
    where raffle_id = $1
    order by sort_order asc, id asc
    `,
    [id],
  );

  return {
    ...toRaffleSummary(raffle),
    offers: offers.map(toOffer),
  };
}

export async function getRaffleBySlug(
  slug: string,
): Promise<RaffleDetails | null> {
  const raffle = await queryOne<RaffleRow>(
    `
    select
      id,
      title,
      slug,
      description,
      image_url,
      draw_at,
      ticket_price,
      max_tickets,
      is_active,
      available_colours,
      created_at
    from raffles
    where slug = $1
      and is_active = true
    `,
    [slug],
  );

  if (!raffle) return null;

  const offers = await query<RaffleOfferRow>(
    `
    select
      id,
      raffle_id,
      label,
      price,
      ticket_count,
      is_active,
      sort_order
    from raffle_offers
    where raffle_id = $1
      and is_active = true
    order by sort_order asc, id asc
    `,
    [raffle.id],
  );

  return {
    ...toRaffleSummary(raffle),
    offers: offers.map(toOffer),
  };
}

export async function createRaffle(
  input: CreateRaffleInput,
): Promise<RaffleDetails> {
  const raffle = await queryOne<RaffleRow>(
    `
    insert into raffles (
      title,
      slug,
      description,
      image_url,
      draw_at,
      ticket_price,
      max_tickets,
      is_active,
      available_colours
    )
    values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    returning
      id,
      title,
      slug,
      description,
      image_url,
      draw_at,
      ticket_price,
      max_tickets,
      is_active,
      available_colours,
      created_at
    `,
    [
      input.title,
      input.slug,
      input.description ?? "",
      input.image_url ?? "",
      input.draw_at ?? null,
      input.ticket_price ?? null,
      input.max_tickets ?? null,
      input.is_active ?? true,
      JSON.stringify(normaliseColours(input.available_colours ?? [])),
    ],
  );

  if (!raffle) {
    throw new Error("Failed to create raffle");
  }

  const offersInput = input.offers ?? [];

  for (let index = 0; index < offersInput.length; index += 1) {
    const offer = offersInput[index];
    await query(
      `
      insert into raffle_offers (
        raffle_id,
        label,
        price,
        ticket_count,
        is_active,
        sort_order
      )
      values ($1, $2, $3, $4, $5, $6)
      `,
      [
        raffle.id,
        offer.label,
        offer.price,
        offer.tickets,
        offer.is_active ?? true,
        offer.sort_order ?? index,
      ],
    );
  }

  const full = await getRaffleById(raffle.id);
  if (!full) {
    throw new Error("Failed to load created raffle");
  }

  return full;
}

export async function updateRaffle(
  id: string,
  input: UpdateRaffleInput,
): Promise<RaffleDetails | null> {
  const updated = await queryOne<RaffleRow>(
    `
    update raffles
    set
      title = $2,
      slug = $3,
      description = $4,
      image_url = $5,
      draw_at = $6,
      ticket_price = $7,
      max_tickets = $8,
      is_active = $9,
      available_colours = $10
    where id = $1
    returning
      id,
      title,
      slug,
      description,
      image_url,
      draw_at,
      ticket_price,
      max_tickets,
      is_active,
      available_colours,
      created_at
    `,
    [
      id,
      input.title,
      input.slug,
      input.description ?? "",
      input.image_url ?? "",
      input.draw_at ?? null,
      input.ticket_price ?? null,
      input.max_tickets ?? null,
      input.is_active ?? true,
      JSON.stringify(normaliseColours(input.available_colours ?? [])),
    ],
  );

  if (!updated) return null;

  await query(`delete from raffle_offers where raffle_id = $1`, [id]);

  const offersInput = input.offers ?? [];

  for (let index = 0; index < offersInput.length; index += 1) {
    const offer = offersInput[index];
    await query(
      `
      insert into raffle_offers (
        raffle_id,
        label,
        price,
        ticket_count,
        is_active,
        sort_order
      )
      values ($1, $2, $3, $4, $5, $6)
      `,
      [
        id,
        offer.label,
        offer.price,
        offer.tickets,
        offer.is_active ?? true,
        offer.sort_order ?? index,
      ],
    );
  }

  return getRaffleById(id);
}

export async function listPurchasesByRaffleId(
  raffleId: string,
): Promise<Purchase[]> {
  const rows = await query<PurchaseRow>(
    `
    select
      id,
      raffle_id,
      buyer_name,
      buyer_email,
      quantity,
      total_price,
      selected_colour,
      selected_numbers,
      created_at
    from purchases
    where raffle_id = $1
    order by created_at desc
    `,
    [raffleId],
  );

  return rows.map(toPurchase);
}
