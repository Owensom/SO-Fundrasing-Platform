import { NextRequest, NextResponse } from "next/server";
import {
  createSquaresWinner,
  getSquaresGameById,
  listSquaresSales,
  listSquaresWinners,
  updateSquaresGame,
} from "../../../../../../../../api/_lib/squares-repo";

type RouteContext = {
  params: {
    id: string;
  };
};

function shuffle<T>(items: T[]) {
  const copy = items.slice();

  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    const current = copy[index];

    copy[index] = copy[swapIndex];
    copy[swapIndex] = current;
  }

  return copy;
}

function parseRangeValue(value: unknown, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

function getAutoDrawFrom(config: any) {
  return parseRangeValue(
    config?.auto_draw_from_prize ??
      config?.autoDrawFromPrize ??
      config?.auto_draw_from ??
      config?.draw_from_prize,
    1,
  );
}

function getAutoDrawTo(config: any, prizeCount: number) {
  return parseRangeValue(
    config?.auto_draw_to_prize ??
      config?.autoDrawToPrize ??
      config?.auto_draw_to ??
      config?.draw_to_prize,
    prizeCount,
  );
}

export async function POST(request: NextRequest, context: RouteContext) {
  const id = context.params.id;

  try {
    const game = await getSquaresGameById(id);

    if (!game) {
      return NextResponse.json(
        { ok: false, error: "Squares game not found" },
        { status: 404 },
      );
    }

    const existingWinners = await listSquaresWinners(game.id);

    if (existingWinners.length > 0) {
      return NextResponse.redirect(
        new URL(`/admin/squares/${game.id}`, request.url),
        { status: 303 },
      );
    }

    const config = (game.config_json ?? {}) as any;
    const prizes: any[] = Array.isArray(config.prizes) ? config.prizes : [];

    if (prizes.length === 0) {
      return NextResponse.json(
        { ok: false, error: "No prizes configured" },
        { status: 400 },
      );
    }

    const autoDrawFrom = Math.max(1, getAutoDrawFrom(config));
    const autoDrawTo = Math.max(
      autoDrawFrom,
      Math.min(getAutoDrawTo(config, prizes.length), prizes.length),
    );

    const prizesToDraw = prizes
      .map((prize: any, index: number) => ({
        prize,
        prizeIndex: index,
        prizeNumber: index + 1,
      }))
      .filter(
        (item) =>
          item.prizeNumber >= autoDrawFrom && item.prizeNumber <= autoDrawTo,
      );

    if (prizesToDraw.length === 0) {
      return NextResponse.json(
        {
          ok: false,
          error: `No prizes found within auto draw range ${autoDrawFrom}-${autoDrawTo}`,
        },
        { status: 400 },
      );
    }

    const sales = await listSquaresSales(game.id);

    const soldEntries = sales.flatMap((sale) =>
      Array.isArray(sale.squares)
        ? sale.squares.map((squareNumber: number | string) => ({
            squareNumber: Number(squareNumber),
            customerName: sale.customer_name,
            customerEmail: sale.customer_email,
          }))
        : [],
    );

    const validSoldEntries = soldEntries.filter(
      (entry) =>
        Number.isInteger(entry.squareNumber) &&
        entry.squareNumber >= 1 &&
        entry.squareNumber <= Number(game.total_squares || 0),
    );

    if (validSoldEntries.length === 0) {
      return NextResponse.json(
        { ok: false, error: "No sold squares to draw from" },
        { status: 400 },
      );
    }

    const shuffledSquares = shuffle(validSoldEntries);

    for (let index = 0; index < prizesToDraw.length; index += 1) {
      const entry = shuffledSquares[index % shuffledSquares.length];
      const prizeItem = prizesToDraw[index];

      const prizeTitle =
        String(prizeItem.prize?.title ?? prizeItem.prize?.name ?? "").trim() ||
        `Prize ${prizeItem.prizeNumber}`;

      await createSquaresWinner({
        tenant_slug: game.tenant_slug,
        game_id: game.id,
        prize_index: prizeItem.prizeIndex,
        prize_title: prizeTitle,
        square_number: entry.squareNumber,
        customer_name: entry.customerName,
        customer_email: entry.customerEmail,
      });
    }

    await updateSquaresGame(game.id, {
      tenant_slug: game.tenant_slug,
      title: game.title,
      slug: game.slug,
      description: game.description ?? "",
      image_url: game.image_url ?? "",
      currency: game.currency ?? "GBP",
      status: "drawn",
      total_squares: game.total_squares,
      price_per_square_cents: game.price_per_square_cents,
      prizes,
      sold: config.sold ?? [],
      reserved: config.reserved ?? [],
      auto_draw_from_prize: autoDrawFrom,
      auto_draw_to_prize: autoDrawTo,
    } as any);

    return NextResponse.redirect(
      new URL(`/admin/squares/${game.id}`, request.url),
      { status: 303 },
    );
  } catch (error) {
    console.error("POST admin squares auto draw failed:", error);

    return NextResponse.json(
      { ok: false, error: "Auto draw failed" },
      { status: 500 },
    );
  }
}
