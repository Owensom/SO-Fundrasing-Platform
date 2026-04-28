import type { CSSProperties } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getTenantSlugFromHeaders } from "@/lib/tenant";
import { listSquaresGames } from "../../../../api/_lib/squares-repo";

function formatMoney(cents: number | null | undefined, currency: string) {
  return `${(Number(cents || 0) / 100).toFixed(2)} ${currency || "GBP"}`;
}

function getStatusStyle(status: string | null | undefined): CSSProperties {
  const value = String(status || "draft").toLowerCase();

  if (value === "published") {
    return { background: "#ecfdf5", borderColor: "#bbf7d0", color: "#166534" };
  }

  if (value === "closed") {
    return { background: "#fff7ed", borderColor: "#fed7aa", color: "#9a3412" };
  }

  if (value === "drawn") {
    return { background: "#eff6ff", borderColor: "#bfdbfe", color: "#1d4ed8" };
  }

  return { background: "#f8fafc", borderColor: "#e2e8f0", color: "#475569" };
}

function statusBadge(status: string | null | undefined) {
  const value = String(status || "draft").toLowerCase();

  return (
    <span style={{ ...styles.statusPill, ...getStatusStyle(value) }}>
      {value}
    </span>
  );
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

  const publishedCount = games.filter(
    (game) => String(game.status || "").toLowerCase() === "published",
  ).length;

  const totalSquares = games.reduce(
    (total, game) => total + Number(game.total_squares || 0),
    0,
  );

  return (
    <main style={styles.page}>
      <section style={styles.topBar}>
        <Link href="/admin" style={styles.backLink}>
          ← Back to dashboard
        </Link>

        <div style={styles.topActions}>
          <Link href="/admin/raffles" style={styles.publicLink}>
            Raffles
          </Link>

          <Link href="/admin/squares/new" style={styles.primaryLink}>
            Create squares game
          </Link>
        </div>
      </section>

      <section style={styles.hero}>
        <div style={styles.heroContent}>
          <div style={styles.eyebrow}>Squares dashboard</div>

          <div style={styles.heroTitleRow}>
            <h1 style={styles.heroTitle}>Squares games</h1>

            <div style={styles.statusPillDark}>{tenantSlug}</div>
          </div>

          <p style={styles.heroSlug}>/admin/squares</p>

          <p style={styles.heroDescription}>
            Create, edit and manage all squares games for this tenant.
          </p>
        </div>

        <div style={styles.heroImageWrap}>
          <div style={styles.heroImageEmpty}>🔲</div>
        </div>
      </section>

      <section style={styles.summaryGrid}>
        <SummaryCard label="Total games" value={games.length} />
        <SummaryCard label="Published" value={publishedCount} />
        <SummaryCard label="Total squares" value={totalSquares} />
      </section>

      {games.length === 0 ? (
        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>No squares games yet</h2>
          <p style={styles.sectionDescription}>
            Create your first squares game to start selling numbered squares.
          </p>

          <div style={{ marginTop: 16 }}>
            <Link href="/admin/squares/new" style={styles.submitButton}>
              Create squares game
            </Link>
          </div>
        </section>
      ) : (
        <section style={styles.section}>
          <div style={styles.sectionHeader}>
            <div>
              <h2 style={styles.sectionTitle}>All squares games</h2>
              <p style={styles.sectionDescription}>
                View live pages, edit settings and manage draw results.
              </p>
            </div>

            <Link href="/admin/squares/new" style={styles.submitButton}>
              New game
            </Link>
          </div>

          <div style={styles.tableWrap}>
            <table style={styles.table}>
              <thead>
                <tr style={styles.tableHeadRow}>
                  <th style={styles.th}>Title</th>
                  <th style={styles.th}>Status</th>
                  <th style={styles.th}>Squares</th>
                  <th style={styles.th}>Price</th>
                  <th style={styles.th}>Public page</th>
                  <th style={{ ...styles.th, textAlign: "right" }}>Actions</th>
                </tr>
              </thead>

              <tbody>
                {games.map((game) => (
                  <tr key={game.id} style={styles.tr}>
                    <td style={styles.td}>
                      <div style={styles.tableTitle}>
                        {game.title || "Untitled squares game"}
                      </div>
                      <div style={styles.tableSub}>/s/{game.slug}</div>
                    </td>

                    <td style={styles.td}>{statusBadge(game.status)}</td>

                    <td style={styles.td}>
                      <strong>{Number(game.total_squares || 0)}</strong>
                    </td>

                    <td style={styles.td}>
                      {formatMoney(
                        game.price_per_square_cents,
                        game.currency ?? "GBP",
                      )}
                    </td>

                    <td style={styles.td}>
                      <a
                        href={`/s/${game.slug}`}
                        target="_blank"
                        rel="noreferrer"
                        style={styles.inlineLink}
                      >
                        View live page ↗
                      </a>
                    </td>

                    <td style={{ ...styles.td, textAlign: "right" }}>
                      <Link
                        href={`/admin/squares/${game.id}`}
                        style={styles.editButton}
                      >
                        Edit
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </main>
  );
}

function SummaryCard({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div style={styles.summaryCard}>
      <div style={styles.summaryLabel}>{label}</div>
      <div style={styles.summaryValue}>{value}</div>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  page: {
    maxWidth: 1180,
    margin: "0 auto",
    padding: "28px 16px 56px",
    background: "#f8fafc",
    minHeight: "100vh",
  },
  topBar: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "center",
    marginBottom: 16,
    flexWrap: "wrap",
  },
  topActions: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
  },
  backLink: {
    color: "#334155",
    textDecoration: "none",
    fontWeight: 800,
  },
  publicLink: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "10px 14px",
    borderRadius: 999,
    background: "#ffffff",
    color: "#0f172a",
    border: "1px solid #cbd5e1",
    textDecoration: "none",
    fontWeight: 800,
    fontSize: 14,
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
  hero: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) 260px",
    gap: 18,
    alignItems: "stretch",
    padding: 22,
    borderRadius: 24,
    background: "#0f172a",
    color: "#ffffff",
    marginBottom: 16,
  },
  heroContent: {
    minWidth: 0,
  },
  eyebrow: {
    display: "inline-flex",
    padding: "5px 9px",
    borderRadius: 999,
    background: "rgba(255,255,255,0.12)",
    fontSize: 12,
    fontWeight: 900,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    marginBottom: 10,
  },
  heroTitleRow: {
    display: "flex",
    gap: 12,
    justifyContent: "space-between",
    alignItems: "flex-start",
    flexWrap: "wrap",
  },
  heroTitle: {
    margin: 0,
    fontSize: 34,
    lineHeight: 1.08,
    letterSpacing: "-0.04em",
    wordBreak: "break-word",
  },
  statusPillDark: {
    padding: "7px 11px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.2)",
    background: "rgba(255,255,255,0.12)",
    color: "#ffffff",
    fontSize: 13,
    fontWeight: 900,
  },
  heroSlug: {
    margin: "8px 0 0",
    color: "#cbd5e1",
    fontSize: 14,
    fontWeight: 700,
    wordBreak: "break-word",
  },
  heroDescription: {
    margin: "12px 0 0",
    color: "#e2e8f0",
    lineHeight: 1.55,
    maxWidth: 720,
  },
  heroImageWrap: {
    borderRadius: 18,
    background: "#1e293b",
    border: "1px solid rgba(255,255,255,0.12)",
    overflow: "hidden",
    minHeight: 180,
  },
  heroImageEmpty: {
    height: "100%",
    minHeight: 180,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 46,
    color: "#94a3b8",
  },
  summaryGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
    gap: 12,
    marginBottom: 16,
  },
  summaryCard: {
    padding: 15,
    borderRadius: 18,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    boxShadow: "0 2px 12px rgba(15,23,42,0.04)",
  },
  summaryLabel: {
    color: "#64748b",
    fontSize: 12,
    fontWeight: 900,
  },
  summaryValue: {
    color: "#0f172a",
    fontSize: 22,
    fontWeight: 900,
    marginTop: 5,
    wordBreak: "break-word",
  },
  section: {
    padding: 18,
    borderRadius: 22,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    boxShadow: "0 2px 12px rgba(15,23,42,0.04)",
    marginBottom: 16,
  },
  sectionHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "flex-start",
    flexWrap: "wrap",
    marginBottom: 16,
  },
  sectionTitle: {
    margin: 0,
    color: "#0f172a",
    fontSize: 22,
    letterSpacing: "-0.02em",
  },
  sectionDescription: {
    margin: "5px 0 0",
    color: "#64748b",
    fontSize: 14,
    lineHeight: 1.45,
  },
  submitButton: {
    display: "inline-flex",
    padding: "13px 20px",
    borderRadius: 999,
    background: "#1683f8",
    color: "#ffffff",
    fontWeight: 900,
    textDecoration: "none",
    boxShadow: "0 10px 20px rgba(22,131,248,0.22)",
  },
  tableWrap: {
    overflowX: "auto",
    border: "1px solid #e2e8f0",
    borderRadius: 16,
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
  },
  tableHeadRow: {
    background: "#f8fafc",
  },
  th: {
    textAlign: "left",
    padding: "14px 16px",
    fontSize: 12,
    color: "#64748b",
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    fontWeight: 900,
  },
  tr: {
    borderTop: "1px solid #e2e8f0",
  },
  td: {
    padding: "16px",
    verticalAlign: "middle",
  },
  tableTitle: {
    fontWeight: 900,
    color: "#0f172a",
  },
  tableSub: {
    color: "#64748b",
    fontSize: 13,
    marginTop: 3,
  },
  inlineLink: {
    color: "#1683f8",
    fontWeight: 900,
    textDecoration: "none",
  },
  editButton: {
    display: "inline-flex",
    borderRadius: 999,
    padding: "9px 13px",
    background: "#eff6ff",
    color: "#1d4ed8",
    fontWeight: 900,
    textDecoration: "none",
  },
  statusPill: {
    display: "inline-flex",
    padding: "7px 11px",
    borderRadius: 999,
    border: "1px solid",
    fontSize: 13,
    textTransform: "capitalize",
    fontWeight: 900,
  },
};
