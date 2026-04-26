// src/lib/raffles.ts
import { query, queryOne } from "@/lib/db";

// ------------------------------
// Types
// ------------------------------
export type Raffle = {
  id: string;
  tenant_slug: string;
  title: string;
  slug: string;
  description?: string;
  image_url?: string; // ✅ restored for admin page
  ticket_price_cents: number;
  total_tickets: number;
  sold_tickets: number;
  status: "draft" | "published" | "closed" | "drawn";
  offers: any[];
  colours: any[];
  prizes?: any[];
};

// ------------------------------
// Get raffle by ID
// ------------------------------
export async function getRaffleById(id: string): Promise<Raffle | null> {
  return await queryOne<Raffle>("SELECT * FROM raffles WHERE id = $1", [id]);
}

// ------------------------------
// Get raffle by slug (multi-tenant)
// ------------------------------
export async function getRaffleBySlug(tenantSlug: string, slug: string): Promise<Raffle | null> {
  return await queryOne<Raffle>(
    "SELECT * FROM raffles WHERE tenant_slug = $1 AND slug = $2",
    [tenantSlug, slug]
  );
}

// ------------------------------
// Delete raffle
// ------------------------------
export async function deleteRaffle(id: string, tenantSlug: string) {
  await query(
    "DELETE FROM raffles WHERE id = $1 AND tenant_slug = $2",
    [id, tenantSlug]
  );
}

// ------------------------------
// Update raffle
// ------------------------------
export async function updateRaffle(
  id: string,
  tenantSlug: string,
  fields: Partial<Omit<Raffle, "id" | "tenant_slug" | "offers" | "colours" | "prizes">>
): Promise<Raffle> {
  const keys = Object.keys(fields);
  const values = Object.values(fields);
  const setClause = keys.map((k, i) => `${k} = $${i + 1}`).join(", ");
  const res = await queryOne<Raffle>(
    `UPDATE raffles SET ${setClause} WHERE id = $${keys.length + 1} AND tenant_slug = $${keys.length + 2} RETURNING *`,
    [...values, id, tenantSlug]
  );
  if (!res) throw new Error("Raffle not found or not updated");
  return res;
}

// ------------------------------
// Update raffle offers
// ------------------------------
export async function updateRaffleOffers(id: string, tenantSlug: string, offers: any[]): Promise<any[]> {
  await query("DELETE FROM raffle_offers WHERE raffle_id = $1 AND tenant_slug = $2", [id, tenantSlug]);
  const inserted: any[] = [];
  for (const offer of offers) {
    const res = await query(
      `INSERT INTO raffle_offers (raffle_id, tenant_slug, label, price, quantity, is_active, sort_order)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [id, tenantSlug, offer.label, offer.price, offer.quantity, offer.isActive, offer.sortOrder || 0]
    );
    inserted.push(res[0]);
  }
  return inserted;
}

// ------------------------------
// Update raffle colours
// ------------------------------
export async function updateRaffleColours(id: string, tenantSlug: string, colours: any[]): Promise<any[]> {
  await query("DELETE FROM raffle_colours WHERE raffle_id = $1 AND tenant_slug = $2", [id, tenantSlug]);
  const inserted: any[] = [];
  for (const colour of colours) {
    const res = await query(
      `INSERT INTO raffle_colours (raffle_id, tenant_slug, name, hex, sort_order)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [id, tenantSlug, colour.name, colour.hex, colour.sortOrder || 0]
    );
    inserted.push(res[0]);
  }
  return inserted;
}

// ------------------------------
// Update raffle prizes
// ------------------------------
export async function updateRafflePrizes(id: string, tenantSlug: string, prizes: any[]): Promise<any[]> {
  await query("DELETE FROM raffle_prizes WHERE raffle_id = $1 AND tenant_slug = $2", [id, tenantSlug]);
  const inserted: any[] = [];
  for (const prize of prizes) {
    const res = await query(
      `INSERT INTO raffle_prizes (raffle_id, tenant_slug, name, description, sort_order)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [id, tenantSlug, prize.name, prize.description, prize.sortOrder || 0]
    );
    inserted.push(res[0]);
  }
  return inserted;
}

// ------------------------------
// Map tickets helper (for by-reservation route)
// ------------------------------
export function mapTickets(tickets: any[]): any[] {
  return tickets.map((t) => ({
    ticket_number: t.ticket_number,
    colour: t.colour || t.hex || "#000000",
  }));
}
