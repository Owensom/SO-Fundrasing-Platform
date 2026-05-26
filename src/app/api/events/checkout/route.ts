import { NextResponse } from "next/server";
import Stripe from "stripe";
import { query } from "@/lib/db";
import { sendEventReceiptEmail } from "@/lib/email";
import { getTenantSlugFromHeaders } from "@/lib/tenant";
import {
  buildPaymentSummary,
  createStripeCheckoutSession,
  getPlatformFeePercent,
  getTenantFinanceSettings,
} from "@/lib/payments";
import {
  attachStripeSessionToReservedSeats,
  createEventOrderItem,
  createPendingEventOrder,
  deleteEventOrderAndItems,
  getEventById,
  reserveEventSeatsForOrder,
  updateEventOrderStripeSession,
} from "../../../../../api/_lib/events-repo";

type CheckoutItem = {
  seatId?: string;
  ticketTypeId: string;
  quantity?: number;
  guestName?: string;
  dietary?: string;
  dietaryRequirements?: string;
  menuChoice?: string;
  tableName?: string;
};

type CheckoutAddOnItem = {
  type?: string;
  quantity?: number;
};

type ValidatedCheckoutAddOn = {
  type: "heads_or_tails";
  title: string;
  quantity: number;
  unitAmount: number;
  totalAmount: number;
};

type EventCheckoutPaymentSummary = {
  ticketTotalCents: number;
  amountTotalCents: number;
  buyerContributionCents: number;
  platformCommissionCents: number;
  stripeProcessingCoverCents: number;
  applicationFeeCents: number;
  tenantNetCents: number;
};

type EventAccessCodeRow = {
  id: string;
  tenant_slug: string;
  event_id: string;
  code: string;
  label: string | null;
  access_type: string;
  max_uses: number | null;
  used_count: number;
  ticket_type_id: string | null;
  is_active: boolean;
  expires_at: string | null;
};

type EventReceiptDetails = {
  title: string;
  starts_at: string | null;
  location: string | null;
};

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2023-10-16",
});

function siteUrl(req: Request) {
  return new URL(req.url).origin;
}

function cleanText(value: unknown) {
  return String(value || "").trim();
}

function cleanAccessCode(value: unknown) {
  return String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function positiveQuantity(value: unknown) {
  const number = Number(value || 0);

  if (!Number.isFinite(number)) {
    return 0;
  }

  return Math.max(0, Math.floor(number));
}

function truthy(value: unknown) {
  return value === true || value === "true" || value === "yes" || value === "1";
}

function safeMoneyCents(value: unknown) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return 0;
  }

  return Math.max(0, Math.round(number));
}

function normaliseEventPaymentSummary(input: {
  ticketTotalCents: number;
  coverFees: boolean;
  platformFeePercent: number;
}): EventCheckoutPaymentSummary {
  const paymentSummary = buildPaymentSummary({
    ticketTotalCents: input.ticketTotalCents,
    coverFees: input.coverFees,
    platformFeePercent: input.platformFeePercent,
  });

  const ticketTotalCents = safeMoneyCents(paymentSummary.ticketTotalCents);
  const amountTotalCents = safeMoneyCents(paymentSummary.amountTotalCents);

  const buyerContributionCents = safeMoneyCents(
    paymentSummary.buyerContributionCents,
  );

  const platformCommissionCents = safeMoneyCents(
    paymentSummary.platformCommissionCents,
  );

  const stripeProcessingCoverCents = Math.max(
    buyerContributionCents - platformCommissionCents,
    0,
  );

  const applicationFeeCents =
    input.coverFees && buyerContributionCents > 0
      ? buyerContributionCents
      : platformCommissionCents;

  const tenantNetCents = Math.max(amountTotalCents - applicationFeeCents, 0);

  return {
    ticketTotalCents,
    amountTotalCents,
    buyerContributionCents,
    platformCommissionCents,
    stripeProcessingCoverCents,
    applicationFeeCents,
    tenantNetCents,
  };
}

function seatLabel(input: {
  tableNumber?: string | null;
  rowLabel?: string | null;
  seatNumber?: string | null;
  tableName?: string | null;
}) {
  const tableName = cleanText(input.tableName);

  if (input.tableNumber) {
    return tableName
      ? `Table ${input.tableNumber} (${tableName}), Seat ${
          input.seatNumber || ""
        }`
      : `Table ${input.tableNumber}, Seat ${input.seatNumber || ""}`;
  }

  return `Row ${input.rowLabel || ""}, Seat ${input.seatNumber || ""}`;
}

function eventCheckoutMetadata(input: {
  event: {
    id: string;
    title: string;
    event_type: string;
    tenant_slug: string;
  };
  orderId: string;
  buyerName: string;
  buyerEmail: string;
  coverFees: boolean;
  buyerContributionCents: number;
  platformFeePercent: number;
  platformCommissionCents: number;
  stripeProcessingCoverCents: number;
  applicationFeeCents: number;
  ticketTotalCents: number;
  amountTotalCents: number;
  tenantNetCents: number;
  addOnTotalCents: number;
  addOnSummary: string;
}) {
  return {
    type: "event",
    tenant_slug: input.event.tenant_slug,
    event_id: input.event.id,
    eventId: input.event.id,
    order_id: input.orderId,
    orderId: input.orderId,
    event_type: input.event.event_type,
    event_title: input.event.title,
    buyer_name: input.buyerName,
    buyer_email: input.buyerEmail,

    cover_fees: input.coverFees ? "true" : "false",
    buyer_requested_cover_fees: input.coverFees ? "true" : "false",
    buyer_fee_contributions_enabled:
      input.buyerContributionCents > 0 ? "true" : "false",
    donor_covered_fees: input.buyerContributionCents > 0 ? "true" : "false",

    buyer_contribution_cents: String(input.buyerContributionCents),
    supporter_contribution_cents: String(input.buyerContributionCents),
    donor_fee_cents: String(input.buyerContributionCents),
    buyer_fee_cents: String(input.buyerContributionCents),

    platform_fee_percent: String(input.platformFeePercent),
    tier_platform_commission_cents: String(input.platformCommissionCents),
    platform_commission_cents: String(input.platformCommissionCents),
    platform_fee_cents: String(input.platformCommissionCents),

    stripe_processing_cover_cents: String(input.stripeProcessingCoverCents),

    application_fee_amount: String(input.applicationFeeCents),
    application_fee_amount_cents: String(input.applicationFeeCents),
    application_fee_includes_supporter_cover:
      input.buyerContributionCents > 0 ? "true" : "false",

    ticket_total_cents: String(input.ticketTotalCents),
    ticket_subtotal_cents: String(input.ticketTotalCents),
    base_amount_cents: String(input.ticketTotalCents),
    tenant_target_amount_cents: String(input.ticketTotalCents),

    event_addon_total_cents: String(input.addOnTotalCents),
    event_addon_summary: input.addOnSummary,

    amount_total_cents: String(input.amountTotalCents),
    checkout_total_cents: String(input.amountTotalCents),
    net_amount_cents: String(input.tenantNetCents),
    tenant_net_after_application_fee_cents: String(input.tenantNetCents),
  };
}

async function getValidEventAccessCode(input: {
  tenantSlug: string;
  eventId: string;
  code: string;
}) {
  const rows = await query<EventAccessCodeRow>(
    `
      select
        id::text,
        tenant_slug,
        event_id::text,
        code,
        label,
        access_type,
        max_uses,
        used_count,
        ticket_type_id::text,
        is_active,
        expires_at::text
      from event_access_codes
      where tenant_slug = $1
        and event_id = $2
        and lower(code) = lower($3)
      limit 1
    `,
    [input.tenantSlug, input.eventId, input.code],
  );

  const accessCode = rows[0] || null;

  if (!accessCode) {
    throw new Error("Invalid access code.");
  }

  if (!accessCode.is_active) {
    throw new Error("This access code is no longer active.");
  }

  if (
    accessCode.expires_at &&
    new Date(accessCode.expires_at).getTime() <= Date.now()
  ) {
    throw new Error("This access code has expired.");
  }

  if (
    accessCode.max_uses !== null &&
    Number(accessCode.used_count) >= Number(accessCode.max_uses)
  ) {
    throw new Error("This access code has already been used.");
  }

  return accessCode;
}

async function incrementAccessCodeUsage(input: {
  tenantSlug: string;
  eventId: string;
  accessCodeId: string;
}) {
  const rows = await query<{ id: string }>(
    `
      update event_access_codes
      set
        used_count = used_count + 1,
        updated_at = now()
      where id = $1
        and tenant_slug = $2
        and event_id = $3
        and is_active = true
        and (expires_at is null or expires_at > now())
        and (max_uses is null or used_count < max_uses)
      returning id::text
    `,
    [input.accessCodeId, input.tenantSlug, input.eventId],
  );

  if (!rows[0]) {
    throw new Error("This access code is no longer available.");
  }
}
async function markEventOrderComplimentaryPaid(input: {
  orderId: string;
  accessCode: EventAccessCodeRow;
}) {
  await query(
    `
      update event_orders
      set
        status = 'paid',
        amount_total = 0,
        stripe_session_id = null
      where id = $1
    `,
    [input.orderId],
  );
}

async function markSeatsComplimentarySold(input: {
  eventId: string;
  orderId: string;
  buyerName: string;
  buyerEmail: string;
  accessType: string;
  rows: Array<{
    seat: {
      id: string;
    };
    guestName: string;
    dietaryRequirements: string;
    menuChoice: string;
  }>;
}) {
  for (const row of input.rows) {
    await query(
      `
        update event_seats
        set
          status = 'sold',
          order_id = $3,
          customer_name = $4,
          customer_email = $5,
          guest_name = $6,
          guest_email = $5,
          dietary_requirements = $7,
          menu_choice = $8,
          seat_purpose = $9,
          updated_at = now()
        where event_id = $1
          and id = $2
      `,
      [
        input.eventId,
        row.seat.id,
        input.orderId,
        input.buyerName,
        input.buyerEmail,
        row.guestName || input.buyerName,
        row.dietaryRequirements || null,
        row.menuChoice || null,
        input.accessType || "complimentary",
      ],
    );
  }
}

async function sendComplimentaryEventReceipt(input: {
  tenantSlug: string;
  eventId: string;
  orderId: string;
  buyerName: string;
  buyerEmail: string;
  currency: string;
}) {
  if (!input.buyerEmail) {
    return;
  }

  try {
    const eventRows = await query<EventReceiptDetails>(
      `
        select
          title,
          starts_at::text,
          location
        from events
        where id = $1
          and tenant_slug = $2
        limit 1
      `,
      [input.eventId, input.tenantSlug],
    );

    const orderItems = await query<{
      label: string;
      quantity: number;
      unit_amount: number;
    }>(
      `
        select
          label,
          quantity,
          unit_amount
        from event_order_items
        where order_id = $1
          and event_id = $2
        order by created_at asc
      `,
      [input.orderId, input.eventId],
    );

    const eventDetails = eventRows[0] || null;

    await sendEventReceiptEmail({
      to: input.buyerEmail,
      name: input.buyerName,
      eventTitle: eventDetails?.title || "Event",
      amountCents: 0,
      currency: input.currency || "GBP",
      orderReference: input.orderId,
      tickets: orderItems,
      eventDate: eventDetails?.starts_at || null,
      location: eventDetails?.location || null,
    });
  } catch (emailError) {
    console.error("Complimentary event receipt email failed:", emailError);
  }
}

function validateAccessCodeTicketRestriction(input: {
  accessCode: EventAccessCodeRow;
  ticketTypeIds: string[];
}) {
  if (!input.accessCode.ticket_type_id) return;

  const invalid = input.ticketTypeIds.some(
    (ticketTypeId) => ticketTypeId !== input.accessCode.ticket_type_id,
  );

  if (invalid) {
    throw new Error("This access code is not valid for the selected ticket type.");
  }
}

function complimentarySuccessUrl(req: Request, slug: string) {
  return `${siteUrl(req)}/e/${slug}?checkout=success&access=complimentary`;
}

function normaliseEventAddOns(rawAddOns: unknown): CheckoutAddOnItem[] {
  if (!Array.isArray(rawAddOns)) {
    return [];
  }

  return rawAddOns
    .map((addOn) => {
      if (!addOn || typeof addOn !== "object") {
        return null;
      }

      const item = addOn as CheckoutAddOnItem;

      return {
        type: cleanText(item.type),
        quantity: positiveQuantity(item.quantity),
      };
    })
    .filter((addOn): addOn is CheckoutAddOnItem => {
      return Boolean(addOn?.type) && positiveQuantity(addOn.quantity) > 0;
    });
}

function validateCheckoutAddOns(input: {
  eventAddOnsJson: unknown;
  submittedAddOns: CheckoutAddOnItem[];
  hasAccessCode: boolean;
}): ValidatedCheckoutAddOn[] {
  if (input.hasAccessCode) {
    return [];
  }

  if (input.submittedAddOns.length === 0) {
    return [];
  }

  const eventAddOns = Array.isArray(input.eventAddOnsJson)
    ? input.eventAddOnsJson
    : [];

  const validatedAddOns: ValidatedCheckoutAddOn[] = [];

  for (const submittedAddOn of input.submittedAddOns) {
    const type = cleanText(submittedAddOn.type);

    if (type !== "heads_or_tails") {
      throw new Error("Invalid event add-on.");
    }

    const configuredAddOn = eventAddOns.find((addOn) => {
      if (!addOn || typeof addOn !== "object") return false;

      const current = addOn as Record<string, unknown>;

      return (
        cleanText(current.type) === "heads_or_tails" &&
        truthy(current.enabled) &&
        truthy(current.collectAtCheckout)
      );
    }) as Record<string, unknown> | undefined;

    if (!configuredAddOn) {
      throw new Error("This event add-on is not available for checkout.");
    }

    const entryPriceCents = safeMoneyCents(configuredAddOn.entryPriceCents);

    if (entryPriceCents <= 0) {
      throw new Error("This event add-on is not priced for checkout.");
    }

    const quantity = positiveQuantity(submittedAddOn.quantity);

    if (quantity <= 0) {
      continue;
    }

    const maxEntriesPerBooking = positiveQuantity(
      configuredAddOn.maxEntriesPerBooking,
    );

    if (maxEntriesPerBooking > 0 && quantity > maxEntriesPerBooking) {
      throw new Error(
        `Heads or Tails is limited to ${maxEntriesPerBooking} entries per booking.`,
      );
    }

    const title = cleanText(configuredAddOn.title) || "Heads or Tails";

    validatedAddOns.push({
      type: "heads_or_tails",
      title,
      quantity,
      unitAmount: entryPriceCents,
      totalAmount: entryPriceCents * quantity,
    });
  }

  return validatedAddOns;
}

function eventAddOnSummary(addOns: ValidatedCheckoutAddOn[]) {
  if (addOns.length === 0) {
    return "";
  }

  return addOns
    .map((addOn) => `${addOn.title} × ${addOn.quantity}`)
    .join(", ");
}

async function createEventAddOnOrderItems(input: {
  orderId: string;
  eventId: string;
  buyerName: string;
  addOns: ValidatedCheckoutAddOn[];
}) {
  for (const addOn of input.addOns) {
    await createEventOrderItem({
      orderId: input.orderId,
      eventId: input.eventId,
      ticketTypeId: null,
      seatId: null,
      label: `Event add-on — ${addOn.title}`,
      quantity: addOn.quantity,
      unitAmount: addOn.unitAmount,
      guest_name: input.buyerName,
      dietary_requirements: null,
      menu_choice: null,
    } as never);
  }
}

function createEventAddOnStripeLineItems(input: {
  eventTitle: string;
  currency: string;
  addOns: ValidatedCheckoutAddOn[];
}): Stripe.Checkout.SessionCreateParams.LineItem[] {
  return input.addOns.map((addOn) => ({
    quantity: addOn.quantity,
    price_data: {
      currency: input.currency.toLowerCase(),
      unit_amount: addOn.unitAmount,
      product_data: {
        name: `${input.eventTitle} — ${addOn.title}`,
        description: "Event-night fundraising add-on.",
      },
    },
  }));
}

export async function POST(req: Request) {
  let orderId: string | null = null;

  try {
    const tenantSlug = await getTenantSlugFromHeaders();
    const body = await req.json();

    const eventId = cleanText(body.eventId);
    const buyerName = cleanText(body.buyerName);
    const buyerEmail = cleanText(body.buyerEmail);
    const requestedAccessCode = cleanAccessCode(body.accessCode);
    const hasAccessCode = Boolean(requestedAccessCode);

    const coverFees = hasAccessCode ? false : truthy(body.coverFees);

    const items: CheckoutItem[] = Array.isArray(body.items) ? body.items : [];
    const submittedAddOns = normaliseEventAddOns(body.addOns);

    if (!eventId || items.length === 0) {
      return NextResponse.json(
        { error: "Missing checkout data." },
        { status: 400 },
      );
    }

    if (!buyerName || !buyerEmail) {
      return NextResponse.json(
        { error: "Name and email address are required." },
        { status: 400 },
      );
    }

    const event = await getEventById(eventId);

    if (!event || event.status !== "published") {
      return NextResponse.json(
        { error: "Event unavailable." },
        { status: 404 },
      );
    }

    if (!tenantSlug || event.tenant_slug !== tenantSlug) {
      return NextResponse.json(
        { error: "Event unavailable for this tenant." },
        { status: 404 },
      );
    }

    const accessCode = hasAccessCode
      ? await getValidEventAccessCode({
          tenantSlug: event.tenant_slug,
          eventId: event.id,
          code: requestedAccessCode,
        })
      : null;

    const validatedAddOns = validateCheckoutAddOns({
      eventAddOnsJson: event.event_addons_json || [],
      submittedAddOns,
      hasAccessCode: Boolean(accessCode),
    });

    const addOnTotalCents = validatedAddOns.reduce(
      (sum, addOn) => sum + addOn.totalAmount,
      0,
    );

    const addOnSummary = eventAddOnSummary(validatedAddOns);

    const finance = await getTenantFinanceSettings(event.tenant_slug);
    const platformFeePercent = getPlatformFeePercent(finance);

    const ticketTypes = (event.ticket_types || []).filter(
      (ticketType) => ticketType.is_active,
    );

    const isGeneralAdmission = event.event_type === "general_admission";

    if (isGeneralAdmission) {
      const checkoutRows = items
        .map((item) => {
          const ticketTypeId = cleanText(item.ticketTypeId);
          const quantity = positiveQuantity(item.quantity);

          const ticketType = ticketTypes.find(
            (currentTicketType) => currentTicketType.id === ticketTypeId,
          );

          if (!ticketType || quantity <= 0) {
            return null;
          }

          return {
            ticketType,
            quantity,
          };
        })
        .filter(Boolean) as {
        ticketType: (typeof ticketTypes)[number];
        quantity: number;
      }[];

      if (checkoutRows.length === 0) {
        return NextResponse.json(
          { error: "Please choose at least one ticket." },
          { status: 400 },
        );
      }

      validateAccessCodeTicketRestriction({
        accessCode: accessCode || {
          id: "",
          tenant_slug: event.tenant_slug,
          event_id: event.id,
          code: "",
          label: null,
          access_type: "complimentary",
          max_uses: null,
          used_count: 0,
          ticket_type_id: null,
          is_active: true,
          expires_at: null,
        },
        ticketTypeIds: checkoutRows.map((row) => row.ticketType.id),
      });

      const ticketOnlyTotalCents = checkoutRows.reduce(
        (sum, row) => sum + Number(row.ticketType.price || 0) * row.quantity,
        0,
      );

      const ticketTotalCents = ticketOnlyTotalCents + addOnTotalCents;

      if (ticketTotalCents <= 0) {
        return NextResponse.json(
          { error: "Invalid checkout total." },
          { status: 400 },
        );
      }
            if (accessCode) {
        const order = await createPendingEventOrder({
          tenantSlug: event.tenant_slug,
          eventId: event.id,
          amountTotal: 0,
          currency: event.currency,
          buyerName,
          buyerEmail,
          buyer_name: buyerName,
          buyer_email: buyerEmail,
        } as never);

        orderId = order.id;

        for (const row of checkoutRows) {
          await createEventOrderItem({
            orderId: order.id,
            eventId: event.id,
            ticketTypeId: row.ticketType.id,
            seatId: null,
            label: `${accessCode.access_type.toUpperCase()} — ${
              row.ticketType.name
            }`,
            quantity: row.quantity,
            unitAmount: 0,
            guest_name: buyerName,
            dietary_requirements: null,
            menu_choice: null,
          });
        }

        await markEventOrderComplimentaryPaid({
          orderId: order.id,
          accessCode,
        });

        await incrementAccessCodeUsage({
          tenantSlug: event.tenant_slug,
          eventId: event.id,
          accessCodeId: accessCode.id,
        });

        await sendComplimentaryEventReceipt({
          tenantSlug: event.tenant_slug,
          eventId: event.id,
          orderId: order.id,
          buyerName,
          buyerEmail,
          currency: event.currency,
        });

        return NextResponse.json({
          url: complimentarySuccessUrl(req, event.slug),
        });
      }

      const paymentSummary = normaliseEventPaymentSummary({
        ticketTotalCents,
        coverFees,
        platformFeePercent,
      });

      const order = await createPendingEventOrder({
        tenantSlug: event.tenant_slug,
        eventId: event.id,
        amountTotal: paymentSummary.amountTotalCents,
        currency: event.currency,
        buyerName,
        buyerEmail,
        buyer_name: buyerName,
        buyer_email: buyerEmail,
      } as never);

      orderId = order.id;

      for (const row of checkoutRows) {
        await createEventOrderItem({
          orderId: order.id,
          eventId: event.id,
          ticketTypeId: row.ticketType.id,
          seatId: null,
          label: row.ticketType.name,
          quantity: row.quantity,
          unitAmount: row.ticketType.price,
          guest_name: buyerName,
          dietary_requirements: null,
          menu_choice: null,
        });
      }

      await createEventAddOnOrderItems({
        orderId: order.id,
        eventId: event.id,
        buyerName,
        addOns: validatedAddOns,
      });

      const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] =
        checkoutRows.map((row) => ({
          quantity: row.quantity,
          price_data: {
            currency: event.currency.toLowerCase(),
            unit_amount: Number(row.ticketType.price || 0),
            product_data: {
              name: `${event.title} — ${row.ticketType.name}`,
            },
          },
        }));

      lineItems.push(
        ...createEventAddOnStripeLineItems({
          eventTitle: event.title,
          currency: event.currency,
          addOns: validatedAddOns,
        }),
      );

      if (paymentSummary.buyerContributionCents > 0) {
        lineItems.push({
          quantity: 1,
          price_data: {
            currency: event.currency.toLowerCase(),
            unit_amount: paymentSummary.buyerContributionCents,
            product_data: {
              name: `${event.title} — Cover processing costs`,
              description:
                "Optional contribution to help cover platform and payment processing costs.",
            },
          },
        });
      }

      const session = await createStripeCheckoutSession({
        stripe,
        buyerEmail,
        successUrl: `${siteUrl(
          req,
        )}/e/${event.slug}?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
        cancelUrl: `${siteUrl(req)}/e/${event.slug}?checkout=cancelled`,
        lineItems,
        finance,
        applicationFeeCents: paymentSummary.applicationFeeCents,
        metadata: eventCheckoutMetadata({
          event,
          orderId: order.id,
          buyerName,
          buyerEmail,
          coverFees,
          buyerContributionCents: paymentSummary.buyerContributionCents,
          platformFeePercent,
          platformCommissionCents: paymentSummary.platformCommissionCents,
          stripeProcessingCoverCents:
            paymentSummary.stripeProcessingCoverCents,
          applicationFeeCents: paymentSummary.applicationFeeCents,
          ticketTotalCents: paymentSummary.ticketTotalCents,
          amountTotalCents: paymentSummary.amountTotalCents,
          tenantNetCents: paymentSummary.tenantNetCents,
          addOnTotalCents,
          addOnSummary,
        }),
      });

      await updateEventOrderStripeSession({
        orderId: order.id,
        stripeSessionId: session.id,
      });

      return NextResponse.json({ url: session.url });
    }

    const seats = event.seats || [];

    const seatIds = Array.from(
      new Set(items.map((item) => cleanText(item.seatId)).filter(Boolean)),
    );

    if (seatIds.length !== items.length) {
      return NextResponse.json(
        { error: "Duplicate or invalid seat selection." },
        { status: 400 },
      );
    }

    const checkoutRows = items.map((item) => {
      const seatId = cleanText(item.seatId);
      const ticketTypeId = cleanText(item.ticketTypeId);

      const seat = seats.find((currentSeat) => currentSeat.id === seatId);

      if (!seat || seat.status !== "available") {
        throw new Error("One or more seats are unavailable.");
      }

      const ticketType = ticketTypes.find(
        (currentTicketType) => currentTicketType.id === ticketTypeId,
      );

      if (!ticketType) {
        throw new Error("Invalid ticket type.");
      }

      if (seat.ticket_type_id && seat.ticket_type_id !== ticketType.id) {
        throw new Error("Invalid ticket type for selected seat.");
      }

      const tableName = cleanText(item.tableName);
      const guestName = cleanText(item.guestName);

      const dietaryRequirements =
        cleanText(item.dietaryRequirements) || cleanText(item.dietary);

      const menuChoice = cleanText(item.menuChoice);

      return {
        seat,
        ticketType,
        tableName,
        guestName,
        dietaryRequirements,
        menuChoice,
      };
    });

    validateAccessCodeTicketRestriction({
      accessCode: accessCode || {
        id: "",
        tenant_slug: event.tenant_slug,
        event_id: event.id,
        code: "",
        label: null,
        access_type: "complimentary",
        max_uses: null,
        used_count: 0,
        ticket_type_id: null,
        is_active: true,
        expires_at: null,
      },
      ticketTypeIds: checkoutRows.map((row) => row.ticketType.id),
    });

    const ticketOnlyTotalCents = checkoutRows.reduce(
      (sum, row) => sum + Number(row.ticketType.price || 0),
      0,
    );

    const ticketTotalCents = ticketOnlyTotalCents + addOnTotalCents;

    if (ticketTotalCents <= 0) {
      return NextResponse.json(
        { error: "Invalid checkout total." },
        { status: 400 },
      );
    }

    if (accessCode) {
      const order = await createPendingEventOrder({
        tenantSlug: event.tenant_slug,
        eventId: event.id,
        amountTotal: 0,
        currency: event.currency,
        buyerName,
        buyerEmail,
        buyer_name: buyerName,
        buyer_email: buyerEmail,
      } as never);

      orderId = order.id;

      const reservedCount = await reserveEventSeatsForOrder({
        eventId: event.id,
        orderId: order.id,
        seatIds,
      });

      if (reservedCount !== seatIds.length) {
        await deleteEventOrderAndItems(order.id);
        orderId = null;

        return NextResponse.json(
          { error: "Seats unavailable." },
          { status: 409 },
        );
      }

      for (const row of checkoutRows) {
        await createEventOrderItem({
          orderId: order.id,
          eventId: event.id,
          ticketTypeId: row.ticketType.id,
          seatId: row.seat.id,
          label: `${accessCode.access_type.toUpperCase()} — ${seatLabel({
            tableNumber: row.seat.table_number,
            rowLabel: row.seat.row_label,
            seatNumber: row.seat.seat_number,
            tableName: row.tableName,
          })}`,
          quantity: 1,
          unitAmount: 0,
          guest_name: row.guestName || buyerName,
          dietary_requirements: row.dietaryRequirements || null,
          menu_choice: row.menuChoice || null,
        });
      }

      await markEventOrderComplimentaryPaid({
        orderId: order.id,
        accessCode,
      });

      await markSeatsComplimentarySold({
        eventId: event.id,
        orderId: order.id,
        buyerName,
        buyerEmail,
        accessType: accessCode.access_type || "complimentary",
        rows: checkoutRows.map((row) => ({
          seat: {
            id: row.seat.id,
          },
          guestName: row.guestName || buyerName,
          dietaryRequirements: row.dietaryRequirements,
          menuChoice: row.menuChoice,
        })),
      });

      await incrementAccessCodeUsage({
        tenantSlug: event.tenant_slug,
        eventId: event.id,
        accessCodeId: accessCode.id,
      });

      await sendComplimentaryEventReceipt({
        tenantSlug: event.tenant_slug,
        eventId: event.id,
        orderId: order.id,
        buyerName,
        buyerEmail,
        currency: event.currency,
      });

      return NextResponse.json({
        url: complimentarySuccessUrl(req, event.slug),
      });
    }

    const paymentSummary = normaliseEventPaymentSummary({
      ticketTotalCents,
      coverFees,
      platformFeePercent,
    });

    const order = await createPendingEventOrder({
      tenantSlug: event.tenant_slug,
      eventId: event.id,
      amountTotal: paymentSummary.amountTotalCents,
      currency: event.currency,
      buyerName,
      buyerEmail,
      buyer_name: buyerName,
      buyer_email: buyerEmail,
    } as never);

    orderId = order.id;

    const reservedCount = await reserveEventSeatsForOrder({
      eventId: event.id,
      orderId: order.id,
      seatIds,
    });

    if (reservedCount !== seatIds.length) {
      await deleteEventOrderAndItems(order.id);
      orderId = null;

      return NextResponse.json(
        { error: "Seats unavailable." },
        { status: 409 },
      );
    }

    for (const row of checkoutRows) {
      await createEventOrderItem({
        orderId: order.id,
        eventId: event.id,
        ticketTypeId: row.ticketType.id,
        seatId: row.seat.id,
        label: seatLabel({
          tableNumber: row.seat.table_number,
          rowLabel: row.seat.row_label,
          seatNumber: row.seat.seat_number,
          tableName: row.tableName,
        }),
        quantity: 1,
        unitAmount: row.ticketType.price,
        guest_name: row.guestName || buyerName,
        dietary_requirements: row.dietaryRequirements || null,
        menu_choice: row.menuChoice || null,
      });
    }

    await createEventAddOnOrderItems({
      orderId: order.id,
      eventId: event.id,
      buyerName,
      addOns: validatedAddOns,
    });

    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [
      {
        quantity: 1,
        price_data: {
          currency: event.currency.toLowerCase(),
          unit_amount: ticketOnlyTotalCents,
          product_data: {
            name: event.title,
          },
        },
      },
      ...createEventAddOnStripeLineItems({
        eventTitle: event.title,
        currency: event.currency,
        addOns: validatedAddOns,
      }),
    ];

    if (paymentSummary.buyerContributionCents > 0) {
      lineItems.push({
        quantity: 1,
        price_data: {
          currency: event.currency.toLowerCase(),
          unit_amount: paymentSummary.buyerContributionCents,
          product_data: {
            name: `${event.title} — Cover processing costs`,
            description:
              "Optional contribution to help cover platform and payment processing costs.",
          },
        },
      });
    }

    const session = await createStripeCheckoutSession({
      stripe,
      buyerEmail,
      successUrl: `${siteUrl(
        req,
      )}/e/${event.slug}?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${siteUrl(req)}/e/${event.slug}?checkout=cancelled`,
      lineItems,
      finance,
      applicationFeeCents: paymentSummary.applicationFeeCents,
      metadata: eventCheckoutMetadata({
        event,
        orderId: order.id,
        buyerName,
        buyerEmail,
        coverFees,
        buyerContributionCents: paymentSummary.buyerContributionCents,
        platformFeePercent,
        platformCommissionCents: paymentSummary.platformCommissionCents,
        stripeProcessingCoverCents: paymentSummary.stripeProcessingCoverCents,
        applicationFeeCents: paymentSummary.applicationFeeCents,
        ticketTotalCents: paymentSummary.ticketTotalCents,
        amountTotalCents: paymentSummary.amountTotalCents,
        tenantNetCents: paymentSummary.tenantNetCents,
        addOnTotalCents,
        addOnSummary,
      }),
    });

    await updateEventOrderStripeSession({
      orderId: order.id,
      stripeSessionId: session.id,
    });

    await attachStripeSessionToReservedSeats({
      orderId: order.id,
      stripeSessionId: session.id,
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    if (orderId) {
      await deleteEventOrderAndItems(orderId);
    }

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Checkout failed.",
      },
      { status: 500 },
    );
  }
}
