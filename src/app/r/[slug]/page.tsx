"use client";

import { useEffect, useMemo, useState } from "react";

type RaffleColour = {
  id: string;
  name: string;
  hex: string;
};

type RaffleOffer = {
  id: string;
  label: string;
  quantity: number;
  price: number;
  isActive?: boolean;
};

type TicketSelection = {
  number: number;
  colourId?: string | null;
};

type ApiResponse = {
  ok: boolean;
  raffle?: {
    id: string;
    slug: string;
    title: string;
    description: string | null;
    image_url: string | null;
    ticket_price_cents: number;
    currency: string;
    status: "draft" | "published" | "completed";
    config: {
      startNumber: number;
      endNumber: number;
      colours: RaffleColour[];
      offers: RaffleOffer[];
    };
  };
  availability?: {
    sold: string[];
    reserved: string[];
    canPurchase: boolean;
  };
  error?: string;
};

function buildKey(selection: TicketSelection) {
  return `${selection.colourId ?? "none"}:${selection.number}`;
}

function calculateTotalCents(
  selections: TicketSelection[],
  ticketPriceCents: number,
  offers: RaffleOffer[],
) {
  const activeOffers = offers
    .filter((o) => o.isActive !== false)
    .sort((a, b) => a.quantity - b.quantity);

  let best = selections.length * ticketPriceCents;

  function search(remaining: number, total: number) {
    best = Math.min(best, total + remaining * ticketPriceCents);

    for (const offer of activeOffers) {
      if (offer.quantity <= remaining) {
        search(remaining - offer.quantity, total + Math.round(offer.price * 100));
      }
    }
  }

  search(selections.length, 0);
  return best;
}

export default function PublicRafflePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const [slug, setSlug] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [raffle, setRaffle] = useState<ApiResponse["raffle"]>();
  const [availability, setAvailability] = useState<ApiResponse["availability"]>();
  const [selectedColour, setSelectedColour] = useState<string | null>(null);
  const [basket, setBasket] = useState<TicketSelection[]>([]);

  useEffect(() => {
    params.then((p) => setSlug(p.slug));
  }, [params]);

  useEffect(() => {
    if (!slug) return;

    let cancelled = false;

    async function run() {
      setLoading(true);
      setError("");

      try {
        const res = await fetch(`/api/raffles/${slug}`, { cache: "no-store" });
        const data = (await res.json()) as ApiResponse;

        if (cancelled) return;

        if (!res.ok || !data.ok || !data.raffle) {
          setError(data.error || "Unable to load raffle");
          setLoading(false);
          return;
        }

        setRaffle(data.raffle);
        setAvailability(data.availability);

        if ((data.raffle.config.colours ?? []).length > 0) {
          setSelectedColour(data.raffle.config.colours[0].id);
        } else {
          setSelectedColour(null);
        }

        setLoading(false);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Unable to load raffle");
        setLoading(false);
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  const soldSet = useMemo(
    () => new Set(availability?.sold ?? []),
    [availability?.sold],
  );

  const reservedSet = useMemo(
    () => new Set(availability?.reserved ?? []),
    [availability?.reserved],
  );

  const basketSet = useMemo(
    () => new Set(basket.map(buildKey)),
    [basket],
  );

  const totalCents = useMemo(() => {
    if (!raffle) return 0;
    return calculateTotalCents(
      basket,
      raffle.ticket_price_cents,
      raffle.config.offers ?? [],
    );
  }, [basket, raffle]);

  function toggleNumber(number: number) {
    if (!raffle) return;

    const colourId =
      (raffle.config.colours ?? []).length > 0 ? selectedColour : null;

    if ((raffle.config.colours ?? []).length > 0 && !colourId) return;

    const selection: TicketSelection = { number, colourId };
    const key = buildKey(selection);

    if (soldSet.has(key) || reservedSet.has(key)) return;

    setBasket((current) => {
      const exists = current.some((item) => buildKey(item) === key);
      if (exists) {
        return current.filter((item) => buildKey(item) !== key);
      }
      return [...current, selection];
    });
  }

  if (loading) {
    return <div style={{ padding: 24 }}>Loading...</div>;
  }

  if (error || !raffle) {
    return <div style={{ padding: 24 }}>{error || "Raffle not found"}</div>;
  }

  const startNumber = raffle.config?.startNumber ?? 1;
  const endNumber = raffle.config?.endNumber ?? startNumber;

  const numbers = Array.from(
    { length: Math.max(endNumber - startNumber + 1, 0) },
    (_, i) => startNumber + i,
  );

  const colours = raffle.config?.colours ?? [];

  return (
    <div
      style={{
        minHeight: "100vh",
        padding: 24,
        backgroundImage: raffle.image_url ? `url(${raffle.image_url})` : undefined,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      <div
        style={{
          maxWidth: 960,
          margin: "0 auto",
          background: "rgba(255,255,255,0.94)",
          borderRadius: 16,
          padding: 24,
        }}
      >
        <h1>{raffle.title}</h1>
        {raffle.description ? <p>{raffle.description}</p> : null}

        {raffle.status === "completed" ? (
          <div
            style={{
              marginBottom: 16,
              padding: 12,
              borderRadius: 10,
              background: "#ecfdf5",
              border: "1px solid #10b981",
            }}
          >
            This raffle is completed.
          </div>
        ) : null}

        {!availability?.canPurchase ? (
          <div
            style={{
              marginBottom: 16,
              padding: 12,
              borderRadius: 10,
              background: "#fff7ed",
              border: "1px solid #fb923c",
            }}
          >
            Ticket sales are not available for this raffle.
          </div>
        ) : null}

        {colours.length > 0 ? (
          <div style={{ marginBottom: 20 }}>
            <h3>Select colour</h3>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              {colours.map((colour) => (
                <button
                  key={colour.id}
                  type="button"
                  onClick={() => setSelectedColour(colour.id)}
                  style={{
                    padding: "10px 14px",
                    borderRadius: 999,
                    border:
                      selectedColour === colour.id
                        ? "2px solid #111827"
                        : "1px solid #d1d5db",
                    background: colour.hex,
                    color: "#fff",
                    cursor: "pointer",
                  }}
                >
                  {colour.name}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <div style={{ marginBottom: 24 }}>
          <h3>Select numbers</h3>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(72px, 1fr))",
              gap: 10,
            }}
          >
            {numbers.map((number) => {
              const key = buildKey({
                number,
                colourId: colours.length > 0 ? selectedColour : null,
              });

              const isSold = soldSet.has(key);
              const isReserved = reservedSet.has(key);
              const isSelected = basketSet.has(key);
              const disabled =
                isSold ||
                isReserved ||
                !availability?.canPurchase ||
                raffle.status !== "published";

              return (
                <button
                  key={number}
                  type="button"
                  disabled={disabled}
                  onClick={() => toggleNumber(number)}
                  style={{
                    padding: "14px 8px",
                    borderRadius: 12,
                    border: "1px solid #d1d5db",
                    cursor: disabled ? "not-allowed" : "pointer",
                    opacity: disabled ? 0.5 : 1,
                    background: isSelected ? "#dbeafe" : "#fff",
                    fontWeight: 700,
                  }}
                >
                  {number}
                </button>
              );
            })}
          </div>
        </div>

        <div
          style={{
            padding: 16,
            border: "1px solid #e5e7eb",
            borderRadius: 16,
            background: "#fff",
          }}
        >
          <h3>Basket</h3>
          {basket.length === 0 ? <p>No tickets selected.</p> : null}

          {basket.length > 0 ? (
            <ul>
              {basket.map((item) => (
                <li key={buildKey(item)}>
                  {item.colourId ? `${item.colourId} / ` : ""}
                  {item.number}
                </li>
              ))}
            </ul>
          ) : null}

          <p>
            Total:{" "}
            <strong>
              {(totalCents / 100).toFixed(2)} {raffle.currency}
            </strong>
          </p>
        </div>
      </div>
    </div>
  );
}
