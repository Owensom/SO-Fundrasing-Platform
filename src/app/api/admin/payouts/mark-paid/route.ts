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

export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json(
        { ok: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = (await request.json()) as Body;

    const tenantSlug =
      typeof body.tenantSlug === "string" ? body.tenantSlug.trim() : "";

    const currency =
      typeof body.currency === "string"
        ? body.currency.trim().toLowerCase()
        : "";

    const reference =
      typeof body.reference === "string" ? body.reference.trim() : "";

    if (!tenantSlug || !currency) {
      return NextResponse.json(
        { ok: false, error: "Missing tenant or currency." },
        { status: 400 }
      );
    }

    const updated = await query<{ id: string }>(
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
        and payout_status = 'pending'
      returning id::text
      `,
      [tenantSlug, currency, reference || null, session.user.email || null]
    );

    return NextResponse.json({
      ok: true,
      paidCount: updated.length,
    });
  } catch (error: any) {
    console.error("mark payout paid error", error);

    return NextResponse.json(
      { ok: false, error: error?.message || "Failed to mark payout paid." },
      { status: 500 }
    );
  }
}
