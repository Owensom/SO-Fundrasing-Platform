import { NextRequest, NextResponse } from "next/server";
import { sendWinnerEmail } from "@/lib/email";
import {
  createSquaresWinner,
  getSquaresGameById,
  listSquaresSales,
  listSquaresWinners,
} from "../../../../../../../api/_lib/squares-repo";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: {
    id: string;
  };
};

function parsePositiveInteger(value: FormDataEntryValue | null) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : null;
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

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const gameId = context.params.id;
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

    const winners = await listSquaresWinners(gameId);

    const existingPrizeWinner = winners.find(
      (winner) => Number(winner.prize_index) === prizeNumber,
    );

    if (existingPrizeWinner) {
      return NextResponse.json(
        {
          ok: false,
          error: `Prize ${prizeNumber} has already been drawn`,
          winner: existingPrizeWinner,
        },
        { status: 400 },
      );
    }

    const existingSquareWinner = winners.find(
      (winner) => Number(winner.square_number) === squareNumber,
    );

    if (existingSquareWinner) {
      return NextResponse.json(
        {
          ok: false,
          error: `Square #${squareNumber} has already won a prize`,
          winner: existingSquareWinner,
        },
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

    const prizes = game.config_json?.prizes ?? [];
    const prize = prizes[prizeNumber - 1];

    const prizeTitle =
      String(prize?.title ?? prize?.name ?? "").trim() ||
      `${prizeNumber}${ordinal(prizeNumber)} Prize`;

    const winnerName = cleanName(matchingSale.customer_name);
    const winnerEmail = cleanEmail(matchingSale.customer_email);

    const winner = await createSquaresWinner({
      tenant_slug: game.tenant_slug,
      game_id: game.id,
      prize_index: prizeNumber,
      prize_title: prizeTitle,
      square_number: squareNumber,
      customer_name: winnerName,
      customer_email: winnerEmail || null,
    });

    if (!winnerEmail) {
      console.warn("Squares draw winner email skipped - missing email", {
        gameId: game.id,
        prizeNumber,
        prizeTitle,
        squareNumber,
      });
    } else {
      try {
        await sendWinnerEmail({
          to: winnerEmail,
          name: winnerName,
          raffleTitle: game.title,
          ticketNumber: squareNumber,
          colour: `Square ${squareNumber} — ${prizeTitle}`,
        });

        console.log("Squares draw winner email sent", {
          to: winnerEmail,
          gameId: game.id,
          prizeNumber,
          prizeTitle,
          squareNumber,
        });
      } catch (emailError: any) {
        console.error("Squares draw winner email failed", {
          to: winnerEmail,
          gameId: game.id,
          prizeNumber,
          prizeTitle,
          squareNumber,
          error: emailError?.message || emailError,
        });
      }
    }

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
