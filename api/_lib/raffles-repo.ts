import type { PoolClient, QueryResultRow } from "pg";
import { query, withTransaction } from "./db";

export type RaffleStatus = "draft" | "published" | "closed";
export type PaymentStatus = "pending" | "paid" | "failed" | "cancelled";

export type PublicRaffle = {
  id: string;
  tenantSlug: string;
  slug: string;
  title: string;
  description: string;
  imageUrl: string | null;
  ticketPrice: number;
  totalTickets: number;
  soldTickets: number;
  remainingTickets: number;
  isSoldOut: boolean;
  status: RaffleStatus;
};

export type AdminRaffle = PublicRaffle & {
  createdAt: string;
  updatedAt: string;
};

export type PurchaseRecord = {
  id: string;
  tenantSlug: string;
  raffleId: string;
  raffleSlug: string;
  customerName: string;
  customerEmail: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  paymentStatus: PaymentStatus;
  paidAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type RaffleRow = QueryResultRow & {
  id: string;
  tenant_slug: string;
  slug: string;
  title: string;
  description: string;
  image_url: string | null;
  ticket_price_cents: number;
  total_tickets: number;
  sold_tickets: number;
  status: RaffleStatus;
  created_at: string;
  updated_at: string;
};

type PurchaseRow = QueryResultRow & {
  id: string;
  tenant_slug: string;
  raffle_id: string;
  raffle_slug: string;
  customer_name: string;
  customer_email: string;
  quantity: number;
  unit_price_cents: number;
  total_price_cents: number;
  payment_status: PaymentStatus;
  paid_at: string | null;
  created_at: string;
  updated_at: string;
};

function centsToAmount(cents: number): number {
  return cents / 100;
}

function mapPublicRaffle(row: RaffleRow): PublicRaffle {
  const remainingTickets = Math.max(row.total_tickets - row.sold_tickets, 0);

  return {
    id: row.id,
    tenantSlug: row.tenant_slug,
    slug: row.slug,
    title: row.title,
    description: row.description,
    imageUrl: row.image_url,
    ticketPrice: centsToAmount(row.ticket_price_cents),
    totalTickets: row.total_tickets,
    soldTickets: row.sold_tickets,
    remainingTickets,
    isSoldOut: remainingTickets === 0,
    status: row.status,
  };
}

function mapAdminRaffle(row: RaffleRow): AdminRaffle {
  return {
    ...mapPublicRaffle(row),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapPurchase(row: PurchaseRow): PurchaseRecord {
  return {
    id: row.id,
    tenantSlug: row.tenant_slug,
    raffleId: row.raffle_id,
    raffleSlug: row.raffle_slug,
    customerName: row.customer_name,
    customerEmail: row.customer_email,
    quantity: row.quantity,
    unitPrice: centsToAmount(row.unit_price_cents),
    totalPrice: centsToAmount(row.total_price_cents),
    paymentStatus: row.payment_status,
    paidAt: row.paid_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listAdminRaffles(
  tenantSlug: string
): Promise<AdminRaffle[]> {
  const result = await query<RaffleRow>(
    `
      select *
      from raffles
      where tenant_slug = $1
      order by created_at desc
    `,
    [tenantSlug]
  );

  return result.rows.map(mapAdminRaffle);
}

export async function getPublicRaffleBySlug(
  tenantSlug: string,
  slug: string
): Promise<PublicRaffle | null> {
  const result = await query<RaffleRow>(
    `
      select *
      from raffles
      where tenant_slug = $1
        and slug = $2
        and status in ('published', 'closed')
      limit 1
    `,
    [tenantSlug, slug]
  );

  const row = result.rows[0];
  return row ? mapPublicRaffle(row) : null;
}

export async function getAdminRaffleBySlug(
  tenantSlug: string,
  slug: string
): Promise<AdminRaffle | null> {
  const result = await query<RaffleRow>(
    `
      select *
      from raffles
      where tenant_slug = $1
        and slug = $2
      limit 1
    `,
    [tenantSlug, slug]
  );

  const row = result.rows[0];
  return row ? mapAdminRaffle(row) : null;
}

export async function listPurchasesForRaffle(
  tenantSlug: string,
  raffleSlug: string
): Promise<PurchaseRecord[]> {
  const result = await query<PurchaseRow>(
    `
      select *
      from raffle_purchases
      where tenant_slug = $1
        and raffle_slug = $2
      order by created_at desc
    `,
    [tenantSlug, raffleSlug]
  );

  return result.rows.map(mapPurchase);
}

export async function createPendingPurchase(input: {
  tenantSlug: string;
  raffleSlug: string;
  customerName: string;
  customerEmail: string;
  quantity: number;
}) {
  return withTransaction(async (client: PoolClient) => {
    const raffleResult = await client.query<RaffleRow>(
      `select * from raffles where tenant_slug = $1 and slug = $2 limit 1`,
      [input.tenantSlug, input.raffleSlug]
    );

    const raffleRow = raffleResult.rows[0];

    if (!raffleRow) {
      return { ok: false, status: 404, message: "Raffle not found." };
    }

    if (raffleRow.status !== "published") {
      return {
        ok: false,
        status: 400,
        message: "Raffle is not open for sales.",
      };
    }

    const purchaseId = `purchase_${Date.now()}`;
    const unitPriceCents = raffleRow.ticket_price_cents;
    const totalPriceCents = unitPriceCents * input.quantity;

    const insert = await client.query<PurchaseRow>(
      `
      insert into raffle_purchases (
        id, tenant_slug, raffle_id, raffle_slug,
        customer_name, customer_email, quantity,
        unit_price_cents, total_price_cents,
        payment_status, created_at, updated_at
      )
      values ($1,$2,$3,$4,$5,$6,$7,$8,$9,'pending',now(),now())
      returning *
    `,
      [
        purchaseId,
        input.tenantSlug,
        raffleRow.id,
        raffleRow.slug,
        input.customerName,
        input.customerEmail.toLowerCase(),
        input.quantity,
        unitPriceCents,
        totalPriceCents,
      ]
    );

    return {
      ok: true,
      purchase: mapPurchase(insert.rows[0]),
      raffle: mapPublicRaffle(raffleRow),
    };
  });
}
