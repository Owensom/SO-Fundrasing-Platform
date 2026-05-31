import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { query } from "@/lib/db";
import {
  sendDonationReceiptEmail,
  sendEventReceiptEmail,
  sendHigherOrLowerPlayerLinkEmail,
  sendReceiptEmail,
  sendSquaresReceiptEmail,
} from "@/lib/email";
import {
  getAuctionWinningBidPaymentByBidId,
  markAuctionWinningBidPaid,
} from "../../../../../api/_lib/auctions-repo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2023-10-16",
});

type EmailBranding = {
  name?: string | null;
  logoUrl?: string | null;
  primaryColor?: string | null;
};

type TenantEmailBrandingRow = {
  public_display_name: string | null;
  public_logo_url: string | null;
  public_logo_mark_url: string | null;
  public_primary_colour: string | null;
};

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
  raffle_subtype: string | null;
};

type EventDetails = {
  id: string;
  tenant_slug: string;
  title: string;
  slug: string;
  starts_at: string | null;
  location: string | null;
};

type SquaresGameDetails = {
  id: string;
  tenant_slug: string;
  title: string;
};

type DonationDetails = {
  id: string;
  tenant_slug: string;
  campaign_type: string | null;
  campaign_id: string | null;
  campaign_title: string | null;
  donor_name: string | null;
  donor_email: string | null;
  message: string | null;
  amount_cents: number;
  currency: string;
  payment_status: string;
  stripe_checkout_session_id: string | null;
  stripe_payment_intent_id: string | null;
  created_at: string;
  paid_at: string | null;
  gift_aid_claimed: boolean;
};

type HigherOrLowerGameSession = {
  id: string;
};

type HigherOrLowerOrderItemRow = {
  event_order_id: string;
  event_order_item_id: string;
  quantity: number | string | null;
  guest_name: string | null;
  customer_name: string | null;
  customer_email: string | null;
  metadata: unknown;
};

type HigherOrLowerPlayer = {
  name: string;
  email: string;
};

type HigherOrLowerEntryRow = {
  id: string;
  entry_number: number;
  player_name: string | null;
  player_email: string | null;
  public_answer_token: string | null;
};

function cleanText(value: unknown) {
  return String(value || "").trim();
}

function cleanEmail(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

function normaliseEmailHexColour(value: unknown) {
  const clean = cleanText(value).toUpperCase();

  if (/^#[0-9A-F]{6}$/.test(clean)) {
    return clean;
  }

  return null;
}

async function getTenantEmailBranding(
  tenantSlug: string,
): Promise<EmailBranding | undefined> {
  const cleanTenantSlug = cleanText(tenantSlug);

  if (!cleanTenantSlug) {
    return undefined;
  }

  try {
    const rows = await query<TenantEmailBrandingRow>(
      `
        select
          public_display_name,
          public_logo_url,
          public_logo_mark_url,
          public_primary_colour
        from tenant_settings
        where tenant_slug = $1
        limit 1
      `,
      [cleanTenantSlug],
    );

    const row = rows[0] || null;

    if (!row) {
      return undefined;
    }

    const name = cleanText(row.public_display_name);
    const logoUrl =
      cleanText(row.public_logo_url) || cleanText(row.public_logo_mark_url);
    const primaryColor = normaliseEmailHexColour(row.public_primary_colour);

    if (!name && !logoUrl && !primaryColor) {
      return undefined;
    }

    return {
      name: name || undefined,
      logoUrl: logoUrl || undefined,
      primaryColor: primaryColor || undefined,
    };
  } catch (error) {
    console.error("Unable to load tenant email branding", {
      tenantSlug: cleanTenantSlug,
      error,
    });

    return undefined;
  }
}

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

  if (
    rawType === "event" ||
    rawType === "squares" ||
    rawType === "raffle" ||
    rawType === "auction_winning_bid" ||
    rawType === "donation"
  ) {
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

function siteUrl(req: NextRequest) {
  return new URL(req.url).origin;
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function normaliseHigherOrLowerPlayer(value: unknown): HigherOrLowerPlayer | null {
  if (!isObjectRecord(value)) {
    return null;
  }

  const name = cleanText(value.name).slice(0, 160);
  const email = cleanEmail(value.email).slice(0, 254);

  if (!name || !email) {
    return null;
  }

  return {
    name,
    email,
  };
}

function higherOrLowerPlayersFromMetadata(value: unknown): HigherOrLowerPlayer[] {
  if (!isObjectRecord(value)) {
    return [];
  }

  const rawPlayers = value.players;

  if (!Array.isArray(rawPlayers)) {
    return [];
  }

  return rawPlayers
    .map((player) => normaliseHigherOrLowerPlayer(player))
    .filter(Boolean) as HigherOrLowerPlayer[];
}

function fallbackHigherOrLowerPlayersForOrderItem(
  item: HigherOrLowerOrderItemRow,
): HigherOrLowerPlayer[] {
  const quantity = Math.max(1, safeNumber(item.quantity, 1));
  const name =
    cleanText(item.guest_name) || cleanText(item.customer_name) || "Player";
  const email = cleanEmail(item.customer_email);

  if (!email) {
    return [];
  }

  return Array.from({ length: quantity }).map(() => ({
    name,
    email,
  }));
}

function higherOrLowerPlayerEntryLabel(entry: {
  player_name?: string | null;
  entry_number: number;
}) {
  return `${cleanText(entry.player_name) || "Player"} #${entry.entry_number}`;
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
    metadata.application_fee_amount_cents || metadata.application_fee_amount,
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
        slug,
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
        title,
        raffle_subtype
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

async function getDonationDetails(input: {
  donationId: string;
  metadataTenantSlug: string;
}): Promise<DonationDetails | null> {
  const rows = await query<DonationDetails>(
    `
      select
        id::text as id,
        tenant_slug,
        campaign_type,
        campaign_id,
        campaign_title,
        donor_name,
        donor_email,
        message,
        amount_cents,
        currency,
        payment_status,
        stripe_checkout_session_id,
        stripe_payment_intent_id,
        created_at::text,
        paid_at::text,
        gift_aid_claimed
      from public_donations
      where id = $1::uuid
      limit 1
    `,
    [input.donationId],
  );

  const donation = rows[0] || null;

  if (!donation) return null;

  if (
    input.metadataTenantSlug &&
    input.metadataTenantSlug !== donation.tenant_slug
  ) {
    return null;
  }

  return donation;
}

async function markDonationPaid(input: {
  donationId: string;
  stripeCheckoutSessionId: string;
  stripePaymentIntentId: string | null;
}) {
  await query(
    `
      update public_donations
      set
        payment_status = 'paid',
        stripe_checkout_session_id = $2,
        stripe_payment_intent_id = $3,
        paid_at = now()
      where id = $1::uuid
    `,
    [
      input.donationId,
      input.stripeCheckoutSessionId,
      input.stripePaymentIntentId,
    ],
  );
}

async function getHigherOrLowerSession(input: {
  tenantSlug: string;
  eventId: string;
}): Promise<HigherOrLowerGameSession | null> {
  const rows = await query<HigherOrLowerGameSession>(
    `
      select id::text
      from event_addon_game_sessions
      where tenant_slug = $1
        and event_id = $2
        and add_on_type = 'higher_or_lower'
      order by created_at asc
      limit 1
    `,
    [input.tenantSlug, input.eventId],
  );

  return rows[0] || null;
}

async function listHigherOrLowerPaidOrderItems(input: {
  tenantSlug: string;
  eventId: string;
  orderId: string;
}) {
  return query<HigherOrLowerOrderItemRow>(
    `
      select
        eo.id::text as event_order_id,
        eoi.id::text as event_order_item_id,
        eoi.quantity,
        eoi.guest_name,
        eo.customer_name,
        eo.customer_email,
        eoi.metadata
      from event_orders eo
      inner join event_order_items eoi
        on eoi.order_id = eo.id
      where eo.tenant_slug = $1
        and eo.event_id = $2
        and eo.id = $3
        and eo.status = 'paid'
        and eoi.metadata ->> 'addOnType' = 'higher_or_lower'
      order by eoi.created_at asc
    `,
    [input.tenantSlug, input.eventId, input.orderId],
  );
}

async function createOrUpdateHigherOrLowerEntry(input: {
  tenantSlug: string;
  eventId: string;
  sessionId: string;
  eventOrderId: string;
  eventOrderItemId: string;
  entryNumber: number;
  playerName: string;
  playerEmail: string;
}) {
  const existingRows = await query<HigherOrLowerEntryRow>(
    `
      select
        id::text,
        entry_number,
        player_name,
        player_email,
        public_answer_token
      from event_addon_game_entries
      where tenant_slug = $1
        and event_id = $2
        and session_id = $3
        and event_order_item_id = $4
        and entry_number = $5
      limit 1
    `,
    [
      input.tenantSlug,
      input.eventId,
      input.sessionId,
      input.eventOrderItemId,
      input.entryNumber,
    ],
  );

  const existing = existingRows[0] || null;

  if (existing) {
    const updatedRows = await query<HigherOrLowerEntryRow>(
      `
        update event_addon_game_entries
        set
          player_name = $6,
          player_email = $7,
          public_answer_token = coalesce(public_answer_token, encode(gen_random_bytes(24), 'hex')),
          updated_at = now()
        where tenant_slug = $1
          and event_id = $2
          and session_id = $3
          and event_order_item_id = $4
          and entry_number = $5
        returning
          id::text,
          entry_number,
          player_name,
          player_email,
          public_answer_token
      `,
      [
        input.tenantSlug,
        input.eventId,
        input.sessionId,
        input.eventOrderItemId,
        input.entryNumber,
        input.playerName,
        input.playerEmail,
      ],
    );

    return updatedRows[0] || existing;
  }

  const insertedRows = await query<HigherOrLowerEntryRow>(
    `
      insert into event_addon_game_entries (
        tenant_slug,
        event_id,
        session_id,
        event_order_id,
        event_order_item_id,
        entry_number,
        player_name,
        player_email,
        status,
        public_answer_token
      )
      values ($1,$2,$3,$4,$5,$6,$7,$8,'active',encode(gen_random_bytes(24), 'hex'))
      returning
        id::text,
        entry_number,
        player_name,
        player_email,
        public_answer_token
    `,
    [
      input.tenantSlug,
      input.eventId,
      input.sessionId,
      input.eventOrderId,
      input.eventOrderItemId,
      input.entryNumber,
      input.playerName,
      input.playerEmail,
    ],
  );

  return insertedRows[0] || null;
}

async function createHigherOrLowerEntriesAndSendLinks(input: {
  req: NextRequest;
  tenantSlug: string;
  eventId: string;
  orderId: string;
  eventTitle: string;
  eventSlug: string;
  branding?: EmailBranding;
}) {
  const gameSession = await getHigherOrLowerSession({
    tenantSlug: input.tenantSlug,
    eventId: input.eventId,
  });

  if (!gameSession) {
    console.warn("Higher or Lower player link email skipped: no game session", {
      tenantSlug: input.tenantSlug,
      eventId: input.eventId,
      orderId: input.orderId,
    });

    return {
      created: 0,
      emailed: 0,
      skippedReason: "missing_game_session",
    };
  }

  const eventSlug = cleanText(input.eventSlug);

  if (!eventSlug) {
    console.warn("Higher or Lower player link email skipped: missing event slug", {
      tenantSlug: input.tenantSlug,
      eventId: input.eventId,
      orderId: input.orderId,
    });

    return {
      created: 0,
      emailed: 0,
      skippedReason: "missing_event_slug",
    };
  }

  const orderItems = await listHigherOrLowerPaidOrderItems({
    tenantSlug: input.tenantSlug,
    eventId: input.eventId,
    orderId: input.orderId,
  });

  if (orderItems.length === 0) {
    return {
      created: 0,
      emailed: 0,
      skippedReason: "no_higher_or_lower_items",
    };
  }

  let created = 0;
  let emailed = 0;

  for (const item of orderItems) {
    const metadataPlayers = higherOrLowerPlayersFromMetadata(item.metadata);
    const players =
      metadataPlayers.length > 0
        ? metadataPlayers
        : fallbackHigherOrLowerPlayersForOrderItem(item);

    if (players.length === 0) {
      console.warn("Higher or Lower player link skipped: no player emails", {
        tenantSlug: input.tenantSlug,
        eventId: input.eventId,
        orderId: input.orderId,
        eventOrderItemId: item.event_order_item_id,
      });

      continue;
    }

    for (let index = 0; index < players.length; index += 1) {
      const player = players[index];
      const entryNumber = index + 1;

      const entry = await createOrUpdateHigherOrLowerEntry({
        tenantSlug: input.tenantSlug,
        eventId: input.eventId,
        sessionId: gameSession.id,
        eventOrderId: item.event_order_id,
        eventOrderItemId: item.event_order_item_id,
        entryNumber,
        playerName: player.name,
        playerEmail: player.email,
      });

      if (!entry?.public_answer_token) {
        console.warn("Higher or Lower player link skipped: missing token", {
          tenantSlug: input.tenantSlug,
          eventId: input.eventId,
          orderId: input.orderId,
          eventOrderItemId: item.event_order_item_id,
          entryNumber,
        });

        continue;
      }

      created += 1;

      const answerUrl = `${siteUrl(input.req)}/e/${encodeURIComponent(
        eventSlug,
      )}/higher-or-lower/play?entry=${encodeURIComponent(
        entry.public_answer_token,
      )}`;

      try {
        await sendHigherOrLowerPlayerLinkEmail({
          to: player.email,
          name: player.name,
          eventTitle: input.eventTitle,
          playerEntryLabel: higherOrLowerPlayerEntryLabel({
            player_name: entry.player_name,
            entry_number: entry.entry_number,
          }),
          playerAnswerUrl: answerUrl,
          branding: input.branding,
        });

        emailed += 1;
      } catch (emailError) {
        console.error("Higher or Lower player link email failed", {
          tenantSlug: input.tenantSlug,
          eventId: input.eventId,
          orderId: input.orderId,
          eventOrderItemId: item.event_order_item_id,
          playerEmail: player.email,
          error: emailError,
        });
      }
    }
  }

  return {
    created,
    emailed,
    skippedReason: "",
  };
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
  auctionId?: string | null;
  auctionItemId?: string | null;
  auctionBidId?: string | null;
  donationId?: string | null;
  campaignType?: string | null;
  campaignId?: string | null;
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
        payout_reconciled_at,
        auction_id,
        auction_item_id,
        auction_bid_id,
        donation_id,
        campaign_type,
        campaign_id
      )
      values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26)
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
        payout_reconciled_at = excluded.payout_reconciled_at,
        auction_id = excluded.auction_id,
        auction_item_id = excluded.auction_item_id,
        auction_bid_id = excluded.auction_bid_id,
        donation_id = excluded.donation_id,
        campaign_type = excluded.campaign_type,
        campaign_id = excluded.campaign_id
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
      input.auctionId || null,
      input.auctionItemId || null,
      input.auctionBidId || null,
      input.donationId || null,
      input.campaignType || null,
      input.campaignId || null,
    ],
  );
}
