import type { CSSProperties, ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTenantSlugFromHeaders } from "@/lib/tenant";
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

export default async function EventSlugPage({ params, searchParams }: PageProps) {
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
          {event.image_url ? (
            <img src={event.image_url} alt={event.title} style={styles.heroImage} />
          ) : (
            <div style={styles.heroFallback}>🎫</div>
          )}

          <h1 style={styles.title}>{event.title}</h1>

          <div style={styles.infoBox}>
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

          <section style={styles.orangePanel}>
            <h2 style={styles.panelTitle}>Tickets</h2>

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
                        <p style={styles.muted}>{ticketType.description}</p>
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
                  seats={seats}
                  ticketTypes={ticketTypes}
                  currency={event.currency}
                  menuOptions={menuOptions}
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

const styles: Record<string, CSSProperties> = {
  page: {
    minHeight: "100vh",
    background: "#ffffff",
    color: "#111827",
    padding: 24,
  },
  wrap: {
    maxWidth: 1040,
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
    border: "1px solid #e5e7eb",
    color: "#111827",
    textDecoration: "none",
    fontWeight: 900,
    boxShadow: "0 1px 4px rgba(15,23,42,0.08)",
  },
  smallLink: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "10px 14px",
    borderRadius: 999,
    background: "#ffffff",
    border: "1px solid #e5e7eb",
    color: "#334155",
    textDecoration: "none",
    fontWeight: 800,
  },
  card: {
    padding: 18,
    borderRadius: 22,
    background: "#ffffff",
    border: "1px solid #e5e7eb",
    boxShadow: "0 8px 28px rgba(15,23,42,0.08)",
  },
  heroImage: {
    width: "100%",
    height: 340,
    objectFit: "cover",
    borderRadius: 18,
    display: "block",
  },
  heroFallback: {
    width: "100%",
    height: 300,
    borderRadius: 18,
    background: "linear-gradient(135deg, #fed7aa, #fdba74, #fb7185)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 64,
  },
  title: {
    margin: "22px 0 14px",
    fontSize: 42,
    lineHeight: 1.05,
    letterSpacing: "-0.04em",
    fontWeight: 950,
    color: "#111827",
  },
  infoBox: {
    padding: 18,
    borderRadius: 16,
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    marginBottom: 14,
  },
  infoRow: {
    margin: "0 0 8px",
    fontSize: 16,
    lineHeight: 1.45,
  },
  description: {
    margin: "14px 0 0",
    color: "#475569",
    whiteSpace: "pre-line",
    fontSize: 15,
    lineHeight: 1.6,
    fontWeight: 600,
  },
  successBox: {
    padding: 14,
    borderRadius: 14,
    background: "#ecfdf5",
    border: "1px solid #a7f3d0",
    color: "#065f46",
    marginBottom: 16,
    lineHeight: 1.5,
  },
  cancelBox: {
    padding: 14,
    borderRadius: 14,
    background: "#fffbeb",
    border: "1px solid #fde68a",
    color: "#92400e",
    marginBottom: 16,
    lineHeight: 1.5,
  },
  orangePanel: {
    padding: 16,
    borderRadius: 16,
    background: "#fff7ed",
    border: "1px solid #fed7aa",
    marginBottom: 18,
  },
  panelTitle: {
    margin: "0 0 12px",
    color: "#9a3412",
    fontSize: 22,
    fontWeight: 950,
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
    padding: 13,
    borderRadius: 13,
    background: "#ffffff",
    border: "1px solid #fed7aa",
    color: "#111827",
  },
  pricePill: {
    whiteSpace: "nowrap",
    borderRadius: 999,
    padding: "6px 10px",
    background: "#ffedd5",
    color: "#9a3412",
    fontSize: 13,
  },
  muted: {
    margin: "5px 0 0",
    color: "#64748b",
    fontSize: 14,
    lineHeight: 1.45,
  },
  emptyBox: {
    padding: 14,
    borderRadius: 13,
    background: "#ffffff",
    border: "1px dashed #fdba74",
    color: "#64748b",
    fontWeight: 800,
    fontSize: 14,
  },
  bookSection: {
    padding: 18,
    borderRadius: 20,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    boxShadow: "0 2px 12px rgba(15,23,42,0.05)",
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
    color: "#111827",
    fontSize: 34,
    lineHeight: 1.1,
    letterSpacing: "-0.03em",
    fontWeight: 950,
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
    background: "#111827",
    color: "#ffffff",
    fontWeight: 950,
    fontSize: 13,
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
