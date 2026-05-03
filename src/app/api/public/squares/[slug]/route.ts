import { NextRequest, NextResponse } from "next/server";
import { getTenantSlugFromRequest } from "@/lib/tenant";
import {
  cleanupExpiredSquaresReservations,
  getActiveSquaresReservations,
  getSquaresGameByTenantAndSlug,
  listSquaresSales,
  listSquaresWinners,
} from "../../../../../../api/_lib/squares-repo";

type RouteContext = {
  params: {
    slug: string;
  };
};

export async function GET(request: NextRequest, context: RouteContext) {
  const tenantSlug = getTenantSlugFromRequest(request);
  const slug = context.params.slug;

  if (!tenantSlug) {
    return NextResponse.json(
      { ok: false, error: "Tenant not found" },
      { status: 404 },
    );
  }

  try {
    const game = await getSquaresGameByTenantAndSlug(tenantSlug, slug);

    if (!game) {
      return NextResponse.json(
        { ok: false, error: "Squares game not found" },
        { status: 404 },
      );
    }

    await cleanupExpiredSquaresReservations(game.id);

    const [sales, reservations, winners] = await Promise.all([
      listSquaresSales(game.id),
      getActiveSquaresReservations(game.id),
      listSquaresWinners(game.id),
    ]);

    const soldSquares = sales.flatMap((sale) =>
      Array.isArray(sale.squares) ? sale.squares : [],
    );

    const reservedSquares = reservations.flatMap((reservation) =>
      Array.isArray(reservation.squares) ? reservation.squares : [],
    );

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
        drawAt: game.draw_at ?? null,
        status: game.status,
        currency: game.currency ?? "GBP",
        pricePerSquareCents: game.price_per_square_cents,
        totalSquares: game.total_squares,
        prizes: config.prizes ?? [],
        soldSquares,
        reservedSquares,
        winners,
        question: config.question ?? null,
        freeEntry: config.free_entry ?? null,
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
