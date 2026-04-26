"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Campaign = {
  id: string;
  slug: string;
  title: string;
  description: string;
  imageUrl: string;
  type: "raffle" | "squares" | "event";
  startNumber?: number;
  endNumber?: number;
  size?: number;
  date?: string;
};

type Props = {
  params: {
    tenantSlug: string;
  };
};

export default function TenantCampaignsPage({ params }: Props) {
  const { tenantSlug } = params;
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        setError("");

        const res = await fetch(`/api/public/campaigns/${encodeURIComponent(tenantSlug)}`);
        const data = await res.json();

        if (!res.ok || !data.ok) {
          throw new Error(data?.error || "Failed to load campaigns");
        }

        setCampaigns(data.campaigns ?? []);
      } catch (err: any) {
        setError(err?.message || "Failed to load campaigns");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [tenantSlug]);

  if (loading) return <div style={styles.wrap}>Loading campaigns…</div>;
  if (error) return <div style={styles.wrap}>Error: {error}</div>;
  if (!campaigns.length) return <div style={styles.wrap}>No active campaigns found.</div>;

  return (
    <div style={styles.page}>
      <h1 style={styles.heading}>Active Campaigns</h1>
      <div style={styles.grid}>
        {campaigns.map((c) => {
          const link =
            c.type === "raffle"
              ? `/r/${c.slug}`
              : c.type === "squares"
              ? `/s/${c.slug}`
              : `/e/${c.slug}`; // future events page

          return (
            <Link key={c.id} href={link} style={styles.card}>
              {c.imageUrl ? (
                <img src={c.imageUrl} alt={c.title} style={styles.image} />
              ) : null}
              <div style={styles.cardContent}>
                <h2 style={styles.cardTitle}>{c.title}</h2>
                <p style={styles.cardDesc}>{c.description}</p>
                <span style={styles.cardType}>{c.type.toUpperCase()}</span>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    maxWidth: 1100,
    margin: "40px auto",
    padding: "0 16px",
    fontFamily: "Arial, sans-serif",
  },
  wrap: {
    padding: 24,
    textAlign: "center",
  },
  heading: {
    fontSize: 32,
    fontWeight: 900,
    marginBottom: 24,
    textAlign: "center",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
    gap: 20,
  },
  card: {
    display: "flex",
    flexDirection: "column",
    border: "1px solid #e2e8f0",
    borderRadius: 12,
    overflow: "hidden",
    textDecoration: "none",
    color: "#111827",
    cursor: "pointer",
    background: "#ffffff",
    transition: "transform 0.2s, box-shadow 0.2s",
  },
  cardContent: {
    padding: 16,
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: 800,
    margin: 0,
  },
  cardDesc: {
    fontSize: 14,
    color: "#64748b",
    flex: 1,
  },
  cardType: {
    fontSize: 12,
    fontWeight: 700,
    color: "#2563eb",
    textTransform: "uppercase",
  },
  image: {
    width: "100%",
    height: 180,
    objectFit: "cover",
    borderBottom: "1px solid #e2e8f0",
  },
};
