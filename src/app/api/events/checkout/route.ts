import { NextResponse } from "next/server";
import Stripe from "stripe";
import {
  attachStripeSessionToReservedSeats,
  createEventOrderItem,
  createPendingEventOrder,
  deleteEventOrderAndItems,
  getEventById,
  reserveEventSeatsForOrder,
  updateEventOrderStripeSession,
} from "../../../../../api/_lib/events-repo";

type CheckoutItemInput = {
  seatId: string;
  ticketTypeId: string;
};

type CheckoutBody = {
  eventId?: string;
  items?: CheckoutItemInput[];
};

function getStripe() {
  const secretKey = process.env.STRIPE_SECRET_KEY;

  if (!secretKey) {
    throw new Error("Missing STRIPE_SECRET_KEY");
  }

  return new Stripe(secretKey);
}

function siteUrl() {
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    return process.env.NEXT_PUBLIC_SITE_URL;
  }

  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return process.env.VERCEL_PROJECT_PRODUCTION_URL.startsWith("http")
      ? process.env.VERCEL_PROJECT_PRODUCTION_URL
      : `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  }

  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }

  return "http://localhost:3000";
}

function normaliseItems(items: unknown): CheckoutItemInput[] {
  if (!Array.isArray(items)) return [];

  const cleanItems = items
    .map((item) => {
      if (!item || typeof item !== "object") return null;

      const record = item as Record<string, unknown>;
      const seatId = String(record.seatId || "").trim();
      const ticketTypeId = String(record.ticketTypeId || "").trim();

      if (!seatId || !ticketTypeId) return null;

      return { seatId, ticketTypeId };
    })
    .filter(Boolean) as CheckoutItemInput[];

  const seen = new Set<string>();

  return cleanItems.filter((item) => {
    if (seen.has(item.seatId)) return false;
    seen.add(item.seatId);
    return true;
  });
}

function seatLabel(seat: {
  section: string | null;
  row_label: string | null;
  seat_number: string | null;
  table_number: string | null;
}) {
  if (seat.table_number) {
    return `Table ${seat.table_number}, Seat ${seat.seat_number || "?"}`;
  }

  return `${seat.section ? `${seat.section} · ` : ""}Row ${
    seat.row_label || "?"
  }, Seat ${seat.seat_number || "?"}`;
}

function isStandard(ticketTypeName: string) {
  return ticketTypeName.toLowerCase().includes("standard");
}

function isConcession(ticketTypeName: string) {
  return ticketTypeName.toLowerCase().includes("concession");
}

function isComplimentary(ticketTypeName: string) {
  return ticketTypeName.toLowerCase().includes("complimentary");
}

export async function POST(request: Request) {
  let orderId: string | null = null;

  try {
    const body = (await request.json()) as CheckoutBody;
    const eventId = String(body.eventId || "").trim();
    const items = normaliseItems(body.items);

    if (!eventId || items.length === 0) {
      return NextResponse.json(
        { error: "Missing event or selected seats." },
        { status: 400 },
      );
    }

    const event = await getEventById(eventId);

    if (!event || event.status !== "published") {
      return NextResponse.json(
        { error: "This event is not available." },
        { status: 404 },
      );
    }

    const seats = event.seats || [];
    const ticketTypes = (event.ticket_types || []).filter(
      (ticketType) => ticketType.is_active,
    );

    const checkoutLines = items.map((item) => {
      const seat = seats.find((seatItem) => seatItem.id === item.seatId);

      if (!seat) {
        throw new Error("Selected seat was not found.");
      }

      if (seat.status !== "available") {
        throw new Error(`${seatLabel(seat)} is no longer available.`);
      }

      const fixedTicketType = seat.ticket_type_id
        ? ticketTypes.find((ticketType) => ticketType.id === seat.ticket_type_id)
        : null;

      if (fixedTicketType && isComplimentary(fixedTicketType.name)) {
        throw new Error(`${seatLabel(seat)} is not available for public sale.`);
      }

      const ticketType = fixedTicketType
        ? fixedTicketType
        : ticketTypes.find((ticketType) => ticketType.id === item.ticketTypeId);

      if (!ticketType) {
        throw new Error("Selected ticket type was not found.");
      }

      if (!fixedTicketType) {
        const allowedNormalTicket =
          isStandard(ticketType.name) || isConcession(ticketType.name);

        if (!allowedNormalTicket) {
          throw new Error("Normal seats can only use Standard or Concession.");
        }
      }

      if (ticketType.price <= 0) {
        throw new Error("Free tickets cannot be purchased through checkout.");
      }

      return {
        seat,
        ticketType,
        label: `${seatLabel(seat)} — ${ticketType.name}`,
      };
    });

    const seatIds = checkoutLines.map((line) => line.seat.id);
    const amountTotal = checkoutLines.reduce(
      (sum, line) => sum + Number(line.ticketType.price || 0),
      0,
    );

    if (amountTotal <= 0) {
      return NextResponse.json(
        { error: "Checkout total must be greater than zero." },
        { status: 400 },
      );
    }

    const order = await createPendingEventOrder({
      tenantSlug: event.tenant_slug,
      eventId: event.id,
      amountTotal,
      currency: event.currency,
    });

    orderId = order.id;

    const reservedCount = await reserveEventSeatsForOrder({
      eventId: event.id,
      orderId: order.id,
      seatIds,
    });

    if (reservedCount !== seatIds.length) {
      await deleteEventOrderAndItems(order.id);

      return NextResponse.json(
        {
          error:
            "One or more selected seats were just reserved by someone else. Please refresh and choose again.",
        },
        { status: 409 },
      );
    }

    await Promise.all(
      checkoutLines.map((line) =>
        createEventOrderItem({
          orderId: order.id,
          eventId: event.id,
          ticketTypeId: line.ticketType.id,
          seatId: line.seat.id,
          label: line.label,
          quantity: 1,
          unitAmount: line.ticketType.price,
        }),
      ),
    );

    const stripe = getStripe();
    const baseUrl = siteUrl();

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      client_reference_id: order.id,
      customer_creation: "if_required",
      success_url: `${baseUrl}/e/${event.slug}?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/e/${event.slug}?checkout=cancelled`,
      metadata: {
        kind: "event_order",
        order_id: order.id,
        event_id: event.id,
        tenant_slug: event.tenant_slug,
      },
      payment_intent_data: {
        metadata: {
          kind: "event_order",
          order_id: order.id,
          event_id: event.id,
          tenant_slug: event.tenant_slug,
        },
      },
      line_items: checkoutLines.map((line) => ({
        quantity: 1,
        price_data: {
          currency: event.currency.toLowerCase(),
          unit_amount: line.ticketType.price,
          product_data: {
            name: line.label,
            metadata: {
              event_id: event.id,
              seat_id: line.seat.id,
              ticket_type_id: line.ticketType.id,
            },
          },
        },
      })),
    });

    if (!session.url) {
      throw new Error("Stripe did not return a checkout URL.");
    }

    await updateEventOrderStripeSession({
      orderId: order.id,
      stripeSessionId: session.id,
    });

    await attachStripeSessionToReservedSeats({
      orderId: order.id,
      stripeSessionId: session.id,
    });

    return NextResponse.json({
      url: session.url,
    });
  } catch (error) {
    if (orderId) {
      try {
        await deleteEventOrderAndItems(orderId);
      } catch {}
    }

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not create checkout session.",
      },
      { status: 500 },
    );
  }
}
import { NextResponse } from "next/server";
import Stripe from "stripe";
import {
  markEventSeatsSoldForStripeSession,
  releaseEventSeatsForStripeSession,
  updateEventOrderStatus,
} from "../../../../../api/_lib/events-repo";

function getStripe() {
  const secretKey = process.env.STRIPE_SECRET_KEY;

  if (!secretKey) {
    throw new Error("Missing STRIPE_SECRET_KEY");
  }

  return new Stripe(secretKey);
}

export async function POST(request: Request) {
  const stripe = getStripe();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    return NextResponse.json(
      { error: "Missing STRIPE_WEBHOOK_SECRET" },
      { status: 500 },
    );
  }

  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json(
      { error: "Missing Stripe signature" },
      { status: 400 },
    );
  }

  let event: Stripe.Event;

  try {
    const rawBody = await request.text();

    event = stripe.webhooks.constructEvent(
      rawBody,
      signature,
      webhookSecret,
    );
  } catch {
    return NextResponse.json(
      { error: "Invalid Stripe webhook signature" },
      { status: 400 },
    );
  }

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;

      const orderId =
        session.metadata?.order_id || session.client_reference_id || null;

      if (orderId) {
        const customerName = session.customer_details?.name || null;
        const customerEmail = session.customer_details?.email || null;

        await updateEventOrderStatus({
          orderId,
          status: "paid",
          customerName,
          customerEmail,
        });

        await markEventSeatsSoldForStripeSession({
          stripeSessionId: session.id,
          customerName,
          customerEmail,
        });
      }
    }

    if (event.type === "checkout.session.expired") {
      const session = event.data.object as Stripe.Checkout.Session;

      const orderId =
        session.metadata?.order_id || session.client_reference_id || null;

      if (orderId) {
        await updateEventOrderStatus({
          orderId,
          status: "expired",
        });
      }

      await releaseEventSeatsForStripeSession({
        stripeSessionId: session.id,
      });
    }

    return NextResponse.json({ received: true });
  } catch {
    return NextResponse.json(
      { error: "Webhook handler failed" },
      { status: 500 },
    );
  }
}
