"use client";

import { useEffect, useState } from "react";

type TicketState = {
  number: number;
  colour: string;
};

type RaffleColour = {
  id: string;
  name: string;
  hex: string | null;
};

type Raffle = {
  id: string;
  slug: string;
  title: string;
  description: string;
  imageUrl: string;
  image_url: string;
  currency: string;
  ticketPrice: number;
  totalTickets: number;
  soldTicketsCount: number;
  status: string;
  startNumber: number;
  endNumber: number;
  colours: RaffleColour[];
  soldTickets: TicketState[];
  reservedTickets: TicketState[];
};

type ApiResponse = {
  ok: boolean;
  raffle?: Raffle;
  error?: string;
};

type SelectedTicket = {
  number: number;
  colour: string;
};

export default function PublicRafflePage({
  params,
}: {
  params: { slug: string };
}) {
  const [raffle, setRaffle] = useState<Raffle | null>(null);
  const [selected, setSelected] = useState<SelectedTicket[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    async function loadRaffle() {
      try {
        setLoadError("");

        const res = await fetch(`/api/raffles/${params.slug}`, {
          cache: "no-store",
        });

        const data: ApiResponse = await res.json();

        if (!res.ok || !data.ok || !data.raffle) {
          throw new Error(data.error || "Failed to load raffle");
        }

        setRaffle(data.raffle);
      } catch (error) {
        setLoadError(
          error instanceof Error ? error.message : "Failed to load raffle",
        );
      }
    }

    loadRaffle();
  }, [params.slug]);

  if (loadError) {
    return <div style={{ padding: 20, color: "red" }}>{loadError}</div>;
  }

  if (!raffle) {
    return <div style={{ padding: 20 }}>Loading...</div>;
  }

  if (raffle.status !== "published") {
    return <div style={{ padding: 20 }}>Not available</div>;
  }

  const colours =
    raffle.colours && raffle.colours.length
      ? raffle.colours
      : [{ id: "default", name: "Default", hex: null }];

  const soldSet = new Set(
    raffle.soldTickets.map((ticket) => `${ticket.colour}-${ticket.number}`),
  );

  const reservedSet = new Set(
    raffle.reservedTickets.map(
      (ticket) => `${ticket.colour}-${ticket.number}`,
    ),
  );

  const numbers = Array.from(
    {
      length: Math.max(
        Number(raffle.endNumber || 1) - Number(raffle.startNumber || 1) + 1,
        0,
      ),
    },
    (_, index) => Number(raffle.startNumber || 1) + index,
  );

  function isSelected(number: number, colour: string) {
    return selected.some(
      (ticket) => ticket.number === number && ticket.colour === colour,
    );
  }

  function toggleTicket(number: number, colour: string) {
    setSelected((current) =>
      current.some(
        (ticket) => ticket.number === number && ticket.colour === colour,
      )
        ? current.filter(
            (ticket) =>
              !(ticket.number === number && ticket.colour === colour),
          )
        : [...current, { number, colour }],
    );
  }

  async function handleCheckout() {
    if (!raffle || !selected.length) return;

    setLoading(true);

    try {
      const reserveRes = await fetch(`/api/raffles/${raffle.slug}/reserve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tickets: selected.map((ticket) => ({
            ticket_number: ticket.number,
            colour: ticket.colour,
          })),
          buyer_name: "Guest",
          buyer_email: "guest@example.com",
        }),
      });

      const reserveData = await reserveRes.json();

      if (!reserveData.ok) {
        alert(reserveData.error || "Reservation failed");
        setLoading(false);
        return;
      }

      const checkoutRes = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reservation_token: reserveData.reservation_token,
        }),
      });

      const checkoutData = await checkoutRes.json();

      if (!checkoutData.url) {
        alert(checkoutData.error || "Checkout failed");
        setLoading(false);
        return;
      }

      window.location.href = checkoutData.url;
    } catch (error) {
      console.error(error);
      alert("Something went wrong");
      setLoading(false);
    }
  }

  return (
    <main style={{ maxWidth: 1000, margin: "40px auto", padding: 16 }}>
      <h1>{raffle.title}</h1>

      {(raffle.imageUrl || raffle.image_url) && (
        <img
          src={raffle.imageUrl || raffle.image_url}
          alt={raffle.title}
          style={{
            width: "100%",
            maxHeight: 420,
            objectFit: "cover",
            borderRadius: 16,
            marginBottom: 20,
          }}
        />
      )}

      <p>{raffle.description}</p>

      <p>
        <strong>Price:</strong> {raffle.ticketPrice} {raffle.currency}
      </p>

      <h2>Select tickets</h2>

      <div style={{ display: "grid", gap: 28 }}>
        {colours.map((colour) => (
          <section key={colour.id}>
            <h3>{colour.name}</h3>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(10, 1fr)",
                gap: 8,
              }}
            >
              {numbers.map((number) => {
                const colourKey = colour.name || colour.id || "default";
                const key = `${colourKey}-${number}`;
                const isSold = soldSet.has(key);
                const isReserved = reservedSet.has(key);
                const isUnavailable = isSold || isReserved;
                const selectedNow = isSelected(number, colourKey);

                return (
                  <button
                    key={`${colourKey}-${number}`}
                    type="button"
                    disabled={isUnavailable}
                    onClick={() => toggleTicket(number, colourKey)}
                    style={{
                      padding: 10,
                      border: "1px solid #ccc",
                      borderRadius: 6,
                      background: isSold
                        ? "#000"
                        : isReserved
                          ? "#999"
                          : selectedNow
                            ? "#4caf50"
                            : "#fff",
                      color: isUnavailable || selectedNow ? "#fff" : "#000",
                      cursor: isUnavailable ? "not-allowed" : "pointer",
                    }}
                  >
                    {number}
                  </button>
                );
              })}
            </div>
          </section>
        ))}
      </div>

      <div style={{ marginTop: 20 }}>
        <p>
          Selected:{" "}
          {selected.length > 0
            ? selected
                .map((ticket) => `${ticket.colour} ${ticket.number}`)
                .join(", ")
            : "None"}
        </p>

        <button
          type="button"
          onClick={handleCheckout}
          disabled={!selected.length || loading}
          style={{
            padding: "12px 20px",
            background: "#0070f3",
            color: "#fff",
            border: "none",
            borderRadius: 6,
            cursor: !selected.length || loading ? "not-allowed" : "pointer",
          }}
        >
          {loading ? "Processing..." : "Checkout"}
        </button>
      </div>
    </main>
  );
}
