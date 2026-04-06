import { appendLedger } from "./purchaseLedger";
import React, { useMemo, useRef, useState } from "react";
import { jsPDF } from "jspdf";

type RaffleColor = "Red" | "Blue" | "Green" | "Yellow" | "Purple" | "Orange";

type RaffleEvent = {
  id: number;
  title: string;
  eventName: string;
  venue: string;
  price: number;
  startNumber: number;
  totalTickets: number;
  colors: RaffleColor[];
  soldByColor: Record<RaffleColor, number[]>;
  background?: string;
};

type RafflePurchase = {
  id: number;
  eventId: number;
  eventTitle: string;
  buyerName: string;
  buyerEmail: string;
  color: RaffleColor;
  tickets: number[];
  quantity: number;
  total: number;
  createdAt: string;
};

type Drafts = Record<number, {
  price: string;
  startNumber: string;
  totalTickets: string;
}>;

const ALL_COLORS: RaffleColor[] = ["Red", "Blue", "Green", "Yellow", "Purple", "Orange"];

function money(n: number) {
  return `£${n.toFixed(2)}`;
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

function summaryCardStyle(): React.CSSProperties {
  return {
    ...cardStyle(),
    padding: 16,
    borderRadius: 20,
  };
}

function colorBadgeStyle(color: RaffleColor, active = false): React.CSSProperties {
  const map: Record<RaffleColor, string> = {
    Red: "rgba(239,68,68,0.22)",
    Blue: "rgba(59,130,246,0.22)",
    Green: "rgba(34,197,94,0.22)",
    Yellow: "rgba(234,179,8,0.22)",
    Purple: "rgba(168,85,247,0.22)",
    Orange: "rgba(249,115,22,0.22)",
  };
  return {
    border: active ? "1px solid white" : "1px solid rgba(255,255,255,0.10)",
    background: map[color],
    color: "white",
    borderRadius: 18,
    padding: "12px 16px",
    fontWeight: 700,
    cursor: "pointer",
    textAlign: "center",
  };
}

function clampPositiveInt(n: number, fallback = 1) {
  if (!Number.isFinite(n)) return fallback;
  return Math.max(1, Math.floor(n));
}

function buildInitialSold(colors: RaffleColor[]): Record<RaffleColor, number[]> {
  return ALL_COLORS.reduce((acc, c) => {
    acc[c] = colors.includes(c) ? [] : [];
    return acc;
  }, {} as Record<RaffleColor, number[]>);
}

export default function RaffleSection() {
  const [admin, setAdmin] = useState(true);
  const [buyerName, setBuyerName] = useState("");
  const [buyerEmail, setBuyerEmail] = useState("");

  const [events, setEvents] = useState<RaffleEvent[]>([
    {
      id: 1,
      title: "Main Raffle",
      eventName: "Main Raffle",
      venue: "Club Hall",
      price: 2,
      startNumber: 1,
      totalTickets: 100,
      colors: ["Red", "Blue", "Green"],
      soldByColor: {
        Red: [1, 2, 8],
        Blue: [3, 10],
        Green: [5],
        Yellow: [],
        Purple: [],
        Orange: [],
      },
      background: "",
    },
  ]);

  const [activeEventId, setActiveEventId] = useState(1);
  const [drafts, setDrafts] = useState<Drafts>({
    1: { price: "2", startNumber: "1", totalTickets: "100" },
  });
  const [selectedColorByEvent, setSelectedColorByEvent] = useState<Record<number, RaffleColor>>({
    1: "Red",
  });
  const [selectedTicketsByEvent, setSelectedTicketsByEvent] = useState<Record<number, number[]>>({
    1: [],
  });
  const [purchases, setPurchases] = useState<RafflePurchase[]>([]);
  const uploadRef = useRef<HTMLInputElement | null>(null);

  const event = events.find((e) => e.id === activeEventId) ?? events[0];
  const draft = drafts[event.id] ?? {
    price: String(event.price),
    startNumber: String(event.startNumber),
    totalTickets: String(event.totalTickets),
  };
  const selectedColor = selectedColorByEvent[event.id] ?? event.colors[0] ?? "Red";
  const selectedTickets = selectedTicketsByEvent[event.id] ?? [];
  const soldForSelectedColor = event.soldByColor[selectedColor] ?? [];
  const availableForSelectedColor = event.totalTickets - soldForSelectedColor.length;
  const total = selectedTickets.length * event.price;

  const priceInvalid = draft.price.trim() === "" || Number(draft.price) <= 0;
  const startInvalid = draft.startNumber.trim() === "" || Number(draft.startNumber) <= 0;
  const totalInvalid = draft.totalTickets.trim() === "" || Number(draft.totalTickets) <= 0;
  const colorsInvalid = event.colors.length === 0;
  const invalidForCompletion = priceInvalid || startInvalid || totalInvalid || colorsInvalid;

  const canBuy =
    buyerName.trim() !== "" &&
    buyerEmail.trim() !== "" &&
    selectedColor &&
    selectedTickets.length > 0 &&
    !invalidForCompletion;

  const visibleTicketNumbers = useMemo(() => {
    const start = event.startNumber;
    return Array.from({ length: event.totalTickets }, (_, i) => start + i);
  }, [event.startNumber, event.totalTickets]);

  function setEventPatch(id: number, patch: Partial<RaffleEvent>) {
    setEvents((curr) => curr.map((e) => (e.id === id ? { ...e, ...patch } : e)));
  }

  function setDraftPatch(id: number, patch: Partial<Drafts[number]>) {
    setDrafts((curr) => ({
      ...curr,
      [id]: { ...(curr[id] ?? { price: "", startNumber: "", totalTickets: "" }), ...patch },
    }));
  }

  function addEvent() {
    const id = Date.now();
    const colors: RaffleColor[] = ["Red", "Blue"];
    const newEvent: RaffleEvent = {
      id,
      title: `New Raffle ${events.length + 1}`,
      eventName: "New Raffle",
      venue: "Venue",
      price: 0,
      startNumber: 0,
      totalTickets: 0,
      colors,
      soldByColor: buildInitialSold(colors),
      background: "",
    };
    setEvents((curr) => [...curr, newEvent]);
    setDrafts((curr) => ({ ...curr, [id]: { price: "0", startNumber: "0", totalTickets: "0" } }));
    setSelectedColorByEvent((curr) => ({ ...curr, [id]: "Red" }));
    setSelectedTicketsByEvent((curr) => ({ ...curr, [id]: [] }));
    setActiveEventId(id);
  }

  function removeCurrentEvent() {
    if (events.length <= 1) return;
    const remaining = events.filter((e) => e.id !== event.id);
    setEvents(remaining);
    setActiveEventId(remaining[0].id);
  }

  function toggleColor(color: RaffleColor) {
    setSelectedColorByEvent((curr) => ({ ...curr, [event.id]: color }));
    setSelectedTicketsByEvent((curr) => ({ ...curr, [event.id]: [] }));
  }

  function toggleTicketNumber(ticketNo: number) {
    if (soldForSelectedColor.includes(ticketNo)) return;
    setSelectedTicketsByEvent((curr) => {
      const existing = curr[event.id] ?? [];
      const next = existing.includes(ticketNo)
        ? existing.filter((n) => n !== ticketNo)
        : [...existing, ticketNo].sort((a, b) => a - b);
      return { ...curr, [event.id]: next };
    });
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

  function toggleAdminColor(color: RaffleColor) {
    const exists = event.colors.includes(color);
    const nextColors = exists
      ? event.colors.filter((c) => c !== color)
      : [...event.colors, color];

    const nextSelected = nextColors.includes(selectedColor) ? selectedColor : nextColors[0] ?? "Red";

    setEvents((curr) =>
      curr.map((e) =>
        e.id === event.id
          ? {
              ...e,
              colors: nextColors,
              soldByColor: {
                ...e.soldByColor,
                [color]: e.soldByColor[color] ?? [],
              },
            }
          : e,
      ),
    );

    setSelectedColorByEvent((curr) => ({ ...curr, [event.id]: nextSelected }));
    setSelectedTicketsByEvent((curr) => ({ ...curr, [event.id]: [] }));
  }

  function downloadReceipt() {
    const doc = new jsPDF();
    doc.setFontSize(20);
    doc.text("Raffle Purchase Receipt", 20, 22);
    doc.setFontSize(12);
    doc.text(`Raffle: ${event.title}`, 20, 38);
    doc.text(`Buyer: ${buyerName || "Not entered"}`, 20, 48);
    doc.text(`Email: ${buyerEmail || "Not entered"}`, 20, 58);
    doc.text(`Color: ${selectedColor}`, 20, 68);
    doc.text(`Tickets: ${selectedTickets.length ? selectedTickets.join(", ") : "None"}`, 20, 78);
    doc.text(`Quantity: ${selectedTickets.length}`, 20, 88);
    doc.text(`Price each: ${money(event.price)}`, 20, 98);
    doc.text(`Total: ${money(total)}`, 20, 108);
    doc.save("buyer-raffle-receipt.pdf");
  }

  function buyRaffleTickets() {
    if (!canBuy) return;

    const now = new Date().toLocaleString();

    setEvents((curr) =>
      curr.map((e) =>
        e.id === event.id
          ? {
              ...e,
              soldByColor: {
                ...e.soldByColor,
                [selectedColor]: [...(e.soldByColor[selectedColor] ?? []), ...selectedTickets].sort((a, b) => a - b),
              },
            }
          : e,
      ),
    );
appendLedger({
  id: String(Date.now()),
  module: "raffle",
  itemTitle: event.title,
  buyerName: buyerName.trim(),
  buyerEmail: buyerEmail.trim(),
  description: `${selectedColor}: ${selectedTickets.join(", ")}`,
  quantity: selectedTickets.length,
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
        color: selectedColor,
        tickets: [...selectedTickets],
        quantity: selectedTickets.length,
        total,
        createdAt: now,
      },
      ...curr,
    ]);

    setSelectedTicketsByEvent((curr) => ({ ...curr, [event.id]: [] }));
    downloadReceipt();
  }

  const eventPurchaseData = purchases.filter((p) => p.eventId === event.id);

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
                Raffle Standalone
              </h1>
              <p style={{ margin: "10px 0 0", color: "#cbd5e1", maxWidth: 760 }}>
                Premium raffle section with multiple raffles, color ticket books, admin controls, sold blocking, purchase data, and PDF receipts.
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
              <h2 style={{ margin: 0, fontSize: 28 }}>Admin • Raffle</h2>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <button onClick={addEvent} style={chipStyle(false)}>Add Raffle</button>
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

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16, marginTop: 18 }}>
              <div>
                <label style={labelStyle()}>Listing title</label>
                <input value={event.title} onChange={(e) => setEventPatch(event.id, { title: e.target.value })} style={inputStyle()} />
              </div>
              <div>
                <label style={labelStyle()}>Event name</label>
                <input value={event.eventName} onChange={(e) => setEventPatch(event.id, { eventName: e.target.value })} style={inputStyle()} />
              </div>
              <div>
                <label style={labelStyle()}>Venue</label>
                <input value={event.venue} onChange={(e) => setEventPatch(event.id, { venue: e.target.value })} style={inputStyle()} />
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

              <div>
                <label style={labelStyle()}>Start number</label>
                <input
                  type="number"
                  min={0}
                  value={draft.startNumber}
                  onChange={(e) => {
                    const v = e.target.value;
                    setDraftPatch(event.id, { startNumber: v });
                    if (v.trim() !== "") {
                      setEventPatch(event.id, { startNumber: Math.max(0, Math.floor(Number(v))) });
                    }
                  }}
                  style={inputStyle(startInvalid)}
                />
                <div style={{ marginTop: 6, fontSize: 11, color: startInvalid ? "#fda4af" : "#64748b" }}>
                  0 allowed while editing. Must be greater than 0 for completion.
                </div>
              </div>

              <div>
                <label style={labelStyle()}>Tickets per color</label>
                <input
                  type="number"
                  min={0}
                  value={draft.totalTickets}
                  onChange={(e) => {
                    const v = e.target.value;
                    setDraftPatch(event.id, { totalTickets: v });
                    if (v.trim() !== "") {
                      setEventPatch(event.id, { totalTickets: Math.max(0, Math.floor(Number(v))) });
                    }
                  }}
                  style={inputStyle(totalInvalid)}
                />
                <div style={{ marginTop: 6, fontSize: 11, color: totalInvalid ? "#fda4af" : "#64748b" }}>
                  0 allowed while editing. Must be greater than 0 for completion.
                </div>
              </div>

              <div style={summaryCardStyle()}>
                <div style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: "0.14em", color: "#94a3b8" }}>
                  Availability
                </div>
                <div style={{ marginTop: 8, fontWeight: 700, fontSize: 20 }}>
                  {availableForSelectedColor} available
                </div>
                <div style={{ marginTop: 6, color: "#cbd5e1", fontSize: 14 }}>
                  {soldForSelectedColor.length} sold of {event.totalTickets} for {selectedColor}
                </div>
              </div>
            </div>

            <div style={{ marginTop: 18 }}>
              <div style={{ ...labelStyle(), marginBottom: 12 }}>Colors to sell</div>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                {ALL_COLORS.map((color) => (
                  <button
                    key={color}
                    onClick={() => toggleAdminColor(color)}
                    style={colorBadgeStyle(color, event.colors.includes(color))}
                  >
                    {color}
                  </button>
                ))}
              </div>
              <div style={{ marginTop: 8, fontSize: 11, color: colorsInvalid ? "#fda4af" : "#64748b" }}>
                Select one or more color books for this raffle.
              </div>
            </div>

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
                {eventPurchaseData.length === 0 ? (
                  <div style={{ color: "#94a3b8" }}>No purchases recorded for this raffle yet.</div>
                ) : (
                  eventPurchaseData.map((purchase) => (
                    <div
                      key={purchase.id}
                      style={{
                        border: "1px solid rgba(255,255,255,0.10)",
                        background: "rgba(2,6,23,0.55)",
                        borderRadius: 18,
                        padding: 16,
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                        <div style={{ fontWeight: 700 }}>{purchase.buyerName}</div>
                        <div>{money(purchase.total)}</div>
                      </div>
                      <div style={{ marginTop: 6, color: "#cbd5e1" }}>{purchase.buyerEmail}</div>
                      <div style={{ marginTop: 6, color: "#cbd5e1" }}>
                        {purchase.color}: {purchase.tickets.join(", ")}
                      </div>
                      <div style={{ marginTop: 6, fontSize: 12, color: "#94a3b8" }}>{purchase.createdAt}</div>
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
            Choose a raffle color, then select the ticket numbers you want. Sold tickets are blocked to avoid duplication.
          </p>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 18 }}>
            {event.colors.map((color) => (
              <button key={color} onClick={() => toggleColor(color)} style={colorBadgeStyle(color, selectedColor === color)}>
                {color}
              </button>
            ))}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(10, minmax(0, 1fr))", gap: 8 }}>
            {visibleTicketNumbers.map((ticketNo) => {
              const isSold = soldForSelectedColor.includes(ticketNo);
              const isSelected = selectedTickets.includes(ticketNo);

              return (
                <button
                  key={ticketNo}
                  type="button"
                  onClick={() => toggleTicketNumber(ticketNo)}
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
                  {ticketNo}
                </button>
              );
            })}
          </div>

          <div style={{ marginTop: 10, color: "#94a3b8", fontSize: 12 }}>
            Sold tickets are blocked and remain sold after purchase for the selected color.
          </div>

          <div style={summaryCardStyle()}>
            <div style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: "0.14em", color: "#94a3b8" }}>
              Selected tickets
            </div>

            <div style={{ marginTop: 8, color: "#e2e8f0" }}>
              {selectedTickets.length ? `${selectedColor}: ${selectedTickets.join(", ")}` : "None selected"}
            </div>

            <div style={{ marginTop: 14, display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
              <div style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: "0.14em", color: "#94a3b8" }}>
                Amount due
              </div>
              <div style={{ fontWeight: 700, fontSize: 22 }}>{money(total)}</div>
            </div>

            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 16 }}>
              <button
                onClick={buyRaffleTickets}
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
                Buy Raffle Tickets
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
