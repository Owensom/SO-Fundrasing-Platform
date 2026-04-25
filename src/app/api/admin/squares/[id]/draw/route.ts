import { NextRequest, NextResponse } from "next/server";
import { getTenantSlugFromRequest } from "@/lib/tenant";
import {
  createSquaresWinner,
  getSquaresGameById,
  listSquaresSales,
  listSquaresWinners,
  normalisePrizes,
} from "../../../../../../../api/_lib/squares-repo";
import { sendSquaresWinnerEmail } from "@/lib/email";
import { query } from "@/lib/db";

type RouteContext = {
  params: {
    id: string;
  };
};

function shuffle<T>(items: T[]) {
  return [...items].sort(() => Math.random() - 0.5);
}

export async function POST(request: NextRequest, context: RouteContext) {
  const tenantSlug = getTenantSlugFromRequest(request);
  const gameId = context.params.id;

  if (!tenantSlug) {
    return NextResponse.json(
      { ok: false, error: "Tenant not found" },
      { status: 404 }
    );
  }

  try {
    const game = await getSquaresGameById(gameId);

    if (!game) {
      return NextResponse.json(
        { ok: false, error: "Squares game not found" },
        { status: 404 }
      );
    }

    if (game.tenant_slug !== tenantSlug) {
      return NextResponse.json(
        { ok: false, error: "Forbidden" },
        { status: 403 }
      );
    }

    const existingWinners = await listSquaresWinners(gameId);

    if (existingWinners.length > 0) {
      return NextResponse.json(
        {
          ok: false,
          error: "Winners have already been drawn.",
        },
        { status: 400 }
      );
    }

    const prizes = normalisePrizes(game.config_json?.prizes ?? []);

    if (prizes.length === 0) {
      return NextResponse.json(
        { ok: false, error: "No prizes configured." },
        { status: 400 }
      );
    }

    const sales = await listSquaresSales(gameId);

    const entries: Array<{
      square_number: number;
      customer_name: string | null;
      customer_email: string | null;
    }> = [];

    for (const sale of sales) {
      if (sale.payment_status !== "paid") continue;

      for (const square of sale.squares ?? []) {
        entries.push({
          square_number: Number(square),
          customer_name: sale.customer_name,
          customer_email: sale.customer_email,
        });
      }
    }

    const validEntries = entries.filter(
      (entry) =>
        Number.isInteger(entry.square_number) &&
        entry.square_number >= 1 &&
        entry.square_number <= game.total_squares
    );

    if (validEntries.length === 0) {
      return NextResponse.json(
        { ok: false, error: "No valid paid squares." },
        { status: 400 }
      );
    }

    const uniqueBySquare = new Map<number, (typeof validEntries)[number]>();

    for (const entry of validEntries) {
      if (!uniqueBySquare.has(entry.square_number)) {
        uniqueBySquare.set(entry.square_number, entry);
      }
    }

    const shuffled = shuffle(Array.from(uniqueBySquare.values()));
    const prizeCount = Math.min(prizes.length, shuffled.length);

    const winners = [];

    for (let i = 0; i < prizeCount; i++) {
      const prize = prizes[i];
      const winningEntry = shuffled[i];

      const winner = await createSquaresWinner({
        tenant_slug: tenantSlug,
        game_id: gameId,
        prize_index: i,
        prize_title: prize.title,
        square_number: winningEntry.square_number,
        customer_name: winningEntry.customer_name,
        customer_email: winningEntry.customer_email,
      });

      winners.push(winner);

      // send email
      if (winningEntry.customer_email) {
        try {
          await sendSquaresWinnerEmail({
            to: winningEntry.customer_email,
            name: winningEntry.customer_name,
            gameTitle: game.title,
            squareNumber: winningEntry.square_number,
            prizeTitle: prize.title,
          });
        } catch (err) {
          console.error("Email failed:", err);
        }
      }
    }

    // 🔒 LOCK GAME AFTER DRAW
    await query(
      `
      update squares_games
      set status = 'drawn',
          updated_at = now()
      where id = $1
        and tenant_slug = $2
      `,
      [gameId, tenantSlug]
    );

    return NextResponse.json({
      ok: true,
      winners,
    });
  } catch (error) {
    console.error("Draw squares winners failed:", error);

    return NextResponse.json(
      { ok: false, error: "Internal error" },
      { status: 500 }
    );
  }
}
