import { NextRequest, NextResponse } from "next/server";
import { getSquaresGameById } from "../../../../../../api/_lib/squares-repo";
import { query } from "@/lib/db";

function shuffle<T>(array: T[]): T[] {
  const arr = array.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const game = await getSquaresGameById(params.id);

    if (!game) {
      return NextResponse.json({ error: "Game not found" }, { status: 404 });
    }

    const config = game.config_json || {};

    const sold: any[] = Array.isArray(config.sold) ? config.sold : [];
    const prizes: any[] = Array.isArray(config.prizes)
      ? config.prizes
      : [];

    if (sold.length === 0) {
      return NextResponse.json(
        { error: "No sold squares to draw from" },
        { status: 400 },
      );
    }

    if (prizes.length === 0) {
      return NextResponse.json(
        { error: "No prizes configured" },
        { status: 400 },
      );
    }

    // ✅ NEW: AUTO DRAW RANGE
    const autoDrawFrom = Number(config.auto_draw_from_prize || 1);
    const autoDrawTo = Number(
      config.auto_draw_to_prize || prizes.length,
    );

    // filter prizes for auto draw
    const prizesToDraw = prizes.filter((_, index) => {
      const pos = index + 1;
      return pos >= autoDrawFrom && pos <= autoDrawTo;
    });

    if (prizesToDraw.length === 0) {
      return NextResponse.json(
        { error: "No prizes fall within auto-draw range" },
        { status: 400 },
      );
    }

    const shuffledSquares = shuffle(sold);

    const winners = prizesToDraw.map((prize, index) => {
      const square = shuffledSquares[index];

      if (!square) return null;

      return {
        game_id: game.id,
        prize_position: autoDrawFrom + index,
        prize_title: prize.title || prize.name || `Prize ${index + 1}`,
        square_number: square.number,
        customer_name: square.customer_name || null,
        customer_email: square.customer_email || null,
      };
    }).filter(Boolean);

    // save winners
    for (const winner of winners) {
      await query(
        `
        insert into squares_winners (
          game_id,
          prize_position,
          prize_title,
          square_number,
          customer_name,
          customer_email
        )
        values ($1,$2,$3,$4,$5,$6)
      `,
        [
          winner.game_id,
          winner.prize_position,
          winner.prize_title,
          winner.square_number,
          winner.customer_name,
          winner.customer_email,
        ],
      );
    }

    // update status to drawn
    await query(
      `
      update squares_games
      set status = 'drawn'
      where id = $1
    `,
      [game.id],
    );

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: "Draw failed" },
      { status: 500 },
    );
  }
}
