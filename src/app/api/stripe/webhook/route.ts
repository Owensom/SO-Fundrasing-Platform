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
        { status: 500 },
      );
    }

    const signature = request.headers.get("stripe-signature");

    if (!signature) {
      return NextResponse.json(
        { ok: false, error: "Missing Stripe signature" },
        { status: 400 },
      );
    }

    const rawBody = await request.text();

    let event: Stripe.Event;

    try {
      event = stripe.webhooks.constructEvent(
        rawBody,
        signature,
        webhookSecret,
      );
    } catch (error: any) {
      console.error("Stripe webhook signature error", error);

      return NextResponse.json(
        { ok: false, error: error?.message || "Invalid signature" },
        { status: 400 },
      );
    }

    if (event.type !== "checkout.session.completed") {
      return NextResponse.json({ ok: true, ignored: event.type });
    }

    const session = event.data.object as Stripe.Checkout.Session;

    const type = String(session.metadata?.type || "raffle");

    const reservationToken = String(
      session.metadata?.reservation_token ||
        session.metadata?.reservationToken ||
        "",
    );

    const tenantSlug = String(
      session.metadata?.tenant_slug || session.metadata?.tenantSlug || "",
    );

    const raffleId =
      type === "raffle"
        ? String(session.metadata?.raffle_id || session.metadata?.raffleId || "")
        : null;

    const squaresGameId =
      type === "squares"
        ? String(session.metadata?.game_id || session.metadata?.gameId || "")
        : null;

    const paymentIntentId =
      typeof session.payment_intent === "string"
        ? session.payment_intent
        : session.payment_intent?.id || null;

    const grossAmountCents = Number(session.amount_total || 0);
    const platformFeeCents = Number(session.metadata?.platform_fee_cents || 0);
    const netAmountCents = Number(
      session.metadata?.net_amount_cents ||
        Math.max(grossAmountCents - platformFeeCents, 0),
    );

    const email =
      session.customer_details?.email || session.customer_email || null;

    const name = session.customer_details?.name || null;

    if (!reservationToken) {
      return NextResponse.json(
        { ok: false, error: "Missing reservation token" },
        { status: 400 },
      );
    }

    if (type === "raffle") {
      if (!raffleId) {
        return NextResponse.json(
          { ok: false, error: "Missing raffle_id metadata" },
          { status: 400 },
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
        ],
      );

      await query(
        `
        insert into raffle_ticket_sales (
          raffle_id,
          ticket_number,
          colour,
          buyer_name,
          buyer_email,
          currency,
          amount_cents,
          reservation_id,
          payment_id,
          stripe_checkout_session_id,
          stripe_payment_intent_id,
          purchase_reference,
          reservation_group_id,
          sold_at
        )
        select
          r.raffle_id,
          r.ticket_number,
          coalesce(nullif(r.colour, ''), 'default'),
          coalesce(r.buyer_name, $7),
          coalesce(r.buyer_email, $8),
          $3,
          $4,
          r.reservation_token,
          $5,
          $6,
          $5,
          r.reservation_token,
          r.reservation_group_id,
          now()
        from raffle_ticket_reservations r
        where r.raffle_id = $1
          and r.reservation_token = $2
          and r.status = 'sold'
          and not exists (
            select 1
            from raffle_ticket_sales s
            where s.raffle_id = r.raffle_id
              and s.ticket_number = r.ticket_number
              and s.colour = coalesce(nullif(r.colour, ''), 'default')
          )
        `,
        [
          raffleId,
          reservationToken,
          session.currency || "GBP",
          grossAmountCents,
          paymentIntentId,
          session.id,
          name,
          email,
        ],
      );

      await query(
        `
        update raffles
        set
          sold_tickets = (
            select count(*)::int
            from raffle_ticket_sales
            where raffle_id = $1
          ),
          updated_at = now()
        where id = $1
        `,
        [raffleId],
      );

      const tickets = await query<{
        ticket_number: number;
        colour: string;
      }>(
        `
        select ticket_number, colour
        from raffle_ticket_sales
        where raffle_id = $1
          and reservation_id = $2
        order by ticket_number asc
        `,
        [raffleId, reservationToken],
      );

      if (email) {
        try {
          await sendReceiptEmail({
            to: email,
            name,
            raffleTitle: session.metadata?.raffle_title || "Raffle",
            tickets,
            amountCents: grossAmountCents,
            currency: session.currency || "GBP",
            reservationToken,
          });
        } catch (emailError) {
          console.error("Raffle receipt email failed:", emailError);
        }
      }
    }

    if (type === "squares") {
      if (!squaresGameId) {
        return NextResponse.json(
          { ok: false, error: "Missing squares game metadata" },
          { status: 400 },
        );
      }

      const squares = JSON.parse(
        session.metadata?.squares_json || "[]",
      ) as number[];

      await query(
        `
        update squares_reservations
        set
          payment_status = 'paid',
          stripe_checkout_session_id = $1
        where reservation_token = $2
          and game_id = $3
        `,
        [session.id, reservationToken, squaresGameId],
      );

      await query(
        `
        insert into squares_sales (
          id,
          tenant_slug,
          game_id,
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
          squares,
          metadata_json
        )
        values (
          gen_random_uuid()::text,
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::jsonb,$14::jsonb
        )
        `,
        [
          tenantSlug,
          squaresGameId,
          reservationToken,
          session.id,
          paymentIntentId,
          session.payment_status || "paid",
          session.currency || "GBP",
          grossAmountCents,
          platformFeeCents,
          netAmountCents,
          email,
          name,
          JSON.stringify(squares),
          JSON.stringify(session.metadata || {}),
        ],
      );

      await query(
        `
        update squares_games
        set
          config_json = jsonb_set(
            jsonb_set(
              coalesce(config_json, '{}'::jsonb),
              '{sold}',
              (
                select to_jsonb(array_agg(distinct value::int order by value::int))
                from jsonb_array_elements_text(
                  coalesce(config_json->'sold', '[]'::jsonb) || $2::jsonb
                ) as value
              )
            ),
            '{reserved}',
            (
              select to_jsonb(coalesce(array_agg(value::int order by value::int), '{}'))
              from jsonb_array_elements_text(
                coalesce(config_json->'reserved', '[]'::jsonb)
              ) as value
              where value::int not in (
                select jsonb_array_elements_text($2::jsonb)::int
              )
            )
          ),
          updated_at = now()
        where id = $1
        `,
        [squaresGameId, JSON.stringify(squares)],
      );

      if (email) {
        try {
          await sendSquaresReceiptEmail({
            to: email,
            name,
            gameTitle: session.metadata?.game_title || "Squares Game",
            squares,
            amountCents: grossAmountCents,
            currency: session.currency || "GBP",
            reservationToken,
          });
        } catch (emailError) {
          console.error("Squares receipt email failed:", emailError);
        }
      }
    }

    await query(
      `
      insert into platform_payments (
        stripe_checkout_session_id,
        stripe_payment_intent_id,
        raffle_id,
        tenant_slug,
        reservation_token,
        currency,
        gross_amount_cents,
        platform_fee_cents,
        net_amount_cents,
        payment_status,
        customer_email,
        payment_type,
        squares_game_id
      )
      values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
      on conflict (stripe_checkout_session_id)
      do update set
        stripe_payment_intent_id = excluded.stripe_payment_intent_id,
        raffle_id = excluded.raffle_id,
        tenant_slug = excluded.tenant_slug,
        reservation_token = excluded.reservation_token,
        currency = excluded.currency,
        gross_amount_cents = excluded.gross_amount_cents,
        platform_fee_cents = excluded.platform_fee_cents,
        net_amount_cents = excluded.net_amount_cents,
        payment_status = excluded.payment_status,
        customer_email = excluded.customer_email,
        payment_type = excluded.payment_type,
        squares_game_id = excluded.squares_game_id
      `,
      [
        session.id,
        paymentIntentId,
        raffleId,
        tenantSlug,
        reservationToken,
        session.currency || null,
        grossAmountCents,
        platformFeeCents,
        netAmountCents,
        session.payment_status || null,
        email,
        type,
        squaresGameId,
      ],
    );

    return NextResponse.json({
      ok: true,
      event: event.type,
      type,
      checkoutSessionId: session.id,
    });
  } catch (error: any) {
    console.error("Stripe webhook error", error);

    return NextResponse.json(
      { ok: false, error: error?.message || "Webhook failed" },
      { status: 500 },
    );
  }
}
