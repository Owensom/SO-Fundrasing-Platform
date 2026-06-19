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
const LOW_STOCK_THRESHOLD = 5;
const CRITICAL_STOCK_THRESHOLD = 1;

type MerchandiseProductStatus = "draft" | "published" | "closed";
type HealthTone = "good" | "warning" | "critical" | "neutral";

type MerchandiseOption = {
  type?: string | null;
  label?: string | null;
  value?: string | null;
};

type MerchandiseProduct = {
  id: string;
  tenant_slug: string;
  slug: string;
  title: string;
  description: string;
  image_url: string | null;
  image_focus_x: number | null;
  image_focus_y: number | null;
  price_cents: number;
  currency: string;
  stock_quantity: number | null;
  sold_quantity: number;
  options_json: MerchandiseOption[] | null;
  status: MerchandiseProductStatus;
  created_at: string;
  updated_at: string;

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
};

type TenantSettingsLike = {
  subscription_tier?: string | null;
  subscription_status?: string | null;
  platform_owner_bypass?: boolean | null;
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
      currency: cleanText(currency, "GBP").toUpperCase(),
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

function statusStyle(status: string): CSSProperties {
  if (status === "published") {
    return {
      background: "#dcfce7",
      color: "#166534",
      borderColor: "#86efac",
    };
  }

  if (status === "closed") {
    return {
      background: "#fff7ed",
      color: "#9a3412",
      borderColor: "#fed7aa",
    };
  }

  return {
    background: "#f1f5f9",
    color: "#475569",
    borderColor: "#e2e8f0",
  };
}

function focusValue(value: number | null | undefined) {
  const number = Number(value);

  if (!Number.isFinite(number)) return 50;

  return Math.max(0, Math.min(100, Math.round(number)));
}

function productImageStyle(product: MerchandiseProduct): CSSProperties {
  return {
    width: "100%",
    height: "100%",
    objectFit: "contain",
    objectPosition: `${focusValue(product.image_focus_x)}% ${focusValue(
      product.image_focus_y,
    )}%`,
    display: "block",
    padding: 14,
    boxSizing: "border-box",
    background:
      "linear-gradient(135deg, #ffffff 0%, #f8fafc 58%, #eff6ff 100%)",
  };
}

function getStockRemaining(product: MerchandiseProduct) {
  if (product.stock_quantity === null) return null;

  return Math.max(
    0,
    Number(product.stock_quantity || 0) - Number(product.sold_quantity || 0),
  );
}

function isSoldOut(product: MerchandiseProduct) {
  const remaining = getStockRemaining(product);
  return remaining !== null && remaining <= 0;
}

function isCriticalStock(product: MerchandiseProduct) {
  const remaining = getStockRemaining(product);

  return (
    remaining !== null &&
    remaining > 0 &&
    remaining <= CRITICAL_STOCK_THRESHOLD
  );
}

function isLowStock(product: MerchandiseProduct) {
  const remaining = getStockRemaining(product);

  return (
    remaining !== null &&
    remaining > CRITICAL_STOCK_THRESHOLD &&
    remaining <= LOW_STOCK_THRESHOLD
  );
}

function getStockLabel(product: MerchandiseProduct) {
  const remaining = getStockRemaining(product);

  if (remaining === null) {
    return "Unlimited / manual";
  }

  if (remaining <= 0) {
    return "Sold out";
  }

  if (remaining === 1) {
    return "1 remaining";
  }

  return `${remaining} remaining`;
}

function getStockDetailLabel(product: MerchandiseProduct) {
  const remaining = getStockRemaining(product);

  if (remaining === null) {
    return `${Number(product.sold_quantity || 0)} sold · no stock limit`;
  }

  return `${Number(product.sold_quantity || 0)} sold of ${Number(
    product.stock_quantity || 0,
  )}`;
}

function getStockTone(product: MerchandiseProduct): HealthTone {
  if (product.status === "closed") return "neutral";
  if (product.stock_quantity === null) return "neutral";
  if (isSoldOut(product)) return "critical";
  if (isCriticalStock(product)) return "critical";
  if (isLowStock(product)) return "warning";
  return "good";
}

function getStockPillLabel(product: MerchandiseProduct) {
  if (product.stock_quantity === null) return "Stock unlimited";
  if (isSoldOut(product)) return "Sold out";
  if (isCriticalStock(product)) return "Nearly empty";
  if (isLowStock(product)) return "Low stock";
  return "Stock available";
}

function stockPillStyle(tone: HealthTone) {
  if (tone === "good") {
    return {
      background: "#ecfdf5",
      color: "#166534",
      borderColor: "#bbf7d0",
    };
  }

  if (tone === "critical") {
    return {
      background: "#fef2f2",
      color: "#991b1b",
      borderColor: "#fecaca",
    };
  }

  if (tone === "warning") {
    return {
      background: "#fffbeb",
      color: "#92400e",
      borderColor: "#fde68a",
    };
  }

  return {
    background: "#f8fafc",
    color: "#475569",
    borderColor: "#e2e8f0",
  };
}

function getSizeOptions(product: MerchandiseProduct) {
  if (!Array.isArray(product.options_json)) return [];

  return product.options_json
    .filter((option) => cleanText(option?.type).toLowerCase() === "size")
    .map((option) => cleanText(option?.label || option?.value))
    .filter(Boolean);
}

function getPublicProductHref(product: MerchandiseProduct) {
  return `/m/${encodeURIComponent(product.tenant_slug)}/${encodeURIComponent(
    product.slug,
  )}`;
}

function getPublicShopHref(tenantSlug: string) {
  return `/m/${encodeURIComponent(tenantSlug)}`;
}

function getLinkedEventLabel(product: MerchandiseProduct) {
  if (!isEnabled(product.event_linking_enabled)) {
    return "Not event-linked";
  }

  return cleanText(product.linked_event_title) || "Event link enabled";
}

function getFulfilmentOptionCount(product: MerchandiseProduct) {
  return [
    isEnabled(product.fulfilment_collect_stand_enabled, true),
    isEnabled(product.fulfilment_collect_table_enabled),
    isEnabled(product.fulfilment_deliver_table_enabled),
    isEnabled(product.fulfilment_deliver_seat_enabled),
    isEnabled(product.fulfilment_post_enabled),
    isEnabled(product.fulfilment_arrange_with_organiser_enabled, true),
  ].filter(Boolean).length;
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
    return "Needs setup";
  }

  return options.join(", ");
}

function getCustomerDetailCount(product: MerchandiseProduct) {
  return [
    isEnabled(product.require_booking_reference),
    isEnabled(product.require_table_number),
    isEnabled(product.require_seat_number),
    isEnabled(product.require_guest_name),
  ].filter(Boolean).length;
}

function getCustomerDetailLabel(product: MerchandiseProduct) {
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

  if (details.length === 0) {
    return "No extra details";
  }

  return details.join(", ");
}

function usesEventTableOrSeatFulfilment(product: MerchandiseProduct) {
  return (
    isEnabled(product.fulfilment_collect_table_enabled) ||
    isEnabled(product.fulfilment_deliver_table_enabled) ||
    isEnabled(product.fulfilment_deliver_seat_enabled)
  );
}

function needsEventDetailSetup(product: MerchandiseProduct) {
  if (!isEnabled(product.event_linking_enabled)) return false;

  if (!cleanText(product.linked_event_id)) return true;

  return (
    usesEventTableOrSeatFulfilment(product) &&
    getCustomerDetailCount(product) === 0
  );
}

function getProductWarnings(product: MerchandiseProduct) {
  const warnings: string[] = [];

  if (product.status === "published" && isSoldOut(product)) {
    warnings.push("Sold out while published");
  }

  if (product.status === "published" && isCriticalStock(product)) {
    warnings.push("Nearly empty");
  }

  if (product.status === "published" && isLowStock(product)) {
    warnings.push("Low stock");
  }

  if (product.status === "published" && getFulfilmentOptionCount(product) === 0) {
    warnings.push("No fulfilment method");
  }

  if (isEnabled(product.event_linking_enabled) && !cleanText(product.linked_event_id)) {
    warnings.push("Event link missing");
  }

  if (needsEventDetailSetup(product)) {
    warnings.push("Event details may be needed");
  }

  return warnings;
}

function isCriticalWarning(warning: string) {
  return warning === "Sold out while published" || warning === "Nearly empty";
}

function getWarningChipStyle(warning: string): CSSProperties {
  if (isCriticalWarning(warning)) {
    return {
      ...styles.warningChip,
      ...styles.criticalWarningChip,
    };
  }

  return styles.warningChip;
}

function getProductReadinessTone(product: MerchandiseProduct): HealthTone {
  if (product.status === "closed") return "neutral";
  if (product.status !== "published") return "neutral";

  if (isSoldOut(product) || isCriticalStock(product)) {
    return "critical";
  }

  if (getProductWarnings(product).length > 0) {
    return "warning";
  }

  return "good";
}

function getProductReadinessLabel(product: MerchandiseProduct) {
  if (product.status === "closed") {
    return "Closed";
  }

  if (product.status !== "published") {
    return "Draft setup";
  }

  if (isSoldOut(product)) {
    return "Sold out";
  }

  if (isCriticalStock(product)) {
    return "Nearly empty";
  }

  if (getFulfilmentOptionCount(product) === 0) {
    return "Public, needs fulfilment";
  }

  if (needsEventDetailSetup(product)) {
    return "Event detail check";
  }

  if (isLowStock(product)) {
    return "Low stock";
  }

  return "Checkout ready";
}

function readinessPillStyle(tone: HealthTone) {
  if (tone === "good") {
    return {
      background: "#dcfce7",
      color: "#166534",
      borderColor: "#86efac",
    };
  }

  if (tone === "critical") {
    return {
      background: "#fef2f2",
      color: "#991b1b",
      borderColor: "#fecaca",
    };
  }

  if (tone === "warning") {
    return {
      background: "#fffbeb",
      color: "#92400e",
      borderColor: "#fde68a",
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

async function listMerchandiseProducts(tenantSlug: string) {
  return query<MerchandiseProduct>(
    `
      select
        merchandise_products.id,
        merchandise_products.tenant_slug,
        merchandise_products.slug,
        merchandise_products.title,
        merchandise_products.description,
        merchandise_products.image_url,
        merchandise_products.image_focus_x,
        merchandise_products.image_focus_y,
        merchandise_products.price_cents,
        merchandise_products.currency,
        merchandise_products.stock_quantity,
        merchandise_products.sold_quantity,
        merchandise_products.options_json,
        merchandise_products.status,
        merchandise_products.created_at::text,
        merchandise_products.updated_at::text,
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
        merchandise_products.require_guest_name
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

export default async function AdminMerchandisePage() {
  const tenantSlug = await requireTenantAccess();

  const [tenantSettingsRaw, products] = await Promise.all([
    getTenantSettings(tenantSlug),
    listMerchandiseProducts(tenantSlug),
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
  const draftProducts = products.filter((product) => product.status === "draft");
  const closedProducts = products.filter(
    (product) => product.status === "closed",
  );
  const eventLinkedProducts = products.filter((product) =>
    isEnabled(product.event_linking_enabled),
  );
  const fulfilmentReadyProducts = products.filter(
    (product) => getFulfilmentOptionCount(product) > 0,
  );
  const checkoutReadyProducts = products.filter(
    (product) =>
      product.status === "published" &&
      getFulfilmentOptionCount(product) > 0 &&
      !isSoldOut(product),
  );

  const stockLimitedProducts = products.filter(
    (product) => product.stock_quantity !== null,
  );
  const unlimitedStockProducts = products.filter(
    (product) => product.stock_quantity === null,
  );
  const publishedSoldOutProducts = products.filter(
    (product) => product.status === "published" && isSoldOut(product),
  );
  const criticalStockProducts = products.filter(
    (product) => product.status === "published" && isCriticalStock(product),
  );
  const lowStockProducts = products.filter(
    (product) => product.status === "published" && isLowStock(product),
  );
  const productsNeedingFulfilment = products.filter(
    (product) =>
      product.status === "published" && getFulfilmentOptionCount(product) === 0,
  );
  const eventDetailWarnings = products.filter(needsEventDetailSetup);
  const productsNeedingAttention = products.filter(
    (product) => getProductWarnings(product).length > 0,
  );

  const soldQuantity = products.reduce(
    (sum, product) => sum + Number(product.sold_quantity || 0),
    0,
  );

  const estimatedRevenueCents = products.reduce(
    (sum, product) =>
      sum +
      Number(product.sold_quantity || 0) * Number(product.price_cents || 0),
    0,
  );

  return (
    <main className="admin-merchandise-page" style={styles.page}>
      <style>{responsiveStyles}</style>

      <section className="merchandise-hero" style={styles.hero}>
        <div className="hero-main-row" style={styles.heroMainRow}>
          <div className="hero-brand-row" style={styles.heroBrandRow}>
            <div className="hero-logo-plate" style={styles.heroLogoPlate}>
              <img
                src={DEFAULT_MERCHANDISE_IMAGE_SRC}
                alt="Merchandise"
                style={styles.heroLogo}
              />
            </div>

            <div style={styles.heroTitleBlock}>
              <div style={styles.heroTopRow}>
                <div style={styles.badgeRow}>
                  <span style={styles.statusBadge}>Merchandise / Shop</span>
                  <span style={styles.planBadge}>{getTierLabel(tier)} plan</span>
                  <span style={styles.phaseBadge}>Checkout live</span>
                </div>

                <Link href="/admin" style={styles.secondaryButton}>
                  ← Dashboard
                </Link>
              </div>

              <h1 className="merchandise-title" style={styles.heroTitle}>
                Merchandise products
              </h1>

              <p style={styles.heroDescription}>
                Manage products, event links, fulfilment settings, stock
                visibility and paid merchandise orders. Public browsing and
                Stripe checkout are live; payments update order status and sold
                quantities after webhook confirmation.
              </p>
            </div>
          </div>

          <div style={styles.heroMeta}>
            <div>
              <strong>Tenant:</strong> {tenantSlug}
            </div>
            <div>
              <strong>Plan:</strong> {getTierLabel(tier)}
            </div>
            <div>
              <strong>Public shop:</strong>{" "}
              {merchandiseCapability.allowed
                ? getPublicShopHref(tenantSlug)
                : "Unavailable on this plan"}
            </div>
          </div>
        </div>

        <div className="merchandise-hero-stats" style={styles.heroStats}>
          <StatCard label="Products" value={products.length} />
          <StatCard label="Published" value={publishedProducts.length} />
          <StatCard label="Checkout ready" value={checkoutReadyProducts.length} />
          <StatCard label="Stock alerts" value={productsNeedingAttention.length} />
          <StatCard label="Sold quantity" value={soldQuantity} />
          <StatCard
            label="Recorded sales"
            value={formatMoney(estimatedRevenueCents)}
          />
        </div>
      </section>

      {!merchandiseCapability.allowed ? (
        <section style={styles.upgradeBanner}>
          <div>
            <div style={styles.upgradeEyebrow}>Professional feature</div>

            <h2 style={styles.upgradeTitle}>
              Merchandise requires Professional or Foundation
            </h2>

            <p style={styles.upgradeText}>
              {merchandiseCapability.reason || getMerchandiseUpgradeMessage()}
            </p>
          </div>

          <div style={styles.upgradeActions}>
            <Link href="/admin/settings/billing" style={styles.upgradeButton}>
              View billing →
            </Link>
          </div>
        </section>
      ) : (
        <>
          <section
            className="merchandise-readiness-panel"
            style={styles.readinessPanel}
          >
            <div style={styles.readinessHeader}>
              <div>
                <div style={styles.readinessEyebrow}>Product setup</div>

                <h2 style={styles.readinessTitle}>Merchandise workspace</h2>

                <p style={styles.readinessIntro}>
                  Published products are visible on the public shop and can be
                  bought through secure Stripe checkout. Paid orders appear in
                  Orders, sold quantities update after payment confirmation, and
                  fulfilment status can be tracked from the fulfilment page.
                </p>
              </div>
            </div>

            <div className="merchandise-actions" style={styles.actionGrid}>
              <Link href="/admin/merchandise/new" style={styles.actionCardPrimary}>
                <span style={styles.actionKicker}>Create</span>
                <strong style={styles.actionTitle}>New product</strong>
                <span style={styles.actionText}>Add another shop item.</span>
              </Link>

              <Link href="/admin/merchandise/orders" style={styles.actionCard}>
                <span style={styles.actionKicker}>Live</span>
                <strong style={styles.actionTitle}>Orders</strong>
                <span style={styles.actionText}>
                  View checkout-started and paid orders.
                </span>
              </Link>

              <Link
                href="/admin/merchandise/fulfilment"
                style={styles.actionCard}
              >
                <span style={styles.actionKicker}>Manual</span>
                <strong style={styles.actionTitle}>Fulfilment</strong>
                <span style={styles.actionText}>Track collection and delivery.</span>
              </Link>

              <Link
                href={getPublicShopHref(tenantSlug)}
                target="_blank"
                style={styles.actionCard}
              >
                <span style={styles.actionKicker}>Public</span>
                <strong style={styles.actionTitle}>Shop page</strong>
                <span style={styles.actionText}>Preview supporter view.</span>
              </Link>

              <Link href="/admin/launch-readiness" style={styles.actionCard}>
                <span style={styles.actionKicker}>Operations</span>
                <strong style={styles.actionTitle}>Readiness</strong>
                <span style={styles.actionText}>Check launch status.</span>
              </Link>
            </div>

            <div
              className="merchandise-readiness-grid"
              style={styles.readinessGrid}
            >
              <ReadinessItem
                label="Admin setup"
                value="Live"
                detail="Product records, images, prices, stock limits, options, event links and fulfilment setup can be managed."
                tone="good"
              />

              <ReadinessItem
                label="Public shop"
                value="Live"
                detail="Published products appear on the tenant shop and product pages."
                tone="good"
              />

              <ReadinessItem
                label="Checkout"
                value="Connected"
                detail="Basket checkout validates products, creates an order and opens Stripe checkout."
                tone="good"
              />

              <ReadinessItem
                label="Payments"
                value="Webhook live"
                detail="Successful Stripe payments mark merchandise orders as paid and store the payment intent."
                tone="good"
              />

              <ReadinessItem
                label="Stock sold count"
                value="Connected"
                detail="Sold quantity increases only after Stripe confirms successful payment."
                tone="good"
              />

              <ReadinessItem
                label="Receipts"
                value="Connected"
                detail="Merchandise customer receipt emails are sent with tenant branding after successful payment."
                tone="good"
              />
            </div>
          </section>

          <section className="stock-watch-panel" style={styles.stockWatchPanel}>
            <div style={styles.sectionHeader}>
              <div>
                <div style={styles.sectionEyebrow}>Stock and fulfilment</div>
                <h2 style={styles.sectionTitle}>Readiness watchlist</h2>
                <p style={styles.sectionIntro}>
                  This is admin guidance only. It does not change basket,
                  checkout, Stripe, webhook, receipts or public product logic.
                </p>
              </div>

              <Link href="/admin/merchandise/fulfilment" style={styles.darkButton}>
                Open fulfilment →
              </Link>
            </div>

            <div className="stock-watch-grid" style={styles.stockWatchGrid}>
              <WatchCard
                label="Sold out while published"
                value={publishedSoldOutProducts.length}
                text="Published stock-limited products with no remaining stock."
                tone={publishedSoldOutProducts.length ? "critical" : "good"}
              />

              <WatchCard
                label="Nearly empty"
                value={criticalStockProducts.length}
                text={`Published products with ${CRITICAL_STOCK_THRESHOLD} remaining.`}
                tone={criticalStockProducts.length ? "critical" : "good"}
              />

              <WatchCard
                label="Low stock"
                value={lowStockProducts.length}
                text={`Published products with ${LOW_STOCK_THRESHOLD} or fewer remaining, excluding critical stock.`}
                tone={lowStockProducts.length ? "warning" : "good"}
              />

              <WatchCard
                label="Needs fulfilment"
                value={productsNeedingFulfilment.length}
                text="Published products without a fulfilment option."
                tone={productsNeedingFulfilment.length ? "warning" : "good"}
              />

              <WatchCard
                label="Event detail check"
                value={eventDetailWarnings.length}
                text="Event-linked products that may need table, seat, booking or guest details."
                tone={eventDetailWarnings.length ? "warning" : "good"}
              />

              <WatchCard
                label="Stock limited"
                value={stockLimitedProducts.length}
                text="Products using a fixed stock quantity."
                tone="neutral"
              />

              <WatchCard
                label="Unlimited stock"
                value={unlimitedStockProducts.length}
                text="Products using manual or unlimited stock."
                tone="neutral"
              />
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
                Create your first merchandise product. Draft products stay
                admin-only. Published products appear on the public shop and can
                be bought through secure checkout when merchandise is available
                on the tenant plan.
              </p>

              <Link href="/admin/merchandise/new" style={styles.emptyButton}>
                Create first product →
              </Link>
            </section>
          ) : (
            <section
              id="merchandise-products"
              className="merchandise-section-card"
              style={styles.sectionCard}
            >
              <div style={styles.sectionHeader}>
                <div>
                  <div style={styles.sectionEyebrow}>Products</div>
                  <h2 style={styles.sectionTitle}>Product catalogue</h2>
                  <p style={styles.sectionIntro}>
                    Published products are public and available through the
                    merchandise basket. Stock, fulfilment and event-linking
                    readiness are shown per product.
                  </p>
                </div>
              </div>

              <div style={styles.itemsList}>
                {products.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>
            </section>
          )}

          <section
            className="merchandise-summary-grid"
            style={styles.summaryGrid}
          >
            <SummaryCard
              label="Draft products"
              value={draftProducts.length}
              text="Admin-only until published."
            />

            <SummaryCard
              label="Published products"
              value={publishedProducts.length}
              text="Visible on the public shop."
            />

            <SummaryCard
              label="Event-linked products"
              value={eventLinkedProducts.length}
              text="Connected to tenant events for collection or delivery workflows."
            />

            <SummaryCard
              label="Fulfilment configured"
              value={fulfilmentReadyProducts.length}
              text="Products with at least one fulfilment option."
            />

            <SummaryCard
              label="Checkout-ready products"
              value={checkoutReadyProducts.length}
              text="Published products with stock available and fulfilment guidance configured."
            />

            <SummaryCard
              label="Closed products"
              value={closedProducts.length}
              text="Hidden from the active public shop but retained for history."
            />
          </section>
        </>
      )}
    </main>
  );
}

function StatCard({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div style={styles.statCard}>
      <div style={styles.statLabel}>{label}</div>
      <div style={styles.statValue}>{value}</div>
    </div>
  );
}

function ReadinessItem({
  label,
  value,
  detail,
  tone,
}: {
  label: string;
  value: ReactNode;
  detail: string;
  tone: HealthTone;
}) {
  return (
    <article
      style={{
        ...styles.readinessItem,
        ...(tone === "good"
          ? styles.readinessItemGood
          : tone === "critical"
            ? styles.readinessItemCritical
            : tone === "warning"
              ? styles.readinessItemWarning
              : styles.readinessItemNeutral),
      }}
    >
      <div style={styles.readinessContent}>
        <span style={styles.readinessLabel}>{label}</span>
        <strong style={styles.readinessValue}>{value}</strong>
        <span style={styles.readinessDetail}>{detail}</span>
      </div>
    </article>
  );
}

function WatchCard({
  label,
  value,
  text,
  tone,
}: {
  label: string;
  value: ReactNode;
  text: string;
  tone: HealthTone;
}) {
  return (
    <article
      style={{
        ...styles.watchCard,
        ...(tone === "good"
          ? styles.watchCardGood
          : tone === "critical"
            ? styles.watchCardCritical
            : tone === "warning"
              ? styles.watchCardWarning
              : styles.watchCardNeutral),
      }}
    >
      <span style={styles.watchLabel}>{label}</span>
      <strong style={styles.watchValue}>{value}</strong>
      <p style={styles.watchText}>{text}</p>
    </article>
  );
}

function SummaryCard({
  label,
  value,
  text,
}: {
  label: string;
  value: ReactNode;
  text: string;
}) {
  return (
    <article style={styles.summaryCard}>
      <span style={styles.summaryLabel}>{label}</span>
      <strong style={styles.summaryValue}>{value}</strong>
      <p style={styles.summaryText}>{text}</p>
    </article>
  );
}

function ProductCard({ product }: { product: MerchandiseProduct }) {
  const sizes = getSizeOptions(product);
  const publicHref = getPublicProductHref(product);
  const canPreviewPublic = product.status === "published";
  const readinessTone = getProductReadinessTone(product);
  const linkedEventLabel = getLinkedEventLabel(product);
  const stockTone = getStockTone(product);
  const warnings = getProductWarnings(product);
  const hasCriticalWarnings = warnings.some(isCriticalWarning);

  return (
    <article
      style={{
        ...styles.itemCard,
        ...(readinessTone === "good"
          ? styles.itemCardGood
          : readinessTone === "critical"
            ? styles.itemCardCritical
            : readinessTone === "warning"
              ? styles.itemCardWarning
              : styles.itemCardNeutral),
      }}
    >
      <div className="merchandise-item-layout" style={styles.itemLayout}>
        <div style={styles.itemImagePreviewWrap}>
          {product.image_url ? (
            <img
              src={product.image_url}
              alt={product.title}
              style={productImageStyle(product)}
            />
          ) : (
            <div style={styles.itemImageFallback}>
              <img
                src={DEFAULT_MERCHANDISE_IMAGE_SRC}
                alt="Merchandise"
                style={styles.defaultItemImage}
              />
            </div>
          )}
        </div>

        <div style={styles.itemContent}>
          <div style={styles.itemSummary}>
            <div style={styles.itemTitleBlock}>
              <div style={styles.itemPillRow}>
                <span
                  style={{
                    ...styles.itemStatusBadge,
                    ...statusStyle(product.status),
                  }}
                >
                  {statusLabel(product.status)}
                </span>

                <span style={styles.pricePill}>
                  {formatMoney(product.price_cents, product.currency)}
                </span>

                <span
                  style={{
                    ...styles.readinessPill,
                    ...readinessPillStyle(readinessTone),
                  }}
                >
                  {getProductReadinessLabel(product)}
                </span>

                <span
                  style={{
                    ...styles.stockPill,
                    ...stockPillStyle(stockTone),
                  }}
                >
                  {getStockPillLabel(product)}
                </span>

                {isEnabled(product.event_linking_enabled) ? (
                  <span style={styles.eventPill}>Event-linked</span>
                ) : null}

                {canPreviewPublic && !isSoldOut(product) ? (
                  <span style={styles.checkoutPill}>Checkout enabled</span>
                ) : null}
              </div>

              <h3 style={styles.itemTitle}>{product.title}</h3>

              <p style={styles.itemDescription}>
                {product.description || "No product description added yet."}
              </p>

              {warnings.length ? (
                <div
                  style={{
                    ...styles.warningStrip,
                    ...(hasCriticalWarnings ? styles.warningStripCritical : {}),
                  }}
                >
                  {warnings.map((warning) => (
                    <span key={warning} style={getWarningChipStyle(warning)}>
                      {warning}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
          </div>

          <div
            className="merchandise-item-meta-grid"
            style={styles.itemMetaGrid}
          >
            <InfoBlock label="Stock" value={getStockLabel(product)} />

            <InfoBlock
              label="Stock detail"
              value={getStockDetailLabel(product)}
            />

            <InfoBlock label="Sold quantity" value={product.sold_quantity} />

            <InfoBlock
              label="Sizes"
              value={sizes.length ? sizes.join(", ") : "Not set"}
            />

            <InfoBlock label="Event link" value={linkedEventLabel} />

            <InfoBlock
              label="Fulfilment"
              value={getFulfilmentLabel(product)}
            />

            <InfoBlock
              label="Checkout details"
              value={getCustomerDetailLabel(product)}
            />

            <InfoBlock
              label="Organiser note"
              value={cleanText(product.fulfilment_notes) ? "Added" : "Not set"}
            />

            <InfoBlock label="Created" value={formatDate(product.created_at)} />

            <InfoBlock label="Updated" value={formatDate(product.updated_at)} />
          </div>

          <div className="merchandise-item-actions" style={styles.itemActions}>
            <Link
              href={`/admin/merchandise/${encodeURIComponent(product.id)}`}
              style={styles.editButton}
            >
              Edit product →
            </Link>

            {canPreviewPublic ? (
              <Link href={publicHref} target="_blank" style={styles.publicButton}>
                View public product →
              </Link>
            ) : (
              <span style={styles.disabledPublicButton}>
                Public product page available when published
              </span>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}

function InfoBlock({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div style={styles.infoCard}>
      <div style={styles.infoLabel}>{label}</div>
      <div style={styles.infoValue}>{value}</div>
    </div>
  );
}

const responsiveStyles = `
.admin-merchandise-page,
.admin-merchandise-page * {
  box-sizing: border-box;
}

.admin-merchandise-page {
  overflow-x: hidden;
}

.admin-merchandise-page img,
.admin-merchandise-page input,
.admin-merchandise-page textarea,
.admin-merchandise-page select,
.admin-merchandise-page button {
  max-width: 100%;
}

.admin-merchandise-page section,
.admin-merchandise-page article,
.admin-merchandise-page div,
.admin-merchandise-page a,
.admin-merchandise-page p,
.admin-merchandise-page h1,
.admin-merchandise-page h2,
.admin-merchandise-page h3,
.admin-merchandise-page strong,
.admin-merchandise-page span {
  min-width: 0;
  max-width: 100%;
}

@media (max-width: 900px) {
  .admin-merchandise-page .hero-brand-row,
  .admin-merchandise-page .merchandise-item-layout {
    grid-template-columns: 1fr !important;
  }

  .admin-merchandise-page .hero-main-row {
    grid-template-columns: 1fr !important;
  }

  .admin-merchandise-page .merchandise-hero-stats,
  .admin-merchandise-page .merchandise-readiness-grid,
  .admin-merchandise-page .merchandise-actions,
  .admin-merchandise-page .stock-watch-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
  }

  .admin-merchandise-page .hero-logo-plate {
    width: 132px !important;
    height: 132px !important;
  }
}

@media (max-width: 640px) {
  .admin-merchandise-page {
    padding: 18px 12px 44px !important;
  }

  .admin-merchandise-page .merchandise-hero,
  .admin-merchandise-page .merchandise-readiness-panel,
  .admin-merchandise-page .merchandise-section-card,
  .admin-merchandise-page .stock-watch-panel {
    padding: 18px !important;
    border-radius: 24px !important;
  }

  .admin-merchandise-page .merchandise-title {
    font-size: clamp(34px, 12vw, 48px) !important;
    line-height: 1 !important;
  }

  .admin-merchandise-page .hero-logo-plate {
    width: 110px !important;
    height: 110px !important;
  }

  .admin-merchandise-page .merchandise-hero-stats,
  .admin-merchandise-page .merchandise-readiness-grid,
  .admin-merchandise-page .merchandise-summary-grid,
  .admin-merchandise-page .merchandise-item-meta-grid,
  .admin-merchandise-page .merchandise-actions,
  .admin-merchandise-page .stock-watch-grid {
    grid-template-columns: 1fr !important;
  }

  .admin-merchandise-page button,
  .admin-merchandise-page a {
    min-height: 46px !important;
  }

  .admin-merchandise-page .merchandise-item-actions {
    display: grid !important;
    grid-template-columns: 1fr !important;
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
      "radial-gradient(circle at top left, rgba(251,191,36,0.10), transparent 34%), #f8fafc",
    color: "#0f172a",
    boxSizing: "border-box",
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
    minWidth: 0,
    overflow: "hidden",
  },

  heroMainRow: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) auto",
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
    justifyContent: "space-between",
    gap: 12,
    flexWrap: "wrap",
    alignItems: "center",
    minWidth: 0,
  },

  badgeRow: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
    alignItems: "center",
    minWidth: 0,
  },

  heroTitle: {
    margin: 0,
    fontSize: "clamp(34px, 5vw, 54px)",
    lineHeight: 0.96,
    letterSpacing: "-0.07em",
    overflowWrap: "anywhere",
  },

  heroDescription: {
    margin: 0,
    color: "#dbeafe",
    lineHeight: 1.5,
    fontWeight: 720,
    maxWidth: 850,
    overflowWrap: "anywhere",
  },

  heroStats: {
    display: "grid",
    gridTemplateColumns: "repeat(6, minmax(0, 1fr))",
    gap: 9,
    minWidth: 0,
  },

  heroMeta: {
    display: "grid",
    gap: 6,
    alignSelf: "stretch",
    minWidth: 215,
    padding: 14,
    borderRadius: 18,
    color: "#bfdbfe",
    background: "rgba(255,255,255,0.075)",
    border: "1px solid rgba(255,255,255,0.13)",
    fontSize: 13,
    lineHeight: 1.35,
    fontWeight: 760,
    overflowWrap: "anywhere",
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

  secondaryButton: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 40,
    padding: "9px 13px",
    borderRadius: 999,
    background: "#ffffff",
    color: "#0f172a",
    textDecoration: "none",
    fontSize: 13,
    fontWeight: 950,
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

  statCard: {
    padding: 12,
    borderRadius: 16,
    background: "rgba(255,255,255,0.09)",
    border: "1px solid rgba(255,255,255,0.15)",
    minWidth: 0,
  },

  statLabel: {
    color: "#fde68a",
    fontSize: 11,
    lineHeight: 1.1,
    fontWeight: 900,
  },

  statValue: {
    marginTop: 5,
    color: "#ffffff",
    fontSize: 21,
    lineHeight: 1,
    fontWeight: 950,
    overflowWrap: "anywhere",
  },

  upgradeBanner: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) auto",
    gap: 18,
    alignItems: "center",
    padding: 20,
    borderRadius: 24,
    background:
      "linear-gradient(135deg, #fffbeb 0%, #ffffff 60%, #eff6ff 100%)",
    border: "1px solid rgba(217,119,6,0.32)",
    boxShadow: "0 16px 40px rgba(15,23,42,0.07)",
    marginBottom: 18,
    minWidth: 0,
  },

  upgradeEyebrow: {
    color: "#b45309",
    fontSize: 12,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    marginBottom: 8,
  },

  upgradeTitle: {
    margin: 0,
    color: "#0f172a",
    fontSize: 24,
    lineHeight: 1.1,
    letterSpacing: "-0.04em",
    overflowWrap: "anywhere",
  },

  upgradeText: {
    margin: "8px 0 0",
    color: "#475569",
    lineHeight: 1.55,
    fontWeight: 700,
    overflowWrap: "anywhere",
  },

  upgradeActions: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
    justifyContent: "flex-end",
  },

  upgradeButton: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 44,
    padding: "11px 16px",
    borderRadius: 999,
    background: "#0f172a",
    color: "#ffffff",
    textDecoration: "none",
    fontWeight: 950,
    whiteSpace: "nowrap",
  },

  readinessPanel: {
    display: "grid",
    gap: 16,
    padding: 18,
    borderRadius: 24,
    background:
      "linear-gradient(135deg, #ffffff 0%, #f8fafc 56%, #eff6ff 100%)",
    border: "1px solid #dbeafe",
    boxShadow: "0 8px 28px rgba(15,23,42,0.055)",
    marginBottom: 18,
    minWidth: 0,
  },

  readinessHeader: {
    display: "grid",
    gap: 8,
    minWidth: 0,
  },

  readinessEyebrow: {
    color: "#2563eb",
    fontSize: 12,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    marginBottom: 5,
  },

  readinessTitle: {
    margin: 0,
    color: "#0f172a",
    fontSize: "clamp(22px, 5vw, 28px)",
    letterSpacing: "-0.045em",
    lineHeight: 1.05,
    overflowWrap: "anywhere",
  },

  readinessIntro: {
    margin: "7px 0 0",
    color: "#64748b",
    fontSize: 14,
    lineHeight: 1.45,
    fontWeight: 750,
    maxWidth: 860,
  },

  actionGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
    gap: 10,
    minWidth: 0,
  },

  actionCardPrimary: {
    display: "grid",
    gap: 4,
    alignContent: "start",
    minHeight: 104,
    padding: 14,
    borderRadius: 20,
    background:
      "linear-gradient(135deg, #1683f8 0%, #2563eb 74%, #1d4ed8 100%)",
    border: "1px solid #1683f8",
    color: "#ffffff",
    textDecoration: "none",
    boxShadow: "0 14px 28px rgba(22,131,248,0.16)",
  },

  actionCard: {
    display: "grid",
    gap: 4,
    alignContent: "start",
    minHeight: 104,
    padding: 14,
    borderRadius: 20,
    background: "#ffffff",
    border: "1px solid #dbeafe",
    color: "#0f172a",
    textDecoration: "none",
    boxShadow: "0 8px 20px rgba(15,23,42,0.035)",
  },

  actionKicker: {
    fontSize: 10,
    lineHeight: 1.1,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    opacity: 0.78,
  },

  actionTitle: {
    fontSize: 16,
    lineHeight: 1.1,
    fontWeight: 950,
    letterSpacing: "-0.035em",
    overflowWrap: "anywhere",
  },

  actionText: {
    color: "inherit",
    opacity: 0.72,
    fontSize: 12,
    lineHeight: 1.3,
    fontWeight: 800,
    overflowWrap: "anywhere",
  },

  readinessGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: 10,
  },

  readinessItem: {
    display: "grid",
    gap: 3,
    padding: 13,
    borderRadius: 18,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    minWidth: 0,
    boxShadow: "0 8px 20px rgba(15,23,42,0.04)",
  },

  readinessItemGood: {
    background: "linear-gradient(135deg, #ecfdf5 0%, #ffffff 78%)",
    borderColor: "#bbf7d0",
    boxShadow: "0 10px 24px rgba(22,163,74,0.09)",
  },

  readinessItemCritical: {
    background: "linear-gradient(135deg, #fef2f2 0%, #ffffff 78%)",
    borderColor: "#fecaca",
    boxShadow: "0 10px 24px rgba(220,38,38,0.09)",
  },

  readinessItemWarning: {
    background: "linear-gradient(135deg, #fff7ed 0%, #ffffff 78%)",
    borderColor: "#fed7aa",
    boxShadow: "0 10px 24px rgba(234,88,12,0.09)",
  },

  readinessItemNeutral: {
    background: "linear-gradient(135deg, #f8fafc 0%, #ffffff 78%)",
    borderColor: "#e2e8f0",
    boxShadow: "0 8px 20px rgba(15,23,42,0.04)",
  },

  readinessContent: {
    display: "grid",
    gap: 3,
    minWidth: 0,
  },

  readinessLabel: {
    color: "#64748b",
    fontSize: 12,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.06em",
  },

  readinessValue: {
    color: "#0f172a",
    fontSize: 16,
    fontWeight: 950,
    overflowWrap: "anywhere",
  },

  readinessDetail: {
    color: "#64748b",
    fontSize: 12,
    lineHeight: 1.35,
    fontWeight: 750,
    overflowWrap: "anywhere",
  },

  stockWatchPanel: {
    display: "grid",
    gap: 16,
    padding: 20,
    borderRadius: 26,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    boxShadow: "0 10px 30px rgba(15,23,42,0.05)",
    marginBottom: 18,
    minWidth: 0,
  },

  stockWatchGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(142px, 1fr))",
    gap: 10,
  },

  watchCard: {
    display: "grid",
    gap: 6,
    padding: 13,
    borderRadius: 18,
    border: "1px solid #e2e8f0",
    background: "#ffffff",
    minWidth: 0,
  },

  watchCardGood: {
    background: "linear-gradient(135deg, #ecfdf5 0%, #ffffff 80%)",
    borderColor: "#bbf7d0",
  },

  watchCardCritical: {
    background: "linear-gradient(135deg, #fef2f2 0%, #ffffff 80%)",
    borderColor: "#fecaca",
  },

  watchCardWarning: {
    background: "linear-gradient(135deg, #fffbeb 0%, #ffffff 80%)",
    borderColor: "#fde68a",
  },

  watchCardNeutral: {
    background: "linear-gradient(135deg, #f8fafc 0%, #ffffff 80%)",
    borderColor: "#e2e8f0",
  },

  watchLabel: {
    color: "#64748b",
    fontSize: 10,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    lineHeight: 1.2,
  },

  watchValue: {
    color: "#0f172a",
    fontSize: 26,
    lineHeight: 1,
    fontWeight: 950,
  },

  watchText: {
    margin: 0,
    color: "#64748b",
    fontSize: 12,
    lineHeight: 1.35,
    fontWeight: 730,
  },

  sectionCard: {
    display: "grid",
    gap: 18,
    padding: 22,
    borderRadius: 26,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    boxShadow: "0 2px 12px rgba(15,23,42,0.04)",
    marginBottom: 18,
    minWidth: 0,
    overflow: "hidden",
  },

  sectionHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: 14,
    flexWrap: "wrap",
    minWidth: 0,
  },

  sectionEyebrow: {
    color: "#2563eb",
    fontSize: 12,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    marginBottom: 6,
  },

  sectionTitle: {
    margin: 0,
    color: "#0f172a",
    fontSize: 28,
    letterSpacing: "-0.05em",
    overflowWrap: "anywhere",
  },

  sectionIntro: {
    margin: "6px 0 0",
    color: "#64748b",
    fontSize: 14,
    lineHeight: 1.45,
    fontWeight: 730,
  },

  itemsList: {
    display: "grid",
    gap: 12,
  },

  itemCard: {
    borderRadius: 22,
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    padding: 14,
    minWidth: 0,
    overflow: "hidden",
    boxShadow: "0 8px 24px rgba(15,23,42,0.04)",
  },

  itemCardGood: {
    background: "linear-gradient(135deg, #f0fdf4 0%, #ffffff 84%)",
    borderColor: "#bbf7d0",
  },

  itemCardCritical: {
    background: "linear-gradient(135deg, #fef2f2 0%, #ffffff 84%)",
    borderColor: "#fecaca",
  },

  itemCardWarning: {
    background: "linear-gradient(135deg, #fffbeb 0%, #ffffff 84%)",
    borderColor: "#fde68a",
  },

  itemCardNeutral: {
    background: "linear-gradient(135deg, #f8fafc 0%, #ffffff 84%)",
    borderColor: "#e2e8f0",
  },

  itemLayout: {
    display: "grid",
    gridTemplateColumns: "260px minmax(0, 1fr)",
    gap: 16,
    alignItems: "stretch",
    minWidth: 0,
  },

  itemImagePreviewWrap: {
    width: "100%",
    minHeight: 240,
    borderRadius: 18,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    overflow: "hidden",
    display: "grid",
    placeItems: "center",
    minWidth: 0,
  },

  itemImageFallback: {
    display: "grid",
    placeItems: "center",
    width: "100%",
    height: "100%",
    minHeight: 240,
    background:
      "linear-gradient(135deg, #ffffff 0%, #f8fafc 58%, #eff6ff 100%)",
    padding: 18,
    boxSizing: "border-box",
  },

  defaultItemImage: {
    display: "block",
    width: "min(88%, 210px)",
    height: "min(88%, 180px)",
    objectFit: "contain",
  },

  itemContent: {
    display: "grid",
    gap: 13,
    alignContent: "start",
    minWidth: 0,
  },

  itemSummary: {
    display: "grid",
    gap: 10,
    minWidth: 0,
  },

  itemTitleBlock: {
    display: "grid",
    gap: 8,
    minWidth: 0,
  },

  itemPillRow: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
    alignItems: "center",
    minWidth: 0,
  },

  itemStatusBadge: {
    display: "inline-flex",
    alignItems: "center",
    width: "fit-content",
    padding: "7px 10px",
    borderRadius: 999,
    border: "1px solid",
    fontSize: 12,
    fontWeight: 950,
    whiteSpace: "nowrap",
  },

  pricePill: {
    display: "inline-flex",
    alignItems: "center",
    width: "fit-content",
    padding: "7px 10px",
    borderRadius: 999,
    background: "#eff6ff",
    color: "#1d4ed8",
    border: "1px solid #bfdbfe",
    fontSize: 12,
    fontWeight: 950,
    whiteSpace: "nowrap",
  },

  readinessPill: {
    display: "inline-flex",
    alignItems: "center",
    width: "fit-content",
    padding: "7px 10px",
    borderRadius: 999,
    border: "1px solid",
    fontSize: 12,
    fontWeight: 950,
    whiteSpace: "nowrap",
  },

  stockPill: {
    display: "inline-flex",
    alignItems: "center",
    width: "fit-content",
    padding: "7px 10px",
    borderRadius: 999,
    border: "1px solid",
    fontSize: 12,
    fontWeight: 950,
    whiteSpace: "nowrap",
  },

  eventPill: {
    display: "inline-flex",
    alignItems: "center",
    width: "fit-content",
    padding: "7px 10px",
    borderRadius: 999,
    background: "#fef3c7",
    color: "#92400e",
    border: "1px solid #fde68a",
    fontSize: 12,
    fontWeight: 950,
    whiteSpace: "nowrap",
  },

  checkoutPill: {
    display: "inline-flex",
    alignItems: "center",
    width: "fit-content",
    padding: "7px 10px",
    borderRadius: 999,
    background: "#ecfdf5",
    color: "#166534",
    border: "1px solid #bbf7d0",
    fontSize: 12,
    fontWeight: 950,
    whiteSpace: "nowrap",
  },

  itemTitle: {
    margin: 0,
    color: "#0f172a",
    fontSize: 28,
    lineHeight: 1.06,
    letterSpacing: "-0.045em",
    overflowWrap: "anywhere",
  },

  itemDescription: {
    margin: 0,
    color: "#64748b",
    lineHeight: 1.5,
    fontSize: 14,
    fontWeight: 730,
    overflowWrap: "anywhere",
  },

  warningStrip: {
    display: "flex",
    gap: 7,
    flexWrap: "wrap",
    padding: 10,
    borderRadius: 16,
    background: "#ffffff",
    border: "1px solid #fde68a",
  },

  warningStripCritical: {
    borderColor: "#fecaca",
  },

  warningChip: {
    display: "inline-flex",
    width: "fit-content",
    padding: "6px 9px",
    borderRadius: 999,
    background: "#fffbeb",
    color: "#92400e",
    border: "1px solid #fde68a",
    fontSize: 11,
    fontWeight: 950,
    whiteSpace: "nowrap",
  },

  criticalWarningChip: {
    background: "#fef2f2",
    color: "#991b1b",
    borderColor: "#fecaca",
  },

  itemMetaGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
    gap: 10,
    minWidth: 0,
  },

  infoCard: {
    padding: 13,
    borderRadius: 16,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    minWidth: 0,
  },

  infoLabel: {
    color: "#64748b",
    fontSize: 11,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    marginBottom: 5,
  },

  infoValue: {
    color: "#0f172a",
    fontWeight: 850,
    lineHeight: 1.35,
    fontSize: 13,
    overflowWrap: "anywhere",
  },

  itemActions: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
    alignItems: "center",
  },

  editButton: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 42,
    padding: "10px 14px",
    borderRadius: 999,
    background: "#1683f8",
    color: "#ffffff",
    textDecoration: "none",
    fontSize: 13,
    fontWeight: 950,
    boxShadow: "0 10px 20px rgba(22,131,248,0.14)",
  },

  publicButton: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 42,
    padding: "10px 14px",
    borderRadius: 999,
    background: "#ffffff",
    color: "#0f172a",
    border: "1px solid #cbd5e1",
    textDecoration: "none",
    fontSize: 13,
    fontWeight: 950,
  },

  disabledPublicButton: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 42,
    padding: "10px 14px",
    borderRadius: 999,
    background: "#e2e8f0",
    color: "#475569",
    border: "1px solid #cbd5e1",
    fontSize: 13,
    fontWeight: 950,
    textAlign: "center",
  },

  emptyState: {
    display: "grid",
    gap: 10,
    justifyItems: "center",
    padding: 26,
    borderRadius: 28,
    background: "#ffffff",
    border: "1px dashed #cbd5e1",
    textAlign: "center",
    marginBottom: 18,
  },

  emptyIcon: {
    display: "grid",
    placeItems: "center",
    width: 74,
    height: 74,
    borderRadius: 22,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    boxShadow: "0 10px 24px rgba(15,23,42,0.07)",
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
    fontSize: 28,
    letterSpacing: "-0.045em",
  },

  emptyText: {
    margin: 0,
    color: "#64748b",
    lineHeight: 1.55,
    fontWeight: 750,
    maxWidth: 640,
  },

  emptyButton: {
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
  },

  summaryGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: 14,
  },

  summaryCard: {
    display: "grid",
    gap: 7,
    padding: 16,
    borderRadius: 22,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    boxShadow: "0 2px 12px rgba(15,23,42,0.04)",
  },

  summaryLabel: {
    color: "#64748b",
    fontSize: 12,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.06em",
  },

  summaryValue: {
    color: "#0f172a",
    fontSize: 30,
    lineHeight: 1,
    fontWeight: 950,
    letterSpacing: "-0.05em",
  },

  summaryText: {
    margin: 0,
    color: "#64748b",
    fontSize: 13,
    lineHeight: 1.45,
    fontWeight: 730,
  },
};
