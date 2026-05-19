import type { CSSProperties, ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTenantSlugFromHeaders } from "@/lib/tenant";
import {
  getPlatformFeePercent,
  getTenantFinanceSettings,
} from "@/lib/payments";
import { getEventBySlug } from "../../../../api/_lib/events-repo";
import PublicGeneralAdmissionSelector from "@/components/events/PublicGeneralAdmissionSelector";
import PublicReservedSeatSelector from "@/components/events/PublicReservedSeatSelector";
import PublicTableSelector from "@/components/events/PublicTableSelector";

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

const TABLE_SHAPE_KEY = "__table_shape";
const DEFAULT_EVENTS_IMAGE = "/brand/so-default-events.png";

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

  const finance = await getTenantFinanceSettings(event.tenant_slug);
  const platformFeePercent = getPlatformFeePercent(finance);

  const ticketTypes = (event.ticket_types || []).filter(
    (ticketType) => ticketType.is_active,
  );

  const seats = event.seats || [];
  const hasCustomImage = Boolean(event.image_url);

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

  const lowestTicketPrice =
    ticketTypes.length > 0
      ? Math.min(...ticketTypes.map((ticketType) => Number(ticketType.price || 0)))
      : 0;

  const availableSeats = seats.filter((seat) => seat.status === "available").length;

  return (
    <main style={styles.page}>
      <section style={styles.hero}>
        <img
          src={event.image_url || DEFAULT_EVENTS_IMAGE}
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

        <div style={styles.heroOverlay} />

        <div style={styles.heroInner}>
          <Link href={`/c/${tenantSlug}`} style={styles.backLink}>
            ← Back to campaigns
          </Link>

          <div style={styles.badgeRow}>
            <span style={styles.badge}>{eventTypeLabel(event.event_type)}</span>
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
            <span>Supporting the organiser</span>
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

        <section style={styles.noticeCard}>
          <div style={styles.noticeTextBlock}>
            <h2 style={styles.noticeTitle}>Open for bookings</h2>
            <p style={styles.noticeText}>
              Choose your tickets or seats below, then continue securely to
              checkout.
            </p>
          </div>

          <div style={styles.noticeChip}>
            <span>Starts</span>
            <strong>{formatDate(event.starts_at)}</strong>
          </div>
        </section>

        <div style={styles.contentGrid}>
          <Card>
            <h2 style={styles.noticeTitle}>Event details</h2>

            <InfoRow label="Event type" value={eventTypeLabel(event.event_type)} />

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

                    <strong style={styles.pricePill}>
                      {event.currency} {moneyFromCents(ticketType.price)}
                    </strong>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>

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

            <div style={styles.checkoutBadge}>Secure Stripe checkout</div>
          </div>

          {event.event_type === "general_admission" ? (
            <PublicGeneralAdmissionSelector
              eventId={event.id}
              ticketTypes={ticketTypes}
              currency={event.currency}
              platformFeePercent={platformFeePercent}
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
            />
          )}
        </section>
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

const styles: Record<string, CSSProperties> = {
  page: {
    width: "100%",
    background:
      "radial-gradient(circle at top left, rgba(251,191,36,0.18), transparent 34%), radial-gradient(circle at 80% 8%, rgba(22,131,248,0.1), transparent 28%), #f8fafc",
    minHeight: "100vh",
    paddingBottom: 48,
    overflowX: "hidden",
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
    background:
      "linear-gradient(180deg, rgba(15,23,42,0.14) 0%, rgba(15,23,42,0.52) 46%, rgba(15,23,42,0.94) 100%)",
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
    background: "rgba(251,191,36,0.16)",
    color: "#fef3c7",
    border: "1px solid rgba(251,191,36,0.32)",
    fontSize: 13,
    fontWeight: 950,
    backdropFilter: "blur(10px)",
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
    background: "#f8fafc",
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
    background: "rgba(251,191,36,0.16)",
    border: "1px solid rgba(251,191,36,0.32)",
    color: "#fef3c7",
    fontSize: 13,
    flexShrink: 0,
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
    background: "#0f172a",
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
};
