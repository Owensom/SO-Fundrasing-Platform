import { NextRequest, NextResponse } from "next/server";
import { getTenantSlugFromRequest } from "@/lib/tenant";
import { listRaffles } from "../../../../../api/_lib/raffles-repo";

export async function GET(request: NextRequest) {
  const tenantSlug = getTenantSlugFromRequest(request);

  if (!tenantSlug) {
    return NextResponse.json(
      { ok: false, error: "Tenant not found" },
      { status: 404 },
    );
  }

  try {
    const items = await listRaffles(tenantSlug);

    return NextResponse.json({
      ok: true,
      items,
    });
  } catch (error) {
    console.error("GET /api/admin/raffles failed", error);

    return NextResponse.json(
      { ok: false, error: "Internal error" },
      { status: 500 },
    );
  }
}
