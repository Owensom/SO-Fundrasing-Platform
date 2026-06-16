import type { CSSProperties, ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { query } from "@/lib/db";
import { getTenantSlugFromHeaders } from "@/lib/tenant";
import { getTenantSettings } from "@/lib/tenant-settings";
import {
  checkSubscriptionCapability,
  getMerchandiseUpgradeMessage,
  getTierLabel,
  normaliseSubscriptionTier,
} from "@/lib/subscription-capabilities";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const DEFAULT_MERCHANDISE_IMAGE_SRC = "/brand/so-default-merchandise.png";

const COMPLETED_FULFILMENT_STATUSES = new Set([
  "collected",
  "delivered",
  "posted",
]);

type TenantSettingsLike = {
  subscription_tier?: string | null;
  subscription_status?: string | null;
  platform_owner_bypass?: boolean | null;
};

type MerchandiseOrder = {
  id: string;
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
  subtotal_cents: number;
  platform_fee_cents: number;
  stripe_fee_cents: number;
  total_cents: number;
  currency: string;
  stripe_checkout_session_id: string | null;
  stripe_payment_intent_id: string | null;
  paid_at: string | null;
  fulfilled_at: string | null;
  fulfilment_status: string;
  internal_note: string | null;
  created_at: string;
  updated_at: string;
  item_count: number;
  total_quantity: number;
  product_titles: string | null;
};

function cleanText(value: unknown, fallback = "") {
  const clean = String(value ?? "").trim();
  return clean || fallback;
}

function formatMoney(cents: number, currency = "GBP") {
  try {
    return new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency: cleanText(currency, "GBP"),
    }).format(Number(cents || 0) / 100);
  } catch {
    return `£${(Number(cents || 0) / 100).toFixed(2)}`;
  }
}

function formatDate(value: string | null | undefined) {
  if (!value) return "Not set";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Not set";
  }

  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function orderStatusLabel(status: string) {
  if (status === "checkout_started") return "Checkout started";
  if (status === "paid") return "Paid";
  if (status === "payment_failed") return "Payment failed";
  if (status === "cancelled") return "Cancelled";
  if (status === "refunded") return "Refunded";
  if (status === "fulfilled") return "Fulfilled";
  if (status === "part_fulfilled") return "Part fulfilled";
  return "Draft";
}

function fulfilmentStatusLabel(status: string) {
  if (status === "ready_for_collection") return "Ready for collection";
  if (status === "collected") return "Collected";
  if (status === "ready_for_delivery") return "Ready for delivery";
  if (status === "delivered") return "Delivered";
  if (status === "posted") return "Posted";
  if (status === "arranged") return "Arranged";
  if (status === "cancelled") return "Cancelled";
  return "Not started";
}

function fulfilmentMethodLabel(method: string | null) {
  if (method === "collect_stand") return "Collect from stand";
  if (method === "collect_table") return "Collect from table";
  if (method === "deliver_table") return "Deliver to table";
  if (method === "deliver_seat") return "Deliver to seat";
  if (method === "post_after_event") return "Post after event";
  if (method === "arrange_with_organiser") return "Arrange with organiser";
  return "Not selected";
}

function isCompletedFulfilmentStatus(status: string | null | undefined) {
  return COMPLETED_FULFILMENT_STATUSES.has(cleanText(status));
}

function fulfilmentTimestampLabel(order: MerchandiseOrder) {
  if (isCompletedFulfilmentStatus(order.fulfilment_status)) {
    return "Fulfilled at";
  }

  if (
    order.fulfilment_status === "ready_for_collection" ||
    order.fulfilment_status === "ready_for_delivery" ||
    order.fulfilment_status === "arranged"
  ) {
    return "Fulfilment updated";
  }

  return "Last updated";
}

function fulfilmentTimestampValue(order: MerchandiseOrder) {
  if (isCompletedFulfilmentStatus(order.fulfilment_status)) {
    return formatDate(order.fulfilled_at);
  }

  return formatDate(order.updated_at);
}

function statusTone(status: string): "good" | "warning" | "neutral" | "danger" {
  if (status === "paid" || status === "fulfilled") return "good";
  if (status === "checkout_started" || status === "part_fulfilled") {
    return "warning";
  }
  if (status === "payment_failed" || status === "cancelled") return "danger";
  return "neutral";
}

function statusPillStyle(tone: "good" | "warning" | "neutral" | "danger") {
  if (tone === "good") {
    return {
      background: "#dcfce7",
      color: "#166534",
      borderColor: "#86efac",
    };
  }

  if (tone === "warning") {
    return {
      background: "#fffbeb",
      color: "#92400e",
      borderColor: "#fde68a",
    };
  }

  if (tone === "danger") {
    return {
      background: "#fef2f2",
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

async function requireTenantAccess() {
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

  return tenantSlug;
}

async function listMerchandiseOrders(tenantSlug: string) {
  return query<MerchandiseOrder>(
    `
      select
        merchandise_orders.id::text,
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
        coalesce(count(merchandise_order_items.id), 0)::int as item_count,
        coalesce(sum(merchandise_order_items.quantity), 0)::int as total_quantity,
        string_agg(
          merchandise_order_items.product_title,
          ', '
          order by merchandise_order_items.created_at asc
        ) as product_titles
      from merchandise_orders
      left join events
        on events.id = merchandise_orders.linked_event_id
       and events.tenant_slug = merchandise_orders.tenant_slug
      left join merchandise_order_items
        on merchandise_order_items.order_id = merchandise_orders.id
       and merchandise_order_items.tenant_slug = merchandise_orders.tenant_slug
      where merchandise_orders.tenant_slug = $1
      group by
        merchandise_orders.id,
        events.title
      order by merchandise_orders.created_at desc
    `,
    [tenantSlug],
  );
}

export default async function AdminMerchandiseOrdersPage() {
  const tenantSlug = await requireTenantAccess();

  const [tenantSettingsRaw, orders] = await Promise.all([
    getTenantSettings(tenantSlug),
    listMerchandiseOrders(tenantSlug),
  ]);

  const tenantSettings = tenantSettingsRaw as TenantSettingsLike | null;
  const tier = normaliseSubscriptionTier(tenantSettings?.subscription_tier);

  const subscriptionTenant = {
    subscription_tier: tier,
    subscription_status:
      cleanText(tenantSettings?.subscription_status, "active") || "active",
    platform_owner_bypass: Boolean(tenantSettings?.platform_owner_bypass),
  };

  const merchandiseCapability = checkSubscriptionCapability(
    subscriptionTenant,
    "merchandise",
  );

  const paidOrders = orders.filter((order) => order.status === "paid");
  const checkoutStartedOrders = orders.filter(
    (order) => order.status === "checkout_started",
  );
  const fulfilledOrders = orders.filter(
    (order) => order.status === "fulfilled",
  );

  const paidOrFulfilmentOrders = orders.filter(
    (order) =>
      order.status === "paid" ||
      order.status === "fulfilled" ||
      order.status === "part_fulfilled",
  );

  const paidTotalCents = paidOrders.reduce(
    (sum, order) => sum + Number(order.total_cents || 0),
    0,
  );

  if (!merchandiseCapability.allowed) {
    return (
      <main className="admin-merchandise-orders-page" style={styles.page}>
        <style>{responsiveStyles}</style>

        <section style={styles.lockedPanel}>
          <p style={styles.kicker}>Upgrade required</p>

          <h1 style={styles.lockedTitle}>Merchandise is not available</h1>

          <p style={styles.lockedText}>
            {merchandiseCapability.reason || getMerchandiseUpgradeMessage()}
          </p>

          <Link href="/admin/settings/billing" style={styles.primaryButton}>
            View billing →
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className="admin-merchandise-orders-page" style={styles.page}>
      <style>{responsiveStyles}</style>

      <section className="orders-hero" style={styles.hero}>
        <div className="hero-main-row" style={styles.heroMainRow}>
          <div className="hero-brand-row" style={styles.heroBrandRow}>
            <div className="hero-logo-plate" style={styles.heroLogoPlate}>
              <img
                src={DEFAULT_MERCHANDISE_IMAGE_SRC}
                alt=""
                aria-hidden="true"
                style={styles.heroLogo}
              />
            </div>

            <div style={styles.heroTitleBlock}>
              <div style={styles.heroTopRow}>
                <div style={styles.badgeRow}>
                  <span style={styles.statusBadge}>Merchandise orders</span>
                  <span style={styles.planBadge}>{getTierLabel(tier)} plan</span>
                  <span style={styles.phaseBadge}>Checkout live</span>
                </div>

                <Link href="/admin/merchandise" style={styles.secondaryHeroButton}>
                  ← Merchandise
                </Link>
              </div>

              <h1 className="orders-title" style={styles.heroTitle}>
                Orders
              </h1>

              <p style={styles.heroDescription}>
                Review merchandise orders from the live basket and Stripe
                checkout flow. Buyer details, payment times and fulfilment
                tracking are shown directly from the order record.
              </p>
            </div>
          </div>

          <div className="hero-actions-panel" style={styles.heroActionsPanel}>
            <Link
              href="/admin/merchandise/fulfilment"
              style={styles.heroPrimaryActionButton}
            >
              Fulfilment planning →
            </Link>

            <Link href="/admin/merchandise" style={styles.heroSecondaryActionButton}>
              Product catalogue →
            </Link>
          </div>
        </div>

        <div className="hero-stats" style={styles.heroStats}>
          <StatCard label="Orders" value={orders.length} />
          <StatCard
            label="Checkout started"
            value={checkoutStartedOrders.length}
          />
          <StatCard label="Paid" value={paidOrders.length} />
          <StatCard label="Ready to fulfil" value={paidOrFulfilmentOrders.length} />
          <StatCard label="Fulfilled" value={fulfilledOrders.length} />
          <StatCard label="Paid recorded" value={formatMoney(paidTotalCents)} />
        </div>
      </section>

      <section className="readiness-grid" style={styles.readinessGrid}>
        <ReadinessCard
          label="Checkout"
          value="Connected"
          detail="Public basket checkout is live and creates Stripe sessions from validated merchandise orders."
          tone="good"
        />

        <ReadinessCard
          label="Payments"
          value="Webhook live"
          detail="Successful Stripe payments mark merchandise orders as paid and store the payment intent."
          tone="good"
        />

        <ReadinessCard
          label="Stock automation"
          value="Connected"
          detail="Sold quantity is increased only after successful payment confirmation."
          tone="good"
        />

        <ReadinessCard
          label="Receipts"
          value="Connected"
          detail="Customer merchandise receipt emails are sent with tenant branding after successful payment."
          tone="good"
        />
      </section>

      {orders.length === 0 ? (
        <section style={styles.emptyState}>
          <div style={styles.emptyIcon}>
            <img
              src={DEFAULT_MERCHANDISE_IMAGE_SRC}
              alt=""
              aria-hidden="true"
              style={styles.emptyIconImage}
            />
          </div>

          <h2 style={styles.emptyTitle}>No merchandise orders yet</h2>

          <p style={styles.emptyText}>
            Merchandise checkout is connected. Orders will appear here once a
            customer adds products to their basket and starts or completes
            secure checkout.
          </p>

          <div className="empty-actions" style={styles.emptyActions}>
            <Link href="/admin/merchandise" style={styles.primaryButton}>
              Product catalogue →
            </Link>

            <Link
              href="/admin/merchandise/fulfilment"
              style={styles.secondaryButton}
            >
              Fulfilment planning →
            </Link>
          </div>
        </section>
      ) : (
        <section className="orders-list-section" style={styles.ordersSection}>
          <div style={styles.sectionHeader}>
            <div>
              <p style={styles.kicker}>Order records</p>
              <h2 style={styles.sectionTitle}>Merchandise orders</h2>
              <p style={styles.sectionText}>
                Live order records grouped by most recent first. Buyer details
                are shown clearly, and fulfilment timing separates completed
                fulfilment from last fulfilment update.
              </p>
            </div>

            <Link
              href="/admin/merchandise/orders/export"
              prefetch={false}
              style={styles.exportButton}
            >
              Export CSV ↓
            </Link>
          </div>

          <div style={styles.ordersList}>
            {orders.map((order) => (
              <OrderCard key={order.id} order={order} />
            ))}
          </div>
        </section>
      )}
    </main>
  );
}

function StatCard({ label, value }: { label: string; value: ReactNode }) {
  return (
    <article style={styles.statCard}>
      <span style={styles.statLabel}>{label}</span>
      <strong style={styles.statValue}>{value}</strong>
    </article>
  );
}

function ReadinessCard({
  label,
  value,
  detail,
  tone,
}: {
  label: string;
  value: ReactNode;
  detail: string;
  tone: "good" | "warning" | "neutral";
}) {
  return (
    <article
      style={{
        ...styles.readinessCard,
        ...(tone === "good"
          ? styles.readinessGood
          : tone === "warning"
            ? styles.readinessWarning
            : styles.readinessNeutral),
      }}
    >
      <span style={styles.readinessLabel}>{label}</span>
      <strong style={styles.readinessValue}>{value}</strong>
      <p style={styles.readinessText}>{detail}</p>
    </article>
  );
}

function OrderCard({ order }: { order: MerchandiseOrder }) {
  const tone = statusTone(order.status);

  return (
    <article
      style={{
        ...styles.orderCard,
        ...(tone === "good"
          ? styles.orderGood
          : tone === "warning"
            ? styles.orderWarning
            : tone === "danger"
              ? styles.orderDanger
              : styles.orderNeutral),
      }}
    >
      <div className="order-main-row" style={styles.orderMainRow}>
        <div style={styles.orderTitleBlock}>
          <div style={styles.orderPillRow}>
            <span
              style={{
                ...styles.statusPill,
                ...statusPillStyle(tone),
              }}
            >
              {orderStatusLabel(order.status)}
            </span>

            <span style={styles.fulfilmentPill}>
              {fulfilmentStatusLabel(order.fulfilment_status)}
            </span>
          </div>

          <h3 style={styles.orderTitle}>{order.order_reference}</h3>

          <p style={styles.orderSubtitle}>
            Buyer: {cleanText(order.customer_name, "No customer name")} ·{" "}
            {cleanText(order.customer_email, "No email")} · Ordered{" "}
            {formatDate(order.created_at)}
          </p>
        </div>

        <div style={styles.orderTotalBlock}>
          <span style={styles.orderTotalLabel}>Total</span>
          <strong style={styles.orderTotalValue}>
            {formatMoney(order.total_cents, order.currency)}
          </strong>
        </div>
      </div>

      <div className="order-info-grid" style={styles.orderInfoGrid}>
        <InfoBlock
          label="Buyer name"
          value={cleanText(order.customer_name, "No customer name")}
          tone={cleanText(order.customer_name) ? "good" : "warning"}
        />

        <InfoBlock
          label="Buyer email"
          value={cleanText(order.customer_email, "No buyer email")}
          tone={cleanText(order.customer_email) ? "good" : "warning"}
        />

        <InfoBlock
          label="Buyer phone"
          value={cleanText(order.customer_phone, "Not provided")}
        />

        <InfoBlock label="Paid at" value={formatDate(order.paid_at)} />

        <InfoBlock
          label="Items"
          value={`${order.item_count} line item${
            order.item_count === 1 ? "" : "s"
          } · ${order.total_quantity} total`}
        />

        <InfoBlock
          label="Products"
          value={cleanText(order.product_titles, "No items recorded")}
        />

        <InfoBlock
          label="Event"
          value={cleanText(order.linked_event_title, "No linked event")}
        />

        <InfoBlock
          label="Fulfilment method"
          value={fulfilmentMethodLabel(order.fulfilment_method)}
        />

        <InfoBlock
          label="Fulfilment status"
          value={fulfilmentStatusLabel(order.fulfilment_status)}
        />

        <InfoBlock
          label={fulfilmentTimestampLabel(order)}
          value={fulfilmentTimestampValue(order)}
        />

        <InfoBlock label="Order updated" value={formatDate(order.updated_at)} />

        <InfoBlock
          label="Booking reference"
          value={cleanText(order.booking_reference, "Not provided")}
        />

        <InfoBlock
          label="Table / seat"
          value={
            [
              cleanText(order.table_number),
              cleanText(order.seat_number),
            ].filter(Boolean).join(" / ") || "Not provided"
          }
        />

        <InfoBlock
          label="Guest / recipient"
          value={cleanText(order.guest_name, "Not provided")}
        />

        <InfoBlock
          label="Customer note"
          value={cleanText(order.customer_note, "No customer note")}
        />

        <InfoBlock
          label="Internal note"
          value={cleanText(order.internal_note, "No internal note")}
        />

        <InfoBlock
          label="Stripe checkout"
          value={
            cleanText(order.stripe_checkout_session_id)
              ? "Session stored"
              : "Not started"
          }
        />

        <InfoBlock
          label="Payment intent"
          value={
            cleanText(order.stripe_payment_intent_id)
              ? "Payment intent stored"
              : "Not stored"
          }
        />
      </div>
    </article>
  );
}

function InfoBlock({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: ReactNode;
  tone?: "good" | "warning" | "neutral";
}) {
  return (
    <div
      style={{
        ...styles.infoBlock,
        ...(tone === "good"
          ? styles.infoBlockGood
          : tone === "warning"
            ? styles.infoBlockWarning
            : null),
      }}
    >
      <span style={styles.infoLabel}>{label}</span>
      <strong style={styles.infoValue}>{value}</strong>
    </div>
  );
}

const responsiveStyles = `
.admin-merchandise-orders-page,
.admin-merchandise-orders-page * {
  box-sizing: border-box;
}

.admin-merchandise-orders-page {
  overflow-x: hidden;
}

.admin-merchandise-orders-page section,
.admin-merchandise-orders-page article,
.admin-merchandise-orders-page div,
.admin-merchandise-orders-page a,
.admin-merchandise-orders-page p,
.admin-merchandise-orders-page h1,
.admin-merchandise-orders-page h2,
.admin-merchandise-orders-page h3,
.admin-merchandise-orders-page strong,
.admin-merchandise-orders-page span {
  min-width: 0;
  max-width: 100%;
}

@media (max-width: 920px) {
  .admin-merchandise-orders-page .hero-main-row,
  .admin-merchandise-orders-page .hero-brand-row,
  .admin-merchandise-orders-page .order-main-row {
    grid-template-columns: 1fr !important;
  }

  .admin-merchandise-orders-page .hero-stats,
  .admin-merchandise-orders-page .readiness-grid,
  .admin-merchandise-orders-page .order-info-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
  }

  .admin-merchandise-orders-page .hero-actions-panel {
    display: grid !important;
    grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
    width: 100% !important;
    max-width: none !important;
    justify-self: stretch !important;
    align-items: stretch !important;
  }

  .admin-merchandise-orders-page .hero-actions-panel a {
    width: 100% !important;
  }

  .admin-merchandise-orders-page .hero-logo-plate {
    width: 132px !important;
    height: 132px !important;
  }
}

@media (max-width: 640px) {
  .admin-merchandise-orders-page {
    padding: 18px 12px 44px !important;
  }

  .admin-merchandise-orders-page .orders-hero,
  .admin-merchandise-orders-page .orders-list-section {
    padding: 18px !important;
    border-radius: 24px !important;
  }

  .admin-merchandise-orders-page .orders-title {
    font-size: clamp(42px, 14vw, 58px) !important;
    line-height: 0.98 !important;
  }

  .admin-merchandise-orders-page .hero-logo-plate {
    width: 110px !important;
    height: 110px !important;
  }

  .admin-merchandise-orders-page .hero-stats,
  .admin-merchandise-orders-page .readiness-grid,
  .admin-merchandise-orders-page .order-info-grid,
  .admin-merchandise-orders-page .hero-actions-panel {
    grid-template-columns: 1fr !important;
  }

  .admin-merchandise-orders-page .empty-actions {
    display: grid !important;
    grid-template-columns: 1fr !important;
    width: 100% !important;
  }

  .admin-merchandise-orders-page a {
    width: 100% !important;
  }
}
`;

const styles: Record<string, CSSProperties> = {
  page: {
    width: "100%",
    maxWidth: 1180,
    margin: "0 auto",
    padding: "28px 16px 64px",
    minHeight: "100vh",
    background:
      "radial-gradient(circle at top left, rgba(251,191,36,0.10), transparent 34%), radial-gradient(circle at top right, rgba(22,131,248,0.08), transparent 32%), #f8fafc",
    color: "#0f172a",
    overflowX: "hidden",
  },

  hero: {
    display: "grid",
    gap: 16,
    padding: 20,
    borderRadius: 28,
    background:
      "radial-gradient(circle at 96% 0%, rgba(250,204,21,0.18), transparent 30%), linear-gradient(135deg, #020617 0%, #0f172a 58%, #172554 100%)",
    color: "#ffffff",
    marginBottom: 18,
    boxShadow: "0 24px 60px rgba(15,23,42,0.18)",
    overflow: "hidden",
  },

  heroMainRow: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) 220px",
    gap: 16,
    alignItems: "start",
    minWidth: 0,
  },

  heroBrandRow: {
    display: "grid",
    gridTemplateColumns: "132px minmax(0, 1fr)",
    gap: 16,
    alignItems: "center",
    minWidth: 0,
  },

  heroLogoPlate: {
    display: "grid",
    placeItems: "center",
    width: 132,
    height: 132,
    borderRadius: 24,
    background:
      "linear-gradient(135deg, rgba(255,255,255,0.98), rgba(248,250,252,0.94))",
    border: "1px solid rgba(255,255,255,0.20)",
    boxShadow:
      "0 18px 38px rgba(0,0,0,0.20), inset 0 1px 0 rgba(255,255,255,0.86)",
    overflow: "hidden",
    padding: 14,
  },

  heroLogo: {
    display: "block",
    width: "100%",
    height: "100%",
    objectFit: "contain",
  },

  heroTitleBlock: {
    display: "grid",
    gap: 10,
    minWidth: 0,
  },

  heroTopRow: {
    display: "flex",
    gap: 12,
    justifyContent: "space-between",
    alignItems: "center",
    flexWrap: "wrap",
  },

  badgeRow: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
    alignItems: "center",
  },

  statusBadge: {
    display: "inline-flex",
    width: "fit-content",
    padding: "8px 12px",
    borderRadius: 999,
    background: "#dcfce7",
    color: "#166534",
    border: "1px solid #bbf7d0",
    fontSize: 13,
    fontWeight: 950,
    whiteSpace: "nowrap",
  },

  planBadge: {
    display: "inline-flex",
    width: "fit-content",
    padding: "8px 12px",
    borderRadius: 999,
    background: "rgba(255,255,255,0.08)",
    color: "#dbeafe",
    border: "1px solid rgba(191,219,254,0.36)",
    fontSize: 13,
    fontWeight: 950,
    whiteSpace: "nowrap",
  },

  phaseBadge: {
    display: "inline-flex",
    width: "fit-content",
    padding: "8px 12px",
    borderRadius: 999,
    background: "rgba(34,197,94,0.14)",
    color: "#bbf7d0",
    border: "1px solid rgba(134,239,172,0.54)",
    fontSize: 13,
    fontWeight: 950,
    whiteSpace: "nowrap",
  },

  heroTitle: {
    margin: 0,
    color: "#ffffff",
    fontSize: "clamp(42px, 6vw, 64px)",
    lineHeight: 0.94,
    letterSpacing: "-0.078em",
    overflowWrap: "anywhere",
  },

  heroDescription: {
    margin: 0,
    color: "#dbeafe",
    lineHeight: 1.5,
    fontWeight: 720,
    maxWidth: 820,
    overflowWrap: "anywhere",
  },

  heroStats: {
    display: "grid",
    gridTemplateColumns: "repeat(6, minmax(0, 1fr))",
    gap: 9,
  },

  statCard: {
    padding: 12,
    borderRadius: 16,
    background: "rgba(255,255,255,0.09)",
    border: "1px solid rgba(255,255,255,0.15)",
    minWidth: 0,
  },

  statLabel: {
    display: "block",
    color: "#fde68a",
    fontSize: 11,
    lineHeight: 1.1,
    fontWeight: 900,
    textTransform: "uppercase",
    letterSpacing: "0.04em",
  },

  statValue: {
    display: "block",
    marginTop: 5,
    color: "#ffffff",
    fontSize: 21,
    lineHeight: 1,
    fontWeight: 950,
    overflowWrap: "anywhere",
  },

  heroActionsPanel: {
    display: "flex",
    flexDirection: "column",
    gap: 10,
    alignItems: "stretch",
    justifyContent: "flex-start",
    justifySelf: "end",
    alignSelf: "start",
    width: "100%",
    maxWidth: 220,
    minWidth: 0,
  },

  heroPrimaryActionButton: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    minHeight: 48,
    padding: "11px 16px",
    borderRadius: 999,
    background: "#1683f8",
    color: "#ffffff",
    border: "1px solid rgba(255,255,255,0.16)",
    textDecoration: "none",
    fontWeight: 950,
    fontSize: 14,
    lineHeight: 1.2,
    textAlign: "center",
    whiteSpace: "normal",
    boxShadow: "0 14px 30px rgba(22,131,248,0.30)",
  },

  heroSecondaryActionButton: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    minHeight: 48,
    padding: "11px 16px",
    borderRadius: 999,
    background: "#ffffff",
    color: "#0f172a",
    border: "1px solid rgba(255,255,255,0.72)",
    textDecoration: "none",
    fontWeight: 950,
    fontSize: 14,
    lineHeight: 1.2,
    textAlign: "center",
    whiteSpace: "normal",
    boxShadow: "0 14px 30px rgba(15,23,42,0.18)",
  },

  primaryButton: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: "fit-content",
    minHeight: 44,
    padding: "10px 15px",
    borderRadius: 999,
    background: "#1683f8",
    color: "#ffffff",
    border: "1px solid #1683f8",
    textDecoration: "none",
    fontWeight: 950,
    textAlign: "center",
  },

  secondaryButton: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: "fit-content",
    minHeight: 44,
    padding: "10px 15px",
    borderRadius: 999,
    background: "#ffffff",
    color: "#0f172a",
    border: "1px solid #cbd5e1",
    textDecoration: "none",
    fontWeight: 950,
    textAlign: "center",
  },

  secondaryHeroButton: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: "fit-content",
    minHeight: 40,
    padding: "9px 13px",
    borderRadius: 999,
    background: "#ffffff",
    color: "#0f172a",
    textDecoration: "none",
    fontSize: 13,
    fontWeight: 950,
    whiteSpace: "nowrap",
  },

  exportButton: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: "fit-content",
    minHeight: 44,
    padding: "10px 15px",
    borderRadius: 999,
    background: "#0f172a",
    color: "#ffffff",
    border: "1px solid #0f172a",
    textDecoration: "none",
    fontWeight: 950,
    textAlign: "center",
    whiteSpace: "nowrap",
  },

  readinessGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
    gap: 12,
    marginBottom: 18,
  },

  readinessCard: {
    display: "grid",
    gap: 6,
    padding: 15,
    borderRadius: 22,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    boxShadow: "0 8px 22px rgba(15,23,42,0.04)",
  },

  readinessGood: {
    background: "linear-gradient(135deg, #ecfdf5 0%, #ffffff 80%)",
    borderColor: "#bbf7d0",
  },

  readinessWarning: {
    background: "linear-gradient(135deg, #fff7ed 0%, #ffffff 80%)",
    borderColor: "#fed7aa",
  },

  readinessNeutral: {
    background: "linear-gradient(135deg, #f8fafc 0%, #ffffff 80%)",
    borderColor: "#e2e8f0",
  },

  readinessLabel: {
    color: "#64748b",
    fontSize: 11,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.06em",
  },

  readinessValue: {
    color: "#0f172a",
    fontSize: 18,
    fontWeight: 950,
    overflowWrap: "anywhere",
  },

  readinessText: {
    margin: 0,
    color: "#64748b",
    fontSize: 12,
    lineHeight: 1.4,
    fontWeight: 730,
  },

  ordersSection: {
    display: "grid",
    gap: 14,
    padding: 20,
    borderRadius: 26,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    boxShadow: "0 10px 30px rgba(15,23,42,0.05)",
  },

  sectionHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: 14,
    flexWrap: "wrap",
    alignItems: "flex-start",
  },

  kicker: {
    margin: 0,
    color: "#2563eb",
    fontSize: 12,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
  },

  sectionTitle: {
    margin: "5px 0 0",
    color: "#0f172a",
    fontSize: 30,
    lineHeight: 1.05,
    letterSpacing: "-0.055em",
    overflowWrap: "anywhere",
  },

  sectionText: {
    margin: "7px 0 0",
    color: "#64748b",
    lineHeight: 1.45,
    fontWeight: 740,
  },

  ordersList: {
    display: "grid",
    gap: 12,
  },

  orderCard: {
    display: "grid",
    gap: 12,
    padding: 14,
    borderRadius: 22,
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
  },

  orderGood: {
    background: "linear-gradient(135deg, #f0fdf4 0%, #ffffff 84%)",
    borderColor: "#bbf7d0",
  },

  orderWarning: {
    background: "linear-gradient(135deg, #fffbeb 0%, #ffffff 84%)",
    borderColor: "#fde68a",
  },

  orderDanger: {
    background: "linear-gradient(135deg, #fef2f2 0%, #ffffff 84%)",
    borderColor: "#fecaca",
  },

  orderNeutral: {
    background: "linear-gradient(135deg, #f8fafc 0%, #ffffff 84%)",
    borderColor: "#e2e8f0",
  },

  orderMainRow: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) auto",
    gap: 12,
    alignItems: "start",
  },

  orderTitleBlock: {
    display: "grid",
    gap: 7,
  },

  orderPillRow: {
    display: "flex",
    gap: 7,
    flexWrap: "wrap",
  },

  statusPill: {
    display: "inline-flex",
    alignItems: "center",
    width: "fit-content",
    padding: "6px 9px",
    borderRadius: 999,
    border: "1px solid",
    fontSize: 11,
    fontWeight: 950,
    whiteSpace: "nowrap",
  },

  fulfilmentPill: {
    display: "inline-flex",
    alignItems: "center",
    width: "fit-content",
    padding: "6px 9px",
    borderRadius: 999,
    background: "#ffffff",
    color: "#475569",
    border: "1px solid #e2e8f0",
    fontSize: 11,
    fontWeight: 950,
    whiteSpace: "nowrap",
  },

  orderTitle: {
    margin: 0,
    color: "#0f172a",
    fontSize: 24,
    lineHeight: 1.08,
    letterSpacing: "-0.045em",
    overflowWrap: "anywhere",
  },

  orderSubtitle: {
    margin: 0,
    color: "#64748b",
    fontSize: 13,
    lineHeight: 1.35,
    fontWeight: 800,
    overflowWrap: "anywhere",
  },

  orderTotalBlock: {
    display: "grid",
    gap: 4,
    justifyItems: "end",
    padding: 12,
    borderRadius: 18,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    minWidth: 150,
  },

  orderTotalLabel: {
    color: "#64748b",
    fontSize: 10,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.06em",
  },

  orderTotalValue: {
    color: "#0f172a",
    fontSize: 22,
    lineHeight: 1,
    fontWeight: 950,
  },

  orderInfoGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
    gap: 9,
  },

  infoBlock: {
    display: "grid",
    gap: 4,
    padding: 11,
    borderRadius: 16,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
  },

  infoBlockGood: {
    background: "linear-gradient(135deg, #ecfdf5 0%, #ffffff 82%)",
    borderColor: "#bbf7d0",
  },

  infoBlockWarning: {
    background: "linear-gradient(135deg, #fffbeb 0%, #ffffff 82%)",
    borderColor: "#fde68a",
  },

  infoLabel: {
    color: "#64748b",
    fontSize: 10,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.06em",
  },

  infoValue: {
    color: "#0f172a",
    fontSize: 13,
    lineHeight: 1.35,
    fontWeight: 850,
    overflowWrap: "anywhere",
  },

  emptyState: {
    display: "grid",
    gap: 10,
    justifyItems: "center",
    padding: 28,
    borderRadius: 28,
    background: "#ffffff",
    border: "1px dashed #cbd5e1",
    textAlign: "center",
  },

  emptyIcon: {
    display: "grid",
    placeItems: "center",
    width: 76,
    height: 76,
    borderRadius: 22,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    overflow: "hidden",
  },

  emptyIconImage: {
    display: "block",
    width: "100%",
    height: "100%",
    objectFit: "contain",
    padding: 6,
    boxSizing: "border-box",
  },

  emptyTitle: {
    margin: 0,
    color: "#0f172a",
    fontSize: 30,
    letterSpacing: "-0.05em",
  },

  emptyText: {
    margin: 0,
    color: "#64748b",
    lineHeight: 1.5,
    fontWeight: 740,
    maxWidth: 620,
  },

  emptyActions: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
    justifyContent: "center",
  },

  lockedPanel: {
    display: "grid",
    gap: 10,
    padding: 24,
    borderRadius: 28,
    background: "#ffffff",
    border: "1px solid #fed7aa",
  },

  lockedTitle: {
    margin: 0,
    color: "#0f172a",
    fontSize: 32,
    letterSpacing: "-0.05em",
  },

  lockedText: {
    margin: 0,
    color: "#7c2d12",
    lineHeight: 1.55,
    fontWeight: 750,
  },
};
