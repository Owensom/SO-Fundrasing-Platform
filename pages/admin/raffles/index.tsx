import React, { useEffect, useState } from "react";
import Link from "next/link";

type Raffle = {
  id: string;
  slug: string;
  title: string;
  description?: string | null;
  status?: string | null;
  heroImageUrl?: string | null;
  raffleConfig?: {
    singleTicketPriceCents?: number;
    totalTickets?: number;
    soldTickets?: number;
    currencyCode?: string;
  };
};

function formatMoney(cents: number | undefined, currencyCode = "GBP") {
  const safeCents = Number.isFinite(cents) ? Number(cents) : 0;
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: currencyCode || "GBP",
  }).format(safeCents / 100);
}

export default function AdminRafflesIndexPage() {
  const [raffles, setRaffles] = useState<Raffle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError("");

      try {
        const res = await fetch("/api/admin/raffles?tenantSlug=demo-a");
        const json = await res.json();

        if (!res.ok) {
          throw new Error(json?.error || "Failed to load raffles");
        }

        setRaffles(Array.isArray(json?.raffles) ? json.raffles : []);
      } catch (err: any) {
        setError(err.message || "Failed to load raffles");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <div style={styles.headerRow}>
          <h1 style={styles.heading}>Raffles</h1>
          <Link href="/admin/raffles/create" style={styles.createButton}>
            Create raffle
          </Link>
        </div>

        {loading ? <div style={styles.card}>Loading raffles...</div> : null}

        {!loading && error ? <div style={styles.error}>{error}</div> : null}

        {!loading && !error && raffles.length === 0 ? (
          <div style={styles.card}>No raffles found yet.</div>
        ) : null}

        {!loading && !error && raffles.length > 0 ? (
          <div style={styles.list}>
            {raffles.map((raffle) => (
              <div key={raffle.id} style={styles.card}>
                <div style={styles.cardHeader}>
                  <div>
                    <h2 style={styles.cardTitle}>{raffle.title || raffle.slug}</h2>
                    <div style={styles.metaRow}>
                      <span style={styles.badge}>{raffle.status || "draft"}</span>
                      <span style={styles.metaText}>Slug: {raffle.slug}</span>
                    </div>
                  </div>

                  <Link
                    href={`/admin/raffles/${encodeURIComponent(raffle.id)}`}
                    style={styles.editButton}
                  >
                    Open
                  </Link>
                </div>

                {raffle.description ? (
                  <p style={styles.description}>{raffle.description}</p>
                ) : null}

                <div style={styles.statsRow}>
                  <div style={styles.statBox}>
                    <div style={styles.statLabel}>Ticket price</div>
                    <div style={styles.statValue}>
                      {formatMoney(
                        raffle.raffleConfig?.singleTicketPriceCents,
                        raffle.raffleConfig?.currencyCode || "GBP"
                      )}
                    </div>
                  </div>

                  <div style={styles.statBox}>
                    <div style={styles.statLabel}>Total tickets</div>
                    <div style={styles.statValue}>
                      {raffle.raffleConfig?.totalTickets ?? 0}
                    </div>
                  </div>

                  <div style={styles.statBox}>
                    <div style={styles.statLabel}>Sold</div>
                    <div style={styles.statValue}>
                      {raffle.raffleConfig?.soldTickets ?? 0}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    background: "#f3f4f6",
    padding: 24,
  },
  container: {
    maxWidth: 1000,
    margin: "0 auto",
  },
  headerRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
    gap: 12,
  },
  heading: {
    margin: 0,
    fontSize: 30,
  },
  createButton: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    height: 42,
    padding: "0 14px",
    borderRadius: 10,
    background: "#2563eb",
    color: "#fff",
    textDecoration: "none",
    fontWeight: 700,
  },
  list: {
    display: "flex",
    flexDirection: "column",
    gap: 16,
  },
  card: {
    background: "#fff",
    border: "1px solid #e5e7eb",
    borderRadius: 14,
    padding: 18,
  },
  cardHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 16,
  },
  cardTitle: {
    margin: 0,
    fontSize: 22,
  },
  metaRow: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
    marginTop: 8,
    alignItems: "center",
  },
  badge: {
    display: "inline-block",
    padding: "4px 8px",
    borderRadius: 999,
    background: "#eef2ff",
    color: "#3730a3",
    fontSize: 12,
    fontWeight: 700,
  },
  metaText: {
    color: "#6b7280",
    fontSize: 13,
  },
  editButton: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    height: 38,
    padding: "0 12px",
    borderRadius: 10,
    border: "1px solid #d1d5db",
    background: "#fff",
    color: "#111827",
    textDecoration: "none",
    fontWeight: 600,
  },
  description: {
    color: "#4b5563",
    marginTop: 12,
    marginBottom: 0,
  },
  statsRow: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: 12,
    marginTop: 16,
  },
  statBox: {
    background: "#f9fafb",
    border: "1px solid #e5e7eb",
    borderRadius: 10,
    padding: 12,
  },
  statLabel: {
    fontSize: 12,
    color: "#6b7280",
  },
  statValue: {
    marginTop: 4,
    fontSize: 20,
    fontWeight: 700,
  },
  error: {
    background: "#fef2f2",
    border: "1px solid #fecaca",
    color: "#b91c1c",
    padding: 12,
    borderRadius: 10,
  },
};
