import type { CSSProperties, ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Cinzel, Poppins } from "next/font/google";
import { getTenantSlugFromHeaders } from "@/lib/tenant";
import { getEventBySlug } from "../../../../api/_lib/events-repo";
import PublicGeneralAdmissionSelector from "@/components/events/PublicGeneralAdmissionSelector";
import PublicReservedSeatSelector from "@/components/events/PublicReservedSeatSelector";
import PublicTableSelector from "@/components/events/PublicTableSelector";

export const dynamic = "force-dynamic";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
});

const cinzel = Cinzel({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
});

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
  if (!value) return "Date to be confirmed";

  try {
    return new Intl.DateTimeFormat("en-GB", {
      dateStyle: "full",
      timeStyle: "short",
    }).format(new Date(value));
  } catch {
    return "Date to be confirmed";
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
    <main className={poppins.className} style={styles.page}>
      <div style={styles.wrap}>
        <div style={styles.topBar}>
          <Link href={`/c/${tenantSlug}`} style={styles.backLink}>
            ← Back to campaigns
          </Link>

          <div style={styles.topLinks}>
            <Link href={`/c/${tenantSlug}/terms`} style={styles.smallLink}>
              Terms
            </Link>
            <Link href={`/c/${tenantSlug}/privacy`} style={styles.smallLink}>
              Privacy
            </Link>
          </div>
        </div>

        <Card>
          <section style={styles.heroShell}>
            <img
              src={event.image_url || DEFAULT_EVENTS_IMAGE}
              alt={event.title || "SO Events"}
              style={{
                ...styles.heroImage,
                objectFit: hasCustomImage ? "cover" : "contain",
                objectPosition: hasCustomImage
                  ? `${event.image_focus_x ?? 50}% ${event.image_focus_y ?? 50}%`
                  : "center",
                padding: hasCustomImage ? 0 : 64,
                opacity: hasCustomImage ? 0.58 : 0.22,
              }}
            />

            <div style={styles.heroShade} />

            <div style={styles.heroContent}>
              <div style={styles.heroPills}>
                <span style={styles.goldPill}>{eventTypeLabel(event.event_type)}</span>
                {lowestTicketPrice > 0 && (
                  <span style={styles.lightPill}>
                    From {event.currency} {moneyFromCents(lowestTicketPrice)}
                  </span>
                )}
              </div>

              <h1 style={styles.title}>{event.title}</h1>

              <div className={cinzel.className} style={styles.heroTagline}>
                Book. Attend. Make an impact.
              </div>

              <div style={styles.heroStats}>
                <HeroStat label="Date" value={formatDate(event.starts_at)} />
                <HeroStat
                  label="Location"
                  value={event.location || "Location to be confirmed"}
                />
                {event.event_type !== "general_admission" && (
                  <HeroStat label="Available" value={availableSeats} />
                )}
              </div>
            </div>
          </section>

          <div style={styles.contentGrid}>
            <section style={styles.infoBox}>
              <h2 className={cinzel.className} style={styles.sectionKicker}>
                Event details
              </h2>

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
                <p style={styles.description}>{event.description}</p>
              )}
            </section>

            <section style={styles.ticketPanel}>
              <h2 className={cinzel.className} style={styles.panelTitle}>
                Tickets
              </h2>

              <div style={styles.stack}>
                {ticketTypes.length === 0 ? (
                  <div style={styles.emptyBox}>
                    Ticket options have not been added yet.
                  </div>
                ) : (
                  ticketTypes.map((ticketType) => (
                    <div key={ticketType.id} style={styles.listItem}>
                      <div>
                        <strong>{ticketType.name}</strong>
                        {ticketType.description && (
                          <p style={styles.mutedLight}>{ticketType.description}</p>
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

          {resolvedSearchParams.checkout === "success" && (
            <div style={styles.successBox}>
              <strong>Payment successful.</strong>
              <br />
              Thank you. Your booking has been received.
            </div>
          )}

          {resolvedSearchParams.checkout === "cancelled" && (
            <div style={styles.cancelBox}>
              <strong>Checkout cancelled.</strong>
              <br />
              Your order was not completed. You can choose again below.
            </div>
          )}

          <section id="book" style={styles.bookSection}>
            <div style={styles.bookHeader}>
              <div>
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
                menuOptions={menuOptions}
                initialSeatingLayout={event.seating_layout_json || {}}
              />
            )}
          </section>
        </Card>
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

function HeroStat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div style={styles.heroStat}>
      <span style={styles.heroStatLabel}>{label}</span>
      <strong style={styles.heroStatValue}>{value}</strong>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  page: {
    minHeight: "100vh",
    background: "linear-gradient(180deg, #f8fafc 0%, #ffffff 100%)",
    color: "#111827",
    padding: 24,
  },
  wrap: {
    maxWidth: 1160,
    margin: "0 auto",
  },
  topBar: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    flexWrap: "wrap",
    marginBottom: 16,
  },
  topLinks: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
  },
  backLink: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "10px 14px",
    borderRadius: 999,
    background: "#ffffff",
    border: "1px solid rgba(13,27,61,0.12)",
    color: "#0d1b3d",
    textDecoration: "none",
    fontWeight: 800,
    boxShadow: "0 8px 22px rgba(15,23,42,0.08)",
  },
  smallLink: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "10px 14px",
    borderRadius: 999,
    background: "#ffffff",
    border: "1px solid rgba(13,27,61,0.12)",
    color: "#334155",
    textDecoration: "none",
    fontWeight: 800,
  },
  card: {
    padding: 18,
    borderRadius: 30,
    background: "#ffffff",
    border: "1px solid rgba(13,27,61,0.10)",
    boxShadow: "0 24px 70px rgba(15,23,42,0.12)",
    overflow: "hidden",
  },
  heroShell: {
    position: "relative",
    minHeight: 440,
    borderRadius: 24,
    overflow: "hidden",
    background: "#0d1b3d",
    boxShadow: "0 20px 55px rgba(13,27,61,0.24)",
  },
  heroImage: {
    position: "absolute",
    inset: 0,
    width: "100%",
    height: "100%",
    display: "block",
    background: "#0d1b3d",
    boxSizing: "border-box",
  },
  heroShade: {
    position: "absolute",
    inset: 0,
    background:
      "linear-gradient(90deg, rgba(13,27,61,0.96) 0%, rgba(13,27,61,0.78) 52%, rgba(13,27,61,0.56) 100%), linear-gradient(180deg, rgba(13,27,61,0.10) 0%, rgba(13,27,61,0.88) 100%)",
  },
  heroContent: {
    position: "relative",
    zIndex: 2,
    minHeight: 440,
    padding: "42px 38px",
    display: "flex",
    flexDirection: "column",
    justifyContent: "flex-end",
    maxWidth: 880,
  },
  heroPills: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
    marginBottom: 16,
  },
  goldPill: {
    display: "inline-flex",
    alignItems: "center",
    borderRadius: 999,
    padding: "8px 12px",
    background: "rgba(200,162,74,0.18)",
    border: "1px solid rgba(200,162,74,0.55)",
    color: "#f7d98a",
    fontWeight: 800,
    fontSize: 13,
  },
  lightPill: {
    display: "inline-flex",
    alignItems: "center",
    borderRadius: 999,
    padding: "8px 12px",
    background: "rgba(255,255,255,0.12)",
    border: "1px solid rgba(255,255,255,0.24)",
    color: "#ffffff",
    fontWeight: 800,
    fontSize: 13,
  },
  title: {
    margin: 0,
    fontSize: "clamp(42px, 6vw, 76px)",
    lineHeight: 0.96,
    letterSpacing: "-0.055em",
    fontWeight: 900,
    color: "#ffffff",
    textTransform: "none",
    textShadow: "0 14px 32px rgba(0,0,0,0.35)",
    maxWidth: 820,
  },
  heroTagline: {
    marginTop: 16,
    color: "#f7d98a",
    letterSpacing: "0.24em",
    textTransform: "uppercase",
    fontSize: "clamp(12px, 1.5vw, 17px)",
    fontWeight: 800,
  },
  heroStats: {
    marginTop: 26,
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
    gap: 12,
    maxWidth: 820,
  },
  heroStat: {
    padding: 14,
    borderRadius: 16,
    background: "rgba(255,255,255,0.12)",
    border: "1px solid rgba(255,255,255,0.22)",
    backdropFilter: "blur(12px)",
  },
  heroStatLabel: {
    display: "block",
    marginBottom: 6,
    color: "rgba(255,255,255,0.66)",
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    fontWeight: 900,
    fontSize: 11,
  },
  heroStatValue: {
    display: "block",
    color: "#ffffff",
    fontSize: 14,
    lineHeight: 1.35,
  },
  contentGrid: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1.15fr) minmax(320px, 0.85fr)",
    gap: 18,
    marginTop: 18,
  },
  infoBox: {
    padding: 22,
    borderRadius: 22,
    background: "linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)",
    border: "1px solid #e2e8f0",
  },
  sectionKicker: {
    margin: "0 0 14px",
    color: "#0d1b3d",
    letterSpacing: "0.16em",
    textTransform: "uppercase",
    fontSize: 18,
    fontWeight: 900,
  },
  infoRow: {
    margin: "0 0 8px",
    fontSize: 16,
    lineHeight: 1.45,
  },
  description: {
    margin: "16px 0 0",
    color: "#475569",
    whiteSpace: "pre-line",
    fontSize: 15,
    lineHeight: 1.7,
    fontWeight: 600,
  },
  ticketPanel: {
    padding: 22,
    borderRadius: 22,
    background: "linear-gradient(180deg, #0d1b3d 0%, #132957 100%)",
    border: "1px solid rgba(200,162,74,0.42)",
  },
  panelTitle: {
    margin: "0 0 14px",
    color: "#f7d98a",
    letterSpacing: "0.14em",
    textTransform: "uppercase",
    fontSize: 18,
    fontWeight: 900,
  },
  stack: {
    display: "grid",
    gap: 10,
  },
  listItem: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
    padding: 14,
    borderRadius: 16,
    background: "rgba(255,255,255,0.10)",
    border: "1px solid rgba(255,255,255,0.14)",
    color: "#ffffff",
  },
  pricePill: {
    whiteSpace: "nowrap",
    borderRadius: 999,
    padding: "7px 11px",
    background: "rgba(200,162,74,0.18)",
    border: "1px solid rgba(200,162,74,0.42)",
    color: "#f7d98a",
    fontSize: 13,
  },
  muted: {
    margin: "5px 0 0",
    color: "#64748b",
    fontSize: 14,
    lineHeight: 1.45,
  },
  mutedLight: {
    margin: "5px 0 0",
    color: "rgba(255,255,255,0.72)",
    fontSize: 14,
    lineHeight: 1.45,
  },
  emptyBox: {
    padding: 14,
    borderRadius: 14,
    background: "rgba(255,255,255,0.10)",
    border: "1px dashed rgba(255,255,255,0.24)",
    color: "#ffffff",
    fontWeight: 800,
    fontSize: 14,
  },
  successBox: {
    padding: 16,
    borderRadius: 18,
    background: "#ecfdf5",
    border: "1px solid #a7f3d0",
    color: "#065f46",
    marginTop: 18,
    marginBottom: 18,
    lineHeight: 1.5,
  },
  cancelBox: {
    padding: 16,
    borderRadius: 18,
    background: "#fffbeb",
    border: "1px solid #fde68a",
    color: "#92400e",
    marginTop: 18,
    marginBottom: 18,
    lineHeight: 1.5,
  },
  bookSection: {
    marginTop: 18,
    padding: 22,
    borderRadius: 24,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    boxShadow: "0 8px 28px rgba(15,23,42,0.08)",
  },
  bookHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-end",
    gap: 14,
    flexWrap: "wrap",
    marginBottom: 18,
  },
  bookTitle: {
    margin: 0,
    color: "#0d1b3d",
    fontSize: 34,
    lineHeight: 1.08,
    letterSpacing: "-0.045em",
    fontWeight: 900,
  },
  bookText: {
    margin: "8px 0 0",
    color: "#64748b",
    fontSize: 15,
    lineHeight: 1.5,
    fontWeight: 700,
  },
  checkoutBadge: {
    padding: "10px 14px",
    borderRadius: 999,
    background: "#0d1b3d",
    color: "#ffffff",
    fontWeight: 900,
    fontSize: 13,
    border: "1px solid rgba(200,162,74,0.45)",
  },
  emptyLarge: {
    padding: 26,
    borderRadius: 16,
    background: "#f8fafc",
    border: "1px dashed #cbd5e1",
    textAlign: "center",
    color: "#111827",
    fontSize: 18,
  },
};
