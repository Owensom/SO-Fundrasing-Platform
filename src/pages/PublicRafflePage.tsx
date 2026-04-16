import React, { useMemo, useState } from "react";

type Offer = {
  label: string;
  price: number;
  quantity: number;
};

const demoRaffle = {
  title: "Demo Raffle",
  startNumber: 1,
  endNumber: 50,
  ticketPrice: 1,
  offers: [
    { label: "5 for £4", price: 4, quantity: 5 },
    { label: "10 for £7", price: 7, quantity: 10 },
  ] as Offer[],
  colours: ["red", "blue", "green"],
};

export default function PublicRafflePage() {
  const [selectedNumbers, setSelectedNumbers] = useState<number[]>([]);
  const [selectedColour, setSelectedColour] = useState<string>("");

  const numbers = useMemo(() => {
    return Array.from(
      { length: demoRaffle.endNumber - demoRaffle.startNumber + 1 },
      (_, i) => demoRaffle.startNumber + i
    );
  }, []);

  function toggleNumber(n: number) {
    setSelectedNumbers((prev) =>
      prev.includes(n) ? prev.filter((x) => x !== n) : [...prev, n]
    );
  }

  function calculateTotal() {
    let remaining = selectedNumbers.length;
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

  return (
    <div style={{ padding: 24, maxWidth: 1000, margin: "0 auto" }}>
      <h1>{demoRaffle.title}</h1>

      <div style={{ marginTop: 24 }}>
        <h2>Select Colour</h2>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          {demoRaffle.colours.map((colour) => (
            <button
              key={colour}
              type="button"
              onClick={() => setSelectedColour(colour)}
              style={{
                width: 42,
                height: 42,
                borderRadius: "50%",
                border:
                  selectedColour === colour ? "3px solid #111" : "1px solid #ccc",
                background: colour,
                cursor: "pointer",
              }}
              aria-label={`Select ${colour}`}
              title={colour}
            />
          ))}
        </div>
        <p style={{ marginTop: 12 }}>
          Selected colour: <strong>{selectedColour || "None"}</strong>
        </p>
      </div>

      <div style={{ marginTop: 32 }}>
        <h2>Pick Numbers</h2>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(10, minmax(0, 1fr))",
            gap: 8,
          }}
        >
          {numbers.map((n) => {
            const selected = selectedNumbers.includes(n);

            return (
              <button
                key={n}
                type="button"
                onClick={() => toggleNumber(n)}
                style={{
                  padding: "12px 8px",
                  borderRadius: 8,
                  border: "1px solid #ccc",
                  background: selected ? "#111" : "#f3f3f3",
                  color: selected ? "#fff" : "#111",
                  cursor: "pointer",
                  fontWeight: 600,
                }}
              >
                {n}
              </button>
            );
          })}
        </div>
      </div>

      <div style={{ marginTop: 32 }}>
        <h2>Offers</h2>
        <ul>
          <li>Single ticket: £{demoRaffle.ticketPrice}</li>
          {demoRaffle.offers.map((offer) => (
            <li key={offer.label}>
              {offer.label} — £{offer.price}
            </li>
          ))}
        </ul>
      </div>

      <div style={{ marginTop: 32 }}>
        <h2>Summary</h2>
        <p>
          Selected numbers:{" "}
          <strong>
            {selectedNumbers.length > 0 ? selectedNumbers.join(", ") : "None"}
          </strong>
        </p>
        <p>
          Selected colour: <strong>{selectedColour || "None"}</strong>
        </p>
        <p>
          Total: <strong>£{calculateTotal()}</strong>
        </p>
      </div>
    </div>
  );
}
