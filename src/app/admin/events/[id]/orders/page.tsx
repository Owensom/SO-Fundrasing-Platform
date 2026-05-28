import type { CSSProperties, ReactNode } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { query } from "@/lib/db";
import { getTenantSlugFromHeaders } from "@/lib/tenant";
import { getEventById } from "../../../../../../api/_lib/events-repo";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type PageProps = {
  params: {
    id: string;
  };
  searchParams?: {
    status?: string;
  };
};

type EventOrderDashboardRow = {
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

type OrderGroup = {
  id: string;
  createdAt: string;
  status: string;
  stripeSessionId: string | null;
  customerName: string | null;
  customerEmail: string | null;
  amountTotal: number;
  currency: string;
  items: EventOrderDashboardRow[];
};

type AddOnSummary = {
  entries: number;
  revenueCents: number;
  paidEntries: number;
  paidRevenueCents: number;
};

type AddOnTypeSummary = AddOnSummary & {
  key: string;
  label: string;
  orders: number;
  paidOrders: number;
};

function formatMoney(
  cents: number | string | null | undefined,
  currency = "GBP",
) {
  const value = Number(cents || 0);

  try {
    return new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency: currency || "GBP",
    }).format(value / 100);
  } catch {
    return `${(value / 100).toFixed(2)} ${currency || "GBP"}`;
  }
}

function formatDate(value: string | null | undefined) {
  if (!value) return "Not recorded";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "Not recorded";

  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function statusLabel(value: string | null | undefined) {
  const clean = String(value || "").trim().toLowerCase();

  if (clean === "paid") return "Paid";
  if (clean === "pending") return "Pending";
  if (clean === "checkout_started") return "Checkout started";
  if (clean === "cancelled") return "Cancelled";
  if (clean === "expired") return "Expired";

  return clean || "Unknown";
}

function statusStyle(value: string | null | undefined): CSSProperties {
  const clean = String(value || "").trim().toLowerCase();

  if (clean === "paid") {
    return {
      background: "#dcfce7",
      color: "#166534",
      borderColor: "#bbf7d0",
    };
  }

  if (clean === "pending" || clean === "checkout_started") {
    return {
      background: "#eff6ff",
      color: "#1d4ed8",
      borderColor: "#bfdbfe",
    };
  }

  if (clean === "cancelled" || clean === "expired") {
    return {
      background: "#fee2e2",
      color: "#991b1b",
      borderColor: "#fecaca",
    };
  }

  return {
    background: "#f8fafc",
    color: "#475569",
    borderColor: "#e2e8f0",
  };
}

function fallbackText(value: unknown, fallback = "Not provided") {
  const clean = String(value || "").trim();
  return clean || fallback;
}

function isEventAddOnItem(row: EventOrderDashboardRow) {
  const label = String(row.item_label || "").trim().toLowerCase();

  return (
    label.startsWith("event add-on") ||
    label.includes("heads or tails") ||
    label.includes("higher or lower") ||
    (!row.ticket_type_id && !row.seat_id && label.includes("add-on"))
  );
}

function ticketLabel(row: EventOrderDashboardRow) {
  return (
    String(row.item_label || "").trim() ||
    String(row.ticket_type_name || "").trim() ||
    "Ticket"
  );
}

function cleanAddOnLabel(row: EventOrderDashboardRow) {
  const label = ticketLabel(row);

  return label
    .replace(/^event add-on\s*[—-]\s*/i, "")
    .replace(/^add-on\s*[—-]\s*/i, "")
    .trim();
}

function addOnDisplayLabel(row: EventOrderDashboardRow) {
  const label = cleanAddOnLabel(row);

  if (label) return label;

  const rawLabel = String(row.item_label || "").toLowerCase();

  if (rawLabel.includes("higher or lower")) return "Higher or Lower";
  if (rawLabel.includes("heads or tails")) return "Heads or Tails";

  return "Event add-on";
}

function addOnKey(row: EventOrderDashboardRow) {
  return addOnDisplayLabel(row)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function formatAddOnEntryLabel(entries: number) {
  if (entries === 1) return "1 add-on entry";
  return `${entries} add-on entries`;
}

function formatOrderAddOnSummary(addOnItems: EventOrderDashboardRow[]) {
  if (addOnItems.length === 0) return "No add-ons";

  const grouped = new Map<string, { label: string; entries: number }>();

  for (const item of addOnItems) {
    const key = addOnKey(item);
    const label = addOnDisplayLabel(item);
    const current = grouped.get(key) || { label, entries: 0 };

    current.entries += rowQuantity(item);
    grouped.set(key, current);
  }

  return Array.from(grouped.values())
    .map((summary) => `${summary.label} × ${summary.entries}`)
    .join(", ");
}

function rowQuantity(row: EventOrderDashboardRow) {
  return Math.max(1, Number(row.quantity || 1));
}

function rowTotal(row: EventOrderDashboardRow) {
  return rowQuantity(row) * Number(row.unit_amount || 0);
}

function seatLabel(row: EventOrderDashboardRow) {
  if (isEventAddOnItem(row)) {
    return "Event add-on";
  }

  if (row.table_number) {
    return `Table ${row.table_number}, Seat ${row.seat_number || "?"}`;
  }

  if (row.row_label || row.seat_number) {
    return `Row ${row.row_label || "?"}, Seat ${row.seat_number || "?"}`;
  }

  return "General admission";
}

function guestName(row: EventOrderDashboardRow, order: OrderGroup) {
  if (isEventAddOnItem(row)) {
    return fallbackText(order.customerName, "Buyer not provided");
  }

  return (
    String(row.guest_name || "").trim() ||
    String(row.seat_customer_name || "").trim() ||
    String(order.customerName || "").trim() ||
    "Guest not provided"
  );
}

function guestEmail(row: EventOrderDashboardRow, order: OrderGroup) {
  return (
    String(row.seat_customer_email || "").trim() ||
    String(order.customerEmail || "").trim() ||
    "Email not provided"
  );
}

function groupOrders(rows: EventOrderDashboardRow[]) {
  const map = new Map<string, OrderGroup>();

  for (const row of rows) {
    const existing = map.get(row.order_id);

    if (!existing) {
      map.set(row.order_id, {
        id: row.order_id,
        createdAt: row.order_created_at,
        status: row.order_status,
        stripeSessionId: row.stripe_session_id,
        customerName: row.customer_name,
        customerEmail: row.customer_email,
        amountTotal: Number(row.amount_total || 0),
        currency: row.currency || "GBP",
        items: row.order_item_id ? [row] : [],
      });

      continue;
    }

    if (row.order_item_id) {
      existing.items.push(row);
    }
  }

  return Array.from(map.values());
}

function cleanStatusFilter(value: string | null | undefined) {
  const clean = String(value || "").trim().toLowerCase();

  if (
    clean === "paid" ||
    clean === "pending" ||
    clean === "checkout_started" ||
    clean === "other"
  ) {
    return clean;
  }

  return "all";
}

function filterOrders(orders: OrderGroup[], statusFilter: string) {
  if (statusFilter === "all") return orders;

  if (statusFilter === "other") {
    return orders.filter(
      (order) =>
        order.status !== "paid" &&
        order.status !== "pending" &&
        order.status !== "checkout_started",
    );
  }

  return orders.filter((order) => order.status === statusFilter);
}

function getAddOnItems(order: OrderGroup) {
  return order.items.filter(isEventAddOnItem);
}

function getTicketItems(order: OrderGroup) {
  return order.items.filter((item) => !isEventAddOnItem(item));
}

function calculateAddOnSummary(orders: OrderGroup[]): AddOnSummary {
  return orders.reduce<AddOnSummary>(
    (summary, order) => {
      const addOnItems = getAddOnItems(order);
      const entries = addOnItems.reduce(
        (sum, item) => sum + rowQuantity(item),
        0,
      );
      const revenueCents = addOnItems.reduce(
        (sum, item) => sum + rowTotal(item),
        0,
      );

      summary.entries += entries;
      summary.revenueCents += revenueCents;

      if (order.status === "paid") {
        summary.paidEntries += entries;
        summary.paidRevenueCents += revenueCents;
      }

      return summary;
    },
    {
      entries: 0,
      revenueCents: 0,
      paidEntries: 0,
      paidRevenueCents: 0,
    },
  );
}

function calculateAddOnSummariesByType(orders: OrderGroup[]) {
  const map = new Map<string, AddOnTypeSummary>();

  for (const order of orders) {
    const addOnItems = getAddOnItems(order);
    const orderSeenKeys = new Set<string>();

    for (const item of addOnItems) {
      const key = addOnKey(item);
      const label = addOnDisplayLabel(item);
      const entries = rowQuantity(item);
      const revenueCents = rowTotal(item);

      const current =
        map.get(key) || {
          key,
          label,
          entries: 0,
          revenueCents: 0,
          paidEntries: 0,
          paidRevenueCents: 0,
          orders: 0,
          paidOrders: 0,
        };

      current.entries += entries;
      current.revenueCents += revenueCents;

      if (!orderSeenKeys.has(key)) {
        current.orders += 1;

        if (order.status === "paid") {
          current.paidOrders += 1;
        }

        orderSeenKeys.add(key);
      }

      if (order.status === "paid") {
        current.paidEntries += entries;
        current.paidRevenueCents += revenueCents;
      }

      map.set(key, current);
    }
  }

  return Array.from(map.values()).sort((a, b) =>
    a.label.localeCompare(b.label),
  );
}

async function listEventOrderDashboardRows(eventId: string) {
  return query<EventOrderDashboardRow>(
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

export default async function AdminEventOrdersPage({
  params,
  searchParams,
}: PageProps) {
  const session = await auth();

  if (!session?.user) {
    redirect("/admin/login");
  }

  const event = await getEventById(params.id);

  if (!event) {
    notFound();
  }

  const tenantSlug = await getTenantSlugFromHeaders();

  const sessionTenantSlugs = Array.isArray(session.user.tenantSlugs)
    ? session.user.tenantSlugs.map((value) => String(value))
    : [];

  if (
    !tenantSlug ||
    event.tenant_slug !== tenantSlug ||
    !sessionTenantSlugs.includes(tenantSlug)
  ) {
    redirect("/admin/login?error=tenant_access_denied");
  }

  const rows = await listEventOrderDashboardRows(event.id);
  const orders = groupOrders(rows);

  const statusFilter = cleanStatusFilter(searchParams?.status);
  const visibleOrders = filterOrders(orders, statusFilter);

  const paidOrders = orders.filter((order) => order.status === "paid");
  const pendingOrders = orders.filter((order) => order.status === "pending");
  const checkoutStartedOrders = orders.filter(
    (order) => order.status === "checkout_started",
  );

  const otherOrders = orders.filter(
    (order) =>
      order.status !== "paid" &&
      order.status !== "pending" &&
      order.status !== "checkout_started",
  );

  const grossTotal = paidOrders.reduce(
    (sum, order) => sum + Number(order.amountTotal || 0),
    0,
  );

  const totalTicketItems = orders.reduce(
    (sum, order) =>
      sum +
      getTicketItems(order).reduce(
        (itemSum, item) => itemSum + rowQuantity(item),
        0,
      ),
    0,
  );

  const paidTicketItems = paidOrders.reduce(
    (sum, order) =>
      sum +
      getTicketItems(order).reduce(
        (itemSum, item) => itemSum + rowQuantity(item),
        0,
      ),
    0,
  );

  const addOnSummary = calculateAddOnSummary(orders);
  const addOnSummariesByType = calculateAddOnSummariesByType(orders);
  const ordersWithAddOns = orders.filter(
    (order) => getAddOnItems(order).length > 0,
  );
  const paidOrdersWithAddOns = paidOrders.filter(
    (order) => getAddOnItems(order).length > 0,
  );

  const currency = event.currency || orders[0]?.currency || "GBP";
  const statusFilters = [
    {
      label: "All",
      value: "all",
      count: orders.length,
      href: `/admin/events/${event.id}/orders`,
    },
    {
      label: "Paid",
      value: "paid",
      count: paidOrders.length,
      href: `/admin/events/${event.id}/orders?status=paid`,
    },
    {
      label: "Pending",
      value: "pending",
      count: pendingOrders.length,
      href: `/admin/events/${event.id}/orders?status=pending`,
    },
    {
      label: "Checkout started",
      value: "checkout_started",
      count: checkoutStartedOrders.length,
      href: `/admin/events/${event.id}/orders?status=checkout_started`,
    },
    {
      label: "Other",
      value: "other",
      count: otherOrders.length,
      href: `/admin/events/${event.id}/orders?status=other`,
    },
  ];
    return (
    <main className="event-orders-page" style={styles.page}>
      <style>{responsiveStyles}</style>

      <section className="event-orders-hero" style={styles.hero}>
        <div>
          <div style={styles.eyebrow}>Orders & guests</div>

          <h1
            className="so-brand-heading event-orders-title"
            style={styles.title}
          >
            {event.title}
          </h1>

          <p style={styles.subtitle}>
            Read-only order dashboard for ticket purchases, guest details,
            seating, menu choices, dietary requirements and event add-ons.
          </p>

          <p style={styles.tenant}>
            Tenant: <strong>{tenantSlug}</strong>
          </p>
        </div>

        <div className="event-orders-hero-actions" style={styles.heroActions}>
          <Link href={`/admin/events/${event.id}`} style={styles.secondaryButton}>
            ← Back to event
          </Link>

          <a
            href={`/api/admin/events/${encodeURIComponent(event.id)}/orders.csv`}
            style={styles.secondaryButton}
          >
            Export CSV
          </a>

          <Link href="/admin/events" style={styles.secondaryButton}>
            All events
          </Link>
        </div>
      </section>

      <section
        className="event-orders-filter-bar"
        style={styles.filterBar}
        aria-label="Order status filters"
      >
        {statusFilters.map((filter) => {
          const active = statusFilter === filter.value;

          return (
            <Link
              key={filter.value}
              href={filter.href}
              style={{
                ...styles.filterButton,
                ...(active ? styles.filterButtonActive : {}),
              }}
            >
              {filter.label}
              <span
                style={active ? styles.filterCountActive : styles.filterCount}
              >
                {filter.count}
              </span>
            </Link>
          );
        })}
      </section>

      <section className="event-orders-summary-grid" style={styles.summaryGrid}>
        <SummaryCard label="Total orders" value={orders.length} />
        <SummaryCard label="Paid orders" value={paidOrders.length} />
        <SummaryCard
          label="Checkout started"
          value={checkoutStartedOrders.length}
        />
        <SummaryCard label="Tickets/items" value={totalTicketItems} />
        <SummaryCard label="Paid tickets/items" value={paidTicketItems} />
        <SummaryCard
          label="Paid gross"
          value={formatMoney(grossTotal, currency)}
        />
      </section>

      <section className="event-orders-addon-panel" style={styles.addOnPanel}>
        <div style={styles.addOnPanelHeader}>
          <div>
            <div style={styles.addOnEyebrow}>Event add-ons</div>
            <h2 style={styles.addOnTitle}>Event add-ons snapshot</h2>
            <p style={styles.addOnText}>
              Read-only summary of event-night add-on entries sold through
              checkout. Heads or Tails and Higher or Lower are counted
              separately when both are used on the same event.
            </p>
          </div>

          <span style={styles.addOnBadge}>
            {addOnSummary.entries > 0 ? "Add-ons recorded" : "No add-ons yet"}
          </span>
        </div>

        <div className="event-orders-addon-grid" style={styles.addOnGrid}>
          <SummaryCard label="Add-on entries" value={addOnSummary.entries} />
          <SummaryCard
            label="Paid add-on entries"
            value={addOnSummary.paidEntries}
          />
          <SummaryCard
            label="Add-on revenue"
            value={formatMoney(addOnSummary.revenueCents, currency)}
          />
          <SummaryCard
            label="Paid add-on revenue"
            value={formatMoney(addOnSummary.paidRevenueCents, currency)}
          />
          <SummaryCard
            label="Orders with add-ons"
            value={ordersWithAddOns.length}
          />
          <SummaryCard
            label="Paid orders with add-ons"
            value={paidOrdersWithAddOns.length}
          />
        </div>

        {addOnSummariesByType.length > 0 ? (
          <div
            className="event-orders-addon-type-grid"
            style={styles.addOnTypeGrid}
          >
            {addOnSummariesByType.map((summary) => (
              <div key={summary.key} style={styles.addOnTypeCard}>
                <div style={styles.addOnTypeHeader}>
                  <div>
                    <div style={styles.addOnTypeEyebrow}>Add-on type</div>
                    <h3 style={styles.addOnTypeTitle}>{summary.label}</h3>
                  </div>

                  <span style={styles.addOnTypeBadge}>
                    {formatAddOnEntryLabel(summary.paidEntries)}
                  </span>
                </div>

                <div style={styles.addOnTypeStats}>
                  <SummaryCard label="Entries" value={summary.entries} />
                  <SummaryCard
                    label="Paid entries"
                    value={summary.paidEntries}
                  />
                  <SummaryCard
                    label="Revenue"
                    value={formatMoney(summary.revenueCents, currency)}
                  />
                  <SummaryCard
                    label="Paid revenue"
                    value={formatMoney(summary.paidRevenueCents, currency)}
                  />
                  <SummaryCard label="Orders" value={summary.orders} />
                  <SummaryCard label="Paid orders" value={summary.paidOrders} />
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </section>

      <section style={styles.listHeader}>
        <div>
          <h2 style={styles.listTitle}>
            {statusFilter === "all"
              ? "All event orders"
              : `${
                  statusFilters.find((filter) => filter.value === statusFilter)
                    ?.label || "Filtered"
                } orders`}
          </h2>

          <p style={styles.listText}>
            Showing {visibleOrders.length} of {orders.length} order
            {orders.length === 1 ? "" : "s"}.
          </p>
        </div>
      </section>

      {visibleOrders.length === 0 ? (
        <section style={styles.emptyCard}>
          <h2 style={styles.emptyTitle}>No matching event orders</h2>

          <p style={styles.emptyText}>
            Try another status filter, or check back after supporters begin
            checkout or complete payment for this event.
          </p>
        </section>
      ) : (
        <section style={styles.orderList}>
          {visibleOrders.map((order) => {
            const addOnItems = getAddOnItems(order);
            const ticketItems = getTicketItems(order);
            const orderAddOnRevenue = addOnItems.reduce(
              (sum, item) => sum + rowTotal(item),
              0,
            );

            return (
              <article
                key={order.id}
                className="event-order-card"
                style={styles.orderCard}
              >
                <div className="event-order-header" style={styles.orderHeader}>
                  <div style={{ minWidth: 0 }}>
                    <h2 style={styles.orderTitle}>
                      {fallbackText(order.customerName, "Customer not provided")}
                    </h2>

                    <p style={styles.orderEmail}>
                      {fallbackText(order.customerEmail, "Email not provided")}
                    </p>

                    <p style={styles.orderMeta}>
                      {formatDate(order.createdAt)}
                      {order.stripeSessionId
                        ? ` · Stripe session ${order.stripeSessionId}`
                        : ""}
                    </p>
                  </div>

                  <div style={styles.orderStatusStack}>
                    <span
                      style={{
                        ...styles.statusPill,
                        ...statusStyle(order.status),
                      }}
                    >
                      {statusLabel(order.status)}
                    </span>

                    <strong style={styles.orderTotal}>
                      {formatMoney(order.amountTotal, order.currency)}
                    </strong>
                  </div>
                </div>

                {addOnItems.length > 0 ? (
                  <section style={styles.orderAddOnSummary}>
                    <div>
                      <div style={styles.orderAddOnEyebrow}>
                        Event add-ons included
                      </div>

                      <strong style={styles.orderAddOnTitle}>
                        {formatOrderAddOnSummary(addOnItems)}
                      </strong>

                      <p style={styles.orderAddOnText}>
                        Add-on revenue on this order:{" "}
                        <strong>
                          {formatMoney(orderAddOnRevenue, order.currency)}
                        </strong>
                      </p>
                    </div>
                  </section>
                ) : null}

                {order.items.length === 0 ? (
                  <div style={styles.noItemsBox}>
                    No order items are attached to this order.
                  </div>
                ) : (
                  <>
                    {ticketItems.length > 0 ? (
                      <div className="event-order-items" style={styles.orderItems}>
                        {ticketItems.map((item) => (
                          <OrderItemCard
                            key={item.order_item_id || `${order.id}-item`}
                            item={item}
                            order={order}
                          />
                        ))}
                      </div>
                    ) : null}

                    {addOnItems.length > 0 ? (
                      <div style={styles.addOnItemList}>
                        {addOnItems.map((item) => (
                          <div
                            key={item.order_item_id || `${order.id}-addon`}
                            style={styles.addOnItemCard}
                          >
                            <div>
                              <div style={styles.itemLabel}>Add-on</div>
                              <div style={styles.itemValue}>
                                {addOnDisplayLabel(item)}
                              </div>
                            </div>

                            <div>
                              <div style={styles.itemLabel}>Buyer</div>
                              <div style={styles.itemValue}>
                                {guestName(item, order)}
                              </div>
                              <div style={styles.itemSubValue}>
                                {guestEmail(item, order)}
                              </div>
                            </div>

                            <div>
                              <div style={styles.itemLabel}>Quantity</div>
                              <div style={styles.itemValue}>
                                {rowQuantity(item)}
                              </div>
                            </div>

                            <div>
                              <div style={styles.itemLabel}>Unit amount</div>
                              <div style={styles.itemValue}>
                                {formatMoney(item.unit_amount, order.currency)}
                              </div>
                            </div>

                            <div>
                              <div style={styles.itemLabel}>Line total</div>
                              <div style={styles.itemValue}>
                                {formatMoney(rowTotal(item), order.currency)}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </>
                )}
              </article>
            );
          })}
        </section>
      )}
    </main>
  );
}

function OrderItemCard({
  item,
  order,
}: {
  item: EventOrderDashboardRow;
  order: OrderGroup;
}) {
  return (
    <div style={styles.itemCard}>
      <div>
        <div style={styles.itemLabel}>Ticket / item</div>
        <div style={styles.itemValue}>{ticketLabel(item)}</div>
      </div>

      <div>
        <div style={styles.itemLabel}>Guest</div>
        <div style={styles.itemValue}>{guestName(item, order)}</div>
        <div style={styles.itemSubValue}>{guestEmail(item, order)}</div>
      </div>

      <div>
        <div style={styles.itemLabel}>Seat / table</div>
        <div style={styles.itemValue}>{seatLabel(item)}</div>
        {item.seat_purpose ? (
          <div style={styles.itemSubValue}>Purpose: {item.seat_purpose}</div>
        ) : null}
      </div>

      <div>
        <div style={styles.itemLabel}>Quantity</div>
        <div style={styles.itemValue}>{rowQuantity(item)}</div>
      </div>

      <div>
        <div style={styles.itemLabel}>Unit amount</div>
        <div style={styles.itemValue}>
          {formatMoney(item.unit_amount, order.currency)}
        </div>
      </div>

      <div>
        <div style={styles.itemLabel}>Menu</div>
        <div style={styles.itemValue}>{fallbackText(item.menu_choice)}</div>
      </div>

      <div className="event-order-dietary" style={styles.dietaryCell}>
        <div style={styles.itemLabel}>Dietary</div>
        <div style={styles.itemValue}>
          {fallbackText(item.dietary_requirements)}
        </div>
      </div>
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="event-orders-summary-card" style={styles.summaryCard}>
      <div style={styles.summaryLabel}>{label}</div>
      <div className="event-orders-summary-value" style={styles.summaryValue}>
        {value}
      </div>
    </div>
  );
}
const responsiveStyles = `
.event-orders-page,
.event-orders-page * {
  box-sizing: border-box;
}

.event-orders-page {
  overflow-x: hidden;
}

.event-orders-page section,
.event-orders-page article,
.event-orders-page div,
.event-orders-page a {
  min-width: 0;
}

@media (max-width: 860px) {
  .event-orders-hero {
    grid-template-columns: 1fr !important;
  }

  .event-orders-hero-actions {
    justify-content: stretch !important;
  }

  .event-orders-hero-actions a {
    width: 100% !important;
  }

  .event-orders-summary-grid,
  .event-orders-addon-grid,
  .event-orders-addon-type-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
  }

  .event-order-header {
    grid-template-columns: 1fr !important;
  }

  .event-order-items {
    grid-template-columns: 1fr !important;
  }
}

@media (max-width: 640px) {
  .event-orders-filter-bar {
    display: grid !important;
    grid-template-columns: 1fr !important;
  }

  .event-orders-filter-bar a {
    width: 100% !important;
    justify-content: space-between !important;
  }

  .event-orders-addon-panel {
    padding: 15px !important;
    border-radius: 22px !important;
  }
}

@media (max-width: 560px) {
  .event-orders-page {
    padding: 18px 12px 44px !important;
  }

  .event-orders-hero {
    padding: 20px !important;
    border-radius: 26px !important;
  }

  .event-orders-title {
    font-size: clamp(36px, 11vw, 50px) !important;
    line-height: 0.98 !important;
  }

  .event-orders-summary-grid,
  .event-orders-addon-grid,
  .event-orders-addon-type-grid {
    grid-template-columns: 1fr !important;
  }

  .event-order-card {
    padding: 15px !important;
    border-radius: 22px !important;
  }

  .event-orders-summary-value {
    font-size: 28px !important;
  }

  .event-order-dietary {
    grid-column: auto !important;
  }
}
`;

const styles: Record<string, CSSProperties> = {
  page: {
    width: "100%",
    maxWidth: 1180,
    margin: "0 auto",
    padding: "28px 16px 56px",
    minHeight: "100vh",
    background:
      "radial-gradient(circle at top left, rgba(22,131,248,0.08), transparent 32%), radial-gradient(circle at top right, rgba(15,23,42,0.05), transparent 34%), #f8fafc",
    overflowX: "hidden",
  },

  hero: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) auto",
    gap: 18,
    alignItems: "start",
    padding: 28,
    borderRadius: 32,
    background:
      "radial-gradient(circle at bottom right, rgba(37,99,235,0.20), transparent 38%), linear-gradient(135deg, #020617 0%, #0f172a 55%, #172554 100%)",
    color: "#ffffff",
    marginBottom: 18,
    boxShadow: "0 28px 70px rgba(15,23,42,0.22)",
    border: "1px solid rgba(148,163,184,0.22)",
  },

  eyebrow: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "8px 14px",
    borderRadius: 999,
    background: "rgba(15,23,42,0.24)",
    color: "#facc15",
    border: "1px solid rgba(250,204,21,0.76)",
    fontSize: 12,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    marginBottom: 14,
  },

  title: {
    margin: 0,
    fontSize: "clamp(46px, 7vw, 72px)",
    lineHeight: 0.94,
    letterSpacing: "-0.075em",
    color: "#ffffff",
    overflowWrap: "anywhere",
  },

  subtitle: {
    margin: "16px 0 0",
    maxWidth: 780,
    color: "#dbeafe",
    fontSize: 17,
    lineHeight: 1.6,
    fontWeight: 750,
  },

  tenant: {
    margin: "14px 0 0",
    color: "#bfdbfe",
    fontSize: 14,
    fontWeight: 850,
    overflowWrap: "anywhere",
  },

  heroActions: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
    justifyContent: "flex-end",
  },

  secondaryButton: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 44,
    padding: "10px 14px",
    borderRadius: 999,
    background: "rgba(255,255,255,0.08)",
    color: "#ffffff",
    border: "1px solid rgba(148,163,184,0.52)",
    textDecoration: "none",
    fontWeight: 900,
    textAlign: "center",
  },

  filterBar: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "flex-start",
    padding: 0,
    marginBottom: 18,
  },

  filterButton: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    minHeight: 44,
    padding: "10px 14px",
    borderRadius: 999,
    background: "#ffffff",
    color: "#334155",
    border: "1px solid #cbd5e1",
    textDecoration: "none",
    fontWeight: 950,
    fontSize: 14,
    boxShadow: "0 2px 8px rgba(15,23,42,0.04)",
    whiteSpace: "nowrap",
  },

  filterButtonActive: {
    background: "#0f172a",
    color: "#ffffff",
    borderColor: "#0f172a",
    boxShadow: "0 10px 22px rgba(15,23,42,0.14)",
  },

  filterCount: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minWidth: 24,
    height: 24,
    padding: "0 7px",
    borderRadius: 999,
    background: "#f1f5f9",
    color: "#475569",
    border: "1px solid #e2e8f0",
    fontSize: 12,
    fontWeight: 950,
  },

  filterCountActive: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minWidth: 24,
    height: 24,
    padding: "0 7px",
    borderRadius: 999,
    background: "rgba(255,255,255,0.14)",
    color: "#ffffff",
    border: "1px solid rgba(255,255,255,0.28)",
    fontSize: 12,
    fontWeight: 950,
  },

  summaryGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
    gap: 12,
    marginBottom: 18,
  },

  summaryCard: {
    padding: 16,
    borderRadius: 18,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    borderTop: "4px solid #1683f8",
    boxShadow: "0 2px 12px rgba(15,23,42,0.04)",
  },

  summaryLabel: {
    color: "#64748b",
    fontSize: 13,
    fontWeight: 850,
  },

  summaryValue: {
    color: "#0f172a",
    fontSize: 30,
    fontWeight: 950,
    marginTop: 5,
    letterSpacing: "-0.04em",
    overflowWrap: "anywhere",
  },

  addOnPanel: {
    display: "grid",
    gap: 16,
    padding: 18,
    borderRadius: 26,
    background:
      "radial-gradient(circle at top left, rgba(250,204,21,0.16), transparent 34%), linear-gradient(135deg, #0f172a 0%, #1e293b 58%, #020617 100%)",
    color: "#ffffff",
    border: "1px solid rgba(250,204,21,0.32)",
    boxShadow: "0 18px 48px rgba(15,23,42,0.16)",
    marginBottom: 18,
    overflow: "hidden",
  },

  addOnPanelHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: 14,
    alignItems: "flex-start",
    flexWrap: "wrap",
  },

  addOnEyebrow: {
    color: "#facc15",
    fontSize: 12,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    marginBottom: 6,
  },

  addOnTitle: {
    margin: 0,
    color: "#ffffff",
    fontSize: "clamp(26px, 5vw, 34px)",
    lineHeight: 1,
    letterSpacing: "-0.05em",
  },

  addOnText: {
    margin: "8px 0 0",
    color: "#cbd5e1",
    fontSize: 14,
    lineHeight: 1.5,
    maxWidth: 760,
    fontWeight: 750,
  },

  addOnBadge: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "8px 12px",
    borderRadius: 999,
    background: "rgba(250,204,21,0.14)",
    color: "#fef3c7",
    border: "1px solid rgba(250,204,21,0.36)",
    fontSize: 12,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.05em",
  },

  addOnGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
    gap: 12,
  },

  addOnTypeGrid: {
    display: "grid",
    gap: 12,
  },

  addOnTypeCard: {
    display: "grid",
    gap: 12,
    padding: 14,
    borderRadius: 20,
    background: "rgba(255,255,255,0.08)",
    border: "1px solid rgba(250,204,21,0.22)",
  },

  addOnTypeHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "flex-start",
    flexWrap: "wrap",
  },

  addOnTypeEyebrow: {
    color: "#facc15",
    fontSize: 11,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    marginBottom: 5,
  },

  addOnTypeTitle: {
    margin: 0,
    color: "#ffffff",
    fontSize: 22,
    lineHeight: 1.05,
    letterSpacing: "-0.04em",
  },

  addOnTypeBadge: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "8px 12px",
    borderRadius: 999,
    background: "rgba(250,204,21,0.14)",
    color: "#fef3c7",
    border: "1px solid rgba(250,204,21,0.36)",
    fontSize: 12,
    fontWeight: 950,
  },

  addOnTypeStats: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(145px, 1fr))",
    gap: 10,
  },

  listHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "flex-end",
    padding: "0 2px",
    marginBottom: 12,
    flexWrap: "wrap",
  },

  listTitle: {
    margin: 0,
    color: "#0f172a",
    fontSize: 26,
    letterSpacing: "-0.05em",
  },

  listText: {
    margin: "5px 0 0",
    color: "#64748b",
    fontSize: 14,
    fontWeight: 800,
  },

  emptyCard: {
    padding: 26,
    borderRadius: 24,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    boxShadow: "0 2px 12px rgba(15,23,42,0.04)",
  },

  emptyTitle: {
    margin: 0,
    color: "#0f172a",
    fontSize: 24,
    letterSpacing: "-0.04em",
  },

  emptyText: {
    margin: "8px 0 0",
    color: "#64748b",
    lineHeight: 1.55,
    fontWeight: 750,
  },

  orderList: {
    display: "grid",
    gap: 14,
  },

  orderCard: {
    padding: 18,
    borderRadius: 26,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    boxShadow: "0 8px 30px rgba(15,23,42,0.05)",
    overflow: "hidden",
  },

  orderHeader: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) auto",
    gap: 14,
    alignItems: "start",
    marginBottom: 14,
  },

  orderTitle: {
    margin: 0,
    color: "#0f172a",
    fontSize: 24,
    letterSpacing: "-0.04em",
    overflowWrap: "anywhere",
  },

  orderEmail: {
    margin: "4px 0 0",
    color: "#334155",
    fontSize: 14,
    fontWeight: 850,
    overflowWrap: "anywhere",
  },

  orderMeta: {
    margin: "6px 0 0",
    color: "#64748b",
    fontSize: 13,
    lineHeight: 1.45,
    overflowWrap: "anywhere",
  },

  orderStatusStack: {
    display: "grid",
    gap: 8,
    justifyItems: "end",
  },

  statusPill: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: "fit-content",
    padding: "8px 12px",
    borderRadius: 999,
    border: "1px solid",
    fontSize: 13,
    fontWeight: 950,
    textTransform: "capitalize",
  },

  orderTotal: {
    color: "#0f172a",
    fontSize: 22,
    letterSpacing: "-0.035em",
  },

  orderAddOnSummary: {
    marginBottom: 14,
    padding: 14,
    borderRadius: 18,
    background:
      "linear-gradient(135deg, rgba(250,204,21,0.18), rgba(255,255,255,0.94))",
    border: "1px solid rgba(250,204,21,0.38)",
  },

  orderAddOnEyebrow: {
    color: "#92400e",
    fontSize: 11,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    marginBottom: 5,
  },

  orderAddOnTitle: {
    display: "block",
    color: "#0f172a",
    fontSize: 18,
    fontWeight: 950,
    letterSpacing: "-0.03em",
  },

  orderAddOnText: {
    margin: "5px 0 0",
    color: "#475569",
    fontSize: 13,
    fontWeight: 800,
  },

  noItemsBox: {
    padding: 14,
    borderRadius: 16,
    background: "#f8fafc",
    border: "1px dashed #cbd5e1",
    color: "#64748b",
    fontWeight: 850,
  },

  orderItems: {
    display: "grid",
    gap: 10,
  },

  itemCard: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 145px), 1fr))",
    gap: 10,
    padding: 14,
    borderRadius: 18,
    background:
      "linear-gradient(135deg, #f8fafc 0%, #ffffff 55%, #eff6ff 100%)",
    border: "1px solid #e2e8f0",
  },

  addOnItemList: {
    display: "grid",
    gap: 10,
    marginTop: 10,
  },

  addOnItemCard: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 145px), 1fr))",
    gap: 10,
    padding: 14,
    borderRadius: 18,
    background:
      "linear-gradient(135deg, #fffbeb 0%, #ffffff 56%, #eff6ff 100%)",
    border: "1px solid #fde68a",
  },

  dietaryCell: {
    gridColumn: "span 2",
  },

  itemLabel: {
    color: "#64748b",
    fontSize: 11,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    marginBottom: 5,
  },

  itemValue: {
    color: "#0f172a",
    fontSize: 14,
    fontWeight: 900,
    lineHeight: 1.35,
    overflowWrap: "anywhere",
    whiteSpace: "pre-wrap",
  },

  itemSubValue: {
    marginTop: 4,
    color: "#64748b",
    fontSize: 12,
    fontWeight: 750,
    overflowWrap: "anywhere",
  },
};
