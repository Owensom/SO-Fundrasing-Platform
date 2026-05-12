import { NextRequest, NextResponse } from "next/server";
import { sendSquaresWinnerEmail } from "@/lib/email";
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

function cleanEmail(value: string | null | undefined) {
  return String(value || "").trim().toLowerCase();
}

function cleanName(value: string | null | undefined) {
  return String(value || "").trim() || "Supporter";
}

function ordinal(value: number) {
  const mod10 = value % 10;
  const mod100 = value % 100;

  if (mod10 === 1 && mod100 !== 11) return "st";
  if (mod10 === 2 && mod100 !== 12) return "nd";
  if (mod10 === 3 && mod100 !== 13) return "rd";

  return "th";
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

function getPrizeTitle(prize: any, prizeNumber: number) {
  return (
    String(
      prize?.title ||
        prize?.name ||
        prize?.prizeTitle ||
        prize?.prize_title ||
        prize?.label ||
        "",
    ).trim() || `${prizeNumber}${ordinal(prizeNumber)} Prize`
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

    const existingWinners = await listSquaresWinners(game.id);
    const alreadyDrawnPrizeNumbers = new Set(
      existingWinners
        .map((winner) => Number(winner.prize_index))
        .filter((value) => Number.isFinite(value) && value > 0),
    );
    const alreadyWinningSquares = new Set(
      existingWinners
        .map((winner) => Number(winner.square_number))
        .filter((value) => Number.isFinite(value) && value > 0),
    );

    const prizesToDraw = prizes
      .map((prize: any, index: number) => ({
        prize,
        prizeNumber: Number(prize?.position ?? prize?.prize_index ?? index + 1),
      }))
      .filter(
        (item) =>
          item.prizeNumber >= autoDrawFrom &&
          item.prizeNumber <= autoDrawTo &&
          !alreadyDrawnPrizeNumbers.has(item.prizeNumber),
      );

    if (prizesToDraw.length === 0) {
      return NextResponse.json(
        {
          ok: false,
          error: `No undrawn prizes found within auto draw range ${autoDrawFrom}-${autoDrawTo}`,
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
        entry.squareNumber <= Number(game.total_squares || 0) &&
        !alreadyWinningSquares.has(entry.squareNumber),
    );

    if (validSoldEntries.length === 0) {
      return NextResponse.json(
        { ok: false, error: "No eligible sold squares to draw from" },
        { status: 400 },
      );
    }

    const shuffledSquares = shuffle(validSoldEntries);
    const usedSquaresThisRun = new Set<number>();

    for (let index = 0; index < prizesToDraw.length; index += 1) {
      const prizeItem = prizesToDraw[index];

      const entry =
        shuffledSquares.find(
          (candidate) => !usedSquaresThisRun.has(candidate.squareNumber),
        ) || shuffledSquares[index % shuffledSquares.length];

      if (!entry) {
        break;
      }

      usedSquaresThisRun.add(entry.squareNumber);

      const prizeTitle = getPrizeTitle(prizeItem.prize, prizeItem.prizeNumber);
      const winnerName = cleanName(entry.customerName);
      const winnerEmail = cleanEmail(entry.customerEmail);

      await createSquaresWinner({
        tenant_slug: game.tenant_slug,
        game_id: game.id,
        prize_index: prizeItem.prizeNumber,
        prize_title: prizeTitle,
        square_number: entry.squareNumber,
        customer_name: winnerName,
        customer_email: winnerEmail || null,
      });

      if (!winnerEmail) {
        console.warn("Squares auto draw winner email skipped - missing email", {
          gameId: game.id,
          prizeNumber: prizeItem.prizeNumber,
          prizeTitle,
          squareNumber: entry.squareNumber,
        });
        continue;
      }

      try {
        await sendSquaresWinnerEmail({
          to: winnerEmail,
          name: winnerName,
          gameTitle: game.title,
          squareNumber: entry.squareNumber,
          prizeTitle,
        });

        console.log("Squares auto draw winner email sent", {
          to: winnerEmail,
          gameId: game.id,
          prizeNumber: prizeItem.prizeNumber,
          prizeTitle,
          squareNumber: entry.squareNumber,
        });
      } catch (emailError: any) {
        console.error("Squares auto draw winner email failed", {
          to: winnerEmail,
          gameId: game.id,
          prizeNumber: prizeItem.prizeNumber,
          prizeTitle,
          squareNumber: entry.squareNumber,
          error: emailError?.message || emailError,
        });
      }
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
