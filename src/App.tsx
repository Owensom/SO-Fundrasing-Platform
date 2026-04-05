import React, { useMemo, useRef, useState } from "react";
import { jsPDF } from "jspdf";

/* ================= TYPES ================= */

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
  price: number;
  mode: TicketMode;
  rows: number;
  seatsPerRow: number;
  soldSeatIds: string[];
  tables: TicketTable[];
};

/* ================= HELPERS ================= */

function money(n: number) {
  return `£${n.toFixed(2)}`;
}

function seatIdForIndex(i: number, perRow: number) {
  const row = String.fromCharCode(65 + Math.floor(i / perRow));
  const num = (i % perRow) + 1;
  return `${row}${num}`;
}

function cardStyle(): React.CSSProperties {
  return {
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(255,255,255,0.07)",
    backdropFilter: "blur(18px)",
    borderRadius: 28,
    padding: 24,
    boxShadow: "0 20px 80px rgba(2,6,23,0.45)",
  };
}

function chip(active: boolean): React.CSSProperties {
  return {
    border: active ? "1px solid rgba(125,211,252,0.4)" : "1px solid rgba(255,255,255,0.1)",
    background: active ? "rgba(255,255,255,0.15)" : "rgba(255,255,255,0.05)",
    color: "white",
    padding: "10px 16px",
    borderRadius: 18,
    cursor: "pointer",
    fontWeight: 600,
  };
}

/* ================= APP ================= */

export default function App() {
  const [section, setSection] = useState<Section>("squares");
  const [admin, setAdmin] = useState(true);

  const [buyerName, setBuyerName] = useState("");
  const [buyerEmail, setBuyerEmail] = useState("");

  /* ===== SQUARES ===== */

  const [game, setGame] = useState<Game>({
    id: 1,
    title: "Super Bowl Squares",
    total: 100,
    price: 10,
    sold: [],
    reserved: [],
  });

  const [selectedSquares, setSelectedSquares] = useState<number[]>([]);

  const visibleSquares = selectedSquares.filter(
    (n) => !game.sold.includes(n) && !game.reserved.includes(n)
  );

  const squaresTotal = visibleSquares.length * game.price;

  function toggleSquare(n: number) {
    if (game.sold.includes(n)) return;
    setSelectedSquares((prev) =>
      prev.includes(n) ? prev.filter((x) => x !== n) : [...prev, n]
    );
  }

  function buySquares() {
    if (!buyerName || !buyerEmail || visibleSquares.length === 0) return;

    setGame((g) => ({
      ...g,
      sold: [...g.sold, ...visibleSquares],
    }));

    setSelectedSquares([]);

    const doc = new jsPDF();
    doc.text("Squares Receipt", 20, 20);
    doc.text(`Buyer: ${buyerName}`, 20, 30);
    doc.text(`Squares: ${visibleSquares.join(", ")}`, 20, 40);
    doc.text(`Total: ${money(squaresTotal)}`, 20, 50);
    doc.save("squares.pdf");
  }

  /* ===== TICKETS ===== */

  const [event, setEvent] = useState<TicketEvent>({
    id: 1,
    title: "Summer Gala",
    price: 35,
    mode: "seats",
    rows: 5,
    seatsPerRow: 10,
    soldSeatIds: [],
    tables: [
      { id: 1, name: "Table A", seats: 8, sold: 0 },
      { id: 2, name: "Table B", seats: 8, sold: 4 },
    ],
  });

  const [selectedSeats, setSelectedSeats] = useState<string[]>([]);
  const [selectedTable, setSelectedTable] = useState<number>(1);
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
    if (!buyerName || !buyerEmail) return;

    if (event.mode === "seats") {
      setEvent((e) => ({
        ...e,
        soldSeatIds: [...e.soldSeatIds, ...selectedSeats],
      }));
      setSelectedSeats([]);
    }

    const doc = new jsPDF();
    doc.text("Ticket Receipt", 20, 20);
    doc.text(`Buyer: ${buyerName}`, 20, 30);
    doc.text(`Total: ${money(ticketTotal)}`, 20, 40);
    doc.save("tickets.pdf");
  }

  /* ================= UI ================= */

  return (
    <div
      style={{
        minHeight: "100vh",
        background:
          "linear-gradient(180deg,#020617,#0f172a,#020617)",
        color: "white",
        padding: 24,
      }}
    >
      <div style={{ maxWidth: 1100, margin: "0 auto", display: "grid", gap: 20 }}>
        
        {/* HEADER */}
        <div style={cardStyle()}>
          <h1>SO Fundraising Platform</h1>
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={() => setSection("squares")} style={chip(section==="squares")}>Squares</button>
            <button onClick={() => setSection("tickets")} style={chip(section==="tickets")}>Tickets</button>
            <button onClick={() => setAdmin(!admin)} style={chip(admin)}>Admin</button>
          </div>
        </div>

        {/* BUYER */}
        <div style={cardStyle()}>
          <input placeholder="Name" value={buyerName} onChange={e=>setBuyerName(e.target.value)} />
          <input placeholder="Email" value={buyerEmail} onChange={e=>setBuyerEmail(e.target.value)} />
        </div>

        {/* SQUARES */}
        {section==="squares" && (
          <div style={cardStyle()}>
            <h2>{game.title}</h2>

            <div style={{display:"grid",gridTemplateColumns:"repeat(10,1fr)",gap:6}}>
              {Array.from({length:game.total}).map((_,i)=>{
                const n=i+1;
                const sold=game.sold.includes(n);
                const sel=visibleSquares.includes(n);

                return (
                  <button key={n}
                    onClick={()=>toggleSquare(n)}
                    style={{
                      padding:10,
                      background: sold?"red": sel?"white":"#1e293b",
                      color: sel?"black":"white"
                    }}>
                    {n}
                  </button>
                )
              })}
            </div>

            <button onClick={buySquares}>Buy (£{squaresTotal})</button>
          </div>
        )}

        {/* TICKETS */}
        {section==="tickets" && (
          <div style={cardStyle()}>
            <h2>{event.title}</h2>

            {event.mode==="seats" && (
              <div style={{
                display:"grid",
                gridTemplateColumns:`repeat(${event.seatsPerRow},1fr)`,
                gap:6
              }}>
                {Array.from({length:event.rows*event.seatsPerRow}).map((_,i)=>{
                  const id=seatIdForIndex(i,event.seatsPerRow);
                  const sold=event.soldSeatIds.includes(id);
                  const sel=selectedSeats.includes(id);

                  return (
                    <button key={id}
                      onClick={()=>toggleSeat(id)}
                      style={{
                        padding:10,
                        background: sold?"red": sel?"white":"#1e293b",
                        color: sel?"black":"white"
                      }}>
                      {id}
                    </button>
                  )
                })}
              </div>
            )}

            {event.mode==="tables" && (
              <div style={{display:"flex",gap:10}}>
                {event.tables.map(t=>(
                  <button key={t.id}
                    onClick={()=>setSelectedTable(t.id)}
                    style={chip(selectedTable===t.id)}>
                    {t.name} ({t.seats - t.sold})
                  </button>
                ))}
              </div>
            )}

            {event.mode!=="seats" && (
              <input type="number" value={quantity} onChange={e=>setQuantity(Number(e.target.value))}/>
            )}

            <button onClick={buyTickets}>
              Buy Tickets (£{ticketTotal})
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
