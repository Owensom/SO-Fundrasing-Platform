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

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const tenantSlug = resolveTenantSlug(req);
  const slug = req.query.slug;

  if (typeof slug !== "string") {
    return res.status(400).json({ error: "Invalid slug" });
  }

  try {
    const { query } = await import("../../../_lib/db.js");

    const body = req.body;

    const title = String(body.title || "").trim();
    const description = String(body.description || "").trim();
    const ticketPrice = Number(body.ticketPrice);
    const totalTickets = Number(body.totalTickets);
    const status = String(body.status || "draft");

    const tenantResult = await query(
      `select id from tenants where slug = $1 limit 1`,
      [tenantSlug]
    );

    const tenant = tenantResult.rows[0];

    if (!tenant) {
      return res.status(400).json({ error: "Tenant not found" });
    }

    const campaignResult = await query(
      `
      select c.id
      from campaigns c
      where c.slug = $1
        and c.tenant_id = $2
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
      [
        campaign.id,
        Math.round(ticketPrice * 100),
        totalTickets,
      ]
    );

    return res.status(200).json({ ok: true });
  } catch (error) {
    return res.status(500).json({
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
}
