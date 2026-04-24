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
  const cents = Number(raffle.ticket_price_cents);
  if (Number.isFinite(cents) && cents > 0) return Math.round(cents);

  const price = Number(raffle.ticket_price);
  if (Number.isFinite(price) && price > 0) return Math.round(price * 100);

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

function calculatePlatformFee(totalCents: number) {
  const platformFeePercent = Number(process.env.PLATFORM_FEE_PERCENT ?? 10);

  if (!Number.isFinite(platformFeePercent) || platformFeePercent < 0) {
    return Math.round(totalCents * 0.1);
  }

  return Math.round(totalCents * (platformFeePercent / 100));
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as CheckoutBody;

    const raffleId =
      typeof body.raffleId === "string" ? body.raffleId.trim() : "";

    const reservationToken =
      typeof body.reservationToken === "string"
        ? body.reservationToken.trim()
        : "";

    if (!raffleId || !reservationToken) {
      return NextResponse.json(
        { ok: false, error: "Missing raffleId or reservationToken." },
        { status: 400 }
      );
    }

    const reservations = await query<ReservationRow>(
      `
      select
        id::text,
        raffle_id,
        reservation_token,
        expires_at,
        buyer_email,
        buyer_name
      from raffle_ticket_reservations
      where reservation_token = $1
        and raffle_id = $2
        and expires_at > now()
      order by created_at asc
      `,
      [reservationToken, raffleId]
    );

    if (!reservations.length) {
      return NextResponse.json(
        { ok: false, error: "Reservation not found or expired." },
        { status: 404 }
      );
    }

    const reservation = reservations[0];

    const raffle = (await getRaffleById(raffleId)) as RaffleLike | null;

    if (!raffle || raffle.status !== "published") {
      return NextResponse.json(
        { ok: false, error: "Raffle is not available." },
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
      [reservationToken, raffleId]
    );

    const quantity = Number(reservationCount?.count ?? 0);

    if (!Number.isFinite(quantity) || quantity <= 0) {
      return NextResponse.json(
        { ok: false, error: "Invalid reservation quantity." },
        { status: 400 }
      );
    }

    const singleTicketPriceCents = toMoneyCentsFromRaffle(raffle);

    if (!Number.isFinite(singleTicketPriceCents) || singleTicketPriceCents <= 0) {
      return NextResponse.json(
        { ok: false, error: "Invalid ticket price." },
        { status: 400 }
      );
    }

    const offers = normalizeOffers(getOffersFromRaffle(raffle));

    const pricing = getBestPriceForQuantity({
      quantity,
      single_ticket_price_cents: singleTicketPriceCents,
      offers,
    });

    if (!Number.isFinite(pricing.subtotal_cents) || pricing.subtotal_cents <= 0) {
      return NextResponse.json(
        { ok: false, error: "Invalid checkout total." },
        { status: 400 }
      );
    }

    const platformFeeCents = calculatePlatformFee(pricing.subtotal_cents);
    const netAmountCents = Math.max(pricing.subtotal_cents - platformFeeCents, 0);

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;

    const successUrl =
      typeof body.successUrl === "string" && body.successUrl.trim()
        ? body.successUrl.trim()
        : `${baseUrl}/success`;

    const cancelUrl =
      typeof body.cancelUrl === "string" && body.cancelUrl.trim()
        ? body.cancelUrl.trim()
        : `${baseUrl}/r/${raffle.slug}`;

    const appliedOffersDescription =
      pricing.applied_offers?.length > 0
        ? ` | Offers: ${pricing.applied_offers
            .map((offer: any) => `${offer.count} × ${offer.label}`)
            .join(", ")}`
        : "";

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
              }${appliedOffersDescription}`,
            },
            unit_amount: pricing.subtotal_cents,
          },
          quantity: 1,
        },
      ],
      customer_email: reservation.buyer_email || undefined,
      metadata: {
        raffle_id: raffleId,
        reservation_token: reservationToken,
        tenant_slug: raffle.tenant_slug ?? "",
        ticket_quantity: String(quantity),
        single_ticket_price_cents: String(singleTicketPriceCents),
        subtotal_cents: String(pricing.subtotal_cents),
        base_total_cents: String(pricing.base_total_cents),
        savings_cents: String(pricing.savings_cents),
        platform_fee_cents: String(platformFeeCents),
        net_amount_cents: String(netAmountCents),
        applied_offers_json: JSON.stringify(pricing.applied_offers ?? []),
      },
      success_url: `${successUrl}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancelUrl,
    });

    const checkoutUrl =
      session.url ||
      (session.id ? `https://checkout.stripe.com/c/pay/${session.id}` : null);

    if (!checkoutUrl) {
      return NextResponse.json(
        { ok: false, error: "Stripe session created but no checkout URL." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      url: checkoutUrl,
      pricing: {
        ...pricing,
        platform_fee_cents: platformFeeCents,
        net_amount_cents: netAmountCents,
      },
    });
  } catch (error: any) {
    console.error("stripe checkout error", error);

    return NextResponse.json(
      { ok: false, error: error?.message || "Internal server error." },
      { status: 500 }
    );
  }
}
