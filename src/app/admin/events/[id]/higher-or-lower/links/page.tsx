import type { CSSProperties } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { query } from "@/lib/db";
import { getTenantSlugFromHeaders } from "@/lib/tenant";
import { getEventById } from "../../../../../../../api/_lib/events-repo";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type PageProps = {
  params: {
    id: string;
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

function cleanText(value: unknown) {
  return String(value || "").trim();
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

function playerAnswerPath(eventSlug: string, token: string | null | undefined) {
  const cleanToken = cleanText(token);

  if (!cleanToken) {
    return "";
  }

  return `/e/${encodeURIComponent(eventSlug)}/higher-or-lower/play?entry=${encodeURIComponent(cleanToken)}`;
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

export default async function HigherOrLowerPlayerLinksPage({ params }: PageProps) {
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

  return (
    <main className="higher-lower-links-page" style={styles.page}>
      <style>{responsiveStyles}</style>

      <section className="links-hero" style={styles.hero}>
        <div>
          <div style={styles.eyebrow}>Player answer links</div>
          <h1 className="links-title" style={styles.title}>Higher or Lower</h1>
          <p style={styles.subtitle}>
            Copy one private answer link per paid Higher or Lower entry. Links are
            token based and only work for this tenant, event and paid game entry.
          </p>
          <p style={styles.tenant}>
            Event: <strong>{event.title}</strong> · Tenant: <strong>{tenantSlug}</strong>
          </p>
        </div>

        <div className="links-actions" style={styles.heroActions}>
          <Link href={`/admin/events/${event.id}/higher-or-lower`} style={styles.secondaryButton}>
            ← Back to game controller
          </Link>
          <Link href={`/e/${event.slug}/higher-or-lower`} style={styles.secondaryButton}>
            Public room display
          </Link>
        </div>
      </section>

      <section className="summary-grid" style={styles.summaryGrid}>
        <SummaryCard label="Game status" value={session ? statusLabel(session.status) : "No game"} />
        <SummaryCard label="Paid entries" value={entries.length} />
        <SummaryCard label="Links ready" value={withTokens.length} />
        <SummaryCard label="Missing tokens" value={missingTokens} />
      </section>

      {!session ? (
        <section style={styles.sectionCard}>
          <h2 style={styles.sectionTitle}>No Higher or Lower game yet</h2>
          <p style={styles.sectionText}>
            Create the Higher or Lower live game first, then generate entries from
            paid orders before copying player answer links.
          </p>
        </section>
      ) : entries.length === 0 ? (
        <section style={styles.sectionCard}>
          <h2 style={styles.sectionTitle}>No paid game entries generated yet</h2>
          <p style={styles.sectionText}>
            Go back to the game controller and use “Generate entries from paid
            orders”. Ticket-only buyers and unpaid orders will not appear here.
          </p>
        </section>
      ) : (
        <section style={styles.sectionCard}>
          <div style={styles.sectionHeader}>
            <div>
              <div style={styles.sectionEyebrow}>Copy links</div>
              <h2 style={styles.sectionTitle}>Paid player entries</h2>
              <p style={styles.sectionText}>
                Select the link field to copy it, then send it to the matching
                player. The public answer page still checks the paid order and
                active game-entry status before saving an answer.
              </p>
            </div>

            <span style={{ ...styles.statusPill, ...statusStyle(session.status) }}>
              {statusLabel(session.status)}
            </span>
          </div>

          {missingTokens > 0 ? (
            <div style={styles.warningBox}>
              {missingTokens} paid entr{missingTokens === 1 ? "y is" : "ies are"} missing a token.
              Run the token backfill SQL, then refresh this page.
            </div>
          ) : null}

          <div style={styles.linkList}>
            {entries.map((entry) => {
              const answerPath = playerAnswerPath(event.slug, entry.public_answer_token);

              return (
                <article key={entry.id} style={styles.linkCard}>
                  <div style={styles.playerHeader}>
                    <div>
                      <h3 style={styles.playerName}>
                        {entry.player_name || "Unnamed player"} #{entry.entry_number}
                      </h3>
                      <p style={styles.metaText}>
                        {entry.player_email || "No email"}
                        {entry.eliminated_round_number
                          ? ` · Eliminated round ${entry.eliminated_round_number}`
                          : ""}
                      </p>
                    </div>

                    <div style={styles.pillRow}>
                      <span style={{ ...styles.statusPill, ...statusStyle(entry.status) }}>
                        {statusLabel(entry.status)}
                      </span>
                      <span style={{ ...styles.statusPill, ...statusStyle(entry.order_status) }}>
                        {statusLabel(entry.order_status)}
                      </span>
                    </div>
                  </div>

                  {answerPath ? (
                    <div style={styles.copyBox}>
                      <label style={styles.copyLabel} htmlFor={`answer-link-${entry.id}`}>
                        Player answer link
                      </label>
                      <input
                        id={`answer-link-${entry.id}`}
                        readOnly
                        value={answerPath}
                        style={styles.copyInput}
                      />
                      <Link href={answerPath} style={styles.openButton}>
                        Open player page
                      </Link>
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
.higher-lower-links-page input {
  min-width: 0;
  max-width: 100%;
}

@media (max-width: 860px) {
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

@media (max-width: 640px) {
  .higher-lower-links-page {
    padding: 18px 12px 44px !important;
  }

  .higher-lower-links-page .links-hero {
    padding: 20px !important;
    border-radius: 26px !important;
  }

  .higher-lower-links-page .links-title {
    font-size: clamp(38px, 12vw, 54px) !important;
    line-height: 0.98 !important;
  }

  .higher-lower-links-page .summary-grid {
    grid-template-columns: 1fr !important;
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

  playerHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "flex-start",
    flexWrap: "wrap",
  },

  playerName: {
    margin: 0,
    color: "#0f172a",
    fontSize: 18,
    lineHeight: 1.1,
    fontWeight: 950,
    overflowWrap: "anywhere",
  },

  metaText: {
    margin: "4px 0 0",
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
  },

  copyBox: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) auto",
    gap: 8,
    alignItems: "center",
    padding: 12,
    borderRadius: 16,
    background: "#ffffff",
    border: "1px solid #dbeafe",
  },

  copyLabel: {
    gridColumn: "1 / -1",
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

  openButton: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 42,
    padding: "9px 13px",
    borderRadius: 999,
    background: "#1683f8",
    color: "#ffffff",
    border: "none",
    textDecoration: "none",
    fontSize: 13,
    fontWeight: 950,
    whiteSpace: "nowrap",
  },
};
