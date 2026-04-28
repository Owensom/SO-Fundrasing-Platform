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
  const [coverFees, setCoverFees] = useState(false);
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

      const reserveResponse = await fetch(
        `/api/public/squares/${encodeURIComponent(slug)}/reserve`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            squares: selectedSquares,
            customerName: customerName.trim(),
            customerEmail: customerEmail.trim(),
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

  if (!slug) return <div className="sq-wrap">Loading…</div>;
  if (loading) return <div className="sq-wrap">Loading squares game…</div>;
  if (error && !game) return <div className="sq-wrap">{error}</div>;
  if (!game) return <div className="sq-wrap">Squares game not found.</div>;

  return (
    <>
      <style>{`
        * {
          box-sizing: border-box;
        }

        .sq-page {
          min-height: 100vh;
          background: #f8fafc;
          padding: 16px;
        }

        .sq-container {
          max-width: 1100px;
          margin: 0 auto;
          background: #ffffff;
          border-radius: 16px;
          padding: 18px;
          box-shadow: 0 2px 14px rgba(15, 23, 42, 0.08);
        }

        .sq-wrap {
          padding: 24px;
        }

        .sq-nav-bar {
          display: flex;
          justify-content: space-between;
          gap: 10px;
          flex-wrap: wrap;
          margin-bottom: 16px;
        }

        .sq-nav-link {
          display: inline-flex;
          padding: 10px 14px;
          border-radius: 999px;
          background: #ffffff;
          color: #0f172a;
          border: 1px solid #cbd5e1;
          text-decoration: none;
          font-weight: 800;
          font-size: 14px;
        }

        .sq-image-wrap {
          width: 100%;
          height: 360px;
          overflow: hidden;
          border-radius: 16px;
          margin-bottom: 20px;
          border: 1px solid #e2e8f0;
          background: #f8fafc;
        }

        .sq-image {
          width: 100%;
          height: 100%;
          object-fit: cover;
          object-position: center;
          display: block;
        }

        .sq-title {
          margin: 0 0 8px;
          font-size: clamp(28px, 7vw, 42px);
          line-height: 1.1;
          color: #0f172a;
        }

        .sq-description {
          margin: 0 0 16px;
          color: #475569;
          line-height: 1.6;
          word-break: break-word;
        }

        .sq-heading {
          margin-top: 24px;
          margin-bottom: 12px;
          font-size: clamp(20px, 5vw, 28px);
          line-height: 1.2;
        }

        .sq-info-box {
          margin-top: 20px;
          padding: 14px;
          border-radius: 10px;
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          display: grid;
          gap: 8px;
          font-weight: 700;
          line-height: 1.4;
          word-break: break-word;
        }

        .sq-prizes-box {
          margin-top: 20px;
          padding: 16px;
          border-radius: 16px;
          background: #fff7ed;
          border: 1px solid #fed7aa;
        }

        .sq-prizes-title {
          font-size: 22px;
          font-weight: 900;
          color: #9a3412;
          margin-bottom: 12px;
        }

        .sq-prize-list {
          display: grid;
          gap: 10px;
        }

        .sq-prize-card {
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
          padding: 14px;
          border-radius: 12px;
          background: #ffffff;
          border: 1px solid #fed7aa;
          align-items: flex-start;
        }

        .sq-prize-position {
          font-size: 22px;
          font-weight: 900;
          color: #c2410c;
          min-width: 70px;
          flex-shrink: 0;
        }

        .sq-prize-content {
          flex: 1 1 200px;
          min-width: 0;
        }

        .sq-prize-title {
          font-size: 18px;
          font-weight: 900;
          color: #111827;
          word-break: break-word;
          overflow-wrap: anywhere;
        }

        .sq-prize-description {
          margin-top: 4px;
          font-size: 14px;
          color: #64748b;
          line-height: 1.45;
          word-break: break-word;
          overflow-wrap: anywhere;
        }

        .sq-winners-box {
          margin-top: 20px;
          padding: 16px;
          border-radius: 16px;
          background: #ecfdf5;
          border: 1px solid #a7f3d0;
        }

        .sq-winners-title {
          font-size: 22px;
          font-weight: 900;
          color: #065f46;
          margin-bottom: 12px;
        }

        .sq-winners-list {
          display: grid;
          gap: 10px;
        }

        .sq-winner-card {
          display: flex;
          flex-wrap: wrap;
          gap: 14px;
          padding: 14px;
          border-radius: 12px;
          background: #ffffff;
          border: 1px solid #bbf7d0;
          align-items: flex-start;
        }

        .sq-winner-block {
          flex: 1 1 140px;
          min-width: 0;
        }

        .sq-winner-label {
          font-size: 12px;
          color: #64748b;
          margin-bottom: 4px;
          font-weight: 700;
        }

        .sq-winner-prize {
          font-size: 20px;
          font-weight: 900;
          color: #065f46;
          word-break: break-word;
        }

        .sq-winner-ticket {
          font-size: 24px;
          font-weight: 900;
          color: #111827;
          word-break: break-word;
        }

        .sq-winner-name {
          font-size: 18px;
          font-weight: 800;
          color: #111827;
          word-break: break-word;
        }

        .sq-quick-select {
          margin-top: 20px;
          padding: 16px;
          border-radius: 14px;
          background: #f0f9ff;
          border: 1px solid #bae6fd;
          display: grid;
          gap: 14px;
        }

        .sq-quick-title {
          margin: 0;
        }

        .sq-quick-text {
          margin: 6px 0 0;
          color: #64748b;
        }

        .sq-quick-controls {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          align-items: end;
        }

        .sq-quick-label {
          display: grid;
          gap: 6px;
        }

        .sq-small-label {
          font-size: 13px;
          font-weight: 700;
          color: #475569;
        }

        .sq-quantity-input {
          width: 130px;
          height: 44px;
          padding: 0 12px;
          border-radius: 10px;
          border: 1px solid #93c5fd;
          font-size: 16px;
          font-weight: 700;
        }

        .sq-auto-button {
          height: 44px;
          padding: 0 16px;
          border: none;
          border-radius: 10px;
          background: #2563eb;
          color: #ffffff;
          font-weight: 800;
          cursor: pointer;
        }

        .sq-clear-button {
          height: 44px;
          padding: 0 16px;
          border-radius: 10px;
          border: 1px solid #cbd5e1;
          background: #ffffff;
          color: #334155;
          font-weight: 700;
          cursor: pointer;
        }

        .sq-number-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(56px, 1fr));
          gap: 8px;
        }

        .sq-number-button {
          min-height: 48px;
          border-radius: 10px;
          border: 1px solid #cbd5e1;
          font-weight: 700;
          font-size: 15px;
          touch-action: manipulation;
        }

        .sq-basket {
          display: grid;
          gap: 8px;
        }

        .sq-basket-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 10px;
          padding: 12px;
          border: 1px solid #e2e8f0;
          border-radius: 10px;
          flex-wrap: wrap;
        }

        .sq-remove-button {
          border: none;
          background: transparent;
          color: #dc2626;
          font-weight: 700;
          cursor: pointer;
        }

        .sq-cover-fees-box {
          display: flex;
          gap: 10px;
          align-items: flex-start;
          padding: 12px;
          border-radius: 10px;
          border: 1px solid #e2e8f0;
          background: #ffffff;
          cursor: pointer;
        }

        .sq-form {
          display: grid;
          gap: 12px;
          margin-top: 24px;
        }

        .sq-input {
          height: 44px;
          padding: 0 12px;
          border-radius: 10px;
          border: 1px solid #cbd5e1;
          font-size: 16px;
          min-width: 0;
          width: 100%;
        }

        .sq-primary-button {
          height: 48px;
          border: none;
          border-radius: 10px;
          background: #16a34a;
          color: #ffffff;
          font-weight: 700;
          font-size: 16px;
        }

        .sq-notice {
          padding: 12px;
          border-radius: 10px;
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          color: #475569;
        }

        .sq-notice-dark {
          padding: 12px;
          border-radius: 10px;
          background: #0f172a;
          border: 1px solid #1e293b;
          color: #e2e8f0;
          margin-top: 16px;
        }

        .sq-success {
          margin-top: 16px;
          padding: 12px;
          border-radius: 10px;
          background: #ecfdf5;
          border: 1px solid #bbf7d0;
          color: #166534;
        }

        .sq-error {
          margin-top: 16px;
          padding: 12px;
          border-radius: 10px;
          background: #fef2f2;
          border: 1px solid #fecaca;
          color: #991b1b;
        }

        @media (max-width: 640px) {
          .sq-page {
            padding: 0;
            background: #ffffff;
          }

          .sq-container {
            width: 100%;
            border-radius: 0;
            padding: 14px;
            box-shadow: none;
          }

          .sq-nav-bar {
            margin-bottom: 12px;
          }

          .sq-nav-link {
            width: 100%;
            justify-content: center;
          }

          .sq-image-wrap {
            height: 220px;
            border-radius: 14px;
            margin-bottom: 16px;
          }

          .sq-title {
            font-size: 30px;
          }

          .sq-description {
            font-size: 15px;
          }

          .sq-info-box {
            font-size: 14px;
          }

          .sq-prizes-box,
          .sq-winners-box,
          .sq-quick-select {
            padding: 14px;
            border-radius: 14px;
          }

          .sq-prize-card,
          .sq-winner-card {
            display: grid;
            gap: 8px;
          }

          .sq-prize-position {
            min-width: 0;
          }

          .sq-quick-controls {
            display: grid;
            grid-template-columns: 1fr;
          }

          .sq-quantity-input,
          .sq-auto-button,
          .sq-clear-button {
            width: 100%;
          }

          .sq-number-grid {
            grid-template-columns: repeat(auto-fill, minmax(44px, 1fr));
            gap: 7px;
          }

          .sq-number-button {
            min-height: 44px;
            border-radius: 9px;
            font-size: 14px;
            padding: 0;
          }

          .sq-basket-row {
            align-items: flex-start;
          }

          .sq-remove-button {
            padding: 6px 0;
          }

          .sq-cover-fees-box {
            font-size: 14px;
          }

          .sq-primary-button {
            min-height: 52px;
          }
        }

        @media (max-width: 380px) {
          .sq-number-grid {
            grid-template-columns: repeat(auto-fill, minmax(38px, 1fr));
            gap: 6px;
          }

          .sq-number-button {
            min-height: 40px;
            font-size: 13px;
          }
        }
      `}</style>

      <div className="sq-page">
        <div className="sq-container">
          <nav className="sq-nav-bar">
            <Link href={`/c/${game.tenantSlug}`} className="sq-nav-link">
              ← Back to campaigns
            </Link>
          </nav>

          {game.imageUrl ? (
            <div className="sq-image-wrap">
              <img src={game.imageUrl} alt={game.title} className="sq-image" />
            </div>
          ) : null}

          <h1 className="sq-title">{game.title}</h1>

          {game.description ? (
            <p className="sq-description">{game.description}</p>
          ) : null}

          <div className="sq-info-box">
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
            <section className="sq-prizes-box">
              <div className="sq-prizes-title">Prizes</div>

              <div className="sq-prize-list">
                {game.prizes.map((prize, index) => (
                  <div
                    key={`${index}-${prize.title ?? prize.name}`}
                    className="sq-prize-card"
                  >
                    <div className="sq-prize-position">{ordinal(index + 1)}</div>

                    <div className="sq-prize-content">
                      <div className="sq-prize-title">
                        {prize.title || prize.name || `Prize ${index + 1}`}
                      </div>

                      {prize.description ? (
                        <div className="sq-prize-description">
                          {prize.description}
                        </div>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {isDrawn ? (
            <section className="sq-winners-box">
              <div className="sq-winners-title">Winning squares</div>

              {game.winners.length > 0 ? (
                <div className="sq-winners-list">
                  {game.winners.map((winner) => (
                    <div key={winner.id} className="sq-winner-card">
                      <div className="sq-winner-block">
                        <div className="sq-winner-label">Prize</div>
                        <div className="sq-winner-prize">
                          {winner.prize_title}
                        </div>
                      </div>

                      <div className="sq-winner-block">
                        <div className="sq-winner-label">Square</div>
                        <div className="sq-winner-ticket">
                          #{winner.square_number}
                        </div>
                      </div>

                      <div className="sq-winner-block">
                        <div className="sq-winner-label">Winner</div>
                        <div className="sq-winner-name">
                          {winner.customer_name || "Winner"}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="sq-notice">
                  No winners have been published yet.
                </div>
              )}
            </section>
          ) : null}

          {isClosed ? (
            <div className="sq-notice-dark">
              This squares game is now closed. Reservations and payments are no
              longer available.
            </div>
          ) : null}

          {isDraft ? (
            <div className="sq-notice">
              This squares game is not published yet.
            </div>
          ) : null}

          {canReserve ? (
            <section className="sq-quick-select">
              <div>
                <h2 className="sq-quick-title">Quick buy</h2>
                <p className="sq-quick-text">
                  Choose how many squares you would like and we’ll randomly
                  auto-select available numbers.
                </p>
              </div>

              <div className="sq-quick-controls">
                <label className="sq-quick-label">
                  <span className="sq-small-label">Number of squares</span>
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
                    className="sq-quantity-input"
                  />
                </label>

                <button
                  type="button"
                  onClick={() => autoSelectSquares(autoQuantity)}
                  className="sq-auto-button"
                >
                  Auto select
                </button>

                <button
                  type="button"
                  onClick={clearBasket}
                  className="sq-clear-button"
                >
                  Clear basket
                </button>
              </div>
            </section>
          ) : null}

          <h2 className="sq-heading">Choose squares</h2>

          <div className="sq-number-grid">
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
                  className="sq-number-button"
                  style={{
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

          <h2 className="sq-heading">Basket</h2>

          {selectedSquares.length === 0 ? (
            <div className="sq-notice">No squares selected yet.</div>
          ) : (
            <div className="sq-basket">
              {selectedSquares.map((square) => (
                <div key={square} className="sq-basket-row">
                  <span>Square #{square}</span>

                  <button
                    type="button"
                    onClick={() =>
                      setSelectedSquares((current) =>
                        current.filter((item) => item !== square),
                      )
                    }
                    className="sq-remove-button"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="sq-info-box">
            <div>Squares: {selectedSquares.length}</div>

            <div>
              Square total:{" "}
              {formatCurrencyFromCents(subtotalCents, game.currency)}
            </div>

            <label className="sq-cover-fees-box">
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

          <h2 className="sq-heading">Your details</h2>

          <div className="sq-form">
            <input
              value={customerName}
              onChange={(event) => setCustomerName(event.target.value)}
              placeholder="Your name"
              className="sq-input"
              disabled={!canReserve}
            />

            <input
              value={customerEmail}
              onChange={(event) => setCustomerEmail(event.target.value)}
              placeholder="Your email"
              type="email"
              className="sq-input"
              disabled={!canReserve}
            />

            <button
              type="button"
              onClick={reserveSquares}
              disabled={saving || selectedSquares.length === 0 || !canReserve}
              className="sq-primary-button"
              style={{
                opacity:
                  saving || selectedSquares.length === 0 || !canReserve
                    ? 0.6
                    : 1,
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
            <div className="sq-success">{reservationMessage}</div>
          ) : null}

          {error ? <div className="sq-error">{error}</div> : null}
        </div>
      </div>
    </>
  );
}
