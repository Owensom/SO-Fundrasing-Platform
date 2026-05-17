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
    return { background: "#eff6ff", color: "#1d4ed8", borderColor: "#bfdbfe" };
  }

  if (type === "squares") {
    return { background: "#f5f3ff", color: "#6d28d9", borderColor: "#ddd6fe" };
  }

  if (type === "event") {
    return { background: "#ecfdf5", color: "#166534", borderColor: "#bbf7d0" };
  }

  return { background: "#fffbeb", color: "#92400e", borderColor: "#fde68a" };
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
  const canShowAdminReturn = isTenantAdmin;
  const adminReturn = canShowAdminReturn
    ? requestedAdminReturn || "/admin"
    : "";

  const activeType = getActiveType(resolvedSearchParams?.type);

  const campaigns: Campaign[] = await getAllCampaignsForTenant(tenantSlug);
  const tenantSettings = await getTenantSettings(tenantSlug);

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

  const featuredCampaign = publicCampaigns[0] || null;
  const campaignTypeNames = auctionCapability.allowed
    ? "raffles, squares, events and auctions"
    : "raffles, squares and events";

  return (
    <main className="campaigns-page" style={styles.page}>
      <style>{responsiveStyles}</style>

      <header className="topBar" style={styles.topBar}>
        <Link href={`/c/${tenantSlug}`} style={styles.logoLink}>
          <img
            src="/brand/so-logo-full.png"
            alt="SO Fundraising Platform"
            style={styles.logoImage}
          />
        </Link>

        <nav className="topNav" style={styles.topNav}>
          <Link href={`/c/${tenantSlug}/terms`} style={styles.topNavLink}>
            Terms of Use
          </Link>

          <Link href={`/c/${tenantSlug}/privacy`} style={styles.topNavLink}>
            Privacy Policy
          </Link>

          {canShowAdminReturn ? (
            <Link href={adminReturn} style={styles.adminBackTop}>
              <span style={styles.adminBackIcon}>↩</span>
              <span>Back to admin</span>
            </Link>
          ) : null}
        </nav>
      </header>

      <section className="hero" style={styles.hero}>
        <div style={styles.heroGlow} />

        <div style={styles.heroContent}>
          <div style={styles.badge}>SO Foundation Platform</div>

          <h1 className="so-brand-heading title" style={styles.title}>
            Support an active campaign
          </h1>

          <p style={styles.subtitle}>
            Choose from live {campaignTypeNames}. Every campaign helps raise
            funds and create impact.
          </p>

          <div className="heroActions" style={styles.heroActions}>
            <Link
              href={`/c/${tenantSlug}/terms`}
              style={styles.primaryHeroButton}
            >
              Terms of Use
            </Link>

            <Link
              href={`/c/${tenantSlug}/privacy`}
              style={styles.secondaryHeroButton}
            >
              Privacy Policy
            </Link>
          </div>
        </div>

        <div className="heroPanel" style={styles.heroPanel}>
          <div style={styles.heroPanelTitle}>Live now</div>

          <div className="heroStats" style={styles.heroStats}>
            <HeroStat label="Campaigns" value={publicCampaigns.length} />
            <HeroStat label="Raffles" value={raffles.length} />
            <HeroStat label="Squares" value={squares.length} />
            <HeroStat label="Events" value={events.length} />
            {auctionCapability.allowed ? (
              <HeroStat label="Auctions" value={auctions.length} />
            ) : null}
          </div>

          {featuredCampaign ? (
            <Link
              href={getCampaignUrl(featuredCampaign)}
              style={styles.featuredLink}
            >
              <span style={styles.featuredKicker}>Featured campaign</span>

              <strong>{featuredCampaign.title}</strong>

              <span>View campaign →</span>
            </Link>
          ) : null}
        </div>
      </section>
            {publicCampaigns.length === 0 ? (
        <section style={styles.emptyCard}>
          <h2 className="so-brand-card-title" style={styles.emptyTitle}>
            No active campaigns found
          </h2>

          <p style={styles.muted}>
            This organiser has no published campaigns at the moment.
          </p>
        </section>
      ) : (
        <>
          <section className="filterStrip" style={styles.filterStrip}>
            <span style={styles.filterLabel}>Browse live campaigns</span>

            <Link
              href={getFilterHref({
                tenantSlug,
                type: "all",
                adminReturn,
              })}
              scroll={false}
              aria-current={activeType === "all" ? "page" : undefined}
              style={{
                ...styles.filterPill,
                ...(activeType === "all" ? styles.filterPillActive : {}),
              }}
            >
              All {publicCampaigns.length}
            </Link>

            <Link
              href={getFilterHref({
                tenantSlug,
                type: "raffle",
                adminReturn,
              })}
              scroll={false}
              aria-current={activeType === "raffle" ? "page" : undefined}
              style={{
                ...styles.filterPill,
                ...(activeType === "raffle" ? styles.filterPillActive : {}),
              }}
            >
              Raffles {raffles.length}
            </Link>

            <Link
              href={getFilterHref({
                tenantSlug,
                type: "squares",
                adminReturn,
              })}
              scroll={false}
              aria-current={activeType === "squares" ? "page" : undefined}
              style={{
                ...styles.filterPill,
                ...(activeType === "squares" ? styles.filterPillActive : {}),
              }}
            >
              Squares {squares.length}
            </Link>

            <Link
              href={getFilterHref({
                tenantSlug,
                type: "event",
                adminReturn,
              })}
              scroll={false}
              aria-current={activeType === "event" ? "page" : undefined}
              style={{
                ...styles.filterPill,
                ...(activeType === "event" ? styles.filterPillActive : {}),
              }}
            >
              Events {events.length}
            </Link>

            {auctionCapability.allowed ? (
              <Link
                href={getFilterHref({
                  tenantSlug,
                  type: "auction",
                  adminReturn,
                })}
                scroll={false}
                aria-current={activeType === "auction" ? "page" : undefined}
                style={{
                  ...styles.filterPill,
                  ...(activeType === "auction"
                    ? styles.filterPillActive
                    : {}),
                }}
              >
                Auctions {auctions.length}
              </Link>
            ) : null}
          </section>

          {visibleCampaigns.length === 0 ? (
            <section style={styles.emptyCard}>
              <h2 className="so-brand-card-title" style={styles.emptyTitle}>
                No campaigns in this category
              </h2>

              <p style={styles.muted}>
                Try another campaign type or browse all live campaigns.
              </p>

              <Link
                href={getFilterHref({
                  tenantSlug,
                  type: "all",
                  adminReturn,
                })}
                style={styles.emptyButton}
              >
                Browse all campaigns
              </Link>
            </section>
          ) : (
            <section className="grid" style={styles.grid}>
              {visibleCampaigns.map((campaign) => (
                <Link
                  key={`${campaign.type}-${campaign.id}`}
                  href={getCampaignUrl(campaign)}
                  className="campaignCard"
                  style={styles.card}
                >
                  <div style={styles.imageWrap}>
                    <img
                      src={campaign.imageUrl || getDefaultImage(campaign.type)}
                      alt={campaign.title}
                      style={getImageStyle(campaign)}
                    />
                  </div>

                  <div style={styles.cardBody}>
                    <div style={styles.cardTopLine}>
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

                    <h2
                      className="so-brand-card-title"
                      style={styles.cardTitle}
                    >
                      {campaign.title}
                    </h2>

                    <div style={styles.metaLine}>
                      {getTypeMeta(campaign.type)}
                    </div>

                    {campaign.description ? (
                      <p style={styles.description}>
                        {campaign.description.length > 170
                          ? `${campaign.description.slice(0, 170)}…`
                          : campaign.description}
                      </p>
                    ) : (
                      <p style={styles.descriptionMuted}>
                        Open this campaign to view details and support the cause.
                      </p>
                    )}

                    <div style={styles.cardFooter}>
                      <span style={styles.button}>View campaign</span>

                      <span style={styles.cardHint}>Support now →</span>
                    </div>
                  </div>
                </Link>
              ))}
            </section>
          )}

          <section className="trustCard" style={styles.trustCard}>
            <div>
              <p style={styles.trustKicker}>Secure fundraising</p>

              <h2 className="so-brand-card-title" style={styles.trustTitle}>
                Choose a campaign and support in minutes.
              </h2>

              <p style={styles.trustText}>
                Payments and campaign activity are handled through the SO
                fundraising platform for this organiser.
              </p>
            </div>

            <div className="trustStats" style={styles.trustStats}>
              <TrustStat
                label="Live campaign types"
                value={pluralise(
                  [raffles, squares, events, auctions].filter(
                    (items) => items.length > 0,
                  ).length,
                  "type",
                  "types",
                )}
              />

              <TrustStat label="Campaign status" value="Published" />
            </div>
          </section>
        </>
      )}
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

function TrustStat({ label, value }: { label: string; value: string }) {
  return (
    <div style={styles.trustStat}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

const responsiveStyles = `
.campaigns-page,
.campaigns-page * {
  box-sizing: border-box;
}

.campaigns-page {
  overflow-x: hidden;
}

.campaigns-page section,
.campaigns-page div,
.campaigns-page article,
.campaigns-page a,
.campaigns-page header,
.campaigns-page nav {
  min-width: 0;
}

.campaigns-page .filterStrip a {
  text-decoration: none;
  touch-action: manipulation;
}

.campaigns-page .filterStrip a:hover,
.campaigns-page .adminBackTop:hover {
  transform: translateY(-1px);
}

.campaigns-page .campaignCard {
  transition:
    transform 180ms ease,
    box-shadow 180ms ease,
    border-color 180ms ease;
}

.campaigns-page .campaignCard:hover {
  transform: translateY(-3px);
  box-shadow: 0 18px 46px rgba(15,23,42,0.11) !important;
  border-color: #bfdbfe !important;
}

@media (max-width: 980px) {
  .campaigns-page .topBar {
    grid-template-columns: 1fr !important;
    justify-items: center !important;
    gap: 12px !important;
  }

  .campaigns-page .topNav {
    justify-content: center !important;
  }

  .campaigns-page .hero,
  .campaigns-page .trustCard {
    grid-template-columns: 1fr !important;
  }

  .campaigns-page .heroStats {
    grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
  }
}

@media (max-width: 720px) {
  .campaigns-page {
    padding: 0 10px 42px !important;
  }

  .campaigns-page .topBar {
    margin-left: -10px !important;
    margin-right: -10px !important;
    padding: 14px 14px !important;
  }

  .campaigns-page .logoImage {
    height: 46px !important;
  }

  .campaigns-page .topNav {
    width: 100% !important;
    gap: 8px !important;
    overflow-x: auto !important;
    flex-wrap: nowrap !important;
    justify-content: flex-start !important;
    -webkit-overflow-scrolling: touch !important;
    scrollbar-width: none !important;
  }

  .campaigns-page .topNav::-webkit-scrollbar {
    display: none !important;
  }

  .campaigns-page .topNavLink,
  .campaigns-page .adminBackTop {
    flex: 0 0 auto !important;
  }
    .campaigns-page .hero {
    margin-top: 14px !important;
    padding: 20px !important;
    border-radius: 26px !important;
  }

  .campaigns-page .title {
    font-size: clamp(38px, 12vw, 54px) !important;
    line-height: 0.98 !important;
  }

  .campaigns-page .heroActions,
  .campaigns-page .trustStats {
    display: grid !important;
    grid-template-columns: 1fr !important;
  }

  .campaigns-page .primaryHeroButton,
  .campaigns-page .secondaryHeroButton {
    width: 100% !important;
    justify-content: center !important;
  }

  .campaigns-page .heroStats,
  .campaigns-page .grid {
    grid-template-columns: 1fr !important;
  }

  .campaigns-page .filterStrip {
    overflow-x: auto !important;
    flex-wrap: nowrap !important;
    -webkit-overflow-scrolling: touch !important;
    scrollbar-width: none !important;
  }

  .campaigns-page .filterStrip::-webkit-scrollbar {
    display: none !important;
  }
}
`;

const styles: Record<string, CSSProperties> = {
  page: {
    minHeight: "100vh",
    background:
      "radial-gradient(circle at top left, rgba(22,131,248,0.08), transparent 28%), radial-gradient(circle at top right, rgba(15,23,42,0.06), transparent 30%), linear-gradient(180deg, #f8fafc 0%, #eef6ff 100%)",
    padding: "0 16px 64px",
    color: "#0f172a",
  },

  topBar: {
    maxWidth: "none",
    margin: "0 -16px 24px",
    padding: "18px 56px",
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) auto",
    alignItems: "center",
    gap: 18,
    background: "#ffffff",
    borderBottom: "1px solid #e2e8f0",
    boxShadow: "0 10px 30px rgba(15,23,42,0.045)",
  },

  logoLink: {
    display: "inline-flex",
    alignItems: "center",
    width: "fit-content",
    textDecoration: "none",
  },

  logoImage: {
    height: 56,
    width: "auto",
    display: "block",
  },

  topNav: {
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 24,
    flexWrap: "wrap",
  },

  topNavLink: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 42,
    color: "#0f172a",
    textDecoration: "none",
    fontWeight: 950,
    fontSize: 14,
    whiteSpace: "nowrap",
  },

  adminBackTop: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    minHeight: 44,
    padding: "10px 15px",
    borderRadius: 999,
    background: "#ffffff",
    color: "#78350f",
    border: "1px solid rgba(217,119,6,0.62)",
    textDecoration: "none",
    fontWeight: 950,
    fontSize: 14,
    whiteSpace: "nowrap",
    boxShadow: "0 10px 22px rgba(15,23,42,0.045)",
    transition:
      "transform 180ms ease, border-color 180ms ease, box-shadow 180ms ease",
  },

  adminBackIcon: {
    color: "#d97706",
    fontWeight: 950,
  },

  hero: {
    position: "relative",
    maxWidth: 1180,
    margin: "0 auto 18px",
    display: "grid",
    gridTemplateColumns: "minmax(0, 1.2fr) minmax(300px, 0.8fr)",
    gap: 22,
    padding: 30,
    borderRadius: 34,
    background:
      "radial-gradient(circle at bottom right, rgba(37,99,235,0.20), transparent 38%), linear-gradient(135deg, #020617 0%, #0f172a 54%, #172554 100%)",
    color: "#ffffff",
    boxShadow: "0 28px 70px rgba(15,23,42,0.20)",
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

  heroContent: {
    position: "relative",
    zIndex: 1,
    minWidth: 0,
  },

  badge: {
    display: "inline-flex",
    padding: "8px 14px",
    borderRadius: 999,
    background: "rgba(15,23,42,0.24)",
    color: "#facc15",
    border: "1px solid rgba(250,204,21,0.76)",
    fontSize: 12,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    marginBottom: 16,
    boxShadow: "0 12px 28px rgba(0,0,0,0.12)",
  },

  title: {
    margin: 0,
    fontSize: "clamp(48px, 7vw, 74px)",
    lineHeight: 0.94,
    letterSpacing: "-0.075em",
    overflowWrap: "anywhere",
    textShadow: "0 18px 45px rgba(0,0,0,0.22)",
  },

  subtitle: {
    margin: "18px 0 0",
    maxWidth: 760,
    color: "#dbeafe",
    fontSize: 18,
    lineHeight: 1.6,
    fontWeight: 700,
  },

  heroActions: {
    marginTop: 24,
    display: "flex",
    flexWrap: "wrap",
    gap: 10,
  },

  primaryHeroButton: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 44,
    padding: "11px 16px",
    borderRadius: 999,
    background: "linear-gradient(135deg, #facc15 0%, #f59e0b 100%)",
    color: "#111827",
    border: "1px solid rgba(251,191,36,0.72)",
    textDecoration: "none",
    fontWeight: 950,
    boxShadow: "0 14px 28px rgba(251,191,36,0.18)",
  },

  secondaryHeroButton: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 44,
    padding: "11px 16px",
    borderRadius: 999,
    background: "rgba(255,255,255,0.06)",
    color: "#ffffff",
    border: "1px solid rgba(148,163,184,0.52)",
    textDecoration: "none",
    fontWeight: 950,
    backdropFilter: "blur(10px)",
  },

  heroPanel: {
    position: "relative",
    zIndex: 1,
    display: "grid",
    gap: 16,
    padding: 18,
    borderRadius: 26,
    background: "rgba(255,255,255,0.08)",
    border: "1px solid rgba(148,163,184,0.26)",
    alignContent: "start",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.10)",
    backdropFilter: "blur(12px)",
  },

  heroPanelTitle: {
    fontSize: 24,
    fontWeight: 950,
    letterSpacing: "-0.04em",
  },

  heroStats: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 10,
  },

  heroStat: {
    display: "grid",
    gap: 4,
    padding: 13,
    borderRadius: 18,
    background: "rgba(255,255,255,0.09)",
    border: "1px solid rgba(148,163,184,0.25)",
  },

  featuredLink: {
    display: "grid",
    gap: 5,
    padding: 14,
    borderRadius: 18,
    background: "#ffffff",
    color: "#0f172a",
    textDecoration: "none",
    fontWeight: 900,
    border: "1px solid rgba(217,119,6,0.44)",
  },

  featuredKicker: {
    color: "#b45309",
    fontSize: 12,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
  },

  filterStrip: {
    maxWidth: 1180,
    margin: "0 auto 18px",
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
    alignItems: "center",
    padding: 12,
    borderRadius: 22,
    background: "#ffffff",
    border: "1px solid #dbeafe",
    boxShadow: "0 8px 30px rgba(15,23,42,0.045)",
  },

  filterLabel: {
    color: "#0f172a",
    fontSize: 13,
    fontWeight: 950,
    marginRight: 4,
    whiteSpace: "nowrap",
  },

  filterPill: {
    display: "inline-flex",
    padding: "8px 11px",
    borderRadius: 999,
    background: "#f8fafc",
    color: "#334155",
    border: "1px solid #e2e8f0",
    fontSize: 12,
    fontWeight: 900,
    whiteSpace: "nowrap",
    textDecoration: "none",
    transition:
      "transform 180ms ease, background 180ms ease, color 180ms ease, border-color 180ms ease, box-shadow 180ms ease",
  },

  filterPillActive: {
    background: "#0f172a",
    color: "#ffffff",
    borderColor: "rgba(250,204,21,0.78)",
    boxShadow: "0 10px 22px rgba(15,23,42,0.16)",
  },

  grid: {
    maxWidth: 1180,
    margin: "0 auto",
    display: "grid",
    gap: 18,
    gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 330px), 1fr))",
  },

  card: {
    display: "grid",
    gridTemplateRows: "auto 1fr",
    gap: 16,
    padding: 16,
    borderRadius: 28,
    border: "1px solid #dbeafe",
    background: "#ffffff",
    textDecoration: "none",
    color: "#111827",
    boxShadow: "0 14px 38px rgba(15,23,42,0.075)",
    minHeight: 460,
  },

  imageWrap: {
    height: 214,
    borderRadius: 22,
    overflow: "hidden",
    background: "#f1f5f9",
    border: "1px solid #dbeafe",
    boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.7)",
  },

  cardBody: {
    display: "grid",
    gap: 9,
    alignContent: "start",
    minWidth: 0,
  },

  cardTopLine: {
    display: "flex",
    justifyContent: "space-between",
    gap: 8,
    flexWrap: "wrap",
    alignItems: "center",
  },

  typePill: {
    width: "fit-content",
    padding: "6px 10px",
    borderRadius: 999,
    border: "1px solid",
    fontSize: 12,
    fontWeight: 950,
  },

  statusPill: {
    width: "fit-content",
    padding: "6px 10px",
    borderRadius: 999,
    border: "1px solid #bbf7d0",
    background: "#dcfce7",
    color: "#166534",
    fontSize: 12,
    fontWeight: 950,
  },

  cardTitle: {
    margin: 0,
    fontSize: 28,
    lineHeight: 1.08,
    color: "#0f172a",
    letterSpacing: "-0.045em",
    overflowWrap: "anywhere",
  },

  metaLine: {
    color: "#334155",
    fontSize: 14,
    fontWeight: 950,
  },

  description: {
    margin: 0,
    color: "#64748b",
    lineHeight: 1.55,
    fontWeight: 700,
    overflowWrap: "anywhere",
  },

  descriptionMuted: {
    margin: 0,
    color: "#64748b",
    lineHeight: 1.55,
    fontWeight: 700,
  },

  cardFooter: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
    flexWrap: "wrap",
    marginTop: 8,
  },

  button: {
    display: "inline-flex",
    width: "fit-content",
    padding: "12px 16px",
    borderRadius: 999,
    background: "#1683f8",
    color: "#ffffff",
    fontWeight: 950,
    boxShadow: "0 10px 20px rgba(22,131,248,0.18)",
  },

  cardHint: {
    color: "#2563eb",
    fontSize: 13,
    fontWeight: 950,
  },

  trustCard: {
    maxWidth: 1180,
    margin: "20px auto 0",
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) minmax(260px, 0.5fr)",
    gap: 18,
    padding: 24,
    borderRadius: 28,
    background: "#ffffff",
    border: "1px solid #dbeafe",
    boxShadow: "0 12px 34px rgba(15,23,42,0.055)",
  },

  trustKicker: {
    margin: "0 0 7px",
    color: "#2563eb",
    fontSize: 12,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
  },

  trustTitle: {
    margin: 0,
    color: "#0f172a",
    fontSize: 30,
    letterSpacing: "-0.05em",
  },

  trustText: {
    margin: "8px 0 0",
    color: "#64748b",
    lineHeight: 1.6,
    fontWeight: 700,
  },

  trustStats: {
    display: "grid",
    gridTemplateColumns: "1fr",
    gap: 10,
  },

  trustStat: {
    display: "grid",
    gap: 5,
    padding: 15,
    borderRadius: 18,
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
  },

  emptyCard: {
    maxWidth: 1180,
    margin: "0 auto",
    padding: 28,
    borderRadius: 26,
    background: "#ffffff",
    border: "1px solid #dbeafe",
    boxShadow: "0 12px 34px rgba(15,23,42,0.055)",
  },

  emptyTitle: {
    margin: 0,
    color: "#0f172a",
    fontSize: 28,
  },

  muted: {
    color: "#64748b",
    lineHeight: 1.55,
    fontWeight: 700,
  },

  emptyButton: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 14,
    minHeight: 44,
    padding: "11px 16px",
    borderRadius: 999,
    background: "#1683f8",
    color: "#ffffff",
    textDecoration: "none",
    fontWeight: 950,
    boxShadow: "0 10px 20px rgba(22,131,248,0.18)",
  },
};
