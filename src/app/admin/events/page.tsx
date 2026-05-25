import type { CSSProperties, ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { query } from "@/lib/db";
import { getTenantSlugFromHeaders } from "@/lib/tenant";
import { getTenantSettings } from "@/lib/tenant-settings";
import {
  canPublishAnotherCampaign,
  getMaximumActiveCampaignsForTier,
  normaliseSubscriptionTier,
} from "@/lib/subscription-capabilities";
import { listEvents } from "../../../../api/_lib/events-repo";

const DEFAULT_EVENTS_IMAGE = "/brand/so-default-events.png";
const EVENTS_LOGO_IMAGE = "/brand/event-champagne-gold.png";

type ActiveCampaignCountRow = {
  total: number | string;
};

async function getActiveCampaignCount(tenantSlug: string) {
  const rows = await query<ActiveCampaignCountRow>(
    `
      select count(*)::int as total
      from (
        select 1
        from raffles
        where tenant_slug = $1
          and status = 'published'

        union all

        select 1
        from squares_games
        where tenant_slug = $1
          and status = 'published'

        union all

        select 1
        from events
        where tenant_slug = $1
          and status = 'published'
      ) active_campaigns
    `,
    [tenantSlug],
  );

  return Number(rows[0]?.total || 0);
}

function formatDate(value: string | null | undefined) {
  if (!value) return "Not set";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "Not set";

  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function formatEventType(value: string | null | undefined) {
  return String(value || "general_admission")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function getStatusStyle(status: string | null | undefined): CSSProperties {
  const clean = String(status || "draft").toLowerCase();

  if (clean === "published") {
    return {
      background: "#ecfdf5",
      color: "#166534",
      borderColor: "#bbf7d0",
    };
  }

  if (clean === "closed") {
    return {
      background: "#fff7ed",
      color: "#9a3412",
      borderColor: "#fed7aa",
    };
  }

  if (clean === "drawn") {
    return {
      background: "#eff6ff",
      color: "#1d4ed8",
      borderColor: "#bfdbfe",
    };
  }

  return {
    background: "#f8fafc",
    color: "#475569",
    borderColor: "#e2e8f0",
  };
}

function formatCampaignLimit(value: number) {
  if (!Number.isFinite(value)) return "unlimited active campaigns";

  return `${value} active campaign${value === 1 ? "" : "s"}`;
}

function formatTierName(value: string) {
  if (value === "foundation") return "Foundation";
  if (value === "professional") return "Professional";
  return "Community";
}

function CreateEventAction({
  canCreate,
  reason,
}: {
  canCreate: boolean;
  reason: string;
}) {
  if (canCreate) {
    return (
      <Link href="/admin/events/new" style={styles.createButton}>
        + Create event
      </Link>
    );
  }

  return (
    <div style={styles.createButtonDisabled} title={reason}>
      Limit reached
    </div>
  );
}

export default async function AdminEventsPage() {
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

  const [events, tenantSettings, activeCampaignCount] = await Promise.all([
    listEvents(tenantSlug),
    getTenantSettings(tenantSlug),
    getActiveCampaignCount(tenantSlug),
  ]);

  const subscriptionTier = normaliseSubscriptionTier(
    tenantSettings?.subscription_tier,
  );

  const maxActiveCampaigns = getMaximumActiveCampaignsForTier(subscriptionTier);

  const canCreateCampaign = canPublishAnotherCampaign({
    subscription_tier: tenantSettings?.subscription_tier,
    currentActiveCampaigns: activeCampaignCount,
  });

  const limitMessage = canCreateCampaign
    ? `Your current plan allows ${formatCampaignLimit(maxActiveCampaigns)}.`
    : `Your current plan has reached its ${formatCampaignLimit(
        maxActiveCampaigns,
      )} limit across raffles, squares and events. Close or unpublish a campaign, or upgrade the tenant plan.`;

  const totalEvents = events.length;
  const publishedCount = events.filter(
    (event) => event.status === "published",
  ).length;
  const draftCount = events.filter((event) => event.status !== "published")
    .length;
  const totalCapacity = events.reduce(
    (sum, event) => sum + Number(event.capacity || 0),
    0,
  );

  return (
    <main className="events-admin-page" style={styles.page}>
      <style>{responsiveStyles}</style>

      <section className="events-admin-hero" style={styles.hero}>
        <div style={styles.heroGlow} />

        <div style={styles.heroContent}>
          <div style={styles.heroPillRow}>
            <span style={styles.heroSectionPill}>Events workspace</span>
          </div>

          <h1
            className="so-brand-heading events-admin-title"
            style={styles.title}
          >
            Manage events
          </h1>

          <p className="events-admin-subtitle" style={styles.subtitle}>
            Manage premium fundraising events with seating, ticketing, guest
            details and public campaign controls.
          </p>

          <p style={styles.tenant}>
            Tenant: <strong>{tenantSlug}</strong>
          </p>
        </div>
                <div className="events-hero-stats" style={styles.heroStats}>
          <HeroStat label="Total events" value={totalEvents} />
          <HeroStat label="Published" value={publishedCount} />
          <HeroStat label="Combined capacity" value={totalCapacity} />
          <HeroStat label="Draft / private" value={draftCount} />
        </div>

        <nav className="events-admin-nav" style={styles.nav}>
          <Link href="/admin" style={styles.navButton}>
            ← Dashboard
          </Link>

          <Link href="/admin/raffles" style={styles.navButton}>
            Raffles
          </Link>

          <Link href="/admin/squares" style={styles.navButton}>
            Squares
          </Link>

          <div style={styles.navButtonActive}>Events</div>

          <Link href="/admin/auctions" style={styles.navButton}>
            Auctions
          </Link>

          <Link
            href={`/c/${tenantSlug}?adminReturn=/admin/events`}
            style={styles.navButton}
          >
            Public site
          </Link>

          <CreateEventAction
            canCreate={canCreateCampaign}
            reason={limitMessage}
          />
        </nav>
      </section>

      <section className="events-limit-panel" style={styles.limitPanel}>
        <div>
          <p style={styles.limitKicker}>Subscription limit</p>

          <h2 style={styles.limitTitle}>
            {canCreateCampaign
              ? "You can create another event."
              : "Active campaign limit reached."}
          </h2>

          <p style={styles.limitText}>{limitMessage}</p>
        </div>

        <div className="events-limit-stats" style={styles.limitStats}>
          <div style={styles.limitStat}>
            <span>Current plan</span>
            <strong>{formatTierName(subscriptionTier)}</strong>
          </div>

          <div style={styles.limitStat}>
            <span>Active campaigns</span>
            <strong>{activeCampaignCount}</strong>
          </div>

          <div style={styles.limitStat}>
            <span>Allowed</span>
            <strong>{formatCampaignLimit(maxActiveCampaigns)}</strong>
          </div>
        </div>
      </section>

      <section className="events-stats-grid" style={styles.statsGrid}>
        <StatCard
          label="Total events"
          value={totalEvents}
          image={EVENTS_LOGO_IMAGE}
          accent="#1683f8"
          tint="#eff6ff"
        />

        <StatCard
          label="Published"
          value={publishedCount}
          icon="✓"
          accent="#16a34a"
          tint="#ecfdf5"
        />

        <StatCard
          label="Combined capacity"
          value={totalCapacity}
          icon="↗"
          accent="#7c3aed"
          tint="#f5f3ff"
        />

        <StatCard
          label="Draft / private"
          value={draftCount}
          icon="•"
          accent="#64748b"
          tint="#f8fafc"
        />
      </section>

      {events.length === 0 ? (
        <section style={styles.emptyCard}>
          <h2 style={{ margin: 0, color: "#0f172a" }}>No events yet</h2>

          <p style={styles.muted}>Create your first fundraising event.</p>

          <CreateEventAction
            canCreate={canCreateCampaign}
            reason={limitMessage}
          />
        </section>
      ) : (
        <section style={styles.list}>
          {events.map((event) => {
            const hasCustomImage = Boolean(event.image_url);
            const capacity = Number(event.capacity || 0);
            const statusStyle = getStatusStyle(event.status);

            return (
              <article key={event.id} className="events-card" style={styles.card}>
                <div className="events-card-top" style={styles.cardTop}>
                  <div className="events-image-wrap" style={styles.imageWrap}>
                    <img
                      src={event.image_url || DEFAULT_EVENTS_IMAGE}
                      alt={event.title || "Event"}
                      style={{
                        ...styles.image,
                        objectFit: hasCustomImage ? "cover" : "contain",
                        padding: hasCustomImage ? 0 : 10,
                        background: hasCustomImage
                          ? "#f1f5f9"
                          : "linear-gradient(135deg, #ffffff 0%, #f8fafc 55%, #eff6ff 100%)",
                        boxSizing: "border-box",
                      }}
                    />
                  </div>

                  <div style={styles.cardMain}>
                    <div
                      className="events-card-header"
                      style={styles.cardHeader}
                    >
                      <div style={{ minWidth: 0 }}>
                        <h2
                          className="events-card-title"
                          style={styles.cardTitle}
                        >
                          {event.title || "Untitled event"}
                        </h2>

                        <p style={styles.slug}>/e/{event.slug}</p>
                      </div>

                      <div style={{ ...styles.status, ...statusStyle }}>
                        {event.status}
                      </div>
                    </div>

                    <div
                      className="events-headline-grid"
                      style={styles.headlineGrid}
                    >
                      <div style={styles.headlineBox}>
                        <div style={styles.headlineLabel}>Starts</div>

                        <div style={styles.headlineValue}>
                          {formatDate(event.starts_at)}
                        </div>
                      </div>

                      <div style={styles.headlineBox}>
                        <div style={styles.headlineLabel}>Capacity</div>

                        <div style={styles.headlineValue}>{capacity}</div>
                      </div>
                    </div>

                    {event.description ? (
                      <p style={styles.description}>
                        {event.description.length > 130
                          ? `${event.description.slice(0, 130)}…`
                          : event.description}
                      </p>
                    ) : null}
                                        <div
                      className="events-detail-grid"
                      style={styles.detailGrid}
                    >
                      <InfoBlock
                        label="Starts"
                        value={formatDate(event.starts_at)}
                      />

                      <InfoBlock label="Ends" value={formatDate(event.ends_at)} />

                      <InfoBlock label="Capacity" value={capacity} />

                      <InfoBlock
                        label="Currency"
                        value={event.currency || "GBP"}
                      />

                      <InfoBlock
                        label="Type"
                        value={formatEventType(event.event_type)}
                      />
                    </div>

                    <div
                      className="events-card-actions"
                      style={styles.actions}
                    >
                      <Link
                        href={`/admin/events/${event.id}`}
                        style={styles.primaryLink}
                      >
                        Open details
                      </Link>

                      <Link
                        href={
                        event.status === "published"
                      ? `/e/${event.slug}?adminReturn=/admin/events/${event.id}`
                    : `/admin/events/${event.id}?error=public-preview-unavailable`
                        }
                    target={event.status === "published" ? "_blank" : undefined}
                    style={styles.secondaryLink}
                      >
                    View campaign
                  </Link>
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </section>
      )}
    </main>
  );
}

function HeroStat({
  label,
  value,
}: {
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="events-hero-stat" style={styles.heroStat}>
      <div style={styles.heroStatLabel}>{label}</div>
      <div style={styles.heroStatValue}>{value}</div>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
  image,
  accent,
  tint,
}: {
  label: string;
  value: ReactNode;
  icon?: string;
  image?: string;
  accent: string;
  tint: string;
}) {
  return (
    <div
      className="events-stat-card"
      style={{
        ...styles.statCard,
        borderTopColor: accent,
      }}
    >
      <div style={styles.statTop}>
        <div style={{ minWidth: 0 }}>
          <div style={styles.statLabel}>{label}</div>

          <div className="events-stat-value" style={styles.statValue}>
            {value}
          </div>
        </div>

        <div
          style={{
            ...styles.statIcon,
            background: tint,
            color: accent,
            borderColor: accent,
            padding: image ? 4 : 0,
            overflow: "hidden",
          }}
        >
          {image ? (
            <img
              src={image}
              alt={label}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "contain",
                display: "block",
              }}
            />
          ) : (
            icon
          )}
        </div>
      </div>
    </div>
  );
}

function InfoBlock({
  label,
  value,
}: {
  label: string;
  value: ReactNode;
}) {
  return (
    <div style={styles.detail}>
      <div style={styles.detailLabel}>{label}</div>
      <div style={styles.detailValue}>{value}</div>
    </div>
  );
}

const responsiveStyles = `
.events-admin-page,
.events-admin-page * {
  box-sizing: border-box;
}

.events-admin-page {
  overflow-x: hidden;
}

.events-admin-page section,
.events-admin-page article,
.events-admin-page div,
.events-admin-page a,
.events-admin-page nav {
  min-width: 0;
}

@media (max-width: 980px) {
  .events-admin-hero {
    grid-template-columns: 1fr !important;
    grid-template-areas:
      "content"
      "stats"
      "nav" !important;
    padding: 24px !important;
  }

  .events-hero-stats {
    grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
  }

  .events-admin-nav {
    grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
  }

  .events-card-top {
    grid-template-columns: 160px minmax(0, 1fr) !important;
  }

  .events-limit-panel {
    grid-template-columns: 1fr !important;
  }

  .events-limit-stats {
    grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
  }
}

@media (max-width: 640px) {
  .events-admin-page {
    width: 100% !important;
    max-width: 100% !important;
    padding: 18px 12px 46px !important;
  }

  .events-admin-hero {
    padding: 20px !important;
    border-radius: 28px !important;
  }

  .events-admin-title {
    font-size: clamp(44px, 14vw, 60px) !important;
    line-height: 0.96 !important;
    letter-spacing: -0.075em !important;
    white-space: normal !important;
    overflow-wrap: anywhere !important;
  }

  .events-admin-subtitle {
    font-size: 16px !important;
    overflow-wrap: anywhere !important;
  }

  .events-admin-nav {
    display: grid !important;
    grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
    gap: 10px !important;
  }

  .events-admin-nav a,
  .events-admin-nav div {
    width: 100% !important;
    min-height: 48px !important;
    padding: 12px 14px !important;
    text-align: center !important;
    font-size: 14px !important;
    white-space: normal !important;
  }

  .events-admin-nav a:first-child,
  .events-admin-nav a:last-child {
    grid-column: 1 / -1 !important;
  }

  .events-hero-stats,
  .events-stats-grid,
  .events-limit-stats {
    grid-template-columns: 1fr !important;
    gap: 12px !important;
  }

  .events-stat-card,
  .events-hero-stat {
    min-height: 112px !important;
    border-radius: 24px !important;
    padding: 18px !important;
  }

  .events-stat-value {
    font-size: clamp(36px, 12vw, 52px) !important;
    line-height: 1 !important;
    overflow-wrap: anywhere !important;
  }

  .events-card {
    padding: 16px !important;
    border-radius: 26px !important;
  }

  .events-card-top {
    display: grid !important;
    grid-template-columns: 1fr !important;
    gap: 16px !important;
  }
    .events-image-wrap {
    width: 100% !important;
    height: auto !important;
    aspect-ratio: 16 / 9 !important;
    border-radius: 22px !important;
  }

  .events-card-header {
    display: grid !important;
    grid-template-columns: 1fr !important;
    gap: 10px !important;
  }

  .events-card-title {
    font-size: clamp(30px, 10vw, 42px) !important;
    line-height: 1.05 !important;
    letter-spacing: -0.055em !important;
  }

  .events-headline-grid,
  .events-detail-grid {
    grid-template-columns: 1fr !important;
  }

  .events-card-actions {
    display: grid !important;
    grid-template-columns: 1fr !important;
    gap: 10px !important;
  }

  .events-card-actions a {
    width: 100% !important;
    min-height: 50px !important;
    font-size: 16px !important;
  }
}

@media (max-width: 380px) {
  .events-admin-page {
    padding-left: 10px !important;
    padding-right: 10px !important;
  }

  .events-admin-title {
    font-size: 40px !important;
  }

  .events-admin-nav {
    grid-template-columns: 1fr !important;
  }

  .events-admin-nav a,
  .events-admin-nav div {
    grid-column: auto !important;
  }

  .events-stat-value {
    font-size: 36px !important;
  }
}
`;

const styles: Record<string, CSSProperties> = {
  page: {
    width: "100%",
    maxWidth: 1240,
    margin: "0 auto",
    padding: "28px 16px 56px",
    background:
      "radial-gradient(circle at top left, rgba(22,131,248,0.08), transparent 32%), radial-gradient(circle at top right, rgba(15,23,42,0.05), transparent 34%), #f8fafc",
    minHeight: "100vh",
    overflowX: "hidden",
  },

  hero: {
    position: "relative",
    display: "grid",
    gridTemplateColumns: "minmax(0, 1.15fr) minmax(300px, 0.85fr)",
    gridTemplateAreas: `
      "content stats"
      "nav nav"
    `,
    gap: 22,
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

  heroContent: {
    position: "relative",
    zIndex: 1,
    gridArea: "content",
    minWidth: 0,
  },

  heroPillRow: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
    marginBottom: 16,
  },

  heroSectionPill: {
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
    boxShadow: "0 12px 28px rgba(0,0,0,0.12)",
  },

  title: {
    margin: 0,
    fontSize: "clamp(54px, 7vw, 84px)",
    lineHeight: 0.92,
    letterSpacing: "-0.085em",
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
    fontWeight: 750,
    overflowWrap: "anywhere",
  },

  tenant: {
    margin: "16px 0 0",
    color: "#bfdbfe",
    fontSize: 14,
    fontWeight: 850,
    overflowWrap: "anywhere",
  },

  heroStats: {
    position: "relative",
    zIndex: 1,
    gridArea: "stats",
    display: "grid",
    gridTemplateColumns: "1fr",
    gap: 12,
    alignContent: "start",
  },

  heroStat: {
    display: "grid",
    gap: 6,
    padding: 18,
    borderRadius: 22,
    background: "rgba(255,255,255,0.08)",
    border: "1px solid rgba(148,163,184,0.26)",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.10)",
    backdropFilter: "blur(12px)",
  },

  heroStatLabel: {
    color: "#bfdbfe",
    fontSize: 13,
    fontWeight: 850,
  },

  heroStatValue: {
    color: "#ffffff",
    fontSize: 30,
    fontWeight: 950,
    letterSpacing: "-0.05em",
    overflowWrap: "anywhere",
  },

  nav: {
    position: "relative",
    zIndex: 1,
    gridArea: "nav",
    display: "grid",
    gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
    gap: 10,
    width: "100%",
  },

  navButton: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 46,
    padding: "11px 14px",
    borderRadius: 9999,
    background: "rgba(255,255,255,0.06)",
    color: "#ffffff",
    border: "1px solid rgba(148,163,184,0.52)",
    textDecoration: "none",
    fontWeight: 900,
    textAlign: "center",
    lineHeight: 1.2,
    backdropFilter: "blur(10px)",
  },

  navButtonActive: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 46,
    padding: "11px 14px",
    borderRadius: 9999,
    background: "#ffffff",
    color: "#0f172a",
    border: "1px solid rgba(250,204,21,0.76)",
    fontWeight: 950,
    textAlign: "center",
    lineHeight: 1.2,
  },

  createButton: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 46,
    padding: "11px 16px",
    borderRadius: 9999,
    background: "linear-gradient(135deg, #1683f8 0%, #2563eb 100%)",
    color: "#ffffff",
    textDecoration: "none",
    fontWeight: 950,
    boxShadow: "0 14px 28px rgba(22,131,248,0.28)",
    textAlign: "center",
    lineHeight: 1.2,
  },

  createButtonDisabled: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 46,
    padding: "11px 16px",
    borderRadius: 9999,
    background: "rgba(255,255,255,0.08)",
    color: "#cbd5e1",
    border: "1px solid rgba(203,213,225,0.42)",
    fontWeight: 950,
    textAlign: "center",
    lineHeight: 1.2,
    cursor: "not-allowed",
  },

  limitPanel: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) minmax(280px, 0.8fr)",
    gap: 16,
    alignItems: "center",
    padding: 18,
    borderRadius: 24,
    background: "#ffffff",
    border: "1px solid #dbeafe",
    boxShadow: "0 8px 30px rgba(15,23,42,0.045)",
    marginBottom: 18,
  },

  limitKicker: {
    margin: "0 0 7px",
    color: "#2563eb",
    fontSize: 12,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
  },

  limitTitle: {
    margin: 0,
    color: "#0f172a",
    fontSize: 24,
    letterSpacing: "-0.04em",
  },

  limitText: {
    margin: "8px 0 0",
    color: "#64748b",
    lineHeight: 1.55,
    fontWeight: 750,
  },

  limitStats: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: 10,
  },

  limitStat: {
    display: "grid",
    gap: 4,
    padding: 12,
    borderRadius: 16,
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    minWidth: 0,
  },

  statsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    gap: 12,
    marginBottom: 22,
  },

  statCard: {
    padding: 16,
    borderRadius: 18,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    borderTop: "4px solid #1683f8",
    boxShadow: "0 2px 12px rgba(15,23,42,0.04)",
    minWidth: 0,
  },

  statTop: {
    display: "flex",
    justifyContent: "space-between",
    gap: 14,
    alignItems: "flex-start",
  },

  statIcon: {
    width: 46,
    height: 46,
    borderRadius: 999,
    border: "1px solid",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 21,
    fontWeight: 900,
    flexShrink: 0,
  },

  statLabel: {
    color: "#64748b",
    fontSize: 13,
    fontWeight: 800,
  },

  statValue: {
    color: "#0f172a",
    fontSize: 28,
    fontWeight: 900,
    marginTop: 4,
    letterSpacing: "-0.03em",
  },

  emptyCard: {
    padding: 28,
    border: "1px solid #e2e8f0",
    borderRadius: 22,
    background: "#ffffff",
    boxShadow: "0 2px 12px rgba(15,23,42,0.04)",
  },

  muted: {
    color: "#64748b",
    margin: "8px 0 18px",
  },

  list: {
    display: "grid",
    gap: 16,
  },

  card: {
    border: "1px solid #e2e8f0",
    borderRadius: 24,
    padding: 18,
    background: "#ffffff",
    boxShadow: "0 8px 30px rgba(15,23,42,0.05)",
    minWidth: 0,
  },

  cardTop: {
    display: "grid",
    gridTemplateColumns: "104px minmax(0, 1fr)",
    gap: 16,
    alignItems: "start",
  },

  imageWrap: {
    width: 104,
    height: 104,
    borderRadius: 20,
    overflow: "hidden",
    background: "#f1f5f9",
    border: "1px solid #e2e8f0",
    boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.7)",
  },

  image: {
    width: "100%",
    height: "100%",
    display: "block",
    objectPosition: "center center",
  },

  cardMain: {
    minWidth: 0,
  },

  cardHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "flex-start",
    flexWrap: "wrap",
  },

  cardTitle: {
    margin: 0,
    fontSize: 22,
    color: "#0f172a",
    letterSpacing: "-0.02em",
    wordBreak: "break-word",
  },

  slug: {
    margin: "6px 0 0",
    color: "#64748b",
    fontSize: 14,
    wordBreak: "break-word",
  },

  status: {
    padding: "7px 11px",
    borderRadius: 9999,
    border: "1px solid",
    fontSize: 13,
    textTransform: "capitalize",
    fontWeight: 800,
    width: "fit-content",
  },

  headlineGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
    gap: 10,
    marginTop: 14,
  },

  headlineBox: {
    padding: "13px 14px",
    borderRadius: 16,
    background: "linear-gradient(135deg, #f8fafc 0%, #ffffff 100%)",
    border: "1px solid #e2e8f0",
    minWidth: 0,
  },

  headlineLabel: {
    fontSize: 12,
    color: "#64748b",
    fontWeight: 800,
  },

  headlineValue: {
    marginTop: 4,
    color: "#0f172a",
    fontSize: 19,
    fontWeight: 950,
    letterSpacing: "-0.03em",
    overflowWrap: "anywhere",
  },

  description: {
    color: "#475569",
    fontSize: 14,
    lineHeight: 1.5,
    margin: "10px 0 0",
  },

  detailGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
    gap: 10,
    marginTop: 16,
  },

  detail: {
    padding: 12,
    borderRadius: 14,
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    minWidth: 0,
  },

  detailLabel: {
    fontSize: 12,
    color: "#64748b",
    fontWeight: 800,
  },

  detailValue: {
    marginTop: 4,
    color: "#0f172a",
    fontWeight: 900,
    wordBreak: "break-word",
  },

  actions: {
    display: "flex",
    gap: 10,
    marginTop: 18,
    flexWrap: "wrap",
  },

  primaryLink: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "10px 14px",
    borderRadius: 999,
    background: "#0f172a",
    color: "#ffffff",
    textDecoration: "none",
    fontWeight: 800,
    fontSize: 14,
  },

  secondaryLink: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "10px 14px",
    borderRadius: 999,
    background: "#f8fafc",
    color: "#334155",
    border: "1px solid #dbe3ef",
    textDecoration: "none",
    fontWeight: 800,
    fontSize: 14,
    boxShadow: "none",
  },
};
