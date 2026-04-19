import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { sql } from "@/lib/db";

function normalizeSecret(value: unknown): string {
  return String(value ?? "").trim();
}

function buildAcceptedSecrets(rawEnvValue: string): string[] {
  const trimmed = normalizeSecret(rawEnvValue);
  const accepted = new Set<string>();

  if (!trimmed) return [];

  accepted.add(trimmed);

  const prefix = "ADMIN_BOOTSTRAP_SECRET=";
  if (trimmed.startsWith(prefix)) {
    accepted.add(trimmed.slice(prefix.length).trim());
  }

  return Array.from(accepted);
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  try {
    return JSON.stringify(error);
  } catch {
    return "Unknown error";
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const secret = normalizeSecret(body?.secret);
    const tenantSlug = String(body?.tenantSlug ?? "").trim();
    const email = String(body?.email ?? "").trim().toLowerCase();
    const password = String(body?.password ?? "");
    const name = String(body?.name ?? "").trim();

    const expectedSecretRaw = process.env.ADMIN_BOOTSTRAP_SECRET;

    if (!expectedSecretRaw) {
      return NextResponse.json(
        { ok: false, error: "Missing ADMIN_BOOTSTRAP_SECRET" },
        { status: 500 },
      );
    }

    const acceptedSecrets = buildAcceptedSecrets(expectedSecretRaw);

    if (!acceptedSecrets.includes(secret)) {
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

    const existingUsers = await sql`
      select id
      from admin_users
      where lower(email) = ${email}
      limit 1
    `;

    if (existingUsers.length > 0) {
      return NextResponse.json(
        { ok: false, error: "Admin user already exists for this email" },
        { status: 400 },
      );
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const adminUserId = crypto.randomUUID();

    await sql`
      insert into admin_users (
        id,
        email,
        name,
        password_hash,
        is_active
      )
      values (
        ${adminUserId},
        ${email},
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
        ${adminUserId},
        ${tenantSlug}
      )
    `;

    return NextResponse.json({
      ok: true,
      message: "Admin created. You can now sign in at /admin/login.",
    });
  } catch (error) {
    const message = getErrorMessage(error);
    console.error("SETUP ERROR:", error);

    return NextResponse.json(
      { ok: false, error: `Internal error: ${message}` },
      { status: 500 },
    );
  }
}
