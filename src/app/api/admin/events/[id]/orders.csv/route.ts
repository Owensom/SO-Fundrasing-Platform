import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { query } from "@/lib/db";
import { getTenantSlugFromRequest } from "@/lib/tenant";
import { getEventById } from "../../../../../../../api/_lib/events-repo";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type RouteContext = {
  params: {
    id: string;
  };
};

type EventOrderExportRow = {
  order_id: string;
  order_created_at: string;
  order_status: string;
  stripe_session_id: string | null;
  customer_name: string | null;
  customer_email: string | null;
  amount_total: number | string | null;
  currency: string | null;

  order_item_id: string | null;
  ticket_type_id: string | null;
  ticket_type_name: string | null;
  item_label: string | null;
  quantity: number | string | null;
  unit_amount: number | string | null;
  guest_name: string | null;
  dietary_requirements: string | null;
  menu_choice: string | null;

  seat_id: string | null;
  table_number: string | null;
  row_label: string | null;
  seat_number: string | null;
  seat_purpose: string | null;
  seat_customer_name: string | null;
  seat_customer_email: string | null;
};

function csvEscape(value: unknown) {
  const text = String(value ?? "");
  const escaped = text.replace(/"/g, '""');

  return `"${escaped}"`;
}

function formatMoneyPlain(
  cents: number | string | null | undefined,
  currency = "GBP",
) {
  const value = Number(cents || 0);

  return `${(value / 100).toFixed(2)} ${currency || "GBP"}`;
}

function formatDate(value: string | null | undefined) {
  if (!value) return "";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "";

  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function fallbackText(value: unknown) {
  return String(value || "").trim();
}

function seatLabel(row: EventOrderExportRow) {
  if (row.table_number) {
    return `Table ${row.table_number}, Seat ${row.seat_number || "?"}`;
  }

  if (row.row_label || row.seat_number) {
    return `Row ${row.row_label || "?"}, Seat ${row.seat_number || "?"}`;
  }

  return "General admission";
}

function ticketLabel(row: EventOrderExportRow) {
  return (
    String(row.item_label || "").trim() ||
    String(row.ticket_type_name || "").trim() ||
    "Ticket"
  );
}

function guestName(row: EventOrderExportRow) {
  return (
    String(row.guest_name || "").trim() ||
    String(row.seat_customer_name || "").trim() ||
    String(row.customer_name || "").trim()
  );
}

function guestEmail(row: EventOrderExportRow) {
  return (
    String(row.seat_customer_email || "").trim() ||
    String(row.customer_email || "").trim()
  );
}

async function requireEventExportAccess(request: NextRequest, eventId: string) {
  const session = await auth();

  if (!session?.user) {
    return {
      ok: false as const,
      response: NextResponse.json(
        { ok: false, error: "Unauthorized" },
        { status: 401 },
      ),
    };
  }

  const tenantSlug = getTenantSlugFromRequest(request);

  const sessionTenantSlugs = Array.isArray(session.user.tenantSlugs)
    ? session.user.tenantSlugs.map((value) => String(value))
    : [];

  if (!tenantSlug || !sessionTenantSlugs.includes(tenantSlug)) {
    return {
      ok: false as const,
      response: NextResponse.json(
        { ok: false, error: "Tenant access denied" },
        { status: 403 },
      ),
    };
  }

  const event = await getEventById(eventId);

  if (!event || event.tenant_slug !== tenantSlug) {
    return {
      ok: false as const,
      response: NextResponse.json(
        { ok: false, error: "Event not found" },
        { status: 404 },
      ),
    };
  }

  return {
    ok: true as const,
    event,
    tenantSlug,
  };
}

async function listEventOrderExportRows(eventId: string) {
  return query<EventOrderExportRow>(
    `
      select
        eo.id::text as order_id,
        eo.created_at::text as order_created_at,
        eo.status as order_status,
        eo.stripe_session_id,
        eo.customer_name,
        eo.customer_email,
        eo.amount_total,
        eo.currency,

        eoi.id::text as order_item_id,
        eoi.ticket_type_id::text,
        ett.name as ticket_type_name,
        eoi.label as item_label,
        eoi.quantity,
        eoi.unit_amount,
        eoi.guest_name,
        eoi.dietary_requirements,
        eoi.menu_choice,

        eoi.seat_id::text,
        es.table_number,
        es.row_label,
        es.seat_number,
        es.seat_purpose,
        es.customer_name as seat_customer_name,
        es.customer_email as seat_customer_email
      from event_orders eo
      left join event_order_items eoi
        on eoi.order_id = eo.id
      left join event_ticket_types ett
        on ett.id = eoi.ticket_type_id
      left join event_seats es
        on es.id = eoi.seat_id
      where eo.event_id = $1
      order by
        eo.created_at desc,
        eoi.created_at asc
    `,
    [eventId],
  );
}

export async function GET(request: NextRequest, context: RouteContext) {
  const eventId = context.params.id;

  const access = await requireEventExportAccess(request, eventId);

  if (!access.ok) {
    return access.response;
  }

  const rows = await listEventOrderExportRows(eventId);

  const headers = [
    "Order ID",
    "Order created",
    "Order status",
    "Stripe session ID",
    "Buyer name",
    "Buyer email",
    "Order total",
    "Currency",
    "Order item ID",
    "Ticket / item",
    "Ticket type",
    "Quantity",
    "Unit amount",
    "Guest name",
    "Guest email",
    "Seat / table",
    "Seat purpose",
    "Menu choice",
    "Dietary requirements",
  ];

  const csvRows = [
    headers.map(csvEscape).join(","),
    ...rows.map((row) => {
      const currency = row.currency || access.event.currency || "GBP";

      return [
        row.order_id,
        formatDate(row.order_created_at),
        row.order_status,
        row.stripe_session_id,
        row.customer_name,
        row.customer_email,
        formatMoneyPlain(row.amount_total, currency),
        currency,
        row.order_item_id,
        ticketLabel(row),
        row.ticket_type_name,
        Number(row.quantity || 0),
        formatMoneyPlain(row.unit_amount, currency),
        guestName(row),
        guestEmail(row),
        seatLabel(row),
        row.seat_purpose,
        fallbackText(row.menu_choice),
        fallbackText(row.dietary_requirements),
      ]
        .map(csvEscape)
        .join(",");
    }),
  ];

  const csv = `${csvRows.join("\n")}\n`;

  const safeSlug = String(access.event.slug || "event")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  const filename = `${safeSlug || "event"}-orders.csv`;

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
