"use client";

import { useMemo, useState } from "react";

type Prize = {
  title: string;
  description?: string;
  imageUrl?: string;
};

type SquaresGame = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  image_url: string | null;
  status: string;
  currency: string | null;
  price_per_square_cents: number;
  total_squares: number;
  config_json: {
    prizes?: Prize[];
    sold?: number[];
    reserved?: number[];
  } | null;
};

export default function SquaresGameClient({ game }: { game: SquaresGame }) {
  const [selected, setSelected] = useState<number[]>([]);

  const sold = useMemo(() => new Set(game.config_json?.sold ?? []), [game]);
  const reserved = useMemo(
    () => new Set(game.config_json?.reserved ?? []),
    [game],
  );

  const squares = useMemo(
    () => Array.from({ length: game.total_squares }, (_, i) => i + 1),
    [game.total_squares],
  );

  const currency = game.currency ?? "GBP";
  const total = selected.length * game.price_per_square_cents;

  function toggleSquare(n: number) {
    if (sold.has(n) || reserved.has(n)) return;

    setSelected((prev) =>
      prev.includes(n) ? prev.filter((x) => x !== n) : [...prev, n],
    );
  }

  function autoPick(count: number) {
    const unavailable = new Set([...Array.from(sold), ...Array.from(reserved)]);
    const available: number[] = [];

    for (let i = 1; i <= game.total_squares; i++) {
      if (!unavailable.has(i)) available.push(i);
    }

    const shuffled = [...available].sort(() => Math.random() - 0.5);
    setSelected(shuffled.slice(0, count));
  }

  return (
    <main style={{ maxWidth: 1000, margin: "40px auto", padding: 24 }}>
      <h1>{game.title}</h1>

      {game.image_url && (
        <img
          src={game.image_url}
          alt=""
          style={{
            width: "100%",
            maxHeight: 420,
            objectFit: "cover",
            borderRadius: 12,
            marginBottom: 20,
          }}
        />
      )}

      {game.description && <p>{game.description}</p>}

      <h2>Prizes</h2>

      {(game.config_json?.prizes ?? []).length > 0 ? (
        <ul>
          {(game.config_json?.prizes ?? []).map((prize, index) => (
            <li key={index}>
              <strong>{prize.title}</strong>
              {prize.description && <div>{prize.description}</div>}
            </li>
          ))}
        </ul>
      ) : (
        <p>No prizes configured yet.</p>
      )}

      <section
        style={{
          marginTop: 24,
          padding: 16,
          border: "1px solid #ddd",
          borderRadius: 12,
        }}
      >
        <h2>Pick your squares</h2>

        <p>
          Price per square:{" "}
          <strong>
            {(game.price_per_square_cents / 100).toFixed(2)} {currency}
          </strong>
        </p>

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <button type="button" onClick={() => autoPick(1)}>
            Auto pick 1
          </button>

          <button type="button" onClick={() => autoPick(5)}>
            Auto pick 5
          </button>

          <button type="button" onClick={() => autoPick(10)}>
            Auto pick 10
          </button>

          <button type="button" onClick={() => setSelected([])}>
            Clear
          </button>
        </div>

        <div style={{ marginTop: 16 }}>
          <strong>Selected:</strong>{" "}
          {selected.length > 0 ? selected.join(", ") : "None"}
        </div>

        <div>
          <strong>Total:</strong> {(total / 100).toFixed(2)} {currency}
        </div>
      </section>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(44px, 1fr))",
          gap: 6,
          marginTop: 24,
        }}
      >
        {squares.map((n) => {
          const isSold = sold.has(n);
          const isReserved = reserved.has(n);
          const isSelected = selected.includes(n);

          let background = "#f3f4f6";
          let color = "#111";

          if (isSold) {
            background = "#111";
            color = "#fff";
          } else if (isReserved) {
            background = "#f59e0b";
          } else if (isSelected) {
            background = "#2563eb";
            color = "#fff";
          }

          return (
            <button
              key={n}
              type="button"
              disabled={isSold || isReserved}
              onClick={() => toggleSquare(n)}
              style={{
                aspectRatio: "1",
                borderRadius: 6,
                border: "1px solid #ddd",
                cursor: isSold || isReserved ? "not-allowed" : "pointer",
                background,
                color,
                fontSize: 12,
              }}
            >
              {n}
            </button>
          );
        })}
      </div>
    </main>
  );
}
