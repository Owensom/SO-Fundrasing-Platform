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

        <div style={styles.itemsList}>
          {items.length === 0 ? (
            <div style={styles.emptyState}>No auction items added yet.</div>
          ) : (
            items.map((item) => {
              const itemBids = bids.filter((bid) => bid.item_id === item.id);
              const highestBidAmount =
                itemBids.length > 0
                  ? Math.max(
                      ...itemBids.map((bid) => Number(bid.amount_cents || 0)),
                    )
                  : item.starting_bid_cents || 0;

              return (
                <article key={item.id} style={styles.itemCard}>
                  <div style={styles.itemTop}>
                    <div style={styles.itemImageWrap}>
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
                        <div style={styles.imageEmpty}>🔨</div>
                      )}
                    </div>

                    <div style={styles.itemMeta}>
                      <div style={styles.itemMetaTop}>
                        <div>
                          <h3 style={styles.itemTitle}>{item.title}</h3>
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

                      <div style={styles.bidGrid}>
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
                          label="Minimum increment"
                          value={moneyFromCents(
                            item.minimum_increment_cents,
                            auction.currency,
                          )}
                        />
                      </div>
                    </div>
                  </div>
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

                    <div style={styles.grid}>
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
                  ) : null}
                </article>
              );
            })
          )}
        </div>
      </section>
    </main>
  );
}

function StatCard({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div style={styles.statCard}>
      <div style={styles.statLabel}>{label}</div>
      <div style={styles.statValue}>{value}</div>
    </div>
  );
}

function Detail({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
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
    padding: "28px 16px 56px",
    background: "#f8fafc",
    minHeight: "100vh",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    gap: 16,
    alignItems: "flex-start",
    flexWrap: "wrap",
    marginBottom: 24,
  },
  badge: {
    display: "inline-flex",
    padding: "6px 10px",
    borderRadius: 999,
    background: "#fef3c7",
    color: "#92400e",
    fontSize: 13,
    fontWeight: 900,
    marginBottom: 10,
  },
  title: {
    margin: 0,
    fontSize: 38,
    lineHeight: 1.1,
    color: "#0f172a",
  },
  subtitle: {
    margin: "10px 0 0",
    color: "#64748b",
  },
  nav: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
  },
  navButton: {
    padding: "12px 18px",
    borderRadius: 999,
    background: "#ffffff",
    color: "#0f172a",
    border: "1px solid #cbd5e1",
    textDecoration: "none",
    fontWeight: 900,
  },
  form: {
    display: "grid",
    gap: 18,
  },
  statsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
    gap: 14,
    marginBottom: 22,
  },
  statCard: {
    padding: 18,
    borderRadius: 16,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
  },
  statLabel: {
    color: "#64748b",
    fontSize: 13,
    fontWeight: 900,
  },
  statValue: {
    marginTop: 6,
    fontSize: 28,
    fontWeight: 950,
    color: "#0f172a",
  },
  card: {
    padding: 22,
    borderRadius: 24,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    marginBottom: 18,
  },
  sectionHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: 16,
    flexWrap: "wrap",
    marginBottom: 18,
  },
  sectionTitle: {
    margin: 0,
    fontSize: 24,
    color: "#0f172a",
  },
  sectionText: {
    margin: "8px 0 0",
    color: "#64748b",
    lineHeight: 1.55,
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
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))",
    gap: 14,
  },
  label: {
    display: "grid",
    gap: 7,
    marginTop: 14,
    color: "#0f172a",
    fontWeight: 900,
  },
  input: {
    width: "100%",
    boxSizing: "border-box",
    borderRadius: 14,
    border: "1px solid #cbd5e1",
    padding: "12px 13px",
    fontSize: 15,
    background: "#ffffff",
  },
  textarea: {
    width: "100%",
    boxSizing: "border-box",
    borderRadius: 14,
    border: "1px solid #cbd5e1",
    padding: "12px 13px",
    fontSize: 15,
    background: "#ffffff",
    resize: "vertical",
    fontFamily: "inherit",
  },
  imageFocusPanel: {
    marginTop: 18,
    padding: 18,
    borderRadius: 20,
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
  },
  uploadBox: {
    marginTop: 14,
    padding: 14,
    borderRadius: 16,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
  },
  actionsRight: {
    display: "flex",
    justifyContent: "flex-end",
    marginTop: 18,
  },
  saveButton: {
    padding: "12px 18px",
    borderRadius: 999,
    background: "#1683f8",
    color: "#ffffff",
    border: "none",
    fontWeight: 900,
    cursor: "pointer",
  },
  itemCreateCard: {
    padding: 18,
    borderRadius: 20,
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    marginBottom: 18,
  },
  itemsList: {
    display: "grid",
    gap: 18,
  },
  itemCard: {
    padding: 18,
    borderRadius: 22,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
  },
  itemTop: {
    display: "grid",
    gridTemplateColumns: "140px 1fr",
    gap: 18,
    marginBottom: 18,
  },
  itemImageWrap: {
    width: 140,
    height: 140,
    borderRadius: 18,
    overflow: "hidden",
    background: "#f1f5f9",
    border: "1px solid #e2e8f0",
  },
  imageEmpty: {
    width: "100%",
    height: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 42,
    color: "#94a3b8",
  },
  itemMeta: {
    minWidth: 0,
  },
  itemMetaTop: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    flexWrap: "wrap",
  },
  itemTitle: {
    margin: 0,
    fontSize: 24,
    color: "#0f172a",
  },
  itemSub: {
    marginTop: 4,
    color: "#64748b",
    fontWeight: 700,
  },
  bidGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
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
  },
  itemEditForm: {
    marginTop: 18,
  },
  itemActions: {
    display: "flex",
    justifyContent: "flex-end",
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
  },
  bidName: {
    fontWeight: 900,
    color: "#0f172a",
  },
  bidEmail: {
    marginTop: 2,
    fontSize: 13,
    color: "#64748b",
  },
  bidAmount: {
    fontWeight: 900,
    color: "#0f172a",
    whiteSpace: "nowrap",
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
};
