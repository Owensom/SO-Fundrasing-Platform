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
    <main style={styles.page}>
      <section style={styles.commandCentre}>
        <div style={styles.commandContent}>
          <div style={styles.badge}>SO Foundation Platform</div>

          <h1 className="so-brand-heading" style={styles.title}>
            Admin command centre
          </h1>

          <p style={styles.subtitle}>
            Manage raffles, squares, events and auctions across your tenant from
            one premium fundraising workspace.
          </p>

          <p style={styles.tenant}>
            Tenant: <strong>{tenantSlug}</strong>
          </p>

          <div style={styles.commandActions}>
            <Link
              href={`/c/${tenantSlug}`}
              target="_blank"
              style={styles.primaryButton}
            >
              View public campaigns →
            </Link>

            <Link href="/admin/metadata" style={styles.secondaryButton}>
              Finance & transactions
            </Link>
          </div>
        </div>

        <div style={styles.commandStats}>
          <StatCard label="Total campaigns" value={totalCampaigns} dark />
          <StatCard label="Published" value={totalPublishedCampaigns} dark />
          <StatCard
            label="Tracked estimate"
            value={formatMoney(combinedEstimatedRevenueCents)}
            dark
          />
        </div>
      </section>

      <section style={styles.focusGrid}>
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

      <section style={styles.sectionHeader}>
        <div>
          <p style={styles.kicker}>Main workspaces</p>
          <h2 className="so-brand-card-title" style={styles.sectionTitle}>
            Open a fundraising area
          </h2>
          <p style={styles.sectionText}>
            Choose the campaign type you want to manage. All existing tools,
            dashboards and workflows remain available inside each area.
          </p>
        </div>
      </section>

      <section style={styles.cardsGrid}>
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
      </section>

      <section style={styles.operationsGrid}>
        <section style={styles.financePanel}>
          <div>
            <p style={styles.financeKicker}>Finance & transactions</p>

            <h2 className="so-brand-card-title" style={styles.financeTitle}>
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

        <section style={styles.dataPanel}>
          <div>
            <p style={styles.kicker}>Live platform overview</p>

            <h2 className="so-brand-card-title" style={styles.sectionTitle}>
              Campaign summary
            </h2>

            <p style={styles.sectionText}>
              A simple snapshot of the live campaign data currently available to
              this tenant.
            </p>
          </div>

          <div style={styles.dataGrid}>
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
    <div style={dark ? styles.darkStatCard : styles.statCard}>
      <div style={dark ? styles.darkStatLabel : styles.statLabel}>{label}</div>
      <div style={dark ? styles.darkStatValue : styles.statValue}>{value}</div>
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
    <article style={styles.focusCard}>
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
    <div style={styles.dataBlock}>
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
      <article style={styles.card}>
        <div style={styles.cardTop}>
          <div style={styles.logoBox}>
            <img src={image} alt={title} style={styles.logoImage} />
          </div>

          <h2 className="so-brand-card-title" style={styles.cardTitle}>
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

const styles: Record<string, CSSProperties> = {
  page: {
    maxWidth: 1220,
    margin: "0 auto",
    padding: "28px 16px 70px",
    background:
      "radial-gradient(circle at top left, rgba(22,131,248,0.08), transparent 30%), radial-gradient(circle at top right, rgba(200,162,74,0.10), transparent 28%), #f8fafc",
    minHeight: "100vh",
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
  },
  darkStatCard: {
    padding: 18,
    borderRadius: 22,
    background: "rgba(255,255,255,0.08)",
    border: "1px solid rgba(255,255,255,0.12)",
    boxShadow: "0 12px 24px rgba(0,0,0,0.14)",
    backdropFilter: "blur(12px)",
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
    marginBottom: 26,
  },
  focusCard: {
    padding: 20,
    borderRadius: 24,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    boxShadow: "0 10px 28px rgba(15,23,42,0.055)",
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
  },
  financeKicker: {
    margin: "0 0 10px",
    color: "#fef3c7",
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
