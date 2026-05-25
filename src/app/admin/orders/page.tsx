import type { CSSProperties, ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { query } from "@/lib/db";
import { getTenantSlugFromHeaders } from "@/lib/tenant";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type PageProps = {
  searchParams?: Promise<{
    type?: string;
    q?: string;
  }>;
};

type UnifiedOrder = {
  id: string;
  type: "raffle" | "squares" | "event" | "auction";
  campaignId: string | null;
  campaignTitle: string;
  campaignSlug: string | null;
  customerName: string;
  customerEmail: string;
  detail: string;
  amountCents: number;
  currency: string;
  status: string;
  createdAt: string | null;
  adminHref: string | null;
  publicHref: string | null;
};

type RawRow = Record<string, any>;

function cleanText(value: unknown, fallback = "") {
  const clean = String(value ?? "").trim();
  return clean || fallback;
}

function safeNumber(value: unknown, fallback = 0) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return number;
}

function formatMoney(cents: number, currency = "GBP") {
  try {
    return new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency: currency || "GBP",
    }).format(Number(cents || 0) / 100);
  } catch {
    return `£${(Number(cents || 0) / 100).toFixed(2)}`;
  }
}

function formatDate(value: string | null) {
  if (!value) return "Unknown";

  try {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "Unknown";

    return new Intl.DateTimeFormat("en-GB", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(date);
  } catch {
    return "Unknown";
  }
}

function activityTime(value: string | null) {
  if (!value) return 0;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : 0;
}

function typeLabel(type: UnifiedOrder["type"]) {
  if (type === "raffle") return "Raffle";
  if (type === "squares") return "Squares";
  if (type === "event") return "Event";
  return "Auction";
}

function typeStyle(type: UnifiedOrder["type"]): CSSProperties {
  if (type === "raffle") {
    return {
      background: "#eff6ff",
      color: "#1d4ed8",
      border: "1px solid #bfdbfe",
    };
  }

  if (type === "squares") {
    return {
      background: "#ecfdf5",
      color: "#166534",
      border: "1px solid #bbf7d0",
    };
  }

  if (type === "event") {
    return {
      background: "#fef3c7",
      color: "#92400e",
      border: "1px solid #fde68a",
    };
  }

  return {
    background: "#f5f3ff",
    color: "#6d28d9",
    border: "1px solid #ddd6fe",
  };
}

function statusStyle(status: string): CSSProperties {
  const clean = status.toLowerCase();

  if (
    clean.includes("paid") ||
    clean.includes("complete") ||
    clean.includes("success") ||
    clean.includes("sold") ||
    clean.includes("placed")
  ) {
    return {
      background: "#dcfce7",
      color: "#166534",
      border: "1px solid #bbf7d0",
    };
  }

  if (
    clean.includes("reserved") ||
    clean.includes("pending") ||
    clean.includes("checkout") ||
    clean.includes("open")
  ) {
    return {
      background: "#fef3c7",
      color: "#92400e",
      border: "1px solid #fde68a",
    };
  }

  if (
    clean.includes("cancel") ||
    clean.includes("failed") ||
    clean.includes("refund")
  ) {
    return {
      background: "#fee2e2",
      color: "#991b1b",
      border: "1px solid #fecaca",
    };
  }

  return {
    background: "#f8fafc",
    color: "#475569",
    border: "1px solid #e2e8f0",
  };
}

function auctionPaymentStatusLabel(value: unknown) {
  const clean = String(value || "unpaid").trim().toLowerCase();

  if (clean === "paid") return "Paid";
  if (clean === "checkout_started") return "Checkout started";
  if (clean === "cancelled") return "Cancelled";

  return "Bid placed";
}

async function safeQuery<T extends RawRow>(
  label: string,
  sql: string,
  values: unknown[],
): Promise<T[]> {
  try {
    return await query<T>(sql, values);
  } catch (error) {
    console.error(`Admin orders ${label} query failed:`, error);
    return [];
  }
}

async function getRaffleOrders(tenantSlug: string): Promise<UnifiedOrder[]> {
  const rows = await safeQuery(
    "raffles",
    `
      select
        sale.id,
        sale.raffle_id,
        sale.ticket_number,
        sale.colour,
        sale.buyer_name,
        sale.buyer_email,
        sale.sold_at as created_at,
        raffle.title as campaign_title,
        raffle.slug as campaign_slug,
        raffle.currency,
        raffle.ticket_price_cents
      from raffle_ticket_sales sale
      join raffles raffle
        on raffle.id = sale.raffle_id
      where raffle.tenant_slug = $1
      order by sale.sold_at desc
      limit 500
    `,
    [tenantSlug],
  );

  return rows.map((row) => {
    const campaignId = cleanText(row.raffle_id);
    const slug = cleanText(row.campaign_slug);

    return {
      id: `raffle-${cleanText(row.id, `${campaignId}-${row.ticket_number}`)}`,
      type: "raffle",
      campaignId: campaignId || null,
      campaignTitle: cleanText(row.campaign_title, "Untitled raffle"),
      campaignSlug: slug || null,
      customerName: cleanText(row.buyer_name, "Supporter"),
      customerEmail: cleanText(row.buyer_email, "No email"),
      detail: `Ticket #${cleanText(row.ticket_number, "—")}${
        row.colour ? ` · ${row.colour}` : ""
      }`,
      amountCents: safeNumber(row.ticket_price_cents, 0),
      currency: cleanText(row.currency, "GBP"),
      status: "Sold",
      createdAt: row.created_at ? String(row.created_at) : null,
      adminHref: campaignId ? `/admin/raffles/${campaignId}` : null,
      publicHref: slug ? `/r/${slug}` : null,
    };
  });
}

async function getSquaresOrders(tenantSlug: string): Promise<UnifiedOrder[]> {
  const rows = await safeQuery(
    "squares",
    `
      select
        sale.id,
        sale.game_id,
        sale.customer_name,
        sale.customer_email,
        sale.squares,
        sale.payment_status,
        sale.currency as sale_currency,
        sale.gross_amount_cents,
        sale.created_at,
        game.title as campaign_title,
        game.slug as campaign_slug,
        game.currency as game_currency,
        game.price_per_square_cents
      from squares_sales sale
      join squares_games game
        on game.id = sale.game_id
       and game.tenant_slug = sale.tenant_slug
      where sale.tenant_slug = $1
        and game.tenant_slug = $1
      order by sale.created_at desc
      limit 500
    `,
    [tenantSlug],
  );

  return rows.map((row) => {
    const campaignId = cleanText(row.game_id);
    const slug = cleanText(row.campaign_slug);
    const squares = Array.isArray(row.squares)
      ? row.squares.join(", ")
      : cleanText(row.squares);

    const squareCount = Array.isArray(row.squares)
      ? row.squares.length
      : squares
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean).length;

    const fallbackAmount =
      safeNumber(row.price_per_square_cents, 0) * Math.max(squareCount, 1);

    return {
      id: `squares-${cleanText(row.id, `${campaignId}-${squares}`)}`,
      type: "squares",
      campaignId: campaignId || null,
      campaignTitle: cleanText(row.campaign_title, "Untitled squares game"),
      campaignSlug: slug || null,
      customerName: cleanText(row.customer_name, "Supporter"),
      customerEmail: cleanText(row.customer_email, "No email"),
      detail: squares ? `Squares ${squares}` : "Squares order",
      amountCents: safeNumber(row.gross_amount_cents, 0) || fallbackAmount,
      currency:
        cleanText(row.sale_currency) || cleanText(row.game_currency, "GBP"),
      status: cleanText(row.payment_status, "Sold"),
      createdAt: row.created_at ? String(row.created_at) : null,
      adminHref: campaignId ? `/admin/squares/${campaignId}` : null,
      publicHref: slug ? `/s/${slug}` : null,
    };
  });
}
async function getEventOrders(tenantSlug: string): Promise<UnifiedOrder[]> {
  const rows = await safeQuery(
    "events",
    `
      select
        event_order.id,
        event_order.event_id,
        event_order.customer_name,
        event_order.customer_email,
        event_order.amount_total,
        event_order.currency as order_currency,
        event_order.status,
        event_order.created_at,
        event.title as campaign_title,
        event.slug as campaign_slug,
        event.currency as event_currency
      from event_orders event_order
      join events event
        on event.id = event_order.event_id
       and event.tenant_slug = event_order.tenant_slug
      where event_order.tenant_slug = $1
        and event.tenant_slug = $1
      order by event_order.created_at desc
      limit 500
    `,
    [tenantSlug],
  );

  return rows.map((row) => {
    const campaignId = cleanText(row.event_id);
    const slug = cleanText(row.campaign_slug);

    return {
      id: `event-${cleanText(row.id, campaignId)}`,
      type: "event",
      campaignId: campaignId || null,
      campaignTitle: cleanText(row.campaign_title, "Untitled event"),
      campaignSlug: slug || null,
      customerName: cleanText(row.customer_name, "Ticket buyer"),
      customerEmail: cleanText(row.customer_email, "No email"),
      detail: "Event ticket order",
      amountCents: safeNumber(row.amount_total, 0),
      currency:
        cleanText(row.order_currency) || cleanText(row.event_currency, "GBP"),
      status: cleanText(row.status, "Paid"),
      createdAt: row.created_at ? String(row.created_at) : null,
      adminHref: campaignId ? `/admin/events/${campaignId}` : null,
      publicHref: slug ? `/e/${slug}` : null,
    };
  });
}

async function getAuctionOrders(tenantSlug: string): Promise<UnifiedOrder[]> {
  const rows = await safeQuery(
    "auctions",
    `
      select
        bid.id,
        bid.item_id,
        bid.bidder_name,
        bid.bidder_email,
        bid.amount_cents,
        bid.payment_status,
        bid.paid_at,
        bid.created_at,
        item.auction_id,
        item.title as item_title,
        auction.title as campaign_title,
        auction.slug as campaign_slug,
        auction.currency
      from silent_auction_bids bid
      join silent_auction_items item
        on item.id = bid.item_id
      join silent_auctions auction
        on auction.id = item.auction_id
      where auction.tenant_slug = $1
      order by bid.created_at desc
      limit 500
    `,
    [tenantSlug],
  );

  return rows.map((row) => {
    const campaignId = cleanText(row.auction_id);
    const slug = cleanText(row.campaign_slug);
    const status = auctionPaymentStatusLabel(row.payment_status);

    return {
      id: `auction-${cleanText(row.id, `${campaignId}-${row.item_id}`)}`,
      type: "auction",
      campaignId: campaignId || null,
      campaignTitle: cleanText(row.campaign_title, "Untitled auction"),
      campaignSlug: slug || null,
      customerName: cleanText(row.bidder_name, "Bidder"),
      customerEmail: cleanText(row.bidder_email, "No email"),
      detail: `Bid · ${cleanText(row.item_title, "Auction item")}`,
      amountCents: safeNumber(row.amount_cents, 0),
      currency: cleanText(row.currency, "GBP"),
      status,
      createdAt: row.created_at ? String(row.created_at) : null,
      adminHref: campaignId ? `/admin/auctions/${campaignId}` : null,
      publicHref: slug ? `/a/${slug}` : null,
    };
  });
}

function filterOrders(
  orders: UnifiedOrder[],
  typeFilter: string,
  searchTerm: string,
) {
  const cleanType = typeFilter.trim().toLowerCase();
  const cleanSearch = searchTerm.trim().toLowerCase();

  return orders.filter((order) => {
    const typeMatch =
      !cleanType || cleanType === "all" || order.type === cleanType;

    const searchMatch =
      !cleanSearch ||
      [
        order.campaignTitle,
        order.customerName,
        order.customerEmail,
        order.detail,
        order.status,
        order.currency,
      ]
        .join(" ")
        .toLowerCase()
        .includes(cleanSearch);

    return typeMatch && searchMatch;
  });
}

function toCsvValue(value: unknown) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

function buildCsvHref(orders: UnifiedOrder[]) {
  const headers = [
    "Type",
    "Campaign",
    "Customer name",
    "Customer email",
    "Detail",
    "Amount",
    "Currency",
    "Status",
    "Created",
  ];

  const rows = orders.map((order) => [
    typeLabel(order.type),
    order.campaignTitle,
    order.customerName,
    order.customerEmail,
    order.detail,
    (order.amountCents / 100).toFixed(2),
    order.currency,
    order.status,
    formatDate(order.createdAt),
  ]);

  const csv = [headers, ...rows]
    .map((row) => row.map(toCsvValue).join(","))
    .join("\n");

  return `data:text/csv;charset=utf-8,${encodeURIComponent(csv)}`;
}

function EventOrdersGuestsLink({ order }: { order: UnifiedOrder }) {
  if (order.type !== "event" || !order.campaignId) {
    return null;
  }

  return (
    <Link
      href={`/admin/events/${encodeURIComponent(order.campaignId)}/orders`}
      style={styles.smallLink}
    >
      Orders &amp; Guests
    </Link>
  );
}

function AdminLink({ order, label }: { order: UnifiedOrder; label: string }) {
  if (!order.adminHref) {
    return null;
  }

  return (
    <Link
      href={order.adminHref}
      style={
        order.type === "event" && order.campaignId
          ? styles.smallLinkMuted
          : styles.smallLink
      }
    >
      {label}
    </Link>
  );
}

export default async function AdminOrdersPage({ searchParams }: PageProps) {
  const session = await auth();

  if (!session?.user) {
    redirect("/admin/login");
  }

  const tenantSlug = await getTenantSlugFromHeaders();

  const sessionTenantSlugs = Array.isArray(session.user.tenantSlugs)
    ? session.user.tenantSlugs.map((value) => String(value))
    : [];

  if (!tenantSlug || !sessionTenantSlugs.includes(tenantSlug)) {
    redirect("/admin/login?error=tenant_access_denied");
  }

  const resolvedSearchParams = searchParams ? await searchParams : {};
  const selectedType = cleanText(resolvedSearchParams.type, "all");
  const searchTerm = cleanText(resolvedSearchParams.q, "");

  const [raffleOrders, squaresOrders, eventOrders, auctionOrders] =
    await Promise.all([
      getRaffleOrders(tenantSlug),
      getSquaresOrders(tenantSlug),
      getEventOrders(tenantSlug),
      getAuctionOrders(tenantSlug),
    ]);

  const allOrders = [
    ...raffleOrders,
    ...squaresOrders,
    ...eventOrders,
    ...auctionOrders,
  ].sort((a, b) => activityTime(b.createdAt) - activityTime(a.createdAt));

  const filteredOrders = filterOrders(allOrders, selectedType, searchTerm);

  const totalRevenue = filteredOrders.reduce(
    (sum, order) => sum + Number(order.amountCents || 0),
    0,
  );

  const uniqueCustomers = new Set(
    filteredOrders
      .map((order) => order.customerEmail.toLowerCase())
      .filter((email) => email && email !== "no email"),
  ).size;

  const csvHref = buildCsvHref(filteredOrders);

  return (
    <main className="orders-page" style={styles.page}>
      <style>{responsiveStyles}</style>

      <section className="hero" style={styles.hero}>
        <div style={styles.heroGlow} />

        <div className="heroMainGrid" style={styles.heroMainGrid}>
          <div style={styles.heroContent}>
            <div style={styles.eyebrow}>Platform operations</div>

            <h1 className="so-brand-heading title" style={styles.title}>
              Orders dashboard
            </h1>

            <p style={styles.subtitle}>
              Unified activity across raffles, squares, events and auctions for
              this tenant.
            </p>

            <div className="heroStats" style={styles.heroStats}>
              <HeroStat label="Orders" value={filteredOrders.length} />
              <HeroStat
                label="Revenue"
                value={formatMoney(totalRevenue, "GBP")}
              />
              <HeroStat label="Customers" value={uniqueCustomers} />
              <HeroStat label="Tenant" value={tenantSlug} />
            </div>
          </div>

          <div style={styles.heroPanel}>
            <div style={styles.heroPanelTitle}>Operational view</div>

            <p style={styles.heroPanelText}>
              Search supporters, review campaign activity, open the source
              campaign, and export the current view as CSV.
            </p>

            <div className="heroPanelGrid" style={styles.heroPanelGrid}>
              <MiniMetric label="Raffles" value={raffleOrders.length} />
              <MiniMetric label="Squares" value={squaresOrders.length} />
              <MiniMetric label="Events" value={eventOrders.length} />
              <MiniMetric label="Auctions" value={auctionOrders.length} />
            </div>
          </div>
        </div>

        <div className="heroActions" style={styles.heroActions}>
          <Link
            href="/admin"
            className="secondaryButton heroSecondaryButton"
            style={styles.heroSecondaryButton}
          >
            ← Back to dashboard
          </Link>

          <a
            href={csvHref}
            download={`orders-${tenantSlug}.csv`}
            className="primaryButton heroPrimaryButton"
            style={styles.heroPrimaryButton}
          >
            Export CSV
          </a>
        </div>
      </section>
            <section className="summaryGrid" style={styles.summaryGrid}>
        <SummaryCard label="Visible orders" value={filteredOrders.length} />
        <SummaryCard label="All orders" value={allOrders.length} />
        <SummaryCard label="Unique customers" value={uniqueCustomers} />
        <SummaryCard label="Raffle rows" value={raffleOrders.length} />
        <SummaryCard label="Squares rows" value={squaresOrders.length} />
        <SummaryCard label="Event rows" value={eventOrders.length} />
        <SummaryCard label="Auction bids" value={auctionOrders.length} />
      </section>

      <section style={styles.filterCard}>
        <form
          action="/admin/orders"
          className="filterForm"
          style={styles.filterForm}
        >
          <label style={styles.field}>
            <span style={styles.label}>Search</span>
            <input
              name="q"
              defaultValue={searchTerm}
              placeholder="Search customer, email, campaign, item..."
              style={styles.input}
            />
          </label>

          <label style={styles.field}>
            <span style={styles.label}>Type</span>
            <select name="type" defaultValue={selectedType} style={styles.input}>
              <option value="all">All activity</option>
              <option value="raffle">Raffles</option>
              <option value="squares">Squares</option>
              <option value="event">Events</option>
              <option value="auction">Auctions</option>
            </select>
          </label>

          <button
            type="submit"
            className="filterButton"
            style={styles.filterButton}
          >
            Apply filters
          </button>

          <Link
            href="/admin/orders"
            className="clearButton"
            style={styles.clearButton}
          >
            Clear
          </Link>
        </form>
      </section>

      <section className="ordersCard" style={styles.ordersCard}>
        <div style={styles.sectionHeader}>
          <div>
            <p style={styles.kicker}>Unified orders</p>

            <h2 className="so-brand-card-title" style={styles.sectionTitle}>
              Latest activity
            </h2>

            <p style={styles.sectionText}>
              This page reads from raffle ticket sales, squares sales, event
              orders and silent auction bids.
            </p>
          </div>

          <span style={styles.countPill}>{filteredOrders.length} rows</span>
        </div>

        {filteredOrders.length === 0 ? (
          <div style={styles.emptyBox}>
            No matching orders found yet. Once orders, bids or ticket sales are
            recorded, they will appear here.
          </div>
        ) : (
          <>
            <div className="desktopTableWrap" style={styles.tableWrap}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Type</th>
                    <th style={styles.th}>Campaign</th>
                    <th style={styles.th}>Customer</th>
                    <th style={styles.th}>Detail</th>
                    <th style={styles.th}>Amount</th>
                    <th style={styles.th}>Status</th>
                    <th style={styles.th}>Created</th>
                    <th style={styles.th}>Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredOrders.map((order) => (
                    <tr key={order.id}>
                      <td style={styles.td}>
                        <span
                          style={{
                            ...styles.typePill,
                            ...typeStyle(order.type),
                          }}
                        >
                          {typeLabel(order.type)}
                        </span>
                      </td>

                      <td style={styles.td}>
                        <strong style={styles.primaryText}>
                          {order.campaignTitle}
                        </strong>
                      </td>

                      <td style={styles.td}>
                        <div style={styles.primaryText}>{order.customerName}</div>
                        <div style={styles.secondaryText}>
                          {order.customerEmail}
                        </div>
                      </td>

                      <td style={styles.td}>
                        <span style={styles.secondaryText}>{order.detail}</span>
                      </td>

                      <td style={styles.td}>
                        <strong style={styles.primaryText}>
                          {formatMoney(order.amountCents, order.currency)}
                        </strong>
                      </td>

                      <td style={styles.td}>
                        <span
                          style={{
                            ...styles.statusPill,
                            ...statusStyle(order.status),
                          }}
                        >
                          {order.status}
                        </span>
                      </td>

                      <td style={styles.td}>
                        <span style={styles.secondaryText}>
                          {formatDate(order.createdAt)}
                        </span>
                      </td>

                      <td style={styles.td}>
                        <div style={styles.actionLinks}>
                          <EventOrdersGuestsLink order={order} />

                          <AdminLink order={order} label="Admin" />

                          {order.publicHref ? (
                            <Link
                              href={order.publicHref}
                              target="_blank"
                              style={styles.smallLinkMuted}
                            >
                              Public
                            </Link>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mobileCards" style={styles.mobileCards}>
              {filteredOrders.map((order) => (
                <article key={order.id} style={styles.mobileOrderCard}>
                  <div style={styles.mobileCardTop}>
                    <span
                      style={{ ...styles.typePill, ...typeStyle(order.type) }}
                    >
                      {typeLabel(order.type)}
                    </span>

                    <span
                      style={{
                        ...styles.statusPill,
                        ...statusStyle(order.status),
                      }}
                    >
                      {order.status}
                    </span>
                  </div>

                  <h3 style={styles.mobileTitle}>{order.campaignTitle}</h3>

                  <div style={styles.mobileMeta}>
                    <strong>{order.customerName}</strong>
                    <span>{order.customerEmail}</span>
                  </div>

                  <div style={styles.mobileDetail}>{order.detail}</div>

                  <div style={styles.mobileBottom}>
                    <strong>
                      {formatMoney(order.amountCents, order.currency)}
                    </strong>
                    <span>{formatDate(order.createdAt)}</span>
                  </div>

                  <div style={styles.mobileActions}>
                    <EventOrdersGuestsLink order={order} />

                    <AdminLink order={order} label="Open admin" />

                    {order.publicHref ? (
                      <Link
                        href={order.publicHref}
                        target="_blank"
                        style={styles.smallLinkMuted}
                      >
                        Public page
                      </Link>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
          </>
        )}
      </section>
    </main>
  );
}

function HeroStat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div style={styles.heroStat}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function MiniMetric({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div style={styles.miniMetric}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div style={styles.summaryCard}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

const responsiveStyles = `
.orders-page,
.orders-page * {
  box-sizing: border-box;
}

.orders-page {
  overflow-x: hidden;
}

.orders-page section,
.orders-page form,
.orders-page div,
.orders-page label,
.orders-page article {
  min-width: 0;
}

.orders-page .mobileCards {
  display: none;
}

@media (max-width: 980px) {
  .orders-page .heroMainGrid,
  .orders-page .filterForm {
    grid-template-columns: 1fr !important;
  }

  .orders-page .heroStats,
  .orders-page .summaryGrid {
    grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
  }

  .orders-page .desktopTableWrap {
    display: none !important;
  }

  .orders-page .mobileCards {
    display: grid !important;
  }

  .orders-page .heroActions,
  .orders-page .mobileActions {
    display: grid !important;
    grid-template-columns: 1fr !important;
    align-items: stretch !important;
  }

  .orders-page .heroPrimaryButton,
  .orders-page .heroSecondaryButton,
  .orders-page .filterButton,
  .orders-page .clearButton,
  .orders-page .smallLink,
  .orders-page .smallLinkMuted {
    width: 100% !important;
    justify-content: center !important;
    text-align: center !important;
  }
}

@media (max-width: 620px) {
  .orders-page {
    width: 100% !important;
    max-width: 100% !important;
    padding: 14px 10px 42px !important;
  }

  .orders-page .hero {
    padding: 18px !important;
    border-radius: 24px !important;
    gap: 14px !important;
  }

  .orders-page .title {
    font-size: clamp(34px, 12vw, 46px) !important;
    line-height: 0.98 !important;
  }

  .orders-page .heroStats,
  .orders-page .summaryGrid,
  .orders-page .heroPanelGrid {
    grid-template-columns: 1fr !important;
  }

  .orders-page .filterCard,
  .orders-page .ordersCard,
  .orders-page .mobileOrderCard {
    padding: 14px !important;
    border-radius: 20px !important;
  }

  .orders-page .filterForm {
    display: grid !important;
    grid-template-columns: 1fr !important;
    gap: 12px !important;
    align-items: stretch !important;
  }

  .orders-page .field,
  .orders-page .input,
  .orders-page .filterButton,
  .orders-page .clearButton {
    width: 100% !important;
    max-width: 100% !important;
  }

  .orders-page .mobileBottom {
    display: grid !important;
    grid-template-columns: 1fr !important;
  }
}
`;
const styles: Record<string, CSSProperties> = {
  page: {
    width: "100%",
    maxWidth: 1240,
    margin: "0 auto",
    padding: "28px 16px 64px",
    minHeight: "100vh",
    background:
      "radial-gradient(circle at top left, rgba(22,131,248,0.08), transparent 32%), radial-gradient(circle at top right, rgba(15,23,42,0.05), transparent 34%), #f8fafc",
    boxSizing: "border-box",
    overflowX: "hidden",
  },
  hero: {
    position: "relative",
    display: "grid",
    gap: 22,
    padding: 30,
    borderRadius: 30,
    background:
      "radial-gradient(circle at bottom right, rgba(37,99,235,0.20), transparent 38%), linear-gradient(135deg, #020617 0%, #0f172a 55%, #172554 100%)",
    color: "#ffffff",
    marginBottom: 16,
    boxShadow: "0 24px 60px rgba(15,23,42,0.20)",
    overflow: "hidden",
    border: "1px solid rgba(148,163,184,0.22)",
  },
  heroMainGrid: {
    position: "relative",
    zIndex: 1,
    display: "grid",
    gridTemplateColumns: "minmax(0, 1.15fr) minmax(280px, 0.85fr)",
    gap: 22,
    alignItems: "stretch",
    minWidth: 0,
  },
  heroGlow: {
    position: "absolute",
    inset: 0,
    pointerEvents: "none",
    background:
      "radial-gradient(circle at 18% 24%, rgba(255,255,255,0.07), transparent 28%)",
  },
  heroContent: {
    position: "relative",
    zIndex: 1,
    minWidth: 0,
  },
  eyebrow: {
    display: "inline-flex",
    padding: "8px 14px",
    borderRadius: 999,
    background: "rgba(15,23,42,0.24)",
    color: "#facc15",
    border: "1px solid rgba(250,204,21,0.76)",
    fontSize: 12,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.1em",
    marginBottom: 14,
    boxShadow: "0 12px 28px rgba(0,0,0,0.12)",
  },
  title: {
    margin: 0,
    fontSize: "clamp(42px, 7vw, 68px)",
    lineHeight: 0.95,
    letterSpacing: "-0.07em",
    overflowWrap: "anywhere",
    textShadow: "0 18px 45px rgba(0,0,0,0.22)",
  },
  subtitle: {
    margin: "16px 0 0",
    maxWidth: 760,
    color: "#dbeafe",
    fontSize: 17,
    lineHeight: 1.55,
    fontWeight: 750,
    overflowWrap: "anywhere",
  },
  heroStats: {
    display: "grid",
    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
    gap: 12,
    marginTop: 24,
  },
  heroStat: {
    display: "grid",
    gap: 5,
    padding: 14,
    borderRadius: 18,
    background: "rgba(255,255,255,0.09)",
    border: "1px solid rgba(148,163,184,0.25)",
    minWidth: 0,
    overflowWrap: "anywhere",
  },
  heroPanel: {
    position: "relative",
    zIndex: 1,
    display: "grid",
    gap: 14,
    alignContent: "start",
    padding: 18,
    borderRadius: 24,
    background: "rgba(255,255,255,0.08)",
    border: "1px solid rgba(148,163,184,0.26)",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.10)",
    backdropFilter: "blur(12px)",
    minWidth: 0,
  },
  heroPanelTitle: {
    color: "#ffffff",
    fontSize: 22,
    fontWeight: 950,
    letterSpacing: "-0.035em",
  },
  heroPanelText: {
    margin: 0,
    color: "#dbeafe",
    lineHeight: 1.5,
    fontWeight: 700,
  },
  heroPanelGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 10,
  },
  miniMetric: {
    display: "grid",
    gap: 4,
    padding: 12,
    borderRadius: 16,
    background: "#ffffff",
    color: "#0f172a",
    border: "1px solid rgba(217,119,6,0.34)",
    minWidth: 0,
    overflowWrap: "anywhere",
  },
  heroActions: {
    position: "relative",
    zIndex: 1,
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    flexWrap: "wrap",
    alignItems: "center",
    paddingTop: 18,
    marginTop: 2,
    borderTop: "1px solid rgba(148,163,184,0.24)",
  },
  heroPrimaryButton: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 44,
    padding: "11px 16px",
    borderRadius: 999,
    background: "#1683f8",
    color: "#ffffff",
    textDecoration: "none",
    fontWeight: 950,
    border: "1px solid rgba(96,165,250,0.88)",
    boxShadow: "0 10px 22px rgba(22,131,248,0.24)",
  },
  heroSecondaryButton: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 44,
    padding: "11px 16px",
    borderRadius: 999,
    background: "rgba(255,255,255,0.10)",
    color: "#ffffff",
    textDecoration: "none",
    fontWeight: 950,
    border: "1px solid rgba(255,255,255,0.28)",
    boxShadow: "0 10px 22px rgba(0,0,0,0.10)",
  },
  summaryGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
    gap: 12,
    marginBottom: 16,
  },
  summaryCard: {
    display: "grid",
    gap: 5,
    padding: 15,
    borderRadius: 18,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    boxShadow: "0 2px 12px rgba(15,23,42,0.04)",
    minWidth: 0,
    overflowWrap: "anywhere",
  },
  filterCard: {
    padding: 16,
    borderRadius: 22,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    boxShadow: "0 2px 12px rgba(15,23,42,0.04)",
    marginBottom: 16,
    minWidth: 0,
  },
  filterForm: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1.4fr) minmax(180px, 0.6fr) auto auto",
    gap: 12,
    alignItems: "end",
    minWidth: 0,
  },
  field: {
    display: "grid",
    gap: 7,
    minWidth: 0,
  },
  label: {
    color: "#334155",
    fontSize: 13,
    fontWeight: 950,
  },
  input: {
    width: "100%",
    minHeight: 44,
    borderRadius: 13,
    border: "1px solid #cbd5e1",
    background: "#ffffff",
    color: "#0f172a",
    padding: "10px 12px",
    fontSize: 15,
    boxSizing: "border-box",
    minWidth: 0,
  },
  filterButton: {
    minHeight: 44,
    padding: "11px 16px",
    borderRadius: 999,
    background: "#0f172a",
    color: "#ffffff",
    border: "none",
    fontWeight: 950,
    cursor: "pointer",
  },
  clearButton: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 44,
    padding: "11px 16px",
    borderRadius: 999,
    background: "#ffffff",
    color: "#475569",
    border: "1px solid #cbd5e1",
    textDecoration: "none",
    fontWeight: 950,
  },
  ordersCard: {
    padding: 18,
    borderRadius: 24,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    boxShadow: "0 2px 12px rgba(15,23,42,0.04)",
    minWidth: 0,
  },
  sectionHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: 16,
    flexWrap: "wrap",
    alignItems: "flex-start",
    marginBottom: 16,
  },
  kicker: {
    margin: "0 0 7px",
    color: "#2563eb",
    fontSize: 12,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
  },
  sectionTitle: {
    margin: 0,
    color: "#0f172a",
    fontSize: 27,
    letterSpacing: "-0.04em",
  },
  sectionText: {
    margin: "7px 0 0",
    color: "#64748b",
    lineHeight: 1.5,
    maxWidth: 720,
  },
  countPill: {
    display: "inline-flex",
    alignItems: "center",
    padding: "8px 12px",
    borderRadius: 999,
    background: "#eff6ff",
    color: "#1d4ed8",
    border: "1px solid #bfdbfe",
    fontSize: 12,
    fontWeight: 950,
  },
  emptyBox: {
    padding: 18,
    borderRadius: 18,
    background: "#f8fafc",
    border: "1px dashed #cbd5e1",
    color: "#64748b",
    fontWeight: 850,
    textAlign: "center",
  },
  tableWrap: {
    width: "100%",
    overflowX: "auto",
  },
  table: {
    width: "100%",
    borderCollapse: "separate",
    borderSpacing: "0 10px",
  },
  th: {
    padding: "8px 10px",
    color: "#64748b",
    fontSize: 12,
    fontWeight: 950,
    textAlign: "left",
    textTransform: "uppercase",
    letterSpacing: "0.06em",
  },
  td: {
    padding: "14px 10px",
    background: "#f8fafc",
    borderTop: "1px solid #e2e8f0",
    borderBottom: "1px solid #e2e8f0",
    verticalAlign: "middle",
  },
  typePill: {
    display: "inline-flex",
    alignItems: "center",
    padding: "7px 10px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 950,
    whiteSpace: "nowrap",
  },
  statusPill: {
    display: "inline-flex",
    alignItems: "center",
    padding: "7px 10px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 950,
    whiteSpace: "nowrap",
  },
  primaryText: {
    color: "#0f172a",
    fontWeight: 950,
    overflowWrap: "anywhere",
  },
  secondaryText: {
    color: "#64748b",
    fontSize: 13,
    fontWeight: 750,
    overflowWrap: "anywhere",
  },
  actionLinks: {
    display: "flex",
    gap: 7,
    flexWrap: "wrap",
  },
  smallLink: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "7px 10px",
    borderRadius: 999,
    background: "#0f172a",
    color: "#ffffff",
    textDecoration: "none",
    fontSize: 12,
    fontWeight: 950,
  },
  smallLinkMuted: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "7px 10px",
    borderRadius: 999,
    background: "#ffffff",
    color: "#334155",
    border: "1px solid #cbd5e1",
    textDecoration: "none",
    fontSize: 12,
    fontWeight: 950,
  },
  mobileCards: {
    display: "none",
    gap: 12,
  },
  mobileOrderCard: {
    display: "grid",
    gap: 10,
    padding: 15,
    borderRadius: 18,
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    minWidth: 0,
  },
  mobileCardTop: {
    display: "flex",
    justifyContent: "space-between",
    gap: 8,
    flexWrap: "wrap",
  },
  mobileTitle: {
    margin: 0,
    color: "#0f172a",
    fontSize: 19,
    letterSpacing: "-0.025em",
    overflowWrap: "anywhere",
  },
  mobileMeta: {
    display: "grid",
    gap: 3,
    color: "#334155",
    overflowWrap: "anywhere",
  },
  mobileDetail: {
    color: "#64748b",
    fontWeight: 800,
    overflowWrap: "anywhere",
  },
  mobileBottom: {
    display: "flex",
    justifyContent: "space-between",
    gap: 10,
    flexWrap: "wrap",
    color: "#0f172a",
  },
  mobileActions: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
  },
};
