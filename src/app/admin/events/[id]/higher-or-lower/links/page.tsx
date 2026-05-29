import type { CSSProperties } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { query, queryOne } from "@/lib/db";
import { sendHigherOrLowerPlayerLinkEmail } from "@/lib/email";
import { getTenantSlugFromHeaders } from "@/lib/tenant";
import { getEventById } from "../../../../../../../api/_lib/events-repo";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type PageProps = {
  params: {
    id: string;
  };
  searchParams?: {
    error?: string;
    success?: string;
  };
};

type GameSession = {
  id: string;
  title: string;
  status: string;
};

type PlayerLinkRow = {
  id: string;
  entry_number: number;
  player_name: string | null;
  player_email: string | null;
  status: string;
  eliminated_round_number: number | null;
  public_answer_token: string | null;
  event_order_id: string | null;
  event_order_item_id: string | null;
  order_status: string | null;
  created_at: string;
};

type EmailBranding = {
  name?: string | null;
  logoUrl?: string | null;
  primaryColor?: string | null;
};

type TenantEmailBrandingRow = {
  public_display_name: string | null;
  public_logo_url: string | null;
  public_logo_mark_url: string | null;
  public_primary_colour: string | null;
};

function cleanText(value: unknown) {
  return String(value || "").trim();
}

function normaliseHexColour(value: unknown, fallback: string) {
  const clean = cleanText(value).toUpperCase();

  if (/^#[0-9A-F]{6}$/.test(clean)) {
    return clean;
  }

  return fallback;
}

function statusLabel(value: string | null | undefined) {
  const clean = cleanText(value).toLowerCase();

  if (clean === "draft") return "Draft";
  if (clean === "live") return "Live";
  if (clean === "paused") return "Paused";
  if (clean === "closed") return "Closed";
  if (clean === "active") return "Active";
  if (clean === "winner") return "Winner";
  if (clean === "eliminated") return "Eliminated";
  if (clean === "paid") return "Paid";
  if (clean === "pending") return "Pending";
  if (clean === "checkout_started") return "Checkout started";

  return clean || "Unknown";
}

function statusStyle(value: string | null | undefined): CSSProperties {
  const clean = cleanText(value).toLowerCase();

  if (clean === "active" || clean === "paid" || clean === "live") {
    return {
      background: "#dcfce7",
      color: "#166534",
      borderColor: "#bbf7d0",
    };
  }

  if (clean === "winner") {
    return {
      background: "#fef3c7",
      color: "#92400e",
      borderColor: "#fde68a",
    };
  }

  if (clean === "closed" || clean === "eliminated") {
    return {
      background: "#fee2e2",
      color: "#991b1b",
      borderColor: "#fecaca",
    };
  }

  return {
    background: "#eff6ff",
    color: "#1d4ed8",
    borderColor: "#bfdbfe",
  };
}

function getPublicBaseUrl() {
  const explicit =
    cleanText(process.env.NEXT_PUBLIC_SITE_URL) ||
    cleanText(process.env.NEXT_PUBLIC_APP_URL) ||
    cleanText(process.env.APP_URL);

  if (explicit) {
    return explicit.replace(/\/+$/, "");
  }

  const vercelUrl = cleanText(process.env.VERCEL_URL);

  if (vercelUrl) {
    return `https://${vercelUrl}`.replace(/\/+$/, "");
  }

  return "https://so-fundraising-platform.vercel.app";
}

function playerAnswerUrl(eventSlug: string, token: string | null | undefined) {
  const cleanToken = cleanText(token);

  if (!cleanToken) {
    return "";
  }

  return `${getPublicBaseUrl()}/e/${encodeURIComponent(
    eventSlug,
  )}/higher-or-lower/play?entry=${encodeURIComponent(cleanToken)}`;
}

function playerEntryLabel(entry: {
  player_name?: string | null;
  entry_number: number;
}) {
  return `${cleanText(entry.player_name) || "Player"} #${entry.entry_number}`;
}

function getSuccessMessage(value: string | undefined) {
  if (value === "link-sent") return "Player link email sent.";
  if (value === "links-sent") return "Active player link emails sent.";
  if (value === "no-active-links") {
    return "No active player links were available to send.";
  }

  return "";
}

function getErrorMessage(value: string | undefined) {
  if (value === "session-missing") {
    return "Higher or Lower game session was not found.";
  }
  if (value === "entry-missing") return "Player entry was not found.";
  if (value === "email-missing") {
    return "This player entry does not have an email address.";
  }
  if (value === "token-missing") {
    return "This player entry does not have a private answer token.";
  }
  if (value === "paid-entry-required") {
    return "Only paid Higher or Lower entries can receive player links.";
  }
  if (value === "send-failed") {
    return "The player link email could not be sent. Check Vercel logs for details.";
  }

  return cleanText(value);
}

async function requireEventAccess(eventId: string) {
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

  const event = await getEventById(eventId);

  if (!event) {
    notFound();
  }

  if (event.tenant_slug !== tenantSlug) {
    redirect("/admin/login?error=tenant_access_denied");
  }

  return {
    event,
    tenantSlug,
  };
}

async function getHigherOrLowerSession(input: {
  tenantSlug: string;
  eventId: string;
}) {
  const rows = await query<GameSession>(
    `
      select
        id::text,
        title,
        status
      from event_addon_game_sessions
      where tenant_slug = $1
        and event_id = $2
        and add_on_type = 'higher_or_lower'
      order by created_at asc
      limit 1
    `,
    [input.tenantSlug, input.eventId],
  );

  return rows[0] || null;
}

async function getTenantEmailBranding(tenantSlug: string): Promise<EmailBranding> {
  const row = await queryOne<TenantEmailBrandingRow>(
    `
      select
        public_display_name,
        public_logo_url,
        public_logo_mark_url,
        public_primary_colour
      from tenant_settings
      where tenant_slug = $1
      limit 1
    `,
    [tenantSlug],
  );

  const logoUrl =
    cleanText(row?.public_logo_url) || cleanText(row?.public_logo_mark_url) || null;

  return {
    name: cleanText(row?.public_display_name) || "SO Fundraising Platform",
    logoUrl,
    primaryColor: normaliseHexColour(row?.public_primary_colour, "#1683F8"),
  };
}

async function listPlayerLinks(input: {
  tenantSlug: string;
  eventId: string;
  sessionId: string;
}) {
  return query<PlayerLinkRow>(
    `
      select
        e.id::text,
        e.entry_number,
        e.player_name,
        e.player_email,
        e.status,
        e.eliminated_round_number,
        e.public_answer_token,
        e.event_order_id::text,
        e.event_order_item_id::text,
        eo.status as order_status,
        e.created_at::text
      from event_addon_game_entries e
      left join event_orders eo
        on eo.id = e.event_order_id
       and eo.tenant_slug = e.tenant_slug
       and eo.event_id = e.event_id
      where e.tenant_slug = $1
        and e.event_id = $2
        and e.session_id = $3
        and e.event_order_item_id is not null
      order by
        case e.status
          when 'active' then 1
          when 'winner' then 2
          when 'eliminated' then 3
          else 4
        end asc,
        e.player_name asc nulls last,
        e.entry_number asc,
        e.created_at asc
    `,
    [input.tenantSlug, input.eventId, input.sessionId],
  );
}

async function getPlayerLinkEntry(input: {
  tenantSlug: string;
  eventId: string;
  sessionId: string;
  entryId: string;
}) {
  const rows = await query<PlayerLinkRow>(
    `
      select
        e.id::text,
        e.entry_number,
        e.player_name,
        e.player_email,
        e.status,
        e.eliminated_round_number,
        e.public_answer_token,
        e.event_order_id::text,
        e.event_order_item_id::text,
        eo.status as order_status,
        e.created_at::text
      from event_addon_game_entries e
      left join event_orders eo
        on eo.id = e.event_order_id
       and eo.tenant_slug = e.tenant_slug
       and eo.event_id = e.event_id
      where e.tenant_slug = $1
        and e.event_id = $2
        and e.session_id = $3
        and e.id = $4
        and e.event_order_item_id is not null
      limit 1
    `,
    [input.tenantSlug, input.eventId, input.sessionId, input.entryId],
  );

  return rows[0] || null;
}

async function sendSinglePlayerLinkAction(formData: FormData) {
  "use server";

  const eventId = cleanText(formData.get("event_id"));
  const sessionId = cleanText(formData.get("session_id"));
  const entryId = cleanText(formData.get("entry_id"));

  if (!eventId || !sessionId || !entryId) {
    redirect("/admin/events");
  }

  const { event, tenantSlug } = await requireEventAccess(eventId);

  const session = await getHigherOrLowerSession({
    tenantSlug,
    eventId: event.id,
  });

  if (!session || session.id !== sessionId) {
    redirect(`/admin/events/${event.id}/higher-or-lower/links?error=session-missing`);
  }

  const entry = await getPlayerLinkEntry({
    tenantSlug,
    eventId: event.id,
    sessionId: session.id,
    entryId,
  });

  if (!entry) {
    redirect(`/admin/events/${event.id}/higher-or-lower/links?error=entry-missing`);
  }

  if (!entry.event_order_item_id || entry.order_status !== "paid") {
    redirect(
      `/admin/events/${event.id}/higher-or-lower/links?error=paid-entry-required`,
    );
  }

  if (!cleanText(entry.player_email)) {
    redirect(`/admin/events/${event.id}/higher-or-lower/links?error=email-missing`);
  }

  const answerUrl = playerAnswerUrl(event.slug, entry.public_answer_token);

  if (!answerUrl) {
    redirect(`/admin/events/${event.id}/higher-or-lower/links?error=token-missing`);
  }

  const branding = await getTenantEmailBranding(tenantSlug);

  await sendHigherOrLowerPlayerLinkEmail({
    to: cleanText(entry.player_email),
    name: cleanText(entry.player_name) || null,
    eventTitle: event.title,
    playerEntryLabel: playerEntryLabel(entry),
    playerAnswerUrl: answerUrl,
    branding,
  });

  redirect(`/admin/events/${event.id}/higher-or-lower/links?success=link-sent`);
}

async function sendAllActivePlayerLinksAction(formData: FormData) {
  "use server";

  const eventId = cleanText(formData.get("event_id"));
  const sessionId = cleanText(formData.get("session_id"));

  if (!eventId || !sessionId) {
    redirect("/admin/events");
  }

  const { event, tenantSlug } = await requireEventAccess(eventId);

  const session = await getHigherOrLowerSession({
    tenantSlug,
    eventId: event.id,
  });

  if (!session || session.id !== sessionId) {
    redirect(`/admin/events/${event.id}/higher-or-lower/links?error=session-missing`);
  }

  const entries = await listPlayerLinks({
    tenantSlug,
    eventId: event.id,
    sessionId: session.id,
  });

  const activeSendableEntries = entries.filter((entry) => {
    return (
      entry.status === "active" &&
      entry.order_status === "paid" &&
      Boolean(entry.event_order_item_id) &&
      Boolean(cleanText(entry.player_email)) &&
      Boolean(playerAnswerUrl(event.slug, entry.public_answer_token))
    );
  });

  if (activeSendableEntries.length === 0) {
    redirect(`/admin/events/${event.id}/higher-or-lower/links?success=no-active-links`);
  }

  const branding = await getTenantEmailBranding(tenantSlug);

  for (const entry of activeSendableEntries) {
    await sendHigherOrLowerPlayerLinkEmail({
      to: cleanText(entry.player_email),
      name: cleanText(entry.player_name) || null,
      eventTitle: event.title,
      playerEntryLabel: playerEntryLabel(entry),
      playerAnswerUrl: playerAnswerUrl(event.slug, entry.public_answer_token),
      branding,
    });
  }

  redirect(`/admin/events/${event.id}/higher-or-lower/links?success=links-sent`);
}

export default async function HigherOrLowerPlayerLinksPage({
  params,
  searchParams,
}: PageProps) {
  const { event, tenantSlug } = await requireEventAccess(params.id);

  const session = await getHigherOrLowerSession({
    tenantSlug,
    eventId: event.id,
  });

  const entries = session
    ? await listPlayerLinks({
        tenantSlug,
        eventId: event.id,
        sessionId: session.id,
      })
    : [];

  const withTokens = entries.filter((entry) => cleanText(entry.public_answer_token));
  const missingTokens = entries.length - withTokens.length;

  const activeEmailReadyCount = entries.filter((entry) => {
    return (
      entry.status === "active" &&
      entry.order_status === "paid" &&
      Boolean(entry.event_order_item_id) &&
      Boolean(cleanText(entry.player_email)) &&
      Boolean(playerAnswerUrl(event.slug, entry.public_answer_token))
    );
  }).length;

  const successMessage = getSuccessMessage(searchParams?.success);
  const errorMessage = getErrorMessage(searchParams?.error);

  return (
    <main className="higher-lower-links-page" style={styles.page}>
      <style>{responsiveStyles}</style>

      <section className="links-hero" style={styles.hero}>
        <div>
          <div style={styles.eyebrow}>Player answer links</div>
          <h1 className="links-title" style={styles.title}>
            Higher or Lower
          </h1>
          <p style={styles.subtitle}>
            Send each paid player their private answer link. The same link works
            for every open round.
          </p>
          <p style={styles.tenant}>
            Event: <strong>{event.title}</strong> · Tenant:{" "}
            <strong>{tenantSlug}</strong>
          </p>
        </div>

        <div className="links-actions" style={styles.heroActions}>
          <Link href={`/admin/events/${event.id}/higher-or-lower`} style={styles.secondaryButton}>
            ← Game controller
          </Link>
          <Link href={`/e/${event.slug}/higher-or-lower`} style={styles.secondaryButton}>
            Room display
          </Link>
        </div>
      </section>

      {successMessage ? (
        <section style={styles.successBanner}>{successMessage}</section>
      ) : null}

      {errorMessage ? (
        <section style={styles.errorBanner}>{errorMessage}</section>
      ) : null}

      <section className="summary-grid" style={styles.summaryGrid}>
        <SummaryCard label="Game" value={session ? statusLabel(session.status) : "No game"} />
        <SummaryCard label="Paid entries" value={entries.length} />
        <SummaryCard label="Links ready" value={withTokens.length} />
        <SummaryCard label="Email ready" value={activeEmailReadyCount} />
      </section>

      {!session ? (
        <section style={styles.sectionCard}>
          <h2 style={styles.sectionTitle}>No Higher or Lower game yet</h2>
          <p style={styles.sectionText}>
            Create the live game first, then generate entries from paid orders
            before emailing player answer links.
          </p>
        </section>
      ) : entries.length === 0 ? (
        <section style={styles.sectionCard}>
          <h2 style={styles.sectionTitle}>No paid entries generated yet</h2>
          <p style={styles.sectionText}>
            Go back to the game controller and use “Generate entries from paid
            orders”. Ticket-only buyers and unpaid orders will not appear here.
          </p>
        </section>
      ) : (
        <section style={styles.sectionCard}>
          <div style={styles.sectionHeader}>
            <div>
              <div style={styles.sectionEyebrow}>Send links</div>
              <h2 style={styles.sectionTitle}>Player links & emails</h2>
              <p style={styles.sectionText}>
                Email the link once before play starts. Use the copy field as a
                backup for WhatsApp, QR codes or event-night support.
              </p>
            </div>

            <div style={styles.headerActions}>
              <span style={{ ...styles.statusPill, ...statusStyle(session.status) }}>
                {statusLabel(session.status)}
              </span>

              <form action={sendAllActivePlayerLinksAction} style={styles.inlineForm}>
                <input type="hidden" name="event_id" value={event.id} />
                <input type="hidden" name="session_id" value={session.id} />
                <button
                  type="submit"
                  disabled={activeEmailReadyCount === 0}
                  style={{
                    ...styles.primaryButton,
                    opacity: activeEmailReadyCount === 0 ? 0.55 : 1,
                    cursor: activeEmailReadyCount === 0 ? "not-allowed" : "pointer",
                  }}
                >
                  Send all active links
                </button>
              </form>
            </div>
          </div>

          {missingTokens > 0 ? (
            <div style={styles.warningBox}>
              {missingTokens} paid entr{missingTokens === 1 ? "y is" : "ies are"} missing a token.
              Run the token backfill SQL, then refresh this page.
            </div>
          ) : null}

          <div style={styles.infoBox}>
            <strong>Simple event-night flow</strong>
            <span>
              Send links once. Players keep their private page open and answer
              each round only when the organiser opens it.
            </span>
          </div>

          <div style={styles.linkList}>
            {entries.map((entry) => {
              const answerUrl = playerAnswerUrl(event.slug, entry.public_answer_token);
              const canSend =
                entry.status === "active" &&
                entry.order_status === "paid" &&
                Boolean(entry.event_order_item_id) &&
                Boolean(cleanText(entry.player_email)) &&
                Boolean(answerUrl);

              return (
                <article key={entry.id} style={styles.linkCard}>
                  <div style={styles.playerTop}>
                    <div style={styles.playerMain}>
                      <div style={styles.playerEyebrow}>Entry #{entry.entry_number}</div>
                      <h3 style={styles.playerName}>
                        {entry.player_name || "Unnamed player"}
                      </h3>
                      <p style={styles.metaText}>
                        {entry.player_email || "No email recorded"}
                        {entry.eliminated_round_number
                          ? ` · Eliminated round ${entry.eliminated_round_number}`
                          : ""}
                      </p>
                    </div>

                    <div className="pill-row" style={styles.pillRow}>
                      <span style={{ ...styles.statusPill, ...statusStyle(entry.status) }}>
                        {statusLabel(entry.status)}
                      </span>
                      <span style={{ ...styles.statusPill, ...statusStyle(entry.order_status) }}>
                        {statusLabel(entry.order_status)}
                      </span>
                    </div>
                  </div>

                  <div className="mobile-action-grid" style={styles.mobileActionGrid}>
                    <form action={sendSinglePlayerLinkAction} style={styles.inlineForm}>
                      <input type="hidden" name="event_id" value={event.id} />
                      <input type="hidden" name="session_id" value={session.id} />
                      <input type="hidden" name="entry_id" value={entry.id} />
                      <button
                        type="submit"
                        disabled={!canSend}
                        style={{
                          ...styles.emailButton,
                          opacity: canSend ? 1 : 0.55,
                          cursor: canSend ? "pointer" : "not-allowed",
                        }}
                      >
                        Send link
                      </button>
                    </form>

                    {answerUrl ? (
                      <Link href={answerUrl} style={styles.openButton}>
                        Open page
                      </Link>
                    ) : (
                      <span style={styles.disabledOpenButton}>No token</span>
                    )}
                  </div>

                  {answerUrl ? (
                    <div className="copy-panel" style={styles.copyPanel}>
                      <label style={styles.copyLabel} htmlFor={`answer-link-${entry.id}`}>
                        Copy fallback link
                      </label>
                      <input
                        id={`answer-link-${entry.id}`}
                        readOnly
                        value={answerUrl}
                        style={styles.copyInput}
                      />
                      <p style={styles.copyHelp}>
                        Tap the field, select all, then copy if you need to send
                        the link manually.
                      </p>
                    </div>
                  ) : (
                    <div style={styles.warningBox}>
                      This paid entry has no token yet. Run the token backfill SQL,
                      or regenerate entries after the token default is installed.
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        </section>
      )}
    </main>
  );
}

function SummaryCard({ label, value }: { label: string; value: string | number }) {
  return (
    <article style={styles.summaryCard}>
      <span style={styles.summaryLabel}>{label}</span>
      <strong style={styles.summaryValue}>{value}</strong>
    </article>
  );
}

const responsiveStyles = `
.higher-lower-links-page,
.higher-lower-links-page * {
  box-sizing: border-box;
}

.higher-lower-links-page {
  overflow-x: hidden;
}

.higher-lower-links-page section,
.higher-lower-links-page article,
.higher-lower-links-page div,
.higher-lower-links-page a,
.higher-lower-links-page input,
.higher-lower-links-page form,
.higher-lower-links-page button {
  min-width: 0;
  max-width: 100%;
}

@media (max-width: 900px) {
  .higher-lower-links-page .links-hero {
    grid-template-columns: 1fr !important;
  }

  .higher-lower-links-page .links-actions {
    justify-content: stretch !important;
  }

  .higher-lower-links-page .links-actions a {
    width: 100% !important;
  }

  .higher-lower-links-page .summary-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
  }
}

@media (max-width: 720px) {
  .higher-lower-links-page .pill-row {
    justify-content: flex-start !important;
  }

  .higher-lower-links-page .mobile-action-grid {
    grid-template-columns: 1fr !important;
  }

  .higher-lower-links-page .mobile-action-grid a,
  .higher-lower-links-page .mobile-action-grid button,
  .higher-lower-links-page .mobile-action-grid span {
    width: 100% !important;
  }
}

@media (max-width: 640px) {
  .higher-lower-links-page {
    padding: 16px 10px 42px !important;
  }

  .higher-lower-links-page .links-hero {
    padding: 18px !important;
    border-radius: 24px !important;
    margin-bottom: 14px !important;
  }

  .higher-lower-links-page .links-title {
    font-size: clamp(36px, 12vw, 52px) !important;
    line-height: 0.98 !important;
  }

  .higher-lower-links-page .summary-grid {
    grid-template-columns: 1fr !important;
    gap: 10px !important;
  }

  .higher-lower-links-page .section-card {
    padding: 16px !important;
    border-radius: 22px !important;
  }

  .higher-lower-links-page .copy-panel {
    padding: 10px !important;
  }

  .higher-lower-links-page .copy-panel input {
    font-size: 12px !important;
  }
}
`;

const styles: Record<string, CSSProperties> = {
  page: {
    width: "100%",
    maxWidth: 1180,
    margin: "0 auto",
    padding: "28px 16px 56px",
    minHeight: "100vh",
    background:
      "radial-gradient(circle at top left, rgba(250,204,21,0.12), transparent 32%), radial-gradient(circle at top right, rgba(22,131,248,0.08), transparent 34%), #f8fafc",
    overflowX: "hidden",
  },

  hero: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) auto",
    gap: 18,
    alignItems: "start",
    padding: 28,
    borderRadius: 32,
    background:
      "radial-gradient(circle at bottom right, rgba(250,204,21,0.18), transparent 38%), linear-gradient(135deg, #020617 0%, #0f172a 55%, #172554 100%)",
    color: "#ffffff",
    marginBottom: 18,
    boxShadow: "0 28px 70px rgba(15,23,42,0.22)",
    border: "1px solid rgba(250,204,21,0.24)",
  },

  eyebrow: {
    display: "inline-flex",
    padding: "8px 14px",
    borderRadius: 999,
    background: "rgba(15,23,42,0.24)",
    color: "#facc15",
    border: "1px solid rgba(250,204,21,0.76)",
    fontSize: 12,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    marginBottom: 14,
  },

  title: {
    margin: 0,
    fontSize: "clamp(48px, 7vw, 76px)",
    lineHeight: 0.94,
    letterSpacing: "-0.075em",
    color: "#ffffff",
    overflowWrap: "anywhere",
  },

  subtitle: {
    margin: "16px 0 0",
    maxWidth: 800,
    color: "#dbeafe",
    fontSize: 17,
    lineHeight: 1.6,
    fontWeight: 750,
  },

  tenant: {
    margin: "14px 0 0",
    color: "#bfdbfe",
    fontSize: 14,
    fontWeight: 850,
    overflowWrap: "anywhere",
  },

  heroActions: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
    justifyContent: "flex-end",
  },

  secondaryButton: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 44,
    padding: "10px 14px",
    borderRadius: 999,
    background: "rgba(255,255,255,0.08)",
    color: "#ffffff",
    border: "1px solid rgba(148,163,184,0.52)",
    textDecoration: "none",
    fontWeight: 900,
    textAlign: "center",
  },

  successBanner: {
    padding: 14,
    borderRadius: 18,
    background: "#dcfce7",
    color: "#166534",
    border: "1px solid #bbf7d0",
    fontWeight: 900,
    marginBottom: 18,
  },

  errorBanner: {
    padding: 14,
    borderRadius: 18,
    background: "#fee2e2",
    color: "#991b1b",
    border: "1px solid #fecaca",
    fontWeight: 900,
    marginBottom: 18,
  },

  summaryGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
    gap: 12,
    marginBottom: 18,
  },

  summaryCard: {
    padding: 16,
    borderRadius: 18,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    borderTop: "4px solid #facc15",
    boxShadow: "0 2px 12px rgba(15,23,42,0.04)",
  },

  summaryLabel: {
    color: "#64748b",
    fontSize: 13,
    fontWeight: 850,
  },

  summaryValue: {
    display: "block",
    color: "#0f172a",
    fontSize: 30,
    fontWeight: 950,
    marginTop: 5,
    letterSpacing: "-0.04em",
    overflowWrap: "anywhere",
  },

  sectionCard: {
    display: "grid",
    gap: 16,
    padding: 22,
    borderRadius: 26,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    boxShadow: "0 2px 12px rgba(15,23,42,0.04)",
    marginBottom: 18,
    overflow: "hidden",
  },

  sectionHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: 14,
    alignItems: "flex-start",
    flexWrap: "wrap",
  },

  headerActions: {
    display: "flex",
    gap: 10,
    alignItems: "center",
    justifyContent: "flex-end",
    flexWrap: "wrap",
  },

  inlineForm: {
    display: "contents",
  },

  sectionEyebrow: {
    color: "#2563eb",
    fontSize: 12,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    marginBottom: 6,
  },

  sectionTitle: {
    margin: 0,
    color: "#0f172a",
    fontSize: 28,
    letterSpacing: "-0.05em",
    overflowWrap: "anywhere",
  },

  sectionText: {
    margin: "8px 0 0",
    color: "#64748b",
    lineHeight: 1.55,
    fontWeight: 750,
  },

  warningBox: {
    padding: 14,
    borderRadius: 18,
    background: "#fffbeb",
    color: "#92400e",
    border: "1px solid #fde68a",
    fontWeight: 850,
    lineHeight: 1.45,
  },

  infoBox: {
    display: "grid",
    gap: 5,
    padding: 14,
    borderRadius: 18,
    background: "#eff6ff",
    color: "#1e3a8a",
    border: "1px solid #bfdbfe",
    fontWeight: 850,
    lineHeight: 1.45,
  },

  statusPill: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: "fit-content",
    padding: "8px 12px",
    borderRadius: 999,
    border: "1px solid",
    fontSize: 13,
    fontWeight: 950,
    textTransform: "capitalize",
  },

  primaryButton: {
    minHeight: 42,
    padding: "9px 14px",
    borderRadius: 999,
    background: "#1683f8",
    color: "#ffffff",
    border: "none",
    fontWeight: 950,
    cursor: "pointer",
    boxShadow: "0 10px 22px rgba(22,131,248,0.18)",
  },

  linkList: {
    display: "grid",
    gap: 12,
  },

  linkCard: {
    display: "grid",
    gap: 12,
    padding: 14,
    borderRadius: 20,
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
  },

  playerTop: {
    display: "grid",
    gap: 10,
  },

  playerMain: {
    display: "grid",
    gap: 4,
  },

  playerEyebrow: {
    color: "#92400e",
    fontSize: 11,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
  },

  playerName: {
    margin: 0,
    color: "#0f172a",
    fontSize: 22,
    lineHeight: 1.05,
    fontWeight: 950,
    letterSpacing: "-0.045em",
    overflowWrap: "anywhere",
  },

  metaText: {
    margin: 0,
    color: "#64748b",
    fontSize: 13,
    lineHeight: 1.4,
    fontWeight: 750,
    overflowWrap: "anywhere",
  },

  pillRow: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
    justifyContent: "flex-start",
  },

  mobileActionGrid: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)",
    gap: 8,
  },

  openButton: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 44,
    padding: "10px 13px",
    borderRadius: 999,
    background: "#0f172a",
    color: "#ffffff",
    border: "none",
    textDecoration: "none",
    fontSize: 13,
    fontWeight: 950,
    textAlign: "center",
  },

  disabledOpenButton: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 44,
    padding: "10px 13px",
    borderRadius: 999,
    background: "#e2e8f0",
    color: "#64748b",
    border: "1px solid #cbd5e1",
    fontSize: 13,
    fontWeight: 950,
    textAlign: "center",
  },

  emailButton: {
    width: "100%",
    minHeight: 44,
    padding: "10px 13px",
    borderRadius: 999,
    background: "#facc15",
    color: "#422006",
    border: "none",
    textDecoration: "none",
    fontSize: 13,
    fontWeight: 950,
    textAlign: "center",
  },

  copyPanel: {
    display: "grid",
    gap: 8,
    padding: 12,
    borderRadius: 16,
    background: "#ffffff",
    border: "1px solid #dbeafe",
  },

  copyLabel: {
    color: "#1d4ed8",
    fontSize: 11,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
  },

  copyInput: {
    width: "100%",
    minHeight: 42,
    borderRadius: 12,
    border: "1px solid #bfdbfe",
    background: "#eff6ff",
    color: "#1e3a8a",
    padding: "9px 10px",
    fontSize: 13,
    fontWeight: 800,
    boxSizing: "border-box",
  },

  copyHelp: {
    margin: 0,
    color: "#64748b",
    fontSize: 12,
    lineHeight: 1.4,
    fontWeight: 750,
  },
};
