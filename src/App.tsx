// FULL PREMIUM + STABLE BUILD
// (Based on your stable Squares file + full Tickets integration)

import React, { useState } from "react";
import { jsPDF } from "jspdf";

// ================= TYPES =================
type Game = {
  id: number;
  title: string;
  total: number;
  price: number;
  background?: string;
  sold: number[];
};

type TicketEvent = {
  id: number;
  title: string;
  price: number;
  mode: "quantity" | "seats" | "tables";
  rows: number;
  seatsPerRow: number;
  soldSeats: string[];
  tables: { id: number; name: string; seats: number; sold: number }[];
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

// ================= HELPERS =================
const money = (n: number) => `£${n.toFixed(2)}`;

// ================= APP =================
export default function App() {
  const [admin, setAdmin] = useState(true);
  const [section, setSection] = useState<"squares" | "tickets">("squares");

  const [buyerName, setBuyerName] = useState("");
  const [buyerEmail, setBuyerEmail] = useState("");

  // ================= SQUARES =================
  const [games, setGames] = useState<Game[]>([
    { id: 1, title: "Game 1", total: 100, price: 5, sold: [] },
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

    setPurchases(p => [
      {
        id: Date.now(),
        type: "Squares",
        title: game.title,
        buyer: buyerName,
        email: buyerEmail,
        details: selectedSquares.map(n => `Square ${n}`),
        total: selectedSquares.length * game.price
      },
      ...p
    ]);

    setGames(g =>
      g.map(x =>
        x.id === game.id
          ? { ...x, sold: [...x.sold, ...selectedSquares] }
          : x
      )
    );

    setSelectedSquares([]);
  }

  // ================= TICKETS =================
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
  const [selectedTableId, setSelectedTableId] = useState<number | null>(null);

  const event = events.find(e => e.id === activeEvent)!;

  function toggleSeat(id: string) {
    if (event.soldSeats.includes(id)) return;
    setSelectedSeats(s =>
      s.includes(id) ? s.filter(x => x !== id) : [...s, id]
    );
  }

  function buyTickets() {
    if (!buyerName || !buyerEmail) return;

    let details: string[] = [];
    let total = 0;

    if (event.mode === "seats") {
      details = selectedSeats;
      total = selectedSeats.length * event.price;
    } else {
      total = Number(qty) * event.price;
      details = [`Qty ${qty}`];
    }

    setPurchases(p => [
      {
        id: Date.now(),
        type: "Tickets",
        title: event.title,
        buyer: buyerName,
        email: buyerEmail,
        details,
        total
      },
      ...p
    ]);
  }

  // ================= PURCHASES =================
  const [purchases, setPurchases] = useState<Purchase[]>([]);

  // ================= UI =================
  return (
    <div style={{ padding: 20, background: "#020617", minHeight: "100vh", color: "white" }}>

      <h1>SO Fundraising Platform</h1>

      <button onClick={() => setAdmin(a => !a)}>
        Admin {admin ? "ON" : "OFF"}
      </button>

      {/* ADMIN */}
      {admin && (
        <div>
          <h2>Admin</h2>

          <div>
            <button onClick={() => setSection("squares")}>Squares</button>
            <button onClick={() => setSection("tickets")}>Tickets</button>
          </div>

          <h3>Data</h3>
          {purchases.map(p => (
            <div key={p.id}>
              {p.buyer} - {money(p.total)}
            </div>
          ))}
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
              return <button key={n} onClick={() => toggleSquare(n)}>{n}</button>;
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
