import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

const DEFAULT_PLATFORM_LOGO_URL =
  "https://res.cloudinary.com/dyez8xsbw/image/upload/v1777292787/so-logo-full_dt3i5l.png";

const MERCHANDISE_IMAGE_URL =
  "https://so-fundraising-platform.vercel.app/brand/so-default-merchandise.png";

type EmailBranding = {
  advancedBranding?: boolean | null;
  name?: string | null;
  logoUrl?: string | null;
  logoMarkUrl?: string | null;
  primaryColor?: string | null;
  primaryColour?: string | null;
  accentColor?: string | null;
  accentColour?: string | null;
  footerText?: string | null;
};

type MerchandiseReceiptItem = {
  productTitle: string;
  optionLabel?: string | null;
  quantity: number;
  unitPriceCents: number;
  lineTotalCents: number;
  currency?: string | null;
  linkedEventTitle?: string | null;
  fulfilmentMethod?: string | null;
  fulfilmentNote?: string | null;
};

type MerchandiseReceiptInput = {
  to: string;
  name?: string | null;
  orderReference: string;
  amountCents: number;
  currency: string;
  items: MerchandiseReceiptItem[];
  fulfilmentMethod?: string | null;
  linkedEventTitle?: string | null;
  bookingReference?: string | null;
  tableNumber?: string | null;
  seatNumber?: string | null;
  guestName?: string | null;
  customerNote?: string | null;
  branding?: EmailBranding;
};

type ResolvedBranding = {
  name: string;
  logoUrl: string;
  primaryColor: string;
  accentColor: string;
  footerText: string;
};

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

function normaliseHexColour(value: unknown, fallback: string) {
  const clean = cleanText(value).toUpperCase();

  if (/^#[0-9A-F]{6}$/.test(clean)) {
    return clean;
  }

  return fallback;
}

function resolveBranding(branding?: EmailBranding): ResolvedBranding {
  const advancedBranding = Boolean(branding?.advancedBranding);

  if (!advancedBranding) {
    return {
      name: "SO Fundraising Platform",
      logoUrl: DEFAULT_PLATFORM_LOGO_URL,
      primaryColor: "#1683F8",
      accentColor: "#FACC15",
      footerText: "Powered by SO Fundraising Platform. Supporting causes through fundraising.",
    };
  }

  const name = cleanText(branding?.name, "SO Fundraising Platform");
  const logoUrl =
    cleanText(branding?.logoMarkUrl) ||
    cleanText(branding?.logoUrl) ||
    DEFAULT_PLATFORM_LOGO_URL;

  return {
    name,
    logoUrl,
    primaryColor: normaliseHexColour(
      branding?.primaryColour || branding?.primaryColor,
      "#1683F8",
    ),
    accentColor: normaliseHexColour(
      branding?.accentColour || branding?.accentColor,
      "#FACC15",
    ),
    footerText:
      cleanText(branding?.footerText) ||
      `Powered by ${name}. Supporting causes through fundraising.`,
  };
}

function formatCurrency(amountCents: number, currency: string) {
  try {
    return new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency: cleanText(currency, "GBP"),
    }).format(Number(amountCents || 0) / 100);
  } catch {
    return `£${(Number(amountCents || 0) / 100).toFixed(2)}`;
  }
}

function fulfilmentMethodLabel(method?: string | null) {
  const clean = cleanText(method);

  if (clean === "collect_stand") return "Collect from merchandise stand";
  if (clean === "collect_table") return "Collect from table";
  if (clean === "deliver_table") return "Deliver to table";
  if (clean === "deliver_seat") return "Deliver to seat";
  if (clean === "post_after_event") return "Post after event";
  if (clean === "arrange_with_organiser") return "Arrange with organiser";

  return "";
}

function infoRow(label: string, value: unknown) {
  const clean = cleanText(value);

  if (!clean) return "";

  return `
    <p style="margin:0 0 10px;font-size:15px;line-height:1.5;color:#334155;">
      <strong style="color:#0f172a;">${escapeHtml(label)}:</strong>
      ${escapeHtml(clean)}
    </p>
  `;
}

function renderItems(items: MerchandiseReceiptItem[], fallbackCurrency: string) {
  if (!items.length) {
    return `<p style="margin:0;color:#64748b;">No merchandise items found.</p>`;
  }

  return items
    .map((item) => {
      const quantity = Math.max(1, Number(item.quantity || 1));
      const itemCurrency = cleanText(item.currency, fallbackCurrency);
      const itemFulfilment = fulfilmentMethodLabel(item.fulfilmentMethod);

      return `
        <div style="
          border:1px solid #e2e8f0;
          border-radius:18px;
          padding:16px;
          margin-bottom:12px;
          background:#ffffff;
          box-shadow:0 8px 18px rgba(15,23,42,0.04);
        ">
          <div style="
            color:#0f172a;
            font-size:17px;
            font-weight:900;
            line-height:1.25;
          ">
            ${escapeHtml(item.productTitle || "Merchandise item")}
          </div>

          <div style="
            margin-top:8px;
            color:#475569;
            font-size:14px;
            line-height:1.55;
            font-weight:750;
          ">
            Quantity: ${escapeHtml(quantity)}
            ${
              item.optionLabel
                ? ` · Option: ${escapeHtml(item.optionLabel)}`
                : ""
            }
            · ${escapeHtml(formatCurrency(Number(item.unitPriceCents || 0), itemCurrency))} each
          </div>

          <div style="
            margin-top:10px;
            display:inline-block;
            padding:7px 10px;
            border-radius:999px;
            background:#f8fafc;
            border:1px solid #e2e8f0;
            color:#0f172a;
            font-size:13px;
            font-weight:850;
          ">
            Line total: ${escapeHtml(formatCurrency(Number(item.lineTotalCents || 0), itemCurrency))}
          </div>

          ${
            item.linkedEventTitle || itemFulfilment || item.fulfilmentNote
              ? `
                <div style="
                  margin-top:12px;
                  padding:12px;
                  border-radius:14px;
                  background:#f8fafc;
                  border:1px solid #e2e8f0;
                ">
                  ${infoRow("Event", item.linkedEventTitle)}
                  ${infoRow("Fulfilment", itemFulfilment)}
                  ${infoRow("Organiser note", item.fulfilmentNote)}
                </div>
              `
              : ""
          }
        </div>
      `;
    })
    .join("");
}

function renderEmailShell({
  branding,
  heading,
  intro,
  body,
}: {
  branding?: EmailBranding;
  heading: string;
  intro: string;
  body: string;
}) {
  const brand = resolveBranding(branding);

  return `
    <!doctype html>
    <html>
      <body style="margin:0;padding:0;background:#f1f5f9;">
        <div style="display:none;max-height:0;overflow:hidden;opacity:0;">
          ${escapeHtml(heading)}
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
            <div style="
              text-align:center;
              padding:28px 22px 18px;
              background:
                radial-gradient(circle at 88% 92%, ${escapeHtml(brand.primaryColor)}58, transparent 30%),
                radial-gradient(circle at 10% 12%, ${escapeHtml(brand.accentColor)}28, transparent 26%),
                linear-gradient(135deg,#060816 0%,#0f172a 56%,#111827 100%);
            ">
              <div style="
                display:inline-block;
                max-width:322px;
                border-radius:24px;
                background:linear-gradient(135deg,rgba(255,255,255,0.98),rgba(248,250,252,0.94));
                border:1px solid rgba(226,232,240,0.96);
                box-shadow:
                  0 18px 44px rgba(15,23,42,0.22),
                  inset 0 1px 0 rgba(255,255,255,0.92);
                padding:16px 20px;
              ">
                <img
                  src="${escapeHtml(brand.logoUrl)}"
                  alt="${escapeHtml(brand.name)}"
                  width="260"
                  style="
                    display:block;
                    width:260px;
                    max-width:100%;
                    height:auto;
                    margin:0 auto;
                    border:0;
                    outline:none;
                    text-decoration:none;
                  "
                />
              </div>
            </div>

            <div style="height:6px;background:linear-gradient(90deg,${escapeHtml(
              brand.primaryColor,
            )},${escapeHtml(brand.accentColor)});"></div>

            <div style="padding:30px 26px 28px;">
              <div style="
                margin:0 auto 26px;
                max-width:320px;
                border-radius:24px;
                background:#ffffff;
                border:1px solid #e2e8f0;
                box-shadow:0 12px 28px rgba(15,23,42,0.08);
                padding:18px;
                text-align:center;
              ">
                <img
                  src="${MERCHANDISE_IMAGE_URL}"
                  alt="Merchandise receipt"
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

              <p style="
                margin:0 0 8px;
                color:${escapeHtml(brand.primaryColor)};
                font-size:13px;
                font-weight:800;
                letter-spacing:0.08em;
                text-transform:uppercase;
              ">
                Merchandise receipt
              </p>

              <h1 style="
                font-size:28px;
                line-height:1.2;
                margin:0 0 12px;
                color:#0f172a;
              ">
                ${escapeHtml(heading)}
              </h1>

              <p style="
                font-size:16px;
                line-height:1.65;
                margin:0 0 22px;
                color:#334155;
              ">
                ${escapeHtml(intro)}
              </p>

              ${body}

              <div style="
                margin-top:30px;
                padding-top:18px;
                border-top:1px solid #e2e8f0;
                color:#64748b;
                font-size:13px;
                line-height:1.6;
              ">
                ${escapeHtml(brand.footerText)}
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
  const brand = resolveBranding(params.branding);

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
    console.error("Resend merchandise email error", {
      to: params.to,
      subject: params.subject,
      error: result.error,
    });

    throw new Error(
      typeof result.error.message === "string"
        ? result.error.message
        : "Resend failed to send merchandise email",
    );
  }

  console.log("Merchandise email sent", {
    to: params.to,
    subject: params.subject,
    id: result.data?.id,
  });
}

export async function sendMerchandiseReceiptEmail({
  to,
  name,
  orderReference,
  amountCents,
  currency,
  items,
  fulfilmentMethod,
  linkedEventTitle,
  bookingReference,
  tableNumber,
  seatNumber,
  guestName,
  customerNote,
  branding,
}: MerchandiseReceiptInput) {
  const safeEmail = cleanText(to).toLowerCase();

  if (!safeEmail) {
    console.error("merchandise receipt email skipped: missing recipient", {
      orderReference,
    });
    return;
  }

  const safeCurrency = cleanText(currency, "GBP");
  const formattedAmount = formatCurrency(amountCents, safeCurrency);
  const safeOrderReference = cleanText(orderReference, "Merchandise order");
  const safeName = cleanText(name, "there");
  const fulfilmentLabel = fulfilmentMethodLabel(fulfilmentMethod);

  const fulfilmentDetailsBlock =
    fulfilmentLabel ||
    linkedEventTitle ||
    bookingReference ||
    tableNumber ||
    seatNumber ||
    guestName ||
    customerNote
      ? `
        <div style="
          border:1px solid #bfdbfe;
          border-radius:18px;
          padding:18px;
          margin:20px 0;
          background:#eff6ff;
        ">
          <p style="
            margin:0 0 10px;
            color:#1e3a8a;
            font-size:13px;
            font-weight:900;
            letter-spacing:0.08em;
            text-transform:uppercase;
          ">
            Collection / delivery details
          </p>

          ${infoRow("Event", linkedEventTitle)}
          ${infoRow("Fulfilment", fulfilmentLabel)}
          ${infoRow("Booking reference", bookingReference)}
          ${infoRow("Table number", tableNumber)}
          ${infoRow("Seat number", seatNumber)}
          ${infoRow("Guest name", guestName)}
          ${infoRow("Note", customerNote)}
        </div>
      `
      : "";

  const html = renderEmailShell({
    branding,
    heading: "Payment successful",
    intro: `Hi ${safeName}, thank you for your purchase. Your merchandise order is confirmed below.`,
    body: `
      <div style="
        border:1px solid #bbf7d0;
        border-radius:20px;
        padding:20px;
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
          Merchandise order paid
        </p>

        <h2 style="
          margin:0;
          color:#0f172a;
          font-size:28px;
          line-height:1.2;
          font-weight:900;
        ">
          ${escapeHtml(formattedAmount)}
        </h2>
      </div>

      <div style="
        border:1px solid #e2e8f0;
        border-radius:18px;
        padding:18px;
        margin:20px 0;
        background:#f8fafc;
      ">
        ${infoRow("Order reference", safeOrderReference)}
        ${infoRow("Amount paid", formattedAmount)}
      </div>

      <h2 style="font-size:20px;margin:24px 0 12px;color:#0f172a;">
        Your items
      </h2>

      <div style="margin:0 0 22px;">
        ${renderItems(items, safeCurrency)}
      </div>

      ${fulfilmentDetailsBlock}

      <div style="
        border-radius:18px;
        padding:18px;
        background:#fffbeb;
        border:1px solid #fde68a;
      ">
        <p style="margin:0;font-size:15px;line-height:1.65;color:#78350f;font-weight:800;">
          The organiser will use these details to arrange collection, delivery or event-night fulfilment where relevant.
        </p>
      </div>
    `,
  });

  try {
    await sendEmail({
      to: safeEmail,
      subject: `Your merchandise order ${safeOrderReference}`,
      html,
      branding,
    });
  } catch (error) {
    console.error("merchandise receipt email failed", {
      to: safeEmail,
      orderReference: safeOrderReference,
      error,
    });
  }
}
