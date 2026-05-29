import type { CSSProperties } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { query, queryOne } from "@/lib/db";
import { getTenantSlugFromHeaders } from "@/lib/tenant";
import { getEventBySlug } from "../../../../../../api/_lib/events-repo";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type PageProps = {
  params: Promise<{
    slug: string;
  }>;
  searchParams?: Promise<{
    entry?: string;
    success?: string;
    error?: string;
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

type PlayerEntry = {
  id: string;
  tenant_slug: string;
  event_id: string;
  session_id: string;
  session_title: string;
  session_status: string;
  event_order_item_id: string | null;
  entry_number: number;
  player_name: string | null;
  player_email: string | null;
  status: string;
  eliminated_round_number: number | null;
  order_status: string | null;
};

type OpenRound = {
  id: string;
  round_number: number;
  prompt: string | null;
  status: string;
};

type BaselineRound = {
  id: string;
  round_number: number;
  reveal_title: string | null;
  reveal_description: string | null;
  reveal_value_cents: number | null;
  reveal_image_url: string | null;
  status: string;
};

type ExistingAnswer = {
  id: string;
  answer: string;
  submitted_at: string;
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

function cleanHigherLowerAnswer(value: unknown) {
  const clean = cleanText(value).toLowerCase();

  if (clean === "higher" || clean === "lower") {
    return clean;
  }

  return "";
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
  if (clean === "paid") return "Paid";
  if (clean === "higher") return "Higher";
  if (clean === "lower") return "Lower";

  return clean || "Waiting";
}

function statusStyle(value: string | null | undefined): CSSProperties {
  const clean = cleanText(value).toLowerCase();

  if (clean === "live" || clean === "open" || clean === "active" || clean === "paid") {
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

function playerDisplayName(entry: PlayerEntry | null | undefined) {
  if (!entry) return "Player";

  return `${cleanText(entry.player_name) || "Player"} #${entry.entry_number}`;
}

function getSuccessMessage(value: string | undefined) {
  if (value === "answer-saved") return "Your answer has been saved.";

  return "";
}

function getErrorMessage(value: string | undefined) {
  if (value === "round-not-open") return "This round is not open for answers.";
  if (value === "entry-not-active") return "This entry is not active in the game.";
  if (value === "game-closed") return "This game is closed.";
  if (value === "answer-required") return "Choose Higher or Lower before submitting.";
  if (value === "paid-entry-required") return "This answer link is not linked to a paid entry.";

  return cleanText(value);
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

async function getPlayerEntry(input: {
  tenantSlug: string;
  eventId: string;
  token: string;
}) {
  const rows = await query<PlayerEntry>(
    `
      select
        e.id::text,
        e.tenant_slug,
        e.event_id::text,
        e.session_id::text,
        s.title as session_title,
        s.status as session_status,
        e.event_order_item_id::text,
        e.entry_number,
        e.player_name,
        e.player_email,
        e.status,
        e.eliminated_round_number,
        eo.status as order_status
      from event_addon_game_entries e
      inner join event_addon_game_sessions s
        on s.id = e.session_id
       and s.tenant_slug = e.tenant_slug
       and s.event_id = e.event_id
       and s.add_on_type = 'higher_or_lower'
      inner join event_orders eo
        on eo.id = e.event_order_id
       and eo.tenant_slug = e.tenant_slug
       and eo.event_id = e.event_id
      where e.tenant_slug = $1
        and e.event_id = $2
        and e.public_answer_token = $3
        and e.event_order_item_id is not null
        and eo.status = 'paid'
      limit 1
    `,
    [input.tenantSlug, input.eventId, input.token],
  );

  return rows[0] || null;
}

async function getCurrentOpenRound(input: {
  tenantSlug: string;
  eventId: string;
  sessionId: string;
}) {
  const rows = await query<OpenRound>(
    `
      select
        id::text,
        round_number,
        prompt,
        status
      from event_addon_game_rounds
      where tenant_slug = $1
        and event_id = $2
        and session_id = $3
        and round_number > 0
        and status = 'open'
      order by round_number asc
      limit 1
    `,
    [input.tenantSlug, input.eventId, input.sessionId],
  );

  return rows[0] || null;
}

async function getCurrentBaselineRound(input: {
  tenantSlug: string;
  eventId: string;
  sessionId: string;
  openRoundNumber: number | null;
}) {
  const roundNumber =
    Number(input.openRoundNumber || 0) > 0
      ? Number(input.openRoundNumber || 0) - 1
      : null;

  const rows = await query<BaselineRound>(
    roundNumber === null
      ? `
          select
            id::text,
            round_number,
            reveal_title,
            reveal_description,
            reveal_value_cents,
            reveal_image_url,
            status
          from event_addon_game_rounds
          where tenant_slug = $1
            and event_id = $2
            and session_id = $3
            and status = 'revealed'
          order by round_number desc
          limit 1
        `
      : `
          select
            id::text,
            round_number,
            reveal_title,
            reveal_description,
            reveal_value_cents,
            reveal_image_url,
            status
          from event_addon_game_rounds
          where tenant_slug = $1
            and event_id = $2
            and session_id = $3
            and round_number = $4
            and status = 'revealed'
          limit 1
        `,
    roundNumber === null
      ? [input.tenantSlug, input.eventId, input.sessionId]
      : [input.tenantSlug, input.eventId, input.sessionId, roundNumber],
  );

  return rows[0] || null;
}

async function getExistingAnswer(input: {
  tenantSlug: string;
  eventId: string;
  sessionId: string;
  roundId: string;
  entryId: string;
}) {
  const rows = await query<ExistingAnswer>(
    `
      select
        id::text,
        answer,
        submitted_at::text
      from event_addon_game_answers
      where tenant_slug = $1
        and event_id = $2
        and session_id = $3
        and round_id = $4
        and entry_id = $5
      limit 1
    `,
    [
      input.tenantSlug,
      input.eventId,
      input.sessionId,
      input.roundId,
      input.entryId,
    ],
  );

  return rows[0] || null;
}

async function savePublicAnswerAction(formData: FormData) {
  "use server";

  const slug = cleanText(formData.get("slug"));
  const token = cleanText(formData.get("entry"));
  const answer = cleanHigherLowerAnswer(formData.get("answer"));

  if (!slug || !token) {
    redirect("/");
  }

  const redirectBase = `/e/${encodeURIComponent(slug)}/higher-or-lower/play?entry=${encodeURIComponent(token)}`;

  if (!answer) {
    redirect(`${redirectBase}&error=answer-required`);
  }

  const tenantSlug = await getTenantSlugFromHeaders();
  const event = await getEventBySlug(tenantSlug, slug);

  if (!event || event.status !== "published") {
    notFound();
  }

  const entry = await getPlayerEntry({
    tenantSlug: event.tenant_slug,
    eventId: event.id,
    token,
  });

  if (!entry || entry.order_status !== "paid" || !entry.event_order_item_id) {
    redirect(`${redirectBase}&error=paid-entry-required`);
  }

  if (entry.status !== "active") {
    redirect(`${redirectBase}&error=entry-not-active`);
  }

  if (entry.session_status === "closed") {
    redirect(`${redirectBase}&error=game-closed`);
  }

  const currentOpenRound = await getCurrentOpenRound({
    tenantSlug: event.tenant_slug,
    eventId: event.id,
    sessionId: entry.session_id,
  });

  if (!currentOpenRound || currentOpenRound.status !== "open") {
    redirect(`${redirectBase}&error=round-not-open`);
  }

  await query(
    `
      insert into event_addon_game_answers (
        tenant_slug,
        event_id,
        session_id,
        round_id,
        entry_id,
        event_order_item_id,
        answer,
        submitted_by
      )
      values ($1,$2,$3,$4,$5,$6,$7,'public')
      on conflict (entry_id, round_id)
      do update set
        answer = excluded.answer,
        submitted_by = 'public',
        submitted_at = now(),
        is_correct = null
    `,
    [
      event.tenant_slug,
      event.id,
      entry.session_id,
      currentOpenRound.id,
      entry.id,
      entry.event_order_item_id,
      answer,
    ],
  );

  redirect(`${redirectBase}&success=answer-saved`);
}

export default async function PublicHigherOrLowerPlayPage({
  params,
  searchParams,
}: PageProps) {
  const { slug } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const token = cleanText(resolvedSearchParams.entry);

  if (!token) {
    notFound();
  }

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

  const entry = await getPlayerEntry({
    tenantSlug: event.tenant_slug,
    eventId: event.id,
    token,
  });

  if (!entry) {
    notFound();
  }

  const currentOpenRound = await getCurrentOpenRound({
    tenantSlug: event.tenant_slug,
    eventId: event.id,
    sessionId: entry.session_id,
  });

  const baseline = await getCurrentBaselineRound({
    tenantSlug: event.tenant_slug,
    eventId: event.id,
    sessionId: entry.session_id,
    openRoundNumber: currentOpenRound?.round_number || null,
  });

  const existingAnswer = currentOpenRound
    ? await getExistingAnswer({
        tenantSlug: event.tenant_slug,
        eventId: event.id,
        sessionId: entry.session_id,
        roundId: currentOpenRound.id,
        entryId: entry.id,
      })
    : null;

  const successMessage = getSuccessMessage(resolvedSearchParams.success);
  const errorMessage = getErrorMessage(resolvedSearchParams.error);
  const canAnswer =
    entry.order_status === "paid" &&
    entry.event_order_item_id &&
    entry.status === "active" &&
    entry.session_status !== "closed" &&
    currentOpenRound;

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
    <main className="public-higher-lower-play-page" style={pageStyle}>
      <style>{responsiveStyles}</style>

      <section className="brandHeader" style={styles.brandHeader}>
        <div className="brandIdentity" style={styles.brandIdentity}>
          {brandLogoSrc ? (
            <div style={styles.brandLogoWrap}>
              <img src={brandLogoSrc} alt={publicDisplayName} style={styles.brandLogo} />
            </div>
          ) : (
            <div style={brandFallbackStyle}>
              {publicDisplayName.slice(0, 2).toUpperCase()}
            </div>
          )}

          <div style={styles.brandCopy}>
            <p style={{ ...styles.brandKicker, color: primaryColour }}>
              Higher or Lower player entry
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
          <span style={styles.brandFeatureText}>{playerDisplayName(entry)}</span>
        </div>
      </section>

      <section className="hero" style={heroStyle}>
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
              Paid entry only
            </span>

            <span style={{ ...styles.statusPill, ...statusStyle(entry.status) }}>
              {statusLabel(entry.status)}
            </span>
          </div>

          <h1 className="heroTitle" style={styles.heroTitle}>
            {entry.session_title || "Higher or Lower"}
          </h1>
          <p style={styles.heroText}>
            Choose Higher or Lower while the current round is open. The next
            prize stays hidden until the organiser reveals it.
          </p>
        </div>
      </section>

      <div className="contentWrap" style={styles.contentWrap}>
        {successMessage ? <section style={styles.successBanner}>{successMessage}</section> : null}
        {errorMessage ? <section style={styles.errorBanner}>{errorMessage}</section> : null}

        <section className="answerGrid" style={styles.answerGrid}>
          <article style={styles.playerCard}>
            <div style={styles.cardEyebrow}>Your entry</div>
            <h2 style={styles.playerName}>{playerDisplayName(entry)}</h2>
            <p style={styles.playerMeta}>{entry.player_email || "No email recorded"}</p>

            <div style={styles.statusGrid}>
              <span style={{ ...styles.statusPill, ...statusStyle(entry.order_status) }}>
                Order {statusLabel(entry.order_status)}
              </span>
              <span style={{ ...styles.statusPill, ...statusStyle(entry.session_status) }}>
                Game {statusLabel(entry.session_status)}
              </span>
            </div>

            {entry.eliminated_round_number ? (
              <p style={styles.warningText}>
                This entry was eliminated in round {entry.eliminated_round_number}.
              </p>
            ) : null}
          </article>

          <article style={styles.baselineCard}>
            <div style={styles.cardEyebrow}>Current baseline prize</div>

            {baseline?.reveal_image_url ? (
              <div style={styles.prizeImageWrap}>
                <img
                  src={baseline.reveal_image_url}
                  alt={baseline.reveal_title || "Current baseline prize"}
                  style={styles.prizeImage}
                />
              </div>
            ) : (
              <div style={styles.hiddenPrizeImage}>
                <div style={styles.hiddenPrizeIcon}>?</div>
                <span>Baseline waiting</span>
              </div>
            )}

            <h2 style={styles.baselineTitle}>
              {baseline?.reveal_title || "Waiting for baseline prize"}
            </h2>

            {baseline ? (
              <p style={styles.baselineValue}>
                {event.currency} {moneyFromCents(baseline.reveal_value_cents).replace("£", "")}
              </p>
            ) : null}

            {baseline?.reveal_description ? (
              <p style={styles.baselineDescription}>{baseline.reveal_description}</p>
            ) : null}
          </article>
        </section>

        <section
          style={{
            ...styles.questionCard,
            borderColor: `${accentColour}66`,
            background: `radial-gradient(circle at top left, ${accentColour}24, transparent 34%), linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)`,
          }}
        >
          {currentOpenRound ? (
            <>
              <div style={styles.cardEyebrow}>Round {currentOpenRound.round_number}</div>
              <h2 style={styles.questionTitle}>Will the next prize be higher or lower?</h2>
              <p style={styles.questionText}>
                Compare against <strong>{baseline?.reveal_title || "the current prize"}</strong>
                {baseline ? (
                  <>
                    {" "}valued at <strong>{event.currency} {moneyFromCents(baseline.reveal_value_cents).replace("£", "")}</strong>
                  </>
                ) : null}
                .
              </p>

              <div className="hiddenNextPrize" style={styles.hiddenNextPrize}>
                <div style={styles.hiddenPrizeImageSmall}>
                  <div style={styles.hiddenPrizeIcon}>?</div>
                  <span>Next prize hidden</span>
                </div>
                <p style={styles.hiddenText}>
                  The next prize title, image, value and correct answer stay hidden
                  until the organiser reveals this round.
                </p>
              </div>

              {existingAnswer ? (
                <div style={styles.currentAnswerBox}>
                  <strong>Current saved answer: {statusLabel(existingAnswer.answer)}</strong>
                  <span>Saved {formatDate(existingAnswer.submitted_at)}</span>
                </div>
              ) : null}

              {canAnswer ? (
                <form action={savePublicAnswerAction} style={styles.choiceForm}>
                  <input type="hidden" name="slug" value={event.slug} />
                  <input type="hidden" name="entry" value={token} />

                  <button type="submit" name="answer" value="higher" style={styles.choiceButton}>
                    Higher
                  </button>
                  <button type="submit" name="answer" value="lower" style={styles.choiceButton}>
                    Lower
                  </button>
                </form>
              ) : (
                <div style={styles.closedBox}>
                  <strong>Answering is closed for this entry.</strong>
                  <span>
                    The game may be closed, this entry may no longer be active, or
                    the organiser may not have opened the next round yet.
                  </span>
                </div>
              )}
            </>
          ) : (
            <>
              <div style={styles.cardEyebrow}>Waiting for organiser</div>
              <h2 style={styles.questionTitle}>No round is open yet</h2>
              <p style={styles.questionText}>
                Keep this page open. The organiser will open the current round from
                the live game controller.
              </p>
            </>
          )}
        </section>

        <section className="roomLinkPanel" style={styles.roomLinkPanel}>
          <div>
            <strong style={styles.roomLinkTitle}>Watching the live screen?</strong>
            <p style={styles.roomLinkText}>
              The room display shows the current baseline prize, active players and
              revealed prize history without exposing the hidden next prize.
            </p>
          </div>

          <Link href={`/e/${encodeURIComponent(event.slug)}/higher-or-lower`} style={styles.roomLinkButton}>
            Open room display
          </Link>
        </section>

        {publicFooterText ? (
          <footer style={{ ...styles.footer, borderColor: `${accentColour}60` }}>
            <p style={styles.footerText}>{publicFooterText}</p>
          </footer>
        ) : null}
      </div>
    </main>
  );
}

const responsiveStyles = `
.public-higher-lower-play-page,
.public-higher-lower-play-page * {
  box-sizing: border-box;
}

.public-higher-lower-play-page {
  overflow-x: hidden;
}

.public-higher-lower-play-page section,
.public-higher-lower-play-page div,
.public-higher-lower-play-page article,
.public-higher-lower-play-page img,
.public-higher-lower-play-page a,
.public-higher-lower-play-page button,
.public-higher-lower-play-page form {
  min-width: 0;
  max-width: 100%;
}

@media (max-width: 980px) {
  .public-higher-lower-play-page .brandHeader,
  .public-higher-lower-play-page .answerGrid,
  .public-higher-lower-play-page .hiddenNextPrize,
  .public-higher-lower-play-page .roomLinkPanel {
    display: grid !important;
    grid-template-columns: minmax(0, 1fr) !important;
  }
}

@media (max-width: 760px) {
  .public-higher-lower-play-page .brandHeader {
    margin: 10px 10px 12px !important;
    padding: 12px !important;
    border-radius: 22px !important;
  }

  .public-higher-lower-play-page .brandIdentity {
    grid-template-columns: 54px minmax(0, 1fr) !important;
  }

  .public-higher-lower-play-page .brandLogoWrap,
  .public-higher-lower-play-page .brandLogoFallback {
    width: 54px !important;
    height: 54px !important;
    border-radius: 16px !important;
  }

  .public-higher-lower-play-page .brandTitle {
    font-size: clamp(24px, 8vw, 34px) !important;
    line-height: 0.98 !important;
    letter-spacing: -0.055em !important;
  }

  .public-higher-lower-play-page .brandTagline {
    font-size: 12px !important;
  }

  .public-higher-lower-play-page .heroContent {
    padding: 24px 12px 26px !important;
  }

  .public-higher-lower-play-page .heroTitle {
    font-size: clamp(40px, 12vw, 56px) !important;
    line-height: 0.96 !important;
    letter-spacing: -0.06em !important;
  }

  .public-higher-lower-play-page .heroText {
    font-size: 15px !important;
    line-height: 1.45 !important;
    margin-top: 12px !important;
  }

  .public-higher-lower-play-page .contentWrap {
    padding: 12px 10px 0 !important;
  }

  .public-higher-lower-play-page .answerGrid {
    gap: 12px !important;
  }

  .public-higher-lower-play-page .playerCard,
  .public-higher-lower-play-page .baselineCard,
  .public-higher-lower-play-page .questionCard,
  .public-higher-lower-play-page .roomLinkPanel {
    padding: 16px !important;
    border-radius: 22px !important;
  }

  .public-higher-lower-play-page .playerName,
  .public-higher-lower-play-page .baselineTitle,
  .public-higher-lower-play-page .questionTitle {
    font-size: clamp(32px, 9vw, 46px) !important;
    line-height: 0.98 !important;
    letter-spacing: -0.06em !important;
  }

  .public-higher-lower-play-page .questionText,
  .public-higher-lower-play-page .hiddenText,
  .public-higher-lower-play-page .roomLinkText {
    font-size: 15px !important;
    line-height: 1.5 !important;
  }

  .public-higher-lower-play-page .prizeImage {
    max-height: 260px !important;
  }

  .public-higher-lower-play-page .hiddenPrizeImage,
  .public-higher-lower-play-page .hiddenPrizeImageSmall {
    min-height: 150px !important;
    border-radius: 18px !important;
  }

  .public-higher-lower-play-page .hiddenPrizeIcon {
    width: 58px !important;
    height: 58px !important;
    font-size: 34px !important;
  }

  .public-higher-lower-play-page .choiceForm {
    grid-template-columns: 1fr !important;
  }

  .public-higher-lower-play-page .choiceButton {
    min-height: 78px !important;
    border-radius: 20px !important;
    font-size: clamp(30px, 10vw, 44px) !important;
  }

  .public-higher-lower-play-page .roomLinkButton {
    width: 100% !important;
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
    width: "fit-content",
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

  contentWrap: {
    maxWidth: 1220,
    margin: "0 auto",
    padding: "18px 14px 0",
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

  answerGrid: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 0.45fr) minmax(0, 0.55fr)",
    gap: 18,
    alignItems: "stretch",
    marginBottom: 18,
  },

  playerCard: {
    display: "grid",
    gap: 12,
    alignContent: "start",
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

  playerName: {
    margin: 0,
    color: "#0f172a",
    fontSize: "clamp(34px, 7vw, 58px)",
    lineHeight: 0.94,
    letterSpacing: "-0.07em",
    overflowWrap: "normal",
    wordBreak: "normal",
  },

  playerMeta: {
    margin: 0,
    color: "#64748b",
    fontWeight: 800,
    lineHeight: 1.45,
    overflowWrap: "anywhere",
  },

  statusGrid: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
  },

  warningText: {
    margin: 0,
    padding: 12,
    borderRadius: 16,
    background: "#fffbeb",
    border: "1px solid #fde68a",
    color: "#92400e",
    fontWeight: 850,
    lineHeight: 1.45,
  },

  baselineCard: {
    display: "grid",
    gap: 12,
    alignContent: "start",
    padding: "clamp(18px, 4vw, 24px)",
    borderRadius: 28,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    boxShadow: "0 14px 38px rgba(15,23,42,0.08)",
    overflow: "hidden",
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

  hiddenPrizeImageSmall: {
    display: "grid",
    placeItems: "center",
    gap: 8,
    minHeight: 180,
    borderRadius: 22,
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

  baselineTitle: {
    margin: 0,
    color: "#0f172a",
    fontSize: "clamp(30px, 6vw, 54px)",
    lineHeight: 0.98,
    letterSpacing: "-0.06em",
    overflowWrap: "normal",
    wordBreak: "normal",
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
    gap: 16,
    padding: "clamp(22px, 5vw, 34px)",
    borderRadius: 28,
    border: "1px solid",
    boxShadow: "0 14px 38px rgba(15,23,42,0.08)",
    overflow: "hidden",
    marginBottom: 18,
  },

  questionTitle: {
    margin: 0,
    color: "#0f172a",
    fontSize: "clamp(42px, 8vw, 82px)",
    lineHeight: 0.9,
    letterSpacing: "-0.075em",
    overflowWrap: "normal",
    wordBreak: "normal",
  },

  questionText: {
    margin: 0,
    color: "#475569",
    fontSize: 18,
    lineHeight: 1.5,
    fontWeight: 800,
    overflowWrap: "normal",
    wordBreak: "normal",
  },

  hiddenNextPrize: {
    display: "grid",
    gridTemplateColumns: "minmax(180px, 0.38fr) minmax(0, 1fr)",
    gap: 14,
    alignItems: "center",
    padding: 14,
    borderRadius: 24,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
  },

  hiddenText: {
    margin: 0,
    color: "#475569",
    fontSize: 15,
    lineHeight: 1.5,
    fontWeight: 800,
    overflowWrap: "normal",
    wordBreak: "normal",
  },

  currentAnswerBox: {
    display: "grid",
    gap: 4,
    padding: 14,
    borderRadius: 18,
    background: "#eff6ff",
    border: "1px solid #bfdbfe",
    color: "#1e3a8a",
    fontWeight: 850,
    lineHeight: 1.45,
  },

  choiceForm: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 12,
  },

  choiceButton: {
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
    cursor: "pointer",
  },

  closedBox: {
    display: "grid",
    gap: 5,
    padding: 14,
    borderRadius: 18,
    background: "#f8fafc",
    border: "1px dashed #cbd5e1",
    color: "#64748b",
    lineHeight: 1.5,
    fontWeight: 800,
  },

  roomLinkPanel: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) auto",
    gap: 14,
    alignItems: "center",
    padding: 18,
    borderRadius: 24,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    boxShadow: "0 10px 28px rgba(15,23,42,0.06)",
    marginBottom: 18,
  },

  roomLinkTitle: {
    display: "block",
    color: "#0f172a",
    fontSize: 18,
    lineHeight: 1.15,
    overflowWrap: "normal",
    wordBreak: "normal",
  },

  roomLinkText: {
    margin: "6px 0 0",
    color: "#64748b",
    lineHeight: 1.5,
    fontWeight: 750,
    overflowWrap: "normal",
    wordBreak: "normal",
  },

  roomLinkButton: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 44,
    padding: "10px 14px",
    borderRadius: 999,
    background: "#1683f8",
    color: "#ffffff",
    textDecoration: "none",
    fontWeight: 950,
    whiteSpace: "normal",
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
