import type { CSSProperties, ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getTenantSlugFromHeaders } from "@/lib/tenant";
import { listEvents } from "../../../../api/_lib/events-repo";

const DEFAULT_EVENTS_IMAGE = "/brand/so-default-events.png";

function formatMoney(
  cents: number | null | undefined,
  currency: string | null | undefined,
) {
  return `${(Number(cents || 0) / 100).toFixed(2)} ${currency || "GBP"}`;
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

export default async function AdminEventsPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/admin/login");
  }

  const tenantSlug = await getTenantSlugFromHeaders();

  const sessionTenantSlugs = Array.isArray(session.user.tenantSlugs)
    ? session.user.tenantSlugs.map((value) => String(value))
    : [];

  if (!tenantSlug || !sessionTenantSlugs.includes(tenantSlug)) {
    redirect("/admin/login?error=tenant_access_denied");
  }

  const events = await listEvents(tenantSlug);

  const publishedCount = events.filter(
    (event) => event.status === "published",
  ).length;

  const totalCapacity = events.reduce(
    (sum, event) => sum + Number(event.capacity || 0),
    0,
  );

  return (
    <main style={styles.page}>
      <section style={styles.header}>
        <div>
          <div style={styles.badge}>Admin dashboard</div>

          <h1 className="so-brand-heading" style={styles.title}>
            Manage events
          </h1>

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

          <Link href="/admin/auctions" style={styles.navButton}>
            Auctions
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
        <StatCard label="Published" value={publishedCount} />
        <StatCard label="Combined capacity" value={totalCapacity} />
      </section>

      {events.length === 0 ? (
        <section style={styles.emptyCard}>
          <h2 className="so-brand-card-title" style={{ margin: 0 }}>
            No events yet
          </h2>

          <p style={styles.muted}>Create your first fundraising event.</p>

          <Link href="/admin/events/new" style={styles.createButton}>
            + Create event
          </Link>
        </section>
      ) : (
        <section style={styles.list}>
          {events.map((event) => {
            const hasCustomImage = Boolean(event.image_url);

            return (
              <article key={event.id} style={styles.card}>
                <div style={styles.cardTop}>
                  <div style={styles.imageWrap}>
                    <img
                      src={event.image_url || DEFAULT_EVENTS_IMAGE}
                      alt={event.title || "SO Events"}
                      style={{
                        ...styles.image,
                        objectFit: hasCustomImage ? "cover" : "contain",
                        padding: hasCustomImage ? 0 : 12,
                        background: hasCustomImage
                          ? "#f1f5f9"
                          : "linear-gradient(135deg, #ffffff 0%, #f8fafc 55%, #eff6ff 100%)",
                        boxSizing: "border-box",
                      }}
                    />
                  </div>

                  <div style={styles.cardMain}>
                    <div style={styles.cardHeader}>
                      <div>
                        <h2 className="so-brand-card-title" style={styles.cardTitle}>
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

                    {event.description ? (
                      <p style={styles.description}>
                        {event.description.length > 150
                          ? `${event.description.slice(0, 150)}…`
                          : event.description}
                      </p>
                    ) : null}

                    <div style={styles.detailGrid}>
                      <Detail label="Starts" value={formatDate(event.starts_at)} />

                      <Detail label="Ends" value={formatDate(event.ends_at)} />

                      <Detail label="Capacity" value={event.capacity || 0} />

                      <Detail label="Currency" value={event.currency || "GBP"} />

                      <Detail label="Type" value={event.event_type || "general"} />
                    </div>

                    <div style={styles.actions}>
                      <Link
                        href={`/admin/events/${event.id}`}
                        style={styles.openButton}
                      >
                        Open details
                      </Link>

                      <a
                        href={`/e/${event.slug}`}
                        target="_blank"
                        rel="noreferrer"
                        style={styles.viewButton}
                      >
                        View campaign page
                      </a>
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </section>
      )}
    </main>
  );
}

function StatCard({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div style={styles.statCard}>
      <div style={styles.statLabel}>{label}</div>
      <div style={styles.statValue}>{value}</div>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: ReactNode }) {
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
    display: "block",
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
  description: {
    marginTop: 12,
    color: "#475569",
    lineHeight: 1.6,
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
    marginTop: 18,
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
