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

type MerchandiseProductStatus = "draft" | "published" | "closed";

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

function formatMoney(cents: number, currency = "GBP") {
  try {
    return new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency,
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

function getStockLabel(product: MerchandiseProduct) {
  const remaining = getStockRemaining(product);

  if (remaining === null) {
    return "Manual / not limited";
  }

  if (remaining === 1) {
    return "1 remaining";
  }

  return `${remaining} remaining`;
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
        id,
        tenant_slug,
        slug,
        title,
        description,
        image_url,
        image_focus_x,
        image_focus_y,
        price_cents,
        currency,
        stock_quantity,
        sold_quantity,
        options_json,
        status,
        created_at::text,
        updated_at::text
      from merchandise_products
      where tenant_slug = $1
      order by created_at desc
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
        <div style={styles.heroImageWrap}>
          <img
            src={DEFAULT_MERCHANDISE_IMAGE_SRC}
            alt="Merchandise"
            style={styles.heroImage}
          />
        </div>

        <div style={styles.heroContent}>
          <div style={styles.heroTopRow}>
            <div style={styles.badgeRow}>
              <span style={styles.statusBadge}>Merchandise / Shop</span>
              <span style={styles.planBadge}>{getTierLabel(tier)} plan</span>
              <span style={styles.phaseBadge}>Public display live</span>
            </div>

            <Link href="/admin" style={styles.secondaryButton}>
              ← Back to dashboard
            </Link>
          </div>

          <h1 className="merchandise-title" style={styles.heroTitle}>
            Merchandise products
          </h1>

          <p style={styles.heroDescription}>
            Create and manage merchandise products for the public shop. Published
            products now appear on the public shop and product pages. Secure
            checkout, order records, stock automation and fulfilment controls
            will be added in later controlled phases.
          </p>

          <div className="merchandise-hero-stats" style={styles.heroStats}>
            <StatCard label="Products" value={products.length} />
            <StatCard label="Published" value={publishedProducts.length} />
            <StatCard label="Manual sold quantity" value={soldQuantity} />
            <StatCard
              label="Manual estimate"
              value={formatMoney(estimatedRevenueCents)}
            />
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
                  Published products are visible on the public shop. This is
                  still a display-only merchandise phase: supporters can view
                  items and contact the organiser, but they cannot buy online
                  yet.
                </p>
              </div>

              <div className="merchandise-actions" style={styles.panelActions}>
                <Link href="/admin/merchandise/new" style={styles.primaryButton}>
                  New product →
                </Link>

                <Link
                  href={getPublicShopHref(tenantSlug)}
                  target="_blank"
                  style={styles.secondaryPanelButton}
                >
                  View public shop →
                </Link>

                <Link
                  href="/admin/launch-readiness"
                  style={styles.secondaryPanelButton}
                >
                  Launch Readiness →
                </Link>
              </div>
            </div>

            <div
              className="merchandise-readiness-grid"
              style={styles.readinessGrid}
            >
              <ReadinessItem
                label="Admin setup"
                value="Live"
                detail="Product records, images, prices, stock notes and options can be managed."
                tone="good"
              />

              <ReadinessItem
                label="Public shop"
                value="Live display"
                detail="Published products appear on the tenant shop and product pages."
                tone="good"
              />

              <ReadinessItem
                label="Checkout"
                value="Not connected"
                detail="Stripe checkout, receipts, order records, stock decrementing and fulfilment are not live yet."
                tone="warning"
              />

              <ReadinessItem
                label="Stock"
                value="Manual for now"
                detail="Sold quantity is not updated automatically until checkout and order handling are built."
                tone="neutral"
              />

              <ReadinessItem
                label="Branding"
                value="Subscription-gated"
                detail="Public shop branding follows the same advanced-branding rules as the campaign hub."
                tone="good"
              />

              <ReadinessItem
                label="Event fulfilment"
                value="Later phase"
                detail="Event-linked collection, table delivery and seat delivery are planned for a later phase."
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
                admin-only. Published products appear on the public shop, but
                online checkout is not connected yet.
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
                    Published products are public. Draft products are private.
                    The public pages are display-only until checkout is added.
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
  tone: "good" | "warning" | "neutral";
}) {
  return (
    <article
      style={{
        ...styles.readinessItem,
        ...(tone === "good"
          ? styles.readinessItemGood
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

  return (
    <article style={styles.itemCard}>
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

                <span style={styles.displayOnlyPill}>Display-only</span>
              </div>

              <h3 style={styles.itemTitle}>{product.title}</h3>

              <p style={styles.itemDescription}>
                {product.description || "No product description added yet."}
              </p>
            </div>
          </div>

          <div
            className="merchandise-item-meta-grid"
            style={styles.itemMetaGrid}
          >
            <InfoBlock label="Stock" value={getStockLabel(product)} />

            <InfoBlock label="Manual sold" value={product.sold_quantity} />

            <InfoBlock
              label="Sizes"
              value={sizes.length ? sizes.join(", ") : "Not set"}
            />

            <InfoBlock label="Created" value={formatDate(product.created_at)} />
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
  .admin-merchandise-page .merchandise-hero,
  .admin-merchandise-page .merchandise-item-layout {
    grid-template-columns: 1fr !important;
  }

  .admin-merchandise-page .merchandise-hero-stats,
  .admin-merchandise-page .merchandise-readiness-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
  }

  .admin-merchandise-page .merchandise-actions {
    width: 100% !important;
    justify-content: stretch !important;
  }
}

@media (max-width: 640px) {
  .admin-merchandise-page {
    padding: 18px 12px 44px !important;
  }

  .admin-merchandise-page .merchandise-hero,
  .admin-merchandise-page .merchandise-readiness-panel,
  .admin-merchandise-page .merchandise-section-card {
    padding: 20px !important;
    border-radius: 24px !important;
  }

  .admin-merchandise-page .merchandise-title {
    font-size: clamp(34px, 12vw, 48px) !important;
    line-height: 1 !important;
  }

  .admin-merchandise-page .merchandise-hero-stats,
  .admin-merchandise-page .merchandise-readiness-grid,
  .admin-merchandise-page .merchandise-summary-grid,
  .admin-merchandise-page .merchandise-item-meta-grid {
    grid-template-columns: 1fr !important;
  }

  .admin-merchandise-page button,
  .admin-merchandise-page a {
    min-height: 46px !important;
  }

  .admin-merchandise-page .merchandise-actions,
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
    gridTemplateColumns: "minmax(260px, 0.72fr) minmax(0, 1.28fr)",
    gap: 22,
    padding: 24,
    borderRadius: 28,
    background:
      "linear-gradient(135deg, #020617 0%, #0f172a 54%, #172554 100%)",
    color: "#ffffff",
    marginBottom: 18,
    boxShadow: "0 24px 60px rgba(15,23,42,0.18)",
    minWidth: 0,
    overflow: "hidden",
  },

  heroImageWrap: {
    minHeight: 260,
    borderRadius: 22,
    overflow: "hidden",
    background:
      "linear-gradient(135deg, #ffffff 0%, #f8fafc 58%, #eff6ff 100%)",
    minWidth: 0,
    display: "grid",
    placeItems: "center",
    padding: 24,
    boxSizing: "border-box",
  },

  heroImage: {
    display: "block",
    width: "min(88%, 240px)",
    height: "min(88%, 210px)",
    objectFit: "contain",
  },

  heroContent: {
    display: "grid",
    gap: 14,
    alignContent: "start",
    minWidth: 0,
  },

  heroTopRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    flexWrap: "wrap",
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
    fontSize: "clamp(36px, 6vw, 58px)",
    lineHeight: 0.96,
    letterSpacing: "-0.07em",
    overflowWrap: "anywhere",
  },

  heroDescription: {
    margin: 0,
    color: "#dbeafe",
    lineHeight: 1.6,
    fontWeight: 700,
    overflowWrap: "anywhere",
  },

  heroStats: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
    gap: 10,
    minWidth: 0,
  },

  heroMeta: {
    display: "grid",
    gap: 6,
    color: "#bfdbfe",
    fontSize: 14,
    fontWeight: 750,
    overflowWrap: "anywhere",
  },

  statusBadge: {
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
    width: "fit-content",
    padding: "8px 12px",
    borderRadius: 999,
    background: "rgba(251,191,36,0.12)",
    color: "#fde68a",
    border: "1px solid rgba(251,191,36,0.54)",
    fontSize: 13,
    fontWeight: 950,
    whiteSpace: "nowrap",
  },

  secondaryButton: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 42,
    padding: "10px 14px",
    borderRadius: 999,
    background: "#ffffff",
    color: "#0f172a",
    textDecoration: "none",
    fontWeight: 950,
  },

  statCard: {
    padding: 14,
    borderRadius: 18,
    background: "rgba(255,255,255,0.09)",
    border: "1px solid rgba(255,255,255,0.16)",
    minWidth: 0,
  },

  statLabel: {
    color: "#fde68a",
    fontSize: 12,
    fontWeight: 900,
  },

  statValue: {
    marginTop: 4,
    color: "#ffffff",
    fontSize: 22,
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
    display: "flex",
    justifyContent: "space-between",
    gap: 14,
    alignItems: "flex-start",
    flexWrap: "wrap",
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
    maxWidth: 760,
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

  panelActions: {
    display: "grid",
    gridTemplateColumns: "1fr",
    gap: 10,
    justifyItems: "stretch",
    minWidth: 210,
  },

  primaryButton: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
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

  secondaryPanelButton: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
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

  displayOnlyPill: {
    display: "inline-flex",
    alignItems: "center",
    width: "fit-content",
    padding: "7px 10px",
    borderRadius: 999,
    background: "#f8fafc",
    color: "#475569",
    border: "1px solid #e2e8f0",
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

  itemMetaGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
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
