import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { auth } from "@/auth";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const tenantSlug = body.tenantSlug;

  try {
    // ✅ Replace sql tagged template with query
    const tenants = await query(
      "SELECT id FROM tenants WHERE slug = $1",
      [tenantSlug]
    );

    if (!tenants.length) {
      return NextResponse.json({ ok: false, error: "Tenant not found" }, { status: 404 });
    }

    // Any other setup logic using query instead of sql
    // Example: creating admin user for tenant
    const adminUser = await query(
      "INSERT INTO admin_users (email, password, tenant_slug) VALUES ($1, $2, $3) RETURNING id",
      [body.email, body.password, tenantSlug]
    );

    return NextResponse.json({ ok: true, tenantId: tenants[0].id, adminUserId: adminUser[0].id });
  } catch (err: any) {
    console.error("Setup route error:", err);
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
