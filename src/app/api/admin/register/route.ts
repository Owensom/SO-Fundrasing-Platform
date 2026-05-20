import { NextRequest, NextResponse } from "next/server";
import { getDbClient } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RegisterInput = {
  organisationName: string;
  tenantSlug: string;
  adminName: string;
  email: string;
  password: string;
  confirmPassword: string;
};

function cleanText(value: unknown) {
  return String(value || "").trim();
}

function cleanEmail(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

function isValidTenantSlug(value: string) {
  return /^[a-z0-9][a-z0-9-]{1,58}[a-z0-9]$/.test(value);
}

function isStrongEnoughPassword(value: string) {
  return value.length >= 10;
}

async function readRegisterInput(request: NextRequest): Promise<RegisterInput> {
  const contentType = request.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    const body = await request.json();

    return {
      organisationName: cleanText(body.organisationName),
      tenantSlug: cleanText(body.tenantSlug),
      adminName: cleanText(body.adminName),
      email: cleanEmail(body.email),
      password: String(body.password || ""),
      confirmPassword: String(body.confirmPassword || ""),
    };
  }

  const formData = await request.formData();

  return {
    organisationName: cleanText(formData.get("organisationName")),
    tenantSlug: cleanText(formData.get("tenantSlug")),
    adminName: cleanText(formData.get("adminName")),
    email: cleanEmail(formData.get("email")),
    password: String(formData.get("password") || ""),
    confirmPassword: String(formData.get("confirmPassword") || ""),
  };
}

function redirectWithError(request: NextRequest, error: string) {
  return NextResponse.redirect(
    new URL(`/admin/register?error=${encodeURIComponent(error)}`, request.url),
    { status: 303 },
  );
}

function redirectWithSuccess(request: NextRequest, tenantSlug: string) {
  return NextResponse.redirect(
    new URL(
      `/admin/login?registered=1&tenant=${encodeURIComponent(tenantSlug)}`,
      request.url,
    ),
    { status: 303 },
  );
}

export async function POST(request: NextRequest) {
  const input = await readRegisterInput(request);

  const organisationName = input.organisationName;
  const tenantSlug = slugify(input.tenantSlug || input.organisationName);
  const adminName = input.adminName;
  const email = input.email;
  const password = input.password;
  const confirmPassword = input.confirmPassword;

  if (!organisationName) {
    return redirectWithError(request, "organisation_required");
  }

  if (!tenantSlug || !isValidTenantSlug(tenantSlug)) {
    return redirectWithError(request, "invalid_slug");
  }

  if (!adminName) {
    return redirectWithError(request, "admin_name_required");
  }

  if (!email || !email.includes("@")) {
    return redirectWithError(request, "invalid_email");
  }

  if (!isStrongEnoughPassword(password)) {
    return redirectWithError(request, "weak_password");
  }

  if (password !== confirmPassword) {
    return redirectWithError(request, "password_mismatch");
  }

  const tenantId = crypto.randomUUID();
  const adminUserId = crypto.randomUUID();

  const pool = getDbClient();
  const client = await pool.connect();

  try {
    await client.query("begin");

    const existingTenants = await client.query(
      `
        select slug
        from tenants
        where slug = $1
        limit 1
      `,
      [tenantSlug],
    );

    if (existingTenants.rows.length > 0) {
      await client.query("rollback");
      return redirectWithError(request, "tenant_exists");
    }

    const existingAdmins = await client.query(
      `
        select id
        from admin_users
        where lower(email) = lower($1)
        limit 1
      `,
      [email],
    );

    if (existingAdmins.rows.length > 0) {
      await client.query("rollback");
      return redirectWithError(request, "email_exists");
    }

    await client.query(
      `
        insert into tenants (
          id,
          slug,
          name,
          logo_url,
          primary_colour,
          created_at,
          updated_at
        )
        values (
          $1,
          $2,
          $3,
          null,
          '#1683f8',
          now(),
          now()
        )
      `,
      [tenantId, tenantSlug, organisationName],
    );

    await client.query(
      `
        insert into tenant_settings (
          tenant_slug,
          subscription_tier,
          platform_fee_percent,
          stripe_customer_id,
          stripe_subscription_id,
          stripe_connect_account_id,
          subscription_status,
          buyer_fee_contributions_enabled,
          crm_enabled,
          auctions_enabled,
          reserved_seating_enabled,
          finance_dashboard_enabled,
          white_label_enabled,
          custom_domain_enabled,
          created_at,
          updated_at
        )
        values (
          $1,
          'community',
          7,
          null,
          null,
          null,
          'active',
          true,
          false,
          false,
          false,
          false,
          false,
          false,
          now(),
          now()
        )
      `,
      [tenantSlug],
    );

    await client.query(
      `
        insert into tenant_branding (
          tenant_id,
          organisation_name,
          tagline,
          primary_color,
          secondary_color,
          accent_color,
          logo_url,
          logo_mark_url,
          favicon_url,
          hero_image_url,
          email_banner_url,
          font_family,
          custom_domain,
          created_at,
          updated_at
        )
        values (
          $1,
          $2,
          null,
          '#1683f8',
          '#0f172a',
          '#facc15',
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          now(),
          now()
        )
      `,
      [tenantId, organisationName],
    );

    await client.query(
      `
        insert into admin_users (
          id,
          tenant_id,
          email,
          full_name,
          role,
          auth_provider,
          auth_provider_user_id,
          is_active,
          created_at,
          updated_at,
          name,
          password_hash
        )
        values (
          $1,
          $2,
          $3,
          $4,
          'owner',
          'credentials',
          null,
          true,
          now(),
          now(),
          $4,
          crypt($5, gen_salt('bf'))
        )
      `,
      [adminUserId, tenantId, email, adminName, password],
    );

    await client.query(
      `
        insert into admin_user_tenants (
          admin_user_id,
          tenant_slug,
          role,
          created_at
        )
        values (
          $1,
          $2,
          'owner',
          now()
        )
      `,
      [adminUserId, tenantSlug],
    );

    await client.query("commit");

    return redirectWithSuccess(request, tenantSlug);
  } catch (error) {
    await client.query("rollback");

    console.error("ADMIN_REGISTER_FAILED", {
      message: error instanceof Error ? error.message : String(error),
      tenantSlug,
      email,
    });

    return redirectWithError(request, "failed");
  } finally {
    client.release();
  }
}
