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

type CheckoutItem = {
  seatId: string;
  ticketTypeId: string;
};

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

function siteUrl() {
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    return process.env.NEXT_PUBLIC_SITE_URL;
  }

  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }

  return "http://localhost:3000";
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

function isStandard(name: string) {
  return name.toLowerCase().includes("standard");
}

function isConcession(name: string) {
  return name.toLowerCase().includes("concession");
}

function isComplimentary(name: string) {
  return name.toLowerCase().includes("complimentary");
}

export async function POST(req: Request) {
  let orderId: string | null = null;

  try {
    const body = (await req.json()) as {
      eventId?: string;
      items?: CheckoutItem[];
    };

    const eventId = String(body.eventId || "").trim();
    const items = Array.isArray(body.items) ? body.items : [];

    if (!eventId || items.length === 0) {
      return NextResponse.json(
        { error: "Missing checkout data." },
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

    const cleanItems = items
      .map((item) => ({
        seatId: String(item.seatId || "").trim(),
        ticketTypeId: String(item.ticketTypeId || "").trim(),
      }))
      .filter((item) => item.seatId && item.ticketTypeId);

    const uniqueSeatIds = new Set<string>();
    const uniqueItems = cleanItems.filter((item) => {
      if (uniqueSeatIds.has(item.seatId)) return false;
      uniqueSeatIds.add(item.seatId);
      return true;
    });

    if (uniqueItems.length === 0) {
      return NextResponse.json(
        { error: "No valid seats selected." },
        { status: 400 },
      );
    }

    const checkoutLines = uniqueItems.map((item) => {
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

      const selectedTicketType = ticketTypes.find(
        (ticketType) => ticketType.id === item.ticketTypeId,
      );

      const ticketType = fixedTicketType || selectedTicketType;

      if (!ticketType) {
        throw new Error("Selected ticket type was not found.");
      }

      if (!fixedTicketType) {
        const allowed =
          isStandard(ticketType.name) || isConcession(ticketType.name);

        if (!allowed) {
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

    const seatIds = checkoutLines.map((line) => line.seat.id);

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

    return NextResponse.json({ url: session.url });
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
            : "Checkout failed. Please try again.",
      },
      { status: 500 },
    );
  }
}
