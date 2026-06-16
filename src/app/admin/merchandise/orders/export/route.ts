import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/auth";
import { query } from "@/lib/db";
import { getTenantSlugFromHeaders } from "@/lib/tenant";
import { getTenantSettings } from "@/lib/tenant-settings";
import {
  checkSubscriptionCapability,
  normaliseSubscriptionTier,
} from "@/lib/subscription-capabilities";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

type TenantSettingsLike = {
  subscription_tier?: string | null;
  subscription_status?: string | null;
  platform_owner_bypass?: boolean | null;
};

type TenantAccessResult =
  | {
      ok: true;
      tenantSlug: string;
    }
  | {
      ok: false;
      response: Response;
    };

type MerchandiseOrderExportRow = {
  order_id: string;
  tenant_slug: string;
  order_reference: string;
  status: string;
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  fulfilment_method: string | null;
  linked_event_id: string | null;
  linked_event_title: string | null;
  booking_reference: string | null;
  table_number: string | null;
  seat_number: string | null;
  guest_name: string | null;
  customer_note: string | null;
  subtotal_cents: number | null;
  platform_fee_cents: number | null;
  stripe_fee_cents: number | null;
  total_cents: number | null;
  currency: string | null;
  stripe_checkout_session_id: string | null;
  stripe_payment_intent_id: string | null;
  paid_at: string | null;
  fulfilled_at: string | null;
  fulfilment_status: string | null;
  internal_note: string | null;
  created_at: string | null;
  updated_at: string | null;
  item_id: string | null;
  item_product_title: string | null;
  item_quantity: number | null;
  item_created_at: string | null;
};

function cleanText(value: unknown, fallback = "") {
  const clean = String(value ?? "").trim();
  return clean || fallback;
}

function orderStatusLabel(status: string | null | undefined) {
  if (status === "checkout_started") return "Checkout started";
  if (status === "paid") return "Paid";
  if (status === "payment_failed") return "Payment failed";
  if (status === "cancelled") return "Cancelled";
  if (status === "refunded") return "Refunded";
  if (status === "fulfilled") return "Fulfilled";
  if (status === "part_fulfilled") return "Part fulfilled";
  return "Draft";
}

function fulfilmentStatusLabel(status: string | null | undefined) {
  if (status === "ready_for_collection") return "Ready for collection";
  if (status === "collected") return "Collected";
  if (status === "ready_for_delivery") return "Ready for delivery";
  if (status === "delivered") return "Delivered";
  if (status === "posted") return "Posted";
  if (status === "arranged") return "Arranged";
  if (status === "cancelled") return "Cancelled";
  return "Not started";
}

function fulfilmentMethodLabel(method: string | null | undefined) {
  if (method === "collect_stand") return "Collect from stand";
  if (method === "collect_table") return "Collect from table";
  if (method === "deliver_table") return "Deliver to table";
  if (method === "deliver_seat") return "Deliver to seat";
  if (method === "post_after_event") return "Post after event";
  if (method === "arrange_with_organiser") return "Arrange with organiser";
  return "Not selected";
}

function penceToAmount(value: number | null | undefined) {
  return (Number(value || 0) / 100).toFixed(2);
}

function formatDateForCsv(value: string | null | undefined) {
  if (!value) return "";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return cleanText(value);
  }

  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "short",
    timeStyle: "short",
    hour12: false,
  }).format(date);
}

function csvCell(value: unknown) {
  const text = String(value ?? "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/\n/g, " ")
    .trim();

  if (/[",\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }

  return text;
}

function buildCsv(rows: MerchandiseOrderExportRow[]) {
  const headers = [
    "Order reference",
    "Order status",
    "Fulfilment status",
    "Customer name",
    "Customer email",
    "Customer phone",
    "Order created",
    "Paid at",
    "Fulfilled at",
    "Fulfilment method",
    "Linked event",
    "Booking reference",
    "Table number",
    "Seat number",
    "Guest name",
    "Customer note",
    "Product title",
    "Quantity",
    "Subtotal amount",
    "Platform fee amount",
    "Stripe fee amount",
    "Total amount",
    "Currency",
    "Stripe checkout session",
    "Stripe payment intent",
    "Internal note",
  ];

  const csvRows = rows.map((row) => [
    row.order_reference,
    orderStatusLabel(row.status),
    fulfilmentStatusLabel(row.fulfilment_status),
    row.customer_name,
    row.customer_email,
    row.customer_phone,
    formatDateForCsv(row.created_at),
    formatDateForCsv(row.paid_at),
    formatDateForCsv(row.fulfilled_at),
    fulfilmentMethodLabel(row.fulfilment_method),
    row.linked_event_title,
    row.booking_reference,
    row.table_number,
    row.seat_number,
    row.guest_name,
    row.customer_note,
    row.item_product_title,
    row.item_quantity ?? "",
    penceToAmount(row.subtotal_cents),
    penceToAmount(row.platform_fee_cents),
    penceToAmount(row.stripe_fee_cents),
    penceToAmount(row.total_cents),
    cleanText(row.currency, "GBP").toUpperCase(),
    row.stripe_checkout_session_id,
    row.stripe_payment_intent_id,
    row.internal_note,
  ]);

  return [headers, ...csvRows]
    .map((cells) => cells.map(csvCell).join(","))
    .join("\n");
}

function safeFilenamePart(value: string) {
  return cleanText(value, "tenant")
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

async function requireTenantAccess(
  request: NextRequest,
): Promise<TenantAccessResult> {
  const session = await auth();

  if (!session?.user) {
    return {
      ok: false,
      response: NextResponse.redirect(new URL("/admin/login", request.url)),
    };
  }

  const tenantSlug = await getTenantSlugFromHeaders();

  const sessionTenantSlugs = Array.isArray(session.user.tenantSlugs)
    ? session.user.tenantSlugs.map((value) => String(value))
    : [];

  if (!tenantSlug || !sessionTenantSlugs.includes(tenantSlug)) {
    return {
      ok: false,
      response: NextResponse.redirect(
        new URL("/admin/login?error=tenant_access_denied", request.url),
      ),
    };
  }

  return {
    ok: true,
    tenantSlug,
  };
}

async function listMerchandiseOrderExportRows(tenantSlug: string) {
  return query<MerchandiseOrderExportRow>(
    `
      select
        merchandise_orders.id::text as order_id,
        merchandise_orders.tenant_slug,
        merchandise_orders.order_reference,
        merchandise_orders.status,
        merchandise_orders.customer_name,
        merchandise_orders.customer_email,
        merchandise_orders.customer_phone,
        merchandise_orders.fulfilment_method,
        merchandise_orders.linked_event_id::text,
        events.title as linked_event_title,
        merchandise_orders.booking_reference,
        merchandise_orders.table_number,
        merchandise_orders.seat_number,
        merchandise_orders.guest_name,
        merchandise_orders.customer_note,
        merchandise_orders.subtotal_cents,
        merchandise_orders.platform_fee_cents,
        merchandise_orders.stripe_fee_cents,
        merchandise_orders.total_cents,
        merchandise_orders.currency,
        merchandise_orders.stripe_checkout_session_id,
        merchandise_orders.stripe_payment_intent_id,
        merchandise_orders.paid_at::text,
        merchandise_orders.fulfilled_at::text,
        merchandise_orders.fulfilment_status,
        merchandise_orders.internal_note,
        merchandise_orders.created_at::text,
        merchandise_orders.updated_at::text,
        merchandise_order_items.id::text as item_id,
        merchandise_order_items.product_title as item_product_title,
        merchandise_order_items.quantity as item_quantity,
        merchandise_order_items.created_at::text as item_created_at
      from merchandise_orders
      left join events
        on events.id = merchandise_orders.linked_event_id
       and events.tenant_slug = merchandise_orders.tenant_slug
      left join merchandise_order_items
        on merchandise_order_items.order_id = merchandise_orders.id
       and merchandise_order_items.tenant_slug = merchandise_orders.tenant_slug
      where merchandise_orders.tenant_slug = $1
      order by
        merchandise_orders.created_at desc,
        merchandise_order_items.created_at asc nulls last
    `,
    [tenantSlug],
  );
}

export async function GET(request: NextRequest): Promise<Response> {
  const access = await requireTenantAccess(request);

  if (!access.ok) {
    return access.response;
  }

  const tenantSlug = access.tenantSlug;
  const tenantSettingsRaw = await getTenantSettings(tenantSlug);
  const tenantSettings = tenantSettingsRaw as TenantSettingsLike | null;
  const tier = normaliseSubscriptionTier(tenantSettings?.subscription_tier);

  const merchandiseCapability = checkSubscriptionCapability(
    {
      subscription_tier: tier,
      subscription_status:
        cleanText(tenantSettings?.subscription_status, "active") || "active",
      platform_owner_bypass: Boolean(tenantSettings?.platform_owner_bypass),
    },
    "merchandise",
  );

  if (!merchandiseCapability.allowed) {
    return NextResponse.json(
      {
        error:
          merchandiseCapability.reason ||
          "Merchandise is not available for this tenant.",
      },
      { status: 403 },
    );
  }

  const rows = await listMerchandiseOrderExportRows(tenantSlug);
  const csv = buildCsv(rows);
  const today = new Date().toISOString().slice(0, 10);
  const filename = `merchandise-orders-${safeFilenamePart(
    tenantSlug,
  )}-${today}.csv`;

  return new NextResponse(`\uFEFF${csv}`, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store, max-age=0",
    },
  });
}
