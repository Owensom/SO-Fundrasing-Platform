import { NextResponse } from "next/server";
import { queryOne } from "@/lib/db";
import { checkSubscriptionCapability } from "@/lib/subscription-capabilities";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{
    tenantSlug: string;
  }>;
};

type TenantPwaSettings = {
  public_display_name: string | null;
  public_logo_url: string | null;
  public_logo_mark_url: string | null;
  subscription_tier: string | null;
  subscription_status: string | null;
  platform_owner_bypass: boolean | null;
};

function cleanText(value: unknown, fallback = "") {
  const clean = String(value || "").trim();
  return clean || fallback;
}

function cleanTenantSlug(value: unknown) {
  return cleanText(value)
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "")
    .slice(0, 80);
}

function getAbsoluteUrl(request: Request, pathOrUrl: string) {
  const clean = cleanText(pathOrUrl);

  if (!clean) return "";

  if (clean.startsWith("http://") || clean.startsWith("https://")) {
    return clean;
  }

  const origin = new URL(request.url).origin;

  return `${origin}${clean.startsWith("/") ? clean : `/${clean}`}`;
}

async function getTenantPwaSettings(tenantSlug: string) {
  return queryOne<TenantPwaSettings>(
    `
      select
        public_display_name,
        public_logo_url,
        public_logo_mark_url,
        subscription_tier,
        subscription_status,
        platform_owner_bypass
      from tenant_settings
      where tenant_slug = $1
      limit 1
    `,
    [tenantSlug],
  );
}

export async function GET(request: Request, context: RouteContext) {
  const { tenantSlug: rawTenantSlug } = await context.params;
  const tenantSlug = cleanTenantSlug(rawTenantSlug);

  if (!tenantSlug) {
    return NextResponse.json(
      {
        error: "Tenant not found.",
      },
      {
        status: 404,
      },
    );
  }

  const tenantSettings = await getTenantPwaSettings(tenantSlug);

  const brandingCapability = checkSubscriptionCapability(
    tenantSettings,
    "advanced_branding",
  );

  const canUseTenantIcon = brandingCapability.allowed;

  const tenantIconSource = canUseTenantIcon
    ? cleanText(tenantSettings?.public_logo_mark_url) ||
      cleanText(tenantSettings?.public_logo_url)
    : "";

  const iconSrc = getAbsoluteUrl(
    request,
    tenantIconSource || "/brand/icon.png",
  );

  const displayName = cleanText(
    canUseTenantIcon ? tenantSettings?.public_display_name : "",
    "SO Fundraising Platform",
  );

  const shortName = cleanText(
    canUseTenantIcon ? tenantSettings?.public_display_name : "",
    "SO Fundraising",
  ).slice(0, 28);

  const startUrl = `/c/${tenantSlug}#live-campaigns`;

  return NextResponse.json({
    name: displayName,
    short_name: shortName,
    description:
      "Support live fundraising campaigns, raffles, squares, events, auctions and donations.",
    start_url: startUrl,
    scope: "/",
    display: "standalone",
    background_color: "#f3f5f7",
    theme_color: "#0f172a",
    orientation: "portrait",
    icons: [
      {
        src: iconSrc,
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: iconSrc,
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: iconSrc,
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  });
}
