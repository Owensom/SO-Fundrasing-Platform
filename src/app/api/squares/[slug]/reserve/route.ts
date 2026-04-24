import { NextRequest, NextResponse } from "next/server";
import { getTenantSlugFromRequest } from "@/lib/tenant";
import {
  getSquaresGameByTenantAndSlug,
  cleanupExpiredSquaresReservations,
  getActiveSquaresReservations,
  createSquaresReservation,
  updateSquaresGame,
} from "../../../../../../api/_lib/squares-repo";

export async function POST(
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
    const body = await request.json();
    const squares: number[] = Array.isArray(body?.squares)
      ? body.squares
      : [];

    if (squares.length === 0) {
      return NextResponse.json(
        { ok: false, error: "No squares selected" },
        { status: 400 },
      );
    }

    const game = await getSquaresGameByTenantAndSlug(
      tenantSlug,
      params.slug,
    );

    if (!game || game.status !== "published") {
      return NextResponse.json(
        { ok: false, error: "Game not available" },
        { status: 404 },
      );
    }

    // cleanup expired reservations
    await cleanupExpiredSquaresReservations(game.id);

    const activeReservations = await getActiveSquaresReservations(game.id);

    const sold = new Set(game.config_json?.sold ?? []);
    const reserved = new Set<number>();

    for (const r of activeReservations) {
      for (const sq of r.squares ?? []) {
        reserved.add(Number(sq));
      }
    }

    // validate availability
    for (const sq of squares) {
      if (sq < 1 || sq > game.total_squares) {
        return NextResponse.json(
          { ok: false, error: `Invalid square ${sq}` },
          { status: 400 },
        );
      }

      if (sold.has(sq) || reserved.has(sq)) {
        return NextResponse.json(
          { ok: false, error: `Square ${sq} not available` },
          { status: 400 },
        );
      }
    }

    // create reservation
    const reservation = await createSquaresReservation({
      tenant_slug: tenantSlug,
      game_id: game.id,
      squares,
    });

    // update reserved list in config_json
    const newReserved = Array.from(
      new Set([...(game.config_json?.reserved ?? []), ...squares]),
    );

    await updateSquaresGame(game.id, {
      tenant_slug: game.tenant_slug,
      reserved: newReserved,
      sold: game.config_json?.sold ?? [],
    });

    return NextResponse.json({
      ok: true,
      reservationToken: reservation?.reservation_token,
    });
  } catch (error) {
    console.error("Squares reserve failed:", error);

    return NextResponse.json(
      { ok: false, error: "Internal error" },
      { status: 500 },
    );
  }
}
