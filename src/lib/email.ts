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

function formatDrawDate(value?: string | null) {
  if (!value) return "";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "full",
    timeStyle: "short",
  }).format(date);
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
              <div style="text-align:center;margin-bottom:28px;">
                <img
                  src="${escapeHtml(brand.logoUrl)}"
                  alt="${escapeHtml(brand.name)}"
                  style="max-width:280px;width:100%;height:auto;display:block;margin:0 auto;"
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

  await resend.emails.send({
    from: `${brand.name} <onboarding@resend.dev>`,
    to: params.to,
    subject: params.subject,
    html: params.html,
  });
}

export async function sendReceiptEmail({
  to,
  name,
  raffleTitle,
  amountCents,
  currency,
  reservationToken,
  tickets,
  drawAt,
  branding,
}: {
  to: string;
  name?: string | null;
  raffleTitle: string;
  amountCents: number;
  currency: string;
  reservationToken: string;
  tickets: Array<{ ticket_number: number; colour?: string | null }>;
  drawAt?: string | null;
  branding?: EmailBranding;
}) {
  const formattedAmount = formatCurrency(amountCents, currency);
  const formattedDrawDate = formatDrawDate(drawAt);

  const ticketItems = tickets
    .map((ticket) => {
      const colour = ticket.colour || "Default";

      return `
        <div style="
          border:1px solid #e2e8f0;
          border-radius:14px;
          padding:13px 14px;
          margin-bottom:10px;
          background:#ffffff;
        ">
          <div style="font-size:16px;font-weight:800;color:#0f172a;">
            🎟️ Ticket #${escapeHtml(ticket.ticket_number)}
          </div>
          <div style="margin-top:5px;font-size:14px;color:#475569;">
            ${colourDot(ticket.colour)}${escapeHtml(colour)}
          </div>
        </div>
      `;
    })
    .join("");

  const html = renderEmailShell({
    branding,
    eyebrow: "Ticket confirmation",
    heading: "Payment successful",
    intro: `Hi ${
      name || "there"
    }, thank you for your purchase. Your raffle tickets are confirmed below.`,
    body: `
      <div style="
        border:1px solid #e2e8f0;
        border-radius:18px;
        padding:18px;
        margin:20px 0;
        background:#f8fafc;
      ">
        ${renderInfoRow("Raffle", raffleTitle)}
        ${renderInfoRow("Draw date", formattedDrawDate)}
        ${renderInfoRow("Amount paid", formattedAmount)}

        <p style="margin:0;font-size:15px;color:#334155;word-break:break-word;">
          <strong style="color:#0f172a;">Reference:</strong>
          ${escapeHtml(reservationToken)}
        </p>
      </div>

      <h2 style="font-size:20px;margin:24px 0 12px;color:#0f172a;">
        Your tickets
      </h2>

      <div style="margin:0 0 22px;">
        ${
          ticketItems ||
          `<p style="color:#64748b;">No ticket numbers found.</p>`
        }
      </div>

      <div style="
        border-radius:18px;
        padding:18px;
        background:#ecfdf5;
        border:1px solid #bbf7d0;
      ">
        <p style="margin:0;font-size:16px;line-height:1.6;color:#166534;font-weight:800;">
          Good luck — your entry is confirmed.
        </p>
      </div>
    `,
  });

  try {
    await sendEmail({
      to,
      subject: `Your tickets for ${raffleTitle}`,
      html,
      branding,
    });
  } catch (err) {
    console.error("receipt email failed", err);
  }
}

export async function sendWinnerEmail({
  to,
  name,
  raffleTitle,
  ticketNumber,
  colour,
  branding,
}: {
  to: string;
  name?: string | null;
  raffleTitle: string;
  ticketNumber: number;
  colour?: string | null;
  branding?: EmailBranding;
}) {
  const brand = getBranding(branding);
  const safeColour = colour || "Default";

  const html = renderEmailShell({
    branding,
    eyebrow: "Winner notification",
    heading: "🎉 You won!",
    intro: `Hi ${
      name || "there"
    }, congratulations — your ticket has been selected as a winner.`,
    body: `
      <div style="
        border:1px solid #bbf7d0;
        border-radius:20px;
        padding:22px;
        margin:20px 0;
        background:#ecfdf5;
      ">
        <p style="
          margin:0 0 14px;
          font-size:20px;
          font-weight:900;
          color:#14532d;
        ">
          ${escapeHtml(raffleTitle)}
        </p>

        <div style="
          border-radius:16px;
          background:#ffffff;
          border:1px solid #bbf7d0;
          padding:16px;
          margin-top:12px;
        ">
          <p style="margin:0 0 10px;font-size:17px;color:#0f172a;">
            <strong>Winning ticket:</strong>
            #${escapeHtml(ticketNumber)}
          </p>

          <p style="margin:0;font-size:17px;color:#0f172a;">
            <strong>Colour:</strong>
            ${colourDot(colour)}${escapeHtml(safeColour)}
          </p>
        </div>
      </div>

      <div style="text-align:center;margin:26px 0;">
        <span style="
          display:inline-block;
          background:${escapeHtml(brand.primaryColor)};
          color:#ffffff;
          text-decoration:none;
          padding:14px 24px;
          border-radius:999px;
          font-weight:900;
          font-size:15px;
        ">
          Congratulations
        </span>
      </div>

      <p style="margin:22px 0 0;color:#334155;font-size:16px;line-height:1.65;">
        The organiser will be in touch soon with the next steps.
      </p>
    `,
  });

  try {
    await sendEmail({
      to,
      subject: `You won ${raffleTitle}!`,
      html,
      branding,
    });
  } catch (err) {
    console.error("winner email failed", err);
  }
}

export async function sendSquaresReceiptEmail({
  to,
  name,
  gameTitle,
  amountCents,
  currency,
  reservationToken,
  squares,
  branding,
}: {
  to: string;
  name?: string | null;
  gameTitle: string;
  amountCents: number;
  currency: string;
  reservationToken: string;
  squares: number[];
  branding?: EmailBranding;
}) {
  const formattedAmount = formatCurrency(amountCents, currency);

  const squareItems = squares
    .map(
      (square) => `
        <div style="
          border:1px solid #e2e8f0;
          border-radius:14px;
          padding:13px 14px;
          margin-bottom:10px;
          background:#ffffff;
        ">
          <div style="font-size:16px;font-weight:800;color:#0f172a;">
            ◼️ Square #${escapeHtml(square)}
          </div>
        </div>
      `,
    )
    .join("");

  const html = renderEmailShell({
    branding,
    eyebrow: "Squares confirmation",
    heading: "Payment successful",
    intro: `Hi ${
      name || "there"
    }, thank you for your purchase. Your squares are confirmed below.`,
    body: `
      <div style="
        border:1px solid #e2e8f0;
        border-radius:18px;
        padding:18px;
        margin:20px 0;
        background:#f8fafc;
      ">
        ${renderInfoRow("Game", gameTitle)}
        ${renderInfoRow("Amount paid", formattedAmount)}

        <p style="margin:0;font-size:15px;color:#334155;word-break:break-word;">
          <strong style="color:#0f172a;">Reference:</strong>
          ${escapeHtml(reservationToken)}
        </p>
      </div>

      <h2 style="font-size:20px;margin:24px 0 12px;color:#0f172a;">
        Your squares
      </h2>

      <div style="margin:0 0 22px;">
        ${squareItems || `<p style="color:#64748b;">No squares found.</p>`}
      </div>
    `,
  });

  try {
    await sendEmail({
      to,
      subject: `Your squares for ${gameTitle}`,
      html,
      branding,
    });
  } catch (err) {
    console.error("squares receipt email failed", err);
  }
}

export async function sendSquaresWinnerEmail({
  to,
  name,
  gameTitle,
  squareNumber,
  prizeTitle,
  branding,
}: {
  to: string;
  name?: string | null;
  gameTitle: string;
  squareNumber: number;
  prizeTitle: string;
  branding?: EmailBranding;
}) {
  const html = renderEmailShell({
    branding,
    eyebrow: "Winner notification",
    heading: "🎉 You won!",
    intro: `Hi ${
      name || "there"
    }, congratulations — your square has been selected as a winner.`,
    body: `
      <div style="
        border:1px solid #bbf7d0;
        border-radius:20px;
        padding:22px;
        margin:20px 0;
        background:#ecfdf5;
      ">
        <p style="
          margin:0 0 14px;
          font-size:20px;
          font-weight:900;
          color:#14532d;
        ">
          ${escapeHtml(gameTitle)}
        </p>

        <div style="
          border-radius:16px;
          background:#ffffff;
          border:1px solid #bbf7d0;
          padding:16px;
          margin-top:12px;
        ">
          <p style="margin:0 0 10px;font-size:17px;color:#0f172a;">
            <strong>Prize:</strong>
            ${escapeHtml(prizeTitle)}
          </p>

          <p style="margin:0;font-size:17px;color:#0f172a;">
            <strong>Winning square:</strong>
            #${escapeHtml(squareNumber)}
          </p>
        </div>
      </div>

      <p style="margin:22px 0 0;color:#334155;font-size:16px;line-height:1.65;">
        The organiser will be in touch soon with the next steps.
      </p>
    `,
  });

  try {
    await sendEmail({
      to,
      subject: `You won ${gameTitle}!`,
      html,
      branding,
    });
  } catch (err) {
    console.error("squares winner email failed", err);
  }
}
