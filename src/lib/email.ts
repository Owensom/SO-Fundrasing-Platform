import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

// 🔧 Replace later with real hosted logo
const DEFAULT_LOGO =
  "https://via.placeholder.com/200x60?text=Your+Logo";

// -----------------------------
// Helpers
// -----------------------------
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

// -----------------------------
// RAFFLE RECEIPT EMAIL
// -----------------------------
export async function sendReceiptEmail({
  to,
  name,
  raffleTitle,
  amountCents,
  currency,
  reservationToken,
  tickets,
}: {
  to: string;
  name?: string | null;
  raffleTitle: string;
  amountCents: number;
  currency: string;
  reservationToken: string;
  tickets: Array<{ ticket_number: number; colour?: string | null }>;
}) {
  const formattedAmount = formatCurrency(amountCents, currency);

  const ticketItems = tickets
    .map(
      (t) =>
        `<li>#${t.ticket_number}${
          t.colour ? ` — ${t.colour}` : ""
        }</li>`,
    )
    .join("");

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#111;">
      
      <div style="text-align:center;margin-bottom:20px;">
        <img src="${DEFAULT_LOGO}" alt="Logo" style="max-height:60px;" />
      </div>

      <h2>Payment successful</h2>
      <p>Hi ${name || "there"},</p>

      <div style="border:1px solid #e5e5e5;border-radius:12px;padding:16px;margin:20px 0;">
        <p><strong>Raffle:</strong> ${raffleTitle}</p>
        <p><strong>Amount paid:</strong> ${formattedAmount}</p>
        <p><strong>Reference:</strong> ${reservationToken}</p>
      </div>

      <h3>Your tickets</h3>
      <ul>${ticketItems}</ul>

      <p style="margin-top:24px;">Good luck!</p>
    </div>
  `;

  try {
    await resend.emails.send({
      from: "Raffle Platform <onboarding@resend.dev>",
      to,
      subject: `Your tickets for ${raffleTitle}`,
      html,
    });
  } catch (err) {
    console.error("receipt email failed", err);
  }
}

// -----------------------------
// RAFFLE WINNER EMAIL
// -----------------------------
export async function sendWinnerEmail({
  to,
  name,
  raffleTitle,
  ticketNumber,
  colour,
}: {
  to: string;
  name?: string | null;
  raffleTitle: string;
  ticketNumber: number;
  colour?: string | null;
}) {
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;">
      
      <div style="text-align:center;margin-bottom:20px;">
        <img src="${DEFAULT_LOGO}" alt="Logo" style="max-height:60px;" />
      </div>

      <h2 style="color:#16a34a;">🎉 You won!</h2>
      <p>Hi ${name || "there"},</p>

      <p>Congratulations — you are the winner of:</p>

      <div style="border:1px solid #e5e5e5;border-radius:12px;padding:16px;margin:20px 0;">
        <p><strong>${raffleTitle}</strong></p>
        <p><strong>Winning ticket:</strong> #${ticketNumber}</p>
        <p><strong>Colour:</strong> ${colour || "Default"}</p>
      </div>

      <p>We’ll be in touch soon.</p>
    </div>
  `;

  try {
    await resend.emails.send({
      from: "Raffle Platform <onboarding@resend.dev>",
      to,
      subject: `You won ${raffleTitle}!`,
      html,
    });
  } catch (err) {
    console.error("winner email failed", err);
  }
}

// -----------------------------
// SQUARES RECEIPT EMAIL (RESTORED)
// -----------------------------
export async function sendSquaresReceiptEmail({
  to,
  name,
  gameTitle,
  amountCents,
  currency,
  reservationToken,
  squares,
}: {
  to: string;
  name?: string | null;
  gameTitle: string;
  amountCents: number;
  currency: string;
  reservationToken: string;
  squares: number[];
}) {
  const formattedAmount = formatCurrency(amountCents, currency);

  const squareItems = squares
    .map((s) => `<li>Square #${s}</li>`)
    .join("");

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;">
      
      <div style="text-align:center;margin-bottom:20px;">
        <img src="${DEFAULT_LOGO}" alt="Logo" style="max-height:60px;" />
      </div>

      <h2>Payment successful</h2>
      <p>Hi ${name || "there"},</p>

      <div style="border:1px solid #e5e5e5;border-radius:12px;padding:16px;margin:20px 0;">
        <p><strong>Game:</strong> ${gameTitle}</p>
        <p><strong>Amount paid:</strong> ${formattedAmount}</p>
        <p><strong>Reference:</strong> ${reservationToken}</p>
      </div>

      <h3>Your squares</h3>
      <ul>${squareItems}</ul>
    </div>
  `;

  try {
    await resend.emails.send({
      from: "Raffle Platform <onboarding@resend.dev>",
      to,
      subject: `Your squares for ${gameTitle}`,
      html,
    });
  } catch (err) {
    console.error("squares receipt email failed", err);
  }
}

// -----------------------------
// SQUARES WINNER EMAIL (RESTORED)
// -----------------------------
export async function sendSquaresWinnerEmail({
  to,
  name,
  gameTitle,
  squareNumber,
  prizeTitle,
}: {
  to: string;
  name?: string | null;
  gameTitle: string;
  squareNumber: number;
  prizeTitle: string;
}) {
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;">
      
      <div style="text-align:center;margin-bottom:20px;">
        <img src="${DEFAULT_LOGO}" alt="Logo" style="max-height:60px;" />
      </div>

      <h2 style="color:#16a34a;">🎉 You won!</h2>
      <p>Hi ${name || "there"},</p>

      <p>Congratulations — you have won:</p>

      <div style="border:1px solid #e5e5e5;border-radius:12px;padding:16px;margin:20px 0;">
        <p><strong>${gameTitle}</strong></p>
        <p><strong>Prize:</strong> ${prizeTitle}</p>
        <p><strong>Winning square:</strong> #${squareNumber}</p>
      </div>

      <p>The organiser will contact you shortly.</p>
    </div>
  `;

  try {
    await resend.emails.send({
      from: "Raffle Platform <onboarding@resend.dev>",
      to,
      subject: `You won ${gameTitle}!`,
      html,
    });
  } catch (err) {
    console.error("squares winner email failed", err);
  }
}
