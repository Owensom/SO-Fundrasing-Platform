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

type PurchaseBody = {
  action?: string;
  slug?: string;
  customerName?: string;
  customerEmail?: string;
  quantity?: number | string;
};

function parseQuantity(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return null;
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  const tenantSlug = resolveTenantSlug(req);

  try {
    const { query, withTransaction } = await import("../_lib/db.js");

    if (req.method === "GET") {
      const slug = req.query.slug;

      if (typeof slug !== "string" || !slug.trim()) {
        return res.status(400).json({ error: "Invalid slug" });
      }

      const result = await query(
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

      const ticketPrice = (row.single_ticket_price_cents ?? 0) / 100;
      const remainingTickets = Math.max(
        (row.total_tickets ?? 0) - (row.sold_tickets ?? 0),
        0
      );

      return res.status(200).json({
        raffle: {
          id: row.id,
          slug: row.slug,
          title: row.title,
          description: row.description,
          ticketPrice,
          totalTickets: row.total_tickets,
          soldTickets: row.sold_tickets,
          remainingTickets,
          isSoldOut: remainingTickets === 0,
          status: row.status,
        },
      });
    }

    if (req.method === "POST") {
      const body =
        typeof req.body === "object" && req.body !== null
          ? (req.body as PurchaseBody)
          : {};

      const action = String(body.action || "").trim();

      if (action !== "purchase") {
        return res.status(400).json({ error: "Invalid action" });
      }

      const slug = String(body.slug || "").trim();
      const customerName = String(body.customerName || "").trim();
      const customerEmail = String(body.customerEmail || "").trim();
      const quantity = parseQuantity(body.quantity);

      if (!slug) {
        return res.status(400).json({ error: "Slug is required." });
      }

      if (!customerName) {
        return res.status(400).json({ error: "Customer name is required." });
      }

      if (!customerEmail) {
        return res.status(400).json({ error: "Customer email is required." });
      }

      if (quantity === null || !Number.isInteger(quantity) || quantity <= 0) {
        return res
          .status(400)
          .json({ error: "Quantity must be a whole number." });
      }

      const result = await withTransaction(async (client: any) => {
        const raffleResult = await client.query(
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

        const raffleRow = raffleResult.rows[0];

        if (!raffleRow) {
          return { ok: false, status: 404, message: "Raffle not found." };
        }

        if (raffleRow.status !== "published") {
          return {
            ok: false,
            status: 400,
            message: "Raffle is not open for sales.",
          };
        }

        const remainingTickets = Math.max(
          raffleRow.total_tickets - raffleRow.sold_tickets,
          0
        );

        if (quantity > remainingTickets) {
          return {
            ok: false,
            status: 409,
            message: `Only ${remainingTickets} ticket(s) remaining.`,
          };
        }

        const orderId = `order_${Date.now()}`;
        const unitPriceCents = raffleRow.single_ticket_price_cents ?? 0;
        const totalAmountCents = unitPriceCents * quantity;

        const orderInsert = await client.query(
          `
          insert into orders (
            id,
            tenant_id,
            campaign_id,
            customer_name,
            customer_email,
            total_amount_cents,
            currency,
            payment_status,
            created_at,
            updated_at
          )
          select
            $1,
            t.id,
            $2,
            $3,
            $4,
            $5,
            'GBP',
            'pending',
            now(),
            now()
          from tenants t
          where t.slug = $6
          returning *
          `,
          [
            orderId,
            raffleRow.id,
            customerName,
            customerEmail.toLowerCase(),
            totalAmountCents,
            tenantSlug,
          ]
        );

        await client.query(
          `
          insert into raffle_entries (
            id,
            tenant_id,
            campaign_id,
            order_id,
            colour_id,
            quantity,
            unit_price_cents,
            total_price_cents,
            created_at
          )
          select
            $1,
            t.id,
            $2,
            $3,
            null,
            $4,
            $5,
            $6,
            now()
          from tenants t
          where t.slug = $7
          `,
          [
            `entry_${Date.now()}`,
            raffleRow.id,
            orderId,
            quantity,
            unitPriceCents,
            totalAmountCents,
            tenantSlug,
          ]
        );

        return {
          ok: true,
          purchase: {
            id: orderInsert.rows[0].id,
            customerName,
            customerEmail,
            quantity,
            totalPrice: totalAmountCents / 100,
            paymentStatus: "pending",
          },
          raffle: {
            id: raffleRow.id,
            slug: raffleRow.slug,
            title: raffleRow.title,
            description: raffleRow.description,
            ticketPrice: unitPriceCents / 100,
            totalTickets: raffleRow.total_tickets,
            soldTickets: raffleRow.sold_tickets,
            remainingTickets,
            isSoldOut: remainingTickets === 0,
            status: raffleRow.status,
          },
        };
      });

      if ((result as any).ok === false) {
        return res.status((result as any).status).json({
          error: (result as any).message,
        });
      }

      return res.status(200).json(result);
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (error) {
    return res.status(500).json({
      error: error instanceof Error ? error.message : "Unknown error",
      tenantSlug,
    });
  }
}
