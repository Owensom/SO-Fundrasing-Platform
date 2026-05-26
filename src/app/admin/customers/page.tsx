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

type ActivityType = "raffle" | "squares" | "event" | "auction" | "donation";

type UnifiedOrder = {
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

type CustomerProfile = {
  key: string;
  name: string;
  email: string;
  totalSpendCents: number;
  orderCount: number;
  campaignCount: number;
  lastActivity: string | null;
  types: Set<ActivityType>;
  orders: UnifiedOrder[];
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
  const clean = cleanText(value).toLowerCase();
  if (!clean || clean === "no email" || clean === "unknown") return "";
  return clean;
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

function typeLabel(type: ActivityType) {
  if (type === "raffle") return "Raffle";
  if (type === "squares") return "Squares";
  if (type === "event") return "Event";
  if (type === "auction") return "Auction";
  return "Donation";
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

  if (type === "auction") {
    return {
      background: "#f5f3ff",
      color: "#6d28d9",
      border: "1px solid #ddd6fe",
    };
  }

  return {
    background: "#fffbeb",
    color: "#92400e",
    border: "1px solid #fde68a",
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
    console.error(`Admin customers ${label} query failed:`, error);
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

type ActivityType = "raffle" | "squares" | "event" | "auction" | "donation";

type UnifiedOrder = {
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

type CustomerProfile = {
  key: string;
  name: string;
  email: string;
  totalSpendCents: number;
  orderCount: number;
  campaignCount: number;
  lastActivity: string | null;
  types: Set<ActivityType>;
  orders: UnifiedOrder[];
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
  const clean = cleanText(value).toLowerCase();
  if (!clean || clean === "no email" || clean === "unknown") return "";
  return clean;
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

function typeLabel(type: ActivityType) {
  if (type === "raffle") return "Raffle";
  if (type === "squares") return "Squares";
  if (type === "event") return "Event";
  if (type === "auction") return "Auction";
  return "Donation";
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

  if (type === "auction") {
    return {
      background: "#f5f3ff",
      color: "#6d28d9",
      border: "1px solid #ddd6fe",
    };
  }

  return {
    background: "#fffbeb",
    color: "#92400e",
    border: "1px solid #fde68a",
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
    console.error(`Admin customers ${label} query failed:`, error);
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
export default async function AdminCustomersPage({
  searchParams,
}: PageProps) {
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

  const [
    raffleOrders,
    squaresOrders,
    eventOrders,
    auctionOrders,
    donationOrders,
  ] = await Promise.all([
    getRaffleOrders(tenantSlug),
    getSquaresOrders(tenantSlug),
    getEventOrders(tenantSlug),
    getAuctionOrders(tenantSlug),
    getDonationOrders(tenantSlug),
  ]);

  const allOrders = [
    ...raffleOrders,
    ...squaresOrders,
    ...eventOrders,
    ...auctionOrders,
    ...donationOrders,
  ].sort((a, b) => activityTime(b.createdAt) - activityTime(a.createdAt));

  const customers = buildCustomerProfiles(allOrders);

  const filteredCustomers = filterCustomers(
    customers,
    selectedType,
    searchTerm,
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
        <div style={styles.heroGlow} />

        <div className="heroMainGrid" style={styles.heroMainGrid}>
          <div style={styles.heroContent}>
            <div style={styles.eyebrow}>Platform CRM</div>

            <h1 className="so-brand-heading title" style={styles.title}>
              Customers
            </h1>

            <p style={styles.subtitle}>
              Supporter profiles grouped from raffle sales, squares sales,
              event orders, silent auction bids and public donations.
            </p>

            <div className="heroStats" style={styles.heroStats}>
              <HeroStat label="Customers" value={filteredCustomers.length} />
              <HeroStat label="Activity rows" value={totalOrders} />
              <HeroStat
                label="Tracked spend"
                value={formatMoney(totalSpendCents)}
              />
              <HeroStat label="Tenant" value={tenantSlug} />
            </div>
          </div>

          <div style={styles.heroPanel}>
            <div style={styles.heroPanelTitle}>Data included</div>

            <p style={styles.heroPanelText}>
              This page groups the same source data used by Orders, plus pure
              donations from the donations report.
            </p>

            <div className="heroPanelGrid" style={styles.heroPanelGrid}>
              <MiniMetric label="Raffles" value={raffleOrders.length} />
              <MiniMetric label="Squares" value={squaresOrders.length} />
              <MiniMetric label="Events" value={eventOrders.length} />
              <MiniMetric label="Auctions" value={auctionOrders.length} />
              <MiniMetric label="Donations" value={donationOrders.length} />
            </div>
          </div>
        </div>

        <div className="heroActions" style={styles.heroActions}>
          <Link
            href="/admin"
            className="heroSecondaryButton"
            style={styles.heroSecondaryButton}
          >
            ← Back to dashboard
          </Link>

          <Link
            href="/admin/orders"
            className="heroSecondaryButton"
            style={styles.heroSecondaryButton}
          >
            Orders dashboard
          </Link>

          <Link
            href="/admin/donations"
            className="heroSecondaryButton"
            style={styles.heroSecondaryButton}
          >
            Donations report
          </Link>

          <a
            href={csvHref}
            download={`customers-${tenantSlug}.csv`}
            className="heroPrimaryButton"
            style={styles.heroPrimaryButton}
          >
            Export CSV
          </a>
        </div>
      </section>

      <section className="summaryGrid" style={styles.summaryGrid}>
        <SummaryCard label="Visible customers" value={filteredCustomers.length} />
        <SummaryCard label="All customers" value={customers.length} />
        <SummaryCard label="Activity rows" value={totalOrders} />
        <SummaryCard
          label="Tracked spend"
          value={formatMoney(totalSpendCents)}
        />
        <SummaryCard label="Raffle rows" value={raffleOrders.length} />
        <SummaryCard label="Squares rows" value={squaresOrders.length} />
        <SummaryCard label="Event rows" value={eventOrders.length} />
        <SummaryCard label="Auction bids" value={auctionOrders.length} />
        <SummaryCard label="Donations" value={donationOrders.length} />
      </section>

      <section className="filterCard" style={styles.filterCard}>
        <form
          action="/admin/customers"
          className="filterForm"
          style={styles.filterForm}
        >
          <label style={styles.field}>
            <span style={styles.label}>Search</span>
            <input
              name="q"
              defaultValue={searchTerm}
              placeholder="Search name, email, campaign, item or donation..."
              style={styles.input}
            />
          </label>

          <label style={styles.field}>
            <span style={styles.label}>Activity type</span>
            <select name="type" defaultValue={selectedType} style={styles.input}>
              <option value="all">All activity</option>
              <option value="raffle">Raffles</option>
              <option value="squares">Squares</option>
              <option value="event">Events</option>
              <option value="auction">Auctions</option>
              <option value="donation">Donations</option>
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
            href="/admin/customers"
            className="clearButton"
            style={styles.clearButton}
          >
            Clear
          </Link>
        </form>
      </section>

      <section className="customersCard" style={styles.customersCard}>
        <div style={styles.sectionHeader}>
          <div>
            <p style={styles.kicker}>Customer profiles</p>

            <h2
              className="so-brand-card-title sectionTitle"
              style={styles.sectionTitle}
            >
              Supporter list
            </h2>

            <p style={styles.sectionText}>
              Each profile shows total tracked spend, activity count, campaigns
              supported and the latest three activity rows.
            </p>
          </div>

          <span style={styles.countPill}>{filteredCustomers.length} rows</span>
        </div>

        {filteredCustomers.length === 0 ? (
          <div style={styles.emptyBox}>No matching customers found yet.</div>
        ) : (
          <div className="customerGrid" style={styles.customerGrid}>
            {filteredCustomers.map((customer) => {
              const recentOrders = customer.orders
                .slice()
                .sort(
                  (a, b) =>
                    activityTime(b.createdAt) - activityTime(a.createdAt),
                )
                .slice(0, 3);

              const latestActivityHref =
                recentOrders[0]?.adminHref || "/admin/orders";

              const latestActivityLabel = recentOrders[0]
                ? "Latest activity"
                : "Orders dashboard";

              const middleHref = customer.types.has("donation")
                ? "/admin/donations"
                : `/admin/orders?q=${encodeURIComponent(customer.email)}`;

              const middleLabel = customer.types.has("donation")
                ? "Donation report"
                : "Orders dashboard";

              return (
                <article
                  key={customer.key}
                  className="customerCard"
                  style={styles.customerCard}
                >
                  <div className="customerTop" style={styles.customerTop}>
                    <div style={styles.customerIdentity}>
                      <h3 className="customerName" style={styles.customerName}>
                        {customer.name}
                      </h3>

                      <p style={styles.customerEmail}>{customer.email}</p>
                    </div>

                    <div className="spendBadge" style={styles.spendBadge}>
                      {formatMoney(customer.totalSpendCents)}
                    </div>
                  </div>

                  <div className="customerStats" style={styles.customerStats}>
                    <MiniMetric label="Activity" value={customer.orderCount} />
                    <MiniMetric
                      label="Campaigns"
                      value={customer.campaignCount}
                    />
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
                    {recentOrders.map((order) => (
                      <div
                        key={order.id}
                        className="activityRow"
                        style={styles.activityRow}
                      >
                        <div>
                          <div style={styles.activityTitle}>
                            {order.campaignTitle}
                          </div>

                          <div style={styles.activityDetail}>
                            {typeLabel(order.type)} · {order.detail}
                          </div>
                        </div>

                        <div
                          className="activityRight"
                          style={styles.activityRight}
                        >
                          <strong>
                            {formatMoney(order.amountCents, order.currency)}
                          </strong>

                          <span>{formatDate(order.createdAt)}</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="cardActions" style={styles.cardActions}>
                    <Link
                      href={`/admin/orders?q=${encodeURIComponent(
                        customer.email,
                      )}`}
                      className="smallLink"
                      style={styles.smallLink}
                    >
                      View orders
                    </Link>

                    <Link
                      href={middleHref}
                      className="smallLinkMuted"
                      style={styles.smallLinkMuted}
                    >
                      {middleLabel}
                    </Link>

                    <Link
                      href={latestActivityHref}
                      className="smallLinkMuted"
                      style={styles.smallLinkMuted}
                    >
                      {latestActivityLabel}
                    </Link>
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
export default async function AdminCustomersPage({
  searchParams,
}: PageProps) {
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

  const [
    raffleOrders,
    squaresOrders,
    eventOrders,
    auctionOrders,
    donationOrders,
  ] = await Promise.all([
    getRaffleOrders(tenantSlug),
    getSquaresOrders(tenantSlug),
    getEventOrders(tenantSlug),
    getAuctionOrders(tenantSlug),
    getDonationOrders(tenantSlug),
  ]);

  const allOrders = [
    ...raffleOrders,
    ...squaresOrders,
    ...eventOrders,
    ...auctionOrders,
    ...donationOrders,
  ].sort((a, b) => activityTime(b.createdAt) - activityTime(a.createdAt));

  const customers = buildCustomerProfiles(allOrders);

  const filteredCustomers = filterCustomers(
    customers,
    selectedType,
    searchTerm,
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
        <div style={styles.heroGlow} />

        <div className="heroMainGrid" style={styles.heroMainGrid}>
          <div style={styles.heroContent}>
            <div style={styles.eyebrow}>Platform CRM</div>

            <h1 className="so-brand-heading title" style={styles.title}>
              Customers
            </h1>

            <p style={styles.subtitle}>
              Supporter profiles grouped from raffle sales, squares sales,
              event orders, silent auction bids and public donations.
            </p>

            <div className="heroStats" style={styles.heroStats}>
              <HeroStat label="Customers" value={filteredCustomers.length} />
              <HeroStat label="Activity rows" value={totalOrders} />
              <HeroStat
                label="Tracked spend"
                value={formatMoney(totalSpendCents)}
              />
              <HeroStat label="Tenant" value={tenantSlug} />
            </div>
          </div>

          <div style={styles.heroPanel}>
            <div style={styles.heroPanelTitle}>Data included</div>

            <p style={styles.heroPanelText}>
              This page groups the same source data used by Orders, plus pure
              donations from the donations report.
            </p>

            <div className="heroPanelGrid" style={styles.heroPanelGrid}>
              <MiniMetric label="Raffles" value={raffleOrders.length} />
              <MiniMetric label="Squares" value={squaresOrders.length} />
              <MiniMetric label="Events" value={eventOrders.length} />
              <MiniMetric label="Auctions" value={auctionOrders.length} />
              <MiniMetric label="Donations" value={donationOrders.length} />
            </div>
          </div>
        </div>

        <div className="heroActions" style={styles.heroActions}>
          <Link
            href="/admin"
            className="heroSecondaryButton"
            style={styles.heroSecondaryButton}
          >
            ← Back to dashboard
          </Link>

          <Link
            href="/admin/orders"
            className="heroSecondaryButton"
            style={styles.heroSecondaryButton}
          >
            Orders dashboard
          </Link>

          <Link
            href="/admin/donations"
            className="heroSecondaryButton"
            style={styles.heroSecondaryButton}
          >
            Donations report
          </Link>

          <a
            href={csvHref}
            download={`customers-${tenantSlug}.csv`}
            className="heroPrimaryButton"
            style={styles.heroPrimaryButton}
          >
            Export CSV
          </a>
        </div>
      </section>

      <section className="summaryGrid" style={styles.summaryGrid}>
        <SummaryCard label="Visible customers" value={filteredCustomers.length} />
        <SummaryCard label="All customers" value={customers.length} />
        <SummaryCard label="Activity rows" value={totalOrders} />
        <SummaryCard
          label="Tracked spend"
          value={formatMoney(totalSpendCents)}
        />
        <SummaryCard label="Raffle rows" value={raffleOrders.length} />
        <SummaryCard label="Squares rows" value={squaresOrders.length} />
        <SummaryCard label="Event rows" value={eventOrders.length} />
        <SummaryCard label="Auction bids" value={auctionOrders.length} />
        <SummaryCard label="Donations" value={donationOrders.length} />
      </section>

      <section className="filterCard" style={styles.filterCard}>
        <form
          action="/admin/customers"
          className="filterForm"
          style={styles.filterForm}
        >
          <label style={styles.field}>
            <span style={styles.label}>Search</span>
            <input
              name="q"
              defaultValue={searchTerm}
              placeholder="Search name, email, campaign, item or donation..."
              style={styles.input}
            />
          </label>

          <label style={styles.field}>
            <span style={styles.label}>Activity type</span>
            <select name="type" defaultValue={selectedType} style={styles.input}>
              <option value="all">All activity</option>
              <option value="raffle">Raffles</option>
              <option value="squares">Squares</option>
              <option value="event">Events</option>
              <option value="auction">Auctions</option>
              <option value="donation">Donations</option>
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
            href="/admin/customers"
            className="clearButton"
            style={styles.clearButton}
          >
            Clear
          </Link>
        </form>
      </section>

      <section className="customersCard" style={styles.customersCard}>
        <div style={styles.sectionHeader}>
          <div>
            <p style={styles.kicker}>Customer profiles</p>

            <h2
              className="so-brand-card-title sectionTitle"
              style={styles.sectionTitle}
            >
              Supporter list
            </h2>

            <p style={styles.sectionText}>
              Each profile shows total tracked spend, activity count, campaigns
              supported and the latest three activity rows.
            </p>
          </div>

          <span style={styles.countPill}>{filteredCustomers.length} rows</span>
        </div>

        {filteredCustomers.length === 0 ? (
          <div style={styles.emptyBox}>No matching customers found yet.</div>
        ) : (
          <div className="customerGrid" style={styles.customerGrid}>
            {filteredCustomers.map((customer) => {
              const recentOrders = customer.orders
                .slice()
                .sort(
                  (a, b) =>
                    activityTime(b.createdAt) - activityTime(a.createdAt),
                )
                .slice(0, 3);

              const latestActivityHref =
                recentOrders[0]?.adminHref || "/admin/orders";

              const latestActivityLabel = recentOrders[0]
                ? "Latest activity"
                : "Orders dashboard";

              const middleHref = customer.types.has("donation")
                ? "/admin/donations"
                : `/admin/orders?q=${encodeURIComponent(customer.email)}`;

              const middleLabel = customer.types.has("donation")
                ? "Donation report"
                : "Orders dashboard";

              return (
                <article
                  key={customer.key}
                  className="customerCard"
                  style={styles.customerCard}
                >
                  <div className="customerTop" style={styles.customerTop}>
                    <div style={styles.customerIdentity}>
                      <h3 className="customerName" style={styles.customerName}>
                        {customer.name}
                      </h3>

                      <p style={styles.customerEmail}>{customer.email}</p>
                    </div>

                    <div className="spendBadge" style={styles.spendBadge}>
                      {formatMoney(customer.totalSpendCents)}
                    </div>
                  </div>

                  <div className="customerStats" style={styles.customerStats}>
                    <MiniMetric label="Activity" value={customer.orderCount} />
                    <MiniMetric
                      label="Campaigns"
                      value={customer.campaignCount}
                    />
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
                    {recentOrders.map((order) => (
                      <div
                        key={order.id}
                        className="activityRow"
                        style={styles.activityRow}
                      >
                        <div>
                          <div style={styles.activityTitle}>
                            {order.campaignTitle}
                          </div>

                          <div style={styles.activityDetail}>
                            {typeLabel(order.type)} · {order.detail}
                          </div>
                        </div>

                        <div
                          className="activityRight"
                          style={styles.activityRight}
                        >
                          <strong>
                            {formatMoney(order.amountCents, order.currency)}
                          </strong>

                          <span>{formatDate(order.createdAt)}</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="cardActions" style={styles.cardActions}>
                    <Link
                      href={`/admin/orders?q=${encodeURIComponent(
                        customer.email,
                      )}`}
                      className="smallLink"
                      style={styles.smallLink}
                    >
                      View orders
                    </Link>

                    <Link
                      href={middleHref}
                      className="smallLinkMuted"
                      style={styles.smallLinkMuted}
                    >
                      {middleLabel}
                    </Link>

                    <Link
                      href={latestActivityHref}
                      className="smallLinkMuted"
                      style={styles.smallLinkMuted}
                    >
                      {latestActivityLabel}
                    </Link>
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

  customersCard: {
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
    alignItems: "stretch",
  },

  customerCard: {
    display: "grid",
    gridTemplateRows: "auto auto auto minmax(178px, 1fr) auto",
    gap: 14,
    padding: 16,
    borderRadius: 22,
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    minWidth: 0,
    overflow: "hidden",
    height: "100%",
  },

  customerTop: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) auto",
    gap: 12,
    alignItems: "start",
  },

  customerIdentity: {
    minWidth: 0,
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
    alignItems: "stretch",
  },

  typeRow: {
    display: "flex",
    gap: 7,
    flexWrap: "wrap",
    alignItems: "flex-start",
    minHeight: 34,
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
    alignContent: "start",
    minHeight: 178,
  },

  activityRow: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) auto",
    gap: 10,
    padding: 12,
    borderRadius: 16,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    minWidth: 0,
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
    alignContent: "start",
  },

  cardActions: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: 8,
    alignItems: "stretch",
    marginTop: "auto",
  },

  smallLink: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 38,
    padding: "8px 11px",
    borderRadius: 999,
    background: "#0f172a",
    color: "#ffffff",
    textDecoration: "none",
    fontSize: 12,
    fontWeight: 950,
    textAlign: "center",
  },

  smallLinkMuted: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 38,
    padding: "8px 11px",
    borderRadius: 999,
    background: "#ffffff",
    color: "#334155",
    border: "1px solid #cbd5e1",
    textDecoration: "none",
    fontSize: 12,
    fontWeight: 950,
    textAlign: "center",
  },
};
