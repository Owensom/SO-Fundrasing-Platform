import type { CSSProperties } from "react";
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
  type: "raffle" | "squares" | "event" | "auction";
  title: string;
  slug: string;
  description?: string | null;
  imageUrl?: string | null;
  image_focus_x?: number | null;
  image_focus_y?: number | null;
  status: "draft" | "published" | "closed" | "drawn";
};

function normaliseFocus(value: number | null | undefined) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 50;
  return Math.max(0, Math.min(100, Math.round(number)));
}

function getDefaultImage(type: Campaign["type"]) {
  if (type === "raffle") return "/brand/so-default-raffles.png";
  if (type === "squares") return "/brand/so-default-squares.png";
  if (type === "event") return "/brand/so-default-events.png";
  if (type === "auction") return "/brand/so-default-auctions.png";
  return "/brand/so-logo-default-full.png";
}

function getImageStyle(campaign: Campaign): CSSProperties {
  const hasImage = Boolean(campaign.imageUrl);

  return {
    width: "100%",
    height: "100%",
    objectFit: hasImage ? "cover" : "contain",
    objectPosition: hasImage
      ? `${normaliseFocus(campaign.image_focus_x)}% ${normaliseFocus(
          campaign.image_focus_y,
        )}%`
      : "center",
    display: "block",
    padding: hasImage ? 0 : 22,
    boxSizing: "border-box",
    background: hasImage
      ? "#f1f5f9"
      : "linear-gradient(135deg, #ffffff 0%, #f8fafc 55%, #eff6ff 100%)",
  };
}

function getCampaignUrl(campaign: Campaign) {
  if (campaign.type === "raffle") return `/r/${campaign.slug}`;
  if (campaign.type === "squares") return `/s/${campaign.slug}`;
  if (campaign.type === "event") return `/e/${campaign.slug}`;
  if (campaign.type === "auction") return `/a/${campaign.slug}`;
  return "#";
}

function getTypeLabel(type: Campaign["type"]) {
  if (type === "raffle") return "Raffle";
  if (type === "squares") return "Squares";
  if (type === "event") return "Event";
  return "Auction";
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
        {adminReturn ? (
          <div style={{ marginBottom: 16 }}>
            <Link href={adminReturn} style={styles.adminBack}>
              ← Back to admin
            </Link>
          </div>
        ) : null}

        <div style={styles.badge}>Fundraising campaigns</div>

        <h1 className="so-brand-heading" style={styles.title}>
          Active Campaigns
        </h1>

        <p style={styles.subtitle}>
          Choose an active raffle, squares campaign, event, or auction to
          support.
        </p>

        <div style={styles.legalLinks}>
          <Link href={`/c/${tenantSlug}/terms`} style={styles.legalLink}>
            Terms of Use
          </Link>

          <Link href={`/c/${tenantSlug}/privacy`} style={styles.legalLink}>
            Privacy Policy
          </Link>
        </div>
      </section>

      {publicCampaigns.length === 0 ? (
        <section style={styles.emptyCard}>
          <h2 className="so-brand-card-title" style={{ margin: 0 }}>
            No active campaigns found
          </h2>
          <p style={styles.muted}>
            This organiser has no published campaigns at the moment.
          </p>
        </section>
      ) : (
        <section style={styles.grid}>
          {publicCampaigns.map((campaign) => (
            <Link
              key={`${campaign.type}-${campaign.id}`}
              href={getCampaignUrl(campaign)}
              style={styles.card}
            >
              <div style={styles.imageWrap}>
                <img
                  src={campaign.imageUrl || getDefaultImage(campaign.type)}
                  alt={campaign.title}
                  style={getImageStyle(campaign)}
                />
              </div>

              <div style={styles.cardBody}>
                <div style={styles.typePill}>{getTypeLabel(campaign.type)}</div>

                <h2 className="so-brand-card-title" style={styles.cardTitle}>
                  {campaign.title}
                </h2>

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

const styles: Record<string, CSSProperties> = {
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
  legalLinks: {
    marginTop: 16,
    display: "flex",
    gap: 12,
    flexWrap: "wrap",
  },
  legalLink: {
    display: "inline-flex",
    padding: "9px 13px",
    borderRadius: 999,
    background: "#ffffff",
    color: "#2563eb",
    border: "1px solid #bfdbfe",
    textDecoration: "none",
    fontWeight: 900,
    fontSize: 13,
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
    gridTemplateColumns: "1fr",
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
