import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import type { AdminRaffleListResponse } from "../types/raffles";

type AdminUser = {
  id: string;
  email: string;
  tenantSlug: string;
  role: "admin";
};

type AdminRaffle = AdminRaffleListResponse["raffles"][number];

export default function AdminPage() {
  const user: AdminUser | null = useMemo(() => {
    return {
      id: "admin_demo_a",
      email: "admin@demo-a.com",
      tenantSlug: "demo-a",
      role: "admin",
    };
  }, []);

  const [raffles, setRaffles] = useState<AdminRaffle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const tenantSlug = user?.tenantSlug ?? "demo-a";
  const userEmail = user?.email ?? "Unknown admin";

  useEffect(() => {
    let isMounted = true;

    async function loadRaffles() {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch("/api/admin/raffles", {
          headers: {
            "x-tenant-slug": tenantSlug,
          },
        });

        const data = (await response.json()) as AdminRaffleListResponse & {
          error?: string;
        };

        if (!response.ok) {
          throw new Error(data.error || "Failed to load raffles.");
        }

        if (!isMounted) return;
        setRaffles(data.raffles);
      } catch (err) {
        if (!isMounted) return;
        setError(err instanceof Error ? err.message : "Failed to load raffles.");
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    void loadRaffles();

    return () => {
      isMounted = false;
    };
  }, [tenantSlug]);

  return (
    <main style={styles.page}>
      <div style={styles.container}>
        <section style={styles.heroCard}>
          <p style={styles.eyebrow}>Admin</p>
          <h1 style={styles.title}>Raffle Admin</h1>
          <p style={styles.description}>
            Manage raffles for your tenant and drill into raffle performance,
            ticket counts, and purchases.
          </p>

          <div style={styles.metaGrid}>
            <MetaCard label="Signed in as" value={userEmail} />
            <MetaCard label="Tenant" value={tenantSlug} />
            <MetaCard label="Role" value={user?.role ?? "admin"} />
            <MetaCard label="Module" value="Raffles" />
          </div>
        </section>

        <section style={styles.card}>
          <div style={styles.sectionHeader}>
            <h2 style={styles.sectionTitle}>Raffles</h2>
            <Link to="/raffles/spring-cash-raffle" style={styles.secondaryLink}>
              Open public demo
            </Link>
          </div>

          {loading ? <p style={styles.note}>Loading raffles...</p> : null}
          {error ? <p style={styles.error}>{error}</p> : null}

          {!loading && !error && raffles.length === 0 ? (
            <p style={styles.note}>No raffles found.</p>
          ) : null}

          {!loading && !error && raffles.length > 0 ? (
            <div style={styles.tableWrapper}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Title</th>
                    <th style={styles.th}>Status</th>
                    <th style={styles.th}>Price</th>
                    <th style={styles.th}>Sold</th>
                    <th style={styles.th}>Remaining</th>
                    <th style={styles.th}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {raffles.map((raffle) => (
                    <tr key={raffle.id}>
                      <td style={styles.td}>
                        <div style={styles.raffleTitle}>{raffle.title}</div>
                        <div style={styles.raffleSlug}>{raffle.slug}</div>
                      </td>
                      <td style={styles.td}>
                        <span style={styles.badge}>{raffle.status}</span>
                      </td>
                      <td style={styles.td}>${raffle.ticketPrice.toFixed(2)}</td>
                      <td style={styles.td}>{raffle.soldTickets}</td>
                      <td style={styles.td}>{raffle.remainingTickets}</td>
                      <td style={styles.td}>
                        <Link
                          to={`/admin/raffles/${raffle.slug}`}
                          style={styles.primaryLink}
                        >
                          View details
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </section>
      </div>
    </main>
  );
}

function MetaCard({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div style={styles.metaCard}>
      <div style={styles.metaLabel}>{label}</div>
      <div style={styles.metaValue}>{value}</div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    background: "#f6f7fb",
    padding: "32px 16px",
  },
  container: {
    maxWidth: 1100,
    margin: "0 auto",
    display: "grid",
    gap: 24,
  },
  heroCard: {
    background: "#ffffff",
    borderRadius: 16,
    padding: 24,
    boxShadow: "0 8px 24px rgba(0, 0, 0, 0.06)",
  },
  card: {
    background: "#ffffff",
    borderRadius: 16,
    padding: 24,
    boxShadow: "0 8px 24px rgba(0, 0, 0, 0.06)",
  },
  eyebrow: {
    margin: 0,
    color: "#64748b",
    fontSize: 14,
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
  },
  title: {
    margin: "8px 0 12px",
    fontSize: 34,
    lineHeight: 1.1,
  },
  description: {
    margin: 0,
    color: "#334155",
    lineHeight: 1.6,
    maxWidth: 800,
  },
  sectionHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 16,
  },
  sectionTitle: {
    margin: 0,
    fontSize: 24,
  },
  metaGrid: {
    marginTop: 20,
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    gap: 12,
  },
  metaCard: {
    border: "1px solid #e5e7eb",
    borderRadius: 12,
    padding: 16,
  },
  metaLabel: {
    fontSize: 13,
    color: "#64748b",
    marginBottom: 8,
  },
  metaValue: {
    fontSize: 20,
    fontWeight: 700,
    color: "#111827",
    wordBreak: "break-word",
  },
  tableWrapper: {
    overflowX: "auto",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
  },
  th: {
    textAlign: "left",
    padding: "12px 10px",
    borderBottom: "1px solid #e5e7eb",
    color: "#475569",
    fontSize: 14,
  },
  td: {
    padding: "14px 10px",
    borderBottom: "1px solid #f1f5f9",
    verticalAlign: "middle",
  },
  raffleTitle: {
    fontWeight: 700,
    color: "#111827",
  },
  raffleSlug: {
    fontSize: 13,
    color: "#64748b",
    marginTop: 4,
  },
  badge: {
    borderRadius: 999,
    background: "#111827",
    color: "#fff",
    padding: "6px 10px",
    fontWeight: 700,
    textTransform: "capitalize",
    display: "inline-block",
  },
  primaryLink: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    textDecoration: "none",
    borderRadius: 10,
    padding: "10px 14px",
    background: "#111827",
    color: "#ffffff",
    fontWeight: 700,
  },
  secondaryLink: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    textDecoration: "none",
    borderRadius: 10,
    padding: "10px 14px",
    background: "#e5e7eb",
    color: "#111827",
    fontWeight: 700,
  },
  note: {
    margin: 0,
    color: "#475569",
    lineHeight: 1.6,
  },
  error: {
    margin: 0,
    color: "#991b1b",
    lineHeight: 1.6,
  },
};
