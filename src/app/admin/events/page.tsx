import type { CSSProperties } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getTenantSlugFromHeaders } from "@/lib/tenant";
import { deleteEvent, listEvents } from "../../../../api/_lib/events-repo";

function moneyFromCents(cents: number | null | undefined) {
  return `£${(Number(cents || 0) / 100).toFixed(2)}`;
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

function eventTypeLabel(type: string) {
  if (type === "reserved_seating") return "Reserved seating";
  if (type === "tables") return "Tables";
  return "General admission";
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

function getEventIcon(type: string) {
  if (type === "reserved_seating") return "🎭";
  if (type === "tables") return "🍽️";
  return "🎫";
}

async function deleteEventAction(formData: FormData) {
  "use server";

  const session = await auth();
  if (!session?.user) redirect("/admin/login");

  const id = String(formData.get("id") || "").trim();
  if (id) await deleteEvent(id);

  redirect("/admin/events");
}

export default async function AdminEventsPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/admin/login");
  }

  const tenantSlug = await getTenantSlugFromHeaders();
  const sessionTenantSlugs = Array.isArray(session.user.tenantSlugs)
    ? session.user.tenantSlugs.map((v) => String(v))
    : [];

  if (!tenantSlug || !sessionTenantSlugs.includes(tenantSlug)) {
    redirect("/admin/login?error=tenant_access_denied");
  }

  const events = await listEvents(tenantSlug);

  const published = events.filter((event) => event.status === "published").length;
  const draft = events.filter((event) => event.status === "draft").length;
  const closed = events.filter((event) => event.status === "closed").length;

  return (
    <main style={styles.page}>
      <section style={styles.header}>
        <div>
          <div style={styles.badge}>Admin dashboard</div>

          <h1 style={styles.title}>Manage events</h1>

          <p style={styles.subtitle}>
            Tenant: <strong>{tenantSlug}</strong>
          </p>
        </div>

        <div style={styles.nav}>
          <Link href="/admin" style={styles.navButton}>
            ← Dashboard
          </Link>

          <Link href="/admin/raffles" style={styles.navButton}>
            Raffles
          </Link>

          <Link href="/admin/squares" style={styles.navButton}>
            Squares
          </Link>

          <Link href="/admin/events" style={styles.navButtonActive}>
            Events
          </Link>

          <Link href={`/c/${tenantSlug}`} target="_blank" style={styles.navButton}>
            Public campaigns page
          </Link>

          <Link href="/admin/events/new" style={styles.createButton}>
            + Create event
          </Link>
        </div>
      </section>

      <section style={styles.statsGrid}>
        <StatCard label="Total events" value={events.length} />
        <StatCard label="Published" value={published} />
        <StatCard label="Draft" value={draft} />
        <StatCard label="Closed" value={closed} />
      </section>

      {events.length === 0 ? (
        <section style={styles.emptyCard}>
          <h2 style={{ margin: 0 }}>No events yet</h2>
          <p style={styles.muted}>Create your first event.</p>

          <Link href="/admin/events/new" style={styles.createButton}>
            + Create event
          </Link>
        </section>
      ) : (
        <section style={styles.list}>
          {events.map((event) => (
            <article key={event.id} style={styles.card}>
              <div style={styles.cardTop}>
                <div style={styles.imageWrap}>
                  {event.image_url ? (
                    <img
                      src={event.image_url}
                      alt={event.title}
                      style={styles.image}
                    />
                  ) : (
                    <div style={styles.imageEmpty}>
                      {getEventIcon(event.event_type)}
                    </div>
                  )}
                </div>

                <div style={styles.cardMain}>
                  <div style={styles.cardHeader}>
                    <div>
                      <h2 style={styles.cardTitle}>
                        {event.title || "Untitled event"}
                      </h2>

                      <p style={styles.slug}>/e/{event.slug}</p>
                    </div>

                    <span
                      style={{
                        ...styles.status,
                        ...getStatusStyle(event.status),
                      }}
                    >
                      {event.status}
                    </span>
                  </div>

                  <div style={styles.detailGrid}>
                    <Detail label="Type" value={eventTypeLabel(event.event_type)} />
                    <Detail label="Date" value={formatDate(event.starts_at)} />
                    <Detail label="Location" value={event.location || "Not set"} />
                    <Detail label="Currency" value={event.currency || "GBP"} />
                    <Detail label="Starting from" value={moneyFromCents(0)} />
                  </div>

                  <div style={styles.actions}>
                    <Link
                      href={`/admin/events/${event.id}`}
                      style={styles.openButton}
                    >
                      Manage
                    </Link>

                    <a
                      href={`/e/${event.slug}`}
                      target="_blank"
                      rel="noreferrer"
                      style={styles.viewButton}
                    >
                      View campaign page
                    </a>

                    <form action={deleteEventAction} style={styles.deleteForm}>
                      <input type="hidden" name="id" value={event.id} />
                      <button type="submit" style={styles.deleteButton}>
                        Delete
                      </button>
                    </form>
                  </div>
                </div>
              </div>
            </article>
          ))}
        </section>
      )}
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
    background: "#e0f2fe",
    color: "#0369a1",
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
  navButtonActive: {
    padding: "12px 18px",
    borderRadius: 999,
    background: "#0f172a",
    color: "#ffffff",
    border: "1px solid #0f172a",
    textDecoration: "none",
    fontWeight: 900,
  },
  createButton: {
    display: "inline-flex",
    padding: "12px 18px",
    borderRadius: 999,
    background: "#1683f8",
    color: "#ffffff",
    textDecoration: "none",
    fontWeight: 900,
    boxShadow: "0 10px 20px rgba(22,131,248,0.22)",
  },
  statsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
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
    fontSize: 28,
    fontWeight: 950,
    color: "#0f172a",
  },
  list: {
    display: "grid",
    gap: 16,
  },
  card: {
    padding: 18,
    borderRadius: 22,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    boxShadow: "0 2px 12px rgba(15,23,42,0.04)",
  },
  cardTop: {
    display: "grid",
    gridTemplateColumns: "110px 1fr",
    gap: 18,
  },
  imageWrap: {
    width: 110,
    height: 110,
    borderRadius: 18,
    overflow: "hidden",
    background: "#f1f5f9",
    border: "1px solid #e2e8f0",
  },
  image: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
    display: "block",
  },
  imageEmpty: {
    width: "100%",
    height: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 32,
    color: "#94a3b8",
  },
  cardMain: {
    minWidth: 0,
  },
  cardHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "flex-start",
  },
  cardTitle: {
    margin: 0,
    fontSize: 24,
    lineHeight: 1.15,
    color: "#0f172a",
  },
  slug: {
    margin: "4px 0 0",
    color: "#64748b",
    fontWeight: 700,
  },
  status: {
    display: "inline-flex",
    padding: "8px 12px",
    borderRadius: 999,
    fontSize: 13,
    fontWeight: 900,
    textTransform: "capitalize",
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
  actions: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
    marginTop: 16,
  },
  openButton: {
    padding: "12px 16px",
    borderRadius: 999,
    background: "#0f172a",
    color: "#ffffff",
    textDecoration: "none",
    fontWeight: 900,
  },
  viewButton: {
    padding: "12px 16px",
    borderRadius: 999,
    background: "#ffffff",
    color: "#0f172a",
    border: "1px solid #cbd5e1",
    textDecoration: "none",
    fontWeight: 900,
  },
  deleteForm: {
    margin: 0,
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
  emptyCard: {
    padding: 24,
    borderRadius: 22,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
  },
  muted: {
    color: "#64748b",
  },
};
