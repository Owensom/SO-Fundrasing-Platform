import type { CSSProperties } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { query, queryOne } from "@/lib/db";
import { getTenantSettings } from "@/lib/tenant-settings";
import { checkSubscriptionCapability } from "@/lib/subscription-capabilities";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type PageProps = {
  params: Promise<{
    tenantSlug: string;
  }>;
};

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

function getDisplayName(settings: TenantPublicSettings | null) {
  return cleanText(settings?.public_display_name) || "SO Fundraising Platform";
}

function getBestLogo(settings: TenantPublicSettings | null) {
  return (
    cleanText(settings?.public_logo_mark_url) ||
    cleanText(settings?.public_logo_url) ||
    "/brand/so-logo-mark.png"
  );
}

function getProductHref(product: MerchandiseProduct) {
  return `/m/${encodeURIComponent(product.tenant_slug)}/${encodeURIComponent(
    product.slug,
  )}`;
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

  if (sizes.length <= 4) {
    return sizes.join(", ");
  }

  return `${sizes.slice(0, 4).join(", ")} +${sizes.length - 4} more`;
}

function getAvailabilityLabel(product: MerchandiseProduct) {
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

  return "Available to enquire about";
}

function getImageObjectPosition(product: MerchandiseProduct) {
  return `${normaliseFocus(product.image_focus_x)}% ${normaliseFocus(
    product.image_focus_y,
  )}%`;
}

async function getTenantPublicSettings(tenantSlug: string) {
  return queryOne<TenantPublicSettings>(
    `
      select
        public_display_name,
        public_tagline,
        public_logo_url,
        public_logo_mark_url,
        public_primary_colour,
        public_accent_colour,
        public_footer_text,
        public_contact_email,
        public_contact_name,
        subscription_tier,
        subscription_status,
        platform_owner_bypass
      from tenant_settings
      where tenant_slug = $1
      limit 1
    `,
    [tenantSlug],
  );
}

async function getPublishedMerchandiseProducts(tenantSlug: string) {
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
        and status = 'published'
      order by created_at desc
    `,
    [tenantSlug],
  );
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { tenantSlug } = await params;
  const tenantSettings = await getTenantPublicSettings(tenantSlug);
  const displayName = getDisplayName(tenantSettings);

  return {
    title: `Merchandise | ${displayName}`,
    description: `Browse merchandise from ${displayName}.`,
    openGraph: {
      title: `Merchandise | ${displayName}`,
      description: `Browse merchandise from ${displayName}.`,
    },
  };
}

export default async function PublicMerchandiseShopPage({ params }: PageProps) {
  const { tenantSlug } = await params;

  const [tenantSettingsRaw, products] = await Promise.all([
    getTenantPublicSettings(tenantSlug),
    getPublishedMerchandiseProducts(tenantSlug),
  ]);

  const tenantSettings = tenantSettingsRaw as TenantPublicSettings | null;

  const merchandiseCapability = checkSubscriptionCapability(
    tenantSettings,
    "merchandise",
  );

  if (!merchandiseCapability.allowed) {
    notFound();
  }

  const displayName = getDisplayName(tenantSettings);
  const tagline =
    cleanText(tenantSettings?.public_tagline) ||
    "Supporting causes through premium fundraising campaigns.";
  const logoUrl = getBestLogo(tenantSettings);
  const primaryColour = normaliseHexColour(
    tenantSettings?.public_primary_colour,
    "#1683F8",
  );
  const accentColour = normaliseHexColour(
    tenantSettings?.public_accent_colour,
    "#FACC15",
  );
  const primaryTextColour = getReadableTextColour(primaryColour);
  const contactEmail = cleanText(tenantSettings?.public_contact_email);
  const contactName = cleanText(tenantSettings?.public_contact_name);
  const footerText = cleanText(tenantSettings?.public_footer_text) || tagline;

  return (
    <main className="public-merchandise-shop-page" style={styles.page}>
      <style>{responsiveStyles}</style>

      <section
        className="shopHero"
        style={{
          ...styles.hero,
          background: `radial-gradient(circle at bottom right, ${accentColour}26, transparent 38%), radial-gradient(circle at top left, ${primaryColour}26, transparent 34%), linear-gradient(135deg, #020617 0%, #0f172a 58%, #111827 100%)`,
        }}
      >
        <div style={styles.heroCopy}>
          <Link href={`/c/${tenantSlug}`} style={styles.backLink}>
            ← Back to all campaigns
          </Link>

          <div className="heroBrandRow" style={styles.heroBrandRow}>
            <div style={styles.logoPlate}>
              <img src={logoUrl} alt={displayName} style={styles.logoImage} />
            </div>

            <div style={styles.heroBrandCopy}>
              <p
                style={{
                  ...styles.heroKicker,
                  color: accentColour,
                  borderColor: `${accentColour}88`,
                }}
              >
                Merchandise / Shop
              </p>

              <h1 className="shopTitle" style={styles.heroTitle}>
                {displayName} shop
              </h1>
            </div>
          </div>

          <p style={styles.heroText}>
            Browse published merchandise items. Online checkout is not connected
            yet, so supporters can view products and contact the organiser.
          </p>

          <div className="heroStats" style={styles.heroStats}>
            <div style={styles.heroStat}>
              <span style={styles.heroStatLabel}>Published items</span>
              <strong style={styles.heroStatValue}>{products.length}</strong>
            </div>

            <div style={styles.heroStat}>
              <span style={styles.heroStatLabel}>Checkout</span>
              <strong style={styles.heroStatValue}>Coming soon</strong>
            </div>
          </div>
        </div>

        <aside style={styles.heroPanel}>
          <span style={styles.panelIcon}>🛍</span>

          <p style={styles.panelKicker}>Display-only phase</p>

          <h2 style={styles.panelTitle}>Shop browsing is live</h2>

          <p style={styles.panelText}>
            Products are visible publicly. Secure merchandise checkout, stock
            handling, receipts and fulfilment will be added later.
          </p>

          {contactEmail ? (
            <a
              href={`mailto:${contactEmail}?subject=${encodeURIComponent(
                `Merchandise enquiry for ${displayName}`,
              )}`}
              style={{
                ...styles.heroButton,
                background: primaryColour,
                borderColor: primaryColour,
                color: primaryTextColour,
              }}
            >
              Contact {contactName || "organiser"} →
            </a>
          ) : (
            <Link
              href={`/c/${tenantSlug}/contact`}
              style={{
                ...styles.heroButton,
                background: primaryColour,
                borderColor: primaryColour,
                color: primaryTextColour,
              }}
            >
              Contact organiser →
            </Link>
          )}
        </aside>
      </section>

      <section className="shopHeader" style={styles.shopHeader}>
        <div>
          <p style={{ ...styles.kicker, color: primaryColour }}>
            Published merchandise
          </p>

          <h2 style={styles.sectionTitle}>Shop items</h2>

          <p style={styles.sectionText}>
            Products below are available for public viewing and organiser
            enquiries.
          </p>
        </div>

        <span
          style={{
            ...styles.countPill,
            borderColor: `${accentColour}88`,
            background: `${accentColour}18`,
          }}
        >
          {products.length} {products.length === 1 ? "item" : "items"}
        </span>
      </section>

      <section className="productGrid" style={styles.productGrid}>
        {products.length === 0 ? (
          <article style={styles.emptyCard}>
            <div
              style={{
                ...styles.emptyIcon,
                color: primaryColour,
                background: `${primaryColour}12`,
                borderColor: `${primaryColour}24`,
              }}
            >
              🛍
            </div>

            <h2 style={styles.emptyTitle}>Merchandise coming soon</h2>

            <p style={styles.emptyText}>
              This organiser has not published any merchandise items yet. You
              can still view their live campaigns or contact them directly.
            </p>

            <div className="emptyActions" style={styles.emptyActions}>
              <Link
                href={`/c/${tenantSlug}`}
                style={{
                  ...styles.primaryButton,
                  background: primaryColour,
                  borderColor: primaryColour,
                  color: primaryTextColour,
                }}
              >
                View campaigns →
              </Link>

              <Link
                href={`/c/${tenantSlug}/contact`}
                style={styles.secondaryButton}
              >
                Contact organiser
              </Link>
            </div>
          </article>
        ) : (
          products.map((product) => {
            const sizes = getSizeOptions(product);

            return (
              <article key={product.id} style={styles.productCard}>
                <Link href={getProductHref(product)} style={styles.imageLink}>
                  <div style={styles.productImageWrap}>
                    {product.image_url ? (
                      <img
                        src={product.image_url}
                        alt={product.title}
                        style={{
                          ...styles.productImage,
                          objectPosition: getImageObjectPosition(product),
                        }}
                      />
                    ) : (
                      <div style={styles.imageFallback}>
                        <span>SHOP</span>
                      </div>
                    )}
                  </div>
                </Link>

                <div style={styles.productBody}>
                  <div style={styles.productTopRow}>
                    <span style={styles.typePill}>🛍 Merchandise</span>
                    <span style={styles.statusPill}>Display only</span>
                  </div>

                  <h2 style={styles.productTitle}>{product.title}</h2>

                  <p style={styles.productText}>
                    {cleanText(product.description) ||
                      "Merchandise item available for organiser enquiry."}
                  </p>

                  {sizes.length ? (
                    <div style={styles.sizeRow}>
                      {sizes.slice(0, 5).map((size) => (
                        <span key={size} style={styles.sizePill}>
                          {size}
                        </span>
                      ))}

                      {sizes.length > 5 ? (
                        <span style={styles.sizePill}>
                          +{sizes.length - 5}
                        </span>
                      ) : null}
                    </div>
                  ) : null}

                  <div style={styles.productMetaGrid}>
                    <MiniMeta
                      label="Price"
                      value={formatMoney(product.price_cents, product.currency)}
                    />

                    <MiniMeta
                      label="Availability"
                      value={getAvailabilityLabel(product)}
                    />

                    <MiniMeta
                      label="Sizes/options"
                      value={getSizeSummary(product)}
                    />
                  </div>

                  <div className="productActions" style={styles.productActions}>
                    <Link
                      href={getProductHref(product)}
                      style={{
                        ...styles.primaryButton,
                        background: primaryColour,
                        borderColor: primaryColour,
                        color: primaryTextColour,
                      }}
                    >
                      View product →
                    </Link>

                    {contactEmail ? (
                      <a
                        href={`mailto:${contactEmail}?subject=${encodeURIComponent(
                          `Merchandise enquiry: ${product.title}`,
                        )}`}
                        style={styles.secondaryButton}
                      >
                        Ask organiser
                      </a>
                    ) : (
                      <Link
                        href={`/c/${tenantSlug}/contact`}
                        style={styles.secondaryButton}
                      >
                        Ask organiser
                      </Link>
                    )}
                  </div>
                </div>
              </article>
            );
          })
        )}
      </section>

      <section className="shopNotice" style={styles.shopNotice}>
        <div>
          <p style={styles.noticeKicker}>Checkout status</p>

          <h2 style={styles.noticeTitle}>Online buying is coming later</h2>

          <p style={styles.noticeText}>
            This shop is currently for public display and enquiries only. Paid
            merchandise checkout, order receipts, stock counting and fulfilment
            controls will be connected in a later controlled phase.
          </p>
        </div>

        <Link href={`/c/${tenantSlug}`} style={styles.noticeLink}>
          Public campaign hub →
        </Link>
      </section>

      <footer className="shopFooter" style={styles.footerPanel}>
        <div>
          <p style={styles.footerBrand}>{displayName}</p>

          <p style={styles.footerText}>{footerText}</p>
        </div>

        <Link href={`/c/${tenantSlug}`} style={styles.footerLink}>
          Back to campaigns →
        </Link>
      </footer>
    </main>
  );
}

function MiniMeta({ label, value }: { label: string; value: string }) {
  return (
    <div style={styles.miniMeta}>
      <span style={styles.miniMetaLabel}>{label}</span>
      <strong style={styles.miniMetaValue}>{value}</strong>
    </div>
  );
}

const responsiveStyles = `
.public-merchandise-shop-page,
.public-merchandise-shop-page * {
  box-sizing: border-box;
}

.public-merchandise-shop-page {
  overflow-x: hidden;
}

.public-merchandise-shop-page section,
.public-merchandise-shop-page article,
.public-merchandise-shop-page aside,
.public-merchandise-shop-page div,
.public-merchandise-shop-page a,
.public-merchandise-shop-page p,
.public-merchandise-shop-page h1,
.public-merchandise-shop-page h2,
.public-merchandise-shop-page strong,
.public-merchandise-shop-page span {
  min-width: 0;
  max-width: 100%;
}

@media (max-width: 1020px) {
  .public-merchandise-shop-page .shopHero {
    grid-template-columns: 1fr !important;
  }

  .public-merchandise-shop-page .productGrid {
    grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
  }
}

@media (max-width: 720px) {
  .public-merchandise-shop-page {
    padding: 14px 10px 40px !important;
  }

  .public-merchandise-shop-page .shopHero,
  .public-merchandise-shop-page .shopHeader,
  .public-merchandise-shop-page .shopNotice,
  .public-merchandise-shop-page .shopFooter {
    padding: 16px !important;
    border-radius: 24px !important;
  }

  .public-merchandise-shop-page .heroBrandRow {
    grid-template-columns: 58px minmax(0, 1fr) !important;
    gap: 11px !important;
  }

  .public-merchandise-shop-page .shopTitle {
    font-size: clamp(38px, 13vw, 58px) !important;
    line-height: 0.96 !important;
  }

  .public-merchandise-shop-page .heroStats,
  .public-merchandise-shop-page .productGrid,
  .public-merchandise-shop-page .productActions,
  .public-merchandise-shop-page .emptyActions {
    grid-template-columns: 1fr !important;
  }

  .public-merchandise-shop-page .productImageWrap {
    height: 210px !important;
  }

  .public-merchandise-shop-page .shopHeader,
  .public-merchandise-shop-page .shopNotice,
  .public-merchandise-shop-page .shopFooter {
    display: grid !important;
    justify-items: stretch !important;
  }

  .public-merchandise-shop-page a {
    width: 100% !important;
  }

  .public-merchandise-shop-page .backLink {
    width: fit-content !important;
  }
}
`;

const styles: Record<string, CSSProperties> = {
  page: {
    minHeight: "100vh",
    width: "100%",
    padding: "24px 14px 52px",
    background:
      "radial-gradient(circle at top left, rgba(22,131,248,0.08), transparent 34%), radial-gradient(circle at top right, rgba(250,204,21,0.12), transparent 32%), #f8fafc",
    color: "#0f172a",
    overflowX: "hidden",
  },

  hero: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1.08fr) minmax(300px, 0.52fr)",
    gap: 22,
    width: "100%",
    maxWidth: 1180,
    margin: "0 auto 16px",
    padding: 28,
    borderRadius: 34,
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

  heroBrandRow: {
    display: "grid",
    gridTemplateColumns: "76px minmax(0, 1fr)",
    gap: 14,
    alignItems: "center",
  },

  logoPlate: {
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

  heroBrandCopy: {
    display: "grid",
    gap: 7,
  },

  heroKicker: {
    display: "inline-flex",
    width: "fit-content",
    margin: 0,
    padding: "7px 11px",
    borderRadius: 999,
    background: "rgba(15,23,42,0.34)",
    border: "1px solid",
    fontSize: 11,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
  },

  heroTitle: {
    margin: 0,
    color: "#ffffff",
    fontSize: "clamp(50px, 7vw, 84px)",
    lineHeight: 0.9,
    letterSpacing: "-0.085em",
    overflowWrap: "anywhere",
    textShadow: "0 18px 45px rgba(0,0,0,0.24)",
  },

  heroText: {
    margin: 0,
    maxWidth: 820,
    color: "#dbeafe",
    fontSize: 18,
    lineHeight: 1.6,
    fontWeight: 720,
    overflowWrap: "anywhere",
  },

  heroStats: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 190px))",
    gap: 10,
  },

  heroStat: {
    display: "grid",
    gap: 4,
    padding: 13,
    borderRadius: 18,
    background: "rgba(255,255,255,0.10)",
    border: "1px solid rgba(255,255,255,0.16)",
  },

  heroStatLabel: {
    color: "#bfdbfe",
    fontSize: 11,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.06em",
  },

  heroStatValue: {
    color: "#ffffff",
    fontSize: 20,
    lineHeight: 1.1,
    fontWeight: 950,
  },

  heroPanel: {
    display: "grid",
    gap: 12,
    alignContent: "center",
    padding: 20,
    borderRadius: 26,
    background: "rgba(255,255,255,0.10)",
    border: "1px solid rgba(255,255,255,0.18)",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.08)",
  },

  panelIcon: {
    display: "grid",
    placeItems: "center",
    width: 54,
    height: 54,
    borderRadius: 18,
    background: "rgba(255,255,255,0.14)",
    border: "1px solid rgba(255,255,255,0.18)",
    fontSize: 25,
  },

  panelKicker: {
    margin: 0,
    color: "#fef3c7",
    fontSize: 12,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
  },

  panelTitle: {
    margin: 0,
    color: "#ffffff",
    fontSize: 30,
    lineHeight: 1.04,
    letterSpacing: "-0.05em",
    overflowWrap: "anywhere",
  },

  panelText: {
    margin: 0,
    color: "#dbeafe",
    lineHeight: 1.55,
    fontWeight: 730,
    overflowWrap: "anywhere",
  },

  heroButton: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: "fit-content",
    minHeight: 46,
    padding: "11px 15px",
    borderRadius: 999,
    border: "1px solid",
    textDecoration: "none",
    fontWeight: 950,
    textAlign: "center",
  },

  shopHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: 14,
    flexWrap: "wrap",
    alignItems: "flex-start",
    width: "100%",
    maxWidth: 1180,
    margin: "0 auto 16px",
    padding: 18,
    borderRadius: 24,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    boxShadow: "0 12px 30px rgba(15,23,42,0.05)",
  },

  kicker: {
    margin: "0 0 5px",
    fontSize: 11,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
  },

  sectionTitle: {
    margin: 0,
    color: "#0f172a",
    fontSize: 30,
    lineHeight: 1.06,
    letterSpacing: "-0.055em",
    overflowWrap: "anywhere",
  },

  sectionText: {
    margin: "6px 0 0",
    color: "#64748b",
    lineHeight: 1.45,
    fontWeight: 740,
    overflowWrap: "anywhere",
  },

  countPill: {
    display: "inline-flex",
    alignItems: "center",
    minHeight: 36,
    padding: "8px 12px",
    borderRadius: 999,
    color: "#0f172a",
    border: "1px solid",
    fontSize: 12,
    fontWeight: 950,
    whiteSpace: "nowrap",
  },

  productGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: 14,
    width: "100%",
    maxWidth: 1180,
    margin: "0 auto 16px",
  },

  productCard: {
    display: "flex",
    flexDirection: "column",
    minWidth: 0,
    overflow: "hidden",
    borderRadius: 26,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    boxShadow: "0 14px 34px rgba(15,23,42,0.07)",
  },

  imageLink: {
    display: "block",
    width: "100%",
    textDecoration: "none",
  },

  productImageWrap: {
    width: "100%",
    height: 220,
    overflow: "hidden",
    background:
      "linear-gradient(135deg, #ffffff 0%, #f8fafc 58%, #eff6ff 100%)",
    borderBottom: "1px solid #e2e8f0",
  },

  productImage: {
    display: "block",
    width: "100%",
    height: "100%",
    objectFit: "cover",
  },

  imageFallback: {
    display: "grid",
    placeItems: "center",
    width: "100%",
    height: "100%",
    color: "#0f172a",
    fontSize: 18,
    fontWeight: 950,
    letterSpacing: "0.08em",
  },

  productBody: {
    display: "flex",
    flexDirection: "column",
    flex: 1,
    gap: 11,
    padding: 15,
  },

  productTopRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: 8,
    alignItems: "center",
    flexWrap: "wrap",
  },

  typePill: {
    display: "inline-flex",
    alignItems: "center",
    gap: 5,
    padding: "8px 12px",
    borderRadius: 999,
    background: "#fdf2f8",
    color: "#9d174d",
    border: "1px solid #fbcfe8",
    fontSize: 12,
    fontWeight: 950,
  },

  statusPill: {
    display: "inline-flex",
    alignItems: "center",
    padding: "7px 10px",
    borderRadius: 999,
    background: "#f1f5f9",
    color: "#475569",
    border: "1px solid #e2e8f0",
    fontSize: 11,
    fontWeight: 950,
  },

  productTitle: {
    margin: 0,
    color: "#0f172a",
    fontSize: 24,
    lineHeight: 1.05,
    letterSpacing: "-0.05em",
    overflowWrap: "anywhere",
  },

  productText: {
    margin: 0,
    color: "#64748b",
    lineHeight: 1.5,
    fontWeight: 720,
    overflowWrap: "anywhere",
  },

  sizeRow: {
    display: "flex",
    gap: 7,
    flexWrap: "wrap",
  },

  sizePill: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 32,
    padding: "6px 10px",
    borderRadius: 999,
    background: "#f8fafc",
    color: "#0f172a",
    border: "1px solid #e2e8f0",
    fontSize: 12,
    fontWeight: 900,
  },

  productMetaGrid: {
    display: "grid",
    gridTemplateColumns: "1fr",
    gap: 8,
    marginTop: "auto",
  },

  miniMeta: {
    display: "grid",
    gap: 3,
    padding: 10,
    borderRadius: 15,
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
  },

  miniMetaLabel: {
    color: "#64748b",
    fontSize: 10,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.06em",
  },

  miniMetaValue: {
    color: "#0f172a",
    fontSize: 13,
    lineHeight: 1.35,
    fontWeight: 900,
    overflowWrap: "anywhere",
  },

  productActions: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 9,
    marginTop: 4,
  },

  primaryButton: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 44,
    padding: "11px 13px",
    borderRadius: 999,
    border: "1px solid",
    textDecoration: "none",
    fontWeight: 950,
    textAlign: "center",
    lineHeight: 1.15,
  },

  secondaryButton: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 44,
    padding: "11px 13px",
    borderRadius: 999,
    background: "#ffffff",
    color: "#0f172a",
    border: "1px solid #cbd5e1",
    textDecoration: "none",
    fontWeight: 950,
    textAlign: "center",
    lineHeight: 1.15,
  },

  emptyCard: {
    gridColumn: "1 / -1",
    display: "grid",
    justifyItems: "center",
    gap: 12,
    padding: 34,
    borderRadius: 28,
    background: "#ffffff",
    border: "1px dashed #cbd5e1",
    textAlign: "center",
  },

  emptyIcon: {
    display: "grid",
    placeItems: "center",
    width: 58,
    height: 58,
    borderRadius: 20,
    border: "1px solid",
    fontSize: 25,
    fontWeight: 950,
  },

  emptyTitle: {
    margin: 0,
    color: "#0f172a",
    fontSize: 30,
    lineHeight: 1.05,
    letterSpacing: "-0.05em",
  },

  emptyText: {
    maxWidth: 620,
    margin: 0,
    color: "#64748b",
    lineHeight: 1.55,
    fontWeight: 750,
  },

  emptyActions: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 9,
    width: "min(100%, 440px)",
  },

  shopNotice: {
    display: "flex",
    gap: 14,
    justifyContent: "space-between",
    alignItems: "center",
    width: "100%",
    maxWidth: 1180,
    margin: "0 auto 16px",
    padding: 18,
    borderRadius: 24,
    background:
      "linear-gradient(135deg, rgba(255,255,255,0.98), rgba(239,246,255,0.92))",
    border: "1px solid #bfdbfe",
    boxShadow: "0 10px 30px rgba(22,131,248,0.06)",
  },

  noticeKicker: {
    margin: "0 0 5px",
    color: "#2563eb",
    fontSize: 11,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
  },

  noticeTitle: {
    margin: 0,
    color: "#0f172a",
    fontSize: 24,
    lineHeight: 1.08,
    letterSpacing: "-0.05em",
    overflowWrap: "anywhere",
  },

  noticeText: {
    margin: "6px 0 0",
    color: "#475569",
    lineHeight: 1.5,
    fontWeight: 730,
    overflowWrap: "anywhere",
  },

  noticeLink: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: "fit-content",
    minHeight: 42,
    padding: "10px 13px",
    borderRadius: 999,
    background: "#0f172a",
    color: "#ffffff",
    textDecoration: "none",
    fontSize: 13,
    fontWeight: 950,
    whiteSpace: "nowrap",
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
