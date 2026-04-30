import type { CSSProperties } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getTenantSlugFromHeaders } from "@/lib/tenant";
import {
  createEvent,
  deleteEvent,
  listEvents,
  slugifyEventTitle,
  type EventType,
} from "../../../../api/_lib/events-repo";

function moneyFromCents(cents: number | null | undefined) {
  return (Number(cents || 0) / 100).toFixed(2);
}

function formatDate(value: string | null) {
  if (!value) return "No date set";

  try {
    return new Intl.DateTimeFormat("en-GB", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value));
  } catch {
    return "Invalid date";
  }
}

function eventTypeLabel(type: string) {
  if (type === "reserved_seating") return "Reserved seating";
  if (type === "tables") return "Tables";
  return "General admission";
}

function statusLabel(status: string) {
  if (status === "published") return "Published";
  if (status === "closed") return "Closed";
  return "Draft";
}

async function createEventAction(formData: FormData) {
  "use server";

  const session = await auth();
  if (!session?.user) redirect("/admin/login");

  const tenantSlug = await getTenantSlugFromHeaders();

  const title = String(formData.get("title") || "").trim();
  const description = String(formData.get("description") || "").trim();
  const location = String(formData.get("location") || "").trim();
  const startsAt = String(formData.get("starts_at") || "").trim();
  const currency = String(formData.get("currency") || "GBP").trim() || "GBP";
  const eventType = String(
    formData.get("event_type") || "general_admission",
  ) as EventType;

  if (!title) redirect("/admin/events?error=missing-title");

  const slug = `${slugifyEventTitle(title)}-${Date.now().toString().slice(-5)}`;

  const event = await createEvent({
    tenantSlug,
    slug,
    title,
    description: description || null,
    location: location || null,
    startsAt: startsAt ? new Date(startsAt).toISOString() : null,
    currency,
    eventType,
    status: "draft",
  });

  redirect(`/admin/events/${event.id}`);
}

async function deleteEventAction(formData: FormData) {
  "use server";

  const session = await auth();
  if (!session?.user) redirect("/admin/login");

  const id = String(formData.get("id") || "").trim();
  if (id) await deleteEvent(id);

  redirect("/admin/events");
}

export default async function AdminEventsPage({
  searchParams,
}: {
  searchParams?: { error?: string };
}) {
  const session = await auth();
  if (!session?.user) redirect("/admin/login");

  const tenantSlug = await getTenantSlugFromHeaders();
  const events = await listEvents(tenantSlug);

  return (
    <main style={styles.page}>
      <section style={styles.hero}>
        <div>
          <p style={styles.eyebrow}>Admin</p>
          <h1 style={styles.title}>Events & Tickets</h1>
          <p style={styles.heroText}>
            Create admission tickets, reserved seating events, lectures,
            cinema-style rows, theatre seating, or table-based fundraisers.
          </p>
        </div>

        <Link href="/admin" style={styles.backButton}>
          Back to admin
        </Link>
      </section>

      <section style={styles.layout}>
        <div style={styles.panel}>
          <div style={styles.sectionHeader}>
            <p style={styles.sectionEyebrow}>Step 1</p>
            <h2 style={styles.sectionTitle}>Create event</h2>
            <p style={styles.sectionText}>
              Start with the event shell. Ticket prices, seat rows and tables
              are managed after creation.
            </p>
          </div>

          {searchParams?.error === "missing-title" && (
            <div style={styles.errorBox}>Please enter an event title.</div>
          )}

          <form action={createEventAction} style={styles.form}>
            <label style={styles.label}>
              Event title
              <input
                name="title"
                required
                placeholder="Charity dinner, theatre night, lecture..."
                style={styles.input}
              />
            </label>

            <label style={styles.label}>
              Description
              <textarea
                name="description"
                rows={5}
                placeholder="Describe the event..."
                style={styles.textarea}
              />
            </label>

            <label style={styles.label}>
              Location
              <input
                name="location"
                placeholder="Venue, hall, cinema, school..."
                style={styles.input}
              />
            </label>

            <div style={styles.twoCol}>
              <label style={styles.label}>
                Start date/time
                <input name="starts_at" type="datetime-local" style={styles.input} />
              </label>

              <label style={styles.label}>
                Currency
                <select name="currency" defaultValue="GBP" style={styles.input}>
                  <option value="GBP">GBP</option>
                  <option value="EUR">EUR</option>
                  <option value="USD">USD</option>
                </select>
              </label>
            </div>

            <label style={styles.label}>
              Event type
              <select
                name="event_type"
                defaultValue="general_admission"
                style={styles.input}
              >
                <option value="general_admission">General admission tickets</option>
                <option value="reserved_seating">Seat numbers and rows</option>
                <option value="tables">Tables with seat numbers</option>
              </select>
            </label>

            <button type="submit" style={styles.primaryButton}>
              Create event
            </button>
          </form>
        </div>

        <div style={styles.panel}>
          <div style={styles.sectionHeaderRow}>
            <div>
              <p style={styles.sectionEyebrow}>Step 2</p>
              <h2 style={styles.sectionTitle}>Your events</h2>
              <p style={styles.sectionText}>
                Manage event setup, ticket prices, seats and public status.
              </p>
            </div>
            <span style={styles.countBadge}>{events.length}</span>
          </div>

          <div style={styles.eventList}>
            {events.length === 0 ? (
              <div style={styles.emptyState}>
                <h3 style={styles.emptyTitle}>No events yet</h3>
                <p style={styles.emptyText}>
                  Create your first admission, seating or table event.
                </p>
              </div>
            ) : (
              events.map((event) => (
                <article key={event.id} style={styles.eventCard}>
                  <div style={styles.eventTop}>
                    <div>
                      <div style={styles.badgeRow}>
                        <span style={styles.goldBadge}>
                          {eventTypeLabel(event.event_type)}
                        </span>
                        <span style={styles.darkBadge}>
                          {statusLabel(event.status)}
                        </span>
                      </div>

                      <h3 style={styles.eventTitle}>{event.title}</h3>
                      <p style={styles.eventMeta}>{formatDate(event.starts_at)}</p>

                      {event.location && (
                        <p style={styles.eventMeta}>{event.location}</p>
                      )}

                      <p style={styles.slugText}>Public slug: /e/{event.slug}</p>
                    </div>

                    <div style={styles.actions}>
                      <Link href={`/admin/events/${event.id}`} style={styles.manageButton}>
                        Manage
                      </Link>

                      <form action={deleteEventAction}>
                        <input type="hidden" name="id" value={event.id} />
                        <button type="submit" style={styles.deleteButton}>
                          Delete
                        </button>
                      </form>
                    </div>
                  </div>

                  <div style={styles.statsGrid}>
                    <div style={styles.statBox}>
                      <p style={styles.statLabel}>Currency</p>
                      <p style={styles.statValue}>{event.currency}</p>
                    </div>

                    <div style={styles.statBox}>
                      <p style={styles.statLabel}>Created</p>
                      <p style={styles.statValueSmall}>{formatDate(event.created_at)}</p>
                    </div>

                    <div style={styles.statBox}>
                      <p style={styles.statLabel}>Starting from</p>
                      <p style={styles.statValue}>£{moneyFromCents(0)}</p>
                    </div>
                  </div>
                </article>
              ))
            )}
          </div>
        </div>
      </section>
    </main>
  );
}

const styles: Record<string, CSSProperties> = {
  page: {
    minHeight: "100vh",
    background: "#f8fafc",
    padding: 16,
    color: "#0f172a",
  },
  hero: {
    maxWidth: 1100,
    margin: "24px auto 16px",
    padding: 24,
    borderRadius: 18,
    background: "#ffffff",
    border: "1px solid #e5e7eb",
    boxShadow: "0 2px 14px rgba(15,23,42,0.08)",
    display: "flex",
    justifyContent: "space-between",
    gap: 16,
    alignItems: "flex-start",
  },
  eyebrow: {
    margin: "0 0 8px",
    color: "#2563eb",
    fontWeight: 900,
    fontSize: 13,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
  },
  title: {
    margin: 0,
    fontSize: "clamp(30px, 6vw, 44px)",
    fontWeight: 950,
    lineHeight: 1.05,
    color: "#0f172a",
  },
  heroText: {
    margin: "12px 0 0",
    color: "#475569",
    fontSize: 15,
    lineHeight: 1.5,
    maxWidth: 740,
  },
  backButton: {
    padding: "10px 14px",
    borderRadius: 999,
    border: "1px solid #111827",
    background: "#111827",
    color: "#fff",
    fontWeight: 800,
    textDecoration: "none",
    whiteSpace: "nowrap",
  },
  layout: {
    maxWidth: 1100,
    margin: "0 auto 16px",
    display: "grid",
    gridTemplateColumns: "minmax(0, 0.9fr) minmax(0, 1.1fr)",
    gap: 16,
  },
  panel: {
    padding: 20,
    borderRadius: 18,
    background: "#ffffff",
    border: "1px solid #e5e7eb",
    boxShadow: "0 2px 14px rgba(15,23,42,0.08)",
  },
  sectionHeader: {
    marginBottom: 16,
  },
  sectionHeaderRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: 16,
    alignItems: "flex-start",
    marginBottom: 16,
  },
  sectionEyebrow: {
    margin: "0 0 6px",
    color: "#2563eb",
    fontWeight: 900,
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
  },
  sectionTitle: {
    margin: 0,
    fontSize: 24,
    fontWeight: 950,
    color: "#0f172a",
  },
  sectionText: {
    margin: "8px 0 0",
    color: "#64748b",
    fontSize: 14,
    lineHeight: 1.5,
  },
  errorBox: {
    marginBottom: 16,
    padding: 12,
    borderRadius: 14,
    background: "#fef2f2",
    border: "1px solid #fecaca",
    color: "#991b1b",
    fontWeight: 800,
    fontSize: 14,
  },
  form: {
    display: "grid",
    gap: 14,
  },
  label: {
    display: "grid",
    gap: 6,
    fontSize: 14,
    fontWeight: 850,
    color: "#334155",
  },
  input: {
    width: "100%",
    minHeight: 44,
    padding: "10px 12px",
    borderRadius: 14,
    border: "1px solid #cbd5e1",
    background: "#f8fafc",
    color: "#0f172a",
    fontSize: 14,
    outline: "none",
    boxSizing: "border-box",
  },
  textarea: {
    width: "100%",
    padding: "10px 12px",
    borderRadius: 14,
    border: "1px solid #cbd5e1",
    background: "#f8fafc",
    color: "#0f172a",
    fontSize: 14,
    outline: "none",
    resize: "vertical",
    boxSizing: "border-box",
  },
  twoCol: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 12,
  },
  primaryButton: {
    width: "100%",
    padding: "13px 16px",
    borderRadius: 16,
    border: "1px solid #111827",
    background: "#111827",
    color: "#ffffff",
    fontWeight: 950,
    fontSize: 14,
    cursor: "pointer",
  },
  countBadge: {
    minWidth: 34,
    height: 34,
    borderRadius: 999,
    background: "#eef2ff",
    color: "#1d4ed8",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 950,
  },
  eventList: {
    display: "grid",
    gap: 14,
  },
  emptyState: {
    padding: 28,
    borderRadius: 18,
    border: "1px dashed #cbd5e1",
    background: "#f8fafc",
    textAlign: "center",
  },
  emptyTitle: {
    margin: 0,
    fontSize: 18,
    fontWeight: 950,
  },
  emptyText: {
    margin: "8px 0 0",
    color: "#64748b",
    fontSize: 14,
  },
  eventCard: {
    padding: 18,
    borderRadius: 18,
    border: "1px solid #e2e8f0",
    background: "#f8fafc",
  },
  eventTop: {
    display: "flex",
    justifyContent: "space-between",
    gap: 16,
    alignItems: "flex-start",
  },
  badgeRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: 8,
  },
  goldBadge: {
    borderRadius: 999,
    background: "#facc15",
    color: "#111827",
    padding: "5px 9px",
    fontSize: 11,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.05em",
  },
  darkBadge: {
    borderRadius: 999,
    background: "#e2e8f0",
    color: "#334155",
    padding: "5px 9px",
    fontSize: 11,
    fontWeight: 900,
    textTransform: "uppercase",
    letterSpacing: "0.05em",
  },
  eventTitle: {
    margin: "12px 0 0",
    fontSize: 22,
    fontWeight: 950,
    color: "#0f172a",
  },
  eventMeta: {
    margin: "6px 0 0",
    color: "#475569",
    fontSize: 14,
  },
  slugText: {
    margin: "8px 0 0",
    color: "#94a3b8",
    fontSize: 12,
  },
  actions: {
    display: "grid",
    gap: 8,
    minWidth: 110,
  },
  manageButton: {
    padding: "10px 12px",
    borderRadius: 14,
    background: "#111827",
    color: "#ffffff",
    fontWeight: 900,
    textDecoration: "none",
    textAlign: "center",
    fontSize: 14,
  },
  deleteButton: {
    width: "100%",
    padding: "10px 12px",
    borderRadius: 14,
    background: "#fff",
    border: "1px solid #fecaca",
    color: "#b91c1c",
    fontWeight: 900,
    cursor: "pointer",
    fontSize: 14,
  },
  statsGrid: {
    marginTop: 14,
    paddingTop: 14,
    borderTop: "1px solid #e2e8f0",
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: 10,
  },
  statBox: {
    padding: 12,
    borderRadius: 14,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
  },
  statLabel: {
    margin: 0,
    color: "#64748b",
    fontSize: 11,
    fontWeight: 900,
    textTransform: "uppercase",
    letterSpacing: "0.06em",
  },
  statValue: {
    margin: "6px 0 0",
    fontSize: 18,
    fontWeight: 950,
    color: "#0f172a",
  },
  statValueSmall: {
    margin: "6px 0 0",
    fontSize: 13,
    fontWeight: 900,
    color: "#0f172a",
  },
};
