import type { CSSProperties } from "react";
import { notFound } from "next/navigation";
import { getTenantSlugFromHeaders } from "@/lib/tenant";
import {
  getAuctionBySlug,
  listAuctionItems,
} from "../../../../api/_lib/auctions-repo";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{
    slug: string;
  }>;
  searchParams?: Promise<{
    bid?: string;
    error?: string;
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

function centsToPoundsInput(cents: number | null | undefined) {
  return (Number(cents || 0) / 100).toFixed(2);
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
    dateStyle: "full",
    timeStyle: "short",
  }).format(date);
}

function getAuctionAvailability(auction: {
  status: string;
  opens_at: string | null;
  closes_at: string | null;
}) {
  const now = Date.now();

  if (auction.status !== "published") {
    return {
      canBid: false,
      label: "Not open",
      message: "This auction is not currently accepting bids.",
    };
  }

  if (auction.opens_at) {
    const opensAt = new Date(auction.opens_at).getTime();

    if (!Number.isNaN(opensAt) && now < opensAt) {
      return {
        canBid: false,
        label: "Opening soon",
        message: `Bidding opens on ${formatDate(auction.opens_at)}.`,
      };
    }
  }

  if (auction.closes_at) {
    const closesAt = new Date(auction.closes_at).getTime();

    if (!Number.isNaN(closesAt) && now > closesAt) {
      return {
        canBid: false,
        label: "Closed",
        message: "This auction has now closed.",
      };
    }
  }

  return {
    canBid: true,
    label: "Open for bids",
    message:
      "Place your bid below. Winning bidders will be contacted after the auction closes.",
  };
}

export default async function PublicAuctionPage({
  params,
  searchParams,
}: PageProps) {
  const resolvedParams = await params;
  const resolvedSearchParams = await searchParams;

  const tenantSlug = await getTenantSlugFromHeaders();

  if (!tenantSlug) {
    notFound();
  }

  let auction = await getAuctionBySlug(
    resolvedParams.slug,
    tenantSlug,
  );

  if (!auction) {
    try {
      auction = await getAuctionBySlug(
        tenantSlug,
        resolvedParams.slug,
      );
    } catch {
      // ignore fallback failure
    }
  }

  if (!auction || auction.status === "draft") {
    notFound();
  }

  const items = await listAuctionItems(auction.id);

  const visibleItems = items.filter(
    (item) => item.status !== "withdrawn",
  );

  const availability = getAuctionAvailability(auction);

  const successMessage =
    resolvedSearchParams?.bid === "success"
      ? "Thank you — your bid has been placed successfully."
      : null;

  const errorMessage = resolvedSearchParams?.error
    ? decodeURIComponent(resolvedSearchParams.error)
    : null;

  return (
    <main style={styles.page}>
      <section style={styles.hero}>
        <div style={styles.heroContent}>
          <div style={styles.badge}>Silent auction</div>

          <h1 style={styles.title}>{auction.title}</h1>

          {auction.description ? (
            <p style={styles.description}>{auction.description}</p>
          ) : null}

          <div style={styles.heroMeta}>
            <div style={styles.metaCard}>
              <span style={styles.metaLabel}>Status</span>
              <strong>{availability.label}</strong>
            </div>

            <div style={styles.metaCard}>
              <span style={styles.metaLabel}>Opens</span>
              <strong>{formatDate(auction.opens_at)}</strong>
            </div>

            <div style={styles.metaCard}>
              <span style={styles.metaLabel}>Closes</span>
              <strong>{formatDate(auction.closes_at)}</strong>
            </div>

            <div style={styles.metaCard}>
              <span style={styles.metaLabel}>Items</span>
              <strong>{visibleItems.length}</strong>
            </div>
          </div>
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
            <div style={styles.heroImageEmpty}>🔨</div>
          )}
        </div>
      </section>

      {successMessage ? (
        <section style={styles.successCard}>
          {successMessage}
        </section>
      ) : null}

      {errorMessage ? (
        <section style={styles.errorCard}>
          {errorMessage}
        </section>
      ) : null}

      <section style={styles.noticeCard}>
        <h2 style={styles.noticeTitle}>
          {availability.label}
        </h2>

        <p style={styles.noticeText}>
          {availability.message}
        </p>
      </section>

      {visibleItems.length === 0 ? (
        <section style={styles.emptyCard}>
          <h2 style={{ margin: 0 }}>
            No auction items available
          </h2>

          <p style={styles.muted}>
            Please check back later.
          </p>
        </section>
      ) : (
        <section style={styles.itemsGrid}>
          {visibleItems.map((item) => {
            const highestBid = item.highest_bid_cents;

            const minimumNextBid =
              highestBid === null
                ? item.starting_bid_cents
                : Number(highestBid || 0) +
                  Number(item.minimum_increment_cents || 0);

            const itemCanBid =
              availability.canBid &&
              item.status === "active";

            return (
              <article
                key={item.id}
                style={styles.itemCard}
              >
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
                    <div style={styles.itemImageEmpty}>
                      🎁
                    </div>
                  )}
                </div>

                <div style={styles.itemBody}>
                  <div style={styles.itemTop}>
                    <div>
                      <h2 style={styles.itemTitle}>
                        {item.title}
                      </h2>

                      {item.donor_name ? (
                        <p style={styles.donor}>
                          Donated by{" "}
                          <strong>
                            {item.donor_name}
                          </strong>
                        </p>
                      ) : null}
                    </div>

                    <span style={styles.itemStatus}>
                      {item.status}
                    </span>
                  </div>

                  {item.description ? (
                    <p style={styles.itemDescription}>
                      {item.description}
                    </p>
                  ) : null}

                  <div style={styles.bidStats}>
                    <div style={styles.bidStat}>
                      <span>Starting bid</span>

                      <strong>
                        {moneyFromCents(
                          item.starting_bid_cents,
                          auction.currency,
                        )}
                      </strong>
                    </div>

                    <div style={styles.bidStat}>
                      <span>Current highest</span>

                      <strong>
                        {highestBid === null
                          ? "No bids yet"
                          : moneyFromCents(
                              highestBid,
                              auction.currency,
                            )}
                      </strong>
                    </div>

                    <div style={styles.bidStat}>
                      <span>Minimum next bid</span>

                      <strong>
                        {moneyFromCents(
                          minimumNextBid,
                          auction.currency,
                        )}
                      </strong>
                    </div>
                  </div>

                  {itemCanBid ? (
                    <form
                      method="post"
                      action="/api/auctions/bid"
                      style={styles.bidForm}
                    >
                      <input
                        type="hidden"
                        name="auction_id"
                        value={auction.id}
                      />

                      <input
                        type="hidden"
                        name="item_id"
                        value={item.id}
                      />

                      <input
                        type="hidden"
                        name="auction_slug"
                        value={auction.slug}
                      />

                      <div style={styles.formGrid}>
                        <label style={styles.label}>
                          Your name

                          <input
                            name="bidder_name"
                            required
                            autoComplete="name"
                            style={styles.input}
                          />
                        </label>

                        <label style={styles.label}>
                          Email

                          <input
                            name="bidder_email"
                            type="email"
                            required
                            autoComplete="email"
                            style={styles.input}
                          />
                        </label>

                        <label style={styles.label}>
                          Phone

                          <input
                            name="bidder_phone"
                            autoComplete="tel"
                            style={styles.input}
                          />
                        </label>

                        <label style={styles.label}>
                          Your bid

                          <input
                            name="amount"
                            inputMode="decimal"
                            required
                            defaultValue={centsToPoundsInput(
                              minimumNextBid,
                            )}
                            style={styles.input}
                          />
                        </label>
                      </div>

                      <label style={styles.checkboxLabel}>
                        <input
                          name="termsAccepted"
                          type="checkbox"
                          required
                        />

                        <span>
                          I understand that bids are
                          binding and that the organiser
                          may contact me if I am the
                          winning bidder.
                        </span>
                      </label>

                      <button
                        type="submit"
                        style={styles.bidButton}
                      >
                        Place bid
                      </button>
                    </form>
                  ) : (
                    <div style={styles.closedBox}>
                      {item.status === "active"
                        ? availability.message
                        : "This item is not currently accepting bids."}
                    </div>
                  )}
                </div>
              </article>
            );
          })}
        </section>
      )}

      {auction.terms_text ? (
        <section style={styles.termsCard}>
          <h2 style={styles.noticeTitle}>
            Auction rules
          </h2>

          <p style={styles.termsText}>
            {auction.terms_text}
          </p>
        </section>
      ) : null}
    </main>
  );
}

const styles: Record<string, CSSProperties> = {
  page: {
    maxWidth: 1180,
    margin: "0 auto",
    padding: "28px 16px 56px",
    background:
      "radial-gradient(circle at top left, rgba(251,191,36,0.16), transparent 34%), #f8fafc",
    minHeight: "100vh",
  },

  hero: {
    display: "grid",
    gridTemplateColumns:
      "minmax(0, 1.25fr) minmax(280px, 0.75fr)",
    gap: 22,
    alignItems: "stretch",
    marginBottom: 20,
  },

  heroContent: {
    padding: 28,
    borderRadius: 28,
    background: "#0f172a",
    color: "#ffffff",
    boxShadow:
      "0 24px 60px rgba(15,23,42,0.22)",
  },

  badge: {
    display: "inline-flex",
    padding: "7px 11px",
    borderRadius: 999,
    background: "rgba(251,191,36,0.16)",
    color: "#fef3c7",
    border:
      "1px solid rgba(251,191,36,0.28)",
    fontSize: 13,
    fontWeight: 950,
    marginBottom: 14,
  },

  title: {
    margin: 0,
    fontSize: 44,
    lineHeight: 1.05,
    letterSpacing: "-0.04em",
  },

  description: {
    margin: "14px 0 0",
    color: "#cbd5e1",
    fontSize: 17,
    lineHeight: 1.65,
    maxWidth: 780,
  },

  heroMeta: {
    display: "grid",
    gridTemplateColumns:
      "repeat(auto-fit, minmax(145px, 1fr))",
    gap: 12,
    marginTop: 24,
  },

  metaCard: {
    padding: 14,
    borderRadius: 18,
    background: "rgba(255,255,255,0.08)",
    border:
      "1px solid rgba(255,255,255,0.12)",
    display: "grid",
    gap: 5,
  },

  metaLabel: {
    color: "#94a3b8",
    fontSize: 12,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.06em",
  },

  heroImageWrap: {
    minHeight: 310,
    borderRadius: 28,
    overflow: "hidden",
    background: "#e2e8f0",
    border: "1px solid #e2e8f0",
    boxShadow:
      "0 18px 44px rgba(15,23,42,0.12)",
  },

  heroImageEmpty: {
    width: "100%",
    height: "100%",
    minHeight: 310,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 54,
    background: "#f1f5f9",
  },

  successCard: {
    padding: 16,
    borderRadius: 20,
    background: "#dcfce7",
    color: "#166534",
    border: "1px solid #bbf7d0",
    fontWeight: 950,
    marginBottom: 16,
  },

  errorCard: {
    padding: 16,
    borderRadius: 20,
    background: "#fee2e2",
    color: "#991b1b",
    border: "1px solid #fecaca",
    fontWeight: 950,
    marginBottom: 16,
  },

  noticeCard: {
    padding: 20,
    borderRadius: 24,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    boxShadow:
      "0 2px 12px rgba(15,23,42,0.04)",
    marginBottom: 18,
  },

  noticeTitle: {
    margin: 0,
    fontSize: 22,
    color: "#0f172a",
  },

  noticeText: {
    margin: "8px 0 0",
    color: "#475569",
    lineHeight: 1.6,
  },

  emptyCard: {
    padding: 24,
    borderRadius: 24,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
  },

  muted: {
    color: "#64748b",
  },

  itemsGrid: {
    display: "grid",
    gridTemplateColumns:
      "repeat(auto-fit, minmax(320px, 1fr))",
    gap: 18,
  },

  itemCard: {
    borderRadius: 26,
    overflow: "hidden",
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    boxShadow:
      "0 2px 12px rgba(15,23,42,0.04)",
  },

  itemImageWrap: {
    width: "100%",
    height: 230,
    background: "#f1f5f9",
  },

  itemImageEmpty: {
    width: "100%",
    height: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 44,
    color: "#94a3b8",
  },

  itemBody: {
    padding: 20,
  },

  itemTop: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "flex-start",
  },

  itemTitle: {
    margin: 0,
    fontSize: 24,
    lineHeight: 1.15,
    color: "#0f172a",
  },

  donor: {
    margin: "6px 0 0",
    color: "#64748b",
  },

  itemStatus: {
    display: "inline-flex",
    padding: "7px 10px",
    borderRadius: 999,
    background: "#fef3c7",
    color: "#92400e",
    fontSize: 12,
    fontWeight: 950,
    textTransform: "capitalize",
    border: "1px solid #fde68a",
  },

  itemDescription: {
    color: "#334155",
    lineHeight: 1.6,
    margin: "14px 0 0",
  },

  bidStats: {
    display: "grid",
    gridTemplateColumns:
      "repeat(auto-fit, minmax(130px, 1fr))",
    gap: 10,
    marginTop: 16,
  },

  bidStat: {
    padding: 12,
    borderRadius: 16,
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    display: "grid",
    gap: 4,
  },

  bidForm: {
    display: "grid",
    gap: 14,
    marginTop: 16,
    padding: 16,
    borderRadius: 20,
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
  },

  formGrid: {
    display: "grid",
    gridTemplateColumns:
      "repeat(auto-fit, minmax(170px, 1fr))",
    gap: 12,
  },

  label: {
    display: "grid",
    gap: 7,
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

  checkboxLabel: {
    display: "flex",
    gap: 10,
    alignItems: "flex-start",
    color: "#334155",
    fontWeight: 750,
    lineHeight: 1.5,
  },

  bidButton: {
    padding: "13px 18px",
    borderRadius: 999,
    background: "#1683f8",
    color: "#ffffff",
    border: "none",
    fontWeight: 950,
    cursor: "pointer",
    boxShadow:
      "0 10px 20px rgba(22,131,248,0.22)",
  },

  closedBox: {
    marginTop: 16,
    padding: 16,
    borderRadius: 18,
    background: "#f1f5f9",
    color: "#475569",
    border: "1px solid #e2e8f0",
    fontWeight: 800,
  },

  termsCard: {
    marginTop: 18,
    padding: 22,
    borderRadius: 24,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    boxShadow:
      "0 2px 12px rgba(15,23,42,0.04)",
  },

  termsText: {
    whiteSpace: "pre-wrap",
    color: "#334155",
    lineHeight: 1.65,
    margin: "10px 0 0",
  },
};
