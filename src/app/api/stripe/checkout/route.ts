import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { getRaffleById } from "@/lib/raffles";
import { query, queryOne } from "@/lib/db";
import { getBestPriceForQuantity, normalizeOffers } from "@/lib/pricing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2023-10-16",
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
  expires_at: string;
  buyer_email: string | null;
  buyer_name: string | null;
};

type ReservationCountRow = {
  count: string | number;
};

type RaffleLike = {
  id: string;
  slug: string;
  title: string;
  status: string;
  currency: string;
  ticket_price?: number | string | null;
  ticket_price_cents?: number | string | null;
  config_json?: {
    offers?: unknown;
  } | null;
  offers?: unknown;
  tenant_slug?: string | null;
};

function toMoneyCentsFromRaffle(raffle: RaffleLike): number {
  if (raffle.ticket_price_cents) {
    const cents = Number(raffle.ticket_price_cents);
    if (Number.isFinite(cents) && cents > 0) return Math.round(cents);
  }

  if (raffle.ticket_price) {
    const price = Number(raffle.ticket_price);
    if (Number.isFinite(price) && price > 0) return Math.round(price * 100);
  }

  return 0;
}

function getOffersFromRaffle(raffle: RaffleLike): unknown {
  if (Array.isArray(raffle.config_json?.offers)) {
    return raffle.config_json?.offers;
  }
  if (Array.isArray(raffle.offers)) {
    return raffle.offers;
  }
  return [];
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as CheckoutBody;

    const reservationToken =
      typeof body.reservationToken === "string"
        ? body.reservationToken.trim()
        : "";

    if (!reservationToken) {
      return NextResponse.json(
        { ok: false, error: "Missing reservationToken." },
        { status: 400 }
      );
    }

    // ✅ Find reservations
    const reservations = await query<ReservationRow>(
      `
      select
        id,
        raffle_id,
        reservation_token,
        expires_at,
        buyer_email,
        buyer_name,
        created_at
      from raffle_ticket_reservations
      where reservation_token = $1
      order by created_at asc
      `,
      [reservationToken]
    );

    // 🚨 DEBUG BLOCK (DO NOT REMOVE UNTIL FIXED)
    if (!reservations.length) {
      const latest = await query(
        `
        select
          reservation_token,
          raffle_id,
          created_at
        from raffle_ticket_reservations
        order by created_at desc
        limit 5
        `
      );

      return NextResponse.json(
        {
          ok: false,
          error: "Reservation not found.",
          debug: {
            sentToken: reservationToken,
            latestReservations: latest,
          },
        },
        { status: 404 }
      );
    }

    const reservation =
      reservations.find(
        (r) => new Date(r.expires_at).getTime() > Date.now()
      ) ?? reservations[0];

    const raffle = (await getRaffleById(
      reservation.raffle_id
    )) as RaffleLike | null;

    if (!raffle || raffle.status !== "published") {
      return NextResponse.json(
        { ok: false, error: "This raffle is closed." },
        { status: 400 }
      );
    }

    // ✅ Count tickets
    const reservationCount = await queryOne<ReservationCountRow>(
      `
      select count(*)::int as count
      from raffle_ticket_reservations
      where reservation_token = $1
        and raffle_id = $2
      `,
      [reservation.reservation_token, reservation.raffle_id]
    );

    const quantity = Number(reservationCount?.count ?? 0);

    if (!Number.isFinite(quantity) || quantity <= 0) {
      return NextResponse.json(
        { ok: false, error: "Invalid reservation quantity." },
        { status: 400 }
      );
    }

    const singleTicketPriceCents = toMoneyCentsFromRaffle(raffle);

    if (singleTicketPriceCents <= 0) {
      return NextResponse.json(
        { ok: false, error: "Invalid ticket price." },
        { status: 400 }
      );
    }

    // ✅ Offers pricing
    const normalizedOffers = normalizeOffers(getOffersFromRaffle(raffle));

    const pricing = getBestPriceForQuantity({
      quantity,
      single_ticket_price_cents: singleTicketPriceCents,
      offers: normalizedOffers,
    });

    if (pricing.subtotal_cents <= 0) {
      return NextResponse.json(
        { ok: false, error: "Invalid checkout total." },
        { status: 400 }
      );
    }

    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;

    const successUrl = `${baseUrl}/success`;
    const cancelUrl = `${baseUrl}/r/${raffle.slug}`;

    // ✅ Create Stripe session
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: raffle.currency.toLowerCase(),
            product_data: {
              name: raffle.title,
              description: `${quantity} ticket${quantity > 1 ? "s" : ""}`,
            },
            unit_amount: pricing.subtotal_cents,
          },
          quantity: 1,
        },
      ],
      customer_email: reservation.buyer_email || undefined,
      metadata: {
        raffle_id: raffle.id,
        reservation_token: reservation.reservation_token,
        ticket_quantity: String(quantity),
      },
      success_url: `${successUrl}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancelUrl,
    });

    // ✅ FIX: fallback URL
    const checkoutUrl =
      session.url ||
      (session.id
        ? `https://checkout.stripe.com/c/pay/${session.id}`
        : null);

    if (!checkoutUrl) {
      return NextResponse.json(
        {
          ok: false,
          error: "Stripe session created but no checkout URL.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      url: checkoutUrl,
      pricing,
    });
  } catch (error: any) {
    console.error("stripe checkout error", error);

    return NextResponse.json(
      {
        ok: false,
        error: error?.message || "Internal server error.",
      },
      { status: 500 }
    );
  }
}
