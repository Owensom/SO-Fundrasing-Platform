import { NextRequest, NextResponse } from "next/server";
import {
  createSquaresWinner,
  getSquaresGameById,
  listSquaresSales,
  listSquaresWinners,
} from "../../../../../../../api/_lib/squares-repo";

type RouteContext = {
  params: {
    id: string;
  };
};

function parsePositiveInteger(value: FormDataEntryValue | null) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : null;
}

function getPrizeTitle(game: Awaited<ReturnType<typeof getSquaresGameById>>, prizeIndex: number) {
  const prizes = game?.config_json?.prizes ?? [];
  const prize = prizes[prizeIndex - 1];

  return prize?.title?.trim() || `${prizeIndex}${getOrdinalSuffix(prizeIndex)} Prize`;
}

function getOrdinalSuffix(value: number) {
  const mod10 = value % 10;
  const mod100 = value % 100;

  if (mod10 === 1 && mod100 !== 11) return "st";
  if (mod10 === 2 && mod100 !== 12) return "nd";
  if (mod10 === 3 && mod100 !== 13) return "rd";

  return "th";
}

export async function POST(request: NextRequest, context: RouteContext) {
  const gameId = context.params.id;

  try {
    const game = await getSquaresGameById(gameId);

    if (!game) {
      return NextResponse.json(
        { ok: false, error: "Squares game not found" },
        { status: 404 },
      );
    }

    const formData = await request.formData();

    const prizeNumber = parsePositiveInteger(formData.get("prize_number"));
    const squareNumber = parsePositiveInteger(formData.get("square_number"));

    if (!prizeNumber || !squareNumber) {
      return NextResponse.json(
        { ok: false, error: "Prize number and square number are required" },
        { status: 400 },
      );
    }

    const existingWinners = await listSquaresWinners(gameId);

    const prizeAlreadyDrawn = existingWinners.some(
      (winner) => Number(winner.prize_index) === prizeNumber,
    );

    if (prizeAlreadyDrawn) {
      return NextResponse.json(
        { ok: false, error: `Prize ${prizeNumber} has already been drawn` },
        { status: 400 },
      );
    }

    const sales = await listSquaresSales(gameId);

    const matchingSale = sales.find((sale) =>
      Array.isArray(sale.squares)
        ? sale.squares.map(Number).includes(squareNumber)
        : false,
    );

    if (!matchingSale) {
      return NextResponse.json(
        { ok: false, error: "That square has not been sold" },
        { status: 400 },
      );
    }

    const winner = await createSquaresWinner({
      tenant_slug: game.tenant_slug,
      game_id: game.id,
      prize_index: prizeNumber,
      prize_title: getPrizeTitle(game, prizeNumber),
      square_number: squareNumber,
      customer_name: matchingSale.customer_name,
      customer_email: matchingSale.customer_email,
    });

    return NextResponse.json({
      ok: true,
      winner,
    });
  } catch (error) {
    console.error("Squares draw failed", error);

    return NextResponse.json(
      { ok: false, error: "Draw failed" },
      { status: 500 },
    );
  }
}
