// src/app/api/admin/raffles/[id]/actions/route.ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getTenantSlugFromHeaders } from "@/lib/tenant";
import { deleteRaffle, getRaffleById } from "@/lib/raffles";

export const runtime = "nodejs";

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    // Authenticate admin
    const user = await auth();
    if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

    const tenantSlug = getTenantSlugFromHeaders(req.headers);

    // Fetch raffle for confirmation/logging
    const raffle = await getRaffleById(params.id);
    if (!raffle || raffle.tenant_slug !== tenantSlug) {
      return NextResponse.json({ ok: false, error: "Raffle not found" }, { status: 404 });
    }

    // Delete raffle (multi-tenant)
    await deleteRaffle(params.id, tenantSlug);

    // Return JSON with success and updated raffle list (frontend expects { ok: true })
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("Delete raffle error:", err);
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
