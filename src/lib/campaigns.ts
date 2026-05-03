import { query } from "@/lib/db";

export type Campaign = {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  tenant_slug: string;
  type: "raffle" | "squares" | "event";
  image_url: string | null;
  imageUrl: string | null;
  status: "draft" | "published" | "closed" | "drawn";
  created_at: string | null;
};

type CampaignRow = {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  tenant_slug: string;
  image_url: string | null;
  status: string | null;
  created_at: string | null;
};

function normaliseStatus(value: string | null | undefined): Campaign["status"] {
  const clean = String(value || "draft").toLowerCase();

  if (clean === "published") return "published";
  if (clean === "closed") return "closed";
  if (clean === "drawn") return "drawn";

  return "draft";
}

function mapCampaign(row: CampaignRow, type: Campaign["type"]): Campaign {
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    description: row.description,
    tenant_slug: row.tenant_slug,
    type,
    image_url: row.image_url,
    imageUrl: row.image_url,
    status: normaliseStatus(row.status),
    created_at: row.created_at,
  };
}

export async function getAllCampaignsForTenant(
  tenantSlug: string,
): Promise<Campaign[]> {
  const raffles = await query<CampaignRow>(
    `
      select
        id,
        title,
        slug,
        description,
        tenant_slug,
        image_url,
        status::text as status,
        created_at
      from raffles
      where tenant_slug = $1
    `,
    [tenantSlug],
  );

  const squares = await query<CampaignRow>(
    `
      select
        id,
        title,
        slug,
        description,
        tenant_slug,
        image_url,
        status::text as status,
        created_at
      from squares_games
      where tenant_slug = $1
    `,
    [tenantSlug],
  );

  const events = await query<CampaignRow>(
    `
      select
        id,
        title,
        slug,
        description,
        tenant_slug,
        image_url,
        status::text as status,
        created_at
      from events
      where tenant_slug = $1
    `,
    [tenantSlug],
  );

  return [
    ...raffles.map((row) => mapCampaign(row, "raffle")),
    ...squares.map((row) => mapCampaign(row, "squares")),
    ...events.map((row) => mapCampaign(row, "event")),
  ].sort((a, b) => {
    const aTime = new Date(a.created_at || 0).getTime();
    const bTime = new Date(b.created_at || 0).getTime();

    return bTime - aTime;
  });
}
