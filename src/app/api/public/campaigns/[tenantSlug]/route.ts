import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, { params }: { params: { tenantSlug: string } }) {
  const { tenantSlug } = params;

  if (!tenantSlug) {
    return NextResponse.json({ ok: false, error: "Missing tenantSlug" }, { status: 400 });
  }

  try {
    // Fetch active raffles
    const raffles = await query(`
      select
        id,
        slug,
        title,
        description,
        image_url as "imageUrl",
        start_number as "startNumber",
        end_number as "endNumber",
        'raffle' as type
      from raffles
      where tenant_slug = $1
        and status = 'published'
      order by created_at desc
    `, [tenantSlug]);

    // Fetch active squares games
    const squares = await query(`
      select
        id,
        slug,
        title,
        description,
        image_url as "imageUrl",
        (config_json->>'size')::int as size,
        'squares' as type
      from squares_games
      where tenant_slug = $1
        and (config_json->>'active')::boolean = true
      order by created_at desc
    `, [tenantSlug]);

    // Fetch active events (if table exists)
    const events = await query(`
      select
        id,
        slug,
        title,
        description,
        image_url as "imageUrl",
        date,
        'event' as type
      from events
      where tenant_slug = $1
        and status = 'published'
      order by date asc
    `, [tenantSlug]);

    return NextResponse.json({
      ok: true,
      campaigns: [...raffles, ...squares, ...events],
    });
  } catch (error: any) {
    console.error("Failed to fetch campaigns:", error);
    return NextResponse.json(
      { ok: false, error: error?.message || "Failed to fetch campaigns" },
      { status: 500 }
    );
  }
}
