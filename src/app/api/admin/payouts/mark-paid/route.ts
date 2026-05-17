import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { query } from "@/lib/db";

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

function cleanText(value: unknown) {
  return String(value || "").trim();
}

function cleanCurrency(value: unknown) {
  return cleanText(value).toLowerCase();
}

function getSessionTenantSlugs(session: Awaited<ReturnType<typeof auth>>) {
  const tenantSlugs = session?.user?.tenantSlugs;

  if (!Array.isArray(tenantSlugs)) {
    return [];
  }

  return tenantSlugs.map((value) => String(value));
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

    const body = (await request.json()) as Body;

    const tenantSlug = cleanText(body.tenantSlug);
    const currency = cleanCurrency(body.currency);
    const reference = cleanText(body.reference);

    if (!tenantSlug || !currency) {
      return NextResponse.json(
        { ok: false, error: "Missing tenant or currency." },
        { status: 400 },
      );
    }

    if (!reference) {
      return NextResponse.json(
        { ok: false, error: "A payout reference is required." },
        { status: 400 },
      );
    }

    const sessionTenantSlugs = getSessionTenantSlugs(session);

    if (!sessionTenantSlugs.includes(tenantSlug)) {
      return NextResponse.json(
        { ok: false, error: "Tenant access denied." },
        { status: 403 },
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
        and coalesce(currency, 'gbp') = $2
        and payment_status = 'paid'
        and coalesce(payout_status, 'pending') = 'pending'
      returning
        id::text,
        coalesce(net_amount_cents, 0)::int as net_amount_cents
      `,
      [tenantSlug, currency, reference, session.user.email || null],
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
