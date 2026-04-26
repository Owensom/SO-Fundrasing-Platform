import { useEffect, useState } from "react";
import Link from "next/link";

type Campaign = {
  id: string;
  slug: string;
  title: string;
  imageUrl: string;
  type: "raffle" | "squares" | "event";
  ticketPrice?: number;
  prizes?: any[];
  gridSize?: number;
};

type Props = {
  params: {
    tenantSlug: string;
  };
};

export default function TenantCampaignPage({ params }: Props) {
  const { tenantSlug } = params;
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadCampaigns() {
      try {
        setLoading(true);
        setError("");
        const res = await fetch(`/api/public/campaigns?tenantSlug=${tenantSlug}`);
        const data = await res.json();

        if (!res.ok || !data.ok) {
          throw new Error(data?.error || "Failed to load campaigns");
        }

        setCampaigns(data.campaigns ?? []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load campaigns");
      } finally {
        setLoading(false);
      }
    }

    loadCampaigns();
  }, [tenantSlug]);

  if (loading) return <div style={styles.wrap}>Loading campaigns…</div>;
  if (error) return <div style={styles.wrap}>Error: {error}</div>;
  if (!campaigns.length) return <div style={styles.wrap}>No campaigns found.</div>;

  return (
    <main style={styles.page}>
      <h1 style={{ textAlign: "center" }}>Active Campaigns</h1>

      <div style={styles.grid}>
        {campaigns.map((c) => {
          const url =
            c.type === "raffle"
              ? `/r/${c.slug}`
              : c.type === "squares"
                ? `/s/${c.slug}`
                : `/e/${c.slug}`;

          return (
            <Link key={c.id} href={url} style={styles.card}>
              {c.imageUrl ? (
                <img src={c.imageUrl} alt={c.title} style={styles.image} />
              ) : null}
              <div style={styles.cardContent}>
                <h2>{c.title}</h2>
                {c.type === "raffle" && c.ticketPrice != null ? (
                  <div>Ticket: £{c.ticketPrice.toFixed(2)}</div>
                ) : null}
                {c.type === "raffle" && c.prizes ? (
                  <div>Prizes: {c.prizes.length}</div>
                ) : null}
                {c.type === "squares" && c.gridSize ? (
                  <div>Grid: {c.gridSize}×{c.gridSize}</div>
                ) : null}
              </div>
            </Link>
          );
        })}
      </div>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    padding: 24,
    minHeight: "100vh",
    background: "#f8fafc",
  },
  wrap: {
    padding: 24,
    textAlign: "center",
  },
  grid: {
    display: "grid",
    gap: 20,
    gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))",
    marginTop: 24,
  },
  card: {
    background: "#ffffff",
    borderRadius: 16,
    boxShadow: "0 2px 12px rgba(0,0,0,0.05)",
    overflow: "hidden",
    textDecoration: "none",
    color: "#111827",
    display: "flex",
    flexDirection: "column",
    cursor: "pointer",
    transition: "transform 0.2s",
  },
  image: {
    width: "100%",
    height: 160,
    objectFit: "cover",
  },
  cardContent: {
    padding: 16,
    display: "grid",
    gap: 6,
  },
};
