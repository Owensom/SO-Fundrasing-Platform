import React, { useMemo, useState } from "react";
import { jsPDF } from "jspdf";

type Section = "squares" | "tickets";
type TicketMode = "quantity" | "seats" | "tables";

type Game = {
  id: number;
  title: string;
  total: number;
  price: number;
  sold: number[];
  reserved: number[];
};

type TicketEvent = {
  id: number;
  title: string;
  price: number;
  mode: TicketMode;
  rows: number;
  seatsPerRow: number;
  soldSeats: string[];
  tables: { id: number; name: string; seats: number; sold: number }[];
};

type Purchase = {
  id: number;
  type: "squares" | "tickets";
  title: string;
  buyer: string;
  email: string;
  details: string[];
  total: number;
};

const money = (n: number) => `£${n.toFixed(2)}`;

const pageStyle: React.CSSProperties = {
  minHeight: "100vh",
  background:
    "radial-gradient(circle at top, rgba(56,189,248,0.16), transparent 28%), radial-gradient(circle at right, rgba(168,85,247,0.14), transparent 22%), linear-gradient(180deg, #020617 0%, #0f172a 48%, #020617 100%)",
  color: "white",
  fontFamily: "Inter, Arial, sans-serif",
  padding: 24,
};

const shellStyle: React.CSSProperties = {
  maxWidth: 1200,
  margin: "0 auto",
  display: "grid",
  gap: 20,
};

const cardStyle: React.CSSProperties = {
  border: "1px solid rgba(255,255,255,0.10)",
  background: "rgba(255,255,255,0.07)",
  backdropFilter: "blur(18px)",
  borderRadius: 28,
  padding: 24,
  boxShadow: "0 20px 80px rgba(2,6,23,0.45)",
};

const miniCardStyle: React.CSSProperties = {
  border: "1px solid rgba(255,255,255,0.10)",
  background: "rgba(2,6,23,0.62)",
  borderRadius: 20,
  padding: 16,
};

const fieldStyle: React.CSSProperties = {
  width: "100%",
  padding: "14px 16px",
  borderRadius: 18,
  border: "1px solid rgba(255,255,255,0.10)",
  background: "rgba(2,6,23,0.72)",
  color: "white",
  boxSizing: "border-box",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  marginBottom: 8,
  fontSize: 12,
  textTransform: "uppercase",
  letterSpacing: "0.14em",
  color: "#94a3b8",
};

function chipStyle(active: boolean): React.CSSProperties {
  return {
    border: active
      ? "1px solid rgba(125,211,252,0.35)"
      : "1px solid rgba(255,255,255,0.10)",
    background: active ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.04)",
    color: "white",
    borderRadius: 18,
    padding: "12px 18px",
    fontWeight: 600,
    cursor: "pointer",
  };
}

function squareButtonStyle(
  isSold: boolean,
  isReserved: boolean,
  isSelected: boolean
): React.CSSProperties {
  return {
    aspectRatio: "1 / 1",
    borderRadius: 18,
    border: isSold
      ? "1px solid rgba(251,113,133,0.35)"
      : isReserved
      ? "1px solid rgba(251,191,36,0.35)"
      : isSelected
      ? "1px solid white"
      : "1px solid rgba(255,255,255,0.15)",
    background: isSold
      ? "rgba(244,63,94,0.22)"
      : isReserved
      ? "rgba(245,158,11,0.22)"
      : isSelected
      ? "white"
      : "rgba(15,23,42,0.72)",
    color: isSelected ? "#020617" : "white",
    fontWeight: 700,
    cursor: isSold || isReserved ? "not-allowed" : "pointer",
    opacity: isSold || isReserved ? 0.82 : 1,
  };
}

function seatButtonStyle(isSold: boolean, isSelected: boolean): React.CSSProperties {
  return {
    borderRadius: 16,
    border: isSold
      ? "1px solid rgba(251,113,133,0.35)"
      : isSelected
      ? "1px solid white"
      : "1px solid rgba(255,255,255,0.10)",
    background: isSold
      ? "rgba(244,63,94,0.22)"
      : isSelected
      ? "white"
      : "rgba(2,6,23,0.62)",
    color: isSelected ? "#020617" : "white",
    padding: "12px 0",
    fontWeight: 700,
    cursor: isSold ? "not-allowed" : "pointer",
  };
}

function ctaStyle(enabled: boolean): React.CSSProperties {
  return {
    marginTop: 16,
    width: "100%",
    borderRadius: 18,
    padding: "14px 18px",
    background: enabled ? "white" : "rgba(255,255,255,0.25)",
    color: enabled ? "#020617" : "#cbd5e1",
    fontWeight: 700,
    border: "none",
    cursor: enabled ? "pointer" : "not-allowed",
    boxShadow: enabled ? "0 14px 36px rgba(255,255,255,0.14)" : "none",
  };
}

function seatId(index: number, seatsPerRow: number) {
  const row = String.fromCharCode(65 + Math.floor(index / seatsPerRow));
  const num = (index % seatsPerRow) + 1;
  return `${row}${num}`;
}

export default function App() {
  const [admin, setAdmin] = useState(true);
  const [section, setSection] = useState<Section>("squares");

  const [buyerName, setBuyerName] = useState("");
  const [buyerEmail, setBuyerEmail] = useState("");

  const [games, setGames] = useState<Game[]>([
    { id: 1, title: "Squares Game", total: 100, price: 10, sold: [], reserved: [] },
  ]);
  const [activeGame, setActiveGame] = useState(1);
  const [selectedSquares, setSelectedSquares] = useState<number[]>([]);

  const [events, setEvents] = useState<TicketEvent[]>([
    {
      id: 1,
      title: "Summer Gala",
      price: 20,
      mode: "seats",
      rows: 5,
      seatsPerRow: 10,
      soldSeats: ["A1"],
      tables: [],
    },
  ]);
  const [activeEvent, setActiveEvent] = useState(1);
  const [selectedSeats, setSelectedSeats] = useState<string[]>([]);
  const [qty, setQty] = useState("1");
  const [selectedTableId, setSelectedTableId] = useState<number | null>(null);

  const [purchases, setPurchases] = useState<Purchase[]>([]);

  const game = games.find((g) => g.id === activeGame)!;
  const event = events.find((e) => e.id === activeEvent)!;

  const squaresTotal = selectedSquares.length * game.price;
  const ticketQty = Math.max(0, Number(qty) || 0);
  const selectedTable =
    event.mode === "tables"
      ? event.tables.find((t) => t.id === selectedTableId) ?? event.tables[0]
      : undefined;
  const tableAvailable = selectedTable ? Math.max(selectedTable.seats - selectedTable.sold, 0) : 0;

  const ticketTotal =
    event.mode === "seats"
      ? selectedSeats.length * event.price
      : ticketQty * event.price;

  const canBuySquares =
    buyerName.trim() !== "" && buyerEmail.trim() !== "" && selectedSquares.length > 0;

  const canBuyTickets =
    buyerName.trim() !== "" &&
    buyerEmail.trim() !== "" &&
    (
      (event.mode === "seats" && selectedSeats.length > 0) ||
      (event.mode === "quantity" && ticketQty > 0) ||
      (event.mode === "tables" && ticketQty > 0 && ticketQty <= tableAvailable)
    );

  const purchaseSummary = useMemo(() => {
    return purchases.slice(0, 8);
  }, [purchases]);

  function exportPdf(title: string, buyer: string, email: string, details: string[], total: number) {
    const doc = new jsPDF();
    doc.setFontSize(20);
    doc.text("Purchase Receipt", 20, 20);
    doc.setFontSize(12);
    doc.text(`Listing: ${title}`, 20, 38);
    doc.text(`Buyer: ${buyer}`, 20, 48);
    doc.text(`Email: ${email}`, 20, 58);
    let y = 72;
    details.forEach((line) => {
      doc.text(line, 20, y);
      y += 10;
    });
    doc.text(`Total: ${money(total)}`, 20, y + 6);
    doc.save(`${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-receipt.pdf`);
  }

  function toggleSquare(n: number) {
    if (game.sold.includes(n) || game.reserved.includes(n)) return;
    setSelectedSquares((curr) =>
      curr.includes(n) ? curr.filter((x) => x !== n) : [...curr, n].sort((a, b) => a - b)
    );
  }

  function buySquares() {
    if (!canBuySquares) return;

    const details = [
      `Squares: ${selectedSquares.join(", ")}`,
      `Quantity: ${selectedSquares.length}`,
      `Price each: ${money(game.price)}`,
    ];

    setPurchases((curr) => [
      {
        id: Date.now(),
        type: "squares",
        title: game.title,
        buyer: buyerName,
        email: buyerEmail,
        details,
        total: squaresTotal,
      },
      ...curr,
    ]);

    setGames((curr) =>
      curr.map((g) =>
        g.id === game.id
          ? { ...g, sold: [...g.sold, ...selectedSquares].sort((a, b) => a - b) }
          : g
      )
    );

    exportPdf(game.title, buyerName, buyerEmail, details, squaresTotal);
    setSelectedSquares([]);
  }

  function toggleSeat(id: string) {
    if (event.soldSeats.includes(id)) return;
    setSelectedSeats((curr) =>
      curr.includes(id) ? curr.filter((x) => x !== id) : [...curr, id].sort()
    );
  }

  function buyTickets() {
    if (!canBuyTickets) return;

    const details =
      event.mode === "seats"
        ? [
            `Seats: ${selectedSeats.join(", ")}`,
            `Quantity: ${selectedSeats.length}`,
            `Price each: ${money(event.price)}`,
          ]
        : event.mode === "tables"
        ? [
            `Table: ${selectedTable?.name ?? "Unknown"}`,
            `Quantity: ${ticketQty}`,
            `Price each: ${money(event.price)}`,
          ]
        : [
            `Quantity: ${ticketQty}`,
            `Price each: ${money(event.price)}`,
          ];

    setPurchases((curr) => [
      {
        id: Date.now(),
        type: "tickets",
        title: event.title,
        buyer: buyerName,
        email: buyerEmail,
        details,
        total: ticketTotal,
      },
      ...curr,
    ]);

    if (event.mode === "seats") {
      setEvents((curr) =>
        curr.map((e) =>
          e.id === event.id
            ? { ...e, soldSeats: [...e.soldSeats, ...selectedSeats].sort() }
            : e
        )
      );
      setSelectedSeats([]);
    } else if (event.mode === "tables" && selectedTable) {
      setEvents((curr) =>
        curr.map((e) =>
          e.id === event.id
            ? {
                ...e,
                tables: e.tables.map((t) =>
                  t.id === selectedTable.id ? { ...t, sold: t.sold + ticketQty } : t
                ),
              }
            : e
        )
      );
    }

    exportPdf(event.title, buyerName, buyerEmail, details, ticketTotal);
  }

  return (
    <div style={pageStyle}>
      <div style={shellStyle}>
        <section style={cardStyle}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
            <div>
              <div
                style={{
                  display: "inline-flex",
                  gap: 8,
                  alignItems: "center",
                  border: "1px solid rgba(255,255,255,0.10)",
                  background: "rgba(255,255,255,0.08)",
                  borderRadius: 999,
                  padding: "6px 12px",
                  fontSize: 11,
                  textTransform: "uppercase",
                  letterSpacing: "0.18em",
                  color: "#bae6fd",
                  marginBottom: 10,
                }}
              >
                Premium fundraising suite
              </div>
              <h1 style={{ margin: 0, fontSize: 38, fontWeight: 700, letterSpacing: "-0.03em" }}>
                Fundraising Platform
              </h1>
              <p style={{ margin: "10px 0 0", color: "#cbd5e1", maxWidth: 760 }}>
                Premium UI for Squares and Tickets with the current logic kept intact.
              </p>
            </div>

            <button onClick={() => setAdmin((a) => !a)} style={chipStyle(admin)}>
              Admin {admin ? "ON" : "OFF"}
            </button>
          </div>
        </section>

        <section style={cardStyle}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "end", gap: 16, flexWrap: "wrap" }}>
            <div>
              <h2 style={{ margin: 0, fontSize: 28 }}>Buyer</h2>
              <p style={{ margin: "8px 0 0", color: "#cbd5e1" }}>
                Buyer details apply across all sections.
              </p>
            </div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button onClick={() => setSection("squares")} style={chipStyle(section === "squares")}>
                Squares
              </button>
              <button onClick={() => setSection("tickets")} style={chipStyle(section === "tickets")}>
                Tickets
              </button>
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: 16,
              marginTop: 18,
            }}
          >
            <div>
              <label style={labelStyle}>Buyer name</label>
              <input value={buyerName} onChange={(e) => setBuyerName(e.target.value)} style={fieldStyle} />
            </div>
            <div>
              <label style={labelStyle}>Buyer email</label>
              <input value={buyerEmail} onChange={(e) => setBuyerEmail(e.target.value)} style={fieldStyle} />
            </div>
            <div style={miniCardStyle}>
              <div style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: "0.14em", color: "#94a3b8" }}>
                Quick summary
              </div>
              <div style={{ marginTop: 8, color: "#e2e8f0" }}>
                {section === "squares"
                  ? `Squares selected: ${selectedSquares.length}`
                  : event.mode === "seats"
                  ? `Seats selected: ${selectedSeats.length}`
                  : `Ticket quantity: ${ticketQty || 0}`}
              </div>
              <div style={{ marginTop: 6, color: "#e2e8f0" }}>
                {section === "squares" ? `Total: ${money(squaresTotal)}` : `Total: ${money(ticketTotal)}`}
              </div>
            </div>
          </div>
        </section>

        {section === "squares" && (
          <>
            {admin && (
              <section style={cardStyle}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
                  <h2 style={{ margin: 0, fontSize: 28 }}>Admin • Squares</h2>
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                    {games.map((g) => (
                      <button key={g.id} onClick={() => setActiveGame(g.id)} style={chipStyle(activeGame === g.id)}>
                        {g.title}
                      </button>
                    ))}
                  </div>
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                    gap: 16,
                    marginTop: 18,
                  }}
                >
                  <div style={miniCardStyle}>
                    <div style={{ fontSize: 12, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.14em" }}>
                      Game
                    </div>
                    <div style={{ marginTop: 8, fontWeight: 700 }}>{game.title}</div>
                  </div>
                  <div style={miniCardStyle}>
                    <div style={{ fontSize: 12, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.14em" }}>
                      Squares
                    </div>
                    <div style={{ marginTop: 8, fontWeight: 700 }}>{game.total}</div>
                  </div>
                  <div style={miniCardStyle}>
                    <div style={{ fontSize: 12, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.14em" }}>
                      Price
                    </div>
                    <div style={{ marginTop: 8, fontWeight: 700 }}>{money(game.price)}</div>
                  </div>
                  <div style={miniCardStyle}>
                    <div style={{ fontSize: 12, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.14em" }}>
                      Sold / Reserved
                    </div>
                    <div style={{ marginTop: 8, fontWeight: 700 }}>
                      {game.sold.length} / {game.reserved.length}
                    </div>
                  </div>
                </div>
              </section>
            )}

            <section style={cardStyle}>
              <h2 style={{ marginTop: 0, marginBottom: 8, fontSize: 30 }}>{game.title} • Buyer View</h2>
              <p style={{ marginTop: 0, marginBottom: 18, color: "#cbd5e1" }}>
                Sold squares are locked. Reserved squares are not available.
              </p>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(10, minmax(0, 1fr))", gap: 8 }}>
                {Array.from({ length: game.total }).map((_, i) => {
                  const n = i + 1;
                  const isSold = game.sold.includes(n);
                  const isReserved = game.reserved.includes(n);
                  const isSelected = selectedSquares.includes(n);

                  return (
                    <button
                      key={n}
                      type="button"
                      onClick={() => toggleSquare(n)}
                      disabled={isSold || isReserved}
                      style={squareButtonStyle(isSold, isReserved, isSelected)}
                    >
                      {n}
                    </button>
                  );
                })}
              </div>

              <div style={{ ...miniCardStyle, marginTop: 18 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                  <div>
                    <div style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: "0.14em", color: "#94a3b8" }}>
                      Selected numbers
                    </div>
                    <div style={{ marginTop: 8, color: "#e2e8f0" }}>
                      {selectedSquares.length ? selectedSquares.join(", ") : "None selected"}
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: "0.14em", color: "#94a3b8" }}>
                      Amount due
                    </div>
                    <div style={{ marginTop: 8, fontWeight: 700, fontSize: 22 }}>{money(squaresTotal)}</div>
                  </div>
                </div>

                <button onClick={buySquares} disabled={!canBuySquares} style={ctaStyle(canBuySquares)}>
                  Buy Selected Squares
                </button>
              </div>
            </section>
          </>
        )}

        {section === "tickets" && (
          <>
            {admin && (
              <section style={cardStyle}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
                  <h2 style={{ margin: 0, fontSize: 28 }}>Admin • Tickets</h2>
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                    {events.map((e) => (
                      <button
                        key={e.id}
                        onClick={() => {
                          setActiveEvent(e.id);
                          setSelectedSeats([]);
                          setSelectedTableId(e.tables[0]?.id ?? null);
                        }}
                        style={chipStyle(activeEvent === e.id)}
                      >
                        {e.title}
                      </button>
                    ))}
                  </div>
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                    gap: 16,
                    marginTop: 18,
                  }}
                >
                  <div style={miniCardStyle}>
                    <div style={{ fontSize: 12, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.14em" }}>
                      Event
                    </div>
                    <div style={{ marginTop: 8, fontWeight: 700 }}>{event.title}</div>
                  </div>
                  <div style={miniCardStyle}>
                    <div style={{ fontSize: 12, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.14em" }}>
                      Mode
                    </div>
                    <div style={{ marginTop: 8, fontWeight: 700 }}>{event.mode}</div>
                  </div>
                  <div style={miniCardStyle}>
                    <div style={{ fontSize: 12, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.14em" }}>
                      Price
                    </div>
                    <div style={{ marginTop: 8, fontWeight: 700 }}>{money(event.price)}</div>
                  </div>
                  <div style={miniCardStyle}>
                    <div style={{ fontSize: 12, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.14em" }}>
                      Availability
                    </div>
                    <div style={{ marginTop: 8, fontWeight: 700 }}>
                      {event.mode === "seats"
                        ? `${event.rows * event.seatsPerRow - event.soldSeats.length} seats open`
                        : event.mode === "tables"
                        ? `${event.tables.reduce((sum, t) => sum + Math.max(t.seats - t.sold, 0), 0)} seats open`
                        : "Open"}
                    </div>
                  </div>
                </div>
              </section>
            )}

            <section style={cardStyle}>
              <h2 style={{ marginTop: 0, marginBottom: 8, fontSize: 30 }}>{event.title} • Buyer View</h2>
              <p style={{ marginTop: 0, marginBottom: 18, color: "#cbd5e1" }}>
                Buy by quantity, choose seats, or select a table depending on the event setup.
              </p>

              {event.mode === "seats" && (
                <>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: `repeat(${event.seatsPerRow}, minmax(0, 1fr))`,
                      gap: 8,
                    }}
                  >
                    {Array.from({ length: event.rows * event.seatsPerRow }).map((_, i) => {
                      const id = seatId(i, event.seatsPerRow);
                      const isSold = event.soldSeats.includes(id);
                      const isSelected = selectedSeats.includes(id);

                      return (
                        <button
                          key={id}
                          type="button"
                          onClick={() => toggleSeat(id)}
                          disabled={isSold}
                          style={seatButtonStyle(isSold, isSelected)}
                        >
                          {id}
                        </button>
                      );
                    })}
                  </div>
                  <div style={{ marginTop: 10, fontSize: 12, color: "#94a3b8" }}>
                    Click seats to choose them. Sold seats are blocked.
                  </div>
                </>
              )}

              {event.mode === "tables" && (
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                    gap: 12,
                  }}
                >
                  {event.tables.map((table) => {
                    const active = selectedTable?.id === table.id;
                    const available = Math.max(table.seats - table.sold, 0);
                    return (
                      <button
                        key={table.id}
                        onClick={() => setSelectedTableId(table.id)}
                        style={{
                          border: active
                            ? "1px solid rgba(125,211,252,0.35)"
                            : "1px solid rgba(255,255,255,0.10)",
                          background: active ? "rgba(255,255,255,0.12)" : "rgba(2,6,23,0.55)",
                          color: "white",
                          borderRadius: 20,
                          padding: 16,
                          textAlign: "left",
                          cursor: "pointer",
                        }}
                      >
                        <div style={{ fontWeight: 700 }}>{table.name}</div>
                        <div style={{ marginTop: 6, color: "#cbd5e1" }}>
                          {available} available of {table.seats}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}

              {event.mode !== "seats" && (
                <div style={{ maxWidth: 240, marginTop: event.mode === "tables" ? 16 : 0 }}>
                  <label style={labelStyle}>Quantity</label>
                  <input value={qty} onChange={(e) => setQty(e.target.value)} style={fieldStyle} />
                </div>
              )}

              <div style={{ ...miniCardStyle, marginTop: 18 }}>
                {event.mode === "seats" ? (
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                    <div>
                      <div style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: "0.14em", color: "#94a3b8" }}>
                        Selected seats
                      </div>
                      <div style={{ marginTop: 8, color: "#e2e8f0" }}>
                        {selectedSeats.length ? selectedSeats.join(", ") : "None selected"}
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: "0.14em", color: "#94a3b8" }}>
                        Amount due
                      </div>
                      <div style={{ marginTop: 8, fontWeight: 700, fontSize: 22 }}>{money(ticketTotal)}</div>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                    <div>
                      <div style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: "0.14em", color: "#94a3b8" }}>
                        {event.mode === "tables" ? "Table / qty" : "Quantity"}
                      </div>
                      <div style={{ marginTop: 8, color: "#e2e8f0" }}>
                        {event.mode === "tables"
                          ? `${selectedTable?.name ?? "No table"} • ${ticketQty || 0}`
                          : ticketQty || 0}
                      </div>
                      {event.mode === "tables" && (
                        <div style={{ marginTop: 6, fontSize: 12, color: "#94a3b8" }}>
                          Available seats: {tableAvailable}
                        </div>
                      )}
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: "0.14em", color: "#94a3b8" }}>
                        Amount due
                      </div>
                      <div style={{ marginTop: 8, fontWeight: 700, fontSize: 22 }}>{money(ticketTotal)}</div>
                    </div>
                  </div>
                )}

                <button onClick={buyTickets} disabled={!canBuyTickets} style={ctaStyle(canBuyTickets)}>
                  {event.mode === "seats" ? "Buy Selected Seats" : "Buy Tickets"}
                </button>
              </div>
            </section>
          </>
        )}

        {admin && (
          <section style={cardStyle}>
            <h2 style={{ marginTop: 0, marginBottom: 14, fontSize: 28 }}>Admin Data</h2>
            {purchaseSummary.length === 0 ? (
              <div style={{ color: "#94a3b8" }}>No purchases yet.</div>
            ) : (
              <div style={{ display: "grid", gap: 12 }}>
                {purchaseSummary.map((p) => (
                  <div key={p.id} style={miniCardStyle}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                      <div style={{ fontWeight: 700 }}>{p.buyer}</div>
                      <div>{money(p.total)}</div>
                    </div>
                    <div style={{ marginTop: 6, color: "#cbd5e1" }}>{p.email}</div>
                    <div style={{ marginTop: 6, color: "#cbd5e1" }}>{p.title}</div>
                    <div style={{ marginTop: 6, fontSize: 12, color: "#94a3b8" }}>
                      {p.details.join(" • ")}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
