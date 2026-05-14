import type { CSSProperties, ReactNode } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { query } from "@/lib/db";
import { getTenantSlugFromHeaders } from "@/lib/tenant";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type PageProps = {
  params: Promise<{
    email: string;
  }>;
};

type ActivityType = "raffle" | "squares" | "event" | "auction";

type CustomerOrder = {
  id: string;
  type: ActivityType;
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

function normaliseEmail(value: unknown) {
  return cleanText(value).toLowerCase();
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

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown";

  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function activityTime(value: string | null) {
  if (!value) return 0;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : 0;
}

function typeLabel(type: ActivityType) {
  if (type === "raffle") return "Raffle";
  if (type === "squares") return "Squares";
  if (type === "event") return "Event";
  return "Auction";
}

function typeStyle(type: ActivityType): CSSProperties {
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
    clean.includes("open")
  ) {
    return {
      background: "#fef3c7",
      color: "#92400e",
      border: "1px solid #fde68a",
    };
  }

  return {
    background: "#f8fafc",
    color: "#475569",
    border: "1px solid #e2e8f0",
  };
}

async function safeQuery<T extends RawRow>(
  label: string,
  sql: string,
  values: unknown[],
): Promise<T[]> {
  try {
    return await query<T>(sql, values);
  } catch (error) {
    console.error(`Customer detail ${label} query failed:`, error);
    return [];
  }
}

async function getRaffleOrders(
  tenantSlug: string,
  email: string,
): Promise<CustomerOrder[]> {
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
        sale.created_at,
        raffle.title as campaign_title,
        raffle.slug as campaign_slug,
        raffle.currency,
        raffle.ticket_price_cents
      from raffle_ticket_sales sale
      join raffles raffle on raffle.id = sale.raffle_id
      where raffle.tenant_slug = $1
      and lower(sale.buyer_email) = lower($2)
      order by sale.created_at desc
      limit 500
    `,
    [tenantSlug, email],
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

async function getSquaresOrders(
  tenantSlug: string,
  email: string,
): Promise<CustomerOrder[]> {
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
      join squares_games game on game.id = sale.game_id
      where sale.tenant_slug = $1
      and lower(sale.customer_email) = lower($2)
      order by sale.created_at desc
      limit 500
    `,
    [tenantSlug, email],
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

async function getEventOrders(
  tenantSlug: string,
  email: string,
): Promise<CustomerOrder[]> {
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
      join events event on event.id = event_order.event_id
      where event_order.tenant_slug = $1
      and lower(event_order.customer_email) = lower($2)
      order by event_order.created_at desc
      limit 500
    `,
    [tenantSlug, email],
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

async function getAuctionOrders(
  tenantSlug: string,
  email: string,
): Promise<CustomerOrder[]> {
  const rows = await safeQuery(
    "auctions",
    `
      select
        bid.id,
        bid.item_id,
        bid.bidder_name,
        bid.bidder_email,
        bid.amount_cents,
        bid.created_at,
        item.auction_id,
        item.title as item_title,
        auction.title as campaign_title,
        auction.slug as campaign_slug,
        auction.currency
      from silent_auction_bids bid
      join silent_auction_items item on item.id = bid.item_id
      join silent_auctions auction on auction.id = item.auction_id
      where auction.tenant_slug = $1
      and lower(bid.bidder_email) = lower($2)
      order by bid.created_at desc
      limit 500
    `,
    [tenantSlug, email],
  );

  return rows.map((row) => {
    const campaignId = cleanText(row.auction_id);
    const slug = cleanText(row.campaign_slug);

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
      status: "Bid placed",
      createdAt: row.created_at ? String(row.created_at) : null,
      adminHref: campaignId ? `/admin/auctions/${campaignId}` : null,
      publicHref: slug ? `/a/${slug}` : null,
    };
  });
}

function uniqueCampaignCount(orders: CustomerOrder[]) {
  return new Set(
    orders.map((order) => `${order.type}:${order.campaignId || order.campaignTitle}`),
  ).size;
}

export default async function CustomerDetailPage({ params }: PageProps) {
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

  const resolvedParams = await params;
  const email = normaliseEmail(decodeURIComponent(resolvedParams.email || ""));

  if (!email) {
    notFound();
  }

  const [raffleOrders, squaresOrders, eventOrders, auctionOrders] =
    await Promise.all([
      getRaffleOrders(tenantSlug, email),
      getSquaresOrders(tenantSlug, email),
      getEventOrders(tenantSlug, email),
      getAuctionOrders(tenantSlug, email),
    ]);

  const orders = [
    ...raffleOrders,
    ...squaresOrders,
    ...eventOrders,
    ...auctionOrders,
  ].sort((a, b) => activityTime(b.createdAt) - activityTime(a.createdAt));

  if (orders.length === 0) {
    notFound();
  }

  const latest = orders[0];
  const customerName = latest?.customerName || "Supporter";
  const totalSpendCents = orders.reduce(
    (sum, order) => sum + Number(order.amountCents || 0),
    0,
  );
  const campaignCount = uniqueCampaignCount(orders);
  const types = Array.from(new Set(orders.map((order) => order.type)));
  const lastActivity = latest?.createdAt || null;

  return (
    <main className="customer-detail-page" style={styles.page}>
      <style>{responsiveStyles}</style>

      <section className="hero" style={styles.hero}>
        <div style={styles.heroContent}>
          <div style={styles.eyebrow}>Customer profile</div>

          <h1 className="so-brand-heading title" style={styles.title}>
            {customerName}
          </h1>

          <p style={styles.subtitle}>{email}</p>

          <div className="heroStats" style={styles.heroStats}>
            <HeroStat label="Lifetime spend" value={formatMoney(totalSpendCents)} />
            <HeroStat label="Orders" value={orders.length} />
            <HeroStat label="Campaigns" value={campaignCount} />
            <HeroStat label="Last active" value={formatDate(lastActivity)} />
          </div>
        </div>

        <div style={styles.heroPanel}>
          <div style={styles.heroPanelTitle}>Activity mix</div>

          <p style={styles.heroPanelText}>
            This supporter has activity across {types.length} fundraising area
            {types.length === 1 ? "" : "s"}.
          </p>

          <div style={styles.typeRow}>
            {types.map((type) => (
              <span key={type} style={{ ...styles.typePill, ...typeStyle(type) }}>
                {typeLabel(type)}
              </span>
            ))}
          </div>
        </div>
      </section>

      <section className="topActions" style={styles.topActions}>
        <Link href="/admin/customers" className="secondaryButton" style={styles.secondaryButton}>
          ← Back to customers
        </Link>

        <Link
          href={`/admin/orders?q=${encodeURIComponent(email)}`}
          className="primaryButton"
          style={styles.primaryButton}
        >
          View matching orders
        </Link>
      </section>

      <section className="summaryGrid" style={styles.summaryGrid}>
        <SummaryCard label="Raffle rows" value={raffleOrders.length} />
        <SummaryCard label="Squares rows" value={squaresOrders.length} />
        <SummaryCard label="Event rows" value={eventOrders.length} />
        <SummaryCard label="Auction bids" value={auctionOrders.length} />
      </section>

      <section className="ordersCard" style={styles.ordersCard}>
        <div style={styles.sectionHeader}>
          <div>
            <p style={styles.kicker}>Supporter timeline</p>

            <h2 className="so-brand-card-title sectionTitle" style={styles.sectionTitle}>
              Full activity history
            </h2>

            <p style={styles.sectionText}>
              Every known order, ticket sale or bid for this email address.
            </p>
          </div>

          <span style={styles.countPill}>{orders.length} rows</span>
        </div>

        <div className="orderList" style={styles.orderList}>
          {orders.map((order) => (
            <article key={order.id} className="orderCard" style={styles.orderCard}>
              <div style={styles.orderTop}>
                <span style={{ ...styles.typePill, ...typeStyle(order.type) }}>
                  {typeLabel(order.type)}
                </span>

                <span style={{ ...styles.statusPill, ...statusStyle(order.status) }}>
                  {order.status}
                </span>
              </div>

              <div>
                <h3 style={styles.orderTitle}>{order.campaignTitle}</h3>
                <p style={styles.orderDetail}>{order.detail}</p>
              </div>

              <div className="orderMeta" style={styles.orderMeta}>
                <Detail label="Amount" value={formatMoney(order.amountCents, order.currency)} />
                <Detail label="Date" value={formatDate(order.createdAt)} />
                <Detail label="Customer" value={order.customerName} />
              </div>

              <div className="cardActions" style={styles.cardActions}>
                {order.adminHref ? (
                  <Link href={order.adminHref} className="smallLink" style={styles.smallLink}>
                    Open admin
                  </Link>
                ) : null}

                {order.publicHref ? (
                  <Link
                    href={order.publicHref}
                    target="_blank"
                    className="smallLinkMuted"
                    style={styles.smallLinkMuted}
                  >
                    Public page
                  </Link>
                ) : null}
              </div>
            </article>
          ))}
        </div>
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

function SummaryCard({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div style={styles.summaryCard}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div style={styles.detail}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

const responsiveStyles = `
.customer-detail-page,
.customer-detail-page * {
  box-sizing: border-box;
}

.customer-detail-page {
  overflow-x: hidden;
}

.customer-detail-page section,
.customer-detail-page article,
.customer-detail-page div {
  min-width: 0;
}

@media (max-width: 980px) {
  .customer-detail-page .hero {
    grid-template-columns: 1fr !important;
  }

  .customer-detail-page .heroStats,
  .customer-detail-page .summaryGrid {
    grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
  }

  .customer-detail-page .topActions,
  .customer-detail-page .cardActions {
    display: grid !important;
    grid-template-columns: 1fr !important;
  }

  .customer-detail-page .primaryButton,
  .customer-detail-page .secondaryButton,
  .customer-detail-page .smallLink,
  .customer-detail-page .smallLinkMuted {
    width: 100% !important;
    justify-content: center !important;
    text-align: center !important;
  }
}

@media (max-width: 620px) {
  .customer-detail-page {
    width: 100% !important;
    max-width: 100% !important;
    padding: 14px 10px 42px !important;
  }

  .customer-detail-page .hero {
    padding: 18px !important;
    border-radius: 24px !important;
    gap: 14px !important;
  }

  .customer-detail-page .title {
    font-size: clamp(34px, 12vw, 46px) !important;
    line-height: 0.98 !important;
  }

  .customer-detail-page .heroStats,
  .customer-detail-page .summaryGrid,
  .customer-detail-page .orderMeta {
    grid-template-columns: 1fr !important;
  }

  .customer-detail-page .ordersCard,
  .customer-detail-page .orderCard {
    padding: 14px !important;
    border-radius: 20px !important;
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
      "radial-gradient(circle at top left, rgba(22,131,248,0.10), transparent 34%), #f8fafc",
    boxSizing: "border-box",
    overflowX: "hidden",
  },
  hero: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1.15fr) minmax(280px, 0.85fr)",
    gap: 22,
    padding: 30,
    borderRadius: 30,
    background:
      "radial-gradient(circle at top left, rgba(251,191,36,0.20), transparent 32%), linear-gradient(135deg, #020617 0%, #0f172a 55%, #172554 100%)",
    color: "#ffffff",
    marginBottom: 16,
    boxShadow: "0 24px 60px rgba(15,23,42,0.20)",
    overflow: "hidden",
  },
  heroContent: {
    minWidth: 0,
  },
  eyebrow: {
    display: "inline-flex",
    padding: "7px 12px",
    borderRadius: 999,
    background: "rgba(255,255,255,0.12)",
    color: "#bfdbfe",
    fontSize: 12,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.1em",
    marginBottom: 14,
  },
  title: {
    margin: 0,
    fontSize: "clamp(42px, 7vw, 68px)",
    lineHeight: 0.95,
    letterSpacing: "-0.07em",
    overflowWrap: "anywhere",
  },
  subtitle: {
    margin: "16px 0 0",
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
    border: "1px solid rgba(255,255,255,0.15)",
    minWidth: 0,
    overflowWrap: "anywhere",
  },
  heroPanel: {
    display: "grid",
    gap: 14,
    alignContent: "start",
    padding: 18,
    borderRadius: 24,
    background: "rgba(255,255,255,0.10)",
    border: "1px solid rgba(255,255,255,0.18)",
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
  topActions: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    flexWrap: "wrap",
    alignItems: "center",
    marginBottom: 16,
  },
  primaryButton: {
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
    border: "1px solid #1683f8",
  },
  secondaryButton: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 44,
    padding: "11px 16px",
    borderRadius: 999,
    background: "#ffffff",
    color: "#0f172a",
    textDecoration: "none",
    fontWeight: 950,
    border: "1px solid #cbd5e1",
  },
  summaryGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
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
  ordersCard: {
    padding: 18,
    borderRadius: 24,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
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
    overflowWrap: "anywhere",
  },
  sectionText: {
    margin: "7px 0 0",
    color: "#64748b",
    lineHeight: 1.5,
    maxWidth: 720,
    overflowWrap: "anywhere",
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
  typeRow: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
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
  orderList: {
    display: "grid",
    gap: 12,
  },
  orderCard: {
    display: "grid",
    gap: 12,
    padding: 16,
    borderRadius: 22,
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    minWidth: 0,
  },
  orderTop: {
    display: "flex",
    justifyContent: "space-between",
    gap: 8,
    flexWrap: "wrap",
  },
  orderTitle: {
    margin: 0,
    color: "#0f172a",
    fontSize: 22,
    letterSpacing: "-0.035em",
    overflowWrap: "anywhere",
  },
  orderDetail: {
    margin: "5px 0 0",
    color: "#64748b",
    fontWeight: 800,
    overflowWrap: "anywhere",
  },
  orderMeta: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: 10,
  },
  detail: {
    display: "grid",
    gap: 4,
    padding: 12,
    borderRadius: 16,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    minWidth: 0,
    overflowWrap: "anywhere",
  },
  cardActions: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
  },
  smallLink: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "8px 11px",
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
    padding: "8px 11px",
    borderRadius: 999,
    background: "#ffffff",
    color: "#334155",
    border: "1px solid #cbd5e1",
    textDecoration: "none",
    fontSize: 12,
    fontWeight: 950,
  },
};
