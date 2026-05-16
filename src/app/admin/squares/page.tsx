import type { CSSProperties, ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getTenantSlugFromHeaders } from "@/lib/tenant";
import { listSquaresGames } from "../../../../api/_lib/squares-repo";

const DEFAULT_SQUARES_IMAGE = "/brand/so-default-squares.png";
const SQUARES_LOGO_IMAGE = "/brand/squares-square-gold.png";

type SquaresGame = Awaited<ReturnType<typeof listSquaresGames>>[number];

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

function getSoldSquares(game: SquaresGame) {
  return Array.isArray(game.config_json?.sold)
    ? game.config_json.sold.length
    : 0;
}

function getRaisedCents(game: SquaresGame) {
  return getSoldSquares(game) * Number(game.price_per_square_cents || 0);
}

export default async function AdminSquaresListPage() {
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

  const games = await listSquaresGames(tenantSlug);

  const totalGames = games.length;
  const publishedCount = games.filter(
    (game) => game.status === "published",
  ).length;

  const totalSquares = games.reduce(
    (sum, game) => sum + Number(game.total_squares || 0),
    0,
  );

  const soldSquares = games.reduce(
    (sum, game) => sum + getSoldSquares(game),
    0,
  );

  const remainingSquares = Math.max(totalSquares - soldSquares, 0);

  const totalRaisedCents = games.reduce(
    (sum, game) => sum + getRaisedCents(game),
    0,
  );

  const dashboardCurrency = games[0]?.currency || "GBP";

  return (
    <main className="squares-admin-page" style={styles.page}>
      <style>{responsiveStyles}</style>

      <section className="squares-admin-hero" style={styles.hero}>
        <div style={styles.heroGlow} />

        <div style={styles.heroContent}>
          <div style={styles.heroPillRow}>
            <span style={styles.heroSectionPill}>Squares workspace</span>
          </div>

          <h1
            className="so-brand-heading squares-admin-title"
            style={styles.title}
          >
            Manage squares
          </h1>

          <p className="squares-admin-subtitle" style={styles.subtitle}>
            Run premium squares campaigns with live availability, supporter
            tracking and draw-ready fundraising controls.
          </p>

          <p style={styles.tenant}>
            Tenant: <strong>{tenantSlug}</strong>
          </p>
        </div>

        <div className="squares-hero-stats" style={styles.heroStats}>
          <HeroStat label="Total games" value={totalGames} />
          <HeroStat label="Published" value={publishedCount} />
          <HeroStat label="Squares sold" value={soldSquares} />
          <HeroStat
            label="Tracked raised"
            value={formatMoney(totalRaisedCents, dashboardCurrency)}
          />
        </div>

        <nav className="squares-admin-nav" style={styles.nav}>
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
            href={`/c/${tenantSlug}?adminReturn=/admin/squares`}
            style={styles.navButton}
          >
            Public site
          </Link>

          <Link href="/admin/squares/new" style={styles.createButton}>
            + Create squares
          </Link>
        </nav>
      </section>

      <section className="squares-stats-grid" style={styles.statsGrid}>
        <StatCard
          label="Total square games"
          value={totalGames}
          image={SQUARES_LOGO_IMAGE}
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
          <h2 style={{ margin: 0, color: "#0f172a" }}>
            No squares games yet
          </h2>

          <p style={styles.muted}>
            Create your first squares game.
          </p>

          <Link
            href="/admin/squares/new"
            style={styles.createButton}
          >
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
            const statusStyle = getStatusStyle(game.status);

            return (
              <article
                key={game.id}
                className="squares-card"
                style={styles.card}
              >
                <div
                  className="squares-card-top"
                  style={styles.cardTop}
                >
                  <div
                    className="squares-image-wrap"
                    style={styles.imageWrap}
                  >
                    <img
                      src={
                        game.image_url ||
                        DEFAULT_SQUARES_IMAGE
                      }
                      alt={game.title || "Squares"}
                      style={{
                        ...styles.image,
                        objectFit: game.image_url
                          ? "cover"
                          : "contain",
                        padding: game.image_url ? 0 : 10,
                        background: game.image_url
                          ? "#f1f5f9"
                          : "linear-gradient(135deg, #ffffff 0%, #f8fafc 55%, #eff6ff 100%)",
                        boxSizing: "border-box",
                      }}
                    />
                  </div>

                  <div style={styles.cardMain}>
                    <div
                      className="squares-card-header"
                      style={styles.cardHeader}
                    >
                      <div style={{ minWidth: 0 }}>
                        <h2
                          className="squares-card-title"
                          style={styles.cardTitle}
                        >
                          {game.title ||
                            "Untitled squares game"}
                        </h2>

                        <p style={styles.slug}>
                          /s/{game.slug}
                        </p>
                      </div>

                      <div
                        style={{
                          ...styles.status,
                          ...statusStyle,
                        }}
                      >
                        {game.status}
                      </div>
                    </div>

                    <div
                      className="squares-headline-grid"
                      style={styles.headlineGrid}
                    >
                      <div style={styles.headlineBox}>
                        <div style={styles.headlineLabel}>
                          Sales progress
                        </div>

                        <div style={styles.headlineValue}>
                          {progress}% sold
                        </div>
                      </div>

                      <div style={styles.headlineBox}>
                        <div style={styles.headlineLabel}>
                          Raised so far
                        </div>

                        <div style={styles.headlineValue}>
                          {formatMoney(
                            raisedCents,
                            game.currency,
                          )}
                        </div>
                      </div>
                    </div>

                    <div
                      className="squares-detail-grid"
                      style={styles.detailGrid}
                    >
                      <InfoBlock
                        label="Price"
                        value={formatMoney(
                          game.price_per_square_cents,
                          game.currency,
                        )}
                      />

                      <InfoBlock
                        label="Draw date"
                        value={formatDrawDate(game.draw_at)}
                      />

                      <InfoBlock
                        label="Total"
                        value={total}
                      />

                      <InfoBlock
                        label="Sold"
                        value={sold}
                      />

                      <InfoBlock
                        label="Remaining"
                        value={remaining}
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

                    <div
                      className="squares-card-actions"
                      style={styles.actions}
                    >
                      <Link
                        href={`/admin/squares/${game.id}`}
                        style={styles.primaryLink}
                      >
                        Open details
                      </Link>

                      <Link
                        href={`/s/${game.slug}?adminReturn=/admin/squares/${game.id}`}
                        target="_blank"
                        style={styles.secondaryLink}
                      >
                        View campaign
                      </Link>

                      <form
                        action={`/api/admin/squares/${game.id}/delete`}
                        method="post"
                        style={styles.deleteForm}
                      >
                        <button
                          type="submit"
                          style={styles.deleteButton}
                        >
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

function HeroStat({
  label,
  value,
}: {
  label: string;
  value: ReactNode;
}) {
  return (
    <div
      className="squares-hero-stat"
      style={styles.heroStat}
    >
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
      className="squares-stat-card"
      style={{
        ...styles.statCard,
        borderTopColor: accent,
      }}
    >
      <div style={styles.statTop}>
        <div style={{ minWidth: 0 }}>
          <div style={styles.statLabel}>{label}</div>

          <div
            className="squares-stat-value"
            style={styles.statValue}
          >
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
.squares-admin-page,
.squares-admin-page * {
  box-sizing: border-box;
}

.squares-admin-page {
  overflow-x: hidden;
}

.squares-admin-page section,
.squares-admin-page article,
.squares-admin-page div,
.squares-admin-page a,
.squares-admin-page nav {
  min-width: 0;
}

@media (max-width: 980px) {
  .squares-admin-hero {
    grid-template-columns: 1fr !important;
    grid-template-areas:
      "content"
      "stats"
      "nav" !important;
    padding: 24px !important;
  }

  .squares-hero-stats {
    grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
  }

  .squares-admin-nav {
    grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
  }

  .squares-card-top {
    grid-template-columns: 160px minmax(0, 1fr) !important;
  }
}

@media (max-width: 640px) {
  .squares-admin-page {
    width: 100% !important;
    max-width: 100% !important;
    padding: 18px 12px 46px !important;
  }

  .squares-admin-hero {
    padding: 20px !important;
    border-radius: 28px !important;
  }

  .squares-admin-title {
    font-size: clamp(44px, 14vw, 60px) !important;
    line-height: 0.96 !important;
    letter-spacing: -0.075em !important;
    white-space: normal !important;
    overflow-wrap: anywhere !important;
  }

  .squares-admin-subtitle {
    font-size: 16px !important;
    overflow-wrap: anywhere !important;
  }

  .squares-admin-nav {
    display: grid !important;
    grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
    gap: 10px !important;
  }

  .squares-admin-nav a,
  .squares-admin-nav div {
    width: 100% !important;
    min-height: 48px !important;
    padding: 12px 14px !important;
    text-align: center !important;
    font-size: 14px !important;
    white-space: normal !important;
  }

  .squares-admin-nav a:first-child,
  .squares-admin-nav a:last-child {
    grid-column: 1 / -1 !important;
  }

  .squares-hero-stats,
  .squares-stats-grid {
    grid-template-columns: 1fr !important;
    gap: 12px !important;
  }

  .squares-stat-card,
  .squares-hero-stat {
    min-height: 112px !important;
    border-radius: 24px !important;
    padding: 18px !important;
  }

  .squares-stat-value {
    font-size: clamp(36px, 12vw, 52px) !important;
    line-height: 1 !important;
    overflow-wrap: anywhere !important;
  }

  .squares-card {
    padding: 16px !important;
    border-radius: 26px !important;
  }

  .squares-card-top {
    display: grid !important;
    grid-template-columns: 1fr !important;
    gap: 16px !important;
  }

  .squares-image-wrap {
    width: 100% !important;
    height: auto !important;
    aspect-ratio: 16 / 9 !important;
    border-radius: 22px !important;
  }

  .squares-card-header {
    display: grid !important;
    grid-template-columns: 1fr !important;
    gap: 10px !important;
  }

  .squares-card-title {
    font-size: clamp(30px, 10vw, 42px) !important;
    line-height: 1.05 !important;
    letter-spacing: -0.055em !important;
  }

  .squares-headline-grid,
  .squares-detail-grid {
    grid-template-columns: 1fr !important;
  }

  .squares-card-actions {
    display: grid !important;
    grid-template-columns: 1fr !important;
    gap: 10px !important;
  }

  .squares-card-actions a,
  .squares-card-actions form,
  .squares-card-actions button {
    width: 100% !important;
  }

  .squares-card-actions a,
  .squares-card-actions button {
    min-height: 50px !important;
    font-size: 16px !important;
  }
}

@media (max-width: 380px) {
  .squares-admin-page {
    padding-left: 10px !important;
    padding-right: 10px !important;
  }

  .squares-admin-title {
    font-size: 40px !important;
  }

  .squares-admin-nav {
    grid-template-columns: 1fr !important;
  }

  .squares-admin-nav a,
  .squares-admin-nav div {
    grid-column: auto !important;
  }

  .squares-stat-value {
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
    fontWeight: 800,
    fontSize: 14,
    cursor: "pointer",
  },
};
