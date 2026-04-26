// src/lib/raffles.ts
import { query } from "./db";
import type { SafeRaffle } from "./types";

// Fetch raffle by slug for public pages
export async function getRaffleBySlug(
  slug: string,
  tenantSlug: string
): Promise<SafeRaffle | null> {
  const result = await query<SafeRaffle>(
    `
    select *
    from raffles
    where slug = $1
      and tenant_slug = $2
      and status = 'published'
    limit 1
    `,
    [slug, tenantSlug]
  );
  return result[0] ?? null;
}

// Fetch raffle by ID for admin/checkout pages
export async function getRaffleById(
  id: string,
  tenantSlug: string
): Promise<SafeRaffle | null> {
  const result = await query<SafeRaffle>(
    `
    select *
    from raffles
    where id = $1
      and tenant_slug = $2
    limit 1
    `,
    [id, tenantSlug]
  );
  return result[0] ?? null;
}

// Delete a raffle (admin)
export async function deleteRaffle(id: string, tenantSlug: string): Promise<void> {
  await query(
    `
    delete from raffles
    where id = $1
      and tenant_slug = $2
    `,
    [id, tenantSlug]
  );
}
