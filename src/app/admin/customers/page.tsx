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
    const paymentStatus = cleanText(row.payment_status, "Bid placed");

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
      status:
        paymentStatus === "paid"
          ? "Paid"
          : paymentStatus === "checkout_started"
            ? "Checkout started"
            : paymentStatus === "cancelled"
              ? "Cancelled"
              : "Bid placed",
      createdAt: row.created_at ? String(row.created_at) : null,
      adminHref: campaignId ? `/admin/auctions/${campaignId}` : null,
      publicHref: slug ? `/a/${slug}` : null,
    };
  });
}

async function getDonationOrders(tenantSlug: string): Promise<UnifiedOrder[]> {
  const rows = await safeQuery(
    "donations",
    `
      select
        id::text,
        campaign_type,
        campaign_id,
        campaign_title,
        donor_name,
        donor_email,
        message,
        amount_cents,
        gross_amount_cents,
        currency,
        payment_status,
        created_at::text,
        paid_at::text,
        gift_aid_claimed
      from public_donations
      where tenant_slug = $1
      order by created_at desc
      limit 500
    `,
    [tenantSlug],
  );

  return rows.map((row) => {
    const campaignType = cleanText(row.campaign_type, "general").toLowerCase();
    const campaignId = cleanText(row.campaign_id);
    const campaignTitle = cleanText(row.campaign_title, "General donation");
    const message = cleanText(row.message);
    const status = cleanText(row.payment_status, "Pending");

    const publicHref =
      campaignType === "raffle" && campaignId
        ? null
        : campaignType === "squares" && campaignId
          ? null
          : campaignType === "event" && campaignId
            ? null
            : campaignType === "auction" && campaignId
              ? null
              : `/c/${tenantSlug}/support`;

    return {
      id: `donation-${cleanText(row.id)}`,
      type: "donation",
      campaignId: campaignId || null,
      campaignTitle,
      campaignSlug: null,
      customerName: cleanText(row.donor_name, "Anonymous donor"),
      customerEmail: cleanText(row.donor_email, "No email"),
      detail: `${row.gift_aid_claimed ? "Gift Aid donation" : "Donation"}${
        message ? ` · ${message}` : ""
      }`,
      amountCents:
        safeNumber(row.gross_amount_cents, 0) ||
        safeNumber(row.amount_cents, 0),
      currency: cleanText(row.currency, "GBP"),
      status:
        status === "paid"
          ? "Paid"
          : status === "checkout_started"
            ? "Checkout started"
            : status === "failed"
              ? "Failed"
              : status === "cancelled"
                ? "Cancelled"
                : "Pending",
      createdAt:
        row.paid_at && status === "paid"
          ? String(row.paid_at)
          : row.created_at
            ? String(row.created_at)
            : null,
      adminHref: "/admin/donations",
      publicHref,
    };
  });
}

function buildCustomerProfiles(orders: UnifiedOrder[]) {
  const map = new Map<string, CustomerProfile>();

  for (const order of orders) {
    const email = normaliseEmail(order.customerEmail);
    const key = email || `${order.type}-${order.id}`;

    const existing = map.get(key);

    if (!existing) {
      map.set(key, {
        key,
        name: cleanText(order.customerName, "Supporter"),
        email: email || "No email",
        totalSpendCents: Number(order.amountCents || 0),
        orderCount: 1,
        campaignCount: 1,
        lastActivity: order.createdAt,
        types: new Set([order.type]),
        orders: [order],
      });

      continue;
    }

    existing.totalSpendCents += Number(order.amountCents || 0);
    existing.orderCount += 1;
    existing.types.add(order.type);
    existing.orders.push(order);

    const campaigns = new Set(
      existing.orders.map(
        (item) => `${item.type}:${item.campaignId || item.campaignTitle}`,
      ),
    );

    existing.campaignCount = campaigns.size;

    if (activityTime(order.createdAt) > activityTime(existing.lastActivity)) {
      existing.lastActivity = order.createdAt;
      existing.name = cleanText(order.customerName, existing.name);
    }
  }

  return Array.from(map.values()).sort((a, b) => {
    if (b.totalSpendCents !== a.totalSpendCents) {
      return b.totalSpendCents - a.totalSpendCents;
    }

    return activityTime(b.lastActivity) - activityTime(a.lastActivity);
  });
}

function filterCustomers(
  customers: CustomerProfile[],
  typeFilter: string,
  searchTerm: string,
) {
  const cleanType = typeFilter.trim().toLowerCase();
  const cleanSearch = searchTerm.trim().toLowerCase();

  return customers.filter((customer) => {
    const typeMatch =
      !cleanType ||
      cleanType === "all" ||
      customer.types.has(cleanType as ActivityType);

    const searchMatch =
      !cleanSearch ||
      [
        customer.name,
        customer.email,
        ...customer.orders.map((order) => order.campaignTitle),
        ...customer.orders.map((order) => order.customerName),
        ...customer.orders.map((order) => order.customerEmail),
        ...customer.orders.map((order) => order.detail),
        ...customer.orders.map((order) => order.status),
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
              <HeroStat label="Tracked spend" value={formatMoney(totalSpendCents)} />
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
        <SummaryCard label="Tracked spend" value={formatMoney(totalSpendCents)} />
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

                    {customer.types.has("donation") ? (
                      <Link
                        href={`/admin/donations`}
                        className="smallLinkMuted"
                        style={styles.smallLinkMuted}
                      >
                        Donation report
                      </Link>
                    ) : null}

                    {recentOrders[0]?.adminHref ? (
                      <Link
                        href={recentOrders[0].adminHref}
                        className="smallLinkMuted"
                        style={styles.smallLinkMuted}
                      >
                        Latest activity
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
.customers-page,
.customers-page * {
  box-sizing: border-box;
}

.customers-page {
  overflow-x: hidden;
}

.customers-page section,
.customers-page article,
.customers-page form,
.customers-page div,
.customers-page label {
  min-width: 0;
}

@media (max-width: 980px) {
  .customers-page .heroMainGrid,
  .customers-page .filterForm {
    grid-template-columns: 1fr !important;
  }

  .customers-page .heroStats,
  .customers-page .summaryGrid {
    grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
  }

  .customers-page .heroActions,
  .customers-page .cardActions {
    display: grid !important;
    grid-template-columns: 1fr !important;
  }

  .customers-page .heroPrimaryButton,
  .customers-page .heroSecondaryButton,
  .customers-page .filterButton,
  .customers-page .clearButton,
  .customers-page .smallLink,
  .customers-page .smallLinkMuted {
    width: 100% !important;
    justify-content: center !important;
    text-align: center !important;
  }
}

@media (max-width: 620px) {
  .customers-page {
    width: 100% !important;
    max-width: 100% !important;
    padding: 14px 10px 42px !important;
  }

  .customers-page .hero {
    padding: 18px !important;
    border-radius: 24px !important;
    gap: 14px !important;
  }

  .customers-page .title {
    font-size: clamp(34px, 12vw, 46px) !important;
    line-height: 0.98 !important;
  }

  .customers-page .heroStats,
  .customers-page .summaryGrid,
  .customers-page .heroPanelGrid,
  .customers-page .customerStats {
    grid-template-columns: 1fr !important;
  }

  .customers-page .filterForm {
    display: grid !important;
    grid-template-columns: 1fr !important;
    gap: 12px !important;
    align-items: stretch !important;
  }

  .customers-page .field,
  .customers-page .input,
  .customers-page .filterButton,
  .customers-page .clearButton {
    width: 100% !important;
    max-width: 100% !important;
  }

  .customers-page .customerTop,
  .customers-page .activityRow {
    grid-template-columns: 1fr !important;
  }

  .customers-page .customerCard,
  .customers-page .customersCard,
  .customers-page .filterCard {
    padding: 14px !important;
    border-radius: 20px !important;
  }

  .customers-page .activityRight {
    text-align: left !important;
  }

  .customers-page .spendBadge {
    width: fit-content !important;
    white-space: normal !important;
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
    gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 135px), 1fr))",
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
    gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 320px), 1fr))",
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
    overflow: "hidden",
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
