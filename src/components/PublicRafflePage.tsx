import React, { useEffect, useMemo, useState } from "react";
import type {
  PublicRaffle,
  PublicRaffleResponse,
  ReserveTicketsRequest,
  ReserveTicketsResponse,
  TicketSelection,
} from "../types/raffles";
import { getBestPrice } from "../lib/rafflePricing";

type Props = {
  slug: string;
};

function formatCurrency(value: number, currency: string) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency,
  }).format(value);
}

function makeTicketKey(colour: string, number: number) {
  return `${colour}::${number}`;
}

export default function PublicRafflePage({ slug }: Props) {
  const [raffle, setRaffle] = useState<PublicRaffle | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>("");
  const [selectedColour, setSelectedColour] = useState<string>("");
  const [basket, setBasket] = useState<TicketSelection[]>([]);
  const [buyerName, setBuyerName] = useState("");
  const [buyerEmail, setBuyerEmail] = useState("");
  const [reservationMessage, setReservationMessage] = useState("");

  // -----------------------------
  // LOAD RAFFLE (SAFE JSON PARSE)
  // -----------------------------
  useEffect(() => {
    if (!slug) return;

    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        setError("");

        const res = await fetch(`/api/public/raffles/${encodeURIComponent(slug)}`);
        const text = await res.text();

        let data: PublicRaffleResponse | { error?: string };

        try {
          data = JSON.parse(text);
        } catch {
          throw new Error("API did not return JSON. Check API route.");
        }

        if (!res.ok) {
          throw new Error(
            "error" in data ? data.error || "Failed to load raffle" : "Failed to load raffle",
          );
        }

        if (!cancelled) {
          const raffleData = (data as PublicRaffleResponse).raffle;
          setRaffle(raffleData);
          setSelectedColour(raffleData.colours[0]?.name || "");
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load raffle");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  // -----------------------------
  // AVAILABILITY
  // -----------------------------
  const availability = useMemo(() => {
    const sold = new Set<string>();
    const reserved = new Set<string>();

    if (!raffle) return { sold, reserved };

    raffle.soldTickets.forEach((t) =>
      sold.add(makeTicketKey(t.colour, t.number)),
    );
    raffle.reservedTickets.forEach((t) =>
      reserved.add(makeTicketKey(t.colour, t.number)),
    );

    return { sold, reserved };
  }, [raffle]);

  const basketKeys = useMemo(
    () => new Set(basket.map((t) => makeTicketKey(t.colour, t.number))),
    [basket],
  );

  const pricing = useMemo(() => {
    if (!raffle) return getBestPrice(0, 0, []);
    return getBestPrice(basket.length, raffle.ticketPrice, raffle.offers);
  }, [basket.length, raffle]);

  const numbers = useMemo(() => {
    if (!raffle) return [];
    return Array.from(
      { length: raffle.endNumber - raffle.startNumber + 1 },
      (_, i) => raffle.startNumber + i,
    );
  }, [raffle]);

  // -----------------------------
  // TOGGLE
  // -----------------------------
  function toggle(number: number) {
    if (!raffle) return;

    const key = makeTicketKey(selectedColour, number);
    if (availability.sold.has(key) || availability.reserved.has(key)) return;

    setBasket((prev) => {
      const exists = prev.some(
        (t) => t.colour === selectedColour && t.number === number,
      );
      if (exists) {
        return prev.filter(
          (t) => !(t.colour === selectedColour && t.number === number),
        );
      }
      return [...prev, { colour: selectedColour, number }];
    });
  }

  function remove(ticket: TicketSelection) {
    setBasket((prev) =>
      prev.filter(
        (t) => !(t.colour === ticket.colour && t.number === ticket.number),
      ),
    );
  }

  // -----------------------------
  // RESERVE (SAFE JSON)
  // -----------------------------
  async function reserve() {
    if (!raffle) return;

    try {
      setSaving(true);
      setError("");

      const payload: ReserveTicketsRequest = {
        buyerName,
        buyerEmail,
        tickets: basket,
      };

      const res = await fetch(`/api/public/raffles/${raffle.id}/reserve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const text = await res.text();

      let data: ReserveTicketsResponse | { error?: string };

      try {
        data = JSON.parse(text);
      } catch {
        throw new Error("Reserve API returned invalid JSON");
      }

      if (!res.ok) {
        throw new Error(
          "error" in data ? data.error || "Reserve failed" : "Reserve failed",
        );
      }

      const result = data as ReserveTicketsResponse;

      setReservationMessage(`Reserved until ${result.expiresAt}`);
      setBasket([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reserve failed");
    } finally {
      setSaving(false);
    }
  }

  // -----------------------------
  // UI
  // -----------------------------
  if (loading) return <div>Loading…</div>;
  if (error && !raffle) return <div>{error}</div>;
  if (!raffle) return <div>Not found</div>;

  return (
    <div style={{ padding: 20 }}>
      <h1>{raffle.title}</h1>

      <p>
        Tickets {raffle.startNumber}–{raffle.endNumber} •{" "}
        {formatCurrency(raffle.ticketPrice, raffle.currency)}
      </p>

      {/* COLOURS */}
      <div style={{ marginBottom: 20 }}>
        {raffle.colours.map((c) => (
          <button
            key={c.id}
            onClick={() => setSelectedColour(c.name)}
            style={{
              marginRight: 10,
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
      <div style={{ display: "grid", gridTemplateColumns: "repeat(10, 1fr)", gap: 6 }}>
        {numbers.map((n) => {
          const key = makeTicketKey(selectedColour, n);
          const isSold = availability.sold.has(key);
          const isReserved = availability.reserved.has(key);
          const isSelected = basketKeys.has(key);

          return (
            <button
              key={key}
              disabled={isSold || isReserved}
              onClick={() => toggle(n)}
              style={{
                padding: 10,
                background: isSelected
                  ? "#2563eb"
                  : isSold
                  ? "#000"
                  : isReserved
                  ? "#f59e0b"
                  : "#fff",
                color: isSelected || isSold || isReserved ? "#fff" : "#000",
              }}
            >
              {n}
            </button>
          );
        })}
      </div>

      {/* BASKET */}
      <h2>Basket</h2>
      {basket.map((t) => (
        <div key={makeTicketKey(t.colour, t.number)}>
          {t.colour} #{t.number}{" "}
          <button onClick={() => remove(t)}>x</button>
        </div>
      ))}

      <p>Total: {formatCurrency(pricing.total, raffle.currency)}</p>

      {/* BUYER */}
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

      <button onClick={reserve} disabled={saving || basket.length === 0}>
        {saving ? "Reserving..." : "Reserve"}
      </button>

      {reservationMessage && <p>{reservationMessage}</p>}
      {error && <p style={{ color: "red" }}>{error}</p>}
    </div>
  );
}
