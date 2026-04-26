// src/lib/raffles.ts
import { query } from "./db";

export type Raffle = {
  id: string;
  tenant_slug: string;
  slug: string;
  title: string;
  description: string;
  image_url?: string | null;
  ticket_price: number;
  total_tickets: number;
  sold_tickets: number;
  status: "draft" | "published" | "closed" | "drawn";
  currency: string;
  config_json: {
    startNumber?: number;
    endNumber?: number;
    colours?: { id: string; name: string; hex?: string }[];
    offers?: { id: string; label: string; price: number; quantity: number; isActive?: boolean }[];
    prizes?: { position: number; title: string; description?: string; isPublic?: boolean }[];
  };
};

export async function getRaffleById(tenantSlug: string, id: string): Promise<Raffle | null> {
  const raffle = await query<Raffle>(
    `SELECT * FROM raffles WHERE id = $1 AND tenant_slug = $2 LIMIT 1`,
    [id, tenantSlug]
  );
  return raffle[0] ?? null;
}

export async function getRaffleBySlug(tenantSlug: string, slug: string): Promise<Raffle | null> {
  const raffle = await query<Raffle>(
    `SELECT * FROM raffles WHERE slug = $1 AND tenant_slug = $2 LIMIT 1`,
    [slug, tenantSlug]
  );
  return raffle[0] ?? null;
}
