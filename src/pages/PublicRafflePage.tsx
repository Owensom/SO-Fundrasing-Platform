import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";

type PublicRaffle = {
  id: string;
  slug: string;
  title: string;
  description: string;
  ticketPrice: number;
  remainingTickets: number;
  isSoldOut: boolean;
  status: string;
};

type PublicRaffleResponse = {
  raffle: PublicRaffle;
  error?: string;
};

export default function PublicRafflePage() {
  const { slug } = useParams<{ slug: string }>();

  const [raffle, setRaffle] = useState<PublicRaffle | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) {
      setError("Missing raffle slug.");
      setLoading(false);
      return;
    }

    const safeSlug: string = slug;
    let isMounted = true;

    async function loadRaffle() {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch(
          `/api/public/raffles?slug=${encodeURIComponent(
            safeSlug
          )}&tenantSlug=demo-a`,
          {
            headers: {
              "x-tenant-slug": "demo-a",
            },
          }
        );

        const json = (await response.json()) as PublicRaffleResponse;

        if (!response.ok) {
          throw new Error(json.error || "Failed to load raffle.");
        }

        if (!isMounted) return;
        setRaffle(json.raffle);
      } catch (err) {
        if (!isMounted) return;
        setError(
          err instanceof Error ? err.message : "Failed to load raffle."
        );
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    void loadRaffle();

    return () => {
      isMounted = false;
    };
  }, [slug]);

  if (loading) {
    return <div style={{ padding: 24 }}>Loading raffle...</div>;
  }

  if (error || !raffle) {
    return (
      <div style={{ padding: 24 }}>
        <h1>Raffle unavailable</h1>
        <p style={{ color: "red" }}>{error || "Not found"}</p>
      </div>
    );
  }

  return (
    <div style={{ padding: 24 }}>
      <h1>{raffle.title}</h1>
      <p>{raffle.description}</p>

      <p>
        <strong>Price:</strong> £{raffle.ticketPrice.toFixed(2)}
      </p>

      <p>
        <strong>Remaining:</strong> {raffle.remainingTickets}
      </p>

      {raffle.isSoldOut ? (
        <p style={{ color: "red" }}>Sold out</p>
      ) : (
        <button>Buy tickets</button>
      )}
    </div>
  );
}
