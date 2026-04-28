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
  status: "draft" | "published" | "closed" | "drawn";
};

export async function getCampaignBySlug(slug: string): Promise<Campaign | null> {
  return queryOne<Campaign>(
    `
    select *
    from (
      select
        id,
        title,
        slug,
        description,
        tenant_slug,
        'raffle' as type,
        image_url,
        image_url as "imageUrl",
        status,
        created_at
      from raffles

      union all

      select
        id,
        title,
        slug,
        description,
        tenant_slug,
        'squares' as type,
        image_url,
        image_url as "imageUrl",
        status,
        created_at
      from squares_games
    ) campaigns
    where slug = $1
    order by created_at desc
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
      tenant_slug,
      type,
      image_url,
      "imageUrl",
      status
    from (
      select
        id,
        title,
        slug,
        description,
        tenant_slug,
        'raffle' as type,
        image_url,
        image_url as "imageUrl",
        status,
        created_at
      from raffles
      where tenant_slug = $1

      union all

      select
        id,
        title,
        slug,
        description,
        tenant_slug,
        'squares' as type,
        image_url,
        image_url as "imageUrl",
        status,
        created_at
      from squares_games
      where tenant_slug = $1
    ) campaigns
    order by created_at desc
    `,
    [tenantSlug],
  );
}
