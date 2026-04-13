import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";

type Offer = {
  id: string;
  label: string;
  ticketQuantity: number;
  price: number;
};

type Colour = {
  id: string;
  name: string;
  hexValue: string | null;
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
  colours: Colour[];
  error?: string;
};

type PurchaseResponse = {
  purchase?: {
    id: string;
    customerName: string;
    customerEmail: string;
    quantity: number;
    totalPrice: number;
    paymentStatus: string;
  };
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
  const [colours, setColours] = useState<Colour[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedOfferId, setSelectedOfferId] = useState<string>("");
  const [colourQuantities, setColourQuantities] = useState<Record<string, number>>(
    {}
  );
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

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
        setColours(json.colours || []);
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

    return [
      singleTicketOffer,
      ...offers.map((offer) => ({
        ...offer,
        isSingleTicket: false,
      })),
    ];
  }, [raffle, offers]);

  useEffect(() => {
    if (displayOffers.length > 0 && !selectedOfferId) {
      setSelectedOfferId(displayOffers[0].id);
    }
  }, [displayOffers, selectedOfferId]);

  const selectedOffer =
    displayOffers.find((offer) => offer.id === selectedOfferId) ?? null;

  const selectedColourTotal = Object.values(colourQuantities).reduce(
    (sum, value) => sum + value,
    0
  );

  const requiredQuantity = selectedOffer?.ticketQuantity ?? 0;
  const colourSelectionValid =
    requiredQuantity > 0 ? selectedColourTotal === requiredQuantity : false;

  function updateColourQuantity(colourId: string, nextValue: number) {
    setColourQuantities((prev) => ({
      ...prev,
      [colourId]: Math.max(0, nextValue),
    }));
  }

  useEffect(() => {
    setColourQuantities({});
  }, [selectedOfferId]);

  async function handleContinue() {
    if (!raffle || !slug || !selectedOffer) return;

    try {
      setSubmitting(true);
      setError(null);
      setSuccessMessage(null);

      const colourSelections = Object.entries(colourQuantities)
        .filter(([, quantity]) => quantity > 0)
        .map(([colourId, quantity]) => ({
          colourId,
          quantity,
        }));

      const response = await fetch("/api/public/raffles", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-tenant-slug": "demo-a",
        },
        body: JSON.stringify({
          action: "purchase",
          slug,
          offerId: selectedOffer.id,
          customerName,
          customerEmail,
          colourSelections,
        }),
      });

      const json = (await response.json()) as PurchaseResponse;

      if (!response.ok) {
        throw new Error(json.error || "Failed to create purchase.");
      }

      setSuccessMessage(
        `Purchase created: ${json.purchase?.quantity ?? 0} ticket(s), £${
          json.purchase?.totalPrice.toFixed(2) ?? "0.00"
        } total.`
      );
      setCustomerName("");
      setCustomerEmail("");
      setColourQuantities({});
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create purchase.");
    } finally {
      setSubmitting(false);
    }
  }

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
          <h2 style={styles.sectionTitle}>Choose an offer</h2>

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

        <div style={styles.section}>
          <h2 style={styles.sectionTitle}>Choose colours</h2>

          {colours.length === 0 ? (
            <p>No colours available yet.</p>
          ) : (
            <div style={styles.colourList}>
              {colours.map((colour) => {
                const currentValue = colourQuantities[colour.id] ?? 0;

                return (
                  <div key={colour.id} style={styles.colourCard}>
                    <div style={styles.colourInfo}>
                      <span
                        style={{
                          ...styles.colourSwatch,
                          background: colour.hexValue || "#e5e7eb",
                        }}
                      />
                      <span>{colour.name}</span>
                    </div>

                    <div style={styles.quantityControls}>
                      <button
                        type="button"
                        onClick={() =>
                          updateColourQuantity(colour.id, currentValue - 1)
                        }
                      >
                        -
                      </button>
                      <span style={styles.quantityValue}>{currentValue}</span>
                      <button
                        type="button"
                        onClick={() =>
                          updateColourQuantity(colour.id, currentValue + 1)
                        }
                      >
                        +
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div style={styles.selectedBox}>
            <div style={styles.selectedLabel}>Selection summary</div>
            <div style={styles.selectedValue}>
              Selected {selectedColourTotal} of {requiredQuantity} required ticket
              {requiredQuantity === 1 ? "" : "s"}
            </div>
            {!colourSelectionValid && (
              <div style={styles.validationText}>
                Your colour quantities must add up to the selected offer quantity.
              </div>
            )}
          </div>
        </div>

        <div style={styles.section}>
          <h2 style={styles.sectionTitle}>Your details</h2>

          <div style={styles.formGrid}>
            <div>
              <label>Name</label>
              <input
                style={styles.input}
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
              />
            </div>

            <div>
              <label>Email</label>
              <input
                style={styles.input}
                value={customerEmail}
                onChange={(e) => setCustomerEmail(e.target.value)}
              />
            </div>
          </div>
        </div>

        {selectedOffer && (
          <div style={styles.selectedBox}>
            <div style={styles.selectedLabel}>Selected offer</div>
            <div style={styles.selectedValue}>
              {selectedOffer.label} — {selectedOffer.ticketQuantity} ticket
              {selectedOffer.ticketQuantity === 1 ? "" : "s"} for £
              {selectedOffer.price.toFixed(2)}
            </div>
          </div>
        )}

        {successMessage && <p style={styles.success}>{successMessage}</p>}
        {error && <p style={styles.error}>{error}</p>}

        {raffle.isSoldOut ? (
          <p style={styles.soldOut}>Sold out</p>
        ) : (
          <button
            style={{
              ...styles.button,
              opacity:
                colourSelectionValid &&
                customerName.trim() &&
                customerEmail.trim() &&
                !submitting
                  ? 1
                  : 0.5,
              cursor:
                colourSelectionValid &&
                customerName.trim() &&
                customerEmail.trim() &&
                !submitting
                  ? "pointer"
                  : "not-allowed",
            }}
            disabled={
              !colourSelectionValid ||
              !customerName.trim() ||
              !customerEmail.trim() ||
              submitting
            }
            onClick={() => void handleContinue()}
          >
            {submitting ? "Creating purchase..." : "Continue"}
          </button>
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
    marginBottom: 24,
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
