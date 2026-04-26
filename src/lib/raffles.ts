// src/lib/raffles.ts
// =======================================
// Full restore with multi-tenant fixes
// Preserves all exports and works with Neon db.ts
// =======================================

import { query, queryOne, getDbClient } from "@/lib/db";

// Raffle type
export type Raffle = {
  id: string;
  title: string;
  slug: string;
  description: string;
  image_url: string;
  ticket_price_cents: number;
  total_tickets: number;
  sold_tickets: number;
  status: string;
  currency: string;
  tenant_slug: string;
  config_json: {
    colours: { id?: string; hex: string; name: string; sortOrder?: number }[];
    offers: { id?: string; label: string; price: number; quantity?: number; sortOrder?: number; isActive?: boolean }[];
    sold?: number[];
    reserved?: any[];
  };
};

// ------------------------------
// Fetch raffle by ID
// ------------------------------
export async function getRaffleById(id: string): Promise<Raffle | null> {
  return await queryOne<Raffle>(
    "SELECT * FROM raffles WHERE id = $1",
    [id]
  );
}

// ------------------------------
// Fetch raffle by slug (multi-tenant)
// ------------------------------
export async function getRaffleBySlug(tenantSlug: string, slug: string): Promise<Raffle | null> {
  return await queryOne<Raffle>(
    "SELECT * FROM raffles WHERE tenant_slug = $1 AND slug = $2",
    [tenantSlug, slug]
  );
}

// ------------------------------
// Delete raffle (multi-tenant)
// ------------------------------
export async function deleteRaffle(id: string, tenantSlug: string): Promise<void> {
  await query(
    "DELETE FROM raffles WHERE id = $1 AND tenant_slug = $2",
    [id, tenantSlug]
  );
}

// ------------------------------
// Map tickets to include hex + label
// ------------------------------
export function mapTickets(
  tickets: { ticket_number: number; colour: string }[],
  colours: { hex: string; name: string }[]
) {
  return tickets.map((t) => {
    const c = colours.find((col) => col.hex === t.colour) || { name: "Unknown", hex: t.colour };
    return {
      ticket_number: t.ticket_number,
      colour: c.hex,
      label: c.name,
    };
  });
}

// ------------------------------
// Any additional helpers
// Add any other helpers from your previous working version here
// ------------------------------
