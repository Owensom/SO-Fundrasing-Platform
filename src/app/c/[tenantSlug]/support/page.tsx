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

  const campaign = await lookupCampaign({
    tenantSlug,
    campaignType,
    campaignId,
  });

  if (campaignType !== "general" && campaignId && !campaign) {
    notFound();
  }

  const campaignTitle =
    campaign?.title ||
    (campaignType === "general"
      ? "Support this cause"
      : "Support this campaign");

  const currency = cleanText(campaign?.currency, "GBP").toUpperCase();
  const publicHref = getCampaignPublicHref(campaignType, campaign?.slug || null);

  return (
    <main style={styles.page}>
      <section style={styles.hero}>
        <div style={styles.heroContent}>
          <Link href={`/c/${tenantSlug}`} style={styles.backLink}>
            ← Back to campaigns
          </Link>

          <div style={styles.badgeRow}>
            <span style={styles.badge}>Support campaign</span>
            <span style={styles.softBadge}>{campaignTypeLabel(campaignType)}</span>
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

      <section style={styles.contentGrid}>
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
            <input type="hidden" name="campaignId" value={campaign?.id || campaignId} />
            <input type="hidden" name="campaignTitle" value={campaignTitle} />
            <input type="hidden" name="currency" value={currency} />

            <label style={styles.field}>
              <span style={styles.label}>Donation amount ({currency})</span>
              <input
                name="amount"
                type="number"
                min="1"
                step="0.01"
                defaultValue="10.00"
                required
                style={styles.input}
              />
            </label>

            <div style={styles.quickAmounts}>
              <label style={styles.quickAmount}>
                <input type="radio" name="amount" value="5.00" />
                £5
              </label>

              <label style={styles.quickAmount}>
                <input type="radio" name="amount" value="10.00" defaultChecked />
                £10
              </label>

              <label style={styles.quickAmount}>
                <input type="radio" name="amount" value="25.00" />
                £25
              </label>

              <label style={styles.quickAmount}>
                <input type="radio" name="amount" value="50.00" />
                £50
              </label>
            </div>

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
              <strong>Gift Aid later</strong>
              <span>
                Gift Aid can be added safely to this pure donation flow later.
              </span>
            </div>
          </div>
        </aside>
      </section>
    </main>
  );
}

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
  },

  heroContent: {
    minWidth: 0,
  },

  backLink: {
    display: "inline-flex",
    width: "fit-content",
    marginBottom: 14,
    padding: "10px 14px",
    borderRadius: 999,
    background: "rgba(255,255,255,0.10)",
    color: "#ffffff",
    border: "1px solid rgba(255,255,255,0.18)",
    textDecoration: "none",
    fontWeight: 900,
    fontSize: 13,
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
  },

  viewCampaignLink: {
    display: "inline-flex",
    width: "fit-content",
    marginTop: 18,
    padding: "11px 15px",
    borderRadius: 999,
    background: "#ffffff",
    color: "#0f172a",
    textDecoration: "none",
    fontWeight: 950,
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
  },

  panelText: {
    margin: 0,
    color: "#dbeafe",
    lineHeight: 1.55,
    fontWeight: 750,
  },

  statusCard: {
    padding: 18,
    borderRadius: 22,
    marginBottom: 18,
    border: "1px solid transparent",
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
  },

  statusText: {
    margin: "7px 0 0",
    lineHeight: 1.55,
    fontWeight: 750,
  },

  contentGrid: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1.1fr) minmax(280px, 0.9fr)",
    gap: 18,
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
  },

  form: {
    display: "grid",
    gap: 14,
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
  },

  quickAmounts: {
    display: "grid",
    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
    gap: 10,
  },

  quickAmount: {
    display: "flex",
    gap: 8,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 44,
    padding: "10px",
    borderRadius: 999,
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    color: "#0f172a",
    fontWeight: 950,
    cursor: "pointer",
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
  },

  infoTitle: {
    margin: 0,
    fontSize: 28,
    letterSpacing: "-0.045em",
  },

  infoList: {
    display: "grid",
    gap: 12,
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
  },
};
