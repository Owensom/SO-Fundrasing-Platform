// src/app/c/[tenantSlug]/page.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getAllCampaignsForTenant } from "@/lib/campaigns";

type CampaignType = "raffle" | "squares" | "event";

type Campaign = {
  id: string;
  type: CampaignType;
  title: string;
  slug: string;
  description?: string;
  imageUrl?: string;
  status: "draft" | "published" | "closed" | "drawn";
};

type Props = {
  params: { tenantSlug: string };
};

export default function CampaignsPage({ params }: Props) {
  const { tenantSlug } = params;
  const router = useRouter();

  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadCampaigns() {
      setLoading(true);
      setError("");

      try {
        const items = await getAllCampaignsForTenant(tenantSlug);
        // Only show published campaigns
        setCampaigns(items.filter((c) => c.status === "published"));
      } catch (err) {
        console.error("Failed to load campaigns:", err);
        setError("Failed to load campaigns.");
      } finally {
        setLoading(false);
      }
    }

    loadCampaigns();
  }, [tenantSlug]);

  if (loading) return <div style={{ padding: 24 }}>Loading campaigns…</div>;
  if (error) return <div style={{ padding: 24, color: "red" }}>{error}</div>;
  if (!campaigns.length) return <div style={{ padding: 24 }}>No active campaigns found.</div>;

  return (
    <main style={{ maxWidth: 1100, margin: "40px auto", padding: 16 }}>
      <h1 style={{ fontSize: 28, fontWeight: 800 }}>Active Campaigns</h1>

      <div style={{ display: "grid", gap: 16, marginTop: 20 }}>
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
              display: "grid",
              gridTemplateColumns: "120px 1fr",
              gap: 12,
              padding: 14,
              border: "1px solid #d1d5db",
              borderRadius: 12,
              textDecoration: "none",
              color: "#111827",
              alignItems: "center",
            }}
          >
            {campaign.imageUrl ? (
              <img
                src={campaign.imageUrl}
                alt={campaign.title}
                style={{ width: 120, height: 80, objectFit: "cover", borderRadius: 8 }}
              />
            ) : (
              <div
                style={{
                  width: 120,
                  height: 80,
                  background: "#f3f4f6",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: 8,
                  color: "#6b7280",
                  fontWeight: 700,
                }}
              >
                No Image
              </div>
            )}

            <div>
              <div style={{ fontSize: 18, fontWeight: 700 }}>{campaign.title}</div>
              {campaign.description ? (
                <div style={{ fontSize: 14, color: "#64748b", marginTop: 4 }}>
                  {campaign.description}
                </div>
              ) : null}
              <div style={{ marginTop: 6, fontSize: 12, color: "#475569" }}>
                Type: {campaign.type}, Status: {campaign.status}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </main>
  );
}
