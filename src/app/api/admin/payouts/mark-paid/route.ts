import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { query } from "@/lib/db";
import { getTenantSlugFromRequest } from "@/lib/tenant";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  tenantSlug?: string;
  currency?: string;
  reference?: string;
};

type UpdatedPaymentRow = {
  id: string;
  net_amount_cents: number;
};

type SessionUserWithTenants = {
  email?: string | null;
  tenantSlugs?: string[];
};

function cleanText(value: unknown) {
  return String(value || "").trim();
}

function cleanCurrency(value: unknown) {
  return cleanText(value).toLowerCase();
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json(
        { ok: false, error: "Unauthorized" },
        { status: 401 },
      );
    }

    const user = session.user as SessionUserWithTenants;
    const verifiedTenantSlug = getTenantSlugFromRequest(request);

    const sessionTenantSlugs = Array.isArray(user.tenantSlugs)
      ? user.tenantSlugs.map((value) => String(value))
      : [];

    if (
      !verifiedTenantSlug ||
      !sessionTenantSlugs.includes(verifiedTenantSlug)
    ) {
      return NextResponse.json(
        { ok: false, error: "Tenant access denied." },
        { status: 403 },
      );
    }

    const body = (await request.json()) as Body;

    const submittedTenantSlug = cleanText(body.tenantSlug);
    const currency = cleanCurrency(body.currency);
    const reference = cleanText(body.reference);

    if (submittedTenantSlug && submittedTenantSlug !== verifiedTenantSlug) {
      return NextResponse.json(
        { ok: false, error: "Tenant access denied." },
        { status: 403 },
      );
    }

    if (!currency) {
      return NextResponse.json(
        { ok: false, error: "Missing currency." },
        { status: 400 },
      );
    }

    if (!reference) {
      return NextResponse.json(
        { ok: false, error: "A payout reference is required." },
        { status: 400 },
      );
    }

    const updated = await query<UpdatedPaymentRow>(
      `
        update platform_payments
        set
          payout_status = 'paid',
          payout_reference = $3,
          paid_out_at = now(),
          paid_out_by = $4
        where tenant_slug = $1
          and lower(coalesce(currency, 'gbp')) = $2
          and payment_status = 'paid'
          and coalesce(payout_status, 'pending') = 'pending'
        returning
          id::text,
          coalesce(net_amount_cents, 0)::int as net_amount_cents
      `,
      [verifiedTenantSlug, currency, reference, user.email || null],
    );

    const paidTotalCents = updated.reduce(
      (sum, row) => sum + Number(row.net_amount_cents || 0),
      0,
    );

    return NextResponse.json({
      ok: true,
      paidCount: updated.length,
      paidTotalCents,
      reference,
    });
  } catch (error: any) {
    console.error("mark payout paid error", error);

    return NextResponse.json(
      { ok: false, error: error?.message || "Failed to mark payout paid." },
      { status: 500 },
    );
  }
}
