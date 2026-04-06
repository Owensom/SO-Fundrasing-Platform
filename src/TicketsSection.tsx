import { appendLedger } from "./purchaseLedger";
import React, { useMemo, useRef, useState } from "react";
import { jsPDF } from "jspdf";

type TicketMode = "rows" | "tables";

type TicketTable = {
  id: number;
  name: string;
  seats: number; // committed numeric value
  sold: number;
};

type TicketEvent = {
  id: number;
  title: string;
  eventName: string;
  venue: string;
  price: number; // committed numeric value
  mode: TicketMode;
  rows: number; // committed numeric value
  seatsPerRow: number; // committed numeric value
  soldSeatIds: string[];
  tables: TicketTable[];
  background?: string;
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

type EventDrafts = Record<
  number,
  {
    price: string;
    rows: string;
    seatsPerRow: string;
  }
>;

type TableDrafts = Record<
  number,
  Record<
    number,
    {
      name: string;
      seats: string;
    }
  >
>;

function money(n: number) {
  return `£${n.toFixed(2)}`;
}

function seatIdForIndex(index: number, seatsPerRow: number): string {
  const row = String.fromCharCode(65 + Math.floor(index / seatsPerRow));
  const num = (index % seatsPerRow) + 1;
  return `${row}${num}`;
}

function clampPositiveInt(n: number, fallback = 1) {
  if (!Number.isFinite(n)) return fallback;
  return Math.max(1, Math.floor(n));
}

function pageStyle(): React.CSSProperties {
  return {
    minHeight: "100vh",
    background:
      "radial-gradient(circle at top, rgba(56,189,248,0.16), transparent 28%), radial-gradient(circle at right, rgba(168,85,247,0.14), transparent 22%), linear-gradient(180deg, #020617 0%, #0f172a 48%, #020617 100%)",
    color: "white",
    fontFamily: "Inter, Arial, sans-serif",
    padding: 24,
  };
}

function cardStyle(): React.CSSProperties {
  return {
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(255,255,255,0.07)",
    backdropFilter: "blur(18px)",
    WebkitBackdropFilter: "blur(18px)",
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
    border: invalid ? "1px solid rgba(251,113,133,0.45)" : "1px solid rgba(255,255,255,0.10)",
    background: invalid ? "rgba(127,29,29,0.18)" : "rgba(2,6,23,0.72)",
    color: "white",
    boxSizing: "border-box",
    outline: "none",
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

function summaryCardStyle(): React.CSSProperties {
  return {
    ...cardStyle(),
    padding: 16,
    borderRadius: 20,
  };
}

function secondaryButtonStyle(): React.CSSProperties {
  return {
    borderRadius: 18,
    padding: "14px 18px",
    background: "rgba(255,255,255,0.08)",
    color: "white",
    fontWeight: 700,
    border: "1px solid rgba(255,255,255,0.12)",
    cursor: "pointer",
  };
}

export default function TicketsSection() {
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
      mode: "rows",
      rows: 5,
      seatsPerRow: 10,
      soldSeatIds: ["A1", "A2", "B5"],
      tables: [],
      background: "",
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
      background: "",
    },
  ]);

  const [activeEventId, setActiveEventId] = useState(1);

  const [drafts, setDrafts] = useState<EventDrafts>({
    1: { price: "35", rows: "5", seatsPerRow: "10" },
    2: { price: "45", rows: "0", seatsPerRow: "0" },
  });

  const [tableDrafts, setTableDrafts] = useState<TableDrafts>({
    1: {},
    2: {
      21: { name: "Table A", seats: "8" },
      22: { name: "Table B", seats: "10" },
    },
  });

  const [selectedSeatIdsByEvent, setSelectedSeatIdsByEvent] = useState<Record<number, string[]>>({
    1: [],
    2: [],
  });

  const [selectedTableByEvent, setSelectedTableByEvent] = useState<Record<number, number>>({
    2: 21,
  });

  const [quantityByEvent, setQuantityByEvent] = useState<Record<number, string>>({
    2: "2",
  });

  const [purchases, setPurchases] = useState<TicketPurchase[]>([]);
  const uploadRef = useRef<HTMLInputElement | null>(null);

  const event = events.find((e) => e.id === activeEventId) ?? events[0];
  const draft = drafts[event.id] ?? {
    price: String(event.price),
    rows: String(event.rows),
    seatsPerRow: String(event.seatsPerRow),
  };

  const selectedSeats = selectedSeatIdsByEvent[event.id] ?? [];
  const selectedTableId = selectedTableByEvent[event.id] ?? event.tables[0]?.id ?? 0;
  const selectedTable = event.tables.find((t) => t.id === selectedTableId);
  const quantity = Math.max(0, Number(quantityByEvent[event.id] || "0") || 0);

  const rowsCountInvalid = event.mode === "rows" && (draft.rows.trim() === "" || Number(draft.rows) <= 0);
  const seatsPerRowInvalid =
    event.mode === "rows" && (draft.seatsPerRow.trim() === "" || Number(draft.seatsPerRow) <= 0);
  const priceInvalid = draft.price.trim() === "" || Number(draft.price) <= 0;

  const anyTableInvalid =
    event.mode === "tables" &&
    event.tables.some((table) => {
      const td = tableDrafts[event.id]?.[table.id] ?? { name: table.name, seats: String(table.seats) };
      return td.name.trim() === "" || td.seats.trim() === "" || Number(td.seats) <= 0;
    });

  const invalidForCompletion = priceInvalid || rowsCountInvalid || seatsPerRowInvalid || anyTableInvalid;

  const totalRowSeats = event.rows * event.seatsPerRow;
  const availableRowSeats = totalRowSeats - event.soldSeatIds.length;
  const totalTableSeats = event.tables.reduce((sum, t) => sum + t.seats, 0);
  const totalSoldTables = event.tables.reduce((sum, t) => sum + t.sold, 0);
  const availableSelectedTable = selectedTable ? Math.max(selectedTable.seats - selectedTable.sold, 0) : 0;

  const total = event.mode === "rows" ? selectedSeats.length * event.price : quantity * event.price;

  const canBuy =
    buyerName.trim() !== "" &&
    buyerEmail.trim() !== "" &&
    !invalidForCompletion &&
    (event.mode === "rows"
      ? selectedSeats.length > 0
      : quantity > 0 && !!selectedTable && quantity <= availableSelectedTable);

  function setEventPatch(id: number, patch: Partial<TicketEvent>) {
    setEvents((curr) => curr.map((e) => (e.id === id ? { ...e, ...patch } : e)));
  }

  function setDraftPatch(id: number, patch: Partial<EventDrafts[number]>) {
    setDrafts((curr) => ({
      ...curr,
      [id]: { ...(curr[id] ?? { price: "", rows: "", seatsPerRow: "" }), ...patch },
    }));
  }

  function setTableDraftPatch(eventId: number, tableId: number, patch: Partial<TableDrafts[number][number]>) {
    setTableDrafts((curr) => ({
      ...curr,
      [eventId]: {
        ...(curr[eventId] ?? {}),
        [tableId]: {
          ...(curr[eventId]?.[tableId] ?? { name: "", seats: "" }),
          ...patch,
        },
      },
    }));
  }

  function addEvent() {
    const id = Date.now();
    const newEvent: TicketEvent = {
      id,
      title: `New Event ${events.length + 1}`,
      eventName: "New Event",
      venue: "Venue",
      price: 0,
      mode: "rows",
      rows: 0,
      seatsPerRow: 0,
      soldSeatIds: [],
      tables: [],
      background: "",
    };
    setEvents((curr) => [...curr, newEvent]);
    setDrafts((curr) => ({
      ...curr,
      [id]: { price: "0", rows: "0", seatsPerRow: "0" },
    }));
    setTableDrafts((curr) => ({ ...curr, [id]: {} }));
    setSelectedSeatIdsByEvent((curr) => ({ ...curr, [id]: [] }));
    setSelectedTableByEvent((curr) => ({ ...curr, [id]: 0 }));
    setQuantityByEvent((curr) => ({ ...curr, [id]: "0" }));
    setActiveEventId(id);
  }

  function removeCurrentEvent() {
    if (events.length <= 1) return;
    const remaining = events.filter((e) => e.id !== event.id);
    setEvents(remaining);
    setActiveEventId(remaining[0].id);
  }

  function addTable() {
    const tableId = Date.now();
    const newTable: TicketTable = {
      id: tableId,
      name: `Table ${String.fromCharCode(65 + event.tables.length)}`,
      seats: 8,
      sold: 0,
    };
    setEvents((curr) =>
      curr.map((e) => (e.id === event.id ? { ...e, tables: [...e.tables, newTable] } : e)),
    );
    setTableDraftPatch(event.id, tableId, { name: newTable.name, seats: "8" });
    setSelectedTableByEvent((curr) => ({ ...curr, [event.id]: tableId }));
  }

  function removeTable(tableId: number) {
    const remainingTables = event.tables.filter((t) => t.id !== tableId);
    setEvents((curr) =>
      curr.map((e) => (e.id === event.id ? { ...e, tables: remainingTables } : e)),
    );
    setSelectedTableByEvent((curr) => ({ ...curr, [event.id]: remainingTables[0]?.id ?? 0 }));
  }

  function uploadBackground(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setEventPatch(event.id, { background: String(reader.result || "") });
    };
    reader.readAsDataURL(file);
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

  function buildReceipt() {
    const doc = new jsPDF();
    doc.setFontSize(20);
    doc.text("Ticket Purchase Receipt", 20, 22);
    doc.setFontSize(12);
    doc.text(`Event: ${event.title}`, 20, 38);
    doc.text(`Buyer: ${buyerName || "Not entered"}`, 20, 48);
    doc.text(`Email: ${buyerEmail || "Not entered"}`, 20, 58);
    doc.text(`Mode: ${event.mode}`, 20, 68);

    if (event.mode === "rows") {
      doc.text(`Selected seats: ${selectedSeats.length ? selectedSeats.join(", ") : "None"}`, 20, 78);
      doc.text(`Quantity: ${selectedSeats.length}`, 20, 88);
    } else {
      doc.text(`Table: ${selectedTable?.name ?? "None"}`, 20, 78);
      doc.text(`Quantity: ${quantity}`, 20, 88);
    }

    doc.text(`Price each: ${money(event.price)}`, 20, 98);
    doc.text(`Total: ${money(total)}`, 20, 108);
    return doc;
  }

  function downloadReceipt() {
    const doc = buildReceipt();
    doc.save("buyer-ticket-receipt.pdf");
  }

  function buyTickets() {
    if (!canBuy) return;

    const now = new Date().toLocaleString();

    if (event.mode === "rows") {
      setEvents((curr) =>
        curr.map((e) =>
          e.id === event.id
            ? { ...e, soldSeatIds: [...e.soldSeatIds, ...selectedSeats].sort() }
            : e,
        ),
      );
      appendLedger({
  id: String(Date.now()),
  module: "tickets",
  itemTitle: event.title,
  buyerName: buyerName.trim(),
  buyerEmail: buyerEmail.trim(),
  description: `Seats: ${selectedSeats.join(", ")}`,
  quantity: selectedSeats.length,
  total,
  createdAt: now,
});
      
      setPurchases((curr) => [
        {
          id: Date.now(),
          eventId: event.id,
          eventTitle: event.title,
          buyerName: buyerName.trim(),
          buyerEmail: buyerEmail.trim(),
          mode: "rows",
          seats: [...selectedSeats],
          quantity: selectedSeats.length,
          total,
          createdAt: now,
        },
        ...curr,
      ]);
      setSelectedSeatIdsByEvent((curr) => ({ ...curr, [event.id]: [] }));
    } else {
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
      setPurchases((curr) => [
        {
          id: Date.now(),
          eventId: event.id,
          eventTitle: event.title,
          buyerName: buyerName.trim(),
          buyerEmail: buyerEmail.trim(),
          mode: "tables",
          seats: [],
          tableName: selectedTable?.name,
          quantity,
          total,
          createdAt: now,
        },
        ...curr,
      ]);
    }

    const doc = buildReceipt();
    doc.save(`${event.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-receipt.pdf`);
  }

  return (
    <div style={pageStyle()}>
      <div style={{ maxWidth: 1200, margin: "0 auto", display: "grid", gap: 20 }}>
        <section style={cardStyle()}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 16,
              flexWrap: "wrap",
            }}
          >
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
                Tickets Standalone
              </h1>
              <p style={{ margin: "10px 0 0", color: "#cbd5e1", maxWidth: 760 }}>
                Rebuilt premium tickets file with rows mode, tables mode, admin controls, background image, seat blocking, and buyer PDF receipt.
              </p>
            </div>

            <button onClick={() => setAdmin((v) => !v)} style={chipStyle(admin)}>
              Admin {admin ? "ON" : "OFF"}
            </button>
          </div>
        </section>

        <section style={cardStyle()}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: 16,
            }}
          >
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
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 16,
                flexWrap: "wrap",
              }}
            >
              <h2 style={{ margin: 0, fontSize: 28 }}>Admin • Tickets</h2>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <button onClick={addEvent} style={chipStyle(false)}>Add Event</button>
                <button onClick={removeCurrentEvent} style={chipStyle(false)}>Remove Current</button>
                <button onClick={() => uploadRef.current?.click()} style={chipStyle(false)}>Background Image</button>
              </div>
            </div>

            <input ref={uploadRef} type="file" accept="image/*" style={{ display: "none" }} onChange={uploadBackground} />

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 16 }}>
              {events.map((e) => (
                <button key={e.id} onClick={() => setActiveEventId(e.id)} style={chipStyle(e.id === event.id)}>
                  {e.title}
                </button>
              ))}
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
                <label style={labelStyle()}>Listing title</label>
                <input
                  value={event.title}
                  onChange={(e) => setEventPatch(event.id, { title: e.target.value })}
                  style={inputStyle()}
                />
              </div>
              <div>
                <label style={labelStyle()}>Event name</label>
                <input
                  value={event.eventName}
                  onChange={(e) => setEventPatch(event.id, { eventName: e.target.value })}
                  style={inputStyle()}
                />
              </div>
              <div>
                <label style={labelStyle()}>Venue</label>
                <input
                  value={event.venue}
                  onChange={(e) => setEventPatch(event.id, { venue: e.target.value })}
                  style={inputStyle()}
                />
              </div>
              <div>
                <label style={labelStyle()}>Ticket price</label>
                <input
                  type="number"
                  min={0}
                  value={draft.price}
                  onChange={(e) => {
                    const v = e.target.value;
                    setDraftPatch(event.id, { price: v });
                    if (v.trim() !== "") {
                      setEventPatch(event.id, { price: Number(v) });
                    }
                  }}
                  style={inputStyle(priceInvalid)}
                />
                <div style={{ marginTop: 6, fontSize: 11, color: priceInvalid ? "#fda4af" : "#64748b" }}>
                  0 allowed while editing. Must be greater than 0 for completion.
                </div>
              </div>
            </div>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 16 }}>
              {(["rows", "tables"] as TicketMode[]).map((m) => (
                <button key={m} onClick={() => setEventPatch(event.id, { mode: m })} style={chipStyle(event.mode === m)}>
                  {m}
                </button>
              ))}
            </div>

            {event.mode === "rows" && (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                  gap: 16,
                  marginTop: 16,
                }}
              >
                <div>
                  <label style={labelStyle()}>Rows</label>
                  <input
                    type="number"
                    min={0}
                    value={draft.rows}
                    onChange={(e) => {
                      const v = e.target.value;
                      setDraftPatch(event.id, { rows: v });
                      if (v.trim() !== "") {
                        setEventPatch(event.id, { rows: Math.max(0, Math.floor(Number(v))) });
                      }
                    }}
                    style={inputStyle(rowsCountInvalid)}
                  />
                  <div style={{ marginTop: 6, fontSize: 11, color: rowsCountInvalid ? "#fda4af" : "#64748b" }}>
                    0 allowed while editing. Must be greater than 0 for completion.
                  </div>
                </div>

                <div>
                  <label style={labelStyle()}>Seats per row</label>
                  <input
                    type="number"
                    min={0}
                    value={draft.seatsPerRow}
                    onChange={(e) => {
                      const v = e.target.value;
                      setDraftPatch(event.id, { seatsPerRow: v });
                      if (v.trim() !== "") {
                        setEventPatch(event.id, { seatsPerRow: Math.max(0, Math.floor(Number(v))) });
                      }
                    }}
                    style={inputStyle(seatsPerRowInvalid)}
                  />
                  <div style={{ marginTop: 6, fontSize: 11, color: seatsPerRowInvalid ? "#fda4af" : "#64748b" }}>
                    0 allowed while editing. Must be greater than 0 for completion.
                  </div>
                </div>

                <div style={summaryCardStyle()}>
                  <div style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: "0.14em", color: "#94a3b8" }}>
                    Availability
                  </div>
                  <div style={{ marginTop: 8, fontWeight: 700, fontSize: 20 }}>{availableRowSeats} available</div>
                  <div style={{ marginTop: 6, color: "#cbd5e1", fontSize: 14 }}>
                    {event.soldSeatIds.length} sold of {totalRowSeats}
                  </div>
                </div>
              </div>
            )}

            {event.mode === "tables" && (
              <div style={{ marginTop: 16, display: "grid", gap: 12 }}>
                <div style={summaryCardStyle()}>
                  <div style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: "0.14em", color: "#94a3b8" }}>
                    Availability
                  </div>
                  <div style={{ marginTop: 8, fontWeight: 700, fontSize: 20 }}>{totalTableSeats - totalSoldTables} available</div>
                  <div style={{ marginTop: 6, color: "#cbd5e1", fontSize: 14 }}>
                    {event.tables.length} tables • {totalSoldTables} sold of {totalTableSeats}
                  </div>
                </div>

                {event.tables.map((table) => {
                  const td = tableDrafts[event.id]?.[table.id] ?? {
                    name: table.name,
                    seats: String(table.seats),
                  };
                  const seatsInvalid = td.seats.trim() === "" || Number(td.seats) <= 0;
                  const nameInvalid = td.name.trim() === "";
                  return (
                    <div
                      key={table.id}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "minmax(220px,1fr) 120px 120px 120px",
                        gap: 12,
                        border: "1px solid rgba(255,255,255,0.10)",
                        background: "rgba(2,6,23,0.55)",
                        borderRadius: 18,
                        padding: 14,
                        alignItems: "center",
                      }}
                    >
                      <div>
                        <input
                          value={td.name}
                          onChange={(e) => {
                            const v = e.target.value;
                            setTableDraftPatch(event.id, table.id, { name: v });
                            setEvents((curr) =>
                              curr.map((ev) =>
                                ev.id === event.id
                                  ? {
                                      ...ev,
                                      tables: ev.tables.map((t) =>
                                        t.id === table.id ? { ...t, name: v } : t,
                                      ),
                                    }
                                  : ev,
                              ),
                            );
                          }}
                          style={inputStyle(nameInvalid)}
                        />
                      </div>

                      <div>
                        <input
                          type="number"
                          min={0}
                          value={td.seats}
                          onChange={(e) => {
                            const v = e.target.value;
                            setTableDraftPatch(event.id, table.id, { seats: v });
                            if (v.trim() !== "") {
                              setEvents((curr) =>
                                curr.map((ev) =>
                                  ev.id === event.id
                                    ? {
                                        ...ev,
                                        tables: ev.tables.map((t) =>
                                          t.id === table.id
                                            ? { ...t, seats: Math.max(0, Math.floor(Number(v))) }
                                            : t,
                                        ),
                                      }
                                    : ev,
                                ),
                              );
                            }
                          }}
                          style={inputStyle(seatsInvalid)}
                        />
                      </div>

                      <div style={summaryCardStyle()}>
                        <div style={{ fontSize: 12, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.14em" }}>
                          Available
                        </div>
                        <div style={{ marginTop: 6, fontWeight: 700 }}>
                          {Math.max(table.seats - table.sold, 0)}
                        </div>
                      </div>

                      <button onClick={() => removeTable(table.id)} style={chipStyle(false)}>
                        Remove
                      </button>
                    </div>
                  );
                })}

                <button onClick={addTable} style={chipStyle(false)}>
                  Add Table
                </button>
                <div style={{ marginTop: 6, fontSize: 11, color: anyTableInvalid ? "#fda4af" : "#64748b" }}>
                  Table names must not be blank. Table seats can be 0 while editing, but must be greater than 0 for completion.
                </div>
              </div>
            )}

            {invalidForCompletion && (
              <div
                style={{
                  marginTop: 16,
                  border: "1px solid rgba(251,113,133,0.35)",
                  background: "rgba(127,29,29,0.18)",
                  borderRadius: 18,
                  padding: 14,
                  color: "#fecdd3",
                }}
              >
                Some required values are blank or 0. They are allowed while editing, but must be greater than 0 for completion.
              </div>
            )}

            <div style={{ marginTop: 22 }}>
              <h3 style={{ marginTop: 0 }}>Purchase data</h3>
              <div style={{ display: "grid", gap: 12 }}>
                {purchases.filter((p) => p.eventId === event.id).length === 0 ? (
                  <div style={{ color: "#94a3b8" }}>No purchases recorded for this event yet.</div>
                ) : (
                  purchases
                    .filter((p) => p.eventId === event.id)
                    .map((p) => (
                      <div
                        key={p.id}
                        style={{
                          border: "1px solid rgba(255,255,255,0.10)",
                          background: "rgba(2,6,23,0.55)",
                          borderRadius: 18,
                          padding: 16,
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            gap: 12,
                            flexWrap: "wrap",
                          }}
                        >
                          <div style={{ fontWeight: 700 }}>{p.buyerName}</div>
                          <div>{money(p.total)}</div>
                        </div>
                        <div style={{ marginTop: 6, color: "#cbd5e1" }}>{p.buyerEmail}</div>
                        <div style={{ marginTop: 6, color: "#cbd5e1" }}>
                          {p.mode === "rows"
                            ? `Seats: ${p.seats.join(", ")}`
                            : `Table: ${p.tableName} • Qty: ${p.quantity}`}
                        </div>
                        <div style={{ marginTop: 6, fontSize: 12, color: "#94a3b8" }}>{p.createdAt}</div>
                      </div>
                    ))
                )}
              </div>
            </div>
          </section>
        )}

        <section
          style={{
            ...cardStyle(),
            backgroundImage: event.background
              ? `linear-gradient(rgba(2,6,23,0.78), rgba(2,6,23,0.78)), url(${event.background})`
              : undefined,
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        >
          <h2 style={{ marginTop: 0, marginBottom: 8, fontSize: 30 }}>{event.title} • Buyer View</h2>
          <p style={{ marginTop: 0, marginBottom: 18, color: "#cbd5e1" }}>
            Buy by rows or by tables depending on the event setup.
          </p>

          {event.mode === "rows" && (
            <>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: `repeat(${Math.max(event.seatsPerRow, 1)}, minmax(0, 1fr))`,
                  gap: 8,
                }}
              >
                {Array.from({ length: event.rows * event.seatsPerRow }).map((_, i) => {
                  const seatId = seatIdForIndex(i, event.seatsPerRow);
                  const isSold = event.soldSeatIds.includes(seatId);
                  const isSelected = selectedSeats.includes(seatId);

                  return (
                    <button
                      key={seatId}
                      type="button"
                      onClick={() => toggleSeat(seatId)}
                      disabled={isSold}
                      style={{
                        aspectRatio: "1 / 1",
                        borderRadius: 18,
                        border: isSold
                          ? "1px solid rgba(251,113,133,0.35)"
                          : isSelected
                          ? "1px solid white"
                          : "1px solid rgba(255,255,255,0.15)",
                        background: isSold
                          ? "rgba(244,63,94,0.22)"
                          : isSelected
                          ? "white"
                          : "rgba(15,23,42,0.72)",
                        color: isSelected ? "#020617" : "white",
                        fontWeight: 700,
                        cursor: isSold ? "not-allowed" : "pointer",
                        opacity: isSold ? 0.82 : 1,
                      }}
                    >
                      {seatId}
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
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                gap: 12,
              }}
            >
              {event.tables.map((table) => (
                <button
                  key={table.id}
                  onClick={() => setSelectedTableByEvent((curr) => ({ ...curr, [event.id]: table.id }))}
                  style={{
                    border:
                      selectedTableId === table.id
                        ? "1px solid rgba(125,211,252,0.35)"
                        : "1px solid rgba(255,255,255,0.10)",
                    background:
                      selectedTableId === table.id
                        ? "rgba(255,255,255,0.12)"
                        : "rgba(2,6,23,0.55)",
                    color: "white",
                    borderRadius: 20,
                    padding: 16,
                    textAlign: "left",
                    cursor: "pointer",
                  }}
                >
                  <div style={{ fontWeight: 700 }}>{table.name}</div>
                  <div style={{ marginTop: 6, color: "#cbd5e1" }}>
                    {Math.max(table.seats - table.sold, 0)} available of {table.seats}
                  </div>
                </button>
              ))}
            </div>
          )}

          {event.mode === "tables" && (
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

          <div style={summaryCardStyle()}>
            <div style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: "0.14em", color: "#94a3b8" }}>
              {event.mode === "rows" ? "Selected seats" : "Selected table"}
            </div>

            <div style={{ marginTop: 8, color: "#e2e8f0" }}>
              {event.mode === "rows"
                ? selectedSeats.length
                  ? selectedSeats.join(", ")
                  : "None selected"
                : selectedTable
                ? `${selectedTable.name} • ${availableSelectedTable} seats available`
                : "No table selected"}
            </div>

            <div
              style={{
                marginTop: 14,
                display: "flex",
                justifyContent: "space-between",
                gap: 12,
                flexWrap: "wrap",
              }}
            >
              <div style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: "0.14em", color: "#94a3b8" }}>
                Amount due
              </div>
              <div style={{ fontWeight: 700, fontSize: 22 }}>{money(total)}</div>
            </div>

            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 16 }}>
              <button
                onClick={buyTickets}
                disabled={!canBuy}
                style={{
                  flex: 1,
                  minWidth: 220,
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

              <button onClick={downloadReceipt} style={{ ...secondaryButtonStyle(), flex: 1, minWidth: 220 }}>
                Download PDF Receipt
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
