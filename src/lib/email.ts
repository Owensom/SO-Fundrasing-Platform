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
      <h2>Payment successful</h2>
      <p>Hi ${name || "there"},</p>
      <p>Thank you for your purchase. Your raffle receipt is below.</p>

      <div style="border:1px solid #e5e5e5;border-radius:12px;padding:16px;margin:20px 0;">
        <p><strong>Raffle:</strong> ${raffleTitle}</p>
        <p><strong>Amount paid:</strong> ${formattedAmount}</p>
        <p><strong>Reservation:</strong> ${reservationToken}</p>
      </div>

      <h3>Your tickets</h3>
      <ul>${ticketItems}</ul>

      <p style="margin-top:24px;">Please keep this email as your receipt.</p>
    </div>
  `;

  await resend.emails.send({
    from: "Raffle Platform <onboarding@resend.dev>",
    to,
    subject: `Your tickets for ${raffleTitle}`,
    html,
  });
}

export async function sendSquaresReceiptEmail(params: {
  to: string;
  name?: string | null;
  gameTitle: string;
  squares: number[];
  amountCents: number;
  currency: string;
  reservationToken: string;
}) {
  const {
    to,
    name,
    gameTitle,
    squares,
    amountCents,
    currency,
    reservationToken,
  } = params;

  if (!to) {
    throw new Error("Recipient email is required");
  }

  const formattedAmount = new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(amountCents / 100);

  const squareItems = squares
    .map((square) => `<li>Square #${square}</li>`)
    .join("");

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#111;">
      <h2>Payment successful</h2>
      <p>Hi ${name || "there"},</p>
      <p>Thank you for your purchase. Your squares receipt is below.</p>

      <div style="border:1px solid #e5e5e5;border-radius:12px;padding:16px;margin:20px 0;">
        <p><strong>Game:</strong> ${gameTitle}</p>
        <p><strong>Amount paid:</strong> ${formattedAmount}</p>
        <p><strong>Reservation:</strong> ${reservationToken}</p>
      </div>

      <h3>Your squares</h3>
      <ul>${squareItems}</ul>
    </div>
  `;

  await resend.emails.send({
    from: "Raffle Platform <onboarding@resend.dev>",
    to,
    subject: `Your squares for ${gameTitle}`,
    html,
  });
}

export async function sendWinnerEmail(params: {
  to: string;
  name?: string | null;
  raffleTitle: string;
  ticketNumber: number;
  colour?: string | null;
}) {
  const { to, name, raffleTitle, ticketNumber, colour } = params;

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;">
      <h2 style="color:#16a34a;">🎉 You won!</h2>
      <p>Hi ${name || "there"},</p>

      <p>You are the winner of:</p>

      <div style="border:1px solid #e5e5e5;border-radius:12px;padding:16px;margin:20px 0;">
        <p><strong>${raffleTitle}</strong></p>
        <p><strong>Winning ticket:</strong> #${ticketNumber}</p>
        <p><strong>Colour:</strong> ${colour || "Default"}</p>
      </div>
    </div>
  `;

  await resend.emails.send({
    from: "Raffle Platform <onboarding@resend.dev>",
    to,
    subject: `🎉 You won: ${raffleTitle}`,
    html,
  });
}

export async function sendSquaresWinnerEmail(params: {
  to: string;
  name?: string | null;
  gameTitle: string;
  squareNumber: number;
  prizeTitle: string;
}) {
  const { to, name, gameTitle, squareNumber, prizeTitle } = params;

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;">
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

  await resend.emails.send({
    from: "Raffle Platform <onboarding@resend.dev>",
    to,
    subject: `🎉 You won: ${gameTitle}`,
    html,
  });
}
