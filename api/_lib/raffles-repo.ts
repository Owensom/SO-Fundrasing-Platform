import { query, queryOne } from "./db";

export type RaffleRow = {
  id: string;
  tenant_slug: string;
  slug: string;
  title: string;
  description: string;
  image_url: string | null;
  ticket_price_cents: number;
  total_tickets: number;
  sold_tickets: number;
  status: "draft" | "published" | "closed";
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
  ticket_price: number;
  total_tickets: number;
  sold_tickets: number;
  remaining_tickets: number;
  status: "draft" | "published" | "closed";
  created_at: string;
  updated_at: string;
};

export type RaffleDetails = RaffleSummary & {
  offers: Array<{
    id?: string;
    label: string;
    price: number;
    tickets: number;
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
  ticket_price?: number | null;
  total_tickets?: number | null;
  sold_tickets?: number | null;
  status?: "draft" | "published" | "closed";
  offers?: Array<{
    label: string;
    price: number;
    tickets: number;
    is_active?: boolean;
    sort_order?: number;
  }>;
};

export type UpdateRaffleInput = CreateRaffleInput;

function toRaffleSummary(row: RaffleRow): RaffleSummary {
  return {
    id: row.id,
    tenant_slug: row.tenant_slug,
    slug: row.slug,
    title: row.title,
    description: row.description ?? "",
    image_url: row.image_url ?? "",
    ticket_price: Number(row.ticket_price_cents) / 100,
    total_tickets: Number(row.total_tickets),
    sold_tickets: Number(row.sold_tickets),
    remaining_tickets: Math.max(
      Number(row.total_tickets) - Number(row.sold_tickets),
      0
    ),
    status: row.status,
    created_at: row.created_at,
    updated_at: row.updated_at,
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
          ticket_price_cents,
          total_tickets,
          sold_tickets,
          status,
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
          ticket_price_cents,
          total_tickets,
          sold_tickets,
          status,
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
      ticket_price_cents,
      total_tickets,
      sold_tickets,
      status,
      created_at,
      updated_at
    from raffles
    where id = $1
    `,
    [id]
  );

  if (!raffle) return null;

  return {
    ...toRaffleSummary(raffle),
    offers: [],
  };
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
      ticket_price_cents,
      total_tickets,
      sold_tickets,
      status,
      created_at,
      updated_at
    from raffles
    where tenant_slug = $1
      and slug = $2
    `,
    [tenantSlug, slug]
  );

  if (!raffle) return null;

  return {
    ...toRaffleSummary(raffle),
    offers: [],
  };
}

export async function createRaffle(
  input: CreateRaffleInput
): Promise<RaffleDetails> {
  const raffle = await queryOne<RaffleRow>(
    `
    insert into raffles (
      id,
      tenant_slug,
      slug,
      title,
      description,
      image_url,
      ticket_price_cents,
      total_tickets,
      sold_tickets,
      status
    )
    values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    returning
      id,
      tenant_slug,
      slug,
      title,
      description,
      image_url,
      ticket_price_cents,
      total_tickets,
      sold_tickets,
      status,
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
      input.ticket_price != null ? Math.round(input.ticket_price * 100) : 0,
      input.total_tickets ?? 0,
      input.sold_tickets ?? 0,
      input.status ?? "published",
    ]
  );

  if (!raffle) {
    throw new Error("Failed to create raffle");
  }

  return {
    ...toRaffleSummary(raffle),
    offers: [],
  };
}

export async function updateRaffle(
  id: string,
  input: UpdateRaffleInput
): Promise<RaffleDetails | null> {
  const updated = await queryOne<RaffleRow>(
    `
    update raffles
    set
      tenant_slug = $2,
      slug = $3,
      title = $4,
      description = $5,
      image_url = $6,
      ticket_price_cents = $7,
      total_tickets = $8,
      sold_tickets = $9,
      status = $10,
      updated_at = now()
    where id = $1
    returning
      id,
      tenant_slug,
      slug,
      title,
      description,
      image_url,
      ticket_price_cents,
      total_tickets,
      sold_tickets,
      status,
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
      input.ticket_price != null ? Math.round(input.ticket_price * 100) : 0,
      input.total_tickets ?? 0,
      input.sold_tickets ?? 0,
      input.status ?? "published",
    ]
  );

  if (!updated) return null;

  return {
    ...toRaffleSummary(updated),
    offers: [],
  };
}
