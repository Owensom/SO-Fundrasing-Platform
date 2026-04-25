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
  sortOrder?: number;
};

type RaffleOffer = {
  id: string;
  label: string;
  quantity: number;
  price: number;
  isActive: boolean;
  sortOrder?: number;
};

type RafflePrize = {
  position: number;
  title: string;
  description: string;
  isPublic: boolean;
};

type RaffleWinner = {
  prizePosition: number;
  ticketNumber: number;
  colour: string | null;
  buyerName: string | null;
  drawnAt: string | null;
};

type SafeRaffleStatus = "draft" | "published" | "closed" | "drawn";

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
  status: SafeRaffleStatus;
  colours: RaffleColour[];
  offers: RaffleOffer[];
  prizes: RafflePrize[];
  reservedTickets: Array<{ colour: string; number: number }>;
  soldTickets: Array<{ colour: string; number: number }>;
  winnerTicketNumber: number | null;
  winnerColour: string | null;
  drawnAt: string | null;
  winners: RaffleWinner[];
};

function makeTicketKey(colour: string, number: number) {
  return `${colour}::${number}`;
}

function formatCurrency(value: number, currency: string) {
  try {
    return new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency: currency || "GBP",
    }).format(Number.isFinite(value) ? value : 0);
  } catch {
    return `${currency || "GBP"} ${(Number.isFinite(value) ? value : 0).toFixed(2)}`;
  }
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function ordinal(position: number) {
  const suffix =
    position % 10 === 1 && position % 100 !== 11
      ? "st"
      : position % 10 === 2 && position % 100 !== 12
      ? "nd"
      : position % 10 === 3 && position % 100 !== 13
      ? "rd"
      : "th";

  return `${position}${suffix}`;
}

function normaliseFrontendStatus(rawStatus: unknown): SafeRaffleStatus {
  const status = String(rawStatus ?? "").trim().toLowerCase();
  if (status === "published") return "published";
  if (status === "drawn") return "drawn";
  if (status === "closed") return "closed";
  return "draft";
}
export default function PublicRafflePage({ slug }: Props) {
  const [raffle, setRaffle] = useState<SafeRaffle | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [selectedColour, setSelectedColour] = useState("");
  const [basket, setBasket] = useState<TicketSelection[]>([]);

  // ✅ FIX: allow blank
  const [autoQuantity, setAutoQuantity] = useState<number>(1);

  const [buyerName, setBuyerName] = useState("");
  const [buyerEmail, setBuyerEmail] = useState("");
  const [coverFees, setCoverFees] = useState(false);
  const [reservationMessage, setReservationMessage] = useState("");

  useEffect(() => {
    if (!slug) return;

    async function load() {
      const res = await fetch(`/api/raffles/${slug}`);
      const json = await res.json();
      setRaffle(json.raffle);
      setLoading(false);
    }

    load();
  }, [slug]);

  function autoSelectTicketQuantity(quantity: number) {
    if (!raffle) return;

    const selected: TicketSelection[] = [];

    for (let i = raffle.startNumber; i <= raffle.endNumber; i++) {
      if (selected.length >= quantity) break;

      selected.push({
        colour: raffle.colours[0]?.name || "",
        number: i,
      });
    }

    setBasket(selected);
  }

  // ✅ FIX: validation only on click
  function autoSelectTickets() {
    if (!autoQuantity || autoQuantity <= 0) {
      setError("Enter how many tickets you would like.");
      return;
    }

    autoSelectTicketQuantity(autoQuantity);
  }

  if (!raffle) return <div>Loading…</div>;

  return (
    <div style={{ padding: 24 }}>
      <h1>{raffle.title}</h1>

      {/* QUICK BUY */}
      <div>
        <h2>Quick buy</h2>

        <input
          type="number"
          min={1}
          value={autoQuantity === 0 ? "" : autoQuantity}
          onChange={(e) => {
            const raw = e.target.value;

            if (raw === "") {
              setAutoQuantity(0);
              return;
            }

            const parsed = Number(raw);
            if (!Number.isFinite(parsed)) return;

            setAutoQuantity(parsed);
          }}
        />

        <button onClick={autoSelectTickets}>Auto select</button>
      </div>

      {/* PRIZES */}
      {raffle.prizes?.length > 0 && (
        <div>
          <h2>Prizes</h2>
          {raffle.prizes.map((p) => (
            <div key={p.position}>
              {ordinal(p.position)} — {p.title}
            </div>
          ))}
        </div>
      )}

      {/* BASKET */}
      <div>
        <h2>Basket</h2>
        {basket.map((t) => (
          <div key={makeTicketKey(t.colour, t.number)}>
            {t.colour} #{t.number}
          </div>
        ))}
      </div>

      {error && <div style={{ color: "red" }}>{error}</div>}

      <div>
        Total: {formatCurrency(basket.length * raffle.ticketPrice, raffle.currency)}
      </div>
    </div>
  );
}
