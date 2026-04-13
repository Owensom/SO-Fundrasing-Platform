import { useEffect, useState } from "react";
import type { AdminRafflePurchasesResponse } from "../../types/raffles";

export default function AdminRaffleDetailsPage() {
  const [data, setData] = useState<AdminRafflePurchasesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const slug = window.location.pathname.split("/").pop();

    if (!slug) {
      setError("Missing raffle slug.");
      setLoading(false);
      return;
    }

    async function load() {
      try {
        const response = await fetch(
          `/api/admin/raffle-details?slug=${encodeURIComponent(
            slug
          )}&tenantSlug=demo-a`,
          {
            headers: { "x-tenant-slug": "demo-a" },
          }
        );

        const raw = await response.text();
        const contentType = response.headers.get("content-type") || "";

        let json: any = null;
        if (contentType.includes("application/json")) {
          json = JSON.parse(raw);
        }

        if (!response.ok) {
          throw new Error(json?.error || raw);
        }

        setData(json);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error");
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, []);

  if (loading) return <div style={styles.page}>Loading...</div>;

  if (error || !data) {
    return (
      <div style={styles.page}>
        <h1>Raffle details</h1>
        <p style={styles.error}>{error || "Not found"}</p>
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

        <div>
          <a
            href={`/admin/raffles/${data.raffle.slug}/edit`}
            style={styles.editButton}
          >
            Edit raffle
          </a>
        </div>
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
          label="Remaining"
          value={String(data.summary.remainingTickets)}
        />
        <SummaryCard
          label="Purchases"
          value={String(data.summary.purchaseCount)}
        />
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
    <div style={styles.card}>
      <div style={styles.label}>{label}</div>
      <div style={styles.value}>{value}</div>
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
    justifyContent: "space-between",
    marginBottom: 24,
  },
  eyebrow: {
    fontSize: 14,
    textTransform: "uppercase",
    color: "#64748b",
  },
  title: {
    fontSize: 32,
  },
  meta: {
    color: "#475569",
  },
  editButton: {
    padding: "10px 14px",
    background: "#111827",
    color: "#fff",
    borderRadius: 8,
    textDecoration: "none",
  },
  summaryGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    gap: 16,
  },
  card: {
    background: "#fff",
    padding: 20,
    borderRadius: 12,
  },
  label: {
    color: "#64748b",
  },
  value: {
    fontSize: 24,
    fontWeight: 700,
  },
  error: {
    color: "red",
  },
};
