import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { getRaffleById } from "@/lib/raffles";
import { queryOne } from "@/lib/db";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2024-06-20",
});

type CheckoutBody = {
  raffleId?: string;
  reservationToken?: string;
  successUrl?: string;
  cancelUrl?: string;
};

type ReservationRow = {
  id: string;
  raffle_id: string;
  reservation_token: string;
  quantity: number;
  expires_at: string;
};

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as CheckoutBody;

    const raffleId =
      typeof body.raffleId === "string" ? body.raffleId : "";
    const reservationToken =
      typeof body.reservationToken === "string"
        ? body.reservationToken
        : "";

    if (!raffleId || !reservationToken) {
      return NextResponse.json(
        { ok: false, error: "Missing raffleId or reservationToken." },
        { status: 400 }
      );
    }

    const raffle = await getRaffleById(raffleId);

    // 🔴 CRITICAL: BLOCK checkout if not published
    if (!raffle || raffle.status !== "published") {
      return NextResponse.json(
        { ok: false, error: "This raffle is closed." },
        { status: 400 }
      );
    }

    const reservation = await queryOne<ReservationRow>(
      `
      select
        id,
        raffle_id,
        reservation_token,
        quantity,
        expires_at
      from raffle_ticket_reservations
      where reservation_token = $1
        and raffle_id = $2
      `,
      [reservationToken, raffleId]
    );

    if (!reservation) {
      return NextResponse.json(
        { ok: false, error: "Reservation not found." },
        { status: 404 }
      );
    }

    if (new Date(reservation.expires_at).getTime() < Date.now()) {
      return NextResponse.json(
        { ok: false, error: "Reservation expired." },
        { status: 400 }
      );
    }

    const quantity = Number(reservation.quantity);

    if (!Number.isFinite(quantity) || quantity <= 0) {
      return NextResponse.json(
        { ok: false, error: "Invalid reservation quantity." },
        { status: 400 }
      );
    }

    const ticketPrice = Number(raffle.ticket_price);

    if (!Number.isFinite(ticketPrice) || ticketPrice <= 0) {
      return NextResponse.json(
        { ok: false, error: "Invalid ticket price." },
        { status: 400 }
      );
    }

    const unitAmount = Math.round(ticketPrice * 100);

    const successUrl =
      typeof body.successUrl === "string" && body.successUrl
        ? body.successUrl
        : `${process.env.NEXT_PUBLIC_APP_URL}/success`;

    const cancelUrl =
      typeof body.cancelUrl === "string" && body.cancelUrl
        ? body.cancelUrl
        : `${process.env.NEXT_PUBLIC_APP_URL}/r/${raffle.slug}`;

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: raffle.currency.toLowerCase(),
            product_data: {
              name: raffle.title,
              description: `${quantity} ticket${
                quantity > 1 ? "s" : ""
              }`,
            },
            unit_amount: unitAmount,
          },
          quantity,
        },
      ],
      metadata: {
        raffle_id: raffle.id,
        reservation_token: reservation.reservation_token,
      },
      success_url: `${successUrl}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancelUrl,
    });

    return NextResponse.json({
      ok: true,
      url: session.url,
    });
  } catch (error) {
    console.error("stripe checkout error", error);

    return NextResponse.json(
      { ok: false, error: "Internal server error." },
      { status: 500 }
    );
  }
}
