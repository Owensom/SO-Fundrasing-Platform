import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

type EmailBranding = {
  name?: string | null;
  logoUrl?: string | null;
  primaryColor?: string | null;
};

const DEFAULT_BRANDING = {
  name: "SO Fundraising Platform",
  logoUrl:
    "https://res.cloudinary.com/dyez8xsbw/image/upload/v1777292787/so-logo-full_dt3i5l.png",
  primaryColor: "#16a34a",
};

const EVENT_CHAMPAGNE_IMAGE_URL =
  "https://so-fundraising-platform.vercel.app/brand/event-champagne-gold.png";

function getBranding(branding?: EmailBranding) {
  return {
    name: branding?.name?.trim() || DEFAULT_BRANDING.name,
    logoUrl: branding?.logoUrl?.trim() || DEFAULT_BRANDING.logoUrl,
    primaryColor:
      branding?.primaryColor?.trim() || DEFAULT_BRANDING.primaryColor,
  };
}

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatDateTime(value?: string | null) {
  if (!value) return "";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "full",
    timeStyle: "short",
  }).format(date);
}

function renderInfoRow(label: string, value: unknown) {
  if (value === null || value === undefined || String(value).trim() === "") {
    return "";
  }

  return `
    <p style="margin:0 0 10px;font-size:15px;color:#334155;">
      <strong style="color:#0f172a;">${escapeHtml(label)}:</strong>
      ${escapeHtml(value)}
    </p>
  `;
}

function renderButton({
  href,
  label,
  primaryColor,
}: {
  href: string;
  label: string;
  primaryColor: string;
}) {
  return `
    <div style="text-align:center;margin:28px 0;">
      <a
        href="${escapeHtml(href)}"
        style="
          display:inline-block;
          padding:15px 22px;
          border-radius:999px;
          background:${escapeHtml(primaryColor)};
          color:#ffffff;
          text-decoration:none;
          font-size:16px;
          font-weight:900;
          box-shadow:0 12px 24px rgba(15,23,42,0.18);
        "
      >
        ${escapeHtml(label)}
      </a>
    </div>
  `;
}

function renderEmailShell(params: {
  branding?: EmailBranding;
  heading: string;
  eyebrow?: string;
  intro?: string;
  body: string;
  footer?: string;
}) {
  const brand = getBranding(params.branding);

  return `
    <!doctype html>
    <html>
      <body style="margin:0;padding:0;background:#f1f5f9;">
        <div style="display:none;max-height:0;overflow:hidden;opacity:0;">
          ${escapeHtml(params.heading)}
        </div>

        <div style="
          font-family:Arial,Helvetica,sans-serif;
          max-width:680px;
          margin:0 auto;
          padding:28px 14px;
          color:#0f172a;
        ">
          <div style="
            background:#ffffff;
            border:1px solid #e2e8f0;
            border-radius:22px;
            overflow:hidden;
            box-shadow:0 10px 30px rgba(15,23,42,0.08);
          ">
            <div style="height:6px;background:${escapeHtml(
              brand.primaryColor,
            )};"></div>

            <div style="padding:30px 26px 28px;">
              <div style="text-align:center;margin-bottom:22px;">
                <img
                  src="${escapeHtml(brand.logoUrl)}"
                  alt="${escapeHtml(brand.name)}"
                  style="max-width:280px;width:100%;height:auto;display:block;margin:0 auto;"
                />
              </div>

              <div style="
                margin:0 auto 26px;
                max-width:320px;
                border-radius:24px;
                background:linear-gradient(135deg,#ffffff 0%,#f8fafc 52%,#eff6ff 100%);
                border:1px solid #dbeafe;
                box-shadow:0 14px 34px rgba(15,23,42,0.08);
                padding:18px;
                text-align:center;
              ">
                <img
                  src="${escapeHtml(EVENT_CHAMPAGNE_IMAGE_URL)}"
                  alt="Event menu choice request"
                  width="260"
                  style="
                    display:block;
                    width:100%;
                    max-width:260px;
                    height:auto;
                    margin:0 auto;
                    border:0;
                    outline:none;
                    text-decoration:none;
                  "
                />
              </div>

              ${
                params.eyebrow
                  ? `<p style="
                      margin:0 0 8px;
                      color:${escapeHtml(brand.primaryColor)};
                      font-size:13px;
                      font-weight:800;
                      letter-spacing:0.08em;
                      text-transform:uppercase;
                    ">${escapeHtml(params.eyebrow)}</p>`
                  : ""
              }

              <h1 style="
                font-size:28px;
                line-height:1.2;
                margin:0 0 12px;
                color:#0f172a;
              ">
                ${escapeHtml(params.heading)}
              </h1>

              ${
                params.intro
                  ? `<p style="
                      font-size:16px;
                      line-height:1.65;
                      margin:0 0 22px;
                      color:#334155;
                    ">${escapeHtml(params.intro)}</p>`
                  : ""
              }

              ${params.body}

              <div style="
                margin-top:30px;
                padding-top:18px;
                border-top:1px solid #e2e8f0;
                color:#64748b;
                font-size:13px;
                line-height:1.6;
              ">
                ${
                  params.footer ||
                  `Powered by ${escapeHtml(
                    brand.name,
                  )}. Supporting causes through fundraising.`
                }
              </div>
            </div>
          </div>
        </div>
      </body>
    </html>
  `;
}

async function sendEmail(params: {
  to: string;
  subject: string;
  html: string;
  branding?: EmailBranding;
}) {
  const brand = getBranding(params.branding);

  const fromEmail =
    process.env.RESEND_FROM_EMAIL?.trim() || "noreply@sofundraising.it.com";

  if (!process.env.RESEND_API_KEY) {
    throw new Error("Missing RESEND_API_KEY");
  }

  const result = await resend.emails.send({
    from: `${brand.name} <${fromEmail}>`,
    to: params.to,
    subject: params.subject,
    html: params.html,
  });

  if (result.error) {
    console.error("Resend menu request email error", {
      to: params.to,
      subject: params.subject,
      error: result.error,
    });

    throw new Error(
      typeof result.error.message === "string"
        ? result.error.message
        : "Resend failed to send menu request email",
    );
  }

  console.log("Event menu request email sent", {
    to: params.to,
    subject: params.subject,
    id: result.data?.id,
  });
}

export async function sendEventMenuRequestEmail({
  to,
  name,
  guestName,
  eventTitle,
  eventDate,
  location,
  updateUrl,
  expiresAt,
  branding,
}: {
  to: string;
  name?: string | null;
  guestName?: string | null;
  eventTitle: string;
  eventDate?: string | null;
  location?: string | null;
  updateUrl: string;
  expiresAt: string;
  branding?: EmailBranding;
}) {
  const brand = getBranding(branding);
  const formattedEventDate = formatDateTime(eventDate);
  const formattedExpiry = formatDateTime(expiresAt);

  const greetingName = guestName || name || "there";

  const html = renderEmailShell({
    branding,
    eyebrow: "Menu choice request",
    heading: "Please confirm your menu choice",
    intro: `Hi ${greetingName}, the organiser has asked guests to confirm their menu choice and dietary requirements for ${eventTitle}.`,
    body: `
      <div style="
        border:1px solid #e2e8f0;
        border-radius:18px;
        padding:18px;
        margin:20px 0;
        background:#f8fafc;
      ">
        ${renderInfoRow("Event", eventTitle)}
        ${renderInfoRow("Date", formattedEventDate)}
        ${renderInfoRow("Location", location)}
        ${renderInfoRow("Guest", guestName)}
        ${renderInfoRow("Link expires", formattedExpiry)}
      </div>

      <p style="margin:0 0 16px;font-size:16px;line-height:1.65;color:#334155;">
        Use the secure link below to update your menu choice and any dietary requirements. This only updates your guest/catering details. It does not change your payment or booking.
      </p>

      ${renderButton({
        href: updateUrl,
        label: "Update menu choice",
        primaryColor: brand.primaryColor,
      })}

      <div style="
        border-radius:18px;
        padding:18px;
        background:#eff6ff;
        border:1px solid #bfdbfe;
      ">
        <p style="margin:0;font-size:15px;line-height:1.6;color:#1e3a8a;font-weight:800;">
          This secure link is for your booking only. Please do not forward it.
        </p>
      </div>
    `,
  });

  await sendEmail({
    to,
    subject: `Menu choice request for ${eventTitle}`,
    html,
    branding,
  });
}
