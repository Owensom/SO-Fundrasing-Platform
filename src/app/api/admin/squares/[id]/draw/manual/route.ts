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

function getPrizeTitle(prize: any, prizeNumber: number) {
  const actualPrizeName = String(
    prize?.description ||
      prize?.name ||
      prize?.prizeName ||
      prize?.prize_name ||
      prize?.prizeTitle ||
      prize?.prize_title ||
      prize?.label ||
      "",
  ).trim();

  const positionLabel = String(prize?.title || "").trim();

  if (actualPrizeName && positionLabel) {
    return `${positionLabel} — ${actualPrizeName}`;
  }

  return (
    actualPrizeName ||
    positionLabel ||
    `${prizeNumber}${ordinal(prizeNumber)} Prize`
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

    const formData = await request.formData();

    const prizeNumber = parsePositiveInteger(formData.get("prize_number"));
    const squareNumber = parsePositiveInteger(formData.get("square_number"));

    if (!prizeNumber || !squareNumber) {
      return NextResponse.json(
        { ok: false, error: "Prize number and square number are required" },
        { status: 400 },
      );
    }

    const totalSquares = Number(game.total_squares || 0);

    if (squareNumber < 1 || squareNumber > totalSquares) {
      return NextResponse.json(
        { ok: false, error: "Square number is outside this board" },
        { status: 400 },
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

    const prize =
      prizes.find(
        (item, index) =>
          Number(item?.position ?? item?.prize_index ?? index + 1) ===
          prizeNumber,
      ) || prizes[prizeNumber - 1];

    if (!prize) {
      return NextResponse.json(
        { ok: false, error: "Prize number does not exist" },
        { status: 400 },
      );
    }

    const existingWinners = await listSquaresWinners(game.id);

    const prizeAlreadyWon = existingWinners.some(
      (winner) => Number(winner.prize_index) === prizeNumber,
    );

    if (prizeAlreadyWon) {
      return NextResponse.json(
        { ok: false, error: "This prize already has a winner" },
        { status: 400 },
      );
    }

    const squareAlreadyWon = existingWinners.some(
      (winner) => Number(winner.square_number) === squareNumber,
    );

    if (squareAlreadyWon) {
      return NextResponse.json(
        { ok: false, error: `Square #${squareNumber} has already won a prize` },
        { status: 400 },
      );
    }

    const sales = await listSquaresSales(game.id);

    const soldEntries = sales.flatMap((sale) =>
      Array.isArray(sale.squares)
        ? sale.squares.map((soldSquare: number | string) => ({
            squareNumber: Number(soldSquare),
            customerName: sale.customer_name,
            customerEmail: sale.customer_email,
          }))
        : [],
    );

    const winningEntry = soldEntries.find(
      (entry) => entry.squareNumber === squareNumber,
    );

    if (!winningEntry) {
      return NextResponse.json(
        { ok: false, error: "That square has not been sold" },
        { status: 400 },
      );
    }

    const prizeTitle = getPrizeTitle(prize, prizeNumber);
    const winnerName = cleanName(winningEntry.customerName);
    const winnerEmail = cleanEmail(winningEntry.customerEmail);

    await createSquaresWinner({
      tenant_slug: game.tenant_slug,
      game_id: game.id,
      prize_index: prizeNumber,
      prize_title: prizeTitle,
      square_number: winningEntry.squareNumber,
      customer_name: winnerName,
      customer_email: winnerEmail || null,
    });

    if (!winnerEmail) {
      console.warn("Squares manual draw winner email skipped - missing email", {
        gameId: game.id,
        prizeNumber,
        prizeTitle,
        squareNumber: winningEntry.squareNumber,
      });
    } else {
      try {
        await sendSquaresWinnerEmail({
          to: winnerEmail,
          name: winnerName,
          gameTitle: game.title,
          squareNumber: winningEntry.squareNumber,
          prizeTitle,
        });

        console.log("Squares manual draw winner email sent", {
          to: winnerEmail,
          gameId: game.id,
          prizeNumber,
          prizeTitle,
          squareNumber: winningEntry.squareNumber,
        });
      } catch (emailError: any) {
        console.error("Squares manual draw winner email failed", {
          to: winnerEmail,
          gameId: game.id,
          prizeNumber,
          prizeTitle,
          squareNumber: winningEntry.squareNumber,
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
      auto_draw_from_prize: config.auto_draw_from_prize ?? 1,
      auto_draw_to_prize: config.auto_draw_to_prize ?? 999,
    } as any);

    return NextResponse.redirect(
      new URL(`/admin/squares/${game.id}`, request.url),
      { status: 303 },
    );
  } catch (error) {
    console.error("POST admin squares manual draw failed:", error);

    return NextResponse.json(
      { ok: false, error: "Manual draw failed" },
      { status: 500 },
    );
  }
}
