// src/app/admin/platform/support/page.tsx
// ===============================
// Platform Owner Support Dashboard
// Phase 5B.4 — status updates + internal notes + reply-to-tenant mailto action
// Mobile-safe, desktop-safe, platform-owner-only
// ===============================

import type { CSSProperties, ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type SupportFilter =
  | "all"
  | "new"
  | "in_progress"
  | "resolved"
  | "urgent"
  | "email_failed";

type SupportStatus = "new" | "in_progress" | "resolved";

type SupportSearchParams = {
  filter?: string | string[];
};

type PlatformSession = {
  user?: {
    email?: unknown;
    name?: unknown;
    isPlatformOwner?: unknown;
  } | null;
} | null;

type SupportRequestRow = {
  id: string;
  tenant_slug: string;
  admin_email: string | null;
  admin_name: string | null;
  category: string;
  urgency: string;
  subject: string;
  message: string;
  page_url: string | null;
  campaign_type: string | null;
  campaign_id: string | null;
  browser_context: string | null;
  status: string;
  email_status: string;
  email_error: string | null;
  internal_notes: string | null;
  created_at: string;
  updated_at: string;
};

type SupportSummaryRow = {
  total_count: string | number;
  new_count: string | number;
  in_progress_count: string | number;
  resolved_count: string | number;
  urgent_count: string | number;
  email_failed_count: string | number;
};

function firstParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0] || "";
  return value || "";
}

function normaliseFilter(value: unknown): SupportFilter {
  const clean = String(value || "").trim().toLowerCase();

  if (
    clean === "new" ||
    clean === "in_progress" ||
    clean === "resolved" ||
    clean === "urgent" ||
    clean === "email_failed"
  ) {
    return clean;
  }

  return "all";
}

function normaliseStatus(value: unknown): SupportStatus | null {
  const clean = String(value || "").trim().toLowerCase();

  if (clean === "new" || clean === "in_progress" || clean === "resolved") {
    return clean;
  }

  return null;
}

function isSafeUuid(value: unknown) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    String(value || "").trim(),
  );
}

function toNumber(value: string | number | null | undefined) {
  const numberValue = Number(value || 0);
  return Number.isFinite(numberValue) ? numberValue : 0;
}

function cleanText(value: unknown, fallback = "—") {
  const clean = String(value ?? "").trim();
  return clean || fallback;
}

function limitText(value: unknown, maxLength: number) {
  return String(value ?? "").trim().slice(0, maxLength);
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

function getFilterWhereClause(filter: SupportFilter) {
  if (filter === "new") {
    return "where status = 'new'";
  }

  if (filter === "in_progress") {
    return "where status = 'in_progress'";
  }

  if (filter === "resolved") {
    return "where status = 'resolved'";
  }

  if (filter === "urgent") {
    return "where urgency = 'urgent'";
  }

  if (filter === "email_failed") {
    return "where email_status = 'failed'";
  }

  return "";
}

function getFilterHref(filter: SupportFilter) {
  if (filter === "all") return "/admin/platform/support";
  return `/admin/platform/support?filter=${encodeURIComponent(filter)}`;
}

function getSafeEmail(value: unknown) {
  const clean = String(value || "")
    .replace(/[\r\n]/g, "")
    .trim();

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) {
    return "";
  }

  return clean;
}

function buildReplyToTenantHref(request: SupportRequestRow) {
  const email = getSafeEmail(request.admin_email);

  if (!email) return "";

  const greetingName = cleanText(request.admin_name, "").split(/\s+/)[0] || "";
  const greeting = greetingName ? `Hi ${greetingName},` : "Hello,";

  const subject = `SO Fundraising Platform support request ${request.id}`;

  const body = [
    greeting,
    "",
    "Thanks for contacting SO Fundraising Platform support.",
    "",
    `Support reference: ${request.id}`,
    `Tenant: ${request.tenant_slug}`,
    `Request subject: ${request.subject}`,
    "",
    "Reply:",
    "",
    "",
    "Kind regards,",
    "SO Fundraising Platform Support",
  ].join("\n");

  return `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(
    subject,
  )}&body=${encodeURIComponent(body)}`;
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

async function getSupportSummary() {
  const rows = await query<SupportSummaryRow>(
    `
      select
        count(*)::int as total_count,
        count(*) filter (where status = 'new')::int as new_count,
        count(*) filter (where status = 'in_progress')::int as in_progress_count,
        count(*) filter (where status = 'resolved')::int as resolved_count,
        count(*) filter (where urgency = 'urgent')::int as urgent_count,
        count(*) filter (where email_status = 'failed')::int as email_failed_count
      from support_requests
    `,
  );

  return (
    rows[0] || {
      total_count: 0,
      new_count: 0,
      in_progress_count: 0,
      resolved_count: 0,
      urgent_count: 0,
      email_failed_count: 0,
    }
  );
}

async function getSupportRequests(filter: SupportFilter) {
  const whereClause = getFilterWhereClause(filter);

  return query<SupportRequestRow>(
    `
      select
        id::text,
        tenant_slug,
        admin_email,
        admin_name,
        category,
        urgency,
        subject,
        message,
        page_url,
        campaign_type,
        campaign_id,
        browser_context,
        status,
        email_status,
        email_error,
        internal_notes,
        created_at::text,
        updated_at::text
      from support_requests
      ${whereClause}
      order by created_at desc
      limit 100
    `,
  );
}

async function updateSupportRequestStatus(formData: FormData) {
  "use server";

  await requirePlatformOwner();

  const requestId = String(formData.get("request_id") || "").trim();
  const nextStatus = normaliseStatus(formData.get("status"));
  const returnFilter = normaliseFilter(formData.get("return_filter"));

  if (!isSafeUuid(requestId) || !nextStatus) {
    redirect(getFilterHref(returnFilter));
  }

  await query(
    `
      update support_requests
      set
        status = $2,
        updated_at = now()
      where id = $1
    `,
    [requestId, nextStatus],
  );

  redirect(getFilterHref(returnFilter));
}

async function updateSupportRequestNotes(formData: FormData) {
  "use server";

  await requirePlatformOwner();

  const requestId = String(formData.get("request_id") || "").trim();
  const returnFilter = normaliseFilter(formData.get("return_filter"));
  const internalNotes = limitText(formData.get("internal_notes"), 5000);

  if (!isSafeUuid(requestId)) {
    redirect(getFilterHref(returnFilter));
  }

  await query(
    `
      update support_requests
      set
        internal_notes = $2,
        updated_at = now()
      where id = $1
    `,
    [requestId, internalNotes || null],
  );

  redirect(getFilterHref(returnFilter));
}

export default async function PlatformSupportDashboardPage({
  searchParams,
}: {
  searchParams?: Promise<SupportSearchParams>;
}) {
  await requirePlatformOwner();

  const resolvedSearchParams = searchParams ? await searchParams : {};
  const activeFilter = normaliseFilter(firstParam(resolvedSearchParams.filter));

  const [summary, requests] = await Promise.all([
    getSupportSummary(),
    getSupportRequests(activeFilter),
  ]);

  return (
    <main className="platform-support-page" style={styles.page}>
      <style>{responsiveStyles}</style>

      <section className="platform-support-hero" style={styles.hero}>
        <div style={styles.heroContent}>
          <Link href="/admin" style={styles.backLink}>
            ← Back to admin dashboard
          </Link>

          <div style={styles.badgeRow}>
            <span style={styles.badge}>Platform owner</span>
            <span style={styles.softBadge}>Support dashboard</span>
          </div>

          <h1
            className="so-brand-heading platform-support-title"
            style={styles.title}
          >
            Support requests
          </h1>

          <p style={styles.subtitle}>
            Review tenant support requests, update status, keep private notes
            and reply to tenant admins from your email client.
          </p>
        </div>

        <div className="platform-support-stats" style={styles.heroStats}>
          <StatCard
            label="Total requests"
            value={toNumber(summary.total_count)}
            dark
          />
          <StatCard label="New" value={toNumber(summary.new_count)} dark />
          <StatCard label="Urgent" value={toNumber(summary.urgent_count)} dark />
          <StatCard
            label="Email failed"
            value={toNumber(summary.email_failed_count)}
            dark
          />
        </div>
      </section>

      <section className="support-summary-grid" style={styles.summaryGrid}>
        <SummaryCard
          label="New"
          value={toNumber(summary.new_count)}
          text="Requests not yet processed"
        />

        <SummaryCard
          label="In progress"
          value={toNumber(summary.in_progress_count)}
          text="Requests currently being handled"
        />

        <SummaryCard
          label="Resolved"
          value={toNumber(summary.resolved_count)}
          text="Requests marked as complete"
        />

        <SummaryCard
          label="Urgent"
          value={toNumber(summary.urgent_count)}
          text="Live campaign or blocking issues"
        />

        <SummaryCard
          label="Email failed"
          value={toNumber(summary.email_failed_count)}
          text="Request stored but email delivery failed"
        />
      </section>

      <section style={styles.filterPanel}>
        <div>
          <p style={styles.kicker}>Filters</p>

          <h2 className="so-brand-card-title" style={styles.sectionTitle}>
            Request queue
          </h2>

          <p style={styles.sectionText}>
            Showing the latest 100 support requests for the selected filter.
            Status changes and notes update the request timestamp and keep the
            page in the same filter view.
          </p>
        </div>

        <div className="support-filter-grid" style={styles.filterGrid}>
          <FilterLink active={activeFilter === "all"} href="/admin/platform/support">
            All
          </FilterLink>

          <FilterLink
            active={activeFilter === "new"}
            href="/admin/platform/support?filter=new"
          >
            New
          </FilterLink>

          <FilterLink
            active={activeFilter === "in_progress"}
            href="/admin/platform/support?filter=in_progress"
          >
            In progress
          </FilterLink>

          <FilterLink
            active={activeFilter === "resolved"}
            href="/admin/platform/support?filter=resolved"
          >
            Resolved
          </FilterLink>

          <FilterLink
            active={activeFilter === "urgent"}
            href="/admin/platform/support?filter=urgent"
          >
            Urgent
          </FilterLink>

          <FilterLink
            active={activeFilter === "email_failed"}
            href="/admin/platform/support?filter=email_failed"
          >
            Email failed
          </FilterLink>
        </div>
      </section>

      <section style={styles.requestsPanel}>
        {requests.length > 0 ? (
          <div className="support-request-list" style={styles.requestList}>
            {requests.map((request) => (
              <SupportRequestCard
                key={request.id}
                request={request}
                activeFilter={activeFilter}
              />
            ))}
          </div>
        ) : (
          <div style={styles.emptyState}>
            <p style={styles.emptyTitle}>No support requests found</p>
            <p style={styles.emptyText}>
              There are no requests matching this filter yet.
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

function StatusButton({
  requestId,
  status,
  currentStatus,
  activeFilter,
  children,
}: {
  requestId: string;
  status: SupportStatus;
  currentStatus: string;
  activeFilter: SupportFilter;
  children: ReactNode;
}) {
  const active = currentStatus === status;

  return (
    <form action={updateSupportRequestStatus} style={styles.statusForm}>
      <input type="hidden" name="request_id" value={requestId} />
      <input type="hidden" name="status" value={status} />
      <input type="hidden" name="return_filter" value={activeFilter} />

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

function ReplyToTenantPanel({ request }: { request: SupportRequestRow }) {
  const href = buildReplyToTenantHref(request);
  const email = getSafeEmail(request.admin_email);

  return (
    <div className="support-reply-panel" style={styles.replyPanel}>
      <div style={styles.replyCopy}>
        <p style={styles.replyKicker}>Reply to tenant</p>
        <h3 style={styles.replyTitle}>Contact tenant admin</h3>
        <p style={styles.replyText}>
          This opens your email client with the support reference and request
          context filled in. No email is sent automatically by the platform.
        </p>
      </div>

      {href ? (
        <a href={href} style={styles.replyButton}>
          Reply to {email} →
        </a>
      ) : (
        <div style={styles.noReplyBox}>No tenant email recorded</div>
      )}
    </div>
  );
}

function SupportRequestCard({
  request,
  activeFilter,
}: {
  request: SupportRequestRow;
  activeFilter: SupportFilter;
}) {
  const hasOptionalContext =
    Boolean(request.page_url) ||
    Boolean(request.campaign_type) ||
    Boolean(request.campaign_id) ||
    Boolean(request.browser_context) ||
    Boolean(request.email_error);

  return (
    <article className="support-request-card" style={styles.requestCard}>
      <div className="support-request-top" style={styles.requestTop}>
        <div style={styles.requestTitleBlock}>
          <div style={styles.requestPills}>
            <span style={styles.tenantPill}>{request.tenant_slug}</span>

            <span
              style={{
                ...styles.statusPill,
                ...(request.status === "new"
                  ? styles.statusNew
                  : request.status === "resolved"
                    ? styles.statusResolved
                    : styles.statusDefault),
              }}
            >
              {formatLabel(request.status)}
            </span>

            <span
              style={{
                ...styles.urgencyPill,
                ...(request.urgency === "urgent"
                  ? styles.urgencyUrgent
                  : request.urgency === "high"
                    ? styles.urgencyHigh
                    : styles.urgencyDefault),
              }}
            >
              {formatLabel(request.urgency)}
            </span>

            <span
              style={{
                ...styles.emailPill,
                ...(request.email_status === "failed"
                  ? styles.emailFailed
                  : request.email_status === "sent"
                    ? styles.emailSent
                    : styles.emailPending),
              }}
            >
              Email {formatLabel(request.email_status)}
            </span>
          </div>

          <h2 style={styles.requestSubject}>{request.subject}</h2>

          <p style={styles.requestMeta}>
            {formatLabel(request.category)} · Created{" "}
            {formatDateTime(request.created_at)}
          </p>
        </div>

        <div style={styles.requestIdBox}>
          <span style={styles.requestIdLabel}>Reference</span>
          <strong style={styles.requestIdValue}>{request.id}</strong>
        </div>
      </div>

      <ReplyToTenantPanel request={request} />

      <div className="support-status-panel" style={styles.statusPanel}>
        <div style={styles.statusPanelCopy}>
          <p style={styles.statusPanelLabel}>Update status</p>
          <p style={styles.statusPanelText}>
            Status changes are platform-owner only and update the request
            timestamp.
          </p>
        </div>

        <div className="support-status-actions" style={styles.statusActions}>
          <StatusButton
            requestId={request.id}
            status="new"
            currentStatus={request.status}
            activeFilter={activeFilter}
          >
            New
          </StatusButton>

          <StatusButton
            requestId={request.id}
            status="in_progress"
            currentStatus={request.status}
            activeFilter={activeFilter}
          >
            In progress
          </StatusButton>

          <StatusButton
            requestId={request.id}
            status="resolved"
            currentStatus={request.status}
            activeFilter={activeFilter}
          >
            Resolved
          </StatusButton>
        </div>
      </div>

      <div className="support-detail-grid" style={styles.detailGrid}>
        <DetailItem label="Tenant" value={request.tenant_slug} />
        <DetailItem label="Admin email" value={cleanText(request.admin_email)} />
        <DetailItem label="Admin name" value={cleanText(request.admin_name)} />
        <DetailItem label="Category" value={formatLabel(request.category)} />
        <DetailItem label="Updated" value={formatDateTime(request.updated_at)} />
      </div>

      <div style={styles.messageBox}>
        <p style={styles.messageLabel}>Message</p>
        <p style={styles.messageText}>{request.message}</p>
      </div>

      <div style={styles.notesPanel}>
        <div style={styles.notesHeader}>
          <div>
            <p style={styles.notesKicker}>Internal notes</p>
            <h3 style={styles.notesTitle}>Private platform notes</h3>
            <p style={styles.notesText}>
              These notes are only shown on this platform-owner support
              dashboard. Tenant admins do not see them.
            </p>
          </div>
        </div>

        {request.internal_notes ? (
          <div style={styles.savedNotesBox}>
            <p style={styles.messageLabel}>Saved notes</p>
            <p style={styles.messageText}>{request.internal_notes}</p>
          </div>
        ) : null}

        <form action={updateSupportRequestNotes} style={styles.notesForm}>
          <input type="hidden" name="request_id" value={request.id} />
          <input type="hidden" name="return_filter" value={activeFilter} />

          <label style={styles.notesField}>
            <span style={styles.notesLabel}>Update internal notes</span>
            <textarea
              name="internal_notes"
              defaultValue={request.internal_notes || ""}
              maxLength={5000}
              rows={4}
              placeholder="Add private support notes, investigation updates, next actions, or contact history."
              style={styles.notesTextarea}
            />
          </label>

          <button type="submit" style={styles.notesButton}>
            Save internal notes →
          </button>
        </form>
      </div>

      {hasOptionalContext ? (
        <details style={styles.contextDetails}>
          <summary style={styles.contextSummary}>View request context</summary>

          <div className="support-detail-grid" style={styles.contextDetailGrid}>
            <DetailItem label="Page URL" value={cleanText(request.page_url)} />
            <DetailItem
              label="Campaign type"
              value={cleanText(request.campaign_type)}
            />
            <DetailItem label="Campaign ID" value={cleanText(request.campaign_id)} />
            <DetailItem label="Email error" value={cleanText(request.email_error)} />
          </div>

          {request.browser_context ? (
            <div style={styles.browserBox}>
              <p style={styles.messageLabel}>Browser / extra context</p>
              <p style={styles.messageText}>{request.browser_context}</p>
            </div>
          ) : null}
        </details>
      ) : null}

      <div style={styles.readOnlyNotice}>
        Status updates, internal notes and mailto replies are live. Controlled
        platform email replies can be added later.
      </div>
    </article>
  );
}

const responsiveStyles = `
.platform-support-page,
.platform-support-page * {
  box-sizing: border-box;
}

.platform-support-page {
  overflow-x: hidden;
}

.platform-support-page section,
.platform-support-page article,
.platform-support-page div,
.platform-support-page a,
.platform-support-page p,
.platform-support-page h1,
.platform-support-page h2,
.platform-support-page h3,
.platform-support-page strong,
.platform-support-page span,
.platform-support-page details,
.platform-support-page summary,
.platform-support-page form,
.platform-support-page label,
.platform-support-page textarea,
.platform-support-page button {
  min-width: 0;
  max-width: 100%;
}

.platform-support-page .support-request-card {
  overflow: hidden;
}

.platform-support-page .support-reply-panel {
  min-width: 0;
  max-width: 100%;
  overflow: hidden;
}

@media (max-width: 1080px) {
  .platform-support-page .platform-support-hero {
    grid-template-columns: 1fr !important;
  }

  .platform-support-page .platform-support-stats,
  .platform-support-page .support-summary-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
  }

  .platform-support-page .support-filter-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
  }

  .platform-support-page .support-detail-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
  }

  .platform-support-page .support-request-top,
  .platform-support-page .support-reply-panel,
  .platform-support-page .support-status-panel {
    grid-template-columns: 1fr !important;
  }

  .platform-support-page .support-reply-panel a,
  .platform-support-page .support-reply-panel div:last-child {
    justify-self: stretch !important;
    width: 100% !important;
  }
}

@media (max-width: 760px) {
  .platform-support-page {
    padding: 18px 12px 44px !important;
  }

  .platform-support-page .platform-support-title {
    font-size: clamp(38px, 11vw, 58px) !important;
    line-height: 0.98 !important;
  }

  .platform-support-page .platform-support-hero,
  .platform-support-page .support-request-card {
    padding: 18px !important;
    border-radius: 24px !important;
  }

  .platform-support-page .platform-support-stats,
  .platform-support-page .support-summary-grid,
  .platform-support-page .support-filter-grid,
  .platform-support-page .support-detail-grid,
  .platform-support-page .support-status-actions {
    grid-template-columns: 1fr !important;
  }

  .platform-support-page .support-status-panel,
  .platform-support-page .support-notes-panel,
  .platform-support-page .support-reply-panel {
    padding: 12px !important;
    border-radius: 18px !important;
  }

  .platform-support-page .support-request-card p,
  .platform-support-page .support-request-card strong,
  .platform-support-page .support-request-card span,
  .platform-support-page .support-request-card summary,
  .platform-support-page .support-request-card button,
  .platform-support-page .support-request-card textarea,
  .platform-support-page .support-request-card a {
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

  filterGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(6, minmax(0, 1fr))",
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

  requestsPanel: {
    minWidth: 0,
    overflow: "hidden",
  },

  requestList: {
    display: "grid",
    gap: 14,
    minWidth: 0,
  },

  requestCard: {
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

  requestTop: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) minmax(0, 260px)",
    gap: 14,
    alignItems: "start",
    minWidth: 0,
  },

  requestTitleBlock: {
    minWidth: 0,
    overflow: "hidden",
  },

  requestPills: {
    display: "flex",
    gap: 7,
    flexWrap: "wrap",
    alignItems: "center",
    marginBottom: 10,
    minWidth: 0,
  },

  tenantPill: {
    display: "inline-flex",
    maxWidth: "100%",
    padding: "6px 9px",
    borderRadius: 999,
    background: "#eff6ff",
    color: "#1d4ed8",
    border: "1px solid #bfdbfe",
    fontSize: 11,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    overflowWrap: "anywhere",
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

  statusNew: {
    background: "#dcfce7",
    color: "#166534",
    border: "1px solid #86efac",
  },

  statusResolved: {
    background: "#f1f5f9",
    color: "#334155",
    border: "1px solid #cbd5e1",
  },

  statusDefault: {
    background: "#fffbeb",
    color: "#92400e",
    border: "1px solid #fde68a",
  },

  urgencyPill: {
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

  urgencyUrgent: {
    background: "#fef2f2",
    color: "#991b1b",
    border: "1px solid #fecaca",
  },

  urgencyHigh: {
    background: "#fff7ed",
    color: "#9a3412",
    border: "1px solid #fed7aa",
  },

  urgencyDefault: {
    background: "#f8fafc",
    color: "#475569",
    border: "1px solid #e2e8f0",
  },

  emailPill: {
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

  emailSent: {
    background: "#ecfdf5",
    color: "#047857",
    border: "1px solid #a7f3d0",
  },

  emailPending: {
    background: "#f8fafc",
    color: "#475569",
    border: "1px solid #e2e8f0",
  },

  emailFailed: {
    background: "#fef2f2",
    color: "#991b1b",
    border: "1px solid #fecaca",
  },

  requestSubject: {
    margin: 0,
    color: "#0f172a",
    fontSize: 25,
    lineHeight: 1.15,
    letterSpacing: "-0.045em",
    overflowWrap: "anywhere",
    wordBreak: "break-word",
  },

  requestMeta: {
    margin: "8px 0 0",
    color: "#64748b",
    fontSize: 13,
    lineHeight: 1.45,
    fontWeight: 800,
    overflowWrap: "anywhere",
  },

  requestIdBox: {
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

  requestIdLabel: {
    color: "#64748b",
    fontSize: 11,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.06em",
  },

  requestIdValue: {
    color: "#0f172a",
    fontSize: 12,
    lineHeight: 1.45,
    overflowWrap: "anywhere",
    wordBreak: "break-word",
  },

  replyPanel: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) minmax(220px, auto)",
    gap: 12,
    alignItems: "center",
    padding: 14,
    borderRadius: 20,
    background:
      "linear-gradient(135deg, rgba(37,99,235,0.08), rgba(255,255,255,1) 72%)",
    border: "1px solid #bfdbfe",
    minWidth: 0,
    maxWidth: "100%",
    overflow: "hidden",
  },

  replyCopy: {
    display: "grid",
    gap: 5,
    minWidth: 0,
    maxWidth: "100%",
    overflow: "hidden",
  },

  replyKicker: {
    margin: 0,
    color: "#2563eb",
    fontSize: 11,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    overflowWrap: "anywhere",
  },

  replyTitle: {
    margin: 0,
    color: "#0f172a",
    fontSize: 18,
    fontWeight: 950,
    letterSpacing: "-0.035em",
    overflowWrap: "anywhere",
  },

  replyText: {
    margin: 0,
    color: "#1e40af",
    fontSize: 13,
    lineHeight: 1.45,
    fontWeight: 750,
    overflowWrap: "anywhere",
  },

  replyButton: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    justifySelf: "end",
    minHeight: 42,
    maxWidth: "100%",
    padding: "10px 14px",
    borderRadius: 999,
    background: "linear-gradient(135deg, #1683f8 0%, #2563eb 100%)",
    color: "#ffffff",
    border: "1px solid #1683f8",
    textDecoration: "none",
    fontSize: 13,
    fontWeight: 950,
    textAlign: "center",
    lineHeight: 1.2,
    whiteSpace: "normal",
    overflowWrap: "anywhere",
  },

  noReplyBox: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    justifySelf: "end",
    minHeight: 42,
    maxWidth: "100%",
    padding: "10px 14px",
    borderRadius: 999,
    background: "#f8fafc",
    color: "#64748b",
    border: "1px solid #cbd5e1",
    fontSize: 13,
    fontWeight: 950,
    textAlign: "center",
    lineHeight: 1.2,
    whiteSpace: "normal",
    overflowWrap: "anywhere",
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

  detailGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
    gap: 10,
    minWidth: 0,
  },

  contextDetailGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
    gap: 10,
    minWidth: 0,
    marginTop: 12,
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

  notesPanel: {
    display: "grid",
    gap: 12,
    padding: 14,
    borderRadius: 20,
    background:
      "linear-gradient(135deg, rgba(251,191,36,0.12), rgba(255,255,255,1) 72%)",
    border: "1px solid #fde68a",
    minWidth: 0,
    maxWidth: "100%",
    overflow: "hidden",
  },

  notesHeader: {
    display: "grid",
    gap: 6,
    minWidth: 0,
  },

  notesKicker: {
    margin: 0,
    color: "#b45309",
    fontSize: 11,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
  },

  notesTitle: {
    margin: 0,
    color: "#0f172a",
    fontSize: 18,
    fontWeight: 950,
    letterSpacing: "-0.035em",
    overflowWrap: "anywhere",
  },

  notesText: {
    margin: 0,
    color: "#78350f",
    fontSize: 13,
    lineHeight: 1.45,
    fontWeight: 750,
    overflowWrap: "anywhere",
  },

  savedNotesBox: {
    display: "grid",
    gap: 7,
    padding: 14,
    borderRadius: 16,
    background: "#ffffff",
    border: "1px solid #fde68a",
    minWidth: 0,
    overflow: "hidden",
  },

  notesForm: {
    display: "grid",
    gap: 10,
    minWidth: 0,
  },

  notesField: {
    display: "grid",
    gap: 7,
    minWidth: 0,
  },

  notesLabel: {
    color: "#92400e",
    fontSize: 12,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    overflowWrap: "anywhere",
  },

  notesTextarea: {
    width: "100%",
    minWidth: 0,
    maxWidth: "100%",
    borderRadius: 16,
    border: "1px solid #fcd34d",
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

  notesButton: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    justifySelf: "start",
    minHeight: 42,
    padding: "10px 14px",
    borderRadius: 999,
    background: "#0f172a",
    color: "#ffffff",
    border: "1px solid #0f172a",
    fontSize: 13,
    fontWeight: 950,
    cursor: "pointer",
    textAlign: "center",
    lineHeight: 1.2,
    whiteSpace: "normal",
    overflowWrap: "anywhere",
  },

  contextDetails: {
    borderRadius: 18,
    background: "#fffbeb",
    border: "1px solid #fde68a",
    padding: 14,
    minWidth: 0,
    overflow: "hidden",
  },

  contextSummary: {
    cursor: "pointer",
    color: "#92400e",
    fontSize: 13,
    fontWeight: 950,
    overflowWrap: "anywhere",
  },

  browserBox: {
    display: "grid",
    gap: 7,
    marginTop: 10,
    padding: 14,
    borderRadius: 16,
    background: "#ffffff",
    border: "1px solid #fde68a",
    minWidth: 0,
    overflow: "hidden",
  },

  readOnlyNotice: {
    padding: 12,
    borderRadius: 16,
    background: "#eff6ff",
    color: "#1e40af",
    border: "1px solid #bfdbfe",
    fontSize: 13,
    fontWeight: 850,
    lineHeight: 1.45,
    overflowWrap: "anywhere",
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
