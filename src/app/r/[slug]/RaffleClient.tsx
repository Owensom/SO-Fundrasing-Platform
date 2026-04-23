"use client";

import { useMemo, useState } from "react";

type TicketState = {
  ticket_number: number;
  colour: string;
};

type RaffleOffer = {
  id?: string;
  label: string;
  price: number;
  quantity?: number;
  tickets?: number;
  is_active?: boolean;
  sort_order?: number;
};

type RawColour =
  | string
  | {
      id?: string;
      value?: string;
      name?: string;
      label?: string;
      hex?: string;
    };

type NormalisedColour = {
  value: string;
  label: string;
  hex?: string;
};

type RaffleConfig = {
  startNumber?: number;
  endNumber?: number;
  colours?: RawColour[];
  offers?: RaffleOffer[];
};

type Raffle = {
  id: string;
  tenant_slug: string;
  slug: string;
  title: string;
  description: string;
  image_url: string;
  currency: string;
  ticket_price?: number;
  total_tickets: number;
  sold_tickets: number;
  remaining_tickets?: number;
  status: string;
  config_json?: RaffleConfig;
};

type Props = {
  raffle: Raffle;
  sold: TicketState[];
  reserved: TicketState[];
};

type SelectedTicket = {
  ticket_number: number;
  colour: string;
};

type ReserveResponse = {
  ok: boolean;
  reservationToken?: string;
  raffleId?: string;
  expiresAt?: string;
  error?: string;
};

type CheckoutResponse = {
  ok: boolean;
  url?: string;
  error?: string;
};

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function normaliseOffers(offers?: RaffleOffer[]) {
  if (!Array.isArray(offers)) return [];

  return offers
    .map((offer, index) => {
      const quantity = Number(offer.quantity ?? offer.tickets ?? 0);
      const price = Number(offer.price ?? 0);
      const label = typeof offer.label === "string" ? offer.label : "";
      const isActive = offer.is_active !== false;
      const sortOrder = Number(offer.sort_order ?? index);

      if (!label || !Number.isFinite(quantity) || quantity <= 0) return null;
      if (!Number.isFinite(price) || price < 0) return null;
      if (!isActive) return null;

      return {
        id: offer.id,
        label,
        quantity,
        price,
        sort_order: sortOrder,
      };
    })
    .filter(Boolean)
    .sort((a, b) => {
      if (b!.quantity !== a!.quantity) return b!.quantity - a!.quantity;
      return a!.sort_order - b!.sort_order;
    }) as Array<{
    id?: string;
    label: string;
    quantity: number;
    price: number;
    sort_order: number;
  }>;
}

function normaliseColours(colours?: RawColour[]): NormalisedColour[] {
  if (!Array.isArray(colours) || colours.length === 0) {
    return [{ value: "default", label: "Default" }];
  }

  const mapped = colours
    .map((colour) => {
      if (typeof colour === "string") {
        return {
          value: colour,
          label: colour,
        };
      }

      if (!colour || typeof colour !== "object") return null;

      const value =
        colour.value ||
        colour.id ||
        colour.name ||
        colour.label ||
        "default";

      const label =
        colour.name ||
        colour.label ||
        colour.value ||
        colour.id ||
        "Default";

      return {
        value,
        label,
        hex: colour.hex,
      };
    })
    .filter(Boolean) as NormalisedColour[];

  return mapped.length > 0
    ? mapped
    : [{ value: "default", label: "Default" }];
}

function calculateOfferTotal(
  selectedCount: number,
  ticketPrice: number,
  offers: Array<{ label: string; quantity: number; price: number }>
) {
  if (selectedCount <= 0) {
    return {
      total: 0,
      appliedOffers: [] as Array<{
        label: string;
        quantity: number;
        price: number;
        times: number;
      }>,
      fullPriceTotal: 0,
      savings: 0,
    };
  }

  let remaining = selectedCount;
  let total = 0;
  const appliedOffers: Array<{
    label: string;
    quantity: number;
    price: number;
    times: number;
  }> = [];

  for (const offer of offers) {
    let times = 0;

    while (remaining >= offer.quantity) {
      total += offer.price;
      remaining -= offer.quantity;
      times += 1;
    }

    if (times > 0) {
      appliedOffers.push({
        label: offer.label,
        quantity: offer.quantity,
        price: offer.price,
        times,
      });
    }
  }

  total += remaining * ticketPrice;

  const fullPriceTotal = selectedCount * ticketPrice;
  const savings = Math.max(fullPriceTotal - total, 0);

  return {
    total,
    appliedOffers,
    fullPriceTotal,
    savings,
  };
}

export default function RaffleClient({ raffle, sold, reserved }: Props) {
  const [buyerName, setBuyerName] = useState("");
  const [buyerEmail, setBuyerEmail] = useState("");
  const [selectedTickets, setSelectedTickets] = useState<SelectedTicket[]>([]);
  const [loading, setLoading] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState<ReserveResponse | null>(null);

  const colourOptions = useMemo(
    () => normaliseColours(raffle.config_json?.colours),
    [raffle.config_json?.colours]
  );

  const [selectedColour, setSelectedColour] = useState(
    colourOptions[0]?.value || "default"
  );

  const isLocked = !!success?.ok;

  const offers = useMemo(() => {
    return normaliseOffers(raffle.config_json?.offers);
  }, [raffle.config_json?.offers]);

  const startNumber = Number(raffle.config_json?.startNumber || 1);
  const endNumber =
    Number(
      raffle.config_json?.endNumber ||
        raffle.total_tickets ||
        startNumber + raffle.total_tickets - 1
    ) || raffle.total_tickets;

  const ticketNumbers = Array.from(
    { length: Math.max(endNumber - startNumber + 1, 0) },
    (_, i) => startNumber + i
  );

  const soldSet = useMemo(
    () => new Set(sold.map((t) => `${t.colour}-${t.ticket_number}`)),
    [sold]
  );

  const reservedSet = useMemo(
    () => new Set(reserved.map((t) => `${t.colour}-${t.ticket_number}`)),
    [reserved]
  );

  const selectedSet = useMemo(
    () => new Set(selectedTickets.map((t) => `${t.colour}-${t.ticket_number}`)),
    [selectedTickets]
  );

  const selectedColourLabel =
    colourOptions.find((c) => c.value === selectedColour)?.label ||
    selectedColour;

  const ticketPrice = Number(raffle.ticket_price || 0);

  const pricing = useMemo(() => {
    return calculateOfferTotal(selectedTickets.length, ticketPrice, offers);
  }, [selectedTickets.length, ticketPrice, offers]);

  function toggleTicket(ticketNumber: number) {
    if (isLocked) return;

    const key = `${selectedColour}-${ticketNumber}`;
    if (soldSet.has(key) || reservedSet.has(key)) return;

    setSelectedTickets((prev) => {
      const exists = prev.some(
        (ticket) =>
          ticket.ticket_number === ticketNumber &&
          ticket.colour === selectedColour
      );

      if (exists) {
        return prev.filter(
          (ticket) =>
            !(
              ticket.ticket_number === ticketNumber &&
              ticket.colour === selectedColour
            )
        );
      }

      return [
        ...prev,
        {
          ticket_number: ticketNumber,
          colour: selectedColour,
        },
      ];
    });

    setError("");
  }

  function removeSelectedTicket(ticket: SelectedTicket) {
    if (isLocked) return;

    setSelectedTickets((prev) =>
      prev.filter(
        (t) =>
          !(
            t.ticket_number === ticket.ticket_number &&
            t.colour === ticket.colour
          )
      )
    );
  }

  async function reserveTickets() {
    try {
      setLoading(true);
      setError("");
      setSuccess(null);

      const trimmedName = buyerName.trim();
      const trimmedEmail = buyerEmail.trim();

      if (!trimmedName || !trimmedEmail) {
        setError("Name and email are required");
        return;
      }

      if (!isValidEmail(trimmedEmail)) {
        setError("Enter a valid email address");
        return;
      }

      if (selectedTickets.length === 0) {
        setError("Please select at least one ticket");
        return;
      }

      const requestBody = {
        tenantSlug: raffle.tenant_slug,
        buyerName: trimmedName,
        buyerEmail: trimmedEmail,
        quantity: selectedTickets.length,
        selectedTickets,
      };

      console.log("FRONTEND RESERVE REQUEST", requestBody);

      const response = await fetch(`/api/raffles/${raffle.slug}/reserve`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      const data = (await response.json()) as ReserveResponse;

      console.log("FRONTEND RESERVE RESPONSE", data);

      if (!response.ok || !data.ok) {
        throw new Error(data.error || "Failed to reserve tickets");
      }

      const cleanSuccess: ReserveResponse = {
        ok: true,
        reservationToken: data.reservationToken,
        raffleId: data.raffleId,
        expiresAt: data.expiresAt,
      };

      console.log("FRONTEND TOKEN STORED", cleanSuccess.reservationToken);

      setSuccess(cleanSuccess);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Reservation failed";

      if (
        message.toLowerCase().includes("already reserved") ||
        message.toLowerCase().includes("already sold") ||
        message.toLowerCase().includes("no longer available")
      ) {
        setError(
          "Some selected tickets are no longer available. Please refresh and try again."
        );
      } else {
        setError(message);
      }
    } finally {
      setLoading(false);
    }
  }

  async function goToStripeCheckout() {
    try {
      if (!success?.reservationToken || !success?.raffleId) {
        throw new Error("Missing reservation details");
      }

      console.log("FRONTEND TOKEN BEFORE CHECKOUT", {
        reservationToken: success.reservationToken,
        raffleId: success.raffleId,
      });

      setCheckoutLoading(true);
      setError("");

      const response = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          raffleId: success.raffleId,
          reservationToken: success.reservationToken,
        }),
      });

      const data = (await response.json()) as CheckoutResponse;

      console.log("FRONTEND CHECKOUT RESPONSE", data);

      if (!response.ok || !data.ok || !data.url) {
        throw new Error(data.error || "Failed to create Stripe Checkout");
      }

      window.location.href = data.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Checkout failed");
    } finally {
      setCheckoutLoading(false);
    }
  }

  return (
    <div>
      {raffle.image_url ? (
        <img
          src={raffle.image_url}
          alt={raffle.title}
          style={{ width: "100%", height: "auto", marginBottom: 20 }}
        />
      ) : null}

      <p>{raffle.description}</p>

      <hr style={{ margin: "24px 0" }} />

      <p>
        <strong>Single ticket price:</strong> {ticketPrice.toFixed(2)}{" "}
        {raffle.currency}
      </p>

      <p>
        <strong>Total tickets:</strong> {raffle.total_tickets}
      </p>

      <p>
        <strong>Sold:</strong> {raffle.sold_tickets}
      </p>

      <p>
        <strong>Remaining:</strong> {raffle.remaining_tickets ?? 0}
      </p>

      <hr style={{ margin: "24px 0" }} />

      {offers.length > 0 ? (
        <div style={{ marginBottom: 24 }}>
          <h3>Offers</h3>
          <ul>
            {offers.map((offer) => (
              <li key={offer.id || `${offer.label}-${offer.quantity}-${offer.price}`}>
                {offer.label}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <h2>Select tickets</h2>

      <div style={{ display: "grid", gap: 12, maxWidth: 420, marginBottom: 20 }}>
        <label>
          <div style={{ marginBottom: 6 }}>Name</div>
          <input
            value={buyerName}
            onChange={(e) => setBuyerName(e.target.value)}
            disabled={isLocked}
            style={{
              width: "100%",
              padding: 10,
              opacity: isLocked ? 0.7 : 1,
            }}
          />
        </label>

        <label>
          <div style={{ marginBottom: 6 }}>Email</div>
          <input
            type="email"
            value={buyerEmail}
            onChange={(e) => setBuyerEmail(e.target.value)}
            disabled={isLocked}
            style={{
              width: "100%",
              padding: 10,
              opacity: isLocked ? 0.7 : 1,
            }}
          />
        </label>
      </div>

      {colourOptions.length > 1 ? (
        <div style={{ marginBottom: 20 }}>
          <h3>Choose a colour</h3>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {colourOptions.map((colour) => (
              <button
                key={colour.value}
                type="button"
                onClick={() => setSelectedColour(colour.value)}
                disabled={isLocked}
                style={{
                  padding: "10px 14px",
                  borderRadius: 8,
                  border: "1px solid #ccc",
                  background: selectedColour === colour.value ? "#111" : "#fff",
                  color: selectedColour === colour.value ? "#fff" : "#111",
                  cursor: isLocked ? "not-allowed" : "pointer",
                  opacity: isLocked ? 0.7 : 1,
                }}
              >
                {colour.label}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(10, 1fr)",
          gap: 8,
        }}
      >
        {ticketNumbers.map((number) => {
          const key = `${selectedColour}-${number}`;
          const isSold = soldSet.has(key);
          const isReserved = reservedSet.has(key);
          const isUnavailable = isSold || isReserved;
          const isSelected = selectedSet.has(key);

          return (
            <button
              key={key}
              type="button"
              disabled={isUnavailable || isLocked}
              onClick={() => toggleTicket(number)}
              style={{
                padding: 10,
                border: "1px solid #ccc",
                borderRadius: 6,
                background: isSold
                  ? "#000"
                  : isReserved
                    ? "#999"
                    : isSelected
                      ? "#16a34a"
                      : "#fff",
                color: isUnavailable || isSelected ? "#fff" : "#000",
                cursor: isUnavailable || isLocked ? "not-allowed" : "pointer",
                opacity: isUnavailable || isLocked ? 0.6 : 1,
              }}
            >
              {number}
            </button>
          );
        })}
      </div>

      <div style={{ marginTop: 20 }}>
        <p>
          <strong>Current colour:</strong> {selectedColourLabel}
        </p>

        <p>
          <strong>Selected:</strong>{" "}
          {selectedTickets.length
            ? selectedTickets
                .map((t) => {
                  const label =
                    colourOptions.find((c) => c.value === t.colour)?.label ||
                    t.colour;
                  return `${t.ticket_number} (${label})`;
                })
                .join(", ")
            : "None"}
        </p>

        <p>
          <strong>Standard total:</strong>{" "}
          {(pricing.fullPriceTotal || 0).toFixed(2)} {raffle.currency}
        </p>

        <p>
          <strong>Total:</strong> {pricing.total.toFixed(2)} {raffle.currency}
        </p>

        {pricing.appliedOffers.length > 0 ? (
          <div style={{ marginTop: 8 }}>
            <p style={{ color: "#15803d", marginBottom: 8 }}>
              Best available offer applied automatically
            </p>
            <ul>
              {pricing.appliedOffers.map((offer) => (
                <li key={`${offer.label}-${offer.times}`}>
                  {offer.label}
                  {offer.times > 1 ? ` × ${offer.times}` : ""}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {pricing.savings > 0 ? (
          <p style={{ color: "#15803d" }}>
            <strong>You save:</strong> {pricing.savings.toFixed(2)}{" "}
            {raffle.currency}
          </p>
        ) : null}
      </div>

      {selectedTickets.length ? (
        <div style={{ marginTop: 12 }}>
          <h3>Basket</h3>
          <ul>
            {selectedTickets.map((ticket) => {
              const label =
                colourOptions.find((c) => c.value === ticket.colour)?.label ||
                ticket.colour;

              return (
                <li key={`${ticket.colour}-${ticket.ticket_number}`}>
                  #{ticket.ticket_number} ({label}){" "}
                  <button
                    type="button"
                    onClick={() => removeSelectedTicket(ticket)}
                    disabled={isLocked}
                    style={{ marginLeft: 8 }}
                  >
                    Remove
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      {!success?.ok ? (
        <div style={{ marginTop: 20 }}>
          <button
            type="button"
            onClick={reserveTickets}
            disabled={loading || selectedTickets.length === 0}
            style={{
              padding: "12px 16px",
              background: "#111",
              color: "#fff",
              border: "none",
              cursor: "pointer",
              borderRadius: 8,
              opacity: loading || selectedTickets.length === 0 ? 0.6 : 1,
            }}
          >
            {loading ? "Reserving..." : "Reserve tickets"}
          </button>
        </div>
      ) : null}

      {error ? <p style={{ color: "red", marginTop: 12 }}>{error}</p> : null}

      {success?.ok ? (
        <div style={{ marginTop: 20, padding: 16, border: "1px solid #ddd" }}>
          <h3>Tickets reserved</h3>
          <p>
            <strong>Reservation token:</strong> {success.reservationToken}
          </p>
          {success.expiresAt ? (
            <p>
              <strong>Reserved until:</strong> {success.expiresAt}
            </p>
          ) : (
            <p>Your tickets are locked for 15 minutes.</p>
          )}
          <p>
            <strong>Buyer:</strong> {buyerName} ({buyerEmail})
          </p>
          <p>
            <strong>Offer-adjusted total shown:</strong> {pricing.total.toFixed(2)}{" "}
            {raffle.currency}
          </p>
          <button
            type="button"
            onClick={goToStripeCheckout}
            disabled={checkoutLoading}
            style={{
              marginTop: 12,
              padding: "12px 16px",
              background: "#635bff",
              color: "#fff",
              border: "none",
              cursor: "pointer",
              borderRadius: 8,
              opacity: checkoutLoading ? 0.6 : 1,
            }}
          >
            {checkoutLoading ? "Redirecting..." : "Pay with Stripe"}
          </button>
        </div>
      ) : null}
    </div>
  );
}
