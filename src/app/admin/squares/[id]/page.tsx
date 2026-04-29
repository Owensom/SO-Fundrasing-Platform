import { NextRequest, NextResponse } from "next/server";
import { getSquaresGameById } from "../../../../../../api/_lib/squares-repo";
import { query } from "@/lib/db";

function parseNumber(value: any, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const game = await getSquaresGameById(params.id);

    if (!game) {
      return NextResponse.json({ error: "Game not found" }, { status: 404 });
    }

    const formData = await req.formData();

    const title = String(formData.get("title") || "").trim();
    const slug = String(formData.get("slug") || "").trim();
    const description = String(formData.get("description") || "").trim();

    const totalSquares = parseNumber(formData.get("total_squares"), 0);
    const pricePerSquare = parseNumber(formData.get("price_per_square"), 0);

    const currency = String(formData.get("currency") || "GBP");
    const status = String(formData.get("status") || "draft");

    const drawAtRaw = formData.get("draw_at");
    const drawAt = drawAtRaw ? new Date(String(drawAtRaw)).toISOString() : null;

    // ✅ PRIZES (like raffles)
    const prizeTitles = formData.getAll("prize_title");
    const prizeDescriptions = formData.getAll("prize_description");

    const prizes = prizeTitles
      .map((title, i) => ({
        title: String(title || "").trim(),
        description: String(prizeDescriptions[i] || "").trim(),
      }))
      .filter((p) => p.title.length > 0);

    // ✅ AUTO DRAW RANGE
    const autoDrawFrom = parseNumber(
      formData.get("auto_draw_from_prize"),
      1,
    );

    const autoDrawTo = parseNumber(
      formData.get("auto_draw_to_prize"),
      prizes.length || 999,
    );

    // preserve existing config safely
    const existingConfig = game.config_json || {};

    const newConfig = {
      ...existingConfig,
      prizes,
      auto_draw_from_prize: autoDrawFrom,
      auto_draw_to_prize: autoDrawTo,
    };

    await query(
      `
      update squares_games
      set
        title = $1,
        slug = $2,
        description = $3,
        total_squares = $4,
        price_per_square_cents = $5,
        currency = $6,
        status = $7,
        draw_at = $8,
        config_json = $9
      where id = $10
    `,
      [
        title,
        slug,
        description,
        totalSquares,
        Math.round(pricePerSquare * 100),
        currency,
        status,
        drawAt,
        JSON.stringify(newConfig),
        game.id,
      ],
    );

    return NextResponse.redirect(
      new URL(`/admin/squares/${game.id}`, req.url),
    );
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: "Failed to update squares game" },
      { status: 500 },
    );
  }
}
