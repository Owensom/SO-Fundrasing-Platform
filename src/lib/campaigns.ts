import { query } from "./db";

export type CampaignType = "raffle" | "squares" | "event";

export type Campaign = {
  id: string;
  slug: string;
  title: string;
  description: string;
  image_url?: string;
  type: CampaignType;
  start_at?: string;
  end_at?: string;
  status: string;
  tenant_slug: string;
};

export async function listActiveCampaigns(tenantSlug: string): Promise<Campaign[]> {
  const rows = await query<Campaign>(
    `
    select id, slug, title, description, image_url, 'raffle'::text as type, status, tenant_slug
    from raffles
    where tenant_slug = $1
      and status = 'published'
    
    union all
    
    select id, slug, title, description, image_url, 'squares'::text as type, status, tenant_slug
    from squares_games
    where tenant_slug = $1
      and status = 'published'
    
    order by title asc
    `,
    [tenantSlug],
  );

  return rows;
}
