"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Campaign = {
  id: string;
  type: "raffle" | "squares" | "event";
  title: string;
  description?: string;
  imageUrl?: string;
  slug: string;
  status: string;
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
    if (!tenantSlug) return;

    let cancelled = false;

    async function loadCampaigns() {
      setLoading(true);
      setError("");

      try {
        const res = await fetch(`/api/public/campaigns/${encodeURIComponent(tenantSlug)}`);
        const data = await res.json();

        if (!res.ok) {
          throw new Error(data?.error || "Failed to load campaigns");
        }

        if (!cancelled) {
          setCampaigns(data.campaigns ?? []);
        }
      } catch (err: any) {
        if (!cancelled) {
          setError(err.message || "Failed to load campaigns");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadCampaigns();

    return () => {
      cancelled = true;
    };
  }, [tenantSlug]);

  return (
    <div style={{ maxWidth: 1000, margin: "40px auto", padding: 16 }}>
      <h1>Active Campaigns</h1>

      {loading && <p>Loading campaigns…</p>}
      {error && <p style={{ color: "red" }}>{error}</p>}

      {!loading && campaigns.length === 0 && <p>No active campaigns found.</p>}

      <div style={{ display: "grid", gap: 20, marginTop: 20 }}>
        {campaigns.map((campaign) => (
          <Link
            key={campaign.id}
            href={
              campaign.type === "raffle"
                ? `/r/${campaign.slug}`
                : campaign.type === "squares"
                  ? `/s/${campaign.slug}`
                  : `/e/${campaign.slug}`
            }
            style={{
              display: "block",
              padding: 16,
              border: "1px solid #e2e8f0",
              borderRadius: 12,
              background: "#ffffff",
              textDecoration: "none",
              color: "#111827",
              transition: "box-shadow 0.2s",
            }}
          >
            {campaign.imageUrl && (
              <img
                src={campaign.imageUrl}
                alt={campaign.title}
                style={{ width: "100%", maxHeight: 240, objectFit: "cover", borderRadius: 8, marginBottom: 12 }}
              />
            )}
            <h2 style={{ margin: "0 0 8px" }}>{campaign.title}</h2>
            {campaign.description && <p style={{ margin: 0, color: "#475569" }}>{campaign.description}</p>}
            <span style={{ fontSize: 12, color: "#64748b" }}>{campaign.type.toUpperCase()}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
