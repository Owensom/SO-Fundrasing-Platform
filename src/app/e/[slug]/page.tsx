import type { CSSProperties, ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { queryOne } from "@/lib/db";
import { getTenantSlugFromHeaders } from "@/lib/tenant";
import {
  getPlatformFeePercent,
  getTenantFinanceSettings,
} from "@/lib/payments";
import { getEventBySlug } from "../../../../api/_lib/events-repo";
import PublicGeneralAdmissionSelector from "@/components/events/PublicGeneralAdmissionSelector";
import PublicReservedSeatSelector from "@/components/events/PublicReservedSeatSelector";
import PublicTableSelector from "@/components/events/PublicTableSelector";
import type { PublicEventCheckoutAddOn } from "@/components/events/PublicEventCheckoutAddOnSelector";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{
    slug: string;
  }>;
  searchParams?: Promise<{
    checkout?: string;
    session_id?: string;
  }>;
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

type PublicDisplayAddOn = {
  type: "heads_or_tails" | "higher_or_lower";
  title: string;
  description: string;
  instructions: string;
  prizeTitle: string;
  entryPriceCents: number;
  maxEntriesPerBooking: number | null;
  collectAtCheckout: boolean;
  footnote: string;
};

const TABLE_SHAPE_KEY = "__table_shape";
const DEFAULT_EVENTS_IMAGE = "/brand/so-default-events.png";

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

function formatDate(value: string | null) {
  if (!value) return "Not set";

  try {
    return new Intl.DateTimeFormat("en-GB", {
      dateStyle: "full",
      timeStyle: "short",
    }).format(new Date(value));
  } catch {
    return "Not set";
  }
}

function moneyFromCents(cents: number | null | undefined) {
  return (Number(cents || 0) / 100).toFixed(2);
}

function eventTypeLabel(type: string) {
  if (type === "reserved_seating") return "Reserved seating";
  if (type === "tables") return "Table seating";
  return "General admission";
}

function isDefaultBrandImage(imageUrl: string | null | undefined) {
  return Boolean(imageUrl && imageUrl.includes("/brand/so-default-"));
}

function getAddOnDefaults(type: string) {
  if (type === "higher_or_lower") {
    return {
      title: "Higher or Lower",
      description:
        "Join our Higher or Lower fundraiser on the night and see how long you can stay in the game.",
      instructions:
        "Guess whether the next card, number or total will be higher or lower. Keep playing while you are correct.",
      footnote:
        "Higher or Lower is run live by the organiser during the event. Main event tickets and seating are booked separately below.",
    };
  }

  return {
    title: "Heads or Tails",
    description:
      "Join our Heads or Tails fundraiser on the night and keep playing until one winner remains.",
    instructions:
      "Choose heads or tails each round. Stay standing if you are correct. The last person standing wins.",
    footnote:
      "Heads or Tails is run live by the organiser during the event. Main event tickets and seating are booked separately below.",
  };
}

async function getTenantBrandingSettings(tenantSlug: string) {
  return queryOne<TenantBrandingSettings>(
    `
      select
        public_display_name,
        public_tagline,
        public_logo_url,
        public_logo_mark_url,
        public_primary_colour,
        public_accent_colour,
        public_footer_text
      from tenant_settings
      where tenant_slug = $1
      limit 1
    `,
    [tenantSlug],
  );
}

function Card({ children }: { children: ReactNode }) {
  return <section style={styles.card}>{children}</section>;
}

export default async function EventSlugPage({
  params,
  searchParams,
}: PageProps) {
  const { slug } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : {};

  const tenantSlug = await getTenantSlugFromHeaders();
  const event = await getEventBySlug(tenantSlug, slug);

  if (!event || event.status !== "published") {
    notFound();
  }

  const [finance, brandingSettings] = await Promise.all([
    getTenantFinanceSettings(event.tenant_slug),
    getTenantBrandingSettings(event.tenant_slug),
  ]);

  const platformFeePercent = getPlatformFeePercent(finance);

  const ticketTypes = (event.ticket_types || []).filter(
    (ticketType) => ticketType.is_active,
  );

  const seats = event.seats || [];
  const eventImageUrl = event.image_url || DEFAULT_EVENTS_IMAGE;
  const hasCustomImage =
    Boolean(event.image_url) && !isDefaultBrandImage(event.image_url);

  const tableShape =
    event.table_names_json?.[TABLE_SHAPE_KEY] === "square" ||
    event.table_names_json?.[TABLE_SHAPE_KEY] === "rectangle" ||
    event.table_names_json?.[TABLE_SHAPE_KEY] === "round"
      ? event.table_names_json[TABLE_SHAPE_KEY]
      : "round";

  const tableSeatsWithNames = seats.map((seat) => ({
    ...seat,
    table_name: seat.table_number
      ? event.table_names_json?.[String(seat.table_number)] || null
      : null,
  }));

  const menuOptions = (event.menu_options || [])
    .filter((option) => option.isActive !== false && option.is_active !== false)
    .sort(
      (a, b) =>
        Number(a.sortOrder ?? a.sort_order ?? 0) -
        Number(b.sortOrder ?? b.sort_order ?? 0),
    )
    .map((option) => String(option.name || option.title || "").trim())
    .filter(Boolean);

  const publicDisplayAddOns: PublicDisplayAddOn[] = (event.event_addons_json || [])
    .filter(
      (addOn) =>
        addOn.enabled &&
        (addOn.type === "heads_or_tails" || addOn.type === "higher_or_lower"),
    )
    .sort((a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0))
    .map((addOn) => {
      const defaults = getAddOnDefaults(addOn.type);
      const entryPriceCents = Number(addOn.entryPriceCents || 0);
      const maxEntriesPerBooking =
        Number(addOn.maxEntriesPerBooking || 0) > 0
          ? Number(addOn.maxEntriesPerBooking || 0)
          : null;

      return {
        type: addOn.type,
        title: cleanText(addOn.title) || defaults.title,
        description: cleanText(addOn.description) || defaults.description,
        instructions: cleanText(addOn.instructions) || defaults.instructions,
        prizeTitle: cleanText(addOn.prizeTitle),
        entryPriceCents,
        maxEntriesPerBooking,
        collectAtCheckout: Boolean(addOn.collectAtCheckout),
        footnote: defaults.footnote,
      };
    });

  const headsOrTailsDisplayAddOn = publicDisplayAddOns.find(
    (addOn) => addOn.type === "heads_or_tails",
  );

  const checkoutAddOn: PublicEventCheckoutAddOn | null =
    headsOrTailsDisplayAddOn?.collectAtCheckout &&
    headsOrTailsDisplayAddOn.entryPriceCents > 0
      ? {
          type: "heads_or_tails",
          title: headsOrTailsDisplayAddOn.title,
          description:
            headsOrTailsDisplayAddOn.description ||
            "Add Heads or Tails entries to your event booking.",
          entryPriceCents: headsOrTailsDisplayAddOn.entryPriceCents,
          maxEntriesPerBooking: headsOrTailsDisplayAddOn.maxEntriesPerBooking,
        }
      : null;

  const lowestTicketPrice =
    ticketTypes.length > 0
      ? Math.min(
          ...ticketTypes.map((ticketType) => Number(ticketType.price || 0)),
        )
      : 0;

  const availableSeats = seats.filter(
    (seat) => seat.status === "available",
  ).length;

  const publicDisplayName =
    cleanText(brandingSettings?.public_display_name) ||
    "SO Fundraising Platform";

  const publicTagline =
    cleanText(brandingSettings?.public_tagline) ||
    "Supporting causes through premium fundraising campaigns.";

  const publicLogoUrl = cleanText(brandingSettings?.public_logo_url);
  const publicLogoMarkUrl = cleanText(brandingSettings?.public_logo_mark_url);
  const publicFooterText = cleanText(brandingSettings?.public_footer_text);

  const primaryColour = normaliseHexColour(
    brandingSettings?.public_primary_colour,
    "#1683F8",
  );

  const accentColour = normaliseHexColour(
    brandingSettings?.public_accent_colour,
    "#FACC15",
  );

  const brandLogoSrc = publicLogoMarkUrl || publicLogoUrl;
  const backToCampaignsHref = `/c/${event.tenant_slug}`;

  const brandedPageStyle: CSSProperties = {
    ...styles.page,
    background: `radial-gradient(circle at top left, ${accentColour}20, transparent 34%), radial-gradient(circle at 80% 8%, ${primaryColour}14, transparent 28%), #f8fafc`,
  };

  const brandedBrandFallbackStyle: CSSProperties = {
    ...styles.brandLogoFallback,
    background: primaryColour,
    borderColor: accentColour,
  };

  const brandedHeroOverlayStyle: CSSProperties = {
    ...styles.heroOverlay,
    background: `linear-gradient(180deg, rgba(15,23,42,0.12) 0%, rgba(15,23,42,0.50) 44%, rgba(15,23,42,0.94) 100%), radial-gradient(circle at bottom left, ${primaryColour}36, transparent 42%), radial-gradient(circle at top right, ${accentColour}18, transparent 32%)`,
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

  const brandedCheckoutBadgeStyle: CSSProperties = {
    ...styles.checkoutBadge,
    background: primaryColour,
    boxShadow: `0 10px 22px ${primaryColour}2E`,
  };

  return (
    <main className="public-event-page" style={brandedPageStyle}>
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
              Event booking
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
          <span style={styles.brandFeatureKicker}>Live event</span>
          <strong style={styles.brandFeatureTitle}>{event.title}</strong>
          <span style={styles.brandFeatureText}>
            {event.location || "Location to be confirmed"}
          </span>
        </div>
      </section>

      <section style={styles.hero}>
        <img
          src={eventImageUrl}
          alt={event.title || "SO Events"}
          style={{
            ...styles.heroBackgroundImage,
            objectPosition: hasCustomImage
              ? `${event.image_focus_x ?? 50}% ${event.image_focus_y ?? 50}%`
              : "center",
            objectFit: hasCustomImage ? "cover" : "contain",
            padding: hasCustomImage ? 0 : 26,
            boxSizing: "border-box",
            background: hasCustomImage
              ? "#0f172a"
              : "linear-gradient(135deg, #ffffff 0%, #f8fafc 52%, #eff6ff 100%)",
          }}
        />

        <div style={brandedHeroOverlayStyle} />

        <div style={styles.heroInner}>
          <Link href={backToCampaignsHref} style={styles.backLink}>
            ← Back to campaigns
          </Link>

          <div style={styles.badgeRow}>
            <span style={brandedBadgeStyle}>
              {eventTypeLabel(event.event_type)}
            </span>
            <span style={styles.statusPill}>Open for bookings</span>
          </div>

          <h1 style={styles.title}>{event.title}</h1>

          {event.description ? (
            <p style={styles.description}>{event.description}</p>
          ) : null}

          <div style={styles.heroMeta}>
            <div style={styles.metaCard}>
              <span style={styles.metaLabel}>Date</span>
              <strong>{formatDate(event.starts_at)}</strong>
            </div>

            <div style={styles.metaCard}>
              <span style={styles.metaLabel}>Location</span>
              <strong>{event.location || "Location to be confirmed"}</strong>
            </div>

            {lowestTicketPrice > 0 && (
              <div style={styles.metaCard}>
                <span style={styles.metaLabel}>Tickets from</span>
                <strong>
                  {event.currency} {moneyFromCents(lowestTicketPrice)}
                </strong>
              </div>
            )}

            {event.event_type !== "general_admission" && (
              <div style={styles.metaCard}>
                <span style={styles.metaLabel}>Available</span>
                <strong>{availableSeats}</strong>
              </div>
            )}
          </div>

          <div style={styles.heroFooter}>
            <span>Supporting {publicDisplayName}</span>
            <strong>Secure event booking</strong>
          </div>
        </div>
      </section>

      <div style={styles.contentWrap}>
        {resolvedSearchParams.checkout === "success" && (
          <section style={styles.successCard}>
            <strong>Payment successful.</strong>
            <br />
            Thank you. Your booking has been received.
          </section>
        )}

        {resolvedSearchParams.checkout === "cancelled" && (
          <section style={styles.errorCard}>
            <strong>Checkout cancelled.</strong>
            <br />
            Your order was not completed. You can choose again below.
          </section>
        )}

        <section style={brandedNoticeCardStyle}>
          <div style={styles.noticeTextBlock}>
            <h2 style={styles.noticeTitle}>Open for bookings</h2>
            <p style={styles.noticeText}>
              Choose your tickets or seats below, then continue securely to
              checkout.
            </p>
          </div>

          <div style={brandedNoticeChipStyle}>
            <span>Starts</span>
            <strong>{formatDate(event.starts_at)}</strong>
          </div>
        </section>

        <div style={styles.contentGrid}>
          <Card>
            <h2 style={styles.noticeTitle}>Event details</h2>

            <InfoRow
              label="Event type"
              value={eventTypeLabel(event.event_type)}
            />

            {lowestTicketPrice > 0 && (
              <InfoRow
                label="Tickets from"
                value={`${event.currency} ${moneyFromCents(lowestTicketPrice)}`}
              />
            )}

            <InfoRow label="Date" value={formatDate(event.starts_at)} />

            <InfoRow
              label="Location"
              value={event.location || "Location to be confirmed"}
            />

            {event.event_type !== "general_admission" && (
              <InfoRow label="Available now" value={availableSeats} />
            )}

            {event.description && (
              <p style={styles.detailDescription}>{event.description}</p>
            )}
          </Card>

          <section style={styles.ticketPanel}>
            <h2 style={styles.ticketPanelTitle}>Tickets</h2>

            <div style={styles.stack}>
              {ticketTypes.length === 0 ? (
                <div style={styles.emptyDark}>
                  Ticket options have not been added yet.
                </div>
              ) : (
                ticketTypes.map((ticketType) => (
                  <div key={ticketType.id} style={styles.ticketItem}>
                    <div style={styles.ticketItemText}>
                      <strong>{ticketType.name}</strong>

                      {ticketType.description && (
                        <p style={styles.mutedLight}>
                          {ticketType.description}
                        </p>
                      )}
                    </div>

                    <strong
                      style={{
                        ...styles.pricePill,
                        borderColor: `${accentColour}66`,
                        background: `${accentColour}24`,
                      }}
                    >
                      {event.currency} {moneyFromCents(ticketType.price)}
                    </strong>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>

        {publicDisplayAddOns.map((addOn) => (
          <section
            key={addOn.type}
            style={{
              ...styles.addOnPanel,
              borderColor: `${accentColour}66`,
              background: `radial-gradient(circle at top left, ${accentColour}22, transparent 34%), linear-gradient(135deg, #0f172a 0%, #1e293b 58%, #020617 100%)`,
            }}
          >
            <div className="addOnHeader" style={styles.addOnHeader}>
              <div>
                <div
                  style={{
                    ...styles.addOnEyebrow,
                    color: accentColour,
                    borderColor: `${accentColour}66`,
                    background: `${accentColour}14`,
                  }}
                >
                  Event-night fundraiser
                </div>

                <h2 className="addOnTitle" style={styles.addOnTitle}>
                  {addOn.title}
                </h2>

                <p style={styles.addOnDescription}>{addOn.description}</p>
              </div>

              <div
                style={{
                  ...styles.addOnPriceCard,
                  borderColor: `${accentColour}66`,
                  background: `${accentColour}14`,
                }}
              >
                <span style={styles.addOnPriceLabel}>Entry</span>
                <strong style={styles.addOnPriceValue}>
                  {addOn.entryPriceCents > 0
                    ? `${event.currency} ${moneyFromCents(
                        addOn.entryPriceCents,
                      )}`
                    : "On the night"}
                </strong>
                <span style={styles.addOnPriceHint}>
                  {addOn.collectAtCheckout && addOn.type === "heads_or_tails"
                    ? "Available during checkout"
                    : addOn.collectAtCheckout
                      ? "Checkout collection coming soon"
                      : "Collected by the organiser"}
                </span>
              </div>
            </div>

            <div className="addOnDetailsGrid" style={styles.addOnDetailsGrid}>
              <div style={styles.addOnDetailCard}>
                <span style={styles.addOnDetailLabel}>How it works</span>
                <strong style={styles.addOnDetailValue}>
                  {addOn.instructions}
                </strong>
              </div>

              <div style={styles.addOnDetailCard}>
                <span style={styles.addOnDetailLabel}>Prize</span>
                <strong style={styles.addOnDetailValue}>
                  {addOn.prizeTitle || "Prize to be announced"}
                </strong>
              </div>

              <div style={styles.addOnDetailCard}>
                <span style={styles.addOnDetailLabel}>Entries</span>
                <strong style={styles.addOnDetailValue}>
                  {addOn.maxEntriesPerBooking
                    ? `Up to ${addOn.maxEntriesPerBooking} per booking`
                    : "Entry details on the night"}
                </strong>
              </div>
            </div>

            <p style={styles.addOnFootnote}>{addOn.footnote}</p>
          </section>
        ))}

        <section id="book" style={styles.bookSection}>
          <div style={styles.bookHeader}>
            <div style={styles.bookHeaderText}>
              <h2 style={styles.bookTitle}>
                {event.event_type === "tables"
                  ? "Choose your table seats"
                  : event.event_type === "reserved_seating"
                    ? "Choose your seats"
                    : "Book tickets"}
              </h2>

              <p style={styles.bookText}>
                {event.event_type === "general_admission"
                  ? "Choose how many of each ticket type you would like."
                  : "Add your details, select tickets, then continue securely to checkout."}
              </p>
            </div>

            <div style={brandedCheckoutBadgeStyle}>Secure Stripe checkout</div>
          </div>

          {event.event_type === "general_admission" ? (
            <PublicGeneralAdmissionSelector
              eventId={event.id}
              ticketTypes={ticketTypes}
              currency={event.currency}
              platformFeePercent={platformFeePercent}
              checkoutAddOn={checkoutAddOn}
            />
          ) : event.event_type === "tables" ? (
            seats.length === 0 ? (
              <div style={styles.emptyLarge}>
                <strong>No table seats available yet</strong>

                <p style={styles.muted}>Tables may not have been released yet.</p>
              </div>
            ) : (
              <PublicTableSelector
                eventId={event.id}
                seats={tableSeatsWithNames}
                ticketTypes={ticketTypes}
                currency={event.currency}
                platformFeePercent={platformFeePercent}
                menuOptions={menuOptions}
                seatingLayoutJson={{
                  ...(event.seating_layout_json || {}),
                  tableShape,
                  table_shape: tableShape,
                }}
                checkoutAddOn={checkoutAddOn}
              />
            )
          ) : seats.length === 0 ? (
            <div style={styles.emptyLarge}>
              <strong>No seats available yet</strong>

              <p style={styles.muted}>Seats may not have been released yet.</p>
            </div>
          ) : (
            <PublicReservedSeatSelector
              eventId={event.id}
              eventType={event.event_type}
              seats={seats}
              ticketTypes={ticketTypes}
              currency={event.currency}
              platformFeePercent={platformFeePercent}
              menuOptions={menuOptions}
              initialSeatingLayout={event.seating_layout_json || {}}
              checkoutAddOn={checkoutAddOn}
            />
          )}
        </section>

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

function InfoRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <p style={styles.infoRow}>
      <strong>{label}:</strong> {value}
    </p>
  );
}

const responsiveStyles = `
.public-event-page,
.public-event-page * {
  box-sizing: border-box;
}

.public-event-page {
  overflow-x: hidden;
}

.public-event-page section,
.public-event-page div,
.public-event-page article,
.public-event-page form,
.public-event-page label {
  min-width: 0;
}

@media (max-width: 980px) {
  .public-event-page .brandHeader {
    grid-template-columns: 1fr !important;
  }

  .public-event-page .addOnHeader,
  .public-event-page .addOnDetailsGrid {
    grid-template-columns: 1fr !important;
  }
}

@media (max-width: 680px) {
  .public-event-page .brandHeader {
    padding: 12px !important;
    border-radius: 22px !important;
    margin: 10px 10px 12px !important;
  }

  .public-event-page .brandIdentity {
    grid-template-columns: 56px minmax(0, 1fr) !important;
  }

  .public-event-page .brandLogoWrap,
  .public-event-page .brandLogoFallback {
    width: 56px !important;
    height: 56px !important;
    border-radius: 16px !important;
  }

  .public-event-page .brandTitle {
    font-size: clamp(24px, 8vw, 36px) !important;
    letter-spacing: -0.06em !important;
  }

  .public-event-page .addOnPanel {
    padding: 16px !important;
    border-radius: 22px !important;
  }

  .public-event-page .addOnTitle {
    font-size: clamp(30px, 10vw, 42px) !important;
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

  heroBackgroundImage: {
    position: "absolute",
    inset: 0,
    width: "100%",
    height: "100%",
    display: "block",
  },

  heroOverlay: {
    position: "absolute",
    inset: 0,
  },

  heroInner: {
    position: "relative",
    zIndex: 2,
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
    background: "#dcfce7",
    color: "#166534",
    border: "1px solid #bbf7d0",
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

  contentGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 320px), 1fr))",
    gap: 18,
    marginBottom: 18,
    alignItems: "start",
  },

  card: {
    padding: 18,
    borderRadius: 22,
    background: "#ffffff",
    border: "1px solid rgba(13,27,61,0.10)",
    boxShadow: "0 12px 34px rgba(15,23,42,0.08)",
    minWidth: 0,
    overflow: "hidden",
  },

  infoRow: {
    margin: "0 0 8px",
    fontSize: 15,
    lineHeight: 1.45,
    overflowWrap: "anywhere",
  },

  detailDescription: {
    margin: "16px 0 0",
    color: "#475569",
    whiteSpace: "pre-line",
    fontSize: 15,
    lineHeight: 1.65,
    fontWeight: 600,
    overflowWrap: "anywhere",
  },

  ticketPanel: {
    padding: 18,
    borderRadius: 22,
    background: "linear-gradient(180deg, #0f172a 0%, #1e293b 100%)",
    color: "#ffffff",
    border: "1px solid rgba(251,191,36,0.24)",
    boxShadow: "0 12px 34px rgba(15,23,42,0.12)",
    minWidth: 0,
    overflow: "hidden",
  },

  ticketPanelTitle: {
    margin: "0 0 14px",
    color: "#fef3c7",
    fontSize: "clamp(21px, 6vw, 26px)",
    letterSpacing: "-0.03em",
  },

  stack: {
    display: "grid",
    gap: 10,
  },

  ticketItem: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
    padding: 14,
    borderRadius: 16,
    background: "rgba(255,255,255,0.10)",
    border: "1px solid rgba(255,255,255,0.14)",
    color: "#ffffff",
    flexWrap: "wrap",
    minWidth: 0,
  },

  ticketItemText: {
    minWidth: 0,
    flex: "1 1 190px",
    overflowWrap: "anywhere",
  },

  pricePill: {
    whiteSpace: "nowrap",
    borderRadius: 999,
    padding: "7px 11px",
    color: "#fef3c7",
    fontSize: 13,
    flexShrink: 0,
    border: "1px solid",
  },

  addOnPanel: {
    margin: "0 0 18px",
    padding: "clamp(18px, 4vw, 24px)",
    borderRadius: 28,
    border: "1px solid",
    color: "#ffffff",
    boxShadow: "0 18px 48px rgba(15,23,42,0.16)",
    overflow: "hidden",
  },

  addOnHeader: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) minmax(220px, 0.34fr)",
    gap: 16,
    alignItems: "stretch",
  },

  addOnEyebrow: {
    display: "inline-flex",
    width: "fit-content",
    padding: "7px 11px",
    borderRadius: 999,
    border: "1px solid",
    fontSize: 12,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    marginBottom: 12,
  },

  addOnTitle: {
    margin: 0,
    color: "#ffffff",
    fontSize: "clamp(34px, 7vw, 62px)",
    lineHeight: 0.96,
    letterSpacing: "-0.065em",
    fontWeight: 1000,
    overflowWrap: "anywhere",
  },

  addOnDescription: {
    margin: "12px 0 0",
    color: "#dbeafe",
    fontSize: "clamp(15px, 3vw, 18px)",
    lineHeight: 1.55,
    maxWidth: 760,
    overflowWrap: "anywhere",
  },

  addOnPriceCard: {
    display: "grid",
    alignContent: "center",
    gap: 6,
    padding: 16,
    borderRadius: 22,
    border: "1px solid",
    minWidth: 0,
  },

  addOnPriceLabel: {
    color: "#cbd5e1",
    fontSize: 11,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
  },

  addOnPriceValue: {
    color: "#ffffff",
    fontSize: 28,
    lineHeight: 1,
    letterSpacing: "-0.05em",
    overflowWrap: "anywhere",
  },

  addOnPriceHint: {
    color: "#dbeafe",
    fontSize: 13,
    lineHeight: 1.35,
    fontWeight: 800,
  },

  addOnDetailsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: 12,
    marginTop: 16,
  },

  addOnDetailCard: {
    display: "grid",
    gap: 7,
    padding: 15,
    borderRadius: 18,
    background: "rgba(255,255,255,0.10)",
    border: "1px solid rgba(255,255,255,0.14)",
    minWidth: 0,
  },

  addOnDetailLabel: {
    color: "#bfdbfe",
    fontSize: 11,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
  },

  addOnDetailValue: {
    color: "#ffffff",
    fontSize: 15,
    lineHeight: 1.45,
    overflowWrap: "anywhere",
    whiteSpace: "pre-line",
  },

  addOnFootnote: {
    margin: "15px 0 0",
    color: "#cbd5e1",
    fontSize: 13,
    lineHeight: 1.45,
    fontWeight: 800,
    overflowWrap: "anywhere",
  },

  muted: {
    color: "#64748b",
  },

  mutedLight: {
    margin: "5px 0 0",
    color: "rgba(255,255,255,0.72)",
    fontSize: 14,
    lineHeight: 1.45,
    overflowWrap: "anywhere",
  },

  emptyDark: {
    padding: 14,
    borderRadius: 14,
    background: "rgba(255,255,255,0.10)",
    border: "1px dashed rgba(255,255,255,0.24)",
    color: "#ffffff",
    fontWeight: 800,
    fontSize: 14,
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
  },

  bookSection: {
    padding: 16,
    borderRadius: 24,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    boxShadow: "0 12px 34px rgba(15,23,42,0.08)",
    minWidth: 0,
    overflow: "hidden",
  },

  bookHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-end",
    gap: 14,
    flexWrap: "wrap",
    marginBottom: 18,
  },

  bookHeaderText: {
    minWidth: 0,
    flex: "1 1 260px",
  },

  bookTitle: {
    margin: 0,
    color: "#0f172a",
    fontSize: "clamp(25px, 7vw, 34px)",
    lineHeight: 1.08,
    letterSpacing: "-0.045em",
    fontWeight: 950,
    overflowWrap: "anywhere",
  },

  bookText: {
    margin: "8px 0 0",
    color: "#64748b",
    fontSize: 15,
    lineHeight: 1.5,
    fontWeight: 700,
    overflowWrap: "anywhere",
  },

  checkoutBadge: {
    padding: "10px 14px",
    borderRadius: 999,
    color: "#ffffff",
    fontWeight: 900,
    fontSize: 13,
    maxWidth: "100%",
    boxSizing: "border-box",
  },

  emptyLarge: {
    padding: 22,
    borderRadius: 16,
    background: "#f8fafc",
    border: "1px dashed #cbd5e1",
    textAlign: "center",
    color: "#111827",
    fontSize: 18,
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
