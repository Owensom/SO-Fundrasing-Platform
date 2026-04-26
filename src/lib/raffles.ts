// src/lib/raffles.ts
// =======================================
// Changes: None that affect logic/UI
// Ensures dynamic db client works and ticket mapping returns label + hex
// =======================================
import { getDbClient } from "@/lib/db";

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

// Fetch raffle by ID (server-side)
export async function getRaffleById(id: string): Promise<Raffle | null> {
  const client = await getDbClient();
  const res = await client.query("SELECT * FROM raffles WHERE id = $1", [id]);
  return res.rows[0] || null;
}

// Map tickets to include both colour hex and label
export function mapTickets(
  tickets: { ticket_number: number; colour: string }[],
  colours: { hex: string; name: string }[]
) {
  return tickets.map((t) => {
    const c = colours.find((col) => col.hex === t.colour) || { name: "Unknown", hex: t.colour };
    return {
      ticket_number: t.ticket_number,
      colour: c.hex,
      label: c.name, // This ensures emails and public API show label
    };
  });
}
