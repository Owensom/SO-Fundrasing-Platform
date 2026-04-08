import React, { useEffect, useMemo, useState } from "react";
import { jsPDF } from "jspdf";
import { useAuth } from "./useAuth";
import { apiFetch } from "./api";

type Mode = "rows" | "tables";

type TicketEvent = {
  id: string;
  title: string;
  venue: string;
  price: number;
  mode: Mode;
  seats: string[];
  soldSeats: string[];
  tables: { id: string; name: string; capacity: number }[];
};

type TicketPurchase = {
  id: string;
  eventTitle: string;
  buyerName: string;
  buyerEmail: string;
  mode: Mode;
  quantity: number;
  total: number;
  seats?: string[];
  tableName?: string;
  createdAt: string;
};

function money(n: number) {
  return `£${n.toFixed(2)}`;
}

export default function TicketsSection() {
  const { canManage, isLoggedIn } = useAuth();

  const [events, setEvents] = useState<TicketEvent[]>([]);
  const [activeEventId, setActiveEventId] = useState<string>("");

  const [buyerName, setBuyerName] = useState("");
  const [buyerEmail, setBuyerEmail] = useState("");

  const [selectedSeats, setSelectedSeats] = useState<string[]>([]);
  const [selectedTable, setSelectedTable] = useState<any>(null);
  const [quantity, setQuantity] = useState(1);

  const [purchases, setPurchases] = useState<TicketPurchase[]>([]);

  useEffect(() => {
    async function load() {
      if (!isLoggedIn) return;

      const data = await apiFetch("/api/tickets");
      setEvents(data || []);
      if (data?.length) setActiveEventId(data[0].id);
    }

    load();
  }, [isLoggedIn]);

  const event = events.find((e) => e.id === activeEventId);

  const total = useMemo(() => {
    if (!event) return 0;
    return event.mode === "rows"
      ? selectedSeats.length * event.price
      : quantity * event.price;
  }, [event, selectedSeats, quantity]);

  function toggleSeat(seat: string) {
    if (!event || event.soldSeats.includes(seat)) return;

    setSelectedSeats((curr) =>
      curr.includes(seat)
        ? curr.filter((s) => s !== seat)
        : [...curr, seat]
    );
  }

  function buildReceipt(purchase?: TicketPurchase) {
    if (!event) return new jsPDF();

    const receiptEventTitle = purchase?.eventTitle ?? event.title;
    const receiptBuyerName = (purchase?.buyerName ?? buyerName) || "Not entered";
    const receiptBuyerEmail = (purchase?.buyerEmail ?? buyerEmail) || "Not entered";
    const receiptMode = purchase?.mode ?? event.mode;
    const receiptQuantity =
      purchase?.quantity ??
      (receiptMode === "rows" ? selectedSeats.length : quantity);
    const receiptTotal = purchase?.total ?? total;
    const receiptSeats = purchase?.seats ?? selectedSeats;
    const receiptTableName =
      purchase?.tableName ?? selectedTable?.name ?? "None";

    const doc = new jsPDF();

    doc.setFontSize(20);
    doc.text("Ticket Receipt", 20, 20);

    doc.setFontSize(12);
    doc.text(`Event: ${receiptEventTitle}`, 20, 40);
    doc.text(`Buyer: ${receiptBuyerName}`, 20, 50);
    doc.text(`Email: ${receiptBuyerEmail}`, 20, 60);
    doc.text(`Mode: ${receiptMode}`, 20, 70);

    if (receiptMode === "rows") {
      doc.text(`Seats: ${receiptSeats.join(", ") || "None"}`, 20, 80);
    } else {
      doc.text(`Table: ${receiptTableName}`, 20, 80);
    }

    doc.text(`Quantity: ${receiptQuantity}`, 20, 90);
    doc.text(`Total: ${money(receiptTotal)}`, 20, 100);

    return doc;
  }

  async function buyTickets() {
    if (!event) return;

    const res = await apiFetch("/api/tickets/purchase", {
      method: "POST",
      body: JSON.stringify({
        eventId: event.id,
        buyerName,
        buyerEmail,
        seats: selectedSeats,
        tableId: selectedTable?.id,
        quantity,
        total,
      }),
    });

    const purchase: TicketPurchase = res.purchase;

    setPurchases((p) => [purchase, ...p]);
    setEvents((curr) =>
      curr.map((e) => (e.id === res.event.id ? res.event : e))
    );

    setSelectedSeats([]);
    setSelectedTable(null);
    setQuantity(1);

    const doc = buildReceipt(purchase);
    doc.save("ticket-receipt.pdf");
  }

  if (!event) return <div style={{ color: "white" }}>No events</div>;

  return (
    <div style={{ padding: 20, color: "white" }}>
      <h1>{event.title}</h1>

      <input
        placeholder="Name"
        value={buyerName}
        onChange={(e) => setBuyerName(e.target.value)}
      />

      <input
        placeholder="Email"
        value={buyerEmail}
        onChange={(e) => setBuyerEmail(e.target.value)}
      />

      {event.mode === "rows" && (
        <div>
          {event.seats.map((seat) => {
            const sold = event.soldSeats.includes(seat);
            const selected = selectedSeats.includes(seat);

            return (
              <button
                key={seat}
                disabled={sold}
                onClick={() => toggleSeat(seat)}
              >
                {seat}
              </button>
            );
          })}
        </div>
      )}

      {event.mode === "tables" && (
        <div>
          {event.tables.map((t) => (
            <button key={t.id} onClick={() => setSelectedTable(t)}>
              {t.name}
            </button>
          ))}

          <input
            type="number"
            value={quantity}
            onChange={(e) => setQuantity(Number(e.target.value))}
          />
        </div>
      )}

      <h2>Total: {money(total)}</h2>

      <button onClick={buyTickets}>Buy</button>

      {canManage && (
        <div>
          <h3>Purchases</h3>
          {purchases.map((p) => (
            <div key={p.id}>
              {p.buyerName} — {money(p.total)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
