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
  reservedTickets: Array<{ colour: string; number: number }>;
  soldTickets: Array<{ colour: string; number: number }>;
  winnerTicketNumber: number | null;
  winnerColour: string | null;
  drawnAt: string | null;
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

function formatDateTime(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function normaliseFrontendStatus(rawStatus: unknown): SafeRaffleStatus {
  const status = String(rawStatus ?? "").trim().toLowerCase();
  if (status === "published") return "published";
  if (status === "drawn") return "drawn";
  if (status === "closed") return "closed";
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
  const rawWinnerTicketNumber = raw.winnerTicketNumber ?? raw.winner_ticket_number;
  const winnerTicketNumber = Number(rawWinnerTicketNumber);

  return {
    id: String(raw.id ?? ""),
    slug: String(raw.slug ?? ""),
    title: String(raw.title ?? "Raffle"),
    description: String(raw.description ?? ""),
    imageUrl: String(raw.imageUrl ?? raw.image_url ?? ""),
    tenantSlug: String(raw.tenantSlug ?? raw.tenant_slug ?? ""),
    startNumber: Number.isFinite(startNumber) ? startNumber : 1,
    endNumber: Number.isFinite(endNumber) ? endNumber : 1,
    currency: String(raw.currency ?? "EUR"),
    ticketPrice: Number.isFinite(Number(raw.ticketPrice)) ? Number(raw.ticketPrice) : 0,
    status: normaliseFrontendStatus(raw.status),
    colours: colours.map((c: any, index: number) => ({
      id: String(c?.id ?? `colour-${index}`),
      name: String(c?.name ?? c ?? `Colour ${index + 1}`),
      hex: c?.hex ? String(c.hex) : null,
      sortOrder: Number.isFinite(Number(c?.sortOrder)) ? Number(c.sortOrder) : index,
    })),
    offers: offers.map((o: any, index: number) => ({
      id: String(o?.id ?? `offer-${index}`),
      label: String(o?.label ?? `Offer ${index + 1}`),
      quantity: Number.isFinite(Number(o?.quantity)) ? Number(o.quantity) : 0,
      price: Number.isFinite(Number(o?.price)) ? Number(o.price) : 0,
      isActive: Boolean(o?.isActive ?? o?.is_active ?? true),
      sortOrder: Number.isFinite(Number(o?.sortOrder ?? o?.sort_order))
        ? Number(o?.sortOrder ?? o?.sort_order)
        : index,
    })),
    reservedTickets: reservedTickets.map((t: any) => ({
      colour: String(t?.colour ?? ""),
      number: Number.isFinite(Number(t?.number)) ? Number(t.number) : 0,
    })),
    soldTickets: soldTickets.map((t: any) => ({
      colour: String(t?.colour ?? ""),
      number: Number.isFinite(Number(t?.number)) ? Number(t.number) : 0,
    })),
    winnerTicketNumber: Number.isFinite(winnerTicketNumber) ? winnerTicketNumber : null,
    winnerColour:
      raw.winnerColour ?? raw.winner_colour
        ? String(raw.winnerColour ?? raw.winner_colour)
        : null,
    drawnAt:
      raw.drawnAt ?? raw.drawn_at
        ? String(raw.drawnAt ?? raw.drawn_at)
        : null,
  };
}

function calculateBestPrice(quantity: number, ticketPrice: number, offers: RaffleOffer[]) {
  const activeOffers = offers
    .filter((o) => o.isActive && o.quantity > 0 && o.price > 0)
    .sort((a, b) => {
      if (b.quantity !== a.quantity) return b.quantity - a.quantity;
      return (a.sortOrder ?? 0) - (b.sortOrder ?? 0);
    });

  let remaining = quantity;
  let total = 0;
  const appliedOffers: Array<{ label: string; quantity: number; price: number; times: number }> = [];

  for (const offer of activeOffers) {
    const times = Math.floor(remaining / offer.quantity);

    if (times > 0) {
      total += times * offer.price;
      remaining -= times * offer.quantity;
      appliedOffers.push({
        label: offer.label,
        quantity: offer.quantity,
        price: offer.price,
        times,
      });
    }
  }

  total += remaining * ticketPrice;

  const standardTotal = quantity * ticketPrice;
  const savings = Math.max(standardTotal - total, 0);

  return {
    quantity,
    total,
    standardTotal,
    savings,
    appliedOffers,
  };
}

function renderColourLabel(colour: RaffleColour) {
  if (colour.hex) {
    return (
      <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
        <span
          style={{
            width: 14,
            height: 14,
            borderRadius: 999,
            background: colour.hex,
            border: "1px solid #cbd5e1",
            display: "inline-block",
          }}
        />
        {colour.name}
      </span>
    );
  }

  return colour.name;
}

export default function PublicRafflePage({ slug }: Props) {
  const [raffle, setRaffle] = useState<SafeRaffle | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [selectedColour, setSelectedColour] = useState("");
  const [basket, setBasket] = useState<TicketSelection[]>([]);
  const [autoQuantity, setAutoQuantity] = useState(1);
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

        const response = await fetch(`/api/raffles/${encodeURIComponent(slug)}`);
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

  const basketKeys = useMemo(
    () => new Set(basket.map((t) => makeTicketKey(t.colour, t.number))),
    [basket]
  );

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
  const isClosed = raffle?.status === "closed";
  const isDrawn = raffle?.status === "drawn";
  const isDraft = raffle?.status === "draft";
  const canReserve = Boolean(raffle && isPublished);

  const pricing = useMemo(() => {
    if (!raffle) {
      return {
        quantity: 0,
        total: 0,
        standardTotal: 0,
        savings: 0,
        appliedOffers: [] as Array<{ label: string; quantity: number; price: number; times: number }>,
      };
    }

    return calculateBestPrice(basket.length, raffle.ticketPrice, isPublished ? raffle.offers : []);
  }, [basket.length, raffle, isPublished]);

  const availableCount = useMemo(() => {
    if (!raffle) return 0;

    let count = 0;

    for (const colour of raffle.colours) {
      for (const number of visibleNumbers) {
        const key = makeTicketKey(colour.name, number);

        if (!availability.sold.has(key) && !availability.reserved.has(key)) {
          count += 1;
        }
      }
    }

    return count;
  }, [raffle, visibleNumbers, availability]);

  function toggleTicket(number: number) {
    if (!raffle || !selectedColour || !canReserve) return;

    const key = makeTicketKey(selectedColour, number);
    if (availability.sold.has(key) || availability.reserved.has(key)) return;

    setBasket((current) => {
      const exists = current.some(
        (ticket) => ticket.colour === selectedColour && ticket.number === number
      );

      if (exists) {
        return current.filter(
          (ticket) => !(ticket.colour === selectedColour && ticket.number === number)
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
        (item) => !(item.colour === ticket.colour && item.number === ticket.number)
      )
    );
  }

  function clearBasket() {
    setBasket([]);
    setError("");
    setReservationMessage("");
  }

  function autoSelectTickets() {
    if (!raffle || !canReserve) return;

    const requested = Math.max(1, Math.floor(Number(autoQuantity) || 0));

    if (requested <= 0) {
      setError("Enter how many tickets you would like.");
      return;
    }

    const currentKeys = new Set(basket.map((t) => makeTicketKey(t.colour, t.number)));
    const selected: TicketSelection[] = [...basket];

    const sortedColours = raffle.colours
      .slice()
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));

    let colourIndex = 0;
    let safety = 0;

    while (selected.length < requested && safety < requested * visibleNumbers.length * Math.max(sortedColours.length, 1)) {
      const colour = sortedColours[colourIndex % Math.max(sortedColours.length, 1)];
      colourIndex += 1;
      safety += 1;

      if (!colour) break;

      const nextNumber = visibleNumbers.find((number) => {
        const key = makeTicketKey(colour.name, number);

        return (
          !currentKeys.has(key) &&
          !availability.sold.has(key) &&
          !availability.reserved.has(key)
        );
      });

      if (nextNumber == null) {
        const everyColourFull = sortedColours.every((c) =>
          visibleNumbers.every((number) => {
            const key = makeTicketKey(c.name, number);
            return (
              currentKeys.has(key) ||
              availability.sold.has(key) ||
              availability.reserved.has(key)
            );
          })
        );

        if (everyColourFull) break;

        continue;
      }

      const key = makeTicketKey(colour.name, nextNumber);
      currentKeys.add(key);
      selected.push({ colour: colour.name, number: nextNumber });
    }

    if (selected.length < requested) {
      setBasket(selected);
      setError(`Only ${selected.length} ticket${selected.length === 1 ? "" : "s"} could be selected. Not enough tickets are available.`);
      return;
    }

    setBasket(
      selected.sort((a, b) => {
        if (a.colour !== b.colour) return a.colour.localeCompare(b.colour);
        return a.number - b.number;
      })
    );
    setError("");
    setReservationMessage("");
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

      const selectedTickets = basket.map((ticket) => ({
        ticket_number: ticket.number,
        colour: ticket.colour,
      }));

      const reserveResponse = await fetch(
        `/api/raffles/${encodeURIComponent(raffle.slug)}/reserve`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tenantSlug: raffle.tenantSlug,
            buyerName: buyerName.trim(),
            buyerEmail: buyerEmail.trim(),
            quantity: basket.length,
            selectedTickets,
          }),
        }
      );

      const reserveText = await reserveResponse.text();

      let reserveParsed: any = null;
      try {
        reserveParsed = JSON.parse(reserveText);
      } catch {
        throw new Error(`Reserve API did not return JSON: ${reserveText.slice(0, 120)}`);
      }

      if (!reserveResponse.ok) {
        throw new Error(reserveParsed?.error || "Reserve failed");
      }

      const reservationToken = String(reserveParsed?.reservationToken ?? "").trim();

      if (!reservationToken) {
        throw new Error("Reservation succeeded but no reservation token was returned.");
      }

      setReservationMessage(`Reserved until ${String(reserveParsed?.expiresAt ?? "")}`);

      const checkoutResponse = await fetch(`/api/stripe/checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          raffleId: raffle.id,
          reservationToken,
        }),
      });

      const checkoutText = await checkoutResponse.text();

      let checkoutParsed: any = null;
      try {
        checkoutParsed = JSON.parse(checkoutText);
      } catch {
        throw new Error(`Checkout API did not return JSON: ${checkoutText.slice(0, 120)}`);
      }

      if (!checkoutResponse.ok) {
        throw new Error(checkoutParsed?.error || "Checkout failed");
      }

      const checkoutUrl = String(
        checkoutParsed?.url ??
          checkoutParsed?.checkoutUrl ??
          checkoutParsed?.sessionUrl ??
          ""
      ).trim();

      if (!checkoutUrl) {
        throw new Error("Checkout session created but no checkout URL was returned.");
      }

      window.location.href = checkoutUrl;
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
        {raffle.imageUrl ? (
          <img
            src={raffle.imageUrl}
            alt={raffle.title}
            style={{
              width: "100%",
              maxHeight: 360,
              objectFit: "cover",
              borderRadius: 16,
              marginBottom: 20,
              border: "1px solid #e2e8f0",
            }}
          />
        ) : null}

        <h1>{raffle.title}</h1>
        {raffle.description ? <p>{raffle.description}</p> : null}

        <div style={styles.totalBox}>
          <div>Ticket price: {formatCurrency(raffle.ticketPrice, raffle.currency)}</div>
          <div>Range: {raffle.startNumber} to {raffle.endNumber}</div>
          <div>Status: {raffle.status}</div>
          <div>Available now: {availableCount}</div>
        </div>

        {isDrawn ? (
          <div style={styles.success}>
            Winning ticket:{" "}
            {raffle.winnerTicketNumber != null ? `#${raffle.winnerTicketNumber}` : "—"}{" "}
            | Colour: {raffle.winnerColour || "—"} | Drawn at: {formatDateTime(raffle.drawnAt)}
          </div>
        ) : null}

        {isClosed ? (
          <div style={styles.noticeDark}>
            This raffle is now closed. Reservations and payments are no longer available.
          </div>
        ) : null}

        {isDraft ? <div style={styles.notice}>This raffle is not published yet.</div> : null}

        {canReserve ? (
          <section style={styles.quickSelect}>
            <div>
              <h2 style={{ margin: 0 }}>Quick buy</h2>
              <p style={{ margin: "6px 0 0", color: "#64748b" }}>
                Choose how many tickets you would like and we’ll auto-select available numbers across colours.
              </p>
            </div>

            <div style={styles.quickControls}>
              <label style={{ display: "grid", gap: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: "#475569" }}>
                  Number of tickets
                </span>
                <input
                  type="number"
                  min={1}
                  max={availableCount || 1}
                  value={autoQuantity}
                  onChange={(e) => setAutoQuantity(Math.max(1, Number(e.target.value) || 1))}
                  style={styles.quantityInput}
                />
              </label>

              <button type="button" onClick={autoSelectTickets} style={styles.autoButton}>
                Auto select
              </button>

              <button type="button" onClick={clearBasket} style={styles.clearButton}>
                Clear basket
              </button>
            </div>
          </section>
        ) : null}

        {raffle.offers.length > 0 && canReserve ? (
          <section style={styles.offerBox}>
            <div style={{ fontWeight: 800, marginBottom: 8 }}>Available offers</div>
            <div style={styles.offerGrid}>
              {raffle.offers
                .filter((offer) => offer.isActive)
                .slice()
                .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
                .map((offer) => (
                  <div key={offer.id} style={styles.offerPill}>
                    {offer.label} — {formatCurrency(offer.price, raffle.currency)}
                  </div>
                ))}
            </div>
          </section>
        ) : null}

        <h2 style={styles.heading}>Choose colour</h2>
        <div style={styles.colourRow}>
          {raffle.colours.length === 0 ? (
            <div style={styles.notice}>No colours configured.</div>
          ) : (
            raffle.colours.map((colour) => (
              <button
                key={colour.id}
                type="button"
                onClick={() => setSelectedColour(colour.name)}
                disabled={!canReserve}
                style={{
                  ...styles.colourButton,
                  background: selectedColour === colour.name ? "#2563eb" : "#e5e7eb",
                  color: selectedColour === colour.name ? "#ffffff" : "#111827",
                  opacity: canReserve ? 1 : 0.7,
                  cursor: canReserve ? "pointer" : "not-allowed",
                }}
              >
                {renderColourLabel(colour)}
              </button>
            ))
          )}
        </div>

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
                    opacity: canReserve ? 1 : 0.7,
                    cursor: isSold || isReserved || !canReserve ? "not-allowed" : "pointer",
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
                <button type="button" onClick={() => removeFromBasket(ticket)} style={styles.removeButton}>
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}

        <div style={styles.totalBox}>
          <div>Tickets: {pricing.quantity}</div>
          <div>Standard total: {formatCurrency(pricing.standardTotal, raffle.currency)}</div>
          <div>Total today: {formatCurrency(pricing.total, raffle.currency)}</div>

          {pricing.appliedOffers.length > 0 ? (
            <div style={{ color: "#166534" }}>
              Best value applied:{" "}
              {pricing.appliedOffers
                .map((offer) => `${offer.label}${offer.times > 1 ? ` × ${offer.times}` : ""}`)
                .join(", ")}
            </div>
          ) : null}

          {pricing.savings > 0 ? (
            <div style={{ color: "#166534" }}>
              You save {formatCurrency(pricing.savings, raffle.currency)}
            </div>
          ) : null}
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
            {saving ? "Redirecting to checkout..." : "Reserve and pay"}
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
  heading: {
    marginTop: 24,
    marginBottom: 12,
  },
  quickSelect: {
    marginTop: 20,
    padding: 16,
    borderRadius: 14,
    background: "#f0f9ff",
    border: "1px solid #bae6fd",
    display: "grid",
    gap: 14,
  },
  quickControls: {
    display: "flex",
    flexWrap: "wrap",
    gap: 10,
    alignItems: "end",
  },
  quantityInput: {
    width: 130,
    height: 44,
    padding: "0 12px",
    borderRadius: 10,
    border: "1px solid #93c5fd",
    fontSize: 16,
    fontWeight: 700,
  },
  autoButton: {
    height: 44,
    padding: "0 16px",
    border: "none",
    borderRadius: 10,
    background: "#2563eb",
    color: "#ffffff",
    fontWeight: 800,
    cursor: "pointer",
  },
  clearButton: {
    height: 44,
    padding: "0 16px",
    borderRadius: 10,
    border: "1px solid #cbd5e1",
    background: "#ffffff",
    color: "#334155",
    fontWeight: 700,
    cursor: "pointer",
  },
  offerBox: {
    marginTop: 16,
    padding: 14,
    borderRadius: 12,
    background: "#ecfdf5",
    border: "1px solid #bbf7d0",
  },
  offerGrid: {
    display: "flex",
    flexWrap: "wrap",
    gap: 8,
  },
  offerPill: {
    padding: "8px 10px",
    borderRadius: 999,
    background: "#ffffff",
    border: "1px solid #bbf7d0",
    color: "#166534",
    fontWeight: 700,
    fontSize: 14,
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
    marginTop: 24,
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
    marginTop: 16,
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
