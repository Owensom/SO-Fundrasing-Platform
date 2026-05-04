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

  // NEW
  guestName?: string;
  dietary?: string;
  menuChoice?: string;
};

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

function siteUrl(req: Request) {
  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    "";

  if (appUrl) {
    return appUrl.startsWith("http") ? appUrl : `https://${appUrl}`;
  }

  return new URL(req.url).origin;
}

export async function POST(req: Request) {
  let orderId: string | null = null;

  try {
    const body = await req.json();

    const eventId = String(body.eventId || "").trim();
    const items: CheckoutItem[] = Array.isArray(body.items)
      ? body.items
      : [];

    if (!eventId || items.length === 0) {
      return NextResponse.json({ error: "Missing checkout data." }, { status: 400 });
    }

    const event = await getEventById(eventId);
    if (!event || event.status !== "published") {
      return NextResponse.json({ error: "Event unavailable." }, { status: 404 });
    }

    const seats = event.seats || [];
    const ticketTypes = event.ticket_types || [];

    const order = await createPendingEventOrder({
      tenantSlug: event.tenant_slug,
      eventId: event.id,
      amountTotal: 0,
      currency: event.currency,
    });

    orderId = order.id;

    const seatIds = items.map((i) => i.seatId);

    const reservedCount = await reserveEventSeatsForOrder({
      eventId,
      orderId: order.id,
      seatIds,
    });

    if (reservedCount !== seatIds.length) {
      await deleteEventOrderAndItems(order.id);
      return NextResponse.json(
        { error: "Some seats no longer available." },
        { status: 409 },
      );
    }

    let total = 0;

    for (const item of items) {
      const seat = seats.find((s) => s.id === item.seatId);
      const ticketType = ticketTypes.find((t) => t.id === item.ticketTypeId);

      if (!seat || !ticketType) {
        throw new Error("Invalid seat or ticket.");
      }

      total += ticketType.price;

      await createEventOrderItem({
        orderId: order.id,
        eventId: event.id,
        ticketTypeId: ticketType.id,
        seatId: seat.id,
        label: `Seat ${seat.seat_number}`,
        quantity: 1,
        unitAmount: ticketType.price,

        // NEW DATA (IMPORTANT)
        guest_name: item.guestName || null,
        dietary_requirements: item.dietary || null,
        menu_choice: item.menuChoice || null,
      } as any);
    }

    const baseUrl = siteUrl(req);

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      success_url: `${baseUrl}/e/${event.slug}?success=1`,
      cancel_url: `${baseUrl}/e/${event.slug}?cancel=1`,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: event.currency.toLowerCase(),
            unit_amount: total,
            product_data: { name: event.title },
          },
        },
      ],
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
      { error: error instanceof Error ? error.message : "Checkout failed" },
      { status: 500 },
    );
  }
}
