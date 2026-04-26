// src/lib/raffles.ts
// =======================================
// Full original raffle functions preserved
// getRaffleById, getRaffleBySlug, ticket mapping intact
// =======================================

import { getDbClient, query, queryOne } from "@/lib/db";

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
  config_json: {
    colours: { id?: string; hex: string; name: string; sortOrder?: number }[];
    offers: { id?: string; label: string; price: number; quantity?: number; sortOrder?: number; isActive?: boolean }[];
    sold?: number[];
    reserved?: any[];
  };
};

// Fetch raffle by ID
export async function getRaffleById(id: string): Promise<Raffle | null> {
  return await queryOne<Raffle>("SELECT * FROM raffles WHERE id = $1", [id]);
}

// Fetch raffle by slug
export async function getRaffleBySlug(slug: string): Promise<Raffle | null> {
  return await queryOne<Raffle>("SELECT * FROM raffles WHERE slug = $1", [slug]);
}

// Map tickets to include both hex + label for colour
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
