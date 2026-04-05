// FULL WORKING VERSION (Squares + Tickets)

import React, { useMemo, useRef, useState } from "react";
import { jsPDF } from "jspdf";

/* ---------- TYPES ---------- */

type Section = "squares" | "tickets";

type Game = {
  id: number;
  title: string;
  total: number;
  price: number;
  background?: string;
  sold: number[];
  reserved: number[];
};

type Purchase = {
  id: number;
  gameId: number;
  gameTitle: string;
  buyerName: string;
  buyerEmail: string;
  squares: number[];
  total: number;
  createdAt: string;
};

type TicketMode = "seats" | "tables" | "quantity";

type TicketEvent = {
  id: number;
  title: string;
  price: number;
  mode: TicketMode;
  rows: number;
  seatsPerRow: number;
  soldSeatIds: string[];
  tables: { id: number; name: string; seats: number; sold: number }[];
};

/* ---------- HELPERS ---------- */

const money = (n: number) => `£${n.toFixed(2)}`;

const seatId = (i: number, perRow: number) =>
  `${String.fromCharCode(65 + Math.floor(i / perRow))}${(i % perRow) + 1}`;

const card = {
  border: "1px solid rgba(255,255,255,0.1)",
  background: "rgba(255,255,255,0.05)",
  borderRadius: 20,
  padding: 20,
};

/* ---------- APP ---------- */

export default function App() {
  const [section, setSection] = useState<Section>("squares");
  const [admin, setAdmin] = useState(true);

  const [buyerName, setBuyerName] = useState("");
  const [buyerEmail, setBuyerEmail] = useState("");

  /* ---------- SQUARES ---------- */

  const [games, setGames] = useState<Game[]>([
    { id: 1, title: "Squares Game", total: 100, price: 5, sold: [], reserved: [] },
  ]);

  const [activeGameId, setActiveGameId] = useState(1);
  const [selected, setSelected] = useState<number[]>([]);

  const game = games.find((g) => g.id === activeGameId)!;

  const toggleSquare = (n: number) => {
    if (game.sold.includes(n)) return;
    setSelected((prev) =>
      prev.includes(n) ? prev.filter((x) => x !== n) : [...prev, n]
    );
  };

  const buySquares = () => {
    setGames((g) =>
      g.map((x) =>
        x.id === game.id
          ? { ...x, sold: [...x.sold, ...selected] }
          : x
      )
    );
    setSelected([]);
  };

  /* ---------- TICKETS ---------- */

  const [events, setEvents] = useState<TicketEvent[]>([
    {
      id: 1,
      title: "Event",
      price: 20,
      mode: "seats",
      rows: 5,
      seatsPerRow: 10,
      soldSeatIds: [],
      tables: [],
    },
  ]);

  const [activeEventId, setActiveEventId] = useState(1);
  const [selectedSeats, setSelectedSeats] = useState<string[]>([]);
  const [qty, setQty] = useState(1);

  const event = events.find((e) => e.id === activeEventId)!;

  const toggleSeat = (id: string) => {
    if (event.soldSeatIds.includes(id)) return;
    setSelectedSeats((s) =>
      s.includes(id) ? s.filter((x) => x !== id) : [...s, id]
    );
  };

  const buyTickets = () => {
    setEvents((ev) =>
      ev.map((e) =>
        e.id === event.id
          ? {
              ...e,
              soldSeatIds: [...e.soldSeatIds, ...selectedSeats],
            }
          : e
      )
    );

    const doc = new jsPDF();
    doc.text("Ticket Receipt", 20, 20);
    doc.text(`Name: ${buyerName}`, 20, 30);
    doc.text(`Seats: ${selectedSeats.join(", ")}`, 20, 40);
    doc.save("ticket.pdf");

    setSelectedSeats([]);
  };

  /* ---------- UI ---------- */

  return (
    <div style={{ padding: 20, color: "white" }}>
      <h1>SO Fundraising Platform</h1>

      <div style={{ display: "flex", gap: 10 }}>
        <button onClick={() => setSection("squares")}>Squares</button>
        <button onClick={() => setSection("tickets")}>Tickets</button>
        <button onClick={() => setAdmin((a) => !a)}>
          Admin {admin ? "ON" : "OFF"}
        </button>
      </div>

      <div style={card}>
        <input
          placeholder="Name"
          value={buyerName}
          onChange={(e) => setBuyerName(e.target.value)}
        />
        <input
          placeholder="Email"
          value={buyerEmail}
          onChange={(e) => setBuyerEmail(e.target.value)}
        />
      </div>

      {/* ---------- SQUARES ---------- */}

      {section === "squares" && (
        <div style={card}>
          <h2>{game.title}</h2>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(10,1fr)", gap: 5 }}>
            {Array.from({ length: game.total }).map((_, i) => {
              const n = i + 1;
              return (
                <button
                  key={n}
                  onClick={() => toggleSquare(n)}
                  disabled={game.sold.includes(n)}
                  style={{
                    background: game.sold.includes(n)
                      ? "red"
                      : selected.includes(n)
                      ? "white"
                      : "#333",
                    color: selected.includes(n) ? "black" : "white",
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
        <div style={card}>
          <h2>{event.title}</h2>

          {event.mode === "seats" && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(10,1fr)", gap: 5 }}>
              {Array.from({ length: event.rows * event.seatsPerRow }).map((_, i) => {
                const id = seatId(i, event.seatsPerRow);
                return (
                  <button
                    key={id}
                    onClick={() => toggleSeat(id)}
                    disabled={event.soldSeatIds.includes(id)}
                  >
                    {id}
                  </button>
                );
              })}
            </div>
          )}

          <button onClick={buyTickets}>Buy Tickets</button>
        </div>
      )}
    </div>
  );
}
