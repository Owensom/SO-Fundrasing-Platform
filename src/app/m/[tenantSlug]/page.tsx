import type { CSSProperties } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { queryOne } from "@/lib/db";
import { getTenantSettings } from "@/lib/tenant-settings";
import {
  checkSubscriptionCapability,
  normaliseSubscriptionTier,
} from "@/lib/subscription-capabilities";

export const dynamic = "force-dynamic";
export const revalidate = 0;

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
  description: string | null;
  image_url: string | null;
  image_focus_x: number | null;
  image_focus_y: number | null;
  price_cents: number;
  currency: string;
  stock_quantity: number | null;
  sold_quantity: number;
  options_json: MerchandiseOption[] | null;
  status: string;
  created_at: string;
  updated_at: string;
};

type TenantPublicSettings = {
  public_display_name?: string | null;
  public_tagline?: string | null;
  public_logo_url?: string | null;
  public_logo_mark_url?: string | null;
  public_primary_colour?: string | null;
  public_accent_colour?: string | null;
  public_footer_text?: string | null;
  public_contact_email?: string | null;
  public_contact_name?: string | null;
  subscription_tier?: string | null;
  subscription_status?: string | null;
  platform_owner_bypass?: boolean | null;
};

function cleanText(value: unknown, fallback = "") {
  const clean = String(value ?? "").trim();
  return clean || fallback;
}

function normaliseHexColour(value: unknown, fallback: string) {
  const clean = cleanText(value).toUpperCase();

  if (/^#[0-9A-F]{6}$/.test(clean)) {
    return clean;
  }

  return fallback;
}

function hexToRgb(hex: string) {
  const clean = normaliseHexColour(hex, "#0F172A").replace("#", "");

  return {
    r: Number.parseInt(clean.slice(0, 2), 16),
    g: Number.parseInt(clean.slice(2, 4), 16),
    b: Number.parseInt(clean.slice(4, 6), 16),
  };
}

function getReadableTextColour(background: string) {
  const { r, g, b } = hexToRgb(background);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

  return luminance > 0.62 ? "#0f172a" : "#ffffff";
}

function normaliseFocus(value: unknown) {
  const number = Number(value);

  if (!Number.isFinite(number)) return 50;

  return Math.max(0, Math.min(100, Math.round(number)));
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

function getStockLabel(product: MerchandiseProduct) {
  if (product.stock_quantity === null) {
    return "Availability to be confirmed";
  }

  const remaining = Math.max(
    0,
    Number(product.stock_quantity || 0) - Number(product.sold_quantity || 0),
  );

  if (remaining <= 0) {
    return "Ask organiser for availability";
  }

  if (remaining === 1) {
    return "1 item remaining";
  }

  return `${remaining} items remaining`;
}

function getStockTone(product: MerchandiseProduct) {
  if (product.stock_quantity === null) return "good";

  const remaining = Math.max(
    0,
    Number(product.stock_quantity || 0) - Number(product.sold_quantity || 0),
  );

  if (remaining <= 0) return "closed";
  if (remaining <= 5) return "warning";

  return "good";
}

function getSizeOptions(product: MerchandiseProduct) {
  if (!Array.isArray(product.options_json)) return [];

  return product.options_json
    .filter((option) => cleanText(option?.type).toLowerCase() === "size")
    .map((option) => cleanText(option?.label || option?.value))
    .filter(Boolean);
}

function getSizeSummary(product: MerchandiseProduct) {
  const sizes = getSizeOptions(product);

  if (sizes.length === 0) {
    return "No size options";
  }

  return sizes.join(", ");
}

function getBestLogo({
  settings,
  canUseAdvancedBranding,
}: {
  settings: TenantPublicSettings | null;
  canUseAdvancedBranding: boolean;
}) {
  if (!canUseAdvancedBranding) {
    return "/brand/so-logo-mark.png";
  }

  return (
    cleanText(settings?.public_logo_mark_url) ||
    cleanText(settings?.public_logo_url) ||
    "/brand/so-logo-mark.png"
  );
}

function getDisplayName(settings: TenantPublicSettings | null) {
  return cleanText(settings?.public_display_name) || "SO Fundraising Platform";
}

function getImageObjectPosition(product: MerchandiseProduct) {
  return `${normaliseFocus(product.image_focus_x)}% ${normaliseFocus(
    product.image_focus_y,
  )}%`;
}

async function getPublishedProduct({
  tenantSlug,
  slug,
}: {
  tenantSlug: string;
  slug: string;
}) {
  return queryOne<MerchandiseProduct>(
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
        and slug = $2
        and status = 'published'
      limit 1
    `,
    [tenantSlug, slug],
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ tenantSlug: string; slug: string }>;
}): Promise<Metadata> {
  const { tenantSlug, slug } = await params;

  const [product, tenantSettingsRaw] = await Promise.all([
    getPublishedProduct({ tenantSlug, slug }),
    getTenantSettings(tenantSlug),
  ]);

  if (!product) {
    return {
      title: "Merchandise not available",
    };
  }

  const tenantSettings = tenantSettingsRaw as TenantPublicSettings | null;

  const merchandiseCapability = checkSubscriptionCapability(
    tenantSettings,
    "merchandise",
  );

  if (!merchandiseCapability.allowed) {
    return {
      title: "Merchandise not available",
    };
  }

  const subscriptionTier = normaliseSubscriptionTier(
    tenantSettings?.subscription_tier,
  );

  const canUseProductImages = subscriptionTier !== "community";
  const displayName = getDisplayName(tenantSettings);
  const description =
    cleanText(product.description) ||
    `Support ${displayName} through merchandise.`;

  const imageUrl = canUseProductImages ? cleanText(product.image_url) : "";

  return {
    title: `${product.title} | ${displayName}`,
    description,
    openGraph: {
      title: `${product.title} | ${displayName}`,
      description,
      images: imageUrl ? [{ url: imageUrl }] : undefined,
    },
  };
}

export default async function PublicMerchandiseProductPage({
  params,
}: {
  params: Promise<{ tenantSlug: string; slug: string }>;
}) {
  const { tenantSlug, slug } = await params;

  const [product, tenantSettingsRaw] = await Promise.all([
    getPublishedProduct({ tenantSlug, slug }),
    getTenantSettings(tenantSlug),
  ]);

  if (!product) {
    notFound();
  }

  const tenantSettings = tenantSettingsRaw as TenantPublicSettings | null;

  const merchandiseCapability = checkSubscriptionCapability(
    tenantSettings,
    "merchandise",
  );

  const advancedBrandingCapability = checkSubscriptionCapability(
    tenantSettings,
    "advanced_branding",
  );

  if (!merchandiseCapability.allowed) {
    notFound();
  }

  const subscriptionTier = normaliseSubscriptionTier(
    tenantSettings?.subscription_tier,
  );

  const canUseAdvancedBranding = advancedBrandingCapability.allowed;
  const canUseProductImages = subscriptionTier !== "community";

  const displayName = getDisplayName(tenantSettings);
  const logoUrl = getBestLogo({
    settings: tenantSettings,
    canUseAdvancedBranding,
  });

  const primaryColour = canUseAdvancedBranding
    ? normaliseHexColour(tenantSettings?.public_primary_colour, "#1683F8")
    : "#1683F8";

  const accentColour = canUseAdvancedBranding
    ? normaliseHexColour(tenantSettings?.public_accent_colour, "#FACC15")
    : "#FACC15";

  const primaryTextColour = getReadableTextColour(primaryColour);
  const contactEmail = cleanText(tenantSettings?.public_contact_email);
  const contactName = cleanText(tenantSettings?.public_contact_name);
  const footerText = canUseAdvancedBranding
    ? cleanText(tenantSettings?.public_footer_text)
    : "";

  const stockTone = getStockTone(product);
  const sizeOptions = getSizeOptions(product);
  const productImageUrl = canUseProductImages ? cleanText(product.image_url) : "";

  const heroBackground = canUseAdvancedBranding
    ? `radial-gradient(circle at bottom right, ${accentColour}22, transparent 38%), radial-gradient(circle at top left, ${primaryColour}22, transparent 34%), linear-gradient(135deg, #020617 0%, #0f172a 58%, #111827 100%)`
    : "radial-gradient(circle at bottom right, rgba(250,204,21,0.14), transparent 38%), radial-gradient(circle at top left, rgba(22,131,248,0.18), transparent 34%), linear-gradient(135deg, #020617 0%, #0f172a 58%, #172554 100%)";

  return (
    <main className="public-merchandise-page" style={styles.page}>
      <style>{responsiveStyles}</style>

      <section
        className="merchandise-hero"
        style={{
          ...styles.hero,
          background: heroBackground,
        }}
      >
        <div style={styles.heroCopy}>
          <Link href={`/m/${tenantSlug}`} style={styles.backLink}>
            ← Back to shop
          </Link>

          <div className="brandRow" style={styles.brandRow}>
            <div
              style={{
                ...styles.logoWrap,
                borderColor: canUseAdvancedBranding
                  ? `${accentColour}66`
                  : "rgba(255,255,255,0.55)",
              }}
            >
              <img src={logoUrl} alt={displayName} style={styles.logoImage} />
            </div>

            <div style={styles.brandCopy}>
              <p
                style={{
                  ...styles.brandKicker,
                  color: canUseAdvancedBranding ? accentColour : "#facc15",
                }}
              >
                Merchandise
              </p>

              <h1 className="merchandise-title" style={styles.title}>
                {product.title}
              </h1>
            </div>
          </div>

          <p style={styles.subtitle}>
            {cleanText(product.description) ||
              `Support ${displayName} through this merchandise item.`}
          </p>

          <div style={styles.heroPills}>
            <span
              style={{
                ...styles.pricePill,
                background: primaryColour,
                borderColor: primaryColour,
                color: primaryTextColour,
              }}
            >
              {formatMoney(product.price_cents, product.currency)}
            </span>

            <span
              style={{
                ...styles.stockPill,
                ...(stockTone === "closed"
                  ? styles.stockPillClosed
                  : stockTone === "warning"
                    ? styles.stockPillWarning
                    : styles.stockPillGood),
              }}
            >
              {getStockLabel(product)}
            </span>

            {sizeOptions.length ? (
              <span style={styles.sizeHeroPill}>
                Sizes: {sizeOptions.join(", ")}
              </span>
            ) : null}
          </div>
        </div>

        <aside style={styles.heroCard}>
          <div style={styles.heroCardImageWrap}>
            {productImageUrl ? (
              <img
                src={productImageUrl}
                alt={product.title}
                style={{
                  ...styles.productImage,
                  objectPosition: getImageObjectPosition(product),
                }}
              />
            ) : (
              <div style={styles.imageFallback}>SHOP</div>
            )}
          </div>
        </aside>
      </section>

      <section className="merchandise-info-grid" style={styles.infoGrid}>
        <article style={styles.primaryPanel}>
          <p style={{ ...styles.kicker, color: primaryColour }}>
            Product details
          </p>

          <h2 style={styles.sectionTitle}>Support {displayName}</h2>

          <p style={styles.sectionText}>
            This merchandise page is currently for public display only. Online
            purchasing and checkout will be added in a later controlled phase.
          </p>

          <div style={styles.detailGrid}>
            <DetailItem
              label="Price"
              value={formatMoney(product.price_cents, product.currency)}
            />

            <DetailItem label="Availability" value={getStockLabel(product)} />

            <DetailItem label="Sizes / options" value={getSizeSummary(product)} />

            <DetailItem label="Organisation" value={displayName} />
          </div>

          {sizeOptions.length ? (
            <div
              style={{
                ...styles.sizePanel,
                borderColor: canUseAdvancedBranding
                  ? `${accentColour}55`
                  : "#dbeafe",
              }}
            >
              <p style={styles.sizePanelTitle}>Available sizes/options</p>

              <div style={styles.sizePillGrid}>
                {sizeOptions.map((size) => (
                  <span key={size} style={styles.sizePill}>
                    {size}
                  </span>
                ))}
              </div>
            </div>
          ) : null}
        </article>

        <aside style={styles.actionPanel}>
          <p style={{ ...styles.kicker, color: primaryColour }}>
            Buying online
          </p>

          <h2 style={styles.actionTitle}>Checkout coming soon</h2>

          <p style={styles.actionText}>
            This product is ready for public display. Secure online purchasing,
            stock handling and receipts will be connected in a later phase.
          </p>

          <div style={styles.disabledCheckout}>
            Online checkout not connected yet
          </div>

          <Link
            href={`/m/${tenantSlug}`}
            style={{
              ...styles.primaryLink,
              background: primaryColour,
              borderColor: primaryColour,
              color: primaryTextColour,
            }}
          >
            View shop →
          </Link>

          <Link href={`/c/${tenantSlug}`} style={styles.secondaryLink}>
            Public campaign hub →
          </Link>

          {contactEmail ? (
            <a
              href={`mailto:${contactEmail}?subject=${encodeURIComponent(
                `Merchandise enquiry: ${product.title}`,
              )}`}
              style={styles.secondaryLink}
            >
              Contact {contactName || "organiser"} →
            </a>
          ) : null}
        </aside>
      </section>

      {footerText ? (
        <section
          className="merchandise-footer-panel"
          style={styles.footerPanel}
        >
          <div>
            <p style={styles.footerBrand}>{displayName}</p>

            <p style={styles.footerText}>{footerText}</p>
          </div>

          <Link href={`/c/${tenantSlug}`} style={styles.footerLink}>
            Public campaign hub →
          </Link>
        </section>
      ) : null}
    </main>
  );
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div style={styles.detailItem}>
      <span style={styles.detailLabel}>{label}</span>
      <strong style={styles.detailValue}>{value}</strong>
    </div>
  );
}

const responsiveStyles = `
.public-merchandise-page,
.public-merchandise-page * {
  box-sizing: border-box;
}

.public-merchandise-page {
  overflow-x: hidden;
}

.public-merchandise-page section,
.public-merchandise-page article,
.public-merchandise-page aside,
.public-merchandise-page div,
.public-merchandise-page a,
.public-merchandise-page p,
.public-merchandise-page h1,
.public-merchandise-page h2,
.public-merchandise-page strong,
.public-merchandise-page span {
  min-width: 0;
  max-width: 100%;
}

@media (max-width: 920px) {
  .public-merchandise-page .merchandise-hero,
  .public-merchandise-page .merchandise-info-grid {
    grid-template-columns: 1fr !important;
  }
}

@media (max-width: 640px) {
  .public-merchandise-page {
    padding: 14px 10px 34px !important;
  }

  .public-merchandise-page .merchandise-hero {
    padding: 18px !important;
    border-radius: 28px !important;
  }

  .public-merchandise-page .brandRow {
    grid-template-columns: 58px minmax(0, 1fr) !important;
    gap: 11px !important;
  }

  .public-merchandise-page .logoWrap {
    width: 58px !important;
    height: 58px !important;
    border-radius: 18px !important;
  }

  .public-merchandise-page .merchandise-title {
    font-size: clamp(38px, 13vw, 58px) !important;
    line-height: 0.96 !important;
  }

  .public-merchandise-page .heroPills {
    display: grid !important;
    grid-template-columns: 1fr !important;
  }

  .public-merchandise-page .pricePill,
  .public-merchandise-page .stockPill,
  .public-merchandise-page .sizeHeroPill {
    width: 100% !important;
  }

  .public-merchandise-page .merchandise-info-grid {
    gap: 12px !important;
  }

  .public-merchandise-page .primaryPanel,
  .public-merchandise-page .actionPanel {
    padding: 16px !important;
    border-radius: 24px !important;
  }

  .public-merchandise-page .detailGrid {
    grid-template-columns: 1fr !important;
  }

  .public-merchandise-page .merchandise-footer-panel {
    display: grid !important;
    justify-items: stretch !important;
  }

  .public-merchandise-page a {
    width: 100% !important;
  }

  .public-merchandise-page .backLink {
    width: fit-content !important;
  }
}
`;

const styles: Record<string, CSSProperties> = {
  page: {
    minHeight: "100vh",
    width: "100%",
    padding: "24px 14px 48px",
    background:
      "radial-gradient(circle at top left, rgba(22,131,248,0.08), transparent 34%), radial-gradient(circle at top right, rgba(250,204,21,0.12), transparent 32%), #f8fafc",
    color: "#0f172a",
    overflowX: "hidden",
  },

  hero: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1.08fr) minmax(300px, 0.92fr)",
    gap: 24,
    width: "100%",
    maxWidth: 1180,
    margin: "0 auto 16px",
    padding: 30,
    borderRadius: 36,
    color: "#ffffff",
    boxShadow: "0 28px 70px rgba(15,23,42,0.24)",
    border: "1px solid rgba(148,163,184,0.26)",
    overflow: "hidden",
  },

  heroCopy: {
    display: "grid",
    gap: 16,
    alignContent: "start",
  },

  backLink: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: "fit-content",
    minHeight: 42,
    padding: "10px 14px",
    borderRadius: 999,
    background: "rgba(255,255,255,0.08)",
    color: "#ffffff",
    border: "1px solid rgba(255,255,255,0.18)",
    textDecoration: "none",
    fontSize: 13,
    fontWeight: 950,
  },

  brandRow: {
    display: "grid",
    gridTemplateColumns: "76px minmax(0, 1fr)",
    gap: 14,
    alignItems: "center",
  },

  logoWrap: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: 76,
    height: 76,
    borderRadius: 24,
    background: "#ffffff",
    border: "1px solid rgba(255,255,255,0.55)",
    boxShadow: "0 14px 34px rgba(0,0,0,0.18)",
    overflow: "hidden",
  },

  logoImage: {
    display: "block",
    width: "100%",
    height: "100%",
    objectFit: "contain",
    padding: 9,
    boxSizing: "border-box",
  },

  brandCopy: {
    display: "grid",
    gap: 5,
  },

  brandKicker: {
    margin: 0,
    fontSize: 13,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
  },

  title: {
    margin: 0,
    color: "#ffffff",
    fontSize: "clamp(50px, 7vw, 86px)",
    lineHeight: 0.9,
    letterSpacing: "-0.085em",
    overflowWrap: "anywhere",
    textShadow: "0 18px 45px rgba(0,0,0,0.24)",
  },

  subtitle: {
    margin: 0,
    maxWidth: 800,
    color: "#dbeafe",
    fontSize: 18,
    lineHeight: 1.6,
    fontWeight: 720,
    overflowWrap: "anywhere",
  },

  heroPills: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
    alignItems: "center",
  },

  pricePill: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 46,
    padding: "11px 16px",
    borderRadius: 999,
    border: "1px solid",
    fontSize: 17,
    fontWeight: 950,
    boxShadow: "0 12px 24px rgba(0,0,0,0.16)",
  },

  stockPill: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 46,
    padding: "11px 16px",
    borderRadius: 999,
    border: "1px solid",
    fontSize: 14,
    fontWeight: 950,
  },

  stockPillGood: {
    background: "#dcfce7",
    color: "#166534",
    borderColor: "#86efac",
  },

  stockPillWarning: {
    background: "#fffbeb",
    color: "#92400e",
    borderColor: "#fde68a",
  },

  stockPillClosed: {
    background: "#fef2f2",
    color: "#991b1b",
    borderColor: "#fecaca",
  },

  sizeHeroPill: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 46,
    padding: "11px 16px",
    borderRadius: 999,
    background: "rgba(255,255,255,0.10)",
    color: "#ffffff",
    border: "1px solid rgba(255,255,255,0.22)",
    fontSize: 14,
    fontWeight: 950,
    overflowWrap: "anywhere",
  },

  heroCard: {
    display: "grid",
    alignContent: "stretch",
    minHeight: 360,
    borderRadius: 30,
    background: "rgba(255,255,255,0.10)",
    border: "1px solid rgba(255,255,255,0.18)",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.08)",
    overflow: "hidden",
  },

  heroCardImageWrap: {
    display: "grid",
    placeItems: "center",
    minHeight: 360,
    background:
      "radial-gradient(circle at top right, rgba(250,204,21,0.18), transparent 38%), rgba(255,255,255,0.08)",
  },

  productImage: {
    display: "block",
    width: "100%",
    height: "100%",
    minHeight: 360,
    objectFit: "cover",
  },

  imageFallback: {
    display: "grid",
    placeItems: "center",
    width: 126,
    height: 126,
    borderRadius: 34,
    background: "#ffffff",
    color: "#0f172a",
    border: "1px solid rgba(255,255,255,0.62)",
    fontSize: 20,
    fontWeight: 950,
    letterSpacing: "0.08em",
  },

  infoGrid: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) minmax(280px, 0.45fr)",
    gap: 16,
    width: "100%",
    maxWidth: 1180,
    margin: "0 auto 16px",
  },

  primaryPanel: {
    display: "grid",
    gap: 12,
    padding: 22,
    borderRadius: 28,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    boxShadow: "0 8px 30px rgba(15,23,42,0.05)",
  },

  actionPanel: {
    display: "grid",
    gap: 12,
    alignContent: "start",
    padding: 22,
    borderRadius: 28,
    background:
      "linear-gradient(135deg, rgba(255,255,255,1), rgba(239,246,255,0.9))",
    border: "1px solid #bfdbfe",
    boxShadow: "0 10px 30px rgba(22,131,248,0.08)",
  },

  kicker: {
    margin: 0,
    fontSize: 12,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
  },

  sectionTitle: {
    margin: 0,
    color: "#0f172a",
    fontSize: 32,
    lineHeight: 1.06,
    letterSpacing: "-0.055em",
    overflowWrap: "anywhere",
  },

  sectionText: {
    margin: 0,
    color: "#475569",
    lineHeight: 1.6,
    fontWeight: 740,
    overflowWrap: "anywhere",
  },

  detailGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 170px), 1fr))",
    gap: 10,
    marginTop: 6,
  },

  detailItem: {
    display: "grid",
    gap: 5,
    padding: 13,
    borderRadius: 18,
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
  },

  detailLabel: {
    color: "#64748b",
    fontSize: 11,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.06em",
  },

  detailValue: {
    color: "#0f172a",
    fontSize: 15,
    lineHeight: 1.35,
    fontWeight: 950,
    overflowWrap: "anywhere",
  },

  sizePanel: {
    display: "grid",
    gap: 10,
    padding: 14,
    borderRadius: 20,
    background:
      "linear-gradient(135deg, #f8fafc 0%, #ffffff 56%, #eff6ff 100%)",
    border: "1px solid #dbeafe",
  },

  sizePanelTitle: {
    margin: 0,
    color: "#0f172a",
    fontSize: 14,
    fontWeight: 950,
  },

  sizePillGrid: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
  },

  sizePill: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 38,
    padding: "8px 12px",
    borderRadius: 999,
    background: "#ffffff",
    color: "#0f172a",
    border: "1px solid #cbd5e1",
    fontSize: 13,
    fontWeight: 950,
  },

  actionTitle: {
    margin: 0,
    color: "#0f172a",
    fontSize: 28,
    lineHeight: 1.08,
    letterSpacing: "-0.05em",
  },

  actionText: {
    margin: 0,
    color: "#475569",
    lineHeight: 1.55,
    fontWeight: 740,
  },

  disabledCheckout: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 48,
    padding: "11px 14px",
    borderRadius: 999,
    background: "#e2e8f0",
    color: "#475569",
    border: "1px solid #cbd5e1",
    fontWeight: 950,
    textAlign: "center",
  },

  primaryLink: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 48,
    padding: "11px 15px",
    borderRadius: 999,
    border: "1px solid",
    textDecoration: "none",
    fontWeight: 950,
    textAlign: "center",
  },

  secondaryLink: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 48,
    padding: "11px 15px",
    borderRadius: 999,
    background: "#ffffff",
    color: "#0f172a",
    border: "1px solid #cbd5e1",
    textDecoration: "none",
    fontWeight: 950,
    textAlign: "center",
  },

  footerPanel: {
    display: "flex",
    gap: 14,
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
    maxWidth: 1180,
    margin: "0 auto",
    padding: 18,
    borderRadius: 24,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    boxShadow: "0 4px 18px rgba(15,23,42,0.04)",
  },

  footerBrand: {
    margin: 0,
    color: "#0f172a",
    fontSize: 16,
    fontWeight: 950,
    overflowWrap: "anywhere",
  },

  footerText: {
    margin: "4px 0 0",
    color: "#64748b",
    fontSize: 13,
    lineHeight: 1.45,
    fontWeight: 720,
    overflowWrap: "anywhere",
  },

  footerLink: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: "fit-content",
    minHeight: 42,
    padding: "9px 13px",
    borderRadius: 999,
    background: "#0f172a",
    color: "#ffffff",
    textDecoration: "none",
    fontSize: 13,
    fontWeight: 950,
    whiteSpace: "nowrap",
  },
};
