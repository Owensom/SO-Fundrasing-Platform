import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import {
  getSquaresGameById,
  getSquaresReservationByToken,
  markSquaresReservationCheckoutSession,
} from "../../../../../../api/_lib/squares-repo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2023-10-16",
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const gameId = String(body.gameId || "").trim();
    const reservationToken = String(body.reservationToken || "").trim();
    const coverFees = Boolean(body.coverFees);

    if (!gameId || !reservationToken) {
      return NextResponse.json(
        { ok: false, error: "Missing checkout data" },
        { status: 400 },
      );
    }

    const [game, reservation] = await Promise.all([
      getSquaresGameById(gameId),
      getSquaresReservationByToken(reservationToken),
    ]);

    if (!game) {
      return NextResponse.json(
        { ok: false, error: "Squares game not found" },
        { status: 404 },
      );
    }

    if (!reservation || reservation.game_id !== game.id) {
      return NextResponse.json(
        { ok: false, error: "Reservation not found" },
        { status: 404 },
      );
    }

    if (reservation.payment_status !== "reserved") {
      return NextResponse.json(
        { ok: false, error: "Reservation is not available" },
        { status: 400 },
      );
    }

    const quantity = Array.isArray(reservation.squares)
      ? reservation.squares.length
      : 0;

    if (quantity <= 0) {
      return NextResponse.json(
        { ok: false, error: "No squares reserved" },
        { status: 400 },
      );
    }

    const pricePerSquareCents = Number(game.price_per_square_cents || 0);

    if (!Number.isFinite(pricePerSquareCents) || pricePerSquareCents <= 0) {
      return NextResponse.json(
        { ok: false, error: "Invalid square price" },
        { status: 400 },
      );
    }

    const baseAmount = pricePerSquareCents * quantity;
    const fee = coverFees ? Math.round(baseAmount * 0.1) : 0;
    const totalAmount = baseAmount + fee;

    const origin = req.nextUrl.origin;
    const successUrl = `${origin}/api/stripe/success?session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = `${origin}/s/${game.slug}`;

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "payment",

      line_items: [
        {
          price_data: {
            currency: String(game.currency || "GBP").toLowerCase(),
            product_data: {
              name: game.title,
              description: `${quantity} square${quantity === 1 ? "" : "s"}`,
            },
            unit_amount: totalAmount,
          },
          quantity: 1,
        },
      ],

      success_url: successUrl,
      cancel_url: cancelUrl,

      metadata: {
        type: "squares",
        squares_game_id: game.id,
        game_id: game.id,
        tenant_slug: game.tenant_slug,
        reservation_token: reservationToken,
        quantity: String(quantity),
        squares: JSON.stringify(reservation.squares ?? []),
      },
    });

    if (session.id) {
      await markSquaresReservationCheckoutSession(reservationToken, session.id);
    }

    return NextResponse.json({
      ok: true,
      url: session.url,
    });
  } catch (err: any) {
    console.error("Stripe squares checkout error:", err);

    return NextResponse.json(
      { ok: false, error: err.message || "Checkout failed" },
      { status: 500 },
    );
  }
}
