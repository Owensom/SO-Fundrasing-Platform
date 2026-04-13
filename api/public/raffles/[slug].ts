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
  const tenantSlug = resolveTenantSlug(req);
  const slug = req.query.slug;

  if (typeof slug !== "string") {
    return res.status(400).json({ error: "Invalid slug" });
  }

  try {
    const db = await import("../../_lib/db.js");

    const result = await db.query(
      `
      select
        c.id,
        c.slug,
        c.title,
        c.description,
        c.status,
        rc.single_ticket_price_cents,
        rc.total_tickets,
        rc.sold_tickets
      from campaigns c
      join tenants t on t.id = c.tenant_id
      join raffle_configs rc on rc.campaign_id = c.id
      where t.slug = $1
        and c.slug = $2
        and c.type = 'raffle'
      limit 1
      `,
      [tenantSlug, slug]
    );

    const row = result.rows[0];

    if (!row) {
      return res.status(404).json({ error: "Raffle not found" });
    }

    const remaining = Math.max(
      (row.total_tickets || 0) - (row.sold_tickets || 0),
      0
    );

    return res.status(200).json({
      raffle: {
        id: row.id,
        slug: row.slug,
        title: row.title,
        description: row.description,
        ticketPrice: (row.single_ticket_price_cents || 0) / 100,
        totalTickets: row.total_tickets || 0,
        soldTickets: row.sold_tickets || 0,
        remainingTickets: remaining,
        isSoldOut: remaining === 0,
        status: row.status,
      },
    });
  } catch (error) {
    return res.status(500).json({
      error: error instanceof Error ? error.message : "Server error",
      tenantSlug,
      slug,
    });
  }
}
