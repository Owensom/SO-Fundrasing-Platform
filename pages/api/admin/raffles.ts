import type { NextApiRequest, NextApiResponse } from "next";
import { query, queryOne } from "../../../api/_lib/db";

type TenantRow = {
  id: string;
  slug: string;
};

type CampaignListRow = {
  id: string;
  tenant_slug: string;
  slug: string;
  title: string;
  description: string;
  hero_image_url: string | null;
  status: "draft" | "published" | "closed" | "archived";
  created_at: string;
  updated_at: string;
  single_ticket_price_cents: number | null;
  total_tickets: number | null;
  sold_tickets: number;
};

type OfferInput = {
  label: string;
  tickets: number;
  price: number;
  is_active: boolean;
  sort_order: number;
};

function toOfferInput(input: any, index: number): OfferInput {
  return {
    label: String(input?.label || input?.name || "").trim(),
    tickets:
      input?.tickets != null
        ? Number(input.tickets)
        : Number(input?.entryCount || input?.ticket_quantity || 0),
    price:
      input?.price != null
        ? Number(input.price)
        : input?.priceCents != null
        ? Number(input.priceCents) / 100
        : input?.price_cents != null
        ? Number(input.price_cents) / 100
        : 0,
    is_active:
      input?.is_active != null
        ? Boolean(input.is_active)
        : Boolean(input?.isActive ?? true),
    sort_order:
      input?.sort_order != null
        ? Number(input.sort_order)
        : input?.sortOrder != null
        ? Number(input.sortOrder)
        : index,
  };
}

function normaliseColours(input: any): Array<{ name: string; hex: string }> {
  if (!Array.isArray(input)) return [];

  return input
    .map((item) => {
      if (!item || typeof item !== "object") return null;

      const name = String(item.name ?? "").trim();
      const hex = String(item.hex ?? "").trim();

      if (!name || !hex) return null;

      return { name, hex };
    })
    .filter(Boolean) as Array<{ name: string; hex: string }>;
}

async function getTenantIdBySlug(tenantSlug: string): Promise<string> {
  const tenant = await queryOne<TenantRow>(
    `
    select id, slug
    from tenants
    where slug = $1
    limit 1
    `,
    [tenantSlug]
  );

  if (!tenant) {
    throw new Error(`Tenant not found for slug "${tenantSlug}"`);
  }

  return tenant.id;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    if (req.method === "GET") {
      const tenantSlug =
        typeof req.query.tenantSlug === "string" ? req.query.tenantSlug : "demo-a";

      const rows = await query<CampaignListRow>(
        `
        select
          c.id,
          t.slug as tenant_slug,
          c.slug,
          c.title,
          c.description,
          c.hero_image_url,
          c.status,
          c.created_at,
          c.updated_at,
          rc.single_ticket_price_cents,
          rc.total_tickets,
          rc.sold_tickets
        from campaigns c
        inner join tenants t
          on t.id = c.tenant_id
        left join raffle_configs rc
          on rc.campaign_id = c.id
        where c.type = 'raffle'
          and t.slug = $1
        order by c.created_at desc
        `,
        [tenantSlug]
      );

      return res.status(200).json({
        raffles: rows.map((item) => {
          const totalTickets = item.total_tickets ?? 0;
          const soldTickets = item.sold_tickets ?? 0;
          const remainingTickets = Math.max(totalTickets - soldTickets, 0);

          return {
            id: item.id,
            tenantSlug: item.tenant_slug,
            slug: item.slug,
            title: item.title,
            description: item.description,
            imageUrl: item.hero_image_url || null,
            ticketPrice: item.single_ticket_price_cents
              ? item.single_ticket_price_cents / 100
              : 0,
            totalTickets,
            soldTickets,
            remainingTickets,
            isSoldOut: remainingTickets <= 0,
            status: item.status,
            createdAt: item.created_at,
            updatedAt: item.updated_at,
          };
        }),
      });
    }

    if (req.method === "POST") {
      const body = req.body ?? {};

      const tenantSlug = String(body.tenantSlug || "demo-a").trim();
      const title = String(body.title || "").trim();
      const slug = String(body.slug || "").trim();
      const description = String(body.description || "");
      const heroImageUrl = String(body.heroImageUrl || body.imageUrl || "");
      const status = String(body.status || "published") as
        | "draft"
        | "published"
        | "closed"
        | "archived";
      const ticketPrice = Number(body.ticketPrice || 0);
      const totalTickets = Number(body.totalTickets || 0);
      const soldTickets = Number(body.soldTickets || 0);
      const backgroundImageUrl = String(body.backgroundImageUrl || "");
      const currencyCode = String(body.currencyCode || "GBP");
      const colourSelectionMode = String(body.colourSelectionMode || "both");
      const numberSelectionMode = String(body.numberSelectionMode || "none");
      const numberRangeStart =
        body.numberRangeStart == null ? null : Number(body.numberRangeStart);
      const numberRangeEnd =
        body.numberRangeEnd == null ? null : Number(body.numberRangeEnd);
      const colours = normaliseColours(body.colours);
      const offers = Array.isArray(body.offers)
        ? body.offers.map((offer: any, index: number) => toOfferInput(offer, index))
        : [];

      if (!title) {
        return res.status(400).json({ error: "Title is required" });
      }

      if (!slug) {
        return res.status(400).json({ error: "Slug is required" });
      }

      const tenantId = await getTenantIdBySlug(tenantSlug);
      const campaignId = crypto.randomUUID();

      await query(
        `
        insert into campaigns (
          id,
          tenant_id,
          type,
          slug,
          title,
          description,
          hero_image_url,
          status
        )
        values ($1, $2, 'raffle', $3, $4, $5, $6, $7)
        `,
        [campaignId, tenantId, slug, title, description, heroImageUrl, status]
      );

      await query(
        `
        insert into raffle_configs (
          campaign_id,
          single_ticket_price_cents,
          total_tickets,
          sold_tickets,
          background_image_url,
          currency_code,
          colour_selection_mode,
          number_selection_mode,
          number_range_start,
          number_range_end,
          colours
        )
        values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb)
        `,
        [
          campaignId,
          Math.round(ticketPrice * 100),
          totalTickets,
          soldTickets,
          backgroundImageUrl,
          currencyCode,
          colourSelectionMode,
          numberSelectionMode,
          numberRangeStart,
          numberRangeEnd,
          JSON.stringify(colours),
        ]
      );

      for (let index = 0; index < offers.length; index += 1) {
        const offer = offers[index];

        await query(
          `
          insert into raffle_offers (
            id,
            campaign_id,
            label,
            ticket_quantity,
            price_cents,
            sort_order,
            is_active
          )
          values ($1, $2, $3, $4, $5, $6, $7)
          `,
          [
            crypto.randomUUID(),
            campaignId,
            offer.label,
            offer.tickets,
            Math.round(offer.price * 100),
            offer.sort_order,
            offer.is_active,
          ]
        );
      }

      return res.status(201).json({
        raffle: {
          id: campaignId,
          tenantSlug,
          slug,
          title,
          description,
          imageUrl: heroImageUrl || null,
          ticketPrice,
          totalTickets,
          soldTickets,
          remainingTickets: Math.max(totalTickets - soldTickets, 0),
          isSoldOut: soldTickets >= totalTickets,
          status,
        },
      });
    }

    if (req.method === "PUT") {
      const body = req.body ?? {};
      const id = String(body.id || "").trim();

      if (!id) {
        return res.status(400).json({ error: "Missing raffle id" });
      }

      const tenantSlug = String(body.tenantSlug || "demo-a").trim();
      const title = String(body.title || "").trim();
      const slug = String(body.slug || "").trim();
      const description = String(body.description || "");
      const heroImageUrl = String(body.heroImageUrl || body.imageUrl || "");
      const status = String(body.status || "published") as
        | "draft"
        | "published"
        | "closed"
        | "archived";
      const ticketPrice = Number(body.ticketPrice || 0);
      const totalTickets = Number(body.totalTickets || 0);
      const soldTickets = Number(body.soldTickets || 0);
      const backgroundImageUrl = String(body.backgroundImageUrl || "");
      const currencyCode = String(body.currencyCode || "GBP");
      const colourSelectionMode = String(body.colourSelectionMode || "both");
      const numberSelectionMode = String(body.numberSelectionMode || "none");
      const numberRangeStart =
        body.numberRangeStart == null ? null : Number(body.numberRangeStart);
      const numberRangeEnd =
        body.numberRangeEnd == null ? null : Number(body.numberRangeEnd);
      const colours = normaliseColours(body.colours);
      const offers = Array.isArray(body.offers)
        ? body.offers.map((offer: any, index: number) => toOfferInput(offer, index))
        : [];

      if (!title) {
        return res.status(400).json({ error: "Title is required" });
      }

      if (!slug) {
        return res.status(400).json({ error: "Slug is required" });
      }

      const tenantId = await getTenantIdBySlug(tenantSlug);

      const existing = await queryOne<{ id: string }>(
        `
        select id
        from campaigns
        where id = $1
          and type = 'raffle'
        limit 1
        `,
        [id]
      );

      if (!existing) {
        return res.status(404).json({ error: "Raffle not found" });
      }

      await query(
        `
        update campaigns
        set
          tenant_id = $2,
          slug = $3,
          title = $4,
          description = $5,
          hero_image_url = $6,
          status = $7,
          updated_at = now()
        where id = $1
        `,
        [id, tenantId, slug, title, description, heroImageUrl, status]
      );

      await query(
        `
        insert into raffle_configs (
          campaign_id,
          single_ticket_price_cents,
          total_tickets,
          sold_tickets,
          background_image_url,
          currency_code,
          colour_selection_mode,
          number_selection_mode,
          number_range_start,
          number_range_end,
          colours
        )
        values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb)
        on conflict (campaign_id)
        do update set
          single_ticket_price_cents = excluded.single_ticket_price_cents,
          total_tickets = excluded.total_tickets,
          sold_tickets = excluded.sold_tickets,
          background_image_url = excluded.background_image_url,
          currency_code = excluded.currency_code,
          colour_selection_mode = excluded.colour_selection_mode,
          number_selection_mode = excluded.number_selection_mode,
          number_range_start = excluded.number_range_start,
          number_range_end = excluded.number_range_end,
          colours = excluded.colours,
          updated_at = now()
        `,
        [
          id,
          Math.round(ticketPrice * 100),
          totalTickets,
          soldTickets,
          backgroundImageUrl,
          currencyCode,
          colourSelectionMode,
          numberSelectionMode,
          numberRangeStart,
          numberRangeEnd,
          JSON.stringify(colours),
        ]
      );

      await query(`delete from raffle_offers where campaign_id = $1`, [id]);

      for (let index = 0; index < offers.length; index += 1) {
        const offer = offers[index];

        await query(
          `
          insert into raffle_offers (
            id,
            campaign_id,
            label,
            ticket_quantity,
            price_cents,
            sort_order,
            is_active
          )
          values ($1, $2, $3, $4, $5, $6, $7)
          `,
          [
            crypto.randomUUID(),
            id,
            offer.label,
            offer.tickets,
            Math.round(offer.price * 100),
            offer.sort_order,
            offer.is_active,
          ]
        );
      }

      return res.status(200).json({
        raffle: {
          id,
          tenantSlug,
          slug,
          title,
          description,
          imageUrl: heroImageUrl || null,
          ticketPrice,
          totalTickets,
          soldTickets,
          remainingTickets: Math.max(totalTickets - soldTickets, 0),
          isSoldOut: soldTickets >= totalTickets,
          status,
        },
      });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (error: any) {
    return res.status(500).json({
      error: error?.message || "Internal server error",
    });
  }
}
