import { NextResponse } from "next/server";
import Stripe from "stripe";
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

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

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

export async function POST(req: Request) {
  let orderId: string | null = null;

  try {
    const tenantSlug = await getTenantSlugFromHeaders();
    const body = await req.json();

    const eventId = cleanText(body.eventId);
    const items: CheckoutItem[] = Array.isArray(body.items) ? body.items : [];

    if (!eventId || items.length === 0) {
      return NextResponse.json(
        { error: "Missing checkout data." },
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

      const total = checkoutRows.reduce(
        (sum, row) => sum + Number(row.ticketType.price || 0) * row.quantity,
        0,
      );

      if (total <= 0) {
        return NextResponse.json(
          { error: "Invalid checkout total." },
          { status: 400 },
        );
      }

      const order = await createPendingEventOrder({
        tenantSlug: event.tenant_slug,
        eventId: event.id,
        amountTotal: total,
        currency: event.currency,
      });

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
          guest_name: null,
          dietary_requirements: null,
          menu_choice: null,
        });
      }

      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        success_url: `${siteUrl(req)}/e/${event.slug}?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${siteUrl(req)}/e/${event.slug}?checkout=cancelled`,
        line_items: checkoutRows.map((row) => ({
          quantity: row.quantity,
          price_data: {
            currency: event.currency.toLowerCase(),
            unit_amount: Number(row.ticketType.price || 0),
            product_data: {
              name: `${event.title} — ${row.ticketType.name}`,
            },
          },
        })),
        metadata: {
          tenant_slug: event.tenant_slug,
          event_id: event.id,
          order_id: order.id,
          event_type: event.event_type,
        },
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

    const total = checkoutRows.reduce(
      (sum, row) => sum + Number(row.ticketType.price || 0),
      0,
    );

    if (total <= 0) {
      return NextResponse.json(
        { error: "Invalid checkout total." },
        { status: 400 },
      );
    }

    const order = await createPendingEventOrder({
      tenantSlug: event.tenant_slug,
      eventId: event.id,
      amountTotal: total,
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
        guest_name: row.guestName || null,
        dietary_requirements: row.dietaryRequirements || null,
        menu_choice: row.menuChoice || null,
      });
    }

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      success_url: `${siteUrl(req)}/e/${event.slug}?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl(req)}/e/${event.slug}?checkout=cancelled`,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: event.currency.toLowerCase(),
            unit_amount: total,
            product_data: {
              name: event.title,
            },
          },
        },
      ],
      metadata: {
        tenant_slug: event.tenant_slug,
        event_id: event.id,
        order_id: order.id,
        event_type: event.event_type,
      },
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
      { error: error instanceof Error ? error.message : "Checkout failed." },
      { status: 500 },
    );
  }
}
