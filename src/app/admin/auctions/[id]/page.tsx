import type { CSSProperties } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { getTenantSlugFromHeaders } from "@/lib/tenant";
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
      String(formData.get("slug") || "").trim().toLowerCase() ||
      auction.slug,
    description: String(formData.get("description") || "").trim() || null,
    imageUrl: String(formData.get("image_url") || "").trim() || null,
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

          <label style={styles.label}>
            Image URL
            <input
              name="image_url"
              defaultValue={auction.image_url || ""}
              placeholder="https://..."
              style={styles.input}
            />
          </label>

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

            <label style={styles.label}>
              Image URL
              <input
                name="image_url"
                placeholder="https://..."
                style={styles.input}
              />
            </label>
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
                {items.length === 0 ? (
          <div style={styles.emptyBox}>
            <h3 style={{ margin: 0 }}>No items yet</h3>
            <p style={styles.muted}>
              Add your first auction item above.
            </p>
          </div>
        ) : (
          <div style={styles.itemsList}>
            {items.map((item) => {
              const itemBids = bids.filter((bid) => bid.item_id === item.id);
              const winningBid = itemBids.find((bid) => bid.is_winning);

              return (
                <article key={item.id} style={styles.itemCard}>
                  <div style={styles.itemTop}>
                    <div style={styles.itemImageWrap}>
                      {item.image_url ? (
                        <img
                          src={item.image_url}
                          alt={item.title}
                          style={styles.itemImage}
                        />
                      ) : (
                        <div style={styles.itemImageEmpty}>🎁</div>
                      )}
                    </div>

                    <div style={styles.itemMain}>
                      <div style={styles.cardHeader}>
                        <div>
                          <h3 style={styles.itemTitle}>{item.title}</h3>
                          <p style={styles.slug}>
                            {item.donor_name
                              ? `Donated by ${item.donor_name}`
                              : "No donor listed"}
                          </p>
                        </div>

                        <span style={styles.itemStatus}>{item.status}</span>
                      </div>

                      <div style={styles.detailGrid}>
                        <Detail
                          label="Starting bid"
                          value={moneyFromCents(
                            item.starting_bid_cents,
                            auction.currency,
                          )}
                        />
                        <Detail
                          label="Increment"
                          value={moneyFromCents(
                            item.minimum_increment_cents,
                            auction.currency,
                          )}
                        />
                        <Detail
                          label="Reserve"
                          value={
                            item.reserve_price_cents === null
                              ? "None"
                              : moneyFromCents(
                                  item.reserve_price_cents,
                                  auction.currency,
                                )
                          }
                        />
                        <Detail
                          label="Highest bid"
                          value={
                            item.highest_bid_cents === null
                              ? "No bids"
                              : moneyFromCents(
                                  item.highest_bid_cents,
                                  auction.currency,
                                )
                          }
                        />
                        <Detail label="Bid count" value={item.bid_count} />
                      </div>

                      {item.description ? (
                        <p style={styles.description}>{item.description}</p>
                      ) : null}
                    </div>
                  </div>

                  <details style={styles.detailsPanel}>
                    <summary style={styles.summary}>Edit item</summary>

                    <form action={updateAuctionItemAction} style={styles.form}>
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
                            required
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
                            inputMode="decimal"
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
                            inputMode="decimal"
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
                            inputMode="decimal"
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
                            defaultValue={item.sort_order}
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

                        <label style={styles.label}>
                          Image URL
                          <input
                            name="image_url"
                            defaultValue={item.image_url || ""}
                            style={styles.input}
                          />
                        </label>
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

                      <div style={styles.actionsRight}>
                        <button type="submit" style={styles.saveButton}>
                          Save item
                        </button>
                      </div>
                    </form>

                    <form action={deleteAuctionItemAction} style={styles.deleteItemForm}>
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
                  </details>

                  <details style={styles.detailsPanel}>
                    <summary style={styles.summary}>View bids</summary>

                    {itemBids.length === 0 ? (
                      <p style={styles.muted}>No bids for this item yet.</p>
                    ) : (
                      <div style={styles.bidsTable}>
                        {itemBids.map((bid) => (
                          <div key={bid.id} style={styles.bidRow}>
                            <div>
                              <strong>{bid.bidder_name}</strong>
                              <div style={styles.muted}>{bid.bidder_email}</div>
                              {bid.bidder_phone ? (
                                <div style={styles.muted}>{bid.bidder_phone}</div>
                              ) : null}
                            </div>

                            <div style={styles.bidAmount}>
                              {moneyFromCents(bid.amount_cents, auction.currency)}
                              {winningBid?.id === bid.id ? (
                                <span style={styles.winningBadge}>Winning</span>
                              ) : null}
                            </div>

                            <div style={styles.muted}>
                              {formatDate(bid.created_at)}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </details>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}

function StatCard({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={styles.statCard}>
      <div style={styles.statLabel}>{label}</div>
      <div style={styles.statValue}>{value}</div>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: React.ReactNode }) {
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
    justifyContent: "flex-end",
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
  statsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
    gap: 14,
    marginBottom: 22,
  },
  statCard: {
    padding: 18,
    borderRadius: 16,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    boxShadow: "0 2px 12px rgba(15,23,42,0.04)",
  },
  statLabel: {
    color: "#64748b",
    fontSize: 13,
    fontWeight: 900,
  },
  statValue: {
    marginTop: 6,
    fontSize: 24,
    fontWeight: 950,
    color: "#0f172a",
    textTransform: "capitalize",
  },
  form: {
    display: "grid",
    gap: 18,
  },
  card: {
    padding: 22,
    borderRadius: 24,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    boxShadow: "0 2px 12px rgba(15,23,42,0.04)",
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
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
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
    color: "#0f172a",
    background: "#ffffff",
  },
  textarea: {
    width: "100%",
    boxSizing: "border-box",
    borderRadius: 14,
    border: "1px solid #cbd5e1",
    padding: "12px 13px",
    fontSize: 15,
    color: "#0f172a",
    background: "#ffffff",
    resize: "vertical",
    fontFamily: "inherit",
  },
  actionsRight: {
    display: "flex",
    justifyContent: "flex-end",
    gap: 10,
    flexWrap: "wrap",
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
    boxShadow: "0 10px 20px rgba(22,131,248,0.22)",
  },
  itemCreateCard: {
    padding: 18,
    borderRadius: 20,
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    marginBottom: 20,
  },
  subTitle: {
    margin: 0,
    fontSize: 20,
    color: "#0f172a",
  },
  emptyBox: {
    padding: 20,
    borderRadius: 18,
    background: "#f8fafc",
    border: "1px dashed #cbd5e1",
  },
  muted: {
    color: "#64748b",
  },
  itemsList: {
    display: "grid",
    gap: 16,
  },
  itemCard: {
    padding: 18,
    borderRadius: 22,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
  },
  itemTop: {
    display: "grid",
    gridTemplateColumns: "130px 1fr",
    gap: 18,
  },
  itemImageWrap: {
    width: 130,
    height: 130,
    borderRadius: 18,
    overflow: "hidden",
    background: "#f1f5f9",
    border: "1px solid #e2e8f0",
  },
  itemImage: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
    display: "block",
  },
  itemImageEmpty: {
    width: "100%",
    height: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 34,
    color: "#94a3b8",
  },
  itemMain: {
    minWidth: 0,
  },
  cardHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "flex-start",
  },
  itemTitle: {
    margin: 0,
    fontSize: 22,
    color: "#0f172a",
  },
  slug: {
    margin: "4px 0 0",
    color: "#64748b",
    fontWeight: 700,
  },
  itemStatus: {
    display: "inline-flex",
    padding: "8px 12px",
    borderRadius: 999,
    fontSize: 13,
    fontWeight: 900,
    textTransform: "capitalize",
    background: "#f1f5f9",
    color: "#475569",
    border: "1px solid #e2e8f0",
  },
  detailGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
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
  description: {
    color: "#334155",
    lineHeight: 1.6,
    margin: "14px 0 0",
  },
  detailsPanel: {
    marginTop: 14,
    padding: 14,
    borderRadius: 16,
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
  },
  summary: {
    cursor: "pointer",
    fontWeight: 950,
    color: "#0f172a",
  },
  deleteItemForm: {
    marginTop: 12,
    display: "flex",
    justifyContent: "flex-end",
  },
  deleteButton: {
    padding: "12px 16px",
    borderRadius: 999,
    background: "#dc2626",
    color: "#ffffff",
    border: "none",
    fontWeight: 900,
    cursor: "pointer",
  },
  bidsTable: {
    display: "grid",
    gap: 10,
    marginTop: 14,
  },
  bidRow: {
    display: "grid",
    gridTemplateColumns: "1.3fr 0.8fr 0.8fr",
    gap: 12,
    alignItems: "center",
    padding: 12,
    borderRadius: 14,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
  },
  bidAmount: {
    display: "grid",
    gap: 6,
    justifyItems: "start",
    color: "#0f172a",
    fontWeight: 950,
  },
  winningBadge: {
    display: "inline-flex",
    padding: "5px 8px",
    borderRadius: 999,
    background: "#dcfce7",
    color: "#166534",
    fontSize: 12,
    fontWeight: 950,
    border: "1px solid #bbf7d0",
  },
};
