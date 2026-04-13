import { useEffect, useMemo, useState } from "react";
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

type DisplayOffer = {
  id: string;
  label: string;
  ticketQuantity: number;
  price: number;
  isSingleTicket: boolean;
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

  const displayOffers = useMemo<DisplayOffer[]>(() => {
    if (!raffle) return [];

    const singleTicketOffer: DisplayOffer = {
      id: "single-ticket",
      label: "1 Ticket",
      ticketQuantity: 1,
      price: raffle.ticketPrice,
      isSingleTicket: true,
    };

    return [singleTicketOffer, ...offers.map((offer) => ({
      ...offer,
      isSingleTicket: false,
    }))];
  }, [raffle, offers]);

  useEffect(() => {
    if (displayOffers.length > 0 && !selectedOfferId) {
      setSelectedOfferId(displayOffers[0].id);
    }
  }, [displayOffers, selectedOfferId]);

  const selectedOffer = displayOffers.find((offer) => offer.id === selectedOfferId) ?? null;

  if (loading) {
    return <div style={styles.page}>Loading raffle...</div>;
  }

  if (error || !raffle) {
    return (
      <div style={styles.page}>
        <h1 style={styles.title}>Raffle unavailable</h1>
        <p style={styles.error}>{error || "Not found"}</p>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <p style={styles.eyebrow}>Public raffle</p>
        <h1 style={styles.title}>{raffle.title}</h1>
        <p style={styles.description}>{raffle.description}</p>

        <div style={styles.metaRow}>
          <div style={styles.metaCard}>
            <div style={styles.metaLabel}>Single ticket</div>
            <div style={styles.metaValue}>£{raffle.ticketPrice.toFixed(2)}</div>
          </div>

          <div style={styles.metaCard}>
            <div style={styles.metaLabel}>Remaining</div>
            <div style={styles.metaValue}>{raffle.remainingTickets}</div>
          </div>

          <div style={styles.metaCard}>
            <div style={styles.metaLabel}>Status</div>
            <div style={styles.metaValue}>{raffle.status}</div>
          </div>
        </div>

        <div style={styles.section}>
          <h2 style={styles.sectionTitle}>Choose tickets</h2>

          <div style={styles.offerList}>
            {displayOffers.map((offer) => (
              <label key={offer.id} style={styles.offerCard}>
                <input
                  type="radio"
                  name="offer"
                  value={offer.id}
                  checked={selectedOfferId === offer.id}
                  onChange={() => setSelectedOfferId(offer.id)}
                />
                <div>
                  <div style={styles.offerTitle}>
                    {offer.label}
                    {offer.isSingleTicket ? " (standard)" : ""}
                  </div>
                  <div style={styles.offerMeta}>
                    {offer.ticketQuantity} ticket
                    {offer.ticketQuantity === 1 ? "" : "s"} for £
                    {offer.price.toFixed(2)}
                  </div>
                </div>
              </label>
            ))}
          </div>
        </div>

        {selectedOffer && (
          <div style={styles.selectedBox}>
            <div style={styles.selectedLabel}>Selected</div>
            <div style={styles.selectedValue}>
              {selectedOffer.label} — {selectedOffer.ticketQuantity} ticket
              {selectedOffer.ticketQuantity === 1 ? "" : "s"} for £
              {selectedOffer.price.toFixed(2)}
            </div>
          </div>
        )}

        {raffle.isSoldOut ? (
          <p style={styles.soldOut}>Sold out</p>
        ) : (
          <button style={styles.button}>Continue</button>
        )}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    background: "#f6f7fb",
    padding: 24,
  },
  card: {
    maxWidth: 720,
    margin: "0 auto",
    background: "#fff",
    borderRadius: 16,
    padding: 24,
    boxShadow: "0 8px 24px rgba(0,0,0,0.06)",
  },
  eyebrow: {
    margin: 0,
    fontSize: 14,
    textTransform: "uppercase",
    color: "#64748b",
    fontWeight: 700,
  },
  title: {
    margin: "8px 0 12px",
    fontSize: 32,
    lineHeight: 1.1,
  },
  description: {
    margin: 0,
    color: "#334155",
    lineHeight: 1.6,
  },
  metaRow: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
    gap: 12,
    marginTop: 20,
    marginBottom: 24,
  },
  metaCard: {
    background: "#f8fafc",
    borderRadius: 12,
    padding: 16,
  },
  metaLabel: {
    fontSize: 13,
    color: "#64748b",
    marginBottom: 8,
  },
  metaValue: {
    fontSize: 22,
    fontWeight: 700,
  },
  section: {
    marginTop: 8,
  },
  sectionTitle: {
    margin: "0 0 12px",
    fontSize: 22,
  },
  offerList: {
    display: "grid",
    gap: 12,
  },
  offerCard: {
    display: "flex",
    gap: 12,
    alignItems: "flex-start",
    padding: 14,
    border: "1px solid #e5e7eb",
    borderRadius: 12,
    cursor: "pointer",
  },
  offerTitle: {
    fontWeight: 700,
    marginBottom: 4,
  },
  offerMeta: {
    color: "#475569",
  },
  selectedBox: {
    marginTop: 20,
    background: "#f8fafc",
    borderRadius: 12,
    padding: 16,
  },
  selectedLabel: {
    fontSize: 13,
    color: "#64748b",
    marginBottom: 6,
  },
  selectedValue: {
    fontWeight: 700,
  },
  soldOut: {
    marginTop: 20,
    color: "#b91c1c",
    fontWeight: 700,
  },
  button: {
    marginTop: 20,
    border: 0,
    borderRadius: 10,
    padding: "12px 16px",
    background: "#111827",
    color: "#fff",
    fontWeight: 700,
    cursor: "pointer",
  },
  error: {
    color: "#b91c1c",
  },
};
