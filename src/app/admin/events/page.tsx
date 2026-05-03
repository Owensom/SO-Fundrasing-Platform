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

function getStatusStyle(status: string): CSSProperties {
  const clean = status.toLowerCase();

  if (clean === "published") {
    return {
      background: "#ecfdf5",
      borderColor: "#bbf7d0",
      color: "#166534",
    };
  }

  if (clean === "closed") {
    return {
      background: "#fff7ed",
      borderColor: "#fed7aa",
      color: "#9a3412",
    };
  }

  return {
    background: "#f8fafc",
    borderColor: "#e2e8f0",
    color: "#475569",
  };
}

function getTypeIcon(type: string) {
  if (type === "reserved_seating") return "🎭";
  if (type === "tables") return "🍽️";
  return "🎫";
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
  const sessionTenantSlugs = Array.isArray(session.user.tenantSlugs)
    ? session.user.tenantSlugs.map((value) => String(value))
    : [];

  if (!tenantSlug || !sessionTenantSlugs.includes(tenantSlug)) {
    redirect("/admin/login?error=tenant_access_denied");
  }

  const events = await listEvents(tenantSlug);

  const totalEvents = events.length;
  const publishedCount = events.filter((event) => event.status === "published")
    .length;
  const draftCount = events.filter((event) => event.status === "draft").length;
  const closedCount = events.filter((event) => event.status === "closed").length;

  return (
    <main style={styles.page}>
      <section style={styles.header}>
        <div>
          <div style={styles.badge}>Admin dashboard</div>

          <h1 style={styles.title}>Manage events</h1>

          <p style={styles.subtitle}>
            Tenant: <strong style={{ color: "#0f172a" }}>{tenantSlug}</strong>
          </p>
        </div>

        <div style={styles.navRow}>
          <Link href="/admin" style={styles.topSecondaryLink}>
            ← Dashboard
          </Link>

          <Link href="/admin/raffles" style={styles.topSecondaryLink}>
            Raffles
          </Link>

          <Link href="/admin/squares" style={styles.topSecondaryLink}>
            Squares
          </Link>

          <div style={styles.activeNav}>Events</div>

          <Link
            href={`/c/${tenantSlug}?adminReturn=/admin/events`}
            style={styles.secondaryLink}
          >
            Public campaigns page
          </Link>

          <a href="#create-event" style={styles.createLink}>
            + Create event
          </a>
        </div>
      </section>
            <section style={styles.statsRow}>
        <StatCard label="Total events" value={totalEvents} />
        <StatCard label="Published" value={publishedCount} />
        <StatCard label="Draft" value={draftCount} />
        <StatCard label="Closed" value={closedCount} />
      </section>

      <section style={styles.layout}>
        {/* CREATE EVENT (same functionality, restyled) */}
        <div id="create-event" style={styles.panel}>
          <div style={styles.sectionHeader}>
            <p style={styles.sectionEyebrow}>Create</p>
            <h2 style={styles.sectionTitle}>New event</h2>
            <p style={styles.sectionText}>
              Create your event first, then manage tickets, seats or tables.
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
                rows={4}
                placeholder="Describe the event..."
                style={styles.textarea}
              />
            </label>

            <label style={styles.label}>
              Location
              <input
                name="location"
                placeholder="Venue, hall, cinema..."
                style={styles.input}
              />
            </label>

            <div style={styles.twoCol}>
              <label style={styles.label}>
                Start date/time
                <input
                  name="starts_at"
                  type="datetime-local"
                  style={styles.input}
                />
              </label>

              <label style={styles.label}>
                Currency
                <select
                  name="currency"
                  defaultValue="GBP"
                  style={styles.input}
                >
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
                <option value="general_admission">
                  General admission tickets
                </option>
                <option value="reserved_seating">
                  Seat numbers and rows
                </option>
                <option value="tables">
                  Tables with seat numbers
                </option>
              </select>
            </label>

            <button type="submit" style={styles.primaryButton}>
              Create event
            </button>
          </form>
        </div>

        {/* EVENTS LIST (converted to raffle-style cards) */}
        <div style={styles.listPanel}>
          {events.length === 0 ? (
            <section style={styles.emptyCard}>
              <h2 style={{ margin: 0 }}>No events yet</h2>
              <p style={styles.muted}>
                Create your first event to get started.
              </p>
            </section>
          ) : (
            <section style={{ display: "grid", gap: 16 }}>
              {events.map((event) => {
                const statusStyle = getStatusStyle(event.status);

                return (
                  <article key={event.id} style={styles.card}>
                    <div style={styles.cardGrid}>
                      {/* IMAGE / ICON */}
                      <div style={styles.imageWrap}>
                        {event.image_url ? (
                          <img
                            src={event.image_url}
                            alt={event.title}
                            style={styles.image}
                          />
                        ) : (
                          <div style={styles.imageEmpty}>
                            {getTypeIcon(event.event_type)}
                          </div>
                        )}
                      </div>

                      {/* CONTENT */}
                      <div style={{ minWidth: 0 }}>
                        <div style={styles.cardTop}>
                          <div>
                            <h2 style={styles.cardTitle}>{event.title}</h2>

                            <p style={styles.slug}>
                              /e/{event.slug}
                            </p>
                          </div>

                          <div style={{ ...styles.statusPill, ...statusStyle }}>
                            {statusLabel(event.status)}
                          </div>
                        </div>

                        <div style={styles.infoGrid}>
                          <InfoBlock
                            label="Type"
                            value={eventTypeLabel(event.event_type)}
                          />
                          <InfoBlock
                            label="Date"
                            value={formatDate(event.starts_at)}
                          />
                          <InfoBlock
                            label="Location"
                            value={event.location || "Not set"}
                          />
                          <InfoBlock
                            label="Currency"
                            value={event.currency}
                          />
                        </div>

                        <div style={styles.actionsRow}>
                          <Link
                            href={`/admin/events/${event.id}`}
                            style={styles.primaryLink}
                          >
                            Manage
                          </Link>

                          <Link
                            href={`/e/${event.slug}?adminReturn=/admin/events/${event.id}`}
                            target="_blank"
                            style={styles.secondaryLink}
                          >
                            View campaign page
                          </Link>

                          <form action={deleteEventAction}>
                            <input type="hidden" name="id" value={event.id} />
                            <button type="submit" style={styles.deleteButton}>
                              Delete
                            </button>
                          </form>
                        </div>
                      </div>
                    </div>
                  </article>
                );
              })}
            </section>
          )}
        </div>
      </section>
    </main>
  );
}
function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div style={styles.statCard}>
      <div style={styles.statLabel}>{label}</div>
      <div style={styles.statValue}>{value}</div>
    </div>
  );
}

function InfoBlock({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div style={styles.infoBlock}>
      <div style={styles.infoLabel}>{label}</div>
      <div style={styles.infoValue}>{value}</div>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  page: {
    minHeight: "100vh",
    background: "#f8fafc",
    padding: "32px 16px 56px",
  },

  header: {
    maxWidth: 1180,
    margin: "0 auto 24px",
  },

  badge: {
    display: "inline-flex",
    padding: "6px 10px",
    borderRadius: 999,
    background: "#e0f2fe",
    color: "#0369a1",
    fontSize: 13,
    fontWeight: 800,
    marginBottom: 10,
  },

  title: {
    margin: 0,
    fontSize: 34,
    lineHeight: 1.1,
    letterSpacing: "-0.04em",
    color: "#0f172a",
  },

  subtitle: {
    margin: "10px 0 0",
    color: "#64748b",
    fontSize: 15,
  },

  navRow: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
    marginTop: 16,
  },

  createLink: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "13px 18px",
    borderRadius: 9999,
    background: "#1683f8",
    color: "#fff",
    textDecoration: "none",
    fontWeight: 800,
  },

  topSecondaryLink: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "13px 18px",
    borderRadius: 9999,
    background: "#ffffff",
    color: "#0f172a",
    border: "1px solid #cbd5e1",
    textDecoration: "none",
    fontWeight: 800,
  },

  activeNav: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "13px 18px",
    borderRadius: 9999,
    background: "#0f172a",
    color: "#ffffff",
    fontWeight: 900,
  },

  secondaryLink: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "10px 14px",
    borderRadius: 999,
    background: "#ffffff",
    color: "#0f172a",
    border: "1px solid #cbd5e1",
    textDecoration: "none",
    fontWeight: 800,
    fontSize: 14,
  },

  primaryLink: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "10px 14px",
    borderRadius: 999,
    background: "#0f172a",
    color: "#ffffff",
    textDecoration: "none",
    fontWeight: 800,
    fontSize: 14,
  },

  deleteButton: {
    padding: "10px 14px",
    borderRadius: 999,
    border: "1px solid #fecaca",
    background: "#fff",
    color: "#b91c1c",
    fontWeight: 800,
    cursor: "pointer",
  },

  statsRow: {
    maxWidth: 1180,
    margin: "0 auto 22px",
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    gap: 12,
  },

  statCard: {
    padding: 16,
    borderRadius: 18,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
  },

  statLabel: {
    color: "#64748b",
    fontSize: 13,
    fontWeight: 800,
  },

  statValue: {
    fontSize: 28,
    fontWeight: 900,
    marginTop: 4,
  },

  layout: {
    maxWidth: 1180,
    margin: "0 auto",
    display: "grid",
    gridTemplateColumns: "minmax(0, 0.9fr) minmax(0, 1.1fr)",
    gap: 16,
  },

  panel: {
    padding: 20,
    borderRadius: 18,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
  },

  listPanel: {
    display: "grid",
    gap: 16,
  },

  sectionHeader: {
    marginBottom: 16,
  },

  sectionEyebrow: {
    margin: "0 0 6px",
    color: "#2563eb",
    fontWeight: 900,
    fontSize: 12,
    textTransform: "uppercase",
  },

  sectionTitle: {
    margin: 0,
    fontSize: 24,
    fontWeight: 950,
  },

  sectionText: {
    margin: "8px 0 0",
    color: "#64748b",
    fontSize: 14,
  },

  errorBox: {
    marginBottom: 16,
    padding: 12,
    borderRadius: 14,
    background: "#fef2f2",
    border: "1px solid #fecaca",
    color: "#991b1b",
    fontWeight: 800,
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
  },

  input: {
    minHeight: 44,
    padding: "10px 12px",
    borderRadius: 14,
    border: "1px solid #cbd5e1",
  },

  textarea: {
    padding: "10px 12px",
    borderRadius: 14,
    border: "1px solid #cbd5e1",
  },

  twoCol: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 12,
  },

  primaryButton: {
    padding: "13px 16px",
    borderRadius: 16,
    background: "#111827",
    color: "#fff",
    fontWeight: 900,
    cursor: "pointer",
  },

  emptyCard: {
    padding: 24,
    borderRadius: 22,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
  },

  muted: {
    color: "#64748b",
  },

  card: {
    border: "1px solid #e2e8f0",
    borderRadius: 22,
    padding: 18,
    background: "#fff",
  },

  cardGrid: {
    display: "grid",
    gridTemplateColumns: "96px 1fr",
    gap: 16,
  },

  imageWrap: {
    width: 96,
    height: 96,
    borderRadius: 18,
    overflow: "hidden",
    background: "#f1f5f9",
  },

  image: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
  },

  imageEmpty: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    height: "100%",
    fontSize: 28,
  },

  cardTop: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
  },

  cardTitle: {
    margin: 0,
    fontSize: 22,
    fontWeight: 900,
  },

  slug: {
    margin: "6px 0 0",
    color: "#64748b",
    fontSize: 14,
  },

  statusPill: {
    padding: "6px 10px",
    borderRadius: 999,
    border: "1px solid",
    fontWeight: 800,
    fontSize: 13,
  },

  infoGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
    gap: 10,
    marginTop: 16,
  },

  infoBlock: {
    padding: 12,
    borderRadius: 14,
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
  },

  infoLabel: {
    fontSize: 12,
    color: "#64748b",
    fontWeight: 800,
  },

  infoValue: {
    marginTop: 4,
    fontWeight: 900,
  },

  actionsRow: {
    display: "flex",
    gap: 10,
    marginTop: 18,
    flexWrap: "wrap",
  },
};
