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
    boxShadow: "0 20px 80px rgba(2,6,23,0.45)",
  };
}

function inputStyle(): React.CSSProperties {
  return {
    width: "100%",
    padding: "14px 16px",
    borderRadius: 18,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(2,6,23,0.72)",
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
    border: active ? "1px solid rgba(125,211,252,0.35)" : "1px solid rgba(255,255,255,0.10)",
    background: active ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.04)",
    color: "white",
    borderRadius: 18,
    padding: "12px 18px",
    fontWeight: 600,
    cursor: "pointer",
  };
}

export default function App() {
  const [admin, setAdmin] = useState(true);
  const [buyerName, setBuyerName] = useState("");
  const [buyerEmail, setBuyerEmail] = useState("");

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
      soldSeatIds: ["A1", "A2", "B5"],
      tables: [],
    },
    {
      id: 2,
      title: "Charity Dinner",
      eventName: "Charity Dinner",
      venue: "Grand Hotel",
      price: 45,
      mode: "tables",
      rows: 0,
      seatsPerRow: 0,
      soldSeatIds: [],
      tables: [
        { id: 21, name: "Table A", seats: 8, sold: 3 },
        { id: 22, name: "Table B", seats: 10, sold: 5 },
      ],
    },
    {
      id: 3,
      title: "Comedy Night",
      eventName: "Comedy Night",
      venue: "City Theatre",
      price: 20,
      mode: "quantity",
      rows: 0,
      seatsPerRow: 0,
      soldSeatIds: [],
      tables: [],
    },
  ]);

  const [activeEventId, setActiveEventId] = useState(1);
  const [selectedSeatIdsByEvent, setSelectedSeatIdsByEvent] = useState<Record<number, string[]>>({
    1: [],
    2: [],
    3: [],
  });
  const [selectedTableByEvent, setSelectedTableByEvent] = useState<Record<number, number>>({
    2: 21,
  });
  const [quantityByEvent, setQuantityByEvent] = useState<Record<number, string>>({
    2: "2",
    3: "2",
  });

  const event = events.find((e) => e.id === activeEventId)!;
  const selectedSeats = selectedSeatIdsByEvent[event.id] ?? [];
  const selectedTableId = selectedTableByEvent[event.id] ?? event.tables[0]?.id ?? 0;
  const selectedTable = event.tables.find((t) => t.id === selectedTableId);
  const quantity = Math.max(0, Number(quantityByEvent[event.id] || "0") || 0);
  const tableAvailable = selectedTable ? Math.max(selectedTable.seats - selectedTable.sold, 0) : 0;
  const ticketTotal = event.mode === "seats" ? selectedSeats.length * event.price : quantity * event.price;

  const canBuy =
    buyerName.trim() !== "" &&
    buyerEmail.trim() !== "" &&
    (event.mode === "seats"
      ? selectedSeats.length > 0
      : event.mode === "tables"
      ? quantity > 0 && !!selectedTable && quantity <= tableAvailable
      : quantity > 0);

  function addEvent() {
    const id = Date.now();
    const newEvent: TicketEvent = {
      id,
      title: `New Event ${events.length + 1}`,
      eventName: "New Event",
      venue: "Venue",
      price: 25,
      mode: "seats",
      rows: 5,
      seatsPerRow: 10,
      soldSeatIds: [],
      tables: [],
    };
    setEvents((curr) => [...curr, newEvent]);
    setSelectedSeatIdsByEvent((curr) => ({ ...curr, [id]: [] }));
    setQuantityByEvent((curr) => ({ ...curr, [id]: "1" }));
    setActiveEventId(id);
  }

  function removeCurrentEvent() {
    if (events.length <= 1) return;
    const remaining = events.filter((e) => e.id !== event.id);
    setEvents(remaining);
    setActiveEventId(remaining[0].id);
  }

  function toggleSeat(seatId: string) {
    if (event.soldSeatIds.includes(seatId)) return;
    setSelectedSeatIdsByEvent((curr) => {
      const existing = curr[event.id] ?? [];
      const next = existing.includes(seatId)
        ? existing.filter((s) => s !== seatId)
        : [...existing, seatId].sort();
      return { ...curr, [event.id]: next };
    });
  }

  function buyTickets() {
    if (!canBuy) return;

    if (event.mode === "seats") {
      setEvents((curr) =>
        curr.map((e) =>
          e.id === event.id
            ? { ...e, soldSeatIds: [...e.soldSeatIds, ...selectedSeats].sort() }
            : e,
        ),
      );
      setSelectedSeatIdsByEvent((curr) => ({ ...curr, [event.id]: [] }));
    } else if (event.mode === "tables") {
      setEvents((curr) =>
        curr.map((e) =>
          e.id === event.id
            ? {
                ...e,
                tables: e.tables.map((t) =>
                  t.id === selectedTableId ? { ...t, sold: t.sold + quantity } : t,
                ),
              }
            : e,
        ),
      );
    }

    const doc = new jsPDF();
    doc.setFontSize(20);
    doc.text("Ticket Purchase Receipt", 20, 22);
    doc.setFontSize(12);
    doc.text(`Event: ${event.title}`, 20, 38);
    doc.text(`Buyer: ${buyerName}`, 20, 48);
    doc.text(`Email: ${buyerEmail}`, 20, 58);
    doc.text(`Mode: ${event.mode}`, 20, 68);
    if (event.mode === "seats") doc.text(`Seats: ${selectedSeats.join(", ")}`, 20, 78);
    if (event.mode === "tables") doc.text(`Table: ${selectedTable?.name ?? ""}`, 20, 78);
    doc.text(`Quantity: ${event.mode === "seats" ? selectedSeats.length : quantity}`, 20, 88);
    doc.text(`Total: ${money(ticketTotal)}`, 20, 98);
    doc.save("tickets-standalone-receipt.pdf");
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background:
          "radial-gradient(circle at top, rgba(56,189,248,0.16), transparent 28%), radial-gradient(circle at right, rgba(168,85,247,0.14), transparent 22%), linear-gradient(180deg, #020617 0%, #0f172a 48%, #020617 100%)",
        color: "white",
        fontFamily: "Inter, Arial, sans-serif",
        padding: 24,
      }}
    >
      <div style={{ maxWidth: 1200, margin: "0 auto", display: "grid", gap: 20 }}>
        <section style={cardStyle()}>
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
                Tickets Standalone Preview
              </h1>
              <p style={{ margin: "10px 0 0", color: "#cbd5e1", maxWidth: 760 }}>
                Use this file in App.tsx to test Tickets functionality only in GitHub/Vercel before integration.
              </p>
            </div>

            <button onClick={() => setAdmin((v) => !v)} style={chipStyle(admin)}>
              Admin {admin ? "ON" : "OFF"}
            </button>
          </div>
        </section>

        <section style={cardStyle()}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
            <div>
              <label style={labelStyle()}>Buyer name</label>
              <input value={buyerName} onChange={(e) => setBuyerName(e.target.value)} style={inputStyle()} />
            </div>
            <div>
              <label style={labelStyle()}>Buyer email</label>
              <input value={buyerEmail} onChange={(e) => setBuyerEmail(e.target.value)} style={inputStyle()} />
            </div>
          </div>
        </section>

        {admin && (
          <section style={cardStyle()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
              <h2 style={{ margin: 0, fontSize: 28 }}>Admin • Tickets</h2>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <button onClick={addEvent} style={chipStyle(false)}>Add Event</button>
                <button onClick={removeCurrentEvent} style={chipStyle(false)}>Remove Current</button>
              </div>
            </div>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 16 }}>
              {events.map((e) => (
                <button key={e.id} onClick={() => setActiveEventId(e.id)} style={chipStyle(e.id === event.id)}>
                  {e.title}
                </button>
              ))}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16, marginTop: 18 }}>
              <div>
                <label style={labelStyle()}>Listing title</label>
                <input value={event.title} onChange={(e) => setEvents((curr) => curr.map((x) => x.id === event.id ? { ...x, title: e.target.value } : x))} style={inputStyle()} />
              </div>
              <div>
                <label style={labelStyle()}>Event name</label>
                <input value={event.eventName} onChange={(e) => setEvents((curr) => curr.map((x) => x.id === event.id ? { ...x, eventName: e.target.value } : x))} style={inputStyle()} />
              </div>
              <div>
                <label style={labelStyle()}>Venue</label>
                <input value={event.venue} onChange={(e) => setEvents((curr) => curr.map((x) => x.id === event.id ? { ...x, venue: e.target.value } : x))} style={inputStyle()} />
              </div>
              <div>
                <label style={labelStyle()}>Ticket price</label>
                <input type="number" min={1} value={event.price} onChange={(e) => setEvents((curr) => curr.map((x) => x.id === event.id ? { ...x, price: Math.max(1, Number(e.target.value || 1)) } : x))} style={inputStyle()} />
              </div>
            </div>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 16 }}>
              {(["seats", "tables", "quantity"] as TicketMode[]).map((m) => (
                <button key={m} onClick={() => setEvents((curr) => curr.map((x) => x.id === event.id ? { ...x, mode: m } : x))} style={chipStyle(event.mode === m)}>
                  {m}
                </button>
              ))}
            </div>
          </section>
        )}

        <section style={cardStyle()}>
          <h2 style={{ marginTop: 0, marginBottom: 8, fontSize: 30 }}>{event.title} • Buyer View</h2>
          <p style={{ marginTop: 0, marginBottom: 18, color: "#cbd5e1" }}>
            Buy by seat, by table, or by quantity depending on the event setup.
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
                  const id = seatIdForIndex(i, event.seatsPerRow);
                  const isSold = event.soldSeatIds.includes(id);
                  const isSelected = selectedSeats.includes(id);

                  const bg = isSold
                    ? "rgba(244,63,94,0.22)"
                    : isSelected
                    ? "white"
                    : "rgba(15,23,42,0.72)";

                  const color = isSelected ? "#020617" : "white";
                  const border = isSold
                    ? "1px solid rgba(251,113,133,0.35)"
                    : isSelected
                    ? "1px solid white"
                    : "1px solid rgba(255,255,255,0.15)";

                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => toggleSeat(id)}
                      disabled={isSold}
                      style={{
                        aspectRatio: "1 / 1",
                        borderRadius: 18,
                        border,
                        background: bg,
                        color,
                        fontWeight: 700,
                        cursor: isSold ? "not-allowed" : "pointer",
                        opacity: isSold ? 0.82 : 1,
                      }}
                    >
                      {id}
                    </button>
                  );
                })}
              </div>

              <div style={{ marginTop: 10, color: "#94a3b8", fontSize: 12 }}>
                Sold seats are blocked and stay sold after purchase.
              </div>
            </>
          )}

          {event.mode === "tables" && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
              {event.tables.map((tb) => (
                <button
                  key={tb.id}
                  onClick={() => setSelectedTableByEvent((curr) => ({ ...curr, [event.id]: tb.id }))}
                  style={{
                    border: selectedTableId === tb.id ? "1px solid rgba(125,211,252,0.35)" : "1px solid rgba(255,255,255,0.10)",
                    background: selectedTableId === tb.id ? "rgba(255,255,255,0.12)" : "rgba(2,6,23,0.55)",
                    color: "white",
                    borderRadius: 20,
                    padding: 16,
                    textAlign: "left",
                    cursor: "pointer",
                  }}
                >
                  <div style={{ fontWeight: 700 }}>{tb.name}</div>
                  <div style={{ marginTop: 6, color: "#cbd5e1" }}>
                    {Math.max(tb.seats - tb.sold, 0)} available of {tb.seats}
                  </div>
                </button>
              ))}
            </div>
          )}

          {event.mode !== "seats" && (
            <div style={{ marginTop: 16, maxWidth: 240 }}>
              <label style={labelStyle()}>Quantity</label>
              <input
                type="number"
                min={1}
                value={quantityByEvent[event.id] ?? ""}
                onChange={(e) => setQuantityByEvent((curr) => ({ ...curr, [event.id]: e.target.value }))}
                style={inputStyle()}
              />
            </div>
          )}

          <div style={{ marginTop: 18, ...cardStyle(), padding: 16, borderRadius: 20 }}>
            <div style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: "0.14em", color: "#94a3b8" }}>
              {event.mode === "seats" ? "Selected seats" : event.mode === "tables" ? "Selected table" : "Quantity"}
            </div>
            <div style={{ marginTop: 8, color: "#e2e8f0" }}>
              {event.mode === "seats"
                ? selectedSeats.length ? selectedSeats.join(", ") : "None selected"
                : event.mode === "tables"
                ? selectedTable ? `${selectedTable.name} • ${tableAvailable} seats available` : "No table selected"
                : quantity || 0}
            </div>

            <div style={{ marginTop: 14, display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
              <div style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: "0.14em", color: "#94a3b8" }}>
                Amount due
              </div>
              <div style={{ fontWeight: 700, fontSize: 22 }}>{money(ticketTotal)}</div>
            </div>

            <button
              onClick={buyTickets}
              disabled={!canBuy}
              style={{
                marginTop: 16,
                width: "100%",
                borderRadius: 18,
                padding: "14px 18px",
                background: canBuy ? "white" : "rgba(255,255,255,0.25)",
                color: canBuy ? "#020617" : "#cbd5e1",
                fontWeight: 700,
                border: "none",
                cursor: canBuy ? "pointer" : "not-allowed",
              }}
            >
              Buy Tickets
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
