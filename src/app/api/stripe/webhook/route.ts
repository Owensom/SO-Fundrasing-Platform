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
  ticketSubtotalCents: number;
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

type VerifiedEventOrder = {
  id: string;
  tenant_slug: string;
  event_id: string;
  customer_name: string | null;
  customer_email: string | null;
};

type VerifiedRaffleReservation = {
  id: string;
  tenant_slug: string;
  raffle_id: string;
  reservation_token: string;
  reservation_group_id: string | null;
  ticket_number: number;
  colour: string | null;
  buyer_name: string | null;
  buyer_email: string | null;
};

type VerifiedSquaresReservation = {
  id: string;
  tenant_slug: string;
  game_id: string;
  reservation_token: string;
  squares: number[] | null;
  customer_name: string | null;
  customer_email: string | null;
};

type RaffleDetails = {
  id: string;
  tenant_slug: string;
  title: string;
};

type EventDetails = {
  id: string;
  tenant_slug: string;
  title: string;
  starts_at: string | null;
  location: string | null;
};

type SquaresGameDetails = {
  id: string;
  tenant_slug: string;
  title: string;
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

function normalisePaymentType(value: unknown) {
  const rawType = String(value || "raffle").trim();

  if (rawType === "event_order") return "event";
  if (rawType === "event" || rawType === "squares" || rawType === "raffle") {
    return rawType;
  }

  return "raffle";
}

function parseSquaresMetadata(value: unknown): number[] {
  try {
    const parsed = JSON.parse(String(value || "[]"));

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .map((item) => Number(item))
      .filter((item) => Number.isInteger(item) && item > 0);
  } catch {
    return [];
  }
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

  const paymentIntentDetails = await getPaymentIntentDetails(paymentIntentId);

  const metadataApplicationFeeAmount = safeNumber(
    metadata.application_fee_amount_cents ||
      metadata.application_fee_amount,
    0,
  );

  const applicationFeeAmountCents =
    paymentIntentDetails.applicationFeeAmountCents ||
    metadataApplicationFeeAmount;

  const ticketSubtotalCents = safeNumber(
    metadata.ticket_subtotal_cents ||
      metadata.tenant_target_amount_cents ||
      metadata.base_amount_cents ||
      metadata.offer_total_cents ||
      session.amount_subtotal ||
      grossAmountCents,
    grossAmountCents,
  );

  const donorFeeCents = safeNumber(
    metadata.supporter_contribution_cents ||
      metadata.donor_fee_cents ||
      metadata.buyer_fee_cents ||
      metadata.buyer_contribution_cents,
    Math.max(grossAmountCents - ticketSubtotalCents, 0),
  );

  const explicitTierPlatformFeeCents = safeNumber(
    metadata.tier_platform_commission_cents ||
      metadata.platform_commission_cents ||
      metadata.platform_fee_cents,
    0,
  );

  const platformFeeCents = Math.min(
    grossAmountCents,
    explicitTierPlatformFeeCents,
  );

  const netAmountCents = safeNumber(
    metadata.net_amount_cents ||
      metadata.tenant_target_amount_cents ||
      ticketSubtotalCents,
    ticketSubtotalCents,
  );

  const stripeDestinationAccountId =
    paymentIntentDetails.stripeDestinationAccountId || stripeConnectAccountId;

  return {
    grossAmountCents,
    ticketSubtotalCents,
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

async function getVerifiedEventOrder(input: {
  orderId: string;
  eventId: string;
  metadataTenantSlug: string;
}): Promise<VerifiedEventOrder | null> {
  const rows = await query<VerifiedEventOrder>(
    `
      select
        eo.id,
        eo.tenant_slug,
        eo.event_id,
        eo.customer_name,
        eo.customer_email
      from event_orders eo
      inner join events e
        on e.id = eo.event_id
       and e.tenant_slug = eo.tenant_slug
      where eo.id = $1
        and eo.event_id = $2
      limit 1
    `,
    [input.orderId, input.eventId],
  );

  const order = rows[0] || null;

  if (!order) return null;

  if (
    input.metadataTenantSlug &&
    input.metadataTenantSlug !== order.tenant_slug
  ) {
    return null;
  }

  return order;
}

async function getEventDetails(input: {
  eventId: string;
  tenantSlug: string;
}): Promise<EventDetails | null> {
  const rows = await query<EventDetails>(
    `
      select
        id,
        tenant_slug,
        title,
        starts_at,
        location
      from events
      where id = $1
        and tenant_slug = $2
      limit 1
    `,
    [input.eventId, input.tenantSlug],
  );

  return rows[0] || null;
}

async function getVerifiedRaffleReservations(input: {
  raffleId: string;
  reservationToken: string;
  metadataTenantSlug: string;
}): Promise<VerifiedRaffleReservation[]> {
  const rows = await query<VerifiedRaffleReservation>(
    `
      select
        r.id,
        ra.tenant_slug,
        r.raffle_id,
        r.reservation_token,
        r.reservation_group_id,
        r.ticket_number,
        r.colour,
        r.buyer_name,
        r.buyer_email
      from raffle_ticket_reservations r
      inner join raffles ra
        on ra.id = r.raffle_id
      where r.raffle_id = $1
        and r.reservation_token = $2
        and r.status in ('reserved', 'sold')
      order by r.ticket_number asc, r.colour asc nulls last
    `,
    [input.raffleId, input.reservationToken],
  );

  if (!rows.length) return [];

  const tenantSlug = rows[0]?.tenant_slug || "";

  if (
    input.metadataTenantSlug &&
    tenantSlug &&
    input.metadataTenantSlug !== tenantSlug
  ) {
    return [];
  }

  return rows.filter((row) => row.tenant_slug === tenantSlug);
}

async function getRaffleDetails(input: {
  raffleId: string;
  tenantSlug: string;
}): Promise<RaffleDetails | null> {
  const rows = await query<RaffleDetails>(
    `
      select
        id,
        tenant_slug,
        title
      from raffles
      where id = $1
        and tenant_slug = $2
      limit 1
    `,
    [input.raffleId, input.tenantSlug],
  );

  return rows[0] || null;
}

async function getVerifiedSquaresReservation(input: {
  gameId: string;
  reservationToken: string;
  metadataTenantSlug: string;
}): Promise<VerifiedSquaresReservation | null> {
  const rows = await query<VerifiedSquaresReservation>(
    `
      select
        sr.id,
        sg.tenant_slug,
        sr.game_id,
        sr.reservation_token,
        null::int[] as squares,
        null::text as customer_name,
        null::text as customer_email
      from squares_reservations sr
      inner join squares_games sg
        on sg.id = sr.game_id
      where sr.game_id = $1
        and sr.reservation_token = $2
      limit 1
    `,
    [input.gameId, input.reservationToken],
  );

  const reservation = rows[0] || null;

  if (!reservation) return null;

  if (
    input.metadataTenantSlug &&
    input.metadataTenantSlug !== reservation.tenant_slug
  ) {
    return null;
  }

  return reservation;
}

async function getSquaresGameDetails(input: {
  gameId: string;
  tenantSlug: string;
}): Promise<SquaresGameDetails | null> {
  const rows = await query<SquaresGameDetails>(
    `
      select
        id,
        tenant_slug,
        title
      from squares_games
      where id = $1
        and tenant_slug = $2
      limit 1
    `,
    [input.gameId, input.tenantSlug],
  );

  return rows[0] || null;
}

async function recordPlatformPayment(input: {
  session: Stripe.Checkout.Session;
  paymentIntentId: string | null;
  raffleId: string | null;
  tenantSlug: string;
  reservationToken: string;
  paymentType: string;
  squaresGameId: string | null;
  email: string | null;
  financials: PaymentFinancials;
}) {
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
        ticket_subtotal_cents,
        payment_status,
        customer_email,
        payment_type,
        squares_game_id,
        stripe_transfer_id,
        stripe_destination_account_id,
        stripe_payout_status,
        payout_reconciled_at
      )
      values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)
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
        ticket_subtotal_cents = excluded.ticket_subtotal_cents,
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
      input.session.id,
      input.paymentIntentId,
      input.raffleId,
      input.tenantSlug,
      input.reservationToken,
      input.session.currency || null,
      input.financials.grossAmountCents,
      input.financials.platformFeeCents,
      input.financials.netAmountCents,
      input.financials.donorFeeCents,
      input.financials.donorCoveredFees,
      input.financials.ticketSubtotalCents,
      input.session.payment_status || null,
      input.email,
      input.paymentType,
      input.squaresGameId,
      input.financials.stripeTransferId || null,
      input.financials.stripeDestinationAccountId ||
        input.financials.stripeConnectAccountId ||
        null,
      input.financials.stripeConnectRouted
        ? "destination_charge_created"
        : null,
      input.financials.stripeConnectRouted
        ? new Date().toISOString()
        : null,
    ],
  );
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
    const type = normalisePaymentType(metadata.type || metadata.kind);
    const metadataTenantSlug = String(
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

      const verifiedOrder = await getVerifiedEventOrder({
        orderId,
        eventId,
        metadataTenantSlug,
      });

      if (!verifiedOrder) {
        console.error("Stripe event webhook failed tenant/order verification", {
          checkoutSessionId: session.id,
          orderId,
          eventId,
          metadataTenantSlug,
        });

        return NextResponse.json({
          ok: true,
          skipped: true,
          reason: "Event order verification failed",
        });
      }

      const tenantSlug = verifiedOrder.tenant_slug;
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
            and tenant_slug = $6
        `,
        [session.id, name, email, orderId, eventId, tenantSlug],
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

      await recordPlatformPayment({
        session,
        paymentIntentId,
        raffleId: null,
        tenantSlug,
        reservationToken: orderId,
        paymentType: "event",
        squaresGameId: null,
        email,
        financials,
      });

      if (email) {
        try {
          const eventDetails = await getEventDetails({
            eventId,
            tenantSlug,
          });

          const orderItems = await query<{
            label: string;
            quantity: number;
            unit_amount: number;
          }>(
            `
              select label, quantity, unit_amount
              from event_order_items
              where order_id = $1
                and event_id = $2
              order by created_at asc
            `,
            [orderId, eventId],
          );

          await sendEventReceiptEmail({
            to: email,
            name,
            eventTitle: eventDetails?.title || metadata.event_title || "Event",
            amountCents: grossAmountCents,
            currency: session.currency || "GBP",
            orderReference: orderId,
            tickets: orderItems,
            eventDate: eventDetails?.starts_at || null,
            location: eventDetails?.location || null,
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
        tenantSlug,
        stripeConnectRouted,
        stripeConnectAccountId,
        stripeTransferId,
        stripeDestinationAccountId,
        applicationFeeAmountCents,
        platformFeeCents,
        netAmountCents,
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

      const verifiedReservations = await getVerifiedRaffleReservations({
        raffleId,
        reservationToken,
        metadataTenantSlug,
      });

      if (verifiedReservations.length === 0) {
        console.error("Stripe raffle webhook failed tenant/reservation check", {
          checkoutSessionId: session.id,
          raffleId,
          reservationToken,
          metadataTenantSlug,
        });

        return NextResponse.json({
          ok: true,
          skipped: true,
          reason: "Raffle reservation verification failed",
        });
      }

      const tenantSlug = verifiedReservations[0].tenant_slug;

      const raffleDetails = await getRaffleDetails({
        raffleId,
        tenantSlug,
      });

      if (!raffleDetails) {
        console.error("Stripe raffle webhook failed raffle verification", {
          checkoutSessionId: session.id,
          raffleId,
          tenantSlug,
        });

        return NextResponse.json({
          ok: true,
          skipped: true,
          reason: "Raffle verification failed",
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
            net_amount_cents = $5,
            donor_fee_cents = $6,
            donor_covered_fees = $7,
            ticket_subtotal_cents = $8
          where raffle_id = $9
            and reservation_token = $10
        `,
        [
          session.id,
          paymentIntentId,
          grossAmountCents,
          platformFeeCents,
          netAmountCents,
          financials.donorFeeCents,
          financials.donorCoveredFees,
          financials.ticketSubtotalCents,
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
            and tenant_slug = $2
        `,
        [raffleId, tenantSlug],
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

      await recordPlatformPayment({
        session,
        paymentIntentId,
        raffleId,
        tenantSlug,
        reservationToken,
        paymentType: "raffle",
        squaresGameId: null,
        email,
        financials,
      });

      if (email) {
        try {
          await sendReceiptEmail({
            to: email,
            name,
            raffleTitle: raffleDetails.title || metadata.raffle_title || "Raffle",
            tickets,
            amountCents: grossAmountCents,
            currency: session.currency || "GBP",
            reservationToken,
          });
        } catch (emailError) {
          console.error("Raffle receipt email failed:", emailError);
        }
      }

      return NextResponse.json({
        ok: true,
        event: event.type,
        type,
        checkoutSessionId: session.id,
        raffleId,
        tenantSlug,
        stripeConnectRouted,
        stripeConnectAccountId,
        stripeTransferId,
        stripeDestinationAccountId,
        applicationFeeAmountCents,
        platformFeeCents,
        netAmountCents,
      });
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

      const verifiedReservation = await getVerifiedSquaresReservation({
        gameId: squaresGameId,
        reservationToken,
        metadataTenantSlug,
      });

      if (!verifiedReservation) {
        console.error("Stripe squares webhook failed tenant/reservation check", {
          checkoutSessionId: session.id,
          squaresGameId,
          reservationToken,
          metadataTenantSlug,
        });

        return NextResponse.json({
          ok: true,
          skipped: true,
          reason: "Squares reservation verification failed",
        });
      }

      const tenantSlug = verifiedReservation.tenant_slug;

      const squaresGame = await getSquaresGameDetails({
        gameId: squaresGameId,
        tenantSlug,
      });

      if (!squaresGame) {
        console.error("Stripe squares webhook failed game verification", {
          checkoutSessionId: session.id,
          squaresGameId,
          tenantSlug,
        });

        return NextResponse.json({
          ok: true,
          skipped: true,
          reason: "Squares game verification failed",
        });
      }

      const squares = parseSquaresMetadata(metadata.squares_json);

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
            tenant_slug: tenantSlug,
            stripe_connect_routed: stripeConnectRouted ? "true" : "false",
            stripe_connect_account_id: stripeConnectAccountId,
            stripe_transfer_id: stripeTransferId,
            stripe_destination_account_id: stripeDestinationAccountId,
            application_fee_amount: String(applicationFeeAmountCents),
            normalized_platform_fee_cents: String(platformFeeCents),
            normalized_net_amount_cents: String(netAmountCents),
            normalized_donor_fee_cents: String(financials.donorFeeCents),
            normalized_ticket_subtotal_cents: String(
              financials.ticketSubtotalCents,
            ),
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
                    coalesce(config_json->'sold', '[]'::jsonb) || $3::jsonb
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
                  select jsonb_array_elements_text($3::jsonb)::int
                )
              )
            ),
            updated_at = now()
          where id = $1
            and tenant_slug = $2
        `,
        [squaresGameId, tenantSlug, JSON.stringify(squares)],
      );

      await recordPlatformPayment({
        session,
        paymentIntentId,
        raffleId: null,
        tenantSlug,
        reservationToken,
        paymentType: "squares",
        squaresGameId,
        email,
        financials,
      });

      if (email) {
        try {
          await sendSquaresReceiptEmail({
            to: email,
            name,
            gameTitle: squaresGame.title || metadata.game_title || "Squares Game",
            squares,
            amountCents: grossAmountCents,
            currency: session.currency || "GBP",
            reservationToken,
          });
        } catch (emailError) {
          console.error("Squares receipt email failed:", emailError);
        }
      }

      return NextResponse.json({
        ok: true,
        event: event.type,
        type,
        checkoutSessionId: session.id,
        squaresGameId,
        tenantSlug,
        stripeConnectRouted,
        stripeConnectAccountId,
        stripeTransferId,
        stripeDestinationAccountId,
        applicationFeeAmountCents,
        platformFeeCents,
        netAmountCents,
      });
    }

    return NextResponse.json({
      ok: true,
      skipped: true,
      event: event.type,
      type,
      reason: "Unsupported checkout session type",
    });
  } catch (error: any) {
    console.error("Stripe webhook error", error);

    return NextResponse.json(
      { ok: false, error: error?.message || "Webhook failed" },
      { status: 500 },
    );
  }
}
