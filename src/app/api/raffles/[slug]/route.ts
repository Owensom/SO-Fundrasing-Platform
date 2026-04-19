import { NextRequest, NextResponse } from "next/server";
import { getTenantSlugFromRequest } from "@/lib/tenant";
// keep your existing DB import here

export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string } },
) {
  const tenantSlug = getTenantSlugFromRequest(request);

  if (!tenantSlug) {
    return NextResponse.json(
      { ok: false, error: "Tenant not found" },
      { status: 404 },
    );
  }

  const slug = params.slug;

  try {
    // 🔴 THIS IS THE ONLY IMPORTANT CHANGE
    const raffle = await YOUR_DB_CALL_HERE({
      slug,
      tenantSlug,
    });

    if (!raffle) {
      return NextResponse.json(
        { ok: false, error: "Raffle not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({
      ok: true,
      raffle,
    });
  } catch (err) {
    console.error(err);

    return NextResponse.json(
      { ok: false, error: "Internal error" },
      { status: 500 },
    );
  }
}
