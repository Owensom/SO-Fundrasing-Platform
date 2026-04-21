import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

type Ticket = {
  ticket_number: number;
  colour: string;
};

export async function sendReceiptEmail(params: {
  to: string;
  name?: string | null;
  raffleTitle: string;
  tickets: Ticket[];
  amountCents: number;
  currency: string;
  reservationToken: string;
}) {
  const {
    to,
    name,
    raffleTitle,
    tickets,
    amountCents,
    currency,
    reservationToken,
  } = params;

  if (!process.env.RESEND_API_KEY) {
    throw new Error("RESEND_API_KEY is required");
  }

  if (!to) {
    throw new Error("Recipient email is required");
  }

  const formattedAmount = new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(amountCents / 100);

  const ticketItems = tickets
    .map(
      (ticket) =>
        `<li style="margin-bottom:6px;">#${ticket.ticket_number} (${ticket.colour})</li>`,
    )
    .join("");

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#111;">
      <h2 style="margin-top:0;">Payment successful</h2>
      <p>Hi ${name || "there"},</p>
      <p>Thank you for your purchase. Your raffle receipt is below.</p>

      <div style="border:1px solid #e5e5e5;border-radius:12px;padding:16px;margin:20px 0;">
        <p style="margin:0 0 10px 0;"><strong>Raffle:</strong> ${raffleTitle}</p>
        <p style="margin:0 0 10px 0;"><strong>Amount paid:</strong> ${formattedAmount}</p>
        <p style="margin:0 0 10px 0;"><strong>Reservation:</strong> ${reservationToken}</p>
      </div>

      <h3>Your tickets</h3>
      <ul style="padding-left:20px;">
        ${ticketItems}
      </ul>

      <p style="margin-top:24px;">Please keep this email as your receipt.</p>
      <p style="margin-top:24px;font-size:12px;color:#666;">This is an automated email confirmation.</p>
    </div>
  `;

  await resend.emails.send({
    from: "Raffle Platform <onboarding@resend.dev>",
    to,
    subject: `Your tickets for ${raffleTitle}`,
    html,
  });
}
