import type { CSSProperties, ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getTenantSlugFromHeaders } from "@/lib/tenant";
import { listEvents } from "../../../../api/_lib/events-repo";

const DEFAULT_EVENTS_IMAGE = "/brand/so-default-events.png";
const EVENTS_LOGO_IMAGE = "/brand/event-champagne-gold.png";

function formatDate(value: string | null | undefined) {
  if (!value) return "Not set";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "Not set";

  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function formatEventType(value: string | null | undefined) {
  return String(value || "general_admission")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function getStatusStyle(status: string | null | undefined): CSSProperties {
  const clean = String(status || "draft").toLowerCase();

  if (clean === "published") {
    return {
      background: "#ecfdf5",
      color: "#166534",
      borderColor: "#bbf7d0",
    };
  }

  if (clean === "closed") {
    return {
      background: "#fff7ed",
      color: "#9a3412",
      borderColor: "#fed7aa",
    };
  }

  if (clean === "drawn") {
    return {
      background: "#eff6ff",
      color: "#1d4ed8",
      borderColor: "#bfdbfe",
    };
  }

  return {
    background: "#f8fafc",
    color: "#475569",
    borderColor: "#e2e8f0",
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

  const totalEvents = events.length;

  const publishedCount = events.filter(
    (event) => event.status === "published",
  ).length;

  const draftCount = events.filter((event) => event.status !== "published")
    .length;

  const totalCapacity = events.reduce(
    (sum, event) => sum + Number(event.capacity || 0),
    0,
  );

  return (
    <main className="events-admin-page" style={styles.page}>
      <style>{responsiveStyles}</style>

      <section className="events-admin-header" style={styles.header}>
        <div style={styles.headerText}>
          <div style={styles.badge}>Admin dashboard</div>

          <h1 className="events-admin-title" style={styles.title}>
            Manage events
          </h1>

          <p className="events-admin-subtitle" style={styles.subtitle}>
            Tenant: <strong style={{ color: "#0f172a" }}>{tenantSlug}</strong>
          </p>
        </div>

        <div className="events-admin-nav" style={styles.nav}>
          <Link href="/admin" style={styles.navButton}>
            ← Dashboard
          </Link>

          <Link href="/admin/raffles" style={styles.navButton}>
            Raffles
          </Link>

          <Link href="/admin/squares" style={styles.navButton}>
            Squares
          </Link>

          <div style={styles.navButtonActive}>Events</div>

          <Link href="/admin/auctions" style={styles.navButton}>
            Auctions
          </Link>

          <Link
            href={`/c/${tenantSlug}?adminReturn=/admin/events`}
            style={styles.navButton}
          >
            Public site
          </Link>

          <Link href="/admin/events/new" style={styles.createButton}>
            + Create event
          </Link>
        </div>
      </section>

      <section className="events-stats-grid" style={styles.statsGrid}>
        <StatCard
          label="Total events"
          value={totalEvents}
          image={EVENTS_LOGO_IMAGE}
          accent="#1683f8"
          tint="#eff6ff"
        />

        <StatCard
          label="Published"
          value={publishedCount}
          icon="✓"
          accent="#16a34a"
          tint="#ecfdf5"
        />

        <StatCard
          label="Combined capacity"
          value={totalCapacity}
          icon="↗"
          accent="#7c3aed"
          tint="#f5f3ff"
        />

        <StatCard
          label="Draft / private"
          value={draftCount}
          icon="•"
          accent="#64748b"
          tint="#f8fafc"
        />
      </section>

      {events.length === 0 ? (
        <section style={styles.emptyCard}>
          <h2 style={{ margin: 0, color: "#0f172a" }}>No events yet</h2>

          <p style={styles.muted}>Create your first fundraising event.</p>

          <Link href="/admin/events/new" style={styles.createButton}>
            + Create event
          </Link>
        </section>
      ) : (
        <section style={styles.list}>
          {events.map((event) => {
            const hasCustomImage = Boolean(event.image_url);
            const capacity = Number(event.capacity || 0);
            const statusStyle = getStatusStyle(event.status);

            return (
              <article key={event.id} className="events-card" style={styles.card}>
                <div className="events-card-top" style={styles.cardTop}>
                  <div className="events-image-wrap" style={styles.imageWrap}>
                    <img
                      src={event.image_url || DEFAULT_EVENTS_IMAGE}
                      alt={event.title || "Event"}
                      style={{
                        ...styles.image,
                        objectFit: hasCustomImage ? "cover" : "contain",
                        padding: hasCustomImage ? 0 : 10,
                        background: hasCustomImage
                          ? "#f1f5f9"
                          : "linear-gradient(135deg, #ffffff 0%, #f8fafc 55%, #eff6ff 100%)",
                        boxSizing: "border-box",
                      }}
                    />
                  </div>

                  <div style={styles.cardMain}>
                    <div className="events-card-header" style={styles.cardHeader}>
                      <div style={{ minWidth: 0 }}>
                        <h2 className="events-card-title" style={styles.cardTitle}>
                          {event.title || "Untitled event"}
                        </h2>

                        <p style={styles.slug}>/e/{event.slug}</p>
                      </div>

                      <div style={{ ...styles.status, ...statusStyle }}>
                        {event.status}
                      </div>
                    </div>

                    <div className="events-headline-grid" style={styles.headlineGrid}>
                      <div style={styles.headlineBox}>
                        <div style={styles.headlineLabel}>Starts</div>
                        <div style={styles.headlineValue}>
                          {formatDate(event.starts_at)}
                        </div>
                      </div>

                      <div style={styles.headlineBox}>
                        <div style={styles.headlineLabel}>Capacity</div>
                        <div style={styles.headlineValue}>{capacity}</div>
                      </div>
                    </div>

                    {event.description ? (
                      <p style={styles.description}>
                        {event.description.length > 130
                          ? `${event.description.slice(0, 130)}…`
                          : event.description}
                      </p>
                    ) : null}

                    <div className="events-detail-grid" style={styles.detailGrid}>
                      <InfoBlock
                        label="Starts"
                        value={formatDate(event.starts_at)}
                      />

                      <InfoBlock
                        label="Ends"
                        value={formatDate(event.ends_at)}
                      />

                      <InfoBlock label="Capacity" value={capacity} />

                      <InfoBlock
                        label="Currency"
                        value={event.currency || "GBP"}
                      />

                      <InfoBlock
                        label="Type"
                        value={formatEventType(event.event_type)}
                      />
                    </div>

                    <div className="events-card-actions" style={styles.actions}>
                      <Link
                        href={`/admin/events/${event.id}`}
                        style={styles.primaryLink}
                      >
                        Open details
                      </Link>

                      <Link
                        href={`/e/${event.slug}?adminReturn=/admin/events/${event.id}`}
                        target="_blank"
                        style={styles.secondaryLink}
                      >
                        View campaign
                      </Link>
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

function StatCard({
  label,
  value,
  icon,
  image,
  accent,
  tint,
}: {
  label: string;
  value: ReactNode;
  icon?: string;
  image?: string;
  accent: string;
  tint: string;
}) {
  return (
    <div
      className="events-stat-card"
      style={{
        ...styles.statCard,
        borderTopColor: accent,
      }}
    >
      <div style={styles.statTop}>
        <div style={{ minWidth: 0 }}>
          <div style={styles.statLabel}>{label}</div>
          <div className="events-stat-value" style={styles.statValue}>
            {value}
          </div>
        </div>

        <div
          style={{
            ...styles.statIcon,
            background: tint,
            color: accent,
            borderColor: accent,
            padding: image ? 4 : 0,
            overflow: "hidden",
          }}
        >
          {image ? (
            <img
              src={image}
              alt={label}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "contain",
                display: "block",
              }}
            />
          ) : (
            icon
          )}
        </div>
      </div>
    </div>
  );
}

function InfoBlock({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div style={styles.detail}>
      <div style={styles.detailLabel}>{label}</div>
      <div style={styles.detailValue}>{value}</div>
    </div>
  );
}

const responsiveStyles = `
  .events-admin-page,
  .events-admin-page * {
    box-sizing: border-box;
  }

  .events-admin-page {
    overflow-x: hidden;
  }

  @media (max-width: 980px) {
    .events-admin-header {
      display: grid !important;
      grid-template-columns: 1fr !important;
      gap: 18px !important;
    }

    .events-admin-nav {
      justify-content: flex-start !important;
      flex-wrap: wrap !important;
      width: 100% !important;
    }

    .events-card-top {
      grid-template-columns: 160px minmax(0, 1fr) !important;
    }
  }

  @media (max-width: 640px) {
    .events-admin-page {
      width: 100% !important;
      max-width: 100% !important;
      padding: 22px 12px 46px !important;
    }

    .events-admin-title {
      font-size: clamp(42px, 13vw, 58px) !important;
      line-height: 0.98 !important;
      letter-spacing: -0.065em !important;
      white-space: normal !important;
      overflow-wrap: anywhere !important;
    }

    .events-admin-subtitle {
      font-size: 17px !important;
      overflow-wrap: anywhere !important;
    }

    .events-admin-nav {
      display: grid !important;
      grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
      gap: 10px !important;
    }

    .events-admin-nav a,
    .events-admin-nav div {
      width: 100% !important;
      min-height: 50px !important;
      padding: 12px 14px !important;
      text-align: center !important;
      font-size: 15px !important;
      white-space: normal !important;
    }

    .events-admin-nav a:first-child {
      grid-column: 1 / -1 !important;
    }

    .events-admin-nav a:last-child {
      grid-column: 1 / -1 !important;
    }

    .events-stats-grid {
      grid-template-columns: 1fr !important;
      gap: 12px !important;
    }

    .events-stat-card {
      min-height: 112px !important;
      border-radius: 24px !important;
      padding: 18px !important;
    }

    .events-stat-value {
      font-size: clamp(36px, 12vw, 52px) !important;
      line-height: 1 !important;
      overflow-wrap: anywhere !important;
    }

    .events-card {
      padding: 16px !important;
      border-radius: 26px !important;
    }

    .events-card-top {
      display: grid !important;
      grid-template-columns: 1fr !important;
      gap: 16px !important;
    }

    .events-image-wrap {
      width: 100% !important;
      height: auto !important;
      aspect-ratio: 16 / 9 !important;
      border-radius: 22px !important;
    }

    .events-card-header {
      display: grid !important;
      grid-template-columns: 1fr !important;
      gap: 10px !important;
    }

    .events-card-title {
      font-size: clamp(30px, 10vw, 42px) !important;
      line-height: 1.05 !important;
      letter-spacing: -0.055em !important;
    }

    .events-headline-grid,
    .events-detail-grid {
      grid-template-columns: 1fr !important;
    }

    .events-card-actions {
      display: grid !important;
      grid-template-columns: 1fr !important;
      gap: 10px !important;
    }

    .events-card-actions a {
      width: 100% !important;
      min-height: 50px !important;
      font-size: 16px !important;
    }
  }

  @media (max-width: 380px) {
    .events-admin-page {
      padding-left: 10px !important;
      padding-right: 10px !important;
    }

    .events-admin-title {
      font-size: 40px !important;
    }

    .events-admin-nav {
      grid-template-columns: 1fr !important;
    }

    .events-admin-nav a,
    .events-admin-nav div {
      grid-column: auto !important;
    }

    .events-stat-value {
      font-size: 36px !important;
    }
  }
`;

const styles: Record<string, CSSProperties> = {
  page: {
    width: "100%",
    maxWidth: 1180,
    margin: "0 auto",
    padding: "32px 16px 56px",
    background: "#f8fafc",
    minHeight: "100vh",
    overflowX: "hidden",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 22,
    gap: 16,
    flexWrap: "nowrap",
  },
  headerText: {
    flex: "0 1 auto",
    minWidth: 0,
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
    whiteSpace: "nowrap",
  },
  subtitle: {
    margin: "10px 0 0",
    color: "#64748b",
    fontSize: 15,
  },
  nav: {
    display: "flex",
    gap: 8,
    flexWrap: "nowrap",
    justifyContent: "flex-end",
    alignItems: "flex-start",
    minWidth: 0,
  },
  navButton: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "13px 13px",
    borderRadius: 9999,
    background: "#ffffff",
    color: "#0f172a",
    border: "1px solid #cbd5e1",
    textDecoration: "none",
    fontWeight: 800,
    whiteSpace: "nowrap",
  },
  navButtonActive: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "13px 13px",
    borderRadius: 9999,
    background: "#0f172a",
    color: "#ffffff",
    fontWeight: 900,
    whiteSpace: "nowrap",
  },
  createButton: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "13px 14px",
    borderRadius: 9999,
    background: "#1683f8",
    color: "#ffffff",
    textDecoration: "none",
    fontWeight: 800,
    boxShadow: "0 10px 20px rgba(22,131,248,0.22)",
    whiteSpace: "nowrap",
  },
  statsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    gap: 12,
    marginBottom: 22,
  },
  statCard: {
    padding: 16,
    borderRadius: 18,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    borderTop: "4px solid #1683f8",
    boxShadow: "0 2px 12px rgba(15,23,42,0.04)",
    minWidth: 0,
  },
  statTop: {
    display: "flex",
    justifyContent: "space-between",
    gap: 14,
    alignItems: "flex-start",
  },
  statIcon: {
    width: 46,
    height: 46,
    borderRadius: 999,
    border: "1px solid",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 21,
    fontWeight: 900,
    flexShrink: 0,
  },
  statLabel: {
    color: "#64748b",
    fontSize: 13,
    fontWeight: 800,
  },
  statValue: {
    color: "#0f172a",
    fontSize: 28,
    fontWeight: 900,
    marginTop: 4,
    letterSpacing: "-0.03em",
  },
  emptyCard: {
    padding: 28,
    border: "1px solid #e2e8f0",
    borderRadius: 22,
    background: "#ffffff",
    boxShadow: "0 2px 12px rgba(15,23,42,0.04)",
  },
  muted: {
    color: "#64748b",
    margin: "8px 0 18px",
  },
  list: {
    display: "grid",
    gap: 16,
  },
  card: {
    border: "1px solid #e2e8f0",
    borderRadius: 22,
    padding: 18,
    background: "#ffffff",
    boxShadow: "0 2px 12px rgba(15,23,42,0.04)",
    minWidth: 0,
  },
  cardTop: {
    display: "grid",
    gridTemplateColumns: "104px minmax(0, 1fr)",
    gap: 16,
    alignItems: "start",
  },
  imageWrap: {
    width: 104,
    height: 104,
    borderRadius: 20,
    overflow: "hidden",
    background: "#f1f5f9",
    border: "1px solid #e2e8f0",
    boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.7)",
  },
  image: {
    width: "100%",
    height: "100%",
    display: "block",
    objectPosition: "center center",
  },
  cardMain: {
    minWidth: 0,
  },
  cardHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "flex-start",
    flexWrap: "wrap",
  },
  cardTitle: {
    margin: 0,
    fontSize: 22,
    color: "#0f172a",
    letterSpacing: "-0.02em",
    wordBreak: "break-word",
  },
  slug: {
    margin: "6px 0 0",
    color: "#64748b",
    fontSize: 14,
    wordBreak: "break-word",
  },
  status: {
    padding: "7px 11px",
    borderRadius: 9999,
    border: "1px solid",
    fontSize: 13,
    textTransform: "capitalize",
    fontWeight: 800,
    width: "fit-content",
  },
  headlineGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
    gap: 10,
    marginTop: 14,
  },
  headlineBox: {
    padding: "13px 14px",
    borderRadius: 16,
    background: "linear-gradient(135deg, #f8fafc 0%, #ffffff 100%)",
    border: "1px solid #e2e8f0",
    minWidth: 0,
  },
  headlineLabel: {
    fontSize: 12,
    color: "#64748b",
    fontWeight: 800,
  },
  headlineValue: {
    marginTop: 4,
    color: "#0f172a",
    fontSize: 19,
    fontWeight: 950,
    letterSpacing: "-0.03em",
    overflowWrap: "anywhere",
  },
  description: {
    color: "#475569",
    fontSize: 14,
    lineHeight: 1.5,
    margin: "10px 0 0",
  },
  detailGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
    gap: 10,
    marginTop: 16,
  },
  detail: {
    padding: 12,
    borderRadius: 14,
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    minWidth: 0,
  },
  detailLabel: {
    fontSize: 12,
    color: "#64748b",
    fontWeight: 800,
  },
  detailValue: {
    marginTop: 4,
    color: "#0f172a",
    fontWeight: 900,
    wordBreak: "break-word",
  },
  actions: {
    display: "flex",
    gap: 10,
    marginTop: 18,
    flexWrap: "wrap",
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
  secondaryLink: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "10px 14px",
    borderRadius: 999,
    background: "#f8fafc",
    color: "#334155",
    border: "1px solid #dbe3ef",
    textDecoration: "none",
    fontWeight: 800,
    fontSize: 14,
    boxShadow: "none",
  },
};
