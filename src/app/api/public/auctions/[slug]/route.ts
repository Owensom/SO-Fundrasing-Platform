import { NextRequest, NextResponse } from "next/server";
import { queryOne } from "@/lib/db";
import { getTenantSlugFromRequest } from "@/lib/tenant";
import {
  getAuctionBySlug,
  listAuctionItems,
} from "../../../../../../api/_lib/auctions-repo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteProps = {
  params: Promise<{
    slug: string;
  }>;
};

type TenantBrandingSettings = {
  public_display_name: string | null;
  public_tagline: string | null;
  public_logo_url: string | null;
  public_logo_mark_url: string | null;
  public_primary_colour: string | null;
  public_accent_colour: string | null;
  public_footer_text: string | null;
};

async function getTenantBrandingSettings(tenantSlug: string) {
  return queryOne<TenantBrandingSettings>(
    `
      select
        public_display_name,
        public_tagline,
        public_logo_url,
        public_logo_mark_url,
        public_primary_colour,
        public_accent_colour,
        public_footer_text
      from tenant_settings
      where tenant_slug = $1
      limit 1
    `,
    [tenantSlug],
  );
}

export async function GET(request: NextRequest, { params }: RouteProps) {
  const resolvedParams = await params;
  const slug = String(resolvedParams.slug || "").trim();
  const tenantSlug = getTenantSlugFromRequest(request) || "demo-a";

  if (!slug) {
    return NextResponse.json(
      { ok: false, error: "Auction slug is required" },
      { status: 400 },
    );
  }

  try {
    const auction = await getAuctionBySlug(slug, tenantSlug);

    if (!auction || auction.status === "draft") {
      return NextResponse.json(
        { ok: false, error: "Auction not found" },
        { status: 404 },
      );
    }

    const [items, branding] = await Promise.all([
      listAuctionItems(auction.id),
      getTenantBrandingSettings(auction.tenant_slug),
    ]);

    return NextResponse.json({
      ok: true,
      auction,
      items: items.filter((item) => item.status !== "withdrawn"),
      branding,
    });
  } catch (error) {
    console.error("GET /api/public/auctions/[slug] failed", error);

    return NextResponse.json(
      { ok: false, error: "Failed to load auction" },
      { status: 500 },
    );
  }
}
