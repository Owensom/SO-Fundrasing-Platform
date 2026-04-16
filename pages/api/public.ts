import type { NextApiRequest, NextApiResponse } from "next";
import { queryOne, query } from "../../api/_lib/db";

type PublicCampaignRow = {
  campaign_id: string;
  tenant_id: string;
  slug: string;
  title: string;
  description: string;
  hero_image_url: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  single_ticket_price_cents: number | null;
  total_tickets: number | null;
  sold_tickets: number;
  background_image_url: string | null;
  currency_code: "GBP" | "USD" | "EUR";
  colour_selection_mode: "manual" | "automatic" | "both";
  number_selection_mode: "none" | "manual" | "automatic" | "both";
  number_range_start: number | null;
  number_range_end: number | null;
  colours: unknown;
};

type PublicOfferRow = {
  id: string;
  campaign_id: string;
  label: string;
  ticket_quantity: number;
  price_cents: number;
  sort_order: number;
  is_active: boolean;
};

function normaliseColours(input: unknown): Array<{ name: string; hex: string }> {
  if (!Array.isArray(input)) return [];

  return input
    .map((item) => {
      if (!item || typeof item !== "object") return null;

      const value = item as { name?: unknown; hex?: unknown };

      const name = String(value.name ?? "").trim();
      const hex = String(value.hex ?? "").trim();

      if (!name || !hex) return null;

      return { name, hex };
    })
    .filter((item): item is { name: string; hex: string } => Boolean(item));
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    if (req.method !== "GET") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const slug = typeof req.query.slug === "string" ? req.query.slug : "";
    const tenantSlug =
      typeof req.query.tenantSlug === "string" ? req.query.tenantSlug : "demo-a";

    if (!slug) {
      return res.status(400).json({ error: "Missing slug" });
    }

    const raffle = await queryOne<PublicCampaignRow>(
      `
      select
        c.id as campaign_id,
        c.tenant_id,
        c.slug,
        c.title,
        c.description,
        c.hero_image_url,
        c.status,
        c.created_at,
        c.updated_at,
        rc.single_ticket_price_cents,
        rc.total_tickets,
        rc.sold_tickets,
        rc.background_image_url,
        rc.currency_code,
        rc.colour_selection_mode,
        rc.number_selection_mode,
        rc.number_range_start,
        rc.number_range_end,
        rc.colours
      from campaigns c
      inner join tenants t
        on t.id = c.tenant_id
      left join raffle_configs rc
        on rc.campaign_id = c.id
      where c.type = 'raffle'
        and c.slug = $1
        and t.slug = $2
      limit 1
      `,
      [slug, tenantSlug]
    );

    if (!raffle) {
      return res.status(404).json({ error: "Raffle not found" });
    }

    const offers = await query<PublicOfferRow>(
      `
      select
        id,
        campaign_id,
        label,
        ticket_quantity,
        price_cents,
        sort_order,
        is_active
      from raffle_offers
      where campaign_id = $1
      order by sort_order asc, created_at asc
      `,
      [raffle.campaign_id]
    );

    return res.status(200).json({
      ok: true,
      item: {
        id: raffle.campaign_id,
        tenant_slug: tenantSlug,
        slug: raffle.slug,
        title: raffle.title,
        description: raffle.description ?? "",
        image_url: raffle.hero_image_url ?? "",
        background_image_url: raffle.background_image_url ?? "",
        ticket_price:
          raffle.single_ticket_price_cents != null
            ? raffle.single_ticket_price_cents / 100
            : 0,
        total_tickets: raffle.total_tickets ?? 0,
        sold_tickets: raffle.sold_tickets ?? 0,
        remaining_tickets: Math.max(
          (raffle.total_tickets ?? 0) - (raffle.sold_tickets ?? 0),
          0
        ),
        status: raffle.status,
        created_at: raffle.created_at,
        updated_at: raffle.updated_at,
        currency_code: raffle.currency_code ?? "GBP",
        colour_selection_mode: raffle.colour_selection_mode ?? "both",
        number_selection_mode: raffle.number_selection_mode ?? "none",
        number_range_start: raffle.number_range_start,
        number_range_end: raffle.number_range_end,
        colours: normaliseColours(raffle.colours),
        offers: offers.map((offer) => ({
          id: offer.id,
          label: offer.label,
          price: offer.price_cents / 100,
          tickets: offer.ticket_quantity,
          is_active: offer.is_active,
          sort_order: offer.sort_order,
        })),
      },
    });
  } catch (error: any) {
    return res.status(500).json({
      error: error?.message || "Internal server error",
    });
  }
}
