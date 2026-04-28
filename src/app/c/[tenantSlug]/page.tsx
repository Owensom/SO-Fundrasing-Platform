import Link from "next/link";
import { getAllCampaignsForTenant } from "@/lib/campaigns";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{
    tenantSlug: string;
  }>;
  searchParams?: {
    adminReturn?: string;
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

function getCampaignUrl(campaign: Campaign) {
  if (campaign.type === "raffle") return `/r/${campaign.slug}`;
  if (campaign.type === "squares") return `/s/${campaign.slug}`;
  if (campaign.type === "event") return `/e/${campaign.slug}`;
  return "#";
}

function getTypeLabel(type: Campaign["type"]) {
  if (type === "raffle") return "Raffle";
  if (type === "squares") return "Squares";
  return "Event";
}

function getSafeAdminReturn(value?: string) {
  if (!value) return "";
  if (value.startsWith("/admin/")) return value;
  return "";
}

export default async function TenantCampaignsPage({
  params,
  searchParams,
}: PageProps) {
  const { tenantSlug } = await params;

  const adminReturn = getSafeAdminReturn(searchParams?.adminReturn);

  const campaigns: Campaign[] = await getAllCampaignsForTenant(tenantSlug);

  const publicCampaigns = campaigns.filter(
    (campaign) => campaign.status === "published",
  );

  return (
    <main style={styles.page}>
      <section style={styles.header}>
        {/* ✅ NEW: admin back button */}
        {adminReturn ? (
          <div style={{ marginBottom: 16 }}>
            <Link href={adminReturn} style={styles.adminBack}>
              ← Back to admin raffles
            </Link>
          </div>
        ) : null}

        <div style={styles.badge}>Fundraising campaigns</div>

        <h1 style={styles.title}>Active Campaigns</h1>

        <p style={styles.subtitle}>
          Choose an active raffle or squares campaign to support.
        </p>
      </section>

      {publicCampaigns.length === 0 ? (
        <section style={styles.emptyCard}>
          <h2 style={{ margin: 0 }}>No active campaigns found</h2>
          <p style={styles.muted}>
            This tenant has no published campaigns at the moment.
          </p>
        </section>
      ) : (
        <section style={styles.grid}>
          {publicCampaigns.map((campaign) => (
            <Link
              key={campaign.id}
              href={getCampaignUrl(campaign)}
              style={styles.card}
            >
              <div style={styles.imageWrap}>
                {campaign.imageUrl ? (
                  <img
                    src={campaign.imageUrl}
                    alt={campaign.title}
                    style={styles.image}
                  />
                ) : (
                  <div style={styles.imageEmpty}>🎟️</div>
                )}
              </div>

              <div style={styles.cardBody}>
                <div style={styles.typePill}>{getTypeLabel(campaign.type)}</div>

                <h2 style={styles.cardTitle}>{campaign.title}</h2>

                {campaign.description ? (
                  <p style={styles.description}>
                    {campaign.description.length > 150
                      ? `${campaign.description.slice(0, 150)}…`
                      : campaign.description}
                  </p>
                ) : (
                  <p style={styles.descriptionMuted}>
                    No campaign description added yet.
                  </p>
                )}

                <div style={styles.button}>View campaign</div>
              </div>
            </Link>
          ))}
        </section>
      )}
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    background: "#f8fafc",
    padding: "32px 16px 56px",
  },
  header: {
    maxWidth: 1100,
    margin: "0 auto 24px",
  },
  adminBack: {
    display: "inline-flex",
    padding: "10px 14px",
    borderRadius: 999,
    background: "#0f172a",
    color: "#ffffff",
    textDecoration: "none",
    fontWeight: 800,
    fontSize: 14,
  },
  badge: {
    display: "inline-flex",
    padding: "6px 10px",
    borderRadius: 999,
    background: "#e0f2fe",
    color: "#0369a1",
    fontSize: 13,
    fontWeight: 900,
    marginBottom: 10,
  },
  title: {
    margin: 0,
    fontSize: 38,
    lineHeight: 1.1,
    letterSpacing: "-0.04em",
    color: "#0f172a",
  },
  subtitle: {
    margin: "10px 0 0",
    color: "#64748b",
    fontSize: 16,
    lineHeight: 1.55,
  },
  muted: {
    color: "#64748b",
    lineHeight: 1.55,
  },
grid: {
  maxWidth: 1100,
  margin: "0 auto",
  display: "grid",
  gap: 18,
  gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
},
card: {
  display: "grid",
  gridTemplateColumns: "1fr", // ✅ single column
  gap: 12,
  padding: 16,
  borderRadius: 22,
  border: "1px solid #e2e8f0",
  background: "#ffffff",
  textDecoration: "none",
  color: "#111827",
  boxShadow: "0 2px 12px rgba(15,23,42,0.04)",
},
imageWrap: {
  height: 180,
  borderRadius: 16,
  overflow: "hidden",
  background: "#f1f5f9",
  border: "1px solid #e2e8f0",
},
image: {
  width: "100%",
  height: "100%",
  objectFit: "cover",
  display: "block",
},

  imageEmpty: {
    height: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 42,
    color: "#94a3b8",
  },
  cardBody: {
    minWidth: 0,
    display: "grid",
    alignContent: "center",
    gap: 8,
  },
  typePill: {
    width: "fit-content",
    padding: "5px 9px",
    borderRadius: 999,
    background: "#ecfdf5",
    color: "#166534",
    fontSize: 12,
    fontWeight: 900,
  },
  cardTitle: {
    margin: 0,
    fontSize: 24,
    lineHeight: 1.2,
    color: "#0f172a",
    letterSpacing: "-0.02em",
    wordBreak: "break-word",
  },
  description: {
    margin: 0,
    color: "#475569",
    lineHeight: 1.5,
    wordBreak: "break-word",
  },
  descriptionMuted: {
    margin: 0,
    color: "#94a3b8",
    lineHeight: 1.5,
  },
  button: {
    width: "fit-content",
    marginTop: 6,
    padding: "10px 14px",
    borderRadius: 999,
    background: "#1683f8",
    color: "#ffffff",
    fontWeight: 900,
  },
  emptyCard: {
    maxWidth: 1100,
    margin: "0 auto",
    padding: 24,
    borderRadius: 22,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
  },
};
