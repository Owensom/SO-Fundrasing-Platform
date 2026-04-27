import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

// 🔧 Replace later with your real platform logo
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
// RECEIPT EMAIL
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
      <p>Thank you for your purchase.</p>

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
// WINNER EMAIL
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
