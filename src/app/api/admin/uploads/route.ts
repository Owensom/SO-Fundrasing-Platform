import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { auth } from "@/auth";
import { query } from "@/lib/db";
import { getTenantSlugFromRequest } from "@/lib/tenant";
import {
  checkSubscriptionCapability,
} from "@/lib/subscription-capabilities";

export const runtime = "nodejs";

type TenantRow = {
  subscription_tier: string | null;
  subscription_status: string | null;
  platform_owner_bypass: boolean | null;
};

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function getTenantSubscription(tenantSlug: string) {
  try {
    const rows = await query<TenantRow>(
      `
        select
          subscription_tier,
          subscription_status,
          platform_owner_bypass
        from tenant_settings
        where tenant_slug = $1
        limit 1
      `,
      [tenantSlug],
    );

    return rows[0] || null;
  } catch (error) {
    console.error("Failed to load tenant subscription", error);

    return null;
  }
}

export async function POST(request: NextRequest) {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json(
      {
        ok: false,
        error: "Authentication required",
      },
      {
        status: 401,
      },
    );
  }

  const tenantSlug = getTenantSlugFromRequest(request);

  if (!tenantSlug) {
    return NextResponse.json(
      {
        ok: false,
        error: "Tenant not found",
      },
      {
        status: 404,
      },
    );
  }

  const sessionTenantSlugs = Array.isArray(session.user.tenantSlugs)
    ? session.user.tenantSlugs.map((value) => String(value))
    : [];

  if (!sessionTenantSlugs.includes(tenantSlug)) {
    return NextResponse.json(
      {
        ok: false,
        error: "Tenant access denied",
      },
      {
        status: 403,
      },
    );
  }

  const tenantSubscription = await getTenantSubscription(tenantSlug);

  const capability = checkSubscriptionCapability(
    tenantSubscription,
    "custom_campaign_images",
  );

  if (!capability.allowed) {
    return NextResponse.json(
      {
        ok: false,
        upgradeRequired: true,
        upgradeTo: capability.upgradeTo || "professional",
        error:
          capability.reason ||
          "Custom campaign images require the Professional plan.",
      },
      {
        status: 403,
      },
    );
  }

  try {
    const formData = await request.formData();

    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json(
        {
          ok: false,
          error: "File is required",
        },
        {
          status: 400,
        },
      );
    }

    const safeName = slugify(file.name || "upload");

    const pathname = `campaigns/${tenantSlug}/${Date.now()}-${safeName}`;

    const blob = await put(pathname, file, {
      access: "public",
      addRandomSuffix: false,
    });

    return NextResponse.json({
      ok: true,
      url: blob.url,
      pathname: blob.pathname,
    });
  } catch (error) {
    console.error("POST /api/admin/uploads failed", error);

    return NextResponse.json(
      {
        ok: false,
        error: "Upload failed",
      },
      {
        status: 500,
      },
    );
  }
}
