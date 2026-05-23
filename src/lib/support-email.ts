// src/lib/support-email.ts
// ===============================
// Platform support email helper
// Additive only: used by admin support requests
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

function renderInfoRow(label: string, value: unknown) {
  return `
    <tr>
      <td style="
        padding:10px 12px;
        border-bottom:1px solid #e2e8f0;
        color:#64748b;
        font-size:13px;
        font-weight:800;
        width:170px;
        vertical-align:top;
      ">
        ${escapeHtml(label)}
      </td>
      <td style="
        padding:10px 12px;
        border-bottom:1px solid #e2e8f0;
        color:#0f172a;
        font-size:14px;
        font-weight:700;
        vertical-align:top;
        word-break:break-word;
      ">
        ${escapeHtml(value)}
      </td>
    </tr>
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

  const html = `
    <!doctype html>
    <html>
      <body style="margin:0;padding:0;background:#f1f5f9;">
        <div style="
          font-family:Arial,Helvetica,sans-serif;
          max-width:720px;
          margin:0 auto;
          padding:28px 14px;
          color:#0f172a;
        ">
          <div style="
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

            <div style="padding:28px 26px;">
              <p style="
                margin:0 0 8px;
                color:#2563eb;
                font-size:13px;
                font-weight:900;
                letter-spacing:0.08em;
                text-transform:uppercase;
              ">
                Admin support request
              </p>

              <h1 style="
                margin:0 0 12px;
                color:#0f172a;
                font-size:28px;
                line-height:1.2;
              ">
                ${escapeHtml(safeSubject)}
              </h1>

              <p style="
                margin:0 0 22px;
                color:#475569;
                font-size:15px;
                line-height:1.6;
                font-weight:700;
              ">
                A tenant admin has submitted a support request from the SO Fundraising Platform admin area.
              </p>

              <div style="
                border:1px solid #e2e8f0;
                border-radius:18px;
                overflow:hidden;
                margin:0 0 22px;
              ">
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                  ${renderInfoRow("Request ID", requestId)}
                  ${renderInfoRow("Tenant", safeTenantSlug)}
                  ${renderInfoRow("Admin name", cleanText(adminName))}
                  ${renderInfoRow("Admin email", cleanText(adminEmail))}
                  ${renderInfoRow("Category", safeCategory)}
                  ${renderInfoRow("Urgency", safeUrgency)}
                  ${renderInfoRow("Page URL", cleanText(pageUrl))}
                  ${renderInfoRow("Campaign type", cleanText(campaignType))}
                  ${renderInfoRow("Campaign ID", cleanText(campaignId))}
                </table>
              </div>

              <div style="
                border-radius:18px;
                padding:18px;
                background:#f8fafc;
                border:1px solid #e2e8f0;
                margin-bottom:18px;
              ">
                <p style="
                  margin:0 0 8px;
                  color:#64748b;
                  font-size:12px;
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
                ">${escapeHtml(message)}</div>
              </div>

              ${
                cleanText(browserContext, "") !== ""
                  ? `
                    <div style="
                      border-radius:18px;
                      padding:16px;
                      background:#fffbeb;
                      border:1px solid #fde68a;
                    ">
                      <p style="
                        margin:0 0 8px;
                        color:#92400e;
                        font-size:12px;
                        font-weight:900;
                        letter-spacing:0.08em;
                        text-transform:uppercase;
                      ">
                        Browser / extra context
                      </p>

                      <div style="
                        color:#78350f;
                        font-size:13px;
                        line-height:1.55;
                        font-weight:700;
                        white-space:pre-wrap;
                        word-break:break-word;
                      ">${escapeHtml(browserContext)}</div>
                    </div>
                  `
                  : ""
              }

              <div style="
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
