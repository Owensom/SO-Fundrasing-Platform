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

type Drafts = Record<number, { total: string; price: string }>;

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

type TicketPurchase = {
  id: number;
  eventId: number;
  eventTitle: string;
  buyerName: string;
  buyerEmail: string;
  mode: TicketMode;
  seats: string[];
  tableName?: string;
  quantity: number;
  total: number;
  createdAt: string;
};

type TicketDrafts = Record<number, { price: string; rows: string; seatsPerRow: string }>;

/* ---------- HELPERS ---------- */

function clampSquares(n: number) {
  return Math.max(1, Math.min(500, Number.isFinite(n) ? Math.floor(n) : 1));
}

function clampPrice(n: number) {
  return Math.max(1, Number.isFinite(n) ? n : 1);
}

function money(n: number) {
  return `£${n.toFixed(2)}`;
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

function inputStyle(invalid = false): React.CSSProperties {
  return {
    width: "100%",
    padding: "14px 16px",
    borderRadius: 18,
    border: invalid
      ? "1px solid rgba(251,113,133,0.45)"
      : "1px solid rgba(255,255,255,0.10)",
    background: invalid ? "rgba(127,29,29,0.18)" : "rgba(2,6,23,0.72)",
    color: "white",
    boxSizing: "border-box",
  };
}

function labelStyle(): React.CSSProperties {
  return {
    display: "block",
    marginBottom: 8,
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: "0.14em",
    color: "#94a3b8",
  };
}

function chipStyle(active: boolean): React.CSSProperties {
  return {
    border: active
      ? "1px solid rgba(125,211,252,0.35)"
      : "1px solid rgba(255,255,255,0.10)",
    background: active
      ? "rgba(255,255,255,0.12)"
      : "rgba(255,255,255,0.04)",
    color: "white",
    borderRadius: 18,
    padding: "12px 18px",
    fontWeight: 600,
    cursor: "pointer",
  };
}

function seatIdForIndex(index: number, seatsPerRow: number): string {
  const row = String.fromCharCode(65 + Math.floor(index / seatsPerRow));
  const num = (index % seatsPerRow) + 1;
  return `${row}${num}`;
}

/* ---------- MAIN APP ---------- */

export default function App() {
  const [section, setSection] = useState<Section>("squares");

  const [admin, setAdmin] = useState(true);
  const [buyerName, setBuyerName] = useState("");
  const [buyerEmail, setBuyerEmail] = useState("");

  /* ---------- SQUARES STATE ---------- */

  const [games, setGames] = useState<Game[]>([
    {
      id: 1,
      title: "Super Bowl Squares",
      total: 100,
      price: 10,
      sold: [3, 8, 14],
      reserved: [5, 11],
      background: "",
    },
  ]);

  const [activeGameId, setActiveGameId] = useState(1);

  const [selectedByGame, setSelectedByGame] = useState<Record<number, number[]>>({
    1: [],
  });

  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const uploadRef = useRef<HTMLInputElement | null>(null);

  const [drafts, setDrafts] = useState<Drafts>({
    1: { total: "100", price: "10" },
  });

  /* ---------- TICKETS STATE ---------- */

  const [events, setEvents] = useState<TicketEvent[]>([
    {
      id: 1,
      title: "Summer Gala",
      eventName: "Summer Gala",
      venue: "Town Hall",
      price: 35,
      mode: "seats",
      rows: 5,
      seatsPerRow: 10,
      soldSeatIds: [],
      tables: [],
    },
  ]);

  const [activeEventId, setActiveEventId] = useState(1);

  const [selectedSeatIdsByEvent, setSelectedSeatIdsByEvent] = useState<
    Record<number, string[]>
  >({
    1: [],
  });

  const [selectedTableByEvent, setSelectedTableByEvent] = useState<
    Record<number, number>
  >({});

  const [quantityByEvent, setQuantityByEvent] = useState<
    Record<number, string>
  >({ 1: "1" });

  const [ticketPurchases, setTicketPurchases] = useState<
    TicketPurchase[]
  >([]);

  const [ticketDrafts, setTicketDrafts] = useState<TicketDrafts>({
    1: { price: "35", rows: "5", seatsPerRow: "10" },
  });

  /* ---------- DERIVED ---------- */

  const game = games.find((g) => g.id === activeGameId)!;
  const selected = selectedByGame[game.id] || [];
    const draft = drafts[game.id];
  const visibleSelected = selected.filter(
    (n) => !game.sold.includes(n) && !game.reserved.includes(n)
  );

  const totalCost = visibleSelected.length * game.price;

  const event = events.find((e) => e.id === activeEventId)!;
  const selectedSeats = selectedSeatIdsByEvent[event.id] || [];
  const quantity = Number(quantityByEvent[event.id] || 0);

  const ticketTotal =
    event.mode === "seats"
      ? selectedSeats.length * event.price
      : quantity * event.price;

  /* ---------- ACTIONS ---------- */

  function toggleSquare(n: number) {
    if (game.sold.includes(n) || game.reserved.includes(n)) return;

    setSelectedByGame((prev) => {
      const list = prev[game.id] || [];
      return {
        ...prev,
        [game.id]: list.includes(n)
          ? list.filter((x) => x !== n)
          : [...list, n],
      };
    });
  }

  function toggleSeat(id: string) {
    if (event.soldSeatIds.includes(id)) return;

    setSelectedSeatIdsByEvent((prev) => {
      const list = prev[event.id] || [];
      return {
        ...prev,
        [event.id]: list.includes(id)
          ? list.filter((x) => x !== id)
          : [...list, id],
      };
    });
  }

  function buySquares() {
    if (!buyerName || !buyerEmail || visibleSelected.length === 0) return;

    setGames((prev) =>
      prev.map((g) =>
        g.id === game.id
          ? { ...g, sold: [...g.sold, ...visibleSelected] }
          : g
      )
    );

    setSelectedByGame((prev) => ({ ...prev, [game.id]: [] }));
  }

  function buyTickets() {
    if (!buyerName || !buyerEmail) return;

    if (event.mode === "seats") {
      setEvents((prev) =>
        prev.map((e) =>
          e.id === event.id
            ? {
                ...e,
                soldSeatIds: [...e.soldSeatIds, ...selectedSeats],
              }
            : e
        )
      );

      setSelectedSeatIdsByEvent((prev) => ({
        ...prev,
        [event.id]: [],
      }));
    }
  }

  /* ---------- UI ---------- */

  return (
    <div
      style={{
        minHeight: "100vh",
        background:
          "linear-gradient(180deg, #020617 0%, #0f172a 50%, #020617 100%)",
        color: "white",
        padding: 24,
        fontFamily: "Arial",
      }}
    >
      <div style={{ maxWidth: 1200, margin: "0 auto", display: "grid", gap: 20 }}>
        {/* HEADER */}
        <div style={cardStyle()}>
          <h1>SO Fundraising Platform</h1>

          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={() => setSection("squares")} style={chipStyle(section === "squares")}>
              Squares
            </button>
            <button onClick={() => setSection("tickets")} style={chipStyle(section === "tickets")}>
              Tickets
            </button>
            <button onClick={() => setAdmin(!admin)} style={chipStyle(admin)}>
              Admin {admin ? "ON" : "OFF"}
            </button>
          </div>
        </div>

        {/* BUYER DETAILS */}
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

        {/* ---------- SQUARES ---------- */}
        {section === "squares" && (
          <div style={cardStyle()}>
            <h2>{game.title}</h2>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(10,1fr)", gap: 6 }}>
              {Array.from({ length: game.total }).map((_, i) => {
                const n = i + 1;
                const sold = game.sold.includes(n);
                const selected = visibleSelected.includes(n);

                return (
                  <button
                    key={n}
                    onClick={() => toggleSquare(n)}
                    disabled={sold}
                    style={{
                      padding: 10,
                      background: sold
                        ? "red"
                        : selected
                        ? "white"
                        : "#1e293b",
                      color: selected ? "black" : "white",
                    }}
                  >
                    {n}
                  </button>
                );
              })}
            </div>

            <button onClick={buySquares}>Buy Squares (£{totalCost})</button>
          </div>
        )}

        {/* ---------- TICKETS ---------- */}
        {section === "tickets" && (
          <div style={cardStyle()}>
            <h2>{event.title}</h2>

            {event.mode === "seats" && (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: `repeat(${event.seatsPerRow},1fr)`,
                  gap: 6,
                }}
              >
                {Array.from({
                  length: event.rows * event.seatsPerRow,
                }).map((_, i) => {
                  const id = seatIdForIndex(i, event.seatsPerRow);
                  const sold = event.soldSeatIds.includes(id);
                  const selected = selectedSeats.includes(id);

                  return (
                    <button
                      key={id}
                      onClick={() => toggleSeat(id)}
                      disabled={sold}
                      style={{
                        padding: 10,
                        background: sold
                          ? "red"
                          : selected
                          ? "white"
                          : "#1e293b",
                        color: selected ? "black" : "white",
                      }}
                    >
                      {id}
                    </button>
                  );
                })}
              </div>
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
