import { NextRequest, NextResponse } from "next/server";
import { query } from "../../../../../api/_lib/db";

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

    const { secret, email, password, name, tenantSlug } = body || {};

    const expectedSecretRaw = process.env.ADMIN_BOOTSTRAP_SECRET;

    if (!expectedSecretRaw) {
      return NextResponse.json(
        { ok: false, error: "Missing ADMIN_BOOTSTRAP_SECRET" },
        { status: 500 },
      );
    }

    const submittedSecret = normalizeSecret(secret);
    const acceptedSecrets = buildAcceptedSecrets(expectedSecretRaw);

    if (!acceptedSecrets.includes(submittedSecret)) {
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

    const existing = await query<{ id: string }>(
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
        String(tenantSlug).trim(),
        String(email).toLowerCase().trim(),
        String(password),
        String(name ?? "").trim(),
      ],
    );

    return NextResponse.json({
      ok: true,
      message: "Admin created",
    });
  } catch (error) {
    const message = getErrorMessage(error);
    console.error("SETUP ERROR:", error);

    return NextResponse.json(
      {
        ok: false,
        error: `Internal error: ${message}`,
      },
      { status: 500 },
    );
  }
}
