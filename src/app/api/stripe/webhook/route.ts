import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { query } from "@/lib/db";
import {
  sendEventReceiptEmail,
  sendReceiptEmail,
  sendSquaresReceiptEmail,
} from "@/lib/email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2023-10-16",
});

type PaymentFinancials = {
  grossAmountCents: number;
  platformFeeCents: number;
  donorFeeCents: number;
  donorCoveredFees: boolean;
  netAmountCents: number;
  stripeConnectRouted: boolean;
  stripeConnectAccountId: string;
  applicationFeeAmountCents: number;
  stripeTransferId: string;
  stripeDestinationAccountId: string;
};

async function syncStripeConnectAccountById(accountId: string) {
  const account = await stripe.accounts.retrieve(accountId);

  const onboardingComplete = Boolean(
    account.details_submitted && account.charges_enabled,
  );

  await query(
    `
    update tenants
    set
      stripe_connect_charges_enabled = $2,
      stripe_connect_payouts_enabled = $3,
      stripe_connect_details_submitted = $4,
      stripe_connect_onboarding_complete = $5,
      stripe_connect_country = $6,
      stripe_connect_default_currency = $7,
      stripe_connect_last_synced_at = now()
    where stripe_connect_account_id = $1
    `,
    [
      account.id,
      Boolean(account.charges_enabled),
      Boolean(account.payouts_enabled),
      Boolean(account.details_submitted),
      onboardingComplete,
      account.country || null,
      account.default_currency || null,
    ],
  );

  return account;
}

function getConnectedAccountIdFromEvent(event: Stripe.Event) {
  const eventAny = event as any;

  if (typeof event.account === "string" && event.account.trim()) {
    return event.account.trim();
  }

  if (
    eventAny.related_object &&
    eventAny.related_object.type === "v2.core.account" &&
    typeof eventAny.related_object.id === "string"
  ) {
    return eventAny.related_object.id.trim();
  }

  if (
    eventAny.related_object &&
    eventAny.related_object.type === "account" &&
    typeof eventAny.related_object.id === "string"
  ) {
    return eventAny.related_object.id.trim();
  }

  const object = event.data?.object as any;

  if (
    object?.id &&
    typeof object.id === "string" &&
    object.id.startsWith("acct_")
  ) {
    return object.id.trim();
  }

  if (
    object?.account &&
    typeof object.account === "string" &&
    object.account.startsWith("acct_")
  ) {
    return object.account.trim();
  }

  return "";
}

function isStripeConnectAccountEvent(eventType: string) {
  return (
    eventType === "account.updated" ||
    eventType === "v2.core.account[requirements].updated" ||
    eventType === "v2.core.account[identity].updated" ||
    eventType ===
      "v2.core.account[configuration.merchant].capability_status_updated" ||
    eventType ===
      "v2.core.account[configuration.recipient].capability_status_updated" ||
    eventType === "v2.account_link.returned"
  );
}

function safeNumber(value: unknown, fallback = 0) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return fallback;
  }

  return Math.max(0, Math.round(number));
}

function stringValue(value: unknown) {
  return String(value || "").trim();
}

function boolMetadata(value: unknown) {
  const clean = String(value || "").trim().toLowerCase();

  return clean === "true" || clean === "1" || clean === "yes";
}

function getPaymentIntentId(session: Stripe.Checkout.Session) {
  if (typeof session.payment_intent === "string") {
    return session.payment_intent;
  }

  return session.payment_intent?.id || null;
}

async function getPaymentIntentDetails(paymentIntentId: string | null) {
  if (!paymentIntentId) {
    return {
      applicationFeeAmountCents: 0,
      stripeTransferId: "",
      stripeDestinationAccountId: "",
    };
  }

  try {
    const paymentIntent = (await stripe.paymentIntents.retrieve(
      paymentIntentId,
      {
        expand: ["latest_charge"],
      },
    )) as any;

    const latestCharge = paymentIntent?.latest_charge;

    const stripeTransferId =
      typeof latestCharge?.transfer === "string"
        ? latestCharge.transfer
        : latestCharge?.transfer?.id || "";

    const stripeDestinationAccountId =
      typeof latestCharge?.destination === "string"
        ? latestCharge.destination
        : latestCharge?.destination?.id || "";

    return {
      applicationFeeAmountCents: safeNumber(
        paymentIntent?.application_fee_amount,
        0,
      ),
      stripeTransferId,
      stripeDestinationAccountId,
    };
  } catch (error) {
    console.error("Unable to retrieve PaymentIntent reconciliation details", {
      paymentIntentId,
      error,
    });

    return {
      applicationFeeAmountCents: 0,
      stripeTransferId: "",
      stripeDestinationAccountId: "",
    };
  }
}
async function getCheckoutFinancials({
  session,
  metadata,
  paymentIntentId,
}: {
  session: Stripe.Checkout.Session;
  metadata: Stripe.Metadata;
  paymentIntentId: string | null;
}): Promise<PaymentFinancials> {
  const grossAmountCents = safeNumber(session.amount_total, 0);

  const stripeConnectRouted = boolMetadata(metadata.stripe_connect_routed);
  const stripeConnectAccountId = stringValue(
    metadata.stripe_connect_account_id,
  );

  const metadataApplicationFeeAmount = safeNumber(
    metadata.application_fee_amount,
    0,
  );

  const paymentIntentDetails = await getPaymentIntentDetails(paymentIntentId);

  const applicationFeeAmountCents =
    paymentIntentDetails.applicationFeeAmountCents ||
    metadataApplicationFeeAmount;

  const supporterContributionCents = safeNumber(
    metadata.supporter_contribution_cents ||
      metadata.donor_fee_cents ||
      metadata.buyer_fee_cents ||
      metadata.buyer_contribution_cents,
    0,
  );

  const rawPlatformFeeCents = safeNumber(metadata.platform_fee_cents, 0);

  const platformCommissionCents = safeNumber(
    metadata.platform_commission_cents ||
      applicationFeeAmountCents ||
      Math.max(rawPlatformFeeCents - supporterContributionCents, 0),
    0,
  );

  const platformFeeCents = stripeConnectRouted
    ? applicationFeeAmountCents || platformCommissionCents
    : platformCommissionCents || rawPlatformFeeCents;

  const donorFeeCents = supporterContributionCents;

  const metadataNetAmountCents = safeNumber(metadata.net_amount_cents, 0);

  const calculatedNetAmountCents = Math.max(
    grossAmountCents - platformFeeCents - donorFeeCents,
    0,
  );

  const netAmountCents =
    metadataNetAmountCents > 0
      ? metadataNetAmountCents
      : calculatedNetAmountCents;

  const stripeDestinationAccountId =
    paymentIntentDetails.stripeDestinationAccountId || stripeConnectAccountId;

  return {
    grossAmountCents,
    platformFeeCents,
    donorFeeCents,
    donorCoveredFees: donorFeeCents > 0,
    netAmountCents,
    stripeConnectRouted,
    stripeConnectAccountId,
    applicationFeeAmountCents,
    stripeTransferId: paymentIntentDetails.stripeTransferId,
    stripeDestinationAccountId,
  };
}

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
      event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
    } catch (error: any) {
      console.error("Stripe webhook signature error", error);

      return NextResponse.json(
        { ok: false, error: error?.message || "Invalid signature" },
        { status: 400 },
      );
    }

    if (isStripeConnectAccountEvent(event.type)) {
      const accountId = getConnectedAccountIdFromEvent(event);

      if (!accountId) {
        console.error("Stripe Connect webhook missing account id", {
          eventType: event.type,
          eventId: event.id,
        });

        return NextResponse.json({
          ok: true,
          skipped: true,
          event: event.type,
          reason: "Missing connected account id",
        });
      }

      const account = await syncStripeConnectAccountById(accountId);

      return NextResponse.json({
        ok: true,
        event: event.type,
        accountId: account.id,
        chargesEnabled: Boolean(account.charges_enabled),
        payoutsEnabled: Boolean(account.payouts_enabled),
        detailsSubmitted: Boolean(account.details_submitted),
        onboardingComplete: Boolean(
          account.details_submitted && account.charges_enabled,
        ),
      });
    }

    if (event.type !== "checkout.session.completed") {
      return NextResponse.json({ ok: true, ignored: event.type });
    }

    const session = event.data.object as Stripe.Checkout.Session;
    const metadata = session.metadata || {};

    const rawType = String(metadata.type || metadata.kind || "raffle");
    const type = rawType === "event_order" ? "event" : rawType;

    const tenantSlug = String(
      metadata.tenant_slug || metadata.tenantSlug || "",
    ).trim();

    const paymentIntentId = getPaymentIntentId(session);

    const financials = await getCheckoutFinancials({
      session,
      metadata,
      paymentIntentId,
    });

    const {
      grossAmountCents,
      platformFeeCents,
      donorFeeCents,
      donorCoveredFees,
      netAmountCents,
      stripeConnectRouted,
      stripeConnectAccountId,
      applicationFeeAmountCents,
      stripeTransferId,
      stripeDestinationAccountId,
    } = financials;

    const email =
      session.customer_details?.email || session.customer_email || null;

    const name = session.customer_details?.name || null;
        if (type === "event") {
      const orderId = String(
        metadata.order_id ||
          metadata.orderId ||
          session.client_reference_id ||
          "",
      ).trim();

      const eventId = String(metadata.event_id || metadata.eventId || "").trim();

      if (!orderId || !eventId) {
        console.error("Stripe event webhook missing order/event id", {
          checkoutSessionId: session.id,
          metadata,
        });

        return NextResponse.json({
          ok: true,
          skipped: true,
          reason: "Missing event order data",
        });
      }

      await query(
        `
        update event_orders
        set
          status = 'paid',
          stripe_session_id = $1,
          customer_name = coalesce($2, customer_name),
          customer_email = coalesce($3, customer_email)
        where id = $4
          and event_id = $5
        `,
        [session.id, name, email, orderId, eventId],
      );

      await query(
        `
        update event_seats
        set
          status = 'sold',
          customer_name = $2,
          customer_email = $3,
          updated_at = now()
        where event_id = $1
          and order_id = $4
          and stripe_session_id = $5
          and status = 'reserved'
        `,
        [eventId, name, email, orderId, session.id],
      );

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
          donor_fee_cents,
          donor_covered_fees,
          payment_status,
          customer_email,
          payment_type,
          squares_game_id,
          stripe_transfer_id,
          stripe_destination_account_id,
          stripe_payout_status,
          payout_reconciled_at
        )
        values ($1,$2,null,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'event',null,$13,$14,$15,$16)
        on conflict (stripe_checkout_session_id)
        do update set
          stripe_payment_intent_id = excluded.stripe_payment_intent_id,
          tenant_slug = excluded.tenant_slug,
          reservation_token = excluded.reservation_token,
          currency = excluded.currency,
          gross_amount_cents = excluded.gross_amount_cents,
          platform_fee_cents = excluded.platform_fee_cents,
          net_amount_cents = excluded.net_amount_cents,
          donor_fee_cents = excluded.donor_fee_cents,
          donor_covered_fees = excluded.donor_covered_fees,
          payment_status = excluded.payment_status,
          customer_email = excluded.customer_email,
          payment_type = excluded.payment_type,
          stripe_transfer_id = excluded.stripe_transfer_id,
          stripe_destination_account_id = excluded.stripe_destination_account_id,
          stripe_payout_status = excluded.stripe_payout_status,
          payout_reconciled_at = excluded.payout_reconciled_at
        `,
        [
          session.id,
          paymentIntentId,
          tenantSlug,
          orderId,
          session.currency || null,
          grossAmountCents,
          platformFeeCents,
          netAmountCents,
          donorFeeCents,
          donorCoveredFees,
          session.payment_status || null,
          email,
          stripeTransferId || null,
          stripeDestinationAccountId || stripeConnectAccountId || null,
          stripeConnectRouted ? "destination_charge_created" : null,
          stripeConnectRouted ? new Date().toISOString() : null,
        ],
      );

      if (email) {
        try {
          const eventDetails = await query<{
            title: string;
            starts_at: string | null;
            location: string | null;
          }>(
            `
            select title, starts_at, location
            from events
            where id = $1
            limit 1
            `,
            [eventId],
          );

          const orderItems = await query<{
            label: string;
            quantity: number;
            unit_amount: number;
          }>(
            `
            select label, quantity, unit_amount
            from event_order_items
            where order_id = $1
            order by created_at asc
            `,
            [orderId],
          );

          await sendEventReceiptEmail({
            to: email,
            name,
            eventTitle:
              eventDetails[0]?.title || metadata.event_title || "Event",
            amountCents: grossAmountCents,
            currency: session.currency || "GBP",
            orderReference: orderId,
            tickets: orderItems,
            eventDate: eventDetails[0]?.starts_at || null,
            location: eventDetails[0]?.location || null,
          });
        } catch (emailError) {
          console.error("Event receipt email failed:", emailError);
        }
      }

      return NextResponse.json({
        ok: true,
        event: event.type,
        type,
        checkoutSessionId: session.id,
        orderId,
        eventId,
        stripeConnectRouted,
        stripeConnectAccountId,
        stripeTransferId,
        stripeDestinationAccountId,
        applicationFeeAmountCents,
      });
    }

    const reservationToken = String(
      metadata.reservation_token ||
        metadata.reservationToken ||
        metadata.reservation_id ||
        metadata.reservationId ||
        "",
    ).trim();

    const raffleId =
      type === "raffle"
        ? String(metadata.raffle_id || metadata.raffleId || "").trim()
        : null;

    const squaresGameId =
      type === "squares"
        ? String(metadata.game_id || metadata.gameId || "").trim()
        : null;

    if (!reservationToken) {
      console.error("Stripe webhook missing reservation token", {
        checkoutSessionId: session.id,
        type,
        metadata,
      });

      return NextResponse.json({
        ok: true,
        skipped: true,
        reason: "Missing reservation token",
      });
    }

    if (type === "raffle") {
      if (!raffleId) {
        console.error("Stripe webhook missing raffle id", {
          checkoutSessionId: session.id,
          metadata,
        });

        return NextResponse.json({
          ok: true,
          skipped: true,
          reason: "Missing raffle id",
        });
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
            raffleTitle: metadata.raffle_title || "Raffle",
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
        console.error("Stripe webhook missing squares game id", {
          checkoutSessionId: session.id,
          metadata,
        });

        return NextResponse.json({
          ok: true,
          skipped: true,
          reason: "Missing squares game id",
        });
      }

      const squares = JSON.parse(metadata.squares_json || "[]") as number[];

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
          JSON.stringify({
            ...metadata,
            stripe_connect_routed: stripeConnectRouted ? "true" : "false",
            stripe_connect_account_id: stripeConnectAccountId,
            stripe_transfer_id: stripeTransferId,
            stripe_destination_account_id: stripeDestinationAccountId,
            application_fee_amount: String(applicationFeeAmountCents),
            normalized_platform_fee_cents: String(platformFeeCents),
            normalized_net_amount_cents: String(netAmountCents),
          }),
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
            gameTitle: metadata.game_title || "Squares Game",
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
        donor_fee_cents,
        donor_covered_fees,
        payment_status,
        customer_email,
        payment_type,
        squares_game_id,
        stripe_transfer_id,
        stripe_destination_account_id,
        stripe_payout_status,
        payout_reconciled_at
      )
      values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)
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
        donor_fee_cents = excluded.donor_fee_cents,
        donor_covered_fees = excluded.donor_covered_fees,
        payment_status = excluded.payment_status,
        customer_email = excluded.customer_email,
        payment_type = excluded.payment_type,
        squares_game_id = excluded.squares_game_id,
        stripe_transfer_id = excluded.stripe_transfer_id,
        stripe_destination_account_id = excluded.stripe_destination_account_id,
        stripe_payout_status = excluded.stripe_payout_status,
        payout_reconciled_at = excluded.payout_reconciled_at
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
        donorFeeCents,
        donorCoveredFees,
        session.payment_status || null,
        email,
        type,
        squaresGameId,
        stripeTransferId || null,
        stripeDestinationAccountId || stripeConnectAccountId || null,
        stripeConnectRouted ? "destination_charge_created" : null,
        stripeConnectRouted ? new Date().toISOString() : null,
      ],
    );

    return NextResponse.json({
      ok: true,
      event: event.type,
      type,
      checkoutSessionId: session.id,
      stripeConnectRouted,
      stripeConnectAccountId,
      stripeTransferId,
      stripeDestinationAccountId,
      applicationFeeAmountCents,
      platformFeeCents,
      netAmountCents,
    });
  } catch (error: any) {
    console.error("Stripe webhook error", error);

    return NextResponse.json(
      { ok: false, error: error?.message || "Webhook failed" },
      { status: 500 },
    );
  }
}
