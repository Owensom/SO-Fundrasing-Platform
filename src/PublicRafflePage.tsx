import { useEffect, useState } from "react";

type Raffle = {
  title: string;
  description: string;
  ticketPrice: number;
  soldTickets: number;
  remainingTickets: number;
  status: string;
};

export default function PublicRafflePage() {
  const [raffle, setRaffle] = useState<Raffle | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        // HARD-CODED FIRST (we will make dynamic after)
        const res = await fetch("/api/public/raffles/demo-raffle");

        if (!res.ok) {
          throw new Error("Failed to load raffle");
        }

        const data = await res.json();
        setRaffle(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  if (loading) {
    return <div style={{ padding: 24 }}>Loading...</div>;
  }

  if (error) {
    return (
      <div style={{ padding: 24 }}>
        <h1>Error</h1>
        <p>{error}</p>
      </div>
    );
  }

  if (!raffle) {
    return <div style={{ padding: 24 }}>No data</div>;
  }

  return (
    <div style={{ padding: 24, maxWidth: 900, margin: "0 auto" }}>
      <h1>{raffle.title}</h1>
      <p>{raffle.description}</p>

      <div style={{ marginTop: 24 }}>
        <p>Price: £{raffle.ticketPrice}</p>
        <p>Sold: {raffle.soldTickets}</p>
        <p>Remaining: {raffle.remainingTickets}</p>
        <p>Status: {raffle.status}</p>
      </div>
    </div>
  );
}
