"use client";

import { useState, useMemo } from "react";
import type { SafeRaffle, TicketSelection } from "@/lib/types";

type Props = { raffle: SafeRaffle };

export default function RaffleClient({ raffle }: Props) {
  const [basket, setBasket] = useState<TicketSelection[]>([]);
  const [selectedColour, setSelectedColour] = useState(raffle.colours[0]?.name ?? "");
  const [autoQuantity, setAutoQuantity] = useState(1);
  const [error, setError] = useState("");

  const availability = useMemo(() => {
    const sold = new Set(raffle.soldTickets.map(t => `${t.colour}::${t.number}`));
    const reserved = new Set(raffle.reservedTickets.map(t => `${t.colour}::${t.number}`));
    return { sold, reserved };
  }, [raffle]);

  const basketKeys = useMemo(() => new Set(basket.map(t => `${t.colour}::${t.number}`)), [basket]);

  const visibleNumbers = useMemo(() => {
    const out: number[] = [];
    for (let n = raffle.startNumber; n <= raffle.endNumber; n += 1) out.push(n);
    return out;
  }, [raffle.startNumber, raffle.endNumber]);

  const toggleTicket = (number: number) => {
    const key = `${selectedColour}::${number}`;
    if (availability.sold.has(key) || availability.reserved.has(key)) return;

    setBasket(current => {
      const exists = current.some(t => t.colour === selectedColour && t.number === number);
      if (exists) return current.filter(t => !(t.colour === selectedColour && t.number === number));
      return [...current, { colour: selectedColour, number }];
    });
  };

  const autoSelectTicketQuantity = (quantity: number) => {
    const requested = Math.max(1, Math.floor(quantity));
    const selected: TicketSelection[] = [];
    const selectedKeys = new Set<string>();

    const sortedColours = raffle.colours.slice().sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));

    for (const colour of sortedColours) {
      for (const number of visibleNumbers) {
        if (selected.length >= requested) break;
        const key = `${colour.name}::${number}`;
        if (selectedKeys.has(key) || availability.sold.has(key) || availability.reserved.has(key)) continue;
        selectedKeys.add(key);
        selected.push({ colour: colour.name, number });
      }
      if (selected.length >= requested) break;
    }

    setBasket(selected);
    if (selected.length < requested) setError(`Only ${selected.length} tickets available.`);
    else setError("");
  };

  const autoSelectTickets = () => autoSelectTicketQuantity(autoQuantity);
  const clearBasket = () => setBasket([]);

  return (
    <div style={{ padding: 24 }}>
      <h1>{raffle.title}</h1>
      <p>{raffle.description}</p>

      <h2>Choose colour</h2>
      {raffle.colours.map(colour => (
        <button
          key={colour.id}
          onClick={() => setSelectedColour(colour.name)}
          style={{
            background: selectedColour === colour.name ? "#2563eb" : "#e5e7eb",
            color: selectedColour === colour.name ? "#fff" : "#111",
            marginRight: 6,
            padding: "6px 12px",
            borderRadius: 999,
            border: "none",
          }}
        >
          {colour.name}
        </button>
      ))}

      <h2>Choose numbers</h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(40px, 1fr))", gap: 6 }}>
        {visibleNumbers.map(number => {
          const key = `${selectedColour}::${number}`;
          const isSold = availability.sold.has(key);
          const isReserved = availability.reserved.has(key);
          const isSelected = basketKeys.has(key);
          return (
            <button
              key={key}
              onClick={() => toggleTicket(number)}
              disabled={isSold || isReserved}
              style={{
                background: isSelected ? "#2563eb" : isSold ? "#111" : isReserved ? "#f59e0b" : "#fff",
                color: isSelected || isSold || isReserved ? "#fff" : "#111",
                padding: 8,
                borderRadius: 8,
                border: "1px solid #cbd5e1",
              }}
            >
              {number}
            </button>
          );
        })}
      </div>

      <div style={{ marginTop: 20 }}>
        <label>
          Number of tickets
          <input type="number" min={1} max={raffle.endNumber - raffle.startNumber + 1}
            value={autoQuantity} onChange={e => setAutoQuantity(Number(e.target.value))}
            style={{ marginLeft: 6, width: 60 }} />
        </label>
        <button onClick={autoSelectTickets} style={{ marginLeft: 10 }}>Auto select</button>
        <button onClick={clearBasket} style={{ marginLeft: 10 }}>Clear basket</button>
      </div>

      <div style={{ marginTop: 20 }}>
        <h3>Basket</h3>
        {basket.length === 0 ? <p>No tickets selected yet.</p> :
          basket.map(t => <div key={`${t.colour}::${t.number}`}>{t.colour} #{t.number}</div>)}
        {error && <p style={{ color: "red" }}>{error}</p>}
      </div>
    </div>
  );
}
