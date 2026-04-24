"use client";

import { useEffect, useState } from "react";

type Props = {
  slug: string;
};

export default function PublicRafflePage({ slug }: Props) {
  const [raffle, setRaffle] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedCount, setSelectedCount] = useState(1);
  const [reservationToken, setReservationToken] = useState<string | null>(null);
  const [coverFees, setCoverFees] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/raffles/${slug}`);
        const data = await res.json();

        if (!data?.ok) {
          setError(data?.error || "Failed to load raffle");
          return;
        }

        setRaffle(data.raffle);
      } catch (err) {
        console.error(err);
        setError("Failed to load raffle");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [slug]);

  async function reserveTickets() {
    try {
      setError("");

      const res = await fetch(`/api/raffles/${raffle.id}/reserve`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          quantity: selectedCount,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data?.ok) {
        setError(data?.error || "Reservation failed");
        return;
      }

      setReservationToken(data.reservationToken);
    } catch (err) {
      console.error(err);
      setError("Reservation failed");
    }
  }

  async function checkout() {
    try {
      setError("");

      const res = await fetch(`/api/stripe/checkout`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          raffleId: raffle.id,
          reservationToken,
          coverFees,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data?.ok || !data.url) {
        setError(data?.error || "Checkout failed");
        return;
      }

      window.location.href = data.url;
    } catch (err) {
      console.error(err);
      setError("Checkout failed");
    }
  }

  if (loading) {
    return <div style={{ padding: 24 }}>Loading...</div>;
  }

  if (!raffle) {
    return <div style={{ padding: 24 }}>Raffle not found</div>;
  }

  const ticketPrice = raffle.ticketPrice || 0;
  const subtotal = ticketPrice * selectedCount;

  // Simple estimate for UI (actual calc happens server-side)
  const estimatedFee = Math.round(subtotal * 0.1);
  const displayTotal = coverFees
    ? subtotal + estimatedFee
    : subtotal;

  return (
    <main style={{ maxWidth: 900, margin: "40px auto", padding: 24 }}>
      <h1 style={{ fontSize: 28, fontWeight: 800 }}>{raffle.title}</h1>

      <p style={{ color: "#6b7280", marginTop: 6 }}>
        {raffle.description}
      </p>

      <div style={{ marginTop: 24 }}>
        <div style={{ fontWeight: 700 }}>Ticket price</div>
        <div style={{ fontSize: 20 }}>
          £{ticketPrice.toFixed(2)}
        </div>
      </div>

      <div style={{ marginTop: 24 }}>
        <label style={{ fontWeight: 700 }}>
          Number of tickets
        </label>

        <input
          type="number"
          min={1}
          value={selectedCount}
          onChange={(e) =>
            setSelectedCount(Number(e.target.value))
          }
          style={{
            display: "block",
            marginTop: 8,
            padding: 10,
            borderRadius: 8,
            border: "1px solid #d1d5db",
            width: 120,
          }}
        />
      </div>

      {/* COVER FEES */}
      <div
        style={{
          marginTop: 20,
          padding: 12,
          borderRadius: 10,
          border: "1px solid #e5e7eb",
          background: "#f9fafb",
        }}
      >
        <label
          style={{
            display: "flex",
            gap: 10,
            alignItems: "center",
            cursor: "pointer",
          }}
        >
          <input
            type="checkbox"
            checked={coverFees}
            onChange={(e) => setCoverFees(e.target.checked)}
          />
          <span style={{ fontWeight: 600 }}>
            I’d like to cover platform fees
          </span>
        </label>

        <div style={{ fontSize: 13, color: "#6b7280", marginTop: 4 }}>
          This helps organisers receive the full amount.
        </div>
      </div>

      {/* TOTAL */}
      <div style={{ marginTop: 20 }}>
        <div style={{ fontWeight: 700 }}>Total</div>
        <div style={{ fontSize: 22 }}>
          £{(displayTotal / 100).toFixed(2)}
        </div>
      </div>

      {/* ACTION BUTTONS */}
      <div style={{ marginTop: 24, display: "flex", gap: 12 }}>
        {!reservationToken ? (
          <button
            onClick={reserveTickets}
            style={{
              padding: "12px 18px",
              borderRadius: 10,
              background: "#111827",
              color: "#fff",
              border: "none",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Reserve Tickets
          </button>
        ) : (
          <button
            onClick={checkout}
            style={{
              padding: "12px 18px",
              borderRadius: 10,
              background: "#16a34a",
              color: "#fff",
              border: "none",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Checkout
          </button>
        )}
      </div>

      {error && (
        <div
          style={{
            marginTop: 16,
            color: "#b91c1c",
            background: "#fef2f2",
            padding: 10,
            borderRadius: 8,
          }}
        >
          {error}
        </div>
      )}
    </main>
  );
}
