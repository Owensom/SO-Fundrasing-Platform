// src/lib/raffles.ts
import { query } from "./db";
import type { SafeRaffle } from "./types";

export async function getRaffleBySlug(slug: string, tenantSlug: string): Promise<SafeRaffle | null> {
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
