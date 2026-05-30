import type { CSSProperties } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/auth";
import { getAllCampaignsForTenant } from "@/lib/campaigns";
import { getTenantSlugFromHeaders } from "@/lib/tenant";
import { getTenantSettings } from "@/lib/tenant-settings";
import {
  checkSubscriptionCapability,
  normaliseSubscriptionTier,
} from "@/lib/subscription-capabilities";
import CampaignShareKitClient, {
  type ShareKitBranding,
  type ShareKitCampaign,
  type ShareKitCampaignType,
} from "@/components/admin/CampaignShareKitClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type CampaignType = "raffle" | "squares" | "event" | "auction";

type Campaign = {
  id: string;
  type: CampaignType;
  title: string;
  slug: string;
  description?: string | null;
  status: "draft" | "published" | "closed" | "drawn";
};

type TenantShareSettings = {
  subscription_tier?: string | null;
  subscription_status?: string | null;
  platform_owner_bypass?: boolean | null;
  public_display_name?: string | null;
  public_tagline?: string | null;
  public_logo_url?: string | null;
  public_logo_mark_url?: string | null;
  public_primary_colour?: string | null;
  public_accent_colour?: string | null;
};

type AdminSession = {
  user?: {
    tenantSlugs?: unknown;
  } | null;
} | null;

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

function isShareKitCampaignType(value: unknown): value is ShareKitCampaignType {
  return (
    value === "raffle" ||
    value === "squares" ||
    value === "event" ||
    value === "auction"
  );
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

async function getAppBaseUrl() {
  const headerStore = await headers();
  const host = headerStore.get("host") || "";
  const protocol = host.includes("localhost") ? "http" : "https";

  const configured =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.VERCEL_PROJECT_PRODUCTION_URL ||
    "";

  if (configured) {
    return configured.startsWith("http") ? configured : `https://${configured}`;
  }

  return `${protocol}://${host}`;
}

function getSessionTenantSlugs(session: AdminSession) {
  return Array.isArray(session?.user?.tenantSlugs)
    ? session.user.tenantSlugs.map((value) => String(value))
    : [];
}

export default async function AdminSharePage() {
  const session = (await auth()) as AdminSession;

  if (!session?.user) {
    redirect("/admin/login");
  }

  const tenantSlug = await getTenantSlugFromHeaders();
  const sessionTenantSlugs = getSessionTenantSlugs(session);

  if (!tenantSlug || !sessionTenantSlugs.includes(tenantSlug)) {
    redirect("/admin/login?error=tenant_access_denied");
  }

  const [campaignsRaw, tenantSettingsRaw, appBaseUrl] = await Promise.all([
    getAllCampaignsForTenant(tenantSlug),
    getTenantSettings(tenantSlug),
    getAppBaseUrl(),
  ]);

  const tenantSettings = tenantSettingsRaw as TenantShareSettings | null;

  const subscriptionTier = normaliseSubscriptionTier(
    tenantSettings?.subscription_tier,
  );

  const subscriptionTenant = {
    subscription_tier: subscriptionTier,
    subscription_status:
      cleanText(tenantSettings?.subscription_status, "active") || "active",
    platform_owner_bypass: Boolean(tenantSettings?.platform_owner_bypass),
  };

  const auctionCapability = checkSubscriptionCapability(
    subscriptionTenant,
    "auctions",
  );

  const liveCampaigns = (campaignsRaw as Campaign[])
    .filter((campaign) => campaign.status === "published")
    .filter((campaign) => {
      if (campaign.type === "auction" && !auctionCapability.allowed) {
        return false;
      }

      return isShareKitCampaignType(campaign.type);
    });

  const campaigns: ShareKitCampaign[] = liveCampaigns.map((campaign) => ({
    id: campaign.id,
    type: campaign.type,
    title: campaign.title,
    slug: campaign.slug,
    description: cleanText(campaign.description),
    publicUrl: getCampaignUrl(campaign),
    supportUrl: getSupportUrl({ tenantSlug, campaign }),
  }));

  const branding: ShareKitBranding = {
    tenantSlug,
    displayName:
      cleanText(tenantSettings?.public_display_name) ||
      "SO Fundraising Platform",
    tagline:
      cleanText(tenantSettings?.public_tagline) ||
      "Supporting causes through premium fundraising campaigns.",
    primaryColour: normaliseHexColour(
      tenantSettings?.public_primary_colour,
      "#1683F8",
    ),
    accentColour: normaliseHexColour(
      tenantSettings?.public_accent_colour,
      "#FACC15",
    ),
    logoUrl: cleanText(tenantSettings?.public_logo_url),
    logoMarkUrl: cleanText(tenantSettings?.public_logo_mark_url),
    platformLogoUrl: "/brand/so-logo-mark.png",
  };

  return (
    <main className="admin-share-page" style={styles.page}>
      <style>{responsiveStyles}</style>

      <section className="share-hero" style={styles.hero}>
        <div style={styles.heroContent}>
          <Link href="/admin" style={styles.backLink}>
            ← Back to dashboard
          </Link>

          <div style={styles.badgeRow}>
            <span style={styles.badge}>Campaign Share Kit</span>
            <span style={styles.softBadge}>Social-ready assets</span>
          </div>

          <h1 className="so-brand-heading share-title" style={styles.title}>
            Share campaigns faster
          </h1>

          <p style={styles.subtitle}>
            Create public hub links, campaign links, donation links, ready-made
            captions and branded PNG cards for social posts, WhatsApp, email and
            printed promotion.
          </p>

          <p style={styles.tenantLine}>
            Tenant: <strong>{tenantSlug}</strong>
          </p>
        </div>

        <div className="share-hero-stats" style={styles.heroStats}>
          <StatCard label="Active campaigns" value={campaigns.length} dark />
          <StatCard label="Public hub" value="Share" dark />
          <StatCard label="Campaign link" value="Copy" dark />
          <StatCard label="PNG card" value="Download" dark />
        </div>
      </section>

      <section className="share-info-grid" style={styles.infoGrid}>
        <InfoCard
          title="Share the public hub"
          text="Promote the tenant’s main public campaign page when you want supporters to browse every active campaign in one place."
        />

        <InfoCard
          title="Share one campaign"
          text="Choose any active campaign and copy the public campaign link, donation link and suggested caption."
        />

        <InfoCard
          title="Download a branded card"
          text="Create a premium PNG share card using tenant branding first, with platform branding as the fallback."
        />
      </section>

      <CampaignShareKitClient
        campaigns={campaigns}
        branding={branding}
        appBaseUrl={appBaseUrl}
      />
    </main>
  );
}

function StatCard({
  label,
  value,
  dark = false,
}: {
  label: string;
  value: string | number;
  dark?: boolean;
}) {
  return (
    <div style={dark ? styles.darkStatCard : styles.statCard}>
      <div style={dark ? styles.darkStatLabel : styles.statLabel}>{label}</div>
      <div style={dark ? styles.darkStatValue : styles.statValue}>{value}</div>
    </div>
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

const responsiveStyles = `
.admin-share-page,
.admin-share-page * {
  box-sizing: border-box;
}

.admin-share-page {
  overflow-x: hidden;
}

.admin-share-page section,
.admin-share-page article,
.admin-share-page div,
.admin-share-page a,
.admin-share-page select,
.admin-share-page button,
.admin-share-page pre {
  min-width: 0;
}

@media (max-width: 1040px) {
  .admin-share-page .share-hero {
    grid-template-columns: 1fr !important;
  }

  .admin-share-page .share-hero-stats,
  .admin-share-page .share-info-grid,
  .admin-share-page .share-kit-grid,
  .admin-share-page .share-selector-panel {
    grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
  }
}

@media (max-width: 720px) {
  .admin-share-page {
    padding: 18px 12px 44px !important;
  }

  .admin-share-page .share-hero {
    padding: 22px !important;
    border-radius: 28px !important;
  }

  .admin-share-page .share-title {
    font-size: clamp(40px, 12vw, 58px) !important;
    line-height: 0.98 !important;
  }

  .admin-share-page .share-hero-stats,
  .admin-share-page .share-info-grid,
  .admin-share-page .share-kit-grid,
  .admin-share-page .share-selector-panel {
    grid-template-columns: 1fr !important;
  }

  .admin-share-page .share-public-hub-panel,
  .admin-share-page .share-selector-panel {
    padding: 18px !important;
    border-radius: 24px !important;
  }

  .admin-share-page .share-preview-actions,
  .admin-share-page .share-hub-actions {
    grid-template-columns: 1fr !important;
  }

  .admin-share-page button,
  .admin-share-page a {
    width: 100% !important;
  }

  .admin-share-page p,
  .admin-share-page h1,
  .admin-share-page h2,
  .admin-share-page h3,
  .admin-share-page strong,
  .admin-share-page span,
  .admin-share-page pre {
    overflow-wrap: anywhere !important;
    word-break: break-word !important;
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
    boxSizing: "border-box",
    overflowX: "hidden",
  },

  hero: {
    position: "relative",
    display: "grid",
    gridTemplateColumns: "minmax(0, 1.18fr) minmax(300px, 0.82fr)",
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
    maxWidth: "100%",
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
    minWidth: 0,
  },

  infoTitle: {
    margin: 0,
    color: "#0f172a",
    fontSize: 20,
    lineHeight: 1.12,
    letterSpacing: "-0.035em",
    overflowWrap: "anywhere",
  },

  infoText: {
    margin: 0,
    color: "#64748b",
    lineHeight: 1.5,
    fontSize: 14,
    fontWeight: 750,
    overflowWrap: "anywhere",
  },
};
