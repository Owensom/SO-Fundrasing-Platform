import React, { useEffect, useMemo, useState } from "react";
import { getBestPrice } from "../lib/rafflePricing";
import type { TicketSelection } from "../types/raffles";

type Props = {
  slug: string;
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

type SafeRaffle = {
  id: string;
  slug: string;
  title: string;
  description: string;
  imageUrl: string;
  startNumber: number;
  endNumber: number;
  currency: string;
  ticketPrice: number;
  status: "draft" | "published" | "completed";
  colours: RaffleColour[];
  offers: RaffleOffer[];
  reservedTickets: Array<{ colour: string; number: number }>;
  soldTickets: Array<{ colour: string; number: number }>;
};

function makeTicketKey(colour: string, number: number) {
  return `${colour}::${number}`;
}

function formatCurrency(value: number, currency: string) {
  try {
    return new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency: currency || "EUR",
    }).format(Number.isFinite(value) ? value : 0);
  } catch {
    return `${currency || "EUR"} ${(Number.isFinite(value) ? value : 0).toFixed(2)}`;
  }
}

function normaliseFrontendStatus(rawStatus: unknown): "draft" | "published" | "completed" {
  const status = String(rawStatus ?? "").trim().toLowerCase();

  if (
    status === "published" ||
    status === "active" ||
    status === "live" ||
    status === "open" ||
    status === "public"
  ) {
    return "published";
  }

  if (
    status === "completed" ||
    status === "complete" ||
    status === "closed" ||
    status === "ended" ||
    status === "finished" ||
    status === "drawn"
  ) {
    return "completed";
  }

  return "draft";
}

function toSafeRaffle(input: any): SafeRaffle {
  const raw = input ?? {};
  const colours = Array.isArray(raw.colours) ? raw.colours : [];
  const offers = Array.isArray(raw.offers) ? raw.offers : [];
  const reservedTickets = Array.isArray(raw.reservedTickets) ? raw.reservedTickets : [];
  const soldTickets = Array.isArray(raw.soldTickets) ? raw.soldTickets : [];

  const startNumber = Number(raw.startNumber);
  const endNumber = Number(raw.endNumber);

  return {
    id: String(raw.id ?? ""),
    slug: String(raw.slug ?? ""),
    title: String(raw.title ?? "Raffle"),
    description: String(raw.description ?? ""),
    imageUrl: String(raw.imageUrl ?? raw.image_url ?? ""),
    startNumber: Number.isFinite(startNumber) ? startNumber : 1,
    endNumber: Number.isFinite(endNumber) ? endNumber : 1,
    currency: String(raw.currency ?? "EUR"),
    ticketPrice: Number.isFinite(Number(raw.ticketPrice)) ? Number(raw.ticketPrice) : 0,
    status: normaliseFrontendStatus(raw.status),
    colours: colours.map((c: any, index: number) => ({
      id: String(c?.id ?? `colour-${index}`),
      name: String(c?.name ?? `Colour ${index + 1}`),
      hex: c?.hex ? String(c.hex) : null,
      sortOrder: Number.isFinite(Number(c?.sortOrder)) ? Number(c.sortOrder) : index,
    })),
    offers: offers.map((o: any, index: number) => ({
      id: String(o?.id ?? `offer-${index}`),
      label: String(o?.label ?? `Offer ${index + 1}`),
      quantity: Number.isFinite(Number(o?.quantity)) ? Number(o.quantity) : 0,
      price: Number.isFinite(Number(o?.price)) ? Number(o.price) : 0,
      isActive: Boolean(o?.isActive ?? true),
      sortOrder: Number.isFinite(Number(o?.sortOrder)) ? Number(o.sortOrder) : index,
    })),
    reservedTickets: reservedTickets.map((t: any) => ({
      colour: String(t?.colour ?? ""),
      number: Number.isFinite(Number(t?.number)) ? Number(t.number) : 0,
    })),
    soldTickets: soldTickets.map((t: any) => ({
      colour: String(t?.colour ?? ""),
      number: Number.isFinite(Number(t?.number)) ? Number(t.number) : 0,
    })),
  };
}

export default function PublicRafflePage({ slug }: Props) {
  const [raffle, setRaffle] = useState<SafeRaffle | null>(null);
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

        const response = await fetch(`/api/public/raffles/${encodeURIComponent(slug)}`);
        const text = await response.text();

        let parsed: any = null;
        try {
          parsed = JSON.parse(text);
        } catch {
          throw new Error(`API did not return JSON: ${text.slice(0, 120)}`);
        }

        if (!response.ok) {
          throw new Error(parsed?.error || "Failed to load raffle");
        }

        const safe = toSafeRaffle(parsed?.raffle);

        if (!cancelled) {
          setRaffle(safe);
          setSelectedColour(safe.colours[0]?.name ?? "");
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

    if (!raffle) return { sold, reserved };

    for (const t of raffle.soldTickets) {
      sold.add(makeTicketKey(t.colour, t.number));
    }

    for (const t of raffle.reservedTickets) {
      reserved.add(makeTicketKey(t.colour, t.number));
    }

    return { sold, reserved };
  }, [raffle]);

  const basketKeys = useMemo(() => {
    return new Set(basket.map((t) => makeTicketKey(t.colour, t.number)));
  }, [basket]);

  const visibleNumbers = useMemo(() => {
    if (!raffle) return [];
    if (!Number.isFinite(raffle.startNumber) || !Number.isFinite(raffle.endNumber)) return [];
    if (raffle.endNumber < raffle.startNumber) return [];

    const out: number[] = [];
    for (let n = raffle.startNumber; n <= raffle.endNumber; n += 1) {
      out.push(n);
    }
    return out;
  }, [raffle]);

  const isPublished = raffle?.status === "published";
  const isCompleted = raffle?.status === "completed";
  const canReserve = Boolean(raffle && isPublished);

  const pricing = useMemo(() => {
    if (!raffle) return getBestPrice(0, 0, []);
    return getBestPrice(
      basket.length,
      raffle.ticketPrice,
      isCompleted ? [] : raffle.offers.filter((o) => o.isActive),
    );
  }, [basket.length, raffle, isCompleted]);

  function toggleTicket(number: number) {
    if (!raffle || !selectedColour || !canReserve) return;

    const key = makeTicketKey(selectedColour, number);
    if (availability.sold.has(key) || availability.reserved.has(key)) return;

    setBasket((current) => {
      const exists = current.some(
        (ticket) => ticket.colour === selectedColour && ticket.number === number,
      );

      if (exists) {
        return current.filter(
          (ticket) => !(ticket.colour === selectedColour && ticket.number === number),
        );
      }

      return [...current, { colour: selectedColour, number }].sort((a, b) => {
        if (a.colour !== b.colour) return a.colour.localeCompare(b.colour);
        return a.number - b.number;
      });
    });
  }

  function removeFromBasket(ticket: TicketSelection) {
    setBasket((current) =>
      current.filter(
        (item) => !(item.colour === ticket.colour && item.number === ticket.number),
      ),
    );
  }

  async function reserveTickets() {
    if (!raffle || !canReserve) return;

    try {
      setSaving(true);
      setError("");
      setReservationMessage("");

      if (!buyerName.trim()) throw new Error("Please enter your name.");
      if (!buyerEmail.trim()) throw new Error("Please enter your email.");
      if (basket.length === 0) throw new Error("Please select at least one ticket.");

      const response = await fetch(`/api/public/raffles/${encodeURIComponent(raffle.slug)}/reserve`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          buyerName: buyerName.trim(),
          buyerEmail: buyerEmail.trim(),
          tickets: basket,
        }),
      });

      const text = await response.text();

      let parsed: any = null;
      try {
        parsed = JSON.parse(text);
      } catch {
        throw new Error(`Reserve API did not return JSON: ${text.slice(0, 120)}`);
      }

      if (!response.ok) {
        throw new Error(parsed?.error || "Reserve failed");
      }

      setReservationMessage(`Reserved until ${parsed?.expiresAt ?? ""}`);
      setBasket([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reserve failed");
    } finally {
      setSaving(false);
    }
  }

  if (!slug) {
    return <div style={styles.wrap}>Loading…</div>;
  }

  if (loading) {
    return <div style={styles.wrap}>Loading raffle…</div>;
  }

  if (error && !raffle) {
    return <div style={styles.wrap}>{error}</div>;
  }

  if (!raffle) {
    return <div style={styles.wrap}>Raffle not found.</div>;
  }

  const backgroundImage = raffle.imageUrl;

  return (
    <div style={styles.page}>
      <div
        style={{
          ...styles.hero,
          ...(backgroundImage
            ? {
                backgroundImage: `linear-gradient(rgba(15,23,42,0.55), rgba(15,23,42,0.55)), url("${backgroundImage}")`,
                backgroundSize: "cover",
                backgroundPosition: "center",
                backgroundRepeat: "no-repeat",
              }
            : {
                background:
                  "linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #334155 100%)",
              }),
        }}
      >
        <div style={styles.heroInner}>
          <h1 style={styles.heroTitle}>{raffle.title}</h1>
          {raffle.description ? (
            <p style={styles.heroDescription}>{raffle.description}</p>
          ) : null}
          <p style={styles.heroMeta}>
            Tickets {raffle.startNumber}–{raffle.endNumber} •{" "}
            {formatCurrency(raffle.ticketPrice, raffle.currency)}
          </p>

          {isCompleted ? (
            <div style={styles.statusCompleted}>Completed</div>
          ) : isPublished ? (
            <div style={styles.statusPublished}>Published</div>
          ) : (
            <div style={styles.statusDraft}>Draft</div>
          )}
        </div>
      </div>

      <div style={styles.container}>
        {isCompleted ? (
          <div style={styles.noticeDark}>
            This raffle is completed. You can view it, but reservations are closed.
          </div>
        ) : null}

        {!isCompleted && !isPublished ? (
          <div style={styles.notice}>
            This raffle is not published yet.
          </div>
        ) : null}

        {raffle.colours.length > 0 ? (
          <>
            <h2 style={styles.heading}>Choose colour</h2>
            <div style={styles.colourRow}>
              {raffle.colours.map((colour) => (
                <button
                  key={colour.id}
                  type="button"
                  onClick={() => setSelectedColour(colour.name)}
                  disabled={!canReserve}
                  style={{
                    ...styles.colourButton,
                    background: selectedColour === colour.name ? "#2563eb" : "#e5e7eb",
                    color: selectedColour === colour.name ? "#ffffff" : "#111827",
                    opacity: canReserve ? 1 : 0.75,
                    cursor: canReserve ? "pointer" : "not-allowed",
                  }}
                >
                  {colour.name}
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
            {visibleNumbers.map((number) => {
              const key = makeTicketKey(selectedColour, number);
              const isSold = availability.sold.has(key);
              const isReserved = availability.reserved.has(key);
              const isSelected = basketKeys.has(key);

              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => toggleTicket(number)}
                  disabled={isSold || isReserved || !canReserve}
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
                    cursor: isSold || isReserved || !canReserve ? "not-allowed" : "pointer",
                    opacity: canReserve ? 1 : 0.75,
                  }}
                >
                  {number}
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
            {basket.map((ticket) => (
              <div key={makeTicketKey(ticket.colour, ticket.number)} style={styles.basketRow}>
                <span>
                  {ticket.colour} #{ticket.number}
                </span>
                <button
                  type="button"
                  onClick={() => removeFromBasket(ticket)}
                  style={styles.removeButton}
                  disabled={!canReserve}
                >
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
            disabled={!canReserve}
          />
          <input
            value={buyerEmail}
            onChange={(e) => setBuyerEmail(e.target.value)}
            placeholder="Your email"
            type="email"
            style={styles.input}
            disabled={!canReserve}
          />
          <button
            type="button"
            onClick={reserveTickets}
            disabled={saving || basket.length === 0 || !canReserve}
            style={{
              ...styles.primaryButton,
              opacity: saving || basket.length === 0 || !canReserve ? 0.6 : 1,
              cursor: saving || basket.length === 0 || !canReserve ? "not-allowed" : "pointer",
            }}
          >
            {isCompleted ? "Completed" : saving ? "Reserving..." : "Reserve tickets"}
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
  },
  hero: {
    minHeight: 320,
    display: "flex",
    alignItems: "flex-end",
    padding: "32px 24px",
  },
  heroInner: {
    maxWidth: 1100,
    width: "100%",
    margin: "0 auto",
    color: "#ffffff",
  },
  heroTitle: {
    margin: 0,
    fontSize: 40,
    lineHeight: 1.1,
  },
  heroDescription: {
    marginTop: 12,
    maxWidth: 760,
    fontSize: 18,
    lineHeight: 1.5,
    color: "rgba(255,255,255,0.92)",
  },
  heroMeta: {
    marginTop: 12,
    fontSize: 16,
    color: "rgba(255,255,255,0.88)",
  },
  statusPublished: {
    display: "inline-block",
    marginTop: 14,
    padding: "8px 12px",
    borderRadius: 999,
    background: "rgba(34,197,94,0.2)",
    border: "1px solid rgba(34,197,94,0.5)",
    color: "#dcfce7",
    fontWeight: 700,
  },
  statusCompleted: {
    display: "inline-block",
    marginTop: 14,
    padding: "8px 12px",
    borderRadius: 999,
    background: "rgba(148,163,184,0.22)",
    border: "1px solid rgba(226,232,240,0.5)",
    color: "#f8fafc",
    fontWeight: 700,
  },
  statusDraft: {
    display: "inline-block",
    marginTop: 14,
    padding: "8px 12px",
    borderRadius: 999,
    background: "rgba(245,158,11,0.2)",
    border: "1px solid rgba(245,158,11,0.45)",
    color: "#fef3c7",
    fontWeight: 700,
  },
  container: {
    maxWidth: 1100,
    margin: "0 auto",
    background: "#ffffff",
    borderRadius: 16,
    padding: 24,
    boxShadow: "0 2px 14px rgba(15,23,42,0.08)",
    marginTop: -32,
    position: "relative",
  },
  wrap: {
    padding: 24,
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
  },
  notice: {
    padding: 12,
    borderRadius: 10,
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    color: "#475569",
  },
  noticeDark: {
    padding: 12,
    borderRadius: 10,
    background: "#0f172a",
    border: "1px solid #1e293b",
    color: "#e2e8f0",
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
