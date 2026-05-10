"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState, type CSSProperties } from "react";

type Auction = {
  id: string;
  tenant_slug: string;
  slug: string;
  title: string;
  description: string | null;
  image_url: string | null;
  image_focus_x: number | null;
  image_focus_y: number | null;
  status: string;
  currency: string;
  opens_at: string | null;
  closes_at: string | null;
  terms_text: string | null;
};

type AuctionItem = {
  id: string;
  auction_id: string;
  title: string;
  description: string | null;
  image_url: string | null;
  image_focus_x: number | null;
  image_focus_y: number | null;
  donor_name: string | null;
  starting_bid_cents: number;
  minimum_increment_cents: number;
  reserve_price_cents: number | null;
  status: string;
  sort_order: number;
  highest_bid_cents: number | null;
  bid_count: number;
};

type Props = {
  params: {
    slug: string;
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

function centsToPoundsInput(cents: number | null | undefined) {
  return (Number(cents || 0) / 100).toFixed(2);
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
    dateStyle: "full",
    timeStyle: "short",
  }).format(date);
}

function getAvailability(auction: Auction | null) {
  if (!auction) {
    return {
      canBid: false,
      label: "Loading",
      message: "Loading auction details.",
    };
  }

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

function reserveStatus(item: AuctionItem, currency: string) {
  if (item.reserve_price_cents === null || item.reserve_price_cents === undefined) {
    return "No reserve";
  }

  if (
    item.highest_bid_cents !== null &&
    item.highest_bid_cents >= item.reserve_price_cents
  ) {
    return "Reserve met";
  }

  return `Reserve ${moneyFromCents(item.reserve_price_cents, currency)}`;
}

function statusStyle(status: string): CSSProperties {
  const clean = status.toLowerCase();

  if (clean === "active" || clean === "published" || clean === "open for bids") {
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

export default function PublicAuctionPage({ params }: Props) {
  const { slug } = params;
  const searchParams = useSearchParams();

  const bidQueryValue = searchParams?.get("bid") || "";
  const errorQueryValue = searchParams?.get("error") || "";

  const [auction, setAuction] = useState<Auction | null>(null);
  const [items, setItems] = useState<AuctionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadAuction() {
    try {
      setLoading(true);
      setError("");

      const response = await fetch(
        `/api/public/auctions/${encodeURIComponent(slug)}`,
        { cache: "no-store" },
      );

      const text = await response.text();

      let parsed: {
        ok?: boolean;
        error?: string;
        auction?: Auction;
        items?: AuctionItem[];
      } | null = null;

      try {
        parsed = JSON.parse(text);
      } catch {
        throw new Error(`Auction API did not return JSON: ${text.slice(0, 120)}`);
      }

      if (!response.ok || !parsed?.ok) {
        throw new Error(parsed?.error || "Failed to load auction");
      }

      setAuction(parsed.auction ?? null);
      setItems(Array.isArray(parsed.items) ? parsed.items : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load auction");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!slug) return;
    loadAuction();
  }, [slug]);

  const availability = useMemo(() => getAvailability(auction), [auction]);

  const successMessage =
    bidQueryValue === "success"
      ? "Thank you — your bid has been placed successfully."
      : "";

  const queryError = errorQueryValue;

  const activeItems = items.filter((item) => item.status === "active").length;

  const totalBids = items.reduce(
    (total, item) => total + Number(item.bid_count || 0),
    0,
  );

  const topBid = items.reduce(
    (highest, item) => Math.max(highest, Number(item.highest_bid_cents || 0)),
    0,
  );

  if (!slug) return <main style={styles.page}>Loading auction…</main>;

  if (loading) {
    return (
      <main style={styles.page}>
        <section style={styles.loadingCard}>
          <div style={styles.loadingIcon}>🔨</div>
          <h1 style={styles.loadingTitle}>Loading silent auction…</h1>
          <p style={styles.loadingText}>Preparing the auction lots.</p>
        </section>
      </main>
    );
  }

  if (error && !auction) {
    return (
      <main style={styles.page}>
        <section style={styles.errorCard}>{error}</section>
      </main>
    );
  }

  if (!auction) {
    return (
      <main style={styles.page}>
        <section style={styles.emptyCard}>Auction not found.</section>
      </main>
    );
  }

  return (
    <main style={styles.page}>
      <section style={styles.hero}>
        <div style={styles.heroContent}>
          <Link href={`/c/${auction.tenant_slug}`} style={styles.backLink}>
            ← Back to campaigns
          </Link>

          <div style={styles.badgeRow}>
            <span style={styles.badge}>Silent auction</span>
            <span style={{ ...styles.statusPill, ...statusStyle(availability.label) }}>
              {availability.label}
            </span>
          </div>

          <h1 style={styles.title}>{auction.title}</h1>

          {auction.description ? (
            <p style={styles.description}>{auction.description}</p>
          ) : null}

          <div style={styles.heroMeta}>
            <div style={styles.metaCard}>
              <span style={styles.metaLabel}>Closes</span>
              <strong>{formatDate(auction.closes_at)}</strong>
            </div>

            <div style={styles.metaCard}>
              <span style={styles.metaLabel}>Auction lots</span>
              <strong>{items.length}</strong>
            </div>

            <div style={styles.metaCard}>
              <span style={styles.metaLabel}>Active lots</span>
              <strong>{activeItems}</strong>
            </div>

            <div style={styles.metaCard}>
              <span style={styles.metaLabel}>Top bid</span>
              <strong>
                {topBid > 0
                  ? moneyFromCents(topBid, auction.currency)
                  : "No bids yet"}
              </strong>
            </div>
          </div>
        </div>

        <div style={styles.heroImageWrap}>
          {auction.image_url ? (
            <img
              src={auction.image_url}
              alt={auction.title}
              style={{
                ...styles.image,
                objectPosition: `${focusValue(auction.image_focus_x)}% ${focusValue(
                  auction.image_focus_y,
                )}%`,
              }}
            />
          ) : (
            <div style={styles.heroImageEmpty}>🔨</div>
          )}

          <div style={styles.heroImageOverlay}>
            <span>Supporting the organiser</span>
            <strong>{totalBids} bids placed</strong>
          </div>
        </div>
      </section>

      {successMessage ? (
        <section style={styles.successCard}>{successMessage}</section>
      ) : null}

      {queryError ? <section style={styles.errorCard}>{queryError}</section> : null}

      {error ? <section style={styles.errorCard}>{error}</section> : null}

      <section style={styles.noticeCard}>
        <div>
          <h2 style={styles.noticeTitle}>{availability.label}</h2>
          <p style={styles.noticeText}>{availability.message}</p>
        </div>

        <div style={styles.noticeChip}>
          <span>Opens</span>
          <strong>{formatDate(auction.opens_at)}</strong>
        </div>
      </section>

      {items.length === 0 ? (
        <section style={styles.emptyCard}>
          <h2 style={{ margin: 0 }}>No auction items available</h2>
          <p style={styles.muted}>Please check back later.</p>
        </section>
      ) : (
        <section style={styles.itemsGrid}>
          {items.map((item, index) => {
            const highestBid = item.highest_bid_cents;

            const minimumNextBid =
              highestBid === null
                ? item.starting_bid_cents
                : Number(highestBid || 0) +
                  Number(item.minimum_increment_cents || 0);

            const itemCanBid = availability.canBid && item.status === "active";

            return (
              <article key={item.id} style={styles.itemCard}>
                <div style={styles.itemImageWrap}>
                  {item.image_url ? (
                    <img
                      src={item.image_url}
                      alt={item.title}
                      style={{
                        ...styles.image,
                        objectPosition: `${focusValue(item.image_focus_x)}% ${focusValue(
                          item.image_focus_y,
                        )}%`,
                      }}
                    />
                  ) : (
                    <div style={styles.itemImageEmpty}>🎁</div>
                  )}

                  <div style={styles.lotBadge}>Lot {item.sort_order || index + 1}</div>
                </div>

                <div style={styles.itemBody}>
                  <div style={styles.itemTop}>
                    <div>
                      <h2 style={styles.itemTitle}>{item.title}</h2>

                      {item.donor_name ? (
                        <p style={styles.donor}>
                          Donated by <strong>{item.donor_name}</strong>
                        </p>
                      ) : null}
                    </div>

                    <span style={{ ...styles.itemStatus, ...statusStyle(item.status) }}>
                      {item.status}
                    </span>
                  </div>

                  {item.description ? (
                    <p style={styles.itemDescription}>{item.description}</p>
                  ) : null}

                  <div style={styles.bidFeature}>
                    <span>Current highest bid</span>
                    <strong>
                      {highestBid === null
                        ? "No bids yet"
                        : moneyFromCents(highestBid, auction.currency)}
                    </strong>
                  </div>

                  <div style={styles.bidStats}>
                    <div style={styles.bidStat}>
                      <span>Starting bid</span>
                      <strong>
                        {moneyFromCents(item.starting_bid_cents, auction.currency)}
                      </strong>
                    </div>

                    <div style={styles.bidStat}>
                      <span>Next bid from</span>
                      <strong>{moneyFromCents(minimumNextBid, auction.currency)}</strong>
                    </div>

                    <div style={styles.bidStat}>
                      <span>Bid count</span>
                      <strong>{item.bid_count || 0}</strong>
                    </div>

                    <div style={styles.bidStat}>
                      <span>Reserve</span>
                      <strong>{reserveStatus(item, auction.currency)}</strong>
                    </div>
                  </div>

                  {itemCanBid ? (
                    <form method="post" action="/api/auctions/bid" style={styles.bidForm}>
                      <input type="hidden" name="auction_id" value={auction.id} />
                      <input type="hidden" name="item_id" value={item.id} />
                      <input type="hidden" name="auction_slug" value={auction.slug} />

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
                            defaultValue={centsToPoundsInput(minimumNextBid)}
                            style={styles.input}
                          />
                        </label>
                      </div>

                      <label style={styles.checkboxLabel}>
                        <input name="termsAccepted" type="checkbox" required />
                        <span>
                          I understand that bids are binding and that the organiser may
                          contact me if I am the winning bidder.
                        </span>
                      </label>

                      <button type="submit" style={styles.bidButton}>
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
          <h2 style={styles.noticeTitle}>Auction rules</h2>
          <p style={styles.termsText}>{auction.terms_text}</p>
        </section>
      ) : null}
    </main>
  );
}

const styles: Record<string, CSSProperties> = {
  page: {
    maxWidth: 1220,
    margin: "0 auto",
    padding: "28px 16px 64px",
    background:
      "radial-gradient(circle at top left, rgba(251,191,36,0.18), transparent 34%), radial-gradient(circle at 80% 8%, rgba(22,131,248,0.1), transparent 28%), #f8fafc",
    minHeight: "100vh",
  },
  hero: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1.2fr) minmax(300px, 0.8fr)",
    gap: 22,
    alignItems: "stretch",
    marginBottom: 20,
  },
  heroContent: {
    padding: 30,
    borderRadius: 32,
    background:
      "linear-gradient(135deg, #0f172a 0%, #1e293b 58%, #78350f 125%)",
    color: "#ffffff",
    boxShadow: "0 26px 70px rgba(15,23,42,0.24)",
  },
  backLink: {
    display: "inline-flex",
    marginBottom: 14,
    padding: "9px 13px",
    borderRadius: 999,
    background: "rgba(255,255,255,0.08)",
    color: "#ffffff",
    border: "1px solid rgba(255,255,255,0.14)",
    textDecoration: "none",
    fontWeight: 900,
    fontSize: 13,
  },
  badgeRow: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
    alignItems: "center",
    marginBottom: 14,
  },
  badge: {
    display: "inline-flex",
    padding: "7px 11px",
    borderRadius: 999,
    background: "rgba(251,191,36,0.16)",
    color: "#fef3c7",
    border: "1px solid rgba(251,191,36,0.28)",
    fontSize: 13,
    fontWeight: 950,
  },
  statusPill: {
    display: "inline-flex",
    padding: "7px 11px",
    borderRadius: 999,
    fontSize: 13,
    fontWeight: 950,
  },
  title: {
    margin: 0,
    fontSize: "clamp(38px, 8vw, 64px)",
    lineHeight: 0.98,
    letterSpacing: "-0.06em",
  },
  description: {
    margin: "16px 0 0",
    color: "#cbd5e1",
    fontSize: 17,
    lineHeight: 1.7,
    maxWidth: 820,
  },
  heroMeta: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(145px, 1fr))",
    gap: 12,
    marginTop: 26,
  },
  metaCard: {
    padding: 14,
    borderRadius: 18,
    background: "rgba(255,255,255,0.08)",
    border: "1px solid rgba(255,255,255,0.12)",
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
    position: "relative",
    minHeight: 330,
    borderRadius: 32,
    overflow: "hidden",
    background: "#e2e8f0",
    border: "1px solid #e2e8f0",
    boxShadow: "0 22px 54px rgba(15,23,42,0.14)",
  },
  image: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
    display: "block",
  },
  heroImageEmpty: {
    width: "100%",
    height: "100%",
    minHeight: 330,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 56,
    background: "#f1f5f9",
  },
  heroImageOverlay: {
    position: "absolute",
    left: 18,
    right: 18,
    bottom: 18,
    padding: 16,
    borderRadius: 20,
    background: "rgba(15,23,42,0.82)",
    color: "#ffffff",
    display: "grid",
    gap: 4,
    backdropFilter: "blur(10px)",
  },
  noticeCard: {
    padding: 20,
    borderRadius: 26,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    boxShadow: "0 2px 14px rgba(15,23,42,0.05)",
    marginBottom: 18,
    display: "flex",
    justifyContent: "space-between",
    gap: 16,
    flexWrap: "wrap",
    alignItems: "center",
  },
  noticeTitle: {
    margin: 0,
    fontSize: 23,
    color: "#0f172a",
    letterSpacing: "-0.03em",
  },
  noticeText: {
    margin: "8px 0 0",
    color: "#475569",
    lineHeight: 1.6,
  },
  noticeChip: {
    padding: 14,
    borderRadius: 18,
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    display: "grid",
    gap: 5,
    minWidth: 210,
  },
  successCard: {
    padding: 16,
    borderRadius: 22,
    background: "#dcfce7",
    color: "#166534",
    border: "1px solid #bbf7d0",
    fontWeight: 950,
    marginBottom: 16,
  },
  errorCard: {
    padding: 16,
    borderRadius: 22,
    background: "#fee2e2",
    color: "#991b1b",
    border: "1px solid #fecaca",
    fontWeight: 950,
    marginBottom: 16,
  },
  loadingCard: {
    maxWidth: 560,
    margin: "80px auto",
    padding: 32,
    borderRadius: 30,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    textAlign: "center",
    boxShadow: "0 20px 60px rgba(15,23,42,0.08)",
  },
  loadingIcon: {
    fontSize: 54,
  },
  loadingTitle: {
    margin: "14px 0 0",
    color: "#0f172a",
  },
  loadingText: {
    margin: "8px 0 0",
    color: "#64748b",
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
    gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))",
    gap: 20,
  },
  itemCard: {
    borderRadius: 30,
    overflow: "hidden",
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    boxShadow: "0 12px 34px rgba(15,23,42,0.08)",
  },
  itemImageWrap: {
    position: "relative",
    width: "100%",
    height: 270,
    background: "#f1f5f9",
  },
  lotBadge: {
    position: "absolute",
    left: 14,
    top: 14,
    padding: "8px 11px",
    borderRadius: 999,
    background: "rgba(15,23,42,0.84)",
    color: "#ffffff",
    fontSize: 13,
    fontWeight: 950,
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
    padding: 22,
  },
  itemTop: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "flex-start",
  },
  itemTitle: {
    margin: 0,
    fontSize: 26,
    lineHeight: 1.12,
    color: "#0f172a",
    letterSpacing: "-0.035em",
  },
  donor: {
    margin: "7px 0 0",
    color: "#64748b",
  },
  itemStatus: {
    display: "inline-flex",
    padding: "7px 10px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 950,
    textTransform: "capitalize",
    whiteSpace: "nowrap",
  },
  itemDescription: {
    color: "#334155",
    lineHeight: 1.65,
    margin: "16px 0 0",
  },
  bidFeature: {
    marginTop: 18,
    padding: 18,
    borderRadius: 22,
    background: "linear-gradient(135deg, #0f172a, #1e293b)",
    color: "#ffffff",
    display: "grid",
    gap: 5,
  },
  bidStats: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(132px, 1fr))",
    gap: 10,
    marginTop: 14,
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
    marginTop: 18,
    padding: 16,
    borderRadius: 22,
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
  },
  formGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
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
    padding: "14px 18px",
    borderRadius: 999,
    background: "#1683f8",
    color: "#ffffff",
    border: "none",
    fontWeight: 950,
    cursor: "pointer",
    boxShadow: "0 10px 20px rgba(22,131,248,0.22)",
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
    boxShadow: "0 2px 12px rgba(15,23,42,0.04)",
  },
  termsText: {
    whiteSpace: "pre-wrap",
    color: "#334155",
    lineHeight: 1.65,
    margin: "10px 0 0",
  },
};
