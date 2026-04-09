import { useEffect, useState } from "react";

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
  const [raffle, setRaffle] = useState<PublicRaffle | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadRaffle() {
      try {
        const path = window.location.pathname;
        const rawSlug = path.split("/r/")[1] || "";
        const slug = rawSlug.split("/")[0].trim();

        if (!slug) {
          throw new Error(`Missing slug from path: ${path}`);
        }

        const apiUrl = `${window.location.origin}/api/public/raffles/${slug}`;

        const res = await fetch(apiUrl, {
          method: "GET",
          headers: {
            Accept: "application/json",
          },
        });

        const text = await res.text();

        let data: any = null;

        try {
          data = text ? JSON.parse(text) : null;
        } catch {
          throw new Error(`API returned non-JSON: ${text.slice(0, 200)}`);
        }

        if (!res.ok) {
          throw new Error(data?.message || `API failed with status ${res.status}`);
        }

        if (!cancelled) {
          setRaffle(data);
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

    loadRaffle();

    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return <div style={{ padding: 24 }}>Loading raffle...</div>;
  }

  if (error) {
    return (
      <div style={{ padding: 24, maxWidth: 960, margin: "0 auto" }}>
        <h1>Raffle not available</h1>
        <p>{error}</p>
        <p>Path: {window.location.pathname}</p>
      </div>
    );
  }

  if (!raffle) {
    return (
      <div style={{ padding: 24, maxWidth: 960, margin: "0 auto" }}>
        <h1>Raffle not found</h1>
      </div>
    );
  }

  return (
    <div style={{ padding: 24, maxWidth: 960, margin: "0 auto" }}>
      <h1>{raffle.title}</h1>
      <p>{raffle.description}</p>

      <div
        style={{
          marginTop: 24,
          padding: 20,
          border: "1px solid #ddd",
          borderRadius: 12,
          background: "#fff",
        }}
      >
        <h2 style={{ marginTop: 0 }}>Raffle Details</h2>
        <p>Ticket Price: £{Number(raffle.ticketPrice).toFixed(2)}</p>
        <p>Sold Tickets: {raffle.soldTickets}</p>
        <p>Remaining Tickets: {raffle.remainingTickets}</p>
        <p>Status: {raffle.status}</p>
      </div>
    </div>
  );
}
