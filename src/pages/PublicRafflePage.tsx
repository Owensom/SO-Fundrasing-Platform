```tsx
import React, { useState } from "react";

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
  const [selectedColour, setSelectedColour] = useState<string | null>(null);

  const numbers = Array.from(
    { length: demoRaffle.endNumber - demoRaffle.startNumber + 1 },
    (_, i) => demoRaffle.startNumber + i
  );

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
    <div style={{ padding: 20 }}>
      <h1>{demoRaffle.title}</h1>

      {/* COLOURS */}
      <h3>Select Colour</h3>
      <div style={{ display: "flex", gap: 10 }}>
        {demoRaffle.colours.map((c) => (
          <div
            key={c}
            onClick={() => setSelectedColour(c)}
            style={{
              width: 40,
              height: 40,
              background: c,
              border: selectedColour === c ? "3px solid black" : "1px solid #ccc",
              cursor: "pointer",
            }}
          />
        ))}
      </div>

      {/* NUMBERS */}
      <h3>Pick Numbers</h3>
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(10, 1fr)",
        gap: 5,
      }}>
        {numbers.map((n) => (
          <div
            key={n}
            onClick={() => toggleNumber(n)}
            style={{
              padding: 10,
              textAlign: "center",
              background: selectedNumbers.includes(n) ? "black" : "#eee",
              color: selectedNumbers.includes(n) ? "white" : "black",
              cursor: "pointer",
            }}
          >
            {n}
          </div>
        ))}
      </div>

      {/* SUMMARY */}
      <h3>Summary</h3>
      <p>Numbers: {selectedNumbers.join(", ") || "None"}</p>
      <p>Colour: {selectedColour || "None"}</p>
      <p>Total: £{calculateTotal()}</p>
    </div>
  );
}
```
