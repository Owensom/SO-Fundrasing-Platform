import type { CSSProperties } from "react";
import Link from "next/link";
import { auth } from "@/auth";
import { getAllCampaignsForTenant } from "@/lib/campaigns";
import { queryOne } from "@/lib/db";
import {
  checkSubscriptionCapability,
  getMaximumActiveCampaignsForTier,
  normaliseSubscriptionTier,
} from "@/lib/subscription-capabilities";
import { getTenantSettings } from "@/lib/tenant-settings";

export const dynamic = "force-dynamic";

type CampaignType = "raffle" | "squares" | "event" | "auction";
type FilterType = "all" | CampaignType;

type PageProps = {
  params: Promise<{
    tenantSlug: string;
  }>;
  searchParams?: Promise<{
    adminReturn?: string;
    type?: string;
  }>;
};

type Campaign = {
  id: string;
  type: CampaignType;
  title: string;
  slug: string;
  description?: string | null;
  imageUrl?: string | null;
  image_focus_x?: number | null;
  image_focus_y?: number | null;
  status: "draft" | "published" | "closed" | "drawn";
};

type SessionUserWithTenants = {
  tenantSlugs?: string[];
};

type TenantCampaignSettings = {
  subscription_tier?: string | null;
};

type HighlightedCampaignSettings = {
  highlighted_campaign_type: string | null;
  highlighted_campaign_id: string | null;
};

type TenantBrandingSettings = {
  public_display_name: string | null;
  public_tagline: string | null;
  public_logo_url: string | null;
  public_logo_mark_url: string | null;
  public_primary_colour: string | null;
  public_accent_colour: string | null;
  public_footer_text: string | null;
};

function cleanText(value: unknown) {
  return String(value || "").trim();
}

function normaliseHexColour(value: unknown, fallback: string) {
  const clean = cleanText(value).toUpperCase();

  if (/^#[0-9A-F]{6}$/.test(clean)) {
    return clean;
  }

  return fallback;
}

function normaliseFocus(value: number | null | undefined) {
  const number = Number(value);

  if (!Number.isFinite(number)) return 50;

  return Math.max(0, Math.min(100, Math.round(number)));
}

function getDefaultImage(type: Campaign["type"]) {
  if (type === "raffle") return "/brand/so-default-raffles.png";
  if (type === "squares") return "/brand/so-default-squares.png";
  if (type === "event") return "/brand/so-default-events.png";
  if (type === "auction") return "/brand/so-default-auctions.png";

  return "/brand/so-logo-full.png";
}

function getCampaignImageSrc(campaign: Campaign) {
  return cleanText(campaign.imageUrl) || getDefaultImage(campaign.type);
}

function isDefaultBrandImage(imageUrl: string | null | undefined) {
  const clean = cleanText(imageUrl);
  return !clean || clean.includes("/brand/so-default-");
}

function getImageStyle(campaign: Campaign): CSSProperties {
  const imageUrl = cleanText(campaign.imageUrl);
  const defaultImage = isDefaultBrandImage(imageUrl);

  return {
    width: "100%",
    height: "100%",
    objectFit: defaultImage ? "contain" : "cover",
    objectPosition: defaultImage
      ? "center"
      : `${normaliseFocus(campaign.image_focus_x)}% ${normaliseFocus(
          campaign.image_focus_y,
        )}%`,
    display: "block",
    padding: defaultImage ? 26 : 0,
    boxSizing: "border-box",
    background: defaultImage
      ? "linear-gradient(135deg, #ffffff 0%, #f8fafc 55%, #eff6ff 100%)"
      : "#f1f5f9",
  };
}

function getCampaignUrl(campaign: Campaign) {
  if (campaign.type === "raffle") return `/r/${campaign.slug}`;
  if (campaign.type === "squares") return `/s/${campaign.slug}`;
  if (campaign.type === "event") return `/e/${campaign.slug}`;
  if (campaign.type === "auction") return `/a/${campaign.slug}`;

  return "#";
}

function getSupportUrl({
  tenantSlug,
  campaign,
}: {
  tenantSlug: string;
  campaign: Campaign;
}) {
  const params = new URLSearchParams();

  params.set("campaignType", campaign.type);
  params.set("campaignId", campaign.id);

  return `/c/${tenantSlug}/support?${params.toString()}`;
}

function getContactUrl({
  tenantSlug,
  campaign,
}: {
  tenantSlug: string;
  campaign?: Campaign | null;
}) {
  const params = new URLSearchParams();

  if (campaign) {
    params.set("campaignType", campaign.type);
    params.set("campaignId", campaign.id);
  }

  const query = params.toString();

  return query
    ? `/c/${tenantSlug}/contact?${query}`
    : `/c/${tenantSlug}/contact`;
}

function getTypeLabel(type: Campaign["type"]) {
  if (type === "raffle") return "Raffle";
  if (type === "squares") return "Squares";
  if (type === "event") return "Event";
  if (type === "auction") return "Auction";

  return "Campaign";
}

function getTypeMeta(type: Campaign["type"]) {
  if (type === "raffle") return "Prize draw campaign";
  if (type === "squares") return "Pick a square to support";
  if (type === "event") return "Ticketed fundraising event";
  if (type === "auction") return "Bid, support, make an impact";

  return "Fundraising campaign";
}

function getTypeStyle(type: Campaign["type"]): CSSProperties {
  if (type === "raffle") {
    return {
      background: "#eff6ff",
      color: "#1d4ed8",
      borderColor: "#bfdbfe",
    };
  }

  if (type === "squares") {
    return {
      background: "#f5f3ff",
      color: "#6d28d9",
      borderColor: "#ddd6fe",
    };
  }

  if (type === "event") {
    return {
      background: "#ecfdf5",
      color: "#166534",
      borderColor: "#bbf7d0",
    };
  }

  return {
    background: "#fffbeb",
    color: "#92400e",
    borderColor: "#fde68a",
  };
}

function getSafeAdminReturn(value?: string) {
  if (!value) return "";
  if (value === "/admin") return value;
  if (value.startsWith("/admin/")) return value;

  return "";
}

function getActiveType(value?: string): FilterType {
  if (
    value === "raffle" ||
    value === "squares" ||
    value === "event" ||
    value === "auction"
  ) {
    return value;
  }

  return "all";
}

function getFilterHref({
  tenantSlug,
  type,
  adminReturn,
}: {
  tenantSlug: string;
  type: FilterType;
  adminReturn: string;
}) {
  const params = new URLSearchParams();

  if (type !== "all") params.set("type", type);
  if (adminReturn) params.set("adminReturn", adminReturn);

  const query = params.toString();

  return query ? `/c/${tenantSlug}?${query}` : `/c/${tenantSlug}`;
}

function pluralise(value: number, singular: string, plural: string) {
  return `${value} ${value === 1 ? singular : plural}`;
}

function isCampaignType(value: unknown): value is CampaignType {
  return (
    value === "raffle" ||
    value === "squares" ||
    value === "event" ||
    value === "auction"
  );
}

async function getHighlightedCampaignSettings(tenantSlug: string) {
  return queryOne<HighlightedCampaignSettings>(
    `
      select
        highlighted_campaign_type,
        highlighted_campaign_id
      from tenant_settings
      where tenant_slug = $1
      limit 1
    `,
    [tenantSlug],
  );
}

async function getTenantBrandingSettings(tenantSlug: string) {
  return queryOne<TenantBrandingSettings>(
    `
      select
        public_display_name,
        public_tagline,
        public_logo_url,
        public_logo_mark_url,
        public_primary_colour,
        public_accent_colour,
        public_footer_text
      from tenant_settings
      where tenant_slug = $1
      limit 1
    `,
    [tenantSlug],
  );
}

function getHighlightedCampaign(params: {
  campaigns: Campaign[];
  highlightedSettings: HighlightedCampaignSettings | null;
}) {
  const highlightedType = String(
    params.highlightedSettings?.highlighted_campaign_type || "",
  ).trim();

  const highlightedId = String(
    params.highlightedSettings?.highlighted_campaign_id || "",
  ).trim();

  if (isCampaignType(highlightedType) && highlightedId) {
    const selectedCampaign = params.campaigns.find(
      (campaign) =>
        campaign.type === highlightedType &&
        String(campaign.id) === highlightedId,
    );

    if (selectedCampaign) {
      return selectedCampaign;
    }
  }

  return params.campaigns[0] || null;
}
export default async function TenantCampaignsPage({
  params,
  searchParams,
}: PageProps) {
  const { tenantSlug } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const session = await auth();

  const sessionUser = session?.user as SessionUserWithTenants | undefined;

  const userTenantSlugs = Array.isArray(sessionUser?.tenantSlugs)
    ? sessionUser.tenantSlugs.map((value) => String(value))
    : [];

  const requestedAdminReturn = getSafeAdminReturn(
    resolvedSearchParams?.adminReturn,
  );

  const isTenantAdmin = userTenantSlugs.includes(tenantSlug);
  const canShowAdminReturn = isTenantAdmin && Boolean(requestedAdminReturn);

  const adminReturn = canShowAdminReturn ? requestedAdminReturn : "";
  const activeType = getActiveType(resolvedSearchParams?.type);

  const [campaigns, tenantSettingsRaw, highlightedSettings, brandingSettings] =
    await Promise.all([
      getAllCampaignsForTenant(tenantSlug),
      getTenantSettings(tenantSlug),
      getHighlightedCampaignSettings(tenantSlug),
      getTenantBrandingSettings(tenantSlug),
    ]);

  const tenantSettings = tenantSettingsRaw as TenantCampaignSettings | null;

  const subscriptionTier = normaliseSubscriptionTier(
    tenantSettings?.subscription_tier,
  );

  const maxPublicCampaigns = getMaximumActiveCampaignsForTier(subscriptionTier);

  const auctionCapability = checkSubscriptionCapability(
    tenantSettings,
    "auctions",
  );

  const capabilityFilteredPublishedCampaigns = campaigns.filter((campaign) => {
    if (campaign.status !== "published") {
      return false;
    }

    if (campaign.type === "auction" && !auctionCapability.allowed) {
      return false;
    }

    return true;
  });

  const publicCampaigns = Number.isFinite(maxPublicCampaigns)
    ? capabilityFilteredPublishedCampaigns.slice(0, maxPublicCampaigns)
    : capabilityFilteredPublishedCampaigns;

  const raffles = publicCampaigns.filter((item) => item.type === "raffle");
  const squares = publicCampaigns.filter((item) => item.type === "squares");
  const events = publicCampaigns.filter((item) => item.type === "event");
  const auctions = publicCampaigns.filter((item) => item.type === "auction");

  const visibleCampaigns =
    activeType === "all"
      ? publicCampaigns
      : publicCampaigns.filter((campaign) => campaign.type === activeType);

  const featuredCampaign = getHighlightedCampaign({
    campaigns: publicCampaigns,
    highlightedSettings,
  });

  const campaignTypeNames = auctionCapability.allowed
    ? "raffles, squares, events and auctions"
    : "raffles, squares and events";

  const publicDisplayName =
    cleanText(brandingSettings?.public_display_name) ||
    "Support a live campaign";

  const publicTagline =
    cleanText(brandingSettings?.public_tagline) ||
    `Browse live ${campaignTypeNames} for this organisation. You can view a campaign to take part, or make a simple donation through the support flow.`;

  const publicLogoUrl = cleanText(brandingSettings?.public_logo_url);
  const publicLogoMarkUrl = cleanText(brandingSettings?.public_logo_mark_url);
  const publicFooterText = cleanText(brandingSettings?.public_footer_text);

  const primaryColour = normaliseHexColour(
    brandingSettings?.public_primary_colour,
    "#1683F8",
  );

  const accentColour = normaliseHexColour(
    brandingSettings?.public_accent_colour,
    "#FACC15",
  );

  const brandLogoSrc = publicLogoMarkUrl || publicLogoUrl;

  const brandedPageStyle: CSSProperties = {
    ...styles.page,
    background: `radial-gradient(circle at top left, ${primaryColour}16, transparent 34%), radial-gradient(circle at top right, ${accentColour}18, transparent 30%), #f8fafc`,
  };

  const brandedHeroStyle: CSSProperties = {
    ...styles.hero,
    background: `radial-gradient(circle at bottom right, ${primaryColour}30, transparent 42%), radial-gradient(circle at top left, ${accentColour}14, transparent 34%), linear-gradient(135deg, #020617 0%, #0f172a 58%, #172554 100%)`,
  };

  const brandedPrimaryActionStyle: CSSProperties = {
    ...styles.primaryAction,
    background: `linear-gradient(135deg, ${primaryColour} 0%, #2563eb 100%)`,
    border: `1px solid ${primaryColour}`,
    boxShadow: `0 12px 24px ${primaryColour}36`,
  };

  const brandedGhostActionStyle: CSSProperties = {
    ...styles.secondaryAction,
    borderColor: `${primaryColour}66`,
  };

  const brandedContactButtonStyle: CSSProperties = {
    ...styles.contactStripButton,
    background: `linear-gradient(135deg, ${primaryColour} 0%, #2563eb 100%)`,
    border: `1px solid ${primaryColour}`,
    boxShadow: `0 12px 24px ${primaryColour}28`,
  };

  const activeFilterStyle: CSSProperties = {
    ...styles.filterButtonActive,
    background: primaryColour,
    borderColor: primaryColour,
    color: "#0f172a",
  };

  return (
    <main className="tenant-campaigns-page" style={brandedPageStyle}>
      <style>{responsiveStyles}</style>

      <section className="brandHeader" style={styles.brandHeader}>
        <div className="brandIdentity" style={styles.brandIdentity}>
          {brandLogoSrc ? (
            <div style={styles.brandLogoWrap}>
              <img
                src={brandLogoSrc}
                alt={publicDisplayName}
                style={styles.brandLogo}
              />
            </div>
          ) : (
            <div
              style={{
                ...styles.brandLogoFallback,
                background: primaryColour,
                borderColor: accentColour,
              }}
            >
              {publicDisplayName.slice(0, 2).toUpperCase()}
            </div>
          )}

          <div style={styles.brandCopy}>
            <h1 style={styles.brandTitle}>{publicDisplayName}</h1>
            <p style={styles.brandTagline}>{publicTagline}</p>
          </div>
        </div>

        <div
          className="brandFeature"
          style={{
            ...styles.brandFeature,
            borderColor: `${accentColour}78`,
            background: `linear-gradient(135deg, ${accentColour}12, #ffffff 78%)`,
          }}
        >
          <span style={styles.brandFeatureKicker}>Campaign hub</span>

          <strong style={styles.brandFeatureTitle}>
            {pluralise(publicCampaigns.length, "live campaign", "live campaigns")}
          </strong>

          <span style={styles.brandFeatureText}>
            {featuredCampaign
              ? `Featuring ${featuredCampaign.title}.`
              : "Published campaigns will appear here when available."}
          </span>
        </div>
      </section>

      <section className="campaigns-hero" style={brandedHeroStyle}>
        <div style={styles.heroGlow} />
        <div style={styles.heroLineOne} />
        <div style={styles.heroLineTwo} />

        <div className="heroMainGrid" style={styles.heroMainGrid}>
          <div style={styles.heroCopy}>
            <div
              style={{
                ...styles.eyebrow,
                color: accentColour,
                borderColor: `${accentColour}CC`,
              }}
            >
              Public campaign hub
            </div>

            <h2 style={styles.heroTitle}>Support a live campaign</h2>

            <p style={styles.subtitle}>
              Browse live {campaignTypeNames}. Open a campaign to take part, or
              make a simple donation through the support flow.
            </p>

            <div className="heroStats" style={styles.heroStats}>
              <HeroStat label="Live campaigns" value={publicCampaigns.length} />
              <HeroStat label="Raffles" value={raffles.length} />
              <HeroStat label="Squares" value={squares.length} />
              <HeroStat label="Events" value={events.length} />
              {auctionCapability.allowed ? (
                <HeroStat label="Auctions" value={auctions.length} />
              ) : null}
            </div>
          </div>

          <div style={styles.supportPanel}>
            <h2 style={styles.supportPanelTitle}>Support options</h2>

            <div style={styles.supportOptionList}>
              <div style={styles.supportOption}>
                <div
                  style={{
                    ...styles.supportIcon,
                    background: `${primaryColour}26`,
                    borderColor: `${primaryColour}66`,
                  }}
                >
                  →
                </div>

                <div style={styles.supportOptionCopy}>
                  <strong>See campaign</strong>
                  <span>Open the campaign page to enter, buy, bid or book.</span>
                </div>
              </div>

              <div style={styles.supportOption}>
                <div
                  style={{
                    ...styles.supportIcon,
                    background: `${accentColour}24`,
                    borderColor: `${accentColour}78`,
                  }}
                >
                  ♥
                </div>

                <div style={styles.supportOptionCopy}>
                  <strong>Support campaign</strong>
                  <span>Make a simple donation without receiving an entry.</span>
                </div>
              </div>

              <Link
                href={getContactUrl({ tenantSlug })}
                style={styles.supportOptionLink}
              >
                <div
                  style={{
                    ...styles.supportIcon,
                    background: "rgba(255,255,255,0.12)",
                    borderColor: "rgba(191,219,254,0.42)",
                  }}
                >
                  ✉
                </div>

                <div style={styles.supportOptionCopy}>
                  <strong>Contact organiser</strong>
                  <span>Ask the charity or organiser a public support question.</span>
                </div>
              </Link>
            </div>
          </div>
        </div>

        {canShowAdminReturn ? (
          <div className="heroActions" style={styles.heroActions}>
            <Link href={adminReturn} style={styles.adminReturnButton}>
              ← Back to admin
            </Link>
          </div>
        ) : null}
      </section>
            <section style={styles.contactStrip}>
        <div style={styles.contactStripCopy}>
          <p style={{ ...styles.contactStripKicker, color: primaryColour }}>
            Need help from the organiser?
          </p>

          <h2 style={styles.contactStripTitle}>Contact the organiser</h2>

          <p style={styles.contactStripText}>
            Questions about a campaign, booking, donation, raffle, event or
            auction can be sent directly to the organiser.
          </p>
        </div>

        <Link
          href={getContactUrl({ tenantSlug })}
          style={brandedContactButtonStyle}
        >
          Contact organiser →
        </Link>
      </section>

      {featuredCampaign ? (
        <section className="featuredCard" style={styles.featuredCard}>
          <div style={styles.featuredImageWrap}>
            <img
              src={getCampaignImageSrc(featuredCampaign)}
              alt={featuredCampaign.title}
              style={getImageStyle(featuredCampaign)}
            />
          </div>

          <div style={styles.featuredContent}>
            <div style={styles.cardTopRow}>
              <span
                style={{
                  ...styles.featuredKicker,
                  color: "#92400e",
                }}
              >
                ★ Featured campaign
              </span>

              <span
                style={{
                  ...styles.statusPill,
                  background: `${accentColour}20`,
                  borderColor: `${accentColour}78`,
                  color: "#0f172a",
                }}
              >
                Selected
              </span>
            </div>

            <h2 style={styles.featuredTitle}>{featuredCampaign.title}</h2>

            <p style={styles.featuredText}>
              {featuredCampaign.description?.trim() ||
                getTypeMeta(featuredCampaign.type)}
            </p>

            <div style={styles.featuredMetaGrid}>
              <MiniMeta
                label="Campaign type"
                value={getTypeLabel(featuredCampaign.type)}
              />
              <MiniMeta label="Status" value="Live" />
              <MiniMeta label="Support" value="Campaign donations" />
            </div>

            <div style={styles.actionStack}>
              <div style={styles.primaryActionRow}>
                <Link
                  href={getCampaignUrl(featuredCampaign)}
                  style={brandedPrimaryActionStyle}
                >
                  See campaign →
                </Link>

                <Link
                  href={getSupportUrl({
                    tenantSlug,
                    campaign: featuredCampaign,
                  })}
                  style={brandedGhostActionStyle}
                >
                  Support campaign
                </Link>
              </div>

              <Link
                href={getContactUrl({
                  tenantSlug,
                  campaign: featuredCampaign,
                })}
                style={styles.contactAction}
              >
                Contact organiser
              </Link>
            </div>
          </div>
        </section>
      ) : null}

      <section className="filtersCard" style={styles.filtersCard}>
        <div style={styles.filtersHeader}>
          <div>
            <p style={{ ...styles.kicker, color: primaryColour }}>
              Filter campaigns
            </p>
            <h2 style={styles.sectionTitle}>Live campaigns</h2>
          </div>

          <span
            style={{
              ...styles.countPill,
              borderColor: `${accentColour}78`,
              background: `${accentColour}1A`,
            }}
          >
            {pluralise(visibleCampaigns.length, "campaign", "campaigns")}
          </span>
        </div>

        <nav className="filterNav" style={styles.filterNav}>
          <Link
            href={getFilterHref({ tenantSlug, type: "all", adminReturn })}
            style={{
              ...styles.filterButton,
              ...(activeType === "all" ? activeFilterStyle : {}),
            }}
          >
            All
          </Link>

          <Link
            href={getFilterHref({ tenantSlug, type: "raffle", adminReturn })}
            style={{
              ...styles.filterButton,
              ...(activeType === "raffle" ? activeFilterStyle : {}),
            }}
          >
            Raffles
          </Link>

          <Link
            href={getFilterHref({ tenantSlug, type: "squares", adminReturn })}
            style={{
              ...styles.filterButton,
              ...(activeType === "squares" ? activeFilterStyle : {}),
            }}
          >
            Squares
          </Link>

          <Link
            href={getFilterHref({ tenantSlug, type: "event", adminReturn })}
            style={{
              ...styles.filterButton,
              ...(activeType === "event" ? activeFilterStyle : {}),
            }}
          >
            Events
          </Link>

          {auctionCapability.allowed ? (
            <Link
              href={getFilterHref({ tenantSlug, type: "auction", adminReturn })}
              style={{
                ...styles.filterButton,
                ...(activeType === "auction" ? activeFilterStyle : {}),
              }}
            >
              Auctions
            </Link>
          ) : null}
        </nav>
      </section>

      <section className="campaignGrid" style={styles.campaignGrid}>
        {visibleCampaigns.length === 0 ? (
          <div style={styles.emptyCard}>
            <h2 style={styles.emptyTitle}>No live campaigns found</h2>

            <p style={styles.emptyText}>
              There are no published campaigns in this category yet.
            </p>

            <Link
              href={getContactUrl({ tenantSlug })}
              style={{
                ...styles.contactAction,
                justifySelf: "center",
                marginTop: 12,
              }}
            >
              Contact organiser
            </Link>
          </div>
        ) : (
          visibleCampaigns.map((campaign) => (
            <article key={`${campaign.type}-${campaign.id}`} style={styles.card}>
              <div style={styles.cardImageWrap}>
                <img
                  src={getCampaignImageSrc(campaign)}
                  alt={campaign.title}
                  style={getImageStyle(campaign)}
                />
              </div>

              <div style={styles.cardBody}>
                <div style={styles.cardTopRow}>
                  <span
                    style={{
                      ...styles.typePill,
                      ...getTypeStyle(campaign.type),
                    }}
                  >
                    {getTypeLabel(campaign.type)}
                  </span>

                  <span style={styles.statusPill}>Live</span>
                </div>

                <h2 style={styles.cardTitle}>{campaign.title}</h2>

                <p style={styles.cardText}>
                  {campaign.description?.trim() || getTypeMeta(campaign.type)}
                </p>

                <div style={styles.actionStack}>
                  <div style={styles.primaryActionRow}>
                    <Link
                      href={getCampaignUrl(campaign)}
                      style={brandedPrimaryActionStyle}
                    >
                      See campaign
                    </Link>

                    <Link
                      href={getSupportUrl({ tenantSlug, campaign })}
                      style={brandedGhostActionStyle}
                    >
                      Support campaign
                    </Link>
                  </div>

                  <Link
                    href={getContactUrl({ tenantSlug, campaign })}
                    style={styles.contactAction}
                  >
                    Contact organiser
                  </Link>
                </div>
              </div>
            </article>
          ))
        )}
      </section>

      {publicFooterText ? (
        <footer
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

function HeroStat({ label, value }: { label: string; value: number }) {
  return (
    <div style={styles.heroStat}>
      <span style={styles.heroStatLabel}>{label}</span>
      <strong style={styles.heroStatValue}>{value}</strong>
    </div>
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
.tenant-campaigns-page,
.tenant-campaigns-page * {
  box-sizing: border-box;
}

.tenant-campaigns-page {
  overflow-x: hidden;
}

.tenant-campaigns-page section,
.tenant-campaigns-page div,
.tenant-campaigns-page article,
.tenant-campaigns-page nav {
  min-width: 0;
}

@media (max-width: 980px) {
  .tenant-campaigns-page .brandHeader,
  .tenant-campaigns-page .heroMainGrid,
  .tenant-campaigns-page .featuredCard,
  .tenant-campaigns-page .contactStrip {
    grid-template-columns: 1fr !important;
  }

  .tenant-campaigns-page .heroStats {
    grid-template-columns: repeat(auto-fit, minmax(118px, 1fr)) !important;
  }

  .tenant-campaigns-page .campaignGrid {
    grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
  }

  .tenant-campaigns-page .featuredCard {
    margin: 12px 18px 16px !important;
  }
}

@media (max-width: 680px) {
  .tenant-campaigns-page {
    width: 100% !important;
    max-width: 100% !important;
    padding: 14px 10px 44px !important;
  }

  .tenant-campaigns-page .brandHeader,
  .tenant-campaigns-page .campaigns-hero,
  .tenant-campaigns-page .featuredCard,
  .tenant-campaigns-page .filtersCard,
  .tenant-campaigns-page .contactStrip {
    padding: 14px !important;
    border-radius: 22px !important;
  }

  .tenant-campaigns-page .brandIdentity {
    grid-template-columns: 56px minmax(0, 1fr) !important;
    text-align: left !important;
    justify-items: stretch !important;
  }

  .tenant-campaigns-page .brandLogoWrap,
  .tenant-campaigns-page .brandLogoFallback {
    width: 56px !important;
    height: 56px !important;
    border-radius: 16px !important;
  }

  .tenant-campaigns-page .brandTitle {
    font-size: clamp(26px, 8vw, 38px) !important;
    letter-spacing: -0.06em !important;
  }

  .tenant-campaigns-page .brandFeature {
    padding: 12px !important;
  }

  .tenant-campaigns-page .heroStats,
  .tenant-campaigns-page .campaignGrid,
  .tenant-campaigns-page .featuredMetaGrid {
    grid-template-columns: 1fr !important;
  }

  .tenant-campaigns-page .supportPanel {
    padding: 14px !important;
  }

  .tenant-campaigns-page .supportOptionLink,
  .tenant-campaigns-page .supportOption {
    grid-template-columns: 44px minmax(0, 1fr) !important;
  }

  .tenant-campaigns-page .featuredCard {
    margin: 10px 0 16px !important;
  }

  .tenant-campaigns-page .featuredImageWrap {
    height: 210px !important;
    min-height: 210px !important;
  }

  .tenant-campaigns-page .primaryActionRow {
    grid-template-columns: 1fr !important;
  }

  .tenant-campaigns-page .filterNav,
  .tenant-campaigns-page .heroActions {
    display: grid !important;
    grid-template-columns: 1fr !important;
    align-items: stretch !important;
  }

  .tenant-campaigns-page .primaryAction,
  .tenant-campaigns-page .secondaryAction,
  .tenant-campaigns-page .contactAction,
  .tenant-campaigns-page .contactStripButton,
  .tenant-campaigns-page .adminReturnButton,
  .tenant-campaigns-page .filterButton {
    width: 100% !important;
    justify-content: center !important;
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
    gridTemplateColumns: "minmax(0, 1fr) minmax(250px, 0.34fr)",
    gap: 14,
    alignItems: "stretch",
    padding: 14,
    borderRadius: 24,
    background: "rgba(255,255,255,0.94)",
    border: "1px solid #e2e8f0",
    boxShadow: "0 14px 38px rgba(15,23,42,0.07)",
    marginBottom: 12,
    backdropFilter: "blur(14px)",
  },

  brandIdentity: {
    display: "grid",
    gridTemplateColumns: "72px minmax(0, 1fr)",
    gap: 14,
    alignItems: "center",
    minWidth: 0,
  },

  brandLogoWrap: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: 72,
    height: 72,
    borderRadius: 18,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    overflow: "hidden",
    boxShadow: "0 10px 24px rgba(15,23,42,0.08)",
  },

  brandLogo: {
    display: "block",
    width: "100%",
    height: "100%",
    objectFit: "contain",
    padding: 7,
  },

  brandLogoFallback: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: 72,
    height: 72,
    borderRadius: 18,
    border: "2px solid",
    color: "#0f172a",
    fontSize: 22,
    fontWeight: 950,
    letterSpacing: "-0.05em",
  },

  brandCopy: {
    display: "grid",
    gap: 4,
    minWidth: 0,
  },

  brandTitle: {
    margin: 0,
    color: "#0f172a",
    fontSize: "clamp(34px, 5vw, 54px)",
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
    gap: 5,
    alignContent: "center",
    padding: 12,
    borderRadius: 18,
    border: "1px solid",
    minWidth: 0,
  },

  brandFeatureKicker: {
    color: "#92400e",
    fontSize: 10,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
  },

  brandFeatureTitle: {
    color: "#0f172a",
    fontSize: 18,
    lineHeight: 1.1,
    letterSpacing: "-0.04em",
    overflowWrap: "anywhere",
  },

  brandFeatureText: {
    color: "#475569",
    fontSize: 12,
    lineHeight: 1.35,
    fontWeight: 750,
  },

  hero: {
    position: "relative",
    display: "grid",
    gap: 16,
    padding: 22,
    borderRadius: 24,
    color: "#ffffff",
    marginBottom: 0,
    boxShadow: "0 22px 52px rgba(15,23,42,0.22)",
    overflow: "hidden",
    border: "1px solid rgba(148,163,184,0.22)",
  },

  heroGlow: {
    position: "absolute",
    inset: 0,
    pointerEvents: "none",
    background:
      "radial-gradient(circle at 18% 24%, rgba(255,255,255,0.07), transparent 30%)",
  },

  heroLineOne: {
    position: "absolute",
    left: -90,
    bottom: -130,
    width: 330,
    height: 330,
    border: "1px solid rgba(250,204,21,0.18)",
    borderRadius: "999px",
    pointerEvents: "none",
  },

  heroLineTwo: {
    position: "absolute",
    left: -140,
    bottom: -180,
    width: 440,
    height: 440,
    border: "1px solid rgba(250,204,21,0.09)",
    borderRadius: "999px",
    pointerEvents: "none",
  },

  heroMainGrid: {
    position: "relative",
    zIndex: 1,
    display: "grid",
    gridTemplateColumns: "minmax(0, 1.08fr) minmax(270px, 0.82fr)",
    gap: 18,
    alignItems: "stretch",
    minWidth: 0,
  },

  heroCopy: {
    minWidth: 0,
  },

  eyebrow: {
    display: "inline-flex",
    padding: "7px 12px",
    borderRadius: 999,
    background: "rgba(15,23,42,0.36)",
    border: "1px solid",
    fontSize: 11,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.1em",
    marginBottom: 11,
  },

  heroTitle: {
    margin: 0,
    maxWidth: 660,
    fontSize: "clamp(38px, 6vw, 60px)",
    lineHeight: 0.94,
    letterSpacing: "-0.075em",
    overflowWrap: "anywhere",
    textShadow: "0 18px 45px rgba(0,0,0,0.22)",
  },

  subtitle: {
    margin: "11px 0 0",
    maxWidth: 700,
    color: "#dbeafe",
    fontSize: 16,
    lineHeight: 1.48,
    fontWeight: 750,
    overflowWrap: "anywhere",
  },

  heroStats: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(112px, 1fr))",
    gap: 10,
    marginTop: 16,
  },

  heroStat: {
    display: "grid",
    gap: 4,
    padding: 11,
    borderRadius: 16,
    background: "rgba(255,255,255,0.09)",
    border: "1px solid rgba(148,163,184,0.25)",
    minWidth: 0,
    overflowWrap: "normal",
  },

  heroStatLabel: {
    color: "#ffffff",
    fontSize: 11,
    lineHeight: 1.15,
    fontWeight: 900,
    whiteSpace: "nowrap",
  },

  heroStatValue: {
    color: "#ffffff",
    fontSize: 22,
    lineHeight: 1,
    fontWeight: 950,
    letterSpacing: "-0.04em",
  },

  supportPanel: {
    display: "grid",
    gap: 11,
    alignContent: "center",
    padding: 17,
    borderRadius: 22,
    background: "rgba(255,255,255,0.08)",
    border: "1px solid rgba(148,163,184,0.28)",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.10)",
    backdropFilter: "blur(12px)",
    minWidth: 0,
  },

  supportPanelTitle: {
    margin: 0,
    color: "#ffffff",
    fontSize: 22,
    lineHeight: 1.05,
    letterSpacing: "-0.04em",
  },

  supportOptionList: {
    display: "grid",
    gap: 9,
  },

  supportOption: {
    display: "grid",
    gridTemplateColumns: "48px minmax(0, 1fr)",
    gap: 11,
    alignItems: "center",
    padding: 12,
    borderRadius: 16,
    background: "rgba(255,255,255,0.10)",
    border: "1px solid rgba(191,219,254,0.18)",
    color: "#dbeafe",
  },

  supportOptionLink: {
    display: "grid",
    gridTemplateColumns: "48px minmax(0, 1fr)",
    gap: 11,
    alignItems: "center",
    padding: 12,
    borderRadius: 16,
    background: "rgba(255,255,255,0.13)",
    border: "1px solid rgba(191,219,254,0.24)",
    color: "#dbeafe",
    textDecoration: "none",
  },
    supportIcon: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: 44,
    height: 44,
    borderRadius: 14,
    border: "1px solid",
    color: "#ffffff",
    fontSize: 18,
    fontWeight: 950,
  },

  supportOptionCopy: {
    display: "grid",
    gap: 2,
    minWidth: 0,
    lineHeight: 1.35,
    fontSize: 13,
  },

  heroActions: {
    position: "relative",
    zIndex: 1,
    display: "flex",
    justifyContent: "flex-start",
    gap: 12,
    flexWrap: "wrap",
    paddingTop: 14,
    borderTop: "1px solid rgba(148,163,184,0.24)",
  },

  adminReturnButton: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 42,
    padding: "10px 15px",
    borderRadius: 999,
    background: "rgba(255,255,255,0.10)",
    color: "#ffffff",
    textDecoration: "none",
    fontWeight: 950,
    border: "1px solid rgba(255,255,255,0.28)",
  },

  contactStrip: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) auto",
    gap: 14,
    alignItems: "center",
    padding: 16,
    borderRadius: 22,
    background:
      "linear-gradient(135deg, rgba(255,255,255,0.98) 0%, rgba(248,250,252,0.98) 62%, rgba(239,246,255,0.98) 100%)",
    border: "1px solid #dbeafe",
    boxShadow: "0 10px 28px rgba(15,23,42,0.055)",
    margin: "14px 0 16px",
    minWidth: 0,
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
    fontSize: 26,
    lineHeight: 1.05,
    letterSpacing: "-0.045em",
    overflowWrap: "anywhere",
  },

  contactStripText: {
    margin: 0,
    color: "#64748b",
    lineHeight: 1.5,
    fontSize: 14,
    fontWeight: 750,
    overflowWrap: "anywhere",
  },

  contactStripButton: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 44,
    padding: "11px 16px",
    borderRadius: 999,
    color: "#ffffff",
    textDecoration: "none",
    fontSize: 14,
    fontWeight: 950,
    whiteSpace: "nowrap",
  },

  featuredCard: {
    display: "grid",
    gridTemplateColumns: "minmax(300px, 0.96fr) minmax(0, 1.04fr)",
    gap: 18,
    padding: 15,
    borderRadius: 26,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    boxShadow: "0 16px 42px rgba(15,23,42,0.08)",
    margin: "12px 28px 16px",
    minWidth: 0,
    overflow: "hidden",
    position: "relative",
    zIndex: 2,
  },

  featuredImageWrap: {
    height: 230,
    minHeight: 230,
    borderRadius: 20,
    overflow: "hidden",
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
  },

  featuredContent: {
    display: "grid",
    gap: 11,
    alignContent: "center",
    minWidth: 0,
    padding: "2px 0",
  },

  cardTopRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: 10,
    alignItems: "center",
    flexWrap: "wrap",
    minWidth: 0,
  },

  featuredKicker: {
    margin: 0,
    fontSize: 11,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
  },

  typePill: {
    display: "inline-flex",
    alignItems: "center",
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
    background: "#dcfce7",
    color: "#166534",
    border: "1px solid #bbf7d0",
    fontSize: 11,
    fontWeight: 950,
    whiteSpace: "nowrap",
  },

  featuredTitle: {
    margin: 0,
    color: "#0f172a",
    fontSize: "clamp(32px, 4.4vw, 46px)",
    lineHeight: 0.98,
    letterSpacing: "-0.065em",
    overflowWrap: "anywhere",
  },

  featuredText: {
    margin: 0,
    color: "#475569",
    lineHeight: 1.5,
    fontWeight: 750,
    overflowWrap: "anywhere",
  },

  featuredMetaGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: 8,
  },

  miniMeta: {
    display: "grid",
    gap: 2,
    padding: 9,
    borderRadius: 13,
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    color: "#64748b",
    fontSize: 11,
    fontWeight: 800,
  },

  actionStack: {
    display: "grid",
    gap: 9,
    width: "100%",
    minWidth: 0,
    marginTop: 2,
  },

  primaryActionRow: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 9,
    width: "100%",
    minWidth: 0,
  },

  primaryAction: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    minWidth: 0,
    minHeight: 42,
    padding: "10px 12px",
    borderRadius: 999,
    color: "#ffffff",
    textDecoration: "none",
    fontWeight: 950,
    textAlign: "center",
    lineHeight: 1.15,
    boxSizing: "border-box",
  },

  secondaryAction: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    minWidth: 0,
    minHeight: 42,
    padding: "10px 12px",
    borderRadius: 999,
    background: "#ffffff",
    color: "#0f172a",
    textDecoration: "none",
    fontWeight: 950,
    border: "1px solid #cbd5e1",
    textAlign: "center",
    lineHeight: 1.15,
    boxSizing: "border-box",
  },

  contactAction: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    minWidth: 0,
    minHeight: 42,
    padding: "10px 12px",
    borderRadius: 999,
    background: "#f8fafc",
    color: "#0f172a",
    textDecoration: "none",
    fontWeight: 950,
    border: "1px solid #cbd5e1",
    textAlign: "center",
    lineHeight: 1.15,
    boxSizing: "border-box",
  },

  filtersCard: {
    display: "grid",
    gap: 12,
    padding: 16,
    borderRadius: 22,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    boxShadow: "0 2px 12px rgba(15,23,42,0.04)",
    marginBottom: 16,
    minWidth: 0,
  },

  filtersHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: 14,
    flexWrap: "wrap",
    alignItems: "flex-start",
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
    fontSize: 26,
    letterSpacing: "-0.045em",
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

  filterNav: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
    alignItems: "center",
  },

  filterButton: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 38,
    padding: "8px 13px",
    borderRadius: 999,
    background: "#f8fafc",
    color: "#334155",
    border: "1px solid #e2e8f0",
    textDecoration: "none",
    fontSize: 13,
    fontWeight: 950,
  },

  filterButtonActive: {
    color: "#0f172a",
  },

  campaignGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: 14,
    minWidth: 0,
  },

  card: {
    display: "grid",
    gridTemplateRows: "200px 1fr",
    borderRadius: 24,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    overflow: "hidden",
    boxShadow: "0 10px 28px rgba(15,23,42,0.06)",
    minWidth: 0,
  },

  cardImageWrap: {
    width: "100%",
    height: 200,
    overflow: "hidden",
    background: "#f8fafc",
    borderBottom: "1px solid #e2e8f0",
  },

  cardBody: {
    display: "grid",
    gap: 11,
    alignContent: "start",
    padding: 15,
    minWidth: 0,
  },

  cardTitle: {
    margin: 0,
    color: "#0f172a",
    fontSize: 23,
    lineHeight: 1.05,
    letterSpacing: "-0.045em",
    overflowWrap: "anywhere",
  },

  cardText: {
    margin: 0,
    color: "#64748b",
    lineHeight: 1.5,
    fontWeight: 700,
    overflowWrap: "anywhere",
  },

  emptyCard: {
    gridColumn: "1 / -1",
    display: "grid",
    justifyItems: "center",
    padding: 28,
    borderRadius: 24,
    background: "#ffffff",
    border: "1px dashed #cbd5e1",
    textAlign: "center",
    minWidth: 0,
  },

  emptyTitle: {
    margin: 0,
    color: "#0f172a",
    fontSize: 28,
    letterSpacing: "-0.04em",
  },

  emptyText: {
    margin: "8px 0 0",
    color: "#64748b",
    lineHeight: 1.55,
    fontWeight: 750,
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
