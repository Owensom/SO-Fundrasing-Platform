import { NextRequest, NextResponse } from "next/server";
import { getTenantSlugFromRequest } from "@/lib/tenant";
import { getSquaresGameByTenantAndSlug } from "../../../../../../api/_lib/squares-repo";

export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string } },
) {
  const tenantSlug = getTenantSlugFromRequest(request);

  if (!tenantSlug) {
    return NextResponse.json(
      { ok: false, error: "Tenant not found" },
      { status: 404 },
    );
  }

  try {
    const game = await getSquaresGameByTenantAndSlug(
      tenantSlug,
      params.slug,
    );

    if (!game) {
      return NextResponse.json(
        { ok: false, error: "Squares game not found" },
        { status: 404 },
      );
    }

    const config = (game.config_json ?? {}) as any;

    return NextResponse.json({
      ok: true,
      game: {
        id: game.id,
        tenantSlug: game.tenant_slug,
        slug: game.slug,
        title: game.title,
        description: game.description ?? "",
        imageUrl: game.image_url ?? "",
        drawAt: game.draw_at,
        status: game.status,
        currency: game.currency ?? "GBP",
        pricePerSquareCents: game.price_per_square_cents,
        totalSquares: game.total_squares,
        prizes: Array.isArray(config.prizes) ? config.prizes : [],
        soldSquares: Array.isArray(config.sold) ? config.sold : [],
        reservedSquares: Array.isArray(config.reserved)
          ? config.reserved
          : [],
        winners: [],

        // ✅ FIXED — THIS WAS MISSING / WRONG
        question: config.question ?? null,

        // ✅ FIXED — map snake_case to camelCase
        freeEntry: config.free_entry
          ? {
              address: config.free_entry.address ?? "",
              instructions: config.free_entry.instructions ?? "",
              closesAt: config.free_entry.closes_at ?? null,
            }
          : null,
      },
    });
  } catch (error) {
    console.error("GET public squares failed:", error);

    return NextResponse.json(
      { ok: false, error: "Internal error" },
      { status: 500 },
    );
  }
}
