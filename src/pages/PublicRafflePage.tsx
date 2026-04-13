import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";

type Offer = {
  id: string;
  label: string;
  ticketQuantity: number;
  price: number;
};

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
  offers: Offer[];
  error?: string;
};

export default function PublicRafflePage() {
  const { slug } = useParams<{ slug: string }>();

  const [raffle, setRaffle] = useState<PublicRaffle | null>(null);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedOfferId, setSelectedOfferId] = useState<string>("");

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
        setOffers(json.offers || []);
        if (json.offers && json.offers.length > 0) {
          setSelectedOfferId(json.offers[0].id);
        }
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
        <strong>Single ticket price:</strong> £{raffle.ticketPrice.toFixed(2)}
      </p>

      <p>
        <strong>Remaining:</strong> {raffle.remainingTickets}
      </p>

      <h2>Offers</h2>

      {offers.length === 0 ? (
        <p>No bundle offers available yet.</p>
      ) : (
        <div style={{ display: "grid", gap: 12, marginBottom: 20 }}>
          {offers.map((offer) => (
            <label
              key={offer.id}
              style={{
                display: "flex",
                gap: 10,
                alignItems: "center",
                padding: 12,
                border: "1px solid #ddd",
                borderRadius: 8,
              }}
            >
              <input
                type="radio"
                name="offer"
                value={offer.id}
                checked={selectedOfferId === offer.id}
                onChange={() => setSelectedOfferId(offer.id)}
              />
              <span>
                {offer.label} — {offer.ticketQuantity} ticket(s) for £
                {offer.price.toFixed(2)}
              </span>
            </label>
          ))}
        </div>
      )}

      {raffle.isSoldOut ? (
        <p style={{ color: "red" }}>Sold out</p>
      ) : (
        <button>Continue</button>
      )}
    </div>
  );
}
