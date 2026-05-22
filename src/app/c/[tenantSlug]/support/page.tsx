import type { CSSProperties } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { queryOne } from "@/lib/db";
import { normalizeTenantSlug } from "@/lib/tenant";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type PageProps = {
  params: Promise<{
    tenantSlug: string;
  }>;
  searchParams?: Promise<{
    campaignType?: string;
    campaignId?: string;
    donation?: string;
  }>;
};

type CampaignType = "raffle" | "squares" | "event" | "auction" | "general";

type CampaignLookup = {
  id: string;
  title: string;
  slug: string | null;
  currency: string | null;
  description: string | null;
  image_url: string | null;
};

type TenantGiftAidSettings = {
  gift_aid_enabled: boolean | null;
  charity_registration_type: string | null;
  charity_registration_number: string | null;
};

function cleanText(value: unknown, fallback = "") {
  const clean = String(value ?? "").trim();
  return clean || fallback;
}

function cleanCampaignType(value: unknown): CampaignType {
  const clean = cleanText(value).toLowerCase();

  if (
    clean === "raffle" ||
    clean === "squares" ||
    clean === "event" ||
    clean === "auction"
  ) {
    return clean;
  }

  return "general";
}

function campaignTypeLabel(type: CampaignType) {
  if (type === "raffle") return "Raffle";
  if (type === "squares") return "Squares";
  if (type === "event") return "Event";
  if (type === "auction") return "Auction";
  return "General support";
}

function getCampaignPublicHref(type: CampaignType, slug: string | null) {
  if (!slug) return "";

  if (type === "raffle") return `/r/${slug}`;
  if (type === "squares") return `/s/${slug}`;
  if (type === "event") return `/e/${slug}`;
  if (type === "auction") return `/a/${slug}`;

  return "";
}

async function lookupCampaign(params: {
  tenantSlug: string;
  campaignType: CampaignType;
  campaignId: string;
}): Promise<CampaignLookup | null> {
  if (!params.campaignId || params.campaignType === "general") {
    return null;
  }

  if (params.campaignType === "raffle") {
    return queryOne<CampaignLookup>(
      `
        select
          id::text as id,
          title,
          slug,
          currency,
          description,
          image_url
        from raffles
        where id::text = $1
          and tenant_slug = $2
        limit 1
      `,
      [params.campaignId, params.tenantSlug],
    );
  }

  if (params.campaignType === "squares") {
    return queryOne<CampaignLookup>(
      `
        select
          id::text as id,
          title,
          slug,
          currency,
          description,
          image_url
        from squares_games
        where id::text = $1
          and tenant_slug = $2
        limit 1
      `,
      [params.campaignId, params.tenantSlug],
    );
  }

  if (params.campaignType === "event") {
    return queryOne<CampaignLookup>(
      `
        select
          id::text as id,
          title,
          slug,
          currency,
          description,
          image_url
        from events
        where id::text = $1
          and tenant_slug = $2
        limit 1
      `,
      [params.campaignId, params.tenantSlug],
    );
  }

  if (params.campaignType === "auction") {
    return queryOne<CampaignLookup>(
      `
        select
          id::text as id,
          title,
          slug,
          currency,
          description,
          image_url
        from silent_auctions
        where id::text = $1
          and tenant_slug = $2
        limit 1
      `,
      [params.campaignId, params.tenantSlug],
    );
  }

  return null;
}

async function getTenantGiftAidSettings(
  tenantSlug: string,
): Promise<TenantGiftAidSettings | null> {
  return queryOne<TenantGiftAidSettings>(
    `
      select
        gift_aid_enabled,
        charity_registration_type,
        charity_registration_number
      from tenant_settings
      where tenant_slug = $1
      limit 1
    `,
    [tenantSlug],
  );
}

function getStatusMessage(value: string | undefined) {
  if (value === "success") {
    return {
      tone: "success" as const,
      title: "Thank you — your donation was successful.",
      text: "Your support has been received securely through Stripe.",
    };
  }

  if (value === "cancelled") {
    return {
      tone: "warning" as const,
      title: "Donation checkout was cancelled.",
      text: "No payment was taken. You can try again below.",
    };
  }

  return null;
}

export default async function PublicSupportPage({
  params,
  searchParams,
}: PageProps) {
  const resolvedParams = await params;
  const resolvedSearchParams = searchParams ? await searchParams : {};

  const tenantSlug = normalizeTenantSlug(resolvedParams.tenantSlug);
  const campaignType = cleanCampaignType(resolvedSearchParams.campaignType);
  const campaignId = cleanText(resolvedSearchParams.campaignId);
  const statusMessage = getStatusMessage(resolvedSearchParams.donation);

  if (!tenantSlug) {
    notFound();
  }

  const [campaign, tenantGiftAidSettings] = await Promise.all([
    lookupCampaign({
      tenantSlug,
      campaignType,
      campaignId,
    }),
    getTenantGiftAidSettings(tenantSlug),
  ]);

  if (campaignType !== "general" && campaignId && !campaign) {
    notFound();
  }

  const giftAidEnabled = Boolean(tenantGiftAidSettings?.gift_aid_enabled);

  const campaignTitle =
    campaign?.title ||
    (campaignType === "general"
      ? "Support this cause"
      : "Support this campaign");

  const currency = cleanText(campaign?.currency, "GBP").toUpperCase();
  const publicHref = getCampaignPublicHref(campaignType, campaign?.slug || null);

  return (
    <main className="support-page" style={styles.page}>
      <style>{responsiveStyles}</style>

      <section className="support-hero" style={styles.hero}>
        <div style={styles.heroContent}>
          <Link href={`/c/${tenantSlug}`} style={styles.backLink}>
            ← Back to campaigns
          </Link>

          <div style={styles.badgeRow}>
            <span style={styles.badge}>Support campaign</span>
            <span style={styles.softBadge}>
              {campaignTypeLabel(campaignType)}
            </span>
          </div>

          <h1 style={styles.title}>{campaignTitle}</h1>

          <p style={styles.subtitle}>
            Make a simple donation to support this cause. This is separate from
            buying raffle tickets, squares, event tickets or auction bids.
          </p>

          {publicHref ? (
            <Link href={publicHref} style={styles.viewCampaignLink}>
              View campaign page
            </Link>
          ) : null}
        </div>

        <div style={styles.heroPanel}>
          <div style={styles.panelEyebrow}>Pure donation</div>
          <h2 style={styles.panelTitle}>No draw entry. No bid. No ticket.</h2>
          <p style={styles.panelText}>
            This payment is treated as a straightforward donation through the
            platform donation flow.
          </p>
        </div>
      </section>

      {statusMessage ? (
        <section
          style={{
            ...styles.statusCard,
            ...(statusMessage.tone === "success"
              ? styles.successCard
              : styles.warningCard),
          }}
        >
          <h2 style={styles.statusTitle}>{statusMessage.title}</h2>
          <p style={styles.statusText}>{statusMessage.text}</p>
        </section>
      ) : null}

      <section className="support-content-grid" style={styles.contentGrid}>
        <section style={styles.formCard}>
          <div style={styles.sectionEyebrow}>Donation details</div>
          <h2 style={styles.sectionTitle}>Choose your support amount</h2>

          <form
            action="/api/stripe/checkout/donation"
            method="post"
            style={styles.form}
          >
            <input type="hidden" name="tenantSlug" value={tenantSlug} />
            <input type="hidden" name="campaignType" value={campaignType} />
            <input
              type="hidden"
              name="campaignId"
              value={campaign?.id || campaignId}
            />
            <input type="hidden" name="campaignTitle" value={campaignTitle} />
            <input type="hidden" name="currency" value={currency} />

            <label style={styles.field}>
              <span style={styles.label}>Donation amount ({currency})</span>
              <select
                name="amount"
                defaultValue="10.00"
                required
                style={styles.input}
              >
                <option value="5.00">£5</option>
                <option value="10.00">£10</option>
                <option value="25.00">£25</option>
                <option value="50.00">£50</option>
                <option value="100.00">£100</option>
              </select>
            </label>

            <label style={styles.coverFeesBox}>
              <input
                type="checkbox"
                name="coverFees"
                value="yes"
                defaultChecked
                style={styles.checkbox}
              />

              <span style={styles.coverFeesText}>
                <strong>Help cover platform and payment costs</strong>
                <span>
                  Add a small contribution so more of your donation reaches the
                  organisation.
                </span>
              </span>
            </label>

            <label style={styles.field}>
              <span style={styles.label}>Your name</span>
              <input
                name="donorName"
                autoComplete="name"
                placeholder="Optional"
                style={styles.input}
              />
            </label>

            <label style={styles.field}>
              <span style={styles.label}>Email address</span>
              <input
                name="donorEmail"
                type="email"
                autoComplete="email"
                required
                style={styles.input}
              />
            </label>

            <label style={styles.field}>
              <span style={styles.label}>Message</span>
              <textarea
                name="message"
                rows={4}
                placeholder="Optional message for the organiser"
                style={styles.textarea}
              />
            </label>

            {giftAidEnabled ? (
              <section style={styles.giftAidBox}>
                <label style={styles.giftAidToggle}>
                  <input
                    type="checkbox"
                    name="giftAidClaimed"
                    value="yes"
                    style={styles.checkbox}
                  />

                  <span style={styles.giftAidToggleText}>
                    <strong>Add Gift Aid to this donation</strong>
                    <span>
                      I am a UK taxpayer and want the charity to treat this
                      donation as a Gift Aid donation.
                    </span>
                  </span>
                </label>

                <div style={styles.giftAidNotice}>
                  <strong>Gift Aid declaration</strong>
                  <span>
                    I confirm that I am a UK taxpayer and understand that if I
                    pay less Income Tax and/or Capital Gains Tax than the amount
                    of Gift Aid claimed on all my donations in that tax year, it
                    is my responsibility to pay any difference.
                  </span>
                </div>

                <div className="gift-aid-grid" style={styles.giftAidGrid}>
                  <label style={styles.field}>
                    <span style={styles.label}>Gift Aid first name</span>
                    <input
                      name="giftAidFirstName"
                      autoComplete="given-name"
                      placeholder="Required if claiming Gift Aid"
                      style={styles.input}
                    />
                  </label>

                  <label style={styles.field}>
                    <span style={styles.label}>Gift Aid last name</span>
                    <input
                      name="giftAidLastName"
                      autoComplete="family-name"
                      placeholder="Required if claiming Gift Aid"
                      style={styles.input}
                    />
                  </label>
                </div>

                <label style={styles.field}>
                  <span style={styles.label}>Address line 1</span>
                  <input
                    name="giftAidAddressLine1"
                    autoComplete="address-line1"
                    placeholder="Required if claiming Gift Aid"
                    style={styles.input}
                  />
                </label>

                <label style={styles.field}>
                  <span style={styles.label}>Address line 2</span>
                  <input
                    name="giftAidAddressLine2"
                    autoComplete="address-line2"
                    placeholder="Optional"
                    style={styles.input}
                  />
                </label>

                <div className="gift-aid-grid" style={styles.giftAidGrid}>
                  <label style={styles.field}>
                    <span style={styles.label}>Town or city</span>
                    <input
                      name="giftAidTownOrCity"
                      autoComplete="address-level2"
                      placeholder="Required if claiming Gift Aid"
                      style={styles.input}
                    />
                  </label>

                  <label style={styles.field}>
                    <span style={styles.label}>Postcode</span>
                    <input
                      name="giftAidPostcode"
                      autoComplete="postal-code"
                      placeholder="Required if claiming Gift Aid"
                      style={styles.input}
                    />
                  </label>
                </div>
              </section>
            ) : null}

            <button type="submit" style={styles.primaryButton}>
              Continue to secure payment
            </button>
          </form>
        </section>

        <aside style={styles.infoCard}>
          <div style={styles.sectionEyebrow}>What this is</div>
          <h2 style={styles.infoTitle}>A simple support payment</h2>

          <div style={styles.infoList}>
            <div style={styles.infoItem}>
              <strong>Separate from campaign entry</strong>
              <span>
                This does not issue tickets, seats, squares, bids or entries.
              </span>
            </div>

            <div style={styles.infoItem}>
              <strong>Secure checkout</strong>
              <span>Payment is processed through Stripe.</span>
            </div>

            <div style={styles.infoItem}>
              <strong>Cover fees option</strong>
              <span>
                Donors can choose to add a small contribution to help cover
                platform and payment costs.
              </span>
            </div>

            {giftAidEnabled ? (
              <div style={styles.infoItem}>
                <strong>Gift Aid for pure donations</strong>
                <span>
                  Gift Aid is available only on this straightforward donation
                  flow. It is not applied to raffle tickets, squares, event
                  tickets, auction bids or competition-style payments.
                </span>
              </div>
            ) : null}
          </div>
        </aside>
      </section>
    </main>
  );
}

const responsiveStyles = `
.support-page,
.support-page * {
  box-sizing: border-box;
}

.support-page {
  overflow-x: hidden;
}

.support-page section,
.support-page div,
.support-page form,
.support-page label,
.support-page aside {
  min-width: 0;
}

@media (max-width: 860px) {
  .support-page .support-hero,
  .support-page .support-content-grid {
    grid-template-columns: 1fr !important;
  }
}

@media (max-width: 720px) {
  .support-page .gift-aid-grid {
    grid-template-columns: 1fr !important;
  }
}

@media (max-width: 620px) {
  .support-page {
    width: 100% !important;
    max-width: 100% !important;
    padding: 16px 10px 44px !important;
  }

  .support-page .support-hero {
    padding: 18px !important;
    border-radius: 24px !important;
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
      "radial-gradient(circle at top left, rgba(22,131,248,0.10), transparent 34%), #f8fafc",
    color: "#0f172a",
    boxSizing: "border-box",
    overflowX: "hidden",
  },

  hero: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1.15fr) minmax(280px, 0.85fr)",
    gap: 20,
    padding: 26,
    borderRadius: 30,
    background:
      "linear-gradient(135deg, #020617 0%, #0f172a 54%, #172554 100%)",
    color: "#ffffff",
    boxShadow: "0 24px 60px rgba(15,23,42,0.18)",
    marginBottom: 18,
    boxSizing: "border-box",
    overflow: "hidden",
  },

  heroContent: {
    minWidth: 0,
  },

  backLink: {
    display: "inline-flex",
    width: "fit-content",
    maxWidth: "100%",
    marginBottom: 14,
    padding: "10px 14px",
    borderRadius: 999,
    background: "rgba(255,255,255,0.10)",
    color: "#ffffff",
    border: "1px solid rgba(255,255,255,0.18)",
    textDecoration: "none",
    fontWeight: 900,
    fontSize: 13,
    boxSizing: "border-box",
  },

  badgeRow: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
    alignItems: "center",
    marginBottom: 14,
    minWidth: 0,
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
    fontSize: "clamp(38px, 7vw, 70px)",
    lineHeight: 0.96,
    letterSpacing: "-0.065em",
    overflowWrap: "anywhere",
  },

  subtitle: {
    margin: "16px 0 0",
    color: "#dbeafe",
    fontSize: 17,
    lineHeight: 1.6,
    fontWeight: 750,
    maxWidth: 760,
    overflowWrap: "anywhere",
  },

  viewCampaignLink: {
    display: "inline-flex",
    width: "fit-content",
    maxWidth: "100%",
    marginTop: 18,
    padding: "11px 15px",
    borderRadius: 999,
    background: "#ffffff",
    color: "#0f172a",
    textDecoration: "none",
    fontWeight: 950,
    boxSizing: "border-box",
  },

  heroPanel: {
    display: "grid",
    gap: 10,
    alignContent: "center",
    padding: 18,
    borderRadius: 24,
    background: "rgba(255,255,255,0.08)",
    border: "1px solid rgba(148,163,184,0.26)",
    minWidth: 0,
  },

  panelEyebrow: {
    color: "#facc15",
    fontSize: 12,
    fontWeight: 950,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
  },

  panelTitle: {
    margin: 0,
    color: "#ffffff",
    fontSize: 26,
    lineHeight: 1.05,
    letterSpacing: "-0.04em",
    overflowWrap: "anywhere",
  },

  panelText: {
    margin: 0,
    color: "#dbeafe",
    lineHeight: 1.55,
    fontWeight: 750,
    overflowWrap: "anywhere",
  },

  statusCard: {
    padding: 18,
    borderRadius: 22,
    marginBottom: 18,
    border: "1px solid transparent",
    boxSizing: "border-box",
  },

  successCard: {
    background: "#dcfce7",
    color: "#166534",
    borderColor: "#bbf7d0",
  },

  warningCard: {
    background: "#fff7ed",
    color: "#9a3412",
    borderColor: "#fed7aa",
  },

  statusTitle: {
    margin: 0,
    fontSize: 22,
    letterSpacing: "-0.03em",
    overflowWrap: "anywhere",
  },

  statusText: {
    margin: "7px 0 0",
    lineHeight: 1.55,
    fontWeight: 750,
    overflowWrap: "anywhere",
  },

  contentGrid: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1.1fr) minmax(280px, 0.9fr)",
    gap: 18,
    minWidth: 0,
  },

  formCard: {
    display: "grid",
    gap: 16,
    padding: 22,
    borderRadius: 26,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    boxShadow: "0 2px 12px rgba(15,23,42,0.04)",
    minWidth: 0,
    boxSizing: "border-box",
  },

  sectionEyebrow: {
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
    letterSpacing: "-0.045em",
    overflowWrap: "anywhere",
  },

  form: {
    display: "grid",
    gap: 14,
    minWidth: 0,
  },

  field: {
    display: "grid",
    gap: 7,
    minWidth: 0,
  },

  label: {
    color: "#334155",
    fontSize: 13,
    fontWeight: 950,
  },

  input: {
    width: "100%",
    minHeight: 48,
    borderRadius: 14,
    border: "1px solid #cbd5e1",
    padding: "11px 13px",
    fontSize: 16,
    boxSizing: "border-box",
    minWidth: 0,
    background: "#ffffff",
    color: "#0f172a",
  },

  textarea: {
    width: "100%",
    borderRadius: 14,
    border: "1px solid #cbd5e1",
    padding: "11px 13px",
    fontSize: 16,
    fontFamily: "inherit",
    boxSizing: "border-box",
    minWidth: 0,
    background: "#ffffff",
    color: "#0f172a",
  },

  coverFeesBox: {
    display: "flex",
    gap: 12,
    alignItems: "flex-start",
    padding: 14,
    borderRadius: 18,
    background: "#eff6ff",
    border: "1px solid #bfdbfe",
    color: "#1e3a8a",
    cursor: "pointer",
    minWidth: 0,
  },

  checkbox: {
    width: 18,
    height: 18,
    marginTop: 2,
    flex: "0 0 auto",
    accentColor: "#1683f8",
  },

  coverFeesText: {
    display: "grid",
    gap: 4,
    lineHeight: 1.45,
    fontSize: 14,
    fontWeight: 750,
    minWidth: 0,
  },

  giftAidBox: {
    display: "grid",
    gap: 14,
    padding: 16,
    borderRadius: 22,
    background:
      "linear-gradient(135deg, #fffbeb 0%, #ffffff 58%, #f8fafc 100%)",
    border: "1px solid #fde68a",
    boxShadow: "0 10px 24px rgba(217,119,6,0.06)",
    minWidth: 0,
  },

  giftAidToggle: {
    display: "flex",
    gap: 12,
    alignItems: "flex-start",
    cursor: "pointer",
    minWidth: 0,
  },

  giftAidToggleText: {
    display: "grid",
    gap: 4,
    color: "#92400e",
    lineHeight: 1.45,
    fontSize: 14,
    fontWeight: 750,
    minWidth: 0,
  },

  giftAidNotice: {
    display: "grid",
    gap: 5,
    padding: 14,
    borderRadius: 18,
    background: "#ffffff",
    border: "1px solid #fed7aa",
    color: "#7c2d12",
    fontSize: 13,
    lineHeight: 1.55,
    fontWeight: 750,
    minWidth: 0,
  },

  giftAidGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 12,
    minWidth: 0,
  },

  primaryButton: {
    minHeight: 50,
    padding: "13px 18px",
    borderRadius: 999,
    background: "#1683f8",
    color: "#ffffff",
    border: "none",
    fontSize: 16,
    fontWeight: 950,
    cursor: "pointer",
    boxShadow: "0 12px 24px rgba(22,131,248,0.22)",
  },

  infoCard: {
    display: "grid",
    gap: 16,
    alignContent: "start",
    padding: 22,
    borderRadius: 26,
    background:
      "linear-gradient(135deg, #ffffff 0%, #f8fafc 58%, #eff6ff 100%)",
    border: "1px solid #dbeafe",
    minWidth: 0,
    boxSizing: "border-box",
  },

  infoTitle: {
    margin: 0,
    fontSize: 28,
    letterSpacing: "-0.045em",
    overflowWrap: "anywhere",
  },

  infoList: {
    display: "grid",
    gap: 12,
    minWidth: 0,
  },

  infoItem: {
    display: "grid",
    gap: 4,
    padding: 14,
    borderRadius: 18,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    color: "#334155",
    lineHeight: 1.5,
    minWidth: 0,
    overflowWrap: "anywhere",
  },
};
