import type { CSSProperties, ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { query, queryOne } from "@/lib/db";
import { getTenantSlugFromHeaders } from "@/lib/tenant";
import { getEventBySlug } from "../../../../../api/_lib/events-repo";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type PageProps = {
  params: Promise<{
    slug: string;
  }>;
};

type TenantBrandingSettings = {
  public_display_name: string | null;
  public_tagline: string | null;
  public_logo_url: string | null;
  public_logo_mark_url: string | null;
  public_primary_colour: string | null;
  public_accent_colour: string | null;
  public_footer_text: string | null;
};

type PublicGameSession = {
  id: string;
  tenant_slug: string;
  event_id: string;
  title: string;
  status: string;
  current_round_number: number;
  created_at: string;
  updated_at: string;
};

type PublicGameRound = {
  id: string;
  round_number: number;
  prompt: string | null;
  reveal_title: string | null;
  reveal_description: string | null;
  reveal_value_cents: number | null;
  reveal_image_url: string | null;
  status: string;
  revealed_at: string | null;
};

type PublicGameEntry = {
  id: string;
  entry_number: number;
  player_name: string | null;
  status: string;
  eliminated_round_number: number | null;
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

function moneyFromCents(cents: number | string | null | undefined) {
  const value = Number(cents || 0);

  return `£${(value / 100).toFixed(2)}`;
}

function formatDate(value: string | null | undefined) {
  if (!value) return "Not recorded";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Not recorded";
  }

  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function statusLabel(value: string | null | undefined) {
  const clean = cleanText(value).toLowerCase();

  if (clean === "draft") return "Draft";
  if (clean === "live") return "Live";
  if (clean === "paused") return "Paused";
  if (clean === "closed") return "Closed";
  if (clean === "open") return "Open";
  if (clean === "revealed") return "Revealed";
  if (clean === "active") return "Active";
  if (clean === "winner") return "Winner";
  if (clean === "eliminated") return "Eliminated";

  return clean || "Not started";
}

function statusStyle(value: string | null | undefined): CSSProperties {
  const clean = cleanText(value).toLowerCase();

  if (clean === "live" || clean === "open" || clean === "active") {
    return {
      background: "#dcfce7",
      color: "#166534",
      borderColor: "#bbf7d0",
    };
  }

  if (clean === "winner" || clean === "revealed") {
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

function playableRounds(rounds: PublicGameRound[]) {
  return rounds.filter((round) => Number(round.round_number || 0) > 0);
}

function startingRound(rounds: PublicGameRound[]) {
  return rounds.find((round) => Number(round.round_number || 0) === 0) || null;
}

function openRound(rounds: PublicGameRound[]) {
  return (
    playableRounds(rounds)
      .filter((round) => round.status === "open")
      .sort((a, b) => Number(a.round_number || 0) - Number(b.round_number || 0))[0] ||
    null
  );
}

function revealedPlayableRounds(rounds: PublicGameRound[]) {
  return playableRounds(rounds)
    .filter((round) => round.status === "revealed")
    .sort((a, b) => Number(a.round_number || 0) - Number(b.round_number || 0));
}

function previousRoundFor(rounds: PublicGameRound[], round: PublicGameRound) {
  const previousRoundNumber = Number(round.round_number || 0) - 1;

  return (
    rounds.find(
      (currentRound) =>
        Number(currentRound.round_number || 0) === previousRoundNumber,
    ) || null
  );
}

function activeEntries(entries: PublicGameEntry[]) {
  return entries.filter((entry) => entry.status === "active");
}

function winnerEntries(entries: PublicGameEntry[]) {
  return entries.filter((entry) => entry.status === "winner");
}

function eliminatedEntries(entries: PublicGameEntry[]) {
  return entries.filter((entry) => entry.status === "eliminated");
}

function playerDisplayName(entry: PublicGameEntry | null | undefined) {
  if (!entry) return "Winner to be announced";

  return `${cleanText(entry.player_name) || "Player"} #${entry.entry_number}`;
}

async function getTenantBrandingSettings(tenantSlug: string) {
  return queryOne<TenantBrandingSettings>(
    `
      select
        public_display_name,
        public_tagline,
        public_logo_url,
        public_logo_mark_url,
        public_primary_colour,
        public_accent_colour,
        public_footer_text
      from tenant_settings
      where tenant_slug = $1
      limit 1
    `,
    [tenantSlug],
  );
}

async function getPublicHigherOrLowerSession(input: {
  tenantSlug: string;
  eventId: string;
}) {
  const rows = await query<PublicGameSession>(
    `
      select
        id::text,
        tenant_slug,
        event_id::text,
        title,
        status,
        current_round_number,
        created_at::text,
        updated_at::text
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

async function listPublicHigherOrLowerRounds(input: {
  tenantSlug: string;
  eventId: string;
  sessionId: string;
}) {
  return query<PublicGameRound>(
    `
      select
        id::text,
        round_number,
        prompt,
        reveal_title,
        reveal_description,
        reveal_value_cents,
        reveal_image_url,
        status,
        revealed_at::text
      from event_addon_game_rounds
      where tenant_slug = $1
        and event_id = $2
        and session_id = $3
      order by round_number asc
    `,
    [input.tenantSlug, input.eventId, input.sessionId],
  );
}

async function listPublicHigherOrLowerEntries(input: {
  tenantSlug: string;
  eventId: string;
  sessionId: string;
}) {
  return query<PublicGameEntry>(
    `
      select
        id::text,
        entry_number,
        player_name,
        status,
        eliminated_round_number
      from event_addon_game_entries
      where tenant_slug = $1
        and event_id = $2
        and session_id = $3
      order by
        case status
          when 'winner' then 1
          when 'active' then 2
          when 'eliminated' then 3
          else 4
        end asc,
        entry_number asc,
        created_at asc
    `,
    [input.tenantSlug, input.eventId, input.sessionId],
  );
}
function PrizeImage({
  imageUrl,
  alt,
  hidden = false,
}: {
  imageUrl: string | null | undefined;
  alt: string;
  hidden?: boolean;
}) {
  const cleanImageUrl = cleanText(imageUrl);

  if (hidden || !cleanImageUrl) {
    return (
      <div style={styles.hiddenPrizeImage}>
        <div style={styles.hiddenPrizeIcon}>?</div>
        <span>Hidden until reveal</span>
      </div>
    );
  }

  return (
    <div style={styles.prizeImageWrap}>
      <img src={cleanImageUrl} alt={alt} style={styles.prizeImage} />
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: ReactNode }) {
  return (
    <article style={styles.statCard}>
      <span style={styles.statLabel}>{label}</span>
      <strong style={styles.statValue}>{value}</strong>
    </article>
  );
}

function RevealedPrizeCard({
  round,
  previousRound,
  currency,
}: {
  round: PublicGameRound;
  previousRound: PublicGameRound | null;
  currency: string;
}) {
  const previousValue = Number(previousRound?.reveal_value_cents || 0);
  const currentValue = Number(round.reveal_value_cents || 0);
  const direction =
    currentValue > previousValue
      ? "Higher"
      : currentValue < previousValue
        ? "Lower"
        : "Same value";

  return (
    <article style={styles.historyCard}>
      <PrizeImage
        imageUrl={round.reveal_image_url}
        alt={round.reveal_title || `Round ${round.round_number} prize`}
      />

      <div style={styles.historyBody}>
        <div style={styles.historyMetaRow}>
          <span style={styles.roundPill}>Round {round.round_number}</span>
          <span style={styles.directionPill}>{direction}</span>
        </div>

        <h3 style={styles.historyTitle}>
          {round.reveal_title || "Revealed prize"}
        </h3>

        <p style={styles.historyValue}>
          {currency} {moneyFromCents(round.reveal_value_cents).replace("£", "")}
        </p>

        {round.reveal_description ? (
          <p style={styles.historyDescription}>{round.reveal_description}</p>
        ) : null}
      </div>
    </article>
  );
}

function PlayerList({
  title,
  entries,
  emptyText,
}: {
  title: string;
  entries: PublicGameEntry[];
  emptyText: string;
}) {
  return (
    <section style={styles.playerPanel}>
      <h2 style={styles.playerPanelTitle}>{title}</h2>

      {entries.length === 0 ? (
        <div style={styles.emptyState}>{emptyText}</div>
      ) : (
        <div style={styles.playerGrid}>
          {entries.map((entry) => (
            <div key={entry.id} style={styles.playerCard}>
              <strong>{playerDisplayName(entry)}</strong>
              <span>{statusLabel(entry.status)}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export default async function PublicHigherOrLowerDisplayPage({
  params,
}: PageProps) {
  const { slug } = await params;

  const tenantSlug = await getTenantSlugFromHeaders();
  const event = await getEventBySlug(tenantSlug, slug);

  if (!event || event.status !== "published") {
    notFound();
  }

  const brandingSettings = await getTenantBrandingSettings(event.tenant_slug);

  const publicDisplayName =
    cleanText(brandingSettings?.public_display_name) ||
    "SO Fundraising Platform";

  const publicTagline =
    cleanText(brandingSettings?.public_tagline) ||
    "Supporting causes through premium fundraising campaigns.";

  const publicLogoUrl = cleanText(brandingSettings?.public_logo_url);
  const publicLogoMarkUrl = cleanText(brandingSettings?.public_logo_mark_url);
  const publicFooterText = cleanText(brandingSettings?.public_footer_text);

  const primaryColour = normaliseHexColour(
    brandingSettings?.public_primary_colour,
    "#1683F8",
  );

  const accentColour = normaliseHexColour(
    brandingSettings?.public_accent_colour,
    "#FACC15",
  );

  const brandLogoSrc = publicLogoMarkUrl || publicLogoUrl;

  const session = await getPublicHigherOrLowerSession({
    tenantSlug: event.tenant_slug,
    eventId: event.id,
  });

  const rounds = session
    ? await listPublicHigherOrLowerRounds({
        tenantSlug: event.tenant_slug,
        eventId: event.id,
        sessionId: session.id,
      })
    : [];

  const entries = session
    ? await listPublicHigherOrLowerEntries({
        tenantSlug: event.tenant_slug,
        eventId: event.id,
        sessionId: session.id,
      })
    : [];

  const baseline = startingRound(rounds);
  const currentRound = openRound(rounds);
  const revealedRounds = revealedPlayableRounds(rounds);
  const active = activeEntries(entries);
  const winners = winnerEntries(entries);
  const eliminated = eliminatedEntries(entries);

  const currentPreviousRound = currentRound
    ? previousRoundFor(rounds, currentRound)
    : null;

  const latestRevealedRound =
    revealedRounds.length > 0 ? revealedRounds[revealedRounds.length - 1] : null;

  const currentBaseline = currentPreviousRound || latestRevealedRound || baseline;

  const pageStyle: CSSProperties = {
    ...styles.page,
    background: `radial-gradient(circle at top left, ${accentColour}22, transparent 34%), radial-gradient(circle at 80% 8%, ${primaryColour}18, transparent 30%), #f8fafc`,
  };

  const heroStyle: CSSProperties = {
    ...styles.hero,
    background: `radial-gradient(circle at bottom right, ${accentColour}24, transparent 34%), linear-gradient(135deg, #020617 0%, #0f172a 55%, #172554 100%)`,
    borderColor: `${accentColour}55`,
  };

  const brandFallbackStyle: CSSProperties = {
    ...styles.brandLogoFallback,
    background: primaryColour,
    borderColor: accentColour,
  };

  return (
    <main className="public-higher-lower-page" style={pageStyle}>
      <style>{responsiveStyles}</style>

      <section className="brandHeader" style={styles.brandHeader}>
        <div className="brandIdentity" style={styles.brandIdentity}>
          {brandLogoSrc ? (
            <div style={styles.brandLogoWrap}>
              <img
                src={brandLogoSrc}
                alt={publicDisplayName}
                style={styles.brandLogo}
              />
            </div>
          ) : (
            <div style={brandFallbackStyle}>
              {publicDisplayName.slice(0, 2).toUpperCase()}
            </div>
          )}

          <div style={styles.brandCopy}>
            <p style={{ ...styles.brandKicker, color: primaryColour }}>
              Higher or Lower live display
            </p>
            <h1 style={styles.brandTitle}>{publicDisplayName}</h1>
            <p style={styles.brandTagline}>{publicTagline}</p>
          </div>
        </div>

        <div
          style={{
            ...styles.brandFeature,
            borderColor: `${accentColour}78`,
            background: `linear-gradient(135deg, ${accentColour}12, #ffffff 78%)`,
          }}
        >
          <span style={styles.brandFeatureKicker}>Event</span>
          <strong style={styles.brandFeatureTitle}>{event.title}</strong>
          <span style={styles.brandFeatureText}>
            {event.location || "Location to be confirmed"}
          </span>
        </div>
      </section>

      <section style={heroStyle}>
        <div style={styles.heroContent}>
          <Link href={`/e/${encodeURIComponent(event.slug)}`} style={styles.backLink}>
            ← Back to event
          </Link>

          <div style={styles.badgeRow}>
            <span
              style={{
                ...styles.badge,
                background: `${accentColour}24`,
                borderColor: `${accentColour}66`,
              }}
            >
              Room screen
            </span>

            <span
              style={{
                ...styles.statusPill,
                ...statusStyle(session?.status || "draft"),
              }}
            >
              {session ? statusLabel(session.status) : "Not started"}
            </span>
          </div>

          <h1 style={styles.heroTitle}>
            {session?.title || "Higher or Lower"}
          </h1>

          <p style={styles.heroText}>
            Guess whether the next prize value will be higher or lower. The next
            prize is hidden until the organiser reveals it.
          </p>

          <div className="summaryGrid" style={styles.summaryGrid}>
            <StatCard label="Active players" value={active.length} />
            <StatCard label="Eliminated" value={eliminated.length} />
            <StatCard label="Revealed rounds" value={revealedRounds.length} />
            <StatCard label="Game status" value={session ? statusLabel(session.status) : "Waiting"} />
          </div>
        </div>
      </section>

      <div style={styles.contentWrap}>
        {!session ? (
          <section style={styles.waitingPanel}>
            <div style={styles.waitingEyebrow}>Waiting for organiser</div>
            <h2 style={styles.waitingTitle}>The game has not started yet</h2>
            <p style={styles.waitingText}>
              The organiser will create the Higher or Lower game from the saved
              prize list before play begins.
            </p>
          </section>
        ) : winners.length > 0 ? (
          <section style={styles.winnerPanel}>
            <div style={styles.winnerEyebrow}>Winner declared</div>
            <h2 style={styles.winnerTitle}>{playerDisplayName(winners[0])}</h2>
            <p style={styles.winnerText}>
              Congratulations. Thank you to everyone who took part.
            </p>
          </section>
        ) : entries.length > 0 && active.length === 0 ? (
          <section style={styles.noPlayersPanel}>
            <div style={styles.noPlayersEyebrow}>Tie-break needed</div>
            <h2 style={styles.noPlayersTitle}>No active players remain</h2>
            <p style={styles.noPlayersText}>
              The organiser will decide whether to reopen the last round or
              declare a winner manually.
            </p>
          </section>
        ) : null}

        {session && baseline ? (
          <section className="gameBoard" style={styles.gameBoard}>
            <article style={styles.baselineCard}>
              <div style={styles.cardEyebrow}>
                {currentRound ? "Current baseline prize" : "Starting prize"}
              </div>

              <PrizeImage
                imageUrl={currentBaseline?.reveal_image_url}
                alt={currentBaseline?.reveal_title || "Current prize"}
              />

              <div style={styles.baselineBody}>
                <h2 style={styles.baselineTitle}>
                  {currentBaseline?.reveal_title || "Prize revealed"}
                </h2>

                <p style={styles.baselineValue}>
                  {event.currency}{" "}
                  {moneyFromCents(
                    currentBaseline?.reveal_value_cents || 0,
                  ).replace("£", "")}
                </p>

                {currentBaseline?.reveal_description ? (
                  <p style={styles.baselineDescription}>
                    {currentBaseline.reveal_description}
                  </p>
                ) : null}
              </div>
            </article>

            <article
              style={{
                ...styles.questionCard,
                borderColor: `${accentColour}66`,
                background: `radial-gradient(circle at top left, ${accentColour}24, transparent 34%), linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)`,
              }}
            >
              {currentRound ? (
                <>
                  <div style={styles.cardEyebrow}>Round {currentRound.round_number}</div>

                  <h2 style={styles.questionTitle}>
                    Will the next prize be higher or lower?
                  </h2>

                  <p style={styles.questionText}>
                    Compare against{" "}
                    <strong>{currentBaseline?.reveal_title || "the current prize"}</strong>{" "}
                    valued at{" "}
                    <strong>
                      {event.currency}{" "}
                      {moneyFromCents(
                        currentBaseline?.reveal_value_cents || 0,
                      ).replace("£", "")}
                    </strong>
                    .
                  </p>

                  <div style={styles.hiddenNextPrize}>
                    <PrizeImage imageUrl={null} alt="Hidden next prize" hidden />

                    <div>
                      <span style={styles.hiddenLabel}>Next prize</span>
                      <strong style={styles.hiddenTitle}>
                        Hidden until reveal
                      </strong>
                      <p style={styles.hiddenText}>
                        The title, value, image and answer are not shown until
                        the organiser reveals this round.
                      </p>
                    </div>
                  </div>

                  <div className="choiceGrid" style={styles.choiceGrid}>
                    <div style={styles.choiceCard}>Higher</div>
                    <div style={styles.choiceCard}>Lower</div>
                  </div>
                </>
              ) : (
                <>
                  <div style={styles.cardEyebrow}>Waiting</div>
                  <h2 style={styles.questionTitle}>
                    Waiting for the next round
                  </h2>
                  <p style={styles.questionText}>
                    The organiser will open or reveal the next round from the
                    live game controller.
                  </p>
                </>
              )}
            </article>
          </section>
        ) : session ? (
          <section style={styles.waitingPanel}>
            <div style={styles.waitingEyebrow}>Prize chain not ready</div>
            <h2 style={styles.waitingTitle}>Starting prize not found</h2>
            <p style={styles.waitingText}>
              The organiser needs to rebuild the live game from the saved prize
              list.
            </p>
          </section>
        ) : null}
                {session && revealedRounds.length > 0 ? (
          <section style={styles.historyPanel}>
            <div style={styles.historyHeader}>
              <div>
                <div style={styles.historyEyebrow}>Revealed prizes</div>
                <h2 style={styles.historyHeading}>Prize history</h2>
              </div>

              <span
                style={{
                  ...styles.historyCount,
                  borderColor: `${accentColour}66`,
                  background: `${accentColour}18`,
                }}
              >
                {revealedRounds.length} revealed
              </span>
            </div>

            <div className="historyGrid" style={styles.historyGrid}>
              {revealedRounds.map((round) => (
                <RevealedPrizeCard
                  key={round.id}
                  round={round}
                  previousRound={previousRoundFor(rounds, round)}
                  currency={event.currency || "GBP"}
                />
              ))}
            </div>
          </section>
        ) : null}

        {session ? (
          <div className="playersGrid" style={styles.playersGrid}>
            <PlayerList
              title="Still playing"
              entries={active}
              emptyText="No active players are currently showing."
            />

            <PlayerList
              title="Out of the game"
              entries={eliminated.slice(0, 12)}
              emptyText="No players have been eliminated yet."
            />
          </div>
        ) : null}

        {publicFooterText ? (
          <footer
            style={{
              ...styles.footer,
              borderColor: `${accentColour}60`,
            }}
          >
            <p style={styles.footerText}>{publicFooterText}</p>
          </footer>
        ) : null}
      </div>
    </main>
  );
}

const responsiveStyles = `
.public-higher-lower-page,
.public-higher-lower-page * {
  box-sizing: border-box;
}

.public-higher-lower-page {
  overflow-x: hidden;
}

.public-higher-lower-page section,
.public-higher-lower-page div,
.public-higher-lower-page article,
.public-higher-lower-page img,
.public-higher-lower-page a {
  min-width: 0;
  max-width: 100%;
}

@media (max-width: 980px) {
  .public-higher-lower-page .brandHeader,
  .public-higher-lower-page .gameBoard,
  .public-higher-lower-page .playersGrid {
    grid-template-columns: 1fr !important;
  }

  .public-higher-lower-page .historyGrid {
    grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
  }
}

@media (max-width: 680px) {
  .public-higher-lower-page .brandHeader {
    padding: 12px !important;
    border-radius: 22px !important;
    margin: 10px 10px 12px !important;
  }

  .public-higher-lower-page .brandIdentity {
    grid-template-columns: 56px minmax(0, 1fr) !important;
  }

  .public-higher-lower-page .brandLogoWrap,
  .public-higher-lower-page .brandLogoFallback {
    width: 56px !important;
    height: 56px !important;
    border-radius: 16px !important;
  }

  .public-higher-lower-page .brandTitle {
    font-size: clamp(24px, 8vw, 36px) !important;
    letter-spacing: -0.06em !important;
  }

  .public-higher-lower-page .hero {
    padding: 22px 14px !important;
  }

  .public-higher-lower-page .heroTitle {
    font-size: clamp(42px, 14vw, 64px) !important;
    line-height: 0.95 !important;
  }

  .public-higher-lower-page .summaryGrid,
  .public-higher-lower-page .choiceGrid,
  .public-higher-lower-page .historyGrid {
    grid-template-columns: 1fr !important;
  }

  .public-higher-lower-page .hiddenNextPrize {
    grid-template-columns: 1fr !important;
  }
}
`;

const styles: Record<string, CSSProperties> = {
  page: {
    width: "100%",
    minHeight: "100vh",
    paddingBottom: 48,
    overflowX: "hidden",
  },

  brandHeader: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) minmax(250px, 0.34fr)",
    gap: 14,
    alignItems: "stretch",
    maxWidth: 1220,
    margin: "18px auto 14px",
    padding: 14,
    borderRadius: 24,
    background: "rgba(255,255,255,0.94)",
    border: "1px solid #e2e8f0",
    boxShadow: "0 14px 38px rgba(15,23,42,0.07)",
    backdropFilter: "blur(14px)",
  },

  brandIdentity: {
    display: "grid",
    gridTemplateColumns: "72px minmax(0, 1fr)",
    gap: 14,
    alignItems: "center",
    minWidth: 0,
  },

  brandLogoWrap: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: 72,
    height: 72,
    borderRadius: 18,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    overflow: "hidden",
    boxShadow: "0 10px 24px rgba(15,23,42,0.08)",
  },

  brandLogo: {
    display: "block",
    width: "100%",
    height: "100%",
    objectFit: "contain",
    padding: 7,
  },

  brandLogoFallback: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: 72,
    height: 72,
    borderRadius: 18,
    border: "2px solid",
    color: "#0f172a",
    fontSize: 22,
    fontWeight: 950,
    letterSpacing: "-0.05em",
  },

  brandCopy: {
    display: "grid",
    gap: 4,
    minWidth: 0,
  },

  brandKicker: {
    margin: 0,
    fontSize: 11,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
  },

  brandTitle: {
    margin: 0,
    color: "#0f172a",
    fontSize: "clamp(30px, 4.6vw, 50px)",
    lineHeight: 0.94,
    letterSpacing: "-0.075em",
    overflowWrap: "anywhere",
  },

  brandTagline: {
    margin: 0,
    color: "#475569",
    fontSize: 14,
    lineHeight: 1.35,
    fontWeight: 850,
    overflowWrap: "anywhere",
  },

  brandFeature: {
    display: "grid",
    gap: 5,
    alignContent: "center",
    padding: 12,
    borderRadius: 18,
    border: "1px solid",
    minWidth: 0,
  },

  brandFeatureKicker: {
    color: "#92400e",
    fontSize: 10,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
  },

  brandFeatureTitle: {
    color: "#0f172a",
    fontSize: 18,
    lineHeight: 1.1,
    letterSpacing: "-0.04em",
    overflowWrap: "anywhere",
  },

  brandFeatureText: {
    color: "#475569",
    fontSize: 12,
    lineHeight: 1.35,
    fontWeight: 750,
  },

  hero: {
    width: "100%",
    color: "#ffffff",
    borderTop: "1px solid",
    borderBottom: "1px solid",
    boxShadow: "0 22px 60px rgba(15,23,42,0.18)",
  },

  heroContent: {
    maxWidth: 1220,
    margin: "0 auto",
    padding: "clamp(30px, 7vw, 72px) 14px",
  },

  backLink: {
    display: "inline-flex",
    marginBottom: 14,
    padding: "10px 14px",
    borderRadius: 999,
    background: "rgba(255,255,255,0.12)",
    color: "#ffffff",
    border: "1px solid rgba(255,255,255,0.18)",
    textDecoration: "none",
    fontWeight: 900,
    fontSize: 13,
    backdropFilter: "blur(10px)",
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
    color: "#fef3c7",
    border: "1px solid",
    fontSize: 13,
    fontWeight: 950,
    backdropFilter: "blur(10px)",
  },

  statusPill: {
    display: "inline-flex",
    padding: "8px 12px",
    borderRadius: 999,
    border: "1px solid",
    fontSize: 13,
    fontWeight: 950,
    backdropFilter: "blur(10px)",
  },

  heroTitle: {
    margin: 0,
    maxWidth: 920,
    fontSize: "clamp(52px, 11vw, 112px)",
    lineHeight: 0.9,
    letterSpacing: "-0.075em",
    fontWeight: 1000,
    overflowWrap: "anywhere",
  },

  heroText: {
    margin: "18px 0 0",
    color: "#dbeafe",
    fontSize: "clamp(17px, 3vw, 24px)",
    lineHeight: 1.45,
    maxWidth: 860,
    fontWeight: 800,
    overflowWrap: "anywhere",
  },

  summaryGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
    gap: 12,
    marginTop: 22,
  },

  statCard: {
    display: "grid",
    gap: 6,
    padding: 15,
    borderRadius: 18,
    background: "rgba(255,255,255,0.09)",
    border: "1px solid rgba(255,255,255,0.14)",
    backdropFilter: "blur(12px)",
  },

  statLabel: {
    color: "#bfdbfe",
    fontSize: 11,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
  },

  statValue: {
    color: "#ffffff",
    fontSize: 24,
    lineHeight: 1,
    fontWeight: 950,
    letterSpacing: "-0.045em",
    overflowWrap: "anywhere",
  },

  contentWrap: {
    maxWidth: 1220,
    margin: "0 auto",
    padding: "18px 14px 0",
  },

  waitingPanel: {
    display: "grid",
    gap: 10,
    padding: "clamp(22px, 5vw, 34px)",
    borderRadius: 28,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    boxShadow: "0 14px 38px rgba(15,23,42,0.08)",
    marginBottom: 18,
  },

  waitingEyebrow: {
    color: "#2563eb",
    fontSize: 12,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
  },

  waitingTitle: {
    margin: 0,
    color: "#0f172a",
    fontSize: "clamp(30px, 7vw, 52px)",
    lineHeight: 0.98,
    letterSpacing: "-0.06em",
  },

  waitingText: {
    margin: 0,
    color: "#475569",
    fontSize: 17,
    lineHeight: 1.55,
    fontWeight: 750,
    maxWidth: 820,
  },

  winnerPanel: {
    display: "grid",
    gap: 10,
    padding: "clamp(24px, 5vw, 40px)",
    borderRadius: 30,
    background:
      "radial-gradient(circle at top left, rgba(250,204,21,0.26), transparent 35%), linear-gradient(135deg, #fffbeb 0%, #ffffff 64%)",
    border: "1px solid #fde68a",
    boxShadow: "0 18px 46px rgba(146,64,14,0.10)",
    marginBottom: 18,
  },

  winnerEyebrow: {
    color: "#92400e",
    fontSize: 12,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
  },

  winnerTitle: {
    margin: 0,
    color: "#422006",
    fontSize: "clamp(42px, 9vw, 86px)",
    lineHeight: 0.9,
    letterSpacing: "-0.075em",
    overflowWrap: "anywhere",
  },

  winnerText: {
    margin: 0,
    color: "#92400e",
    fontSize: 18,
    lineHeight: 1.5,
    fontWeight: 850,
  },

  noPlayersPanel: {
    display: "grid",
    gap: 10,
    padding: "clamp(22px, 5vw, 34px)",
    borderRadius: 28,
    background:
      "radial-gradient(circle at top left, rgba(239,68,68,0.12), transparent 34%), linear-gradient(135deg, #fff7ed 0%, #ffffff 68%)",
    border: "1px solid #fed7aa",
    boxShadow: "0 14px 34px rgba(154,52,18,0.08)",
    marginBottom: 18,
  },

  noPlayersEyebrow: {
    color: "#c2410c",
    fontSize: 12,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
  },

  noPlayersTitle: {
    margin: 0,
    color: "#7c2d12",
    fontSize: "clamp(30px, 7vw, 52px)",
    lineHeight: 0.98,
    letterSpacing: "-0.06em",
  },

  noPlayersText: {
    margin: 0,
    color: "#9a3412",
    fontSize: 17,
    lineHeight: 1.55,
    fontWeight: 850,
  },

  gameBoard: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 0.92fr) minmax(0, 1.08fr)",
    gap: 18,
    alignItems: "stretch",
    marginBottom: 18,
  },

  baselineCard: {
    display: "grid",
    gap: 14,
    padding: "clamp(18px, 4vw, 24px)",
    borderRadius: 28,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    boxShadow: "0 14px 38px rgba(15,23,42,0.08)",
    overflow: "hidden",
  },

  cardEyebrow: {
    color: "#2563eb",
    fontSize: 12,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
  },

  prizeImageWrap: {
    width: "100%",
    borderRadius: 24,
    overflow: "hidden",
    border: "1px solid #e2e8f0",
    background: "#f8fafc",
    boxShadow: "0 12px 28px rgba(15,23,42,0.08)",
  },

  prizeImage: {
    display: "block",
    width: "100%",
    maxHeight: 430,
    objectFit: "cover",
    objectPosition: "center",
  },

  hiddenPrizeImage: {
    display: "grid",
    placeItems: "center",
    gap: 9,
    minHeight: 230,
    borderRadius: 24,
    background:
      "radial-gradient(circle at top left, rgba(250,204,21,0.16), transparent 36%), linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
    color: "#fef3c7",
    border: "1px solid rgba(250,204,21,0.32)",
    textAlign: "center",
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
  },

  hiddenPrizeIcon: {
    display: "grid",
    placeItems: "center",
    width: 76,
    height: 76,
    borderRadius: 999,
    background: "rgba(250,204,21,0.18)",
    border: "1px solid rgba(250,204,21,0.4)",
    color: "#fde68a",
    fontSize: 44,
    lineHeight: 1,
    fontWeight: 1000,
  },

  baselineBody: {
    display: "grid",
    gap: 8,
  },

  baselineTitle: {
    margin: 0,
    color: "#0f172a",
    fontSize: "clamp(30px, 6vw, 54px)",
    lineHeight: 0.98,
    letterSpacing: "-0.06em",
    overflowWrap: "anywhere",
  },

  baselineValue: {
    margin: 0,
    color: "#92400e",
    fontSize: 28,
    lineHeight: 1,
    fontWeight: 950,
    letterSpacing: "-0.05em",
  },

  baselineDescription: {
    margin: 0,
    color: "#475569",
    lineHeight: 1.55,
    fontWeight: 750,
    overflowWrap: "anywhere",
  },

  questionCard: {
    display: "grid",
    alignContent: "center",
    gap: 16,
    padding: "clamp(22px, 5vw, 34px)",
    borderRadius: 28,
    border: "1px solid",
    boxShadow: "0 14px 38px rgba(15,23,42,0.08)",
    overflow: "hidden",
  },

  questionTitle: {
    margin: 0,
    color: "#0f172a",
    fontSize: "clamp(42px, 8vw, 82px)",
    lineHeight: 0.9,
    letterSpacing: "-0.075em",
    overflowWrap: "anywhere",
  },

  questionText: {
    margin: 0,
    color: "#475569",
    fontSize: 18,
    lineHeight: 1.5,
    fontWeight: 800,
  },

  hiddenNextPrize: {
    display: "grid",
    gridTemplateColumns: "minmax(180px, 0.42fr) minmax(0, 1fr)",
    gap: 14,
    alignItems: "center",
    padding: 14,
    borderRadius: 24,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
  },

  hiddenLabel: {
    display: "block",
    color: "#64748b",
    fontSize: 11,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    marginBottom: 6,
  },

  hiddenTitle: {
    display: "block",
    color: "#0f172a",
    fontSize: 26,
    lineHeight: 1.05,
    letterSpacing: "-0.05em",
  },

  hiddenText: {
    margin: "8px 0 0",
    color: "#64748b",
    fontSize: 14,
    lineHeight: 1.45,
    fontWeight: 800,
  },

  choiceGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 12,
  },

  choiceCard: {
    display: "grid",
    placeItems: "center",
    minHeight: 104,
    padding: 18,
    borderRadius: 26,
    background: "#0f172a",
    color: "#ffffff",
    border: "1px solid rgba(15,23,42,0.16)",
    boxShadow: "0 16px 34px rgba(15,23,42,0.18)",
    fontSize: "clamp(30px, 7vw, 54px)",
    lineHeight: 1,
    fontWeight: 1000,
    letterSpacing: "-0.065em",
  },

  historyPanel: {
    display: "grid",
    gap: 16,
    padding: "clamp(18px, 4vw, 24px)",
    borderRadius: 28,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    boxShadow: "0 14px 38px rgba(15,23,42,0.08)",
    marginBottom: 18,
  },

  historyHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "flex-start",
    flexWrap: "wrap",
  },

  historyEyebrow: {
    color: "#92400e",
    fontSize: 12,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    marginBottom: 6,
  },

  historyHeading: {
    margin: 0,
    color: "#0f172a",
    fontSize: "clamp(30px, 6vw, 48px)",
    lineHeight: 0.98,
    letterSpacing: "-0.06em",
  },

  historyCount: {
    display: "inline-flex",
    padding: "9px 12px",
    borderRadius: 999,
    color: "#92400e",
    border: "1px solid",
    fontSize: 13,
    fontWeight: 950,
  },

  historyGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: 14,
  },

  historyCard: {
    display: "grid",
    gap: 12,
    padding: 14,
    borderRadius: 22,
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    overflow: "hidden",
  },

  historyBody: {
    display: "grid",
    gap: 8,
  },

  historyMetaRow: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
    alignItems: "center",
  },

  roundPill: {
    display: "inline-flex",
    width: "fit-content",
    padding: "6px 9px",
    borderRadius: 999,
    background: "#eff6ff",
    color: "#1d4ed8",
    border: "1px solid #bfdbfe",
    fontSize: 11,
    fontWeight: 950,
  },

  directionPill: {
    display: "inline-flex",
    width: "fit-content",
    padding: "6px 9px",
    borderRadius: 999,
    background: "#fffbeb",
    color: "#92400e",
    border: "1px solid #fde68a",
    fontSize: 11,
    fontWeight: 950,
  },

  historyTitle: {
    margin: 0,
    color: "#0f172a",
    fontSize: 22,
    lineHeight: 1.05,
    letterSpacing: "-0.045em",
    overflowWrap: "anywhere",
  },

  historyValue: {
    margin: 0,
    color: "#92400e",
    fontSize: 20,
    lineHeight: 1,
    fontWeight: 950,
    letterSpacing: "-0.04em",
  },

  historyDescription: {
    margin: 0,
    color: "#64748b",
    fontSize: 14,
    lineHeight: 1.45,
    fontWeight: 750,
    overflowWrap: "anywhere",
  },

  playersGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 18,
    marginBottom: 18,
  },

  playerPanel: {
    display: "grid",
    gap: 14,
    padding: 18,
    borderRadius: 24,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    boxShadow: "0 10px 28px rgba(15,23,42,0.06)",
  },

  playerPanelTitle: {
    margin: 0,
    color: "#0f172a",
    fontSize: 26,
    lineHeight: 1.05,
    letterSpacing: "-0.045em",
  },

  playerGrid: {
    display: "grid",
    gap: 8,
  },

  playerCard: {
    display: "flex",
    justifyContent: "space-between",
    gap: 10,
    alignItems: "center",
    flexWrap: "wrap",
    padding: 12,
    borderRadius: 16,
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    color: "#0f172a",
    fontSize: 14,
    lineHeight: 1.35,
  },

  emptyState: {
    padding: 16,
    borderRadius: 16,
    background: "#f8fafc",
    border: "1px dashed #cbd5e1",
    color: "#64748b",
    fontWeight: 850,
    textAlign: "center",
  },

  footer: {
    marginTop: 20,
    padding: 16,
    borderRadius: 22,
    background: "#ffffff",
    border: "1px solid",
    textAlign: "center",
  },

  footerText: {
    margin: 0,
    color: "#64748b",
    fontWeight: 800,
    lineHeight: 1.5,
  },
};
