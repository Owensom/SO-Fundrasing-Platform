import { NextRequest, NextResponse } from "next/server";
import { query } from "../../../../../api/_lib/db";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const {
      secret,
      email,
      password,
      name,
      tenantSlug,
    } = body || {};

    const expectedSecret = process.env.ADMIN_BOOTSTRAP_SECRET;

    if (!expectedSecret) {
      return NextResponse.json(
        { ok: false, error: "Missing ADMIN_BOOTSTRAP_SECRET" },
        { status: 500 },
      );
    }

    // 🔴 IMPORTANT FIX — trim both sides
    if ((secret || "").trim() !== expectedSecret.trim()) {
      return NextResponse.json(
        { ok: false, error: "Invalid setup secret" },
        { status: 401 },
      );
    }

    if (!email || !password || !tenantSlug) {
      return NextResponse.json(
        { ok: false, error: "Missing required fields" },
        { status: 400 },
      );
    }

    // Check if admin already exists for this tenant
    const existing = await query(
      `
      select id
      from admin_users
      where tenant_slug = $1
      limit 1
      `,
      [tenantSlug],
    );

    if (existing.length > 0) {
      return NextResponse.json(
        { ok: false, error: "Admin already exists for this tenant" },
        { status: 400 },
      );
    }

    // Insert admin user
    await query(
      `
      insert into admin_users (
        id,
        tenant_slug,
        email,
        password_hash,
        name,
        created_at
      )
      values ($1, $2, $3, crypt($4, gen_salt('bf')), $5, now())
      `,
      [
        crypto.randomUUID(),
        tenantSlug,
        email.toLowerCase(),
        password,
        name || "",
      ],
    );

    return NextResponse.json({
      ok: true,
      message: "Admin created",
    });
  } catch (error) {
    console.error("SETUP ERROR:", error);

    return NextResponse.json(
      { ok: false, error: "Internal error" },
      { status: 500 },
    );
  }
}
