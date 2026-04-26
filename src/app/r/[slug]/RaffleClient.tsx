// src/app/r/[slug]/RaffleClient.tsx
"use client";

import { useState, useMemo } from "react";
import type { SafeRaffle, TicketSelection } from "@/lib/types";

type Props = { raffle: SafeRaffle };

export default function RaffleClient({ raffle }: Props) {
  const [basket, setBasket] = useState<TicketSelection[]>([]);
  const [selectedColour, setSelectedColour] = useState(raffle.colours[0]?.name ?? "");
  const [autoQuantity, setAutoQuantity] = useState(1);

  // Calculate sold/reserved keys
  const availability = useMemo(() => {
    const sold = new Set(raffle.soldTickets.map(t => `${t.colour}::${t.number}`));
    const reserved = new Set(raffle.reservedTickets.map(t => `${t.colour}::${t.number}`));
    return { sold, reserved };
  }, [raffle]);

  const basketKeys = useMemo(() => new Set(basket.map(t => `${t.colour}::${t.number}`)), [basket]);

  const visibleNumbers = useMemo(() => {
    const numbers: number[] = [];
    for (let n = raffle.startNumber; n <= raffle.endNumber; n++) numbers.push(n);
    return numbers;
  }, [raffle.startNumber, raffle.endNumber]);

  const toggleTicket = (number: number) => {
    const key = `${selectedColour}::${number}`;
    if (availability.sold.has(key) || availability.reserved.has(key)) return;

    setBasket(curr => {
      const exists = curr.some(t => t.colour === selectedColour && t.number === number);
      if (exists) return curr.filter(t => !(t.colour === selectedColour && t.number === number));
      return [...curr, { colour: selectedColour, number }];
    });
  };

  const clearBasket = () => setBasket([]);

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

    if (selected.length < requested) {
      setBasket(selected);
      return;
    }

    setBasket(selected);
  };

  const autoSelectTickets = () => autoSelectTicketQuantity(autoQuantity);

  return (
    <div>
      <h1>{raffle.title}</h1>
      <p>{raffle.description}</p>

      <h2>Choose colour</h2>
      {raffle.colours.map(colour => (
        <button key={colour.id} onClick={() => setSelectedColour(colour.name)}>
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
            <button key={key} onClick={() => toggleTicket(number)} disabled={isSold || isReserved}>
              {number}
            </button>
          );
        })}
      </div>

      <div>
        <label>
          Number of tickets
          <input type="number" min={1} max={visibleNumbers.length} value={autoQuantity} onChange={e => setAutoQuantity(Number(e.target.value))} />
        </label>
        <button onClick={autoSelectTickets}>Auto select</button>
        <button onClick={clearBasket}>Clear basket</button>
      </div>

      <h3>Basket</h3>
      {basket.length === 0 ? <p>No tickets selected yet.</p> : basket.map(t => <div key={`${t.colour}::${t.number}`}>{t.colour} #{t.number}</div>)}
    </div>
  );
}
