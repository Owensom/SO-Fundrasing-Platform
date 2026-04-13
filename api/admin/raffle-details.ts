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
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const tenantSlug = resolveTenantSlug(req);
  const slug = req.query.slug;

  if (typeof slug !== "string" || !slug.trim()) {
    return res.status(400).json({ error: "Invalid raffle slug." });
  }

  try {
    const { query } = await import("../_lib/db.js");

    const raffleResult = await query(
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
      join raffle_configs rc on rc.campaign_id = c.id
      where t.slug = $1
        and c.slug = $2
        and c.type = 'raffle'
      limit 1
      `,
      [tenantSlug, slug]
    );

    const row = raffleResult.rows[0];

    if (!row) {
      return res.status(404).json({ error: "Raffle not found." });
    }

    const purchasesResult = await query(
      `
      select
        o.id,
        $1 as tenant_slug,
        c.id as raffle_id,
        c.slug as raffle_slug,
        o.customer_name,
        o.customer_email,
        coalesce(sum(re.quantity), 0)::int as quantity,
        case
          when coalesce(sum(re.quantity), 0) > 0
            then floor(o.total_amount_cents / coalesce(sum(re.quantity), 1))
          else 0
        end::int as unit_price_cents,
        o.total_amount_cents,
        o.payment_status,
        o.paid_at,
        o.created_at,
        o.updated_at
      from orders o
      join campaigns c on c.id = o.campaign_id
      left join raffle_entries re on re.order_id = o.id
      where c.id = $2
      group by
        o.id,
        c.id,
        c.slug,
        o.customer_name,
        o.customer_email,
        o.total_amount_cents,
        o.payment_status,
        o.paid_at,
        o.created_at,
        o.updated_at
      order by o.created_at desc
      `,
      [tenantSlug, row.id]
    );

    const purchases = purchasesResult.rows.map((purchase: any) => ({
      id: purchase.id,
      tenantSlug: purchase.tenant_slug,
      raffleId: purchase.raffle_id,
      raffleSlug: purchase.raffle_slug,
      customerName: purchase.customer_name,
      customerEmail: purchase.customer_email,
      quantity: purchase.quantity,
      unitPrice: purchase.unit_price_cents / 100,
      totalPrice: purchase.total_amount_cents / 100,
      paymentStatus: purchase.payment_status,
      paidAt: purchase.paid_at,
      createdAt: purchase.created_at,
      updatedAt: purchase.updated_at,
    }));

    const soldTickets = purchases.reduce((total: number, purchase: any) => {
      return purchase.paymentStatus === "paid"
        ? total + purchase.quantity
        : total;
    }, 0);

    const raffle = {
      id: row.id,
      tenantSlug,
      slug: row.slug,
      title: row.title,
      description: row.description ?? "",
      imageUrl: null,
      ticketPrice: (row.single_ticket_price_cents ?? 0) / 100,
      totalTickets: row.total_tickets ?? 0,
      soldTickets: row.sold_tickets ?? 0,
      remainingTickets: Math.max(
        (row.total_tickets ?? 0) - (row.sold_tickets ?? 0),
        0
      ),
      isSoldOut:
        Math.max((row.total_tickets ?? 0) - (row.sold_tickets ?? 0), 0) === 0,
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };

    return res.status(200).json({
      raffle,
      purchases,
      summary: {
        totalTickets: raffle.totalTickets,
        soldTickets,
        remainingTickets: Math.max(raffle.totalTickets - soldTickets, 0),
        purchaseCount: purchases.length,
      },
    });
  } catch (error) {
    return res.status(500).json({
      error: error instanceof Error ? error.message : "Unknown runtime error",
      tenantSlug,
      slug,
    });
  }
}
