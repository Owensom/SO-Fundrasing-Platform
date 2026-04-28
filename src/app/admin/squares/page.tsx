import type { CSSProperties } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getTenantSlugFromHeaders } from "@/lib/tenant";
import { listSquaresGames } from "../../../../api/_lib/squares-repo";

function formatMoney(cents: number | null | undefined, currency: string) {
  return `${(Number(cents || 0) / 100).toFixed(2)} ${currency || "GBP"}`;
}

function statusBadge(status: string | null | undefined) {
  const value = String(status || "draft").toLowerCase();

  const background =
    value === "published"
      ? "#dcfce7"
      : value === "closed"
        ? "#fee2e2"
        : value === "drawn"
          ? "#e0e7ff"
          : "#fef3c7";

  const color =
    value === "published"
      ? "#166534"
      : value === "closed"
        ? "#991b1b"
        : value === "drawn"
          ? "#3730a3"
          : "#92400e";

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        borderRadius: 999,
        padding: "4px 10px",
        fontSize: 13,
        fontWeight: 700,
        textTransform: "capitalize",
        background,
        color,
      }}
    >
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

  return (
    <main style={pageStyle}>
      <div style={headerStyle}>
        <div>
          <p style={{ margin: "0 0 10px" }}>
            <Link href="/admin" style={linkStyle}>
              ← Back to dashboard
            </Link>
          </p>

          <h1 style={titleStyle}>Squares Games</h1>

          <p style={subtitleStyle}>
            Create and manage football-style squares games for this tenant.
          </p>
        </div>

        <Link href="/admin/squares/new" style={primaryButtonStyle}>
          + Create squares game
        </Link>
      </div>

      <section style={statsGridStyle}>
        <div style={statCardStyle}>
          <div style={statLabelStyle}>Total games</div>
          <div style={statValueStyle}>{games.length}</div>
        </div>

        <div style={statCardStyle}>
          <div style={statLabelStyle}>Published</div>
          <div style={statValueStyle}>
            {
              games.filter(
                (game) => String(game.status || "").toLowerCase() === "published",
              ).length
            }
          </div>
        </div>

        <div style={statCardStyle}>
          <div style={statLabelStyle}>Total squares available</div>
          <div style={statValueStyle}>
            {games.reduce(
              (total, game) => total + Number(game.total_squares || 0),
              0,
            )}
          </div>
        </div>
      </section>

      {games.length === 0 ? (
        <section style={emptyStateStyle}>
          <h2 style={{ marginTop: 0 }}>No squares games yet</h2>
          <p style={{ color: "#64748b" }}>
            Create your first squares game to start selling numbered squares.
          </p>

          <Link href="/admin/squares/new" style={primaryButtonStyle}>
            Create squares game
          </Link>
        </section>
      ) : (
        <section style={tableShellStyle}>
          <table style={tableStyle}>
            <thead>
              <tr style={{ background: "#f8fafc" }}>
                <th style={thStyle}>Title</th>
                <th style={thStyle}>Status</th>
                <th style={thStyle}>Squares</th>
                <th style={thStyle}>Price</th>
                <th style={thStyle}>Public page</th>
                <th style={{ ...thStyle, textAlign: "right" }}>Actions</th>
              </tr>
            </thead>

            <tbody>
              {games.map((game) => (
                <tr key={game.id} style={trStyle}>
                  <td style={tdStyle}>
                    <div style={{ fontWeight: 900 }}>
                      {game.title || "Untitled squares game"}
                    </div>
                    <div style={{ color: "#64748b", fontSize: 13 }}>
                      /s/{game.slug}
                    </div>
                  </td>

                  <td style={tdStyle}>{statusBadge(game.status)}</td>

                  <td style={tdStyle}>
                    <strong>{Number(game.total_squares || 0)}</strong>
                  </td>

                  <td style={tdStyle}>
                    {formatMoney(
                      game.price_per_square_cents,
                      game.currency ?? "GBP",
                    )}
                  </td>

                  <td style={tdStyle}>
                    <a
                      href={`/s/${game.slug}`}
                      target="_blank"
                      rel="noreferrer"
                      style={linkStyle}
                    >
                      View live page ↗
                    </a>
                  </td>

                  <td style={{ ...tdStyle, textAlign: "right" }}>
                    <Link
                      href={`/admin/squares/${game.id}`}
                      style={editButtonStyle}
                    >
                      Edit
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </main>
  );
}

const pageStyle: CSSProperties = {
  maxWidth: 1120,
  margin: "40px auto",
  padding: 24,
  fontFamily:
    'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
};

const headerStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 16,
  alignItems: "flex-start",
  marginBottom: 24,
};

const titleStyle: CSSProperties = {
  margin: 0,
  fontSize: 36,
  lineHeight: 1.1,
  color: "#0f172a",
};

const subtitleStyle: CSSProperties = {
  marginTop: 10,
  color: "#64748b",
  maxWidth: 680,
};

const linkStyle: CSSProperties = {
  color: "#2563eb",
  fontWeight: 800,
  textDecoration: "none",
};

const primaryButtonStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  borderRadius: 12,
  padding: "12px 16px",
  background: "#111827",
  color: "white",
  fontWeight: 900,
  textDecoration: "none",
  whiteSpace: "nowrap",
  boxShadow: "0 8px 20px rgba(15, 23, 42, 0.14)",
};

const statsGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
  gap: 14,
  marginBottom: 22,
};

const statCardStyle: CSSProperties = {
  border: "1px solid #e5e7eb",
  borderRadius: 16,
  padding: 18,
  background: "#ffffff",
};

const statLabelStyle: CSSProperties = {
  color: "#64748b",
  fontSize: 14,
  fontWeight: 800,
};

const statValueStyle: CSSProperties = {
  fontSize: 30,
  fontWeight: 950,
  color: "#0f172a",
};

const emptyStateStyle: CSSProperties = {
  border: "1px dashed #cbd5e1",
  borderRadius: 18,
  padding: 32,
  background: "#f8fafc",
  textAlign: "center",
};

const tableShellStyle: CSSProperties = {
  border: "1px solid #e5e7eb",
  borderRadius: 18,
  overflow: "hidden",
  background: "#ffffff",
  boxShadow: "0 8px 24px rgba(15, 23, 42, 0.06)",
};

const tableStyle: CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
};

const thStyle: CSSProperties = {
  textAlign: "left",
  padding: "14px 16px",
  fontSize: 13,
  color: "#475569",
  textTransform: "uppercase",
  letterSpacing: "0.04em",
};

const trStyle: CSSProperties = {
  borderTop: "1px solid #e5e7eb",
};

const tdStyle: CSSProperties = {
  padding: "16px",
  verticalAlign: "middle",
};

const editButtonStyle: CSSProperties = {
  display: "inline-flex",
  borderRadius: 10,
  padding: "9px 12px",
  background: "#eff6ff",
  color: "#1d4ed8",
  fontWeight: 900,
  textDecoration: "none",
};
