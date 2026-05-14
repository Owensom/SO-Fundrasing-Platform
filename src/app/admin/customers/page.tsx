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
    q?: string;
    type?: string;
  }>;
};

type CustomerActivity = {
  id: string;
  type: "raffle" | "squares" | "event" | "auction";
  customerName: string;
  customerEmail: string;
  campaignTitle: string;
  campaignSlug: string | null;
  detail: string;
  amountCents: number;
  currency: string;
  createdAt: string | null;
  adminHref: string | null;
  publicHref: string | null;
};

type CustomerProfile = {
  email: string;
  name: string;
  totalSpendCents: number;
  orderCount: number;
  campaignCount: number;
  lastActivity: string | null;
  types: Set<CustomerActivity["type"]>;
  activities: CustomerActivity[];
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

function normaliseEmail(value: unknown) {
  return cleanText(value, "No email").toLowerCase();
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

function typeLabel(type: CustomerActivity["type"]) {
  if (type === "raffle") return "Raffle";
  if (type === "squares") return "Squares";
  if (type === "event") return "Event";
  return "Auction";
}

function typeStyle(type: CustomerActivity["type"]): CSSProperties {
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

async function safeQuery<T extends RawRow>(
  sql: string,
  values: unknown[],
): Promise<T[]> {
  try {
    return await query<T>(sql, values);
  } catch (error) {
    console.error("Admin customers query failed:", error);
    return [];
  }
}

async function getRaffleActivity(
  tenantSlug: string,
): Promise<CustomerActivity[]> {
  const rows = await safeQuery(
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
      order by sale.created_at desc
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
      customerName: cleanText(row.buyer_name, "Supporter"),
      customerEmail: cleanText(row.buyer_email, "No email"),
      campaignTitle: cleanText(row.campaign_title, "Untitled raffle"),
      campaignSlug: slug || null,
      detail: `Ticket #${cleanText(row.ticket_number, "—")}${
        row.colour ? ` · ${row.colour}` : ""
      }`,
      amountCents: safeNumber(row.ticket_price_cents, 0),
      currency: cleanText(row.currency, "GBP"),
      createdAt: row.created_at ? String(row.created_at) : null,
      adminHref: campaignId ? `/admin/raffles/${campaignId}` : null,
      publicHref: slug ? `/r/${slug}` : null,
    };
  });
}

async function getSquaresActivity(
  tenantSlug: string,
): Promise<CustomerActivity[]> {
  const rows = await safeQuery(
    `
      select
        sale.id,
        sale.game_id,
        sale.customer_name,
        sale.customer_email,
        sale.squares,
        sale.amount_cents,
        sale.total_cents,
        sale.created_at,
        game.title as campaign_title,
        game.slug as campaign_slug,
        game.currency,
        game.price_per_square_cents
      from squares_sales sale
      join squares_games game on game.id = sale.game_id
      where game.tenant_slug = $1
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

    return {
      id: `squares-${cleanText(row.id, `${campaignId}-${squares}`)}`,
      type: "squares",
      customerName: cleanText(row.customer_name, "Supporter"),
      customerEmail: cleanText(row.customer_email, "No email"),
      campaignTitle: cleanText(row.campaign_title, "Untitled squares game"),
      campaignSlug: slug || null,
      detail: squares ? `Squares ${squares}` : "Squares order",
      amountCents:
        safeNumber(row.amount_cents, 0) ||
        safeNumber(row.total_cents, 0) ||
        safeNumber(row.price_per_square_cents, 0),
      currency: cleanText(row.currency, "GBP"),
      createdAt: row.created_at ? String(row.created_at) : null,
      adminHref: campaignId ? `/admin/squares/${campaignId}` : null,
      publicHref: slug ? `/s/${slug}` : null,
    };
  });
}

async function getEventActivity(
  tenantSlug: string,
): Promise<CustomerActivity[]> {
  const rows = await safeQuery(
    `
      select
        event_order.id,
        event_order.event_id,
        event_order.customer_name,
        event_order.customer_email,
        event_order.buyer_name,
        event_order.buyer_email,
        event_order.total_amount_cents,
        event_order.amount_cents,
        event_order.created_at,
        event.title as campaign_title,
        event.slug as campaign_slug,
        event.currency
      from event_orders event_order
      join events event on event.id = event_order.event_id
      where event.tenant_slug = $1
      order by event_order.created_at desc
      limit 500
    `,
    [tenantSlug],
  );

  return rows.map((row) => {
    const campaignId = cleanText(row.event_id);
    const slug = cleanText(row.campaign_slug);
    const customerName =
      cleanText(row.customer_name) ||
      cleanText(row.buyer_name) ||
      "Ticket buyer";
    const customerEmail =
      cleanText(row.customer_email) ||
      cleanText(row.buyer_email) ||
      "No email";

    return {
      id: `event-${cleanText(row.id, campaignId)}`,
      type: "event",
      customerName,
      customerEmail,
      campaignTitle: cleanText(row.campaign_title, "Untitled event"),
      campaignSlug: slug || null,
      detail: "Event ticket order",
      amountCents:
        safeNumber(row.total_amount_cents, 0) ||
        safeNumber(row.amount_cents, 0),
      currency: cleanText(row.currency, "GBP"),
      createdAt: row.created_at ? String(row.created_at) : null,
      adminHref: campaignId ? `/admin/events/${campaignId}` : null,
      publicHref: slug ? `/e/${slug}` : null,
    };
  });
}

async function getAuctionActivity(
  tenantSlug: string,
): Promise<CustomerActivity[]> {
  const rows = await safeQuery(
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
      from auction_bids bid
      join auction_items item on item.id = bid.item_id
      join auctions auction on auction.id = item.auction_id
      where auction.tenant_slug = $1
      order by bid.created_at desc
      limit 500
    `,
    [tenantSlug],
  );

  return rows.map((row) => {
    const campaignId = cleanText(row.auction_id);
    const slug = cleanText(row.campaign_slug);

    return {
      id: `auction-${cleanText(row.id, `${campaignId}-${row.item_id}`)}`,
      type: "auction",
      customerName: cleanText(row.bidder_name, "Bidder"),
      customerEmail: cleanText(row.bidder_email, "No email"),
      campaignTitle: cleanText(row.campaign_title, "Untitled auction"),
      campaignSlug: slug || null,
      detail: `Bid · ${cleanText(row.item_title, "Auction item")}`,
      amountCents: safeNumber(row.amount_cents, 0),
      currency: cleanText(row.currency, "GBP"),
      createdAt: row.created_at ? String(row.created_at) : null,
      adminHref: campaignId ? `/admin/auctions/${campaignId}` : null,
      publicHref: slug ? `/a/${slug}` : null,
    };
  });
}

function buildCustomerProfiles(activities: CustomerActivity[]) {
  const profileMap = new Map<string, CustomerProfile>();

  for (const activity of activities) {
    const email = normaliseEmail(activity.customerEmail);
    const key = email || `unknown-${activity.customerName.toLowerCase()}`;

    const existing = profileMap.get(key);

    if (!existing) {
      profileMap.set(key, {
        email,
        name: activity.customerName,
        totalSpendCents: Number(activity.amountCents || 0),
        orderCount: 1,
        campaignCount: 1,
        lastActivity: activity.createdAt,
        types: new Set([activity.type]),
        activities: [activity],
      });
      continue;
    }

    existing.totalSpendCents += Number(activity.amountCents || 0);
    existing.orderCount += 1;
    existing.types.add(activity.type);
    existing.activities.push(activity);

    const campaigns = new Set(
      existing.activities.map((item) => `${item.type}:${item.campaignTitle}`),
    );
    existing.campaignCount = campaigns.size;

    const existingTime = existing.lastActivity
      ? new Date(existing.lastActivity).getTime()
      : 0;
    const activityTime = activity.createdAt
      ? new Date(activity.createdAt).getTime()
      : 0;

    if (activityTime > existingTime) {
      existing.lastActivity = activity.createdAt;
      existing.name = activity.customerName || existing.name;
    }
  }

  return Array.from(profileMap.values()).sort(
    (a, b) => b.totalSpendCents - a.totalSpendCents,
  );
}

function filterCustomers(
  customers: CustomerProfile[],
  searchTerm: string,
  typeFilter: string,
) {
  const cleanSearch = searchTerm.trim().toLowerCase();
  const cleanType = typeFilter.trim().toLowerCase();

  return customers.filter((customer) => {
    const typeMatch =
      !cleanType ||
      cleanType === "all" ||
      customer.types.has(cleanType as CustomerActivity["type"]);

    const searchText = [
      customer.name,
      customer.email,
      ...customer.activities.map((activity) => activity.campaignTitle),
      ...customer.activities.map((activity) => activity.detail),
    ]
      .join(" ")
      .toLowerCase();

    const searchMatch = !cleanSearch || searchText.includes(cleanSearch);

    return typeMatch && searchMatch;
  });
}

function toCsvValue(value: unknown) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

function buildCsvHref(customers: CustomerProfile[]) {
  const headers = [
    "Name",
    "Email",
    "Total spend",
    "Order count",
    "Campaign count",
    "Activity types",
    "Last activity",
  ];

  const rows = customers.map((customer) => [
    customer.name,
    customer.email,
    (customer.totalSpendCents / 100).toFixed(2),
    customer.orderCount,
    customer.campaignCount,
    Array.from(customer.types).map(typeLabel).join(" | "),
    formatDate(customer.lastActivity),
  ]);

  const csv = [headers, ...rows]
    .map((row) => row.map(toCsvValue).join(","))
    .join("\n");

  return `data:text/csv;charset=utf-8,${encodeURIComponent(csv)}`;
}

export default async function AdminCustomersPage({ searchParams }: PageProps) {
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
  const searchTerm = cleanText(resolvedSearchParams.q, "");
  const selectedType = cleanText(resolvedSearchParams.type, "all");

  const [raffleActivity, squaresActivity, eventActivity, auctionActivity] =
    await Promise.all([
      getRaffleActivity(tenantSlug),
      getSquaresActivity(tenantSlug),
      getEventActivity(tenantSlug),
      getAuctionActivity(tenantSlug),
    ]);

  const allActivity = [
    ...raffleActivity,
    ...squaresActivity,
    ...eventActivity,
    ...auctionActivity,
  ];

  const customers = buildCustomerProfiles(allActivity);
  const filteredCustomers = filterCustomers(
    customers,
    searchTerm,
    selectedType,
  );

  const totalSpendCents = filteredCustomers.reduce(
    (sum, customer) => sum + customer.totalSpendCents,
    0,
  );

  const totalOrders = filteredCustomers.reduce(
    (sum, customer) => sum + customer.orderCount,
    0,
  );

  const csvHref = buildCsvHref(filteredCustomers);

  return (
    <main className="customers-page" style={styles.page}>
      <style>{responsiveStyles}</style>

      <section className="hero" style={styles.hero}>
        <div style={styles.heroContent}>
          <div style={styles.eyebrow}>Platform CRM</div>

          <h1 className="so-brand-heading title" style={styles.title}>
            Customers
          </h1>

          <p style={styles.subtitle}>
            Supporter profiles built from raffles, squares, events and auction
            activity for this tenant.
          </p>

          <div className="heroStats" style={styles.heroStats}>
            <HeroStat label="Customers" value={filteredCustomers.length} />
            <HeroStat label="Activity rows" value={allActivity.length} />
            <HeroStat label="Orders" value={totalOrders} />
            <HeroStat label="Spend" value={formatMoney(totalSpendCents)} />
          </div>
        </div>

        <div style={styles.heroPanel}>
          <div style={styles.heroPanelTitle}>Supporter intelligence</div>
          <p style={styles.heroPanelText}>
            See who supports multiple campaigns, where they spend, and when they
            last interacted with the platform.
          </p>

          <div style={styles.heroPanelGrid}>
            <MiniMetric label="Raffles" value={raffleActivity.length} />
            <MiniMetric label="Squares" value={squaresActivity.length} />
            <MiniMetric label="Events" value={eventActivity.length} />
            <MiniMetric label="Auctions" value={auctionActivity.length} />
          </div>
        </div>
      </section>

      <section className="topActions" style={styles.topActions}>
        <Link href="/admin" style={styles.secondaryButton}>
          ← Back to dashboard
        </Link>

        <Link href="/admin/orders" style={styles.secondaryButton}>
          Orders dashboard
        </Link>

        <a
          href={csvHref}
          download={`customers-${tenantSlug}.csv`}
          style={styles.primaryButton}
        >
          Export CSV
        </a>
      </section>

      <section className="summaryGrid" style={styles.summaryGrid}>
        <SummaryCard label="Visible customers" value={filteredCustomers.length} />
        <SummaryCard label="All customers" value={customers.length} />
        <SummaryCard label="Activity rows" value={allActivity.length} />
        <SummaryCard label="Orders" value={totalOrders} />
        <SummaryCard label="Total spend" value={formatMoney(totalSpendCents)} />
      </section>

      <section style={styles.filterCard}>
        <form action="/admin/customers" style={styles.filterForm}>
          <label style={styles.field}>
            <span style={styles.label}>Search</span>
            <input
              name="q"
              defaultValue={searchTerm}
              placeholder="Search name, email, campaign or item..."
              style={styles.input}
            />
          </label>

          <label style={styles.field}>
            <span style={styles.label}>Activity type</span>
            <select
              name="type"
              defaultValue={selectedType}
              style={styles.input}
            >
              <option value="all">All activity</option>
              <option value="raffle">Raffles</option>
              <option value="squares">Squares</option>
              <option value="event">Events</option>
              <option value="auction">Auctions</option>
            </select>
          </label>

          <button type="submit" style={styles.filterButton}>
            Apply filters
          </button>

          <Link href="/admin/customers" style={styles.clearButton}>
            Clear
          </Link>
        </form>
      </section>

      <section style={styles.customersCard}>
        <div style={styles.sectionHeader}>
          <div>
            <p style={styles.kicker}>Customer profiles</p>

            <h2 className="so-brand-card-title" style={styles.sectionTitle}>
              Supporter list
            </h2>

            <p style={styles.sectionText}>
              Grouped by customer email where available. Each profile includes
              total spend, activity count, campaign count and latest activity.
            </p>
          </div>

          <span style={styles.countPill}>{filteredCustomers.length} rows</span>
        </div>

        {filteredCustomers.length === 0 ? (
          <div style={styles.emptyBox}>
            No matching customers found yet. Once orders, bids or ticket sales
            are recorded, customer profiles will appear here.
          </div>
        ) : (
          <div className="customerGrid" style={styles.customerGrid}>
            {filteredCustomers.map((customer) => {
              const recentActivities = customer.activities
                .slice()
                .sort((a, b) => {
                  const aTime = a.createdAt
                    ? new Date(a.createdAt).getTime()
                    : 0;
                  const bTime = b.createdAt
                    ? new Date(b.createdAt).getTime()
                    : 0;

                  return bTime - aTime;
                })
                .slice(0, 3);

              return (
                <article key={customer.email} style={styles.customerCard}>
                  <div style={styles.customerTop}>
                    <div>
                      <h3 style={styles.customerName}>{customer.name}</h3>
                      <p style={styles.customerEmail}>{customer.email}</p>
                    </div>

                    <div style={styles.spendBadge}>
                      {formatMoney(customer.totalSpendCents)}
                    </div>
                  </div>

                  <div style={styles.customerStats}>
                    <MiniMetric label="Orders" value={customer.orderCount} />
                    <MiniMetric label="Campaigns" value={customer.campaignCount} />
                    <MiniMetric
                      label="Last active"
                      value={formatDate(customer.lastActivity)}
                    />
                  </div>

                  <div style={styles.typeRow}>
                    {Array.from(customer.types).map((type) => (
                      <span
                        key={type}
                        style={{ ...styles.typePill, ...typeStyle(type) }}
                      >
                        {typeLabel(type)}
                      </span>
                    ))}
                  </div>

                  <div style={styles.activityList}>
                    {recentActivities.map((activity) => (
                      <div key={activity.id} style={styles.activityRow}>
                        <div>
                          <div style={styles.activityTitle}>
                            {activity.campaignTitle}
                          </div>
                          <div style={styles.activityDetail}>
                            {activity.detail}
                          </div>
                        </div>

                        <div style={styles.activityRight}>
                          <strong>
                            {formatMoney(
                              activity.amountCents,
                              activity.currency,
                            )}
                          </strong>
                          <span>{formatDate(activity.createdAt)}</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div style={styles.cardActions}>
                    <Link
                      href={`/admin/orders?q=${encodeURIComponent(
                        customer.email,
                      )}`}
                      style={styles.smallLink}
                    >
                      View orders
                    </Link>

                    {recentActivities[0]?.adminHref ? (
                      <Link
                        href={recentActivities[0].adminHref}
                        style={styles.smallLinkMuted}
                      >
                        Latest campaign
                      </Link>
                    ) : null}
                  </div>
                </article>
              );
            })}
          </div>
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
@media (max-width: 900px) {
  .customers-page {
    overflow-x: hidden;
  }

  .customers-page .hero,
  .customers-page .filterForm {
    grid-template-columns: 1fr !important;
  }

  .customers-page .heroStats,
  .customers-page .summaryGrid {
    grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
  }

  .customers-page .topActions {
    align-items: stretch !important;
  }

  .customers-page .primaryButton,
  .customers-page .secondaryButton,
  .customers-page .filterButton,
  .customers-page .clearButton {
    width: 100% !important;
    justify-content: center !important;
    text-align: center !important;
    box-sizing: border-box !important;
  }
}

@media (max-width: 560px) {
  .customers-page {
    padding: 18px 12px 44px !important;
  }

  .customers-page .hero {
    padding: 20px !important;
    border-radius: 24px !important;
  }

  .customers-page .title {
    font-size: clamp(34px, 11vw, 46px) !important;
  }

  .customers-page .heroStats,
  .customers-page .summaryGrid,
  .customers-page .heroPanelGrid,
  .customers-page .customerStats {
    grid-template-columns: 1fr !important;
  }

  .customers-page .customerTop,
  .customers-page .activityRow {
    grid-template-columns: 1fr !important;
  }

  .customers-page .activityRight {
    text-align: left !important;
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
    maxWidth: 760,
    color: "#dbeafe",
    fontSize: 17,
    lineHeight: 1.55,
    fontWeight: 750,
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
  },
  heroPanel: {
    display: "grid",
    gap: 14,
    alignContent: "start",
    padding: 18,
    borderRadius: 24,
    background: "rgba(255,255,255,0.10)",
    border: "1px solid rgba(255,255,255,0.18)",
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
    border: "1px solid #e2e8f0",
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
    boxShadow: "0 10px 20px rgba(22,131,248,0.18)",
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
    gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
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
  },
  filterCard: {
    padding: 16,
    borderRadius: 22,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    boxShadow: "0 2px 12px rgba(15,23,42,0.04)",
    marginBottom: 16,
  },
  filterForm: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1.4fr) minmax(180px, 0.6fr) auto auto",
    gap: 12,
    alignItems: "end",
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
  customersCard: {
    padding: 18,
    borderRadius: 24,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    boxShadow: "0 2px 12px rgba(15,23,42,0.04)",
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
  customerGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 340px), 1fr))",
    gap: 14,
  },
  customerCard: {
    display: "grid",
    gap: 14,
    padding: 16,
    borderRadius: 22,
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    minWidth: 0,
  },
  customerTop: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) auto",
    gap: 12,
    alignItems: "start",
  },
  customerName: {
    margin: 0,
    color: "#0f172a",
    fontSize: 22,
    letterSpacing: "-0.035em",
    overflowWrap: "anywhere",
  },
  customerEmail: {
    margin: "4px 0 0",
    color: "#64748b",
    fontSize: 13,
    fontWeight: 850,
    overflowWrap: "anywhere",
  },
  spendBadge: {
    padding: "8px 11px",
    borderRadius: 999,
    background: "#dcfce7",
    color: "#166534",
    border: "1px solid #bbf7d0",
    fontSize: 13,
    fontWeight: 950,
    whiteSpace: "nowrap",
  },
  customerStats: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: 10,
  },
  typeRow: {
    display: "flex",
    gap: 7,
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
  activityList: {
    display: "grid",
    gap: 9,
  },
  activityRow: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) auto",
    gap: 10,
    padding: 12,
    borderRadius: 16,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
  },
  activityTitle: {
    color: "#0f172a",
    fontWeight: 950,
    overflowWrap: "anywhere",
  },
  activityDetail: {
    marginTop: 3,
    color: "#64748b",
    fontSize: 13,
    fontWeight: 750,
    overflowWrap: "anywhere",
  },
  activityRight: {
    display: "grid",
    gap: 3,
    textAlign: "right",
    color: "#0f172a",
    fontSize: 13,
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
