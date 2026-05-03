import { NextRequest, NextResponse } from "next/server";
import { getTenantSlugFromRequest } from "@/lib/tenant";
import {
  cleanupExpiredSquaresReservations,
  getActiveSquaresReservations,
  getSquaresGameByTenantAndSlug,
  listSquaresSales,
  listSquaresWinners,
} from "../../../../../../api/_lib/squares-repo";

type RouteContext = {
  params: {
    slug: string;
  };
};

export async function GET(request: NextRequest, context: RouteContext) {
  const tenantSlug = getTenantSlugFromRequest(request);
  const slug = context.params.slug;

  if (!tenantSlug) {
    return NextResponse.json(
      { ok: false, error: "Tenant not found" },
      { status: 404 },
    );
  }

  try {
    const game = await getSquaresGameByTenantAndSlug(tenantSlug, slug);

    if (!game) {
      return NextResponse.json(
        { ok: false, error: "Squares game not found" },
        { status: 404 },
      );
    }

    await cleanupExpiredSquaresReservations(game.id);

    const [sales, reservations, winners] = await Promise.all([
      listSquaresSales(game.id),
      getActiveSquaresReservations(game.id),
      listSquaresWinners(game.id),
    ]);

    const soldSquares = sales.flatMap((sale) =>
      Array.isArray(sale.squares) ? sale.squares : [],
    );

    const reservedSquares = reservations.flatMap((reservation) =>
      Array.isArray(reservation.squares) ? reservation.squares : [],
    );

    const config = game.config_json ?? {};

    return NextResponse.json({
      ok: true,
      game: {
        id: game.id,
        tenantSlug: game.tenant_slug,
        slug: game.slug,
        title: game.title,
        description: game.description ?? "",
        imageUrl: game.image_url ?? "",
        drawAt: game.draw_at ?? null,
        status: game.status,
        currency: game.currency ?? "GBP",
        pricePerSquareCents: game.price_per_square_cents,
        totalSquares: game.total_squares,
        prizes: config.prizes ?? [],
        soldSquares,
        reservedSquares,
        winners,
        question: config.question ?? null,
        freeEntry: config.free_entry ?? null,
      },
    });
  } catch (error) {
    console.error("GET public squares failed:", error);

    return NextResponse.json(
      { ok: false, error: "Internal error" },
      { status: 500 },
    );
  }
}
import { NextRequest, NextResponse } from "next/server";
import { getTenantSlugFromRequest } from "@/lib/tenant";
import {
  cleanupExpiredSquaresReservations,
  createSquaresReservation,
  getActiveSquaresReservations,
  getSquaresGameByTenantAndSlug,
  listSquaresSales,
  normaliseSquares,
} from "../../../../../../../api/_lib/squares-repo";

type RouteContext = {
  params: {
    slug: string;
  };
};

function getRandomAvailableSquares(
  totalSquares: number,
  unavailable: Set<number>,
  count: number,
) {
  const available: number[] = [];

  for (let i = 1; i <= totalSquares; i++) {
    if (!unavailable.has(i)) available.push(i);
  }

  for (let i = available.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [available[i], available[j]] = [available[j], available[i]];
  }

  return available.slice(0, count).sort((a, b) => a - b);
}

function cleanAnswer(value: unknown) {
  return String(value ?? "").trim().toLowerCase();
}

export async function POST(request: NextRequest, context: RouteContext) {
  const tenantSlug = getTenantSlugFromRequest(request);
  const slug = context.params.slug;

  if (!tenantSlug) {
    return NextResponse.json(
      { ok: false, error: "Tenant not found" },
      { status: 404 },
    );
  }

  try {
    const body = await request.json();

    const requestedSquares = Array.isArray(body?.squares) ? body.squares : [];
    const randomCount = Math.max(0, Math.floor(Number(body?.randomCount || 0)));
    const previewOnly = Boolean(body?.previewOnly);

    const customerName = String(body?.customerName ?? "").trim();
    const customerEmail = String(body?.customerEmail ?? "").trim();
    const entryAnswer = cleanAnswer(body?.entryAnswer);

    const game = await getSquaresGameByTenantAndSlug(tenantSlug, slug);

    if (!game) {
      return NextResponse.json(
        { ok: false, error: "Squares game not found" },
        { status: 404 },
      );
    }

    if (game.status !== "published") {
      return NextResponse.json(
        { ok: false, error: "This squares game is not open" },
        { status: 400 },
      );
    }

    const question = game.config_json?.question ?? null;
    const questionText = String(question?.text ?? "").trim();
    const correctAnswer = cleanAnswer(question?.answer);

    if (!previewOnly && questionText && correctAnswer) {
      if (!entryAnswer) {
        return NextResponse.json(
          { ok: false, error: "Please answer the entry question." },
          { status: 400 },
        );
      }

      if (entryAnswer !== correctAnswer) {
        return NextResponse.json(
          { ok: false, error: "The entry question answer is incorrect." },
          { status: 400 },
        );
      }
    }

    await cleanupExpiredSquaresReservations(game.id);

    const [sales, reservations] = await Promise.all([
      listSquaresSales(game.id),
      getActiveSquaresReservations(game.id),
    ]);

    const unavailable = new Set<number>();

    for (const sale of sales) {
      for (const square of sale.squares ?? []) unavailable.add(Number(square));
    }

    for (const reservation of reservations) {
      for (const square of reservation.squares ?? []) {
        unavailable.add(Number(square));
      }
    }

    const selectedSquares =
      randomCount > 0
        ? getRandomAvailableSquares(game.total_squares, unavailable, randomCount)
        : normaliseSquares(requestedSquares, game.total_squares);

    if (selectedSquares.length === 0) {
      return NextResponse.json(
        { ok: false, error: "Choose at least one square" },
        { status: 400 },
      );
    }

    if (randomCount > 0 && selectedSquares.length < randomCount) {
      return NextResponse.json(
        { ok: false, error: "Not enough squares are available" },
        { status: 400 },
      );
    }

    const blocked = selectedSquares.filter((square) => unavailable.has(square));

    if (blocked.length > 0) {
      return NextResponse.json(
        { ok: false, error: `Square ${blocked[0]} is no longer available` },
        { status: 409 },
      );
    }

    if (previewOnly) {
      return NextResponse.json({
        ok: true,
        previewOnly: true,
        squares: selectedSquares,
      });
    }

    const reservation = await createSquaresReservation({
      tenant_slug: tenantSlug,
      game_id: game.id,
      squares: selectedSquares,
      customer_name: customerName || undefined,
      customer_email: customerEmail || undefined,
      minutes: 15,
    });

    if (!reservation) {
      return NextResponse.json(
        { ok: false, error: "Reservation failed" },
        { status: 500 },
      );
    }

    return NextResponse.json({
      ok: true,
      reservationToken: reservation.reservation_token,
      squares: selectedSquares,
    });
  } catch (error) {
    console.error("POST public squares reserve failed:", error);

    return NextResponse.json(
      { ok: false, error: "Internal error" },
      { status: 500 },
    );
  }
}
import { NextRequest, NextResponse } from "next/server";
import { getTenantSlugFromRequest } from "@/lib/tenant";
import {
  getSquaresGameById,
  normalisePrizes,
  slugify,
} from "../../../../../../api/_lib/squares-repo";
import { query } from "@/lib/db";

type RouteContext = {
  params: {
    id: string;
  };
};

function parseNumber(
  value: FormDataEntryValue | string | null | undefined,
  fallback = 0,
) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function parsePrizeRows(formData: FormData) {
  const titles = formData.getAll("prize_title");
  const descriptions = formData.getAll("prize_description");

  return normalisePrizes(
    titles.map((title, index) => ({
      title: String(title ?? "").trim(),
      description: String(descriptions[index] ?? "").trim(),
    })),
  );
}

function parseDrawAt(value: FormDataEntryValue | null) {
  const raw = String(value ?? "").trim();
  if (!raw) return null;

  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return null;

  return date.toISOString();
}

function parseFreeEntryClosesAt(value: FormDataEntryValue | null) {
  const raw = String(value ?? "").trim();
  if (!raw) return "";

  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return "";

  return date.toISOString();
}

export async function GET(request: NextRequest, context: RouteContext) {
  const tenantSlug = getTenantSlugFromRequest(request);
  const id = context.params.id;

  if (!tenantSlug) {
    return NextResponse.json(
      { ok: false, error: "Tenant not found" },
      { status: 404 },
    );
  }

  try {
    const game = await getSquaresGameById(id);

    if (!game) {
      return NextResponse.json(
        { ok: false, error: "Squares game not found" },
        { status: 404 },
      );
    }

    if (game.tenant_slug !== tenantSlug) {
      return NextResponse.json(
        { ok: false, error: "Forbidden" },
        { status: 403 },
      );
    }

    return NextResponse.json({ ok: true, item: game });
  } catch (error) {
    console.error("GET admin square failed:", error);
    return NextResponse.json(
      { ok: false, error: "Internal error" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  const tenantSlug = getTenantSlugFromRequest(request);
  const id = context.params.id;

  if (!tenantSlug) {
    return NextResponse.json(
      { ok: false, error: "Tenant not found" },
      { status: 404 },
    );
  }

  try {
    const existing = await getSquaresGameById(id);

    if (!existing) {
      return NextResponse.json(
        { ok: false, error: "Squares game not found" },
        { status: 404 },
      );
    }

    if (existing.tenant_slug !== tenantSlug) {
      return NextResponse.json(
        { ok: false, error: "Forbidden" },
        { status: 403 },
      );
    }

    const formData = await request.formData();

    const title = String(formData.get("title") ?? existing.title).trim();
    const rawSlug = String(formData.get("slug") ?? existing.slug).trim();
    const cleanSlug = slugify(rawSlug || existing.slug);

    const description = String(formData.get("description") ?? "").trim();
    const imageUrl = String(
      formData.get("image_url") ?? existing.image_url ?? "",
    ).trim();

    const currency = String(
      formData.get("currency") ?? existing.currency ?? "GBP",
    );

    const status = String(formData.get("status") ?? existing.status);

    const totalSquares = Math.min(
      500,
      Math.max(
        1,
        parseNumber(formData.get("total_squares"), existing.total_squares),
      ),
    );

    const priceMajor = parseNumber(
      formData.get("price_per_square"),
      existing.price_per_square_cents / 100,
    );

    const pricePerSquareCents = Math.round(priceMajor * 100);
    const drawAt = parseDrawAt(formData.get("draw_at"));
    const prizes = parsePrizeRows(formData);

    const currentConfig = existing.config_json ?? {};

    const autoDrawFromPrize = Math.max(
      1,
      Math.floor(parseNumber(formData.get("auto_draw_from_prize"), 1)),
    );

    const autoDrawToPrize = Math.max(
      autoDrawFromPrize,
      Math.floor(parseNumber(formData.get("auto_draw_to_prize"), 999)),
    );

    const questionText = String(formData.get("question_text") ?? "").trim();
    const questionAnswer = String(formData.get("question_answer") ?? "").trim();

    const freeEntryAddress = String(
      formData.get("free_entry_address") ?? "",
    ).trim();

    const freeEntryInstructions = String(
      formData.get("free_entry_instructions") ?? "",
    ).trim();

    const freeEntryClosesAt = parseFreeEntryClosesAt(
      formData.get("free_entry_closes_at"),
    );

    const config = {
      ...currentConfig,
      prizes,
      sold: Array.isArray(currentConfig.sold) ? currentConfig.sold : [],
      reserved: Array.isArray(currentConfig.reserved)
        ? currentConfig.reserved
        : [],
      auto_draw_from_prize: autoDrawFromPrize,
      auto_draw_to_prize: autoDrawToPrize,
      question:
        questionText || questionAnswer
          ? {
              text: questionText,
              answer: questionAnswer,
            }
          : null,
      free_entry:
        freeEntryAddress || freeEntryInstructions || freeEntryClosesAt
          ? {
              address: freeEntryAddress,
              instructions: freeEntryInstructions,
              closes_at: freeEntryClosesAt,
            }
          : null,
    };

    await query(
      `
        update squares_games
        set
          slug = $2,
          title = $3,
          description = $4,
          image_url = $5,
          draw_at = $6,
          status = $7,
          currency = $8,
          price_per_square_cents = $9,
          total_squares = $10,
          config_json = $11::jsonb,
          updated_at = now()
        where id = $1
          and tenant_slug = $12
      `,
      [
        existing.id,
        cleanSlug || existing.slug,
        title || existing.title,
        description,
        imageUrl,
        drawAt,
        status,
        currency,
        pricePerSquareCents,
        totalSquares,
        JSON.stringify(config),
        tenantSlug,
      ],
    );

    return NextResponse.redirect(new URL(`/admin/squares/${id}`, request.url), {
      status: 303,
    });
  } catch (error) {
    console.error("POST admin square failed:", error);
    return NextResponse.json(
      { ok: false, error: "Internal error" },
      { status: 500 },
    );
  }
}
"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type Prize = {
  title?: string;
  name?: string;
  description?: string;
};

type Winner = {
  id: string;
  prize_title: string;
  square_number: number;
  customer_name?: string | null;
};

type EntryQuestion = {
  text?: string;
  answer?: string;
} | null;

type FreeEntry = {
  address?: string;
  instructions?: string;
  closes_at?: string;
} | null;

type SquaresGame = {
  id: string;
  tenantSlug: string;
  slug: string;
  title: string;
  description?: string;
  imageUrl?: string;
  drawAt?: string | null;
  status: string;
  currency: string;
  pricePerSquareCents: number;
  totalSquares: number;
  prizes: Prize[];
  soldSquares: number[];
  reservedSquares: number[];
  winners: Winner[];
  question?: EntryQuestion;
  freeEntry?: FreeEntry;
};

type Props = {
  params: {
    slug: string;
  };
};

function formatCurrencyFromCents(cents: number, currency: string) {
  const major = Number(cents || 0) / 100;

  try {
    return new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency: currency || "GBP",
    }).format(Number.isFinite(major) ? major : 0);
  } catch {
    return `${currency || "GBP"} ${(Number.isFinite(major) ? major : 0).toFixed(
      2,
    )}`;
  }
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "full",
    timeStyle: "short",
  }).format(date);
}

function ordinal(position: number) {
  const suffix =
    position % 10 === 1 && position % 100 !== 11
      ? "st"
      : position % 10 === 2 && position % 100 !== 12
        ? "nd"
        : position % 10 === 3 && position % 100 !== 13
          ? "rd"
          : "th";

  return `${position}${suffix}`;
}

export default function PublicSquaresPage({ params }: Props) {
  const { slug } = params;

  const [game, setGame] = useState<SquaresGame | null>(null);
  const [selectedSquares, setSelectedSquares] = useState<number[]>([]);
  const [autoQuantity, setAutoQuantity] = useState(1);
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [entryAnswer, setEntryAnswer] = useState("");
  const [coverFees, setCoverFees] = useState(false);
  const [showAllPrizes, setShowAllPrizes] = useState(false);
  const [showPostalEntry, setShowPostalEntry] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [reservationMessage, setReservationMessage] = useState("");

  async function loadGame() {
    try {
      setLoading(true);
      setError("");
      setReservationMessage("");

      const response = await fetch(
        `/api/public/squares/${encodeURIComponent(slug)}`,
        { cache: "no-store" },
      );

      const text = await response.text();

      let parsed: any = null;

      try {
        parsed = JSON.parse(text);
      } catch {
        throw new Error(`API did not return JSON: ${text.slice(0, 120)}`);
      }

      if (!response.ok) {
        throw new Error(parsed?.error || "Failed to load squares game");
      }

      setGame(parsed.game ?? null);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load squares game",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!slug) return;
    loadGame();
  }, [slug]);

  const unavailableSquares = useMemo(() => {
    const set = new Set<number>();

    for (const square of game?.soldSquares ?? []) {
      set.add(Number(square));
    }

    for (const square of game?.reservedSquares ?? []) {
      set.add(Number(square));
    }

    return set;
  }, [game]);

  const availableCount = useMemo(() => {
    if (!game) return 0;

    let count = 0;

    for (let number = 1; number <= game.totalSquares; number += 1) {
      if (!unavailableSquares.has(number)) count += 1;
    }

    return count;
  }, [game, unavailableSquares]);

  const isPublished = game?.status === "published";
  const isClosed = game?.status === "closed";
  const isDrawn = game?.status === "drawn";
  const isDraft = game?.status === "draft";
  const canReserve = Boolean(game && isPublished);

  const hasEntryQuestion = Boolean(
    String(game?.question?.text ?? "").trim() &&
      String(game?.question?.answer ?? "").trim(),
  );

  const hasFreeEntry = Boolean(
    String(game?.freeEntry?.address ?? "").trim() ||
      String(game?.freeEntry?.instructions ?? "").trim() ||
      String(game?.freeEntry?.closes_at ?? "").trim(),
  );

  const subtotalCents =
    selectedSquares.length * Number(game?.pricePerSquareCents || 0);
  const feeCents = coverFees ? Math.round(subtotalCents * 0.1) : 0;
  const totalCents = subtotalCents + feeCents;

  function toggleSquare(square: number) {
    if (!game || !canReserve) return;
    if (unavailableSquares.has(square)) return;

    setSelectedSquares((current) =>
      current.includes(square)
        ? current.filter((item) => item !== square)
        : [...current, square].sort((a, b) => a - b),
    );

    setError("");
    setReservationMessage("");
  }

  function clearBasket() {
    setSelectedSquares([]);
    setError("");
    setReservationMessage("");
  }

  async function autoSelectSquares(quantity: number) {
    if (!game || !canReserve) return;

    const requested = Math.max(1, Math.floor(Number(quantity) || 0));

    try {
      setSaving(true);
      setError("");
      setReservationMessage("");

      const response = await fetch(
        `/api/public/squares/${encodeURIComponent(slug)}/reserve`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            randomCount: requested,
            previewOnly: true,
          }),
        },
      );

      const text = await response.text();

      let parsed: any = null;

      try {
        parsed = JSON.parse(text);
      } catch {
        throw new Error(`Random API did not return JSON: ${text.slice(0, 120)}`);
      }

      if (!response.ok) {
        throw new Error(parsed?.error || "Random selection failed");
      }

      setSelectedSquares(Array.isArray(parsed.squares) ? parsed.squares : []);
      setAutoQuantity(requested);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Random selection failed");
    } finally {
      setSaving(false);
    }
  }

  async function reserveSquares() {
    if (!game || !canReserve) return;

    try {
      setSaving(true);
      setError("");
      setReservationMessage("");

      if (!customerName.trim()) {
        throw new Error("Please enter your name.");
      }

      if (!customerEmail.trim()) {
        throw new Error("Please enter your email.");
      }

      if (hasEntryQuestion && !entryAnswer.trim()) {
        throw new Error("Please answer the entry question.");
      }

      if (selectedSquares.length === 0) {
        throw new Error("Please select at least one square.");
      }

      const reserveResponse = await fetch(
        `/api/public/squares/${encodeURIComponent(slug)}/reserve`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            squares: selectedSquares,
            customerName: customerName.trim(),
            customerEmail: customerEmail.trim(),
            entryAnswer: entryAnswer.trim(),
          }),
        },
      );

      const reserveText = await reserveResponse.text();

      let reserveParsed: any = null;

      try {
        reserveParsed = JSON.parse(reserveText);
      } catch {
        throw new Error(
          `Reserve API did not return JSON: ${reserveText.slice(0, 120)}`,
        );
      }

      if (!reserveResponse.ok) {
        throw new Error(reserveParsed?.error || "Reserve failed");
      }

      const reservationToken = String(
        reserveParsed?.reservationToken ?? "",
      ).trim();

      if (!reservationToken) {
        throw new Error(
          "Reservation succeeded but no reservation token was returned.",
        );
      }

      setReservationMessage("Squares reserved. Redirecting to checkout...");

      const checkoutResponse = await fetch("/api/stripe/checkout/squares", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gameId: game.id,
          reservationToken,
          coverFees,
        }),
      });

      const checkoutText = await checkoutResponse.text();

      let checkoutParsed: any = null;

      try {
        checkoutParsed = JSON.parse(checkoutText);
      } catch {
        throw new Error(
          `Checkout API did not return JSON: ${checkoutText.slice(0, 120)}`,
        );
      }

      if (!checkoutResponse.ok) {
        throw new Error(checkoutParsed?.error || "Checkout failed");
      }

      const checkoutUrl = String(
        checkoutParsed?.url ??
          checkoutParsed?.checkoutUrl ??
          checkoutParsed?.sessionUrl ??
          "",
      ).trim();

      if (!checkoutUrl) {
        throw new Error(
          "Checkout session created but no checkout URL was returned.",
        );
      }

      window.location.href = checkoutUrl;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reserve failed");
      await loadGame();
    } finally {
      setSaving(false);
    }
  }

  if (!slug) return <div style={styles.wrap}>Loading…</div>;
  if (loading) return <div style={styles.wrap}>Loading squares game…</div>;
  if (error && !game) return <div style={styles.wrap}>{error}</div>;
  if (!game) return <div style={styles.wrap}>Squares game not found.</div>;

  const visiblePrizes = showAllPrizes ? game.prizes : game.prizes.slice(0, 3);

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <nav style={styles.navBar}>
          <Link href={`/c/${game.tenantSlug}`} style={styles.navLink}>
            ← Back to campaigns
          </Link>
        </nav>

        {game.imageUrl ? (
          <div style={styles.imageWrap}>
            <img src={game.imageUrl} alt={game.title} style={styles.image} />
          </div>
        ) : null}

        <h1 style={styles.title}>{game.title}</h1>

        {game.description ? (
          <p style={styles.description}>{game.description}</p>
        ) : null}

        <div style={styles.totalBox}>
          <div>
            Square price:{" "}
            {formatCurrencyFromCents(game.pricePerSquareCents, game.currency)}
          </div>
          <div>Draw date: {formatDateTime(game.drawAt)}</div>
          <div>Total squares: {game.totalSquares}</div>
          <div>Status: {game.status}</div>
          <div>Available now: {availableCount}</div>
        </div>

        {game.prizes.length > 0 ? (
          <section style={styles.prizesBox}>
            <div style={styles.prizesTitle}>Prizes</div>

            <div style={{ display: "grid", gap: 10 }}>
              {visiblePrizes.map((prize, index) => (
                <div
                  key={`${index}-${prize.title ?? prize.name}`}
                  style={styles.prizeCard}
                >
                  <div style={styles.prizePosition}>{ordinal(index + 1)}</div>

                  <div style={styles.prizeContent}>
                    <div style={styles.prizeTitle}>
                      {prize.title || prize.name || `Prize ${index + 1}`}
                    </div>

                    {prize.description ? (
                      <div style={styles.prizeDescription}>
                        {prize.description}
                      </div>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>

            {game.prizes.length > 3 ? (
              <button
                type="button"
                onClick={() => setShowAllPrizes((value) => !value)}
                style={styles.showMoreButton}
              >
                {showAllPrizes ? "Hide prizes" : "Show all prizes"}
              </button>
            ) : null}
          </section>
        ) : null}

        {isDrawn ? (
          <section style={styles.winnersBox}>
            <div style={styles.winnersTitle}>Winning squares</div>

            {game.winners.length > 0 ? (
              <div style={{ display: "grid", gap: 10 }}>
                {game.winners.map((winner) => (
                  <div key={winner.id} style={styles.winnerCard}>
                    <div style={styles.winnerBlock}>
                      <div style={styles.winnerLabel}>Prize</div>
                      <div style={styles.winnerPrize}>{winner.prize_title}</div>
                    </div>

                    <div style={styles.winnerBlock}>
                      <div style={styles.winnerLabel}>Square</div>
                      <div style={styles.winnerTicket}>
                        #{winner.square_number}
                      </div>
                    </div>

                    <div style={styles.winnerBlock}>
                      <div style={styles.winnerLabel}>Winner</div>
                      <div style={styles.winnerName}>
                        {winner.customer_name || "Winner"}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={styles.notice}>No winners have been published yet.</div>
            )}
          </section>
        ) : null}

        {isClosed ? (
          <div style={styles.noticeDark}>
            This squares game is now closed. Reservations and payments are no
            longer available.
          </div>
        ) : null}

        {isDraft ? (
          <div style={styles.notice}>This squares game is not published yet.</div>
        ) : null}

        {canReserve ? (
          <section style={styles.quickSelect}>
            <div>
              <h2 style={{ margin: 0 }}>Quick buy</h2>
              <p style={{ margin: "6px 0 0", color: "#64748b" }}>
                Choose how many squares you would like and we’ll randomly
                auto-select available numbers.
              </p>
            </div>

            <div style={styles.quickControls}>
              <label style={{ display: "grid", gap: 6 }}>
                <span style={styles.smallLabel}>Number of squares</span>
                <input
                  type="number"
                  min={1}
                  max={availableCount || 1}
                  value={autoQuantity === 0 ? "" : autoQuantity}
                  onChange={(event) => {
                    const raw = event.target.value;

                    if (raw === "") {
                      setAutoQuantity(0);
                      return;
                    }

                    const parsed = Number(raw);
                    if (!Number.isFinite(parsed)) return;

                    setAutoQuantity(parsed);
                  }}
                  style={styles.quantityInput}
                />
              </label>

              <button
                type="button"
                onClick={() => autoSelectSquares(autoQuantity)}
                style={styles.autoButton}
              >
                Auto select
              </button>

              <button
                type="button"
                onClick={clearBasket}
                style={styles.clearButton}
              >
                Clear basket
              </button>
            </div>
          </section>
        ) : null}

        <h2 style={styles.heading}>Choose squares</h2>

        <div style={styles.numberGrid}>
          {Array.from({ length: game.totalSquares }, (_, index) => {
            const square = index + 1;
            const isUnavailable = unavailableSquares.has(square);
            const isSelected = selectedSquares.includes(square);

            return (
              <button
                key={square}
                type="button"
                onClick={() => toggleSquare(square)}
                disabled={isUnavailable || !canReserve}
                style={{
                  ...styles.numberButton,
                  background: isSelected
                    ? "#2563eb"
                    : isUnavailable
                      ? "#111827"
                      : "#ffffff",
                  color: isSelected || isUnavailable ? "#ffffff" : "#111827",
                  opacity: canReserve ? 1 : 0.7,
                  cursor:
                    isUnavailable || !canReserve ? "not-allowed" : "pointer",
                }}
              >
                {square}
              </button>
            );
          })}
        </div>

        <h2 style={styles.heading}>Basket</h2>

        {selectedSquares.length === 0 ? (
          <div style={styles.notice}>No squares selected yet.</div>
        ) : (
          <div style={styles.basket}>
            {selectedSquares.map((square) => (
              <div key={square} style={styles.basketRow}>
                <span>Square #{square}</span>

                <button
                  type="button"
                  onClick={() =>
                    setSelectedSquares((current) =>
                      current.filter((item) => item !== square),
                    )
                  }
                  style={styles.removeButton}
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}

        <div style={styles.totalBox}>
          <div>Squares: {selectedSquares.length}</div>

          <div>
            Square total:{" "}
            {formatCurrencyFromCents(subtotalCents, game.currency)}
          </div>

          <label style={styles.coverFeesBox}>
            <input
              type="checkbox"
              checked={coverFees}
              onChange={(event) => setCoverFees(event.target.checked)}
              disabled={!canReserve || selectedSquares.length === 0}
            />

            <span>
              <strong>I’d like to cover platform fees</strong>
              <br />
              <span style={{ color: "#64748b", fontSize: 13 }}>
                Adds approximately{" "}
                {formatCurrencyFromCents(feeCents, game.currency)} so the
                organiser receives the full square value.
              </span>
            </span>
          </label>

          <div>
            Total today: {formatCurrencyFromCents(totalCents, game.currency)}
          </div>
        </div>

        {hasEntryQuestion ? (
          <section style={styles.legalBox}>
            <h2 style={styles.legalTitle}>Entry question</h2>

            <p style={styles.legalDescription}>
              To enter this squares game, please answer the question below before
              reserving your squares.
            </p>

            <label style={styles.legalField}>
              <span style={styles.smallLabel}>{game.question?.text}</span>
              <input
                value={entryAnswer}
                onChange={(event) => setEntryAnswer(event.target.value)}
                placeholder="Your answer"
                style={styles.input}
                disabled={!canReserve}
              />
            </label>
          </section>
        ) : null}

        {hasFreeEntry ? (
          <section style={styles.postalBox}>
            <button
              type="button"
              onClick={() => setShowPostalEntry((value) => !value)}
              style={styles.postalToggle}
            >
              {showPostalEntry
                ? "Hide free postal entry details"
                : "Free postal entry details"}
            </button>

            {showPostalEntry ? (
              <div style={styles.postalContent}>
                {game.freeEntry?.address ? (
                  <div>
                    <div style={styles.postalLabel}>Postal address</div>
                    <div style={styles.postalText}>
                      {game.freeEntry.address}
                    </div>
                  </div>
                ) : null}

                {game.freeEntry?.instructions ? (
                  <div>
                    <div style={styles.postalLabel}>Instructions</div>
                    <div style={styles.postalText}>
                      {game.freeEntry.instructions}
                    </div>
                  </div>
                ) : null}

                {game.freeEntry?.closes_at ? (
                  <div>
                    <div style={styles.postalLabel}>Postal entry closes</div>
                    <div style={styles.postalText}>
                      {formatDateTime(game.freeEntry.closes_at)}
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}
          </section>
        ) : null}

        <h2 style={styles.heading}>Your details</h2>

        <div style={styles.form}>
          <input
            value={customerName}
            onChange={(event) => setCustomerName(event.target.value)}
            placeholder="Your name"
            style={styles.input}
            disabled={!canReserve}
          />

          <input
            value={customerEmail}
            onChange={(event) => setCustomerEmail(event.target.value)}
            placeholder="Your email"
            type="email"
            style={styles.input}
            disabled={!canReserve}
          />

          <button
            type="button"
            onClick={reserveSquares}
            disabled={saving || selectedSquares.length === 0 || !canReserve}
            style={{
              ...styles.primaryButton,
              opacity:
                saving || selectedSquares.length === 0 || !canReserve ? 0.6 : 1,
              cursor:
                saving || selectedSquares.length === 0 || !canReserve
                  ? "not-allowed"
                  : "pointer",
            }}
          >
            {saving ? "Redirecting to checkout..." : "Reserve and pay"}
          </button>
        </div>

        {reservationMessage ? (
          <div style={styles.success}>{reservationMessage}</div>
        ) : null}

        {error ? <div style={styles.error}>{error}</div> : null}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    background: "#f8fafc",
    padding: 16,
  },
  container: {
    maxWidth: 1100,
    margin: "0 auto",
    background: "#ffffff",
    borderRadius: 16,
    padding: 18,
    boxShadow: "0 2px 14px rgba(15,23,42,0.08)",
  },
  wrap: {
    padding: 24,
  },
  navBar: {
    display: "flex",
    justifyContent: "space-between",
    gap: 10,
    flexWrap: "wrap",
    marginBottom: 16,
  },
  navLink: {
    display: "inline-flex",
    padding: "10px 14px",
    borderRadius: 999,
    background: "#ffffff",
    color: "#0f172a",
    border: "1px solid #cbd5e1",
    textDecoration: "none",
    fontWeight: 800,
    fontSize: 14,
  },
  imageWrap: {
    width: "100%",
    height: 360,
    overflow: "hidden",
    borderRadius: 16,
    marginBottom: 20,
    border: "1px solid #e2e8f0",
    background: "#f8fafc",
  },
  image: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
    objectPosition: "center",
    display: "block",
  },
  title: {
    margin: "0 0 8px",
    fontSize: "clamp(28px, 7vw, 42px)",
    lineHeight: 1.1,
    color: "#0f172a",
  },
  description: {
    margin: "0 0 16px",
    color: "#475569",
    lineHeight: 1.6,
    wordBreak: "break-word",
  },
  heading: {
    marginTop: 24,
    marginBottom: 12,
    fontSize: "clamp(20px, 5vw, 28px)",
    lineHeight: 1.2,
  },
  prizesBox: {
    marginTop: 20,
    padding: 16,
    borderRadius: 16,
    background: "#fff7ed",
    border: "1px solid #fed7aa",
  },
  prizesTitle: {
    fontSize: 22,
    fontWeight: 900,
    color: "#9a3412",
    marginBottom: 12,
  },
  prizeCard: {
    display: "flex",
    flexWrap: "wrap",
    gap: 12,
    padding: 14,
    borderRadius: 12,
    background: "#ffffff",
    border: "1px solid #fed7aa",
    alignItems: "flex-start",
  },
  prizePosition: {
    fontSize: 22,
    fontWeight: 900,
    color: "#c2410c",
    minWidth: 70,
    flexShrink: 0,
  },
  prizeContent: {
    flex: "1 1 200px",
    minWidth: 0,
  },
  prizeTitle: {
    fontSize: 18,
    fontWeight: 900,
    color: "#111827",
    wordBreak: "break-word",
    overflowWrap: "anywhere",
  },
  prizeDescription: {
    marginTop: 4,
    fontSize: 14,
    color: "#64748b",
    lineHeight: 1.45,
    wordBreak: "break-word",
    overflowWrap: "anywhere",
  },
  showMoreButton: {
    marginTop: 12,
    padding: "10px 14px",
    borderRadius: 10,
    border: "1px solid #fdba74",
    background: "#fff7ed",
    color: "#9a3412",
    fontWeight: 800,
    cursor: "pointer",
  },
  winnersBox: {
    marginTop: 20,
    padding: 16,
    borderRadius: 16,
    background: "#ecfdf5",
    border: "1px solid #a7f3d0",
  },
  winnersTitle: {
    fontSize: 22,
    fontWeight: 900,
    color: "#065f46",
    marginBottom: 12,
  },
  winnerCard: {
    display: "flex",
    flexWrap: "wrap",
    gap: 14,
    padding: 14,
    borderRadius: 12,
    background: "#ffffff",
    border: "1px solid #bbf7d0",
    alignItems: "flex-start",
  },
  winnerBlock: {
    flex: "1 1 140px",
    minWidth: 0,
  },
  winnerLabel: {
    fontSize: 12,
    color: "#64748b",
    marginBottom: 4,
    fontWeight: 700,
  },
  winnerPrize: {
    fontSize: 20,
    fontWeight: 900,
    color: "#065f46",
    wordBreak: "break-word",
  },
  winnerTicket: {
    fontSize: 24,
    fontWeight: 900,
    color: "#111827",
    wordBreak: "break-word",
  },
  winnerName: {
    fontSize: 18,
    fontWeight: 800,
    color: "#111827",
    wordBreak: "break-word",
  },
  quickSelect: {
    marginTop: 20,
    padding: 16,
    borderRadius: 14,
    background: "#f0f9ff",
    border: "1px solid #bae6fd",
    display: "grid",
    gap: 14,
  },
  quickControls: {
    display: "flex",
    flexWrap: "wrap",
    gap: 10,
    alignItems: "end",
  },
  smallLabel: {
    fontSize: 13,
    fontWeight: 700,
    color: "#475569",
  },
  quantityInput: {
    width: 130,
    height: 44,
    padding: "0 12px",
    borderRadius: 10,
    border: "1px solid #93c5fd",
    fontSize: 16,
    fontWeight: 700,
  },
  autoButton: {
    height: 44,
    padding: "0 16px",
    border: "none",
    borderRadius: 10,
    background: "#2563eb",
    color: "#ffffff",
    fontWeight: 800,
    cursor: "pointer",
  },
  clearButton: {
    height: 44,
    padding: "0 16px",
    borderRadius: 10,
    border: "1px solid #cbd5e1",
    background: "#ffffff",
    color: "#334155",
    fontWeight: 700,
    cursor: "pointer",
  },
  numberGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(56px, 1fr))",
    gap: 8,
  },
  numberButton: {
    height: 48,
    borderRadius: 10,
    border: "1px solid #cbd5e1",
    fontWeight: 700,
  },
  basket: {
    display: "grid",
    gap: 8,
  },
  basketRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
    padding: 12,
    border: "1px solid #e2e8f0",
    borderRadius: 10,
    flexWrap: "wrap",
  },
  removeButton: {
    border: "none",
    background: "transparent",
    color: "#dc2626",
    fontWeight: 700,
    cursor: "pointer",
  },
  totalBox: {
    marginTop: 20,
    padding: 14,
    borderRadius: 10,
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    display: "grid",
    gap: 8,
    fontWeight: 700,
    lineHeight: 1.4,
    wordBreak: "break-word",
  },
  coverFeesBox: {
    display: "flex",
    gap: 10,
    alignItems: "flex-start",
    padding: 12,
    borderRadius: 10,
    border: "1px solid #e2e8f0",
    background: "#ffffff",
    cursor: "pointer",
  },
  legalBox: {
    marginTop: 24,
    padding: 16,
    borderRadius: 14,
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    display: "grid",
    gap: 12,
  },
  legalTitle: {
    margin: 0,
    color: "#0f172a",
    fontSize: 22,
    fontWeight: 900,
  },
  legalDescription: {
    margin: 0,
    color: "#64748b",
    lineHeight: 1.45,
  },
  legalField: {
    display: "grid",
    gap: 6,
  },
  postalBox: {
    marginTop: 14,
    borderRadius: 14,
    border: "1px solid #e2e8f0",
    background: "#ffffff",
    overflow: "hidden",
  },
  postalToggle: {
    width: "100%",
    padding: "13px 14px",
    border: "none",
    background: "#f8fafc",
    color: "#0f172a",
    fontWeight: 900,
    textAlign: "left",
    cursor: "pointer",
  },
  postalContent: {
    padding: 14,
    display: "grid",
    gap: 12,
    borderTop: "1px solid #e2e8f0",
  },
  postalLabel: {
    color: "#64748b",
    fontSize: 12,
    fontWeight: 900,
    marginBottom: 4,
  },
  postalText: {
    color: "#0f172a",
    fontWeight: 700,
    whiteSpace: "pre-wrap",
    lineHeight: 1.45,
  },
  form: {
    display: "grid",
    gap: 12,
    marginTop: 24,
  },
  input: {
    height: 44,
    padding: "0 12px",
    borderRadius: 10,
    border: "1px solid #cbd5e1",
    fontSize: 16,
    minWidth: 0,
  },
  primaryButton: {
    height: 48,
    border: "none",
    borderRadius: 10,
    background: "#16a34a",
    color: "#ffffff",
    fontWeight: 700,
    fontSize: 16,
  },
  notice: {
    padding: 12,
    borderRadius: 10,
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    color: "#475569",
  },
  noticeDark: {
    padding: 12,
    borderRadius: 10,
    background: "#0f172a",
    border: "1px solid #1e293b",
    color: "#e2e8f0",
    marginTop: 16,
  },
  success: {
    marginTop: 16,
    padding: 12,
    borderRadius: 10,
    background: "#ecfdf5",
    border: "1px solid #bbf7d0",
    color: "#166534",
  },
  error: {
    marginTop: 16,
    padding: 12,
    borderRadius: 10,
    background: "#fef2f2",
    border: "1px solid #fecaca",
    color: "#991b1b",
  },
};
