import type { CSSProperties, ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { headers, cookies } from "next/headers";
import { auth } from "@/auth";
import { getTenantSlugFromHeaders } from "@/lib/tenant";
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

  const [raffles, squares, events, auctions] = await Promise.all([
    getAdminRaffles(),
    listSquaresGames(tenantSlug),
    listEvents(tenantSlug),
    listAuctions(tenantSlug),
  ]);

  const publishedRaffles = raffles.filter(
    (item) => item.status === "published",
  );

  const publishedSquares = squares.filter(
    (item) => item.status === "published",
  );

  const publishedEvents = events.filter(
    (item) => item.status === "published",
  );

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

          <div className="admin-command-actions" style={styles.commandActions}>
            <Link
              href={`/c/${tenantSlug}`}
              target="_blank"
              className="primaryButton"
              style={styles.primaryButton}
            >
              View public campaigns →
            </Link>

            <Link
              href="/admin/orders"
              className="secondaryButton"
              style={styles.secondaryButton}
            >
              Orders dashboard
            </Link>

            <Link
              href="/admin/customers"
              className="secondaryButton"
              style={styles.secondaryButton}
            >
              Customers
            </Link>

            <Link
              href="/admin/metadata"
              className="secondaryButton"
              style={styles.secondaryButton}
            >
              Finance & fees
            </Link>

            <Link
              href="/admin/settings/billing"
              className="secondaryButton"
              style={styles.secondaryButton}
            >
              Billing
            </Link>
          </div>
        </div>

        <div className="admin-command-stats" style={styles.commandStats}>
          <StatCard label="Total campaigns" value={totalCampaigns} dark />
          <StatCard label="Published" value={totalPublishedCampaigns} dark />
          <StatCard
            label="Tracked estimate"
            value={formatMoney(combinedEstimatedRevenueCents)}
            dark
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
            Choose the campaign type or operational dashboard you want
            to manage.
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

      <section
        className="admin-operations-grid"
        style={styles.operationsGrid}
      >
        <section
          className="admin-finance-panel"
          style={styles.financePanel}
        >
          <div>
            <p style={styles.financeKicker}>
              Finance & transactions
            </p>

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

          <div
            className="admin-panel-actions"
            style={styles.panelActions}
          >
            <Link
              href="/admin/metadata"
              className="financeButton"
              style={styles.financeButton}
            >
              Open finance →
            </Link>

            <Link
              href="/admin/orders"
              className="financeButtonSecondary"
              style={styles.financeButtonSecondary}
            >
              Orders →
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

        <section
          className="admin-data-panel"
          style={styles.dataPanel}
        >
          <div>
            <p style={styles.kicker}>
              Live platform overview
            </p>

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

          <div
            className="admin-data-grid"
            style={styles.dataGrid}
          >
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
      <div
        style={
          dark
            ? styles.darkStatLabel
            : styles.statLabel
        }
      >
        {label}
      </div>

      <div
        className="admin-stat-value"
        style={
          dark
            ? styles.darkStatValue
            : styles.statValue
        }
      >
        {value}
      </div>
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
}: {
  href: string;
  image?: string;
  badgeText?: string;
  title: string;
  description: string;
  stats: string;
  tone?: "default" | "blue" | "gold";
  compact?: boolean;
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
        }`}
        style={
          compact
            ? {
                ...styles.card,
                ...styles.compactCard,
              }
            : styles.card
        }
      >
        <div style={styles.cardTop}>
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
          <div style={styles.openLink}>Open dashboard →</div>
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
    padding: 24px !important;
    border-radius: 30px !important;
  }

  .admin-dashboard-page .admin-dashboard-title {
    font-size: clamp(44px, 10vw, 66px) !important;
    line-height: 0.95 !important;
  }

  .admin-dashboard-page .admin-command-actions {
    grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
  }

  .admin-dashboard-page .primaryButton,
  .admin-dashboard-page .secondaryButton {
    width: 100% !important;
    justify-content: center !important;
    text-align: center !important;
    white-space: normal !important;
  }

  .admin-dashboard-page .admin-command-stats,
  .admin-dashboard-page .admin-focus-grid,
  .admin-dashboard-page .admin-data-grid,
  .admin-dashboard-page .admin-panel-actions {
    grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
  }
}

@media (max-width: 620px) {
  .admin-dashboard-page .admin-command-actions,
  .admin-dashboard-page .admin-command-stats,
  .admin-dashboard-page .admin-focus-grid,
  .admin-dashboard-page .admin-data-grid,
  .admin-dashboard-page .admin-cards-grid,
  .admin-dashboard-page .admin-panel-actions {
    grid-template-columns: 1fr !important;
  }

  .admin-dashboard-page .admin-dashboard-card,
  .admin-dashboard-page .admin-finance-panel,
  .admin-dashboard-page .admin-data-panel {
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
      "radial-gradient(circle at top left, rgba(22,131,248,0.10), transparent 34%), #f8fafc",
    boxSizing: "border-box",
    overflowX: "hidden",
  },

  commandCentre: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1.2fr) minmax(320px, 0.8fr)",
    gap: 22,
    padding: 30,
    borderRadius: 34,
    background:
      "radial-gradient(circle at top left, rgba(251,191,36,0.24), transparent 32%), linear-gradient(135deg, #020617 0%, #0f172a 55%, #172554 100%)",
    color: "#ffffff",
    marginBottom: 18,
    boxShadow: "0 28px 70px rgba(15,23,42,0.22)",
  },

  commandContent: {
    minWidth: 0,
  },

  badge: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "7px 13px",
    borderRadius: 999,
    background: "rgba(251,191,36,0.12)",
    color: "#facc15",
    border: "1px solid rgba(251,191,36,0.32)",
    fontSize: 12,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    marginBottom: 16,
  },

  title: {
    margin: 0,
    fontSize: "clamp(52px, 7vw, 82px)",
    lineHeight: 0.92,
    letterSpacing: "-0.08em",
    overflowWrap: "anywhere",
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
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, max-content))",
    gap: 10,
    marginTop: 24,
    alignItems: "center",
  },

  primaryButton: {
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
    border: "1px solid #1683f8",
    boxShadow: "0 14px 28px rgba(22,131,248,0.22)",
    whiteSpace: "nowrap",
    textAlign: "center",
  },

  secondaryButton: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 44,
    padding: "11px 15px",
    borderRadius: 999,
    background: "rgba(255,255,255,0.10)",
    color: "#ffffff",
    textDecoration: "none",
    fontWeight: 900,
    border: "1px solid rgba(255,255,255,0.16)",
    backdropFilter: "blur(10px)",
    whiteSpace: "nowrap",
    textAlign: "center",
  },

  commandStats: {
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
    background: "rgba(255,255,255,0.10)",
    border: "1px solid rgba(255,255,255,0.16)",
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
