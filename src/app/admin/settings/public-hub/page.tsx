import type { CSSProperties } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { getAllCampaignsForTenant } from "@/lib/campaigns";
import { query, queryOne } from "@/lib/db";
import { getTenantSlugFromHeaders } from "@/lib/tenant";
import { getTenantSettings } from "@/lib/tenant-settings";
import {
  checkSubscriptionCapability,
  getMaximumActiveCampaignsForTier,
  normaliseSubscriptionTier,
} from "@/lib/subscription-capabilities";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type CampaignType = "raffle" | "squares" | "event" | "auction";

type Campaign = {
  id: string;
  type: CampaignType;
  title: string;
  slug: string;
  description?: string | null;
  imageUrl?: string | null;
  image_focus_x?: number | null;
  image_focus_y?: number | null;
  status: "draft" | "published" | "closed" | "drawn";
};

type SessionUserWithTenants = {
  tenantSlugs?: string[];
  isPlatformOwner?: boolean;
};

type HighlightedCampaignSettings = {
  highlighted_campaign_type: string | null;
  highlighted_campaign_id: string | null;
};

type TenantCampaignSettings = {
  subscription_tier?: string | null;
};

function cleanText(value: unknown) {
  return String(value || "").trim();
}

function isCampaignType(value: unknown): value is CampaignType {
  return (
    value === "raffle" ||
    value === "squares" ||
    value === "event" ||
    value === "auction"
  );
}

function getCampaignLabel(type: CampaignType) {
  if (type === "raffle") return "Raffle";
  if (type === "squares") return "Squares";
  if (type === "event") return "Event";
  if (type === "auction") return "Auction";

  return "Campaign";
}

function getCampaignUrl(campaign: Campaign) {
  if (campaign.type === "raffle") return `/r/${campaign.slug}`;
  if (campaign.type === "squares") return `/s/${campaign.slug}`;
  if (campaign.type === "event") return `/e/${campaign.slug}`;
  if (campaign.type === "auction") return `/a/${campaign.slug}`;

  return "#";
}

function getSelectedValue(settings: HighlightedCampaignSettings | null) {
  const type = cleanText(settings?.highlighted_campaign_type);
  const id = cleanText(settings?.highlighted_campaign_id);

  if (!isCampaignType(type) || !id) {
    return "none";
  }

  return `${type}:${id}`;
}

function splitSelectedCampaign(value: unknown) {
  const selected = cleanText(value);

  if (!selected || selected === "none") {
    return {
      type: null as CampaignType | null,
      id: null as string | null,
    };
  }

  const [rawType, ...idParts] = selected.split(":");
  const id = idParts.join(":").trim();

  if (!isCampaignType(rawType) || !id) {
    return {
      type: null as CampaignType | null,
      id: null as string | null,
    };
  }

  return {
    type: rawType,
    id,
  };
}

async function requireCurrentTenantAccess() {
  const session = await auth();

  if (!session?.user) {
    redirect("/admin/login");
  }

  const tenantSlug = await getTenantSlugFromHeaders();

  const sessionUser = session.user as SessionUserWithTenants;

  const sessionTenantSlugs = Array.isArray(sessionUser.tenantSlugs)
    ? sessionUser.tenantSlugs.map((value) => String(value))
    : [];

  if (!tenantSlug || !sessionTenantSlugs.includes(tenantSlug)) {
    redirect("/admin/login?error=tenant_access_denied");
  }

  return {
    tenantSlug,
  };
}

async function getHighlightedCampaignSettings(tenantSlug: string) {
  return queryOne<HighlightedCampaignSettings>(
    `
      select
        highlighted_campaign_type,
        highlighted_campaign_id
      from tenant_settings
      where tenant_slug = $1
      limit 1
    `,
    [tenantSlug],
  );
}

async function getVisiblePublishedCampaigns(tenantSlug: string) {
  const campaigns: Campaign[] = await getAllCampaignsForTenant(tenantSlug);
  const tenantSettingsRaw = await getTenantSettings(tenantSlug);
  const tenantSettings = tenantSettingsRaw as TenantCampaignSettings | null;

  const subscriptionTier = normaliseSubscriptionTier(
    tenantSettings?.subscription_tier,
  );

  const maxPublicCampaigns = getMaximumActiveCampaignsForTier(subscriptionTier);

  const auctionCapability = checkSubscriptionCapability(
    tenantSettings,
    "auctions",
  );

  const capabilityFilteredPublishedCampaigns = campaigns.filter((campaign) => {
    if (campaign.status !== "published") {
      return false;
    }

    if (campaign.type === "auction" && !auctionCapability.allowed) {
      return false;
    }

    return true;
  });

  return Number.isFinite(maxPublicCampaigns)
    ? capabilityFilteredPublishedCampaigns.slice(0, maxPublicCampaigns)
    : capabilityFilteredPublishedCampaigns;
}

async function updateHighlightedCampaign(formData: FormData) {
  "use server";

  const access = await requireCurrentTenantAccess();
  const tenantSlug = access.tenantSlug;

  const selected = splitSelectedCampaign(formData.get("highlighted_campaign"));
  const visibleCampaigns = await getVisiblePublishedCampaigns(tenantSlug);

  if (selected.type && selected.id) {
    const selectedCampaign = visibleCampaigns.find(
      (campaign) =>
        campaign.type === selected.type && String(campaign.id) === selected.id,
    );

    if (!selectedCampaign) {
      redirect("/admin/settings/public-hub?error=invalid_campaign");
    }
  }

  await query(
    `
      insert into tenant_settings (
        tenant_slug,
        highlighted_campaign_type,
        highlighted_campaign_id
      )
      values ($1, $2, $3)
      on conflict (tenant_slug)
      do update set
        highlighted_campaign_type = excluded.highlighted_campaign_type,
        highlighted_campaign_id = excluded.highlighted_campaign_id,
        updated_at = now()
    `,
    [tenantSlug, selected.type, selected.id],
  );

  revalidatePath(`/c/${tenantSlug}`);
  revalidatePath("/admin/settings/public-hub");
  redirect("/admin/settings/public-hub?saved=1");
}

export default async function AdminPublicHubSettingsPage({
  searchParams,
}: {
  searchParams?: Promise<{
    saved?: string;
    error?: string;
  }>;
}) {
  const access = await requireCurrentTenantAccess();
  const tenantSlug = access.tenantSlug;
  const resolvedSearchParams = searchParams ? await searchParams : {};

  const [visibleCampaigns, highlightedSettings] = await Promise.all([
    getVisiblePublishedCampaigns(tenantSlug),
    getHighlightedCampaignSettings(tenantSlug),
  ]);

  const selectedValue = getSelectedValue(highlightedSettings);

  const selectedCampaign =
    visibleCampaigns.find(
      (campaign) => `${campaign.type}:${campaign.id}` === selectedValue,
    ) || null;

  const saved = resolvedSearchParams.saved === "1";
  const invalidCampaign = resolvedSearchParams.error === "invalid_campaign";

  return (
    <main className="public-hub-settings-page" style={styles.page}>
      <style>{responsiveStyles}</style>

      <section className="public-hub-hero" style={styles.hero}>
        <div>
          <Link href="/admin" style={styles.backLink}>
            ← Back to dashboard
          </Link>

          <div style={styles.badgeRow}>
            <span style={styles.badge}>Public campaign hub</span>
            <span style={styles.softBadge}>Highlighted campaign</span>
          </div>

          <h1 className="so-brand-heading public-hub-title" style={styles.title}>
            Public hub settings
          </h1>

          <p style={styles.subtitle}>
            Choose which published campaign appears as the large featured
            campaign at the top of the public tenant campaign page.
          </p>

          <p style={styles.tenant}>
            Tenant: <strong>{tenantSlug}</strong>
          </p>
        </div>

        <div style={styles.heroPanel}>
          <p style={styles.heroPanelEyebrow}>Current public page</p>

          <h2 style={styles.heroPanelTitle}>/c/{tenantSlug}</h2>

          <p style={styles.heroPanelText}>
            If no highlighted campaign is selected, the page automatically uses
            the first visible published campaign.
          </p>

          <Link
            href={`/c/${tenantSlug}?adminReturn=${encodeURIComponent(
              "/admin/settings/public-hub",
            )}`}
            target="_blank"
            style={styles.heroPanelButton}
          >
            View public hub →
          </Link>
        </div>
      </section>

      {saved ? (
        <section style={styles.successCard}>
          <strong>Highlighted campaign saved.</strong>
          <span>The public campaign hub has been updated.</span>
        </section>
      ) : null}

      {invalidCampaign ? (
        <section style={styles.errorCard}>
          <strong>Campaign could not be selected.</strong>
          <span>
            Please choose a published campaign that is visible for this tenant.
          </span>
        </section>
      ) : null}

      <section className="settings-grid" style={styles.settingsGrid}>
        <section className="form-card" style={styles.formCard}>
          <p style={styles.kicker}>Featured placement</p>

          <h2 style={styles.sectionTitle}>Choose highlighted campaign</h2>

          <p style={styles.sectionText}>
            Only published campaigns visible on the public hub are listed here.
            This avoids selecting a draft, closed, locked or hidden campaign.
          </p>

          <form action={updateHighlightedCampaign} style={styles.form}>
            <label style={styles.field}>
              <span style={styles.label}>Highlighted campaign</span>

              <select
                name="highlighted_campaign"
                defaultValue={selectedValue}
                style={styles.select}
              >
                <option value="none">
                  None — use first visible campaign automatically
                </option>

                {visibleCampaigns.map((campaign) => (
                  <option
                    key={`${campaign.type}-${campaign.id}`}
                    value={`${campaign.type}:${campaign.id}`}
                  >
                    {getCampaignLabel(campaign.type)} — {campaign.title}
                  </option>
                ))}
              </select>
            </label>

            <button type="submit" style={styles.primaryButton}>
              Save highlighted campaign
            </button>
          </form>
        </section>

        <aside className="preview-card" style={styles.previewCard}>
          <p style={styles.kicker}>Current selection</p>

          {selectedCampaign ? (
            <>
              <div style={styles.previewType}>
                {getCampaignLabel(selectedCampaign.type)}
              </div>

              <h2 style={styles.previewTitle}>{selectedCampaign.title}</h2>

              <p style={styles.previewText}>
                This campaign will appear in the large featured section of the
                public campaign hub.
              </p>

              <div className="preview-actions" style={styles.previewActions}>
                <Link
                  href={getCampaignUrl(selectedCampaign)}
                  target="_blank"
                  style={styles.previewPrimaryLink}
                >
                  View campaign →
                </Link>

                <Link
                  href={`/c/${tenantSlug}`}
                  target="_blank"
                  style={styles.previewSecondaryLink}
                >
                  View hub →
                </Link>
              </div>
            </>
          ) : (
            <>
              <div style={styles.previewType}>Automatic</div>

              <h2 style={styles.previewTitle}>First visible campaign</h2>

              <p style={styles.previewText}>
                No campaign is manually highlighted. The public hub will use the
                first published visible campaign as the featured card.
              </p>

              <Link
                href={`/c/${tenantSlug}`}
                target="_blank"
                style={styles.previewPrimaryLink}
              >
                View hub →
              </Link>
            </>
          )}
        </aside>
      </section>

      <section className="info-panel" style={styles.infoPanel}>
        <p style={styles.infoTitle}>Safe behaviour</p>

        <div className="info-grid" style={styles.infoGrid}>
          <InfoItem
            label="Published only"
            text="Draft, closed and hidden campaigns are not selectable."
          />

          <InfoItem
            label="Tenant isolated"
            text="Only campaigns belonging to this tenant are shown."
          />

          <InfoItem
            label="No payment changes"
            text="This only changes the featured display on the public hub."
          />
        </div>
      </section>
    </main>
  );
}

function InfoItem({ label, text }: { label: string; text: string }) {
  return (
    <div style={styles.infoItem}>
      <strong>{label}</strong>
      <span>{text}</span>
    </div>
  );
}

const responsiveStyles = `
.public-hub-settings-page,
.public-hub-settings-page * {
  box-sizing: border-box;
}

.public-hub-settings-page {
  overflow-x: hidden;
}

.public-hub-settings-page section,
.public-hub-settings-page div,
.public-hub-settings-page form,
.public-hub-settings-page label,
.public-hub-settings-page aside,
.public-hub-settings-page a {
  min-width: 0;
}

@media (max-width: 960px) {
  .public-hub-settings-page .public-hub-hero,
  .public-hub-settings-page .settings-grid {
    grid-template-columns: 1fr !important;
  }
}

@media (max-width: 680px) {
  .public-hub-settings-page {
    padding: 18px 12px 44px !important;
  }

  .public-hub-settings-page .public-hub-hero,
  .public-hub-settings-page .form-card,
  .public-hub-settings-page .preview-card,
  .public-hub-settings-page .info-panel {
    padding: 18px !important;
    border-radius: 24px !important;
  }

  .public-hub-settings-page .public-hub-title {
    font-size: clamp(38px, 11vw, 58px) !important;
    line-height: 0.98 !important;
  }

  .public-hub-settings-page .info-grid,
  .public-hub-settings-page .preview-actions {
    grid-template-columns: 1fr !important;
  }

  .public-hub-settings-page .preview-actions a {
    min-height: 46px !important;
    border-radius: 18px !important;
    justify-content: center !important;
    text-align: center !important;
    width: 100% !important;
  }
}
`;

const styles: Record<string, CSSProperties> = {
  page: {
    width: "100%",
    maxWidth: 1180,
    margin: "0 auto",
    padding: "28px 16px 64px",
    minHeight: "100vh",
    background:
      "radial-gradient(circle at top left, rgba(37,99,235,0.10), transparent 34%), radial-gradient(circle at top right, rgba(250,204,21,0.08), transparent 30%), #f8fafc",
    color: "#0f172a",
    boxSizing: "border-box",
    overflowX: "hidden",
  },

  hero: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1.15fr) minmax(280px, 0.85fr)",
    gap: 22,
    padding: 30,
    borderRadius: 34,
    background:
      "radial-gradient(circle at bottom right, rgba(37,99,235,0.22), transparent 38%), linear-gradient(135deg, #020617 0%, #0f172a 55%, #172554 100%)",
    color: "#ffffff",
    marginBottom: 18,
    boxShadow: "0 28px 70px rgba(15,23,42,0.22)",
    overflow: "hidden",
    border: "1px solid rgba(148,163,184,0.22)",
  },

  backLink: {
    display: "inline-flex",
    width: "fit-content",
    maxWidth: "100%",
    marginBottom: 16,
    padding: "10px 14px",
    borderRadius: 999,
    background: "rgba(255,255,255,0.08)",
    color: "#ffffff",
    border: "1px solid rgba(255,255,255,0.18)",
    textDecoration: "none",
    fontSize: 13,
    fontWeight: 950,
  },

  badgeRow: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
    alignItems: "center",
    marginBottom: 14,
  },

  badge: {
    display: "inline-flex",
    padding: "8px 12px",
    borderRadius: 999,
    background: "rgba(251,191,36,0.16)",
    color: "#fef3c7",
    border: "1px solid rgba(251,191,36,0.32)",
    fontSize: 13,
    fontWeight: 950,
  },

  softBadge: {
    display: "inline-flex",
    padding: "8px 12px",
    borderRadius: 999,
    background: "rgba(255,255,255,0.10)",
    color: "#dbeafe",
    border: "1px solid rgba(191,219,254,0.26)",
    fontSize: 13,
    fontWeight: 950,
  },

  title: {
    margin: 0,
    color: "#ffffff",
    fontSize: "clamp(52px, 7vw, 82px)",
    lineHeight: 0.92,
    letterSpacing: "-0.08em",
    overflowWrap: "anywhere",
    textShadow: "0 18px 45px rgba(0,0,0,0.22)",
  },

  subtitle: {
    margin: "18px 0 0",
    maxWidth: 760,
    color: "#dbeafe",
    fontSize: 18,
    lineHeight: 1.6,
    fontWeight: 700,
    overflowWrap: "anywhere",
  },

  tenant: {
    margin: "16px 0 0",
    color: "#bfdbfe",
    fontSize: 14,
    fontWeight: 850,
    overflowWrap: "anywhere",
  },

  heroPanel: {
    display: "grid",
    gap: 12,
    alignContent: "start",
    padding: 18,
    borderRadius: 24,
    background: "rgba(255,255,255,0.08)",
    border: "1px solid rgba(148,163,184,0.26)",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.10)",
    backdropFilter: "blur(12px)",
  },

  heroPanelEyebrow: {
    margin: 0,
    color: "#facc15",
    fontSize: 12,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
  },

  heroPanelTitle: {
    margin: 0,
    color: "#ffffff",
    fontSize: 26,
    lineHeight: 1.05,
    letterSpacing: "-0.04em",
    overflowWrap: "anywhere",
  },

  heroPanelText: {
    margin: 0,
    color: "#dbeafe",
    lineHeight: 1.55,
    fontWeight: 750,
    overflowWrap: "anywhere",
  },

  heroPanelButton: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: "fit-content",
    minHeight: 44,
    padding: "11px 16px",
    borderRadius: 999,
    background: "#ffffff",
    color: "#0f172a",
    textDecoration: "none",
    fontWeight: 950,
  },

  successCard: {
    display: "grid",
    gap: 4,
    padding: 16,
    borderRadius: 20,
    marginBottom: 16,
    background: "#dcfce7",
    color: "#166534",
    border: "1px solid #86efac",
    fontWeight: 800,
  },

  errorCard: {
    display: "grid",
    gap: 4,
    padding: 16,
    borderRadius: 20,
    marginBottom: 16,
    background: "#fee2e2",
    color: "#991b1b",
    border: "1px solid #fecaca",
    fontWeight: 800,
  },

  settingsGrid: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1.1fr) minmax(300px, 0.9fr)",
    gap: 16,
    marginBottom: 18,
  },

  formCard: {
    display: "grid",
    gap: 14,
    padding: 22,
    borderRadius: 28,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    boxShadow: "0 8px 30px rgba(15,23,42,0.05)",
  },

  kicker: {
    margin: 0,
    color: "#2563eb",
    fontSize: 12,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
  },

  sectionTitle: {
    margin: 0,
    color: "#0f172a",
    fontSize: 30,
    lineHeight: 1.05,
    letterSpacing: "-0.05em",
    overflowWrap: "anywhere",
  },

  sectionText: {
    margin: 0,
    color: "#64748b",
    lineHeight: 1.6,
    fontWeight: 700,
    overflowWrap: "anywhere",
  },

  form: {
    display: "grid",
    gap: 14,
  },

  field: {
    display: "grid",
    gap: 8,
  },

  label: {
    color: "#334155",
    fontSize: 13,
    fontWeight: 950,
  },

  select: {
    width: "100%",
    minHeight: 50,
    borderRadius: 16,
    border: "1px solid #cbd5e1",
    background: "#ffffff",
    color: "#0f172a",
    padding: "12px 13px",
    fontSize: 16,
    fontWeight: 750,
  },

  primaryButton: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: "fit-content",
    minHeight: 48,
    padding: "12px 18px",
    borderRadius: 999,
    background: "#1683f8",
    color: "#ffffff",
    border: "none",
    fontSize: 15,
    fontWeight: 950,
    cursor: "pointer",
    boxShadow: "0 12px 24px rgba(22,131,248,0.22)",
  },

  previewCard: {
    display: "grid",
    gap: 12,
    alignContent: "start",
    padding: 22,
    borderRadius: 28,
    background:
      "linear-gradient(135deg, #ffffff 0%, #f8fafc 58%, #eff6ff 100%)",
    border: "1px solid #dbeafe",
    boxShadow: "0 8px 30px rgba(15,23,42,0.04)",
  },

  previewType: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: "fit-content",
    maxWidth: "100%",
    padding: "6px 11px",
    borderRadius: 999,
    background: "#fffbeb",
    color: "#92400e",
    border: "1px solid #fde68a",
    fontSize: 11,
    lineHeight: 1.1,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
  },

  previewTitle: {
    margin: 0,
    color: "#0f172a",
    fontSize: "clamp(28px, 7vw, 38px)",
    lineHeight: 1,
    letterSpacing: "-0.06em",
    overflowWrap: "anywhere",
  },

  previewText: {
    margin: 0,
    color: "#64748b",
    lineHeight: 1.5,
    fontWeight: 700,
    overflowWrap: "anywhere",
  },

  previewActions: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 10,
  },

  previewPrimaryLink: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 44,
    padding: "10px 14px",
    borderRadius: 18,
    background: "#0f172a",
    color: "#ffffff",
    textDecoration: "none",
    fontWeight: 950,
    lineHeight: 1.15,
    textAlign: "center",
  },

  previewSecondaryLink: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 44,
    padding: "10px 14px",
    borderRadius: 18,
    background: "#ffffff",
    color: "#0f172a",
    border: "1px solid #cbd5e1",
    textDecoration: "none",
    fontWeight: 950,
    lineHeight: 1.15,
    textAlign: "center",
  },

  infoPanel: {
    display: "grid",
    gap: 14,
    padding: 22,
    borderRadius: 28,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    boxShadow: "0 8px 30px rgba(15,23,42,0.04)",
  },

  infoTitle: {
    margin: 0,
    color: "#0f172a",
    fontSize: 24,
    fontWeight: 950,
    letterSpacing: "-0.04em",
  },

  infoGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: 12,
  },

  infoItem: {
    display: "grid",
    gap: 5,
    padding: 14,
    borderRadius: 18,
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    color: "#475569",
    lineHeight: 1.5,
  },
};
