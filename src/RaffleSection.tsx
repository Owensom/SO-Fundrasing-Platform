import { appendLedger } from "./purchaseLedger";
import React, { useMemo, useRef, useState } from "react";
import { jsPDF } from "jspdf";
import { useAdminAuth } from "./useAdminAuth";
import { adminFetch } from "./api";

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

type Drafts = Record<
  number,
  {
    price: string;
    startNumber: string;
    totalTickets: string;
  }
>;

type SelectedTicketsByEvent = Record<number, Record<RaffleColor, number[]>>;

type RafflePurchase = {
  id: number;
  eventId: number;
  eventTitle: string;
  buyerName: string;
  buyerEmail: string;
  selections: Record<RaffleColor, number[]>;
  quantity: number;
  subtotal: number;
  total: number;
  createdAt: string;
};

const ALL_COLORS: RaffleColor[] = ["Red", "Blue", "Green", "Yellow", "Purple", "Orange"];

/**
 * Example offer pricing:
 * 5 tickets for £8
 * 10 tickets for £15
 */
const OFFER_TIERS = [
  { quantity: 10, price: 15 },
  { quantity: 5, price: 8 },
];

function money(n: number) {
  return `£${Number.isFinite(n) ? n.toFixed(2) : "0.00"}`;
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

function buildInitialSold(): Record<RaffleColor, number[]> {
  return ALL_COLORS.reduce((acc, color) => {
    acc[color] = [];
    return acc;
  }, {} as Record<RaffleColor, number[]>);
}

function buildEmptyColorSelection(): Record<RaffleColor, number[]> {
  return ALL_COLORS.reduce((acc, color) => {
    acc[color] = [];
    return acc;
  }, {} as Record<RaffleColor, number[]>);
}

function calculateOfferTotal(quantity: number, singlePrice: number) {
  const tiers = [...OFFER_TIERS].sort((a, b) => b.quantity - a.quantity);

  let remaining = quantity;
  let total = 0;
  const applied: string[] = [];

  for (const tier of tiers) {
    const count = Math.floor(remaining / tier.quantity);
    if (count > 0) {
      total += count * tier.price;
      remaining -= count * tier.quantity;
      applied.push(`${count} x ${tier.quantity} for ${money(tier.price)}`);
    }
  }

  total += remaining * singlePrice;

  return {
    total,
    applied,
    remainder: remaining,
  };
}

export default function RaffleSection() {
  const { isAdmin, loading } = useAdminAuth();

  const [buyerName, setBuyerName] = useState("");
  const [buyerEmail, setBuyerEmail] = useState("");
  const [adminBusy, setAdminBusy] = useState(false);
  const [adminMessage, setAdminMessage] = useState("");

  const [events, setEvents] = useState<RaffleEvent[]>([
    {
      id: 1,
      title: "Main Raffle",
      eventName: "Main Raffle",
      venue: "Club Hall",
      price: 2,
      startNumber: 1,
      totalTickets: 100,
      colors: ["Red", "Blue", "Green", "Yellow"],
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

  const [selectedTicketsByEvent, setSelectedTicketsByEvent] = useState<SelectedTicketsByEvent>({
    1: buildEmptyColorSelection(),
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
  const eventSelections = selectedTicketsByEvent[event.id] ?? buildEmptyColorSelection();
  const selectedTicketsForActiveColor = eventSelections[selectedColor] ?? [];
  const soldForSelectedColor = event.soldByColor[selectedColor] ?? [];
  const availableForSelectedColor = event.totalTickets - soldForSelectedColor.length;

  const visibleTicketNumbers = useMemo(() => {
    return Array.from({ length: event.totalTickets }, (_, i) => event.startNumber + i);
  }, [event.startNumber, event.totalTickets]);

  const totalSelectedCount = useMemo(() => {
    return event.colors.reduce((sum, color) => {
      return sum + (eventSelections[color]?.length ?? 0);
    }, 0);
  }, [event.colors, eventSelections]);

  const subtotal = totalSelectedCount * event.price;
  const offer = calculateOfferTotal(totalSelectedCount, event.price);
  const total = offer.total;
  const savings = subtotal - total;

  const selectedSummary = useMemo(() => {
    const rows = event.colors
      .map((color) => {
        const tickets = eventSelections[color] ?? [];
        if (!tickets.length) return null;
        return `${color}: ${tickets.join(", ")}`;
      })
      .filter(Boolean);

    return rows.length ? rows.join(" • ") : "None selected";
  }, [event.colors, eventSelections]);

  const priceInvalid = draft.price.trim() === "" || Number(draft.price) <= 0;
  const startInvalid = draft.startNumber.trim() === "" || Number(draft.startNumber) <= 0;
  const totalInvalid = draft.totalTickets.trim() === "" || Number(draft.totalTickets) <= 0;
  const colorsInvalid = event.colors.length === 0;
  const invalidForCompletion = priceInvalid || startInvalid || totalInvalid || colorsInvalid;

  const canBuy =
    buyerName.trim() !== "" &&
    buyerEmail.trim() !== "" &&
    totalSelectedCount > 0 &&
    !invalidForCompletion;

  function setEventPatch(id: number, patch: Partial<RaffleEvent>) {
    setEvents((curr) => curr.map((e) => (e.id === id ? { ...e, ...patch } : e)));
  }

  function setDraftPatch(id: number, patch: Partial<Drafts[number]>) {
    setDrafts((curr) => ({
      ...curr,
      [id]: {
        ...(curr[id] ?? { price: "", startNumber: "", totalTickets: "" }),
        ...patch,
      },
    }));
  }

  function ensureEventSelectionExists(eventId: number) {
    setSelectedTicketsByEvent((curr) => ({
      ...curr,
      [eventId]: curr[eventId] ?? buildEmptyColorSelection(),
    }));
  }

  async function addEvent() {
    if (!isAdmin) return;

    setAdminMessage("");
    setAdminBusy(true);

    try {
      const payload = {
        title: `New Raffle ${events.length + 1}`,
        eventName: "New Raffle",
        venue: "Venue",
        price: 0,
        startNumber: 0,
        totalTickets: 0,
        colors: ["Red", "Blue"],
        soldByColor: buildInitialSold(),
        background: "",
      };

      const saved = await adminFetch("/api/raffles", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      const newEvent: RaffleEvent = {
        id: saved.id,
        title: saved.title,
        eventName: saved.eventName,
        venue: saved.venue,
        price: saved.price,
        startNumber: saved.startNumber,
        totalTickets: saved.totalTickets,
        colors: saved.colors ?? ["Red", "Blue"],
        soldByColor: saved.soldByColor ?? buildInitialSold(),
        background: saved.background ?? "",
      };

      setEvents((curr) => [...curr, newEvent]);
      setDrafts((curr) => ({
        ...curr,
        [newEvent.id]: {
          price: String(newEvent.price),
          startNumber: String(newEvent.startNumber),
          totalTickets: String(newEvent.totalTickets),
        },
      }));
      setSelectedColorByEvent((curr) => ({ ...curr, [newEvent.id]: newEvent.colors[0] ?? "Red" }));
      setSelectedTicketsByEvent((curr) => ({ ...curr, [newEvent.id]: buildEmptyColorSelection() }));
      setActiveEventId(newEvent.id);
      setAdminMessage("Raffle created.");
    } catch (err) {
      setAdminMessage(err instanceof Error ? err.message : "Unable to add raffle.");
    } finally {
      setAdminBusy(false);
    }
  }

  async function removeCurrentEvent() {
    if (!isAdmin || events.length <= 1) return;

    setAdminMessage("");
    setAdminBusy(true);

    try {
      await adminFetch(`/api/raffles/${event.id}`, {
        method: "DELETE",
      });

      const remaining = events.filter((e) => e.id !== event.id);
      setEvents(remaining);
      setActiveEventId(remaining[0].id);

      setDrafts((curr) => {
        const next = { ...curr };
        delete next[event.id];
        return next;
      });

      setSelectedColorByEvent((curr) => {
        const next = { ...curr };
        delete next[event.id];
        return next;
      });

      setSelectedTicketsByEvent((curr) => {
        const next = { ...curr };
        delete next[event.id];
        return next;
      });

      setAdminMessage("Raffle removed.");
    } catch (err) {
      setAdminMessage(err instanceof Error ? err.message : "Unable to remove raffle.");
    } finally {
      setAdminBusy(false);
    }
  }

  function toggleColor(color: RaffleColor) {
    ensureEventSelectionExists(event.id);
    setSelectedColorByEvent((curr) => ({ ...curr, [event.id]: color }));
  }

  function toggleTicketNumber(ticketNo: number) {
    if (soldForSelectedColor.includes(ticketNo)) return;

    setSelectedTicketsByEvent((curr) => {
      const existingEventSelections = curr[event.id] ?? buildEmptyColorSelection();
      const currentColorTickets = existingEventSelections[selectedColor] ?? [];

      const nextTickets = currentColorTickets.includes(ticketNo)
        ? currentColorTickets.filter((n) => n !== ticketNo)
        : [...currentColorTickets, ticketNo].sort((a, b) => a - b);

      return {
        ...curr,
        [event.id]: {
          ...existingEventSelections,
          [selectedColor]: nextTickets,
        },
      };
    });
  }

  function clearSelections() {
    setSelectedTicketsByEvent((curr) => ({
      ...curr,
      [event.id]: buildEmptyColorSelection(),
    }));
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
    const nextColors = exists ? event.colors.filter((c) => c !== color) : [...event.colors, color];
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
          : e
      )
    );

    setSelectedColorByEvent((curr) => ({ ...curr, [event.id]: nextSelected }));

    if (exists) {
      setSelectedTicketsByEvent((curr) => {
        const eventSelections = curr[event.id] ?? buildEmptyColorSelection();
        return {
          ...curr,
          [event.id]: {
            ...eventSelections,
            [color]: [],
          },
        };
      });
    }
  }

  async function saveCurrentEvent() {
    if (!isAdmin) return;

    setAdminMessage("");
    setAdminBusy(true);

    try {
      await adminFetch(`/api/raffles/${event.id}`, {
        method: "PUT",
        body: JSON.stringify({
          title: event.title,
          eventName: event.eventName,
          venue: event.venue,
          price: event.price,
          startNumber: event.startNumber,
          totalTickets: event.totalTickets,
          colors: event.colors,
          soldByColor: event.soldByColor,
          background: event.background ?? "",
        }),
      });

      setAdminMessage("Raffle saved.");
    } catch (err) {
      setAdminMessage(err instanceof Error ? err.message : "Unable to save raffle.");
    } finally {
      setAdminBusy(false);
    }
  }

  function downloadReceipt(purchase?: RafflePurchase) {
    const selections = purchase?.selections ?? eventSelections;
    const quantity = purchase?.quantity ?? totalSelectedCount;
    const subtotalValue = purchase?.subtotal ?? subtotal;
    const totalValue = purchase?.total ?? total;
    const buyer = purchase?.buyerName ?? buyerName;
    const email = purchase?.buyerEmail ?? buyerEmail;
    const createdAt = purchase?.createdAt ?? new Date().toLocaleString();

    const lines = event.colors
      .map((color) => {
        const tickets = selections[color] ?? [];
        if (!tickets.length) return null;
        return `${color}: ${tickets.join(", ")}`;
      })
      .filter(Boolean) as string[];

    const doc = new jsPDF();
    let y = 22;

    doc.setFontSize(20);
    doc.text("Raffle Purchase Receipt", 20, y);
    y += 16;

    doc.setFontSize(12);
    doc.text(`Raffle: ${event.title}`, 20, y);
    y += 10;
    doc.text(`Buyer: ${buyer || "Not entered"}`, 20, y);
    y += 10;
    doc.text(`Email: ${email || "Not entered"}`, 20, y);
    y += 10;
    doc.text(`Purchased: ${createdAt}`, 20, y);
    y += 14;

    doc.text(`Quantity: ${quantity}`, 20, y);
    y += 10;
    doc.text(`Standard subtotal: ${money(subtotalValue)}`, 20, y);
    y += 10;
    doc.text(`Total paid: ${money(totalValue)}`, 20, y);
    y += 14;

    doc.text("Selections:", 20, y);
    y += 10;

    if (!lines.length) {
      doc.text("None", 20, y);
    } else {
      lines.forEach((line) => {
        const wrapped = doc.splitTextToSize(line, 170);
        doc.text(wrapped, 20, y);
        y += wrapped.length * 8;
      });
    }

    doc.save("buyer-raffle-receipt.pdf");
  }

  function buyRaffleTickets() {
    if (!canBuy) return;

    const now = new Date().toLocaleString();

    const cleanedSelections = ALL_COLORS.reduce((acc, color) => {
      acc[color] = [...(eventSelections[color] ?? [])].sort((a, b) => a - b);
      return acc;
    }, {} as Record<RaffleColor, number[]>);

    setEvents((curr) =>
      curr.map((e) =>
        e.id === event.id
          ? {
              ...e,
              soldByColor: ALL_COLORS.reduce((soldAcc, color) => {
                const existing = e.soldByColor[color] ?? [];
                const added = cleanedSelections[color] ?? [];
                soldAcc[color] = [...existing, ...added].sort((a, b) => a - b);
                return soldAcc;
              }, {} as Record<RaffleColor, number[]>),
            }
          : e
      )
    );

    const description = event.colors
      .map((color) => {
        const tickets = cleanedSelections[color] ?? [];
        if (!tickets.length) return null;
        return `${color}: ${tickets.join(", ")}`;
      })
      .filter(Boolean)
      .join(" | ");

    appendLedger({
      id: String(Date.now()),
      module: "raffle",
      itemTitle: event.title,
      buyerName: buyerName.trim(),
      buyerEmail: buyerEmail.trim(),
      description,
      quantity: totalSelectedCount,
      total,
      createdAt: now,
    });

    const purchase: RafflePurchase = {
      id: Date.now(),
      eventId: event.id,
      eventTitle: event.title,
      buyerName: buyerName.trim(),
      buyerEmail: buyerEmail.trim(),
      selections: cleanedSelections,
      quantity: totalSelectedCount,
      subtotal,
      total,
      createdAt: now,
    };

    setPurchases((curr) => [purchase, ...curr]);

    setSelectedTicketsByEvent((curr) => ({
      ...curr,
      [event.id]: buildEmptyColorSelection(),
    }));

    setBuyerName("");
    setBuyerEmail("");

    downloadReceipt(purchase);
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
                Buyers can mix colours in one basket and offer pricing applies across the combined total.
              </p>
            </div>

            <div
              style={{
                border: "1px solid rgba(255,255,255,0.10)",
                background: "rgba(255,255,255,0.08)",
                borderRadius: 999,
                padding: "10px 14px",
                fontSize: 12,
                color: loading ? "#cbd5e1" : isAdmin ? "#86efac" : "#cbd5e1",
              }}
            >
              {loading ? "Checking admin..." : isAdmin ? "Admin logged in" : "Buyer mode"}
            </div>
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

        {!loading && isAdmin && (
          <section style={cardStyle()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
              <h2 style={{ margin: 0, fontSize: 28 }}>Admin • Raffle</h2>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <button onClick={addEvent} disabled={adminBusy} style={chipStyle(false)}>
                  Add Raffle
                </button>
                <button onClick={removeCurrentEvent} disabled={adminBusy} style={chipStyle(false)}>
                  Remove Current
                </button>
                <button onClick={() => uploadRef.current?.click()} disabled={adminBusy} style={chipStyle(false)}>
                  Background Image
                </button>
                <button onClick={saveCurrentEvent} disabled={adminBusy} style={chipStyle(false)}>
                  Save Raffle
                </button>
              </div>
            </div>

            <input
              ref={uploadRef}
              type="file"
              accept="image/*"
              style={{ display: "none" }}
              onChange={uploadBackground}
            />

            {adminMessage && (
              <div
                style={{
                  marginTop: 14,
                  border: "1px solid rgba(255,255,255,0.10)",
                  background: "rgba(2,6,23,0.55)",
                  borderRadius: 16,
                  padding: 12,
                  color: "#cbd5e1",
                }}
              >
                {adminMessage}
              </div>
            )}

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
                  step="0.01"
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
                        {event.colors
                          .map((color) => {
                            const nums = purchase.selections[color] ?? [];
                            return nums.length ? `${color}: ${nums.join(", ")}` : null;
                          })
                          .filter(Boolean)
                          .join(" • ")}
                      </div>
                      <div style={{ marginTop: 6, fontSize: 12, color: "#94a3b8" }}>
                        {purchase.quantity} tickets • subtotal {money(purchase.subtotal)} • paid {money(purchase.total)}
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
            Select tickets in one colour, switch colours, and keep building the same basket until purchase.
          </p>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 18 }}>
            {event.colors.map((color) => {
              const count = eventSelections[color]?.length ?? 0;
              return (
                <button
                  key={color}
                  onClick={() => toggleColor(color)}
                  style={colorBadgeStyle(color, selectedColor === color)}
                >
                  {color}
                  {count > 0 ? ` (${count})` : ""}
                </button>
              );
            })}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(10, minmax(0, 1fr))", gap: 8 }}>
            {visibleTicketNumbers.map((ticketNo) => {
              const isSold = soldForSelectedColor.includes(ticketNo);
              const isSelected = selectedTicketsForActiveColor.includes(ticketNo);

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
            Your selections are stored per colour and remain in the basket until purchase or clear.
          </div>

          <div style={{ marginTop: 18, ...summaryCardStyle() }}>
            <div style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: "0.14em", color: "#94a3b8" }}>
              Selected tickets
            </div>

            <div style={{ marginTop: 8, color: "#e2e8f0" }}>{selectedSummary}</div>

            <div style={{ marginTop: 14, display: "grid", gap: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                <div style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: "0.14em", color: "#94a3b8" }}>
                  Total tickets
                </div>
                <div style={{ fontWeight: 700 }}>{totalSelectedCount}</div>
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                <div style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: "0.14em", color: "#94a3b8" }}>
                  Standard subtotal
                </div>
                <div style={{ fontWeight: 700 }}>{money(subtotal)}</div>
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                <div style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: "0.14em", color: "#94a3b8" }}>
                  Offer pricing total
                </div>
                <div style={{ fontWeight: 700, fontSize: 22 }}>{money(total)}</div>
              </div>

              {savings > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                  <div style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: "0.14em", color: "#94a3b8" }}>
                    Savings
                  </div>
                  <div style={{ fontWeight: 700 }}>{money(savings)}</div>
                </div>
              )}

              {offer.applied.length > 0 && (
                <div style={{ fontSize: 12, color: "#94a3b8" }}>
                  Offer applied: {offer.applied.join(" + ")}
                  {offer.remainder > 0 ? ` + ${offer.remainder} at ${money(event.price)} each` : ""}
                </div>
              )}
            </div>

            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 16 }}>
              <button onClick={clearSelections} style={{ ...secondaryButtonStyle(), flex: 1, minWidth: 220 }}>
                Clear Selection
              </button>

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

              <button onClick={() => downloadReceipt()} style={{ ...secondaryButtonStyle(), flex: 1, minWidth: 220 }}>
                Download PDF Receipt
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
