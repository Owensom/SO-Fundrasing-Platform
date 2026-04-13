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

type ColourSelection = {
  colourId: string;
  quantity: number;
};

type PurchaseBody = {
  action?: string;
  slug?: string;
  customerName?: string;
  customerEmail?: string;
  offerId?: string;
  colourSelections?: ColourSelection[];
};

function isValidEmail(value: string): boolean {
  return /\S+@\S+\.\S+/.test(value);
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

      const offersResult = await query(
        `
        select id, label, ticket_quantity, price_cents, is_active, sort_order
        from raffle_offers
        where campaign_id = $1
          and is_active = true
        order by sort_order asc, created_at asc
        `,
        [row.id]
      );

      const coloursResult = await query(
        `
        select id, name, hex_value, is_active, sort_order
        from raffle_colours
        where campaign_id = $1
          and is_active = true
        order by sort_order asc, created_at asc
        `,
        [row.id]
      );

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
        offers: offersResult.rows.map((offer: any) => ({
          id: offer.id,
          label: offer.label,
          ticketQuantity: offer.ticket_quantity,
          price: offer.price_cents / 100,
        })),
        colours: coloursResult.rows.map((colour: any) => ({
          id: colour.id,
          name: colour.name,
          hexValue: colour.hex_value,
        })),
      });
    }

    if (req.method === "POST") {
      const body =
        typeof req.body === "object" && req.body !== null ? req.body : {};

      const action = String((body as PurchaseBody).action || "").trim();

      if (action !== "purchase") {
        return res.status(400).json({ error: "Invalid action" });
      }

      const slug = String((body as PurchaseBody).slug || "").trim();
      const customerName = String((body as PurchaseBody).customerName || "").trim();
      const customerEmail = String((body as PurchaseBody).customerEmail || "").trim();
      const offerId = String((body as PurchaseBody).offerId || "").trim();
      const colourSelectionsRaw = Array.isArray((body as PurchaseBody).colourSelections)
        ? ((body as PurchaseBody).colourSelections as ColourSelection[])
        : [];

      if (!slug) {
        return res.status(400).json({ error: "Slug is required." });
      }

      if (!customerName) {
        return res.status(400).json({ error: "Customer name is required." });
      }

      if (!customerEmail || !isValidEmail(customerEmail)) {
        return res.status(400).json({ error: "A valid customer email is required." });
      }

      if (!offerId) {
        return res.status(400).json({ error: "Offer is required." });
      }

      const colourSelections = colourSelectionsRaw
        .map((item) => ({
          colourId: String(item.colourId || "").trim(),
          quantity: Number(item.quantity),
        }))
        .filter((item) => item.colourId && Number.isInteger(item.quantity) && item.quantity > 0);

      const selectedQuantity = colourSelections.reduce(
        (sum, item) => sum + item.quantity,
        0
      );

      if (selectedQuantity <= 0) {
        return res.status(400).json({ error: "Please choose at least one colour." });
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

        let requiredQuantity = 1;
        let unitPriceCents = raffleRow.single_ticket_price_cents ?? 0;
        let totalAmountCents = unitPriceCents;

        if (offerId === "single-ticket") {
          requiredQuantity = 1;
          totalAmountCents = unitPriceCents;
        } else {
          const offerResult = await client.query(
            `
            select id, ticket_quantity, price_cents
            from raffle_offers
            where id = $1
              and campaign_id = $2
              and is_active = true
            limit 1
            `,
            [offerId, raffleRow.id]
          );

          const offerRow = offerResult.rows[0];

          if (!offerRow) {
            return { ok: false, status: 400, message: "Offer not found." };
          }

          requiredQuantity = offerRow.ticket_quantity;
          totalAmountCents = offerRow.price_cents;
          unitPriceCents = Math.floor(totalAmountCents / requiredQuantity);
        }

        if (selectedQuantity !== requiredQuantity) {
          return {
            ok: false,
            status: 400,
            message: `Your colour selections must add up to ${requiredQuantity} ticket(s).`,
          };
        }

        if (requiredQuantity > remainingTickets) {
          return {
            ok: false,
            status: 409,
            message: `Only ${remainingTickets} ticket(s) remaining.`,
          };
        }

        const colourIds = colourSelections.map((item) => item.colourId);
        const coloursResult = await client.query(
          `
          select id
          from raffle_colours
          where campaign_id = $1
            and is_active = true
            and id = any($2)
          `,
          [raffleRow.id, colourIds]
        );

        const validColourIds = new Set(coloursResult.rows.map((row: any) => row.id));

        if (validColourIds.size !== colourIds.length) {
          return {
            ok: false,
            status: 400,
            message: "One or more selected colours are invalid.",
          };
        }

        const orderId = `order_${Date.now()}`;

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

        for (const selection of colourSelections) {
          const selectionTotalPrice = unitPriceCents * selection.quantity;

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
              $4,
              $5,
              $6,
              $7,
              now()
            from tenants t
            where t.slug = $8
            `,
            [
              `entry_${Date.now()}_${selection.colourId}`,
              raffleRow.id,
              orderId,
              selection.colourId,
              selection.quantity,
              unitPriceCents,
              selectionTotalPrice,
              tenantSlug,
            ]
          );
        }

        return {
          ok: true,
          purchase: {
            id: orderInsert.rows[0].id,
            customerName,
            customerEmail,
            quantity: requiredQuantity,
            totalPrice: totalAmountCents / 100,
            paymentStatus: "pending",
          },
          raffle: {
            id: raffleRow.id,
            slug: raffleRow.slug,
            title: raffleRow.title,
            description: raffleRow.description,
            ticketPrice: (raffleRow.single_ticket_price_cents ?? 0) / 100,
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
