// src/app/c/[tenantSlug]/page.tsx
import Link from "next/link";
import { getAllCampaignsForTenant } from "@/lib/campaigns";

type Params = {
  params: {
    tenantSlug: string;
  };
};

type Campaign = {
  id: string;
  type: "raffle" | "squares" | "event";
  title: string;
  slug: string;
  description?: string;
  imageUrl?: string;
  status: "draft" | "published" | "closed" | "drawn";
};

export default async function TenantCampaignsPage({ params }: Params) {
  const tenantSlug = params.tenantSlug;

  // Server-side DB call
  const campaigns: Campaign[] = await getAllCampaignsForTenant(tenantSlug);

  if (!campaigns.length) {
    return (
      <main style={{ maxWidth: 900, margin: "40px auto", padding: 16 }}>
        <h1>No active campaigns found</h1>
        <p>This tenant has no published campaigns at the moment.</p>
      </main>
    );
  }

  return (
    <main style={{ maxWidth: 1100, margin: "40px auto", padding: 16 }}>
      <h1 style={{ marginBottom: 24 }}>Active Campaigns</h1>

      <div style={{ display: "grid", gap: 24 }}>
        {campaigns
          .filter((c) => c.status === "published")
          .map((campaign) => {
            let url = "#";
            if (campaign.type === "raffle") url = `/r/${campaign.slug}`;
            else if (campaign.type === "squares") url = `/s/${campaign.slug}`;
            else if (campaign.type === "event") url = `/e/${campaign.slug}`;

            return (
              <Link
                key={campaign.id}
                href={url}
                style={{
                  display: "grid",
                  gridTemplateColumns: "200px 1fr",
                  gap: 16,
                  padding: 16,
                  borderRadius: 12,
                  border: "1px solid #e2e8f0",
                  background: "#ffffff",
                  textDecoration: "none",
                  color: "#111827",
                  alignItems: "center",
                }}
              >
                {campaign.imageUrl ? (
                  <img
                    src={campaign.imageUrl}
                    alt={campaign.title}
                    style={{
                      width: "100%",
                      maxHeight: 140,
                      objectFit: "cover",
                      borderRadius: 8,
                    }}
                  />
                ) : (
                  <div
                    style={{
                      width: "100%",
                      height: 140,
                      background: "#f0f0f0",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      borderRadius: 8,
                      fontWeight: 700,
                      color: "#64748b",
                    }}
                  >
                    No image
                  </div>
                )}

                <div>
                  <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>
                    {campaign.title}
                  </h2>
                  {campaign.description && (
                    <p style={{ margin: "6px 0 0", color: "#64748b" }}>
                      {campaign.description}
                    </p>
                  )}
                  <div
                    style={{
                      marginTop: 8,
                      fontSize: 12,
                      color: "#94a3b8",
                      fontWeight: 600,
                    }}
                  >
                    Type: {campaign.type.toUpperCase()}
                  </div>
                </div>
              </Link>
            );
          })}
      </div>
    </main>
  );
}
