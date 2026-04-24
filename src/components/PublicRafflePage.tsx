"use client";

import { useEffect, useMemo, useState } from "react";

type Winner = {
  prizePosition: number;
  ticketNumber: number;
  colour: string | null;
  buyerName: string | null;
  drawnAt: string | null;
};

type Raffle = {
  id: string;
  slug: string;
  title: string;
  description: string;
  imageUrl: string;
  currency: string;
  ticketPrice: number;
  totalTickets: number;
  soldTicketsCount: number;
  status: string;
  colours: any[];
  soldTickets: { number: number; colour: string }[];
  reservedTickets: { number: number; colour: string }[];
  winnerTicketNumber: number | null;
  winnerColour: string | null;
  drawnAt: string | null;
  winners: Winner[];
};

function formatDateTime(value?: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString();
}

function ordinal(n: number) {
  if (n === 1) return "1st";
  if (n === 2) return "2nd";
  if (n === 3) return "3rd";
  return `${n}th`;
}

export default function PublicRafflePage({ slug }: { slug: string }) {
  const [raffle, setRaffle] = useState<Raffle | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/raffles/${slug}`);
        const data = await res.json();

        if (data?.ok) {
          setRaffle(data.raffle);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [slug]);

  if (loading) return <div style={{ padding: 40 }}>Loading...</div>;
  if (!raffle) return <div style={{ padding: 40 }}>Not found</div>;

  const isDrawn = raffle.status === "drawn";

  return (
    <main style={{ maxWidth: 900, margin: "40px auto", padding: 16 }}>
      <h1 style={{ fontSize: 32, fontWeight: 800 }}>{raffle.title}</h1>

      {raffle.imageUrl ? (
        <img
          src={raffle.imageUrl}
          alt={raffle.title}
          style={{ width: "100%", borderRadius: 12, marginTop: 12 }}
        />
      ) : null}

      {raffle.description ? (
        <p style={{ marginTop: 12 }}>{raffle.description}</p>
      ) : null}

      {/* WINNERS */}
      {isDrawn ? (
        <div
          style={{
            marginTop: 20,
            padding: 16,
            borderRadius: 12,
            background: "#ecfdf5",
            border: "1px solid #a7f3d0",
          }}
        >
          <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 10 }}>
            Winners
          </div>

          {raffle.winners && raffle.winners.length > 0 ? (
            <div style={{ display: "grid", gap: 10 }}>
              {raffle.winners.map((w) => (
                <div
                  key={`${w.prizePosition}-${w.ticketNumber}`}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    padding: 12,
                    borderRadius: 10,
                    background: "#fff",
                    border: "1px solid #d1fae5",
                  }}
                >
                  <strong>{ordinal(w.prizePosition)}</strong>

                  <span>
                    #{w.ticketNumber}{" "}
                    {w.colour ? `(${w.colour})` : ""}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div>
              #{raffle.winnerTicketNumber} ({raffle.winnerColour}) —{" "}
              {formatDateTime(raffle.drawnAt)}
            </div>
          )}
        </div>
      ) : null}

      {/* BASIC INFO */}
      <div style={{ marginTop: 20 }}>
        <div>
          Price: {raffle.currency} {raffle.ticketPrice.toFixed(2)}
        </div>
        <div>Total: {raffle.totalTickets}</div>
        <div>Sold: {raffle.soldTicketsCount}</div>
      </div>
    </main>
  );
}
