import React, { useEffect, useMemo, useState } from "react";
import { getBestPrice } from "../lib/rafflePricing";
import type {
  PublicRaffleResponse,
  ReserveTicketsRequest,
  ReserveTicketsResponse,
  TicketSelection,
} from "../types/raffles";

type Props = {
  slug: string;
};

type PublicRaffleSafe = {
  id: string;
  slug: string;
  title: string;
  description?: string | null;
  imageUrl?: string | null;
  image_url?: string | null;
  startNumber: number;
  endNumber: number;
  currency: string;
  ticketPrice: number;
  colours: Array<{
    id: string;
    name: string;
    hex?: string | null;
    sortOrder?: number;
  }>;
  offers: Array<{
    id: string;
    label: string;
    quantity: number;
    price: number;
    isActive: boolean;
    sortOrder?: number;
  }>;
  reservedTickets: Array<{ colour: string; number: number }>;
  soldTickets: Array<{ colour: string; number: number }>;
};

function formatCurrency(value: number, currency: string) {
  try {
    return new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency: currency || "GBP",
    }).format(value || 0);
  } catch {
    return `${currency || "GBP"} ${Number(value || 0).toFixed(2)}`;
  }
}

function makeTicketKey(colour: string, number: number) {
  return `${colour}::${number}`;
}

function normaliseRaffle(raw: any): PublicRaffleSafe {
  const colours = Array.isArray(raw?.colours) ? raw.colours : [];
  const offers = Array.isArray(raw?.offers) ? raw.offers : [];
  const reservedTickets = Array.isArray(raw?.reservedTickets) ? raw.reservedTickets : [];
  const soldTickets = Array.isArray(raw?.soldTickets) ? raw.soldTickets : [];

  const startNumber = Number(raw?.startNumber ?? 1);
  const endNumber = Number(raw?.endNumber ?? startNumber);

  return {
    id: String(raw?.id ?? ""),
    slug: String(raw?.slug ?? ""),
    title: String(raw?.title ?? "Raffle"),
    description: raw?.description ?? null,
    imageUrl: raw?.imageUrl ?? raw?.image_url ?? null,
    image_url: raw?.image_url ?? raw?.imageUrl ?? null,
    startNumber,
    endNumber,
    currency: String(raw?.currency ?? "GBP"),
    ticketPrice: Number(raw?.ticketPrice ?? 0),
    colours: colours.map((c: any, index: number) => ({
      id: String(c?.id ?? `colour-${index}`),
      name: String(c?.name ?? `Colour ${index + 1}`),
      hex: c?.hex ?? null,
      sortOrder: Number(c?.sortOrder ?? index),
    })),
    offers: offers.map((o: any, index: number) => ({
      id: String(o?.id ?? `offer-${index}`),
      label: String(o?.label ?? `Offer ${index + 1}`),
      quantity: Number(o?.quantity ?? 0),
      price: Number(o?.price ?? 0),
      isActive: Boolean(o?.isActive ?? true),
      sortOrder: Number(o?.sortOrder ?? index),
    })),
    reservedTickets: reservedTickets.map((t: any) => ({
      colour: String(t?.colour ?? ""),
      number: Number(t?.number ?? 0),
    })),
    soldTickets: soldTickets.map((t: any) => ({
      colour: String(t?.colour ?? ""),
      number: Number(t?.number ?? 0),
    })),
  };
}

export default function PublicRafflePage({ slug }: Props) {
  const [raffle, setRaffle] = useState<PublicRaffleSafe | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [selectedColour, setSelectedColour] = useState("");
  const [basket, setBasket] = useState<TicketSelection[]>([]);
  const [buyerName, setBuyerName] = useState("");
  const [buyerEmail, setBuyerEmail] = useState("");
  const [reservationMessage, setReservationMessage] = useState("");

  useEffect(() => {
    if (!slug) return;

    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        setError("");
        setReservationMessage("");

        const res = await fetch(`/api/public/raffles/${encodeURIComponent(slug)}`);
        const text = await res.text();

        let data: PublicRaffleResponse | { error?: string; details?: string };

        try {
          data = JSON.parse(text);
        } catch {
          throw new Error(`API did not return JSON: ${text.slice(0, 120)}`);
        }

        if (!res.ok) {
          throw new Error(
            "error" in data ? data.error || "Failed to load raffle" : "Failed to load raffle",
          );
        }

        const safeRaffle = normaliseRaffle((data as any).raffle);

        if (!cancelled) {
          setRaffle(safeRaffle);
          setSelectedColour(safeRaffle.colours[0]?.name ?? "");
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load raffle");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [slug]);

  const availability = useMemo(() => {
    const sold = new Set<string>();
    const reserved = new Set<string>();

    if (!raffle) {
      return { sold, reserved };
    }

    for (const ticket of raffle.soldTickets) {
      sold.add(makeTicketKey(ticket.colour, ticket.number));
    }

    for (const ticket of raffle.reservedTickets) {
      reserved.add(makeTicketKey(ticket.colour, ticket.number));
    }

    return { sold, reserved };
  }, [raffle]);

  const basketKeys = useMemo(() => {
    return new Set(basket.map((ticket) => makeTicketKey(ticket.colour, ticket.number)));
  }, [basket]);

  const pricing = useMemo(() => {
    if (!raffle) return getBestPrice(0, 0, []);
    return getBestPrice(basket.length, raffle.ticketPrice, raffle.offers);
  }, [basket.length, raffle]);

  const numbers = useMemo(() => {
    if (!raffle) return [];
    if (!Number.isFinite(raffle.startNumber) || !Number.isFinite(raffle.endNumber)) return [];
    if (raffle.endNumber < raffle.startNumber) return [];

    return Array.from(
      { length: raffle.endNumber - raffle.startNumber + 1 },
      (_, i) => raffle.startNumber + i,
    );
  }, [raffle]);

  function toggle(number: number) {
    if (!raffle || !selectedColour) return;

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

      return [...prev, { colour: selectedColour, number }].sort((a, b) => {
        if (a.colour !== b.colour) return a.colour.localeCompare(b.colour);
        return a.number - b.number;
      });
    });
  }

  function remove(ticket: TicketSelection) {
    setBasket((prev) =>
      prev.filter(
        (t) => !(t.colour === ticket.colour && t.number === ticket.number),
      ),
    );
  }

  async function reserve() {
    if (!raffle) return;

    try {
      setSaving(true);
      setError("");
      setReservationMessage("");

      if (!buyerName.trim()) throw new Error("Please enter your name.");
      if (!buyerEmail.trim()) throw new Error("Please enter your email.");
      if (basket.length === 0) throw new Error("Please select at least one ticket.");

      const payload: ReserveTicketsRequest = {
        buyerName: buyerName.trim(),
        buyerEmail: buyerEmail.trim(),
        tickets: basket,
      };

      const res = await fetch(`/api/public/raffles/${encodeURIComponent(raffle.slug)}/reserve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const text = await res.text();

      let data: ReserveTicketsResponse | { error?: string; details?: string };

      try {
        data = JSON.parse(text);
      } catch {
        throw new Error(`Reserve API did not return JSON: ${text.slice(0, 120)}`);
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

  if (!slug) return <div style={styles.wrap}>Loading…</div>;
  if (loading) return <div style={styles.wrap}>Loading raffle…</div>;
  if (error && !raffle) return <div style={styles.wrap}>{error}</div>;
  if (!raffle) return <div style={styles.wrap}>Raffle not found.</div>;

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <h1 style={styles.title}>{raffle.title}</h1>

        {raffle.description ? <p style={styles.description}>{raffle.description}</p> : null}

        <p style={styles.meta}>
          Tickets {raffle.startNumber}–{raffle.endNumber} •{" "}
          {formatCurrency(raffle.ticketPrice, raffle.currency)}
        </p>

        {raffle.colours.length > 0 ? (
          <>
            <h2 style={styles.heading}>Choose colour</h2>
            <div style={styles.colourRow}>
              {raffle.colours.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setSelectedColour(c.name)}
                  style={{
                    ...styles.colourButton,
                    background: selectedColour === c.name ? "#2563eb" : "#e5e7eb",
                    color: selectedColour === c.name ? "#fff" : "#111827",
                  }}
                >
                  {c.name}
                </button>
              ))}
            </div>
          </>
        ) : (
          <div style={styles.notice}>No colours configured yet.</div>
        )}

        <h2 style={styles.heading}>Choose numbers</h2>

        {selectedColour ? (
          <div style={styles.numberGrid}>
            {numbers.map((n) => {
              const key = makeTicketKey(selectedColour, n);
              const isSold = availability.sold.has(key);
              const isReserved = availability.reserved.has(key);
              const isSelected = basketKeys.has(key);

              return (
                <button
                  key={key}
                  type="button"
                  disabled={isSold || isReserved}
                  onClick={() => toggle(n)}
                  style={{
                    ...styles.numberButton,
                    background: isSelected
                      ? "#2563eb"
                      : isSold
                        ? "#111827"
                        : isReserved
                          ? "#f59e0b"
                          : "#ffffff",
                    color: isSelected || isSold || isReserved ? "#ffffff" : "#111827",
                    cursor: isSold || isReserved ? "not-allowed" : "pointer",
                  }}
                >
                  {n}
                </button>
              );
            })}
          </div>
        ) : (
          <div style={styles.notice}>Select a colour to view available numbers.</div>
        )}

        <h2 style={styles.heading}>Basket</h2>

        {basket.length === 0 ? (
          <div style={styles.notice}>No tickets selected yet.</div>
        ) : (
          <div style={styles.basket}>
            {basket.map((t) => (
              <div key={makeTicketKey(t.colour, t.number)} style={styles.basketRow}>
                <span>
                  {t.colour} #{t.number}
                </span>
                <button type="button" onClick={() => remove(t)} style={styles.removeButton}>
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}

        <div style={styles.totalBox}>
          <div>Tickets: {pricing.quantity}</div>
          <div>Total: {formatCurrency(pricing.total, raffle.currency)}</div>
        </div>

        <h2 style={styles.heading}>Your details</h2>

        <div style={styles.form}>
          <input
            value={buyerName}
            onChange={(e) => setBuyerName(e.target.value)}
            placeholder="Your name"
            style={styles.input}
          />
          <input
            value={buyerEmail}
            onChange={(e) => setBuyerEmail(e.target.value)}
            placeholder="Your email"
            type="email"
            style={styles.input}
          />
          <button
            type="button"
            onClick={reserve}
            disabled={saving || basket.length === 0}
            style={styles.primaryButton}
          >
            {saving ? "Reserving..." : "Reserve tickets"}
          </button>
        </div>

        {reservationMessage ? <div style={styles.success}>{reservationMessage}</div> : null}
        {error ? <div style={styles.error}>{error}</div> : null}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    background: "#f8fafc",
    padding: 24,
  },
  container: {
    maxWidth: 1100,
    margin: "0 auto",
    background: "#ffffff",
    borderRadius: 16,
    padding: 24,
    boxShadow: "0 2px 14px rgba(15,23,42,0.08)",
  },
  wrap: {
    padding: 24,
  },
  title: {
    marginTop: 0,
    marginBottom: 8,
    fontSize: 32,
  },
  description: {
    color: "#475569",
  },
  meta: {
    color: "#475569",
    marginBottom: 20,
  },
  heading: {
    marginTop: 24,
    marginBottom: 12,
  },
  colourRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: 10,
  },
  colourButton: {
    border: "none",
    borderRadius: 999,
    padding: "10px 16px",
    fontWeight: 700,
  },
  numberGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(64px, 1fr))",
    gap: 8,
  },
  numberButton: {
    height: 48,
    borderRadius: 10,
    border: "1px solid #cbd5e1",
    fontWeight: 700,
  },
  basket: {
    display: "grid",
    gap: 8,
  },
  basketRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 12,
    border: "1px solid #e2e8f0",
    borderRadius: 10,
  },
  removeButton: {
    border: "none",
    background: "transparent",
    color: "#dc2626",
    fontWeight: 700,
    cursor: "pointer",
  },
  totalBox: {
    marginTop: 20,
    padding: 14,
    borderRadius: 10,
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    display: "grid",
    gap: 6,
    fontWeight: 700,
  },
  form: {
    display: "grid",
    gap: 12,
  },
  input: {
    height: 44,
    padding: "0 12px",
    borderRadius: 10,
    border: "1px solid #cbd5e1",
    fontSize: 16,
  },
  primaryButton: {
    height: 48,
    border: "none",
    borderRadius: 10,
    background: "#16a34a",
    color: "#ffffff",
    fontWeight: 700,
    fontSize: 16,
    cursor: "pointer",
  },
  notice: {
    padding: 12,
    borderRadius: 10,
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    color: "#475569",
  },
  success: {
    marginTop: 16,
    padding: 12,
    borderRadius: 10,
    background: "#ecfdf5",
    border: "1px solid #bbf7d0",
    color: "#166534",
  },
  error: {
    marginTop: 16,
    padding: 12,
    borderRadius: 10,
    background: "#fef2f2",
    border: "1px solid #fecaca",
    color: "#991b1b",
  },
};
