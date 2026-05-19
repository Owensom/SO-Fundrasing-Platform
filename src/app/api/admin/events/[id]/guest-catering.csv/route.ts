import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { query } from "@/lib/db";
import { getTenantSlugFromHeaders } from "@/lib/tenant";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RouteContext = {
  params: {
    id: string;
  };
};

type EventRow = {
  id: string;
  tenant_slug: string;
  title: string;
  currency: string | null;
};

type GuestCateringCsvRow = {
  event_title: string | null;
  order_created_at: string | null;
  order_status: string | null;
  buyer_name: string | null;
  buyer_email: string | null;
  ticket_label: string | null;
  ticket_type_name: string | null;
  quantity: number | string | null;
  unit_amount: number | string | null;
  currency: string | null;
  guest_name: string | null;
  dietary_requirements: string | null;
  menu_choice: string | null;
  table_number: string | null;
  row_label: string | null;
  seat_number: string | null;
  seat_purpose: string | null;
};

function csvEscape(value: unknown) {
  const text = String(value ?? "");
  const escaped = text.replace(/"/g, '""');

  return `"${escaped}"`;
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

function moneyFromCents(value: number | string | null | undefined) {
  const number = Number(value || 0);

  if (!Number.isFinite(number)) return "0.00";

  return (number / 100).toFixed(2);
}

function seatLabel(row: GuestCateringCsvRow) {
  const tableNumber = String(row.table_number || "").trim();
  const rowLabel = String(row.row_label || "").trim();
  const seatNumber = String(row.seat_number || "").trim();

  if (tableNumber) {
    return `Table ${tableNumber}${seatNumber ? `, Seat ${seatNumber}` : ""}`;
  }

  if (rowLabel || seatNumber) {
    return `Row ${rowLabel || "?"}, Seat ${seatNumber || "?"}`;
  }

  return "General admission";
}

function ticketLabel(row: GuestCateringCsvRow) {
  return (
    String(row.ticket_label || "").trim() ||
    String(row.ticket_type_name || "").trim() ||
    "Ticket"
  );
}

function guestName(row: GuestCateringCsvRow) {
  return (
    String(row.guest_name || "").trim() ||
    String(row.buyer_name || "").trim() ||
    ""
  );
}

function makeCsv(rows: GuestCateringCsvRow[]) {
  const headers = [
    "Event",
    "Order date",
    "Payment status",
    "Buyer name",
    "Buyer email",
    "Guest name",
    "Seat / table",
    "Ticket type",
    "Quantity",
    "Ticket value",
    "Currency",
    "Menu choice",
    "Dietary requirements",
    "Seat purpose",
  ];

  const body = rows.map((row) => {
    const quantity = Math.max(1, Number(row.quantity || 1));
    const unitAmount = Number(row.unit_amount || 0);
    const ticketValue = moneyFromCents(unitAmount * quantity);

    return [
      row.event_title || "",
      formatDate(row.order_created_at),
      row.order_status || "",
      row.buyer_name || "",
      row.buyer_email || "",
      guestName(row),
      seatLabel(row),
      ticketLabel(row),
      String(quantity),
      ticketValue,
      row.currency || "",
      row.menu_choice || "",
      row.dietary_requirements || "",
      row.seat_purpose || "",
    ]
      .map(csvEscape)
      .join(",");
  });

  return [headers.map(csvEscape).join(","), ...body].join("\r\n");
}

function safeFilename(value: string) {
  const clean = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

  return clean || "event";
}

export async function GET(_request: Request, context: RouteContext) {
  const session = await auth();

  if (!session?.user) {
    return new NextResponse("Unauthorised", { status: 401 });
  }

  const eventId = String(context.params.id || "").trim();

  if (!eventId) {
    return new NextResponse("Missing event id", { status: 400 });
  }

  const tenantSlug = await getTenantSlugFromHeaders();

  const sessionTenantSlugs = Array.isArray(session.user.tenantSlugs)
    ? session.user.tenantSlugs.map((value) => String(value))
    : [];

  if (!tenantSlug || !sessionTenantSlugs.includes(tenantSlug)) {
    return new NextResponse("Tenant access denied", { status: 403 });
  }

  const eventRows = await query<EventRow>(
    `
      select
        id,
        tenant_slug,
        title,
        currency
      from events
      where id = $1
      limit 1
    `,
    [eventId],
  );

  const event = eventRows[0];

  if (!event) {
    return new NextResponse("Event not found", { status: 404 });
  }

  if (event.tenant_slug !== tenantSlug) {
    return new NextResponse("Tenant access denied", { status: 403 });
  }

  const rows = await query<GuestCateringCsvRow>(
    `
      select
        e.title as event_title,
        eo.created_at as order_created_at,
        eo.status as order_status,
        eo.customer_name as buyer_name,
        eo.customer_email as buyer_email,
        eoi.label as ticket_label,
        ett.name as ticket_type_name,
        eoi.quantity,
        eoi.unit_amount,
        coalesce(eo.currency, e.currency) as currency,
        eoi.guest_name,
        eoi.dietary_requirements,
        eoi.menu_choice,
        es.table_number,
        es.row_label,
        es.seat_number,
        es.seat_purpose
      from event_orders eo
      inner join events e
        on e.id = eo.event_id
      inner join event_order_items eoi
        on eoi.order_id = eo.id
      left join event_seats es
        on es.id = eoi.seat_id
      left join event_ticket_types ett
        on ett.id = eoi.ticket_type_id
      where eo.event_id = $1
        and eo.status = 'paid'
        and e.tenant_slug = $2
      order by
        eo.created_at desc,
        case
          when es.table_number ~ '^[0-9]+$'
          then es.table_number::int
          else null
        end asc nulls last,
        es.table_number asc nulls last,
        case
          when es.row_label ~ '^[0-9]+$'
          then es.row_label::int
          else null
        end asc nulls last,
        es.row_label asc nulls last,
        case
          when es.seat_number ~ '^[0-9]+$'
          then es.seat_number::int
          else null
        end asc nulls last,
        es.seat_number asc nulls last,
        eoi.created_at asc
    `,
    [eventId, tenantSlug],
  );

  const csv = makeCsv(rows);
  const filename = `${safeFilename(event.title)}-guest-catering.csv`;

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
