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
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const tenantSlug = resolveTenantSlug(req);

  try {
    const { query } = await import("../../_lib/db.js");

    const body = req.body;

    const title = String(body.title || "").trim();
    const description = String(body.description || "").trim();
    const ticketPrice = Number(body.ticketPrice);
    const totalTickets = Number(body.totalTickets);

    if (!title) {
      return res.status(400).json({ error: "Title is required" });
    }

    const slug = slugify(title);

    const tenantResult = await query(
      `select id from tenants where slug = $1 limit 1`,
      [tenantSlug]
    );

    const tenant = tenantResult.rows[0];

    if (!tenant) {
      return res.status(400).json({ error: "Tenant not found" });
    }

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
      [
        campaignId,
        Math.round(ticketPrice * 100),
        totalTickets,
      ]
    );

    return res.status(200).json({
      ok: true,
      slug,
    });
  } catch (error) {
    return res.status(500).json({
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
}
