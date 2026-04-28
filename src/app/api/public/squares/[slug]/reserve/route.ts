import { NextRequest, NextResponse } from "next/server";
import { getTenantSlugFromRequest } from "@/lib/tenant";
import {
  cleanupExpiredSquaresReservations,
  createSquaresReservation,
  getActiveSquaresReservations,
  getSquaresGameByTenantAndSlug,
  listSquaresSales,
  normaliseSquares,
} from "../../../../../../../api/_lib/squares-repo";

type RouteContext = {
  params: {
    slug: string;
  };
};

function getRandomAvailableSquares(
  totalSquares: number,
  unavailable: Set<number>,
  count: number,
) {
  const available: number[] = [];

  for (let i = 1; i <= totalSquares; i++) {
    if (!unavailable.has(i)) {
      available.push(i);
    }
  }

  for (let i = available.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [available[i], available[j]] = [available[j], available[i]];
  }

  return available.slice(0, count).sort((a, b) => a - b);
}

export async function POST(request: NextRequest, context: RouteContext) {
  const tenantSlug = getTenantSlugFromRequest(request);
  const slug = context.params.slug;

  if (!tenantSlug) {
    return NextResponse.json(
      { ok: false, error: "Tenant not found" },
      { status: 404 },
    );
  }

  try {
    const body = await request.json();

    const requestedSquares = Array.isArray(body?.squares) ? body.squares : [];
    const randomCount = Math.max(0, Math.floor(Number(body?.randomCount || 0)));

    const customerName = String(body?.customerName ?? "").trim();
    const customerEmail = String(body?.customerEmail ?? "").trim();

    const game = await getSquaresGameByTenantAndSlug(tenantSlug, slug);

    if (!game) {
      return NextResponse.json(
        { ok: false, error: "Squares game not found" },
        { status: 404 },
      );
    }

    if (game.status !== "published") {
      return NextResponse.json(
        { ok: false, error: "This squares game is not open" },
        { status: 400 },
      );
    }

    await cleanupExpiredSquaresReservations(game.id);

    const [sales, reservations] = await Promise.all([
      listSquaresSales(game.id),
      getActiveSquaresReservations(game.id),
    ]);

    const unavailable = new Set<number>();

    for (const sale of sales) {
      for (const square of sale.squares ?? []) {
        unavailable.add(Number(square));
      }
    }

    for (const reservation of reservations) {
      for (const square of reservation.squares ?? []) {
        unavailable.add(Number(square));
      }
    }

    const selectedSquares =
      randomCount > 0
        ? getRandomAvailableSquares(game.total_squares, unavailable, randomCount)
        : normaliseSquares(requestedSquares, game.total_squares);

    if (selectedSquares.length === 0) {
      return NextResponse.json(
        { ok: false, error: "Choose at least one square" },
        { status: 400 },
      );
    }

    if (randomCount > 0 && selectedSquares.length < randomCount) {
      return NextResponse.json(
        { ok: false, error: "Not enough squares are available" },
        { status: 400 },
      );
    }

    const blocked = selectedSquares.filter((square) => unavailable.has(square));

    if (blocked.length > 0) {
      return NextResponse.json(
        { ok: false, error: `Square ${blocked[0]} is no longer available` },
        { status: 409 },
      );
    }

    const reservation = await createSquaresReservation({
      tenant_slug: tenantSlug,
      game_id: game.id,
      squares: selectedSquares,
      customer_name: customerName || undefined,
      customer_email: customerEmail || undefined,
      minutes: 15,
    });

    if (!reservation) {
      return NextResponse.json(
        { ok: false, error: "Reservation failed" },
        { status: 500 },
      );
    }

    return NextResponse.json({
      ok: true,
      reservationToken: reservation.reservation_token,
      squares: selectedSquares,
    });
  } catch (error) {
    console.error("POST public squares reserve failed:", error);

    return NextResponse.json(
      { ok: false, error: "Internal error" },
      { status: 500 },
    );
  }
}
