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
  createdAt: string;
};

export default function PublicRafflePage() {
  const { slug } = useParams<{ slug: string }>();

  const [raffle, setRaffle] = useState<PublicRaffle | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;

    async function loadRaffle() {
      if (!slug) {
        setError("Missing raffle slug");
        setLoading(false);
        return;
      }

      try {
        const res = await fetch(`/api/public/raffles/${slug}`, {
          headers: {
            "x-tenant-id": "demo-a",
            Accept: "application/json",
          },
        });

        const contentType = res.headers.get("content-type") || "";
        const rawText = await res.text();

        if (!contentType.includes("application/json")) {
          throw new Error(
            `API did not return JSON. Status: ${res.status}. Response: ${rawText.slice(0, 200)}`
          );
        }

        const data = JSON.parse(rawText);

        if (!res.ok) {
          throw new Error(data.message || "Failed to load raffle");
        }

        if (mounted) {
          setRaffle(data);
        }
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err.message : "Failed to load raffle");
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    loadRaffle();

    return () => {
      mounted = false;
    };
  }, [slug]);

  if (loading) {
    return <div style={{ padding: 24 }}>Loading raffle...</div>;
  }

  if (error) {
    return (
      <div style={{ padding: 24, maxWidth: 960, margin: "0 auto" }}>
        <h1>Raffle not available</h1>
        <p>{error}</p>
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
        <h2 style={{ marginTop: 0 }}>Buy Tickets</h2>
        <p>Ticket Price: £{Number(raffle.ticketPrice).toFixed(2)}</p>
        <p>Max Tickets: {raffle.maxTickets}</p>
        <p>Tenant: {raffle.tenantId}</p>

        <button type="button">Buy Ticket</button>
      </div>
    </div>
  );
}
