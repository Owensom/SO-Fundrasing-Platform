import { NextRequest, NextResponse } from "next/server";
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

    const items = await listAuctionItems(auction.id);

    return NextResponse.json({
      ok: true,
      auction,
      items: items.filter((item) => item.status !== "withdrawn"),
    });
  } catch (error) {
    console.error("GET /api/public/auctions/[slug] failed", error);

    return NextResponse.json(
      { ok: false, error: "Failed to load auction" },
      { status: 500 },
    );
  }
}
