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

function defaultAuctionImageStyle(padding = 22): CSSProperties {
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
    imageUrl: String(formData.get("image_url") || "").trim() || null,
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
    imageUrl: auction.image_url,
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

export default async function AdminAuctionDetailPage({ params }: PageProps) {
  const resolvedParams = await params;

  const { auction, tenantSlug } = await requireAuctionAccess(
    resolvedParams.id,
  );

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

  return (
    <main className="auction-detail-page" style={styles.page}>
      <style>{responsiveStyles}</style>

      <section style={styles.hero}>
        <div style={styles.heroCopy}>
          <div style={styles.badge}>Auction editor</div>

          <h1 className="so-brand-heading" style={styles.title}>
            {auction.title || "Untitled auction"}
          </h1>

          <div style={styles.metaRow}>
            <span
              style={{
                ...styles.statusPill,
                ...getStatusStyle(auction.status),
              }}
            >
              {auction.status}
            </span>

            <span style={styles.currencyPill}>
              {auction.currency || "GBP"}
            </span>
          </div>

          <p style={styles.subtitle}>Public page: /a/{auction.slug}</p>

          <p style={styles.description}>
            {auction.description || "No description added yet."}
          </p>
        </div>

        <div style={styles.heroImageWrap}>
          {auction.image_url ? (
            <img
              src={auction.image_url}
              alt={auction.title}
              style={focusedImageStyle(
                auction.image_focus_x,
                auction.image_focus_y,
              )}
            />
          ) : (
            <img
              src={DEFAULT_AUCTION_IMAGE}
              alt="SO Auctions"
              style={defaultAuctionImageStyle(24)}
            />
          )}
        </div>

        <div style={styles.heroActions}>
          <Link href="/admin/auctions" style={styles.heroButtonDark}>
            Back to auctions
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
        </div>
      </section>
            <nav style={styles.tabBar} aria-label="Auction admin sections">
        <a href="#auction-overview" style={styles.tabButton}>
          Overview
        </a>

        <a href="#winner-tools" style={styles.tabButton}>
          Winner Tools
        </a>

        <a href="#auction-settings" style={styles.tabButton}>
          Settings
        </a>

        <a href="#items" style={styles.tabButton}>
          Auction Items
        </a>

        <a href="#danger-zone" style={styles.dangerTabButton}>
          Danger Zone
        </a>
      </nav>

      <CollapsibleSection
        id="auction-overview"
        eyebrow="Section 1"
        title="Auction overview"
        description="Headline status, items and bidding summary."
        defaultOpen
      >
        <section style={styles.statsGrid}>
          <StatCard label="Items" value={items.length} />

          <StatCard label="Active items" value={activeItems} />

          <StatCard label="Total bids" value={totalBids} />

          <StatCard
            label="Highest bid"
            value={moneyFromCents(highestBid, auction.currency)}
          />
        </section>
      </CollapsibleSection>

      <CollapsibleSection
        id="winner-tools"
        eyebrow="Section 2"
        title="Auction winner tools"
        description="Close this auction, close all active lots and email the highest valid bidder for each lot."
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
              <div key={item.id} style={styles.winnerRow}>
                <div>
                  <div style={styles.winnerTitle}>
                    Lot {item.sort_order || index + 1}: {item.title}
                  </div>

                  <div style={styles.winnerMeta}>
                    {topBid?.bidder_name || "No bidder"}

                    {topBid?.bidder_email
                      ? ` · ${topBid.bidder_email}`
                      : ""}
                  </div>
                </div>

                <div style={styles.winnerAmount}>
                  {topBid
                    ? moneyFromCents(topBid.amount_cents, auction.currency)
                    : "No bids"}

                  {topBid && !reserveMet ? (
                    <span style={styles.reserveWarning}>
                      Reserve not met
                    </span>
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

          <div style={styles.grid}>
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
              rows={5}
              style={styles.textarea}
            />
          </label>

          <section style={styles.imageFocusPanel}>
            <div>
              <h3 style={styles.subTitle}>Main auction image</h3>

              <p style={styles.sectionText}>
                Upload or replace the main public image. If no custom image is
                uploaded, the SO Auctions default image will be used.
              </p>
            </div>

            <div style={styles.uploadBox}>
              <ImageFocusUploadField
                currentImageUrl={auction.image_url || ""}
                currentFocusX={auction.image_focus_x}
                currentFocusY={auction.image_focus_y}
                label="Main auction image"
                previewAlt={auction.title}
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

          <div style={styles.actionsRight}>
            <button type="submit" style={styles.saveButton}>
              Save auction settings
            </button>
          </div>
        </form>
      </CollapsibleSection>

      <CollapsibleSection
        id="items"
        eyebrow="Section 4"
        title="Auction items"
        description="Add prizes, experiences, donated items or sponsor lots. Existing items are collapsible to keep the page manageable as the auction grows."
        defaultOpen
      >
        <details style={styles.createDetails}>
          <summary style={styles.createSummary}>
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

            <div style={styles.grid}>
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

            <div style={styles.actionsRight}>
              <button type="submit" style={styles.saveButton}>
                Add item
              </button>
            </div>
          </form>
        </details>
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

                      <div style={styles.itemActions}>
                        <button type="submit" style={styles.saveButton}>
                          Save item
                        </button>
                      </div>
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

                      <button type="submit" style={styles.deleteButton}>
                        Delete item
                      </button>
                    </form>

                    {itemBids.length > 0 ? (
                      <div style={styles.bidHistory}>
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
      >
        <div style={styles.dangerPanel}>
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

              <button type="submit" style={styles.deleteAuctionButton}>
                Delete closed auction
              </button>
            </form>
          ) : (
            <button type="button" disabled style={styles.disabledDangerButton}>
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
  defaultOpen = false,
  children,
}: {
  id: string;
  title: string;
  eyebrow?: string;
  description?: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  return (
    <details id={id} open={defaultOpen} style={styles.card}>
      <summary style={styles.collapsibleSummary}>
        <div style={styles.collapsibleHeading}>
          {eyebrow ? <p style={styles.kicker}>{eyebrow}</p> : null}

          <h2 className="so-brand-card-title" style={styles.sectionTitle}>
            {title}
          </h2>

          {description ? (
            <p style={styles.sectionText}>{description}</p>
          ) : null}
        </div>

        <span style={styles.collapsibleToggle}>Open / close</span>
      </summary>

      <div style={styles.collapsibleBody}>{children}</div>
    </details>
  );
}

function StatCard({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div style={styles.statCard}>
      <div style={styles.statLabel}>{label}</div>
      <div style={styles.statValue}>{value}</div>
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
    maxWidth: 1180,
    margin: "0 auto",
    padding: "26px 16px 64px",
    background:
      "radial-gradient(circle at top left, rgba(251,191,36,0.10), transparent 34%), #f8fafc",
    minHeight: "100vh",
  },

  hero: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) 180px 150px",
    gap: 24,
    alignItems: "center",
    padding: 24,
    borderRadius: 30,
    background:
      "linear-gradient(135deg, #020617 0%, #081028 45%, #0f172a 100%)",
    color: "#ffffff",
    marginBottom: 18,
    minHeight: 260,
    boxShadow: "0 24px 60px rgba(15,23,42,0.24)",
  },

  heroCopy: {
    minWidth: 0,
  },

  heroActions: {
    display: "grid",
    gap: 10,
    alignContent: "start",
  },

  heroButtonDark: {
    padding: "12px 16px",
    borderRadius: 999,
    background: "rgba(255,255,255,0.08)",
    color: "#ffffff",
    border: "1px solid rgba(255,255,255,0.16)",
    textDecoration: "none",
    fontWeight: 900,
    textAlign: "center",
    fontSize: 14,
  },

  heroButtonLight: {
    padding: "12px 16px",
    borderRadius: 999,
    background: "#ffffff",
    color: "#0f172a",
    border: "1px solid rgba(255,255,255,0.18)",
    textDecoration: "none",
    fontWeight: 900,
    textAlign: "center",
    fontSize: 14,
  },

  badge: {
    display: "inline-flex",
    padding: "6px 10px",
    borderRadius: 999,
    background: "rgba(255,255,255,0.12)",
    color: "#e2e8f0",
    border: "1px solid rgba(255,255,255,0.14)",
    fontSize: 11,
    fontWeight: 950,
    marginBottom: 10,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
  },

  title: {
    margin: 0,
    fontSize: "clamp(34px, 5vw, 48px)",
    lineHeight: 0.95,
    letterSpacing: "-0.06em",
  },

  metaRow: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
    alignItems: "center",
    marginTop: 12,
  },

  statusPill: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "6px 12px",
    borderRadius: 999,
    fontSize: 11,
    fontWeight: 950,
    textTransform: "capitalize",
  },

  currencyPill: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "6px 12px",
    borderRadius: 999,
    background: "rgba(255,255,255,0.14)",
    color: "#ffffff",
    border: "1px solid rgba(255,255,255,0.12)",
    fontSize: 11,
    fontWeight: 950,
  },

  subtitle: {
    margin: "10px 0 0",
    color: "#cbd5e1",
    fontWeight: 850,
    fontSize: 13,
  },

  description: {
    margin: "14px 0 0",
    color: "#bfdbfe",
    fontSize: 15,
    lineHeight: 1.6,
    maxWidth: 680,
  },

  heroImageWrap: {
    width: 180,
    height: 180,
    borderRadius: 22,
    overflow: "hidden",
    background: "#ffffff",
    border: "1px solid rgba(255,255,255,0.16)",
    boxShadow: "0 20px 40px rgba(0,0,0,0.25)",
  },
