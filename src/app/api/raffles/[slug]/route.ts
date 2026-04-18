import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import {
  normalizeStatus,
  parseConfig,
  buildSelectionKey,
  type PublicRaffle,
} from "@/lib/raffles";
import { getTenantSlugFromRequest } from "@/lib/tenant";

export const dynamic = "force-dynamic";

type Params = {
  params: Promise<{ slug: string }>;
};

export async function GET(request: NextRequest, { params }: Params) {
  const { slug } = await params;
  const tenantSlug = getTenantSlugFromRequest(request);

  const raffles = await sql`
    select
      id,
      tenant_slug,
      slug,
      title,
      description,
      image_url,
      ticket_price_cents,
      total_tickets,
      sold_tickets,
      status,
      currency,
      config_json
    from raffles
    where tenant_slug = ${tenantSlug}
      and slug = ${slug}
    limit 1
  `;

  if (!raffles.length) {
    return NextResponse.json(
      { ok: false, error: "Raffle not found" },
      { status: 404 },
    );
  }

  const row = raffles[0];
  const status = normalizeStatus(row.status);

  if (status === "draft") {
    return NextResponse.json(
      { ok: false, error: "Raffle not found" },
      { status: 404 },
    );
  }

  const config = parseConfig(row.config_json);

  const soldRows = await sql`
    select ticket_number, colour_id
    from raffle_ticket_sales
    where raffle_id = ${row.id}
  `;

  const reservedRows = await sql`
    select ticket_number, colour_id
    from raffle_ticket_reservations
    where raffle_id = ${row.id}
      and expires_at > now()
  `;

  const soldKeys = soldRows.map((r) =>
    buildSelectionKey({
      number: Number(r.ticket_number),
      colourId: r.colour_id ?? null,
    }),
  );

  const reservedKeys = reservedRows.map((r) =>
    buildSelectionKey({
      number: Number(r.ticket_number),
      colourId: r.colour_id ?? null,
    }),
  );

  const raffle: PublicRaffle = {
    id: String(row.id),
    tenant_slug: String(row.tenant_slug),
    slug: String(row.slug),
    title: String(row.title),
    description: row.description ? String(row.description) : null,
    image_url: row.image_url ? String(row.image_url) : null,
    ticket_price_cents: Number(row.ticket_price_cents),
    total_tickets: Number(row.total_tickets),
    sold_tickets: soldRows.length,
    status,
    currency: String(row.currency || "EUR"),
    config,
  };

  return NextResponse.json({
    ok: true,
    raffle,
    availability: {
      sold: soldKeys,
      reserved: reservedKeys,
      canPurchase: status === "published",
    },
  });
}
