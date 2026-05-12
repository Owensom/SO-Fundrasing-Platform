import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

const DEFAULT_TICKET_IMAGE_URL =
  "https://so-fundraising-platform.vercel.app/brand/so-ticket-placeholder.png";

const WINNER_TROPHY_IMAGE_URL =
  "https://so-fundraising-platform.vercel.app/brand/winner-trophy-gold.png";

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

function renderTicketHero(label = "SO Fundraising Ticket") {
  return `
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
        src="${DEFAULT_TICKET_IMAGE_URL}"
        alt="${escapeHtml(label)}"
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
  `;
}

function renderWinnerTrophyHero(label = "Winner trophy") {
  return `
    <div style="
      margin:0 auto 30px;
      max-width:420px;
      border-radius:34px;
      background:
        radial-gradient(circle at top, rgba(250,204,21,0.18), transparent 52%),
        linear-gradient(135deg,#020617 0%,#0f172a 50%,#312e81 100%);
      border:1px solid rgba(250,204,21,0.45);
      box-shadow:
        0 28px 60px rgba(15,23,42,0.24),
        inset 0 1px 0 rgba(255,255,255,0.06);
      padding:28px 22px;
      text-align:center;
    ">
      <img
        src="${WINNER_TROPHY_IMAGE_URL}"
        alt="${escapeHtml(label)}"
        width="320"
        style="
          display:block;
          width:100%;
          max-width:320px;
          height:auto;
          margin:0 auto;
          border:0;
          outline:none;
          text-decoration:none;
          filter:
            drop-shadow(0 12px 30px rgba(250,204,21,0.35))
            drop-shadow(0 0 20px rgba(250,204,21,0.18));
        "
      />

      <div style="
        margin-top:14px;
        color:#facc15;
        font-size:13px;
        font-weight:900;
        letter-spacing:0.18em;
        text-transform:uppercase;
      ">
        Winner Confirmed
      </div>
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
  ticketImageLabel?: string;
  winnerTrophyLabel?: string;
  showTicketImage?: boolean;
  showWinnerTrophy?: boolean;
}) {
  const brand = getBranding(params.branding);
  const showTicketImage = params.showTicketImage !== false;

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

              ${
                params.showWinnerTrophy
                  ? renderWinnerTrophyHero(params.winnerTrophyLabel)
                  : showTicketImage
                    ? renderTicketHero(params.ticketImageLabel)
                    : ""
              }

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
    console.error("Resend email error", {
      to: params.to,
      subject: params.subject,
      error: result.error,
    });

    throw new Error(
      typeof result.error.message === "string"
        ? result.error.message
        : "Resend failed to send email",
    );
  }

  console.log("Email sent", {
    to: params.to,
    subject: params.subject,
    id: result.data?.id,
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
            Ticket #${escapeHtml(ticket.ticket_number)}
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
    ticketImageLabel: "Raffle ticket confirmation",
    intro: `Hi ${name || "there"}, thank you for your purchase. Your raffle tickets are confirmed below.`,
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
        ${ticketItems || `<p style="color:#64748b;">No ticket numbers found.</p>`}
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
  prizeTitle,
  ticketNumber,
  colour,
  branding,
}: {
  to: string;
  name?: string | null;
  raffleTitle: string;
  prizeTitle?: string | null;
  ticketNumber: number;
  colour?: string | null;
  branding?: EmailBranding;
}) {
  const safeColour = colour || "Default";
  const safePrizeTitle = String(prizeTitle || "").trim();

  const html = renderEmailShell({
    branding,
    eyebrow: "Winner notification",
    heading: "You won!",
    showWinnerTrophy: true,
    showTicketImage: false,
    winnerTrophyLabel: "Winning raffle trophy",
    intro: `Hi ${name || "there"}, congratulations — your ticket has been selected as a winner.`,
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
          ${
            safePrizeTitle
              ? `
                <p style="margin:0 0 10px;font-size:17px;color:#0f172a;">
                  <strong>Prize won:</strong>
                  ${escapeHtml(safePrizeTitle)}
                </p>
              `
              : ""
          }

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

      <p style="margin:22px 0 0;color:#334155;font-size:16px;line-height:1.65;">
        The organiser will be in touch soon with the next steps.
      </p>
    `,
  });

  try {
    await sendEmail({
      to,
      subject: safePrizeTitle
        ? `You won ${safePrizeTitle}!`
        : `You won ${raffleTitle}!`,
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
            Square #${escapeHtml(square)}
          </div>
        </div>
      `,
    )
    .join("");

  const html = renderEmailShell({
    branding,
    eyebrow: "Squares confirmation",
    heading: "Payment successful",
    ticketImageLabel: "Squares entry confirmation",
    intro: `Hi ${name || "there"}, thank you for your purchase. Your squares are confirmed below.`,
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
  const safePrizeTitle = String(prizeTitle || "").trim() || "Prize";

  const html = renderEmailShell({
    branding,
    eyebrow: "Squares winner",
    heading: "You won!",
    showWinnerTrophy: true,
    showTicketImage: false,
    winnerTrophyLabel: "Winning squares trophy",
    intro: `Hi ${name || "there"}, congratulations — you have won ${safePrizeTitle}.`,
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
            <strong>Prize won:</strong>
            ${escapeHtml(safePrizeTitle)}
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
      subject: `You won ${safePrizeTitle}`,
      html,
      branding,
    });
  } catch (err) {
    console.error("squares winner email failed", err);
  }
}
export async function sendEventReceiptEmail({
  to,
  name,
  eventTitle,
  amountCents,
  currency,
  orderReference,
  tickets,
  eventDate,
  location,
  branding,
}: {
  to: string;
  name?: string | null;
  eventTitle: string;
  amountCents: number;
  currency: string;
  orderReference: string;
  tickets: Array<{
    label: string;
    quantity?: number | null;
    unit_amount?: number | null;
  }>;
  eventDate?: string | null;
  location?: string | null;
  branding?: EmailBranding;
}) {
  const formattedAmount = formatCurrency(amountCents, currency);
  const formattedEventDate = formatDrawDate(eventDate);

  const ticketItems = tickets
    .map((ticket) => {
      const quantity = Number(ticket.quantity || 1);
      const unitAmount = Number(ticket.unit_amount || 0);

      return `
        <div style="
          border:1px solid #e2e8f0;
          border-radius:14px;
          padding:13px 14px;
          margin-bottom:10px;
          background:#ffffff;
        ">
          <div style="font-size:16px;font-weight:800;color:#0f172a;">
            ${escapeHtml(ticket.label)}
          </div>
          <div style="margin-top:5px;font-size:14px;color:#475569;">
            Quantity: ${escapeHtml(quantity)}
            ${
              unitAmount > 0
                ? ` · ${escapeHtml(formatCurrency(unitAmount, currency))}`
                : ""
            }
          </div>
        </div>
      `;
    })
    .join("");

  const html = renderEmailShell({
    branding,
    eyebrow: "Event ticket confirmation",
    heading: "Payment successful",
    ticketImageLabel: "Event ticket confirmation",
    intro: `Hi ${name || "there"}, thank you for your purchase. Your event tickets are confirmed below.`,
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
        ${renderInfoRow("Amount paid", formattedAmount)}

        <p style="margin:0;font-size:15px;color:#334155;word-break:break-word;">
          <strong style="color:#0f172a;">Reference:</strong>
          ${escapeHtml(orderReference)}
        </p>
      </div>

      <h2 style="font-size:20px;margin:24px 0 12px;color:#0f172a;">
        Your tickets
      </h2>

      <div style="margin:0 0 22px;">
        ${ticketItems || `<p style="color:#64748b;">No tickets found.</p>`}
      </div>

      <div style="
        border-radius:18px;
        padding:18px;
        background:#ecfdf5;
        border:1px solid #bbf7d0;
      ">
        <p style="margin:0;font-size:16px;line-height:1.6;color:#166534;font-weight:800;">
          Your event booking is confirmed.
        </p>
      </div>
    `,
  });

  try {
    await sendEmail({
      to,
      subject: `Your tickets for ${eventTitle}`,
      html,
      branding,
    });
  } catch (err) {
    console.error("event receipt email failed", err);
  }
}

export async function sendEventWinnerEmail({
  to,
  name,
  eventTitle,
  prizeTitle,
  winningEntry,
  branding,
}: {
  to: string;
  name?: string | null;
  eventTitle: string;
  prizeTitle: string;
  winningEntry?: string | null;
  branding?: EmailBranding;
}) {
  const html = renderEmailShell({
    branding,
    eyebrow: "Event winner",
    heading: "You won!",
    showWinnerTrophy: true,
    showTicketImage: false,
    winnerTrophyLabel: "Winning event trophy",
    intro: `Hi ${name || "there"}, congratulations — you have been selected as a winner.`,
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
          ${escapeHtml(eventTitle)}
        </p>

        <div style="
          border-radius:16px;
          background:#ffffff;
          border:1px solid #bbf7d0;
          padding:16px;
          margin-top:12px;
        ">
          ${renderInfoRow("Prize", prizeTitle)}
          ${renderInfoRow("Winning entry", winningEntry)}
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
      subject: `You won ${prizeTitle}`,
      html,
      branding,
    });
  } catch (err) {
    console.error("event winner email failed", err);
  }
}

export async function sendAuctionBidConfirmationEmail({
  to,
  name,
  auctionTitle,
  itemTitle,
  amountCents,
  currency,
  closesAt,
  branding,
}: {
  to: string;
  name?: string | null;
  auctionTitle: string;
  itemTitle: string;
  amountCents: number;
  currency: string;
  closesAt?: string | null;
  branding?: EmailBranding;
}) {
  const formattedAmount = formatCurrency(amountCents, currency);
  const formattedCloseDate = formatDrawDate(closesAt);

  const html = renderEmailShell({
    branding,
    eyebrow: "Bid confirmation",
    heading: "Your bid has been placed",
    ticketImageLabel: "Auction bid confirmation",
    intro: `Hi ${name || "there"}, thank you — your silent auction bid has been received.`,
    body: `
      <div style="
        border:1px solid #e2e8f0;
        border-radius:18px;
        padding:18px;
        margin:20px 0;
        background:#f8fafc;
      ">
        ${renderInfoRow("Auction", auctionTitle)}
        ${renderInfoRow("Item", itemTitle)}
        ${renderInfoRow("Your bid", formattedAmount)}
        ${renderInfoRow("Auction closes", formattedCloseDate)}
      </div>

      <div style="
        border-radius:18px;
        padding:18px;
        background:#eff6ff;
        border:1px solid #bfdbfe;
      ">
        <p style="margin:0;font-size:16px;line-height:1.6;color:#1e3a8a;font-weight:800;">
          Your bid is binding. If you are the winning bidder, the organiser will contact you after the auction closes.
        </p>
      </div>
    `,
  });

  try {
    await sendEmail({
      to,
      subject: `Your bid for ${itemTitle}`,
      html,
      branding,
    });
  } catch (err) {
    console.error("auction bid confirmation email failed", err);
  }
}

export async function sendAuctionOutbidEmail({
  to,
  name,
  auctionTitle,
  itemTitle,
  previousAmountCents,
  newAmountCents,
  currency,
  closesAt,
  branding,
}: {
  to: string;
  name?: string | null;
  auctionTitle: string;
  itemTitle: string;
  previousAmountCents: number;
  newAmountCents: number;
  currency: string;
  closesAt?: string | null;
  branding?: EmailBranding;
}) {
  const previousAmount = formatCurrency(previousAmountCents, currency);
  const newAmount = formatCurrency(newAmountCents, currency);
  const formattedCloseDate = formatDrawDate(closesAt);

  const html = renderEmailShell({
    branding,
    eyebrow: "Auction update",
    heading: "You have been outbid",
    ticketImageLabel: "Auction update",
    intro: `Hi ${name || "there"}, another bidder has placed a higher bid on an item you were leading.`,
    body: `
      <div style="
        border:1px solid #fed7aa;
        border-radius:18px;
        padding:18px;
        margin:20px 0;
        background:#fff7ed;
      ">
        ${renderInfoRow("Auction", auctionTitle)}
        ${renderInfoRow("Item", itemTitle)}
        ${renderInfoRow("Your previous bid", previousAmount)}
        ${renderInfoRow("New highest bid", newAmount)}
        ${renderInfoRow("Auction closes", formattedCloseDate)}
      </div>

      <div style="
        border-radius:18px;
        padding:18px;
        background:#eff6ff;
        border:1px solid #bfdbfe;
      ">
        <p style="margin:0;font-size:16px;line-height:1.6;color:#1e3a8a;font-weight:800;">
          You can return to the auction page and place a new bid before the auction closes.
        </p>
      </div>
    `,
  });

  try {
    await sendEmail({
      to,
      subject: `You have been outbid on ${itemTitle}`,
      html,
      branding,
    });
  } catch (err) {
    console.error("auction outbid email failed", err);
  }
}

export async function sendAuctionWinnerEmail({
  to,
  name,
  auctionTitle,
  itemTitle,
  winningAmountCents,
  currency,
  branding,
}: {
  to: string;
  name?: string | null;
  auctionTitle: string;
  itemTitle: string;
  winningAmountCents: number;
  currency: string;
  branding?: EmailBranding;
}) {
  const winningAmount = formatCurrency(winningAmountCents, currency);
  const prizeName = String(itemTitle || "").trim() || "Auction prize";

  const html = renderEmailShell({
    branding,
    eyebrow: "Auction winner",
    heading: "You are the winning bidder",
    showWinnerTrophy: true,
    showTicketImage: false,
    winnerTrophyLabel: "Winning auction trophy",
    intro: `Hi ${name || "there"}, congratulations — you placed the winning bid in the silent auction.`,
    body: `
      <div style="
        border:1px solid #bbf7d0;
        border-radius:20px;
        padding:22px;
        margin:20px 0;
        background:#ecfdf5;
      ">
        <p style="
          margin:0 0 8px;
          color:#166534;
          font-size:13px;
          font-weight:900;
          letter-spacing:0.08em;
          text-transform:uppercase;
        ">
          Prize won
        </p>

        <h2 style="
          margin:0 0 18px;
          color:#0f172a;
          font-size:26px;
          line-height:1.2;
          font-weight:900;
        ">
          ${escapeHtml(prizeName)}
        </h2>

        <div style="
          border-radius:16px;
          background:#ffffff;
          border:1px solid #bbf7d0;
          padding:16px;
        ">
          ${renderInfoRow("Auction", auctionTitle)}
          ${renderInfoRow("Winning bid", winningAmount)}
        </div>
      </div>

      <p style="margin:22px 0 0;color:#334155;font-size:16px;line-height:1.65;">
        The organiser will be in touch soon with payment or collection details.
      </p>
    `,
  });

  try {
    await sendEmail({
      to,
      subject: `You won ${prizeName}`,
      html,
      branding,
    });
  } catch (err) {
    console.error("auction winner email failed", err);
  }
}
