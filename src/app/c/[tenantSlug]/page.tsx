// File: src/app/api/public/campaigns/[tenantSlug]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: { tenantSlug: string } }
) {
  try {
    const tenantSlug = params.tenantSlug;

    if (!tenantSlug) {
      return NextResponse.json(
        { ok: false, error: "Tenant slug is required" },
        { status: 400 }
      );
    }

    // Fetch active raffles
    const raffles = await query<{
      id: string;
      slug: string;
      title: string;
      image_url: string | null;
      ticket_price_cents: number;
      status: string;
      config_json: any;
    }>(
      `
      select id, slug, title, image_url, ticket_price_cents, status, config_json
      from raffles
      where tenant_slug = $1
        and status = 'published'
      order by created_at desc
      `,
      [tenantSlug]
    );

    // Map raffles to front-end shape
    const raffleCampaigns = raffles.map((r) => ({
      id: r.id,
      slug: r.slug,
      title: r.title,
      imageUrl: r.image_url ?? "",
      type: "raffle" as const,
      ticketPrice: r.ticket_price_cents != null ? r.ticket_price_cents / 100 : 0,
      prizes: Array.isArray(r.config_json?.prizes) ? r.config_json.prizes : [],
    }));

    // Fetch active squares
    const squares = await query<{
      id: string;
      slug: string;
      title: string;
      image_url: string | null;
      config_json: any;
      status: string;
    }>(
      `
      select id, slug, title, image_url, config_json, status
      from squares_games
      where tenant_slug = $1
        and status = 'published'
      order by created_at desc
      `,
      [tenantSlug]
    );

    const squareCampaigns = squares.map((s) => ({
      id: s.id,
      slug: s.slug,
      title: s.title,
      imageUrl: s.image_url ?? "",
      type: "squares" as const,
      gridSize: s.config_json?.gridSize ?? s.config_json?.size ?? null,
    }));

    // TODO: Fetch events in future
    const eventsCampaigns: any[] = [];

    const campaigns = [
      ...raffleCampaigns,
      ...squareCampaigns,
      ...eventsCampaigns,
    ];

    return NextResponse.json({
      ok: true,
      campaigns,
    });
  } catch (error: any) {
    console.error("Fetch campaigns error", error);
    return NextResponse.json(
      { ok: false, error: error?.message || "Failed to fetch campaigns" },
      { status: 500 }
    );
  }
}
