import { NextResponse } from "next/server";
import Stripe from "stripe";
import { query } from "@/lib/db";
import { getTenantSlugFromHeaders } from "@/lib/tenant";
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

type TenantFinanceRow = {
  stripe_connect_account_id: string | null;
  stripe_connect_charges_enabled: boolean | null;
  stripe_connect_payouts_enabled: boolean | null;
  stripe_connect_details_submitted: boolean | null;
  stripe_connect_onboarding_complete: boolean | null;
  platform_fee_percent: number | string | null;
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
  if (!Number.isFinite(number)) return 0;
  return Math.max(0, Math.floor(number));
}

function truthy(value: unknown) {
  return value === true || value === "true" || value === "yes" || value === "1";
}

function calculateBuyerContributionCents(subtotalCents: number) {
  if (!subtotalCents || subtotalCents <= 0) return 0;
  return Math.max(0, Math.ceil(subtotalCents * 0.02 + 20));
}

function safePercent(value: unknown, fallback = 0) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) return fallback;
  return Math.min(100, Number(number.toFixed(2)));
}

function calculateApplicationFeeCents(
  subtotalCents: number,
  platformFeePercent: number,
) {
  if (!subtotalCents || subtotalCents <= 0 || platformFeePercent <= 0) return 0;
  return Math.max(0, Math.ceil(subtotalCents * (platformFeePercent / 100)));
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
      ? `Table ${input.tableNumber} (${tableName}), Seat ${input.seatNumber || ""}`
      : `Table ${input.tableNumber}, Seat ${input.seatNumber || ""}`;
  }

  return `Row ${input.rowLabel || ""}, Seat ${input.seatNumber || ""}`;
}

async function getTenantFinanceSettings(
  tenantSlug: string,
): Promise<TenantFinanceRow | null> {
  const rows = (await query(
    `
      select
        coalesce(
          nullif(ts.stripe_connect_account_id, ''),
          nullif(t.stripe_connect_account_id, '')
        ) as stripe_connect_account_id,
        t.stripe_connect_charges_enabled,
        t.stripe_connect_payouts_enabled,
        t.stripe_connect_details_submitted,
        t.stripe_connect_onboarding_complete,
        ts.platform_fee_percent
      from tenants t
      left join tenant_settings ts
        on ts.tenant_slug = t.slug
      where t.slug = $1
      limit 1
    `,
    [tenantSlug],
  )) as TenantFinanceRow[];

  return rows[0] || null;
}

function canUseConnectDestination(finance: TenantFinanceRow | null) {
  return Boolean(
    finance?.stripe_connect_account_id &&
      finance.stripe_connect_charges_enabled &&
      finance.stripe_connect_payouts_enabled &&
      finance.stripe_connect_details_submitted &&
      finance.stripe_connect_onboarding_complete,
  );
}

function stripeCheckoutParams(input: {
  buyerEmail: string;
  successUrl: string;
  cancelUrl: string;
  lineItems: Stripe.Checkout.SessionCreateParams.LineItem[];
  metadata: Stripe.MetadataParam;
  finance: TenantFinanceRow | null;
  applicationFeeCents: number;
}): Stripe.Checkout.SessionCreateParams {
  const useConnect = canUseConnectDestination(input.finance);
  const destination = input.finance?.stripe_connect_account_id || "";

  const params: Stripe.Checkout.SessionCreateParams = {
    mode: "payment",
    customer_email: input.buyerEmail,
    success_url: input.successUrl,
    cancel_url: input.cancelUrl,
    line_items: input.lineItems,
    metadata: {
      ...input.metadata,
      stripe_connect_enabled: useConnect ? "true" : "false",
      stripe_connect_account_id: destination,
    },
  };

  if (useConnect && destination) {
    params.payment_intent_data = {
      application_fee_amount: input.applicationFeeCents,
      transfer_data: {
        destination,
      },
      metadata: {
        ...input.metadata,
        stripe_connect_enabled: "true",
        stripe_connect_account_id: destination,
      },
    };
  }

  return params;
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
      return NextResponse.json({ error: "Missing checkout data." }, { status: 400 });
    }

    if (!buyerName || !buyerEmail) {
      return NextResponse.json(
        { error: "Name and email address are required." },
        { status: 400 },
      );
    }

    const event = await getEventById(eventId);

    if (!event || event.status !== "published") {
      return NextResponse.json({ error: "Event unavailable." }, { status: 404 });
    }

    if (!tenantSlug || event.tenant_slug !== tenantSlug) {
      return NextResponse.json(
        { error: "Event unavailable for this tenant." },
        { status: 404 },
      );
    }

    const finance = await getTenantFinanceSettings(event.tenant_slug);
    const platformFeePercent = safePercent(finance?.platform_fee_percent, 0);

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

          if (!ticketType || quantity <= 0) return null;

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

      const ticketTotal = checkoutRows.reduce(
        (sum, row) => sum + Number(row.ticketType.price || 0) * row.quantity,
        0,
      );

      if (ticketTotal <= 0) {
        return NextResponse.json(
          { error: "Invalid checkout total." },
          { status: 400 },
        );
      }

      const buyerContributionCents = coverFees
        ? calculateBuyerContributionCents(ticketTotal)
        : 0;

      const applicationFeeCents = calculateApplicationFeeCents(
        ticketTotal,
        platformFeePercent,
      );

      const total = ticketTotal + buyerContributionCents;

      const order = await createPendingEventOrder({
        tenantSlug: event.tenant_slug,
        eventId: event.id,
        amountTotal: total,
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

      if (buyerContributionCents > 0) {
        lineItems.push({
          quantity: 1,
          price_data: {
            currency: event.currency.toLowerCase(),
            unit_amount: buyerContributionCents,
            product_data: {
              name: `${event.title} — Cover processing costs`,
              description:
                "Optional contribution to help cover platform and payment processing costs.",
            },
          },
        });
      }

      const session = await stripe.checkout.sessions.create(
        stripeCheckoutParams({
          buyerEmail,
          successUrl: `${siteUrl(req)}/e/${event.slug}?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
          cancelUrl: `${siteUrl(req)}/e/${event.slug}?checkout=cancelled`,
          lineItems,
          finance,
          applicationFeeCents,
          metadata: {
            type: "event",
            tenant_slug: event.tenant_slug,
            event_id: event.id,
            eventId: event.id,
            order_id: order.id,
            orderId: order.id,
            event_type: event.event_type,
            event_title: event.title,
            buyer_name: buyerName,
            buyer_email: buyerEmail,
            cover_fees: coverFees ? "true" : "false",
            buyer_contribution_cents: String(buyerContributionCents),
            platform_fee_percent: String(platformFeePercent),
            platform_fee_cents: String(applicationFeeCents),
            ticket_total_cents: String(ticketTotal),
            amount_total_cents: String(total),
          },
        }),
      );

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

    const ticketTotal = checkoutRows.reduce(
      (sum, row) => sum + Number(row.ticketType.price || 0),
      0,
    );

    if (ticketTotal <= 0) {
      return NextResponse.json(
        { error: "Invalid checkout total." },
        { status: 400 },
      );
    }

    const buyerContributionCents = coverFees
      ? calculateBuyerContributionCents(ticketTotal)
      : 0;

    const applicationFeeCents = calculateApplicationFeeCents(
      ticketTotal,
      platformFeePercent,
    );

    const total = ticketTotal + buyerContributionCents;

    const order = await createPendingEventOrder({
      tenantSlug: event.tenant_slug,
      eventId: event.id,
      amountTotal: total,
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
          unit_amount: ticketTotal,
          product_data: {
            name: event.title,
          },
        },
      },
    ];

    if (buyerContributionCents > 0) {
      lineItems.push({
        quantity: 1,
        price_data: {
          currency: event.currency.toLowerCase(),
          unit_amount: buyerContributionCents,
          product_data: {
            name: `${event.title} — Cover processing costs`,
            description:
              "Optional contribution to help cover platform and payment processing costs.",
          },
        },
      });
    }

    const session = await stripe.checkout.sessions.create(
      stripeCheckoutParams({
        buyerEmail,
        successUrl: `${siteUrl(req)}/e/${event.slug}?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
        cancelUrl: `${siteUrl(req)}/e/${event.slug}?checkout=cancelled`,
        lineItems,
        finance,
        applicationFeeCents,
        metadata: {
          type: "event",
          tenant_slug: event.tenant_slug,
          event_id: event.id,
          eventId: event.id,
          order_id: order.id,
          orderId: order.id,
          event_type: event.event_type,
          event_title: event.title,
          buyer_name: buyerName,
          buyer_email: buyerEmail,
          cover_fees: coverFees ? "true" : "false",
          buyer_contribution_cents: String(buyerContributionCents),
          platform_fee_percent: String(platformFeePercent),
          platform_fee_cents: String(applicationFeeCents),
          ticket_total_cents: String(ticketTotal),
          amount_total_cents: String(total),
        },
      }),
    );

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
