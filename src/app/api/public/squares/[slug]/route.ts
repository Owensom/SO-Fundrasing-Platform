import { NextRequest, NextResponse } from "next/server";
import { getTenantSlugFromRequest } from "@/lib/tenant";
import { getSquaresGameByTenantAndSlug } from "../../../../../../api/_lib/squares-repo";

function normaliseFocus(value: unknown, fallback = 50) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) return fallback;

  return Math.max(0, Math.min(100, Math.round(parsed)));
}

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
    const game = await getSquaresGameByTenantAndSlug(tenantSlug, params.slug);

    if (!game) {
      return NextResponse.json(
        { ok: false, error: "Squares game not found" },
        { status: 404 },
      );
    }

    const config = (game.config_json ?? {}) as any;

    const imageFocusX = normaliseFocus(config.image_focus_x, 50);
    const imageFocusY = normaliseFocus(config.image_focus_y, 50);

    return NextResponse.json({
      ok: true,
      game: {
        id: game.id,
        tenantSlug: game.tenant_slug,
        slug: game.slug,
        title: game.title,
        description: game.description ?? "",
        imageUrl: game.image_url ?? "",
        imageFocusX,
        imageFocusY,
        image_focus_x: imageFocusX,
        image_focus_y: imageFocusY,
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
        question: config.question ?? null,
        freeEntry: config.free_entry
          ? {
              address: config.free_entry.address ?? "",
              instructions: config.free_entry.instructions ?? "",
              closes_at: config.free_entry.closes_at ?? null,
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
