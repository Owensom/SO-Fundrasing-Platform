import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";

type PublicRaffle = {
  id: string;
  tenantId: string;
  title: string;
  slug: string;
  description: string;
  ticketPrice: number;
  maxTickets: number;
  isPublished: boolean;
  status: "draft" | "published" | "closed";
  endAt: string | null;
  createdAt: string;
  updatedAt: string;
  soldTickets: number;
  remainingTickets: number;
};

export default function PublicRafflePage() {
  const { slug } = useParams();
  const [raffle, setRaffle] = useState<PublicRaffle | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        if (!slug) {
          throw new Error("Missing slug");
        }

        const res = await fetch(`/api/public/raffles/${slug}`);
        const text = await res.text();

        let data: any = null;

        try {
          data = text ? JSON.parse(text) : null;
        } catch {
          throw new Error(`Non-JSON response: ${text.slice(0, 200)}`);
        }

        if (!res.ok) {
          throw new Error(data?.message || "Failed to load raffle");
        }

        if (!cancelled) {
          setRaffle(data);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Unknown error");
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

  if (loading) {
    return <div style={{ padding: 24 }}>Loading raffle...</div>;
  }

  if (error) {
    return (
      <div style={{ padding: 24 }}>
        <h1>Raffle not available</h1>
        <p>{error}</p>
        <p>Slug: {slug || "missing"}</p>
        <p>URL: {typeof window !== "undefined" ? window.location.href : ""}</p>
      </div>
    );
  }

  if (!raffle) {
    return (
      <div style={{ padding: 24 }}>
        <h1>No raffle data</h1>
      </div>
    );
  }

  return (
    <div style={{ padding: 24, maxWidth: 900, margin: "0 auto" }}>
      <h1>{raffle.title}</h1>
      <p>{raffle.description}</p>

      <div
        style={{
          marginTop: 24,
          padding: 20,
          border: "1px solid #ddd",
          borderRadius: 12,
        }}
      >
        <h2 style={{ marginTop: 0 }}>Raffle Details</h2>
        <p>Ticket Price: £{Number(raffle.ticketPrice).toFixed(2)}</p>
        <p>Sold Tickets: {raffle.soldTickets}</p>
        <p>Remaining Tickets: {raffle.remainingTickets}</p>
        <p>Status: {raffle.status}</p>
      </div>

      <div
        style={{
          marginTop: 24,
          padding: 20,
          border: "1px solid #ddd",
          borderRadius: 12,
        }}
      >
        <h2 style={{ marginTop: 0 }}>Buy Tickets</h2>
        <p>Name input, email input, and checkout are the next step once this page is stable.</p>
      </div>
    </div>
  );
}
