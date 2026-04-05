// FINAL VERSION — STABLE + PREMIUM + FULL FEATURES

import React, { useMemo, useRef, useState } from "react";
import { jsPDF } from "jspdf";

/* =========================
   TYPES
========================= */
type Game = {
  id: number;
  title: string;
  total: number;
  price: number;
  background?: string;
  sold: number[];
};

type Table = {
  id: number;
  name: string;
  seats: number;
  sold: number;
};

type TicketEvent = {
  id: number;
  title: string;
  price: number;
  mode: "quantity" | "seats" | "tables";
  rows: number;
  seatsPerRow: number;
  soldSeats: string[];
  tables: Table[];
};

type Purchase = {
  id: number;
  type: string;
  title: string;
  buyer: string;
  email: string;
  details: string[];
  total: number;
};

/* =========================
   HELPERS
========================= */
const money = (n: number) => `£${n.toFixed(2)}`;

function exportPDF(title: string, buyer: string, email: string, lines: string[], total: number) {
  const doc = new jsPDF();
  doc.text("Receipt", 20, 20);
  doc.text(title, 20, 30);
  doc.text(buyer, 20, 40);
  doc.text(email, 20, 50);

  let y = 65;
  lines.forEach(l => {
    doc.text(l, 20, y);
    y += 10;
  });

  doc.text(`Total: ${money(total)}`, 20, y + 10);
  doc.save("receipt.pdf");
}

/* =========================
   APP
========================= */
export default function App() {

  /* =========================
     GLOBAL
  ========================= */
  const [admin, setAdmin] = useState(true);
  const [section, setSection] = useState<"squares" | "tickets">("squares");

  const [buyerName, setBuyerName] = useState("");
  const [buyerEmail, setBuyerEmail] = useState("");

  const [purchases, setPurchases] = useState<Purchase[]>([]);

  /* =========================
     SQUARES
  ========================= */
  const [games, setGames] = useState<Game[]>([
    { id: 1, title: "Squares 1", total: 100, price: 5, sold: [] }
  ]);

  const [activeGame, setActiveGame] = useState(1);
  const [selectedSquares, setSelectedSquares] = useState<number[]>([]);

  const game = games.find(g => g.id === activeGame)!;

  function toggleSquare(n: number) {
    if (game.sold.includes(n)) return;
    setSelectedSquares(s =>
      s.includes(n) ? s.filter(x => x !== n) : [...s, n]
    );
  }

  function buySquares() {
    if (!buyerName || !buyerEmail || selectedSquares.length === 0) return;

    const total = selectedSquares.length * game.price;

    const lines = selectedSquares.map(n => `Square ${n}`);

    setPurchases(p => [{
      id: Date.now(),
      type: "Squares",
      title: game.title,
      buyer: buyerName,
      email: buyerEmail,
      details: lines,
      total
    }, ...p]);

    setGames(g =>
      g.map(x =>
        x.id === game.id
          ? { ...x, sold: [...x.sold, ...selectedSquares] }
          : x
      )
    );

    exportPDF(game.title, buyerName, buyerEmail, lines, total);
    setSelectedSquares([]);
  }

  function addGame() {
    setGames(g => [...g, {
      id: Date.now(),
      title: "New Game",
      total: 100,
      price: 5,
      sold: []
    }]);
  }

  /* =========================
     TICKETS
  ========================= */
  const [events, setEvents] = useState<TicketEvent[]>([
    {
      id: 1,
      title: "Event 1",
      price: 10,
      mode: "seats",
      rows: 5,
      seatsPerRow: 10,
      soldSeats: [],
      tables: []
    }
  ]);

  const [activeEvent, setActiveEvent] = useState(1);
  const [selectedSeats, setSelectedSeats] = useState<string[]>([]);
  const [qty, setQty] = useState("1");
  const [selectedTable, setSelectedTable] = useState<number | null>(null);

  const event = events.find(e => e.id === activeEvent)!;

  function toggleSeat(id: string) {
    if (event.soldSeats.includes(id)) return;
    setSelectedSeats(s =>
      s.includes(id) ? s.filter(x => x !== id) : [...s, id]
    );
  }

  function buyTickets() {
    if (!buyerName || !buyerEmail) return;

    let lines: string[] = [];
    let total = 0;

    if (event.mode === "seats") {
      lines = selectedSeats;
      total = selectedSeats.length * event.price;

      setEvents(e =>
        e.map(x =>
          x.id === event.id
            ? { ...x, soldSeats: [...x.soldSeats, ...selectedSeats] }
            : x
        )
      );
    } else {
      total = Number(qty) * event.price;
      lines = [`Qty ${qty}`];
    }

    setPurchases(p => [{
      id: Date.now(),
      type: "Tickets",
      title: event.title,
      buyer: buyerName,
      email: buyerEmail,
      details: lines,
      total
    }, ...p]);

    exportPDF(event.title, buyerName, buyerEmail, lines, total);
    setSelectedSeats([]);
  }

  function addEvent() {
    setEvents(e => [...e, {
      id: Date.now(),
      title: "New Event",
      price: 10,
      mode: "quantity",
      rows: 5,
      seatsPerRow: 10,
      soldSeats: [],
      tables: []
    }]);
  }

  /* =========================
     UI
  ========================= */
  return (
    <div style={{ padding: 20, background: "#020617", color: "white", minHeight: "100vh" }}>

      <h1>SO Fundraising Platform</h1>

      <button onClick={() => setAdmin(a => !a)}>
        Admin {admin ? "ON" : "OFF"}
      </button>

      {/* ADMIN */}
      {admin && (
        <div>
          <h2>Admin</h2>

          <button onClick={() => setSection("squares")}>Squares</button>
          <button onClick={() => setSection("tickets")}>Tickets</button>

          <h3>Data</h3>
          {purchases.map(p => (
            <div key={p.id}>
              {p.buyer} - {money(p.total)}
            </div>
          ))}

          {section === "squares" && (
            <button onClick={addGame}>Add Game</button>
          )}

          {section === "tickets" && (
            <button onClick={addEvent}>Add Event</button>
          )}
        </div>
      )}

      {/* BUYER */}
      <div>
        <input placeholder="Name" value={buyerName} onChange={e => setBuyerName(e.target.value)} />
        <input placeholder="Email" value={buyerEmail} onChange={e => setBuyerEmail(e.target.value)} />
      </div>

      {/* SQUARES */}
      {section === "squares" && (
        <div>
          <h2>{game.title}</h2>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(10,1fr)" }}>
            {Array.from({ length: game.total }).map((_, i) => {
              const n = i + 1;
              return (
                <button key={n} onClick={() => toggleSquare(n)}>
                  {n}
                </button>
              );
            })}
          </div>

          <button onClick={buySquares}>Buy Squares</button>
        </div>
      )}

      {/* TICKETS */}
      {section === "tickets" && (
        <div>
          <h2>{event.title}</h2>

          {event.mode === "seats" && (
            <div style={{ display: "grid", gridTemplateColumns: `repeat(${event.seatsPerRow},1fr)` }}>
              {Array.from({ length: event.rows * event.seatsPerRow }).map((_, i) => {
                const row = String.fromCharCode(65 + Math.floor(i / event.seatsPerRow));
                const num = (i % event.seatsPerRow) + 1;
                const id = `${row}${num}`;
                return <button key={id} onClick={() => toggleSeat(id)}>{id}</button>;
              })}
            </div>
          )}

          <button onClick={buyTickets}>Buy Tickets</button>
        </div>
      )}

    </div>
  );
}
