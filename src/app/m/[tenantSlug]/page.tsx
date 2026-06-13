import type { CSSProperties } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { query, queryOne } from "@/lib/db";
import {
  checkSubscriptionCapability,
  normaliseSubscriptionTier,
} from "@/lib/subscription-capabilities";

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

function getProductImageSrc({
  product,
  canUseProductImages,
}: {
  product: MerchandiseProduct;
  canUseProductImages: boolean;
}) {
  if (!canUseProductImages) {
    return "";
  }

  return cleanText(product.image_url);
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

  const subscriptionTier = normaliseSubscriptionTier(
    tenantSettings?.subscription_tier,
  );

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

  const canUseAdvancedBranding = advancedBrandingCapability.allowed;
  const canUseProductImages = subscriptionTier !== "community";

  const displayName = getDisplayName(tenantSettings);

  const publicTagline =
    cleanText(tenantSettings?.public_tagline) ||
    "Browse live fundraising campaigns and merchandise for this organisation.";

  const publicFooterText = canUseAdvancedBranding
    ? cleanText(tenantSettings?.public_footer_text)
    : "";

  const publicLogoUrl = canUseAdvancedBranding
    ? cleanText(tenantSettings?.public_logo_url)
    : "";

  const publicLogoMarkUrl = canUseAdvancedBranding
    ? cleanText(tenantSettings?.public_logo_mark_url)
    : "";

  const primaryColour = canUseAdvancedBranding
    ? normaliseHexColour(tenantSettings?.public_primary_colour, "#1683F8")
    : "#1683F8";

  const accentColour = canUseAdvancedBranding
    ? normaliseHexColour(tenantSettings?.public_accent_colour, "#FACC15")
    : "#FACC15";

  const brandLogoSrc = publicLogoMarkUrl || publicLogoUrl;
  const primaryTextColour = getReadableTextColour(primaryColour);
  const accentTextColour = getReadableTextColour(accentColour);

  const contactEmail = cleanText(tenantSettings?.public_contact_email);
  const contactName = cleanText(tenantSettings?.public_contact_name);

  const brandedPageStyle: CSSProperties = canUseAdvancedBranding
    ? {
        ...styles.page,
        background: `radial-gradient(circle at top left, ${primaryColour}12, transparent 32%), radial-gradient(circle at top right, ${accentColour}14, transparent 30%), linear-gradient(180deg, #f8fafc 0%, #eef2f7 100%)`,
      }
    : {
        ...styles.page,
        background:
          "radial-gradient(circle at top left, rgba(37,99,235,0.10), transparent 34%), radial-gradient(circle at top right, rgba(250,204,21,0.08), transparent 30%), #f8fafc",
      };

  const brandedHeroStyle: CSSProperties = canUseAdvancedBranding
    ? {
        ...styles.hero,
        background: `
          radial-gradient(circle at 98% 104%, ${primaryColour}58, transparent 28%),
          radial-gradient(circle at 8% 12%, ${accentColour}28, transparent 25%),
          linear-gradient(126deg, #060816 0%, #0f172a 52%, #111827 100%)
        `,
      }
    : {
        ...styles.hero,
        background:
          "radial-gradient(circle at bottom right, rgba(37,99,235,0.24), transparent 40%), radial-gradient(circle at top left, rgba(250,204,21,0.10), transparent 32%), linear-gradient(135deg, #020617 0%, #0f172a 58%, #172554 100%)",
      };

  const brandedPrimaryActionStyle: CSSProperties = canUseAdvancedBranding
    ? {
        ...styles.primaryButton,
        background: `linear-gradient(135deg, ${primaryColour} 0%, ${accentColour} 135%)`,
        border: `1px solid ${primaryColour}`,
        color: primaryTextColour,
        boxShadow: `0 18px 34px ${primaryColour}36`,
      }
    : {
        ...styles.primaryButton,
        background: "linear-gradient(135deg, #1683F8 0%, #2563eb 100%)",
        border: "1px solid #1683F8",
        color: "#ffffff",
        boxShadow: "0 18px 34px rgba(22,131,248,0.22)",
      };

  const brandedContactButtonStyle: CSSProperties = canUseAdvancedBranding
    ? {
        ...styles.contactButton,
        background: `linear-gradient(135deg, ${primaryColour} 0%, ${accentColour} 130%)`,
        border: `1px solid ${primaryColour}`,
        color: primaryTextColour,
        boxShadow: `0 18px 34px ${primaryColour}28`,
      }
    : {
        ...styles.contactButton,
        background: "linear-gradient(135deg, #1683F8 0%, #2563eb 100%)",
        border: "1px solid #1683F8",
        color: "#ffffff",
        boxShadow: "0 18px 34px rgba(22,131,248,0.20)",
      };

  return (
    <main className="public-merchandise-shop-page" style={brandedPageStyle}>
      <style>{responsiveStyles}</style>

      <section className="brandHeader" style={styles.brandHeader}>
        <div className="brandIdentity" style={styles.brandIdentity}>
          <div
            className="brandLogoPlate"
            style={{
              ...styles.brandLogoPlate,
              borderColor: canUseAdvancedBranding
                ? `${accentColour}66`
                : "rgba(226,232,240,0.96)",
            }}
          >
            {brandLogoSrc ? (
              <img
                src={brandLogoSrc}
                alt={displayName}
                style={styles.brandLogo}
              />
            ) : (
              <img
                src="/brand/so-logo-mark.png"
                alt="SO Fundraising Platform"
                style={styles.brandLogo}
              />
            )}
          </div>

          <div style={styles.brandCopy}>
            <h1 className="brandTitle" style={styles.brandTitle}>
              {displayName}
            </h1>
            <p style={styles.brandTagline}>{publicTagline}</p>
          </div>
        </div>

        <div
          className="brandFeature"
          style={{
            ...styles.brandFeature,
            borderColor: canUseAdvancedBranding
              ? `${accentColour}78`
              : "rgba(191,219,254,0.72)",
            background: canUseAdvancedBranding
              ? `linear-gradient(135deg, ${accentColour}12, #ffffff 78%)`
              : "linear-gradient(135deg, rgba(239,246,255,0.92), #ffffff 78%)",
          }}
        >
          <span
            style={{
              ...styles.brandFeatureIcon,
              color: canUseAdvancedBranding ? primaryColour : "#2563eb",
            }}
          >
            🛍
          </span>

          <div style={styles.brandFeatureCopy}>
            <span
              style={{
                ...styles.brandFeatureKicker,
                color: canUseAdvancedBranding ? primaryColour : "#2563eb",
              }}
            >
              Merchandise shop
            </span>

            <strong style={styles.brandFeatureTitle}>
              {products.length} {products.length === 1 ? "item" : "items"}
            </strong>

            <span style={styles.brandFeatureText}>
              Public browsing is live. Checkout is coming soon.
            </span>
          </div>
        </div>
      </section>

      <section className="shopHero" style={brandedHeroStyle}>
        <div style={styles.heroGlow} />
        <div
          style={{
            ...styles.heroLineOne,
            borderColor: canUseAdvancedBranding
              ? `${accentColour}24`
              : "rgba(250,204,21,0.16)",
          }}
        />
        <div
          style={{
            ...styles.heroLineTwo,
            borderColor: canUseAdvancedBranding
              ? `${primaryColour}1E`
              : "rgba(37,99,235,0.16)",
          }}
        />

        <div className="heroMainGrid" style={styles.heroMainGrid}>
          <div style={styles.heroCopy}>
            <Link href={`/c/${tenantSlug}`} style={styles.backLink}>
              ← Back to all campaigns
            </Link>

            <div
              style={{
                ...styles.eyebrow,
                color: canUseAdvancedBranding ? accentColour : "#facc15",
                borderColor: canUseAdvancedBranding
                  ? `${accentColour}A8`
                  : "rgba(250,204,21,0.72)",
                background: canUseAdvancedBranding
                  ? `${primaryColour}1A`
                  : "rgba(15,23,42,0.34)",
              }}
            >
              Merchandise / Shop
            </div>

            <h2 style={styles.heroTitle}>{displayName} shop</h2>

            <p style={styles.subtitle}>
              Browse published merchandise items. Online checkout is not
              connected yet, so supporters can view products and contact the
              organiser.
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

          <aside style={styles.supportPanel}>
            <div style={styles.supportPanelHeader}>
              <span style={styles.supportPanelKicker}>Shop status</span>
              <h2 style={styles.supportPanelTitle}>Browsing is live</h2>
            </div>

            <p style={styles.supportPanelText}>
              Products are visible publicly. Secure merchandise checkout, stock
              handling, receipts and fulfilment will be added later.
            </p>

            <div style={styles.supportOptionList}>
              <a
                href="#shop-items"
                style={styles.supportOptionLink}
              >
                <div
                  style={{
                    ...styles.supportIcon,
                    background: canUseAdvancedBranding
                      ? `linear-gradient(135deg, ${primaryColour}, ${accentColour})`
                      : "linear-gradient(135deg, #1683F8, #2563eb)",
                    borderColor: canUseAdvancedBranding
                      ? `${primaryColour}55`
                      : "rgba(147,197,253,0.45)",
                    color: canUseAdvancedBranding ? primaryTextColour : "#ffffff",
                  }}
                >
                  ↓
                </div>

                <div style={styles.supportOptionCopy}>
                  <strong>View shop items</strong>
                  <span>Browse the published merchandise below.</span>
                </div>

                <span style={styles.supportChevron}>›</span>
              </a>

              {contactEmail ? (
                <a
                  href={`mailto:${contactEmail}?subject=${encodeURIComponent(
                    `Merchandise enquiry for ${displayName}`,
                  )}`}
                  style={styles.supportOptionLink}
                >
                  <div
                    style={{
                      ...styles.supportIcon,
                      background: canUseAdvancedBranding
                        ? `linear-gradient(135deg, ${accentColour}, ${primaryColour})`
                        : "linear-gradient(135deg, #FACC15, #1683F8)",
                      borderColor: canUseAdvancedBranding
                        ? `${accentColour}66`
                        : "rgba(250,204,21,0.50)",
                      color: canUseAdvancedBranding
                        ? accentTextColour
                        : "#0f172a",
                    }}
                  >
                    ✉
                  </div>

                  <div style={styles.supportOptionCopy}>
                    <strong>Contact {contactName || "organiser"}</strong>
                    <span>Ask a question before checkout is added.</span>
                  </div>

                  <span style={styles.supportChevron}>›</span>
                </a>
              ) : (
                <Link href={`/c/${tenantSlug}/contact`} style={styles.supportOptionLink}>
                  <div
                    style={{
                      ...styles.supportIcon,
                      background: canUseAdvancedBranding
                        ? `linear-gradient(135deg, ${accentColour}, ${primaryColour})`
                        : "linear-gradient(135deg, #FACC15, #1683F8)",
                      borderColor: canUseAdvancedBranding
                        ? `${accentColour}66`
                        : "rgba(250,204,21,0.50)",
                      color: canUseAdvancedBranding
                        ? accentTextColour
                        : "#0f172a",
                    }}
                  >
                    ✉
                  </div>

                  <div style={styles.supportOptionCopy}>
                    <strong>Contact organiser</strong>
                    <span>Ask a question before checkout is added.</span>
                  </div>

                  <span style={styles.supportChevron}>›</span>
                </Link>
              )}
            </div>
          </aside>
        </div>
      </section>

      <section
        id="shop-items"
        className="shopHeader"
        style={styles.shopHeader}
      >
        <div>
          <p
            style={{
              ...styles.kicker,
              color: canUseAdvancedBranding ? primaryColour : "#2563eb",
            }}
          >
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
            borderColor: canUseAdvancedBranding
              ? `${accentColour}78`
              : "#bfdbfe",
            background: canUseAdvancedBranding
              ? `${accentColour}1A`
              : "#eff6ff",
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
                background: canUseAdvancedBranding
                  ? `${primaryColour}12`
                  : "rgba(37,99,235,0.10)",
                color: canUseAdvancedBranding ? primaryColour : "#2563eb",
                borderColor: canUseAdvancedBranding
                  ? `${primaryColour}24`
                  : "rgba(37,99,235,0.18)",
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
              <Link href={`/c/${tenantSlug}`} style={brandedPrimaryActionStyle}>
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
            const productImageUrl = getProductImageSrc({
              product,
              canUseProductImages,
            });

            return (
              <article key={product.id} style={styles.productCard}>
                <Link href={getProductHref(product)} style={styles.imageLink}>
                  <div style={styles.productImageWrap}>
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
                      <div style={styles.imageFallback}>
                        <span>SHOP</span>
                      </div>
                    )}
                  </div>
                </Link>

                <div style={styles.productBody}>
                  <div style={styles.productTopRow}>
                    <span
                      style={{
                        ...styles.typePill,
                        borderColor: canUseAdvancedBranding
                          ? `${accentColour}70`
                          : "#bfdbfe",
                        background: canUseAdvancedBranding
                          ? `${accentColour}16`
                          : "#eff6ff",
                        color: "#0f172a",
                      }}
                    >
                      🛍 Merchandise
                    </span>

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
                      style={brandedPrimaryActionStyle}
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

      <section className="contactStrip" style={styles.contactStrip}>
        <div
          style={{
            ...styles.contactStripIcon,
            background: canUseAdvancedBranding
              ? `${primaryColour}12`
              : "rgba(37,99,235,0.10)",
            color: canUseAdvancedBranding ? primaryColour : "#2563eb",
            borderColor: canUseAdvancedBranding
              ? `${primaryColour}24`
              : "rgba(37,99,235,0.18)",
          }}
        >
          ✉
        </div>

        <div style={styles.contactStripCopy}>
          <p
            style={{
              ...styles.contactStripKicker,
              color: canUseAdvancedBranding ? primaryColour : "#2563eb",
            }}
          >
            Need help from the organiser?
          </p>

          <h2 style={styles.contactStripTitle}>Contact the organiser</h2>

          <p style={styles.contactStripText}>
            Questions about merchandise, campaigns, donations, raffles, events
            or auctions can be sent directly to the organiser.
          </p>
        </div>

        <Link
          href={`/c/${tenantSlug}/contact`}
          style={brandedContactButtonStyle}
        >
          Contact organiser →
        </Link>
      </section>

      {publicFooterText ? (
        <footer
          className="shopFooter"
          style={{
            ...styles.footer,
            borderColor: `${accentColour}60`,
          }}
        >
          <p style={styles.footerText}>{publicFooterText}</p>
        </footer>
      ) : null}
    </main>
  );
}

function MiniMeta({ label, value }: { label: string; value: string }) {
  return (
    <div style={styles.miniMeta}>
      <span>{label}</span>
      <strong>{value}</strong>
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

@media (max-width: 980px) {
  .public-merchandise-shop-page .brandHeader,
  .public-merchandise-shop-page .heroMainGrid,
  .public-merchandise-shop-page .contactStrip {
    grid-template-columns: 1fr !important;
  }

  .public-merchandise-shop-page .productGrid {
    grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
  }
}

@media (max-width: 680px) {
  .public-merchandise-shop-page {
    width: 100% !important;
    max-width: 100% !important;
    padding: 14px 10px 44px !important;
  }

  .public-merchandise-shop-page .brandHeader,
  .public-merchandise-shop-page .shopHero,
  .public-merchandise-shop-page .shopHeader,
  .public-merchandise-shop-page .shopNotice,
  .public-merchandise-shop-page .contactStrip {
    padding: 14px !important;
    border-radius: 22px !important;
  }

  .public-merchandise-shop-page .brandIdentity {
    grid-template-columns: 56px minmax(0, 1fr) !important;
    text-align: left !important;
    justify-items: stretch !important;
  }

  .public-merchandise-shop-page .brandLogoPlate {
    width: 56px !important;
    height: 56px !important;
    border-radius: 16px !important;
    padding: 6px !important;
  }

  .public-merchandise-shop-page .brandTitle {
    font-size: clamp(26px, 8vw, 38px) !important;
    letter-spacing: -0.06em !important;
  }

  .public-merchandise-shop-page .brandFeature {
    padding: 12px !important;
  }

  .public-merchandise-shop-page .heroTitle {
    font-size: clamp(42px, 12vw, 58px) !important;
    line-height: 0.94 !important;
  }

  .public-merchandise-shop-page .heroStats,
  .public-merchandise-shop-page .productGrid,
  .public-merchandise-shop-page .productActions,
  .public-merchandise-shop-page .emptyActions {
    grid-template-columns: 1fr !important;
  }

  .public-merchandise-shop-page .supportPanel {
    padding: 14px !important;
  }

  .public-merchandise-shop-page .supportOptionLink {
    grid-template-columns: 44px minmax(0, 1fr) 18px !important;
  }

  .public-merchandise-shop-page .productImageWrap {
    height: 210px !important;
  }

  .public-merchandise-shop-page .primaryButton,
  .public-merchandise-shop-page .secondaryButton,
  .public-merchandise-shop-page .contactButton,
  .public-merchandise-shop-page .noticeLink {
    width: 100% !important;
    justify-content: center !important;
    text-align: center !important;
  }

  .public-merchandise-shop-page .contactStrip {
    grid-template-columns: 1fr !important;
  }

  .public-merchandise-shop-page .contactStripIcon {
    margin: 0 auto !important;
  }

  .public-merchandise-shop-page .contactStripCopy {
    text-align: center !important;
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
    color: "#0f172a",
    boxSizing: "border-box",
    overflowX: "hidden",
  },

  brandHeader: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) minmax(270px, 0.35fr)",
    gap: 14,
    alignItems: "stretch",
    padding: 14,
    borderRadius: 28,
    background:
      "linear-gradient(135deg, rgba(255,255,255,0.98), rgba(248,250,252,0.94))",
    border: "1px solid rgba(226,232,240,0.92)",
    boxShadow: "0 18px 44px rgba(15,23,42,0.075)",
    marginBottom: 14,
    backdropFilter: "blur(14px)",
  },

  brandIdentity: {
    display: "grid",
    gridTemplateColumns: "78px minmax(0, 1fr)",
    gap: 16,
    alignItems: "center",
    minWidth: 0,
  },

  brandLogoPlate: {
    position: "relative",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: 78,
    height: 78,
    borderRadius: 22,
    padding: 8,
    overflow: "hidden",
    background:
      "linear-gradient(135deg, rgba(255,255,255,0.98), rgba(248,250,252,0.94))",
    border: "1px solid rgba(226,232,240,0.96)",
    boxShadow:
      "0 14px 30px rgba(15,23,42,0.12), inset 0 1px 0 rgba(255,255,255,0.92)",
    isolation: "isolate",
  },

  brandLogo: {
    display: "block",
    width: "100%",
    height: "100%",
    objectFit: "contain",
  },

  brandCopy: {
    display: "grid",
    gap: 5,
    minWidth: 0,
  },

  brandTitle: {
    margin: 0,
    color: "#0f172a",
    fontSize: "clamp(34px, 5vw, 56px)",
    lineHeight: 0.94,
    letterSpacing: "-0.075em",
    overflowWrap: "anywhere",
  },

  brandTagline: {
    margin: 0,
    color: "#475569",
    fontSize: 14,
    lineHeight: 1.35,
    fontWeight: 850,
    overflowWrap: "anywhere",
  },

  brandFeature: {
    display: "grid",
    gridTemplateColumns: "46px minmax(0, 1fr)",
    gap: 11,
    alignItems: "center",
    padding: 14,
    borderRadius: 22,
    border: "1px solid",
    minWidth: 0,
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.72)",
  },

  brandFeatureIcon: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: 44,
    height: 44,
    borderRadius: 16,
    background: "rgba(255,255,255,0.72)",
    border: "1px solid rgba(226,232,240,0.82)",
    fontSize: 18,
    fontWeight: 950,
  },

  brandFeatureCopy: {
    display: "grid",
    gap: 4,
    minWidth: 0,
  },

  brandFeatureKicker: {
    fontSize: 10,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
  },

  brandFeatureTitle: {
    color: "#0f172a",
    fontSize: 19,
    lineHeight: 1.08,
    letterSpacing: "-0.045em",
    overflowWrap: "anywhere",
  },

  brandFeatureText: {
    color: "#475569",
    fontSize: 12,
    lineHeight: 1.35,
    fontWeight: 760,
  },

  hero: {
    position: "relative",
    display: "grid",
    gap: 16,
    padding: 24,
    borderRadius: 30,
    color: "#ffffff",
    marginBottom: 16,
    boxShadow: "0 28px 66px rgba(15,23,42,0.24)",
    overflow: "hidden",
    border: "1px solid rgba(255,255,255,0.16)",
  },

  heroGlow: {
    position: "absolute",
    inset: 0,
    pointerEvents: "none",
    background:
      "radial-gradient(circle at 20% 18%, rgba(255,255,255,0.08), transparent 30%)",
  },

  heroLineOne: {
    position: "absolute",
    left: -90,
    bottom: -130,
    width: 330,
    height: 330,
    border: "1px solid",
    borderRadius: "999px",
    pointerEvents: "none",
  },

  heroLineTwo: {
    position: "absolute",
    left: -140,
    bottom: -180,
    width: 440,
    height: 440,
    border: "1px solid",
    borderRadius: "999px",
    pointerEvents: "none",
  },

  heroMainGrid: {
    position: "relative",
    zIndex: 1,
    display: "grid",
    gridTemplateColumns: "minmax(0, 1.08fr) minmax(280px, 0.82fr)",
    gap: 20,
    alignItems: "stretch",
    minWidth: 0,
  },

  heroCopy: {
    display: "grid",
    alignContent: "center",
    gap: 14,
    minWidth: 0,
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

  eyebrow: {
    display: "inline-flex",
    width: "fit-content",
    padding: "8px 13px",
    borderRadius: 999,
    border: "1px solid",
    fontSize: 11,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.1em",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.12)",
  },

  heroTitle: {
    margin: 0,
    maxWidth: 760,
    fontSize: "clamp(42px, 6vw, 66px)",
    lineHeight: 0.92,
    letterSpacing: "-0.078em",
    overflowWrap: "anywhere",
    textShadow: "0 18px 45px rgba(0,0,0,0.28)",
  },

  subtitle: {
    margin: 0,
    maxWidth: 760,
    color: "#e5edf8",
    fontSize: 17,
    lineHeight: 1.5,
    fontWeight: 760,
    overflowWrap: "anywhere",
  },

  heroStats: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 190px))",
    gap: 10,
    marginTop: 4,
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

  supportPanel: {
    display: "grid",
    gap: 12,
    alignContent: "center",
    padding: 19,
    borderRadius: 26,
    background: "rgba(15,23,42,0.30)",
    border: "1px solid rgba(255,255,255,0.18)",
    boxShadow:
      "inset 0 1px 0 rgba(255,255,255,0.12), 0 20px 48px rgba(0,0,0,0.16)",
    backdropFilter: "blur(14px)",
    minWidth: 0,
  },

  supportPanelHeader: {
    display: "grid",
    gap: 3,
  },

  supportPanelKicker: {
    color: "#cbd5e1",
    fontSize: 11,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
  },

  supportPanelTitle: {
    margin: 0,
    color: "#ffffff",
    fontSize: 24,
    lineHeight: 1.05,
    letterSpacing: "-0.045em",
  },

  supportPanelText: {
    margin: 0,
    color: "#dbeafe",
    lineHeight: 1.5,
    fontSize: 14,
    fontWeight: 760,
    overflowWrap: "anywhere",
  },

  supportOptionList: {
    display: "grid",
    gap: 10,
  },

  supportOptionLink: {
    display: "grid",
    gridTemplateColumns: "48px minmax(0, 1fr) 18px",
    gap: 12,
    alignItems: "center",
    padding: 13,
    borderRadius: 18,
    background:
      "linear-gradient(135deg, rgba(255,255,255,0.13), rgba(255,255,255,0.06))",
    border: "1px solid rgba(255,255,255,0.20)",
    color: "#e5edf8",
    textDecoration: "none",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.10)",
  },

  supportIcon: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: 44,
    height: 44,
    borderRadius: 16,
    border: "1px solid",
    fontSize: 18,
    fontWeight: 950,
    boxShadow: "0 10px 22px rgba(0,0,0,0.16)",
  },

  supportOptionCopy: {
    display: "grid",
    gap: 2,
    minWidth: 0,
    lineHeight: 1.35,
    fontSize: 13,
  },

  supportChevron: {
    color: "rgba(255,255,255,0.72)",
    fontSize: 25,
    lineHeight: 1,
    fontWeight: 700,
  },

  shopHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: 14,
    flexWrap: "wrap",
    alignItems: "flex-start",
    padding: 18,
    borderRadius: 24,
    background:
      "linear-gradient(135deg, rgba(255,255,255,0.99), rgba(248,250,252,0.96))",
    border: "1px solid rgba(226,232,240,0.95)",
    boxShadow: "0 14px 34px rgba(15,23,42,0.06)",
    marginBottom: 16,
    minWidth: 0,
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
    fontSize: 27,
    letterSpacing: "-0.05em",
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
    padding: "7px 11px",
    borderRadius: 999,
    color: "#0f172a",
    border: "1px solid",
    fontSize: 11,
    fontWeight: 950,
    whiteSpace: "nowrap",
  },

  productGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: 14,
    minWidth: 0,
    marginBottom: 16,
  },

  productCard: {
    display: "flex",
    flexDirection: "column",
    height: "100%",
    borderRadius: 26,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    overflow: "hidden",
    boxShadow: "0 14px 34px rgba(15,23,42,0.07)",
    minWidth: 0,
  },

  imageLink: {
    display: "block",
    width: "100%",
    textDecoration: "none",
  },

  productImageWrap: {
    width: "100%",
    height: 200,
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
    minWidth: 0,
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
    border: "1px solid",
    fontSize: 12,
    fontWeight: 950,
    whiteSpace: "nowrap",
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
    whiteSpace: "nowrap",
  },

  productTitle: {
    margin: 0,
    color: "#0f172a",
    fontSize: 23,
    lineHeight: 1.05,
    letterSpacing: "-0.045em",
    overflowWrap: "anywhere",
  },

  productText: {
    margin: 0,
    color: "#64748b",
    lineHeight: 1.5,
    fontWeight: 710,
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
    gap: 2,
    padding: 10,
    borderRadius: 15,
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    color: "#64748b",
    fontSize: 11,
    fontWeight: 800,
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
    width: "100%",
    minWidth: 0,
    minHeight: 44,
    padding: "11px 13px",
    borderRadius: 999,
    textDecoration: "none",
    fontWeight: 950,
    textAlign: "center",
    lineHeight: 1.15,
    boxSizing: "border-box",
  },

  secondaryButton: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    minWidth: 0,
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
    boxSizing: "border-box",
  },

  emptyCard: {
    gridColumn: "1 / -1",
    display: "grid",
    justifyItems: "center",
    gap: 12,
    padding: 34,
    borderRadius: 28,
    background:
      "linear-gradient(135deg, rgba(255,255,255,0.98), rgba(248,250,252,0.95))",
    border: "1px dashed #cbd5e1",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.84)",
    textAlign: "center",
    minWidth: 0,
  },

  emptyIcon: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: 58,
    height: 58,
    borderRadius: 20,
    border: "1px solid",
    fontSize: 24,
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
    maxWidth: 610,
    margin: 0,
    color: "#64748b",
    lineHeight: 1.55,
    fontWeight: 760,
  },

  emptyActions: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 9,
    width: "min(100%, 440px)",
    marginTop: 2,
  },

  shopNotice: {
    display: "flex",
    gap: 14,
    justifyContent: "space-between",
    alignItems: "center",
    padding: 18,
    borderRadius: 24,
    background:
      "linear-gradient(135deg, rgba(255,255,255,0.98), rgba(239,246,255,0.92))",
    border: "1px solid #bfdbfe",
    boxShadow: "0 10px 30px rgba(22,131,248,0.06)",
    marginBottom: 16,
    minWidth: 0,
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

  contactStrip: {
    display: "grid",
    gridTemplateColumns: "52px minmax(0, 1fr) auto",
    gap: 14,
    alignItems: "center",
    padding: 16,
    borderRadius: 24,
    background:
      "linear-gradient(135deg, rgba(255,255,255,0.98) 0%, rgba(248,250,252,0.98) 62%, rgba(241,245,249,0.98) 100%)",
    border: "1px solid rgba(226,232,240,0.92)",
    boxShadow: "0 16px 36px rgba(15,23,42,0.07)",
    margin: "0 0 16px",
    minWidth: 0,
  },

  contactStripIcon: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: 50,
    height: 50,
    borderRadius: 18,
    border: "1px solid",
    fontSize: 21,
    fontWeight: 950,
  },

  contactStripCopy: {
    display: "grid",
    gap: 4,
    minWidth: 0,
  },

  contactStripKicker: {
    margin: 0,
    fontSize: 11,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
  },

  contactStripTitle: {
    margin: 0,
    color: "#0f172a",
    fontSize: 27,
    lineHeight: 1.05,
    letterSpacing: "-0.05em",
    overflowWrap: "anywhere",
  },

  contactStripText: {
    margin: 0,
    color: "#64748b",
    lineHeight: 1.5,
    fontSize: 14,
    fontWeight: 760,
    overflowWrap: "anywhere",
  },

  contactButton: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 46,
    padding: "11px 17px",
    borderRadius: 999,
    textDecoration: "none",
    fontSize: 14,
    fontWeight: 950,
    whiteSpace: "nowrap",
  },

  footer: {
    marginTop: 20,
    padding: 16,
    borderRadius: 22,
    background: "#ffffff",
    border: "1px solid",
    textAlign: "center",
  },

  footerText: {
    margin: 0,
    color: "#64748b",
    fontWeight: 800,
    lineHeight: 1.5,
  },
};
