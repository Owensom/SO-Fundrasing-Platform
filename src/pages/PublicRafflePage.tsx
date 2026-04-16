import React, { useMemo, useState } from "react";

type Offer = {
  label: string;
  price: number;
  quantity: number;
};

type TicketSelection = {
  colour: string;
  number: number;
};

const demoRaffle = {
  title: "SO Foundation Demo Raffle",
  startNumber: 1,
  endNumber: 200,
  ticketPrice: 2,
  offers: [
    { label: "5 for £8", price: 8, quantity: 5 },
    { label: "10 for £15", price: 15, quantity: 10 },
  ] as Offer[],
  colours: ["#ef4444", "#3b82f6", "#22c55e"],
};

function selectionKey(colour: string, number: number) {
  return `${colour}__${number}`;
}

export default function PublicRafflePage() {
  const [activeColour, setActiveColour] = useState<string>(
    demoRaffle.colours[0] || ""
  );
  const [selectedTickets, setSelectedTickets] = useState<TicketSelection[]>([]);

  const numbers = useMemo(() => {
    return Array.from(
      { length: demoRaffle.endNumber - demoRaffle.startNumber + 1 },
      (_, i) => demoRaffle.startNumber + i
    );
  }, []);

  const totalTickets = useMemo(() => {
    return numbers.length * demoRaffle.colours.length;
  }, [numbers.length]);

  function isSelected(colour: string, number: number) {
    return selectedTickets.some(
      (ticket) => ticket.colour === colour && ticket.number === number
    );
  }

  function toggleTicket(colour: string, number: number) {
    setSelectedTickets((prev) => {
      const exists = prev.some(
        (ticket) => ticket.colour === colour && ticket.number === number
      );

      if (exists) {
        return prev.filter(
          (ticket) => !(ticket.colour === colour && ticket.number === number)
        );
      }

      return [...prev, { colour, number }];
    });
  }

  function calculateTotal() {
    let remaining = selectedTickets.length;
    let total = 0;

    const sortedOffers = [...demoRaffle.offers].sort(
      (a, b) => b.quantity - a.quantity
    );

    for (const offer of sortedOffers) {
      while (remaining >= offer.quantity) {
        total += offer.price;
        remaining -= offer.quantity;
      }
    }

    total += remaining * demoRaffle.ticketPrice;
    return total;
  }

  const ticketsForActiveColour = selectedTickets.filter(
    (ticket) => ticket.colour === activeColour
  );

  return (
    <div style={{ padding: 24, maxWidth: 1100, margin: "0 auto" }}>
      <h1>{demoRaffle.title}</h1>

      <div
        style={{
          marginTop: 20,
          padding: 16,
          borderRadius: 16,
          background: "#f9fafb",
          border: "1px solid #e5e7eb",
          display: "grid",
          gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
          gap: 12,
        }}
      >
        <SummaryCard label="Numbers per colour" value={`${numbers.length}`} />
        <SummaryCard label="Colours" value={`${demoRaffle.colours.length}`} />
        <SummaryCard label="Total tickets" value={`${totalTickets}`} />
        <SummaryCard label="Single price" value={`£${demoRaffle.ticketPrice}`} />
      </div>

      <div style={{ marginTop: 28 }}>
        <h2>Choose colour board</h2>
        <p style={{ color: "#6b7280", marginTop: 6 }}>
          Each colour is a separate full ticket range. You can choose the same number in different colours.
        </p>

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 14 }}>
          {demoRaffle.colours.map((colour) => {
            const active = activeColour === colour;
            const count = selectedTickets.filter((t) => t.colour === colour).length;

            return (
              <button
                key={colour}
                type="button"
                onClick={() => setActiveColour(colour)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "10px 14px",
                  borderRadius: 999,
                  border: active ? "2px solid #111827" : "1px solid #d1d5db",
                  background: "#fff",
                  cursor: "pointer",
                  fontWeight: 700,
                }}
              >
                <span
                  style={{
                    width: 18,
                    height: 18,
                    borderRadius: "50%",
                    background: colour,
                    border: colour === "#ffffff" ? "1px solid #d1d5db" : "none",
                  }}
                />
                <span>{colour}</span>
                <span style={{ color: "#6b7280", fontWeight: 600 }}>({count})</span>
              </button>
            );
          })}
        </div>
      </div>

      <div style={{ marginTop: 28 }}>
        <h2>Pick numbers for {activeColour || "colour"}</h2>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(10, minmax(0, 1fr))",
            gap: 8,
            marginTop: 14,
          }}
        >
          {numbers.map((n) => {
            const selected = isSelected(activeColour, n);

            return (
              <button
                key={selectionKey(activeColour, n)}
                type="button"
                onClick={() => toggleTicket(activeColour, n)}
                style={{
                  padding: "12px 8px",
                  borderRadius: 10,
                  border: selected ? "2px solid #111827" : "1px solid #d1d5db",
                  background: selected ? activeColour || "#111827" : "#f3f4f6",
                  color: selected ? "#fff" : "#111827",
                  cursor: "pointer",
                  fontWeight: 700,
                }}
              >
                {n}
              </button>
            );
          })}
        </div>
      </div>

      <div
        style={{
          marginTop: 32,
          display: "grid",
          gridTemplateColumns: "1.2fr 0.8fr",
          gap: 20,
          alignItems: "start",
        }}
      >
        <div
          style={{
            border: "1px solid #e5e7eb",
            borderRadius: 16,
            padding: 18,
            background: "#fff",
          }}
        >
          <h2 style={{ marginTop: 0 }}>Selected tickets</h2>

          {selectedTickets.length === 0 ? (
            <p style={{ color: "#6b7280" }}>No tickets selected yet.</p>
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              {demoRaffle.colours.map((colour) => {
                const items = selectedTickets
                  .filter((ticket) => ticket.colour === colour)
                  .sort((a, b) => a.number - b.number);

                if (items.length === 0) return null;

                return (
                  <div
                    key={colour}
                    style={{
                      border: "1px solid #e5e7eb",
                      borderRadius: 14,
                      padding: 14,
                      background: "#fafafa",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        marginBottom: 10,
                        fontWeight: 700,
                      }}
                    >
                      <span
                        style={{
                          width: 18,
                          height: 18,
                          borderRadius: "50%",
                          background: colour,
                          border: colour === "#ffffff" ? "1px solid #d1d5db" : "none",
                        }}
                      />
                      <span>{colour}</span>
                      <span style={{ color: "#6b7280" }}>({items.length})</span>
                    </div>

                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {items.map((ticket) => (
                        <button
                          key={selectionKey(ticket.colour, ticket.number)}
                          type="button"
                          onClick={() => toggleTicket(ticket.colour, ticket.number)}
                          style={{
                            border: "1px solid #d1d5db",
                            background: "#fff",
                            borderRadius: 999,
                            padding: "6px 10px",
                            cursor: "pointer",
                            fontWeight: 600,
                          }}
                        >
                          {ticket.number} ×
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div
          style={{
            border: "1px solid #e5e7eb",
            borderRadius: 16,
            padding: 18,
            background: "#fff",
          }}
        >
          <h2 style={{ marginTop: 0 }}>Summary</h2>

          <div style={{ display: "grid", gap: 10 }}>
            <SummaryRow label="Active colour" value={activeColour || "—"} />
            <SummaryRow label="Selected on this colour" value={`${ticketsForActiveColour.length}`} />
            <SummaryRow label="Total selected tickets" value={`${selectedTickets.length}`} />
            <SummaryRow label="Total price" value={`£${calculateTotal()}`} />
          </div>

          <div style={{ marginTop: 18 }}>
            <div style={{ fontWeight: 700, marginBottom: 8 }}>Offers</div>
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              <li>Single ticket: £{demoRaffle.ticketPrice}</li>
              {demoRaffle.offers.map((offer) => (
                <li key={offer.label}>
                  {offer.label} — £{offer.price}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid #e5e7eb",
        borderRadius: 14,
        padding: 14,
      }}
    >
      <div style={{ fontSize: 12, fontWeight: 700, color: "#6b7280", marginBottom: 8 }}>
        {label}
      </div>
      <div style={{ fontSize: 24, fontWeight: 800, color: "#111827" }}>{value}</div>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        gap: 12,
        paddingBottom: 10,
        borderBottom: "1px solid #f3f4f6",
      }}
    >
      <span style={{ color: "#6b7280" }}>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
