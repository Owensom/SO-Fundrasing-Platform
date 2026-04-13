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

  try {
    const { query } = await import("../../_lib/db.js");

    const result = await query(
      `
      select
        c.id,
        c.slug,
        c.title,
        c.status,
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
      const remaining = Math.max(
        (row.total_tickets ?? 0) - (row.sold_tickets ?? 0),
        0
      );

      return {
        id: row.id,
        slug: row.slug,
        title: row.title,
        status: row.status,
        ticketPrice: (row.single_ticket_price_cents ?? 0) / 100,
        totalTickets: row.total_tickets ?? 0,
        soldTickets: row.sold_tickets ?? 0,
        remainingTickets: remaining,
        isSoldOut: remaining === 0,
      };
    });

    return res.status(200).json({ raffles });
  } catch (error) {
    return res.status(500).json({
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
}
