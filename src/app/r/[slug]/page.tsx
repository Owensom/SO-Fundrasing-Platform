"use client";

import { useEffect, useState } from "react";

type TicketState = {
  ticket_number: number;
  colour: string;
};

type Raffle = {
  id: string;
  slug: string;
  title: string;
  description: string;
  image_url: string;
  currency: string;
  ticket_price?: number;
  total_tickets: number;
  sold_tickets: number;
  status: string;
};

type ApiResponse = {
  ok: boolean;
  raffle?: Raffle;
  sold?: TicketState[];
  reserved?: TicketState[];
};

export default function PublicRafflePage({
  params,
}: {
  params: { slug: string };
}) {
  const [raffle, setRaffle] = useState<Raffle | null>(null);
  const [sold, setSold] = useState<TicketState[]>([]);
  const [reserved, setReserved] = useState<TicketState[]>([]);
  const [selected, setSelected] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);

  const colour = "default";

  useEffect(() => {
    fetch(`/api/raffles/${params.slug}`)
      .then((res) => res.json())
      .then((data: ApiResponse) => {
        if (data.ok && data.raffle) {
          setRaffle(data.raffle);
          setSold(data.sold || []);
          setReserved(data.reserved || []);
        }
      });
  }, [params.slug]);

  if (!raffle) {
    return <div style={{ padding: 20 }}>Loading...</div>;
  }

  if (raffle.status !== "published") {
    return <div style={{ padding: 20 }}>Not available</div>;
  }

  const soldSet = new Set(
    sold.map((t) => `${t.colour}-${t.ticket_number}`)
  );

  const reservedSet = new Set(
    reserved.map((t) => `${t.colour}-${t.ticket_number}`)
  );

  const numbers = Array.from(
    { length: raffle.total_tickets },
    (_, i) => i + 1
  );

  function toggleTicket(number: number) {
    setSelected((prev) =>
      prev.includes(number)
        ? prev.filter((n) => n !== number)
        : [...prev, number]
    );
  }

  async function handleCheckout() {
    if (!selected.length) return;

    setLoading(true);

    try {
      // STEP 1: reserve tickets
      const reserveRes = await fetch(
        `/api/raffles/${raffle.slug}/reserve`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tickets: selected.map((n) => ({
              ticket_number: n,
              colour,
            })),
            buyer_name: "Guest",
            buyer_email: "guest@example.com",
          }),
        }
      );

      const reserveData = await reserveRes.json();

      if (!reserveData.ok) {
        alert("Reservation failed");
        setLoading(false);
        return;
      }

      // STEP 2: create Stripe checkout
      const checkoutRes = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reservation_token: reserveData.reservation_token,
        }),
      });

      const checkoutData = await checkoutRes.json();

      if (!checkoutData.url) {
        alert("Checkout failed");
        setLoading(false);
        return;
      }

      // STEP 3: redirect to Stripe
      window.location.href = checkoutData.url;
    } catch (err) {
      console.error(err);
      alert("Something went wrong");
    }

    setLoading(false);
  }

  return (
    <main style={{ maxWidth: 900, margin: "40px auto", padding: 16 }}>
      <h1>{raffle.title}</h1>

      {raffle.image_url && (
        <img
          src={raffle.image_url}
          style={{ width: "100%", marginBottom: 20 }}
        />
      )}

      <p>{raffle.description}</p>

      <p>
        <strong>Price:</strong> {raffle.ticket_price} {raffle.currency}
      </p>

      <h2>Select tickets</h2>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(10, 1fr)",
          gap: 8,
        }}
      >
        {numbers.map((number) => {
          const key = `${colour}-${number}`;

          const isSold = soldSet.has(key);
          const isReserved = reservedSet.has(key);
          const isUnavailable = isSold || isReserved;
          const isSelected = selected.includes(number);

          return (
            <button
              key={number}
              disabled={isUnavailable}
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
                  ? "#4caf50"
                  : "#fff",
                color: isUnavailable || isSelected ? "#fff" : "#000",
                cursor: isUnavailable ? "not-allowed" : "pointer",
              }}
            >
              {number}
            </button>
          );
        })}
      </div>

      <div style={{ marginTop: 20 }}>
        <p>
          Selected: {selected.length > 0 ? selected.join(", ") : "None"}
        </p>

        <button
          onClick={handleCheckout}
          disabled={!selected.length || loading}
          style={{
            padding: "12px 20px",
            background: "#0070f3",
            color: "#fff",
            border: "none",
            borderRadius: 6,
            cursor: "pointer",
          }}
        >
          {loading ? "Processing..." : "Checkout"}
        </button>
      </div>
    </main>
  );
}
