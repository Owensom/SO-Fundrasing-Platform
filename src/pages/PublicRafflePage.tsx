import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";

type PublicRaffle = {
  id?: string;
  slug?: string;
  title?: string;
  description?: string;
  tenantId?: string;
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
        const res = await fetch(`/api/public/raffles/${slug}`);

        if (!res.ok) {
          throw new Error("Failed to load raffle");
        }

        const data = await res.json();

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
      <div style={{ padding: 24 }}>
        <h1>Raffle not available</h1>
        <p>{error}</p>
      </div>
    );
  }

  if (!raffle) {
    return (
      <div style={{ padding: 24 }}>
        <h1>Raffle not found</h1>
      </div>
    );
  }

  return (
    <div style={{ padding: 24, maxWidth: 960, margin: "0 auto" }}>
      <h1>{raffle.title || "Untitled Raffle"}</h1>
      <p>{raffle.description || "No description available."}</p>

      <div style={{ marginTop: 24, padding: 16, border: "1px solid #ddd", borderRadius: 8 }}>
        <h2>Buyer Area</h2>
        <p>Tenant: {raffle.tenantId || "Unknown tenant"}</p>
        <p>Slug: {raffle.slug || slug}</p>
        <button>Buy Ticket</button>
      </div>
    </div>
  );
}
