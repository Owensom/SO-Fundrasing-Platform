"use client";

import { useMemo, useState } from "react";

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
};

type Props = {
  raffle: Raffle;
};

type SelectedTicket = {
  ticket_number: number;
  colour: string;
};

type ReserveResponse = {
  ok: boolean;
  reservationToken?: string;
  raffleId?: string;
  totalAmountCents?: number;
  error?: string;
};

type CheckoutResponse = {
  ok: boolean;
  url?: string;
  error?: string;
};

export default function RaffleClient({ raffle }: Props) {
  const [buyerName, setBuyerName] = useState("");
  const [buyerEmail, setBuyerEmail] = useState("");
  const [ticketInput, setTicketInput] = useState("");
  const [selectedTickets, setSelectedTickets] = useState<SelectedTicket[]>([]);
  const [loading, setLoading] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState<ReserveResponse | null>(null);

  const ticketPrice = Number(raffle.ticket_price || 0);

  const total = useMemo(() => {
    return selectedTickets.length * ticketPrice;
  }, [selectedTickets, ticketPrice]);

  function addTicket() {
    const value = Number(ticketInput);

    if (!Number.isInteger(value) || value <= 0) {
      setError("Enter a valid ticket number");
      return;
    }

    const exists = selectedTickets.some(
      (ticket) => ticket.ticket_number === value && ticket.colour === "default",
    );

    if (exists) {
      setError("That ticket is already selected");
      return;
    }

    setSelectedTickets((prev) => [
      ...prev,
      { ticket_number: value, colour: "default" },
    ]);
    setTicketInput("");
    setError("");
  }

  function removeTicket(ticketNumber: number) {
    setSelectedTickets((prev) =>
      prev.filter((ticket) => ticket.ticket_number !== ticketNumber),
    );
  }

  async function reserveTickets() {
    try {
      setLoading(true);
      setError("");
      setSuccess(null);

      const response = await fetch(`/api/raffles/${raffle.slug}/reserve`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          buyerName,
          buyerEmail,
          selectedTickets,
        }),
      });

      const data = (await response.json()) as ReserveResponse;

      if (!response.ok || !data.ok) {
        throw new Error(data.error || "Failed to reserve tickets");
      }

      setSuccess(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reservation failed");
    } finally {
      setLoading(false);
    }
  }

  async function goToStripeCheckout() {
    try {
      if (!success?.reservationToken || !success?.raffleId) {
        throw new Error("Missing reservation details");
      }

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
        <strong>Price:</strong> {ticketPrice} {raffle.currency}
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

      <h2>Select tickets</h2>

      <div style={{ display: "grid", gap: 12, maxWidth: 420 }}>
        <label>
          <div style={{ marginBottom: 6 }}>Name</div>
          <input
            value={buyerName}
            onChange={(e) => setBuyerName(e.target.value)}
            style={{ width: "100%", padding: 10 }}
          />
        </label>

        <label>
          <div style={{ marginBottom: 6 }}>Email</div>
          <input
            type="email"
            value={buyerEmail}
            onChange={(e) => setBuyerEmail(e.target.value)}
            style={{ width: "100%", padding: 10 }}
          />
        </label>

        <label>
          <div style={{ marginBottom: 6 }}>Ticket number</div>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              type="number"
              value={ticketInput}
              onChange={(e) => setTicketInput(e.target.value)}
              style={{ flex: 1, padding: 10 }}
            />
            <button type="button" onClick={addTicket} style={{ padding: "10px 14px" }}>
              Add
            </button>
          </div>
        </label>
      </div>

      {selectedTickets.length ? (
        <div style={{ marginTop: 20 }}>
          <h3>Selected tickets</h3>
          <ul>
            {selectedTickets.map((ticket) => (
              <li key={`${ticket.colour}-${ticket.ticket_number}`}>
                #{ticket.ticket_number}{" "}
                <button
                  type="button"
                  onClick={() => removeTicket(ticket.ticket_number)}
                  style={{ marginLeft: 8 }}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>

          <p>
            <strong>Total:</strong> {total.toFixed(2)} {raffle.currency}
          </p>
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
              background: "black",
              color: "white",
              border: "none",
              cursor: "pointer",
              opacity: loading || selectedTickets.length === 0 ? 0.6 : 1,
            }}
          >
            {loading ? "Reserving..." : "Reserve tickets"}
          </button>
        </div>
      ) : null}

      {error ? (
        <p style={{ color: "red", marginTop: 12 }}>{error}</p>
      ) : null}

      {success?.ok ? (
        <div style={{ marginTop: 20, padding: 16, border: "1px solid #ddd" }}>
          <h3>Tickets reserved</h3>
          <p>
            <strong>Reservation token:</strong> {success.reservationToken}
          </p>
          <p>Your tickets are locked for 15 minutes.</p>
          <button
            type="button"
            onClick={goToStripeCheckout}
            disabled={checkoutLoading}
            style={{
              marginTop: 12,
              padding: "12px 16px",
              background: "#635bff",
              color: "white",
              border: "none",
              cursor: "pointer",
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
