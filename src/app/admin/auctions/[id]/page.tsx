import type { CSSProperties, ReactNode } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { getTenantSlugFromHeaders } from "@/lib/tenant";
import { sendAuctionWinnerEmail } from "@/lib/email";
import ImageFocusUploadField from "@/components/ImageFocusUploadField";
import {
  createAuctionItem,
  deleteAuction,
  deleteAuctionItem,
  getAuctionById,
  listAuctionBids,
  listAuctionItems,
  updateAuction,
  updateAuctionItem,
  type AuctionItemStatus,
  type AuctionStatus,
} from "../../../../../api/_lib/auctions-repo";

const DEFAULT_AUCTION_IMAGE = "/brand/so-default-auctions.png";

type PageProps = {
  params: Promise<{
    id: string;
  }>;
};

function moneyFromCents(cents: number | null | undefined, currency = "GBP") {
  const amount = Number(cents || 0) / 100;

  try {
    return new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency: currency || "GBP",
    }).format(amount);
  } catch {
    return `£${amount.toFixed(2)}`;
  }
}

function poundsToCents(value: FormDataEntryValue | null) {
  const raw = String(value || "").replace(/[£,\s]/g, "").trim();
  const amount = Number(raw);

  if (!Number.isFinite(amount) || amount < 0) return 0;

  return Math.round(amount * 100);
}

function optionalPoundsToCents(value: FormDataEntryValue | null) {
  const raw = String(value || "").replace(/[£,\s]/g, "").trim();

  if (!raw) return null;

  const amount = Number(raw);

  if (!Number.isFinite(amount) || amount < 0) return null;

  return Math.round(amount * 100);
}

function centsToPoundsInput(cents: number | null | undefined) {
  if (cents === null || cents === undefined) return "";
  return (Number(cents || 0) / 100).toFixed(2);
}

function cleanFocus(value: FormDataEntryValue | null) {
  const number = Number(value);

  if (!Number.isFinite(number)) return 50;

  return Math.max(0, Math.min(100, Math.round(number)));
}

function focusValue(value: number | null | undefined) {
  const number = Number(value);

  if (!Number.isFinite(number)) return 50;

  return Math.max(0, Math.min(100, Math.round(number)));
}

function focusedImageStyle(
  focusX: number | null | undefined,
  focusY: number | null | undefined,
): CSSProperties {
  return {
    width: "100%",
    height: "100%",
    objectFit: "cover",
    objectPosition: `${focusValue(focusX)}% ${focusValue(focusY)}%`,
    display: "block",
  };
}

function defaultAuctionImageStyle(padding = 20): CSSProperties {
  return {
    width: "100%",
    height: "100%",
    objectFit: "contain",
    objectPosition: "center",
    display: "block",
    padding,
    boxSizing: "border-box",
    background:
      "linear-gradient(135deg, #ffffff 0%, #f8fafc 55%, #eff6ff 100%)",
  };
}

function toDateTimeLocalValue(value: string | null | undefined) {
  if (!value) return "";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "";

  const offsetMs = date.getTimezoneOffset() * 60 * 1000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

function cleanDateTime(value: FormDataEntryValue | null) {
  const raw = String(value || "").trim();

  if (!raw) return null;

  const date = new Date(raw);

  if (Number.isNaN(date.getTime())) return null;

  return date.toISOString();
}

function formatDate(value: string | null | undefined) {
  if (!value) return "Not scheduled";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "Not scheduled";

  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function getStatusStyle(status: string | null | undefined): CSSProperties {
  const clean = String(status || "draft").toLowerCase();

  if (clean === "published" || clean === "active") {
    return {
      background: "#dcfce7",
      color: "#166534",
      border: "1px solid #bbf7d0",
    };
  }

  if (clean === "closed") {
    return {
      background: "#fff7ed",
      color: "#9a3412",
      border: "1px solid #fed7aa",
    };
  }

  if (clean === "withdrawn") {
    return {
      background: "#fee2e2",
      color: "#991b1b",
      border: "1px solid #fecaca",
    };
  }

  return {
    background: "#f1f5f9",
    color: "#475569",
    border: "1px solid #e2e8f0",
  };
}

function auctionStatusLabel(status: string | null | undefined) {
  const clean = String(status || "draft").toLowerCase();

  if (clean === "published") return "Published";
  if (clean === "closed") return "Closed";
  return "Draft";
}

async function requireAuctionAccess(id: string) {
  const session = await auth();

  if (!session?.user) {
    redirect("/admin/login");
  }

  const tenantSlug = await getTenantSlugFromHeaders();
  const sessionTenantSlugs = Array.isArray(session.user.tenantSlugs)
    ? session.user.tenantSlugs.map((value) => String(value))
    : [];

  if (!tenantSlug || !sessionTenantSlugs.includes(tenantSlug)) {
    redirect("/admin/login?error=tenant_access_denied");
  }

  const auction = await getAuctionById(id, tenantSlug);

  if (!auction) {
    notFound();
  }

  return { auction, tenantSlug };
}

async function updateAuctionAction(formData: FormData) {
  "use server";

  const id = String(formData.get("id") || "").trim();

  if (!id) redirect("/admin/auctions");

  const { auction } = await requireAuctionAccess(id);

  await updateAuction(auction.id, {
    title: String(formData.get("title") || "").trim() || "Untitled auction",
    slug:
      String(formData.get("slug") || "").trim().toLowerCase() || auction.slug,
    description: String(formData.get("description") || "").trim() || null,
    imageUrl:
      String(formData.get("image_url") || "").trim() || DEFAULT_AUCTION_IMAGE,
    imageFocusX: cleanFocus(formData.get("image_focus_x")),
    imageFocusY: cleanFocus(formData.get("image_focus_y")),
    status: String(formData.get("status") || "draft") as AuctionStatus,
    currency: String(formData.get("currency") || "GBP").trim() || "GBP",
    opensAt: cleanDateTime(formData.get("opens_at")),
    closesAt: cleanDateTime(formData.get("closes_at")),
    termsText: String(formData.get("terms_text") || "").trim() || null,
  });

  redirect(`/admin/auctions/${auction.id}#auction-settings`);
}

async function closeAuctionAndNotifyWinnersAction(formData: FormData) {
  "use server";

  const auctionId = String(formData.get("auction_id") || "").trim();

  if (!auctionId) redirect("/admin/auctions");

  const { auction } = await requireAuctionAccess(auctionId);
  const items = await listAuctionItems(auction.id);
  const bids = await listAuctionBids(auction.id);

  const winnerByItemId = new Map<
    string,
    {
      bidder_name: string | null;
      bidder_email: string | null;
      amount_cents: number;
    }
  >();

  for (const bid of bids) {
    const itemId = String(bid.item_id || "");
    if (!itemId) continue;

    const amountCents = Number(bid.amount_cents || 0);
    const existing = winnerByItemId.get(itemId);

    if (!existing || amountCents > Number(existing.amount_cents || 0)) {
      winnerByItemId.set(itemId, {
        bidder_name: bid.bidder_name || null,
        bidder_email: bid.bidder_email || null,
        amount_cents: amountCents,
      });
    }
  }

  for (const item of items) {
    if (item.status !== "active") continue;

    await updateAuctionItem(item.id, {
      title: item.title,
      description: item.description,
      imageUrl: item.image_url,
      imageFocusX: item.image_focus_x ?? 50,
      imageFocusY: item.image_focus_y ?? 50,
      donorName: item.donor_name,
      startingBidCents: Number(item.starting_bid_cents || 0),
      minimumIncrementCents: Number(item.minimum_increment_cents || 100),
      reservePriceCents: item.reserve_price_cents,
      status: "closed",
      sortOrder: Number(item.sort_order || 0),
    });

    const winner = winnerByItemId.get(item.id);

    if (!winner?.bidder_email) continue;

    if (
      item.reserve_price_cents !== null &&
      item.reserve_price_cents !== undefined &&
      Number(winner.amount_cents || 0) < Number(item.reserve_price_cents || 0)
    ) {
      continue;
    }

    await sendAuctionWinnerEmail({
      to: winner.bidder_email,
      name: winner.bidder_name,
      auctionTitle: auction.title,
      itemTitle: item.title,
      winningAmountCents: Number(winner.amount_cents || 0),
      currency: auction.currency || "GBP",
    });
  }

  await updateAuction(auction.id, {
    title: auction.title,
    slug: auction.slug,
    description: auction.description,
    imageUrl: auction.image_url || DEFAULT_AUCTION_IMAGE,
    imageFocusX: auction.image_focus_x ?? 50,
    imageFocusY: auction.image_focus_y ?? 50,
    status: "closed",
    currency: auction.currency || "GBP",
    opensAt: auction.opens_at,
    closesAt: auction.closes_at || new Date().toISOString(),
    termsText: auction.terms_text,
  });

  redirect(`/admin/auctions/${auction.id}#winner-tools`);
}

async function deleteClosedAuctionAction(formData: FormData) {
  "use server";

  const auctionId = String(formData.get("auction_id") || "").trim();

  if (!auctionId) redirect("/admin/auctions");

  const { auction } = await requireAuctionAccess(auctionId);

  if (auction.status !== "closed") {
    redirect(`/admin/auctions/${auction.id}#danger-zone`);
  }

  await deleteAuction(auction.id);

  redirect("/admin/auctions");
}

async function createAuctionItemAction(formData: FormData) {
  "use server";

  const auctionId = String(formData.get("auction_id") || "").trim();

  if (!auctionId) redirect("/admin/auctions");

  const { auction } = await requireAuctionAccess(auctionId);

  await createAuctionItem({
    auctionId: auction.id,
    title: String(formData.get("title") || "").trim() || "Untitled item",
    description: String(formData.get("description") || "").trim() || null,
    imageUrl: String(formData.get("image_url") || "").trim() || null,
    imageFocusX: cleanFocus(formData.get("image_focus_x")),
    imageFocusY: cleanFocus(formData.get("image_focus_y")),
    donorName: String(formData.get("donor_name") || "").trim() || null,
    startingBidCents: poundsToCents(formData.get("starting_bid")),
    minimumIncrementCents:
      poundsToCents(formData.get("minimum_increment")) || 100,
    reservePriceCents: optionalPoundsToCents(formData.get("reserve_price")),
    status: String(formData.get("status") || "active") as AuctionItemStatus,
    sortOrder: Number(formData.get("sort_order") || 0),
  });

  redirect(`/admin/auctions/${auction.id}#items`);
}
async function updateAuctionItemAction(formData: FormData) {
  "use server";

  const auctionId = String(formData.get("auction_id") || "").trim();
  const itemId = String(formData.get("item_id") || "").trim();

  if (!auctionId || !itemId) redirect("/admin/auctions");

  const { auction } = await requireAuctionAccess(auctionId);

  await updateAuctionItem(itemId, {
    title: String(formData.get("title") || "").trim() || "Untitled item",
    description: String(formData.get("description") || "").trim() || null,
    imageUrl: String(formData.get("image_url") || "").trim() || null,
    imageFocusX: cleanFocus(formData.get("image_focus_x")),
    imageFocusY: cleanFocus(formData.get("image_focus_y")),
    donorName: String(formData.get("donor_name") || "").trim() || null,
    startingBidCents: poundsToCents(formData.get("starting_bid")),
    minimumIncrementCents:
      poundsToCents(formData.get("minimum_increment")) || 100,
    reservePriceCents: optionalPoundsToCents(formData.get("reserve_price")),
    status: String(formData.get("status") || "active") as AuctionItemStatus,
    sortOrder: Number(formData.get("sort_order") || 0),
  });

  redirect(`/admin/auctions/${auction.id}#items`);
}

async function deleteAuctionItemAction(formData: FormData) {
  "use server";

  const auctionId = String(formData.get("auction_id") || "").trim();
  const itemId = String(formData.get("item_id") || "").trim();

  if (!auctionId || !itemId) redirect("/admin/auctions");

  const { auction } = await requireAuctionAccess(auctionId);

  await deleteAuctionItem(itemId);

  redirect(`/admin/auctions/${auction.id}#items`);
}

const responsiveStyles = `
@media (max-width: 980px) {
  .auction-edit-page {
    overflow-x: hidden;
  }

  .auction-edit-page * {
    max-width: 100%;
  }

  .auction-edit-page section,
  .auction-edit-page form,
  .auction-edit-page details,
  .auction-edit-page summary,
  .auction-edit-page div,
  .auction-edit-page label {
    min-width: 0 !important;
  }

  .auction-edit-page .hero,
  .auction-edit-page .heroMetaGrid,
  .auction-edit-page .summaryGrid,
  .auction-edit-page .grid,
  .auction-edit-page .twoCol,
  .auction-edit-page .threeCol,
  .auction-edit-page .mediaBox,
  .auction-edit-page .winnerRow,
  .auction-edit-page .itemSummary,
  .auction-edit-page .bidGrid {
    grid-template-columns: 1fr !important;
  }

  .auction-edit-page .tabBar {
    overflow-x: auto !important;
    flex-wrap: nowrap !important;
    -webkit-overflow-scrolling: touch !important;
  }

  .auction-edit-page .tabButton,
  .auction-edit-page .dangerTabButton {
    white-space: nowrap !important;
    flex: 0 0 auto !important;
  }

  .auction-edit-page .heroImageWrap,
  .auction-edit-page .previewBox {
    height: 220px !important;
  }

  .auction-edit-page .topActions,
  .auction-edit-page .submitBar,
  .auction-edit-page .dangerPanel {
    align-items: stretch !important;
  }

  .auction-edit-page .saveButton,
  .auction-edit-page .closeButton,
  .auction-edit-page .deleteButton,
  .auction-edit-page .deleteAuctionButton,
  .auction-edit-page .disabledDangerButton,
  .auction-edit-page .heroButtonDark,
  .auction-edit-page .heroButtonLight,
  .auction-edit-page .dangerOutlineButton {
    width: 100% !important;
    justify-content: center !important;
    text-align: center !important;
    box-sizing: border-box !important;
  }

  .auction-edit-page .itemsList,
  .auction-edit-page .bidHistory {
    overflow-x: hidden !important;
  }
}

@media (max-width: 640px) {
  .auction-edit-page {
    padding: 18px 12px 44px !important;
  }

  .auction-edit-page .hero {
    padding: 18px !important;
    border-radius: 24px !important;
  }

  .auction-edit-page .title {
    font-size: clamp(31px, 10vw, 42px) !important;
    line-height: 1.02 !important;
  }

  .auction-edit-page .card,
  .auction-edit-page .itemExpanded,
  .auction-edit-page .itemCreateCard {
    padding: 14px !important;
  }

  .auction-edit-page .collapsibleSummary,
  .auction-edit-page .itemSummary,
  .auction-edit-page .createSummary {
    align-items: flex-start !important;
  }

  .auction-edit-page .collapsibleActions {
    width: 100% !important;
    justify-content: flex-start !important;
  }

  .auction-edit-page .sectionBadge,
  .auction-edit-page .collapsibleToggle {
    max-width: none !important;
  }

  .auction-edit-page .statValue {
    font-size: 20px !important;
  }

  .auction-edit-page .heroImageWrap,
  .auction-edit-page .previewBox {
    height: 190px !important;
  }

  .auction-edit-page .summaryImageWrap {
    width: 100% !important;
    height: 180px !important;
  }
}
`;

export default async function AdminAuctionDetailPage({ params }: PageProps) {
  const resolvedParams = await params;

  const { auction, tenantSlug } = await requireAuctionAccess(resolvedParams.id);

  const items = await listAuctionItems(auction.id);
  const bids = await listAuctionBids(auction.id);

  const activeItems = items.filter((item) => item.status === "active").length;
  const totalBids = bids.length;

  const highestBid =
    bids.length > 0
      ? Math.max(...bids.map((bid) => Number(bid.amount_cents || 0)))
      : 0;

  const winnerRows = items.map((item, index) => {
    const itemBids = bids.filter((bid) => bid.item_id === item.id);

    const topBid =
      itemBids.length > 0
        ? itemBids.reduce((highest, bid) =>
            Number(bid.amount_cents || 0) > Number(highest.amount_cents || 0)
              ? bid
              : highest,
          )
        : null;

    const reserveMet =
      !topBid ||
      item.reserve_price_cents === null ||
      item.reserve_price_cents === undefined
        ? true
        : Number(topBid.amount_cents || 0) >=
          Number(item.reserve_price_cents || 0);

    return {
      item,
      index,
      topBid,
      reserveMet,
    };
  });

  const hasCustomImage =
    Boolean(auction.image_url) && auction.image_url !== DEFAULT_AUCTION_IMAGE;

  return (
    <main className="auction-edit-page" style={styles.page}>
      <style>{responsiveStyles}</style>

      <section className="hero" style={styles.hero}>
        <div style={styles.heroCopy}>
          <div style={styles.badge}>Auction editor</div>

          <div style={styles.heroTitleRow}>
            <h1 className="so-brand-heading title" style={styles.title}>
              {auction.title || "Untitled auction"}
            </h1>

            <span
              style={{
                ...styles.statusPill,
                ...getStatusStyle(auction.status),
              }}
            >
              {auctionStatusLabel(auction.status)}
            </span>
          </div>

          <p style={styles.subtitle}>/a/{auction.slug}</p>

          <p style={styles.description}>
            {auction.description || "No description added yet."}
          </p>

          <div className="heroMetaGrid" style={styles.heroMetaGrid}>
            <HeroMetric label="Auction type" value="Silent auction" />
            <HeroMetric
              label="Status"
              value={auctionStatusLabel(auction.status)}
            />
            <HeroMetric label="Opens" value={formatDate(auction.opens_at)} />
            <HeroMetric label="Closes" value={formatDate(auction.closes_at)} />
          </div>
        </div>

        <div style={styles.heroPreview}>
          <div style={styles.previewKicker}>Public preview</div>

          <div className="heroImageWrap" style={styles.heroImageWrap}>
            <img
              src={auction.image_url || DEFAULT_AUCTION_IMAGE}
              alt={auction.title || "SO Auctions"}
              style={
                hasCustomImage
                  ? focusedImageStyle(
                      auction.image_focus_x,
                      auction.image_focus_y,
                    )
                  : defaultAuctionImageStyle(22)
              }
            />
          </div>
        </div>
      </section>

      <section className="topActions" style={styles.topActions}>
        <Link href="/admin/auctions" style={styles.heroButtonDark}>
          ← Back to auctions
        </Link>

        <a
          href={`/a/${auction.slug}`}
          target="_blank"
          rel="noreferrer"
          style={styles.heroButtonLight}
        >
          View public page
        </a>

        <Link
          href={`/c/${tenantSlug}`}
          target="_blank"
          style={styles.heroButtonLight}
        >
          Campaigns page
        </Link>
      </section>

      <nav
        className="tabBar"
        style={styles.tabBar}
        aria-label="Auction admin sections"
      >
        <a href="#auction-overview" className="tabButton" style={styles.tabButton}>
          Overview
        </a>

        <a href="#winner-tools" className="tabButton" style={styles.tabButton}>
          Winner Tools
        </a>

        <a href="#auction-settings" className="tabButton" style={styles.tabButton}>
          Settings
        </a>

        <a href="#items" className="tabButton" style={styles.tabButton}>
          Auction Items
        </a>

        <a
          href="#danger-zone"
          className="dangerTabButton"
          style={styles.dangerTabButton}
        >
          Danger Zone
        </a>
      </nav>

      <section className="summaryGrid" style={styles.summaryGrid}>
        <StatCard label="Items" value={items.length} />
        <StatCard label="Active items" value={activeItems} />
        <StatCard label="Total bids" value={totalBids} />
        <StatCard
          label="Highest bid"
          value={moneyFromCents(highestBid, auction.currency)}
        />
        <StatCard label="Currency" value={auction.currency || "GBP"} />
      </section>

      <CollapsibleSection
        id="auction-overview"
        eyebrow="Section 1"
        title="Auction overview"
        description="Headline status, items and bidding summary."
        badge={`${items.length} items`}
      >
        <div className="summaryGrid" style={styles.statsGrid}>
          <StatCard label="Items" value={items.length} />
          <StatCard label="Active items" value={activeItems} />
          <StatCard label="Total bids" value={totalBids} />
          <StatCard
            label="Highest bid"
            value={moneyFromCents(highestBid, auction.currency)}
          />
        </div>
      </CollapsibleSection>

      <CollapsibleSection
        id="winner-tools"
        eyebrow="Section 2"
        title="Auction winner tools"
        description="Close this auction, close all active lots and email the highest valid bidder for each lot."
        badge={auctionStatusLabel(auction.status)}
      >
        <div style={styles.sectionHeader}>
          <div>
            <p style={styles.kicker}>Close and notify</p>

            <h3 className="so-brand-card-title" style={styles.innerTitle}>
              Winner notification centre
            </h3>

            <p style={styles.sectionText}>
              Lots with a reserve price are only notified if the reserve has
              been met.
            </p>
          </div>

          <span
            style={{
              ...styles.status,
              ...getStatusStyle(auction.status),
            }}
          >
            {auction.status}
          </span>
        </div>

        <div style={styles.winnerGrid}>
          {winnerRows.length === 0 ? (
            <div style={styles.emptyState}>No auction items added yet.</div>
          ) : (
            winnerRows.map(({ item, index, topBid, reserveMet }) => (
              <div key={item.id} className="winnerRow" style={styles.winnerRow}>
                <div>
                  <div style={styles.winnerTitle}>
                    Lot {item.sort_order || index + 1}: {item.title}
                  </div>

                  <div style={styles.winnerMeta}>
                    {topBid?.bidder_name || "No bidder"}
                    {topBid?.bidder_email ? ` · ${topBid.bidder_email}` : ""}
                  </div>
                </div>

                <div style={styles.winnerAmount}>
                  {topBid
                    ? moneyFromCents(topBid.amount_cents, auction.currency)
                    : "No bids"}

                  {topBid && !reserveMet ? (
                    <span style={styles.reserveWarning}>Reserve not met</span>
                  ) : null}
                </div>
              </div>
            ))
          )}
        </div>

        <form
          action={closeAuctionAndNotifyWinnersAction}
          style={styles.closeForm}
        >
          <input type="hidden" name="auction_id" value={auction.id} />

          <button
            type="submit"
            className="closeButton"
            style={{
              ...styles.closeButton,
              opacity: auction.status === "closed" ? 0.55 : 1,
              cursor: auction.status === "closed" ? "not-allowed" : "pointer",
            }}
            disabled={auction.status === "closed"}
          >
            {auction.status === "closed"
              ? "Auction already closed"
              : "Close auction and email winners"}
          </button>
        </form>
      </CollapsibleSection>

      <CollapsibleSection
        id="auction-settings"
        eyebrow="Section 3"
        title="Auction settings"
        description="Control public visibility, timing, rules and the main campaign details."
        badge="Settings"
        defaultOpen
      >
        <form action={updateAuctionAction} style={styles.form}>
          <input type="hidden" name="id" value={auction.id} />

          <div style={styles.sectionHeader}>
            <div>
              <p style={styles.kicker}>Auction controls</p>

              <h3 className="so-brand-card-title" style={styles.innerTitle}>
                Campaign details
              </h3>
            </div>

            <span
              style={{
                ...styles.status,
                ...getStatusStyle(auction.status),
              }}
            >
              {auction.status}
            </span>
          </div>

          <div className="grid" style={styles.grid}>
            <label style={styles.label}>
              Auction title
              <input
                name="title"
                required
                defaultValue={auction.title}
                style={styles.input}
              />
            </label>

            <label style={styles.label}>
              Public slug
              <input
                name="slug"
                required
                defaultValue={auction.slug}
                style={styles.input}
              />
            </label>

            <label style={styles.label}>
              Status
              <select
                name="status"
                defaultValue={auction.status}
                style={styles.input}
              >
                <option value="draft">Draft</option>
                <option value="published">Published</option>
                <option value="closed">Closed</option>
              </select>
            </label>

            <label style={styles.label}>
              Currency
              <input
                name="currency"
                defaultValue={auction.currency || "GBP"}
                style={styles.input}
              />
            </label>

            <label style={styles.label}>
              Opens
              <input
                name="opens_at"
                type="datetime-local"
                defaultValue={toDateTimeLocalValue(auction.opens_at)}
                style={styles.input}
              />
            </label>

            <label style={styles.label}>
              Closes
              <input
                name="closes_at"
                type="datetime-local"
                defaultValue={toDateTimeLocalValue(auction.closes_at)}
                style={styles.input}
              />
            </label>
          </div>
                    <label style={styles.label}>
            Description
            <textarea
              name="description"
              defaultValue={auction.description || ""}
              rows={4}
              style={styles.textarea}
            />
          </label>

          <section className="mediaBox" style={styles.imageFocusPanel}>
            <div>
              <h3 style={styles.subTitle}>Main auction image</h3>

              <p style={styles.sectionText}>
                Upload or replace the main public image. If no custom image is
                uploaded, the SO Auctions default image will be used.
              </p>

              <div style={styles.uploadBox}>
                <ImageFocusUploadField
                  currentImageUrl={
                    hasCustomImage ? auction.image_url || "" : ""
                  }
                  currentFocusX={auction.image_focus_x}
                  currentFocusY={auction.image_focus_y}
                  label="Main auction image"
                  previewAlt={auction.title}
                />
              </div>
            </div>

            <div className="previewBox" style={styles.previewBox}>
              <img
                src={auction.image_url || DEFAULT_AUCTION_IMAGE}
                alt={auction.title || "SO Auctions"}
                style={
                  hasCustomImage
                    ? focusedImageStyle(
                        auction.image_focus_x,
                        auction.image_focus_y,
                      )
                    : defaultAuctionImageStyle(18)
                }
              />
            </div>
          </section>

          <label style={styles.label}>
            Terms / auction rules
            <textarea
              name="terms_text"
              defaultValue={auction.terms_text || ""}
              rows={5}
              style={styles.textarea}
            />
          </label>

          <section className="submitBar" style={styles.submitBar}>
            <div>
              <strong style={{ color: "#0f172a" }}>
                Save auction settings
              </strong>
              <div style={styles.mutedSmall}>
                This updates the public auction page and admin values.
              </div>
            </div>

            <button type="submit" className="saveButton" style={styles.saveButton}>
              Save auction settings
            </button>
          </section>
        </form>
      </CollapsibleSection>

      <CollapsibleSection
        id="items"
        eyebrow="Section 4"
        title="Auction items"
        description="Add prizes, experiences, donated items or sponsor lots. Existing items are collapsible to keep the page manageable."
        badge={`${items.length} lots`}
      >
        <details style={styles.createDetails}>
          <summary className="createSummary" style={styles.createSummary}>
            <span>
              <strong>Add a new auction item</strong>
              <small style={styles.summarySmall}>
                Open this section to add another lot.
              </small>
            </span>

            <span style={styles.summaryChevron}>⌄</span>
          </summary>

          <form action={createAuctionItemAction} style={styles.itemCreateCard}>
            <input type="hidden" name="auction_id" value={auction.id} />

            <div className="grid" style={styles.grid}>
              <label style={styles.label}>
                Item title
                <input
                  name="title"
                  required
                  placeholder="Weekend hotel stay"
                  style={styles.input}
                />
              </label>

              <label style={styles.label}>
                Donor / sponsor
                <input
                  name="donor_name"
                  placeholder="Optional"
                  style={styles.input}
                />
              </label>

              <label style={styles.label}>
                Starting bid
                <input
                  name="starting_bid"
                  inputMode="decimal"
                  placeholder="25.00"
                  style={styles.input}
                />
              </label>

              <label style={styles.label}>
                Minimum increment
                <input
                  name="minimum_increment"
                  inputMode="decimal"
                  defaultValue="5.00"
                  style={styles.input}
                />
              </label>

              <label style={styles.label}>
                Reserve price
                <input
                  name="reserve_price"
                  inputMode="decimal"
                  placeholder="Optional"
                  style={styles.input}
                />
              </label>

              <label style={styles.label}>
                Sort order
                <input
                  name="sort_order"
                  type="number"
                  defaultValue="0"
                  style={styles.input}
                />
              </label>

              <label style={styles.label}>
                Status
                <select
                  name="status"
                  defaultValue="active"
                  style={styles.input}
                >
                  <option value="active">Active</option>
                  <option value="closed">Closed</option>
                  <option value="withdrawn">Withdrawn</option>
                </select>
              </label>
            </div>

            <div style={styles.uploadBox}>
              <ImageFocusUploadField
                currentImageUrl=""
                currentFocusX={50}
                currentFocusY={50}
                label="Item image"
                previewAlt="Auction item image preview"
              />
            </div>

            <label style={styles.label}>
              Description
              <textarea
                name="description"
                rows={4}
                placeholder="Describe the auction item."
                style={styles.textarea}
              />
            </label>

            <button type="submit" className="saveButton" style={styles.saveButton}>
              Add item
            </button>
          </form>
        </details>

        <div className="itemsList" style={styles.itemsList}>
          {items.length === 0 ? (
            <div style={styles.emptyState}>No auction items added yet.</div>
          ) : (
            items.map((item, index) => {
              const itemBids = bids.filter((bid) => bid.item_id === item.id);

              const highestBidAmount =
                itemBids.length > 0
                  ? Math.max(
                      ...itemBids.map((bid) => Number(bid.amount_cents || 0)),
                    )
                  : item.highest_bid_cents ?? item.starting_bid_cents ?? 0;

              return (
                <details
                  key={item.id}
                  style={styles.itemDetails}
                  open={index === 0}
                >
                  <summary className="itemSummary" style={styles.itemSummary}>
                    <div className="summaryImageWrap" style={styles.summaryImageWrap}>
                      {item.image_url ? (
                        <img
                          src={item.image_url}
                          alt={item.title}
                          style={focusedImageStyle(
                            item.image_focus_x,
                            item.image_focus_y,
                          )}
                        />
                      ) : (
                        <img
                          src={DEFAULT_AUCTION_IMAGE}
                          alt="SO Auctions item"
                          style={defaultAuctionImageStyle(18)}
                        />
                      )}
                    </div>

                    <div style={styles.summaryMain}>
                      <div style={styles.summaryTitleRow}>
                        <div>
                          <h3 style={styles.itemTitle}>
                            Lot {item.sort_order || index + 1}: {item.title}
                          </h3>

                          <div style={styles.itemSub}>
                            Donor: {item.donor_name || "Not set"}
                          </div>
                        </div>

                        <span
                          style={{
                            ...styles.status,
                            ...getStatusStyle(item.status),
                          }}
                        >
                          {item.status}
                        </span>
                      </div>

                      <div className="bidGrid" style={styles.bidGrid}>
                        <Detail
                          label="Starting bid"
                          value={moneyFromCents(
                            item.starting_bid_cents,
                            auction.currency,
                          )}
                        />

                        <Detail
                          label="Highest bid"
                          value={moneyFromCents(
                            highestBidAmount,
                            auction.currency,
                          )}
                        />

                        <Detail label="Bid count" value={itemBids.length} />

                        <Detail
                          label="Increment"
                          value={moneyFromCents(
                            item.minimum_increment_cents,
                            auction.currency,
                          )}
                        />
                      </div>
                    </div>

                    <span style={styles.summaryChevron}>⌄</span>
                  </summary>

                  <div className="itemExpanded" style={styles.itemExpanded}>
                    <form
                      action={updateAuctionItemAction}
                      style={styles.itemEditForm}
                    >
                      <input
                        type="hidden"
                        name="auction_id"
                        value={auction.id}
                      />

                      <input type="hidden" name="item_id" value={item.id} />

                      <div className="grid" style={styles.grid}>
                        <label style={styles.label}>
                          Item title
                          <input
                            name="title"
                            defaultValue={item.title}
                            style={styles.input}
                          />
                        </label>

                        <label style={styles.label}>
                          Donor / sponsor
                          <input
                            name="donor_name"
                            defaultValue={item.donor_name || ""}
                            style={styles.input}
                          />
                        </label>

                        <label style={styles.label}>
                          Starting bid
                          <input
                            name="starting_bid"
                            defaultValue={centsToPoundsInput(
                              item.starting_bid_cents,
                            )}
                            style={styles.input}
                          />
                        </label>

                        <label style={styles.label}>
                          Minimum increment
                          <input
                            name="minimum_increment"
                            defaultValue={centsToPoundsInput(
                              item.minimum_increment_cents,
                            )}
                            style={styles.input}
                          />
                        </label>

                        <label style={styles.label}>
                          Reserve price
                          <input
                            name="reserve_price"
                            defaultValue={centsToPoundsInput(
                              item.reserve_price_cents,
                            )}
                            style={styles.input}
                          />
                        </label>

                        <label style={styles.label}>
                          Sort order
                          <input
                            name="sort_order"
                            type="number"
                            defaultValue={item.sort_order || 0}
                            style={styles.input}
                          />
                        </label>

                        <label style={styles.label}>
                          Status
                          <select
                            name="status"
                            defaultValue={item.status}
                            style={styles.input}
                          >
                            <option value="active">Active</option>
                            <option value="closed">Closed</option>
                            <option value="withdrawn">Withdrawn</option>
                          </select>
                        </label>
                      </div>

                      <div style={styles.uploadBox}>
                        <ImageFocusUploadField
                          currentImageUrl={item.image_url || ""}
                          currentFocusX={item.image_focus_x}
                          currentFocusY={item.image_focus_y}
                          label="Item image"
                          previewAlt={item.title}
                        />
                      </div>

                      <label style={styles.label}>
                        Description
                        <textarea
                          name="description"
                          rows={4}
                          defaultValue={item.description || ""}
                          style={styles.textarea}
                        />
                      </label>

                      <button
                        type="submit"
                        className="saveButton"
                        style={styles.saveButton}
                      >
                        Save item
                      </button>
                    </form>

                    <form
                      action={deleteAuctionItemAction}
                      style={styles.deleteForm}
                    >
                      <input
                        type="hidden"
                        name="auction_id"
                        value={auction.id}
                      />

                      <input type="hidden" name="item_id" value={item.id} />

                      <button
                        type="submit"
                        className="deleteButton"
                        style={styles.deleteButton}
                      >
                        Delete item
                      </button>
                    </form>

                    {itemBids.length > 0 ? (
                      <div className="bidHistory" style={styles.bidHistory}>
                        <h4 style={styles.bidHistoryTitle}>Bid history</h4>

                        <div style={styles.bidList}>
                          {itemBids.map((bid) => (
                            <div key={bid.id} style={styles.bidRow}>
                              <div>
                                <div style={styles.bidName}>
                                  {bid.bidder_name || "Anonymous"}
                                </div>

                                <div style={styles.bidEmail}>
                                  {bid.bidder_email}
                                </div>
                              </div>

                              <div style={styles.bidAmount}>
                                {moneyFromCents(
                                  bid.amount_cents,
                                  auction.currency,
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div style={styles.noBidsBox}>
                        No bids have been placed on this item yet.
                      </div>
                    )}
                  </div>
                </details>
              );
            })
          )}
        </div>
      </CollapsibleSection>

      <CollapsibleSection
        id="danger-zone"
        eyebrow="Final section"
        title="Delete auction"
        description="For safety, an auction can only be deleted after it has been closed."
        badge="Delete"
      >
        <div className="dangerPanel" style={styles.dangerPanel}>
          <div>
            <h3 style={styles.dangerTitle}>Delete after close</h3>

            <p style={styles.sectionText}>
              Close the auction first. Once closed, you can permanently remove
              the auction from the admin dashboard.
            </p>
          </div>

          {auction.status === "closed" ? (
            <form action={deleteClosedAuctionAction}>
              <input type="hidden" name="auction_id" value={auction.id} />

              <button
                type="submit"
                className="deleteAuctionButton"
                style={styles.deleteAuctionButton}
              >
                Delete closed auction
              </button>
            </form>
          ) : (
            <button
              type="button"
              disabled
              className="disabledDangerButton"
              style={styles.disabledDangerButton}
            >
              Close auction before deleting
            </button>
          )}
        </div>
      </CollapsibleSection>
    </main>
  );
}

function CollapsibleSection({
  id,
  title,
  eyebrow,
  description,
  badge,
  defaultOpen = false,
  children,
}: {
  id: string;
  title: string;
  eyebrow?: string;
  description?: string;
  badge?: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  return (
    <details id={id} open={defaultOpen} className="card" style={styles.card}>
      <summary className="collapsibleSummary" style={styles.collapsibleSummary}>
        <div style={styles.collapsibleHeading}>
          {eyebrow ? <p style={styles.kicker}>{eyebrow}</p> : null}

          <h2 className="so-brand-card-title" style={styles.sectionTitle}>
            {title}
          </h2>

          {description ? <p style={styles.sectionText}>{description}</p> : null}
        </div>

        <div className="collapsibleActions" style={styles.collapsibleActions}>
          {badge ? (
            <span className="sectionBadge" style={styles.sectionBadge}>
              {badge}
            </span>
          ) : null}

          <span className="collapsibleToggle" style={styles.collapsibleToggle}>
            Open / close
          </span>
        </div>
      </summary>

      <div style={styles.collapsibleBody}>{children}</div>
    </details>
  );
}

function HeroMetric({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div style={styles.heroMetric}>
      <div style={styles.heroMetricLabel}>{label}</div>
      <div style={styles.heroMetricValue}>{value}</div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div style={styles.statCard}>
      <div style={styles.statLabel}>{label}</div>
      <div className="statValue" style={styles.statValue}>
        {value}
      </div>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div style={styles.detail}>
      <div style={styles.detailLabel}>{label}</div>
      <div style={styles.detailValue}>{value}</div>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  page: {
    width: "100%",
    maxWidth: 1180,
    margin: "0 auto",
    padding: "28px 16px 64px",
    background:
      "radial-gradient(circle at top left, rgba(251,191,36,0.10), transparent 34%), #f8fafc",
    minHeight: "100vh",
    overflowX: "hidden",
    boxSizing: "border-box",
  },
  hero: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1.15fr) minmax(280px, 0.85fr)",
    gap: 20,
    alignItems: "stretch",
    padding: "clamp(20px, 4vw, 28px)",
    borderRadius: 28,
    background:
      "radial-gradient(circle at top left, rgba(251,191,36,0.22), transparent 34%), linear-gradient(135deg, #020617 0%, #0f172a 54%, #172554 100%)",
    color: "#ffffff",
    marginBottom: 16,
    boxShadow: "0 24px 60px rgba(15,23,42,0.18)",
    overflow: "hidden",
  },
  heroCopy: {
    minWidth: 0,
  },
  badge: {
    display: "inline-flex",
    padding: "6px 10px",
    borderRadius: 999,
    background: "rgba(255,255,255,0.12)",
    color: "#fde68a",
    border: "1px solid rgba(255,255,255,0.14)",
    fontSize: 12,
    fontWeight: 950,
    marginBottom: 12,
    textTransform: "uppercase",
    letterSpacing: "0.1em",
  },
  heroTitleRow: {
    display: "flex",
    gap: 12,
    justifyContent: "space-between",
    alignItems: "flex-start",
    flexWrap: "wrap",
  },
  title: {
    margin: 0,
    fontSize: "clamp(34px, 5vw, 48px)",
    lineHeight: 1.02,
    letterSpacing: "-0.06em",
    overflowWrap: "anywhere",
    maxWidth: 720,
  },
  statusPill: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "8px 12px",
    borderRadius: 999,
    fontSize: 13,
    fontWeight: 950,
    textTransform: "capitalize",
    flexShrink: 0,
  },
  subtitle: {
    margin: "10px 0 0",
    color: "#fde68a",
    fontWeight: 850,
    fontSize: 14,
    overflowWrap: "anywhere",
  },
  description: {
    margin: "14px 0 0",
    color: "#dbeafe",
    fontSize: 15,
    lineHeight: 1.6,
    maxWidth: 760,
    overflowWrap: "anywhere",
  },
  heroMetaGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 130px), 1fr))",
    gap: 10,
    marginTop: 22,
  },
  heroMetric: {
    padding: "13px 14px",
    borderRadius: 18,
    background: "rgba(255,255,255,0.09)",
    border: "1px solid rgba(255,255,255,0.16)",
    minWidth: 0,
  },
  heroMetricLabel: {
    color: "#fde68a",
    fontSize: 12,
    fontWeight: 900,
  },
  heroMetricValue: {
    marginTop: 4,
    color: "#ffffff",
    fontSize: 18,
    fontWeight: 950,
    letterSpacing: "-0.03em",
    overflowWrap: "anywhere",
  },
  heroPreview: {
    display: "grid",
    gap: 12,
    alignContent: "start",
    padding: 14,
    borderRadius: 24,
    background: "rgba(255,255,255,0.1)",
    border: "1px solid rgba(255,255,255,0.18)",
  },
  previewKicker: {
    justifySelf: "start",
    padding: "6px 10px",
    borderRadius: 999,
    background: "#ffffff",
    color: "#0f172a",
    fontSize: 12,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
  },
  heroImageWrap: {
    height: 240,
    borderRadius: 20,
    background: "#ffffff",
    border: "1px solid rgba(255,255,255,0.18)",
    overflow: "hidden",
  },
  previewBox: {
    height: 210,
    borderRadius: 18,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    overflow: "hidden",
  },
  topActions: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "center",
    marginBottom: 16,
    flexWrap: "wrap",
  },
  heroButtonDark: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 44,
    padding: "10px 14px",
    borderRadius: 999,
    background: "#0f172a",
    color: "#ffffff",
    border: "1px solid #0f172a",
    textDecoration: "none",
    fontWeight: 950,
  },
  heroButtonLight: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 44,
    padding: "10px 14px",
    borderRadius: 999,
    background: "#ffffff",
    color: "#0f172a",
    border: "1px solid #cbd5e1",
    textDecoration: "none",
    fontWeight: 950,
  },
  tabBar: {
    display: "flex",
    flexWrap: "wrap",
    gap: 8,
    padding: 12,
    borderRadius: 18,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    marginBottom: 16,
    boxShadow: "0 2px 12px rgba(15,23,42,0.04)",
  },
  tabButton: {
    padding: "10px 12px",
    borderRadius: 999,
    background: "#ffffff",
    border: "1px solid #cbd5e1",
    color: "#0f172a",
    textDecoration: "none",
    fontWeight: 900,
    fontSize: 14,
  },
  dangerTabButton: {
    padding: "10px 12px",
    borderRadius: 999,
    background: "#fff7f7",
    border: "1px solid #fecaca",
    color: "#b91c1c",
    textDecoration: "none",
    fontWeight: 900,
    fontSize: 14,
  },
  summaryGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 150px), 1fr))",
    gap: 12,
    marginBottom: 16,
  },
  statsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 170px), 1fr))",
    gap: 12,
  },
  statCard: {
    padding: 15,
    borderRadius: 18,
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    minWidth: 0,
  },
  statLabel: {
    color: "#64748b",
    fontSize: 12,
    fontWeight: 900,
  },
  statValue: {
    marginTop: 6,
    fontSize: 22,
    fontWeight: 950,
    color: "#0f172a",
    letterSpacing: "-0.03em",
    overflowWrap: "anywhere",
  },
  card: {
    padding: "clamp(16px, 4vw, 18px)",
    borderRadius: 24,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    marginBottom: 16,
    boxShadow: "0 2px 12px rgba(15,23,42,0.04)",
    minWidth: 0,
    overflow: "hidden",
  },
  collapsibleSummary: {
    display: "flex",
    justifyContent: "space-between",
    gap: 14,
    alignItems: "flex-start",
    cursor: "pointer",
    listStyle: "none",
    flexWrap: "wrap",
  },
  collapsibleHeading: {
    minWidth: 0,
    flex: "1 1 260px",
  },
  collapsibleActions: {
    display: "flex",
    gap: 8,
    alignItems: "center",
    justifyContent: "flex-end",
    flexWrap: "wrap",
  },
  collapsibleToggle: {
    flexShrink: 0,
    padding: "8px 12px",
    borderRadius: 999,
    background: "#eff6ff",
    color: "#1d4ed8",
    border: "1px solid #bfdbfe",
    fontSize: 12,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.04em",
  },
  sectionBadge: {
    display: "inline-flex",
    alignItems: "center",
    padding: "8px 11px",
    borderRadius: 999,
    background: "#ffffff",
    color: "#334155",
    border: "1px solid #e2e8f0",
    fontSize: 12,
    fontWeight: 950,
    whiteSpace: "nowrap",
  },
  collapsibleBody: {
    marginTop: 16,
  },
  sectionHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: 16,
    flexWrap: "wrap",
    marginBottom: 18,
  },
  kicker: {
    margin: "0 0 7px",
    color: "#b45309",
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    fontWeight: 950,
  },
  sectionTitle: {
    margin: 0,
    fontSize: "clamp(22px, 5vw, 26px)",
    color: "#0f172a",
    letterSpacing: "-0.035em",
    overflowWrap: "anywhere",
  },
  innerTitle: {
    margin: 0,
    fontSize: 21,
    color: "#0f172a",
    letterSpacing: "-0.025em",
  },
  sectionText: {
    margin: "8px 0 0",
    color: "#64748b",
    lineHeight: 1.55,
    overflowWrap: "anywhere",
  },
  subTitle: {
    margin: 0,
    fontSize: 20,
    color: "#0f172a",
  },
  status: {
    display: "inline-flex",
    padding: "8px 12px",
    borderRadius: 999,
    fontSize: 13,
    fontWeight: 900,
    textTransform: "capitalize",
    whiteSpace: "nowrap",
  },
  form: {
    display: "grid",
    gap: 14,
    minWidth: 0,
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 230px), 1fr))",
    gap: 14,
  },
  label: {
    display: "grid",
    gap: 7,
    color: "#0f172a",
    fontWeight: 900,
    minWidth: 0,
  },
  input: {
    width: "100%",
    boxSizing: "border-box",
    borderRadius: 13,
    border: "1px solid #cbd5e1",
    padding: "10px 12px",
    minHeight: 44,
    fontSize: 15,
    background: "#ffffff",
    color: "#0f172a",
    minWidth: 0,
  },
  textarea: {
    width: "100%",
    boxSizing: "border-box",
    borderRadius: 13,
    border: "1px solid #cbd5e1",
    padding: "10px 12px",
    fontSize: 15,
    background: "#ffffff",
    color: "#0f172a",
    resize: "vertical",
    fontFamily: "inherit",
    minWidth: 0,
  },
  imageFocusPanel: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 260px), 1fr))",
    gap: 14,
    padding: 14,
    borderRadius: 20,
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
  },
  uploadBox: {
    marginTop: 14,
    padding: 14,
    borderRadius: 18,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    overflow: "hidden",
  },
  submitBar: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 14,
    flexWrap: "wrap",
    padding: 16,
    borderRadius: 20,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
  },
  saveButton: {
    width: "fit-content",
    minHeight: 44,
    padding: "13px 18px",
    borderRadius: 999,
    background: "#1683f8",
    color: "#ffffff",
    border: "none",
    fontWeight: 950,
    cursor: "pointer",
    boxShadow: "0 10px 20px rgba(22,131,248,0.18)",
  },
  winnerGrid: {
    display: "grid",
    gap: 10,
    marginTop: 16,
  },
  winnerRow: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) auto",
    gap: 14,
    alignItems: "center",
    padding: 14,
    borderRadius: 18,
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
  },
  winnerTitle: {
    color: "#0f172a",
    fontWeight: 950,
  },
  winnerMeta: {
    marginTop: 4,
    color: "#64748b",
    fontWeight: 750,
    fontSize: 13,
    overflowWrap: "anywhere",
  },
  winnerAmount: {
    color: "#0f172a",
    fontWeight: 950,
    textAlign: "right",
    whiteSpace: "nowrap",
  },
  reserveWarning: {
    display: "block",
    marginTop: 5,
    color: "#b45309",
    fontSize: 12,
    fontWeight: 950,
  },
  closeForm: {
    marginTop: 18,
    display: "flex",
    justifyContent: "flex-end",
  },
  closeButton: {
    padding: "13px 18px",
    borderRadius: 999,
    background: "#0f172a",
    color: "#ffffff",
    border: "none",
    fontWeight: 950,
    boxShadow: "0 10px 20px rgba(15,23,42,0.18)",
  },
  createDetails: {
    borderRadius: 22,
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    marginBottom: 18,
    overflow: "hidden",
  },
  createSummary: {
    listStyle: "none",
    cursor: "pointer",
    padding: 18,
    display: "flex",
    justifyContent: "space-between",
    gap: 14,
    alignItems: "center",
    color: "#0f172a",
  },
  summarySmall: {
    display: "block",
    marginTop: 4,
    color: "#64748b",
    fontWeight: 750,
  },
  summaryChevron: {
    width: 34,
    height: 34,
    borderRadius: 999,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#475569",
    fontWeight: 950,
    flexShrink: 0,
  },
  itemCreateCard: {
    display: "grid",
    gap: 14,
    padding: "0 18px 18px",
    background: "#f8fafc",
  },
  itemsList: {
    display: "grid",
    gap: 14,
  },
  itemDetails: {
    borderRadius: 24,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    overflow: "hidden",
    boxShadow: "0 2px 12px rgba(15,23,42,0.04)",
  },
  itemSummary: {
    listStyle: "none",
    cursor: "pointer",
    padding: 16,
    display: "grid",
    gridTemplateColumns: "110px minmax(0, 1fr) 38px",
    gap: 16,
    alignItems: "center",
  },
  summaryImageWrap: {
    width: 110,
    height: 110,
    borderRadius: 18,
    overflow: "hidden",
    background: "#f1f5f9",
    border: "1px solid #e2e8f0",
  },
  summaryMain: {
    minWidth: 0,
  },
  summaryTitleRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    flexWrap: "wrap",
    alignItems: "flex-start",
  },
  itemTitle: {
    margin: 0,
    fontSize: 22,
    color: "#0f172a",
    letterSpacing: "-0.025em",
    overflowWrap: "anywhere",
  },
  itemSub: {
    marginTop: 4,
    color: "#64748b",
    fontWeight: 700,
  },
  bidGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 130px), 1fr))",
    gap: 10,
    marginTop: 14,
  },
  detail: {
    padding: 12,
    borderRadius: 14,
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
  },
  detailLabel: {
    color: "#64748b",
    fontSize: 12,
    fontWeight: 900,
  },
  detailValue: {
    marginTop: 4,
    color: "#0f172a",
    fontWeight: 900,
    overflowWrap: "anywhere",
  },
  itemExpanded: {
    padding: "0 18px 18px",
    borderTop: "1px solid #e2e8f0",
    background: "#ffffff",
  },
  itemEditForm: {
    display: "grid",
    gap: 14,
    marginTop: 18,
  },
  deleteForm: {
    marginTop: 10,
    display: "flex",
    justifyContent: "flex-end",
  },
  deleteButton: {
    padding: "10px 14px",
    borderRadius: 999,
    background: "#dc2626",
    color: "#ffffff",
    border: "none",
    fontWeight: 900,
    cursor: "pointer",
  },
  bidHistory: {
    marginTop: 20,
    padding: 16,
    borderRadius: 18,
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
  },
  bidHistoryTitle: {
    margin: "0 0 14px",
    fontSize: 18,
    color: "#0f172a",
  },
  bidList: {
    display: "grid",
    gap: 10,
  },
  bidRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "center",
    padding: 12,
    borderRadius: 14,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    flexWrap: "wrap",
  },
  bidName: {
    fontWeight: 900,
    color: "#0f172a",
  },
  bidEmail: {
    marginTop: 2,
    fontSize: 13,
    color: "#64748b",
    overflowWrap: "anywhere",
  },
  bidAmount: {
    fontWeight: 900,
    color: "#0f172a",
    whiteSpace: "nowrap",
  },
  noBidsBox: {
    marginTop: 18,
    padding: 14,
    borderRadius: 16,
    background: "#f8fafc",
    border: "1px dashed #cbd5e1",
    color: "#64748b",
    fontWeight: 800,
  },
  emptyState: {
    padding: 20,
    borderRadius: 18,
    background: "#f8fafc",
    border: "1px dashed #cbd5e1",
    color: "#64748b",
    fontWeight: 800,
    textAlign: "center",
  },
  dangerPanel: {
    display: "flex",
    justifyContent: "space-between",
    gap: 16,
    alignItems: "center",
    flexWrap: "wrap",
    padding: 18,
    borderRadius: 22,
    background: "#fef2f2",
    border: "1px solid #fecaca",
  },
  dangerTitle: {
    margin: 0,
    color: "#991b1b",
    fontSize: 20,
    letterSpacing: "-0.02em",
  },
  deleteAuctionButton: {
    padding: "13px 18px",
    borderRadius: 999,
    background: "#dc2626",
    color: "#ffffff",
    border: "none",
    fontWeight: 950,
    cursor: "pointer",
    boxShadow: "0 10px 20px rgba(220,38,38,0.18)",
  },
  disabledDangerButton: {
    padding: "13px 18px",
    borderRadius: 999,
    background: "#e5e7eb",
    color: "#64748b",
    border: "none",
    fontWeight: 950,
    cursor: "not-allowed",
  },
  dangerOutlineButton: {
    minHeight: 42,
    padding: "10px 14px",
    borderRadius: 999,
    border: "1px solid #fecaca",
    background: "#ffffff",
    color: "#b91c1c",
    fontWeight: 900,
    cursor: "pointer",
  },
  mutedSmall: {
    color: "#64748b",
    fontSize: 13,
    marginTop: 3,
  },
};
