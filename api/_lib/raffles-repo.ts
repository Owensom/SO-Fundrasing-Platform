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
