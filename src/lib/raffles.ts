import { query } from "./db";
import type { SafeRaffle } from "./types";

export async function getRaffleBySlug(tenantSlug: string, slug: string): Promise<SafeRaffle | null> {
  const row = await query(
    `select * from raffles where tenant_slug = $1 and slug = $2 limit 1`,
    [tenantSlug, slug]
  );

  if (!row || !row.length) return null;

  const raw = row[0];

  return {
    id: raw.id,
    slug: raw.slug,
    title: raw.title,
    description: raw.description || "",
    imageUrl: raw.image_url || "",
    tenantSlug: raw.tenant_slug,
    startNumber: raw.config_json?.startNumber ?? 1,
    endNumber: raw.config_json?.endNumber ?? raw.total_tickets,
    currency: raw.currency ?? "GBP",
    ticketPrice: Number(raw.ticket_price_cents ?? 0) / 100,
    status: raw.status as SafeRaffle["status"],
    colours: raw.config_json?.colours ?? [],
    offers: raw.config_json?.offers ?? [],
    prizes: raw.config_json?.prizes ?? [],
    reservedTickets: raw.reservedTickets ?? [],
    soldTickets: raw.soldTickets ?? [],
    winnerTicketNumber: raw.winnerTicketNumber ?? null,
    winnerColour: raw.winnerColour ?? null,
    drawnAt: raw.drawnAt ?? null,
    winners: raw.winners ?? [],
  };
}

export async function getAllCampaignsForTenant(tenantSlug: string) {
  const rows = await query(
    `select * from raffles where tenant_slug = $1 and status = 'published' order by created_at desc`,
    [tenantSlug]
  );
  return rows;
}
