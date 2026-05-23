// src/app/admin/support/page.tsx
// ===============================
// Admin Help & Support
// Tenant-isolated support request form
// ===============================

import type { CSSProperties, ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { query } from "@/lib/db";
import { getTenantSlugFromHeaders } from "@/lib/tenant";
import { sendPlatformSupportRequestEmail } from "@/lib/support-email";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type SupportSearchParams = {
  support?: string | string[];
  ref?: string | string[];
};

type SupportRequestInsertRow = {
  id: string;
};

function cleanText(value: unknown, fallback = "") {
  const clean = String(value ?? "").trim();
  return clean || fallback;
}

function limitText(value: unknown, maxLength: number) {
  return cleanText(value).slice(0, maxLength);
}

function firstParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0] || "";
  return value || "";
}

function getSessionTenantSlugs(session: Awaited<ReturnType<typeof auth>>) {
  return Array.isArray(session?.user?.tenantSlugs)
    ? session.user.tenantSlugs.map((value) => String(value))
    : [];
}

function getSessionUserEmail(session: Awaited<ReturnType<typeof auth>>) {
  return cleanText(session?.user?.email, "");
}

function getSessionUserName(session: Awaited<ReturnType<typeof auth>>) {
  return cleanText(session?.user?.name, "");
}

function isAllowedCategory(value: string) {
  return [
    "general",
    "bug",
    "payment_or_finance",
    "campaign_setup",
    "tenant_or_login",
    "design_or_branding",
    "feature_request",
  ].includes(value);
}

function isAllowedUrgency(value: string) {
  return ["low", "normal", "high", "urgent"].includes(value);
}

function normaliseCategory(value: unknown) {
  const clean = cleanText(value, "general").toLowerCase();
  return isAllowedCategory(clean) ? clean : "general";
}

function normaliseUrgency(value: unknown) {
  const clean = cleanText(value, "normal").toLowerCase();
  return isAllowedUrgency(clean) ? clean : "normal";
}

function supportStatusMessage(status: string, ref: string) {
  if (status === "sent") {
    return {
      tone: "success" as const,
      title: "Support request sent",
      text: ref
        ? `Your support request has been recorded and emailed to platform support. Reference: ${ref}`
        : "Your support request has been recorded and emailed to platform support.",
    };
  }

  if (status === "saved_email_failed") {
    return {
      tone: "warning" as const,
      title: "Request saved, email needs checking",
      text: ref
        ? `Your request was saved, but the support email could not be sent automatically. Reference: ${ref}`
        : "Your request was saved, but the support email could not be sent automatically.",
    };
  }

  if (status === "validation_error") {
    return {
      tone: "error" as const,
      title: "Please check the form",
      text: "A subject and message are required before a support request can be sent.",
    };
  }

  if (status === "error") {
    return {
      tone: "error" as const,
      title: "Support request was not sent",
      text: "Something went wrong while saving the request. Please try again.",
    };
  }

  return null;
}

async function createSupportRequest(formData: FormData) {
  "use server";

  const session = await auth();

  if (!session?.user) {
    redirect("/admin/login");
  }

  const tenantSlug = await getTenantSlugFromHeaders();

  const sessionTenantSlugs = getSessionTenantSlugs(session);

  if (!tenantSlug || !sessionTenantSlugs.includes(tenantSlug)) {
    redirect("/admin/login?error=tenant_access_denied");
  }

  const adminEmail = getSessionUserEmail(session);
  const adminName = getSessionUserName(session);

  const category = normaliseCategory(formData.get("category"));
  const urgency = normaliseUrgency(formData.get("urgency"));
  const subject = limitText(formData.get("subject"), 180);
  const message = limitText(formData.get("message"), 5000);
  const pageUrl = limitText(formData.get("page_url"), 600);
  const campaignType = limitText(formData.get("campaign_type"), 80);
  const campaignId = limitText(formData.get("campaign_id"), 160);
  const browserContext = limitText(formData.get("browser_context"), 2000);

  if (!subject || !message) {
    redirect("/admin/support?support=validation_error");
  }

  let requestId = "";

  try {
    const rows = await query<SupportRequestInsertRow>(
      `
        insert into support_requests (
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
          email_status
        )
        values (
          $1,
          $2,
          $3,
          $4,
          $5,
          $6,
          $7,
          $8,
          $9,
          $10,
          $11,
          'new',
          'pending'
        )
        returning id::text
      `,
      [
        tenantSlug,
        adminEmail || null,
        adminName || null,
        category,
        urgency,
        subject,
        message,
        pageUrl || null,
        campaignType || null,
        campaignId || null,
        browserContext || null,
      ],
    );

    requestId = rows[0]?.id || "";
  } catch (error) {
    console.error("Support request insert failed", error);
    redirect("/admin/support?support=error");
  }

  if (!requestId) {
    redirect("/admin/support?support=error");
  }

  let emailFailed = false;

  try {
    await sendPlatformSupportRequestEmail({
      requestId,
      tenantSlug,
      adminEmail,
      adminName,
      category,
      urgency,
      subject,
      message,
      pageUrl,
      campaignType,
      campaignId,
      browserContext,
    });

    await query(
      `
        update support_requests
        set
          email_status = 'sent',
          email_error = null,
          updated_at = now()
        where id = $1
          and tenant_slug = $2
      `,
      [requestId, tenantSlug],
    );
  } catch (emailError) {
    emailFailed = true;

    console.error("Support request email failed", emailError);

    try {
      await query(
        `
          update support_requests
          set
            email_status = 'failed',
            email_error = $3,
            updated_at = now()
          where id = $1
            and tenant_slug = $2
        `,
        [
          requestId,
          tenantSlug,
          emailError instanceof Error
            ? emailError.message.slice(0, 1000)
            : "Support email failed",
        ],
      );
    } catch (updateError) {
      console.error("Support request email failure update failed", updateError);
    }
  }

  if (emailFailed) {
    redirect(
      `/admin/support?support=saved_email_failed&ref=${encodeURIComponent(
        requestId,
      )}`,
    );
  }

  redirect(`/admin/support?support=sent&ref=${encodeURIComponent(requestId)}`);
}

export default async function AdminSupportPage({
  searchParams,
}: {
  searchParams?: Promise<SupportSearchParams>;
}) {
  const session = await auth();

  if (!session?.user) {
    redirect("/admin/login");
  }

  const tenantSlug = await getTenantSlugFromHeaders();

  const sessionTenantSlugs = getSessionTenantSlugs(session);

  if (!tenantSlug || !sessionTenantSlugs.includes(tenantSlug)) {
    redirect("/admin/login?error=tenant_access_denied");
  }

  const resolvedSearchParams = searchParams ? await searchParams : {};
  const status = firstParam(resolvedSearchParams.support);
  const ref = firstParam(resolvedSearchParams.ref);
  const statusMessage = supportStatusMessage(status, ref);

  const adminEmail = getSessionUserEmail(session);
  const adminName = getSessionUserName(session);

  return (
    <main className="admin-support-page" style={styles.page}>
      <style>{responsiveStyles}</style>

      <section className="support-hero" style={styles.hero}>
        <div style={styles.heroContent}>
          <Link href="/admin" style={styles.backLink}>
            ← Back to dashboard
          </Link>

          <div style={styles.badgeRow}>
            <span style={styles.badge}>Help & Support</span>
            <span style={styles.softBadge}>Phase 5A</span>
          </div>

          <h1 className="so-brand-heading support-title" style={styles.title}>
            Admin Help & Support
          </h1>

          <p style={styles.subtitle}>
            Report a problem, ask for help, or send useful operational context
            to platform support without leaving the admin area.
          </p>

          <p style={styles.tenant}>
            Tenant: <strong>{tenantSlug}</strong>
          </p>
        </div>

        <div className="support-hero-stats" style={styles.heroStats}>
          <StatCard label="Tenant context" value="Included" dark />
          <StatCard label="Support email" value="Automatic" dark />
          <StatCard label="Database record" value="Stored" dark />
        </div>
      </section>

      {statusMessage ? (
        <section
          style={{
            ...styles.statusPanel,
            ...(statusMessage.tone === "success"
              ? styles.statusSuccess
              : statusMessage.tone === "warning"
                ? styles.statusWarning
                : styles.statusError),
          }}
        >
          <h2 style={styles.statusTitle}>{statusMessage.title}</h2>
          <p style={styles.statusText}>{statusMessage.text}</p>
        </section>
      ) : null}

      <section className="support-options-grid" style={styles.optionsGrid}>
        <SupportOption
          label="Report a problem"
          title="Something is not working"
          text="Send the platform support team a clear issue report with tenant, page and campaign context."
        />

        <SupportOption
          label="Ask for help"
          title="Need support using a feature?"
          text="Use this for setup questions, admin workflows, campaign configuration or account support."
        />

        <SupportOption
          label="Incident-ready"
          title="Start building a support trail"
          text="Each request is stored so a future incident/status log can be added without changing checkout flows."
        />
      </section>

      <section className="support-layout" style={styles.layoutGrid}>
        <section className="support-form-panel" style={styles.formPanel}>
          <div style={styles.sectionHeader}>
            <p style={styles.kicker}>Report a problem</p>

            <h2 className="so-brand-card-title" style={styles.sectionTitle}>
              Send a support request
            </h2>

            <p style={styles.sectionText}>
              Include the page, campaign or browser context if it helps. Your
              tenant and admin details are included automatically.
            </p>
          </div>

          <form action={createSupportRequest} style={styles.form}>
            <div className="support-form-grid" style={styles.formGrid}>
              <label style={styles.field}>
                <span style={styles.label}>Category</span>
                <select name="category" defaultValue="general" style={styles.input}>
                  <option value="general">General support</option>
                  <option value="bug">Bug / something broken</option>
                  <option value="payment_or_finance">
                    Payment or finance question
                  </option>
                  <option value="campaign_setup">Campaign setup</option>
                  <option value="tenant_or_login">Tenant or login access</option>
                  <option value="design_or_branding">Design or branding</option>
                  <option value="feature_request">Feature request</option>
                </select>
              </label>

              <label style={styles.field}>
                <span style={styles.label}>Urgency</span>
                <select name="urgency" defaultValue="normal" style={styles.input}>
                  <option value="low">Low — question or suggestion</option>
                  <option value="normal">Normal — needs support</option>
                  <option value="high">High — blocking admin work</option>
                  <option value="urgent">Urgent — live campaign affected</option>
                </select>
              </label>
            </div>

            <label style={styles.field}>
              <span style={styles.label}>Subject</span>
              <input
                name="subject"
                type="text"
                required
                maxLength={180}
                placeholder="Brief summary of the issue"
                style={styles.input}
              />
            </label>

            <label style={styles.field}>
              <span style={styles.label}>Message</span>
              <textarea
                name="message"
                required
                maxLength={5000}
                rows={8}
                placeholder="Describe what happened, what you expected, and any steps that caused the issue."
                style={styles.textarea}
              />
            </label>

            <div className="support-form-grid" style={styles.formGrid}>
              <label style={styles.field}>
                <span style={styles.label}>Page URL</span>
                <input
                  name="page_url"
                  type="text"
                  maxLength={600}
                  placeholder="/admin/events/..."
                  style={styles.input}
                />
              </label>

              <label style={styles.field}>
                <span style={styles.label}>Campaign type</span>
                <select name="campaign_type" defaultValue="" style={styles.input}>
                  <option value="">Not campaign-specific</option>
                  <option value="raffle">Raffle</option>
                  <option value="squares">Squares</option>
                  <option value="event">Event</option>
                  <option value="auction">Auction</option>
                  <option value="donation">Donation / support page</option>
                  <option value="tenant">Tenant/admin area</option>
                </select>
              </label>
            </div>

            <label style={styles.field}>
              <span style={styles.label}>Campaign ID or slug</span>
              <input
                name="campaign_id"
                type="text"
                maxLength={160}
                placeholder="Optional campaign ID, slug, order reference or page identifier"
                style={styles.input}
              />
            </label>

            <label style={styles.field}>
              <span style={styles.label}>Browser / extra context</span>
              <textarea
                name="browser_context"
                maxLength={2000}
                rows={4}
                placeholder="Optional: device, browser, screenshot notes, error text, or what the admin was doing."
                style={styles.textarea}
              />
            </label>

            <button type="submit" style={styles.submitButton}>
              Send support request →
            </button>
          </form>
        </section>

        <aside className="support-context-panel" style={styles.contextPanel}>
          <div>
            <p style={styles.contextKicker}>Included automatically</p>

            <h2 className="so-brand-card-title" style={styles.contextTitle}>
              Request context
            </h2>

            <p style={styles.contextText}>
              These details are attached to the support request so issues can be
              traced without exposing unrelated tenant data.
            </p>
          </div>

          <div style={styles.contextList}>
            <ContextItem label="Tenant" value={tenantSlug} />
            <ContextItem label="Admin email" value={adminEmail || "Not recorded"} />
            <ContextItem label="Admin name" value={adminName || "Not recorded"} />
            <ContextItem label="Request storage" value="support_requests" />
            <ContextItem label="Default status" value="New" />
          </div>

          <div style={styles.noticeBox}>
            <p style={styles.noticeTitle}>Safe first version</p>
            <p style={styles.noticeText}>
              This page only records and emails support requests. Incident logs,
              support dashboards and status reporting can be layered on later.
            </p>
          </div>
        </aside>
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

function SupportOption({
  label,
  title,
  text,
}: {
  label: string;
  title: string;
  text: string;
}) {
  return (
    <article style={styles.optionCard}>
      <p style={styles.optionLabel}>{label}</p>
      <h2 style={styles.optionTitle}>{title}</h2>
      <p style={styles.optionText}>{text}</p>
    </article>
  );
}

function ContextItem({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div style={styles.contextItem}>
      <span style={styles.contextLabel}>{label}</span>
      <strong style={styles.contextValue}>{value}</strong>
    </div>
  );
}

const responsiveStyles = `
.admin-support-page,
.admin-support-page * {
  box-sizing: border-box;
}

.admin-support-page {
  overflow-x: hidden;
}

.admin-support-page section,
.admin-support-page article,
.admin-support-page div,
.admin-support-page a,
.admin-support-page form,
.admin-support-page label,
.admin-support-page input,
.admin-support-page select,
.admin-support-page textarea,
.admin-support-page button {
  min-width: 0;
}

@media (max-width: 1040px) {
  .admin-support-page .support-hero,
  .admin-support-page .support-layout {
    grid-template-columns: 1fr !important;
  }

  .admin-support-page .support-hero-stats {
    grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
  }
}

@media (max-width: 760px) {
  .admin-support-page {
    padding: 18px 12px 44px !important;
  }

  .admin-support-page .support-title {
    font-size: clamp(38px, 11vw, 58px) !important;
    line-height: 0.98 !important;
  }

  .admin-support-page .support-hero {
    padding: 22px !important;
    border-radius: 28px !important;
  }

  .admin-support-page .support-options-grid,
  .admin-support-page .support-form-grid,
  .admin-support-page .support-hero-stats {
    grid-template-columns: 1fr !important;
  }

  .admin-support-page .support-form-panel,
  .admin-support-page .support-context-panel {
    padding: 18px !important;
    border-radius: 24px !important;
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
    gridTemplateColumns: "minmax(0, 1.2fr) minmax(300px, 0.8fr)",
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

  tenant: {
    margin: "16px 0 0",
    color: "#bfdbfe",
    fontSize: 14,
    fontWeight: 850,
    overflowWrap: "anywhere",
  },

  heroStats: {
    display: "grid",
    gridTemplateColumns: "1fr",
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

  statusPanel: {
    display: "grid",
    gap: 6,
    padding: 18,
    borderRadius: 24,
    border: "1px solid transparent",
    marginBottom: 18,
  },

  statusSuccess: {
    background: "#ecfdf5",
    borderColor: "#bbf7d0",
  },

  statusWarning: {
    background: "#fffbeb",
    borderColor: "#fde68a",
  },

  statusError: {
    background: "#fef2f2",
    borderColor: "#fecaca",
  },

  statusTitle: {
    margin: 0,
    color: "#0f172a",
    fontSize: 22,
    letterSpacing: "-0.04em",
  },

  statusText: {
    margin: 0,
    color: "#475569",
    lineHeight: 1.55,
    fontWeight: 750,
    overflowWrap: "anywhere",
  },

  optionsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: 12,
    marginBottom: 18,
  },

  optionCard: {
    display: "grid",
    gap: 8,
    padding: 18,
    borderRadius: 24,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    boxShadow: "0 8px 30px rgba(15,23,42,0.05)",
  },

  optionLabel: {
    margin: 0,
    color: "#2563eb",
    fontSize: 12,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
  },

  optionTitle: {
    margin: 0,
    color: "#0f172a",
    fontSize: 22,
    letterSpacing: "-0.04em",
  },

  optionText: {
    margin: 0,
    color: "#64748b",
    lineHeight: 1.55,
    fontSize: 14,
    fontWeight: 700,
  },

  layoutGrid: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1.25fr) minmax(320px, 0.75fr)",
    gap: 16,
    alignItems: "start",
  },

  formPanel: {
    display: "grid",
    gap: 18,
    padding: 22,
    borderRadius: 28,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    boxShadow: "0 8px 30px rgba(15,23,42,0.05)",
  },

  sectionHeader: {
    display: "grid",
    gap: 6,
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
    margin: 0,
    color: "#0f172a",
    fontSize: 30,
    letterSpacing: "-0.05em",
    overflowWrap: "anywhere",
  },

  sectionText: {
    margin: 0,
    color: "#64748b",
    lineHeight: 1.6,
    maxWidth: 800,
    fontWeight: 700,
    overflowWrap: "anywhere",
  },

  form: {
    display: "grid",
    gap: 14,
  },

  formGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 12,
  },

  field: {
    display: "grid",
    gap: 7,
  },

  label: {
    color: "#334155",
    fontSize: 13,
    fontWeight: 950,
  },

  input: {
    width: "100%",
    minHeight: 48,
    borderRadius: 16,
    border: "1px solid #cbd5e1",
    background: "#ffffff",
    color: "#0f172a",
    padding: "12px 14px",
    fontSize: 15,
    fontWeight: 700,
    outline: "none",
  },

  textarea: {
    width: "100%",
    borderRadius: 16,
    border: "1px solid #cbd5e1",
    background: "#ffffff",
    color: "#0f172a",
    padding: "12px 14px",
    fontSize: 15,
    fontWeight: 700,
    lineHeight: 1.5,
    resize: "vertical",
    outline: "none",
  },

  submitButton: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    justifySelf: "start",
    minHeight: 52,
    padding: "13px 20px",
    borderRadius: 999,
    background: "linear-gradient(135deg, #1683f8 0%, #2563eb 100%)",
    color: "#ffffff",
    border: "1px solid #1683f8",
    fontSize: 15,
    fontWeight: 950,
    cursor: "pointer",
    boxShadow: "0 14px 28px rgba(22,131,248,0.24)",
  },

  contextPanel: {
    display: "grid",
    gap: 18,
    padding: 22,
    borderRadius: 28,
    background:
      "linear-gradient(135deg, rgba(251,191,36,0.12) 0%, rgba(255,255,255,1) 76%)",
    border: "1px solid #fde68a",
    boxShadow: "0 8px 30px rgba(15,23,42,0.05)",
  },

  contextKicker: {
    margin: "0 0 7px",
    color: "#b45309",
    fontSize: 12,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
  },

  contextTitle: {
    margin: 0,
    color: "#0f172a",
    fontSize: 28,
    letterSpacing: "-0.05em",
    overflowWrap: "anywhere",
  },

  contextText: {
    margin: "8px 0 0",
    color: "#78350f",
    lineHeight: 1.6,
    fontWeight: 700,
    overflowWrap: "anywhere",
  },

  contextList: {
    display: "grid",
    gap: 10,
  },

  contextItem: {
    display: "grid",
    gap: 5,
    padding: 13,
    borderRadius: 16,
    background: "#ffffff",
    border: "1px solid #fde68a",
  },

  contextLabel: {
    color: "#92400e",
    fontSize: 12,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.05em",
  },

  contextValue: {
    color: "#0f172a",
    fontSize: 14,
    lineHeight: 1.45,
    overflowWrap: "anywhere",
  },

  noticeBox: {
    display: "grid",
    gap: 7,
    padding: 16,
    borderRadius: 20,
    background: "#eff6ff",
    border: "1px solid #bfdbfe",
  },

  noticeTitle: {
    margin: 0,
    color: "#1e3a8a",
    fontSize: 15,
    fontWeight: 950,
  },

  noticeText: {
    margin: 0,
    color: "#1e40af",
    lineHeight: 1.55,
    fontSize: 14,
    fontWeight: 750,
  },
};
