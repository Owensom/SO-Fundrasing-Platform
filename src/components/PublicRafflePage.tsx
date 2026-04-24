"use client";

import { useEffect, useMemo, useState } from "react";

type Props = {
  slug: string;
};

type TicketSelection = {
  colour: string;
  number: number;
};

type RaffleColour = {
  id: string;
  name: string;
  hex?: string | null;
};

type SafeRaffle = {
  id: string;
  slug: string;
  title: string;
  description: string;
  imageUrl: string;
  tenantSlug: string;
  startNumber: number;
  endNumber: number;
  currency: string;
  ticketPrice: number;
  status: "draft" | "published" | "closed" | "drawn";
  colours: RaffleColour[];
  reservedTickets: Array<{ colour: string; number: number }>;
  soldTickets: Array<{ colour: string; number: number }>;
};

function makeKey(c: string, n: number) {
  return `${c}::${n}`;
}

export default function PublicRafflePage({ slug }: Props) {
  const [raffle, setRaffle] = useState<SafeRaffle | null>(null);
  const [basket, setBasket] = useState<TicketSelection[]>([]);
  const [selectedColour, setSelectedColour] = useState("");
  const [quantityInput, setQuantityInput] = useState(1);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`/api/raffles/${slug}`)
      .then((r) => r.json())
      .then((d) => {
        setRaffle(d.raffle);
        setSelectedColour(d.raffle.colours?.[0]?.name || "");
      });
  }, [slug]);

  const availability = useMemo(() => {
    const sold = new Set<string>();
    const reserved = new Set<string>();

    raffle?.soldTickets.forEach((t) => sold.add(makeKey(t.colour, t.number)));
    raffle?.reservedTickets.forEach((t) =>
      reserved.add(makeKey(t.colour, t.number))
    );

    return { sold, reserved };
  }, [raffle]);

  const visibleNumbers = useMemo(() => {
    if (!raffle) return [];
    const arr: number[] = [];
    for (let i = raffle.startNumber; i <= raffle.endNumber; i++) {
      arr.push(i);
    }
    return arr;
  }, [raffle]);

  function toggleTicket(colour: string, number: number) {
    const key = makeKey(colour, number);

    setBasket((prev) => {
      const exists = prev.some((t) => makeKey(t.colour, t.number) === key);
      if (exists) return prev.filter((t) => makeKey(t.colour, t.number) !== key);
      return [...prev, { colour, number }];
    });
  }

  function autoSelectTickets() {
    if (!raffle) return;

    const needed = Number(quantityInput);
    if (!Number.isFinite(needed) || needed <= 0) return;

    const selected: TicketSelection[] = [];

    for (const colour of raffle.colours) {
      for (const number of visibleNumbers) {
        const key = makeKey(colour.name, number);

        if (
          !availability.sold.has(key) &&
          !availability.reserved.has(key)
        ) {
          selected.push({ colour: colour.name, number });
        }

        if (selected.length >= needed) break;
      }
      if (selected.length >= needed) break;
    }

    if (selected.length < needed) {
      setError("Not enough tickets available.");
      return;
    }

    setBasket(selected);
    setError("");
  }

  function clearBasket() {
    setBasket([]);
  }

  if (!raffle) return <div>Loading...</div>;

  return (
    <div style={{ padding: 24 }}>
      <h1>{raffle.title}</h1>

      {/* AUTO SELECT SECTION */}
      <div style={{ marginTop: 20 }}>
        <h3>Quick Select</h3>

        <div style={{ display: "flex", gap: 10 }}>
          <input
            type="number"
            value={quantityInput}
            min={1}
            onChange={(e) => setQuantityInput(Number(e.target.value))}
            style={{ width: 100, padding: 8 }}
          />

          <button onClick={autoSelectTickets}>
            Auto Select Tickets
          </button>

          <button onClick={clearBasket}>
            Clear
          </button>
        </div>

        {error && (
          <div style={{ color: "red", marginTop: 8 }}>{error}</div>
        )}
      </div>

      {/* COLOURS */}
      <div style={{ marginTop: 20 }}>
        {raffle.colours.map((c) => (
          <button
            key={c.id}
            onClick={() => setSelectedColour(c.name)}
            style={{
              marginRight: 8,
              padding: 10,
              background: selectedColour === c.name ? "#2563eb" : "#ddd",
              color: selectedColour === c.name ? "#fff" : "#000",
            }}
          >
            {c.name}
          </button>
        ))}
      </div>

      {/* NUMBERS */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(60px, 1fr))",
          gap: 8,
          marginTop: 20,
        }}
      >
        {visibleNumbers.map((n) => {
          const key = makeKey(selectedColour, n);
          const sold = availability.sold.has(key);
          const reserved = availability.reserved.has(key);
          const selected = basket.some(
            (t) => makeKey(t.colour, t.number) === key
          );

          return (
            <button
              key={key}
              disabled={sold || reserved}
              onClick={() => toggleTicket(selectedColour, n)}
              style={{
                padding: 10,
                background: selected
                  ? "#2563eb"
                  : sold
                  ? "#000"
                  : reserved
                  ? "#f59e0b"
                  : "#fff",
                color: selected || sold || reserved ? "#fff" : "#000",
              }}
            >
              {n}
            </button>
          );
        })}
      </div>

      {/* BASKET */}
      <div style={{ marginTop: 20 }}>
        <h3>Basket ({basket.length})</h3>
        {basket.map((t) => (
          <div key={makeKey(t.colour, t.number)}>
            {t.colour} #{t.number}
          </div>
        ))}
      </div>
    </div>
  );
}
