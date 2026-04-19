import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { sql } from "@/lib/db";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const secret = String(body?.secret ?? "").trim();
    const tenantSlug = String(body?.tenantSlug ?? "").trim();
    const email = String(body?.email ?? "").trim().toLowerCase();
    const password = String(body?.password ?? "");
    const name = String(body?.name ?? "").trim();

    const expectedSecret = String(process.env.ADMIN_BOOTSTRAP_SECRET ?? "").trim();

    if (!expectedSecret) {
      return NextResponse.json(
        { ok: false, error: "Missing ADMIN_BOOTSTRAP_SECRET" },
        { status: 500 },
      );
    }

    if (secret !== expectedSecret) {
      return NextResponse.json(
        { ok: false, error: "Invalid setup secret" },
        { status: 401 },
      );
    }

    if (!tenantSlug || !email || !password || !name) {
      return NextResponse.json(
        { ok: false, error: "Missing required fields" },
        { status: 400 },
      );
    }

    // 🔴 GET TENANT ID FROM SLUG
    const tenants = await sql`
      select id
      from tenants
      where slug = ${tenantSlug}
      limit 1
    `;

    if (tenants.length === 0) {
      return NextResponse.json(
        { ok: false, error: "Tenant not found" },
        { status: 404 },
      );
    }

    const tenantId = tenants[0].id;

    // check existing user
    const existing = await sql`
      select id from admin_users where lower(email) = ${email} limit 1
    `;

    if (existing.length > 0) {
      return NextResponse.json(
        { ok: false, error: "User already exists" },
        { status: 400 },
      );
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const userId = crypto.randomUUID();

    // ✅ INSERT WITH tenant_id
    await sql`
      insert into admin_users (
        id,
        tenant_id,
        email,
        name,
        full_name,
        password_hash,
        is_active
      )
      values (
        ${userId},
        ${tenantId},
        ${email},
        ${name},
        ${name},
        ${passwordHash},
        true
      )
    `;

    // link to tenant (used by auth)
    await sql`
      insert into admin_user_tenants (
        admin_user_id,
        tenant_slug
      )
      values (
        ${userId},
        ${tenantSlug}
      )
    `;

    return NextResponse.json({
      ok: true,
      message: "Admin created",
    });
  } catch (err) {
    console.error("SETUP ERROR:", err);

    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 },
    );
  }
}
