"use client";

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

export default function TenantCampaignsPage({ params }: Props) {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadCampaigns() {
      try {
        setLoading(true);
        setError("");

        const res = await fetch(`/api/public/campaigns/${params.tenantSlug}`);
        const data = await res.json();

        if (!res.ok) {
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
  }, [params.tenantSlug]);

  if (loading) return <div style={styles.wrap}>Loading campaigns…</div>;
  if (error) return <div style={styles.wrap}>Error: {error}</div>;
  if (!campaigns.length) return <div style={styles.wrap}>No active campaigns found.</div>;

  return (
    <main style={styles.page}>
      <h1 style={styles.heading}>Active Campaigns</h1>
      <div style={styles.grid}>
        {campaigns.map((campaign) => (
          <Link
            key={campaign.id}
            href={`/${campaign.type}/${campaign.slug}`}
            style={styles.card}
          >
            {campaign.imageUrl && (
              <img
                src={campaign.imageUrl}
                alt={campaign.title}
                style={styles.image}
              />
            )}
            <div style={styles.cardBody}>
              <div style={styles.title}>{campaign.title}</div>
              <div style={styles.type}>{campaign.type.toUpperCase()}</div>
              {campaign.type === "raffle" && campaign.ticketPrice != null && (
                <div style={styles.price}>Ticket: £{(campaign.ticketPrice ?? 0).toFixed(2)}</div>
              )}
              {campaign.type === "squares" && campaign.gridSize != null && (
                <div style={styles.price}>Grid: {campaign.gridSize} squares</div>
              )}
            </div>
          </Link>
        ))}
      </div>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    padding: 24,
    maxWidth: 1100,
    margin: "0 auto",
    fontFamily: "Arial, sans-serif",
  },
  wrap: {
    padding: 24,
    textAlign: "center",
  },
  heading: {
    fontSize: 28,
    fontWeight: 700,
    marginBottom: 24,
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
    gap: 20,
  },
  card: {
    display: "block",
    borderRadius: 16,
    border: "1px solid #e2e8f0",
    textDecoration: "none",
    color: "#111827",
    overflow: "hidden",
    boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
    transition: "transform 0.2s",
  },
  image: {
    width: "100%",
    height: 140,
    objectFit: "cover",
    display: "block",
  },
  cardBody: {
    padding: 12,
    display: "grid",
    gap: 6,
  },
  title: {
    fontSize: 18,
    fontWeight: 700,
  },
  type: {
    fontSize: 12,
    fontWeight: 700,
    color: "#64748b",
  },
  price: {
    fontSize: 14,
    fontWeight: 600,
    marginTop: 4,
  },
};
