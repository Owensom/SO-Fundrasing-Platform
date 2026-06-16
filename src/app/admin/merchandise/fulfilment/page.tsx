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
import { updateMerchandiseOrderFulfilment } from "./actions";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const DEFAULT_MERCHANDISE_IMAGE_SRC = "/brand/so-default-merchandise.png";

type TenantSettingsLike = {
  subscription_tier?: string | null;
  subscription_status?: string | null;
  platform_owner_bypass?: boolean | null;
};

type MerchandiseProduct = {
  id: string;
  tenant_slug: string;
  slug: string;
  title: string;
  status: string;
  price_cents: number;
  currency: string;
  stock_quantity: number | null;
  sold_quantity: number;
  linked_event_id: string | null;
  linked_event_title: string | null;
  linked_event_status: string | null;
  event_linking_enabled: boolean | null;
  fulfilment_collect_stand_enabled: boolean | null;
  fulfilment_collect_table_enabled: boolean | null;
  fulfilment_deliver_table_enabled: boolean | null;
  fulfilment_deliver_seat_enabled: boolean | null;
  fulfilment_post_enabled: boolean | null;
  fulfilment_arrange_with_organiser_enabled: boolean | null;
  fulfilment_notes: string | null;
  require_booking_reference: boolean | null;
  require_table_number: boolean | null;
  require_seat_number: boolean | null;
  require_guest_name: boolean | null;
  created_at: string;
  updated_at: string;
};

type MerchandiseFulfilmentOrder = {
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
  total_cents: number;
  currency: string;
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

type EventGroup = {
  key: string;
  label: string;
  status: string;
  products: MerchandiseProduct[];
};

function cleanText(value: unknown, fallback = "") {
  const clean = String(value ?? "").trim();
  return clean || fallback;
}

function isEnabled(value: boolean | null | undefined, fallback = false) {
  if (typeof value === "boolean") return value;
  return fallback;
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

function statusLabel(status: string) {
  if (status === "published") return "Published";
  if (status === "closed") return "Closed";
  return "Draft";
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

function fulfilmentStatusLabel(status: string | null | undefined) {
  if (status === "ready_for_collection") return "Ready for collection";
  if (status === "collected") return "Collected";
  if (status === "ready_for_delivery") return "Ready for delivery";
  if (status === "delivered") return "Delivered";
  if (status === "posted") return "Posted";
  if (status === "arranged") return "Arranged";
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

function fulfilmentStatusTone(status: string | null | undefined) {
  if (status === "collected" || status === "delivered" || status === "posted") {
    return "good";
  }

  if (
    status === "ready_for_collection" ||
    status === "ready_for_delivery" ||
    status === "arranged"
  ) {
    return "warning";
  }

  return "neutral";
}

function getPublicProductHref(product: MerchandiseProduct) {
  return `/m/${encodeURIComponent(product.tenant_slug)}/${encodeURIComponent(
    product.slug,
  )}`;
}

function getStockLabel(product: MerchandiseProduct) {
  if (product.stock_quantity === null) {
    return "Manual / not limited";
  }

  const remaining = Math.max(
    0,
    Number(product.stock_quantity || 0) - Number(product.sold_quantity || 0),
  );

  if (remaining === 1) {
    return "1 remaining";
  }

  return `${remaining} remaining`;
}

function getEventLabel(product: MerchandiseProduct) {
  if (!isEnabled(product.event_linking_enabled)) {
    return "Not event-linked";
  }

  return cleanText(product.linked_event_title) || "Event link enabled";
}

function getEventGroupKey(product: MerchandiseProduct) {
  if (!isEnabled(product.event_linking_enabled)) {
    return "__not_linked__";
  }

  return cleanText(product.linked_event_id) || "__linked_missing_event__";
}

function getEventGroupLabel(product: MerchandiseProduct) {
  if (!isEnabled(product.event_linking_enabled)) {
    return "Not linked to an event";
  }

  return cleanText(product.linked_event_title) || "Linked event not found";
}

function getEventGroupStatus(product: MerchandiseProduct) {
  if (!isEnabled(product.event_linking_enabled)) {
    return "none";
  }

  return cleanText(product.linked_event_status, "unknown");
}

function getFulfilmentOptions(product: MerchandiseProduct) {
  const options: string[] = [];

  if (isEnabled(product.fulfilment_collect_stand_enabled, true)) {
    options.push("Stand collection");
  }

  if (isEnabled(product.fulfilment_collect_table_enabled)) {
    options.push("Table collection");
  }

  if (isEnabled(product.fulfilment_deliver_table_enabled)) {
    options.push("Table delivery");
  }

  if (isEnabled(product.fulfilment_deliver_seat_enabled)) {
    options.push("Seat delivery");
  }

  if (isEnabled(product.fulfilment_post_enabled)) {
    options.push("Post after event");
  }

  if (isEnabled(product.fulfilment_arrange_with_organiser_enabled, true)) {
    options.push("Arrange with organiser");
  }

  return options;
}

function getFulfilmentLabel(product: MerchandiseProduct) {
  const options = getFulfilmentOptions(product);

  if (options.length === 0) {
    return "Needs fulfilment setup";
  }

  return options.join(", ");
}

function getRequiredDetails(product: MerchandiseProduct) {
  const details: string[] = [];

  if (isEnabled(product.require_booking_reference)) {
    details.push("Booking reference");
  }

  if (isEnabled(product.require_table_number)) {
    details.push("Table number");
  }

  if (isEnabled(product.require_seat_number)) {
    details.push("Seat number");
  }

  if (isEnabled(product.require_guest_name)) {
    details.push("Guest name");
  }

  return details;
}

function getRequiredDetailsLabel(product: MerchandiseProduct) {
  const details = getRequiredDetails(product);

  if (details.length === 0) {
    return "No extra checkout details planned";
  }

  return details.join(", ");
}

function getFulfilmentTone(product: MerchandiseProduct): "good" | "warning" {
  return getFulfilmentOptions(product).length > 0 ? "good" : "warning";
}

function getProductPlanningTone(product: MerchandiseProduct) {
  if (product.status !== "published") return "neutral";
  if (getFulfilmentOptions(product).length === 0) return "warning";
  return "good";
}

function groupProductsByEvent(products: MerchandiseProduct[]) {
  const groups = new Map<string, EventGroup>();

  for (const product of products) {
    const key = getEventGroupKey(product);

    if (!groups.has(key)) {
      groups.set(key, {
        key,
        label: getEventGroupLabel(product),
        status: getEventGroupStatus(product),
        products: [],
      });
    }

    groups.get(key)?.products.push(product);
  }

  return Array.from(groups.values()).sort((a, b) => {
    if (a.key === "__not_linked__") return 1;
    if (b.key === "__not_linked__") return -1;
    return a.label.localeCompare(b.label);
  });
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

async function listMerchandiseProducts(tenantSlug: string) {
  return query<MerchandiseProduct>(
    `
      select
        merchandise_products.id,
        merchandise_products.tenant_slug,
        merchandise_products.slug,
        merchandise_products.title,
        merchandise_products.status,
        merchandise_products.price_cents,
        merchandise_products.currency,
        merchandise_products.stock_quantity,
        merchandise_products.sold_quantity,
        merchandise_products.linked_event_id::text,
        events.title as linked_event_title,
        events.status as linked_event_status,
        merchandise_products.event_linking_enabled,
        merchandise_products.fulfilment_collect_stand_enabled,
        merchandise_products.fulfilment_collect_table_enabled,
        merchandise_products.fulfilment_deliver_table_enabled,
        merchandise_products.fulfilment_deliver_seat_enabled,
        merchandise_products.fulfilment_post_enabled,
        merchandise_products.fulfilment_arrange_with_organiser_enabled,
        merchandise_products.fulfilment_notes,
        merchandise_products.require_booking_reference,
        merchandise_products.require_table_number,
        merchandise_products.require_seat_number,
        merchandise_products.require_guest_name,
        merchandise_products.created_at::text,
        merchandise_products.updated_at::text
      from merchandise_products
      left join events
        on events.id = merchandise_products.linked_event_id
       and events.tenant_slug = merchandise_products.tenant_slug
      where merchandise_products.tenant_slug = $1
      order by
        case
          when merchandise_products.status = 'published' then 1
          when merchandise_products.status = 'draft' then 2
          when merchandise_products.status = 'closed' then 3
          else 4
        end,
        merchandise_products.created_at desc
    `,
    [tenantSlug],
  );
}

async function listMerchandiseFulfilmentOrders(tenantSlug: string) {
  return query<MerchandiseFulfilmentOrder>(
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
        merchandise_orders.total_cents,
        merchandise_orders.currency,
        merchandise_orders.paid_at::text,
        merchandise_orders.fulfilled_at::text,
        merchandise_orders.fulfilment_status,
        merchandise_orders.internal_note,
        merchandise_orders.created_at::text,
        merchandise_orders.updated_at::text,
        coalesce(count(merchandise_order_items.id), 0)::int as item_count,
        coalesce(sum(merchandise_order_items.quantity), 0)::int as total_quantity,
        string_agg(
          merchandise_order_items.product_title ||
          coalesce(' — ' || nullif(merchandise_order_items.option_label, ''), ''),
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
        and merchandise_orders.status in ('paid', 'fulfilled', 'part_fulfilled')
      group by
        merchandise_orders.id,
        events.title
      order by
        case
          when merchandise_orders.fulfilment_status in ('not_started', '') then 1
          when merchandise_orders.fulfilment_status in ('ready_for_collection', 'ready_for_delivery', 'arranged') then 2
          when merchandise_orders.fulfilment_status in ('collected', 'delivered', 'posted') then 3
          else 4
        end,
        merchandise_orders.paid_at desc nulls last,
        merchandise_orders.created_at desc
    `,
    [tenantSlug],
  );
}

export default async function AdminMerchandiseFulfilmentPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const saved =
    typeof resolvedSearchParams.saved === "string"
      ? resolvedSearchParams.saved
      : "";
  const error =
    typeof resolvedSearchParams.error === "string"
      ? resolvedSearchParams.error
      : "";

  const tenantSlug = await requireTenantAccess();

  const [tenantSettingsRaw, products, fulfilmentOrders] = await Promise.all([
    getTenantSettings(tenantSlug),
    listMerchandiseProducts(tenantSlug),
    listMerchandiseFulfilmentOrders(tenantSlug),
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

  const publishedProducts = products.filter(
    (product) => product.status === "published",
  );
  const eventLinkedProducts = products.filter((product) =>
    isEnabled(product.event_linking_enabled),
  );
  const fulfilmentConfiguredProducts = products.filter(
    (product) => getFulfilmentOptions(product).length > 0,
  );
  const needsFulfilmentProducts = products.filter(
    (product) => getFulfilmentOptions(product).length === 0,
  );
  const requiresCheckoutDetailsProducts = products.filter(
    (product) => getRequiredDetails(product).length > 0,
  );

  const readyOrders = fulfilmentOrders.filter((order) =>
    ["ready_for_collection", "ready_for_delivery", "arranged"].includes(
      order.fulfilment_status,
    ),
  );

  const completedOrders = fulfilmentOrders.filter((order) =>
    ["collected", "delivered", "posted"].includes(order.fulfilment_status),
  );

  const notStartedOrders = fulfilmentOrders.filter(
    (order) =>
      !order.fulfilment_status || order.fulfilment_status === "not_started",
  );

  const eventGroups = groupProductsByEvent(products);

  if (!merchandiseCapability.allowed) {
    return (
      <main className="admin-merchandise-fulfilment-page" style={styles.page}>
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
    <main className="admin-merchandise-fulfilment-page" style={styles.page}>
      <style>{responsiveStyles}</style>

      <section className="fulfilment-hero" style={styles.hero}>
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
            <div className="hero-top-row" style={styles.heroTopRow}>
              <div style={styles.badgeRow}>
                <span style={styles.statusBadge}>Merchandise fulfilment</span>
                <span style={styles.planBadge}>{getTierLabel(tier)} plan</span>
                <span style={styles.phaseBadge}>Order tracking live</span>
              </div>

              <div className="hero-action-row" style={styles.heroActionRow}>
                <Link
                  href="/admin/merchandise/orders"
                  style={styles.secondaryHeroButton}
                >
                  ← Orders
                </Link>

                <Link href="/admin/merchandise/new" style={styles.primaryPill}>
                  New product →
                </Link>

                <Link
                  href="/admin/merchandise"
                  style={styles.secondaryHeroButton}
                >
                  Product catalogue →
                </Link>
              </div>
            </div>

            <h1 className="fulfilment-title" style={styles.heroTitle}>
              Fulfilment planning
            </h1>

            <p style={styles.heroDescription}>
              Track paid merchandise orders for collection, delivery, posting or
              organiser follow-up. This page only updates fulfilment tracking —
              it does not create payments, resend receipts or change Stripe
              checkout.
            </p>
          </div>
        </div>

        <div className="hero-stats" style={styles.heroStats}>
          <StatCard label="Paid orders" value={fulfilmentOrders.length} />
          <StatCard label="Not started" value={notStartedOrders.length} />
          <StatCard label="Ready / arranged" value={readyOrders.length} />
          <StatCard label="Completed" value={completedOrders.length} />
          <StatCard label="Products" value={products.length} />
          <StatCard label="Event-linked" value={eventLinkedProducts.length} />
        </div>
      </section>

      {saved ? (
        <section style={styles.successPanel}>
          Fulfilment tracking has been updated.
        </section>
      ) : null}

      {error ? (
        <section style={styles.errorPanel}>
          The fulfilment update could not be saved. Please check the order and
          try again.
        </section>
      ) : null}

      <section className="readiness-grid" style={styles.readinessGrid}>
        <ReadinessCard
          label="Checkout"
          value="Preserved"
          detail="Fulfilment tracking does not change basket checkout, Stripe sessions, receipts or payment metadata."
          tone="good"
        />

        <ReadinessCard
          label="Paid order tracking"
          value={`${fulfilmentOrders.length} orders`}
          detail="Only paid, fulfilled or part-fulfilled merchandise orders are shown for organiser action."
          tone={fulfilmentOrders.length ? "good" : "neutral"}
        />

        <ReadinessCard
          label="Fulfilment status"
          value={`${completedOrders.length} completed`}
          detail="Completed statuses set the fulfilled date while keeping checkout and payment history intact."
          tone={completedOrders.length ? "good" : "neutral"}
        />

        <ReadinessCard
          label="Product planning"
          value={`${fulfilmentConfiguredProducts.length} configured`}
          detail="Product setup still shows event links, planned methods and checkout detail requirements."
          tone={fulfilmentConfiguredProducts.length ? "good" : "neutral"}
        />
      </section>

      <section className="orders-panel" style={styles.ordersPanel}>
        <div style={styles.sectionHeader}>
          <div>
            <p style={styles.kicker}>Paid order fulfilment</p>
            <h2 style={styles.sectionTitle}>Orders to fulfil</h2>
            <p style={styles.sectionText}>
              Update order-level fulfilment status and organiser notes. These
              controls are admin-only and tenant-isolated.
            </p>
          </div>

          <Link href="/admin/merchandise/orders" style={styles.darkButton}>
            View orders →
          </Link>
        </div>

        {fulfilmentOrders.length === 0 ? (
          <div style={styles.emptyInline}>
            Paid merchandise orders will appear here after successful Stripe
            payment.
          </div>
        ) : (
          <div style={styles.orderList}>
            {fulfilmentOrders.map((order) => (
              <FulfilmentOrderCard key={order.id} order={order} />
            ))}
          </div>
        )}
      </section>

      <section style={styles.planningIntro}>
        <div>
          <p style={styles.kicker}>Product fulfilment setup</p>
          <h2 style={styles.sectionTitle}>Product planning</h2>
          <p style={styles.sectionText}>
            This preserves the original product planning view, grouped by event,
            so organisers can still check which products have event links,
            collection methods and required customer details.
          </p>
        </div>
      </section>

      {products.length === 0 ? (
        <section style={styles.emptyState}>
          <div style={styles.emptyIcon}>
            <img
              src={DEFAULT_MERCHANDISE_IMAGE_SRC}
              alt=""
              aria-hidden="true"
              style={styles.emptyIconImage}
            />
          </div>

          <h2 style={styles.emptyTitle}>No merchandise products yet</h2>

          <p style={styles.emptyText}>
            Create products first, then return here to review event and
            fulfilment planning.
          </p>

          <Link href="/admin/merchandise/new" style={styles.primaryButton}>
            Create first product →
          </Link>
        </section>
      ) : (
        <section className="event-groups" style={styles.groupsWrapper}>
          {eventGroups.map((group) => (
            <EventGroupCard key={group.key} group={group} />
          ))}
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

function FulfilmentOrderCard({
  order,
}: {
  order: MerchandiseFulfilmentOrder;
}) {
  const tone = fulfilmentStatusTone(order.fulfilment_status);

  return (
    <article
      style={{
        ...styles.orderCard,
        ...(tone === "good"
          ? styles.orderGood
          : tone === "warning"
            ? styles.orderWarning
            : styles.orderNeutral),
      }}
    >
      <div className="order-main-row" style={styles.orderMainRow}>
        <div style={styles.orderTitleBlock}>
          <div style={styles.productPillRow}>
            <span style={styles.statusPill}>{orderStatusLabel(order.status)}</span>
            <span
              style={{
                ...styles.fulfilmentPill,
                ...(tone === "good"
                  ? styles.fulfilmentPillGood
                  : tone === "warning"
                    ? styles.fulfilmentPillWarning
                    : styles.fulfilmentPillNeutral),
              }}
            >
              {fulfilmentStatusLabel(order.fulfilment_status)}
            </span>
          </div>

          <h3 style={styles.productTitle}>{order.order_reference}</h3>

          <p style={styles.productSubtitle}>
            {cleanText(order.customer_name, "No customer name")} ·{" "}
            {cleanText(order.customer_email, "No email")} ·{" "}
            {formatMoney(order.total_cents, order.currency)}
          </p>
        </div>

        <div style={styles.orderTotalBlock}>
          <span style={styles.miniStatLabel}>Paid</span>
          <strong style={styles.miniStatValue}>{formatDate(order.paid_at)}</strong>
        </div>
      </div>

      <div className="planning-grid" style={styles.planningGrid}>
        <InfoBlock
          label="Products"
          value={cleanText(order.product_titles, "No items recorded")}
        />
        <InfoBlock
          label="Items"
          value={`${order.item_count} line item${
            order.item_count === 1 ? "" : "s"
          } · ${order.total_quantity} total`}
        />
        <InfoBlock
          label="Fulfilment method"
          value={fulfilmentMethodLabel(order.fulfilment_method)}
        />
        <InfoBlock
          label="Event"
          value={cleanText(order.linked_event_title, "No linked event")}
        />
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
          label="Guest name"
          value={cleanText(order.guest_name, "Not provided")}
        />
        <InfoBlock
          label="Customer note"
          value={cleanText(order.customer_note, "No customer note")}
        />
        <InfoBlock label="Fulfilled at" value={formatDate(order.fulfilled_at)} />
      </div>

      <form action={updateMerchandiseOrderFulfilment} style={styles.updateForm}>
        <input type="hidden" name="orderId" value={order.id} />

        <label style={styles.formLabel}>
          <span style={styles.formLabelText}>Fulfilment status</span>
          <select
            name="fulfilmentStatus"
            defaultValue={cleanText(order.fulfilment_status, "not_started")}
            style={styles.selectField}
          >
            <option value="not_started">Not started</option>
            <option value="ready_for_collection">Ready for collection</option>
            <option value="ready_for_delivery">Ready for delivery</option>
            <option value="arranged">Arranged with organiser</option>
            <option value="collected">Collected</option>
            <option value="delivered">Delivered</option>
            <option value="posted">Posted</option>
          </select>
        </label>

        <label style={styles.formLabel}>
          <span style={styles.formLabelText}>Internal note</span>
          <textarea
            name="internalNote"
            defaultValue={cleanText(order.internal_note)}
            rows={3}
            placeholder="Optional organiser note, collection update, delivery detail or follow-up reminder."
            style={styles.textareaField}
          />
        </label>

        <button type="submit" style={styles.saveButton}>
          Save fulfilment update
        </button>
      </form>
    </article>
  );
}

function EventGroupCard({ group }: { group: EventGroup }) {
  const publishedCount = group.products.filter(
    (product) => product.status === "published",
  ).length;

  const fulfilmentReadyCount = group.products.filter(
    (product) => getFulfilmentOptions(product).length > 0,
  ).length;

  return (
    <article style={styles.groupCard}>
      <div className="group-header" style={styles.groupHeader}>
        <div>
          <p style={styles.groupKicker}>
            {group.key === "__not_linked__" ? "General merchandise" : "Event"}
          </p>

          <h2 style={styles.groupTitle}>{group.label}</h2>

          <p style={styles.groupText}>
            {group.key === "__not_linked__"
              ? "These products are not linked to a specific event."
              : `Event status: ${statusLabel(group.status)}.`}
          </p>
        </div>

        <div className="group-stats" style={styles.groupStats}>
          <MiniStat label="Products" value={group.products.length} />
          <MiniStat label="Published" value={publishedCount} />
          <MiniStat label="Fulfilment ready" value={fulfilmentReadyCount} />
        </div>
      </div>

      <div style={styles.productList}>
        {group.products.map((product) => (
          <ProductPlanningCard key={product.id} product={product} />
        ))}
      </div>
    </article>
  );
}

function MiniStat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div style={styles.miniStat}>
      <span style={styles.miniStatLabel}>{label}</span>
      <strong style={styles.miniStatValue}>{value}</strong>
    </div>
  );
}

function ProductPlanningCard({ product }: { product: MerchandiseProduct }) {
  const fulfilmentTone = getFulfilmentTone(product);
  const planningTone = getProductPlanningTone(product);

  return (
    <article
      style={{
        ...styles.productCard,
        ...(planningTone === "good"
          ? styles.productGood
          : planningTone === "warning"
            ? styles.productWarning
            : styles.productNeutral),
      }}
    >
      <div className="product-main-row" style={styles.productMainRow}>
        <div style={styles.productTitleBlock}>
          <div style={styles.productPillRow}>
            <span style={styles.statusPill}>{statusLabel(product.status)}</span>

            <span
              style={{
                ...styles.fulfilmentPill,
                ...(fulfilmentTone === "good"
                  ? styles.fulfilmentPillGood
                  : styles.fulfilmentPillWarning),
              }}
            >
              {fulfilmentTone === "good" ? "Fulfilment set" : "Needs setup"}
            </span>
          </div>

          <h3 style={styles.productTitle}>{product.title}</h3>

          <p style={styles.productSubtitle}>
            {formatMoney(product.price_cents, product.currency)} ·{" "}
            {getStockLabel(product)}
          </p>
        </div>

        <div className="product-actions" style={styles.productActions}>
          <Link
            href={`/admin/merchandise/${encodeURIComponent(product.id)}`}
            style={styles.editButton}
          >
            Edit product →
          </Link>

          {product.status === "published" ? (
            <Link
              href={getPublicProductHref(product)}
              target="_blank"
              style={styles.publicButton}
            >
              View public →
            </Link>
          ) : null}
        </div>
      </div>

      <div className="planning-grid" style={styles.planningGrid}>
        <InfoBlock label="Event" value={getEventLabel(product)} />

        <InfoBlock label="Fulfilment" value={getFulfilmentLabel(product)} />

        <InfoBlock
          label="Details later"
          value={getRequiredDetailsLabel(product)}
        />

        <InfoBlock
          label="Organiser note"
          value={cleanText(product.fulfilment_notes) || "No internal note"}
        />

        <InfoBlock label="Created" value={formatDate(product.created_at)} />

        <InfoBlock label="Updated" value={formatDate(product.updated_at)} />
      </div>
    </article>
  );
}

function InfoBlock({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div style={styles.infoBlock}>
      <span style={styles.infoLabel}>{label}</span>
      <strong style={styles.infoValue}>{value}</strong>
    </div>
  );
}

const responsiveStyles = `
.admin-merchandise-fulfilment-page,
.admin-merchandise-fulfilment-page * {
  box-sizing: border-box;
}

.admin-merchandise-fulfilment-page {
  overflow-x: hidden;
}

.admin-merchandise-fulfilment-page section,
.admin-merchandise-fulfilment-page article,
.admin-merchandise-fulfilment-page div,
.admin-merchandise-fulfilment-page a,
.admin-merchandise-fulfilment-page p,
.admin-merchandise-fulfilment-page h1,
.admin-merchandise-fulfilment-page h2,
.admin-merchandise-fulfilment-page h3,
.admin-merchandise-fulfilment-page strong,
.admin-merchandise-fulfilment-page span,
.admin-merchandise-fulfilment-page form,
.admin-merchandise-fulfilment-page label,
.admin-merchandise-fulfilment-page select,
.admin-merchandise-fulfilment-page textarea,
.admin-merchandise-fulfilment-page button {
  min-width: 0;
  max-width: 100%;
}

@media (max-width: 920px) {
  .admin-merchandise-fulfilment-page .hero-brand-row,
  .admin-merchandise-fulfilment-page .group-header,
  .admin-merchandise-fulfilment-page .product-main-row,
  .admin-merchandise-fulfilment-page .order-main-row {
    grid-template-columns: 1fr !important;
  }

  .admin-merchandise-fulfilment-page .hero-top-row {
    align-items: flex-start !important;
  }

  .admin-merchandise-fulfilment-page .hero-action-row {
    justify-content: flex-start !important;
  }

  .admin-merchandise-fulfilment-page .hero-stats,
  .admin-merchandise-fulfilment-page .readiness-grid,
  .admin-merchandise-fulfilment-page .group-stats,
  .admin-merchandise-fulfilment-page .planning-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
  }

  .admin-merchandise-fulfilment-page .hero-logo-plate {
    width: 116px !important;
    height: 116px !important;
  }
}

@media (max-width: 640px) {
  .admin-merchandise-fulfilment-page {
    padding: 18px 12px 44px !important;
  }

  .admin-merchandise-fulfilment-page .fulfilment-hero,
  .admin-merchandise-fulfilment-page .group-card,
  .admin-merchandise-fulfilment-page .orders-panel,
  .admin-merchandise-fulfilment-page .planning-intro {
    padding: 18px !important;
    border-radius: 24px !important;
  }

  .admin-merchandise-fulfilment-page .fulfilment-title {
    font-size: clamp(38px, 12vw, 54px) !important;
    line-height: 0.98 !important;
  }

  .admin-merchandise-fulfilment-page .hero-logo-plate {
    width: 96px !important;
    height: 96px !important;
  }

  .admin-merchandise-fulfilment-page .hero-stats,
  .admin-merchandise-fulfilment-page .readiness-grid,
  .admin-merchandise-fulfilment-page .group-stats,
  .admin-merchandise-fulfilment-page .planning-grid {
    grid-template-columns: 1fr !important;
  }

  .admin-merchandise-fulfilment-page .hero-action-row,
  .admin-merchandise-fulfilment-page .product-actions {
    display: grid !important;
    grid-template-columns: 1fr !important;
    width: 100% !important;
  }

  .admin-merchandise-fulfilment-page .hero-action-row a,
  .admin-merchandise-fulfilment-page .product-actions a,
  .admin-merchandise-fulfilment-page button {
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

  heroBrandRow: {
    display: "grid",
    gridTemplateColumns: "116px minmax(0, 1fr)",
    gap: 16,
    alignItems: "center",
    minWidth: 0,
  },

  heroLogoPlate: {
    display: "grid",
    placeItems: "center",
    width: 116,
    height: 116,
    borderRadius: 22,
    background:
      "linear-gradient(135deg, rgba(255,255,255,0.98), rgba(248,250,252,0.94))",
    border: "1px solid rgba(255,255,255,0.20)",
    boxShadow:
      "0 14px 30px rgba(0,0,0,0.18), inset 0 1px 0 rgba(255,255,255,0.86)",
    overflow: "hidden",
    padding: 12,
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

  heroActionRow: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
    justifyContent: "flex-end",
    alignItems: "center",
  },

  statusBadge: {
    display: "inline-flex",
    width: "fit-content",
    padding: "7px 11px",
    borderRadius: 999,
    background: "#dcfce7",
    color: "#166534",
    border: "1px solid #bbf7d0",
    fontSize: 12,
    fontWeight: 950,
    whiteSpace: "nowrap",
  },

  planBadge: {
    display: "inline-flex",
    width: "fit-content",
    padding: "7px 11px",
    borderRadius: 999,
    background: "rgba(255,255,255,0.08)",
    color: "#dbeafe",
    border: "1px solid rgba(191,219,254,0.36)",
    fontSize: 12,
    fontWeight: 950,
    whiteSpace: "nowrap",
  },

  phaseBadge: {
    display: "inline-flex",
    width: "fit-content",
    padding: "7px 11px",
    borderRadius: 999,
    background: "rgba(34,197,94,0.14)",
    color: "#bbf7d0",
    border: "1px solid rgba(134,239,172,0.54)",
    fontSize: 12,
    fontWeight: 950,
    whiteSpace: "nowrap",
  },

  heroTitle: {
    margin: 0,
    color: "#ffffff",
    fontSize: "clamp(40px, 5.8vw, 60px)",
    lineHeight: 0.94,
    letterSpacing: "-0.078em",
    overflowWrap: "anywhere",
  },

  heroDescription: {
    margin: 0,
    color: "#dbeafe",
    lineHeight: 1.5,
    fontWeight: 720,
    maxWidth: 880,
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

  primaryPill: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: "fit-content",
    minHeight: 38,
    padding: "9px 13px",
    borderRadius: 999,
    background: "#1683f8",
    color: "#ffffff",
    border: "1px solid #1683f8",
    textDecoration: "none",
    fontSize: 13,
    fontWeight: 950,
    textAlign: "center",
    whiteSpace: "nowrap",
    boxShadow: "0 10px 20px rgba(22,131,248,0.18)",
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

  secondaryHeroButton: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: "fit-content",
    minHeight: 38,
    padding: "9px 13px",
    borderRadius: 999,
    background: "#ffffff",
    color: "#0f172a",
    textDecoration: "none",
    fontSize: 13,
    fontWeight: 950,
    whiteSpace: "nowrap",
  },

  darkButton: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: "fit-content",
    minHeight: 42,
    padding: "9px 14px",
    borderRadius: 999,
    background: "#0f172a",
    color: "#ffffff",
    textDecoration: "none",
    fontSize: 13,
    fontWeight: 950,
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

  successPanel: {
    marginBottom: 14,
    padding: "12px 14px",
    borderRadius: 18,
    background: "#dcfce7",
    color: "#166534",
    border: "1px solid #86efac",
    fontWeight: 900,
  },

  errorPanel: {
    marginBottom: 14,
    padding: "12px 14px",
    borderRadius: 18,
    background: "#fef2f2",
    color: "#991b1b",
    border: "1px solid #fecaca",
    fontWeight: 900,
  },

  ordersPanel: {
    display: "grid",
    gap: 14,
    padding: 20,
    borderRadius: 26,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    boxShadow: "0 10px 30px rgba(15,23,42,0.05)",
    marginBottom: 18,
  },

  sectionHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: 14,
    flexWrap: "wrap",
    alignItems: "flex-start",
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

  emptyInline: {
    padding: 16,
    borderRadius: 20,
    background: "#f8fafc",
    border: "1px dashed #cbd5e1",
    color: "#64748b",
    fontWeight: 780,
  },

  orderList: {
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

  updateForm: {
    display: "grid",
    gap: 10,
    padding: 12,
    borderRadius: 18,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
  },

  formLabel: {
    display: "grid",
    gap: 6,
  },

  formLabelText: {
    color: "#64748b",
    fontSize: 11,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.06em",
  },

  selectField: {
    width: "100%",
    minHeight: 44,
    padding: "10px 12px",
    borderRadius: 14,
    border: "1px solid #cbd5e1",
    background: "#ffffff",
    color: "#0f172a",
    fontSize: 14,
    fontWeight: 800,
  },

  textareaField: {
    width: "100%",
    padding: "11px 12px",
    borderRadius: 14,
    border: "1px solid #cbd5e1",
    background: "#ffffff",
    color: "#0f172a",
    fontSize: 14,
    lineHeight: 1.45,
    fontWeight: 700,
    resize: "vertical",
  },

  saveButton: {
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
    cursor: "pointer",
  },

  planningIntro: {
    display: "grid",
    gap: 10,
    padding: 20,
    borderRadius: 26,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    boxShadow: "0 10px 30px rgba(15,23,42,0.05)",
    marginBottom: 16,
  },

  groupsWrapper: {
    display: "grid",
    gap: 16,
  },

  groupCard: {
    display: "grid",
    gap: 14,
    padding: 20,
    borderRadius: 26,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    boxShadow: "0 10px 30px rgba(15,23,42,0.05)",
  },

  groupHeader: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) minmax(260px, 0.55fr)",
    gap: 14,
    alignItems: "start",
  },

  groupKicker: {
    margin: 0,
    color: "#2563eb",
    fontSize: 12,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
  },

  groupTitle: {
    margin: "5px 0 0",
    color: "#0f172a",
    fontSize: 30,
    lineHeight: 1.05,
    letterSpacing: "-0.055em",
    overflowWrap: "anywhere",
  },

  groupText: {
    margin: "7px 0 0",
    color: "#64748b",
    lineHeight: 1.45,
    fontWeight: 740,
  },

  groupStats: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: 8,
  },

  miniStat: {
    display: "grid",
    gap: 4,
    padding: 12,
    borderRadius: 17,
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
  },

  miniStatLabel: {
    color: "#64748b",
    fontSize: 10,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.06em",
  },

  miniStatValue: {
    color: "#0f172a",
    fontSize: 15,
    lineHeight: 1.2,
    fontWeight: 950,
    overflowWrap: "anywhere",
  },

  productList: {
    display: "grid",
    gap: 11,
  },

  productCard: {
    display: "grid",
    gap: 12,
    padding: 14,
    borderRadius: 22,
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
  },

  productGood: {
    background: "linear-gradient(135deg, #f0fdf4 0%, #ffffff 84%)",
    borderColor: "#bbf7d0",
  },

  productWarning: {
    background: "linear-gradient(135deg, #fffbeb 0%, #ffffff 84%)",
    borderColor: "#fde68a",
  },

  productNeutral: {
    background: "linear-gradient(135deg, #f8fafc 0%, #ffffff 84%)",
    borderColor: "#e2e8f0",
  },

  productMainRow: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) auto",
    gap: 12,
    alignItems: "start",
  },

  productTitleBlock: {
    display: "grid",
    gap: 7,
  },

  productPillRow: {
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
    background: "#ffffff",
    color: "#475569",
    border: "1px solid #e2e8f0",
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
    border: "1px solid",
    fontSize: 11,
    fontWeight: 950,
    whiteSpace: "nowrap",
  },

  fulfilmentPillGood: {
    background: "#dcfce7",
    color: "#166534",
    borderColor: "#86efac",
  },

  fulfilmentPillWarning: {
    background: "#fffbeb",
    color: "#92400e",
    borderColor: "#fde68a",
  },

  fulfilmentPillNeutral: {
    background: "#f8fafc",
    color: "#475569",
    borderColor: "#e2e8f0",
  },

  productTitle: {
    margin: 0,
    color: "#0f172a",
    fontSize: 23,
    lineHeight: 1.08,
    letterSpacing: "-0.045em",
    overflowWrap: "anywhere",
  },

  productSubtitle: {
    margin: 0,
    color: "#64748b",
    fontSize: 13,
    lineHeight: 1.35,
    fontWeight: 800,
  },

  productActions: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
    justifyContent: "flex-end",
  },

  editButton: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 40,
    padding: "9px 12px",
    borderRadius: 999,
    background: "#1683f8",
    color: "#ffffff",
    textDecoration: "none",
    fontSize: 13,
    fontWeight: 950,
  },

  publicButton: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 40,
    padding: "9px 12px",
    borderRadius: 999,
    background: "#ffffff",
    color: "#0f172a",
    border: "1px solid #cbd5e1",
    textDecoration: "none",
    fontSize: 13,
    fontWeight: 950,
  },

  planningGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
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

  lockedPanel: {
    display: "grid",
    gap: 10,
    padding: 24,
    borderRadius: 28,
    background: "#ffffff",
    border: "1px solid #fed7aa",
  },

  kicker: {
    margin: 0,
    color: "#2563eb",
    fontSize: 12,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
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
