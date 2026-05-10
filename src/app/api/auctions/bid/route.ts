import { NextRequest, NextResponse } from "next/server";
import { getTenantSlugFromRequest } from "@/lib/tenant";
import {
  createAuctionBid,
  getAuctionBySlug,
  getAuctionItemById,
  getHighestBidForItem,
} from "../../../../../api/_lib/auctions-repo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function poundsToCents(value: FormDataEntryValue | null) {
  const raw = String(value || "").replace(/[£,\s]/g, "").trim();
  const amount = Number(raw);

  if (!Number.isFinite(amount) || amount <= 0) {
    return 0;
  }

  return Math.round(amount * 100);
}

function redirectWithError(slug: string, message: string) {
  return NextResponse.redirect(
    new URL(
      `/a/${encodeURIComponent(slug)}?error=${encodeURIComponent(message)}`,
      process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000",
    ),
    { status: 303 },
  );
}

function redirectWithSuccess(slug: string) {
  return NextResponse.redirect(
    new URL(
      `/a/${encodeURIComponent(slug)}?bid=success`,
      process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000",
    ),
    { status: 303 },
  );
}

function auctionIsOpen(auction: {
  status: string;
  opens_at: string | null;
  closes_at: string | null;
}) {
  const now = Date.now();

  if (auction.status !== "published") return false;

  if (auction.opens_at) {
    const opensAt = new Date(auction.opens_at).getTime();
    if (!Number.isNaN(opensAt) && now < opensAt) return false;
  }

  if (auction.closes_at) {
    const closesAt = new Date(auction.closes_at).getTime();
    if (!Number.isNaN(closesAt) && now > closesAt) return false;
  }

  return true;
}

export async function POST(request: NextRequest) {
  try {
    const tenantSlug = getTenantSlugFromRequest(request);
    const formData = await request.formData();

    const auctionSlug = String(formData.get("auction_slug") || "").trim();
    const itemId = String(formData.get("item_id") || "").trim();

    if (!auctionSlug) {
      return NextResponse.json(
        { ok: false, error: "Auction not found" },
        { status: 400 },
      );
    }

    if (!tenantSlug) {
      return redirectWithError(auctionSlug, "Tenant not found.");
    }

    const auction = await getAuctionBySlug(auctionSlug, tenantSlug);

    if (!auction) {
      return redirectWithError(auctionSlug, "Auction not found.");
    }

    if (!auctionIsOpen(auction)) {
      return redirectWithError(
        auction.slug,
        "This auction is not currently accepting bids.",
      );
    }

    const item = await getAuctionItemById(itemId);

    if (!item || item.auction_id !== auction.id) {
      return redirectWithError(auction.slug, "Auction item not found.");
    }

    if (item.status !== "active") {
      return redirectWithError(
        auction.slug,
        "This item is not accepting bids.",
      );
    }

    const termsAccepted = formData.get("termsAccepted");

    if (!termsAccepted) {
      return redirectWithError(
        auction.slug,
        "Please accept the auction terms before bidding.",
      );
    }

    const bidderName = String(formData.get("bidder_name") || "").trim();
    const bidderEmail = String(formData.get("bidder_email") || "")
      .trim()
      .toLowerCase();
    const bidderPhone = String(formData.get("bidder_phone") || "").trim();
    const amountCents = poundsToCents(formData.get("amount"));

    if (!bidderName || !bidderEmail || !bidderEmail.includes("@")) {
      return redirectWithError(
        auction.slug,
        "Please enter your name and a valid email address.",
      );
    }

    if (amountCents <= 0) {
      return redirectWithError(auction.slug, "Please enter a valid bid amount.");
    }

    const currentHighestBid = await getHighestBidForItem(item.id);

    const minimumBid = currentHighestBid
      ? Number(currentHighestBid.amount_cents || 0) +
        Number(item.minimum_increment_cents || 0)
      : Number(item.starting_bid_cents || 0);

    if (amountCents < minimumBid) {
      return redirectWithError(
        auction.slug,
        `Your bid must be at least £${(minimumBid / 100).toFixed(2)}.`,
      );
    }

    await createAuctionBid({
      auctionId: auction.id,
      itemId: item.id,
      bidderName,
      bidderEmail,
      bidderPhone: bidderPhone || null,
      amountCents,
    });

    return redirectWithSuccess(auction.slug);
  } catch (error) {
    console.error("POST /api/auctions/bid failed", error);

    return NextResponse.json(
      { ok: false, error: "Could not place bid" },
      { status: 500 },
    );
  }
}
