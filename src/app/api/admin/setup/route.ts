import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { sql } from "@/lib/db";

function normalize(value: unknown) {
  return String(value ?? "").trim();
}

function acceptedSecrets(raw: string) {
  const envValue = normalize(raw);
  const set = new Set<string>();

  if (!envValue) return [];

  set.add(envValue);

  const prefix = "ADMIN_BOOTSTRAP_SECRET=";
  if (envValue.startsWith(prefix)) {
    set.add(envValue.slice(prefix.length).trim());
  }

  return Array.from(set);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const secret = normalize(body?.secret);
    const tenantSlug = normalize(body?.tenantSlug);
    const email = normalize(body?.email).toLowerCase();
    const password = String(body?.password ?? "");
    const name = normalize(body?.name);

    const envRaw = process.env.ADMIN_BOOTSTRAP_SECRET;

    if (!envRaw) {
      return NextResponse.json(
        { ok: false, error: "Missing ADMIN_BOOTSTRAP_SECRET" },
        { status: 500 },
      );
    }

    const allowed = acceptedSecrets(envRaw);

    if (!allowed.includes(secret)) {
      return NextResponse.json(
        {
          ok: false,
          error: "Invalid setup secret",
          debug: {
            submitted: secret,
            submittedLength: secret.length,
            acceptedLengths: allowed.map((v) => v.length),
          },
        },
        { status: 401 },
      );
    }

    if (!tenantSlug || !email || !password || !name) {
      return NextResponse.json(
        { ok: false, error: "Missing required fields" },
        { status: 400 },
      );
    }

    const existing = await sql`
      select id
      from admin_users
      where lower(email) = ${email}
      limit 1
    `;

    if (existing.length > 0) {
      return NextResponse.json(
        { ok: false, error: "User already exists" },
        { status: 400 },
      );
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const userId = crypto.randomUUID();

    await sql`
      insert into admin_users (
        id,
        email,
        name,
        full_name,
        password_hash,
        is_active
      )
      values (
        ${userId},
        ${email},
        ${name},
        ${name},
        ${passwordHash},
        true
      )
    `;

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
