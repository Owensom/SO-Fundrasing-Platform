import { query, queryOne } from "@/lib/db";

export type Campaign = {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  tenant_slug: string;
  type: "raffle" | "squares" | "event";
  image_url?: string | null;
  imageUrl?: string | null;
  status: "draft" | "published" | "closed" | "drawn";
  created_at?: string;
};

type CampaignRow = Omit<Campaign, "type" | "imageUrl"> & {
  image_url?: string | null;
};

function mapCampaign(
  row: CampaignRow,
  type: Campaign["type"],
): Campaign {
  return {
    ...row,
    type,
    imageUrl: row.image_url ?? null,
  };
}

export async function getCampaignBySlug(slug: string): Promise<Campaign | null> {
  const raffle = await queryOne<CampaignRow>(
    `
      select
        id,
        title,
        slug,
        description,
        tenant_slug,
        image_url,
        status,
        created_at
      from raffles
      where slug = $1
      limit 1
    `,
    [slug],
  );

  if (raffle) return mapCampaign(raffle, "raffle");

  const squares = await queryOne<CampaignRow>(
    `
      select
        id,
        title,
        slug,
        description,
        tenant_slug,
        image_url,
        status,
        created_at
      from squares_games
      where slug = $1
      limit 1
    `,
    [slug],
  );

  if (squares) return mapCampaign(squares, "squares");

  const event = await queryOne<CampaignRow>(
    `
      select
        id,
        title,
        slug,
        description,
        tenant_slug,
        image_url,
        status,
        created_at
      from events
      where slug = $1
      limit 1
    `,
    [slug],
  );

  if (event) return mapCampaign(event, "event");

  return null;
}

export async function getAllCampaignsForTenant(
  tenantSlug: string,
): Promise<Campaign[]> {
  const [raffles, squares, events] = await Promise.all([
    query<CampaignRow>(
      `
        select
          id,
          title,
          slug,
          description,
          tenant_slug,
          image_url,
          status,
          created_at
        from raffles
        where tenant_slug = $1
      `,
      [tenantSlug],
    ),

    query<CampaignRow>(
      `
        select
          id,
          title,
          slug,
          description,
          tenant_slug,
          image_url,
          status,
          created_at
        from squares_games
        where tenant_slug = $1
      `,
      [tenantSlug],
    ),

    query<CampaignRow>(
      `
        select
          id,
          title,
          slug,
          description,
          tenant_slug,
          image_url,
          status,
          created_at
        from events
        where tenant_slug = $1
      `,
      [tenantSlug],
    ),
  ]);

  return [
    ...raffles.map((row) => mapCampaign(row, "raffle")),
    ...squares.map((row) => mapCampaign(row, "squares")),
    ...events.map((row) => mapCampaign(row, "event")),
  ].sort((a, b) => {
    const aTime = new Date(a.created_at ?? 0).getTime();
    const bTime = new Date(b.created_at ?? 0).getTime();

    return bTime - aTime;
  });
}
