import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { sql } from "@/lib/db";

function makeId(prefix: string) {
  return `${prefix}_${crypto.randomUUID()}`;
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as {
    secret?: string;
    email?: string;
    password?: string;
    name?: string;
    tenantSlug?: string;
  };

  const bootstrapSecret = process.env.ADMIN_BOOTSTRAP_SECRET;

  if (!bootstrapSecret) {
    return NextResponse.json(
      { ok: false, error: "Missing ADMIN_BOOTSTRAP_SECRET" },
      { status: 500 },
    );
  }

  if (!body.secret || body.secret !== bootstrapSecret) {
    return NextResponse.json(
      { ok: false, error: "Invalid setup secret" },
      { status: 403 },
    );
  }

  const email = String(body.email ?? "").trim().toLowerCase();
  const password = String(body.password ?? "");
  const name = String(body.name ?? "").trim();
  const tenantSlug = String(body.tenantSlug ?? "").trim();

  if (!email || !password || !tenantSlug) {
    return NextResponse.json(
      { ok: false, error: "Email, password, and tenant slug are required" },
      { status: 400 },
    );
  }

  if (password.length < 8) {
    return NextResponse.json(
      { ok: false, error: "Password must be at least 8 characters" },
      { status: 400 },
    );
  }

  const existingUsers = await sql`
    select id
    from admin_users
    where lower(email) = ${email}
    limit 1
  `;

  if (existingUsers.length) {
    return NextResponse.json(
      { ok: false, error: "Admin user already exists" },
      { status: 409 },
    );
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const userId = makeId("admin");

  await sql`
    insert into admin_users (
      id,
      email,
      password_hash,
      name,
      is_active,
      created_at,
      updated_at
    )
    values (
      ${userId},
      ${email},
      ${passwordHash},
      ${name || null},
      true,
      now(),
      now()
    )
  `;

  await sql`
    insert into admin_user_tenants (
      admin_user_id,
      tenant_slug,
      role,
      created_at
    )
    values (
      ${userId},
      ${tenantSlug},
      'owner',
      now()
    )
  `;

  return NextResponse.json({
    ok: true,
    user: {
      id: userId,
      email,
      name: name || null,
      tenantSlug,
    },
  });
}
