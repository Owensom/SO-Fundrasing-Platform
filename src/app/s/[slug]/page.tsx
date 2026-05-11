"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

const DEFAULT_SQUARES_IMAGE = "/brand/so-default-squares.png";

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
  text?: string | null;
  answer?: string | null;
};

type FreeEntry = {
  address?: string | null;
  instructions?: string | null;
  closes_at?: string | null;
  closesAt?: string | null;
};

type SquaresGame = {
  id: string;
  tenantSlug: string;
  slug: string;
  title: string;
  description?: string;
  imageUrl?: string;
  imageFocusX?: number | null;
  imageFocusY?: number | null;
  image_focus_x?: number | null;
  image_focus_y?: number | null;
  drawAt?: string | null;
  status: string;
  currency: string;
  pricePerSquareCents: number;
  totalSquares: number;
  prizes: Prize[];
  soldSquares: number[];
  reservedSquares: number[];
  winners: Winner[];
  question?: EntryQuestion | null;
  freeEntry?: FreeEntry | null;
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

function normaliseFocus(value: unknown, fallback = 50) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(0, Math.min(100, Math.round(parsed)));
}

function hasEntryQuestion(question: EntryQuestion | null | undefined) {
  return Boolean(
    String(question?.text ?? "").trim() && String(question?.answer ?? "").trim(),
  );
}

function hasFreeEntry(freeEntry: FreeEntry | null | undefined) {
  return Boolean(
    String(freeEntry?.address ?? "").trim() ||
      String(freeEntry?.instructions ?? "").trim() ||
      String(freeEntry?.closes_at ?? freeEntry?.closesAt ?? "").trim(),
  );
}

function getStatusLabel(status: string | null | undefined) {
  const clean = String(status || "draft").toLowerCase();

  if (clean === "published") return "Open now";
  if (clean === "drawn") return "Drawn";
  if (clean === "closed") return "Closed";
  return "Draft";
}

function getStatusStyle(status: string | null | undefined): React.CSSProperties {
  const clean = String(status || "draft").toLowerCase();

  if (clean === "published") {
    return {
      background: "#dcfce7",
      color: "#166534",
      border: "1px solid #bbf7d0",
    };
  }

  if (clean === "drawn") {
    return {
      background: "#dbeafe",
      color: "#1d4ed8",
      border: "1px solid #bfdbfe",
    };
  }

  if (clean === "closed") {
    return {
      background: "#fff7ed",
      color: "#9a3412",
      border: "1px solid #fed7aa",
    };
  }

  return {
    background: "#f1f5f9",
    color: "#475569",
    border: "1px solid #e2e8f0",
  };
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
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [showAllPrizes, setShowAllPrizes] = useState(false);
  const [showPostalDetails, setShowPostalDetails] = useState(false);
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
  const requiresQuestion = hasEntryQuestion(game?.question);
  const showFreeEntry = hasFreeEntry(game?.freeEntry);

  const imageFocusX = normaliseFocus(
    game?.imageFocusX ?? game?.image_focus_x,
    50,
  );

  const imageFocusY = normaliseFocus(
    game?.imageFocusY ?? game?.image_focus_y,
    50,
  );

  const imageObjectPosition = `${imageFocusX}% ${imageFocusY}%`;
  const hasCustomImage = Boolean(game?.imageUrl);
  const heroImageUrl = game?.imageUrl || DEFAULT_SQUARES_IMAGE;

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

      if (selectedSquares.length === 0) {
        throw new Error("Please select at least one square.");
      }

      if (requiresQuestion && !entryAnswer.trim()) {
        throw new Error("Please answer the entry question.");
      }

      if (!acceptedTerms) {
        throw new Error(
          "Please confirm you have accepted the terms and privacy policy.",
        );
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

  const reserveDisabled =
    saving ||
    selectedSquares.length === 0 ||
    !canReserve ||
    !acceptedTerms ||
    (requiresQuestion && !entryAnswer.trim());

  return (
    <div style={styles.page}>
      <section style={styles.hero}>
        <img
          src={heroImageUrl}
          alt={game.title}
          style={{
            ...styles.heroBackgroundImage,
            objectFit: hasCustomImage ? "cover" : "contain",
            objectPosition: hasCustomImage ? imageObjectPosition : "center",
            background: hasCustomImage
              ? "#0f172a"
              : "linear-gradient(135deg, #ffffff 0%, #f8fafc 52%, #eff6ff 100%)",
            padding: hasCustomImage ? 0 : 54,
            boxSizing: "border-box",
          }}
        />

        <div style={styles.heroOverlay} />

        <div style={styles.heroInner}>
          <nav style={styles.heroNav}>
            <Link href={`/c/${game.tenantSlug}`} style={styles.heroBackLink}>
              ← Back to campaigns
            </Link>
          </nav>

          <div style={styles.badgeRow}>
            <span style={styles.typeBadge}>Squares</span>

            <span
              style={{
                ...styles.statusPill,
                ...getStatusStyle(game.status),
              }}
            >
              {getStatusLabel(game.status)}
            </span>
          </div>

          <h1 style={styles.heroTitle}>{game.title}</h1>

          {game.description ? (
            <p style={styles.heroDescription}>{game.description}</p>
          ) : null}

          <div style={styles.heroMeta}>
            <div style={styles.metaCard}>
              <span style={styles.metaLabel}>Square price</span>
              <strong>
                {formatCurrencyFromCents(
                  game.pricePerSquareCents,
                  game.currency,
                )}
              </strong>
            </div>

            <div style={styles.metaCard}>
              <span style={styles.metaLabel}>Draw date</span>
              <strong>{formatDateTime(game.drawAt)}</strong>
            </div>

            <div style={styles.metaCard}>
              <span style={styles.metaLabel}>Total squares</span>
              <strong>{game.totalSquares}</strong>
            </div>

            <div style={styles.metaCard}>
              <span style={styles.metaLabel}>Available now</span>
              <strong>{availableCount}</strong>
            </div>
          </div>

          <div style={styles.heroFooter}>
            <span>Supporting the organiser</span>
            <strong>
              {selectedSquares.length > 0
                ? `${selectedSquares.length} selected`
                : "Choose squares below"}
            </strong>
          </div>
        </div>
      </section>

      <main style={styles.contentWrap}>
        <div style={styles.container}>
          <div style={styles.legalNotice}>
            This campaign is run by the organiser. The platform provides
            software only and is not responsible for the operation of this draw.
            The organiser is responsible for ensuring compliance with all
            applicable laws.
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
                        <div style={styles.winnerPrize}>
                          {winner.prize_title}
                        </div>
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
                <div style={styles.notice}>
                  No winners have been published yet.
                </div>
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
            <div style={styles.notice}>
              This squares game is not published yet.
            </div>
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

            {requiresQuestion ? (
              <section style={styles.questionBox}>
                <div style={styles.questionLabel}>Entry question</div>
                <div style={styles.questionText}>{game.question?.text}</div>

                <input
                  value={entryAnswer}
                  onChange={(event) => setEntryAnswer(event.target.value)}
                  placeholder="Your answer"
                  style={styles.input}
                  disabled={!canReserve}
                />
              </section>
            ) : null}

            {showFreeEntry ? (
              <section style={styles.postalMiniBox}>
                <button
                  type="button"
                  onClick={() => setShowPostalDetails((value) => !value)}
                  style={styles.postalMiniButton}
                >
                  No purchase necessary — free postal entry available
                </button>

                {showPostalDetails ? (
                  <div style={styles.postalDetails}>
                    {game.freeEntry?.address ? (
                      <div style={styles.freeEntryBlock}>
                        <div style={styles.freeEntryLabel}>Postal address</div>
                        <div style={styles.freeEntryText}>
                          {game.freeEntry.address}
                        </div>
                      </div>
                    ) : null}

                    {game.freeEntry?.instructions ? (
                      <div style={styles.freeEntryBlock}>
                        <div style={styles.freeEntryLabel}>Instructions</div>
                        <div style={styles.freeEntryText}>
                          {game.freeEntry.instructions}
                        </div>
                      </div>
                    ) : null}

                    {game.freeEntry?.closes_at || game.freeEntry?.closesAt ? (
                      <div style={styles.freeEntryBlock}>
                        <div style={styles.freeEntryLabel}>
                          Postal entry closes
                        </div>

                        <div style={styles.freeEntryText}>
                          {formatDateTime(
                            game.freeEntry.closes_at ?? game.freeEntry.closesAt,
                          )}
                        </div>
                      </div>
                    ) : null}

                    <div style={styles.freeEntryNotice}>
                      Postal entries are included in the same draw as paid
                      entries. Please include your full name, email address, this
                      squares game name, your answer to the entry question if one
                      is shown, and your preferred square number where
                      applicable. One entry per postcard/envelope.
                    </div>
                  </div>
                ) : null}
              </section>
            ) : null}

            <label style={styles.termsBox}>
              <input
                type="checkbox"
                checked={acceptedTerms}
                onChange={(event) => setAcceptedTerms(event.target.checked)}
                disabled={!canReserve}
              />

              <span>
                I confirm I have read and accept the{" "}
                <Link href="/terms" style={styles.inlineLink}>
                  terms
                </Link>{" "}
                and{" "}
                <Link href="/privacy" style={styles.inlineLink}>
                  privacy policy
                </Link>
                .
              </span>
            </label>

            <button
              type="button"
              onClick={reserveSquares}
              disabled={reserveDisabled}
              style={{
                ...styles.primaryButton,
                opacity: reserveDisabled ? 0.6 : 1,
                cursor: reserveDisabled ? "not-allowed" : "pointer",
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
      </main>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    background:
      "linear-gradient(180deg, #020617 0px, #0f172a 760px, #f8fafc 760px, #f8fafc 100%)",
  },

  hero: {
    position: "relative",
    minHeight: 760,
    overflow: "hidden",
    display: "flex",
    alignItems: "flex-end",
  },

  heroBackgroundImage: {
    position: "absolute",
    inset: 0,
    width: "100%",
    height: "100%",
    display: "block",
  },

  heroOverlay: {
    position: "absolute",
    inset: 0,
    background:
      "linear-gradient(180deg, rgba(2,6,23,0.16) 0%, rgba(2,6,23,0.34) 34%, rgba(2,6,23,0.82) 72%, rgba(2,6,23,0.96) 100%)",
  },

  heroInner: {
    position: "relative",
    zIndex: 2,
    width: "100%",
    maxWidth: 1240,
    margin: "0 auto",
    padding: "34px 20px 54px",
    color: "#ffffff",
  },

  heroNav: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    flexWrap: "wrap",
    marginBottom: 48,
  },

  heroBackLink: {
    display: "inline-flex",
    alignItems: "center",
    padding: "12px 16px",
    borderRadius: 999,
    background: "rgba(255,255,255,0.12)",
    border: "1px solid rgba(255,255,255,0.18)",
    color: "#ffffff",
    textDecoration: "none",
    fontWeight: 800,
    backdropFilter: "blur(12px)",
  },

  badgeRow: {
    display: "flex",
    gap: 12,
    flexWrap: "wrap",
    alignItems: "center",
    marginBottom: 22,
  },
    typeBadge: {
    display: "inline-flex",
    padding: "8px 14px",
    borderRadius: 999,
    background: "rgba(255,255,255,0.12)",
    border: "1px solid rgba(255,255,255,0.18)",
    color: "#ffffff",
    fontWeight: 900,
    fontSize: 13,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    backdropFilter: "blur(12px)",
  },

  statusPill: {
    display: "inline-flex",
    alignItems: "center",
    padding: "8px 14px",
    borderRadius: 999,
    fontWeight: 900,
    fontSize: 13,
    textTransform: "uppercase",
    letterSpacing: "0.06em",
  },

  heroTitle: {
    margin: 0,
    maxWidth: 860,
    fontSize: "clamp(44px, 8vw, 88px)",
    lineHeight: 0.92,
    letterSpacing: "-0.07em",
    fontWeight: 950,
    textShadow: "0 8px 32px rgba(0,0,0,0.45)",
  },

  heroDescription: {
    margin: "24px 0 0",
    maxWidth: 760,
    color: "rgba(255,255,255,0.82)",
    fontSize: 18,
    lineHeight: 1.75,
    textShadow: "0 4px 18px rgba(0,0,0,0.34)",
  },

  heroMeta: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    gap: 14,
    marginTop: 34,
  },

  metaCard: {
    padding: 18,
    borderRadius: 24,
    background: "rgba(255,255,255,0.12)",
    border: "1px solid rgba(255,255,255,0.14)",
    backdropFilter: "blur(14px)",
    boxShadow: "0 10px 30px rgba(0,0,0,0.22)",
    display: "grid",
    gap: 8,
  },

  metaLabel: {
    color: "rgba(255,255,255,0.72)",
    fontSize: 12,
    fontWeight: 800,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
  },

  heroFooter: {
    marginTop: 24,
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    flexWrap: "wrap",
    color: "rgba(255,255,255,0.78)",
    fontWeight: 700,
  },

  contentWrap: {
    position: "relative",
    zIndex: 5,
    marginTop: -80,
    paddingBottom: 80,
  },

  container: {
    maxWidth: 1240,
    margin: "0 auto",
    padding: "0 20px",
    display: "grid",
    gap: 22,
  },

  wrap: {
    padding: 30,
    color: "#ffffff",
  },

  heading: {
    margin: "10px 0 14px",
    fontSize: "clamp(24px, 5vw, 34px)",
    lineHeight: 1,
    letterSpacing: "-0.05em",
    color: "#0f172a",
    fontWeight: 950,
  },

  legalNotice: {
    padding: 18,
    borderRadius: 24,
    background: "#fff7ed",
    border: "1px solid #fed7aa",
    color: "#9a3412",
    fontWeight: 700,
    lineHeight: 1.65,
    boxShadow: "0 8px 24px rgba(15,23,42,0.05)",
  },

  prizesBox: {
    padding: 24,
    borderRadius: 28,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    boxShadow: "0 10px 30px rgba(15,23,42,0.06)",
  },

  prizesTitle: {
    marginBottom: 16,
    fontSize: 28,
    color: "#0f172a",
    fontWeight: 950,
    letterSpacing: "-0.04em",
  },

  prizeCard: {
    display: "flex",
    gap: 18,
    padding: 18,
    borderRadius: 22,
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    alignItems: "flex-start",
  },

  prizePosition: {
    width: 72,
    height: 72,
    borderRadius: 20,
    background:
      "linear-gradient(135deg, #2563eb 0%, #1d4ed8 50%, #1e40af 100%)",
    color: "#ffffff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 24,
    fontWeight: 950,
    flexShrink: 0,
    boxShadow: "0 10px 24px rgba(37,99,235,0.25)",
  },

  prizeContent: {
    flex: 1,
    minWidth: 0,
  },

  prizeTitle: {
    fontSize: 22,
    fontWeight: 900,
    color: "#0f172a",
    lineHeight: 1.15,
  },

  prizeDescription: {
    marginTop: 8,
    color: "#64748b",
    lineHeight: 1.7,
  },

  winnersBox: {
    padding: 24,
    borderRadius: 28,
    background: "#ecfdf5",
    border: "1px solid #bbf7d0",
  },

  winnersTitle: {
    marginBottom: 16,
    fontSize: 28,
    color: "#065f46",
    fontWeight: 950,
    letterSpacing: "-0.04em",
  },

  winnerCard: {
    display: "flex",
    flexWrap: "wrap",
    gap: 18,
    padding: 18,
    borderRadius: 22,
    background: "#ffffff",
    border: "1px solid #bbf7d0",
  },

  winnerBlock: {
    display: "grid",
    gap: 6,
    minWidth: 150,
  },

  winnerLabel: {
    fontSize: 12,
    color: "#64748b",
    fontWeight: 800,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
  },

  winnerPrize: {
    fontSize: 24,
    fontWeight: 950,
    color: "#065f46",
  },

  winnerTicket: {
    fontSize: 24,
    fontWeight: 950,
    color: "#0f172a",
  },

  winnerName: {
    fontSize: 20,
    fontWeight: 900,
    color: "#0f172a",
  },

  quickSelect: {
    padding: 24,
    borderRadius: 28,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    display: "grid",
    gap: 18,
    boxShadow: "0 10px 30px rgba(15,23,42,0.06)",
  },

  quickControls: {
    display: "flex",
    flexWrap: "wrap",
    gap: 12,
    alignItems: "end",
  },

  smallLabel: {
    fontSize: 13,
    fontWeight: 800,
    color: "#475569",
  },

  quantityInput: {
    width: 140,
    height: 50,
    padding: "0 14px",
    borderRadius: 14,
    border: "1px solid #cbd5e1",
    fontSize: 16,
    fontWeight: 800,
  },

  autoButton: {
    height: 50,
    padding: "0 18px",
    borderRadius: 14,
    border: "none",
    background: "#2563eb",
    color: "#ffffff",
    fontWeight: 900,
    cursor: "pointer",
  },

  clearButton: {
    height: 50,
    padding: "0 18px",
    borderRadius: 14,
    border: "1px solid #cbd5e1",
    background: "#ffffff",
    color: "#334155",
    fontWeight: 800,
    cursor: "pointer",
  },

  numberGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(62px, 1fr))",
    gap: 10,
  },

  numberButton: {
    height: 56,
    borderRadius: 16,
    border: "1px solid #cbd5e1",
    fontWeight: 900,
    fontSize: 15,
  },

  basket: {
    display: "grid",
    gap: 10,
  },

  basketRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    padding: 16,
    border: "1px solid #e2e8f0",
    borderRadius: 18,
    background: "#ffffff",
    fontWeight: 800,
  },

  removeButton: {
    border: "none",
    background: "transparent",
    color: "#dc2626",
    fontWeight: 900,
    cursor: "pointer",
  },

  totalBox: {
    padding: 22,
    borderRadius: 28,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    display: "grid",
    gap: 10,
    fontWeight: 800,
    boxShadow: "0 10px 30px rgba(15,23,42,0.06)",
  },

  coverFeesBox: {
    display: "flex",
    gap: 12,
    alignItems: "flex-start",
    padding: 16,
    borderRadius: 18,
    border: "1px solid #e2e8f0",
    background: "#f8fafc",
  },

  form: {
    display: "grid",
    gap: 14,
  },

  input: {
    height: 52,
    padding: "0 14px",
    borderRadius: 16,
    border: "1px solid #cbd5e1",
    fontSize: 16,
  },

  questionBox: {
    padding: 20,
    borderRadius: 22,
    background: "#eff6ff",
    border: "1px solid #bfdbfe",
    display: "grid",
    gap: 12,
  },

  questionLabel: {
    color: "#1d4ed8",
    fontWeight: 950,
  },

  questionText: {
    color: "#1e40af",
    fontWeight: 700,
    lineHeight: 1.65,
  },

  postalMiniBox: {
    display: "grid",
    gap: 10,
  },

  postalMiniButton: {
    width: "100%",
    textAlign: "left",
    padding: 18,
    borderRadius: 22,
    background: "#eff6ff",
    border: "1px solid #bfdbfe",
    color: "#1d4ed8",
    fontWeight: 900,
    cursor: "pointer",
  },

  postalDetails: {
    padding: 18,
    borderRadius: 22,
    background: "#f0f9ff",
    border: "1px solid #bae6fd",
    display: "grid",
    gap: 12,
  },

  freeEntryBlock: {
    padding: 16,
    borderRadius: 18,
    background: "#ffffff",
    border: "1px solid #e0f2fe",
  },

  freeEntryLabel: {
    fontSize: 12,
    fontWeight: 900,
    color: "#0369a1",
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: "0.06em",
  },

  freeEntryText: {
    color: "#0f172a",
    lineHeight: 1.6,
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
  },

  freeEntryNotice: {
    padding: 16,
    borderRadius: 18,
    background: "#ffffff",
    border: "1px dashed #7dd3fc",
    color: "#475569",
    lineHeight: 1.6,
    fontSize: 14,
  },

  termsBox: {
    display: "flex",
    gap: 12,
    alignItems: "flex-start",
    padding: 16,
    borderRadius: 18,
    border: "1px solid #e2e8f0",
    background: "#ffffff",
    lineHeight: 1.6,
    fontWeight: 700,
  },

  inlineLink: {
    color: "#2563eb",
    fontWeight: 900,
  },

  primaryButton: {
    height: 56,
    border: "none",
    borderRadius: 18,
    background:
      "linear-gradient(135deg, #2563eb 0%, #1d4ed8 50%, #1e40af 100%)",
    color: "#ffffff",
    fontWeight: 900,
    fontSize: 16,
    boxShadow: "0 14px 30px rgba(37,99,235,0.25)",
  },

  notice: {
    padding: 16,
    borderRadius: 18,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    color: "#475569",
    fontWeight: 700,
  },

  noticeDark: {
    padding: 18,
    borderRadius: 22,
    background: "#0f172a",
    border: "1px solid #1e293b",
    color: "#e2e8f0",
    fontWeight: 700,
  },

  success: {
    padding: 18,
    borderRadius: 22,
    background: "#ecfdf5",
    border: "1px solid #bbf7d0",
    color: "#166534",
    fontWeight: 800,
  },

  error: {
    padding: 18,
    borderRadius: 22,
    background: "#fef2f2",
    border: "1px solid #fecaca",
    color: "#991b1b",
    fontWeight: 800,
  },

  showMoreButton: {
    marginTop: 14,
    padding: "12px 16px",
    borderRadius: 14,
    border: "1px solid #cbd5e1",
    background: "#ffffff",
    color: "#0f172a",
    fontWeight: 900,
    cursor: "pointer",
  },
};
