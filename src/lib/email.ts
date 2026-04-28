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

function formatCurrency(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency,
    }).format(amount / 100);
  } catch {
    return `${(amount / 100).toFixed(2)} ${escapeHtml(currency)}`;
  }
}

function colourDot(colour?: string | null) {
  if (!colour) return "";

  const safeColour = escapeHtml(colour);
  const isHex = /^#[0-9A-Fa-f]{6}$/.test(colour.trim());

  return `
    <span style="
      display:inline-block;
      width:12px;
      height:12px;
      border-radius:999px;
      margin-right:8px;
      vertical-align:-1px;
      background:${isHex ? safeColour : "#94a3b8"};
      border:1px solid #cbd5e1;
    "></span>
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
        <div style="display:none;">${escapeHtml(params.heading)}</div>

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
          ">
            <div style="height:6px;background:${brand.primaryColor};"></div>

            <div style="padding:30px;">
              <div style="text-align:center;margin-bottom:20px;">
                <img src="${brand.logoUrl}" style="max-width:240px;" />
              </div>

              <h1>${escapeHtml(params.heading)}</h1>

              ${params.intro ? `<p>${escapeHtml(params.intro)}</p>` : ""}

              ${params.body}

              <div style="margin-top:20px;font-size:12px;color:#64748b;">
                Powered by ${escapeHtml(brand.name)}
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

  await resend.emails.send({
    from: `${brand.name} <noreply@sofundraising.it.com>`,
    to: params.to,
    subject: params.subject,
    html: params.html,
  });
}

/* =========================
   RECEIPT EMAIL
========================= */

export async function sendReceiptEmail({
  to,
  name,
  raffleTitle,
  amountCents,
  currency,
  reservationToken,
  tickets,
  branding,
}: any) {
  const formattedAmount = formatCurrency(amountCents, currency);

  const ticketItems = tickets
    .map(
      (ticket: any) => `
      <div>
        🎟️ Ticket #${ticket.ticket_number}
        <br/>
        ${colourDot(ticket.colour)} ${ticket.colour || "Default"}
      </div>
    `,
    )
    .join("");

  const html = renderEmailShell({
    branding,
    heading: "Payment successful",
    intro: `Hi ${name || "there"}, your tickets are confirmed.`,
    body: `
      <p><strong>${raffleTitle}</strong></p>
      <p>Amount: ${formattedAmount}</p>
      <p>Ref: ${reservationToken}</p>
      <hr/>
      ${ticketItems}
    `,
  });

  await sendEmail({
    to,
    subject: `Your tickets for ${raffleTitle}`,
    html,
    branding,
  });
}

/* =========================
   WINNER EMAIL
========================= */

export async function sendWinnerEmail({
  to,
  name,
  raffleTitle,
  ticketNumber,
  colour,
  branding,
}: any) {
  const html = renderEmailShell({
    branding,
    heading: "🎉 You won!",
    intro: `Hi ${name || "there"}, congratulations!`,
    body: `
      <p>${raffleTitle}</p>
      <p>Ticket: #${ticketNumber}</p>
      <p>Colour: ${colourDot(colour)} ${colour || "Default"}</p>
    `,
  });

  await sendEmail({
    to,
    subject: `You won ${raffleTitle}!`,
    html,
    branding,
  });
}
