import React, { useState } from "react";
import { jsPDF } from "jspdf";

type TicketMode = "seats" | "tables" | "quantity";

type TicketTable = {
  id: number;
  name: string;
  seats: number;
  sold: number;
};

type TicketEvent = {
  id: number;
  title: string;
  eventName: string;
  venue: string;
  price: number;
  mode: TicketMode;
  rows: number;
  seatsPerRow: number;
  soldSeatIds: string[];
  tables: TicketTable[];
};

function money(n: number) {
  return `£${n.toFixed(2)}`;
}

function seatIdForIndex(index: number, seatsPerRow: number): string {
  const row = String.fromCharCode(65 + Math.floor(index / seatsPerRow));
  const num = (index % seatsPerRow) + 1;
  return `${row}${num}`;
}

function cardStyle(): React.CSSProperties {
  return {
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(255,255,255,0.07)",
    backdropFilter: "blur(18px)",
    borderRadius: 28,
    padding: 24,
  };
}

function inputStyle(): React.CSSProperties {
  return {
    width: "100%",
    padding: "14px",
    borderRadius: 18,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(2,6,23,0.7)",
    color: "white",
  };
}

function chip(active: boolean): React.CSSProperties {
  return {
    border: active ? "1px solid white" : "1px solid rgba(255,255,255,0.1)",
    background: active ? "white" : "rgba(255,255,255,0.05)",
    color: active ? "black" : "white",
    padding: "10px 14px",
    borderRadius: 18,
    cursor: "pointer",
  };
}

export default function App() {
  const [admin, setAdmin] = useState(true);
  const [buyerName, setBuyerName] = useState("");
  const [buyerEmail, setBuyerEmail] = useState("");

  const [event, setEvent] = useState<TicketEvent>({
    id: 1,
    title: "Summer Gala",
    eventName: "Summer Gala",
    venue: "Town Hall",
    price: 35,
    mode: "seats",
    rows: 5,
    seatsPerRow: 10,
    soldSeatIds: ["A1", "A2"],
    tables: [
      { id: 1, name: "Table A", seats: 8, sold: 3 },
      { id: 2, name: "Table B", seats: 10, sold: 5 },
    ],
  });

  const [selectedSeats, setSelectedSeats] = useState<string[]>([]);
  const [selectedTable, setSelectedTable] = useState(1);
  const [quantity, setQuantity] = useState(1);

  const ticketTotal =
    event.mode === "seats"
      ? selectedSeats.length * event.price
      : quantity * event.price;

  function toggleSeat(id: string) {
    if (event.soldSeatIds.includes(id)) return;
    setSelectedSeats((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  function buyTickets() {
    const doc = new jsPDF();
    doc.text("Ticket Receipt", 20, 20);
    doc.text(`Name: ${buyerName}`, 20, 30);
    doc.text(`Total: ${money(ticketTotal)}`, 20, 40);
    doc.save("ticket.pdf");
  }

  return (
    <div style={{ padding: 20, color: "white", background: "#020617" }}>
      <h1>Tickets Test</h1>

      <button onClick={() => setAdmin(!admin)}>
        Admin {admin ? "ON" : "OFF"}
      </button>

      <div style={cardStyle()}>
        <input
          placeholder="Name"
          value={buyerName}
          onChange={(e) => setBuyerName(e.target.value)}
          style={inputStyle()}
        />
        <input
          placeholder="Email"
          value={buyerEmail}
          onChange={(e) => setBuyerEmail(e.target.value)}
          style={inputStyle()}
        />
      </div>

      {admin && (
        <div style={cardStyle()}>
          <h2>Admin</h2>
          <input
            value={event.title}
            onChange={(e) =>
              setEvent({ ...event, title: e.target.value })
            }
            style={inputStyle()}
          />
        </div>
      )}

      <div style={cardStyle()}>
        <h2>{event.title}</h2>

        {event.mode === "seats" && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(10,1fr)" }}>
            {Array.from({ length: event.rows * event.seatsPerRow }).map((_, i) => {
              const id = seatIdForIndex(i, event.seatsPerRow);
              return (
                <button key={id} onClick={() => toggleSeat(id)}>
                  {id}
                </button>
              );
            })}
          </div>
        )}

        {event.mode === "tables" && (
          <div>
            {event.tables.map((t) => (
              <button key={t.id} onClick={() => setSelectedTable(t.id)}>
                {t.name}
              </button>
            ))}
          </div>
        )}

        {event.mode !== "seats" && (
          <input
            type="number"
            value={quantity}
            onChange={(e) => setQuantity(Number(e.target.value))}
          />
        )}

        <button onClick={buyTickets}>
          Buy (£{ticketTotal})
        </button>
      </div>
    </div>
  );
}
