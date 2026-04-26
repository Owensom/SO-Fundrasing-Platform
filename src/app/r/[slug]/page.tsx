"use client";

import { useEffect, useMemo, useState } from "react";

type Props = {
  slug: string | undefined | null;
};

type TicketSelection = { colour: string; number: number };

// Minimal SafeRaffle type to preserve existing logic
type SafeRaffle = {
  id: string;
  slug: string;
  title: string;
  description: string;
  imageUrl: string;
  startNumber: number;
  endNumber: number;
  ticketPrice: number;
  currency: string;
  status: "draft" | "published" | "closed" | "drawn";
  colours: { name: string; hex?: string | null; sortOrder?: number }[];
  offers: { quantity: number; price: number; isActive: boolean; label: string }[];
  reservedTickets: TicketSelection[];
  soldTickets: TicketSelection[];
};

function makeTicketKey(colour: string, number: number) {
  return `${colour}::${number}`;
}

export default function PublicRafflePage({ slug }: Props) {
  const [raffle, setRaffle] = useState<SafeRaffle | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // --- Validate slug
  if (!slug || !slug.match(/^[a-zA-Z0-9-_]+$/)) {
    return <div style={{ padding: 24 }}>Invalid raffle link.</div>;
  }

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError("");

      try {
        const response = await fetch(`/api/raffles/${encodeURIComponent(slug)}`);
        const data = await response.json();

        if (!response.ok || !data?.raffle) {
          throw new Error(data?.error || "Raffle not found");
        }

        if (!cancelled) setRaffle(data.raffle);
      } catch (err: any) {
        if (!cancelled) setError(err.message || "Failed to load raffle");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [slug]);

  if (loading) return <div style={{ padding: 24 }}>Loading raffle…</div>;
  if (error) return <div style={{ padding: 24, color: "red" }}>{error}</div>;
  if (!raffle) return <div style={{ padding: 24 }}>Raffle not found.</div>;

  const availableNumbers = useMemo(() => {
    const numbers: number[] = [];
    for (let n = raffle.startNumber; n <= raffle.endNumber; n++) numbers.push(n);
    return numbers;
  }, [raffle]);

  const availability = useMemo(() => {
    const sold = new Set<string>();
    const reserved = new Set<string>();

    raffle.soldTickets.forEach((t) => sold.add(makeTicketKey(t.colour, t.number)));
    raffle.reservedTickets.forEach((t) => reserved.add(makeTicketKey(t.colour, t.number)));

    return { sold, reserved };
  }, [raffle]);

  return (
    <div style={{ padding: 24, maxWidth: 800, margin: "0 auto" }}>
      <button
        onClick={() => window.history.back()}
        style={{ marginBottom: 16, cursor: "pointer" }}
      >
        ← Back to campaigns
      </button>

      <h1>{raffle.title}</h1>
      {raffle.description && <p>{raffle.description}</p>}

      {raffle.imageUrl && (
        <img
          src={raffle.imageUrl}
          alt={raffle.title}
          style={{ width: "100%", borderRadius: 12, marginBottom: 16 }}
        />
      )}

      <div>
        <strong>Ticket price:</strong> {raffle.currency} {raffle.ticketPrice}
      </div>
      <div>
        <strong>Ticket numbers:</strong> {raffle.startNumber} to {raffle.endNumber}
      </div>
      <div>
        <strong>Status:</strong> {raffle.status}
      </div>

      {raffle.colours.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <strong>Colours:</strong>{" "}
          {raffle.colours.map((c) => (
            <span
              key={c.name}
              style={{
                display: "inline-block",
                width: 16,
                height: 16,
                background: c.hex || "#ccc",
                borderRadius: 999,
                marginRight: 6,
                verticalAlign: "middle",
              }}
            />
          ))}
        </div>
      )}

      <div style={{ marginTop: 16 }}>
        <strong>Available ticket numbers:</strong>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 4 }}>
          {availableNumbers.map((num) =>
            raffle.colours.map((colour) => {
              const key = makeTicketKey(colour.name, num);
              const isSold = availability.sold.has(key);
              const isReserved = availability.reserved.has(key);

              return (
                <span
                  key={key}
                  style={{
                    width: 40,
                    height: 40,
                    lineHeight: "40px",
                    textAlign: "center",
                    borderRadius: 6,
                    background: isSold ? "#111" : isReserved ? "#f59e0b" : "#e5e7eb",
                    color: isSold || isReserved ? "#fff" : "#111",
                  }}
                >
                  {num} ({colour.name})
                </span>
              );
            }),
          )}
        </div>
      </div>
    </div>
  );
}
