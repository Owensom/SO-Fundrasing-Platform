// src/app/c/[tenantSlug]/contact/page.tsx
// ===============================
// Public customer/supporter → tenant contact page
// Phase 5E.1B
// Branded public route, tenant contact email only
// No platform-owner support dashboard changes
// No database storage yet
// No checkout/campaign changes
// ===============================

import type { CSSProperties } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { queryOne } from "@/lib/db";
import { normalizeTenantSlug } from "@/lib/tenant";
import { sendCustomerContactEmail } from "@/lib/customer-contact-email";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type PageProps = {
  params: Promise<{
    tenantSlug: string;
  }>;
  searchParams?: Promise<{
    campaignType?: string;
    campaignId?: string;
    pageUrl?: string;
    contact?: string;
    message?: string;
  }>;
};

type CampaignType = "raffle" | "squares" | "event" | "auction" | "general";

type CampaignLookup = {
  id: string;
  title: string;
  slug: string | null;
  description: string | null;
  image_url: string | null;
};

type TenantContactSettings = {
  public_display_name: string | null;
  public_tagline: string | null;
  public_contact_name: string | null;
  public_contact_email: string | null;
  public_logo_url: string | null;
  public_logo_mark_url: string | null;
  public_primary_colour: string | null;
  public_accent_colour: string | null;
  public_footer_text: string | null;
};

function cleanText(value: unknown, fallback = "") {
  const clean = String(value ?? "").trim();
  return clean || fallback;
}

function cleanLimitedText(value: unknown, maxLength: number) {
  return cleanText(value).slice(0, maxLength);
}

function normaliseHexColour(value: unknown, fallback: string) {
  const clean = cleanText(value).toUpperCase();

  if (/^#[0-9A-F]{6}$/.test(clean)) {
    return clean;
  }

  return fallback;
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function cleanEmail(value: unknown) {
  const clean = cleanLimitedText(value, 254).toLowerCase();

  if (!clean) return "";

  return isValidEmail(clean) ? clean : "";
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
  return "General enquiry";
}

function getCampaignPublicHref(type: CampaignType, slug: string | null) {
  if (!slug) return "";

  if (type === "raffle") return `/r/${slug}`;
  if (type === "squares") return `/s/${slug}`;
  if (type === "event") return `/e/${slug}`;
  if (type === "auction") return `/a/${slug}`;

  return "";
}

function getContactRedirectHref({
  tenantSlug,
  status,
  campaignType,
  campaignId,
  pageUrl,
  message,
}: {
  tenantSlug: string;
  status: string;
  campaignType?: string | null;
  campaignId?: string | null;
  pageUrl?: string | null;
  message?: string | null;
}) {
  const params = new URLSearchParams();

  params.set("contact", status);

  if (campaignType) params.set("campaignType", campaignType);
  if (campaignId) params.set("campaignId", campaignId);
  if (pageUrl) params.set("pageUrl", pageUrl);
  if (message) params.set("message", message);

  return `/c/${tenantSlug}/contact?${params.toString()}`;
}

function getStatusMessage(value: string | undefined, message?: string) {
  if (value === "sent") {
    return {
      tone: "success" as const,
      title: "Message sent",
      text: "Your message has been sent to the organiser contact email for this campaign.",
    };
  }

  if (value === "validation_error") {
    return {
      tone: "error" as const,
      title: "Please check the form",
      text:
        cleanText(message) ||
        "Your name, email address, subject and message are required.",
    };
  }

  if (value === "no_contact") {
    return {
      tone: "warning" as const,
      title: "Contact is not available yet",
      text: "This organiser has not added a public contact email address yet.",
    };
  }

  if (value === "email_failed") {
    return {
      tone: "error" as const,
      title: "Message could not be sent",
      text: "Something went wrong while sending your message. Please try again later.",
    };
  }

  return null;
}

async function getTenantContactSettings(
  tenantSlug: string,
): Promise<TenantContactSettings | null> {
  return queryOne<TenantContactSettings>(
    `
      select
        public_display_name,
        public_tagline,
        public_contact_name,
        public_contact_email,
        public_logo_url,
        public_logo_mark_url,
        public_primary_colour,
        public_accent_colour,
        public_footer_text
      from tenant_settings
      where tenant_slug = $1
      limit 1
    `,
    [tenantSlug],
  );
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

async function sendPublicContactMessage(formData: FormData) {
  "use server";

  const tenantSlug = normalizeTenantSlug(formData.get("tenantSlug") as string);
  const campaignType = cleanCampaignType(formData.get("campaignType"));
  const campaignId = cleanLimitedText(formData.get("campaignId"), 160);
  const pageUrl = cleanLimitedText(formData.get("pageUrl"), 600);
  const supporterName = cleanLimitedText(formData.get("supporterName"), 120);
  const supporterEmail = cleanEmail(formData.get("supporterEmail"));
  const subject = cleanLimitedText(formData.get("subject"), 180);
  const message = cleanLimitedText(formData.get("message"), 5000);

  if (!tenantSlug) {
    redirect("/");
  }

  if (!supporterName || !supporterEmail || !subject || !message) {
    redirect(
      getContactRedirectHref({
        tenantSlug,
        status: "validation_error",
        campaignType,
        campaignId,
        pageUrl,
        message: !supporterEmail
          ? "Please enter a valid email address."
          : "Please complete all required fields.",
      }),
    );
  }

  const [tenantSettings, campaign] = await Promise.all([
    getTenantContactSettings(tenantSlug),
    lookupCampaign({
      tenantSlug,
      campaignType,
      campaignId,
    }),
  ]);

  const tenantContactEmail = cleanEmail(tenantSettings?.public_contact_email);

  if (!tenantContactEmail) {
    redirect(
      getContactRedirectHref({
        tenantSlug,
        status: "no_contact",
        campaignType,
        campaignId,
        pageUrl,
      }),
    );
  }

  const tenantDisplayName =
    cleanText(tenantSettings?.public_display_name) || tenantSlug;

  try {
    await sendCustomerContactEmail({
      tenantSlug,
      tenantDisplayName,
      tenantContactEmail,
      tenantContactName: tenantSettings?.public_contact_name,
      supporterName,
      supporterEmail,
      subject,
      message,
      campaignType,
      campaignId,
      campaignTitle: campaign?.title || null,
      pageUrl,
    });
  } catch (error) {
    console.error("Customer contact email failed", error);

    redirect(
      getContactRedirectHref({
        tenantSlug,
        status: "email_failed",
        campaignType,
        campaignId,
        pageUrl,
      }),
    );
  }

  redirect(
    getContactRedirectHref({
      tenantSlug,
      status: "sent",
      campaignType,
      campaignId,
      pageUrl,
    }),
  );
}

export default async function PublicTenantContactPage({
  params,
  searchParams,
}: PageProps) {
  const resolvedParams = await params;
  const resolvedSearchParams = searchParams ? await searchParams : {};

  const tenantSlug = normalizeTenantSlug(resolvedParams.tenantSlug);
  const campaignType = cleanCampaignType(resolvedSearchParams.campaignType);
  const campaignId = cleanText(resolvedSearchParams.campaignId);
  const pageUrl = cleanText(resolvedSearchParams.pageUrl);
  const statusMessage = getStatusMessage(
    resolvedSearchParams.contact,
    resolvedSearchParams.message,
  );

  if (!tenantSlug) {
    notFound();
  }

  const [tenantSettings, campaign] = await Promise.all([
    getTenantContactSettings(tenantSlug),
    lookupCampaign({
      tenantSlug,
      campaignType,
      campaignId,
    }),
  ]);

  if (!tenantSettings) {
    notFound();
  }

  const publicDisplayName =
    cleanText(tenantSettings.public_display_name) || tenantSlug;

  const publicTagline =
    cleanText(tenantSettings.public_tagline) ||
    "Supporting causes through premium fundraising campaigns.";

  const publicContactName =
    cleanText(tenantSettings.public_contact_name) ||
    `${publicDisplayName} organiser`;

  const publicContactEmail = cleanEmail(tenantSettings.public_contact_email);

  const publicLogoUrl = cleanText(tenantSettings.public_logo_url);
  const publicLogoMarkUrl = cleanText(tenantSettings.public_logo_mark_url);
  const publicFooterText = cleanText(tenantSettings.public_footer_text);

  const primaryColour = normaliseHexColour(
    tenantSettings.public_primary_colour,
    "#1683F8",
  );

  const accentColour = normaliseHexColour(
    tenantSettings.public_accent_colour,
    "#FACC15",
  );

  const brandLogoSrc = publicLogoMarkUrl || publicLogoUrl;

  const campaignTitle =
    campaign?.title ||
    (campaignType === "general" ? "General enquiry" : "Campaign enquiry");

  const publicHref = getCampaignPublicHref(campaignType, campaign?.slug || null);

  const contactAvailable = Boolean(publicContactEmail);

  const brandedPageStyle: CSSProperties = {
    ...styles.page,
    background: `radial-gradient(circle at top left, ${accentColour}20, transparent 34%), radial-gradient(circle at 80% 8%, ${primaryColour}14, transparent 28%), #f8fafc`,
  };

  const brandedHeroStyle: CSSProperties = {
    ...styles.hero,
    background: `radial-gradient(circle at bottom right, ${primaryColour}30, transparent 42%), radial-gradient(circle at top left, ${accentColour}14, transparent 34%), linear-gradient(135deg, #020617 0%, #0f172a 58%, #172554 100%)`,
  };

  const brandedBrandFallbackStyle: CSSProperties = {
    ...styles.brandLogoFallback,
    background: primaryColour,
    borderColor: accentColour,
  };

  const brandedBadgeStyle: CSSProperties = {
    ...styles.badge,
    background: `${accentColour}24`,
    borderColor: `${accentColour}66`,
  };

  const brandedSoftBadgeStyle: CSSProperties = {
    ...styles.softBadge,
    borderColor: `${primaryColour}66`,
  };

  const brandedPrimaryButtonStyle: CSSProperties = {
    ...styles.primaryButton,
    background: contactAvailable ? primaryColour : "#94a3b8",
    boxShadow: contactAvailable ? `0 12px 24px ${primaryColour}36` : "none",
    cursor: contactAvailable ? "pointer" : "not-allowed",
  };

  const brandedSectionEyebrowStyle: CSSProperties = {
    ...styles.sectionEyebrow,
    color: primaryColour,
  };

  return (
    <main className="tenant-contact-page" style={brandedPageStyle}>
      <style>{responsiveStyles}</style>

      <section className="brandHeader" style={styles.brandHeader}>
        <div className="brandIdentity" style={styles.brandIdentity}>
          {brandLogoSrc ? (
            <div style={styles.brandLogoWrap}>
              <img
                src={brandLogoSrc}
                alt={publicDisplayName}
                style={styles.brandLogo}
              />
            </div>
          ) : (
            <div style={brandedBrandFallbackStyle}>
              {publicDisplayName.slice(0, 2).toUpperCase()}
            </div>
          )}

          <div style={styles.brandCopy}>
            <p style={{ ...styles.brandKicker, color: primaryColour }}>
              Contact organiser
            </p>
            <h1 style={styles.brandTitle}>{publicDisplayName}</h1>
            <p style={styles.brandTagline}>{publicTagline}</p>
          </div>
        </div>

        <div
          style={{
            ...styles.brandFeature,
            borderColor: `${accentColour}78`,
            background: `linear-gradient(135deg, ${accentColour}12, #ffffff 78%)`,
          }}
        >
          <span style={styles.brandFeatureKicker}>Public contact</span>
          <strong style={styles.brandFeatureTitle}>{publicContactName}</strong>
          <span style={styles.brandFeatureText}>
            {contactAvailable
              ? "Messages are sent directly to the organiser contact email."
              : "This organiser has not added a public contact email yet."}
          </span>
        </div>
      </section>

      <section className="tenant-contact-hero" style={brandedHeroStyle}>
        <div style={styles.heroContent}>
          <Link href={`/c/${tenantSlug}`} style={styles.backLink}>
            ← Back to campaigns
          </Link>

          <div style={styles.badgeRow}>
            <span style={brandedBadgeStyle}>Contact page</span>
            <span style={brandedSoftBadgeStyle}>
              {campaignTypeLabel(campaignType)}
            </span>
          </div>

          <h2 style={styles.title}>Contact the organiser</h2>

          <p style={styles.subtitle}>
            Send a message directly to the organiser for questions about this
            cause, campaign, booking, donation, raffle, event or auction.
          </p>

          {publicHref ? (
            <Link
              href={publicHref}
              style={{
                ...styles.viewCampaignLink,
                border: `1px solid ${accentColour}70`,
              }}
            >
              View campaign page
            </Link>
          ) : null}
        </div>

        <div
          style={{
            ...styles.heroPanel,
            borderColor: `${accentColour}48`,
          }}
        >
          <div style={{ ...styles.panelEyebrow, color: accentColour }}>
            Supporter message
          </div>
          <h2 style={styles.panelTitle}>{campaignTitle}</h2>
          <p style={styles.panelText}>
            This form contacts the tenant organiser. Platform technical support
            remains separate.
          </p>
        </div>
      </section>

      {statusMessage ? (
        <section
          style={{
            ...styles.statusCard,
            ...(statusMessage.tone === "success"
              ? styles.successCard
              : statusMessage.tone === "error"
                ? styles.errorCard
                : styles.warningCard),
          }}
        >
          <h2 style={styles.statusTitle}>{statusMessage.title}</h2>
          <p style={styles.statusText}>{statusMessage.text}</p>
        </section>
      ) : null}

      {!contactAvailable ? (
        <section style={styles.warningCard}>
          <h2 style={styles.statusTitle}>Contact form unavailable</h2>
          <p style={styles.statusText}>
            This organiser has not added a public contact email address yet.
            Please return to the campaign page for any available campaign
            information.
          </p>
        </section>
      ) : null}

      <section className="tenant-contact-content-grid" style={styles.contentGrid}>
        <section style={styles.formCard}>
          <div style={brandedSectionEyebrowStyle}>Send a message</div>
          <h2 style={styles.sectionTitle}>Contact details</h2>

          <form action={sendPublicContactMessage} style={styles.form}>
            <input type="hidden" name="tenantSlug" value={tenantSlug} />
            <input type="hidden" name="campaignType" value={campaignType} />
            <input
              type="hidden"
              name="campaignId"
              value={campaign?.id || campaignId}
            />
            <input type="hidden" name="pageUrl" value={pageUrl} />

            <label style={styles.field}>
              <span style={styles.label}>Your name</span>
              <input
                name="supporterName"
                autoComplete="name"
                required
                disabled={!contactAvailable}
                placeholder="Your name"
                style={styles.input}
              />
            </label>

            <label style={styles.field}>
              <span style={styles.label}>Your email address</span>
              <input
                name="supporterEmail"
                type="email"
                autoComplete="email"
                required
                disabled={!contactAvailable}
                placeholder="you@example.com"
                style={styles.input}
              />
              <span style={styles.helpText}>
                The organiser can reply directly to this address.
              </span>
            </label>

            <label style={styles.field}>
              <span style={styles.label}>Subject</span>
              <input
                name="subject"
                required
                maxLength={180}
                disabled={!contactAvailable}
                defaultValue={
                  campaignType === "general"
                    ? ""
                    : `Question about ${campaignTitle}`
                }
                placeholder="Brief summary of your question"
                style={styles.input}
              />
            </label>

            <label style={styles.field}>
              <span style={styles.label}>Message</span>
              <textarea
                name="message"
                required
                maxLength={5000}
                rows={7}
                disabled={!contactAvailable}
                placeholder="Write your message for the organiser."
                style={styles.textarea}
              />
            </label>

            <button
              type="submit"
              disabled={!contactAvailable}
              style={brandedPrimaryButtonStyle}
            >
              Send message
            </button>
          </form>
        </section>

        <aside
          style={{
            ...styles.infoCard,
            borderColor: `${primaryColour}24`,
          }}
        >
          <div style={brandedSectionEyebrowStyle}>Where this goes</div>
          <h2 style={styles.infoTitle}>Tenant organiser contact</h2>

          <div style={styles.infoList}>
            <div style={styles.infoItem}>
              <strong>Sent to organiser</strong>
              <span>
                Your message goes to the public contact address provided by this
                tenant.
              </span>
            </div>

            <div style={styles.infoItem}>
              <strong>Not platform support</strong>
              <span>
                This form is for campaign, booking, donation and organiser
                questions. Technical platform issues are handled separately.
              </span>
            </div>

            <div style={styles.infoItem}>
              <strong>Campaign context</strong>
              <span>
                If you arrived from a campaign, the campaign type and reference
                are included automatically.
              </span>
            </div>

            <div style={styles.infoItem}>
              <strong>Reply by email</strong>
              <span>
                The organiser can reply directly to the email address you
                provide.
              </span>
            </div>
          </div>
        </aside>
      </section>

      {publicFooterText ? (
        <footer
          style={{
            ...styles.footer,
            borderColor: `${accentColour}60`,
          }}
        >
          <p style={styles.footerText}>{publicFooterText}</p>
        </footer>
      ) : null}
    </main>
  );
}

const responsiveStyles = `
.tenant-contact-page,
.tenant-contact-page * {
  box-sizing: border-box;
}

.tenant-contact-page {
  overflow-x: hidden;
}

.tenant-contact-page section,
.tenant-contact-page div,
.tenant-contact-page form,
.tenant-contact-page label,
.tenant-contact-page aside,
.tenant-contact-page footer {
  min-width: 0;
}

@media (max-width: 980px) {
  .tenant-contact-page .brandHeader {
    grid-template-columns: 1fr !important;
  }
}

@media (max-width: 860px) {
  .tenant-contact-page .tenant-contact-hero,
  .tenant-contact-page .tenant-contact-content-grid {
    grid-template-columns: 1fr !important;
  }
}

@media (max-width: 620px) {
  .tenant-contact-page {
    width: 100% !important;
    max-width: 100% !important;
    padding: 16px 10px 44px !important;
  }

  .tenant-contact-page .brandHeader,
  .tenant-contact-page .tenant-contact-hero {
    padding: 14px !important;
    border-radius: 22px !important;
  }

  .tenant-contact-page .brandIdentity {
    grid-template-columns: 56px minmax(0, 1fr) !important;
  }

  .tenant-contact-page .brandLogoWrap,
  .tenant-contact-page .brandLogoFallback {
    width: 56px !important;
    height: 56px !important;
    border-radius: 16px !important;
  }

  .tenant-contact-page .brandTitle {
    font-size: clamp(24px, 8vw, 36px) !important;
    letter-spacing: -0.06em !important;
  }

  .tenant-contact-page a,
  .tenant-contact-page p,
  .tenant-contact-page h1,
  .tenant-contact-page h2,
  .tenant-contact-page strong,
  .tenant-contact-page span,
  .tenant-contact-page input,
  .tenant-contact-page textarea,
  .tenant-contact-page button {
    overflow-wrap: anywhere !important;
    word-break: break-word !important;
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
    color: "#0f172a",
    boxSizing: "border-box",
    overflowX: "hidden",
  },

  brandHeader: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) minmax(250px, 0.34fr)",
    gap: 14,
    alignItems: "stretch",
    padding: 14,
    borderRadius: 24,
    background: "rgba(255,255,255,0.94)",
    border: "1px solid #e2e8f0",
    boxShadow: "0 14px 38px rgba(15,23,42,0.07)",
    marginBottom: 12,
    backdropFilter: "blur(14px)",
  },

  brandIdentity: {
    display: "grid",
    gridTemplateColumns: "72px minmax(0, 1fr)",
    gap: 14,
    alignItems: "center",
    minWidth: 0,
  },

  brandLogoWrap: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: 72,
    height: 72,
    borderRadius: 18,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    overflow: "hidden",
    boxShadow: "0 10px 24px rgba(15,23,42,0.08)",
  },

  brandLogo: {
    display: "block",
    width: "100%",
    height: "100%",
    objectFit: "contain",
    padding: 7,
  },

  brandLogoFallback: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: 72,
    height: 72,
    borderRadius: 18,
    border: "2px solid",
    color: "#0f172a",
    fontSize: 22,
    fontWeight: 950,
    letterSpacing: "-0.05em",
  },

  brandCopy: {
    display: "grid",
    gap: 4,
    minWidth: 0,
  },

  brandKicker: {
    margin: 0,
    fontSize: 11,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
  },

  brandTitle: {
    margin: 0,
    color: "#0f172a",
    fontSize: "clamp(30px, 4.6vw, 50px)",
    lineHeight: 0.94,
    letterSpacing: "-0.075em",
    overflowWrap: "anywhere",
  },

  brandTagline: {
    margin: 0,
    color: "#475569",
    fontSize: 14,
    lineHeight: 1.35,
    fontWeight: 850,
    overflowWrap: "anywhere",
  },

  brandFeature: {
    display: "grid",
    gap: 5,
    alignContent: "center",
    padding: 12,
    borderRadius: 18,
    border: "1px solid",
    minWidth: 0,
  },

  brandFeatureKicker: {
    color: "#92400e",
    fontSize: 10,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
  },

  brandFeatureTitle: {
    color: "#0f172a",
    fontSize: 18,
    lineHeight: 1.1,
    letterSpacing: "-0.04em",
    overflowWrap: "anywhere",
  },

  brandFeatureText: {
    color: "#475569",
    fontSize: 12,
    lineHeight: 1.35,
    fontWeight: 750,
  },

  hero: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1.15fr) minmax(280px, 0.85fr)",
    gap: 20,
    padding: 26,
    borderRadius: 30,
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
    color: "#fef3c7",
    border: "1px solid",
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
    padding: 18,
    borderRadius: 22,
    marginBottom: 18,
    border: "1px solid #fed7aa",
    boxSizing: "border-box",
  },

  errorCard: {
    background: "#fee2e2",
    color: "#991b1b",
    borderColor: "#fecaca",
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

  helpText: {
    color: "#64748b",
    fontSize: 12,
    lineHeight: 1.45,
    fontWeight: 750,
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

  primaryButton: {
    minHeight: 50,
    padding: "13px 18px",
    borderRadius: 999,
    color: "#ffffff",
    border: "none",
    fontSize: 16,
    fontWeight: 950,
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

  footer: {
    marginTop: 20,
    padding: 16,
    borderRadius: 22,
    background: "#ffffff",
    border: "1px solid",
    textAlign: "center",
  },

  footerText: {
    margin: 0,
    color: "#64748b",
    fontWeight: 800,
    lineHeight: 1.5,
  },
};
