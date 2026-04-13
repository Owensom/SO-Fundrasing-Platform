import type { VercelRequest, VercelResponse } from "@vercel/node";

function resolveTenantSlug(req: VercelRequest): string {
  const headerTenant = req.headers["x-tenant-slug"];
  const queryTenant = req.query.tenantSlug;

  if (typeof headerTenant === "string" && headerTenant.trim()) {
    return headerTenant.trim();
  }

  if (typeof queryTenant === "string" && queryTenant.trim()) {
    return queryTenant.trim();
  }

  return "demo-a";
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  const tenantSlug = resolveTenantSlug(req);

  try {
    const { query } = await import("../_lib/db.js");

    if (req.method === "GET") {
      const result = await query(
        `
        select
          c.id,
          c.slug,
          c.title,
          c.description,
          c.status,
          c.created_at,
          c.updated_at,
          rc.single_ticket_price_cents,
          rc.total_tickets,
          rc.sold_tickets
        from campaigns c
        join tenants t on t.id = c.tenant_id
        left join raffle_configs rc on rc.campaign_id = c.id
        where t.slug = $1
          and c.type = 'raffle'
        order by c.created_at desc
        `,
        [tenantSlug]
      );

      const raffles = result.rows.map((row: any) => {
        const remainingTickets = Math.max(
          (row.total_tickets ?? 0) - (row.sold_tickets ?? 0),
          0
        );

        return {
          id: row.id,
          tenantSlug,
          slug: row.slug,
          title: row.title,
          description: row.description ?? "",
          imageUrl: null,
          ticketPrice: (row.single_ticket_price_cents ?? 0) / 100,
          totalTickets: row.total_tickets ?? 0,
          soldTickets: row.sold_tickets ?? 0,
          remainingTickets,
          isSoldOut: remainingTickets === 0,
          status: row.status,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        };
      });

      return res.status(200).json({ raffles });
    }

    if (req.method === "POST") {
      const body =
        typeof req.body === "object" && req.body !== null ? req.body : {};

      const action = String((body as any).action || "").trim();

      const tenantResult = await query(
        `select id from tenants where slug = $1 limit 1`,
        [tenantSlug]
      );

      const tenant = tenantResult.rows[0];

      if (!tenant) {
        return res.status(400).json({ error: "Tenant not found" });
      }

      if (action === "create") {
        const title = String((body as any).title || "").trim();
        const description = String((body as any).description || "").trim();
        const ticketPrice = Number((body as any).ticketPrice);
        const totalTickets = Number((body as any).totalTickets);

        if (!title) {
          return res.status(400).json({ error: "Title is required" });
        }

        if (!Number.isFinite(ticketPrice) || ticketPrice < 0) {
          return res.status(400).json({ error: "Invalid ticket price" });
        }

        if (!Number.isFinite(totalTickets) || totalTickets < 0) {
          return res.status(400).json({ error: "Invalid total tickets" });
        }

        const slug = slugify(title);
        const campaignId = `campaign_${Date.now()}`;

        await query(
          `
          insert into campaigns (
            id, tenant_id, type, slug, title, description, status
          )
          values ($1, $2, 'raffle', $3, $4, $5, 'draft')
          `,
          [campaignId, tenant.id, slug, title, description]
        );

        await query(
          `
          insert into raffle_configs (
            campaign_id,
            single_ticket_price_cents,
            total_tickets,
            sold_tickets
          )
          values ($1, $2, $3, 0)
          `,
          [campaignId, Math.round(ticketPrice * 100), totalTickets]
        );

        return res.status(200).json({
          ok: true,
          slug,
        });
      }

      if (action === "update") {
        const slug = String((body as any).slug || "").trim();
        const title = String((body as any).title || "").trim();
        const description = String((body as any).description || "").trim();
        const ticketPrice = Number((body as any).ticketPrice);
        const totalTickets = Number((body as any).totalTickets);
        const status = String((body as any).status || "draft").trim();

        if (!slug) {
          return res.status(400).json({ error: "Slug is required" });
        }

        const campaignResult = await query(
          `
          select c.id
          from campaigns c
          where c.slug = $1
            and c.tenant_id = $2
            and c.type = 'raffle'
          limit 1
          `,
          [slug, tenant.id]
        );

        const campaign = campaignResult.rows[0];

        if (!campaign) {
          return res.status(404).json({ error: "Raffle not found" });
        }

        await query(
          `
          update campaigns
          set
            title = $2,
            description = $3,
            status = $4,
            updated_at = now()
          where id = $1
          `,
          [campaign.id, title, description, status]
        );

        await query(
          `
          update raffle_configs
          set
            single_ticket_price_cents = $2,
            total_tickets = $3,
            updated_at = now()
          where campaign_id = $1
          `,
          [campaign.id, Math.round(ticketPrice * 100), totalTickets]
        );

        return res.status(200).json({ ok: true });
      }

      if (action === "add-offer") {
        const slug = String((body as any).slug || "").trim();
        const label = String((body as any).label || "").trim();
        const ticketQuantity = Number((body as any).ticketQuantity);
        const price = Number((body as any).price);

        if (!slug) {
          return res.status(400).json({ error: "Slug is required" });
        }

        if (!label) {
          return res.status(400).json({ error: "Label is required" });
        }

        if (!Number.isInteger(ticketQuantity) || ticketQuantity <= 0) {
          return res.status(400).json({ error: "Invalid ticket quantity" });
        }

        if (!Number.isFinite(price) || price < 0) {
          return res.status(400).json({ error: "Invalid price" });
        }

        const campaignResult = await query(
          `
          select c.id
          from campaigns c
          where c.slug = $1
            and c.tenant_id = $2
            and c.type = 'raffle'
          limit 1
          `,
          [slug, tenant.id]
        );

        const campaign = campaignResult.rows[0];

        if (!campaign) {
          return res.status(404).json({ error: "Raffle not found" });
        }

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
          values ($1, $2, $3, $4, $5, 0, true)
          `,
          [
            `offer_${Date.now()}`,
            campaign.id,
            label,
            ticketQuantity,
            Math.round(price * 100),
          ]
        );

        return res.status(200).json({ ok: true });
      }

      if (action === "remove-offer") {
        const offerId = String((body as any).offerId || "").trim();

        if (!offerId) {
          return res.status(400).json({ error: "Offer ID is required" });
        }

        await query(`delete from raffle_offers where id = $1`, [offerId]);

        return res.status(200).json({ ok: true });
      }

      return res.status(400).json({ error: "Invalid action" });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (error) {
    return res.status(500).json({
      error: error instanceof Error ? error.message : "Unknown error",
      tenantSlug,
    });
  }
}
