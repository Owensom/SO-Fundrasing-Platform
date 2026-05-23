// src/lib/support-email.ts
// ===============================
// Platform support email helper
// Additive only: used by admin support requests
// Mobile-friendly email template
// ===============================

import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

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

function getSupportRecipient() {
  return (
    process.env.PLATFORM_SUPPORT_EMAIL?.trim() ||
    process.env.SUPPORT_EMAIL?.trim() ||
    "sofundraisingplatform@gmail.com"
  );
}

function getFromEmail() {
  return (
    process.env.RESEND_FROM_EMAIL?.trim() || "noreply@sofundraising.it.com"
  );
}

function formatSupportLabel(value: unknown) {
  const clean = cleanText(value, "general").toLowerCase();

  return clean
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
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

export async function sendPlatformSupportRequestEmail({
  requestId,
  tenantSlug,
  adminEmail,
  adminName,
  category,
  urgency,
  subject,
  message,
  pageUrl,
  campaignType,
  campaignId,
  browserContext,
}: {
  requestId: string;
  tenantSlug: string;
  adminEmail?: string | null;
  adminName?: string | null;
  category: string;
  urgency: string;
  subject: string;
  message: string;
  pageUrl?: string | null;
  campaignType?: string | null;
  campaignId?: string | null;
  browserContext?: string | null;
}) {
  if (!process.env.RESEND_API_KEY) {
    throw new Error("Missing RESEND_API_KEY");
  }

  const to = getSupportRecipient();
  const fromEmail = getFromEmail();

  const safeTenantSlug = cleanText(tenantSlug, "unknown");
  const safeCategory = formatSupportLabel(category);
  const safeUrgency = formatSupportLabel(urgency);
  const safeSubject = cleanText(subject, "Support request");
  const hasBrowserContext = cleanText(browserContext, "") !== "";

  const html = `
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
            .browser-box {
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
          ${escapeHtml(safeSubject)}
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
            <div style="
              height:7px;
              background:linear-gradient(90deg,#1683f8,#facc15);
            "></div>

            <div class="email-content" style="padding:28px 26px;">
              <p style="
                margin:0 0 8px;
                color:#2563eb;
                font-size:12px;
                line-height:1.35;
                font-weight:900;
                letter-spacing:0.08em;
                text-transform:uppercase;
              ">
                Admin support request
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
                ${escapeHtml(safeSubject)}
              </h1>

              <p class="email-intro" style="
                margin:0 0 18px;
                color:#475569;
                font-size:15px;
                line-height:1.65;
                font-weight:700;
              ">
                A tenant admin has submitted a support request from the SO Fundraising Platform admin area.
              </p>

              <div class="summary-row" style="
                display:flex;
                gap:8px;
                flex-wrap:wrap;
                margin:0 0 20px;
              ">
                <span class="summary-pill" style="
                  display:inline-block;
                  padding:8px 11px;
                  border-radius:999px;
                  background:#eff6ff;
                  border:1px solid #bfdbfe;
                  color:#1d4ed8;
                  font-size:12px;
                  line-height:1.2;
                  font-weight:900;
                ">
                  Tenant: ${escapeHtml(safeTenantSlug)}
                </span>

                <span class="summary-pill" style="
                  display:inline-block;
                  padding:8px 11px;
                  border-radius:999px;
                  background:#fffbeb;
                  border:1px solid #fde68a;
                  color:#92400e;
                  font-size:12px;
                  line-height:1.2;
                  font-weight:900;
                ">
                  ${escapeHtml(safeUrgency)}
                </span>

                <span class="summary-pill" style="
                  display:inline-block;
                  padding:8px 11px;
                  border-radius:999px;
                  background:#f8fafc;
                  border:1px solid #e2e8f0;
                  color:#334155;
                  font-size:12px;
                  line-height:1.2;
                  font-weight:900;
                ">
                  ${escapeHtml(safeCategory)}
                </span>
              </div>

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
                ${renderMetaCard("Request ID", requestId)}
                ${renderMetaCard("Tenant", safeTenantSlug)}
                ${renderMetaCard("Admin name", cleanText(adminName))}
                ${renderMetaCard("Admin email", cleanText(adminEmail))}
                ${renderMetaCard("Category", safeCategory)}
                ${renderMetaCard("Urgency", safeUrgency)}
                ${renderMetaCard("Page URL", cleanText(pageUrl))}
                ${renderMetaCard("Campaign type", cleanText(campaignType))}
                ${renderMetaCard("Campaign ID", cleanText(campaignId))}
              </div>

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

              ${
                hasBrowserContext
                  ? `
                    <div class="browser-box" style="
                      border-radius:20px;
                      padding:18px;
                      background:#fffbeb;
                      border:1px solid #fde68a;
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
                        Browser / extra context
                      </p>

                      <div style="
                        color:#78350f;
                        font-size:13px;
                        line-height:1.6;
                        font-weight:700;
                        white-space:pre-wrap;
                        word-break:break-word;
                        overflow-wrap:anywhere;
                      ">${escapeHtml(browserContext)}</div>
                    </div>
                  `
                  : ""
              }

              <div class="footer-text" style="
                margin-top:24px;
                padding-top:16px;
                border-top:1px solid #e2e8f0;
                color:#64748b;
                font-size:13px;
                line-height:1.6;
              ">
                Sent automatically by the SO Fundraising Platform support request system.
              </div>
            </div>
          </div>
        </div>
      </body>
    </html>
  `;

  const result = await resend.emails.send({
    from: `SO Fundraising Support <${fromEmail}>`,
    to,
    subject: `[${safeUrgency}] ${safeTenantSlug}: ${safeSubject}`,
    html,
    replyTo: adminEmail?.trim() || undefined,
  });

  if (result.error) {
    throw new Error(
      typeof result.error.message === "string"
        ? result.error.message
        : "Resend failed to send support email",
    );
  }

  return result.data?.id || null;
}
