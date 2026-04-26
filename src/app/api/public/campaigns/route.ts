import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { extractTenantSlugFromHost } from "@/lib/tenant";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const tenantSlugParam = url.searchParams.get("tenantSlug");

    const tenantSlug =
      tenantSlugParam || extractTenantSlugFromHost(request.headers.get("host"));

    if (!tenantSlug) {
      return NextResponse.json({ ok: false, error: "Tenant slug missing" }, { status: 400 });
    }

    // Get published raffles
    const raffles = await query(
      `
      select id, slug, title, image_url, ticket_price_cents, status, config_json
      from raffles
      where tenant_slug = $1
        and status = 'published'
      order by created_at desc
      `,
      [tenantSlug]
    );

    // Get published squares games
    const squares = await query(
      `
      select id, slug, title, image_url, status, config_json
      from squares_games
      where tenant_slug = $1
        and (config_json->>'status') = 'published'
      order by created_at desc
      `,
      [tenantSlug]
    );

    // Map to unified campaign objects
    const campaigns = [
      ...raffles.map((r: any) => ({
        id: r.id,
        slug: r.slug,
        title: r.title,
        imageUrl: r.image_url ?? "",
        type: "raffle",
        ticketPrice: r.ticket_price_cents != null ? r.ticket_price_cents / 100 : 0,
        prizes: Array.isArray(r.config_json?.prizes) ? r.config_json.prizes : [],
      })),
      ...squares.map((s: any) => ({
        id: s.id,
        slug: s.slug,
        title: s.title,
        imageUrl: s.image_url ?? "",
        type: "squares",
        gridSize: s.config_json?.gridSize ?? 10,
      })),
    ];

    return NextResponse.json({ ok: true, tenantSlug, campaigns });
  } catch (error: any) {
    console.error("Public campaigns API error", error);
    return NextResponse.json({ ok: false, error: error?.message || "Failed to load campaigns" }, { status: 500 });
  }
}
