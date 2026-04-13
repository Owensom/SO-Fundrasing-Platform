import { useEffect, useState } from "react";

type Offer = {
  id: string;
  label: string;
  ticketQuantity: number;
  price: number;
  isActive: boolean;
  sortOrder: number;
};

type Colour = {
  id: string;
  name: string;
  hexValue: string | null;
  isActive: boolean;
  sortOrder: number;
};

type AdminRafflePurchasesResponse = {
  raffle: {
    id: string;
    slug: string;
    title: string;
    description: string;
    ticketPrice: number;
    totalTickets: number;
    soldTickets: number;
    remainingTickets: number;
    isSoldOut: boolean;
    status: string;
    createdAt?: string;
    updatedAt?: string;
  };
  offers: Offer[];
  colours: Colour[];
  purchases: Array<{
    id: string;
    customerName: string;
    customerEmail: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
    paymentStatus: string;
    createdAt: string;
  }>;
  summary: {
    totalTickets: number;
    soldTickets: number;
    remainingTickets: number;
    purchaseCount: number;
  };
  error?: string;
};

export default function AdminRaffleDetailsPage() {
  const [data, setData] = useState<AdminRafflePurchasesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [offerLabel, setOfferLabel] = useState("");
  const [offerTicketQuantity, setOfferTicketQuantity] = useState(1);
  const [offerPrice, setOfferPrice] = useState(5);

  const [colourName, setColourName] = useState("");
  const [colourHexValue, setColourHexValue] = useState("");

  const slug = window.location.pathname.split("/").pop();

  async function load() {
    if (!slug) return;

    const safeSlug = slug;

    try {
      const response = await fetch(
        `/api/admin/raffle-details?slug=${encodeURIComponent(
          safeSlug
        )}&tenantSlug=demo-a`,
        {
          headers: { "x-tenant-slug": "demo-a" },
        }
      );

      const raw = await response.text();
      const contentType = response.headers.get("content-type") || "";

      let json: AdminRafflePurchasesResponse | null = null;
      if (contentType.includes("application/json")) {
        json = JSON.parse(raw) as AdminRafflePurchasesResponse;
      }

      if (!response.ok) {
        throw new Error(json?.error || raw || "Failed to load raffle details");
      }

      if (!json) {
        throw new Error("Admin API did not return JSON.");
      }

      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!slug) {
      setError("Missing raffle slug.");
      setLoading(false);
      return;
    }

    void load();
  }, [slug]);

  async function handleAddOffer(e: React.FormEvent) {
    e.preventDefault();

    if (!slug) return;

    if (!offerLabel.trim()) {
      setError("Please enter an offer label, for example '3 Tickets'.");
      return;
    }

    try {
      setError(null);

      const response = await fetch("/api/admin/raffles", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-tenant-slug": "demo-a",
        },
        body: JSON.stringify({
          action: "add-offer",
          slug,
          label: offerLabel,
          ticketQuantity: offerTicketQuantity,
          price: offerPrice,
        }),
      });

      const json = await response.json();

      if (!response.ok) {
        throw new Error(json.error || "Failed to add offer");
      }

      setOfferLabel("");
      setOfferTicketQuantity(1);
      setOfferPrice(5);

      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    }
  }

  async function handleRemoveOffer(offerId: string) {
    try {
      setError(null);

      const response = await fetch("/api/admin/raffles", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-tenant-slug": "demo-a",
        },
        body: JSON.stringify({
          action: "remove-offer",
          offerId,
        }),
      });

      const json = await response.json();

      if (!response.ok) {
        throw new Error(json.error || "Failed to remove offer");
      }

      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    }
  }

  async function handleAddColour(e: React.FormEvent) {
    e.preventDefault();

    if (!slug) return;

    if (!colourName.trim()) {
      setError("Please enter a colour name.");
      return;
    }

    try {
      setError(null);

      const response = await fetch("/api/admin/raffles", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-tenant-slug": "demo-a",
        },
        body: JSON.stringify({
          action: "add-colour",
          slug,
          name: colourName,
          hexValue: colourHexValue,
        }),
      });

      const json = await response.json();

      if (!response.ok) {
        throw new Error(json.error || "Failed to add colour");
      }

      setColourName("");
      setColourHexValue("");

      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    }
  }

  async function handleRemoveColour(colourId: string) {
    try {
      setError(null);

      const response = await fetch("/api/admin/raffles", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-tenant-slug": "demo-a",
        },
        body: JSON.stringify({
          action: "remove-colour",
          colourId,
        }),
      });

      const json = await response.json();

      if (!response.ok) {
        throw new Error(json.error || "Failed to remove colour");
      }

      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    }
  }

  if (loading) return <div style={styles.page}>Loading...</div>;

  if (error || !data) {
    return (
      <div style={styles.page}>
        <h1>Raffle details</h1>
        <p style={styles.error}>{error || "Not found"}</p>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <div>
          <p style={styles.eyebrow}>Admin</p>
          <h1 style={styles.title}>{data.raffle.title}</h1>
          <p style={styles.meta}>Slug: {data.raffle.slug}</p>
        </div>

        <div>
          <a
            href={`/admin/raffles/${encodeURIComponent(data.raffle.slug)}/edit`}
            style={styles.editButton}
          >
            Edit raffle
          </a>
        </div>
      </div>

      <div style={styles.summaryGrid}>
        <SummaryCard
          label="Total tickets"
          value={String(data.summary.totalTickets)}
        />
        <SummaryCard
          label="Sold tickets"
          value={String(data.summary.soldTickets)}
        />
        <SummaryCard
          label="Remaining"
          value={String(data.summary.remainingTickets)}
        />
        <SummaryCard
          label="Purchases"
          value={String(data.summary.purchaseCount)}
        />
      </div>

      <div style={styles.section}>
        <h2>Colours</h2>

        {data.colours.length === 0 ? (
          <p>No colours yet.</p>
        ) : (
          <div style={styles.itemList}>
            {data.colours.map((colour) => (
              <div key={colour.id} style={styles.itemCard}>
                <div style={styles.itemLeft}>
                  <span
                    style={{
                      ...styles.colourSwatch,
                      background: colour.hexValue || "#e5e7eb",
                    }}
                  />
                  <div>
                    <strong>{colour.name}</strong>
                    <div style={styles.smallText}>
                      {colour.hexValue || "No hex value"}
                    </div>
                  </div>
                </div>
                <button onClick={() => void handleRemoveColour(colour.id)}>
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}

        <form onSubmit={handleAddColour} style={styles.form}>
          <h3>Add colour</h3>

          <div>
            <label>Name</label>
            <input
              value={colourName}
              onChange={(e) => setColourName(e.target.value)}
              placeholder="Red"
            />
          </div>

          <div>
            <label>Hex value (optional)</label>
            <input
              value={colourHexValue}
              onChange={(e) => setColourHexValue(e.target.value)}
              placeholder="#DC2626"
            />
          </div>

          <button type="submit">Add colour</button>
        </form>
      </div>

      <div style={styles.section}>
        <h2>Offers</h2>

        {data.offers.length === 0 ? (
          <p>No offers yet.</p>
        ) : (
          <div style={styles.itemList}>
            {data.offers.map((offer) => (
              <div key={offer.id} style={styles.itemCard}>
                <div>
                  <strong>{offer.label}</strong>
                  <div style={styles.smallText}>
                    {offer.ticketQuantity} ticket(s) — £{offer.price.toFixed(2)}
                  </div>
                </div>
                <button onClick={() => void handleRemoveOffer(offer.id)}>
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}

        <form onSubmit={handleAddOffer} style={styles.form}>
          <h3>Add offer</h3>

          <div>
            <label>Label</label>
            <input
              value={offerLabel}
              onChange={(e) => setOfferLabel(e.target.value)}
              placeholder="3 Tickets"
            />
          </div>

          <div>
            <label>Ticket quantity</label>
            <input
              type="number"
              value={offerTicketQuantity}
              onChange={(e) => setOfferTicketQuantity(Number(e.target.value))}
            />
          </div>

          <div>
            <label>Price (£)</label>
            <input
              type="number"
              value={offerPrice}
              onChange={(e) => setOfferPrice(Number(e.target.value))}
            />
          </div>

          <button type="submit">Add offer</button>
        </form>
      </div>
    </div>
  );
}

function SummaryCard({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div style={styles.card}>
      <div style={styles.label}>{label}</div>
      <div style={styles.value}>{value}</div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    padding: 24,
    background: "#f6f7fb",
    minHeight: "100vh",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    marginBottom: 24,
    gap: 16,
  },
  eyebrow: {
    fontSize: 14,
    textTransform: "uppercase",
    color: "#64748b",
  },
  title: {
    fontSize: 32,
  },
  meta: {
    color: "#475569",
  },
  editButton: {
    padding: "10px 14px",
    background: "#111827",
    color: "#fff",
    borderRadius: 8,
    textDecoration: "none",
  },
  summaryGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    gap: 16,
    marginBottom: 24,
  },
  card: {
    background: "#fff",
    padding: 20,
    borderRadius: 12,
  },
  label: {
    color: "#64748b",
  },
  value: {
    fontSize: 24,
    fontWeight: 700,
  },
  section: {
    background: "#fff",
    padding: 20,
    borderRadius: 12,
    marginBottom: 24,
  },
  itemList: {
    display: "grid",
    gap: 12,
    marginBottom: 24,
  },
  itemCard: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    padding: 12,
    border: "1px solid #e5e7eb",
    borderRadius: 8,
  },
  itemLeft: {
    display: "flex",
    alignItems: "center",
    gap: 10,
  },
  colourSwatch: {
    width: 18,
    height: 18,
    borderRadius: 999,
    border: "1px solid #cbd5e1",
    display: "inline-block",
  },
  smallText: {
    color: "#64748b",
    fontSize: 13,
  },
  form: {
    display: "grid",
    gap: 12,
  },
  error: {
    color: "red",
  },
};
