import React, { useState } from "react";
import SquaresApp from "./SquaresApp"; // ⬅️ your EXACT code goes here

/* ---------- TICKETS TYPES ---------- */

type Seat = { id: string; sold: boolean };

type EventType = {
  id: number;
  title: string;
  price: number;
  mode: "seats" | "tables" | "quantity";
  seats: Seat[];
  tables: { id: number; seats: number; sold: number }[];
};

/* ---------- MAIN APP ---------- */

export default function App() {
  const [section, setSection] = useState<"squares" | "tickets">("squares");

  return (
    <div style={{ padding: 20 }}>
      <h1 style={{ color: "white" }}>SO Fundraising Platform</h1>

      <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
        <button onClick={() => setSection("squares")}>Squares</button>
        <button onClick={() => setSection("tickets")}>Tickets</button>
      </div>

      {section === "squares" && <SquaresApp />}
      {section === "tickets" && <Tickets />}
    </div>
  );
}

/* ---------- TICKETS COMPONENT ---------- */

function Tickets() {
  const [events, setEvents] = useState<EventType[]>([
    {
      id: 1,
      title: "Charity Event",
      price: 20,
      mode: "seats",
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

  const event = events[0];

  function toggleSeat(id: string) {
    setSelectedSeats((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  function buyTickets() {
    setEvents((prev) =>
      prev.map((e) =>
        e.id === event.id
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

  return (
    <div style={{ color: "white" }}>
      <h2>Tickets</h2>

      {/* MODE SWITCH */}
      <select
        value={event.mode}
        onChange={(e) =>
          setEvents((prev) =>
            prev.map((ev) =>
              ev.id === event.id
                ? { ...ev, mode: e.target.value as any }
                : ev
            )
          )
        }
      >
        <option value="seats">Seats</option>
        <option value="tables">Tables</option>
        <option value="quantity">Quantity</option>
      </select>

      {/* SEATS MODE */}
      {event.mode === "seats" && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(10,1fr)",
            gap: 8,
            marginTop: 20,
          }}
        >
          {event.seats.map((s) => (
            <button
              key={s.id}
              disabled={s.sold}
              onClick={() => toggleSeat(s.id)}
              style={{
                padding: 10,
                background: s.sold
                  ? "red"
                  : selectedSeats.includes(s.id)
                  ? "white"
                  : "#222",
                color: selectedSeats.includes(s.id) ? "black" : "white",
              }}
            >
              {s.id}
            </button>
          ))}
        </div>
      )}

      {/* TABLES MODE */}
      {event.mode === "tables" && (
        <div style={{ marginTop: 20 }}>
          {event.tables.map((t) => (
            <button
              key={t.id}
              onClick={() => setSelectedTable(t.id)}
              style={{
                marginRight: 10,
                padding: 10,
              }}
            >
              Table {t.id} ({t.seats - t.sold} left)
            </button>
          ))}
        </div>
      )}

      {/* QUANTITY MODE */}
      {event.mode === "quantity" && (
        <input
          type="number"
          value={qty}
          onChange={(e) => setQty(Number(e.target.value))}
          style={{ marginTop: 20 }}
        />
      )}

      <button onClick={buyTickets} style={{ marginTop: 20 }}>
        Buy Tickets
      </button>
    </div>
  );
}
