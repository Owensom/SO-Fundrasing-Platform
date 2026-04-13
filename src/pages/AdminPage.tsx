import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { AdminRaffle } from "../types/raffles";

type AdminRafflesResponse = {
  raffles: AdminRaffle[];
  error?: string;
};

export default function AdminPage() {
  const [raffles, setRaffles] = useState<AdminRaffle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadRaffles() {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch("/api/admin/raffles", {
          headers: {
            "x-tenant-slug": "demo-a",
          },
        });

        const raw = await response.text();
        const contentType = response.headers.get("content-type") || "";

        let json: AdminRafflesResponse | null = null;

        if (contentType.includes("application/json")) {
          json = JSON.parse(raw) as AdminRafflesResponse;
        }

        if (!response.ok) {
          throw new Error(json?.error || raw || "Failed to load raffles.");
        }

        if (!json) {
          throw new Error("Admin API did not return JSON.");
        }

        if (!isMounted) return;
        setRaffles(json.raffles);
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
  }, []);

  return (
    <main style={styles.page}>
      <div style={styles.container}>
        <div style={styles.header}>
          <div>
            <p style={styles.eyebrow}>Admin</p>
            <h1 style={styles.title}>Raffles</h1>
          </div>
        </div>

        {loading ? (
          <div style={styles.card}>Loading raffles...</div>
        ) : error ? (
          <div style={styles.card}>
            <p style={styles.error}>{error}</p>
          </div>
        ) : raffles.length === 0 ? (
          <div style={styles.card}>
            <p style={styles.empty}>No raffles found.</p>
          </div>
        ) : (
          <div style={styles.grid}>
            {raffles.map((raffle) => (
              <div key={raffle.id} style={styles.card}>
                <p style={styles.badge}>{raffle.status}</p>
                <h2 style={styles.cardTitle}>{raffle.title}</h2>
                <p style={styles.meta}>Slug: {raffle.slug}</p>
                <p style={styles.meta}>
                  £{raffle.ticketPrice.toFixed(2)} per ticket
                </p>
                <p style={styles.meta}>
                  {raffle.remainingTickets} remaining of {raffle.totalTickets}
                </p>

                <div style={styles.actions}>
                  <Link
                    to={`/admin/raffles/${raffle.slug}`}
                    style={styles.primaryLink}
                  >
                    View details
                  </Link>
                  <Link
                    to={`/raffles/${raffle.slug}`}
                    style={styles.secondaryLink}
                  >
                    Open public page
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
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
  },
  header: {
    marginBottom: 24,
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
    margin: "8px 0 0",
    fontSize: 34,
    lineHeight: 1.1,
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
    gap: 16,
  },
  card: {
    background: "#ffffff",
    borderRadius: 16,
    padding: 24,
    boxShadow: "0 8px 24px rgba(0, 0, 0, 0.06)",
  },
  badge: {
    display: "inline-block",
    margin: 0,
    marginBottom: 12,
    borderRadius: 999,
    background: "#111827",
    color: "#fff",
    padding: "6px 10px",
    fontWeight: 700,
    textTransform: "capitalize",
    fontSize: 12,
  },
  cardTitle: {
    margin: "0 0 8px",
    fontSize: 24,
  },
  meta: {
    margin: "6px 0",
    color: "#475569",
  },
  actions: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
    marginTop: 16,
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
  error: {
    color: "#991b1b",
    whiteSpace: "pre-wrap",
  },
  empty: {
    color: "#64748b",
    margin: 0,
  },
};
