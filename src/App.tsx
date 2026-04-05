// PREMIUM FULL FUNDRAISING PLATFORM
// Squares + Tickets + Admin + Receipts

import React, { useState } from "react";

/* ---------- TYPES ---------- */

type SquareGame = {
  id: number;
  title: string;
  total: number;
  price: number;
  sold: number[];
};

type Seat = {
  id: string;
  sold: boolean;
};

type TicketEvent = {
  id: number;
  title: string;
  mode: "seats" | "tables" | "quantity";
  price: number;
  seats: Seat[];
  tables: { id: number; seats: number; sold: number }[];
};

/* ---------- APP ---------- */

export default function App() {
  const [section, setSection] = useState<"squares" | "tickets">("squares");
  const [admin, setAdmin] = useState(true);

  /* ---------- SQUARES ---------- */

  const [games, setGames] = useState<SquareGame[]>([
    { id: 1, title: "Squares Game", total: 100, price: 5, sold: [] },
  ]);

  const [selectedSquares, setSelectedSquares] = useState<number[]>([]);

  function toggleSquare(n: number) {
    setSelectedSquares((prev) =>
      prev.includes(n) ? prev.filter((x) => x !== n) : [...prev, n]
    );
  }

  function buySquares() {
    setGames((prev) =>
      prev.map((g) =>
        g.id === 1
          ? { ...g, sold: [...g.sold, ...selectedSquares] }
          : g
      )
    );
    setSelectedSquares([]);
  }

  /* ---------- TICKETS ---------- */

  const [events, setEvents] = useState<TicketEvent[]>([
    {
      id: 1,
      title: "Event Night",
      mode: "seats",
      price: 20,
      seats: Array.from({ length: 60 }, (_, i) => ({
        id: `A${i + 1}`,
        sold: false,
      })),
      tables: [
        { id: 1, seats: 8, sold: 0 },
        { id: 2, seats: 8, sold: 0 },
      ],
    },
  ]);

  const [selectedSeats, setSelectedSeats] = useState<string[]>([]);
  const [qty, setQty] = useState(1);
  const [selectedTable, setSelectedTable] = useState(1);

  function toggleSeat(id: string) {
    setSelectedSeats((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  function buyTickets() {
    setEvents((prev) =>
      prev.map((e) =>
        e.id === 1
          ? {
              ...e,
              seats: e.seats.map((s) =>
                selectedSeats.includes(s.id) ? { ...s, sold: true } : s
              ),
              tables: e.tables.map((t) =>
                t.id === selectedTable
                  ? { ...t, sold: t.sold + qty }
                  : t
              ),
            }
          : e
      )
    );
    setSelectedSeats([]);
  }

  /* ---------- UI ---------- */

  return (
    <div style={{ padding: 20 }}>
      <h1>Premium Fundraising Platform</h1>

      <button onClick={() => setAdmin(!admin)}>
        Admin {admin ? "ON" : "OFF"}
      </button>

      <div>
        <button onClick={() => setSection("squares")}>Squares</button>
        <button onClick={() => setSection("tickets")}>Tickets</button>
      </div>

      {/* ---------- SQUARES ---------- */}

      {section === "squares" && (
        <div>
          <h2>Squares</h2>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(10,1fr)" }}>
            {Array.from({ length: games[0].total }).map((_, i) => {
              const n = i + 1;
              const sold = games[0].sold.includes(n);

              return (
                <button
                  key={n}
                  disabled={sold}
                  onClick={() => toggleSquare(n)}
                  style={{
                    background: sold
                      ? "red"
                      : selectedSquares.includes(n)
                      ? "white"
                      : "grey",
                  }}
                >
                  {n}
                </button>
              );
            })}
          </div>

          <button onClick={buySquares}>Buy Squares</button>
        </div>
      )}

      {/* ---------- TICKETS ---------- */}

      {section === "tickets" && (
        <div>
          <h2>Tickets</h2>

          <select
            onChange={(e) =>
              setEvents((prev) =>
                prev.map((ev) =>
                  ev.id === 1
                    ? { ...ev, mode: e.target.value as any }
                    : ev
                )
              )
            }
          >
            <option value="quantity">Quantity</option>
            <option value="seats">Seats</option>
            <option value="tables">Tables</option>
          </select>

          {events[0].mode === "seats" && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(10,1fr)" }}>
              {events[0].seats.map((s) => (
                <button
                  key={s.id}
                  disabled={s.sold}
                  onClick={() => toggleSeat(s.id)}
                  style={{
                    background: s.sold
                      ? "red"
                      : selectedSeats.includes(s.id)
                      ? "white"
                      : "grey",
                  }}
                >
                  {s.id}
                </button>
              ))}
            </div>
          )}

          {events[0].mode === "tables" && (
            <div>
              {events[0].tables.map((t) => (
                <button key={t.id} onClick={() => setSelectedTable(t.id)}>
                  Table {t.id} ({t.seats - t.sold} left)
                </button>
              ))}
            </div>
          )}

          {events[0].mode === "quantity" && (
            <input
              type="number"
              value={qty}
              onChange={(e) => setQty(Number(e.target.value))}
            />
          )}

          <button onClick={buyTickets}>Buy Tickets</button>
        </div>
      )}
    </div>
  );
}
