import type { CSSProperties, ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getTenantSlugFromHeaders } from "@/lib/tenant";
import { listSquaresGames } from "../../../../api/_lib/squares-repo";

const DEFAULT_SQUARES_IMAGE = "/brand/so-default-squares.png";
const SQUARES_LOGO_IMAGE = "/brand/so-default-squares.png";

function formatMoney(
  cents: number | null | undefined,
  currency: string | null | undefined,
) {
  const safeCurrency = currency || "GBP";
  const pounds = Number(cents || 0) / 100;

  try {
    return new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency: safeCurrency,
    }).format(Number.isFinite(pounds) ? pounds : 0);
  } catch {
    return `${pounds.toFixed(2)} ${safeCurrency}`;
  }
}

function formatDrawDate(value: string | null | undefined) {
  if (!value) return "Not set";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not set";

  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
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

function progressPercent(sold: number, total: number) {
  if (!total || total <= 0) return 0;
  return Math.min(100, Math.max(0, Math.round((sold / total) * 100)));
}

function getSoldSquares(game: Awaited<ReturnType<typeof listSquaresGames>>[number]) {
  return Array.isArray(game.config_json?.sold) ? game.config_json.sold.length : 0;
}

function getRaisedCents(game: Awaited<ReturnType<typeof listSquaresGames>>[number]) {
  return getSoldSquares(game) * Number(game.price_per_square_cents || 0);
}

export default async function AdminSquaresListPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/admin/login");
  }

  const tenantSlug = await getTenantSlugFromHeaders();
  const sessionTenantSlugs = Array.isArray(session.user.tenantSlugs)
    ? session.user.tenantSlugs.map((v) => String(v))
    : [];

  if (!tenantSlug || !sessionTenantSlugs.includes(tenantSlug)) {
    redirect("/admin/login?error=tenant_access_denied");
  }

  const games = await listSquaresGames(tenantSlug);

  const published = games.filter((game) => game.status === "published").length;

  const totalSquares = games.reduce(
    (sum, game) => sum + Number(game.total_squares || 0),
    0,
  );

  const soldSquares = games.reduce((sum, game) => sum + getSoldSquares(game), 0);
  const remainingSquares = Math.max(totalSquares - soldSquares, 0);
  const totalRaisedCents = games.reduce(
    (sum, game) => sum + getRaisedCents(game),
    0,
  );
  const dashboardCurrency = games[0]?.currency || "GBP";

  return (
    <main style={styles.page}>
      <section style={styles.header}>
        <div>
          <div style={styles.badge}>Admin dashboard</div>

          <h1 className="so-brand-heading" style={styles.title}>
            Manage squares
          </h1>

          <p style={styles.subtitle}>
            Tenant: <strong style={{ color: "#0f172a" }}>{tenantSlug}</strong>
          </p>
        </div>

        <div style={styles.nav}>
          <Link href="/admin" style={styles.navButton}>
            ← Dashboard
          </Link>

          <Link href="/admin/raffles" style={styles.navButton}>
            Raffles
          </Link>

          <div style={styles.navButtonActive}>Squares</div>

          <Link href="/admin/events" style={styles.navButton}>
            Events
          </Link>

          <Link href="/admin/auctions" style={styles.navButton}>
            Auctions
          </Link>

          <Link
            href={`/c/${tenantSlug}`}
            target="_blank"
            style={styles.navButton}
          >
            Public site
          </Link>

          <Link href="/admin/squares/new" style={styles.createButton}>
            + Create squares
          </Link>
        </div>
      </section>

      <section style={styles.statsGrid}>
        <StatCard
          label="Total square games"
          value={games.length}
          image={SQUARES_LOGO_IMAGE}
          accent="#1683f8"
          tint="#eff6ff"
        />

        <StatCard
          label="Published"
          value={published}
          icon="✓"
          accent="#16a34a"
          tint="#ecfdf5"
        />

        <StatCard
          label="Squares sold"
          value={soldSquares}
          icon="↗"
          accent="#7c3aed"
          tint="#f5f3ff"
        />

        <StatCard
          label="Raised"
          value={formatMoney(totalRaisedCents, dashboardCurrency)}
          icon="£"
          accent="#d97706"
          tint="#fffbeb"
        />

        <StatCard
          label="Remaining"
          value={remainingSquares}
          icon="•"
          accent="#64748b"
          tint="#f8fafc"
        />
      </section>

      {games.length === 0 ? (
        <section style={styles.emptyCard}>
          <h2 className="so-brand-card-title" style={{ margin: 0 }}>
            No squares games yet
          </h2>

          <p style={styles.muted}>Create your first squares game.</p>

          <Link href="/admin/squares/new" style={styles.createButton}>
            + Create squares
          </Link>
        </section>
      ) : (
        <section style={styles.list}>
          {games.map((game) => {
            const sold = getSoldSquares(game);
            const total = Number(game.total_squares || 0);
            const remaining = Math.max(total - sold, 0);
            const progress = progressPercent(sold, total);
            const raisedCents = getRaisedCents(game);

            return (
              <article key={game.id} style={styles.card}>
                <div style={styles.cardTop}>
                  <div style={styles.imageWrap}>
                    <img
                      src={game.image_url || DEFAULT_SQUARES_IMAGE}
                      alt={game.title || "SO Squares"}
                      style={{
                        ...styles.image,
                        objectFit: game.image_url ? "cover" : "contain",
                        padding: game.image_url ? 0 : 12,
                        background: game.image_url
                          ? "#f1f5f9"
                          : "linear-gradient(135deg, #eff6ff 0%, #ffffff 50%, #f8fafc 100%)",
                        boxSizing: "border-box",
                      }}
                    />
                  </div>

                  <div style={styles.cardMain}>
                    <div style={styles.cardHeader}>
                      <div style={{ minWidth: 0 }}>
                        <h2
                          className="so-brand-card-title"
                          style={styles.cardTitle}
                        >
                          {game.title || "Untitled squares game"}
                        </h2>

                        <p style={styles.slug}>/s/{game.slug}</p>
                      </div>

                      <span
                        style={{
                          ...styles.status,
                          ...getStatusStyle(game.status),
                        }}
                      >
                        {game.status}
                      </span>
                    </div>

                    <div style={styles.headlineGrid}>
                      <div style={styles.headlineBox}>
                        <div style={styles.headlineLabel}>Sales progress</div>
                        <div style={styles.headlineValue}>{progress}% sold</div>
                      </div>

                      <div style={styles.headlineBox}>
                        <div style={styles.headlineLabel}>Raised so far</div>
                        <div style={styles.headlineValue}>
                          {formatMoney(raisedCents, game.currency)}
                        </div>
                      </div>
                    </div>

                    <div style={styles.detailGrid}>
                      <Detail
                        label="Price"
                        value={formatMoney(
                          game.price_per_square_cents,
                          game.currency,
                        )}
                      />

                      <Detail
                        label="Draw date"
                        value={formatDrawDate(game.draw_at)}
                      />

                      <Detail label="Total" value={total} />
                      <Detail label="Sold" value={sold} />
                      <Detail label="Remaining" value={remaining} />
                    </div>

                    <div style={styles.progressRow}>
                      <div style={styles.progressLabel}>Sales progress</div>
                      <div style={styles.progressPercent}>{progress}%</div>
                    </div>

                    <div style={styles.progressTrack}>
                      <div
                        style={{
                          ...styles.progressFill,
                          width: `${progress}%`,
                        }}
                      />
                    </div>

                    <div style={styles.actions}>
                      <Link
                        href={`/admin/squares/${game.id}`}
                        style={styles.openButton}
                      >
                        Open details
                      </Link>

                      <a
                        href={`/s/${game.slug}`}
                        target="_blank"
                        rel="noreferrer"
                        style={styles.viewButton}
                      >
                        View campaign
                      </a>

                      <form
                        action={`/api/admin/squares/${game.id}/delete`}
                        method="post"
                        style={styles.deleteForm}
                      >
                        <button type="submit" style={styles.deleteButton}>
                          Delete
                        </button>
                      </form>
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
      style={{
        ...styles.statCard,
        borderTopColor: accent,
      }}
    >
      <div style={styles.statTop}>
        <div>
          <div style={styles.statLabel}>{label}</div>
          <div style={styles.statValue}>{value}</div>
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

function Detail({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div style={styles.detail}>
      <div style={styles.detailLabel}>{label}</div>
      <div style={styles.detailValue}>{value}</div>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  page: {
    maxWidth: 1180,
    margin: "0 auto",
    padding: "32px 16px 56px",
    background: "#f8fafc",
    minHeight: "100vh",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    gap: 16,
    alignItems: "flex-start",
    flexWrap: "wrap",
    marginBottom: 22,
  },
  badge: {
    display: "inline-flex",
    padding: "6px 10px",
    borderRadius: 999,
    background: "#e0f2fe",
    color: "#0369a1",
    fontSize: 13,
    fontWeight: 900,
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
    fontWeight: 900,
  },
  navButtonActive: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "13px 18px",
    borderRadius: 9999,
    background: "#0f172a",
    color: "#ffffff",
    border: "1px solid #0f172a",
    textDecoration: "none",
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
    fontWeight: 900,
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
  },
  statTop: {
    display: "flex",
    justifyContent: "space-between",
    gap: 14,
    alignItems: "flex-start",
  },
  statIcon: {
    width: 34,
    height: 34,
    borderRadius: 999,
    border: "1px solid",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 15,
    fontWeight: 900,
    flexShrink: 0,
  },
  statLabel: {
    color: "#64748b",
    fontSize: 13,
    fontWeight: 900,
  },
  statValue: {
    marginTop: 4,
    fontSize: 28,
    fontWeight: 950,
    color: "#0f172a",
    letterSpacing: "-0.03em",
  },
  list: {
    display: "grid",
    gap: 16,
  },
  card: {
    padding: 18,
    borderRadius: 22,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    boxShadow: "0 2px 12px rgba(15,23,42,0.04)",
  },
  cardTop: {
    display: "grid",
    gridTemplateColumns: "104px 1fr",
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
    position: "relative",
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
    lineHeight: 1.15,
    color: "#0f172a",
    letterSpacing: "-0.02em",
    wordBreak: "break-word",
  },
  slug: {
    margin: "6px 0 0",
    color: "#64748b",
    fontSize: 14,
    fontWeight: 700,
    wordBreak: "break-word",
  },
  status: {
    display: "inline-flex",
    padding: "7px 11px",
    borderRadius: 9999,
    border: "1px solid",
    fontSize: 13,
    fontWeight: 900,
    textTransform: "capitalize",
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
  },
  headlineLabel: {
    fontSize: 12,
    color: "#64748b",
    fontWeight: 900,
  },
  headlineValue: {
    marginTop: 4,
    color: "#0f172a",
    fontSize: 19,
    fontWeight: 950,
    letterSpacing: "-0.03em",
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
    color: "#64748b",
    fontSize: 12,
    fontWeight: 900,
  },
  detailValue: {
    marginTop: 4,
    color: "#0f172a",
    fontWeight: 900,
    wordBreak: "break-word",
  },
  progressRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: 10,
    marginTop: 16,
    color: "#64748b",
    fontWeight: 900,
    fontSize: 13,
  },
  progressLabel: {},
  progressPercent: {},
  progressTrack: {
    height: 10,
    background: "#e2e8f0",
    borderRadius: 999,
    overflow: "hidden",
    marginTop: 8,
  },
  progressFill: {
    height: "100%",
    background: "linear-gradient(90deg, #16a34a 0%, #22c55e 100%)",
    borderRadius: 999,
  },
  actions: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
    marginTop: 18,
  },
  openButton: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "10px 14px",
    borderRadius: 999,
    background: "#0f172a",
    color: "#ffffff",
    textDecoration: "none",
    fontWeight: 900,
    fontSize: 14,
  },
  viewButton: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "10px 14px",
    borderRadius: 999,
    background: "#f8fafc",
    color: "#334155",
    border: "1px solid #dbe3ef",
    textDecoration: "none",
    fontWeight: 900,
    fontSize: 14,
    boxShadow: "none",
  },
  deleteForm: {
    margin: 0,
  },
  deleteButton: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "10px 14px",
    borderRadius: 999,
    background: "#dc2626",
    color: "#ffffff",
    border: "none",
    fontWeight: 900,
    fontSize: 14,
    cursor: "pointer",
  },
  emptyCard: {
    padding: 28,
    borderRadius: 22,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    boxShadow: "0 2px 12px rgba(15,23,42,0.04)",
  },
  muted: {
    color: "#64748b",
    margin: "8px 0 18px",
  },
};
