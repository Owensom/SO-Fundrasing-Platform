import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import type { AdminRafflePurchasesResponse } from "../../types/raffles";

export default function AdminRaffleDetailsPage() {
  const { slug } = useParams<{ slug: string }>();

  const [data, setData] = useState<AdminRafflePurchasesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) {
      setError("Missing raffle slug.");
      setLoading(false);
      return;
    }

    let isMounted = true;

    async function loadAdminRaffleDetails() {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch(
          `/api/admin/raffles/${encodeURIComponent(slug)}/purchases`,
          {
            headers: {
              "x-tenant-slug": "demo-a",
            },
          }
        );

        const json = (await response.json()) as AdminRafflePurchasesResponse & {
          error?: string;
        };

        if (!response.ok) {
          throw new Error(json.error || "Failed to load raffle details.");
        }

        if (!isMounted) return;
        setData(json);
      } catch (err) {
        if (!isMounted) return;
        setError(
          err instanceof Error ? err.message : "Failed to load raffle details."
        );
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    void loadAdminRaffleDetails();

    return () => {
      isMounted = false;
    };
  }, [slug]);

  if (loading) {
    return <div style={styles.page}>Loading admin raffle details...</div>;
  }

  if (error || !data) {
    return (
      <div style={styles.page}>
        <h1 style={styles.title}>Raffle details</h1>
        <p style={styles.error}>{error || "Raffle not found."}</p>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <div>
          <p style={styles.eyebrow}>Admin</p>
          <h1 style={styles.title}>{data.raffle.title}</h1>
          <p style={styles.meta}>Slug: {data.raffle.slug}</p>
        </div>
        <div style={styles.badge}>{data.raffle.status}</div>
      </div>

      <div style={styles.summaryGrid}>
        <SummaryCard
          label="Total tickets"
          value={String(data.summary.totalTickets)}
        />
        <SummaryCard
          label="Sold tickets"
          value={String(data.summary.soldTickets)}
        />
        <SummaryCard
          label="Remaining tickets"
          value={String(data.summary.remainingTickets)}
        />
        <SummaryCard
          label="Purchase count"
          value={String(data.summary.purchaseCount)}
        />
      </div>

      <div style={styles.tableCard}>
        <h2 style={styles.sectionTitle}>Purchases</h2>

        {data.purchases.length === 0 ? (
          <p style={styles.emptyText}>No purchases yet.</p>
        ) : (
          <div style={styles.tableWrapper}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Date</th>
                  <th style={styles.th}>Name</th>
                  <th style={styles.th}>Email</th>
                  <th style={styles.th}>Qty</th>
                  <th style={styles.th}>Unit price</th>
                  <th style={styles.th}>Total</th>
                </tr>
              </thead>
              <tbody>
                {data.purchases.map((purchase) => (
                  <tr key={purchase.id}>
                    <td style={styles.td}>
                      {new Date(purchase.createdAt).toLocaleString()}
                    </td>
                    <td style={styles.td}>{purchase.customerName}</td>
                    <td style={styles.td}>{purchase.customerEmail}</td>
                    <td style={styles.td}>{purchase.quantity}</td>
                    <td style={styles.td}>${purchase.unitPrice.toFixed(2)}</td>
                    <td style={styles.td}>${purchase.totalPrice.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function SummaryCard({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div style={styles.summaryCard}>
      <div style={styles.summaryLabel}>{label}</div>
      <div style={styles.summaryValue}>{value}</div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    padding: 24,
    background: "#f6f7fb",
    minHeight: "100vh",
  },
  header: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 16,
    marginBottom: 24,
  },
  eyebrow: {
    margin: 0,
    fontSize: 14,
    textTransform: "uppercase",
    color: "#64748b",
    fontWeight: 700,
  },
  title: {
    margin: "8px 0",
    fontSize: 32,
  },
  meta: {
    margin: 0,
    color: "#475569",
  },
  badge: {
    borderRadius: 999,
    background: "#111827",
    color: "#fff",
    padding: "8px 12px",
    fontWeight: 700,
    textTransform: "capitalize",
  },
  summaryGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    gap: 16,
    marginBottom: 24,
  },
  summaryCard: {
    background: "#fff",
    borderRadius: 16,
    padding: 20,
    boxShadow: "0 8px 24px rgba(0,0,0,0.06)",
  },
  summaryLabel: {
    fontSize: 13,
    color: "#64748b",
    marginBottom: 8,
  },
  summaryValue: {
    fontSize: 28,
    fontWeight: 700,
  },
  tableCard: {
    background: "#fff",
    borderRadius: 16,
    padding: 20,
    boxShadow: "0 8px 24px rgba(0,0,0,0.06)",
  },
  sectionTitle: {
    marginTop: 0,
    marginBottom: 16,
    fontSize: 22,
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
    padding: "12px 10px",
    borderBottom: "1px solid #f1f5f9",
  },
  error: {
    color: "#991b1b",
  },
  emptyText: {
    color: "#64748b",
  },
};
