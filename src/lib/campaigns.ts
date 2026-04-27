import { query, queryOne } from "@/lib/db";

export type Campaign = {
  id: string;
  title: string;
  slug: string;
  description: string;
  tenant_slug: string;
  type: "raffle" | "squares" | "event";
  image_url?: string;
  imageUrl?: string;
  start_date?: string;
  end_date?: string;
  status: "draft" | "published" | "closed" | "drawn";
};

export async function getCampaignBySlug(slug: string): Promise<Campaign | null> {
  return queryOne<Campaign>(
    `
    select
      id,
      title,
      slug,
      description,
      tenant_id as tenant_slug,
      type,
      hero_image_url as image_url,
      hero_image_url as "imageUrl",
      starts_at as start_date,
      ends_at as end_date,
      status
    from campaigns
    where slug = $1
    limit 1
    `,
    [slug],
  );
}

export async function getAllCampaignsForTenant(
  tenantSlug: string,
): Promise<Campaign[]> {
  return query<Campaign>(
    `
    select
      id,
      title,
      slug,
      description,
      tenant_id as tenant_slug,
      type,
      hero_image_url as image_url,
      hero_image_url as "imageUrl",
      starts_at as start_date,
      ends_at as end_date,
      status
    from campaigns
    where tenant_id = $1
    order by starts_at desc nulls last, created_at desc
    `,
    [tenantSlug],
  );
}
