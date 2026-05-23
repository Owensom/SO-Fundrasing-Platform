import type { CSSProperties, ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { headers, cookies } from "next/headers";
import { auth } from "@/auth";
import { getTenantSlugFromHeaders } from "@/lib/tenant";
import { getTenantSettings } from "@/lib/tenant-settings";
import {
  checkSubscriptionCapability,
  getTierLabel,
  getTierPlatformFeePercent,
  normaliseSubscriptionTier,
} from "@/lib/subscription-capabilities";
import { listSquaresGames } from "../../../api/_lib/squares-repo";
import { listEvents } from "../../../api/_lib/events-repo";
import { listAuctions } from "../../../api/_lib/auctions-repo";

type RaffleItem = {
  id: string;
  status: string;
  currency: string;
  ticket_price: number;
  total_tickets: number;
  sold_tickets: number;
  remaining_tickets: number;
};

type ApiResponse = {
  ok: boolean;
  items?: RaffleItem[];
  error?: string;
};

type TenantBillingLike = {
  subscription_tier?: string | null;
  subscription_status?: string | null;
  platform_owner_bypass?: boolean | null;
  platform_fee_percent?: number | null;
};

async function getAdminRaffles(): Promise<RaffleItem[]> {
  try {
    const headerStore = await headers();
    const cookieStore = await cookies();

    const host = headerStore.get("host") || "";
    const protocol = host.includes("localhost") ? "http" : "https";

    const cookieHeader = cookieStore
      .getAll()
      .map((cookie) => `${cookie.name}=${cookie.value}`)
      .join("; ");

    const res = await fetch(`${protocol}://${host}/api/admin/raffles`, {
      cache: "no-store",
      headers: {
        cookie: cookieHeader,
      },
    });

    if (!res.ok) return [];

    const data = (await res.json()) as ApiResponse;

    if (!data.ok || !data.items) return [];

    return data.items;
  } catch {
    return [];
  }
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

function formatPercent(value: number) {
  if (!Number.isFinite(value)) return "0%";

  return `${Number(value).toLocaleString("en-GB", {
    maximumFractionDigits: 2,
  })}%`;
}

export default async function AdminDashboardPage() {
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

  const publicCampaignsHref = `/c/${tenantSlug}?adminReturn=${encodeURIComponent(
    "/admin",
  )}`;

  const [raffles, squares, events, auctions, tenantSettingsRaw] =
    await Promise.all([
      getAdminRaffles(),
      listSquaresGames(tenantSlug),
      listEvents(tenantSlug),
      listAuctions(tenantSlug),
      getTenantSettings(tenantSlug),
    ]);

  const tenantSettings = tenantSettingsRaw as TenantBillingLike | null;

  const subscriptionTier = normaliseSubscriptionTier(
    tenantSettings?.subscription_tier,
  );

  const subscriptionStatus =
    tenantSettings?.subscription_status?.trim() || "active";

  const platformFeePercent = Number.isFinite(
    Number(tenantSettings?.platform_fee_percent),
  )
    ? Number(tenantSettings?.platform_fee_percent)
    : getTierPlatformFeePercent(subscriptionTier);

  const subscriptionTenant = {
    subscription_tier: subscriptionTier,
    subscription_status: subscriptionStatus,
    platform_owner_bypass: Boolean(tenantSettings?.platform_owner_bypass),
  };

  const auctionCapability = checkSubscriptionCapability(
    subscriptionTenant,
    "auctions",
  );

  const brandingCapability = checkSubscriptionCapability(
    subscriptionTenant,
    "advanced_branding",
  );

  const customDomainCapability = checkSubscriptionCapability(
    subscriptionTenant,
    "custom_domain",
  );

  const publishedRaffles = raffles.filter(
    (item) => item.status === "published",
  );

  const publishedSquares = squares.filter(
    (item) => item.status === "published",
  );

  const publishedEvents = events.filter((item) => item.status === "published");

  const publishedAuctions = auctions.filter(
    (item) => item.status === "published",
  );

  const raffleRevenueCents = raffles.reduce(
    (sum, raffle) =>
      sum +
      Number(raffle.sold_tickets || 0) * Number(raffle.ticket_price || 0),
    0,
  );

  const squaresSold = squares.reduce((sum, game) => {
    const sold = Array.isArray(game.config_json?.sold)
      ? game.config_json.sold.length
      : 0;

    return sum + sold;
  }, 0);

  const squaresRevenueCents = squares.reduce((sum, game) => {
    const sold = Array.isArray(game.config_json?.sold)
      ? game.config_json.sold.length
      : 0;

    return sum + sold * Number(game.price_per_square_cents || 0);
  }, 0);

  const totalRaffleTicketsSold = raffles.reduce(
    (sum, raffle) => sum + Number(raffle.sold_tickets || 0),
    0,
  );

  const totalRaffleTicketsRemaining = raffles.reduce(
    (sum, raffle) => sum + Number(raffle.remaining_tickets || 0),
    0,
  );

  const totalCampaigns =
    raffles.length + squares.length + events.length + auctions.length;

  const totalPublishedCampaigns =
    publishedRaffles.length +
    publishedSquares.length +
    publishedEvents.length +
    publishedAuctions.length;

  const combinedEstimatedRevenueCents =
    raffleRevenueCents + squaresRevenueCents;

  return (
    <main className="admin-dashboard-page" style={styles.page}>
      <style>{responsiveStyles}</style>

      <section className="admin-command-centre" style={styles.commandCentre}>
        <div style={styles.heroGlow} />

        <div style={styles.commandContent}>
          <div style={styles.badge}>SO Foundation Platform</div>

          <h1
            className="so-brand-heading admin-dashboard-title"
            style={styles.title}
          >
            Admin command centre
          </h1>

          <p className="admin-dashboard-subtitle" style={styles.subtitle}>
            Manage campaigns, payments, supporters and operations across one
            premium fundraising workspace.
          </p>

          <p className="admin-dashboard-tenant" style={styles.tenant}>
            Tenant: <strong>{tenantSlug}</strong>
          </p>
        </div>

        <div className="admin-command-stats" style={styles.commandStats}>
          <StatCard label="Total campaigns" value={totalCampaigns} dark />

          <StatCard label="Published" value={totalPublishedCampaigns} dark />

          <StatCard
            label="Tracked estimate"
            value={formatMoney(combinedEstimatedRevenueCents)}
            dark
          />

          <StatCard
            label="Current plan"
            value={getTierLabel(subscriptionTier)}
            dark
          />

          <StatCard
            label="Platform fee"
            value={formatPercent(platformFeePercent)}
            dark
          />
        </div>

        <div className="admin-command-actions" style={styles.commandActions}>
          <Link
            href={publicCampaignsHref}
            target="_blank"
            className="primaryButton"
            style={styles.primaryButton}
          >
            View public →
          </Link>

          <Link
            href="/admin/settings/public-hub"
            className="secondaryButton"
            style={styles.secondaryButton}
          >
            Public Hub →
          </Link>

          <Link
            href="/admin/settings/branding"
            className="secondaryButton"
            style={styles.secondaryButton}
          >
            Branding →
          </Link>

          <Link
            href="/admin/orders"
            className="secondaryButton"
            style={styles.secondaryButton}
          >
            Orders →
          </Link>

          <Link
            href="/admin/donations"
            className="secondaryButton"
            style={styles.secondaryButton}
          >
            Donations →
          </Link>

          <Link
            href="/admin/support"
            className="secondaryButton"
            style={styles.secondaryButton}
          >
            Help & Support →
          </Link>

          <Link
            href="/admin/customers"
            className="secondaryButton"
            style={styles.secondaryButton}
          >
            Customers →
          </Link>

          <Link
            href="/admin/metadata"
            className="secondaryButton"
            style={styles.secondaryButton}
          >
            Finance →
          </Link>

          <Link
            href="/admin/settings/billing"
            className="secondaryButton"
            style={styles.secondaryButton}
          >
            Billing →
          </Link>
        </div>
      </section>

      <section className="admin-plan-panel" style={styles.planPanel}>
        <div>
          <p style={styles.planKicker}>Subscription status</p>

          <h2
            className="so-brand-card-title admin-section-title"
            style={styles.planTitle}
          >
            {getTierLabel(subscriptionTier)} plan
          </h2>

          <p style={styles.planText}>
            This dashboard now understands the tenant plan and can show
            upgrade-only features without blocking routes yet.
          </p>
        </div>

        <div className="admin-plan-grid" style={styles.planGrid}>
          <PlanFeature label="Raffles" included text="Included on all plans" />

          <PlanFeature label="Squares" included text="Included on all plans" />

          <PlanFeature label="Events" included text="Included on all plans" />

          <PlanFeature
            label="Auctions"
            included={auctionCapability.allowed}
            text={
              auctionCapability.allowed
                ? "Included on this plan"
                : "Professional required"
            }
          />

          <PlanFeature
            label="Advanced branding"
            included={brandingCapability.allowed}
            text={
              brandingCapability.allowed
                ? "Included on this plan"
                : "Professional required"
            }
          />

          <PlanFeature
            label="Custom domains"
            included={customDomainCapability.allowed}
            text={
              customDomainCapability.allowed
                ? "Foundation required"
                : "Foundation required"
            }
          />
        </div>
      </section>

      <section className="admin-focus-grid" style={styles.focusGrid}>
        <FocusCard
          label="Raffle tickets sold"
          value={totalRaffleTicketsSold}
          text={`${totalRaffleTicketsRemaining} raffle tickets remaining`}
        />

        <FocusCard
          label="Squares sold"
          value={squaresSold}
          text="Across all active squares campaigns"
        />

        <FocusCard
          label="Published events"
          value={publishedEvents.length}
          text={`${events.length} total events created`}
        />

        <FocusCard
          label="Active auctions"
          value={publishedAuctions.length}
          text={`${auctions.length} total auctions created`}
        />

        <FocusCard
          label="Published campaigns"
          value={totalPublishedCampaigns}
          text={`${totalCampaigns} total campaigns created`}
        />
      </section>

      <section style={styles.sectionHeader}>
        <div>
          <p style={styles.kicker}>Main workspaces</p>

          <h2
            className="so-brand-card-title admin-section-title"
            style={styles.sectionTitle}
          >
            Open a fundraising area
          </h2>

          <p style={styles.sectionText}>
            Choose the campaign type or operational dashboard you want to
            manage. Locked labels are visual only at this stage.
          </p>
        </div>
      </section>

      <section className="admin-cards-grid" style={styles.cardsGrid}>
        <DashboardCard
          href="/admin/raffles"
          image="/brand/so-default-raffles.png"
          title="Raffles"
          description="Create, manage and draw fundraising raffles."
          stats={`${raffles.length} total · ${publishedRaffles.length} published`}
        />

        <DashboardCard
          href="/admin/squares"
          image="/brand/so-default-squares.png"
          title="Squares"
          description="Run football cards and live squares competitions."
          stats={`${squares.length} total · ${publishedSquares.length} published`}
        />

        <DashboardCard
          href="/admin/events"
          image="/brand/so-default-events.png"
          title="Events"
          description="Manage seating plans, ticketing and guest experiences."
          stats={`${events.length} total · ${publishedEvents.length} published`}
        />

        <DashboardCard
          href="/admin/auctions"
          image="/brand/so-default-auctions.png"
          title="Auctions"
          description="Run premium auction fundraising campaigns."
          stats={`${auctions.length} total · ${publishedAuctions.length} published`}
          locked={!auctionCapability.allowed}
          lockText="Professional required"
        />

        <DashboardCard
          href="/admin/settings/public-hub"
          badgeText="HUB"
          title="Public Hub"
          description="Choose the highlighted campaign shown on the public campaign hub."
          stats="Featured campaign settings"
          tone="blue"
          compact
        />

        <DashboardCard
          href="/admin/settings/branding"
          badgeText="BRAND"
          title="Branding"
          description="Manage public display name, logos, colours and tenant-facing brand settings."
          stats={
            brandingCapability.allowed ||
            Boolean(tenantSettings?.platform_owner_bypass)
              ? "Advanced branding available"
              : "Basic branding settings"
          }
          tone="gold"
          compact
        />

        <DashboardCard
          href="/admin/orders"
          badgeText="ORDERS"
          title="Orders"
          description="Review raffle sales, squares sales, event orders and auction bids."
          stats="Unified activity dashboard"
          tone="blue"
          compact
        />

        <DashboardCard
          href="/admin/donations"
          badgeText="GIFT"
          title="Donations & Gift Aid"
          description="Review pure donations, donor details, payment status and Gift Aid declarations."
          stats="Donation reporting"
          tone="gold"
          compact
        />

        <DashboardCard
          href="/admin/support"
          badgeText="HELP"
          title="Help & Support"
          description="Report a problem, ask for help and send tenant context to platform support."
          stats="Support requests"
          tone="blue"
          compact
        />

        <DashboardCard
          href="/admin/customers"
          badgeText="CRM"
          title="Customers"
          description="View supporter profiles grouped from orders and campaign activity."
          stats="Supporter intelligence"
          tone="gold"
          compact
        />

        <DashboardCard
          href="/admin/metadata"
          badgeText="FEES"
          title="Finance"
          description="Review payment metadata, platform fees, Stripe fees, commission and organiser net estimates."
          stats="Money breakdown"
          tone="gold"
          compact
        />

        <DashboardCard
          href="/admin/settings/billing"
          badgeText="PLAN"
          title="Billing"
          description="View subscription tier, platform commission, enabled capabilities and Stripe billing readiness."
          stats="Subscription settings"
          tone="blue"
          compact
        />
      </section>

      <section className="admin-operations-grid" style={styles.operationsGrid}>
        <section className="admin-finance-panel" style={styles.financePanel}>
          <div>
            <p style={styles.financeKicker}>Finance & transactions</p>

            <h2
              className="so-brand-card-title admin-section-title"
              style={styles.financeTitle}
            >
              Money breakdown
            </h2>

            <p style={styles.financeText}>
              Review payment metadata, Stripe fees, platform contribution,
              supporter details and organiser net estimates from one clean
              operations panel.
            </p>
          </div>

          <div className="admin-panel-actions" style={styles.panelActions}>
            <Link
              href="/admin/metadata"
              className="financeButton"
              style={styles.financeButton}
            >
              Open finance →
            </Link>

            <Link
              href="/admin/settings/public-hub"
              className="financeButtonSecondary"
              style={styles.financeButtonSecondary}
            >
              Public Hub →
            </Link>

            <Link
              href="/admin/settings/branding"
              className="financeButtonSecondary"
              style={styles.financeButtonSecondary}
            >
              Branding →
            </Link>

            <Link
              href="/admin/orders"
              className="financeButtonSecondary"
              style={styles.financeButtonSecondary}
            >
              Orders →
            </Link>

            <Link
              href="/admin/donations"
              className="financeButtonSecondary"
              style={styles.financeButtonSecondary}
            >
              Donations & Gift Aid →
            </Link>

            <Link
              href="/admin/support"
              className="financeButtonSecondary"
              style={styles.financeButtonSecondary}
            >
              Help & Support →
            </Link>

            <Link
              href="/admin/customers"
              className="financeButtonSecondary"
              style={styles.financeButtonSecondary}
            >
              Customers →
            </Link>

            <Link
              href="/admin/settings/billing"
              className="financeButtonSecondary"
              style={styles.financeButtonSecondary}
            >
              Billing →
            </Link>
          </div>
        </section>

        <section className="admin-data-panel" style={styles.dataPanel}>
          <div>
            <p style={styles.kicker}>Live platform overview</p>

            <h2
              className="so-brand-card-title admin-section-title"
              style={styles.sectionTitle}
            >
              Campaign summary
            </h2>

            <p style={styles.sectionText}>
              A simple snapshot of the live campaign data currently available
              to this tenant.
            </p>
          </div>

          <div className="admin-data-grid" style={styles.dataGrid}>
            <DataBlock
              label="Raffles"
              total={raffles.length}
              published={publishedRaffles.length}
            />

            <DataBlock
              label="Squares"
              total={squares.length}
              published={publishedSquares.length}
            />

            <DataBlock
              label="Events"
              total={events.length}
              published={publishedEvents.length}
            />

            <DataBlock
              label="Auctions"
              total={auctions.length}
              published={publishedAuctions.length}
            />
          </div>
        </section>
      </section>
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
    <div
      className="admin-stat-card"
      style={dark ? styles.darkStatCard : styles.statCard}
    >
      <div style={dark ? styles.darkStatLabel : styles.statLabel}>{label}</div>

      <div
        className="admin-stat-value"
        style={dark ? styles.darkStatValue : styles.statValue}
      >
        {value}
      </div>
    </div>
  );
}

function PlanFeature({
  label,
  included,
  text,
}: {
  label: string;
  included: boolean;
  text: string;
}) {
  return (
    <div
      className="admin-plan-feature"
      style={{
        ...styles.planFeature,
        ...(included ? styles.planFeatureIncluded : styles.planFeatureLocked),
      }}
    >
      <div style={styles.planFeatureTop}>
        <span style={styles.planFeatureLabel}>{label}</span>

        <span
          style={{
            ...styles.planPill,
            ...(included ? styles.planPillIncluded : styles.planPillLocked),
          }}
        >
          {included ? "Included" : "Locked"}
        </span>
      </div>

      <p style={styles.planFeatureText}>{text}</p>
    </div>
  );
}

function FocusCard({
  label,
  value,
  text,
}: {
  label: string;
  value: ReactNode;
  text: string;
}) {
  return (
    <article className="admin-focus-card" style={styles.focusCard}>
      <div style={styles.focusLabel}>{label}</div>

      <div style={styles.focusValue}>{value}</div>

      <p style={styles.focusText}>{text}</p>
    </article>
  );
}

function DataBlock({
  label,
  total,
  published,
}: {
  label: string;
  total: number;
  published: number;
}) {
  return (
    <div className="admin-data-block" style={styles.dataBlock}>
      <div style={styles.dataLabel}>{label}</div>

      <div style={styles.dataValue}>{total}</div>

      <div style={styles.dataSub}>{published} published</div>
    </div>
  );
}

function DashboardCard({
  href,
  image,
  badgeText,
  title,
  description,
  stats,
  tone = "default",
  compact = false,
  locked = false,
  lockText,
}: {
  href: string;
  image?: string;
  badgeText?: string;
  title: string;
  description: string;
  stats: string;
  tone?: "default" | "blue" | "gold";
  compact?: boolean;
  locked?: boolean;
  lockText?: string;
}) {
  const badgeStyle =
    tone === "gold"
      ? styles.logoTextGold
      : tone === "blue"
        ? styles.logoTextBlue
        : styles.logoTextDefault;

  return (
    <Link href={href} style={styles.cardLink}>
      <article
        className={`admin-dashboard-card ${
          compact ? "admin-compact-card" : ""
        } ${locked ? "admin-locked-card" : ""}`}
        style={{
          ...(compact
            ? {
                ...styles.card,
                ...styles.compactCard,
              }
            : styles.card),
          ...(locked ? styles.lockedCard : {}),
        }}
      >
        <div style={styles.cardTop}>
          <div style={styles.cardHeaderRow}>
            <div
              style={
                compact
                  ? {
                      ...styles.logoBox,
                      ...styles.compactLogoBox,
                    }
                  : styles.logoBox
              }
            >
              {image ? (
                <img
                  src={image}
                  alt={title}
                  style={
                    image.includes("so-default-auctions")
                      ? {
                          ...styles.logoImage,
                          width: "132%",
                          height: "132%",
                          padding: 2,
                        }
                      : styles.logoImage
                  }
                />
              ) : (
                <span style={badgeStyle}>{badgeText || title}</span>
              )}
            </div>

            {locked ? <span style={styles.lockBadge}>{lockText}</span> : null}
          </div>

          <h2
            className="so-brand-card-title admin-card-title"
            style={styles.cardTitle}
          >
            {title}
          </h2>

          <p style={styles.cardDescription}>{description}</p>
        </div>

        <div style={styles.cardBottom}>
          <div style={styles.cardStats}>{stats}</div>

          <div style={styles.cardDivider} />

          <div style={locked ? styles.lockedOpenLink : styles.openLink}>
            {locked ? "View upgrade option →" : "Open dashboard →"}
          </div>
        </div>
      </article>
    </Link>
  );
}

const responsiveStyles = `
.admin-dashboard-page,
.admin-dashboard-page * {
  box-sizing: border-box;
}

.admin-dashboard-page {
  overflow-x: hidden;
}

.admin-dashboard-page section,
.admin-dashboard-page article,
.admin-dashboard-page div,
.admin-dashboard-page a {
  min-width: 0;
}

@media (max-width: 1180px) {
  .admin-dashboard-page .admin-command-centre,
  .admin-dashboard-page .admin-operations-grid {
    grid-template-columns: 1fr !important;
    grid-template-areas:
      "content"
      "stats"
      "actions" !important;
  }

  .admin-dashboard-page .admin-command-stats {
    grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
  }

  .admin-dashboard-page .admin-focus-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
  }
}

@media (max-width: 900px) {
  .admin-dashboard-page {
    padding: 18px 12px 44px !important;
  }

  .admin-dashboard-page .admin-command-centre {
    padding: 22px !important;
    border-radius: 28px !important;
  }

  .admin-dashboard-page .admin-dashboard-title {
    font-size: clamp(38px, 11vw, 56px) !important;
    line-height: 0.98 !important;
  }

  .admin-dashboard-page .admin-command-actions {
    grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
  }

  .admin-dashboard-page .primaryButton,
  .admin-dashboard-page .secondaryButton {
    width: 100% !important;
    justify-content: center !important;
    text-align: center !important;
  }

  .admin-dashboard-page .admin-command-stats,
  .admin-dashboard-page .admin-focus-grid,
  .admin-dashboard-page .admin-data-grid,
  .admin-dashboard-page .admin-panel-actions,
  .admin-dashboard-page .admin-plan-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
  }
}

@media (max-width: 620px) {
  .admin-dashboard-page .admin-command-actions,
  .admin-dashboard-page .admin-command-stats,
  .admin-dashboard-page .admin-focus-grid,
  .admin-dashboard-page .admin-data-grid,
  .admin-dashboard-page .admin-cards-grid,
  .admin-dashboard-page .admin-panel-actions,
  .admin-dashboard-page .admin-plan-grid {
    grid-template-columns: 1fr !important;
  }

  .admin-dashboard-page .admin-dashboard-card,
  .admin-dashboard-page .admin-finance-panel,
  .admin-dashboard-page .admin-data-panel,
  .admin-dashboard-page .admin-plan-panel {
    padding: 16px !important;
    border-radius: 22px !important;
  }

  .admin-dashboard-page .admin-command-centre {
    gap: 18px !important;
  }

  .admin-dashboard-page .admin-card-title,
  .admin-dashboard-page .admin-section-title {
    font-size: 25px !important;
  }
}
`;

const styles: Record<string, CSSProperties> = {
  page: {
    width: "100%",
    maxWidth: 1320,
    margin: "0 auto",
    padding: "28px 16px 64px",
    minHeight: "100vh",
    background:
      "radial-gradient(circle at top left, rgba(22,131,248,0.08), transparent 32%), radial-gradient(circle at top right, rgba(15,23,42,0.05), transparent 34%), #f8fafc",
    boxSizing: "border-box",
    overflowX: "hidden",
  },

 commandActions: {
  position: "relative",
  zIndex: 1,
  gridArea: "actions",
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(172px, 1fr))",
  gap: 12,
  alignItems: "stretch",
  width: "100%",
   },
    gap: 24,
    padding: 30,
    borderRadius: 34,
    background:
      "radial-gradient(circle at bottom right, rgba(37,99,235,0.20), transparent 38%), linear-gradient(135deg, #020617 0%, #0f172a 55%, #172554 100%)",
    color: "#ffffff",
    marginBottom: 18,
    boxShadow: "0 28px 70px rgba(15,23,42,0.22)",
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

  commandContent: {
    position: "relative",
    zIndex: 1,
    gridArea: "content",
    minWidth: 0,
  },

  badge: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
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
    fontSize: "clamp(52px, 7vw, 82px)",
    lineHeight: 0.92,
    letterSpacing: "-0.08em",
    color: "#ffffff",
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
    overflowWrap: "anywhere",
  },

  tenant: {
    margin: "16px 0 0",
    color: "#bfdbfe",
    fontSize: 14,
    fontWeight: 850,
    overflowWrap: "anywhere",
  },

  commandActions: {
    position: "relative",
    zIndex: 1,
    gridArea: "actions",
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(132px, 1fr))",
    gap: 12,
    alignItems: "stretch",
    width: "100%",
  },

  primaryButton: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 48,
    padding: "12px 16px",
    borderRadius: 999,
    background: "linear-gradient(135deg, #1683f8 0%, #2563eb 100%)",
    color: "#ffffff",
    textDecoration: "none",
    fontWeight: 950,
    border: "1px solid #1683f8",
    boxShadow: "0 14px 28px rgba(22,131,248,0.28)",
    whiteSpace: "nowrap",
    textAlign: "center",
    lineHeight: 1.2,
  },

  secondaryButton: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 48,
    padding: "12px 16px",
    borderRadius: 999,
    background: "rgba(255,255,255,0.06)",
    color: "#ffffff",
    textDecoration: "none",
    fontWeight: 900,
    border: "1px solid rgba(148,163,184,0.52)",
    backdropFilter: "blur(10px)",
    whiteSpace: "nowrap",
    textAlign: "center",
    lineHeight: 1.2,
  },

  commandStats: {
    position: "relative",
    zIndex: 1,
    gridArea: "stats",
    display: "grid",
    gridTemplateColumns: "1fr",
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

  planPanel: {
    display: "grid",
    gap: 18,
    padding: 22,
    borderRadius: 28,
    background:
      "linear-gradient(135deg, rgba(37,99,235,0.08), rgba(255,255,255,1) 72%)",
    border: "1px solid #bfdbfe",
    boxShadow: "0 8px 30px rgba(15,23,42,0.04)",
    marginBottom: 18,
  },

  planKicker: {
    margin: "0 0 7px",
    color: "#2563eb",
    fontSize: 12,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
  },

  planTitle: {
    margin: 0,
    color: "#0f172a",
    fontSize: 30,
    letterSpacing: "-0.05em",
    overflowWrap: "anywhere",
  },

  planText: {
    margin: "8px 0 0",
    color: "#475569",
    lineHeight: 1.6,
    maxWidth: 860,
    fontWeight: 750,
    overflowWrap: "anywhere",
  },

  planGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: 12,
  },

  planFeature: {
    display: "grid",
    gap: 8,
    padding: 14,
    borderRadius: 18,
    minWidth: 0,
  },

  planFeatureIncluded: {
    background: "#ffffff",
    border: "1px solid #bbf7d0",
  },

  planFeatureLocked: {
    background: "#fff7ed",
    border: "1px solid #fed7aa",
  },

  planFeatureTop: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },

  planFeatureLabel: {
    color: "#0f172a",
    fontSize: 14,
    fontWeight: 950,
    overflowWrap: "anywhere",
  },

  planPill: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "5px 9px",
    borderRadius: 999,
    fontSize: 11,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    whiteSpace: "nowrap",
  },

  planPillIncluded: {
    background: "#dcfce7",
    color: "#166534",
    border: "1px solid #86efac",
  },

  planPillLocked: {
    background: "#ffedd5",
    color: "#9a3412",
    border: "1px solid #fdba74",
  },

  planFeatureText: {
    margin: 0,
    color: "#64748b",
    fontSize: 13,
    lineHeight: 1.45,
    fontWeight: 750,
  },

  focusGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
    gap: 12,
    marginBottom: 18,
  },

  focusCard: {
    display: "grid",
    gap: 8,
    padding: 16,
    borderRadius: 22,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    boxShadow: "0 2px 12px rgba(15,23,42,0.04)",
    minWidth: 0,
  },

  focusLabel: {
    color: "#64748b",
    fontSize: 12,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.06em",
  },

  focusValue: {
    color: "#0f172a",
    fontSize: 30,
    fontWeight: 950,
    letterSpacing: "-0.06em",
    lineHeight: 1,
    overflowWrap: "anywhere",
  },

  focusText: {
    margin: 0,
    color: "#64748b",
    lineHeight: 1.45,
    fontSize: 13,
    fontWeight: 700,
    overflowWrap: "anywhere",
  },

  sectionHeader: {
    marginBottom: 16,
  },

  kicker: {
    margin: "0 0 7px",
    color: "#2563eb",
    fontSize: 12,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
  },

  sectionTitle: {
    margin: 0,
    color: "#0f172a",
    fontSize: 30,
    letterSpacing: "-0.05em",
    overflowWrap: "anywhere",
  },

  sectionText: {
    margin: "8px 0 0",
    color: "#64748b",
    lineHeight: 1.6,
    maxWidth: 760,
    fontWeight: 700,
    overflowWrap: "anywhere",
  },

  cardsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 280px), 1fr))",
    gap: 16,
    marginBottom: 20,
    alignItems: "stretch",
  },

  cardLink: {
    textDecoration: "none",
    color: "inherit",
    display: "block",
    minWidth: 0,
    height: "100%",
  },

  card: {
    display: "grid",
    gap: 14,
    padding: 18,
    borderRadius: 28,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    minHeight: 250,
    boxShadow: "0 8px 30px rgba(15,23,42,0.05)",
    height: "100%",
    minWidth: 0,
  },

  lockedCard: {
    background:
      "linear-gradient(135deg, rgba(255,247,237,0.92), rgba(255,255,255,1) 62%)",
    border: "1px solid #fed7aa",
  },

  compactCard: {
    minHeight: 210,
    gap: 12,
  },

  cardTop: {
    display: "grid",
    gap: 12,
    alignContent: "start",
    minWidth: 0,
  },

  cardHeaderRow: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 10,
  },

  logoBox: {
    width: 66,
    height: 66,
    borderRadius: 18,
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    overflow: "hidden",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },

  compactLogoBox: {
    width: 58,
    height: 58,
  },

  logoImage: {
    width: "100%",
    height: "100%",
    objectFit: "contain",
    objectPosition: "center",
    display: "block",
    padding: 8,
    boxSizing: "border-box",
  },

  lockBadge: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "7px 10px",
    borderRadius: 999,
    background: "#ffedd5",
    color: "#9a3412",
    border: "1px solid #fdba74",
    fontSize: 11,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    whiteSpace: "nowrap",
  },

  logoTextDefault: {
    color: "#0f172a",
    fontSize: 12,
    fontWeight: 950,
    letterSpacing: "0.08em",
  },

  logoTextBlue: {
    color: "#2563eb",
    fontSize: 12,
    fontWeight: 950,
    letterSpacing: "0.08em",
  },

  logoTextGold: {
    color: "#b45309",
    fontSize: 12,
    fontWeight: 950,
    letterSpacing: "0.08em",
  },

  cardTitle: {
    margin: 0,
    color: "#0f172a",
    fontSize: 26,
    letterSpacing: "-0.05em",
    overflowWrap: "anywhere",
  },

  cardDescription: {
    margin: 0,
    color: "#64748b",
    lineHeight: 1.5,
    fontSize: 14,
    fontWeight: 700,
    overflowWrap: "anywhere",
  },

  cardBottom: {
    display: "grid",
    gap: 9,
    alignContent: "end",
    marginTop: "auto",
  },

  cardStats: {
    color: "#0f172a",
    fontSize: 13,
    fontWeight: 950,
    overflowWrap: "anywhere",
  },

  cardDivider: {
    width: "100%",
    height: 1,
    background: "#e2e8f0",
  },

  openLink: {
    color: "#2563eb",
    fontWeight: 950,
    fontSize: 14,
  },

  lockedOpenLink: {
    color: "#b45309",
    fontWeight: 950,
    fontSize: 14,
  },

  operationsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 16,
  },

  financePanel: {
    display: "grid",
    gap: 18,
    padding: 22,
    borderRadius: 28,
    background:
      "linear-gradient(135deg, rgba(251,191,36,0.12) 0%, rgba(255,255,255,1) 80%)",
    border: "1px solid #fde68a",
    minWidth: 0,
  },

  financeKicker: {
    margin: "0 0 7px",
    color: "#b45309",
    fontSize: 12,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
  },

  financeTitle: {
    margin: 0,
    color: "#0f172a",
    fontSize: 30,
    letterSpacing: "-0.05em",
    overflowWrap: "anywhere",
  },

  financeText: {
    margin: "8px 0 0",
    color: "#78350f",
    lineHeight: 1.6,
    fontWeight: 700,
    overflowWrap: "anywhere",
  },

  panelActions: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 10,
    alignItems: "stretch",
  },

  financeButton: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 54,
    padding: "14px 16px",
    borderRadius: 18,
    background: "#0f172a",
    color: "#ffffff",
    textDecoration: "none",
    fontWeight: 950,
    whiteSpace: "normal",
    width: "100%",
    boxShadow: "0 14px 28px rgba(15,23,42,0.16)",
  },

  financeButtonSecondary: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 54,
    padding: "14px 16px",
    borderRadius: 18,
    background: "#ffffff",
    color: "#0f172a",
    border: "1px solid #cbd5e1",
    textDecoration: "none",
    fontWeight: 950,
    whiteSpace: "normal",
    width: "100%",
    boxShadow: "0 8px 20px rgba(15,23,42,0.04)",
  },

  dataPanel: {
    display: "grid",
    gap: 18,
    padding: 22,
    borderRadius: 28,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    minWidth: 0,
  },

  dataGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 12,
  },

  dataBlock: {
    display: "grid",
    gap: 6,
    padding: 16,
    borderRadius: 20,
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    minWidth: 0,
  },

  dataLabel: {
    color: "#64748b",
    fontSize: 13,
    fontWeight: 850,
  },

  dataValue: {
    color: "#0f172a",
    fontSize: 32,
    fontWeight: 950,
    letterSpacing: "-0.06em",
    overflowWrap: "anywhere",
  },

  dataSub: {
    color: "#2563eb",
    fontSize: 13,
    fontWeight: 850,
  },
};
