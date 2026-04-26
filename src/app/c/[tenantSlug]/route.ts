import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/public/campaigns/[tenantSlug]
 * Returns all published campaigns (raffles and squares) for a tenant
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { tenantSlug: string } }
) {
  try {
    const tenantSlug = params.tenantSlug;

    // Fetch published raffles
    const raffles = await query(
      `
      select id, slug, title, image_url, ticket_price_cents
      from raffles
      where tenant_slug = $1 and status = 'published'
      order by created_at desc
      `,
      [tenantSlug]
    );

    // Fetch published squares games
    const squares = await query(
      `
      select id, slug, title, image_url, (config_json->>'gridSize')::int as grid_size
      from squares_games
      where tenant_slug = $1 and status = 'published'
      order by created_at desc
      `,
      [tenantSlug]
    );

    // Combine into unified campaigns array
    const campaigns = [
      ...raffles.map((r) => ({
        id: r.id,
        slug: r.slug,
        title: r.title,
        imageUrl: r.image_url,
        type: "raffle",
        ticketPrice: r.ticket_price_cents ? r.ticket_price_cents / 100 : undefined,
      })),
      ...squares.map((s) => ({
        id: s.id,
        slug: s.slug,
        title: s.title,
        imageUrl: s.image_url,
        type: "squares",
        gridSize: s.grid_size,
      })),
    ];

    return NextResponse.json({ ok: true, campaigns });
  } catch (error: any) {
    console.error("Campaigns API error", error);

    return NextResponse.json(
      { ok: false, error: error?.message || "Failed to fetch campaigns" },
      { status: 500 }
    );
  }
}
