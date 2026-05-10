import type { CSSProperties } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { getTenantSlugFromHeaders } from "@/lib/tenant";
import ImageFocusUploadField from "@/components/ImageFocusUploadField";
import {
  createAuctionItem,
  deleteAuctionItem,
  getAuctionById,
  listAuctionBids,
  listAuctionItems,
  updateAuction,
  updateAuctionItem,
  type AuctionItemStatus,
  type AuctionStatus,
} from "../../../../../api/_lib/auctions-repo";

type PageProps = {
  params: {
    id: string;
  };
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

function formatDate(value: string | null | undefined) {
  if (!value) return "Not set";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "Not set";

  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
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

  if (clean === "published") {
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

  return {
    background: "#f1f5f9",
    color: "#475569",
    border: "1px solid #e2e8f0",
  };
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

  redirect(`/admin/auctions/${auction.id}`);
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
  const { auction, tenantSlug } = await requireAuctionAccess(params.id);
  const items = await listAuctionItems(auction.id);
  const bids = await listAuctionBids(auction.id);

  const activeItems = items.filter((item) => item.status === "active").length;
  const totalBids = bids.length;
  const highestBid =
    bids.length > 0
      ? Math.max(...bids.map((bid) => Number(bid.amount_cents || 0)))
      : 0;

  return (
    <main style={styles.page}>
      <section style={styles.header}>
        <div>
          <div style={styles.badge}>Silent auction</div>

          <h1 style={styles.title}>{auction.title || "Untitled auction"}</h1>

          <p style={styles.subtitle}>
            Tenant: <strong>{tenantSlug}</strong> · Public page:{" "}
            <strong>/a/{auction.slug}</strong>
          </p>
        </div>

        <div style={styles.nav}>
          <Link href="/admin/auctions" style={styles.navButton}>
            ← Back to auctions
          </Link>

          <a
            href={`/a/${auction.slug}`}
            target="_blank"
            rel="noreferrer"
            style={styles.navButton}
          >
            View public page
          </a>

          <Link href={`/c/${tenantSlug}`} target="_blank" style={styles.navButton}>
            Campaigns page
          </Link>
        </div>
      </section>

      <section style={styles.statsGrid}>
        <StatCard label="Status" value={auction.status} />
        <StatCard label="Items" value={items.length} />
        <StatCard label="Active items" value={activeItems} />
        <StatCard label="Total bids" value={totalBids} />
        <StatCard
          label="Highest bid"
          value={moneyFromCents(highestBid, auction.currency)}
        />
      </section>

      <form action={updateAuctionAction} style={styles.form}>
        <input type="hidden" name="id" value={auction.id} />

        <section style={styles.card}>
          <div style={styles.sectionHeader}>
            <div>
              <h2 style={styles.sectionTitle}>Auction settings</h2>
              <p style={styles.sectionText}>
                Control public visibility, timing, rules and the main campaign
                details.
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
                Upload or replace the main public image, then use the live
                previews to set the image focus point.
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
        </section>
      </form>
            <section id="items" style={styles.card}>
        <div style={styles.sectionHeader}>
          <div>
            <h2 style={styles.sectionTitle}>Auction items</h2>
            <p style={styles.sectionText}>
              Add prizes, experiences, donated items or sponsor lots. Bids are
              collected per item.
            </p>
          </div>
        </div>

        <form action={createAuctionItemAction}
                  <form action={createAuctionItemAction} style={styles.itemCreateCard}>
          <input type="hidden" name="auction_id" value={auction.id} />

          <h3 style={styles.subTitle}>Add new item</h3>

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
              <select name="status" defaultValue="active" style={styles.input}>
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
