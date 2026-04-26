// src/app/api/admin/raffles/[id]/actions/route.ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { deleteRaffle } from "@/lib/raffles";
import { getTenantSlugFromHeaders } from "@/lib/tenant";

export const runtime = "nodejs";

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const tenantSlug = await getTenantSlugFromHeaders();
  if (!tenantSlug) return NextResponse.json({ ok: false, error: "Tenant not found" }, { status: 400 });

  try {
    await deleteRaffle(params.id, tenantSlug);
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("Delete raffle error:", err);
    return NextResponse.json({ ok: false, error: err.message || "Failed to delete raffle" }, { status: 500 });
  }
}
