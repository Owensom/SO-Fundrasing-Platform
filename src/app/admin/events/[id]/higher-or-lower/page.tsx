import type { CSSProperties, ReactNode } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { query } from "@/lib/db";
import { getTenantSlugFromHeaders } from "@/lib/tenant";
import { getEventById } from "../../../../../../api/_lib/events-repo";

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
  tenant_slug: string;
  event_id: string;
  add_on_type: string;
  title: string;
  status: string;
  current_round_number: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

type GameEntry = {
  id: string;
  tenant_slug: string;
  event_id: string;
  session_id: string;
  event_order_id: string | null;
  event_order_item_id: string | null;
  entry_number: number;
  player_name: string | null;
  player_email: string | null;
  status: string;
  eliminated_round_number: number | null;
  created_at: string;
  updated_at: string;
};

type GameRound = {
  id: string;
  tenant_slug: string;
  event_id: string;
  session_id: string;
  round_number: number;
  prompt: string | null;
  reveal_title: string | null;
  reveal_description: string | null;
  reveal_value_cents: number | null;
  correct_answer: string | null;
  status: string;
  revealed_at: string | null;
  created_at: string;
  updated_at: string;
};

type GameAnswer = {
  id: string;
  tenant_slug: string;
  event_id: string;
  session_id: string;
  round_id: string;
  entry_id: string;
  event_order_item_id: string | null;
  answer: string;
  is_correct: boolean | null;
  submitted_by: string | null;
  submitted_at: string;
  created_at: string;
};

type PaidHigherOrLowerOrderItem = {
  event_order_id: string;
  event_order_item_id: string;
  customer_name: string | null;
  customer_email: string | null;
  guest_name: string | null;
  quantity: number | string | null;
};

function cleanText(value: unknown) {
  return String(value || "").trim();
}

function cleanGameStatus(value: unknown) {
  const clean = cleanText(value).toLowerCase();

  if (
    clean === "draft" ||
    clean === "live" ||
    clean === "paused" ||
    clean === "closed"
  ) {
    return clean;
  }

  return "draft";
}

function cleanRoundStatus(value: unknown) {
  const clean = cleanText(value).toLowerCase();

  if (
    clean === "draft" ||
    clean === "open" ||
    clean === "locked" ||
    clean === "revealed" ||
    clean === "closed"
  ) {
    return clean;
  }

  return "draft";
}

function cleanHigherLowerAnswer(value: unknown) {
  const clean = cleanText(value).toLowerCase();

  if (clean === "higher" || clean === "lower") {
    return clean;
  }

  return "";
}

function positiveInteger(value: unknown, fallback = 0) {
  const number = Number(value);

  if (!Number.isFinite(number) || number < 0) {
    return fallback;
  }

  return Math.floor(number);
}

function moneyInputToCents(value: unknown) {
  const raw = cleanText(value).replace(/[£,\s]/g, "");

  if (!raw) return null;

  const number = Number(raw);

  if (!Number.isFinite(number) || number < 0) {
    return null;
  }

  return Math.round(number * 100);
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
  if (clean === "locked") return "Locked";
  if (clean === "revealed") return "Revealed";
  if (clean === "active") return "Active";
  if (clean === "eliminated") return "Eliminated";
  if (clean === "winner") return "Winner";
  if (clean === "withdrawn") return "Withdrawn";

  return clean || "Unknown";
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

  if (clean === "paused" || clean === "locked" || clean === "draft") {
    return {
      background: "#eff6ff",
      color: "#1d4ed8",
      borderColor: "#bfdbfe",
    };
  }

  if (clean === "revealed" || clean === "winner") {
    return {
      background: "#fef3c7",
      color: "#92400e",
      borderColor: "#fde68a",
    };
  }

  if (clean === "closed" || clean === "eliminated" || clean === "withdrawn") {
    return {
      background: "#fee2e2",
      color: "#991b1b",
      borderColor: "#fecaca",
    };
  }

  return {
    background: "#f8fafc",
    color: "#475569",
    borderColor: "#e2e8f0",
  };
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
        tenant_slug,
        event_id::text,
        add_on_type,
        title,
        status,
        current_round_number,
        notes,
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

async function listGameEntries(input: {
  tenantSlug: string;
  eventId: string;
  sessionId: string;
}) {
  return query<GameEntry>(
    `
      select
        id::text,
        tenant_slug,
        event_id::text,
        session_id::text,
        event_order_id::text,
        event_order_item_id::text,
        entry_number,
        player_name,
        player_email,
        status,
        eliminated_round_number,
        created_at::text,
        updated_at::text
      from event_addon_game_entries
      where tenant_slug = $1
        and event_id = $2
        and session_id = $3
      order by
        case status
          when 'active' then 1
          when 'winner' then 2
          when 'eliminated' then 3
          else 4
        end asc,
        player_name asc nulls last,
        entry_number asc,
        created_at asc
    `,
    [input.tenantSlug, input.eventId, input.sessionId],
  );
}

async function listGameRounds(input: {
  tenantSlug: string;
  eventId: string;
  sessionId: string;
}) {
  return query<GameRound>(
    `
      select
        id::text,
        tenant_slug,
        event_id::text,
        session_id::text,
        round_number,
        prompt,
        reveal_title,
        reveal_description,
        reveal_value_cents,
        correct_answer,
        status,
        revealed_at::text,
        created_at::text,
        updated_at::text
      from event_addon_game_rounds
      where tenant_slug = $1
        and event_id = $2
        and session_id = $3
      order by round_number asc
    `,
    [input.tenantSlug, input.eventId, input.sessionId],
  );
}

async function listGameAnswers(input: {
  tenantSlug: string;
  eventId: string;
  sessionId: string;
}) {
  return query<GameAnswer>(
    `
      select
        id::text,
        tenant_slug,
        event_id::text,
        session_id::text,
        round_id::text,
        entry_id::text,
        event_order_item_id::text,
        answer,
        is_correct,
        submitted_by,
        submitted_at::text,
        created_at::text
      from event_addon_game_answers
      where tenant_slug = $1
        and event_id = $2
        and session_id = $3
      order by submitted_at asc
    `,
    [input.tenantSlug, input.eventId, input.sessionId],
  );
}

async function listPaidHigherOrLowerOrderItems(input: {
  tenantSlug: string;
  eventId: string;
}) {
  return query<PaidHigherOrLowerOrderItem>(
    `
      select
        eo.id::text as event_order_id,
        eoi.id::text as event_order_item_id,
        eo.customer_name,
        eo.customer_email,
        eoi.guest_name,
        eoi.quantity
      from event_orders eo
      inner join event_order_items eoi
        on eoi.order_id = eo.id
      where eo.tenant_slug = $1
        and eo.event_id = $2
        and eo.status = 'paid'
        and eoi.metadata ->> 'addOnType' = 'higher_or_lower'
      order by eo.created_at asc, eoi.created_at asc
    `,
    [input.tenantSlug, input.eventId],
  );
}

async function createSessionAction(formData: FormData) {
  "use server";

  const eventId = cleanText(formData.get("event_id"));
  const title = cleanText(formData.get("title")) || "Higher or Lower";
  const notes = cleanText(formData.get("notes")) || null;

  if (!eventId) {
    redirect("/admin/events");
  }

  const { event, tenantSlug } = await requireEventAccess(eventId);

  const existing = await getHigherOrLowerSession({
    tenantSlug,
    eventId: event.id,
  });

  if (existing) {
    redirect(`/admin/events/${event.id}/higher-or-lower?success=session-ready`);
  }

  await query(
    `
      insert into event_addon_game_sessions (
        tenant_slug,
        event_id,
        add_on_type,
        title,
        status,
        notes
      )
      values ($1, $2, 'higher_or_lower', $3, 'draft', $4)
    `,
    [tenantSlug, event.id, title, notes],
  );

  redirect(`/admin/events/${event.id}/higher-or-lower?success=session-created`);
}

async function updateSessionAction(formData: FormData) {
  "use server";

  const eventId = cleanText(formData.get("event_id"));
  const sessionId = cleanText(formData.get("session_id"));
  const title = cleanText(formData.get("title")) || "Higher or Lower";
  const status = cleanGameStatus(formData.get("status"));
  const notes = cleanText(formData.get("notes")) || null;

  if (!eventId || !sessionId) {
    redirect("/admin/events");
  }

  const { event, tenantSlug } = await requireEventAccess(eventId);

  await query(
    `
      update event_addon_game_sessions
      set
        title = $4,
        status = $5,
        notes = $6,
        updated_at = now()
      where tenant_slug = $1
        and event_id = $2
        and id = $3
        and add_on_type = 'higher_or_lower'
    `,
    [tenantSlug, event.id, sessionId, title, status, notes],
  );

  redirect(`/admin/events/${event.id}/higher-or-lower?success=session-updated`);
}

async function generateEntriesAction(formData: FormData) {
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
    redirect(`/admin/events/${event.id}/higher-or-lower?error=session-missing`);
  }

  const paidItems = await listPaidHigherOrLowerOrderItems({
    tenantSlug,
    eventId: event.id,
  });

  for (const item of paidItems) {
    const quantity = Math.max(1, positiveInteger(item.quantity, 1));

    for (let entryNumber = 1; entryNumber <= quantity; entryNumber += 1) {
      const existing = await query<{ id: string }>(
        `
          select id::text
          from event_addon_game_entries
          where tenant_slug = $1
            and event_id = $2
            and session_id = $3
            and event_order_item_id = $4
            and entry_number = $5
          limit 1
        `,
        [
          tenantSlug,
          event.id,
          session.id,
          item.event_order_item_id,
          entryNumber,
        ],
      );

      if (existing[0]) {
        continue;
      }

      await query(
        `
          insert into event_addon_game_entries (
            tenant_slug,
            event_id,
            session_id,
            event_order_id,
            event_order_item_id,
            entry_number,
            player_name,
            player_email,
            status
          )
          values ($1,$2,$3,$4,$5,$6,$7,$8,'active')
        `,
        [
          tenantSlug,
          event.id,
          session.id,
          item.event_order_id,
          item.event_order_item_id,
          entryNumber,
          cleanText(item.guest_name) || cleanText(item.customer_name) || null,
          cleanText(item.customer_email) || null,
        ],
      );
    }
  }

  redirect(`/admin/events/${event.id}/higher-or-lower?success=entries-generated`);
}

async function createRoundAction(formData: FormData) {
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
    redirect(`/admin/events/${event.id}/higher-or-lower?error=session-missing`);
  }

  const nextRoundRows = await query<{ next_round: number }>(
    `
      select coalesce(max(round_number), 0) + 1 as next_round
      from event_addon_game_rounds
      where tenant_slug = $1
        and event_id = $2
        and session_id = $3
    `,
    [tenantSlug, event.id, session.id],
  );

  const nextRound = Number(nextRoundRows[0]?.next_round || 1);
  const prompt =
    cleanText(formData.get("prompt")) ||
    `Round ${nextRound}: higher or lower?`;

  const revealTitle = cleanText(formData.get("reveal_title")) || null;
  const revealDescription = cleanText(formData.get("reveal_description")) || null;
  const revealValueCents = moneyInputToCents(formData.get("reveal_value"));
  const status = cleanRoundStatus(formData.get("status")) || "draft";

  await query(
    `
      insert into event_addon_game_rounds (
        tenant_slug,
        event_id,
        session_id,
        round_number,
        prompt,
        reveal_title,
        reveal_description,
        reveal_value_cents,
        status
      )
      values ($1,$2,$3,$4,$5,$6,$7,$8,$9)
    `,
    [
      tenantSlug,
      event.id,
      session.id,
      nextRound,
      prompt,
      revealTitle,
      revealDescription,
      revealValueCents,
      status,
    ],
  );

  await query(
    `
      update event_addon_game_sessions
      set
        current_round_number = greatest(current_round_number, $4),
        updated_at = now()
      where tenant_slug = $1
        and event_id = $2
        and id = $3
    `,
    [tenantSlug, event.id, session.id, nextRound],
  );

  redirect(`/admin/events/${event.id}/higher-or-lower?success=round-created`);
}

async function updateRoundAction(formData: FormData) {
  "use server";

  const eventId = cleanText(formData.get("event_id"));
  const sessionId = cleanText(formData.get("session_id"));
  const roundId = cleanText(formData.get("round_id"));
  const status = cleanRoundStatus(formData.get("status"));
  const correctAnswer = cleanHigherLowerAnswer(formData.get("correct_answer"));

  if (!eventId || !sessionId || !roundId) {
    redirect("/admin/events");
  }

  const { event, tenantSlug } = await requireEventAccess(eventId);

  const prompt = cleanText(formData.get("prompt")) || null;
  const revealTitle = cleanText(formData.get("reveal_title")) || null;
  const revealDescription = cleanText(formData.get("reveal_description")) || null;
  const revealValueCents = moneyInputToCents(formData.get("reveal_value"));

  await query(
    `
      update event_addon_game_rounds
      set
        prompt = $5,
        reveal_title = $6,
        reveal_description = $7,
        reveal_value_cents = $8,
        correct_answer = $9,
        status = $10,
        revealed_at = case
          when $10 = 'revealed' and revealed_at is null then now()
          else revealed_at
        end,
        updated_at = now()
      where tenant_slug = $1
        and event_id = $2
        and session_id = $3
        and id = $4
    `,
    [
      tenantSlug,
      event.id,
      sessionId,
      roundId,
      prompt,
      revealTitle,
      revealDescription,
      revealValueCents,
      correctAnswer || null,
      status,
    ],
  );

  if (status === "revealed" && correctAnswer) {
    await query(
      `
        update event_addon_game_answers
        set is_correct = (answer = $5)
        where tenant_slug = $1
          and event_id = $2
          and session_id = $3
          and round_id = $4
      `,
      [tenantSlug, event.id, sessionId, roundId, correctAnswer],
    );

    const roundRows = await query<{ round_number: number }>(
      `
        select round_number
        from event_addon_game_rounds
        where tenant_slug = $1
          and event_id = $2
          and session_id = $3
          and id = $4
        limit 1
      `,
      [tenantSlug, event.id, sessionId, roundId],
    );

    const roundNumber = Number(roundRows[0]?.round_number || 0);

    if (roundNumber > 0) {
      await query(
        `
          update event_addon_game_entries e
          set
            status = 'eliminated',
            eliminated_round_number = $5,
            updated_at = now()
          where e.tenant_slug = $1
            and e.event_id = $2
            and e.session_id = $3
            and e.status = 'active'
            and exists (
              select 1
              from event_addon_game_answers a
              where a.entry_id = e.id
                and a.round_id = $4
                and a.is_correct = false
            )
        `,
        [tenantSlug, event.id, sessionId, roundId, roundNumber],
      );
    }
  }

  redirect(`/admin/events/${event.id}/higher-or-lower?success=round-updated`);
}

async function saveAnswerAction(formData: FormData) {
  "use server";

  const eventId = cleanText(formData.get("event_id"));
  const sessionId = cleanText(formData.get("session_id"));
  const roundId = cleanText(formData.get("round_id"));
  const entryId = cleanText(formData.get("entry_id"));
  const answer = cleanHigherLowerAnswer(formData.get("answer"));

  if (!eventId || !sessionId || !roundId || !entryId || !answer) {
    redirect("/admin/events");
  }

  const { event, tenantSlug } = await requireEventAccess(eventId);

  const entryRows = await query<{
    event_order_item_id: string | null;
  }>(
    `
      select event_order_item_id::text
      from event_addon_game_entries
      where tenant_slug = $1
        and event_id = $2
        and session_id = $3
        and id = $4
      limit 1
    `,
    [tenantSlug, event.id, sessionId, entryId],
  );

  const entry = entryRows[0] || null;

  if (!entry) {
    redirect(`/admin/events/${event.id}/higher-or-lower?error=entry-missing`);
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
      values ($1,$2,$3,$4,$5,$6,$7,'admin')
      on conflict (entry_id, round_id)
      do update set
        answer = excluded.answer,
        submitted_by = 'admin',
        submitted_at = now(),
        is_correct = null
    `,
    [
      tenantSlug,
      event.id,
      sessionId,
      roundId,
      entryId,
      entry.event_order_item_id,
      answer,
    ],
  );

  redirect(`/admin/events/${event.id}/higher-or-lower?success=answer-saved`);
}

async function markWinnerAction(formData: FormData) {
  "use server";

  const eventId = cleanText(formData.get("event_id"));
  const sessionId = cleanText(formData.get("session_id"));
  const entryId = cleanText(formData.get("entry_id"));

  if (!eventId || !sessionId || !entryId) {
    redirect("/admin/events");
  }

  const { event, tenantSlug } = await requireEventAccess(eventId);

  await query(
    `
      update event_addon_game_entries
      set
        status = case when id = $4 then 'winner' else status end,
        updated_at = now()
      where tenant_slug = $1
        and event_id = $2
        and session_id = $3
    `,
    [tenantSlug, event.id, sessionId, entryId],
  );

  await query(
    `
      update event_addon_game_sessions
      set
        status = 'closed',
        updated_at = now()
      where tenant_slug = $1
        and event_id = $2
        and id = $3
    `,
    [tenantSlug, event.id, sessionId],
  );

  redirect(`/admin/events/${event.id}/higher-or-lower?success=winner-marked`);
}

function getSuccessMessage(value: string | undefined) {
  if (value === "session-created") return "Higher or Lower game created.";
  if (value === "session-ready") return "Higher or Lower game already exists.";
  if (value === "session-updated") return "Game settings updated.";
  if (value === "entries-generated") {
    return "Entries generated from paid Higher or Lower orders.";
  }
  if (value === "round-created") return "Round created.";
  if (value === "round-updated") return "Round updated.";
  if (value === "answer-saved") return "Answer saved.";
  if (value === "winner-marked") return "Winner marked and game closed.";

  return "";
}

function getErrorMessage(value: string | undefined) {
  if (value === "session-missing") return "Higher or Lower game session was not found.";
  if (value === "entry-missing") return "Player entry was not found.";

  return cleanText(value);
}

function answersByEntryAndRound(answers: GameAnswer[]) {
  const map = new Map<string, GameAnswer>();

  for (const answer of answers) {
    map.set(`${answer.entry_id}:${answer.round_id}`, answer);
  }

  return map;
}

function activeEntries(entries: GameEntry[]) {
  return entries.filter((entry) => entry.status === "active");
}

function winnerEntries(entries: GameEntry[]) {
  return entries.filter((entry) => entry.status === "winner");
}

function eliminatedEntries(entries: GameEntry[]) {
  return entries.filter((entry) => entry.status === "eliminated");
}

export default async function AdminHigherOrLowerGamePage({
  params,
  searchParams,
}: PageProps) {
  const { event, tenantSlug } = await requireEventAccess(params.id);

  const session = await getHigherOrLowerSession({
    tenantSlug,
    eventId: event.id,
  });

  const paidHigherOrLowerItems = await listPaidHigherOrLowerOrderItems({
    tenantSlug,
    eventId: event.id,
  });

  const entries = session
    ? await listGameEntries({
        tenantSlug,
        eventId: event.id,
        sessionId: session.id,
      })
    : [];

  const rounds = session
    ? await listGameRounds({
        tenantSlug,
        eventId: event.id,
        sessionId: session.id,
      })
    : [];

  const answers = session
    ? await listGameAnswers({
        tenantSlug,
        eventId: event.id,
        sessionId: session.id,
      })
    : [];

  const answerMap = answersByEntryAndRound(answers);

  const active = activeEntries(entries);
  const winners = winnerEntries(entries);
  const eliminated = eliminatedEntries(entries);

  const paidEntryCount = paidHigherOrLowerItems.reduce(
    (sum, item) => sum + Math.max(1, positiveInteger(item.quantity, 1)),
    0,
  );

  const successMessage = getSuccessMessage(searchParams?.success);
  const errorMessage = getErrorMessage(searchParams?.error);

  return (
    <main className="higher-lower-page" style={styles.page}>
      <style>{responsiveStyles}</style>

      <section className="higher-lower-hero" style={styles.hero}>
        <div>
          <div style={styles.eyebrow}>Live game mode</div>

          <h1 className="higher-lower-title" style={styles.title}>
            Higher or Lower
          </h1>

          <p style={styles.subtitle}>
            Run a live Higher or Lower fundraiser from paid event add-on entries,
            record round answers, reveal results and track active players.
          </p>

          <p style={styles.tenant}>
            Event: <strong>{event.title}</strong> · Tenant:{" "}
            <strong>{tenantSlug}</strong>
          </p>
        </div>

        <div className="higher-lower-hero-actions" style={styles.heroActions}>
          <Link href={`/admin/events/${event.id}`} style={styles.secondaryButton}>
            ← Back to event
          </Link>

          <Link href={`/admin/events/${event.id}/orders`} style={styles.secondaryButton}>
            Orders
          </Link>

          <Link href={`/e/${event.slug}`} style={styles.secondaryButton}>
            Public event
          </Link>
        </div>
      </section>

      {successMessage ? (
        <section style={styles.successBanner}>{successMessage}</section>
      ) : null}

      {errorMessage ? (
        <section style={styles.errorBanner}>{errorMessage}</section>
      ) : null}

      <section className="higher-lower-summary-grid" style={styles.summaryGrid}>
        <SummaryCard label="Paid Higher or Lower entries" value={paidEntryCount} />
        <SummaryCard label="Generated game entries" value={entries.length} />
        <SummaryCard label="Active players" value={active.length} />
        <SummaryCard label="Eliminated" value={eliminated.length} />
        <SummaryCard label="Winners" value={winners.length} />
        <SummaryCard label="Rounds" value={rounds.length} />
      </section>

      {!session ? (
        <section style={styles.sectionCard}>
          <div style={styles.sectionHeader}>
            <div>
              <div style={styles.sectionEyebrow}>Setup</div>
              <h2 style={styles.sectionTitle}>Create live game</h2>
            </div>
          </div>

          <p style={styles.sectionText}>
            This creates the admin game space for Higher or Lower. It does not
            change checkout, public event pages, Stripe, receipts or existing
            orders.
          </p>

          <form action={createSessionAction} style={styles.formGrid}>
            <input type="hidden" name="event_id" value={event.id} />

            <label style={styles.field}>
              <span style={styles.label}>Game title</span>
              <input
                name="title"
                defaultValue="Higher or Lower"
                style={styles.input}
              />
            </label>

            <label style={{ ...styles.field, gridColumn: "1 / -1" }}>
              <span style={styles.label}>Internal notes</span>
              <textarea
                name="notes"
                rows={3}
                placeholder="Optional organiser notes for this live game."
                style={styles.textarea}
              />
            </label>

            <div style={styles.submitRow}>
              <button type="submit" style={styles.primaryButton}>
                Create Higher or Lower game
              </button>
            </div>
          </form>
        </section>
      ) : (
        <>
          <section style={styles.sectionCard}>
            <div style={styles.sectionHeader}>
              <div>
                <div style={styles.sectionEyebrow}>Game control</div>
                <h2 style={styles.sectionTitle}>{session.title}</h2>
                <p style={styles.sectionText}>
                  Created {formatDate(session.created_at)} · Current round{" "}
                  {session.current_round_number || 0}
                </p>
              </div>

              <span
                style={{
                  ...styles.statusPill,
                  ...statusStyle(session.status),
                }}
              >
                {statusLabel(session.status)}
              </span>
            </div>

            <form action={updateSessionAction} style={styles.formGrid}>
              <input type="hidden" name="event_id" value={event.id} />
              <input type="hidden" name="session_id" value={session.id} />

              <label style={styles.field}>
                <span style={styles.label}>Game title</span>
                <input
                  name="title"
                  defaultValue={session.title}
                  style={styles.input}
                />
              </label>

              <label style={styles.field}>
                <span style={styles.label}>Status</span>
                <select
                  name="status"
                  defaultValue={session.status}
                  style={styles.select}
                >
                  <option value="draft">Draft</option>
                  <option value="live">Live</option>
                  <option value="paused">Paused</option>
                  <option value="closed">Closed</option>
                </select>
              </label>

              <label style={{ ...styles.field, gridColumn: "1 / -1" }}>
                <span style={styles.label}>Internal notes</span>
                <textarea
                  name="notes"
                  rows={3}
                  defaultValue={session.notes || ""}
                  style={styles.textarea}
                />
              </label>

              <div style={styles.submitRow}>
                <button type="submit" style={styles.primaryButton}>
                  Save game settings
                </button>
              </div>
            </form>
          </section>

          <section style={styles.sectionCard}>
            <div style={styles.sectionHeader}>
              <div>
                <div style={styles.sectionEyebrow}>Entries</div>
                <h2 style={styles.sectionTitle}>Generate player entries</h2>
              </div>
            </div>

            <p style={styles.sectionText}>
              This reads paid Higher or Lower add-on order items and creates one
              live-game entry for each paid add-on entry. Existing generated
              entries are skipped.
            </p>

            <div className="higher-lower-mini-grid" style={styles.miniGrid}>
              <InfoCard label="Paid order items" value={paidHigherOrLowerItems.length} />
              <InfoCard label="Paid entries available" value={paidEntryCount} />
              <InfoCard label="Game entries created" value={entries.length} />
            </div>

            <form action={generateEntriesAction} style={styles.submitRow}>
              <input type="hidden" name="event_id" value={event.id} />
              <input type="hidden" name="session_id" value={session.id} />

              <button type="submit" style={styles.primaryButton}>
                Generate entries from paid orders
              </button>
            </form>
          </section>

          <section style={styles.sectionCard}>
            <div style={styles.sectionHeader}>
              <div>
                <div style={styles.sectionEyebrow}>Rounds</div>
                <h2 style={styles.sectionTitle}>Create next round</h2>
              </div>
            </div>

            <form action={createRoundAction} style={styles.formGrid}>
              <input type="hidden" name="event_id" value={event.id} />
              <input type="hidden" name="session_id" value={session.id} />

              <label style={{ ...styles.field, gridColumn: "1 / -1" }}>
                <span style={styles.label}>Round prompt</span>
                <input
                  name="prompt"
                  placeholder={`Round ${rounds.length + 1}: higher or lower?`}
                  style={styles.input}
                />
              </label>

              <label style={styles.field}>
                <span style={styles.label}>Reveal title</span>
                <input
                  name="reveal_title"
                  placeholder="Prize, card, amount or reveal item"
                  style={styles.input}
                />
              </label>

              <label style={styles.field}>
                <span style={styles.label}>Reveal value</span>
                <input
                  name="reveal_value"
                  placeholder="25.00"
                  inputMode="decimal"
                  style={styles.input}
                />
              </label>

              <label style={styles.field}>
                <span style={styles.label}>Status</span>
                <select name="status" defaultValue="open" style={styles.select}>
                  <option value="draft">Draft</option>
                  <option value="open">Open</option>
                  <option value="locked">Locked</option>
                  <option value="revealed">Revealed</option>
                  <option value="closed">Closed</option>
                </select>
              </label>

              <label style={{ ...styles.field, gridColumn: "1 / -1" }}>
                <span style={styles.label}>Reveal description</span>
                <textarea
                  name="reveal_description"
                  rows={3}
                  placeholder="Optional context for the round reveal."
                  style={styles.textarea}
                />
              </label>

              <div style={styles.submitRow}>
                <button type="submit" style={styles.primaryButton}>
                  Create round
                </button>
              </div>
            </form>
          </section>

          <section style={styles.sectionCard}>
            <div style={styles.sectionHeader}>
              <div>
                <div style={styles.sectionEyebrow}>Round control</div>
                <h2 style={styles.sectionTitle}>Rounds and answers</h2>
              </div>
            </div>

            {rounds.length === 0 ? (
              <div style={styles.emptyState}>No rounds created yet.</div>
            ) : (
              <div style={styles.roundList}>
                {rounds.map((round) => (
                  <details key={round.id} style={styles.roundCard}>
                    <summary style={styles.roundSummary}>
                      <div>
                        <strong>
                          Round {round.round_number}:{" "}
                          {round.prompt || "Higher or lower?"}
                        </strong>
                        <div style={styles.metaText}>
                          {round.reveal_title || "No reveal title"} ·{" "}
                          {round.reveal_value_cents !== null
                            ? moneyFromCents(round.reveal_value_cents)
                            : "No value"}{" "}
                          · {statusLabel(round.status)}
                        </div>
                      </div>

                      <span
                        style={{
                          ...styles.statusPill,
                          ...statusStyle(round.status),
                        }}
                      >
                        {statusLabel(round.status)}
                      </span>
                    </summary>

                    <form action={updateRoundAction} style={styles.formGrid}>
                      <input type="hidden" name="event_id" value={event.id} />
                      <input type="hidden" name="session_id" value={session.id} />
                      <input type="hidden" name="round_id" value={round.id} />

                      <label style={{ ...styles.field, gridColumn: "1 / -1" }}>
                        <span style={styles.label}>Prompt</span>
                        <input
                          name="prompt"
                          defaultValue={round.prompt || ""}
                          style={styles.input}
                        />
                      </label>

                      <label style={styles.field}>
                        <span style={styles.label}>Reveal title</span>
                        <input
                          name="reveal_title"
                          defaultValue={round.reveal_title || ""}
                          style={styles.input}
                        />
                      </label>

                      <label style={styles.field}>
                        <span style={styles.label}>Reveal value</span>
                        <input
                          name="reveal_value"
                          defaultValue={
                            round.reveal_value_cents !== null
                              ? (Number(round.reveal_value_cents) / 100).toFixed(2)
                              : ""
                          }
                          inputMode="decimal"
                          style={styles.input}
                        />
                      </label>

                      <label style={styles.field}>
                        <span style={styles.label}>Correct answer</span>
                        <select
                          name="correct_answer"
                          defaultValue={round.correct_answer || ""}
                          style={styles.select}
                        >
                          <option value="">Not revealed</option>
                          <option value="higher">Higher</option>
                          <option value="lower">Lower</option>
                        </select>
                      </label>

                      <label style={styles.field}>
                        <span style={styles.label}>Round status</span>
                        <select
                          name="status"
                          defaultValue={round.status}
                          style={styles.select}
                        >
                          <option value="draft">Draft</option>
                          <option value="open">Open</option>
                          <option value="locked">Locked</option>
                          <option value="revealed">Revealed</option>
                          <option value="closed">Closed</option>
                        </select>
                      </label>

                      <label style={{ ...styles.field, gridColumn: "1 / -1" }}>
                        <span style={styles.label}>Reveal description</span>
                        <textarea
                          name="reveal_description"
                          rows={3}
                          defaultValue={round.reveal_description || ""}
                          style={styles.textarea}
                        />
                      </label>

                      <div style={styles.submitRow}>
                        <button type="submit" style={styles.primaryButton}>
                          Save / reveal round
                        </button>
                      </div>
                    </form>

                    <div style={styles.answerGrid}>
                      {entries.length === 0 ? (
                        <div style={styles.emptyState}>
                          Generate entries before recording round answers.
                        </div>
                      ) : (
                        entries.map((entry) => {
                          const existingAnswer = answerMap.get(
                            `${entry.id}:${round.id}`,
                          );

                          return (
                            <form
                              key={`${round.id}-${entry.id}`}
                              action={saveAnswerAction}
                              style={styles.answerRow}
                            >
                              <input type="hidden" name="event_id" value={event.id} />
                              <input
                                type="hidden"
                                name="session_id"
                                value={session.id}
                              />
                              <input type="hidden" name="round_id" value={round.id} />
                              <input type="hidden" name="entry_id" value={entry.id} />

                              <div>
                                <div style={styles.playerName}>
                                  {entry.player_name || "Unnamed player"} #
                                  {entry.entry_number}
                                </div>
                                <div style={styles.metaText}>
                                  {entry.player_email || "No email"} ·{" "}
                                  {statusLabel(entry.status)}
                                  {existingAnswer?.is_correct === true
                                    ? " · Correct"
                                    : existingAnswer?.is_correct === false
                                      ? " · Incorrect"
                                      : ""}
                                </div>
                              </div>

                              <select
                                name="answer"
                                defaultValue={existingAnswer?.answer || ""}
                                style={styles.answerSelect}
                              >
                                <option value="">Choose</option>
                                <option value="higher">Higher</option>
                                <option value="lower">Lower</option>
                              </select>

                              <button type="submit" style={styles.smallButton}>
                                Save
                              </button>
                            </form>
                          );
                        })
                      )}
                    </div>
                  </details>
                ))}
              </div>
            )}
          </section>

          <section style={styles.sectionCard}>
            <div style={styles.sectionHeader}>
              <div>
                <div style={styles.sectionEyebrow}>Players</div>
                <h2 style={styles.sectionTitle}>Player status</h2>
              </div>
            </div>

            {entries.length === 0 ? (
              <div style={styles.emptyState}>No game entries generated yet.</div>
            ) : (
              <div style={styles.playerList}>
                {entries.map((entry) => (
                  <div key={entry.id} style={styles.playerCard}>
                    <div>
                      <div style={styles.playerName}>
                        {entry.player_name || "Unnamed player"} #{entry.entry_number}
                      </div>
                      <div style={styles.metaText}>
                        {entry.player_email || "No email"}
                        {entry.eliminated_round_number
                          ? ` · Eliminated round ${entry.eliminated_round_number}`
                          : ""}
                      </div>
                    </div>

                    <span
                      style={{
                        ...styles.statusPill,
                        ...statusStyle(entry.status),
                      }}
                    >
                      {statusLabel(entry.status)}
                    </span>

                    {entry.status === "active" && active.length <= 3 ? (
                      <form action={markWinnerAction}>
                        <input type="hidden" name="event_id" value={event.id} />
                        <input type="hidden" name="session_id" value={session.id} />
                        <input type="hidden" name="entry_id" value={entry.id} />
                        <button type="submit" style={styles.winnerButton}>
                          Mark winner
                        </button>
                      </form>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </main>
  );
}

function SummaryCard({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div style={styles.summaryCard}>
      <div style={styles.summaryLabel}>{label}</div>
      <div style={styles.summaryValue}>{value}</div>
    </div>
  );
}

function InfoCard({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div style={styles.infoCard}>
      <div style={styles.infoLabel}>{label}</div>
      <div style={styles.infoValue}>{value}</div>
    </div>
  );
}

const responsiveStyles = `
.higher-lower-page,
.higher-lower-page * {
  box-sizing: border-box;
}

.higher-lower-page {
  overflow-x: hidden;
}

.higher-lower-page section,
.higher-lower-page article,
.higher-lower-page div,
.higher-lower-page form,
.higher-lower-page input,
.higher-lower-page textarea,
.higher-lower-page select,
.higher-lower-page button,
.higher-lower-page a {
  min-width: 0;
  max-width: 100%;
}

@media (max-width: 860px) {
  .higher-lower-hero {
    grid-template-columns: 1fr !important;
  }

  .higher-lower-hero-actions {
    justify-content: stretch !important;
  }

  .higher-lower-hero-actions a {
    width: 100% !important;
  }

  .higher-lower-summary-grid,
  .higher-lower-mini-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
  }
}

@media (max-width: 640px) {
  .higher-lower-page {
    padding: 18px 12px 44px !important;
  }

  .higher-lower-hero {
    padding: 20px !important;
    border-radius: 26px !important;
  }

  .higher-lower-title {
    font-size: clamp(38px, 12vw, 54px) !important;
    line-height: 0.98 !important;
  }

  .higher-lower-summary-grid,
  .higher-lower-mini-grid {
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
    alignItems: "center",
    justifyContent: "center",
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
    margin: 0,
    color: "#64748b",
    lineHeight: 1.55,
    fontWeight: 750,
  },

  formGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 14,
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
    minHeight: 46,
    borderRadius: 14,
    border: "1px solid #cbd5e1",
    padding: "10px 12px",
    fontSize: 15,
    boxSizing: "border-box",
  },

  select: {
    width: "100%",
    minHeight: 46,
    borderRadius: 14,
    border: "1px solid #cbd5e1",
    padding: "10px 12px",
    fontSize: 15,
    boxSizing: "border-box",
    background: "#ffffff",
  },

  textarea: {
    width: "100%",
    borderRadius: 14,
    border: "1px solid #cbd5e1",
    padding: "10px 12px",
    fontSize: 15,
    fontFamily: "inherit",
    boxSizing: "border-box",
    resize: "vertical",
  },

  submitRow: {
    display: "flex",
    justifyContent: "flex-end",
    gap: 10,
    flexWrap: "wrap",
    gridColumn: "1 / -1",
  },

  primaryButton: {
    minHeight: 46,
    padding: "12px 18px",
    borderRadius: 999,
    background: "#1683f8",
    color: "#ffffff",
    border: "none",
    fontWeight: 950,
    cursor: "pointer",
    boxShadow: "0 12px 22px rgba(22,131,248,0.2)",
  },

  smallButton: {
    minHeight: 40,
    padding: "9px 13px",
    borderRadius: 999,
    background: "#0f172a",
    color: "#ffffff",
    border: "none",
    fontWeight: 950,
    cursor: "pointer",
  },

  winnerButton: {
    minHeight: 40,
    padding: "9px 13px",
    borderRadius: 999,
    background: "#facc15",
    color: "#422006",
    border: "none",
    fontWeight: 950,
    cursor: "pointer",
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

  miniGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    gap: 12,
  },

  infoCard: {
    padding: 14,
    borderRadius: 18,
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
  },

  infoLabel: {
    color: "#64748b",
    fontSize: 12,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    marginBottom: 6,
  },

  infoValue: {
    color: "#0f172a",
    fontWeight: 950,
    fontSize: 18,
  },

  emptyState: {
    padding: 18,
    borderRadius: 18,
    background: "#f8fafc",
    border: "1px dashed #cbd5e1",
    color: "#64748b",
    fontWeight: 850,
    textAlign: "center",
  },

  roundList: {
    display: "grid",
    gap: 12,
  },

  roundCard: {
    borderRadius: 20,
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    padding: 14,
    overflow: "hidden",
  },

  roundSummary: {
    cursor: "pointer",
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "center",
    flexWrap: "wrap",
    marginBottom: 14,
  },

  metaText: {
    marginTop: 4,
    color: "#64748b",
    fontSize: 13,
    lineHeight: 1.4,
    fontWeight: 750,
    overflowWrap: "anywhere",
  },

  answerGrid: {
    display: "grid",
    gap: 8,
    marginTop: 14,
  },

  answerRow: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) 130px auto",
    gap: 8,
    alignItems: "center",
    padding: 10,
    borderRadius: 16,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
  },

  answerSelect: {
    width: "100%",
    minHeight: 40,
    borderRadius: 12,
    border: "1px solid #cbd5e1",
    padding: "8px 10px",
    background: "#ffffff",
  },

  playerList: {
    display: "grid",
    gap: 10,
  },

  playerCard: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) auto auto",
    gap: 10,
    alignItems: "center",
    padding: 12,
    borderRadius: 18,
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
  },

  playerName: {
    color: "#0f172a",
    fontSize: 15,
    fontWeight: 950,
    overflowWrap: "anywhere",
  },
};
