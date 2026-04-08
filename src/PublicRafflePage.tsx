import React, { useEffect, useMemo, useState } from "react";
import { jsPDF } from "jspdf";
import { publicApiFetch } from "./api";

type RaffleColor = "Red" | "Blue" | "Green" | "Yellow" | "Purple" | "Orange";

type PublicTenant = {
  id: string;
  name: string;
  slug: string;
};

type RaffleEvent = {
  id: string;
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

type SelectedTicketsByEvent = Record<string, Record<RaffleColor, number[]>>;

type Purchase = {
  id: string;
  itemTitle: string;
  buyerName: string;
  buyerEmail: string;
  quantity: number;
  subtotal: number;
  total: number;
  createdAt: string;
  details?: {
    selections?: Record<RaffleColor, number[]>;
  };
};

const ALL_COLORS: RaffleColor[] = ["Red", "Blue", "Green", "Yellow", "Purple", "Orange"];

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

type Props = {
  slug: string;
};

export default function PublicRafflePage({ slug }: Props) {
  const [tenant, setTenant] = useState<PublicTenant | null>(null);
  const [events, setEvents] = useState<RaffleEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const [buyerName, setBuyerName] = useState("");
  const [buyerEmail, setBuyerEmail] = useState("");

  const [activeEventId, setActiveEventId] = useState<string>("");
  const [selectedColorByEvent, setSelectedColorByEvent] = useState<Record<string, RaffleColor>>({});
  const [selectedTicketsByEvent, setSelectedTicketsByEvent] = useState<SelectedTicketsByEvent>({});

  useEffect(() => {
    async function loadRaffles() {
      setLoading(true);
      setMessage("");

      try {
        const data = await publicApiFetch(`/api/public/raffles/${slug}`);
        const loadedTenant = data?.tenant ?? null;
        const loadedEvents = Array.isArray(data?.raffles) ? data.raffles : [];

        setTenant(loadedTenant);
        setEvents(loadedEvents);

        setSelectedColorByEvent(
          loadedEvents.reduce((acc: Record<string, RaffleColor>, event: RaffleEvent) => {
            acc[event.id] = event.colors[0] ?? "Red";
            return acc;
          }, {})
        );

        setSelectedTicketsByEvent(
          loadedEvents.reduce((acc: SelectedTicketsByEvent, event: RaffleEvent) => {
            acc[event.id] = buildEmptyColorSelection();
            return acc;
          }, {})
        );

        if (loadedEvents.length > 0) {
          setActiveEventId(loadedEvents[0].id);
        }
      } catch (err) {
        setMessage(err instanceof Error ? err.message : "Unable to load raffle.");
      } finally {
        setLoading(false);
      }
    }

    loadRaffles();
  }, [slug]);

  const event = events.find((e) => e.id === activeEventId) ?? events[0];

  const selectedColor = event
    ? selectedColorByEvent[event.id] ?? event.colors[0] ?? "Red"
    : "Red";

  const eventSelections = event
    ? selectedTicketsByEvent[event.id] ?? buildEmptyColorSelection()
    : buildEmptyColorSelection();

  const selectedTicketsForActiveColor = eventSelections[selectedColor] ?? [];
  const soldForSelectedColor = event?.soldByColor[selectedColor] ?? [];
  const availableForSelectedColor = event ? event.totalTickets - soldForSelectedColor.length : 0;

  const visibleTicketNumbers = useMemo(() => {
    if (!event) return [];
    return Array.from({ length: event.totalTickets }, (_, i) => event.startNumber + i);
  }, [event]);

  const totalSelectedCount = useMemo(() => {
    if (!event) return 0;
    return event.colors.reduce((sum, color) => sum + (eventSelections[color]?.length ?? 0), 0);
  }, [event, eventSelections]);

  const subtotal = event ? totalSelectedCount * event.price : 0;
  const offer = calculateOfferTotal(totalSelectedCount, event?.price ?? 0);
  const total = offer.total;
  const savings = subtotal - total;

  const selectedSummary = useMemo(() => {
    if (!event) return "None selected";

    const rows = event.colors
      .map((color) => {
        const tickets = eventSelections[color] ?? [];
        if (!tickets.length) return null;
        return `${color}: ${tickets.join(", ")}`;
      })
      .filter(Boolean);

    return rows.length ? rows.join(" • ") : "None selected";
  }, [event, eventSelections]);

  const canBuy =
    !!event &&
    buyerName.trim() !== "" &&
    buyerEmail.trim() !== "" &&
    totalSelectedCount > 0;

  function ensureEventSelectionExists(eventId: string) {
    setSelectedTicketsByEvent((curr) => ({
      ...curr,
      [eventId]: curr[eventId] ?? buildEmptyColorSelection(),
    }));
  }

  function toggleColor(color: RaffleColor) {
    if (!event) return;
    ensureEventSelectionExists(event.id);
    setSelectedColorByEvent((curr) => ({ ...curr, [event.id]: color }));
  }

  function toggleTicketNumber(ticketNo: number) {
    if (!event) return;
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
    if (!event) return;
    setSelectedTicketsByEvent((curr) => ({
      ...curr,
      [event.id]: buildEmptyColorSelection(),
    }));
  }

  function downloadReceipt(purchase?: Purchase) {
    if (!event) return;

    const selections =
      (purchase?.details?.selections as Record<RaffleColor, number[]> | undefined) ?? eventSelections;

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
    doc.text(`Raffle: ${purchase?.itemTitle ?? event.title}`, 20, y);
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

  async function buyRaffleTickets() {
    if (!canBuy || !event) return;

    setBusy(true);
    setMessage("");

    try {
      const cleanedSelections = ALL_COLORS.reduce((acc, color) => {
        acc[color] = [...(eventSelections[color] ?? [])].sort((a, b) => a - b);
        return acc;
      }, {} as Record<RaffleColor, number[]>);

      const response = await publicApiFetch(`/api/public/raffles/${slug}/purchase`, {
        method: "POST",
        body: JSON.stringify({
          eventId: event.id,
          buyerName: buyerName.trim(),
          buyerEmail: buyerEmail.trim(),
          selections: cleanedSelections,
          subtotal,
          total,
        }),
      });

      const updatedEvent: RaffleEvent = response.event;
      const purchase: Purchase = response.purchase;

      const description = event.colors
        .map((color) => {
          const tickets = cleanedSelections[color] ?? [];
          if (!tickets.length) return null;
          return `${color}: ${tickets.join(", ")}`;
        })
        .filter(Boolean)
        .join(" | ");

      appendLedger({
        id: String(purchase.id),
        module: "raffle",
        itemTitle: purchase.itemTitle ?? event.title,
        buyerName: purchase.buyerName,
        buyerEmail: purchase.buyerEmail,
        description,
        quantity: purchase.quantity,
        total: purchase.total,
        createdAt: purchase.createdAt,
      });

      setEvents((curr) => curr.map((e) => (e.id === updatedEvent.id ? updatedEvent : e)));

      setSelectedTicketsByEvent((curr) => ({
        ...curr,
        [event.id]: buildEmptyColorSelection(),
      }));

      setBuyerName("");
      setBuyerEmail("");
      setMessage("Purchase complete.");
      downloadReceipt(purchase);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Unable to complete purchase.");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: "#020617", color: "white", padding: 24 }}>
        Loading raffle...
      </div>
    );
  }

  if (!event) {
    return (
      <div style={{ minHeight: "100vh", background: "#020617", color: "white", padding: 24 }}>
        {message || "No raffle found."}
      </div>
    );
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
                Public fundraiser
              </div>
              <h1 style={{ margin: 0, fontSize: 38, fontWeight: 700, letterSpacing: "-0.03em" }}>
                {tenant?.name ?? "Raffle"}
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
                color: "#cbd5e1",
              }}
            >
              Buyer access
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
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 18 }}>
            {events.map((e) => (
              <button
                key={e.id}
                onClick={() => setActiveEventId(e.id)}
                style={chipStyle(e.id === event.id)}
              >
                {e.title}
              </button>
            ))}
          </div>

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

          <div style={{ marginBottom: 14, color: "#cbd5e1" }}>
            {availableForSelectedColor} available in {selectedColor}
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

              {message && (
                <div style={{ fontSize: 13, color: message === "Purchase complete." ? "#86efac" : "#fda4af" }}>
                  {message}
                </div>
              )}
            </div>

            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 16 }}>
              <button onClick={clearSelections} style={{ ...secondaryButtonStyle(), flex: 1, minWidth: 220 }}>
                Clear Selection
              </button>

              <button
                onClick={buyRaffleTickets}
                disabled={!canBuy || busy}
                style={{
                  flex: 1,
                  minWidth: 220,
                  borderRadius: 18,
                  padding: "14px 18px",
                  background: canBuy && !busy ? "white" : "rgba(255,255,255,0.25)",
                  color: canBuy && !busy ? "#020617" : "#cbd5e1",
                  fontWeight: 700,
                  border: "none",
                  cursor: canBuy && !busy ? "pointer" : "not-allowed",
                }}
              >
                {busy ? "Processing..." : "Buy Raffle Tickets"}
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
