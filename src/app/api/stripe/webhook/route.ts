import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { query } from "../../../../../../api/_lib/db";

export const runtime = "nodejs";

type ReservationRow = {
  id: string;
  raffle_id: string;
  reservation_token: string;
  ticket_number: number;
  colour: string | null;
  buyer_email: string | null;
  unit_price_cents: number;
  status: string;
  tenant_slug: string;
};

function getStripe() {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error("STRIPE_SECRET_KEY is required");
  }
  return new Stripe(process.env.STRIPE_SECRET_KEY);
}

export async function POST(request: NextRequest) {
  try {
    const stripe = getStripe();
    const signature = request.headers.get("stripe-signature");

    if (!signature) {
      return NextResponse.json(
        { ok: false, error: "Missing stripe signature" },
        { status: 400 },
      );
    }

    if (!process.env.STRIPE_WEBHOOK_SECRET) {
      return NextResponse.json(
        { ok: false, error: "Missing STRIPE_WEBHOOK_SECRET" },
        { status: 500 },
      );
    }

    const rawBody = await request.text();

    const event = stripe.webhooks.constructEvent(
      rawBody,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET,
    );

    if (
      event.type !== "checkout.session.completed" &&
      event.type !== "checkout.session.async_payment_succeeded"
    ) {
      return NextResponse.json({ ok: true });
    }

    const session = event.data.object as Stripe.Checkout.Session;

    const reservationToken = session.metadata?.reservation_token;
    const raffleId = session.metadata?.raffle_id;

    if (!reservationToken || !raffleId) {
      return NextResponse.json(
        { ok: false, error: "Missing reservation metadata" },
        { status: 400 },
      );
    }

    const existingPayment = await query<{ id: string }>(
      `
      select id
      from raffle_payments
      where stripe_checkout_session_id = $1
      limit 1
      `,
      [session.id],
    );

    if (existingPayment.length) {
      return NextResponse.json({ ok: true });
    }

    const reservations = await query<ReservationRow>(
      `
      select
        r.id,
        r.raffle_id,
        r.reservation_token,
        r.ticket_number,
        r.colour,
        r.buyer_email,
        r.unit_price_cents,
        r.status,
        ra.tenant_slug
      from raffle_ticket_reservations r
      join raffles ra on ra.id = r.raffle_id
      where r.raffle_id = $1
        and r.reservation_token = $2
      order by r.ticket_number asc
      `,
      [raffleId, reservationToken],
    );

    if (!reservations.length) {
      return NextResponse.json({ ok: true });
    }

    const total = reservations.reduce(
      (sum, row) => sum + Number(row.unit_price_cents || 0),
      0,
    );

    const feePercent = Number(process.env.PLATFORM_FEE_PERCENT || "10");
    const platformFee = Math.round(total * (feePercent / 100));
    const paymentId = crypto.randomUUID();

    await query(
      `
      insert into raffle_payments (
        id,
        tenant_slug,
        raffle_id,
        reservation_token,
        stripe_checkout_session_id,
        stripe_payment_intent_id,
        payment_status,
        currency,
        gross_amount_cents,
        platform_fee_cents,
        net_amount_cents,
        customer_email,
        customer_name,
        metadata_json
      ) values (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14::jsonb
      )
      `,
      [
        paymentId,
        reservations[0].tenant_slug,
        raffleId,
        reservationToken,
        session.id,
        typeof session.payment_intent === "string"
          ? session.payment_intent
          : null,
        session.payment_status || "paid",
        (session.currency || "gbp").toUpperCase(),
        total,
        platformFee,
        total - platformFee,
        session.customer_details?.email ||
          reservations[0].buyer_email ||
          null,
        session.customer_details?.name || null,
        JSON.stringify(session.metadata || {}),
      ],
    );

    for (const r of reservations) {
      await query(
        `
        insert into raffle_ticket_sales (
          id,
          raffle_id,
          reservation_id,
          payment_id,
          stripe_checkout_session_id,
          stripe_payment_intent_id,
          ticket_number,
          colour_id,
          amount_cents,
          currency,
          sold_at
        ) values (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, now()
        )
        `,
        [
          crypto.randomUUID(),
          r.raffle_id,
          r.id,
          paymentId,
          session.id,
          typeof session.payment_intent === "string"
            ? session.payment_intent
            : null,
          r.ticket_number,
          r.colour,
          r.unit_price_cents,
          (session.currency || "gbp").toUpperCase(),
        ],
      );
    }

    await query(
      `
      update raffle_ticket_reservations
      set status = 'sold', payment_id = $3
      where raffle_id = $1
        and reservation_token = $2
      `,
      [raffleId, reservationToken, paymentId],
    );

    await query(
      `
      update raffles
      set sold_tickets = (
        select count(*)
        from raffle_ticket_sales
        where raffle_id = $1
      )
      where id = $1
      `,
      [raffleId],
    );

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("stripe webhook error", error);
    return NextResponse.json(
      { ok: false, error: "Webhook failed" },
      { status: 500 },
    );
  }
}
