import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { query } from "@/lib/db";
import { sendReceiptEmail, sendSquaresReceiptEmail } from "@/lib/email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2023-10-16",
});

export async function POST(request: NextRequest) {
  try {
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!webhookSecret) {
      return NextResponse.json(
        { ok: false, error: "STRIPE_WEBHOOK_SECRET is missing" },
        { status: 500 }
      );
    }

    const signature = request.headers.get("stripe-signature");

    if (!signature) {
      return NextResponse.json(
        { ok: false, error: "Missing Stripe signature" },
        { status: 400 }
      );
    }

    const rawBody = await request.text();

    let event: Stripe.Event;

    try {
      event = stripe.webhooks.constructEvent(
        rawBody,
        signature,
        webhookSecret
      );
    } catch (error: any) {
      console.error("Stripe webhook signature error", error);

      return NextResponse.json(
        { ok: false, error: error?.message || "Invalid signature" },
        { status: 400 }
      );
    }

    if (event.type !== "checkout.session.completed") {
      return NextResponse.json({ ok: true, ignored: event.type });
    }

    const session = event.data.object as Stripe.Checkout.Session;

    const type = session.metadata?.type || "raffle";

    const reservationToken = String(session.metadata?.reservation_token || "");
    const tenantSlug = String(session.metadata?.tenant_slug || "");

    const paymentIntentId =
      typeof session.payment_intent === "string"
        ? session.payment_intent
        : session.payment_intent?.id || null;

    const grossAmountCents = Number(session.amount_total || 0);
    const platformFeeCents = Number(session.metadata?.platform_fee_cents || 0);
    const netAmountCents = Number(
      session.metadata?.net_amount_cents ||
        Math.max(grossAmountCents - platformFeeCents, 0)
    );

    const email =
      session.customer_details?.email || session.customer_email || null;

    const name = session.customer_details?.name || null;

    if (type === "raffle") {
      const raffleId = String(session.metadata?.raffle_id || "");

      if (!raffleId || !reservationToken) {
        return NextResponse.json(
          { ok: false, error: "Missing raffle metadata" },
          { status: 400 }
        );
      }

      await query(
        `
        update raffle_ticket_reservations
        set
          status = 'sold',
          checkout_session_id = $1,
          payment_id = $2,
          gross_amount_cents = $3,
          platform_fee_cents = $4,
          net_amount_cents = $5
        where raffle_id = $6
          and reservation_token = $7
        `,
        [
          session.id,
          paymentIntentId,
          grossAmountCents,
          platformFeeCents,
          netAmountCents,
          raffleId,
          reservationToken,
        ]
      );

      const tickets = await query(
        `
        select ticket_number, colour
        from raffle_ticket_reservations
        where raffle_id = $1
          and reservation_token = $2
        `,
        [raffleId, reservationToken]
      );

      if (email) {
        await sendReceiptEmail({
          to: email,
          name,
          raffleTitle: session.metadata?.raffle_title || "Raffle",
          tickets,
          amountCents: grossAmountCents,
          currency: session.currency || "GBP",
          reservationToken,
        });
      }
    }

    if (type === "squares") {
      const gameId = String(session.metadata?.game_id || "");

      if (!gameId || !reservationToken) {
        return NextResponse.json(
          { ok: false, error: "Missing squares metadata" },
          { status: 400 }
        );
      }

      await query(
        `
        update squares_reservations
        set
          payment_status = 'paid',
          stripe_checkout_session_id = $1
        where reservation_token = $2
        `,
        [session.id, reservationToken]
      );

      const squares = JSON.parse(
        session.metadata?.squares_json || "[]"
      ) as number[];

      if (email) {
        await sendSquaresReceiptEmail({
          to: email,
          name,
          gameTitle: session.metadata?.game_title || "Squares Game",
          squares,
          amountCents: grossAmountCents,
          currency: session.currency || "GBP",
          reservationToken,
        });
      }
    }

    await query(
      `
      insert into platform_payments (
        stripe_checkout_session_id,
        stripe_payment_intent_id,
        tenant_slug,
        reservation_token,
        currency,
        gross_amount_cents,
        platform_fee_cents,
        net_amount_cents,
        payment_status,
        customer_email
      )
      values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
      on conflict (stripe_checkout_session_id)
      do update set
        stripe_payment_intent_id = excluded.stripe_payment_intent_id,
        tenant_slug = excluded.tenant_slug,
        reservation_token = excluded.reservation_token,
        currency = excluded.currency,
        gross_amount_cents = excluded.gross_amount_cents,
        platform_fee_cents = excluded.platform_fee_cents,
        net_amount_cents = excluded.net_amount_cents,
        payment_status = excluded.payment_status,
        customer_email = excluded.customer_email
      `,
      [
        session.id,
        paymentIntentId,
        tenantSlug,
        reservationToken,
        session.currency || null,
        grossAmountCents,
        platformFeeCents,
        netAmountCents,
        session.payment_status || null,
        email,
      ]
    );

    return NextResponse.json({
      ok: true,
      event: event.type,
    });
  } catch (error: any) {
    console.error("Stripe webhook error", error);

    return NextResponse.json(
      { ok: false, error: error?.message || "Webhook failed" },
      { status: 500 }
    );
  }
}
