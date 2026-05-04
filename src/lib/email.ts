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
            🎫 ${escapeHtml(ticket.label)}
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
