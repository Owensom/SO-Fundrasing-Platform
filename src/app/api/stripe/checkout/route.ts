import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { query } from "../../../../../api/_lib/db";

export const runtime = "nodejs";

type ReservationRow = {
  id: string;
  raffle_id: string;
  reservation_token: string;
  ticket_number: number;
  colour: string | null;
  unit_price_cents: number;
  status: string;
  expires_at: string;
  title: string;
  slug: string;
  tenant_slug: string;
  currency: string | null;
};

function getAppUrl() {
  const value = process.env.NEXT_PUBLIC_APP_URL;
  if (!value) {
    throw new Error("NEXT_PUBLIC_APP_URL is required");
  }
  return value.replace(/\/$/, "");
}

function getStripe() {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error("STRIPE_SECRET_KEY is required");
  }

  return new Stripe(process.env.STRIPE_SECRET_KEY);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const raffleId =
      typeof body.raffleId === "string" ? body.raffleId.trim() : "";
    const reservationToken =
      typeof body.reservationToken === "string"
        ? body.reservationToken.trim()
        : "";

    if (!raffleId || !reservationToken) {
      return NextResponse.json(
        { ok: false, error: "raffleId and reservationToken are required" },
        { status: 400 },
      );
    }

    const rows = await query<ReservationRow>(
      `
      select
        r.id,
        r.raffle_id,
        r.reservation_token,
        r.ticket_number,
        r.colour,
        r.unit_price_cents,
        r.status,
        r.expires_at,
        ra.title,
        ra.slug,
        ra.tenant_slug,
        ra.currency
      from raffle_ticket_reservations r
      join raffles ra on ra.id = r.raffle_id
      where r.raffle_id = $1
        and r.reservation_token = $2
        and r.status = 'reserved'
        and r.expires_at > now()
      order by r.ticket_number asc
      `,
      [raffleId, reservationToken],
    );

    if (!rows.length) {
      return NextResponse.json(
        { ok: false, error: "No active reservations found for checkout" },
        { status: 400 },
      );
    }

    const raffle = rows[0];
    const currency = (raffle.currency || "GBP").toLowerCase();

    const totalAmountCents = rows.reduce(
      (sum, row) => sum + Number(row.unit_price_cents || 0),
      0,
    );

    if (totalAmountCents <= 0) {
      return NextResponse.json(
        { ok: false, error: "Invalid reservation total" },
        { status: 400 },
      );
    }

    const ticketSummary = rows
      .map((row) => `${row.ticket_number}${row.colour ? `-${row.colour}` : ""}`)
      .join(", ");

    const stripe = getStripe();
    const appUrl = getAppUrl();

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      success_url: `${appUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/r/${raffle.slug}?checkout=cancelled`,
      client_reference_id: reservationToken,
      customer_creation: "always",
      metadata: {
        raffle_id: raffle.raffle_id,
        tenant_slug: raffle.tenant_slug,
        reservation_token: reservationToken,
      },
      payment_intent_data: {
        metadata: {
          raffle_id: raffle.raffle_id,
          tenant_slug: raffle.tenant_slug,
          reservation_token: reservationToken,
        },
      },
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency,
            unit_amount: totalAmountCents,
            product_data: {
              name: `${raffle.title} tickets`,
              description: `${rows.length} ticket(s): ${ticketSummary}`.slice(
                0,
                500,
              ),
            },
          },
        },
      ],
    });

    await query(
      `
      update raffle_ticket_reservations
      set checkout_session_id = $3
      where raffle_id = $1
        and reservation_token = $2
      `,
      [raffleId, reservationToken, session.id],
    );

    return NextResponse.json({
      ok: true,
      sessionId: session.id,
      url: session.url,
    });
  } catch (error) {
    console.error("stripe checkout create error", error);
    return NextResponse.json(
      { ok: false, error: "Failed to create checkout session" },
      { status: 500 },
    );
  }
}
