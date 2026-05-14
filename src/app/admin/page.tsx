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

  const publishedRaffles = raffles.filter((item) => item.status === "published");
  const publishedSquares = squares.filter((item) => item.status === "published");
  const publishedEvents = events.filter((item) => item.status === "published");
  const publishedAuctions = auctions.filter(
    (item) => item.status === "published",
  );

  const raffleRevenueCents = raffles.reduce(
    (sum, raffle) =>
      sum + Number(raffle.sold_tickets || 0) * Number(raffle.ticket_price || 0),
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

  const combinedEstimatedRevenueCents = raffleRevenueCents + squaresRevenueCents;

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
            Manage raffles, squares, events, auctions and platform operations
            across your tenant from one premium fundraising workspace.
          </p>

          <p className="admin-dashboard-tenant" style={styles.tenant}>
            Tenant: <strong>{tenantSlug}</strong>
          </p>

          <div className="admin-command-actions" style={styles.commandActions}>
            <Link
              href={`/c/${tenantSlug}`}
              target="_blank"
              style={styles.primaryButton}
            >
              View public campaigns →
            </Link>

            <Link href="/admin/orders" style={styles.secondaryButton}>
              Orders dashboard
            </Link>

            <Link href="/admin/metadata" style={styles.secondaryButton}>
              Finance & transactions
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
          label="Published campaigns"
          value={totalPublishedCampaigns}
          text={`${totalCampaigns} total campaigns created`}
        />
      </section>

      <section className="admin-ops-spotlight" style={styles.opsSpotlight}>
        <div>
          <p style={styles.financeKicker}>Platform core</p>

          <h2
            className="so-brand-card-title admin-section-title"
            style={styles.opsTitle}
          >
            Orders dashboard
          </h2>

          <p style={styles.opsText}>
            Review unified activity across raffles, squares, events and
            auctions. Search supporters, check campaign activity and export the
            current view as CSV.
          </p>
        </div>

        <Link href="/admin/orders" style={styles.opsButton}>
          Open orders dashboard →
        </Link>
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
            Choose the campaign type or operational area you want to manage.
            Campaign dashboards remain separate, while Orders gives you the
            combined platform view.
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
          image="/brand/so-logo-mark.png"
          title="Orders"
          description="View unified orders, ticket sales, bids and customer activity."
          stats="Unified platform activity"
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
              Transaction centre
            </h2>

            <p style={styles.financeText}>
              Open the full metadata view for tracked transactions, campaign
              types, supporter details, platform contribution, Stripe fees and
              organiser net estimates.
            </p>
          </div>

          <Link href="/admin/metadata" style={styles.financeButton}>
            Open transaction centre →
          </Link>
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
              A simple snapshot of the live campaign data currently available to
              this tenant.
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
  title,
  description,
  stats,
}: {
  href: string;
  image: string;
  title: string;
  description: string;
  stats: string;
}) {
  return (
    <Link href={href} style={styles.cardLink}>
      <article className="admin-dashboard-card" style={styles.card}>
        <div style={styles.cardTop}>
          <div style={styles.logoBox}>
            <img src={image} alt={title} style={styles.logoImage} />
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

  @media (max-width: 900px) {
    .admin-command-centre {
      grid-template-columns: 1fr !important;
      padding: 22px !important;
      border-radius: 30px !important;
    }

    .admin-command-stats {
      grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
      align-content: stretch !important;
    }

    .admin-operations-grid {
      grid-template-columns: 1fr !important;
    }
  }

  @media (max-width: 640px) {
    .admin-dashboard-page {
      width: 100% !important;
      max-width: 100% !important;
      padding: 14px 12px 42px !important;
    }

    .admin-command-centre {
      display: block !important;
      padding: 20px !important;
      border-radius: 28px !important;
      margin-bottom: 14px !important;
    }

    .admin-dashboard-title {
      font-size: clamp(38px, 13vw, 52px) !important;
      line-height: 0.98 !important;
      letter-spacing: -0.065em !important;
      overflow-wrap: anywhere !important;
    }

    .admin-dashboard-subtitle {
      font-size: 16px !important;
      line-height: 1.55 !important;
      max-width: 100% !important;
    }

    .admin-dashboard-tenant {
      overflow-wrap: anywhere !important;
      word-break: break-word !important;
    }

    .admin-command-actions {
      display: grid !important;
      grid-template-columns: 1fr !important;
      gap: 10px !important;
      width: 100% !important;
    }

    .admin-command-actions a {
      width: 100% !important;
      min-height: 50px !important;
      text-align: center !important;
      padding: 14px 16px !important;
    }

    .admin-command-stats {
      display: grid !important;
      grid-template-columns: 1fr !important;
      gap: 10px !important;
      margin-top: 18px !important;
    }

    .admin-stat-card {
      width: 100% !important;
      padding: 16px !important;
      border-radius: 20px !important;
    }

    .admin-stat-value {
      font-size: 28px !important;
      line-height: 1.05 !important;
      overflow-wrap: anywhere !important;
    }

    .admin-focus-grid,
    .admin-cards-grid,
    .admin-data-grid {
      grid-template-columns: 1fr !important;
    }

    .admin-focus-card,
    .admin-dashboard-card,
    .admin-finance-panel,
    .admin-data-panel,
    .admin-ops-spotlight {
      border-radius: 24px !important;
      padding: 18px !important;
    }

    .admin-dashboard-card {
      min-height: auto !important;
    }

    .admin-section-title {
      font-size: 25px !important;
      line-height: 1.05 !important;
      overflow-wrap: anywhere !important;
    }

    .admin-card-title {
      font-size: 27px !important;
    }

    .admin-data-block {
      padding: 15px !important;
    }
  }

  @media (max-width: 380px) {
    .admin-dashboard-page {
      padding-left: 10px !important;
      padding-right: 10px !important;
    }

    .admin-command-centre {
      padding: 18px !important;
      border-radius: 24px !important;
    }

    .admin-dashboard-title {
      font-size: 40px !important;
    }

    .admin-stat-value {
      font-size: 26px !important;
    }
  }
`;

const styles: Record<string, CSSProperties> = {
  page: {
    width: "100%",
    maxWidth: 1220,
    margin: "0 auto",
    padding: "28px 16px 70px",
    background:
      "radial-gradient(circle at top left, rgba(22,131,248,0.08), transparent 30%), radial-gradient(circle at top right, rgba(200,162,74,0.10), transparent 28%), #f8fafc",
    minHeight: "100vh",
    overflowX: "hidden",
  },
  commandCentre: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1.45fr) minmax(280px, 0.7fr)",
    gap: 20,
    alignItems: "stretch",
    marginBottom: 18,
    padding: 24,
    borderRadius: 34,
    background:
      "linear-gradient(135deg, #08142f 0%, #0f1f46 48%, #1f2937 100%)",
    color: "#ffffff",
    border: "1px solid rgba(255,255,255,0.12)",
    boxShadow: "0 24px 60px rgba(15,23,42,0.18)",
    overflow: "hidden",
  },
  commandContent: {
    minWidth: 0,
  },
  badge: {
    display: "inline-flex",
    padding: "7px 11px",
    borderRadius: 999,
    background: "rgba(212,175,87,0.14)",
    color: "#f8d878",
    fontWeight: 950,
    fontSize: 13,
    marginBottom: 16,
    border: "1px solid rgba(212,175,87,0.28)",
  },
  title: {
    margin: 0,
    fontSize: "clamp(42px, 7vw, 68px)",
    lineHeight: 0.95,
    letterSpacing: "-0.07em",
    color: "#ffffff",
    textShadow: "0 16px 38px rgba(0,0,0,0.25)",
  },
  subtitle: {
    margin: "16px 0 0",
    color: "rgba(255,255,255,0.76)",
    fontSize: 17,
    lineHeight: 1.7,
    maxWidth: 780,
  },
  tenant: {
    margin: "12px 0 0",
    color: "rgba(255,255,255,0.88)",
    fontWeight: 800,
  },
  commandActions: {
    display: "flex",
    gap: 12,
    flexWrap: "wrap",
    marginTop: 24,
  },
  primaryButton: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "14px 19px",
    borderRadius: 999,
    background: "linear-gradient(180deg, #d4af57 0%, #c8a24a 100%)",
    color: "#08142f",
    border: "1px solid rgba(255,255,255,0.20)",
    textDecoration: "none",
    fontWeight: 950,
    boxShadow: "0 14px 28px rgba(0,0,0,0.25)",
  },
  secondaryButton: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "14px 19px",
    borderRadius: 999,
    background: "rgba(255,255,255,0.08)",
    color: "#ffffff",
    border: "1px solid rgba(255,255,255,0.18)",
    textDecoration: "none",
    fontWeight: 900,
    backdropFilter: "blur(10px)",
  },
  commandStats: {
    display: "grid",
    gridTemplateColumns: "1fr",
    gap: 12,
    alignContent: "center",
    minWidth: 0,
  },
  darkStatCard: {
    padding: 18,
    borderRadius: 22,
    background: "rgba(255,255,255,0.08)",
    border: "1px solid rgba(255,255,255,0.12)",
    boxShadow: "0 12px 24px rgba(0,0,0,0.14)",
    backdropFilter: "blur(12px)",
    minWidth: 0,
  },
  darkStatLabel: {
    color: "rgba(255,255,255,0.68)",
    fontSize: 13,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.06em",
  },
  darkStatValue: {
    marginTop: 7,
    fontSize: 30,
    fontWeight: 950,
    color: "#ffffff",
    letterSpacing: "-0.04em",
  },
  focusGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
    gap: 14,
    marginBottom: 18,
  },
  focusCard: {
    padding: 20,
    borderRadius: 24,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    boxShadow: "0 10px 28px rgba(15,23,42,0.055)",
    minWidth: 0,
  },
  focusLabel: {
    color: "#64748b",
    fontSize: 13,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.05em",
  },
  focusValue: {
    marginTop: 8,
    fontSize: 34,
    fontWeight: 950,
    color: "#0f172a",
    letterSpacing: "-0.05em",
  },
  focusText: {
    margin: "7px 0 0",
    color: "#64748b",
    fontSize: 14,
    lineHeight: 1.55,
  },
  opsSpotlight: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 18,
    flexWrap: "wrap",
    padding: 24,
    borderRadius: 30,
    marginBottom: 24,
    background:
      "linear-gradient(135deg, #ffffff 0%, #eff6ff 54%, #fef3c7 130%)",
    border: "1px solid #dbeafe",
    boxShadow: "0 14px 34px rgba(15,23,42,0.07)",
  },
  opsTitle: {
    margin: 0,
    color: "#0f172a",
    fontSize: 30,
    letterSpacing: "-0.045em",
  },
  opsText: {
    margin: "8px 0 0",
    color: "#475569",
    lineHeight: 1.6,
    maxWidth: 760,
  },
  opsButton: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: "fit-content",
    padding: "13px 18px",
    borderRadius: 999,
    background: "#0f172a",
    color: "#ffffff",
    textDecoration: "none",
    fontWeight: 950,
    boxShadow: "0 10px 20px rgba(15,23,42,0.18)",
  },
  sectionHeader: {
    margin: "8px 0 14px",
  },
  kicker: {
    margin: "0 0 8px",
    color: "#c8a24a",
    fontSize: 12,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.1em",
  },
  sectionTitle: {
    margin: 0,
    color: "#0f172a",
    fontSize: 28,
    letterSpacing: "-0.04em",
  },
  sectionText: {
    margin: "8px 0 0",
    color: "#64748b",
    lineHeight: 1.6,
    maxWidth: 790,
  },
  cardsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(245px, 1fr))",
    gap: 18,
    marginBottom: 22,
    alignItems: "stretch",
  },
  cardLink: {
    textDecoration: "none",
    color: "inherit",
    display: "block",
    height: "100%",
    minWidth: 0,
  },
  card: {
    height: "100%",
    minHeight: 282,
    borderRadius: 30,
    padding: 24,
    background: "linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)",
    border: "1px solid #e2e8f0",
    boxShadow: "0 14px 34px rgba(15,23,42,0.07)",
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-between",
    minWidth: 0,
  },
  cardTop: {
    display: "flex",
    flexDirection: "column",
  },
  logoBox: {
    width: 78,
    height: 78,
    borderRadius: 24,
    background:
      "linear-gradient(135deg, #eff6ff 0%, #ffffff 50%, #f8fafc 100%)",
    border: "1px solid #dbeafe",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 18,
    overflow: "hidden",
    flexShrink: 0,
  },
  logoImage: {
    width: "88%",
    height: "88%",
    objectFit: "contain",
    display: "block",
  },
  cardTitle: {
    margin: 0,
    fontSize: 30,
    lineHeight: 1.05,
    color: "#0f172a",
    letterSpacing: "-0.05em",
  },
  cardDescription: {
    margin: "12px 0 0",
    color: "#64748b",
    lineHeight: 1.65,
    fontSize: 15,
    minHeight: 50,
  },
  cardBottom: {
    marginTop: 24,
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-start",
  },
  cardStats: {
    padding: "9px 11px",
    borderRadius: 999,
    background: "#f8fafc",
    color: "#334155",
    border: "1px solid #e2e8f0",
    fontWeight: 950,
    fontSize: 13,
    width: "fit-content",
  },
  cardDivider: {
    width: "100%",
    height: 1,
    background: "#e2e8f0",
    margin: "20px 0 18px",
  },
  openLink: {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    color: "#1683f8",
    fontWeight: 950,
  },
  operationsGrid: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 0.9fr) minmax(0, 1.1fr)",
    gap: 18,
    alignItems: "stretch",
  },
  financePanel: {
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-between",
    gap: 20,
    padding: 24,
    borderRadius: 30,
    background:
      "linear-gradient(135deg, #0f172a 0%, #1e293b 62%, #78350f 140%)",
    color: "#ffffff",
    border: "1px solid rgba(255,255,255,0.12)",
    boxShadow: "0 18px 42px rgba(15,23,42,0.16)",
    minWidth: 0,
  },
  financeKicker: {
    margin: "0 0 10px",
    color: "#92400e",
    fontSize: 12,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.1em",
  },
  financeTitle: {
    margin: 0,
    color: "#ffffff",
    fontSize: 28,
    letterSpacing: "-0.04em",
  },
  financeText: {
    margin: "10px 0 0",
    color: "rgba(255,255,255,0.72)",
    lineHeight: 1.6,
  },
  financeButton: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: "fit-content",
    padding: "13px 18px",
    borderRadius: 999,
    background: "#ffffff",
    color: "#0f172a",
    textDecoration: "none",
    fontWeight: 950,
    boxShadow: "0 10px 20px rgba(2,6,23,0.22)",
  },
  dataPanel: {
    padding: 24,
    borderRadius: 30,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    boxShadow: "0 12px 30px rgba(15,23,42,0.055)",
    minWidth: 0,
  },
  dataGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
    gap: 12,
    marginTop: 18,
  },
  dataBlock: {
    padding: 16,
    borderRadius: 20,
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    minWidth: 0,
  },
  dataLabel: {
    color: "#64748b",
    fontSize: 13,
    fontWeight: 950,
  },
  dataValue: {
    marginTop: 4,
    color: "#0f172a",
    fontSize: 30,
    fontWeight: 950,
  },
  dataSub: {
    marginTop: 2,
    color: "#64748b",
    fontSize: 13,
    fontWeight: 800,
  },
  statCard: {
    padding: 18,
    borderRadius: 20,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    boxShadow: "0 2px 12px rgba(15,23,42,0.04)",
    minWidth: 0,
  },
  statLabel: {
    color: "#64748b",
    fontSize: 13,
    fontWeight: 900,
  },
  statValue: {
    marginTop: 6,
    fontSize: 28,
    fontWeight: 950,
    color: "#0f172a",
  },
};
