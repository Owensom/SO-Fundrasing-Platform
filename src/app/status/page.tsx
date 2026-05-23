// src/app/status/page.tsx
// ===============================
// Public Platform Status Page
// Phase 5C.3 — read-only public status page
// Shows only incidents deliberately marked is_public = true
// ===============================

import type { CSSProperties, ReactNode } from "react";
import Link from "next/link";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type PublicIncidentRow = {
  id: string;
  title: string;
  status: string;
  severity: string;
  affected_area: string;
  public_message: string | null;
  started_at: string;
  resolved_at: string | null;
  updated_at: string;
};

type PublicStatusSummaryRow = {
  public_count: string | number;
  active_count: string | number;
  investigating_count: string | number;
  monitoring_count: string | number;
  resolved_count: string | number;
};

function toNumber(value: string | number | null | undefined) {
  const numberValue = Number(value || 0);
  return Number.isFinite(numberValue) ? numberValue : 0;
}

function cleanText(value: unknown, fallback = "—") {
  const clean = String(value ?? "").trim();
  return clean || fallback;
}

function formatLabel(value: unknown) {
  return cleanText(value, "unknown")
    .toLowerCase()
    .replaceAll("_", " ")
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "—";

  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/London",
  }).format(date);
}

function getPublicMessage(incident: PublicIncidentRow) {
  const message = String(incident.public_message || "").trim();

  if (message) {
    return message;
  }

  if (incident.status === "resolved") {
    return "This incident has been resolved. We are keeping this update visible for transparency.";
  }

  if (incident.status === "monitoring") {
    return "A fix or mitigation is in place and we are monitoring the platform.";
  }

  return "We are investigating this issue and will update the status when more information is available.";
}

async function getPublicStatusSummary() {
  const rows = await query<PublicStatusSummaryRow>(
    `
      select
        count(*)::int as public_count,
        count(*) filter (where status <> 'resolved')::int as active_count,
        count(*) filter (where status = 'investigating')::int as investigating_count,
        count(*) filter (where status = 'monitoring')::int as monitoring_count,
        count(*) filter (where status = 'resolved')::int as resolved_count
      from platform_incidents
      where is_public = true
    `,
  );

  return (
    rows[0] || {
      public_count: 0,
      active_count: 0,
      investigating_count: 0,
      monitoring_count: 0,
      resolved_count: 0,
    }
  );
}

async function getPublicIncidents() {
  return query<PublicIncidentRow>(
    `
      select
        id::text,
        title,
        status,
        severity,
        affected_area,
        public_message,
        started_at::text,
        resolved_at::text,
        updated_at::text
      from platform_incidents
      where is_public = true
      order by
        case
          when status = 'investigating' then 1
          when status = 'monitoring' then 2
          else 3
        end,
        started_at desc
      limit 50
    `,
  );
}

export default async function PublicStatusPage() {
  const [summary, incidents] = await Promise.all([
    getPublicStatusSummary(),
    getPublicIncidents(),
  ]);

  const activeCount = toNumber(summary.active_count);
  const hasActiveIncidents = activeCount > 0;

  return (
    <main className="public-status-page" style={styles.page}>
      <style>{responsiveStyles}</style>

      <section className="public-status-hero" style={styles.hero}>
        <div style={styles.heroContent}>
          <Link href="/" style={styles.homeLink}>
            ← SO Fundraising Platform
          </Link>

          <div style={styles.badgeRow}>
            <span style={styles.badge}>Platform status</span>
            <span
              style={{
                ...styles.statusBadge,
                ...(hasActiveIncidents ? styles.statusBadgeActive : {}),
              }}
            >
              {hasActiveIncidents ? "Active incident" : "Operational"}
            </span>
          </div>

          <h1 className="so-brand-heading public-status-title" style={styles.title}>
            Platform status
          </h1>

          <p style={styles.subtitle}>
            Public updates for SO Fundraising Platform availability, known issues
            and resolved incidents.
          </p>
        </div>

        <div className="public-status-stats" style={styles.heroStats}>
          <StatCard label="Active incidents" value={activeCount} dark />
          <StatCard
            label="Investigating"
            value={toNumber(summary.investigating_count)}
            dark
          />
          <StatCard
            label="Monitoring"
            value={toNumber(summary.monitoring_count)}
            dark
          />
          <StatCard label="Resolved" value={toNumber(summary.resolved_count)} dark />
        </div>
      </section>

      <section style={styles.overviewPanel}>
        <div style={styles.overviewIcon}>{hasActiveIncidents ? "!" : "✓"}</div>

        <div>
          <p style={styles.kicker}>Current status</p>

          <h2 style={styles.overviewTitle}>
            {hasActiveIncidents
              ? "We are tracking an active platform incident"
              : "All published platform systems are operational"}
          </h2>

          <p style={styles.overviewText}>
            {hasActiveIncidents
              ? "Details are listed below. We will update this page when the incident changes."
              : "There are no active published incidents at the moment."}
          </p>
        </div>
      </section>

      <section style={styles.incidentsPanel}>
        <div style={styles.sectionHeader}>
          <p style={styles.kicker}>Updates</p>
          <h2 style={styles.sectionTitle}>Public incident history</h2>
          <p style={styles.sectionText}>
            Only incidents deliberately published by SO Fundraising Platform
            support are shown here.
          </p>
        </div>

        {incidents.length > 0 ? (
          <div className="public-incident-list" style={styles.incidentList}>
            {incidents.map((incident) => (
              <PublicIncidentCard key={incident.id} incident={incident} />
            ))}
          </div>
        ) : (
          <div style={styles.emptyState}>
            <p style={styles.emptyTitle}>No public incidents</p>
            <p style={styles.emptyText}>
              There are no published status incidents at this time.
            </p>
          </div>
        )}
      </section>
    </main>
  );
}

function StatCard({
  label,
  value,
  dark = false,
}: {
  label: string;
  value: ReactNode;
  dark?: boolean;
}) {
  return (
    <div style={dark ? styles.darkStatCard : styles.statCard}>
      <div style={dark ? styles.darkStatLabel : styles.statLabel}>{label}</div>
      <div style={dark ? styles.darkStatValue : styles.statValue}>{value}</div>
    </div>
  );
}

function PublicIncidentCard({ incident }: { incident: PublicIncidentRow }) {
  return (
    <article className="public-incident-card" style={styles.incidentCard}>
      <div className="public-incident-top" style={styles.incidentTop}>
        <div style={styles.incidentTitleBlock}>
          <div style={styles.incidentPills}>
            <span
              style={{
                ...styles.statusPill,
                ...(incident.status === "investigating"
                  ? styles.statusInvestigating
                  : incident.status === "monitoring"
                    ? styles.statusMonitoring
                    : styles.statusResolved),
              }}
            >
              {formatLabel(incident.status)}
            </span>

            <span
              style={{
                ...styles.severityPill,
                ...(incident.severity === "critical"
                  ? styles.severityCritical
                  : incident.severity === "high"
                    ? styles.severityHigh
                    : styles.severityDefault),
              }}
            >
              {formatLabel(incident.severity)}
            </span>

            <span style={styles.areaPill}>{incident.affected_area}</span>
          </div>

          <h3 style={styles.incidentTitle}>{incident.title}</h3>

          <p style={styles.incidentMeta}>
            Started {formatDateTime(incident.started_at)}
            {incident.resolved_at
              ? ` · Resolved ${formatDateTime(incident.resolved_at)}`
              : ""}
          </p>
        </div>

        <div style={styles.updatedBox}>
          <span style={styles.updatedLabel}>Last updated</span>
          <strong style={styles.updatedValue}>
            {formatDateTime(incident.updated_at)}
          </strong>
        </div>
      </div>

      <div style={styles.messageBox}>
        <p style={styles.messageLabel}>Public update</p>
        <p style={styles.messageText}>{getPublicMessage(incident)}</p>
      </div>
    </article>
  );
}

const responsiveStyles = `
.public-status-page,
.public-status-page * {
  box-sizing: border-box;
}

.public-status-page {
  overflow-x: hidden;
}

.public-status-page section,
.public-status-page article,
.public-status-page div,
.public-status-page a,
.public-status-page p,
.public-status-page h1,
.public-status-page h2,
.public-status-page h3,
.public-status-page strong,
.public-status-page span {
  min-width: 0;
  max-width: 100%;
}

.public-status-page .public-incident-card {
  overflow: hidden;
}

@media (max-width: 1080px) {
  .public-status-page .public-status-hero {
    grid-template-columns: 1fr !important;
  }

  .public-status-page .public-status-stats {
    grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
  }

  .public-status-page .public-incident-top {
    grid-template-columns: 1fr !important;
  }
}

@media (max-width: 760px) {
  .public-status-page {
    padding: 18px 12px 44px !important;
  }

  .public-status-page .public-status-title {
    font-size: clamp(38px, 11vw, 58px) !important;
    line-height: 0.98 !important;
  }

  .public-status-page .public-status-hero,
  .public-status-page .public-incident-card {
    padding: 18px !important;
    border-radius: 24px !important;
  }

  .public-status-page .public-status-stats {
    grid-template-columns: 1fr !important;
  }

  .public-status-page .public-incident-card p,
  .public-status-page .public-incident-card strong,
  .public-status-page .public-incident-card span,
  .public-status-page .public-incident-card a {
    overflow-wrap: anywhere !important;
    word-break: break-word !important;
  }
}
`;

const styles: Record<string, CSSProperties> = {
  page: {
    width: "100%",
    maxWidth: 1180,
    margin: "0 auto",
    padding: "28px 16px 64px",
    minHeight: "100vh",
    background:
      "radial-gradient(circle at top left, rgba(37,99,235,0.10), transparent 30%), radial-gradient(circle at top right, rgba(34,197,94,0.10), transparent 34%), #f8fafc",
    color: "#0f172a",
    boxSizing: "border-box",
    overflowX: "hidden",
  },

  hero: {
    position: "relative",
    display: "grid",
    gridTemplateColumns: "minmax(0, 1.15fr) minmax(320px, 0.85fr)",
    gap: 22,
    padding: 30,
    borderRadius: 34,
    background:
      "radial-gradient(circle at bottom right, rgba(34,197,94,0.18), transparent 38%), linear-gradient(135deg, #020617 0%, #0f172a 55%, #172554 100%)",
    color: "#ffffff",
    marginBottom: 18,
    boxShadow: "0 28px 70px rgba(15,23,42,0.22)",
    overflow: "hidden",
    border: "1px solid rgba(148,163,184,0.22)",
  },

  heroContent: {
    minWidth: 0,
  },

  homeLink: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: "fit-content",
    maxWidth: "100%",
    marginBottom: 16,
    padding: "10px 14px",
    borderRadius: 999,
    background: "rgba(255,255,255,0.08)",
    color: "#ffffff",
    border: "1px solid rgba(255,255,255,0.18)",
    textDecoration: "none",
    fontSize: 13,
    fontWeight: 950,
    overflowWrap: "anywhere",
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
    background: "rgba(37,99,235,0.22)",
    color: "#dbeafe",
    border: "1px solid rgba(147,197,253,0.34)",
    fontSize: 13,
    fontWeight: 950,
  },

  statusBadge: {
    display: "inline-flex",
    padding: "8px 12px",
    borderRadius: 999,
    background: "rgba(34,197,94,0.16)",
    color: "#dcfce7",
    border: "1px solid rgba(134,239,172,0.34)",
    fontSize: 13,
    fontWeight: 950,
  },

  statusBadgeActive: {
    background: "rgba(251,191,36,0.18)",
    color: "#fef3c7",
    border: "1px solid rgba(251,191,36,0.36)",
  },

  title: {
    margin: 0,
    fontSize: "clamp(52px, 7vw, 82px)",
    lineHeight: 0.92,
    letterSpacing: "-0.08em",
    color: "#ffffff",
    overflowWrap: "anywhere",
    textShadow: "0 18px 45px rgba(0,0,0,0.22)",
  },

  subtitle: {
    margin: "18px 0 0",
    maxWidth: 760,
    color: "#dbeafe",
    fontSize: 18,
    lineHeight: 1.6,
    fontWeight: 700,
    overflowWrap: "anywhere",
  },

  heroStats: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 12,
    alignContent: "start",
  },

  statCard: {
    display: "grid",
    gap: 6,
    padding: 16,
    borderRadius: 20,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
  },

  darkStatCard: {
    display: "grid",
    gap: 6,
    padding: 18,
    borderRadius: 22,
    background: "rgba(255,255,255,0.08)",
    border: "1px solid rgba(148,163,184,0.26)",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.10)",
    backdropFilter: "blur(12px)",
  },

  statLabel: {
    color: "#64748b",
    fontSize: 13,
    fontWeight: 850,
  },

  darkStatLabel: {
    color: "#bfdbfe",
    fontSize: 13,
    fontWeight: 850,
  },

  statValue: {
    color: "#0f172a",
    fontSize: 28,
    fontWeight: 950,
    letterSpacing: "-0.05em",
  },

  darkStatValue: {
    color: "#ffffff",
    fontSize: 30,
    fontWeight: 950,
    letterSpacing: "-0.05em",
    overflowWrap: "anywhere",
  },

  overviewPanel: {
    display: "grid",
    gridTemplateColumns: "auto minmax(0, 1fr)",
    gap: 14,
    alignItems: "center",
    padding: 22,
    borderRadius: 28,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    boxShadow: "0 8px 30px rgba(15,23,42,0.05)",
    marginBottom: 18,
    minWidth: 0,
    overflow: "hidden",
  },

  overviewIcon: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: 46,
    height: 46,
    borderRadius: 999,
    background: "#ecfdf5",
    color: "#047857",
    border: "1px solid #a7f3d0",
    fontSize: 22,
    fontWeight: 950,
  },

  kicker: {
    margin: 0,
    color: "#2563eb",
    fontSize: 12,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
  },

  overviewTitle: {
    margin: "5px 0 0",
    color: "#0f172a",
    fontSize: 26,
    letterSpacing: "-0.05em",
    overflowWrap: "anywhere",
  },

  overviewText: {
    margin: "7px 0 0",
    color: "#64748b",
    lineHeight: 1.55,
    fontWeight: 750,
    overflowWrap: "anywhere",
  },

  incidentsPanel: {
    display: "grid",
    gap: 14,
    minWidth: 0,
    overflow: "hidden",
  },

  sectionHeader: {
    display: "grid",
    gap: 4,
    padding: "0 2px",
    minWidth: 0,
  },

  sectionTitle: {
    margin: 0,
    color: "#0f172a",
    fontSize: 30,
    letterSpacing: "-0.05em",
    overflowWrap: "anywhere",
  },

  sectionText: {
    margin: "4px 0 0",
    color: "#64748b",
    lineHeight: 1.55,
    maxWidth: 760,
    fontWeight: 700,
    overflowWrap: "anywhere",
  },

  incidentList: {
    display: "grid",
    gap: 14,
    minWidth: 0,
  },

  incidentCard: {
    display: "grid",
    gap: 16,
    padding: 20,
    borderRadius: 28,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    boxShadow: "0 8px 30px rgba(15,23,42,0.05)",
    minWidth: 0,
    overflow: "hidden",
  },

  incidentTop: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) minmax(0, 210px)",
    gap: 14,
    alignItems: "start",
    minWidth: 0,
  },

  incidentTitleBlock: {
    minWidth: 0,
    overflow: "hidden",
  },

  incidentPills: {
    display: "flex",
    gap: 7,
    flexWrap: "wrap",
    alignItems: "center",
    marginBottom: 10,
    minWidth: 0,
  },

  statusPill: {
    display: "inline-flex",
    maxWidth: "100%",
    padding: "6px 9px",
    borderRadius: 999,
    fontSize: 11,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    overflowWrap: "anywhere",
  },

  statusInvestigating: {
    background: "#fff7ed",
    color: "#9a3412",
    border: "1px solid #fed7aa",
  },

  statusMonitoring: {
    background: "#eff6ff",
    color: "#1d4ed8",
    border: "1px solid #bfdbfe",
  },

  statusResolved: {
    background: "#ecfdf5",
    color: "#047857",
    border: "1px solid #a7f3d0",
  },

  severityPill: {
    display: "inline-flex",
    maxWidth: "100%",
    padding: "6px 9px",
    borderRadius: 999,
    fontSize: 11,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    overflowWrap: "anywhere",
  },

  severityCritical: {
    background: "#fef2f2",
    color: "#991b1b",
    border: "1px solid #fecaca",
  },

  severityHigh: {
    background: "#fff7ed",
    color: "#9a3412",
    border: "1px solid #fed7aa",
  },

  severityDefault: {
    background: "#f8fafc",
    color: "#475569",
    border: "1px solid #e2e8f0",
  },

  areaPill: {
    display: "inline-flex",
    maxWidth: "100%",
    padding: "6px 9px",
    borderRadius: 999,
    background: "#f8fafc",
    color: "#334155",
    border: "1px solid #e2e8f0",
    fontSize: 11,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    overflowWrap: "anywhere",
  },

  incidentTitle: {
    margin: 0,
    color: "#0f172a",
    fontSize: 25,
    lineHeight: 1.15,
    letterSpacing: "-0.045em",
    overflowWrap: "anywhere",
    wordBreak: "break-word",
  },

  incidentMeta: {
    margin: "8px 0 0",
    color: "#64748b",
    fontSize: 13,
    lineHeight: 1.45,
    fontWeight: 800,
    overflowWrap: "anywhere",
  },

  updatedBox: {
    display: "grid",
    gap: 5,
    padding: 12,
    borderRadius: 18,
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    minWidth: 0,
    maxWidth: "100%",
    overflow: "hidden",
  },

  updatedLabel: {
    color: "#64748b",
    fontSize: 11,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.06em",
  },

  updatedValue: {
    color: "#0f172a",
    fontSize: 12,
    lineHeight: 1.45,
    overflowWrap: "anywhere",
    wordBreak: "break-word",
  },

  messageBox: {
    display: "grid",
    gap: 7,
    padding: 15,
    borderRadius: 18,
    background: "#ffffff",
    border: "1px solid #cbd5e1",
    minWidth: 0,
    overflow: "hidden",
  },

  messageLabel: {
    margin: 0,
    color: "#64748b",
    fontSize: 11,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.06em",
  },

  messageText: {
    margin: 0,
    color: "#0f172a",
    fontSize: 14,
    lineHeight: 1.6,
    fontWeight: 700,
    whiteSpace: "pre-wrap",
    overflowWrap: "anywhere",
    wordBreak: "break-word",
  },

  emptyState: {
    display: "grid",
    gap: 6,
    padding: 24,
    borderRadius: 24,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    boxShadow: "0 8px 30px rgba(15,23,42,0.05)",
  },

  emptyTitle: {
    margin: 0,
    color: "#0f172a",
    fontSize: 22,
    fontWeight: 950,
    letterSpacing: "-0.04em",
    overflowWrap: "anywhere",
  },

  emptyText: {
    margin: 0,
    color: "#64748b",
    lineHeight: 1.55,
    fontWeight: 700,
    overflowWrap: "anywhere",
  },
};
