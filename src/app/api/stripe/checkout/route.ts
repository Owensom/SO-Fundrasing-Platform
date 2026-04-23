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
  status?: string | null;
  created_at?: string;
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
  const centsRaw = raffle.ticket_price_cents;

  if (typeof centsRaw === "number" && Number.isFinite(centsRaw) && centsRaw > 0) {
    return Math.round(centsRaw);
  }

  if (
    typeof centsRaw === "string" &&
    centsRaw.trim() !== "" &&
    Number.isFinite(Number(centsRaw))
  ) {
    const parsed = Number(centsRaw);
    if (parsed > 0) return Math.round(parsed);
  }

  const priceRaw = raffle.ticket_price;

  if (typeof priceRaw === "number" && Number.isFinite(priceRaw) && priceRaw > 0) {
    return Math.round(priceRaw * 100);
  }

  if (
    typeof priceRaw === "string" &&
    priceRaw.trim() !== "" &&
    Number.isFinite(Number(priceRaw))
  ) {
    const parsed = Number(priceRaw);
    if (parsed > 0) return Math.round(parsed * 100);
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

    const requestedRaffleId =
      typeof body.raffleId === "string" ? body.raffleId.trim() : "";
    const reservationToken =
      typeof body.reservationToken === "string"
        ? body.reservationToken.trim()
        : "";

    if (!requestedRaffleId || !reservationToken) {
      return NextResponse.json(
        {
          ok: false,
          error: `Missing raffleId or reservationToken | raffleId=${requestedRaffleId || "(blank)"} | token=${reservationToken || "(blank)"}`,
        },
        { status: 400 }
      );
    }

    const exactReservations = await query<ReservationRow>(
      `
      select
        id,
        raffle_id,
        reservation_token,
        expires_at,
        buyer_email,
        buyer_name,
        status,
        created_at
      from raffle_ticket_reservations
      where reservation_token = $1
        and raffle_id = $2
      order by created_at asc
      `,
      [reservationToken, requestedRaffleId]
    );

    if (!exactReservations.length) {
      const tokenOnlyReservations = await query<ReservationRow>(
        `
        select
          id,
          raffle_id,
          reservation_token,
          expires_at,
          buyer_email,
          buyer_name,
          status,
          created_at
        from raffle_ticket_reservations
        where reservation_token = $1
        order by created_at asc
        `,
        [reservationToken]
      );

      const latestReservations = await query<ReservationRow>(
        `
        select
          id,
          raffle_id,
          reservation_token,
          expires_at,
          buyer_email,
          buyer_name,
          status,
          created_at
        from raffle_ticket_reservations
        order by created_at desc
        limit 3
        `
      );

      return NextResponse.json(
        {
          ok: false,
          error:
            `Reservation not found | sent raffleId=${requestedRaffleId} | sent token=${reservationToken} | tokenOnlyMatches=${tokenOnlyReservations.length}` +
            (tokenOnlyReservations[0]
              ? ` | token belongs to raffleId=${tokenOnlyReservations[0].raffle_id}`
              : "") +
            (latestReservations[0]
              ? ` | latest raffleId=${latestReservations[0].raffle_id} | latest token=${latestReservations[0].reservation_token}`
              : ""),
        },
        { status: 404 }
      );
    }

    const reservation =
      exactReservations.find(
        (row) => new Date(row.expires_at).getTime() > Date.now()
      ) ?? null;

    if (!reservation) {
      return NextResponse.json(
        {
          ok: false,
          error: `Reservation expired | raffleId=${requestedRaffleId} | token=${reservationToken}`,
        },
        { status: 400 }
      );
    }

    const raffle = (await getRaffleById(requestedRaffleId)) as RaffleLike | null;

    if (!raffle || raffle.status !== "published") {
      return NextResponse.json(
        {
          ok: false,
          error: `Raffle not available | raffleId=${requestedRaffleId} | status=${raffle?.status || "(missing)"}`,
        },
        { status: 400 }
      );
    }

    const reservationCount = await queryOne<ReservationCountRow>(
      `
      select count(*)::int as count
      from raffle_ticket_reservations
      where reservation_token = $1
        and raffle_id = $2
        and expires_at > now()
      `,
      [reservationToken, requestedRaffleId]
    );

    const quantity = Number(reservationCount?.count ?? 0);

    if (!Number.isFinite(quantity) || quantity <= 0) {
      return NextResponse.json(
        {
          ok: false,
          error: `Invalid reservation quantity | raffleId=${requestedRaffleId} | token=${reservationToken} | count=${String(reservationCount?.count ?? 0)}`,
        },
        { status: 400 }
      );
    }

    const singleTicketPriceCents = toMoneyCentsFromRaffle(raffle);

    if (!Number.isFinite(singleTicketPriceCents) || singleTicketPriceCents <= 0) {
      return NextResponse.json(
        {
          ok: false,
          error: `Invalid ticket price | raffleId=${requestedRaffleId}`,
        },
        { status: 400 }
      );
    }

    const normalizedOffers = normalizeOffers(getOffersFromRaffle(raffle));

    const pricing = getBestPriceForQuantity({
      quantity,
      single_ticket_price_cents: singleTicketPriceCents,
      offers: normalizedOffers,
    });

    if (!Number.isFinite(pricing.subtotal_cents) || pricing.subtotal_cents <= 0) {
      return NextResponse.json(
        {
          ok: false,
          error: `Invalid checkout total | raffleId=${requestedRaffleId} | quantity=${quantity}`,
        },
        { status: 400 }
      );
    }

    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;

    const successUrl =
      typeof body.successUrl === "string" && body.successUrl.trim()
        ? body.successUrl.trim()
        : `${baseUrl}/success`;

    const cancelUrl =
      typeof body.cancelUrl === "string" && body.cancelUrl.trim()
        ? body.cancelUrl.trim()
        : `${baseUrl}/r/${raffle.slug}`;

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
        raffle_id: requestedRaffleId,
        reservation_token: reservationToken,
        ticket_quantity: String(quantity),
      },
      success_url: `${successUrl}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancelUrl,
    });

    const checkoutUrl =
      session.url ||
      (session.id
        ? `https://checkout.stripe.com/c/pay/${session.id}`
        : null);

    if (!checkoutUrl) {
      return NextResponse.json(
        {
          ok: false,
          error: `Stripe session created but no checkout URL | raffleId=${requestedRaffleId} | token=${reservationToken}`,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      url: checkoutUrl,
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
