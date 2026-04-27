import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

type EmailBranding = {
  name?: string | null;
  logoUrl?: string | null;
  primaryColor?: string | null;
};

const DEFAULT_BRANDING = {
  name: "SO Platform",
  logoUrl:
    "https://res.cloudinary.com/dyez8xsbw/image/upload/v1777292787/so-logo-full_dt3i5l.png",
  primaryColor: "#16a34a",
};

function getBranding(branding?: EmailBranding) {
  return {
    name: branding?.name?.trim() || DEFAULT_BRANDING.name,
    logoUrl: branding?.logoUrl?.trim() || DEFAULT_BRANDING.logoUrl,
    primaryColor: branding?.primaryColor?.trim() || DEFAULT_BRANDING.primaryColor,
  };
}

function formatCurrency(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency,
    }).format(amount / 100);
  } catch {
    return `${amount / 100} ${currency}`;
  }
}

function renderEmailShell(params: {
  branding?: EmailBranding;
  heading: string;
  intro?: string;
  body: string;
  footer?: string;
}) {
  const brand = getBranding(params.branding);

  return `
    <div style="margin:0;padding:0;background:#f8fafc;">
      <div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;padding:28px;color:#111827;">
        <div style="background:#ffffff;border:1px solid #e5e7eb;border-radius:18px;padding:28px;">
          <div style="text-align:center;margin-bottom:26px;">
            <img
              src="${brand.logoUrl}"
              alt="${brand.name}"
              style="max-width:240px;height:auto;display:block;margin:0 auto;"
            />
          </div>

          <h1 style="font-size:24px;line-height:1.25;margin:0 0 12px;color:#111827;">
            ${params.heading}
          </h1>

          ${
            params.intro
              ? `<p style="font-size:16px;line-height:1.6;margin:0 0 20px;color:#374151;">${params.intro}</p>`
              : ""
          }

          ${params.body}

          <div style="margin-top:26px;padding-top:18px;border-top:1px solid #e5e7eb;color:#64748b;font-size:13px;line-height:1.5;">
            ${params.footer || `Sent by ${brand.name}.`}
          </div>
        </div>
      </div>
    </div>
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
  branding,
}: {
  to: string;
  name?: string | null;
  raffleTitle: string;
  amountCents: number;
  currency: string;
  reservationToken: string;
  tickets: Array<{ ticket_number: number; colour?: string | null }>;
  branding?: EmailBranding;
}) {
  const formattedAmount = formatCurrency(amountCents, currency);

  const ticketItems = tickets
    .map(
      (ticket) =>
        `<li style="margin-bottom:8px;">#${ticket.ticket_number}${
          ticket.colour ? ` — ${ticket.colour}` : ""
        }</li>`,
    )
    .join("");

  const html = renderEmailShell({
    branding,
    heading: "Payment successful",
    intro: `Hi ${name || "there"}, thank you for your purchase. Your raffle tickets are confirmed below.`,
    body: `
      <div style="border:1px solid #e5e7eb;border-radius:14px;padding:18px;margin:20px 0;background:#f9fafb;">
        <p style="margin:0 0 8px;"><strong>Raffle:</strong> ${raffleTitle}</p>
        <p style="margin:0 0 8px;"><strong>Amount paid:</strong> ${formattedAmount}</p>
        <p style="margin:0;"><strong>Reference:</strong> ${reservationToken}</p>
      </div>

      <h2 style="font-size:18px;margin:22px 0 10px;">Your tickets</h2>
      <ul style="padding-left:20px;margin:0;color:#111827;">${ticketItems}</ul>

      <p style="margin-top:24px;font-weight:700;color:#16a34a;">Good luck!</p>
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

  const html = renderEmailShell({
    branding,
    heading: "🎉 You won!",
    intro: `Hi ${name || "there"}, congratulations — you are a winner.`,
    body: `
      <div style="border:1px solid #bbf7d0;border-radius:14px;padding:18px;margin:20px 0;background:#ecfdf5;">
        <p style="margin:0 0 8px;"><strong>${raffleTitle}</strong></p>
        <p style="margin:0 0 8px;"><strong>Winning ticket:</strong> #${ticketNumber}</p>
        <p style="margin:0;"><strong>Colour:</strong> ${colour || "Default"}</p>
      </div>

      <a
        href="#"
        style="display:inline-block;background:${brand.primaryColor};color:#ffffff;text-decoration:none;padding:12px 18px;border-radius:999px;font-weight:700;margin-top:8px;"
      >
        Congratulations
      </a>

      <p style="margin-top:22px;color:#374151;">The organiser will be in touch soon.</p>
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
    .map((square) => `<li style="margin-bottom:8px;">Square #${square}</li>`)
    .join("");

  const html = renderEmailShell({
    branding,
    heading: "Payment successful",
    intro: `Hi ${name || "there"}, thank you for your purchase. Your squares are confirmed below.`,
    body: `
      <div style="border:1px solid #e5e7eb;border-radius:14px;padding:18px;margin:20px 0;background:#f9fafb;">
        <p style="margin:0 0 8px;"><strong>Game:</strong> ${gameTitle}</p>
        <p style="margin:0 0 8px;"><strong>Amount paid:</strong> ${formattedAmount}</p>
        <p style="margin:0;"><strong>Reference:</strong> ${reservationToken}</p>
      </div>

      <h2 style="font-size:18px;margin:22px 0 10px;">Your squares</h2>
      <ul style="padding-left:20px;margin:0;color:#111827;">${squareItems}</ul>
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
    heading: "🎉 You won!",
    intro: `Hi ${name || "there"}, congratulations — you have won a prize.`,
    body: `
      <div style="border:1px solid #bbf7d0;border-radius:14px;padding:18px;margin:20px 0;background:#ecfdf5;">
        <p style="margin:0 0 8px;"><strong>${gameTitle}</strong></p>
        <p style="margin:0 0 8px;"><strong>Prize:</strong> ${prizeTitle}</p>
        <p style="margin:0;"><strong>Winning square:</strong> #${squareNumber}</p>
      </div>

      <p style="margin-top:22px;color:#374151;">The organiser will be in touch soon.</p>
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
