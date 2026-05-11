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

  const combinedEstimatedRevenueCents = raffleRevenueCents + squaresRevenueCents;

  return (
    <main style={styles.page}>
      <section style={styles.header}>
        <div>
          <div style={styles.badge}>SO Foundation Platform</div>

          <h1 className="so-brand-heading" style={styles.title}>
            Admin dashboard
          </h1>

          <p style={styles.subtitle}>
            Manage raffles, squares, events and auctions across your tenant.
          </p>

          <p style={styles.tenant}>
            Tenant: <strong>{tenantSlug}</strong>
          </p>
        </div>

        <div style={styles.headerActions}>
          <Link href="/admin/metadata" style={styles.metadataButton}>
            Admin metadata
          </Link>

          <Link
            href={`/c/${tenantSlug}`}
            target="_blank"
            style={styles.publicButton}
          >
            Public campaigns page
          </Link>
        </div>
      </section>

      <section style={styles.statsGrid}>
        <StatCard
          label="Total campaigns"
          value={raffles.length + squares.length + events.length + auctions.length}
        />

        <StatCard
          label="Published campaigns"
          value={
            publishedRaffles.length +
            publishedSquares.length +
            publishedEvents.length +
            publishedAuctions.length
          }
        />

        <StatCard
          label="Stripe tracked estimate"
          value={formatMoney(combinedEstimatedRevenueCents)}
        />

        <StatCard label="Raffle tickets sold" value={totalRaffleTicketsSold} />

        <StatCard label="Squares sold" value={squaresSold} />

        <StatCard label="Tickets remaining" value={totalRaffleTicketsRemaining} />
      </section>

      <section style={styles.financePanel}>
        <div>
          <p style={styles.financeKicker}>Finance and transaction metadata</p>

          <h2 className="so-brand-card-title" style={styles.sectionTitle}>
            Detailed transaction breakdown
          </h2>

          <p style={styles.sectionText}>
            Open the full metadata view for every tracked transaction, including
            campaign type, supporter details, platform contribution, Stripe fees,
            and organiser net estimate.
          </p>
        </div>

        <Link href="/admin/metadata" style={styles.financeButton}>
          View admin metadata →
        </Link>
      </section>

      <section style={styles.dataPanel}>
        <div>
          <h2 className="so-brand-card-title" style={styles.sectionTitle}>
            Platform data overview
          </h2>

          <p style={styles.sectionText}>
            Summary of live campaign data currently available to this tenant.
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
    </main>
  );
}

function StatCard({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div style={styles.statCard}>
      <div style={styles.statLabel}>{label}</div>
      <div style={styles.statValue}>{value}</div>
    </div>
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
        <div style={styles.logoBox}>
          <img src={image} alt={title} style={styles.logoImage} />
        </div>

        <h2 className="so-brand-card-title" style={styles.cardTitle}>
          {title}
        </h2>

        <p style={styles.cardDescription}>{description}</p>

        <div style={styles.cardStats}>{stats}</div>

        <div style={styles.openLink}>Open dashboard →</div>
      </article>
    </Link>
  );
}

const styles: Record<string, CSSProperties> = {
  page: {
    maxWidth: 1180,
    margin: "0 auto",
    padding: "34px 16px 60px",
    background:
      "radial-gradient(circle at top left, rgba(22,131,248,0.08), transparent 32%), #f8fafc",
    minHeight: "100vh",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    gap: 20,
    flexWrap: "wrap",
    alignItems: "flex-start",
    marginBottom: 26,
  },
  headerActions: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
    justifyContent: "flex-end",
  },
  badge: {
    display: "inline-flex",
    padding: "6px 10px",
    borderRadius: 999,
    background: "#dbeafe",
    color: "#1d4ed8",
    fontWeight: 900,
    fontSize: 13,
    marginBottom: 12,
  },
  title: {
    margin: 0,
    fontSize: "clamp(38px, 8vw, 58px)",
    lineHeight: 1,
    letterSpacing: "-0.06em",
    color: "#0f172a",
  },
  subtitle: {
    margin: "14px 0 0",
    color: "#64748b",
    fontSize: 16,
    lineHeight: 1.6,
    maxWidth: 760,
  },
  tenant: {
    margin: "10px 0 0",
    color: "#0f172a",
    fontWeight: 800,
  },
  publicButton: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "13px 18px",
    borderRadius: 999,
    background: "#ffffff",
    color: "#0f172a",
    border: "1px solid #cbd5e1",
    textDecoration: "none",
    fontWeight: 900,
  },
  metadataButton: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "13px 18px",
    borderRadius: 999,
    background: "#0f172a",
    color: "#ffffff",
    border: "1px solid #0f172a",
    textDecoration: "none",
    fontWeight: 900,
    boxShadow: "0 10px 22px rgba(15,23,42,0.16)",
  },
  statsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
    gap: 14,
    marginBottom: 18,
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
  financePanel: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 18,
    flexWrap: "wrap",
    padding: 22,
    borderRadius: 26,
    background:
      "linear-gradient(135deg, #0f172a 0%, #1e293b 62%, #78350f 140%)",
    color: "#ffffff",
    border: "1px solid rgba(255,255,255,0.12)",
    boxShadow: "0 18px 42px rgba(15,23,42,0.16)",
    marginBottom: 22,
  },
  financeKicker: {
    margin: "0 0 8px",
    color: "#fef3c7",
    fontSize: 12,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
  },
  financeButton: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "13px 18px",
    borderRadius: 999,
    background: "#ffffff",
    color: "#0f172a",
    textDecoration: "none",
    fontWeight: 950,
    boxShadow: "0 10px 20px rgba(2,6,23,0.22)",
  },
  dataPanel: {
    padding: 22,
    borderRadius: 26,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    boxShadow: "0 2px 14px rgba(15,23,42,0.05)",
    marginBottom: 22,
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
    lineHeight: 1.55,
    maxWidth: 760,
  },
  dataGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
    gap: 12,
    marginTop: 18,
  },
  dataBlock: {
    padding: 16,
    borderRadius: 18,
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
  },
  dataLabel: {
    color: "#64748b",
    fontSize: 13,
    fontWeight: 900,
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
  cardsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
    gap: 18,
  },
  cardLink: {
    textDecoration: "none",
  },
  card: {
    height: "100%",
    borderRadius: 28,
    padding: 24,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    boxShadow: "0 10px 30px rgba(15,23,42,0.05)",
  },
  logoBox: {
    width: 78,
    height: 78,
    borderRadius: 22,
    background:
      "linear-gradient(135deg, #eff6ff 0%, #ffffff 50%, #f8fafc 100%)",
    border: "1px solid #dbeafe",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 18,
    overflow: "hidden",
  },
  logoImage: {
    width: "88%",
    height: "88%",
    objectFit: "contain",
    display: "block",
  },
  cardTitle: {
    margin: 0,
    fontSize: 28,
    lineHeight: 1.1,
    color: "#0f172a",
    letterSpacing: "-0.04em",
  },
  cardDescription: {
    margin: "12px 0 0",
    color: "#64748b",
    lineHeight: 1.65,
    fontSize: 15,
  },
  cardStats: {
    marginTop: 14,
    padding: "9px 11px",
    borderRadius: 999,
    background: "#f8fafc",
    color: "#334155",
    border: "1px solid #e2e8f0",
    fontWeight: 900,
    fontSize: 13,
    width: "fit-content",
  },
  openLink: {
    marginTop: 20,
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    color: "#1683f8",
    fontWeight: 900,
  },
};
