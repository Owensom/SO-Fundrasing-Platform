"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState, type CSSProperties } from "react";

const DEFAULT_AUCTION_IMAGE = "/brand/so-default-auctions.png";

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

type TenantBrandingSettings = {
  public_display_name: string | null;
  public_tagline: string | null;
  public_logo_url: string | null;
  public_logo_mark_url: string | null;
  public_primary_colour: string | null;
  public_accent_colour: string | null;
  public_footer_text: string | null;
};

type Props = {
  params: {
    slug: string;
  };
};

function cleanText(value: unknown) {
  return String(value || "").trim();
}

function normaliseHexColour(value: unknown, fallback: string) {
  const clean = cleanText(value).toUpperCase();

  if (/^#[0-9A-F]{6}$/.test(clean)) {
    return clean;
  }

  return fallback;
}

function isDefaultAuctionImage(value: string | null | undefined) {
  const clean = cleanText(value);

  return !clean || clean.includes("/brand/so-default-auctions.png");
}

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
  const [branding, setBranding] = useState<TenantBrandingSettings | null>(null);
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
        branding?: TenantBrandingSettings | null;
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
      setBranding(parsed.branding ?? null);
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

  const publicDisplayName =
    cleanText(branding?.public_display_name) || "SO Fundraising Platform";

  const publicTagline =
    cleanText(branding?.public_tagline) ||
    "Supporting causes through premium fundraising campaigns.";

  const publicLogoUrl = cleanText(branding?.public_logo_url);
  const publicLogoMarkUrl = cleanText(branding?.public_logo_mark_url);
  const publicFooterText = cleanText(branding?.public_footer_text);

  const primaryColour = normaliseHexColour(
    branding?.public_primary_colour,
    "#1683F8",
  );

  const accentColour = normaliseHexColour(
    branding?.public_accent_colour,
    "#FACC15",
  );

  const brandLogoSrc = publicLogoMarkUrl || publicLogoUrl;

  const auctionUsesDefaultImage = isDefaultAuctionImage(auction?.image_url);
  const auctionHeroImageSrc = auction?.image_url || DEFAULT_AUCTION_IMAGE;

  const brandedPageStyle: CSSProperties = {
    ...styles.page,
    background: `radial-gradient(circle at top left, ${accentColour}20, transparent 34%), radial-gradient(circle at 80% 8%, ${primaryColour}14, transparent 28%), #f8fafc`,
  };

  const brandedBrandFallbackStyle: CSSProperties = {
    ...styles.brandLogoFallback,
    background: primaryColour,
    borderColor: accentColour,
  };

  const brandedHeroStyle: CSSProperties = {
    ...styles.hero,
    minHeight: auctionUsesDefaultImage
      ? "clamp(390px, 56vh, 620px)"
      : styles.hero.minHeight,
    background: auctionUsesDefaultImage
      ? "linear-gradient(135deg, #f8fafc 0%, #ffffff 42%, #eef2ff 100%)"
      : undefined,
  };

  const brandedHeroOverlayStyle: CSSProperties = {
    ...styles.heroOverlay,
    background: auctionUsesDefaultImage
      ? `linear-gradient(180deg, rgba(15,23,42,0.03) 0%, rgba(15,23,42,0.32) 46%, rgba(15,23,42,0.92) 100%), radial-gradient(circle at bottom left, ${primaryColour}30, transparent 42%), radial-gradient(circle at top right, ${accentColour}14, transparent 32%)`
      : `linear-gradient(180deg, rgba(15,23,42,0.12) 0%, rgba(15,23,42,0.50) 44%, rgba(15,23,42,0.94) 100%), radial-gradient(circle at bottom left, ${primaryColour}36, transparent 42%), radial-gradient(circle at top right, ${accentColour}18, transparent 32%)`,
  };

  const brandedBadgeStyle: CSSProperties = {
    ...styles.badge,
    background: `${accentColour}24`,
    color: "#fef3c7",
    borderColor: `${accentColour}66`,
  };

  const brandedNoticeCardStyle: CSSProperties = {
    ...styles.noticeCard,
    borderColor: `${primaryColour}2B`,
  };

  const brandedNoticeChipStyle: CSSProperties = {
    ...styles.noticeChip,
    borderColor: `${accentColour}60`,
    background: `${accentColour}12`,
  };

  const brandedBidButtonStyle: CSSProperties = {
    ...styles.bidButton,
    background: primaryColour,
    boxShadow: `0 10px 20px ${primaryColour}36`,
  };

  if (!slug) {
    return (
      <main className="public-auction-page" style={brandedPageStyle}>
        <style>{responsiveStyles}</style>
        Loading auction…
      </main>
    );
  }

  if (loading) {
    return (
      <main className="public-auction-page" style={brandedPageStyle}>
        <style>{responsiveStyles}</style>

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
      <main className="public-auction-page" style={brandedPageStyle}>
        <style>{responsiveStyles}</style>

        <section style={styles.errorCard}>{error}</section>
      </main>
    );
  }

  if (!auction) {
    return (
      <main className="public-auction-page" style={brandedPageStyle}>
        <style>{responsiveStyles}</style>

        <section style={styles.emptyCard}>Auction not found.</section>
      </main>
    );
  }

  return (
    <main className="public-auction-page" style={brandedPageStyle}>
      <style>{responsiveStyles}</style>

      <section className="brandHeader" style={styles.brandHeader}>
        <div className="brandIdentity" style={styles.brandIdentity}>
          {brandLogoSrc ? (
            <div style={styles.brandLogoWrap}>
              <img
                src={brandLogoSrc}
                alt={publicDisplayName}
                style={styles.brandLogo}
              />
            </div>
          ) : (
            <div style={brandedBrandFallbackStyle}>
              {publicDisplayName.slice(0, 2).toUpperCase()}
            </div>
          )}

          <div style={styles.brandCopy}>
            <p style={{ ...styles.brandKicker, color: primaryColour }}>
              Silent auction
            </p>
            <h1 style={styles.brandTitle}>{publicDisplayName}</h1>
            <p style={styles.brandTagline}>{publicTagline}</p>
          </div>
        </div>

        <div
          style={{
            ...styles.brandFeature,
            borderColor: `${accentColour}78`,
            background: `linear-gradient(135deg, ${accentColour}12, #ffffff 78%)`,
          }}
        >
          <span style={styles.brandFeatureKicker}>Live auction</span>
          <strong style={styles.brandFeatureTitle}>{auction.title}</strong>
          <span style={styles.brandFeatureText}>
            {totalBids} bids placed · {items.length} lots
          </span>
        </div>
      </section>

      <section style={brandedHeroStyle}>
        <div
          style={{
            ...styles.defaultHeroImageHalo,
            display: auctionUsesDefaultImage ? "block" : "none",
            background: `radial-gradient(circle, ${accentColour}18 0%, transparent 58%)`,
          }}
        />

        <img
          src={auctionHeroImageSrc}
          alt={auction.title}
          style={{
            ...styles.heroBackgroundImage,
            objectPosition: auctionUsesDefaultImage
              ? "center 38%"
              : `${focusValue(auction.image_focus_x)}% ${focusValue(
                  auction.image_focus_y,
                )}%`,
            objectFit: auctionUsesDefaultImage ? "contain" : "cover",
            padding: auctionUsesDefaultImage ? "clamp(42px, 7vw, 76px)" : 0,
            boxSizing: "border-box",
            background: auctionUsesDefaultImage
              ? "transparent"
              : "#0f172a",
            opacity: auctionUsesDefaultImage ? 0.82 : 1,
            transform: auctionUsesDefaultImage ? "scale(0.88)" : undefined,
          }}
        />

        <div style={brandedHeroOverlayStyle} />

        <div style={styles.heroInner}>
          <Link href={`/c/${auction.tenant_slug}`} style={styles.backLink}>
            ← Back to campaigns
          </Link>

          <div style={styles.badgeRow}>
            <span style={brandedBadgeStyle}>Silent auction</span>
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

          <div style={styles.heroFooter}>
            <span>Supporting {publicDisplayName}</span>
            <strong>{totalBids} bids placed</strong>
          </div>
        </div>
      </section>

      <div style={styles.contentWrap}>
        {successMessage ? (
          <section style={styles.successCard}>{successMessage}</section>
        ) : null}

        {queryError ? <section style={styles.errorCard}>{queryError}</section> : null}

        {error ? <section style={styles.errorCard}>{error}</section> : null}

        <section style={brandedNoticeCardStyle}>
          <div style={styles.noticeTextBlock}>
            <h2 style={styles.noticeTitle}>{availability.label}</h2>
            <p style={styles.noticeText}>{availability.message}</p>
          </div>

          <div style={brandedNoticeChipStyle}>
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
              const itemUsesDefaultImage = isDefaultAuctionImage(item.image_url);

              return (
                <article key={item.id} style={styles.itemCard}>
                  <div
                    style={{
                      ...styles.itemImageWrap,
                      height: itemUsesDefaultImage
                        ? "clamp(160px, 34vw, 220px)"
                        : styles.itemImageWrap.height,
                    }}
                  >
                    <img
                      src={item.image_url || DEFAULT_AUCTION_IMAGE}
                      alt={item.title}
                      style={{
                        ...styles.image,
                        objectPosition: itemUsesDefaultImage
                          ? "center"
                          : `${focusValue(item.image_focus_x)}% ${focusValue(
                              item.image_focus_y,
                            )}%`,
                        objectFit: itemUsesDefaultImage ? "contain" : "cover",
                        background: itemUsesDefaultImage
                          ? "linear-gradient(135deg, #ffffff 0%, #f8fafc 52%, #eff6ff 100%)"
                          : "#f1f5f9",
                        padding: itemUsesDefaultImage ? "clamp(24px, 6vw, 42px)" : 0,
                        boxSizing: "border-box",
                      }}
                    />

                    <div
                      style={{
                        ...styles.lotBadge,
                        background: "rgba(15,23,42,0.84)",
                        border: `1px solid ${accentColour}60`,
                      }}
                    >
                      Lot {item.sort_order || index + 1}
                    </div>
                  </div>

                  <div style={styles.itemBody}>
                    <div style={styles.itemTop}>
                      <div style={styles.itemTitleWrap}>
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

                    <div
                      style={{
                        ...styles.bidFeature,
                        background: "linear-gradient(135deg, #0f172a, #1e293b)",
                        border: `1px solid ${accentColour}36`,
                      }}
                    >
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
                        <strong>
                          {moneyFromCents(minimumNextBid, auction.currency)}
                        </strong>
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

                        <button type="submit" style={brandedBidButtonStyle}>
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

        {publicFooterText ? (
          <footer
            style={{
              ...styles.footer,
              borderColor: `${accentColour}60`,
            }}
          >
            <p style={styles.footerText}>{publicFooterText}</p>
          </footer>
        ) : null}
      </div>
    </main>
  );
}

const responsiveStyles = `
.public-auction-page,
.public-auction-page * {
  box-sizing: border-box;
}

.public-auction-page {
  overflow-x: hidden;
}

.public-auction-page section,
.public-auction-page div,
.public-auction-page article,
.public-auction-page form,
.public-auction-page label {
  min-width: 0;
}

@media (max-width: 980px) {
  .public-auction-page .brandHeader {
    grid-template-columns: 1fr !important;
  }
}

@media (max-width: 680px) {
  .public-auction-page .brandHeader {
    padding: 12px !important;
    border-radius: 22px !important;
    margin: 10px 10px 12px !important;
  }

  .public-auction-page .brandIdentity {
    grid-template-columns: 56px minmax(0, 1fr) !important;
  }

  .public-auction-page .brandLogoWrap,
  .public-auction-page .brandLogoFallback {
    width: 56px !important;
    height: 56px !important;
    border-radius: 16px !important;
  }

  .public-auction-page .brandTitle {
    font-size: clamp(24px, 8vw, 36px) !important;
    letter-spacing: -0.06em !important;
  }

  .public-auction-page .heroTitle {
    font-size: clamp(38px, 16vw, 76px) !important;
  }
}
`;

const styles: Record<string, CSSProperties> = {
  page: {
    width: "100%",
    minHeight: "100vh",
    paddingBottom: 48,
    overflowX: "hidden",
  },

  brandHeader: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) minmax(250px, 0.34fr)",
    gap: 14,
    alignItems: "stretch",
    maxWidth: 1220,
    margin: "18px auto 14px",
    padding: 14,
    borderRadius: 24,
    background: "rgba(255,255,255,0.94)",
    border: "1px solid #e2e8f0",
    boxShadow: "0 14px 38px rgba(15,23,42,0.07)",
    backdropFilter: "blur(14px)",
  },

  brandIdentity: {
    display: "grid",
    gridTemplateColumns: "72px minmax(0, 1fr)",
    gap: 14,
    alignItems: "center",
    minWidth: 0,
  },

  brandLogoWrap: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: 72,
    height: 72,
    borderRadius: 18,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    overflow: "hidden",
    boxShadow: "0 10px 24px rgba(15,23,42,0.08)",
  },

  brandLogo: {
    display: "block",
    width: "100%",
    height: "100%",
    objectFit: "contain",
    padding: 7,
  },

  brandLogoFallback: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: 72,
    height: 72,
    borderRadius: 18,
    border: "2px solid",
    color: "#0f172a",
    fontSize: 22,
    fontWeight: 950,
    letterSpacing: "-0.05em",
  },

  brandCopy: {
    display: "grid",
    gap: 4,
    minWidth: 0,
  },

  brandKicker: {
    margin: 0,
    fontSize: 11,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
  },

  brandTitle: {
    margin: 0,
    color: "#0f172a",
    fontSize: "clamp(30px, 4.6vw, 50px)",
    lineHeight: 0.94,
    letterSpacing: "-0.075em",
    overflowWrap: "anywhere",
  },

  brandTagline: {
    margin: 0,
    color: "#475569",
    fontSize: 14,
    lineHeight: 1.35,
    fontWeight: 850,
    overflowWrap: "anywhere",
  },

  brandFeature: {
    display: "grid",
    gap: 5,
    alignContent: "center",
    padding: 12,
    borderRadius: 18,
    border: "1px solid",
    minWidth: 0,
  },

  brandFeatureKicker: {
    color: "#92400e",
    fontSize: 10,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
  },

  brandFeatureTitle: {
    color: "#0f172a",
    fontSize: 18,
    lineHeight: 1.1,
    letterSpacing: "-0.04em",
    overflowWrap: "anywhere",
  },

  brandFeatureText: {
    color: "#475569",
    fontSize: 12,
    lineHeight: 1.35,
    fontWeight: 750,
  },

  hero: {
    position: "relative",
    width: "100%",
    minHeight: "clamp(430px, 68vh, 740px)",
    overflow: "hidden",
    display: "flex",
    alignItems: "flex-end",
  },

  defaultHeroImageHalo: {
    position: "absolute",
    left: "50%",
    top: "48%",
    width: "min(68vw, 760px)",
    height: "min(68vw, 760px)",
    transform: "translate(-50%, -50%)",
    borderRadius: 999,
    pointerEvents: "none",
    zIndex: 0,
  },

  heroBackgroundImage: {
    position: "absolute",
    inset: 0,
    width: "100%",
    height: "100%",
    display: "block",
    zIndex: 1,
  },

  heroOverlay: {
    position: "absolute",
    inset: 0,
    zIndex: 2,
  },

  heroInner: {
    position: "relative",
    zIndex: 3,
    width: "100%",
    maxWidth: 1220,
    margin: "0 auto",
    padding: "72px 14px 28px",
    color: "#ffffff",
    boxSizing: "border-box",
  },

  backLink: {
    display: "inline-flex",
    marginBottom: 14,
    padding: "10px 14px",
    borderRadius: 999,
    background: "rgba(255,255,255,0.12)",
    color: "#ffffff",
    border: "1px solid rgba(255,255,255,0.18)",
    textDecoration: "none",
    fontWeight: 900,
    fontSize: 13,
    backdropFilter: "blur(10px)",
    maxWidth: "100%",
    boxSizing: "border-box",
  },

  badgeRow: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
    alignItems: "center",
    marginBottom: 14,
  },

  badge: {
    display: "inline-flex",
    padding: "8px 12px",
    borderRadius: 999,
    fontSize: 13,
    fontWeight: 950,
    backdropFilter: "blur(10px)",
    border: "1px solid",
  },

  statusPill: {
    display: "inline-flex",
    padding: "8px 12px",
    borderRadius: 999,
    fontSize: 13,
    fontWeight: 950,
    backdropFilter: "blur(10px)",
  },

  title: {
    margin: 0,
    maxWidth: 900,
    fontSize: "clamp(34px, 11vw, 96px)",
    lineHeight: 0.96,
    letterSpacing: "-0.065em",
    fontWeight: 1000,
    wordBreak: "break-word",
    overflowWrap: "anywhere",
  },

  description: {
    margin: "16px 0 0",
    color: "#e2e8f0",
    fontSize: "clamp(15px, 4vw, 20px)",
    lineHeight: 1.55,
    maxWidth: 780,
    overflowWrap: "anywhere",
  },

  heroMeta: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 150px), 1fr))",
    gap: 10,
    marginTop: 22,
    maxWidth: 920,
  },

  metaCard: {
    padding: 14,
    borderRadius: 18,
    background: "rgba(255,255,255,0.1)",
    border: "1px solid rgba(255,255,255,0.14)",
    display: "grid",
    gap: 6,
    backdropFilter: "blur(12px)",
    minWidth: 0,
    overflowWrap: "anywhere",
  },

  metaLabel: {
    color: "#cbd5e1",
    fontSize: 11,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.06em",
  },

  heroFooter: {
    marginTop: 18,
    width: "fit-content",
    maxWidth: "100%",
    padding: "14px 16px",
    borderRadius: 18,
    background: "rgba(15,23,42,0.74)",
    color: "#ffffff",
    display: "grid",
    gap: 4,
    backdropFilter: "blur(12px)",
    boxSizing: "border-box",
    overflowWrap: "anywhere",
  },

  contentWrap: {
    maxWidth: 1220,
    margin: "0 auto",
    padding: "0 14px",
    boxSizing: "border-box",
    width: "100%",
  },

  noticeCard: {
    padding: 16,
    borderRadius: 22,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    boxShadow: "0 2px 14px rgba(15,23,42,0.05)",
    margin: "18px 0",
    display: "flex",
    justifyContent: "space-between",
    gap: 14,
    flexWrap: "wrap",
    alignItems: "center",
  },

  noticeTextBlock: {
    minWidth: 0,
    flex: "1 1 260px",
  },

  noticeTitle: {
    margin: 0,
    fontSize: "clamp(21px, 6vw, 26px)",
    color: "#0f172a",
    letterSpacing: "-0.03em",
    overflowWrap: "anywhere",
  },

  noticeText: {
    margin: "8px 0 0",
    color: "#475569",
    lineHeight: 1.55,
    overflowWrap: "anywhere",
  },

  noticeChip: {
    padding: 14,
    borderRadius: 18,
    border: "1px solid #e2e8f0",
    display: "grid",
    gap: 5,
    minWidth: 0,
    width: "min(100%, 300px)",
    overflowWrap: "anywhere",
  },

  successCard: {
    padding: 16,
    borderRadius: 22,
    background: "#dcfce7",
    color: "#166534",
    border: "1px solid #bbf7d0",
    fontWeight: 950,
    marginTop: 18,
    marginBottom: 16,
  },

  errorCard: {
    padding: 16,
    borderRadius: 22,
    background: "#fee2e2",
    color: "#991b1b",
    border: "1px solid #fecaca",
    fontWeight: 950,
    marginTop: 18,
    marginBottom: 16,
    overflowWrap: "anywhere",
  },

  loadingCard: {
    maxWidth: 560,
    margin: "80px auto",
    padding: 28,
    borderRadius: 28,
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
    padding: 22,
    borderRadius: 24,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    overflowWrap: "anywhere",
  },

  muted: {
    color: "#64748b",
  },

  itemsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 320px), 1fr))",
    gap: 18,
  },

  itemCard: {
    borderRadius: 26,
    overflow: "hidden",
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    boxShadow: "0 12px 34px rgba(15,23,42,0.08)",
    minWidth: 0,
  },

  itemImageWrap: {
    position: "relative",
    width: "100%",
    height: "clamp(210px, 56vw, 300px)",
    background: "#f1f5f9",
  },

  image: {
    width: "100%",
    height: "100%",
    display: "block",
  },

  lotBadge: {
    position: "absolute",
    left: 14,
    top: 14,
    padding: "8px 11px",
    borderRadius: 999,
    color: "#ffffff",
    fontSize: 13,
    fontWeight: 950,
  },

  itemBody: {
    padding: "clamp(16px, 5vw, 22px)",
  },

  itemTop: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "flex-start",
    flexWrap: "wrap",
  },

  itemTitleWrap: {
    minWidth: 0,
    flex: "1 1 220px",
  },

  itemTitle: {
    margin: 0,
    fontSize: "clamp(23px, 7vw, 30px)",
    lineHeight: 1.1,
    color: "#0f172a",
    letterSpacing: "-0.035em",
    wordBreak: "break-word",
    overflowWrap: "anywhere",
  },

  donor: {
    margin: "7px 0 0",
    color: "#64748b",
    overflowWrap: "anywhere",
  },

  itemStatus: {
    display: "inline-flex",
    padding: "7px 10px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 950,
    textTransform: "capitalize",
    whiteSpace: "nowrap",
    flexShrink: 0,
  },

  itemDescription: {
    color: "#334155",
    lineHeight: 1.6,
    margin: "16px 0 0",
    overflowWrap: "anywhere",
  },

  bidFeature: {
    marginTop: 18,
    padding: 16,
    borderRadius: 20,
    color: "#ffffff",
    display: "grid",
    gap: 5,
    overflowWrap: "anywhere",
  },

  bidStats: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 132px), 1fr))",
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
    minWidth: 0,
    overflowWrap: "anywhere",
  },

  bidForm: {
    display: "grid",
    gap: 14,
    marginTop: 18,
    padding: "clamp(14px, 4vw, 16px)",
    borderRadius: 22,
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    minWidth: 0,
  },

  formGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 170px), 1fr))",
    gap: 12,
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
    borderRadius: 14,
    border: "1px solid #cbd5e1",
    padding: "13px 13px",
    fontSize: 16,
    color: "#0f172a",
    background: "#ffffff",
    minWidth: 0,
  },

  checkboxLabel: {
    display: "flex",
    gap: 10,
    alignItems: "flex-start",
    color: "#334155",
    fontWeight: 750,
    lineHeight: 1.5,
    overflowWrap: "anywhere",
  },

  bidButton: {
    width: "100%",
    padding: "15px 18px",
    borderRadius: 999,
    color: "#ffffff",
    border: "none",
    fontWeight: 950,
    cursor: "pointer",
    fontSize: 16,
  },

  closedBox: {
    marginTop: 16,
    padding: 16,
    borderRadius: 18,
    background: "#f1f5f9",
    color: "#475569",
    border: "1px solid #e2e8f0",
    fontWeight: 800,
    overflowWrap: "anywhere",
  },

  termsCard: {
    marginTop: 18,
    padding: 20,
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
    overflowWrap: "anywhere",
  },

  footer: {
    marginTop: 20,
    padding: 16,
    borderRadius: 22,
    background: "#ffffff",
    border: "1px solid",
    textAlign: "center",
  },

  footerText: {
    margin: 0,
    color: "#64748b",
    fontWeight: 800,
    lineHeight: 1.5,
  },
};
