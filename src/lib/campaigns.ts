// src/lib/campaigns.ts
import { query } from "./db";

export type Campaign = {
  id: string;
  type: "raffle" | "squares" | "event";
  title: string;
  slug: string;
  status: "draft" | "published" | "closed" | "drawn";
  description?: string;
  imageUrl?: string;
};

/**
 * Fetch all campaigns for a tenant.
 * Returns an array of Campaign objects.
 */
export async function getAllCampaignsForTenant(tenantSlug: string): Promise<Campaign[]> {
  const rows = await query<any>(
    `
    SELECT 
      id,
      type,
      title,
      slug,
      status,
      description,
      image_url AS "imageUrl"
    FROM campaigns
    WHERE tenant_slug = $1
    ORDER BY created_at DESC
    `,
    [tenantSlug]
  );

  return (rows ?? []).map((row: any) => ({
    id: String(row.id),
    type: row.type as "raffle" | "squares" | "event",
    title: String(row.title ?? "Untitled"),
    slug: String(row.slug ?? ""),
    status: row.status as "draft" | "published" | "closed" | "drawn",
    description: row.description ? String(row.description) : undefined,
    imageUrl: row.imageUrl ? String(row.imageUrl) : undefined,
  }));
}
