// src/app/admin/platform/incidents/page.tsx
// ===============================
// Platform Owner Incident Log
// Phase 5C.3 — internal incident log with status updates + public status controls
// Mobile-safe, desktop-safe, platform-owner-only
// ===============================

import type { CSSProperties, ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type IncidentStatus = "investigating" | "monitoring" | "resolved";
type IncidentSeverity = "low" | "medium" | "high" | "critical";
type IncidentPublicAction = "publish" | "save_public" | "unpublish";

type IncidentSearchParams = {
  status?: string | string[];
};

type PlatformSession = {
  user?: {
    email?: unknown;
    name?: unknown;
    isPlatformOwner?: unknown;
  } | null;
} | null;

type IncidentRow = {
  id: string;
  title: string;
  status: string;
  severity: string;
  affected_area: string;
  summary: string;
  internal_notes: string | null;
  is_public: boolean;
  public_message: string | null;
  started_at: string;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
};

type IncidentSummaryRow = {
  total_count: string | number;
  investigating_count: string | number;
  monitoring_count: string | number;
  resolved_count: string | number;
  critical_count: string | number;
  high_count: string | number;
  public_count: string | number;
};

function firstParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0] || "";
  return value || "";
}

function normaliseStatus(value: unknown): IncidentStatus | "all" {
  const clean = String(value || "").trim().toLowerCase();

  if (
    clean === "investigating" ||
    clean === "monitoring" ||
    clean === "resolved"
  ) {
    return clean;
  }

  return "all";
}

function normaliseIncidentStatus(value: unknown): IncidentStatus {
  const clean = String(value || "").trim().toLowerCase();

  if (
    clean === "investigating" ||
    clean === "monitoring" ||
    clean === "resolved"
  ) {
    return clean;
  }

  return "investigating";
}

function normaliseSeverity(value: unknown): IncidentSeverity {
  const clean = String(value || "").trim().toLowerCase();

  if (
    clean === "low" ||
    clean === "medium" ||
    clean === "high" ||
    clean === "critical"
  ) {
    return clean;
  }

  return "medium";
}

function normalisePublicAction(value: unknown): IncidentPublicAction {
  const clean = String(value || "").trim().toLowerCase();

  if (clean === "publish" || clean === "save_public" || clean === "unpublish") {
    return clean;
  }

  return "save_public";
}

function isSafeUuid(value: unknown) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    String(value || "").trim(),
  );
}

function cleanText(value: unknown, fallback = "—") {
  const clean = String(value ?? "").trim();
  return clean || fallback;
}

function limitText(value: unknown, maxLength: number) {
  return String(value ?? "").trim().slice(0, maxLength);
}

function toNumber(value: string | number | null | undefined) {
  const numberValue = Number(value || 0);
  return Number.isFinite(numberValue) ? numberValue : 0;
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

function getStatusHref(status: IncidentStatus | "all") {
  if (status === "all") return "/admin/platform/incidents";
  return `/admin/platform/incidents?status=${encodeURIComponent(status)}`;
}

function getStatusWhereClause(status: IncidentStatus | "all") {
  if (status === "investigating") {
    return "where status = 'investigating'";
  }

  if (status === "monitoring") {
    return "where status = 'monitoring'";
  }

  if (status === "resolved") {
    return "where status = 'resolved'";
  }

  return "";
}

async function requirePlatformOwner() {
  const session = (await auth()) as PlatformSession;

  if (!session?.user) {
    redirect("/admin/login");
  }

  if (!Boolean(session.user.isPlatformOwner)) {
    redirect("/admin?error=platform_owner_required");
  }

  return session;
}

async function getIncidentSummary() {
  const rows = await query<IncidentSummaryRow>(
    `
      select
        count(*)::int as total_count,
        count(*) filter (where status = 'investigating')::int as investigating_count,
        count(*) filter (where status = 'monitoring')::int as monitoring_count,
        count(*) filter (where status = 'resolved')::int as resolved_count,
        count(*) filter (where severity = 'critical')::int as critical_count,
        count(*) filter (where severity = 'high')::int as high_count,
        count(*) filter (where is_public = true)::int as public_count
      from platform_incidents
    `,
  );

  return (
    rows[0] || {
      total_count: 0,
      investigating_count: 0,
      monitoring_count: 0,
      resolved_count: 0,
      critical_count: 0,
      high_count: 0,
      public_count: 0,
    }
  );
}

async function getIncidents(status: IncidentStatus | "all") {
  const whereClause = getStatusWhereClause(status);

  return query<IncidentRow>(
    `
      select
        id::text,
        title,
        status,
        severity,
        affected_area,
        summary,
        internal_notes,
        is_public,
        public_message,
        started_at::text,
        resolved_at::text,
        created_at::text,
        updated_at::text
      from platform_incidents
      ${whereClause}
      order by
        case
          when status = 'investigating' then 1
          when status = 'monitoring' then 2
          else 3
        end,
        started_at desc
      limit 100
    `,
  );
}

async function createIncident(formData: FormData) {
  "use server";

  await requirePlatformOwner();

  const title = limitText(formData.get("title"), 140);
  const status = normaliseIncidentStatus(formData.get("status"));
  const severity = normaliseSeverity(formData.get("severity"));
  const affectedArea = limitText(formData.get("affected_area"), 80) || "platform";
  const summary = limitText(formData.get("summary"), 1200);
  const internalNotes = limitText(formData.get("internal_notes"), 3000);

  if (!title || !summary) {
    redirect("/admin/platform/incidents?error=missing_required");
  }

  await query(
    `
      insert into platform_incidents (
        title,
        status,
        severity,
        affected_area,
        summary,
        internal_notes,
        resolved_at,
        updated_at
      )
      values (
        $1,
        $2,
        $3,
        $4,
        $5,
        $6,
        case when $2 = 'resolved' then now() else null end,
        now()
      )
    `,
    [title, status, severity, affectedArea, summary, internalNotes || null],
  );

  redirect(getStatusHref(status));
}

async function updateIncidentStatus(formData: FormData) {
  "use server";

  await requirePlatformOwner();

  const incidentId = String(formData.get("incident_id") || "").trim();
  const nextStatus = normaliseIncidentStatus(formData.get("status"));
  const returnStatus = normaliseStatus(formData.get("return_status"));

  if (!isSafeUuid(incidentId)) {
    redirect(getStatusHref(returnStatus));
  }

  await query(
    `
      update platform_incidents
      set
        status = $2,
        resolved_at = case
          when $2 = 'resolved' then coalesce(resolved_at, now())
          else null
        end,
        updated_at = now()
      where id = $1
    `,
    [incidentId, nextStatus],
  );

  redirect(getStatusHref(returnStatus));
}

async function updateIncidentPublicStatus(formData: FormData) {
  "use server";

  await requirePlatformOwner();

  const incidentId = String(formData.get("incident_id") || "").trim();
  const publicAction = normalisePublicAction(formData.get("public_action"));
  const returnStatus = normaliseStatus(formData.get("return_status"));
  const publicMessage = limitText(formData.get("public_message"), 1200);

  if (!isSafeUuid(incidentId)) {
    redirect(getStatusHref(returnStatus));
  }

  if (publicAction === "unpublish") {
    await query(
      `
        update platform_incidents
        set
          is_public = false,
          public_message = $2,
          updated_at = now()
        where id = $1
      `,
      [incidentId, publicMessage || null],
    );

    redirect(getStatusHref(returnStatus));
  }

  await query(
    `
      update platform_incidents
      set
        is_public = true,
        public_message = $2,
        updated_at = now()
      where id = $1
    `,
    [incidentId, publicMessage || null],
  );

  redirect(getStatusHref(returnStatus));
}
export default async function PlatformIncidentsPage({
  searchParams,
}: {
  searchParams?: Promise<IncidentSearchParams>;
}) {
  await requirePlatformOwner();

  const resolvedSearchParams = searchParams ? await searchParams : {};
  const activeStatus = normaliseStatus(firstParam(resolvedSearchParams.status));

  const [summary, incidents] = await Promise.all([
    getIncidentSummary(),
    getIncidents(activeStatus),
  ]);

  return (
    <main className="platform-incidents-page" style={styles.page}>
      <style>{responsiveStyles}</style>

      <section className="platform-incidents-hero" style={styles.hero}>
        <div style={styles.heroContent}>
          <Link href="/admin/platform/support" style={styles.backLink}>
            ← Back to support dashboard
          </Link>

          <div style={styles.badgeRow}>
            <span style={styles.badge}>Platform owner</span>
            <span style={styles.softBadge}>Incident log</span>
          </div>

          <h1
            className="so-brand-heading platform-incidents-title"
            style={styles.title}
          >
            Incident log
          </h1>

          <p style={styles.subtitle}>
            Track platform issues, update internal status, and choose exactly
            which incidents appear on the public platform status page.
          </p>

          <div style={styles.heroActions}>
            <Link href="/status" style={styles.statusPageLink}>
              View public status page →
            </Link>
          </div>
        </div>

        <div className="platform-incidents-stats" style={styles.heroStats}>
          <StatCard
            label="Total incidents"
            value={toNumber(summary.total_count)}
            dark
          />
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
          <StatCard
            label="Public"
            value={toNumber(summary.public_count)}
            dark
          />
        </div>
      </section>

      <section className="incident-summary-grid" style={styles.summaryGrid}>
        <SummaryCard
          label="Investigating"
          value={toNumber(summary.investigating_count)}
          text="Open incidents being actively checked"
        />

        <SummaryCard
          label="Monitoring"
          value={toNumber(summary.monitoring_count)}
          text="Issues being watched after a fix"
        />

        <SummaryCard
          label="Resolved"
          value={toNumber(summary.resolved_count)}
          text="Closed incidents kept for history"
        />

        <SummaryCard
          label="Public"
          value={toNumber(summary.public_count)}
          text="Incidents visible on /status"
        />

        <SummaryCard
          label="Critical"
          value={toNumber(summary.critical_count)}
          text="Major platform-impacting incidents"
        />
      </section>

      <section className="incident-create-panel" style={styles.createPanel}>
        <div>
          <p style={styles.kicker}>Create incident</p>

          <h2 className="so-brand-card-title" style={styles.sectionTitle}>
            Add a manual incident
          </h2>

          <p style={styles.sectionText}>
            Record platform issues, degraded service, support spikes or known
            operational problems. New incidents remain private unless you publish
            them below.
          </p>
        </div>

        <form action={createIncident} style={styles.createForm}>
          <label style={styles.field}>
            <span style={styles.label}>Title</span>
            <input
              name="title"
              type="text"
              required
              maxLength={140}
              placeholder="Example: Stripe checkout delay reported"
              style={styles.input}
            />
          </label>

          <div className="incident-form-grid" style={styles.formGrid}>
            <label style={styles.field}>
              <span style={styles.label}>Status</span>
              <select
                name="status"
                defaultValue="investigating"
                style={styles.select}
              >
                <option value="investigating">Investigating</option>
                <option value="monitoring">Monitoring</option>
                <option value="resolved">Resolved</option>
              </select>
            </label>

            <label style={styles.field}>
              <span style={styles.label}>Severity</span>
              <select
                name="severity"
                defaultValue="medium"
                style={styles.select}
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </label>

            <label style={styles.field}>
              <span style={styles.label}>Affected area</span>
              <input
                name="affected_area"
                type="text"
                maxLength={80}
                placeholder="Platform, checkout, email, admin, public pages"
                defaultValue="platform"
                style={styles.input}
              />
            </label>
          </div>

          <label style={styles.field}>
            <span style={styles.label}>Summary</span>
            <textarea
              name="summary"
              required
              maxLength={1200}
              rows={4}
              placeholder="Write a clear internal summary of what happened, who was affected, and what is currently being done."
              style={styles.textarea}
            />
          </label>

          <label style={styles.field}>
            <span style={styles.label}>Internal notes</span>
            <textarea
              name="internal_notes"
              maxLength={3000}
              rows={3}
              placeholder="Optional private notes, investigation details, links to support requests, or follow-up actions."
              style={styles.textarea}
            />
          </label>

          <button type="submit" style={styles.createButton}>
            Create incident →
          </button>
        </form>
      </section>

      <section style={styles.filterPanel}>
        <div>
          <p style={styles.kicker}>Filters</p>

          <h2 className="so-brand-card-title" style={styles.sectionTitle}>
            Incident history
          </h2>

          <p style={styles.sectionText}>
            Showing the latest 100 incidents for the selected status. Public
            visibility is controlled per incident and only published incidents
            appear on /status.
          </p>
        </div>

        <div className="incident-filter-grid" style={styles.filterGrid}>
          <FilterLink active={activeStatus === "all"} href="/admin/platform/incidents">
            All
          </FilterLink>

          <FilterLink
            active={activeStatus === "investigating"}
            href="/admin/platform/incidents?status=investigating"
          >
            Investigating
          </FilterLink>

          <FilterLink
            active={activeStatus === "monitoring"}
            href="/admin/platform/incidents?status=monitoring"
          >
            Monitoring
          </FilterLink>

          <FilterLink
            active={activeStatus === "resolved"}
            href="/admin/platform/incidents?status=resolved"
          >
            Resolved
          </FilterLink>
        </div>
      </section>

      <section style={styles.incidentsPanel}>
        {incidents.length > 0 ? (
          <div className="incident-list" style={styles.incidentList}>
            {incidents.map((incident) => (
              <IncidentCard
                key={incident.id}
                incident={incident}
                activeStatus={activeStatus}
              />
            ))}
          </div>
        ) : (
          <div style={styles.emptyState}>
            <p style={styles.emptyTitle}>No incidents found</p>
            <p style={styles.emptyText}>
              There are no incidents matching this filter yet.
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

function SummaryCard({
  label,
  value,
  text,
}: {
  label: string;
  value: ReactNode;
  text: string;
}) {
  return (
    <article style={styles.summaryCard}>
      <p style={styles.summaryLabel}>{label}</p>
      <div style={styles.summaryValue}>{value}</div>
      <p style={styles.summaryText}>{text}</p>
    </article>
  );
}

function FilterLink({
  active,
  href,
  children,
}: {
  active: boolean;
  href: string;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      style={{
        ...styles.filterLink,
        ...(active ? styles.filterLinkActive : {}),
      }}
    >
      {children}
    </Link>
  );
}

function DetailItem({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div style={styles.detailItem}>
      <span style={styles.detailLabel}>{label}</span>
      <strong style={styles.detailValue}>{value}</strong>
    </div>
  );
}

function IncidentStatusButton({
  incidentId,
  status,
  currentStatus,
  activeStatus,
  children,
}: {
  incidentId: string;
  status: IncidentStatus;
  currentStatus: string;
  activeStatus: IncidentStatus | "all";
  children: ReactNode;
}) {
  const active = currentStatus === status;

  return (
    <form action={updateIncidentStatus} style={styles.statusForm}>
      <input type="hidden" name="incident_id" value={incidentId} />
      <input type="hidden" name="status" value={status} />
      <input type="hidden" name="return_status" value={activeStatus} />

      <button
        type="submit"
        disabled={active}
        style={{
          ...styles.statusButton,
          ...(active ? styles.statusButtonActive : {}),
        }}
      >
        {children}
      </button>
    </form>
  );
}

function IncidentCard({
  incident,
  activeStatus,
}: {
  incident: IncidentRow;
  activeStatus: IncidentStatus | "all";
}) {
  return (
    <article className="incident-card" style={styles.incidentCard}>
      <div className="incident-card-top" style={styles.incidentTop}>
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
                    : incident.severity === "low"
                      ? styles.severityLow
                      : styles.severityMedium),
              }}
            >
              {formatLabel(incident.severity)}
            </span>

            <span style={styles.areaPill}>{incident.affected_area}</span>

            <span
              style={{
                ...styles.publicPill,
                ...(incident.is_public ? styles.publicPillLive : {}),
              }}
            >
              {incident.is_public ? "Public" : "Private"}
            </span>
          </div>

          <h2 style={styles.incidentTitle}>{incident.title}</h2>

          <p style={styles.incidentMeta}>
            Started {formatDateTime(incident.started_at)}
            {incident.resolved_at
              ? ` · Resolved ${formatDateTime(incident.resolved_at)}`
              : ""}
          </p>
        </div>

        <div style={styles.incidentIdBox}>
          <span style={styles.incidentIdLabel}>Reference</span>
          <strong style={styles.incidentIdValue}>{incident.id}</strong>
        </div>
      </div>
            <div className="incident-status-panel" style={styles.statusPanel}>
        <div style={styles.statusPanelCopy}>
          <p style={styles.statusPanelLabel}>Update status</p>
          <p style={styles.statusPanelText}>
            Moving to resolved sets the resolved timestamp. Moving back to
            investigating or monitoring clears it.
          </p>
        </div>

        <div className="incident-status-actions" style={styles.statusActions}>
          <IncidentStatusButton
            incidentId={incident.id}
            status="investigating"
            currentStatus={incident.status}
            activeStatus={activeStatus}
          >
            Investigating
          </IncidentStatusButton>

          <IncidentStatusButton
            incidentId={incident.id}
            status="monitoring"
            currentStatus={incident.status}
            activeStatus={activeStatus}
          >
            Monitoring
          </IncidentStatusButton>

          <IncidentStatusButton
            incidentId={incident.id}
            status="resolved"
            currentStatus={incident.status}
            activeStatus={activeStatus}
          >
            Resolved
          </IncidentStatusButton>
        </div>
      </div>

      <div className="incident-detail-grid" style={styles.detailGrid}>
        <DetailItem label="Status" value={formatLabel(incident.status)} />
        <DetailItem label="Severity" value={formatLabel(incident.severity)} />
        <DetailItem label="Affected area" value={incident.affected_area} />
        <DetailItem label="Updated" value={formatDateTime(incident.updated_at)} />
      </div>

      <div style={styles.summaryBox}>
        <p style={styles.boxLabel}>Internal summary</p>
        <p style={styles.boxText}>{incident.summary}</p>
      </div>

      <div className="incident-public-panel" style={styles.publicPanel}>
        <div style={styles.publicHeader}>
          <div>
            <p style={styles.publicKicker}>Public status page</p>
            <h3 style={styles.publicTitle}>
              {incident.is_public ? "Published to /status" : "Private incident"}
            </h3>
            <p style={styles.publicText}>
              Only published incidents appear on the public status page. Internal
              notes are never shown publicly.
            </p>
          </div>
        </div>

        <form action={updateIncidentPublicStatus} style={styles.publicForm}>
          <input type="hidden" name="incident_id" value={incident.id} />
          <input type="hidden" name="return_status" value={activeStatus} />

          <label style={styles.field}>
            <span style={styles.label}>Public message</span>
            <textarea
              name="public_message"
              defaultValue={incident.public_message || ""}
              maxLength={1200}
              rows={3}
              placeholder="Optional public-facing update. If left blank, the internal summary is not exposed; the status page will use a safe generic message."
              style={styles.textarea}
            />
          </label>

          <div className="incident-public-actions" style={styles.publicActions}>
            <button
              type="submit"
              name="public_action"
              value={incident.is_public ? "save_public" : "publish"}
              style={styles.publicButton}
            >
              {incident.is_public ? "Save public message" : "Publish to status page"} →
            </button>

            {incident.is_public ? (
              <button
                type="submit"
                name="public_action"
                value="unpublish"
                style={styles.unpublishButton}
              >
                Unpublish
              </button>
            ) : null}
          </div>
        </form>
      </div>

      {incident.internal_notes ? (
        <div style={styles.internalNotesBox}>
          <p style={styles.boxLabel}>Internal notes</p>
          <p style={styles.boxText}>{incident.internal_notes}</p>
        </div>
      ) : null}
    </article>
  );
}

const responsiveStyles = `
.platform-incidents-page,
.platform-incidents-page * {
  box-sizing: border-box;
}

.platform-incidents-page {
  overflow-x: hidden;
}

.platform-incidents-page section,
.platform-incidents-page article,
.platform-incidents-page div,
.platform-incidents-page a,
.platform-incidents-page p,
.platform-incidents-page h1,
.platform-incidents-page h2,
.platform-incidents-page h3,
.platform-incidents-page strong,
.platform-incidents-page span,
.platform-incidents-page form,
.platform-incidents-page label,
.platform-incidents-page input,
.platform-incidents-page select,
.platform-incidents-page textarea,
.platform-incidents-page button {
  min-width: 0;
  max-width: 100%;
}

.platform-incidents-page .incident-card {
  overflow: hidden;
}

@media (max-width: 1080px) {
  .platform-incidents-page .platform-incidents-hero {
    grid-template-columns: 1fr !important;
  }

  .platform-incidents-page .platform-incidents-stats,
  .platform-incidents-page .incident-summary-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
  }

  .platform-incidents-page .incident-form-grid,
  .platform-incidents-page .incident-status-panel {
    grid-template-columns: 1fr !important;
  }

  .platform-incidents-page .incident-filter-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
  }

  .platform-incidents-page .incident-detail-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
  }

  .platform-incidents-page .incident-card-top {
    grid-template-columns: 1fr !important;
  }
}

@media (max-width: 760px) {
  .platform-incidents-page {
    padding: 18px 12px 44px !important;
  }

  .platform-incidents-page .platform-incidents-title {
    font-size: clamp(38px, 11vw, 58px) !important;
    line-height: 0.98 !important;
  }

  .platform-incidents-page .platform-incidents-hero,
  .platform-incidents-page .incident-create-panel,
  .platform-incidents-page .incident-card {
    padding: 18px !important;
    border-radius: 24px !important;
  }

  .platform-incidents-page .platform-incidents-stats,
  .platform-incidents-page .incident-summary-grid,
  .platform-incidents-page .incident-filter-grid,
  .platform-incidents-page .incident-detail-grid,
  .platform-incidents-page .incident-status-actions,
  .platform-incidents-page .incident-public-actions {
    grid-template-columns: 1fr !important;
  }

  .platform-incidents-page .incident-status-panel,
  .platform-incidents-page .incident-public-panel {
    padding: 12px !important;
    border-radius: 18px !important;
  }

  .platform-incidents-page .incident-card p,
  .platform-incidents-page .incident-card strong,
  .platform-incidents-page .incident-card span,
  .platform-incidents-page .incident-card a,
  .platform-incidents-page .incident-card button,
  .platform-incidents-page input,
  .platform-incidents-page select,
  .platform-incidents-page textarea,
  .platform-incidents-page button {
    overflow-wrap: anywhere !important;
    word-break: break-word !important;
  }
}
`;

const styles: Record<string, CSSProperties> = {
  page: {
    width: "100%",
    maxWidth: 1320,
    margin: "0 auto",
    padding: "28px 16px 64px",
    minHeight: "100vh",
    background:
      "radial-gradient(circle at top left, rgba(37,99,235,0.10), transparent 30%), radial-gradient(circle at top right, rgba(251,191,36,0.10), transparent 34%), #f8fafc",
    color: "#0f172a",
    boxSizing: "border-box",
    overflowX: "hidden",
  },

  hero: {
    position: "relative",
    display: "grid",
    gridTemplateColumns: "minmax(0, 1.18fr) minmax(320px, 0.82fr)",
    gap: 22,
    padding: 30,
    borderRadius: 34,
    background:
      "radial-gradient(circle at bottom right, rgba(251,191,36,0.18), transparent 38%), linear-gradient(135deg, #020617 0%, #0f172a 55%, #172554 100%)",
    color: "#ffffff",
    marginBottom: 18,
    boxShadow: "0 28px 70px rgba(15,23,42,0.22)",
    overflow: "hidden",
    border: "1px solid rgba(148,163,184,0.22)",
  },

  heroContent: {
    minWidth: 0,
  },

  backLink: {
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

  softBadge: {
    display: "inline-flex",
    padding: "8px 12px",
    borderRadius: 999,
    background: "rgba(251,191,36,0.16)",
    color: "#fef3c7",
    border: "1px solid rgba(251,191,36,0.32)",
    fontSize: 13,
    fontWeight: 950,
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
    maxWidth: 780,
    color: "#dbeafe",
    fontSize: 18,
    lineHeight: 1.6,
    fontWeight: 700,
    overflowWrap: "anywhere",
  },

  heroActions: {
    display: "flex",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 18,
    minWidth: 0,
  },

  statusPageLink: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    maxWidth: "100%",
    padding: "10px 14px",
    borderRadius: 999,
    background: "rgba(255,255,255,0.10)",
    color: "#ffffff",
    border: "1px solid rgba(255,255,255,0.22)",
    textDecoration: "none",
    fontSize: 13,
    fontWeight: 950,
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

  summaryGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
    gap: 12,
    marginBottom: 18,
  },

  summaryCard: {
    display: "grid",
    gap: 8,
    padding: 16,
    borderRadius: 22,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    boxShadow: "0 2px 12px rgba(15,23,42,0.04)",
    minWidth: 0,
    overflow: "hidden",
  },

  summaryLabel: {
    margin: 0,
    color: "#64748b",
    fontSize: 12,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    overflowWrap: "anywhere",
  },

  summaryValue: {
    color: "#0f172a",
    fontSize: 30,
    fontWeight: 950,
    letterSpacing: "-0.06em",
    lineHeight: 1,
    overflowWrap: "anywhere",
  },

  summaryText: {
    margin: 0,
    color: "#64748b",
    lineHeight: 1.45,
    fontSize: 13,
    fontWeight: 700,
    overflowWrap: "anywhere",
  },

  createPanel: {
    display: "grid",
    gap: 18,
    padding: 22,
    borderRadius: 28,
    background:
      "linear-gradient(135deg, rgba(37,99,235,0.08), rgba(255,255,255,1) 72%)",
    border: "1px solid #bfdbfe",
    boxShadow: "0 8px 30px rgba(15,23,42,0.05)",
    marginBottom: 18,
    minWidth: 0,
    overflow: "hidden",
  },

  kicker: {
    margin: 0,
    color: "#2563eb",
    fontSize: 12,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
  },

  sectionTitle: {
    margin: "6px 0 0",
    color: "#0f172a",
    fontSize: 30,
    letterSpacing: "-0.05em",
    overflowWrap: "anywhere",
  },

  sectionText: {
    margin: "8px 0 0",
    color: "#64748b",
    lineHeight: 1.6,
    maxWidth: 760,
    fontWeight: 700,
    overflowWrap: "anywhere",
  },

  createForm: {
    display: "grid",
    gap: 14,
    minWidth: 0,
  },

  formGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: 12,
    minWidth: 0,
  },

  field: {
    display: "grid",
    gap: 7,
    minWidth: 0,
  },

  label: {
    color: "#0f172a",
    fontSize: 12,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    overflowWrap: "anywhere",
  },

  input: {
    width: "100%",
    minWidth: 0,
    maxWidth: "100%",
    minHeight: 44,
    borderRadius: 16,
    border: "1px solid #cbd5e1",
    background: "#ffffff",
    color: "#0f172a",
    padding: "11px 13px",
    fontSize: 14,
    fontWeight: 750,
    lineHeight: 1.35,
    outline: "none",
    overflowWrap: "anywhere",
  },

  select: {
    width: "100%",
    minWidth: 0,
    maxWidth: "100%",
    minHeight: 44,
    borderRadius: 16,
    border: "1px solid #cbd5e1",
    background: "#ffffff",
    color: "#0f172a",
    padding: "11px 13px",
    fontSize: 14,
    fontWeight: 850,
    lineHeight: 1.35,
    outline: "none",
  },

  textarea: {
    width: "100%",
    minWidth: 0,
    maxWidth: "100%",
    borderRadius: 16,
    border: "1px solid #cbd5e1",
    background: "#ffffff",
    color: "#0f172a",
    padding: "12px 14px",
    fontSize: 14,
    fontWeight: 700,
    lineHeight: 1.5,
    resize: "vertical",
    outline: "none",
    overflowWrap: "anywhere",
  },

  createButton: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    justifySelf: "start",
    minHeight: 46,
    maxWidth: "100%",
    padding: "11px 16px",
    borderRadius: 999,
    background: "linear-gradient(135deg, #1683f8 0%, #2563eb 100%)",
    color: "#ffffff",
    border: "1px solid #1683f8",
    fontSize: 14,
    fontWeight: 950,
    cursor: "pointer",
    textAlign: "center",
    lineHeight: 1.2,
    whiteSpace: "normal",
    overflowWrap: "anywhere",
    boxShadow: "0 14px 28px rgba(22,131,248,0.20)",
  },

  filterPanel: {
    display: "grid",
    gap: 16,
    padding: 22,
    borderRadius: 28,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    boxShadow: "0 8px 30px rgba(15,23,42,0.05)",
    marginBottom: 18,
    minWidth: 0,
    overflow: "hidden",
  },

  filterGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
    gap: 10,
    minWidth: 0,
  },

  filterLink: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 44,
    padding: "10px 12px",
    borderRadius: 999,
    background: "#f8fafc",
    color: "#0f172a",
    border: "1px solid #e2e8f0",
    textDecoration: "none",
    fontSize: 13,
    fontWeight: 950,
    textAlign: "center",
    overflowWrap: "anywhere",
    lineHeight: 1.2,
  },

  filterLinkActive: {
    background: "linear-gradient(135deg, #1683f8 0%, #2563eb 100%)",
    color: "#ffffff",
    border: "1px solid #1683f8",
    boxShadow: "0 14px 28px rgba(22,131,248,0.20)",
  },

  incidentsPanel: {
    minWidth: 0,
    overflow: "hidden",
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
    gridTemplateColumns: "minmax(0, 1fr) minmax(0, 260px)",
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

  severityMedium: {
    background: "#fffbeb",
    color: "#92400e",
    border: "1px solid #fde68a",
  },

  severityLow: {
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

  publicPill: {
    display: "inline-flex",
    maxWidth: "100%",
    padding: "6px 9px",
    borderRadius: 999,
    background: "#f8fafc",
    color: "#475569",
    border: "1px solid #e2e8f0",
    fontSize: 11,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    overflowWrap: "anywhere",
  },

  publicPillLive: {
    background: "#ecfdf5",
    color: "#047857",
    border: "1px solid #a7f3d0",
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

  incidentIdBox: {
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

  incidentIdLabel: {
    color: "#64748b",
    fontSize: 11,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.06em",
  },

  incidentIdValue: {
    color: "#0f172a",
    fontSize: 12,
    lineHeight: 1.45,
    overflowWrap: "anywhere",
    wordBreak: "break-word",
  },

  statusPanel: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr)",
    gap: 12,
    alignItems: "center",
    padding: 14,
    borderRadius: 20,
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    minWidth: 0,
    maxWidth: "100%",
    overflow: "hidden",
  },

  statusPanelCopy: {
    minWidth: 0,
    maxWidth: "100%",
    overflow: "hidden",
  },

  statusPanelLabel: {
    margin: 0,
    color: "#0f172a",
    fontSize: 14,
    fontWeight: 950,
    overflowWrap: "anywhere",
  },

  statusPanelText: {
    margin: "4px 0 0",
    color: "#64748b",
    fontSize: 13,
    lineHeight: 1.45,
    fontWeight: 700,
    overflowWrap: "anywhere",
  },

  statusActions: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: 8,
    minWidth: 0,
    maxWidth: "100%",
  },

  statusForm: {
    display: "block",
    minWidth: 0,
    maxWidth: "100%",
  },

  statusButton: {
    width: "100%",
    minHeight: 40,
    padding: "9px 10px",
    borderRadius: 999,
    background: "#ffffff",
    color: "#0f172a",
    border: "1px solid #cbd5e1",
    fontSize: 12,
    fontWeight: 950,
    cursor: "pointer",
    textAlign: "center",
    lineHeight: 1.2,
    whiteSpace: "normal",
    overflowWrap: "anywhere",
  },

  statusButtonActive: {
    background: "linear-gradient(135deg, #1683f8 0%, #2563eb 100%)",
    color: "#ffffff",
    border: "1px solid #1683f8",
    cursor: "default",
  },

  publicPanel: {
    display: "grid",
    gap: 12,
    padding: 14,
    borderRadius: 20,
    background:
      "linear-gradient(135deg, rgba(22,163,74,0.10), rgba(255,255,255,1) 72%)",
    border: "1px solid #bbf7d0",
    minWidth: 0,
    maxWidth: "100%",
    overflow: "hidden",
  },

  publicHeader: {
    display: "grid",
    gap: 6,
    minWidth: 0,
  },

  publicKicker: {
    margin: 0,
    color: "#047857",
    fontSize: 11,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
  },

  publicTitle: {
    margin: 0,
    color: "#0f172a",
    fontSize: 18,
    fontWeight: 950,
    letterSpacing: "-0.035em",
    overflowWrap: "anywhere",
  },

  publicText: {
    margin: 0,
    color: "#166534",
    fontSize: 13,
    lineHeight: 1.45,
    fontWeight: 750,
    overflowWrap: "anywhere",
  },

  publicForm: {
    display: "grid",
    gap: 10,
    minWidth: 0,
  },

  publicActions: {
    display: "grid",
    gridTemplateColumns: "minmax(0, auto) minmax(0, auto)",
    justifyContent: "start",
    gap: 8,
    minWidth: 0,
  },

  publicButton: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 42,
    maxWidth: "100%",
    padding: "10px 14px",
    borderRadius: 999,
    background: "linear-gradient(135deg, #16a34a 0%, #047857 100%)",
    color: "#ffffff",
    border: "1px solid #16a34a",
    fontSize: 13,
    fontWeight: 950,
    cursor: "pointer",
    textAlign: "center",
    lineHeight: 1.2,
    whiteSpace: "normal",
    overflowWrap: "anywhere",
  },

  unpublishButton: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 42,
    maxWidth: "100%",
    padding: "10px 14px",
    borderRadius: 999,
    background: "#ffffff",
    color: "#991b1b",
    border: "1px solid #fecaca",
    fontSize: 13,
    fontWeight: 950,
    cursor: "pointer",
    textAlign: "center",
    lineHeight: 1.2,
    whiteSpace: "normal",
    overflowWrap: "anywhere",
  },

  detailGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
    gap: 10,
    minWidth: 0,
  },

  detailItem: {
    display: "grid",
    gap: 5,
    padding: 12,
    borderRadius: 16,
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    minWidth: 0,
    overflow: "hidden",
  },

  detailLabel: {
    color: "#64748b",
    fontSize: 11,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    overflowWrap: "anywhere",
  },

  detailValue: {
    color: "#0f172a",
    fontSize: 13,
    lineHeight: 1.4,
    overflowWrap: "anywhere",
    wordBreak: "break-word",
  },

  summaryBox: {
    display: "grid",
    gap: 7,
    padding: 15,
    borderRadius: 18,
    background: "#ffffff",
    border: "1px solid #cbd5e1",
    minWidth: 0,
    overflow: "hidden",
  },

  internalNotesBox: {
    display: "grid",
    gap: 7,
    padding: 15,
    borderRadius: 18,
    background:
      "linear-gradient(135deg, rgba(251,191,36,0.12), rgba(255,255,255,1) 72%)",
    border: "1px solid #fde68a",
    minWidth: 0,
    overflow: "hidden",
  },

  boxLabel: {
    margin: 0,
    color: "#64748b",
    fontSize: 11,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.06em",
  },

  boxText: {
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
