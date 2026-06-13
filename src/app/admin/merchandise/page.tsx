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

type MerchandiseProductStatus = "draft" | "published" | "closed";

type MerchandiseProduct = {
  id: string;
  tenant_slug: string;
  slug: string;
  title: string;
  description: string;
  image_url: string | null;
  price_cents: number;
  currency: string;
  stock_quantity: number | null;
  sold_quantity: number;
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
      background: "#f8fafc",
      color: "#475569",
      borderColor: "#cbd5e1",
    };
  }

  return {
    background: "#fffbeb",
    color: "#92400e",
    borderColor: "#fde68a",
  };
}

function getStockLabel(product: MerchandiseProduct) {
  if (product.stock_quantity === null) {
    return "Unlimited / not tracked";
  }

  const remaining = Math.max(
    0,
    Number(product.stock_quantity || 0) - Number(product.sold_quantity || 0),
  );

  return `${remaining} remaining`;
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
        price_cents,
        currency,
        stock_quantity,
        sold_quantity,
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
        <div style={styles.heroContent}>
          <Link href="/admin" style={styles.backLink}>
            ← Back to dashboard
          </Link>

          <div style={styles.badgeRow}>
            <span style={styles.badge}>Merchandise / Shop</span>
            <span style={styles.softBadge}>Phase 7A setup</span>
          </div>

          <h1
            className="so-brand-heading merchandise-title"
            style={styles.title}
          >
            Merchandise fundraising
          </h1>

          <p style={styles.subtitle}>
            Set up tenant-branded merchandise products before public shop,
            checkout, stock handling and Stripe collection are connected in
            later phases.
          </p>

          <p style={styles.tenantLine}>
            Tenant: <strong>{tenantSlug}</strong> · Plan:{" "}
            <strong>{getTierLabel(tier)}</strong>
          </p>
        </div>

        <div className="merchandise-hero-stats" style={styles.heroStats}>
          <StatCard label="Products" value={products.length} dark />
          <StatCard label="Published" value={publishedProducts.length} dark />
          <StatCard label="Sold quantity" value={soldQuantity} dark />
          <StatCard
            label="Tracked estimate"
            value={formatMoney(estimatedRevenueCents)}
            dark
          />
        </div>
      </section>

      {!merchandiseCapability.allowed ? (
        <section style={styles.lockedPanel}>
          <div style={styles.lockedIcon}>🔒</div>

          <div style={styles.lockedCopy}>
            <p style={styles.lockedKicker}>Upgrade required</p>

            <h2 style={styles.lockedTitle}>
              Merchandise requires Professional or Foundation
            </h2>

            <p style={styles.lockedText}>
              {merchandiseCapability.reason || getMerchandiseUpgradeMessage()}
            </p>

            <Link href="/admin/settings/billing" style={styles.lockedButton}>
              View billing →
            </Link>
          </div>
        </section>
      ) : (
        <>
          <section className="merchandise-info-grid" style={styles.infoGrid}>
            <InfoCard
              title="Admin setup only"
              text="This phase creates the merchandise workspace and product structure without opening public purchasing yet."
            />

            <InfoCard
              title="Checkout comes later"
              text="Stripe checkout, receipts, webhook fulfilment and stock decrementing will be added in a controlled later phase."
            />

            <InfoCard
              title="Tenant isolated"
              text="Products are scoped to the current tenant and do not mix with raffles, squares, events or auctions."
            />
          </section>

          <section className="merchandise-readiness-panel" style={styles.panel}>
            <div>
              <p style={styles.kicker}>Product setup</p>

              <h2 style={styles.panelTitle}>Merchandise products</h2>

              <p style={styles.panelText}>
                Add or edit product records here. Public shop display and
                checkout will only be connected after this admin model is
                stable.
              </p>
            </div>

            <div style={styles.panelActions}>
              <Link href="/admin/merchandise/new" style={styles.primaryLink}>
                New product →
              </Link>

              <Link href="/admin/launch-readiness" style={styles.secondaryLink}>
                Launch Readiness →
              </Link>
            </div>
          </section>

          {products.length === 0 ? (
            <section style={styles.emptyState}>
              <div style={styles.emptyIcon}>🛍️</div>

              <h2 style={styles.emptyTitle}>No merchandise products yet</h2>

              <p style={styles.emptyText}>
                Create your first merchandise product. It will remain admin-only
                until public shop and checkout phases are added.
              </p>

              <Link href="/admin/merchandise/new" style={styles.emptyButton}>
                Create first product →
              </Link>
            </section>
          ) : (
            <section className="merchandise-product-grid" style={styles.grid}>
              {products.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </section>
          )}

          <section className="merchandise-summary-grid" style={styles.summaryGrid}>
            <SummaryCard
              label="Draft products"
              value={draftProducts.length}
              text="Not visible publicly."
            />

            <SummaryCard
              label="Published products"
              value={publishedProducts.length}
              text="Ready for public shop display later."
            />

            <SummaryCard
              label="Closed products"
              value={closedProducts.length}
              text="Retained for reporting/history."
            />
          </section>
        </>
      )}
    </main>
  );
}

function StatCard({
  label,
  value,
  dark = false,
}: {
  label: string;
  value: ReactNode;
  dark?: boolean;
}) {
  return (
    <article style={dark ? styles.darkStatCard : styles.statCard}>
      <span style={dark ? styles.darkStatLabel : styles.statLabel}>{label}</span>

      <strong style={dark ? styles.darkStatValue : styles.statValue}>
        {value}
      </strong>
    </article>
  );
}

function InfoCard({ title, text }: { title: string; text: string }) {
  return (
    <article style={styles.infoCard}>
      <h2 style={styles.infoTitle}>{title}</h2>
      <p style={styles.infoText}>{text}</p>
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
  return (
    <Link
      href={`/admin/merchandise/${encodeURIComponent(product.id)}`}
      style={styles.productLink}
    >
      <article style={styles.productCard}>
        <div style={styles.productImageWrap}>
          {product.image_url ? (
            <img
              src={product.image_url}
              alt={product.title}
              style={styles.productImage}
            />
          ) : (
            <div style={styles.productImageFallback}>SHOP</div>
          )}
        </div>

        <div style={styles.productBody}>
          <div style={styles.productTop}>
            <span
              style={{
                ...styles.statusPill,
                ...statusStyle(product.status),
              }}
            >
              {statusLabel(product.status)}
            </span>

            <span style={styles.pricePill}>
              {formatMoney(product.price_cents, product.currency)}
            </span>
          </div>

          <h2 style={styles.productTitle}>{product.title}</h2>

          <p style={styles.productDescription}>
            {product.description || "No product description added yet."}
          </p>

          <div style={styles.productMetaGrid}>
            <div style={styles.productMeta}>
              <span style={styles.productMetaLabel}>Stock</span>
              <strong style={styles.productMetaValue}>
                {getStockLabel(product)}
              </strong>
            </div>

            <div style={styles.productMeta}>
              <span style={styles.productMetaLabel}>Sold</span>
              <strong style={styles.productMetaValue}>
                {product.sold_quantity}
              </strong>
            </div>

            <div style={styles.productMeta}>
              <span style={styles.productMetaLabel}>Created</span>
              <strong style={styles.productMetaValue}>
                {formatDate(product.created_at)}
              </strong>
            </div>
          </div>

          <span style={styles.editLink}>Edit product →</span>
        </div>
      </article>
    </Link>
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

.admin-merchandise-page section,
.admin-merchandise-page article,
.admin-merchandise-page div,
.admin-merchandise-page a,
.admin-merchandise-page p,
.admin-merchandise-page h1,
.admin-merchandise-page h2,
.admin-merchandise-page strong,
.admin-merchandise-page span {
  min-width: 0;
  max-width: 100%;
}

@media (max-width: 1060px) {
  .admin-merchandise-page .merchandise-hero {
    grid-template-columns: 1fr !important;
  }

  .admin-merchandise-page .merchandise-hero-stats,
  .admin-merchandise-page .merchandise-info-grid,
  .admin-merchandise-page .merchandise-summary-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
  }
}

@media (max-width: 720px) {
  .admin-merchandise-page {
    padding: 18px 12px 44px !important;
  }

  .admin-merchandise-page .merchandise-hero,
  .admin-merchandise-page .merchandise-readiness-panel {
    padding: 20px !important;
    border-radius: 26px !important;
  }

  .admin-merchandise-page .merchandise-title {
    font-size: clamp(40px, 12vw, 58px) !important;
    line-height: 0.98 !important;
  }

  .admin-merchandise-page .merchandise-hero-stats,
  .admin-merchandise-page .merchandise-info-grid,
  .admin-merchandise-page .merchandise-product-grid,
  .admin-merchandise-page .merchandise-summary-grid {
    grid-template-columns: 1fr !important;
  }

  .admin-merchandise-page .merchandise-readiness-panel {
    grid-template-columns: 1fr !important;
  }

  .admin-merchandise-page a {
    width: 100% !important;
  }
}
`;

const styles: Record<string, CSSProperties> = {
  page: {
    width: "100%",
    maxWidth: 1220,
    margin: "0 auto",
    padding: "28px 16px 64px",
    minHeight: "100vh",
    background:
      "radial-gradient(circle at top left, rgba(22,131,248,0.08), transparent 32%), radial-gradient(circle at top right, rgba(250,204,21,0.12), transparent 34%), #f8fafc",
    color: "#0f172a",
    overflowX: "hidden",
  },

  hero: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1.12fr) minmax(300px, 0.88fr)",
    gap: 22,
    padding: 30,
    borderRadius: 34,
    background:
      "radial-gradient(circle at bottom right, rgba(250,204,21,0.18), transparent 38%), linear-gradient(135deg, #020617 0%, #0f172a 55%, #172554 100%)",
    color: "#ffffff",
    marginBottom: 18,
    boxShadow: "0 28px 70px rgba(15,23,42,0.22)",
    overflow: "hidden",
    border: "1px solid rgba(148,163,184,0.22)",
  },

  heroContent: {
    minWidth: 0,
  },

  backLink: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: "fit-content",
    marginBottom: 16,
    padding: "10px 14px",
    borderRadius: 999,
    background: "rgba(255,255,255,0.08)",
    color: "#ffffff",
    border: "1px solid rgba(255,255,255,0.18)",
    textDecoration: "none",
    fontSize: 13,
    fontWeight: 950,
  },

  badgeRow: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
    alignItems: "center",
    marginBottom: 14,
  },

  badge: {
    display: "inline-flex",
    padding: "8px 12px",
    borderRadius: 999,
    background: "rgba(37,99,235,0.22)",
    color: "#dbeafe",
    border: "1px solid rgba(147,197,253,0.34)",
    fontSize: 13,
    fontWeight: 950,
  },

  softBadge: {
    display: "inline-flex",
    padding: "8px 12px",
    borderRadius: 999,
    background: "rgba(251,191,36,0.16)",
    color: "#fef3c7",
    border: "1px solid rgba(251,191,36,0.32)",
    fontSize: 13,
    fontWeight: 950,
  },

  title: {
    margin: 0,
    fontSize: "clamp(52px, 7vw, 82px)",
    lineHeight: 0.92,
    letterSpacing: "-0.08em",
    color: "#ffffff",
    overflowWrap: "anywhere",
    textShadow: "0 18px 45px rgba(0,0,0,0.22)",
  },

  subtitle: {
    margin: "18px 0 0",
    maxWidth: 780,
    color: "#dbeafe",
    fontSize: 18,
    lineHeight: 1.6,
    fontWeight: 700,
    overflowWrap: "anywhere",
  },

  tenantLine: {
    margin: "16px 0 0",
    color: "#bfdbfe",
    fontSize: 14,
    fontWeight: 850,
    overflowWrap: "anywhere",
  },

  heroStats: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 12,
    alignContent: "start",
  },

  statCard: {
    display: "grid",
    gap: 6,
    padding: 16,
    borderRadius: 20,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
  },

  darkStatCard: {
    display: "grid",
    gap: 6,
    padding: 18,
    borderRadius: 22,
    background: "rgba(255,255,255,0.08)",
    border: "1px solid rgba(148,163,184,0.26)",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.10)",
    backdropFilter: "blur(12px)",
  },

  statLabel: {
    color: "#64748b",
    fontSize: 13,
    fontWeight: 850,
  },

  darkStatLabel: {
    color: "#bfdbfe",
    fontSize: 13,
    fontWeight: 850,
  },

  statValue: {
    color: "#0f172a",
    fontSize: 28,
    fontWeight: 950,
    letterSpacing: "-0.05em",
  },

  darkStatValue: {
    color: "#ffffff",
    fontSize: 30,
    fontWeight: 950,
    letterSpacing: "-0.05em",
    overflowWrap: "anywhere",
  },

  lockedPanel: {
    display: "grid",
    gridTemplateColumns: "68px minmax(0, 1fr)",
    gap: 18,
    padding: 22,
    borderRadius: 28,
    background:
      "linear-gradient(135deg, rgba(255,247,237,0.96), rgba(255,255,255,1) 70%)",
    border: "1px solid #fed7aa",
    boxShadow: "0 12px 30px rgba(194,65,12,0.08)",
  },

  lockedIcon: {
    display: "grid",
    placeItems: "center",
    width: 62,
    height: 62,
    borderRadius: 20,
    background: "#ffedd5",
    border: "1px solid #fdba74",
    fontSize: 28,
  },

  lockedCopy: {
    display: "grid",
    gap: 8,
  },

  lockedKicker: {
    margin: 0,
    color: "#c2410c",
    fontSize: 12,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
  },

  lockedTitle: {
    margin: 0,
    color: "#0f172a",
    fontSize: 30,
    lineHeight: 1.08,
    letterSpacing: "-0.05em",
  },

  lockedText: {
    margin: 0,
    color: "#7c2d12",
    lineHeight: 1.55,
    fontWeight: 750,
  },

  lockedButton: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: "fit-content",
    minHeight: 44,
    padding: "10px 15px",
    borderRadius: 999,
    background: "#0f172a",
    color: "#ffffff",
    textDecoration: "none",
    fontWeight: 950,
  },

  infoGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: 14,
    marginBottom: 18,
  },

  infoCard: {
    display: "grid",
    gap: 8,
    padding: 16,
    borderRadius: 22,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    boxShadow: "0 2px 12px rgba(15,23,42,0.04)",
  },

  infoTitle: {
    margin: 0,
    color: "#0f172a",
    fontSize: 20,
    lineHeight: 1.12,
    letterSpacing: "-0.035em",
  },

  infoText: {
    margin: 0,
    color: "#64748b",
    lineHeight: 1.5,
    fontSize: 14,
    fontWeight: 750,
  },

  panel: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) auto",
    gap: 16,
    alignItems: "center",
    padding: 22,
    borderRadius: 28,
    background:
      "linear-gradient(135deg, rgba(255,255,255,1), rgba(239,246,255,0.88))",
    border: "1px solid #bfdbfe",
    boxShadow: "0 12px 30px rgba(22,131,248,0.08)",
    marginBottom: 18,
  },

  kicker: {
    margin: "0 0 7px",
    color: "#2563eb",
    fontSize: 12,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
  },

  panelTitle: {
    margin: 0,
    color: "#0f172a",
    fontSize: 30,
    lineHeight: 1.08,
    letterSpacing: "-0.05em",
  },

  panelText: {
    margin: "8px 0 0",
    color: "#475569",
    lineHeight: 1.55,
    fontWeight: 750,
    maxWidth: 760,
  },

  panelActions: {
    display: "grid",
    gap: 10,
    justifyItems: "stretch",
    minWidth: 210,
  },

  primaryLink: {
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

  secondaryLink: {
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
    fontSize: 34,
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

  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 300px), 1fr))",
    gap: 16,
    marginBottom: 18,
  },

  productLink: {
    display: "block",
    color: "inherit",
    textDecoration: "none",
    height: "100%",
  },

  productCard: {
    display: "grid",
    gridTemplateRows: "180px minmax(0, 1fr)",
    borderRadius: 28,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    boxShadow: "0 8px 30px rgba(15,23,42,0.05)",
    overflow: "hidden",
    height: "100%",
  },

  productImageWrap: {
    display: "grid",
    placeItems: "center",
    background:
      "radial-gradient(circle at top right, rgba(250,204,21,0.16), transparent 38%), #f8fafc",
    borderBottom: "1px solid #e2e8f0",
  },

  productImage: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
    display: "block",
  },

  productImageFallback: {
    display: "grid",
    placeItems: "center",
    width: 86,
    height: 86,
    borderRadius: 26,
    background: "#0f172a",
    color: "#facc15",
    fontSize: 16,
    fontWeight: 950,
    letterSpacing: "0.08em",
  },

  productBody: {
    display: "grid",
    gap: 11,
    padding: 17,
  },

  productTop: {
    display: "flex",
    gap: 8,
    justifyContent: "space-between",
    alignItems: "center",
    flexWrap: "wrap",
  },

  statusPill: {
    display: "inline-flex",
    alignItems: "center",
    width: "fit-content",
    padding: "7px 10px",
    borderRadius: 999,
    border: "1px solid",
    fontSize: 12,
    fontWeight: 950,
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
  },

  productTitle: {
    margin: 0,
    color: "#0f172a",
    fontSize: 25,
    lineHeight: 1.08,
    letterSpacing: "-0.045em",
    overflowWrap: "anywhere",
  },

  productDescription: {
    margin: 0,
    color: "#64748b",
    lineHeight: 1.5,
    fontSize: 14,
    fontWeight: 730,
    overflowWrap: "anywhere",
  },

  productMetaGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: 8,
  },

  productMeta: {
    display: "grid",
    gap: 4,
    padding: 10,
    borderRadius: 16,
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
  },

  productMetaLabel: {
    color: "#64748b",
    fontSize: 11,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.05em",
  },

  productMetaValue: {
    color: "#0f172a",
    fontSize: 12,
    lineHeight: 1.35,
    fontWeight: 900,
    overflowWrap: "anywhere",
  },

  editLink: {
    color: "#2563eb",
    fontSize: 13,
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
