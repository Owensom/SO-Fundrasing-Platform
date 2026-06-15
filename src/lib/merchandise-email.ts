import { Resend } from "resend";

type MerchandiseReceiptItem = {
  productTitle: string | null;
  optionLabel?: string | null;
  quantity: number;
  unitPriceCents: number;
  lineTotalCents: number;
  currency?: string | null;
  linkedEventTitle?: string | null;
  fulfilmentMethod?: string | null;
  fulfilmentNote?: string | null;
};

type MerchandiseEmailBranding = {
  [key: string]: unknown;
  public_display_name?: string | null;
  public_logo_url?: string | null;
  public_logo_mark_url?: string | null;
  public_primary_colour?: string | null;
  public_accent_colour?: string | null;
  public_footer_text?: string | null;
  displayName?: string | null;
  logoUrl?: string | null;
  logoMarkUrl?: string | null;
  primaryColour?: string | null;
  accentColour?: string | null;
  footerText?: string | null;
};

type SendMerchandiseReceiptEmailInput = {
  to: string;
  name?: string | null;
  orderReference: string;
  amountCents: number;
  currency?: string | null;
  items: MerchandiseReceiptItem[];
  fulfilmentMethod?: string | null;
  linkedEventTitle?: string | null;
  bookingReference?: string | null;
  tableNumber?: string | null;
  seatNumber?: string | null;
  guestName?: string | null;
  customerNote?: string | null;
  branding?: MerchandiseEmailBranding | null;
};

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

const FROM_EMAIL =
  process.env.RESEND_FROM_EMAIL ||
  "SO Fundraising Platform <noreply@so-fundraising-platform.com>";

const PLATFORM_URL =
  process.env.NEXT_PUBLIC_APP_URL ||
  "https://so-fundraising-platform.vercel.app";

const MERCHANDISE_EMAIL_LOGO_URL = `${PLATFORM_URL}/brand/merchandise-shop-gold.png`;

function cleanText(value: unknown, fallback = "") {
  const clean = String(value ?? "").trim();
  return clean || fallback;
}

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatMoney(cents: number, currency = "GBP") {
  try {
    return new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency: currency || "GBP",
    }).format(Number(cents || 0) / 100);
  } catch {
    return `£${(Number(cents || 0) / 100).toFixed(2)}`;
  }
}

function formatFulfilmentMethod(value: string | null | undefined) {
  const clean = cleanText(value).toLowerCase();

  if (!clean) return "";

  if (clean === "collect_from_stand") return "Collect from merchandise stand";
  if (clean === "collect_from_table") return "Collect from table";
  if (clean === "deliver_to_table") return "Deliver to table";
  if (clean === "deliver_to_seat") return "Deliver to seat";
  if (clean === "post_after_event") return "Post after event";
  if (clean === "arrange_with_organiser") return "Arrange with organiser";

  if (clean === "collect_stand") return "Collect from merchandise stand";
  if (clean === "collect_table") return "Collect from table";
  if (clean === "deliver_table") return "Deliver to table";
  if (clean === "deliver_seat") return "Deliver to seat";

  if (clean === "collection") return "Collection";
  if (clean === "delivery") return "Delivery";

  return clean
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function brandName(branding?: MerchandiseEmailBranding | null) {
  return (
    cleanText(branding?.public_display_name) ||
    cleanText(branding?.displayName) ||
    "SO Fundraising Platform"
  );
}

function brandFooter(branding?: MerchandiseEmailBranding | null) {
  return (
    cleanText(branding?.public_footer_text) ||
    cleanText(branding?.footerText) ||
    "Thank you for supporting this fundraising campaign."
  );
}

function brandPrimary(branding?: MerchandiseEmailBranding | null) {
  return (
    cleanText(branding?.public_primary_colour) ||
    cleanText(branding?.primaryColour) ||
    "#0f172a"
  );
}

function brandAccent(branding?: MerchandiseEmailBranding | null) {
  return (
    cleanText(branding?.public_accent_colour) ||
    cleanText(branding?.accentColour) ||
    "#d4af37"
  );
}

function renderDetailRow(label: string, value: string | null | undefined) {
  const clean = cleanText(value);

  if (!clean) return "";

  return `
    <tr>
      <td style="padding:8px 0;color:#64748b;font-size:13px;font-weight:800;">${escapeHtml(
        label,
      )}</td>
      <td style="padding:8px 0;color:#0f172a;font-size:13px;font-weight:900;text-align:right;">${escapeHtml(
        clean,
      )}</td>
    </tr>
  `;
}

function renderMerchandiseItems(
  items: MerchandiseReceiptItem[],
  fallbackCurrency: string,
) {
  if (!items.length) {
    return `
      <tr>
        <td colspan="4" style="padding:14px;color:#64748b;font-size:14px;font-weight:700;text-align:center;">
          Merchandise order
        </td>
      </tr>
    `;
  }

  return items
    .map((item) => {
      const title = cleanText(item.productTitle, "Merchandise item");
      const optionLabel = cleanText(item.optionLabel);
      const quantity = Number(item.quantity || 0);
      const itemCurrency = cleanText(item.currency, fallbackCurrency);
      const fulfilmentMethod = formatFulfilmentMethod(item.fulfilmentMethod);
      const fulfilmentNote = cleanText(item.fulfilmentNote);
      const linkedEventTitle = cleanText(item.linkedEventTitle);

      const secondaryParts = [
        optionLabel,
        linkedEventTitle ? `Event: ${linkedEventTitle}` : "",
        fulfilmentMethod ? `Fulfilment: ${fulfilmentMethod}` : "",
        fulfilmentNote,
      ].filter(Boolean);

      return `
        <tr>
          <td style="padding:14px 0;border-bottom:1px solid #e2e8f0;">
            <div style="color:#0f172a;font-size:14px;font-weight:950;line-height:1.35;">${escapeHtml(
              title,
            )}</div>
            ${
              secondaryParts.length
                ? `<div style="margin-top:4px;color:#64748b;font-size:12px;font-weight:750;line-height:1.45;">${escapeHtml(
                    secondaryParts.join(" · "),
                  )}</div>`
                : ""
            }
          </td>
          <td style="padding:14px 0;border-bottom:1px solid #e2e8f0;color:#0f172a;font-size:14px;font-weight:850;text-align:center;">${quantity}</td>
          <td style="padding:14px 0;border-bottom:1px solid #e2e8f0;color:#475569;font-size:13px;font-weight:800;text-align:right;">${formatMoney(
            item.unitPriceCents,
            itemCurrency,
          )}</td>
          <td style="padding:14px 0;border-bottom:1px solid #e2e8f0;color:#0f172a;font-size:14px;font-weight:950;text-align:right;">${formatMoney(
            item.lineTotalCents,
            itemCurrency,
          )}</td>
        </tr>
      `;
    })
    .join("");
}

function renderMerchandiseReceiptEmail(input: SendMerchandiseReceiptEmailInput) {
  const branding = input.branding || null;
  const tenantName = brandName(branding);
  const primary = brandPrimary(branding);
  const accent = brandAccent(branding);
  const footer = brandFooter(branding);
  const currency = cleanText(input.currency, "GBP");
  const customerName = cleanText(input.name, "Supporter");
  const fulfilmentMethod = formatFulfilmentMethod(input.fulfilmentMethod);

  const detailRows = [
    renderDetailRow("Order reference", input.orderReference),
    renderDetailRow("Fulfilment", fulfilmentMethod),
    renderDetailRow("Linked event", input.linkedEventTitle),
    renderDetailRow("Booking reference", input.bookingReference),
    renderDetailRow("Table number", input.tableNumber),
    renderDetailRow("Seat number", input.seatNumber),
    renderDetailRow("Guest name", input.guestName),
    renderDetailRow("Customer note", input.customerNote),
  ].join("");

  return `
<!doctype html>
<html>
  <head>
    <meta charSet="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>Your merchandise order</title>
  </head>

  <body style="margin:0;padding:0;background:#f3f5f7;font-family:Arial,Helvetica,sans-serif;color:#0f172a;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f3f5f7;padding:24px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;background:#ffffff;border-radius:28px;overflow:hidden;border:1px solid #e2e8f0;box-shadow:0 18px 50px rgba(15,23,42,0.12);">
            <tr>
              <td style="padding:0;background:${escapeHtml(primary)};">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                  <tr>
                    <td style="padding:30px 28px 26px;text-align:center;background:radial-gradient(circle at top right, rgba(255,255,255,0.14), transparent 34%),linear-gradient(135deg, ${escapeHtml(
                      primary,
                    )} 0%, #020617 100%);">
                      <img
                        src="${escapeHtml(MERCHANDISE_EMAIL_LOGO_URL)}"
                        alt="Merchandise"
                        width="86"
                        height="86"
                        style="display:block;margin:0 auto 16px;width:86px;height:86px;object-fit:contain;border-radius:22px;"
                      />

                      <div style="display:inline-block;padding:7px 12px;border-radius:999px;background:rgba(255,255,255,0.08);border:1px solid ${escapeHtml(
                        accent,
                      )};color:${escapeHtml(
                        accent,
                      )};font-size:11px;font-weight:950;letter-spacing:0.08em;text-transform:uppercase;">
                        Merchandise order
                      </div>

                      <h1 style="margin:14px 0 0;color:#ffffff;font-size:34px;line-height:1.02;letter-spacing:-0.05em;font-weight:950;">
                        Thank you for your order
                      </h1>

                      <p style="margin:12px auto 0;max-width:460px;color:#dbeafe;font-size:15px;line-height:1.55;font-weight:700;">
                        ${escapeHtml(
                          tenantName,
                        )} has received your merchandise order. Keep this email for your records.
                      </p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <tr>
              <td style="padding:28px;">
                <p style="margin:0 0 16px;color:#334155;font-size:16px;line-height:1.55;font-weight:750;">
                  Hi ${escapeHtml(customerName)},
                </p>

                <p style="margin:0 0 22px;color:#475569;font-size:15px;line-height:1.6;font-weight:700;">
                  Your merchandise order has been confirmed. The organiser will manage fulfilment using the order details below.
                </p>

                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 22px;border-radius:22px;background:#f8fafc;border:1px solid #e2e8f0;overflow:hidden;">
                  <tr>
                    <td style="padding:20px;">
                      <div style="color:#64748b;font-size:12px;font-weight:950;letter-spacing:0.08em;text-transform:uppercase;">
                        Total paid
                      </div>

                      <div style="margin-top:6px;color:#0f172a;font-size:34px;line-height:1;font-weight:950;letter-spacing:-0.05em;">
                        ${formatMoney(input.amountCents, currency)}
                      </div>

                      <div style="margin-top:8px;color:#64748b;font-size:13px;font-weight:800;">
                        Reference: ${escapeHtml(input.orderReference)}
                      </div>
                    </td>
                  </tr>
                </table>

                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 22px;">
                  <thead>
                    <tr>
                      <th align="left" style="padding:0 0 10px;color:#64748b;font-size:11px;font-weight:950;letter-spacing:0.06em;text-transform:uppercase;border-bottom:1px solid #e2e8f0;">Item</th>
                      <th align="center" style="padding:0 0 10px;color:#64748b;font-size:11px;font-weight:950;letter-spacing:0.06em;text-transform:uppercase;border-bottom:1px solid #e2e8f0;">Qty</th>
                      <th align="right" style="padding:0 0 10px;color:#64748b;font-size:11px;font-weight:950;letter-spacing:0.06em;text-transform:uppercase;border-bottom:1px solid #e2e8f0;">Each</th>
                      <th align="right" style="padding:0 0 10px;color:#64748b;font-size:11px;font-weight:950;letter-spacing:0.06em;text-transform:uppercase;border-bottom:1px solid #e2e8f0;">Total</th>
                    </tr>
                  </thead>

                  <tbody>
                    ${renderMerchandiseItems(input.items, currency)}
                  </tbody>
                </table>

                ${
                  detailRows.trim()
                    ? `
                      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 22px;padding:16px 18px;border-radius:20px;background:#fff7ed;border:1px solid #fed7aa;">
                        <tbody>
                          ${detailRows}
                        </tbody>
                      </table>
                    `
                    : ""
                }

                <div style="padding:18px;border-radius:20px;background:#eff6ff;border:1px solid #bfdbfe;">
                  <div style="color:#1d4ed8;font-size:13px;font-weight:950;text-transform:uppercase;letter-spacing:0.06em;">
                    What happens next
                  </div>

                  <p style="margin:8px 0 0;color:#334155;font-size:14px;line-height:1.55;font-weight:750;">
                    The organiser will use your order reference and fulfilment details to prepare your merchandise. If you have any questions, reply to the organiser or contact them through the campaign page.
                  </p>
                </div>
              </td>
            </tr>

            <tr>
              <td style="padding:20px 28px 26px;background:#f8fafc;border-top:1px solid #e2e8f0;text-align:center;">
                <p style="margin:0;color:#64748b;font-size:13px;line-height:1.55;font-weight:750;">
                  ${escapeHtml(footer)}
                </p>

                <p style="margin:10px 0 0;color:#94a3b8;font-size:12px;line-height:1.45;font-weight:700;">
                  Powered by SO Fundraising Platform
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
`;
}

export async function sendMerchandiseReceiptEmail(
  input: SendMerchandiseReceiptEmailInput,
) {
  if (!resend) {
    console.warn("Merchandise receipt email skipped: RESEND_API_KEY missing");
    return;
  }

  const to = cleanText(input.to);

  if (!to) {
    console.warn("Merchandise receipt email skipped: missing recipient");
    return;
  }

  const orderReference = cleanText(input.orderReference, "merchandise order");

  await resend.emails.send({
    from: FROM_EMAIL,
    to,
    subject: `Your merchandise order ${orderReference}`,
    html: renderMerchandiseReceiptEmail(input),
  });
}
