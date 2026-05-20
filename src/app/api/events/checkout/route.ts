import { NextResponse } from "next/server";
import Stripe from "stripe";
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

type EventCheckoutPaymentSummary = {
  ticketTotalCents: number;
  amountTotalCents: number;
  buyerContributionCents: number;
  platformCommissionCents: number;
  stripeProcessingCoverCents: number;
  applicationFeeCents: number;
  tenantNetCents: number;
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

    amount_total_cents: String(input.amountTotalCents),
    checkout_total_cents: String(input.amountTotalCents),
    net_amount_cents: String(input.tenantNetCents),
    tenant_net_after_application_fee_cents: String(input.tenantNetCents),
  };
}

export async function POST(req: Request) {
  let orderId: string | null = null;

  try {
    const tenantSlug = await getTenantSlugFromHeaders();
    const body = await req.json();

    const eventId = cleanText(body.eventId);
    const buyerName = cleanText(body.buyerName);
    const buyerEmail = cleanText(body.buyerEmail);
    const coverFees = truthy(body.coverFees);

    const items: CheckoutItem[] = Array.isArray(body.items) ? body.items : [];

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

      const ticketTotalCents = checkoutRows.reduce(
        (sum, row) => sum + Number(row.ticketType.price || 0) * row.quantity,
        0,
      );

      if (ticketTotalCents <= 0) {
        return NextResponse.json(
          { error: "Invalid checkout total." },
          { status: 400 },
        );
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

    const ticketTotalCents = checkoutRows.reduce(
      (sum, row) => sum + Number(row.ticketType.price || 0),
      0,
    );

    if (ticketTotalCents <= 0) {
      return NextResponse.json(
        { error: "Invalid checkout total." },
        { status: 400 },
      );
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

    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [
      {
        quantity: 1,
        price_data: {
          currency: event.currency.toLowerCase(),
          unit_amount: ticketTotalCents,
          product_data: {
            name: event.title,
          },
        },
      },
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
