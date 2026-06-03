// src/lib/customer-contact-email.ts
// ===============================
// Public customer/supporter → tenant contact email helper
// Separate from platform-owner support emails
// White branded tenant/contact email layout
// ===============================

import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

const CONTACT_EMAIL_LOGO_PATH = "/brand/contact-emails-gold.png";
const PLATFORM_LOGO_PATH = "/brand/contact-emails-gold.png";

const OWNER_PRIMARY_COLOUR = "#0F172A";
const OWNER_ACCENT_COLOUR = "#D4AF37";

type ContactEmailBranding = {
  advancedBranding?: boolean | null;
  displayName?: string | null;
  name?: string | null;
  logoUrl?: string | null;
  logoMarkUrl?: string | null;
  primaryColour?: string | null;
  primaryColor?: string | null;
  accentColour?: string | null;
  accentColor?: string | null;
  footerText?: string | null;
  public_display_name?: string | null;
  public_logo_url?: string | null;
  public_logo_mark_url?: string | null;
  public_primary_colour?: string | null;
  public_accent_colour?: string | null;
  public_footer_text?: string | null;
};

type ResolvedEmailBranding = {
  advancedBranding: boolean;
  displayName: string;
  logoUrl: string;
  primaryColour: string;
  accentColour: string;
  footerText: string;
};

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function cleanText(value: unknown, fallback = "—") {
  const clean = String(value ?? "").trim();
  return clean || fallback;
}

function cleanOptionalText(value: unknown) {
  return String(value ?? "").trim();
}

function getFromEmail() {
  return (
    process.env.RESEND_FROM_EMAIL?.trim() || "noreply@sofundraising.it.com"
  );
}

function getBaseUrl() {
  const explicit =
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    process.env.APP_URL?.trim();

  if (explicit) {
    return explicit.replace(/\/+$/, "");
  }

  const vercelProductionUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();

  if (vercelProductionUrl) {
    return `https://${vercelProductionUrl
      .replace(/^https?:\/\//, "")
      .replace(/\/+$/, "")}`;
  }

  const vercelUrl = process.env.VERCEL_URL?.trim();

  if (vercelUrl) {
    return `https://${vercelUrl
      .replace(/^https?:\/\//, "")
      .replace(/\/+$/, "")}`;
  }

  return "https://sofundraising.it.com";
}

function getAssetUrl(path: string) {
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  return `${getBaseUrl()}${cleanPath}`;
}

function resolveImageUrl(value: unknown, fallbackPath: string) {
  const clean = cleanOptionalText(value);

  if (!clean) {
    return getAssetUrl(fallbackPath);
  }

  if (clean.startsWith("https://") || clean.startsWith("http://")) {
    return clean;
  }

  if (clean.startsWith("/")) {
    return getAssetUrl(clean);
  }

  return getAssetUrl(fallbackPath);
}

function normaliseHexColour(value: unknown, fallback: string) {
  const clean = cleanOptionalText(value).toUpperCase();

  if (/^#[0-9A-F]{6}$/.test(clean)) {
    return clean;
  }

  return fallback;
}

function hasUsableBranding(branding?: ContactEmailBranding) {
  if (!branding) return false;

  return Boolean(
    branding.advancedBranding ||
      cleanOptionalText(branding.displayName) ||
      cleanOptionalText(branding.name) ||
      cleanOptionalText(branding.logoUrl) ||
      cleanOptionalText(branding.logoMarkUrl) ||
      cleanOptionalText(branding.primaryColour) ||
      cleanOptionalText(branding.primaryColor) ||
      cleanOptionalText(branding.accentColour) ||
      cleanOptionalText(branding.accentColor) ||
      cleanOptionalText(branding.footerText) ||
      cleanOptionalText(branding.public_display_name) ||
      cleanOptionalText(branding.public_logo_url) ||
      cleanOptionalText(branding.public_logo_mark_url) ||
      cleanOptionalText(branding.public_primary_colour) ||
      cleanOptionalText(branding.public_accent_colour) ||
      cleanOptionalText(branding.public_footer_text),
  );
}

function resolveEmailBranding({
  tenantDisplayName,
  branding,
}: {
  tenantDisplayName: string;
  branding?: ContactEmailBranding;
}): ResolvedEmailBranding {
  const hasTenantBranding = hasUsableBranding(branding);

  if (!hasTenantBranding) {
    return {
      advancedBranding: false,
      displayName: "SO Fundraising Platform",
      logoUrl: getAssetUrl(PLATFORM_LOGO_PATH),
      primaryColour: OWNER_PRIMARY_COLOUR,
      accentColour: OWNER_ACCENT_COLOUR,
      footerText: "",
    };
  }

  const displayName =
    cleanOptionalText(branding?.displayName) ||
    cleanOptionalText(branding?.name) ||
    cleanOptionalText(branding?.public_display_name) ||
    cleanOptionalText(tenantDisplayName) ||
    "Tenant organiser";

  const logoUrl = resolveImageUrl(
    cleanOptionalText(branding?.logoMarkUrl) ||
      cleanOptionalText(branding?.logoUrl) ||
      cleanOptionalText(branding?.public_logo_mark_url) ||
      cleanOptionalText(branding?.public_logo_url),
    CONTACT_EMAIL_LOGO_PATH,
  );

  return {
    advancedBranding: true,
    displayName,
    logoUrl,
    primaryColour: normaliseHexColour(
      branding?.primaryColour ||
        branding?.primaryColor ||
        branding?.public_primary_colour,
      OWNER_PRIMARY_COLOUR,
    ),
    accentColour: normaliseHexColour(
      branding?.accentColour ||
        branding?.accentColor ||
        branding?.public_accent_colour,
      OWNER_ACCENT_COLOUR,
    ),
    footerText:
      cleanOptionalText(branding?.footerText) ||
      cleanOptionalText(branding?.public_footer_text),
  };
}

function formatLabel(value: unknown) {
  const clean = cleanText(value, "general").toLowerCase();

  return clean
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function renderContactLogo(brand: ResolvedEmailBranding) {
  const logoMaxWidth = brand.advancedBranding ? 230 : 260;

  return `
    <div style="
      text-align:center;
      padding:30px 22px 22px;
      background:
        radial-gradient(circle at 8% 10%, ${escapeHtml(brand.accentColour)}24, transparent 30%),
        radial-gradient(circle at 92% 12%, ${escapeHtml(brand.primaryColour)}10, transparent 32%),
        linear-gradient(135deg,#ffffff 0%,#f8fafc 58%,#ffffff 100%);
      border-bottom:1px solid #e2e8f0;
    ">
      <div style="
        display:inline-block;
        max-width:${logoMaxWidth + 48}px;
        border-radius:24px;
        background:#ffffff;
        border:1px solid #e2e8f0;
        box-shadow:
          0 16px 38px rgba(15,23,42,0.10),
          inset 0 1px 0 rgba(255,255,255,0.92);
        padding:16px 20px;
      ">
        <img
          src="${escapeHtml(brand.logoUrl)}"
          alt="${escapeHtml(brand.displayName)}"
          width="${logoMaxWidth}"
          style="
            display:block;
            width:${logoMaxWidth}px;
            max-width:100%;
            height:auto;
            margin:0 auto;
            border:0;
            outline:none;
            text-decoration:none;
          "
        />
      </div>

      <div style="
        margin:14px auto 0;
        max-width:520px;
        color:${escapeHtml(brand.primaryColour)};
        font-size:18px;
        line-height:1.25;
        font-weight:900;
        letter-spacing:-0.03em;
        word-break:break-word;
        overflow-wrap:anywhere;
      ">
        ${escapeHtml(brand.displayName)}
      </div>
    </div>
  `;
}

function renderMetaCard(label: string, value: unknown) {
  return `
    <div class="meta-card" style="
      border:1px solid #e2e8f0;
      border-radius:16px;
      background:#ffffff;
      padding:13px 14px;
      overflow:hidden;
    ">
      <div style="
        color:#64748b;
        font-size:11px;
        line-height:1.25;
        font-weight:900;
        letter-spacing:0.08em;
        text-transform:uppercase;
        margin:0 0 6px;
      ">
        ${escapeHtml(label)}
      </div>

      <div style="
        color:#0f172a;
        font-size:14px;
        line-height:1.45;
        font-weight:800;
        word-break:break-word;
        overflow-wrap:anywhere;
      ">
        ${escapeHtml(value)}
      </div>
    </div>
  `;
}

function renderSummaryPill({
  label,
  background,
  border,
  colour,
}: {
  label: string;
  background: string;
  border: string;
  colour: string;
}) {
  return `
    <span class="summary-pill" style="
      display:inline-block;
      padding:8px 11px;
      border-radius:999px;
      background:${background};
      border:1px solid ${border};
      color:${colour};
      font-size:12px;
      line-height:1.2;
      font-weight:900;
    ">
      ${escapeHtml(label)}
    </span>
  `;
}

function renderEmailShell({
  preheader,
  eyebrow,
  title,
  intro,
  summaryHtml,
  metaHtml,
  messageHtml,
  noticeHtml,
  footer,
  brand,
}: {
  preheader: string;
  eyebrow: string;
  title: string;
  intro: string;
  summaryHtml: string;
  metaHtml: string;
  messageHtml: string;
  noticeHtml: string;
  footer: string;
  brand: ResolvedEmailBranding;
}) {
  const topStripe = `linear-gradient(90deg,${escapeHtml(
    brand.primaryColour,
  )},${escapeHtml(brand.accentColour)})`;

  const finalFooter =
    brand.advancedBranding && brand.footerText
      ? `${footer} ${brand.footerText}`
      : footer;

  return `
    <!doctype html>
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />

        <style>
          @media only screen and (max-width: 640px) {
            .email-outer {
              padding: 14px 8px !important;
            }

            .email-card {
              border-radius: 18px !important;
            }

            .email-content {
              padding: 22px 16px !important;
            }

            .email-title {
              font-size: 24px !important;
              line-height: 1.18 !important;
            }

            .email-intro {
              font-size: 14px !important;
            }

            .summary-row {
              display: block !important;
            }

            .summary-pill {
              display: block !important;
              width: 100% !important;
              margin: 0 0 8px !important;
              box-sizing: border-box !important;
              text-align: left !important;
            }

            .meta-grid {
              display: block !important;
            }

            .meta-card {
              display: block !important;
              margin: 0 0 10px !important;
              width: 100% !important;
              box-sizing: border-box !important;
            }

            .message-box,
            .notice-box {
              padding: 15px !important;
              border-radius: 16px !important;
            }

            .footer-text {
              font-size: 12px !important;
            }
          }
        </style>
      </head>

      <body style="margin:0;padding:0;background:#f1f5f9;">
        <div style="display:none;max-height:0;overflow:hidden;opacity:0;">
          ${escapeHtml(preheader)}
        </div>

        <div class="email-outer" style="
          font-family:Arial,Helvetica,sans-serif;
          max-width:720px;
          margin:0 auto;
          padding:28px 14px;
          color:#0f172a;
          box-sizing:border-box;
        ">
          <div class="email-card" style="
            background:#ffffff;
            border:1px solid #e2e8f0;
            border-radius:24px;
            overflow:hidden;
            box-shadow:0 12px 34px rgba(15,23,42,0.08);
          ">
            ${renderContactLogo(brand)}

            <div style="
              height:7px;
              background:${topStripe};
            "></div>

            <div class="email-content" style="padding:28px 26px;">
              <p style="
                margin:0 0 8px;
                color:${escapeHtml(brand.primaryColour)};
                font-size:12px;
                line-height:1.35;
                font-weight:900;
                letter-spacing:0.08em;
                text-transform:uppercase;
              ">
                ${escapeHtml(eyebrow)}
              </p>

              <h1 class="email-title" style="
                margin:0 0 12px;
                color:#0f172a;
                font-size:30px;
                line-height:1.15;
                letter-spacing:-0.04em;
                word-break:break-word;
                overflow-wrap:anywhere;
              ">
                ${escapeHtml(title)}
              </h1>

              <p class="email-intro" style="
                margin:0 0 18px;
                color:#475569;
                font-size:15px;
                line-height:1.65;
                font-weight:700;
              ">
                ${escapeHtml(intro)}
              </p>

              ${summaryHtml}
              ${metaHtml}
              ${messageHtml}
              ${noticeHtml}

              <div class="footer-text" style="
                margin-top:24px;
                padding-top:16px;
                border-top:1px solid #e2e8f0;
                color:#64748b;
                font-size:13px;
                line-height:1.6;
              ">
                ${escapeHtml(finalFooter)}
              </div>
            </div>
          </div>
        </div>
      </body>
    </html>
  `;
}
export async function sendCustomerContactEmail({
  tenantSlug,
  tenantDisplayName,
  tenantContactEmail,
  tenantContactName,
  supporterName,
  supporterEmail,
  subject,
  message,
  campaignType,
  campaignId,
  campaignTitle,
  pageUrl,
  branding,
}: {
  tenantSlug: string;
  tenantDisplayName: string;
  tenantContactEmail: string;
  tenantContactName?: string | null;
  supporterName?: string | null;
  supporterEmail: string;
  subject: string;
  message: string;
  campaignType?: string | null;
  campaignId?: string | null;
  campaignTitle?: string | null;
  pageUrl?: string | null;
  branding?: ContactEmailBranding;
}) {
  if (!process.env.RESEND_API_KEY) {
    throw new Error("Missing RESEND_API_KEY");
  }

  const to = cleanOptionalText(tenantContactEmail);
  const fromEmail = getFromEmail();

  if (!to) {
    throw new Error("Tenant contact email is not configured");
  }

  const safeTenantSlug = cleanText(tenantSlug, "unknown");
  const safeTenantDisplayName = cleanText(
    tenantDisplayName,
    "Tenant organiser",
  );
  const safeTenantContactName = cleanText(
    tenantContactName,
    safeTenantDisplayName,
  );
  const safeSupporterName = cleanText(supporterName, "Supporter");
  const safeSupporterEmail = cleanText(supporterEmail, "Not supplied");
  const safeSubject = cleanText(subject, "Supporter contact message");
  const safeCampaignType = formatLabel(campaignType || "general");
  const safeCampaignTitle = cleanText(campaignTitle, "Not campaign-specific");
  const hasPageUrl = cleanOptionalText(pageUrl) !== "";

  const brand = resolveEmailBranding({
    tenantDisplayName: safeTenantDisplayName,
    branding,
  });

  const summaryHtml = `
    <div class="summary-row" style="
      display:flex;
      gap:8px;
      flex-wrap:wrap;
      margin:0 0 20px;
    ">
      ${renderSummaryPill({
        label: `Tenant: ${safeTenantSlug}`,
        background: `${brand.primaryColour}10`,
        border: `${brand.primaryColour}30`,
        colour: brand.primaryColour,
      })}

      ${renderSummaryPill({
        label: safeCampaignType,
        background: `${brand.accentColour}22`,
        border: `${brand.accentColour}66`,
        colour: "#0f172a",
      })}

      ${renderSummaryPill({
        label: "Supporter message",
        background: "#f8fafc",
        border: "#e2e8f0",
        colour: "#334155",
      })}
    </div>
  `;

  const metaHtml = `
    <div class="meta-grid" style="
      display:grid;
      grid-template-columns:repeat(2,minmax(0,1fr));
      gap:10px;
      background:#f8fafc;
      border:1px solid #e2e8f0;
      border-radius:20px;
      padding:12px;
      margin:0 0 22px;
    ">
      ${renderMetaCard("Tenant", safeTenantSlug)}
      ${renderMetaCard("Tenant contact", safeTenantContactName)}
      ${renderMetaCard("Supporter name", safeSupporterName)}
      ${renderMetaCard("Supporter email", safeSupporterEmail)}
      ${renderMetaCard("Campaign type", safeCampaignType)}
      ${renderMetaCard("Campaign title", safeCampaignTitle)}
      ${renderMetaCard("Campaign ID", cleanText(campaignId))}
      ${renderMetaCard("Page URL", cleanText(pageUrl))}
    </div>
  `;

  const messageHtml = `
    <div class="message-box" style="
      border-radius:20px;
      padding:18px;
      background:#ffffff;
      border:1px solid #cbd5e1;
      margin:0 0 18px;
    ">
      <p style="
        margin:0 0 8px;
        color:#64748b;
        font-size:12px;
        line-height:1.35;
        font-weight:900;
        letter-spacing:0.08em;
        text-transform:uppercase;
      ">
        Message
      </p>

      <div style="
        color:#0f172a;
        font-size:15px;
        line-height:1.65;
        font-weight:700;
        white-space:pre-wrap;
        word-break:break-word;
        overflow-wrap:anywhere;
      ">${escapeHtml(message)}</div>
    </div>
  `;

  const noticeHtml = `
    <div class="notice-box" style="
      border-radius:20px;
      padding:18px;
      background:#fffbeb;
      border:1px solid #fde68a;
      margin:0;
    ">
      <p style="
        margin:0 0 8px;
        color:#92400e;
        font-size:12px;
        line-height:1.35;
        font-weight:900;
        letter-spacing:0.08em;
        text-transform:uppercase;
      ">
        Reply guidance
      </p>

      <div style="
        color:#78350f;
        font-size:13px;
        line-height:1.6;
        font-weight:700;
      ">
        Reply directly to this email to contact the supporter. Their supplied email address has been set as the reply-to address.
        ${
          hasPageUrl
            ? `The page they referenced was: ${escapeHtml(pageUrl)}.`
            : ""
        }
      </div>
    </div>
  `;

  const html = renderEmailShell({
    preheader: safeSubject,
    eyebrow: "Public supporter contact",
    title: safeSubject,
    intro: `${safeTenantContactName}, a public supporter has sent a message to ${safeTenantDisplayName} through the SO Fundraising Platform contact page.`,
    summaryHtml,
    metaHtml,
    messageHtml,
    noticeHtml,
    footer:
      "Sent automatically by the SO Fundraising Platform public contact system. This message was sent to the tenant contact email, not platform owner support.",
    brand,
  });

  const fromName = brand.advancedBranding
    ? `${brand.displayName} via SO Fundraising`
    : `${safeTenantDisplayName} via SO Fundraising`;

  const result = await resend.emails.send({
    from: `${fromName} <${fromEmail}>`,
    to,
    subject: `[${safeTenantDisplayName}] ${safeSubject}`,
    html,
    replyTo: safeSupporterEmail,
  });

  if (result.error) {
    throw new Error(
      typeof result.error.message === "string"
        ? result.error.message
        : "Resend failed to send customer contact email",
    );
  }

  return result.data?.id || null;
}

export async function sendTenantContactTestEmail({
  tenantSlug,
  tenantDisplayName,
  tenantContactEmail,
  tenantContactName,
  branding,
}: {
  tenantSlug: string;
  tenantDisplayName: string;
  tenantContactEmail: string;
  tenantContactName?: string | null;
  branding?: ContactEmailBranding;
}) {
  if (!process.env.RESEND_API_KEY) {
    throw new Error("Missing RESEND_API_KEY");
  }

  const to = cleanOptionalText(tenantContactEmail);
  const fromEmail = getFromEmail();

  if (!to) {
    throw new Error("Tenant contact email is not configured");
  }

  const safeTenantSlug = cleanText(tenantSlug, "unknown");
  const safeTenantDisplayName = cleanText(
    tenantDisplayName,
    "Tenant organiser",
  );
  const safeTenantContactName = cleanText(
    tenantContactName,
    safeTenantDisplayName,
  );

  const brand = resolveEmailBranding({
    tenantDisplayName: safeTenantDisplayName,
    branding,
  });

  const summaryHtml = `
    <div class="summary-row" style="
      display:flex;
      gap:8px;
      flex-wrap:wrap;
      margin:0 0 20px;
    ">
      ${renderSummaryPill({
        label: `Tenant: ${safeTenantSlug}`,
        background: `${brand.primaryColour}10`,
        border: `${brand.primaryColour}30`,
        colour: brand.primaryColour,
      })}

      ${renderSummaryPill({
        label: "Contact email test",
        background: `${brand.accentColour}22`,
        border: `${brand.accentColour}66`,
        colour: "#0f172a",
      })}
    </div>
  `;

  const metaHtml = `
    <div class="meta-grid" style="
      display:grid;
      grid-template-columns:repeat(2,minmax(0,1fr));
      gap:10px;
      background:#f8fafc;
      border:1px solid #e2e8f0;
      border-radius:20px;
      padding:12px;
      margin:0 0 22px;
    ">
      ${renderMetaCard("Tenant", safeTenantSlug)}
      ${renderMetaCard("Tenant name", safeTenantDisplayName)}
      ${renderMetaCard("Contact name", safeTenantContactName)}
      ${renderMetaCard("Contact email", to)}
    </div>
  `;

  const messageHtml = `
    <div class="message-box" style="
      border-radius:20px;
      padding:18px;
      background:#ffffff;
      border:1px solid #cbd5e1;
      margin:0 0 18px;
    ">
      <p style="
        margin:0 0 8px;
        color:#64748b;
        font-size:12px;
        line-height:1.35;
        font-weight:900;
        letter-spacing:0.08em;
        text-transform:uppercase;
      ">
        Test message
      </p>

      <div style="
        color:#0f172a;
        font-size:15px;
        line-height:1.65;
        font-weight:700;
        white-space:pre-wrap;
        word-break:break-word;
        overflow-wrap:anywhere;
      ">This is a test email for the public contact address linked to ${escapeHtml(
        safeTenantDisplayName,
      )}. If you received this, the tenant contact email can receive public supporter messages from SO Fundraising Platform.</div>
    </div>
  `;

  const noticeHtml = `
    <div class="notice-box" style="
      border-radius:20px;
      padding:18px;
      background:#ecfdf5;
      border:1px solid #a7f3d0;
      margin:0;
    ">
      <p style="
        margin:0 0 8px;
        color:#047857;
        font-size:12px;
        line-height:1.35;
        font-weight:900;
        letter-spacing:0.08em;
        text-transform:uppercase;
      ">
        What this confirms
      </p>

      <div style="
        color:#065f46;
        font-size:13px;
        line-height:1.6;
        font-weight:700;
      ">
        This confirms that the email address can receive messages from the platform. A later verification step can add confirmed status tracking.
      </div>
    </div>
  `;

  const html = renderEmailShell({
    preheader: "SO Fundraising Platform contact email test",
    eyebrow: "Contact email test",
    title: "Your public contact email is receiving messages",
    intro: `${safeTenantContactName}, this is a test email for the public contact address used by ${safeTenantDisplayName}.`,
    summaryHtml,
    metaHtml,
    messageHtml,
    noticeHtml,
    footer:
      "Sent automatically by the SO Fundraising Platform branding settings page.",
    brand,
  });

  const fromName = brand.advancedBranding
    ? `${brand.displayName} Contact Test`
    : "SO Fundraising Contact Test";

  const result = await resend.emails.send({
    from: `${fromName} <${fromEmail}>`,
    to,
    subject: `[SO Fundraising] Contact email test for ${safeTenantDisplayName}`,
    html,
  });

  if (result.error) {
    throw new Error(
      typeof result.error.message === "string"
        ? result.error.message
        : "Resend failed to send tenant contact test email",
    );
  }

  return result.data?.id || null;
}
