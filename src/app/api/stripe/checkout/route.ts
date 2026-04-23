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
  reservation_group_id?: string | null;
  ticket_number?: number | null;
  colour: string | null;
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
    [key: string]: unknown;
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

    console.log("STRIPE CHECKOUT INPUT", {
      requestedRaffleId,
      reservationToken,
    });

    if (!reservationToken) {
      return NextResponse.json(
        { ok: false, error: "Missing reservationToken." },
        { status: 400 }
      );
    }

    const reservations = await query<ReservationRow>(
      `
      select
        id,
        raffle_id,
        reservation_token,
        reservation_group_id,
        ticket_number,
        colour,
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

    console.log("CHECKOUT TOKEN MATCHES", reservations);

    const nowIso = new Date().toISOString();

    if (!reservations.length) {
      const latestReservations = await query<ReservationRow>(
        `
        select
          id,
          raffle_id,
          reservation_token,
          reservation_group_id,
          ticket_number,
          colour,
          expires_at,
          buyer_email,
          buyer_name,
          status,
          created_at
        from raffle_ticket_reservations
        order by created_at desc
        limit 10
        `
      );

      return NextResponse.json(
        {
          ok: false,
          error: "Reservation not found.",
          debug: {
            requestedRaffleId,
            reservationToken,
            nowIso,
            foundCount: 0,
            latestReservations: latestReservations.map((row) => ({
              raffle_id: row.raffle_id,
              reservation_token: row.reservation_token,
              reservation_group_id: row.reservation_group_id,
              ticket_number: row.ticket_number,
              colour: row.colour,
              buyer_email: row.buyer_email,
              buyer_name: row.buyer_name,
              status: row.status,
              expires_at: row.expires_at,
              created_at: row.created_at,
            })),
          },
        },
        { status: 404 }
      );
    }

    const reservation =
      reservations.find(
        (row) => new Date(row.expires_at).getTime() > Date.now()
      ) ?? reservations[0];

    const raffleIdToUse = reservation.raffle_id || requestedRaffleId;

    if (!raffleIdToUse) {
      return NextResponse.json(
        {
          ok: false,
          error: "Missing raffle id for reservation.",
          debug: {
            requestedRaffleId,
            reservationToken,
            reservation,
          },
        },
        { status: 400 }
      );
    }

    const raffle = (await getRaffleById(raffleIdToUse)) as RaffleLike | null;

    if (!raffle) {
      return NextResponse.json(
        {
          ok: false,
          error: "Raffle not found for reservation.",
          debug: {
            requestedRaffleId,
            raffleIdToUse,
            reservationToken,
            reservation,
          },
        },
        { status: 404 }
      );
    }

    if (raffle.status !== "published") {
      return NextResponse.json(
        {
          ok: false,
          error: "This raffle is closed.",
          debug: {
            raffleIdToUse,
            raffleStatus: raffle.status,
          },
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
      `,
      [reservation.reservation_token, raffleIdToUse]
    );

    const quantity = Number(reservationCount?.count ?? 0);

    if (!Number.isFinite(quantity) || quantity <= 0) {
      return NextResponse.json(
        {
          ok: false,
          error: "Invalid reservation quantity.",
          debug: {
            raffleIdToUse,
            reservationToken,
            reservationCount,
            reservation,
          },
        },
        { status: 400 }
      );
    }

    const singleTicketPriceCents = toMoneyCentsFromRaffle(raffle);

    if (!Number.isFinite(singleTicketPriceCents) || singleTicketPriceCents <= 0) {
      return NextResponse.json(
        {
          ok: false,
          error: "Invalid ticket price.",
          debug: {
            raffleIdToUse,
            ticket_price: raffle.ticket_price,
            ticket_price_cents: raffle.ticket_price_cents,
          },
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
          error: "Invalid checkout total.",
          debug: {
            pricing,
            raffleIdToUse,
            reservationToken,
          },
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

    const descriptionParts: string[] = [
      `${quantity} ticket${quantity > 1 ? "s" : ""}`,
    ];

    if (pricing.applied_offers.length > 0) {
      descriptionParts.push(
        `Offers applied: ${pricing.applied_offers
          .map((offer) => `${offer.count} x ${offer.label}`)
          .join(", ")}`
      );
    }

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: raffle.currency.toLowerCase(),
            product_data: {
              name: raffle.title,
              description: descriptionParts.join(" • "),
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
        single_ticket_price_cents: String(singleTicketPriceCents),
        subtotal_cents: String(pricing.subtotal_cents),
        base_total_cents: String(pricing.base_total_cents),
        savings_cents: String(pricing.savings_cents),
        applied_offers_json: JSON.stringify(pricing.applied_offers),
        tenant_slug: raffle.tenant_slug ?? "",
        requested_raffle_id: requestedRaffleId,
      },
      success_url: `${successUrl}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancelUrl,
    });

    return NextResponse.json({
      ok: true,
      url: session.url,
      pricing: {
        quantity: pricing.quantity,
        subtotal_cents: pricing.subtotal_cents,
        base_total_cents: pricing.base_total_cents,
        savings_cents: pricing.savings_cents,
        applied_offers: pricing.applied_offers,
      },
      debug: {
        requestedRaffleId,
        raffleIdToUse,
        reservationToken,
        reservationRowsFound: reservations.length,
      },
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
