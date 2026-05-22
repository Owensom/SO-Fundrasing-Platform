import type { CSSProperties } from "react";
import Link from "next/link";
import { auth } from "@/auth";
import { getAllCampaignsForTenant } from "@/lib/campaigns";
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
  highlighted_campaign_type?: string | null;
  highlighted_campaign_id?: string | null;
};

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

function isDefaultBrandImage(imageUrl: string | null | undefined) {
  return Boolean(imageUrl && imageUrl.includes("/brand/so-default-"));
}

function getImageStyle(campaign: Campaign): CSSProperties {
  const imageUrl = campaign.imageUrl || "";
  const defaultImage = !imageUrl || isDefaultBrandImage(imageUrl);

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
    padding: defaultImage ? 28 : 0,
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

function getHighlightedCampaign(params: {
  campaigns: Campaign[];
  settings: TenantCampaignSettings | null;
}) {
  const highlightedType = String(
    params.settings?.highlighted_campaign_type || "",
  ).trim();

  const highlightedId = String(
    params.settings?.highlighted_campaign_id || "",
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

  const campaigns: Campaign[] = await getAllCampaignsForTenant(tenantSlug);
  const tenantSettingsRaw = await getTenantSettings(tenantSlug);
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
    settings: tenantSettings,
  });

  const campaignTypeNames = auctionCapability.allowed
    ? "raffles, squares, events and auctions"
    : "raffles, squares and events";

  return (
    <main className="tenant-campaigns-page" style={styles.page}>
      <style>{responsiveStyles}</style>

      <section className="campaigns-hero" style={styles.hero}>
        <div style={styles.heroGlow} />

        <div className="heroMainGrid" style={styles.heroMainGrid}>
          <div style={styles.heroCopy}>
            <div style={styles.eyebrow}>Fundraising campaigns</div>

            <h1 style={styles.title}>Support a live campaign</h1>

            <p style={styles.subtitle}>
              Browse live {campaignTypeNames} for this organisation. You can
              view a campaign to take part, or make a simple donation through
              the new support flow.
            </p>

            <div className="heroStats" style={styles.heroStats}>
              <HeroStat
                label="Live campaigns"
                value={publicCampaigns.length}
              />
              <HeroStat label="Raffles" value={raffles.length} />
              <HeroStat label="Squares" value={squares.length} />
              <HeroStat label="Events" value={events.length} />
              {auctionCapability.allowed ? (
                <HeroStat label="Auctions" value={auctions.length} />
              ) : null}
            </div>
          </div>

          <div style={styles.heroPanel}>
            <div style={styles.heroPanelEyebrow}>Support options</div>

            <h2 style={styles.heroPanelTitle}>Two ways to help</h2>

            <div style={styles.heroPanelList}>
              <div style={styles.heroPanelItem}>
                <strong>See campaign</strong>
                <span>Open the campaign page to enter, buy, bid or book.</span>
              </div>

              <div style={styles.heroPanelItem}>
                <strong>Support campaign</strong>
                <span>Make a simple donation without receiving an entry.</span>
              </div>
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

      {featuredCampaign ? (
        <section className="featuredCard" style={styles.featuredCard}>
          <div style={styles.featuredImageWrap}>
            <img
              src={
                featuredCampaign.imageUrl || getDefaultImage(featuredCampaign.type)
              }
              alt={featuredCampaign.title}
              style={getImageStyle(featuredCampaign)}
            />
          </div>

          <div style={styles.featuredContent}>
            <div style={styles.cardTopRow}>
              <span
                style={{
                  ...styles.typePill,
                  ...getTypeStyle(featuredCampaign.type),
                }}
              >
                {getTypeLabel(featuredCampaign.type)}
              </span>

              <span style={styles.statusPill}>Featured</span>
            </div>

            <h2 style={styles.featuredTitle}>{featuredCampaign.title}</h2>

            <p style={styles.featuredText}>
              {featuredCampaign.description?.trim() ||
                getTypeMeta(featuredCampaign.type)}
            </p>

            <div className="campaignActions" style={styles.campaignActions}>
              <Link
                href={getCampaignUrl(featuredCampaign)}
                style={styles.primaryAction}
              >
                See campaign
              </Link>

              <Link
                href={getSupportUrl({
                  tenantSlug,
                  campaign: featuredCampaign,
                })}
                style={styles.secondaryAction}
              >
                Support campaign
              </Link>
            </div>
          </div>
        </section>
      ) : null}

      <section className="filtersCard" style={styles.filtersCard}>
        <div style={styles.filtersHeader}>
          <div>
            <p style={styles.kicker}>Filter campaigns</p>
            <h2 style={styles.sectionTitle}>Live campaigns</h2>
          </div>

          <span style={styles.countPill}>
            {pluralise(visibleCampaigns.length, "campaign", "campaigns")}
          </span>
        </div>

        <nav className="filterNav" style={styles.filterNav}>
          <Link
            href={getFilterHref({ tenantSlug, type: "all", adminReturn })}
            style={{
              ...styles.filterButton,
              ...(activeType === "all" ? styles.filterButtonActive : {}),
            }}
          >
            All
          </Link>

          <Link
            href={getFilterHref({ tenantSlug, type: "raffle", adminReturn })}
            style={{
              ...styles.filterButton,
              ...(activeType === "raffle" ? styles.filterButtonActive : {}),
            }}
          >
            Raffles
          </Link>

          <Link
            href={getFilterHref({ tenantSlug, type: "squares", adminReturn })}
            style={{
              ...styles.filterButton,
              ...(activeType === "squares" ? styles.filterButtonActive : {}),
            }}
          >
            Squares
          </Link>

          <Link
            href={getFilterHref({ tenantSlug, type: "event", adminReturn })}
            style={{
              ...styles.filterButton,
              ...(activeType === "event" ? styles.filterButtonActive : {}),
            }}
          >
            Events
          </Link>

          {auctionCapability.allowed ? (
            <Link
              href={getFilterHref({ tenantSlug, type: "auction", adminReturn })}
              style={{
                ...styles.filterButton,
                ...(activeType === "auction" ? styles.filterButtonActive : {}),
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
          </div>
        ) : (
          visibleCampaigns.map((campaign) => (
            <article key={`${campaign.type}-${campaign.id}`} style={styles.card}>
              <div style={styles.cardImageWrap}>
                <img
                  src={campaign.imageUrl || getDefaultImage(campaign.type)}
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

                <div className="campaignActions" style={styles.campaignActions}>
                  <Link
                    href={getCampaignUrl(campaign)}
                    style={styles.primaryAction}
                  >
                    See campaign
                  </Link>

                  <Link
                    href={getSupportUrl({ tenantSlug, campaign })}
                    style={styles.secondaryAction}
                  >
                    Support campaign
                  </Link>
                </div>
              </div>
            </article>
          ))
        )}
      </section>
    </main>
  );
}

function HeroStat({ label, value }: { label: string; value: number }) {
  return (
    <div style={styles.heroStat}>
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
  .tenant-campaigns-page .heroMainGrid,
  .tenant-campaigns-page .featuredCard {
    grid-template-columns: 1fr !important;
  }

  .tenant-campaigns-page .heroStats {
    grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
  }

  .tenant-campaigns-page .campaignGrid {
    grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
  }
}

@media (max-width: 680px) {
  .tenant-campaigns-page {
    width: 100% !important;
    max-width: 100% !important;
    padding: 16px 10px 44px !important;
  }

  .tenant-campaigns-page .campaigns-hero,
  .tenant-campaigns-page .featuredCard,
  .tenant-campaigns-page .filtersCard {
    padding: 18px !important;
    border-radius: 24px !important;
  }

  .tenant-campaigns-page .heroStats,
  .tenant-campaigns-page .campaignGrid {
    grid-template-columns: 1fr !important;
  }

  .tenant-campaigns-page .filterNav,
  .tenant-campaigns-page .campaignActions,
  .tenant-campaigns-page .heroActions {
    display: grid !important;
    grid-template-columns: 1fr !important;
    align-items: stretch !important;
  }

  .tenant-campaigns-page .primaryAction,
  .tenant-campaigns-page .secondaryAction,
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
    background:
      "radial-gradient(circle at top left, rgba(22,131,248,0.10), transparent 34%), radial-gradient(circle at top right, rgba(250,204,21,0.08), transparent 30%), #f8fafc",
    color: "#0f172a",
    boxSizing: "border-box",
    overflowX: "hidden",
  },

  hero: {
    position: "relative",
    display: "grid",
    gap: 22,
    padding: 30,
    borderRadius: 32,
    background:
      "radial-gradient(circle at bottom right, rgba(37,99,235,0.22), transparent 38%), linear-gradient(135deg, #020617 0%, #0f172a 55%, #172554 100%)",
    color: "#ffffff",
    marginBottom: 18,
    boxShadow: "0 24px 60px rgba(15,23,42,0.20)",
    overflow: "hidden",
    border: "1px solid rgba(148,163,184,0.22)",
  },

  heroGlow: {
    position: "absolute",
    inset: 0,
    pointerEvents: "none",
    background:
      "radial-gradient(circle at 18% 24%, rgba(255,255,255,0.07), transparent 28%)",
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

  heroCopy: {
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
    fontSize: "clamp(42px, 7vw, 72px)",
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
    gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
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

  heroPanelEyebrow: {
    color: "#facc15",
    fontSize: 12,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
  },

  heroPanelTitle: {
    margin: 0,
    color: "#ffffff",
    fontSize: 28,
    lineHeight: 1.05,
    letterSpacing: "-0.045em",
  },

  heroPanelList: {
    display: "grid",
    gap: 12,
  },

  heroPanelItem: {
    display: "grid",
    gap: 4,
    padding: 14,
    borderRadius: 18,
    background: "rgba(255,255,255,0.10)",
    border: "1px solid rgba(191,219,254,0.22)",
    color: "#dbeafe",
    lineHeight: 1.45,
  },

  heroActions: {
    position: "relative",
    zIndex: 1,
    display: "flex",
    justifyContent: "flex-start",
    gap: 12,
    flexWrap: "wrap",
    paddingTop: 16,
    borderTop: "1px solid rgba(148,163,184,0.24)",
  },

  adminReturnButton: {
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
  },

  featuredCard: {
    display: "grid",
    gridTemplateColumns: "minmax(280px, 0.9fr) minmax(0, 1.1fr)",
    gap: 18,
    padding: 20,
    borderRadius: 28,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    boxShadow: "0 14px 36px rgba(15,23,42,0.08)",
    marginBottom: 18,
    minWidth: 0,
    overflow: "hidden",
  },

  featuredImageWrap: {
    height: 320,
    borderRadius: 22,
    overflow: "hidden",
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
  },

  featuredContent: {
    display: "grid",
    gap: 14,
    alignContent: "center",
    minWidth: 0,
  },

  cardTopRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: 10,
    alignItems: "center",
    flexWrap: "wrap",
    minWidth: 0,
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
    padding: "8px 12px",
    borderRadius: 999,
    background: "#dcfce7",
    color: "#166534",
    border: "1px solid #bbf7d0",
    fontSize: 12,
    fontWeight: 950,
    whiteSpace: "nowrap",
  },

  featuredTitle: {
    margin: 0,
    color: "#0f172a",
    fontSize: "clamp(32px, 5vw, 52px)",
    lineHeight: 0.98,
    letterSpacing: "-0.06em",
    overflowWrap: "anywhere",
  },

  featuredText: {
    margin: 0,
    color: "#475569",
    lineHeight: 1.65,
    fontWeight: 750,
    overflowWrap: "anywhere",
  },

  campaignActions: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
    alignItems: "center",
  },

  primaryAction: {
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
    boxShadow: "0 10px 22px rgba(22,131,248,0.20)",
  },

  secondaryAction: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 44,
    padding: "11px 16px",
    borderRadius: 999,
    background: "#ffffff",
    color: "#0f172a",
    textDecoration: "none",
    fontWeight: 950,
    border: "1px solid #cbd5e1",
  },

  filtersCard: {
    display: "grid",
    gap: 14,
    padding: 18,
    borderRadius: 24,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    boxShadow: "0 2px 12px rgba(15,23,42,0.04)",
    marginBottom: 18,
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
    margin: "0 0 6px",
    color: "#2563eb",
    fontSize: 12,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
  },

  sectionTitle: {
    margin: 0,
    color: "#0f172a",
    fontSize: 28,
    letterSpacing: "-0.045em",
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
    whiteSpace: "nowrap",
  },

  filterNav: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
    alignItems: "center",
  },

  filterButton: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 40,
    padding: "9px 13px",
    borderRadius: 999,
    background: "#f8fafc",
    color: "#334155",
    border: "1px solid #e2e8f0",
    textDecoration: "none",
    fontSize: 13,
    fontWeight: 950,
  },

  filterButtonActive: {
    background: "#0f172a",
    color: "#ffffff",
    border: "1px solid #0f172a",
  },

  campaignGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: 16,
    minWidth: 0,
  },

  card: {
    display: "grid",
    gridTemplateRows: "220px 1fr",
    borderRadius: 26,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    overflow: "hidden",
    boxShadow: "0 2px 12px rgba(15,23,42,0.04)",
    minWidth: 0,
  },

  cardImageWrap: {
    width: "100%",
    height: 220,
    overflow: "hidden",
    background: "#f8fafc",
    borderBottom: "1px solid #e2e8f0",
  },

  cardBody: {
    display: "grid",
    gap: 12,
    alignContent: "start",
    padding: 16,
    minWidth: 0,
  },

  cardTitle: {
    margin: 0,
    color: "#0f172a",
    fontSize: 24,
    lineHeight: 1.05,
    letterSpacing: "-0.045em",
    overflowWrap: "anywhere",
  },

  cardText: {
    margin: 0,
    color: "#64748b",
    lineHeight: 1.55,
    fontWeight: 700,
    overflowWrap: "anywhere",
  },

  emptyCard: {
    gridColumn: "1 / -1",
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
};
