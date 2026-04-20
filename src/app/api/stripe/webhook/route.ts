import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { query } from "../../../../../../api/_lib/db";

export const runtime = "nodejs";

function getStripe() {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error("STRIPE_SECRET_KEY is required");
  }
  return new Stripe(process.env.STRIPE_SECRET_KEY);
}

export async function POST(request: NextRequest) {
  try {
    const stripe = getStripe();

    const body = await request.json();

    if (body.type !== "checkout.session.completed") {
      return NextResponse.json({ ok: true });
    }

    const session = body.data.object;

    const reservationToken = session.metadata?.reservation_token;
    const raffleId = session.metadata?.raffle_id;

    if (!reservationToken || !raffleId) {
      return NextResponse.json({ ok: false }, { status: 400 });
    }

    const reservations = await query<any>(
      `
      select *
      from raffle_ticket_reservations
      where raffle_id = $1
        and reservation_token = $2
        and status = 'reserved'
      `,
      [raffleId, reservationToken],
    );

    if (!reservations.length) {
      return NextResponse.json({ ok: true });
    }

    const total = reservations.reduce(
      (sum: number, r: any) => sum + Number(r.unit_price_cents || 0),
      0,
    );

    const feePercent = Number(process.env.PLATFORM_FEE_PERCENT || 10);
    const fee = Math.round(total * (feePercent / 100));

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
        customer_email
      ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
      `,
      [
        paymentId,
        reservations[0].tenant_slug || "",
        raffleId,
        reservationToken,
        session.id,
        session.payment_intent,
        "paid",
        (session.currency || "gbp").toUpperCase(),
        total,
        fee,
        total - fee,
        session.customer_details?.email || null,
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
          colour,
          amount_cents,
          currency
        ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
        `,
        [
          crypto.randomUUID(),
          r.raffle_id,
          r.id,
          paymentId,
          session.id,
          session.payment_intent,
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
        select count(*) from raffle_ticket_sales where raffle_id = $1
      )
      where id = $1
      `,
      [raffleId],
    );

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("webhook error", err);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
