import type { CSSProperties, ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { headers, cookies } from "next/headers";
import { getTenantSlugFromHeaders } from "@/lib/tenant";

const DEFAULT_RAFFLE_IMAGE = "/brand/so-default-raffles.png";
const TICKET_LOGO_IMAGE = "/brand/so-ticket-placeholder.png";

type RaffleItem = {
  id: string;
  tenant_slug: string;
  slug: string;
  title: string;
  description: string;
  image_url: string;
  draw_at: string | null;
  currency: string;
  ticket_price: number;
  total_tickets: number;
  sold_tickets: number;
  remaining_tickets: number;
  status: string;
  created_at: string;
  updated_at: string;
};

type ApiResponse = {
  ok: boolean;
  items?: RaffleItem[];
  error?: string;
};

async function getAdminRaffles(): Promise<RaffleItem[]> {
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

  const data = (await res.json()) as ApiResponse;

  if (!res.ok || !data.ok || !data.items) {
    return [];
  }

  return data.items;
}

function formatDrawDate(value: string | null) {
  if (!value) return "Not set";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not set";

  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function formatCurrency(value: number, currency: string) {
  try {
    return new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency: currency || "GBP",
    }).format(Number.isFinite(value) ? value : 0);
  } catch {
    return `${Number(value || 0).toFixed(2)} ${currency || "GBP"}`;
  }
}

function getStatusStyle(status: string): CSSProperties {
  const clean = status.toLowerCase();

  if (clean === "published") {
    return {
      background: "#ecfdf5",
      borderColor: "#bbf7d0",
      color: "#166534",
    };
  }

  if (clean === "closed") {
    return {
      background: "#fff7ed",
      borderColor: "#fed7aa",
      color: "#9a3412",
    };
  }

  if (clean === "drawn") {
    return {
      background: "#eff6ff",
      borderColor: "#bfdbfe",
      color: "#1d4ed8",
    };
  }

  return {
    background: "#f8fafc",
    borderColor: "#e2e8f0",
    color: "#475569",
  };
}

function getProgressPercent(raffle: RaffleItem) {
  if (!raffle.total_tickets || raffle.total_tickets <= 0) return 0;

  return Math.min(
    100,
    Math.max(0, Math.round((raffle.sold_tickets / raffle.total_tickets) * 100)),
  );
}

function getRaisedTotal(raffle: RaffleItem) {
  return Number(raffle.sold_tickets || 0) * Number(raffle.ticket_price || 0);
}

export default async function AdminRafflesPage() {
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

  const raffles = await getAdminRaffles();

  const totalRaffles = raffles.length;
  const publishedCount = raffles.filter((r) => r.status === "published").length;
  const totalSold = raffles.reduce(
    (sum, r) => sum + Number(r.sold_tickets || 0),
    0,
  );
  const totalRemaining = raffles.reduce(
    (sum, r) => sum + Number(r.remaining_tickets || 0),
    0,
  );
  const totalRaised = raffles.reduce((sum, r) => sum + getRaisedTotal(r), 0);
  const dashboardCurrency = raffles[0]?.currency || "GBP";

  return (
    <main className="raffles-admin-page" style={styles.page}>
      <style>{responsiveStyles}</style>

      <section className="raffles-admin-header" style={styles.header}>
        <div style={styles.headerCopy}>
          <div style={styles.badge}>Admin dashboard</div>

          <h1 className="raffles-admin-title" style={styles.title}>
            Manage raffles
          </h1>

          <p className="raffles-admin-subtitle" style={styles.subtitle}>
            Tenant: <strong style={{ color: "#0f172a" }}>{tenantSlug}</strong>
          </p>
        </div>

        <div className="raffles-admin-nav" style={styles.nav}>
          <Link href="/admin" style={styles.navButton}>
            ← Dashboard
          </Link>

          <div style={styles.navButtonActive}>Raffles</div>

          <Link href="/admin/squares" style={styles.navButton}>
            Squares
          </Link>

          <Link href="/admin/events" style={styles.navButton}>
            Events
          </Link>

          <Link href="/admin/auctions" style={styles.navButton}>
            Auctions
          </Link>

          <Link
            href={`/c/${tenantSlug}?adminReturn=/admin/raffles`}
            style={styles.navButton}
          >
            Public site
          </Link>

          <Link href="/admin/raffles/new" style={styles.createButton}>
            + Create raffle
          </Link>
        </div>
      </section>

      <section className="raffles-stats-grid" style={styles.statsGrid}>
        <StatCard
          label="Total raffles"
          value={totalRaffles}
          image={TICKET_LOGO_IMAGE}
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
          label="Tickets sold"
          value={totalSold}
          icon="↗"
          accent="#7c3aed"
          tint="#f5f3ff"
        />

        <StatCard
          label="Raised"
          value={formatCurrency(totalRaised, dashboardCurrency)}
          icon="£"
          accent="#d97706"
          tint="#fffbeb"
        />

        <StatCard
          label="Remaining"
          value={totalRemaining}
          icon="•"
          accent="#64748b"
          tint="#f8fafc"
        />
      </section>

      {raffles.length === 0 ? (
        <section style={styles.emptyCard}>
          <h2 style={{ margin: 0, color: "#0f172a" }}>No raffles yet</h2>

          <p style={styles.muted}>
            Create your first raffle and publish it when ready.
          </p>

          <Link href="/admin/raffles/new" style={styles.createButton}>
            Create raffle
          </Link>
        </section>
      ) : (
        <section style={styles.list}>
          {raffles.map((raffle) => {
            const progress = getProgressPercent(raffle);
            const statusStyle = getStatusStyle(raffle.status);
            const raised = getRaisedTotal(raffle);

            return (
              <article key={raffle.id} className="raffle-card" style={styles.card}>
                <div className="raffle-card-top" style={styles.cardTop}>
                  <div className="raffle-image-wrap" style={styles.imageWrap}>
                    <img
                      src={raffle.image_url || DEFAULT_RAFFLE_IMAGE}
                      alt={raffle.title || "Raffle"}
                      style={{
                        ...styles.image,
                        objectFit: raffle.image_url ? "cover" : "contain",
                        padding: raffle.image_url ? 0 : 10,
                        background: raffle.image_url
                          ? "#f1f5f9"
                          : "linear-gradient(135deg, #ffffff 0%, #f8fafc 55%, #eff6ff 100%)",
                        boxSizing: "border-box",
                      }}
                    />
                  </div>

                  <div style={styles.cardMain}>
                    <div className="raffle-card-header" style={styles.cardHeader}>
                      <div style={{ minWidth: 0 }}>
                        <h2 className="raffle-card-title" style={styles.cardTitle}>
                          {raffle.title}
                        </h2>

                        <p style={styles.slug}>/r/{raffle.slug}</p>
                      </div>

                      <div style={{ ...styles.status, ...statusStyle }}>
                        {raffle.status}
                      </div>
                    </div>

                    <div className="raffle-headline-grid" style={styles.headlineGrid}>
                      <div style={styles.headlineBox}>
                        <div style={styles.headlineLabel}>Sales progress</div>
                        <div style={styles.headlineValue}>{progress}% sold</div>
                      </div>

                      <div style={styles.headlineBox}>
                        <div style={styles.headlineLabel}>Raised so far</div>
                        <div style={styles.headlineValue}>
                          {formatCurrency(raised, raffle.currency)}
                        </div>
                      </div>
                    </div>

                    {raffle.description ? (
                      <p style={styles.description}>
                        {raffle.description.length > 130
                          ? `${raffle.description.slice(0, 130)}…`
                          : raffle.description}
                      </p>
                    ) : null}

                    <div className="raffle-detail-grid" style={styles.detailGrid}>
                      <InfoBlock
                        label="Price"
                        value={formatCurrency(
                          raffle.ticket_price,
                          raffle.currency,
                        )}
                      />

                      <InfoBlock
                        label="Draw date"
                        value={formatDrawDate(raffle.draw_at)}
                      />

                      <InfoBlock label="Total" value={raffle.total_tickets} />

                      <InfoBlock label="Sold" value={raffle.sold_tickets} />

                      <InfoBlock
                        label="Remaining"
                        value={raffle.remaining_tickets}
                      />
                    </div>

                    <div style={styles.progressSection}>
                      <div style={styles.progressHeader}>
                        <span>Sales progress</span>
                        <span>{progress}%</span>
                      </div>

                      <div style={styles.progressTrack}>
                        <div
                          style={{
                            ...styles.progressFill,
                            width: `${progress}%`,
                          }}
                        />
                      </div>
                    </div>

                    <div className="raffle-card-actions" style={styles.actions}>
                      <Link
                        href={`/admin/raffles/${raffle.id}`}
                        style={styles.primaryLink}
                      >
                        Open details
                      </Link>

                      <Link
                        href={`/r/${raffle.slug}?adminReturn=/admin/raffles/${raffle.id}`}
                        target="_blank"
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
      className="raffles-stat-card"
      style={{
        ...styles.statCard,
        borderTopColor: accent,
      }}
    >
      <div style={styles.statTop}>
        <div style={{ minWidth: 0 }}>
          <div style={styles.statLabel}>{label}</div>
          <div className="raffles-stat-value" style={styles.statValue}>
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

function InfoBlock({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div style={styles.detail}>
      <div style={styles.detailLabel}>{label}</div>
      <div style={styles.detailValue}>{value}</div>
    </div>
  );
}

const responsiveStyles = `
  .raffles-admin-page,
  .raffles-admin-page * {
    box-sizing: border-box;
  }

  .raffles-admin-page {
    overflow-x: hidden;
  }

  @media (max-width: 900px) {
    .raffles-admin-header {
      display: grid !important;
      grid-template-columns: 1fr !important;
      gap: 18px !important;
    }

    .raffles-admin-nav {
      justify-content: flex-start !important;
      width: 100% !important;
    }

    .raffle-card-top {
      grid-template-columns: 160px minmax(0, 1fr) !important;
    }
  }

  @media (max-width: 640px) {
    .raffles-admin-page {
      width: 100% !important;
      max-width: 100% !important;
      padding: 22px 12px 46px !important;
    }

    .raffles-admin-title {
      font-size: clamp(42px, 13vw, 58px) !important;
      line-height: 0.98 !important;
      letter-spacing: -0.065em !important;
      overflow-wrap: anywhere !important;
    }

    .raffles-admin-subtitle {
      font-size: 17px !important;
      overflow-wrap: anywhere !important;
    }

    .raffles-admin-nav {
      display: grid !important;
      grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
      gap: 10px !important;
    }

    .raffles-admin-nav a,
    .raffles-admin-nav div {
      width: 100% !important;
      min-height: 50px !important;
      padding: 12px 14px !important;
      text-align: center !important;
      font-size: 15px !important;
    }

    .raffles-admin-nav a:first-child {
      grid-column: 1 / -1 !important;
    }

    .raffles-admin-nav a:last-child {
      grid-column: 1 / -1 !important;
    }

    .raffles-stats-grid {
      grid-template-columns: 1fr !important;
      gap: 12px !important;
    }

    .raffles-stat-card {
      min-height: 112px !important;
      border-radius: 24px !important;
      padding: 18px !important;
    }

    .raffles-stat-value {
      font-size: clamp(36px, 12vw, 52px) !important;
      line-height: 1 !important;
      overflow-wrap: anywhere !important;
    }

    .raffle-card {
      padding: 16px !important;
      border-radius: 26px !important;
    }

    .raffle-card-top {
      display: grid !important;
      grid-template-columns: 1fr !important;
      gap: 16px !important;
    }

    .raffle-image-wrap {
      width: 100% !important;
      height: auto !important;
      aspect-ratio: 16 / 9 !important;
      border-radius: 22px !important;
    }

    .raffle-card-header {
      display: grid !important;
      grid-template-columns: 1fr !important;
      gap: 10px !important;
    }

    .raffle-card-title {
      font-size: clamp(30px, 10vw, 42px) !important;
      line-height: 1.05 !important;
      letter-spacing: -0.055em !important;
    }

    .raffle-headline-grid,
    .raffle-detail-grid {
      grid-template-columns: 1fr !important;
    }

    .raffle-card-actions {
      display: grid !important;
      grid-template-columns: 1fr !important;
      gap: 10px !important;
    }

    .raffle-card-actions a {
      width: 100% !important;
      min-height: 50px !important;
      font-size: 16px !important;
    }
  }

  @media (max-width: 380px) {
    .raffles-admin-page {
      padding-left: 10px !important;
      padding-right: 10px !important;
    }

    .raffles-admin-title {
      font-size: 40px !important;
    }

    .raffles-admin-nav {
      grid-template-columns: 1fr !important;
    }

    .raffles-admin-nav a,
    .raffles-admin-nav div {
      grid-column: auto !important;
    }

    .raffles-stat-value {
      font-size: 36px !important;
    }
  }
`;

const styles: Record<string, CSSProperties> = {
  page: {
    width: "100%",
    maxWidth: 1180,
    margin: "0 auto",
    padding: "32px 16px 56px",
    background: "#f8fafc",
    minHeight: "100vh",
    overflowX: "hidden",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 22,
    gap: 16,
    flexWrap: "wrap",
  },
  headerCopy: {
    minWidth: 0,
  },
  badge: {
    display: "inline-flex",
    padding: "6px 10px",
    borderRadius: 999,
    background: "#e0f2fe",
    color: "#0369a1",
    fontSize: 13,
    fontWeight: 800,
    marginBottom: 10,
  },
  title: {
    margin: 0,
    fontSize: 34,
    lineHeight: 1.1,
    letterSpacing: "-0.04em",
    color: "#0f172a",
  },
  subtitle: {
    margin: "10px 0 0",
    color: "#64748b",
    fontSize: 15,
  },
  nav: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
    justifyContent: "flex-end",
    minWidth: 0,
  },
  navButton: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "13px 18px",
    borderRadius: 9999,
    background: "#ffffff",
    color: "#0f172a",
    border: "1px solid #cbd5e1",
    textDecoration: "none",
    fontWeight: 800,
  },
  navButtonActive: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "13px 18px",
    borderRadius: 9999,
    background: "#0f172a",
    color: "#ffffff",
    fontWeight: 900,
  },
  createButton: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "13px 18px",
    borderRadius: 9999,
    background: "#1683f8",
    color: "#ffffff",
    textDecoration: "none",
    fontWeight: 800,
    boxShadow: "0 10px 20px rgba(22,131,248,0.22)",
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
    borderRadius: 22,
    padding: 18,
    background: "#ffffff",
    boxShadow: "0 2px 12px rgba(15,23,42,0.04)",
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
  progressSection: {
    marginTop: 16,
  },
  progressHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: 10,
    color: "#64748b",
    fontSize: 13,
    fontWeight: 700,
    marginBottom: 6,
  },
  progressTrack: {
    height: 10,
    borderRadius: 999,
    background: "#e2e8f0",
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    background: "linear-gradient(90deg, #16a34a 0%, #22c55e 100%)",
    borderRadius: 999,
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
