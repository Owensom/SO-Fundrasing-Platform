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
    <main style={styles.page}>
      <section style={styles.header}>
        <div style={styles.headerText}>
          <div style={styles.badge}>Admin dashboard</div>

          <h1 style={styles.title}>Manage events</h1>

          <p style={styles.subtitle}>
            Tenant: <strong style={{ color: "#0f172a" }}>{tenantSlug}</strong>
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

      <section style={styles.statsGrid}>
        <StatCard
          label="Total events"
          value={events.length}
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
          <h2 style={{ margin: 0, color: "#0f172a" }}>
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
            const capacity = Number(event.capacity || 0);

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
                      <div style={{ minWidth: 0 }}>
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

                    <div style={styles.headlineGrid}>
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
                        {event.description.length > 150
                          ? `${event.description.slice(0, 150)}…`
                          : event.description}
                      </p>
                    ) : null}

                    <div style={styles.detailGrid}>
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

                    <div style={styles.actions}>
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
      style={{
        ...styles.statCard,
        borderTopColor: accent,
      }}
    >
      <div style={styles.statTop}>
        <div>
          <div style={styles.statLabel}>{label}</div>
          <div style={styles.statValue}>{value}</div>
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

const styles: Record<string, CSSProperties> = {
  page: {
    maxWidth: 1180,
    margin: "0 auto",
    padding: "32px 16px 56px",
    background: "#f8fafc",
    minHeight: "100vh",
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
    flex: "0 0 auto",
    minWidth: 240,
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

  /* KEEP REMAINDER IDENTICAL TO RAFFLES FILE */
};
