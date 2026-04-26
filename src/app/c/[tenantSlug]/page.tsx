"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Campaign = {
  id: string;
  slug: string;
  title: string;
  imageUrl?: string;
  type: "raffle" | "squares";
  ticketPrice?: number;
  gridSize?: number;
};

type Props = {
  params: { tenantSlug: string };
};

export default function CampaignPage({ params }: Props) {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadCampaigns() {
      setLoading(true);
      setError("");

      try {
        const res = await fetch(`/api/public/campaigns/${params.tenantSlug}`);
        const data = await res.json();

        if (!res.ok || !data.ok) {
          throw new Error(data?.error || "Failed to load campaigns");
        }

        setCampaigns(data.campaigns ?? []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    }

    loadCampaigns();
  }, [params.tenantSlug]);

  if (loading) return <div style={{ padding: 24 }}>Loading campaigns…</div>;
  if (error) return <div style={{ padding: 24, color: "red" }}>{error}</div>;
  if (!campaigns.length) return <div style={{ padding: 24 }}>No active campaigns.</div>;

  return (
    <main style={{ maxWidth: 1000, margin: "40px auto", padding: 16 }}>
      <h1>Active Campaigns</h1>
      <div style={{ display: "grid", gap: 16 }}>
        {campaigns.map((campaign) => (
          <Link
            key={campaign.id}
            href={`/${campaign.type === "raffle" ? "r" : "s"}/${campaign.slug}`}
            style={{
              display: "block",
              padding: 12,
              border: "1px solid #e2e8f0",
              borderRadius: 12,
              background: "#ffffff",
              textDecoration: "none",
              color: "#111827",
            }}
          >
            {campaign.imageUrl && (
              <img
                src={campaign.imageUrl}
                alt={campaign.title}
                style={{ width: "100%", maxHeight: 200, objectFit: "cover", borderRadius: 8 }}
              />
            )}
            <h2 style={{ margin: "8px 0" }}>{campaign.title}</h2>
            <div style={{ fontSize: 14, color: "#475569" }}>
              {campaign.type === "raffle" ? (
                <>Ticket price: £{campaign.ticketPrice?.toFixed(2) ?? "0.00"}</>
              ) : (
                <>Squares grid: {campaign.gridSize ?? "N/A"}</>
              )}
            </div>
          </Link>
        ))}
      </div>
    </main>
  );
}
