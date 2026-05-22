import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { query } from "@/lib/db";
import { getTenantSlugFromHeaders } from "@/lib/tenant";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type DonationExportRow = {
  id: string;
  tenant_slug: string;
  campaign_type: string | null;
  campaign_id: string | null;
  campaign_title: string | null;
  donor_name: string | null;
  donor_email: string | null;
  message: string | null;
  amount_cents: number | string | null;
  currency: string | null;
  payment_status: string | null;
  stripe_checkout_session_id: string | null;
  stripe_payment_intent_id: string | null;
  created_at: string | null;
  paid_at: string | null;
  donor_covered_fees: boolean | null;
  donor_fee_cents: number | string | null;
  gross_amount_cents: number | string | null;
  platform_fee_cents: number | string | null;
  net_amount_cents: number | string | null;
  gift_aid_claimed: boolean | null;
  gift_aid_first_name: string | null;
  gift_aid_last_name: string | null;
  gift_aid_address_line_1: string | null;
  gift_aid_address_line_2: string | null;
  gift_aid_town_or_city: string | null;
  gift_aid_postcode: string | null;
  gift_aid_declaration_text: string | null;
  gift_aid_declaration_accepted_at: string | null;
};

const HEADERS = [
  "Donation ID",
  "Tenant",
  "Campaign Type",
  "Campaign ID",
  "Campaign Title",
  "Donor Name",
  "Donor Email",
  "Message",
  "Donation Amount",
  "Currency",
  "Payment Status",
  "Stripe Checkout Session ID",
  "Stripe Payment Intent ID",
  "Created At",
  "Paid At",
  "Donor Covered Fees",
  "Donor Fee",
  "Gross Amount",
  "Platform Fee",
  "Net Amount",
  "Gift Aid Claimed",
  "Gift Aid First Name",
  "Gift Aid Last Name",
  "Gift Aid Address Line 1",
  "Gift Aid Address Line 2",
  "Gift Aid Town or City",
  "Gift Aid Postcode",
  "Gift Aid Declaration Text",
  "Gift Aid Declaration Accepted At",
];

function csvEscape(value: unknown) {
  if (value === null || value === undefined) {
    return "";
  }

  const stringValue =
    typeof value === "boolean" ? (value ? "Yes" : "No") : String(value);

  return `"${stringValue.replaceAll('"', '""')}"`;
}

function centsToPounds(value: unknown) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return "0.00";
  }

  return (number / 100).toFixed(2);
}

function safeSlug(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function formatDateForFilename(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function rowToCsv(row: DonationExportRow) {
  return [
    row.id,
    row.tenant_slug,
    row.campaign_type,
    row.campaign_id,
    row.campaign_title,
    row.donor_name,
    row.donor_email,
    row.message,
    centsToPounds(row.amount_cents),
    row.currency || "GBP",
    row.payment_status,
    row.stripe_checkout_session_id,
    row.stripe_payment_intent_id,
    row.created_at,
    row.paid_at,
    Boolean(row.donor_covered_fees),
    centsToPounds(row.donor_fee_cents),
    centsToPounds(row.gross_amount_cents ?? row.amount_cents),
    centsToPounds(row.platform_fee_cents),
    centsToPounds(row.net_amount_cents ?? row.amount_cents),
    Boolean(row.gift_aid_claimed),
    row.gift_aid_first_name,
    row.gift_aid_last_name,
    row.gift_aid_address_line_1,
    row.gift_aid_address_line_2,
    row.gift_aid_town_or_city,
    row.gift_aid_postcode,
    row.gift_aid_declaration_text,
    row.gift_aid_declaration_accepted_at,
  ]
    .map(csvEscape)
    .join(",");
}

async function getDonationExportRows(tenantSlug: string) {
  return query<DonationExportRow>(
    `
      select
        id::text,
        tenant_slug,
        campaign_type,
        campaign_id,
        campaign_title,
        donor_name,
        donor_email,
        message,
        amount_cents,
        currency,
        payment_status,
        stripe_checkout_session_id,
        stripe_payment_intent_id,
        created_at::text,
        paid_at::text,
        donor_covered_fees,
        donor_fee_cents,
        gross_amount_cents,
        platform_fee_cents,
        net_amount_cents,
        gift_aid_claimed,
        gift_aid_first_name,
        gift_aid_last_name,
        gift_aid_address_line_1,
        gift_aid_address_line_2,
        gift_aid_town_or_city,
        gift_aid_postcode,
        gift_aid_declaration_text,
        gift_aid_declaration_accepted_at::text
      from public_donations
      where tenant_slug = $1
      order by created_at desc
    `,
    [tenantSlug],
  );
}

export async function GET() {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json(
      { ok: false, error: "Authentication required." },
      { status: 401 },
    );
  }

  const tenantSlug = await getTenantSlugFromHeaders();

  const sessionTenantSlugs = Array.isArray(session.user.tenantSlugs)
    ? session.user.tenantSlugs.map((value) => String(value))
    : [];

  if (!tenantSlug || !sessionTenantSlugs.includes(tenantSlug)) {
    return NextResponse.json(
      { ok: false, error: "Tenant access denied." },
      { status: 403 },
    );
  }

  const rows = await getDonationExportRows(tenantSlug);

  const csv = [
    HEADERS.map(csvEscape).join(","),
    ...rows.map((row) => rowToCsv(row)),
  ].join("\r\n");

  const filename = `donations-gift-aid-${safeSlug(
    tenantSlug,
  )}-${formatDateForFilename()}.csv`;

  return new NextResponse(`\uFEFF${csv}`, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
