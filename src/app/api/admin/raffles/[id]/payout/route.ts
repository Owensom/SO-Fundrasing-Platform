import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { query, queryOne } from "@/lib/db";
import { getTenantSlugFromHeaders } from "@/lib/tenant";
import { getRaffleById } from "@/lib/raffles";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type WinnerRow = {
  id: string;
};

type PayoutStatus = "pending" | "paid" | "not_required";

function cleanText(value: FormDataEntryValue | string | null | undefined) {
  return String(value || "").trim();
}

function normalisePayoutStatus(value: FormDataEntryValue | string | null) {
  const clean = cleanText(value).toLowerCase();

  if (clean === "paid") return "paid";
  if (clean === "not_required") return "not_required";

  return "pending";
}

function normaliseDate(value: FormDataEntryValue | string | null) {
  const clean = cleanText(value);

  if (!clean) return null;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(clean)) {
    return null;
  }

  return clean;
}

async function requireTenantAccess() {
  const session = await auth();

  if (!session?.user) {
    return {
      ok: false as const,
      response: NextResponse.json(
        { ok: false, error: "Unauthorized" },
        { status: 401 },
      ),
    };
  }

  const tenantSlug = await getTenantSlugFromHeaders();

  const sessionTenantSlugs = Array.isArray(session.user.tenantSlugs)
    ? session.user.tenantSlugs.map((value) => String(value))
    : [];

  if (!tenantSlug || !sessionTenantSlugs.includes(tenantSlug)) {
    return {
      ok: false as const,
      response: NextResponse.json(
        { ok: false, error: "Tenant access denied" },
        { status: 403 },
      ),
    };
  }

  return {
    ok: true as const,
    session,
    tenantSlug,
  };
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    const access = await requireTenantAccess();

    if (!access.ok) {
      return access.response;
    }

    const { session, tenantSlug } = access;

    const raffle = await getRaffleById(id);

    if (!raffle || raffle.tenant_slug !== tenantSlug) {
      return NextResponse.json(
        { ok: false, error: "Raffle not found" },
        { status: 404 },
      );
    }

    if (raffle.raffle_subtype !== "fifty_fifty") {
      return NextResponse.json(
        { ok: false, error: "Payout tracking is only available for 50/50 raffles." },
        { status: 400 },
      );
    }

    if (raffle.status !== "drawn") {
      return NextResponse.json(
        { ok: false, error: "Draw the raffle before updating payout tracking." },
        { status: 400 },
      );
    }

    const formData = await request.formData();

    const payoutStatus = normalisePayoutStatus(
      formData.get("payout_status"),
    ) as PayoutStatus;

    const payoutMethod = cleanText(formData.get("payout_method")) || null;
    const payoutDate = normaliseDate(formData.get("payout_date"));
    const payoutReference = cleanText(formData.get("payout_reference")) || null;
    const payoutNote = cleanText(formData.get("payout_note")) || null;

    const winner = await queryOne<WinnerRow>(
      `
        select id
        from raffle_winners
        where tenant_slug = $1
          and raffle_id = $2
          and raffle_subtype_snapshot = 'fifty_fifty'
        order by prize_position asc
        limit 1
      `,
      [tenantSlug, raffle.id],
    );

    if (!winner) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "No 50/50 winner snapshot was found. Draw the 50/50 raffle again using the current draw action.",
        },
        { status: 404 },
      );
    }

    await query(
      `
        update raffle_winners
        set
          payout_status = $3,
          payout_method = $4,
          payout_date = $5,
          payout_reference = $6,
          payout_note = $7,
          payout_recorded_by = $8,
          payout_recorded_at = now()
        where id = $1
          and tenant_slug = $2
          and raffle_id = $9
          and raffle_subtype_snapshot = 'fifty_fifty'
      `,
      [
        winner.id,
        tenantSlug,
        payoutStatus,
        payoutMethod,
        payoutDate,
        payoutReference,
        payoutNote,
        session.user.email ?? null,
        raffle.id,
      ],
    );

    return NextResponse.redirect(
      new URL(`/admin/raffles/${raffle.id}`, request.url),
      { status: 303 },
    );
  } catch (error: any) {
    console.error("50/50 payout update failed", error);

    return NextResponse.json(
      { ok: false, error: error?.message || "Payout update failed" },
      { status: 500 },
    );
  }
}
