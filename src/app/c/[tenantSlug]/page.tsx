// src/app/c/[tenantSlug]/page.tsx
import Link from "next/link";
import { getAllCampaignsForTenant } from "@/lib/campaigns";

type Params = {
  params: { tenantSlug: string };
};

type Campaign = {
  id: string;
  type: "raffle" | "squares" | "event";
  title: string;
  slug: string;
  status: "published" | "closed" | "draft" | "drawn";
  description?: string;
  imageUrl?: string;
};

export default async function TenantCampaignsPage({ params }: Params) {
  const { tenantSlug } = params;

  // Fetch campaigns for this tenant
  const campaigns: Campaign[] = await getAllCampaignsForTenant(tenantSlug);

  // Filter to only published campaigns
  const activeCampaigns = campaigns.filter(
    (c) => c.status === "published"
  );

  if (activeCampaigns.length === 0) {
    return (
      <main style={styles.page}>
        <div style={styles.container}>
          <h1>Tenant campaigns</h1>
          <p>No active campaigns available at this time.</p>
        </div>
      </main>
    );
  }

  return (
    <main style={styles.page}>
      <div style={styles.container}>
        <h1>Active campaigns</h1>
        <div style={styles.grid}>
          {activeCampaigns.map((c) => {
            const linkHref =
              c.type === "raffle"
                ? `/r/${c.slug}`
                : c.type === "squares"
                ? `/s/${c.slug}`
                : `/e/${c.slug}`;

            return (
              <Link key={c.id} href={linkHref} style={styles.card}>
                {c.imageUrl ? (
                  <img
                    src={c.imageUrl}
                    alt={c.title}
                    style={styles.cardImage}
                  />
                ) : null}
                <div style={styles.cardBody}>
                  <h2 style={styles.cardTitle}>{c.title}</h2>
                  {c.description ? (
                    <p style={styles.cardDescription}>{c.description}</p>
                  ) : null}
                  <span style={styles.cardType}>
                    {c.type.charAt(0).toUpperCase() + c.type.slice(1)}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: { minHeight: "100vh", padding: 24, background: "#f8fafc" },
  container: { maxWidth: 1100, margin: "0 auto" },
  grid: {
    display: "grid",
    gap: 16,
    gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))",
    marginTop: 16,
  },
  card: {
    display: "block",
    borderRadius: 12,
    overflow: "hidden",
    border: "1px solid #e2e8f0",
    background: "#ffffff",
    textDecoration: "none",
    color: "#111827",
    boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
  },
  cardImage: { width: "100%", height: 160, objectFit: "cover" },
  cardBody: { padding: 12 },
  cardTitle: { fontSize: 18, fontWeight: 700, marginBottom: 6 },
  cardDescription: { fontSize: 14, color: "#64748b", marginBottom: 6 },
  cardType: { fontSize: 12, fontWeight: 700, color: "#2563eb" },
};
