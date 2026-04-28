"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

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

function money(cents: number, currency: string) {
  return `${(Number(cents || 0) / 100).toFixed(2)} ${currency || "GBP"}`;
}

function formatDrawDate(value?: string | null) {
  if (!value) return "To be confirmed";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "To be confirmed";

  return date.toLocaleString("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export default function PublicSquaresPage({ params }: Props) {
  const { slug } = params;

  const [game, setGame] = useState<SquaresGame | null>(null);
  const [selectedSquares, setSelectedSquares] = useState<number[]>([]);
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [coverFees, setCoverFees] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function loadGame() {
    setLoading(true);
    setError("");

    try {
      const res = await fetch(`/api/public/squares/${slug}`, {
        cache: "no-store",
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || "Failed to load squares game");
      }

      setGame(data.game ?? null);
    } catch (err: any) {
      setError(err.message || "Failed to load squares game");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
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

  const total = selectedSquares.length * Number(game?.pricePerSquareCents || 0);
  const fee = coverFees ? Math.round(total * 0.1) : 0;
  const totalWithFees = total + fee;

  function toggleSquare(square: number) {
    if (!game || game.status !== "published") return;
    if (unavailableSquares.has(square)) return;

    setSelectedSquares((current) =>
      current.includes(square)
        ? current.filter((item) => item !== square)
        : [...current, square].sort((a, b) => a - b),
    );
  }

  function quickPick(count: number) {
    if (!game) return;

    const available = Array.from(
      { length: game.totalSquares },
      (_, index) => index + 1,
    ).filter((square) => !unavailableSquares.has(square));

    const shuffled = [...available].sort(() => Math.random() - 0.5);

    setSelectedSquares(shuffled.slice(0, count).sort((a, b) => a - b));
  }

  async function checkout() {
    if (!game || selectedSquares.length === 0) return;

    setBusy(true);
    setError("");

    try {
      const reserveRes = await fetch(`/api/public/squares/${slug}/reserve`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          squares: selectedSquares,
          customerName,
          customerEmail,
        }),
      });

      const reserveData = await reserveRes.json();

      if (!reserveRes.ok) {
        throw new Error(reserveData?.error || "Could not reserve squares");
      }

      const checkoutRes = await fetch("/api/stripe/checkout/squares", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          gameId: game.id,
          reservationToken: reserveData.reservationToken,
          coverFees,
        }),
      });

      const checkoutData = await checkoutRes.json();

      if (!checkoutRes.ok) {
        throw new Error(checkoutData?.error || "Checkout failed");
      }

      if (checkoutData.url) {
        window.location.href = checkoutData.url;
        return;
      }

      throw new Error("Checkout URL missing");
    } catch (err: any) {
      setError(err.message || "Checkout failed");
      await loadGame();
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <main style={pageStyle}>Loading…</main>;
  }

  if (error && !game) {
    return (
      <main style={pageStyle}>
        <p style={{ color: "#b91c1c", fontWeight: 800 }}>{error}</p>
      </main>
    );
  }

  if (!game) {
    return <main style={pageStyle}>Squares game not found.</main>;
  }

  return (
    <main style={pageStyle}>
      <Link href="/" style={linkStyle}>
        ← Back
      </Link>

      <section style={heroStyle}>
        <div>
          <div style={statusStyle}>{game.status}</div>
          <h1 style={titleStyle}>{game.title}</h1>

          <p style={mutedStyle}>
            Draw date: <strong>{formatDrawDate(game.drawAt)}</strong>
          </p>

          {game.description ? <p style={descriptionStyle}>{game.description}</p> : null}

          <div style={infoGridStyle}>
            <div style={infoCardStyle}>
              <div style={infoLabelStyle}>Price per square</div>
              <div style={infoValueStyle}>
                {money(game.pricePerSquareCents, game.currency)}
              </div>
            </div>

            <div style={infoCardStyle}>
              <div style={infoLabelStyle}>Total squares</div>
              <div style={infoValueStyle}>{game.totalSquares}</div>
            </div>

            <div style={infoCardStyle}>
              <div style={infoLabelStyle}>Available</div>
              <div style={infoValueStyle}>
                {game.totalSquares - unavailableSquares.size}
              </div>
            </div>
          </div>
        </div>

        {game.imageUrl ? (
          <img src={game.imageUrl} alt={game.title} style={imageStyle} />
        ) : null}
      </section>

      {game.prizes?.length > 0 ? (
        <section style={cardStyle}>
          <h2 style={sectionTitleStyle}>Prizes</h2>
          <div style={prizeGridStyle}>
            {game.prizes.map((prize, index) => (
              <div key={index} style={prizeCardStyle}>
                <strong>{prize.title || prize.name || `Prize ${index + 1}`}</strong>
                {prize.description ? (
                  <p style={mutedStyle}>{prize.description}</p>
                ) : null}
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {game.winners?.length > 0 ? (
        <section style={cardStyle}>
          <h2 style={sectionTitleStyle}>Winners</h2>
          <div style={prizeGridStyle}>
            {game.winners.map((winner) => (
              <div key={winner.id} style={winnerCardStyle}>
                <strong>{winner.prize_title}</strong>
                <p style={mutedStyle}>
                  Square #{winner.square_number}
                  {winner.customer_name ? ` — ${winner.customer_name}` : ""}
                </p>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section style={layoutStyle}>
        <div style={cardStyle}>
          <h2 style={sectionTitleStyle}>Choose your squares</h2>

          {game.status !== "published" ? (
            <p style={{ color: "#b91c1c", fontWeight: 800 }}>
              This squares game is not currently open.
            </p>
          ) : null}

          <div style={quickPickStyle}>
            <button type="button" onClick={() => quickPick(1)} style={smallButtonStyle}>
              Random 1
            </button>
            <button type="button" onClick={() => quickPick(5)} style={smallButtonStyle}>
              Random 5
            </button>
            <button type="button" onClick={() => quickPick(10)} style={smallButtonStyle}>
              Random 10
            </button>
            <button type="button" onClick={() => setSelectedSquares([])} style={smallButtonStyle}>
              Clear
            </button>
          </div>

          <div style={squareGridStyle}>
            {Array.from({ length: game.totalSquares }, (_, index) => {
              const square = index + 1;
              const isUnavailable = unavailableSquares.has(square);
              const isSelected = selectedSquares.includes(square);

              return (
                <button
                  key={square}
                  type="button"
                  disabled={isUnavailable || game.status !== "published"}
                  onClick={() => toggleSquare(square)}
                  style={{
                    ...squareButtonStyle,
                    ...(isUnavailable ? unavailableSquareStyle : {}),
                    ...(isSelected ? selectedSquareStyle : {}),
                  }}
                >
                  {square}
                </button>
              );
            })}
          </div>
        </div>

        <aside style={cardStyle}>
          <h2 style={sectionTitleStyle}>Your selection</h2>

          <p style={mutedStyle}>
            {selectedSquares.length === 0
              ? "No squares selected yet."
              : selectedSquares.join(", ")}
          </p>

          <label style={labelStyle}>
            Name
            <input
              value={customerName}
              onChange={(event) => setCustomerName(event.target.value)}
              style={inputStyle}
            />
          </label>

          <label style={labelStyle}>
            Email
            <input
              type="email"
              value={customerEmail}
              onChange={(event) => setCustomerEmail(event.target.value)}
              style={inputStyle}
            />
          </label>

          <label style={checkboxStyle}>
            <input
              type="checkbox"
              checked={coverFees}
              onChange={(event) => setCoverFees(event.target.checked)}
            />
            Cover platform fees
          </label>

          <div style={totalBoxStyle}>
            <div>Squares: {selectedSquares.length}</div>
            <div>Subtotal: {money(total, game.currency)}</div>
            {coverFees ? <div>Fees: {money(fee, game.currency)}</div> : null}
            <strong>Total: {money(totalWithFees, game.currency)}</strong>
          </div>

          {error ? (
            <p style={{ color: "#b91c1c", fontWeight: 800 }}>{error}</p>
          ) : null}

          <button
            type="button"
            disabled={busy || selectedSquares.length === 0 || game.status !== "published"}
            onClick={checkout}
            style={{
              ...checkoutButtonStyle,
              opacity:
                busy || selectedSquares.length === 0 || game.status !== "published"
                  ? 0.5
                  : 1,
            }}
          >
            {busy ? "Opening checkout…" : "Checkout"}
          </button>
        </aside>
      </section>
    </main>
  );
}

const pageStyle = {
  maxWidth: 1180,
  margin: "40px auto",
  padding: 24,
  fontFamily:
    'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
};

const linkStyle = {
  color: "#2563eb",
  fontWeight: 800,
  textDecoration: "none",
};

const heroStyle = {
  display: "grid",
  gridTemplateColumns: "1.2fr 0.8fr",
  gap: 24,
  alignItems: "start",
  marginTop: 18,
  marginBottom: 18,
};

const titleStyle = {
  margin: "8px 0",
  fontSize: 42,
  lineHeight: 1.05,
};

const descriptionStyle = {
  color: "#334155",
  fontSize: 17,
  lineHeight: 1.6,
};

const statusStyle = {
  display: "inline-flex",
  borderRadius: 999,
  padding: "6px 12px",
  background: "#dcfce7",
  color: "#166534",
  fontWeight: 900,
  textTransform: "capitalize" as const,
};

const imageStyle = {
  width: "100%",
  maxHeight: 360,
  objectFit: "cover" as const,
  borderRadius: 18,
};

const infoGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
  gap: 12,
  marginTop: 18,
};

const infoCardStyle = {
  border: "1px solid #e5e7eb",
  borderRadius: 16,
  padding: 14,
  background: "#ffffff",
};

const infoLabelStyle = {
  color: "#64748b",
  fontSize: 13,
  fontWeight: 800,
};

const infoValueStyle = {
  fontSize: 22,
  fontWeight: 950,
};

const layoutStyle = {
  display: "grid",
  gridTemplateColumns: "1fr 340px",
  gap: 18,
  alignItems: "start",
};

const cardStyle = {
  border: "1px solid #e5e7eb",
  borderRadius: 18,
  padding: 22,
  background: "#ffffff",
  boxShadow: "0 8px 24px rgba(15, 23, 42, 0.06)",
  marginBottom: 18,
};

const sectionTitleStyle = {
  marginTop: 0,
  color: "#0f172a",
};

const prizeGridStyle = {
  display: "grid",
  gap: 10,
};

const prizeCardStyle = {
  border: "1px solid #e5e7eb",
  borderRadius: 14,
  padding: 14,
  background: "#f8fafc",
};

const winnerCardStyle = {
  border: "1px solid #bbf7d0",
  borderRadius: 14,
  padding: 14,
  background: "#f0fdf4",
};

const quickPickStyle = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap" as const,
  marginBottom: 14,
};

const smallButtonStyle = {
  border: "1px solid #cbd5e1",
  borderRadius: 10,
  padding: "9px 12px",
  background: "#ffffff",
  fontWeight: 900,
  cursor: "pointer",
};

const squareGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(48px, 1fr))",
  gap: 8,
};

const squareButtonStyle = {
  border: "1px solid #cbd5e1",
  borderRadius: 10,
  padding: "10px 6px",
  background: "#ffffff",
  color: "#0f172a",
  fontWeight: 900,
  cursor: "pointer",
};

const unavailableSquareStyle = {
  background: "#e5e7eb",
  color: "#94a3b8",
  cursor: "not-allowed",
};

const selectedSquareStyle = {
  background: "#111827",
  color: "#ffffff",
  borderColor: "#111827",
};

const labelStyle = {
  display: "grid",
  gap: 6,
  fontWeight: 900,
  marginBottom: 12,
};

const inputStyle = {
  width: "100%",
  boxSizing: "border-box" as const,
  border: "1px solid #cbd5e1",
  borderRadius: 12,
  padding: "11px 12px",
  fontSize: 15,
};

const checkboxStyle = {
  display: "flex",
  gap: 8,
  alignItems: "center",
  fontWeight: 800,
  marginBottom: 12,
};

const totalBoxStyle = {
  display: "grid",
  gap: 6,
  border: "1px solid #e5e7eb",
  borderRadius: 14,
  padding: 14,
  background: "#f8fafc",
  marginBottom: 14,
};

const checkoutButtonStyle = {
  width: "100%",
  border: "1px solid #111827",
  borderRadius: 12,
  padding: "13px 18px",
  background: "#111827",
  color: "#ffffff",
  fontWeight: 950,
  cursor: "pointer",
};

const mutedStyle = {
  color: "#64748b",
};
