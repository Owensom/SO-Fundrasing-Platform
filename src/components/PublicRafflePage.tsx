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

function getColourStyle(name: string, hex?: string | null): React.CSSProperties {
  const lowered = name.toLowerCase();

  const background =
    hex ||
    (lowered.includes("red")
      ? "#dc2626"
      : lowered.includes("blue")
        ? "#2563eb"
        : lowered.includes("green")
          ? "#16a34a"
          : lowered.includes("yellow")
            ? "#eab308"
            : lowered.includes("orange")
              ? "#f97316"
              : lowered.includes("purple")
                ? "#9333ea"
                : lowered.includes("pink")
                  ? "#ec4899"
                  : lowered.includes("black")
                    ? "#111827"
                    : lowered.includes("white")
                      ? "#ffffff"
                      : "#e5e7eb");

  const isLight =
    background === "#ffffff" ||
    background === "#e5e7eb" ||
    background === "#f3f4f6" ||
    background === "#eab308";

  return {
    background,
    color: isLight ? "#111827" : "#ffffff",
    border: "1px solid rgba(0,0,0,0.12)",
  };
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

  useEffect(() => {
    if (!slug) return;

    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        setError("");
        setReservationMessage("");

        const response = await fetch(`/api/public/raffles/${encodeURIComponent(slug)}`);
        const data = (await response.json()) as PublicRaffleResponse | { error?: string };

        if (!response.ok) {
          throw new Error(data && "error" in data ? data.error || "Failed to load raffle" : "Failed to load raffle");
        }

        if (!cancelled) {
          const nextRaffle = (data as PublicRaffleResponse).raffle;
          setRaffle(nextRaffle);
          setSelectedColour(nextRaffle.colours[0]?.name || "");
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
    if (!raffle) {
      return getBestPrice(0, 0, []);
    }

    return getBestPrice(basket.length, raffle.ticketPrice, raffle.offers);
  }, [basket.length, raffle]);

  const visibleNumbers = useMemo(() => {
    if (!raffle) return [];

    const items: number[] = [];
    for (let n = raffle.startNumber; n <= raffle.endNumber; n += 1) {
      items.push(n);
    }
    return items;
  }, [raffle]);

  function toggleTicket(number: number) {
    if (!raffle || !selectedColour) return;

    const key = makeTicketKey(selectedColour, number);
    if (availability.sold.has(key) || availability.reserved.has(key)) {
      return;
    }

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
    if (!raffle) return;

    try {
      setSaving(true);
      setError("");
      setReservationMessage("");

      if (!buyerName.trim()) {
        throw new Error("Please enter your name.");
      }

      if (!buyerEmail.trim()) {
        throw new Error("Please enter your email.");
      }

      if (basket.length === 0) {
        throw new Error("Please select at least one ticket.");
      }

      const payload: ReserveTicketsRequest = {
        buyerName: buyerName.trim(),
        buyerEmail: buyerEmail.trim(),
        tickets: basket,
      };

      const response = await fetch(`/api/public/raffles/${raffle.id}/reserve`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = (await response.json()) as ReserveTicketsResponse | { error?: string };

      if (!response.ok) {
        throw new Error(data && "error" in data ? data.error || "Failed to reserve tickets" : "Failed to reserve tickets");
      }

      const result = data as ReserveTicketsResponse;

      setReservationMessage(
        `Reserved successfully until ${new Date(result.expiresAt).toLocaleTimeString("en-GB", {
          hour: "2-digit",
          minute: "2-digit",
        })}. Stripe checkout can use reservation group ${result.reservationGroupId}.`,
      );

      if (raffle) {
        setRaffle({
          ...raffle,
          reservedTickets: [
            ...raffle.reservedTickets,
            ...basket.map((ticket) => ({ colour: ticket.colour, number: ticket.number })),
          ],
        });
      }

      setBasket([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reserve tickets");
    } finally {
      setSaving(false);
    }
  }

  if (!slug) {
    return <div style={styles.centered}>Loading…</div>;
  }

  if (loading) {
    return <div style={styles.centered}>Loading raffle…</div>;
  }

  if (error && !raffle) {
    return <div style={styles.centeredError}>{error}</div>;
  }

  if (!raffle) {
    return <div style={styles.centeredError}>Raffle not found.</div>;
  }

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <div style={styles.headerCard}>
          <h1 style={styles.title}>{raffle.title}</h1>
          <div style={styles.metaRow}>
            <span>
              Tickets {raffle.startNumber}–{raffle.endNumber}
            </span>
            <span>•</span>
            <span>{formatCurrency(raffle.ticketPrice, raffle.currency)} each</span>
          </div>

          {raffle.offers.length > 0 && (
            <div style={styles.offerBar}>
              {raffle.offers
                .filter((offer) => offer.isActive)
                .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
                .map((offer) => (
                  <div key={offer.id} style={styles.offerPill}>
                    <strong>{offer.label}</strong>
                    <span>
                      {offer.quantity} for {formatCurrency(offer.price, raffle.currency)}
                    </span>
                  </div>
                ))}
            </div>
          )}
        </div>

        <div style={styles.layout}>
          <div style={styles.mainPanel}>
            <div style={styles.sectionCard}>
              <h2 style={styles.sectionTitle}>1. Pick a colour</h2>

              <div style={styles.colourTabs}>
                {raffle.colours.map((colour) => {
                  const active = selectedColour === colour.name;
                  return (
                    <button
                      key={colour.id}
                      type="button"
                      onClick={() => setSelectedColour(colour.name)}
                      style={{
                        ...styles.colourTab,
                        ...getColourStyle(colour.name, colour.hex),
                        boxShadow: active ? "0 0 0 3px rgba(59,130,246,0.25)" : "none",
                        transform: active ? "translateY(-1px)" : "none",
                      }}
                    >
                      {colour.name}
                    </button>
                  );
                })}
              </div>
            </div>

            <div style={styles.sectionCard}>
              <h2 style={styles.sectionTitle}>2. Pick your numbers</h2>

              <div style={styles.legend}>
                <span><strong>Available</strong></span>
                <span><strong>Selected</strong></span>
                <span><strong>Reserved</strong></span>
                <span><strong>Sold</strong></span>
              </div>

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
                      disabled={isSold || isReserved}
                      style={{
                        ...styles.numberButton,
                        ...(isSelected
                          ? styles.numberButtonSelected
                          : isSold
                            ? styles.numberButtonSold
                            : isReserved
                              ? styles.numberButtonReserved
                              : styles.numberButtonAvailable),
                      }}
                      title={`${selectedColour} ${number}`}
                    >
                      {number}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <aside style={styles.sidebar}>
            <div style={styles.sectionCard}>
              <h2 style={styles.sectionTitle}>3. Your basket</h2>

              {basket.length === 0 ? (
                <p style={styles.muted}>No tickets selected yet.</p>
              ) : (
                <>
                  <div style={styles.basketList}>
                    {basket.map((ticket) => (
                      <div
                        key={makeTicketKey(ticket.colour, ticket.number)}
                        style={styles.basketRow}
                      >
                        <span>
                          {ticket.colour} #{ticket.number}
                        </span>
                        <button
                          type="button"
                          onClick={() => removeFromBasket(ticket)}
                          style={styles.removeButton}
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>

                  <div style={styles.pricingBox}>
                    <div style={styles.pricingRow}>
                      <span>Tickets</span>
                      <strong>{pricing.quantity}</strong>
                    </div>
                    <div style={styles.pricingRow}>
                      <span>Subtotal</span>
                      <strong>{formatCurrency(pricing.subtotal, raffle.currency)}</strong>
                    </div>

                    {pricing.appliedOffers.map((offer) => (
                      <div key={offer.offerId} style={styles.pricingRow}>
                        <span>
                          {offer.label} × {offer.count}
                        </span>
                        <strong>-</strong>
                      </div>
                    ))}

                    {pricing.singlesCount > 0 && (
                      <div style={styles.pricingRow}>
                        <span>Singles ({pricing.singlesCount})</span>
                        <strong>
                          {formatCurrency(pricing.singlesTotal, raffle.currency)}
                        </strong>
                      </div>
                    )}

                    {pricing.discount > 0 && (
                      <div style={styles.pricingRow}>
                        <span>Discount</span>
                        <strong>
                          -{formatCurrency(pricing.discount, raffle.currency)}
                        </strong>
                      </div>
                    )}

                    <div style={styles.pricingTotalRow}>
                      <span>Total</span>
                      <strong>{formatCurrency(pricing.total, raffle.currency)}</strong>
                    </div>
                  </div>
                </>
              )}
            </div>

            <div style={styles.sectionCard}>
              <h2 style={styles.sectionTitle}>4. Reserve and continue</h2>

              <label style={styles.label}>
                Name
                <input
                  value={buyerName}
                  onChange={(e) => setBuyerName(e.target.value)}
                  placeholder="Your name"
                  style={styles.input}
                />
              </label>

              <label style={styles.label}>
                Email
                <input
                  value={buyerEmail}
                  onChange={(e) => setBuyerEmail(e.target.value)}
                  placeholder="you@example.com"
                  type="email"
                  style={styles.input}
                />
              </label>

              <button
                type="button"
                onClick={reserveTickets}
                disabled={saving || basket.length === 0}
                style={styles.primaryButton}
              >
                {saving ? "Reserving..." : "Reserve tickets"}
              </button>

              <p style={styles.muted}>
                Next step: create Stripe Checkout using the returned reservation group.
              </p>

              {reservationMessage ? (
                <div style={styles.successBox}>{reservationMessage}</div>
              ) : null}

              {error ? <div style={styles.errorBox}>{error}</div> : null}
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    background: "#f8fafc",
    padding: "24px 16px 40px",
  },
  container: {
    maxWidth: 1320,
    margin: "0 auto",
  },
  headerCard: {
    background: "#ffffff",
    borderRadius: 16,
    padding: 24,
    boxShadow: "0 2px 14px rgba(15,23,42,0.08)",
    marginBottom: 20,
  },
  title: {
    margin: 0,
    fontSize: 32,
    lineHeight: 1.15,
  },
  metaRow: {
    display: "flex",
    gap: 12,
    alignItems: "center",
    color: "#475569",
    marginTop: 10,
    flexWrap: "wrap",
  },
  offerBar: {
    display: "flex",
    gap: 12,
    flexWrap: "wrap",
    marginTop: 18,
  },
  offerPill: {
    display: "flex",
    gap: 8,
    alignItems: "center",
    padding: "10px 14px",
    borderRadius: 999,
    background: "#eff6ff",
    color: "#1e3a8a",
    border: "1px solid #bfdbfe",
    fontSize: 14,
  },
  layout: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) 360px",
    gap: 20,
  },
  mainPanel: {
    display: "grid",
    gap: 20,
  },
  sidebar: {
    display: "grid",
    gap: 20,
    alignSelf: "start",
    position: "sticky",
    top: 16,
  },
  sectionCard: {
    background: "#ffffff",
    borderRadius: 16,
    padding: 20,
    boxShadow: "0 2px 14px rgba(15,23,42,0.08)",
  },
  sectionTitle: {
    marginTop: 0,
    marginBottom: 16,
    fontSize: 20,
  },
  colourTabs: {
    display: "flex",
    flexWrap: "wrap",
    gap: 10,
  },
  colourTab: {
    borderRadius: 999,
    padding: "10px 16px",
    fontWeight: 700,
    cursor: "pointer",
  },
  legend: {
    display: "flex",
    gap: 14,
    flexWrap: "wrap",
    color: "#475569",
    marginBottom: 12,
    fontSize: 14,
  },
  numberGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(68px, 1fr))",
    gap: 10,
  },
  numberButton: {
    height: 54,
    borderRadius: 12,
    border: "1px solid #cbd5e1",
    fontWeight: 700,
    fontSize: 16,
    cursor: "pointer",
  },
  numberButtonAvailable: {
    background: "#ffffff",
    color: "#0f172a",
  },
  numberButtonSelected: {
    background: "#2563eb",
    color: "#ffffff",
    border: "1px solid #2563eb",
  },
  numberButtonReserved: {
    background: "#f59e0b",
    color: "#ffffff",
    border: "1px solid #f59e0b",
    cursor: "not-allowed",
  },
  numberButtonSold: {
    background: "#0f172a",
    color: "#ffffff",
    border: "1px solid #0f172a",
    cursor: "not-allowed",
  },
  basketList: {
    display: "grid",
    gap: 8,
    marginBottom: 16,
  },
  basketRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "10px 12px",
    background: "#f8fafc",
    borderRadius: 12,
    border: "1px solid #e2e8f0",
  },
  removeButton: {
    border: "none",
    background: "transparent",
    color: "#dc2626",
    cursor: "pointer",
    fontWeight: 700,
  },
  pricingBox: {
    borderTop: "1px solid #e2e8f0",
    paddingTop: 14,
    display: "grid",
    gap: 10,
  },
  pricingRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
  },
  pricingTotalRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    fontSize: 18,
    paddingTop: 10,
    borderTop: "1px solid #e2e8f0",
  },
  label: {
    display: "grid",
    gap: 6,
    marginBottom: 12,
    fontWeight: 600,
  },
  input: {
    height: 44,
    borderRadius: 12,
    border: "1px solid #cbd5e1",
    padding: "0 12px",
    fontSize: 16,
  },
  primaryButton: {
    width: "100%",
    height: 48,
    borderRadius: 12,
    border: "none",
    background: "#16a34a",
    color: "#ffffff",
    fontWeight: 700,
    fontSize: 16,
    cursor: "pointer",
    marginTop: 6,
  },
  muted: {
    color: "#64748b",
    fontSize: 14,
  },
  successBox: {
    marginTop: 14,
    padding: 12,
    borderRadius: 12,
    background: "#ecfdf5",
    color: "#166534",
    border: "1px solid #bbf7d0",
  },
  errorBox: {
    marginTop: 14,
    padding: 12,
    borderRadius: 12,
    background: "#fef2f2",
    color: "#991b1b",
    border: "1px solid #fecaca",
  },
  centered: {
    minHeight: "50vh",
    display: "grid",
    placeItems: "center",
    color: "#334155",
    fontSize: 18,
  },
  centeredError: {
    minHeight: "50vh",
    display: "grid",
    placeItems: "center",
    color: "#991b1b",
    fontSize: 18,
  },
};
