import { useRouter } from "next/router";
import React, { useEffect, useState } from "react";

type PublicRaffle = {
  id: string;
  tenant_slug: string;
  slug: string;
  title: string;
  description: string;
  image_url: string;
  background_image_url?: string;
  ticket_price: number;
  total_tickets: number;
  sold_tickets: number;
  remaining_tickets: number;
  status: string;
  created_at: string;
  updated_at: string;
  currency_code?: string;
  colour_selection_mode?: string;
  number_selection_mode?: string;
  number_range_start?: number | null;
  number_range_end?: number | null;
  colours?: Array<{ name: string; hex: string }>;
  offers: Array<{
    id?: string;
    label: string;
    price: number;
    tickets: number;
    is_active: boolean;
    sort_order: number;
  }>;
};

type ApiResponse = {
  ok?: boolean;
  item?: PublicRaffle;
  error?: string;
};

function money(value: number, currency = "GBP") {
  const symbol = currency === "USD" ? "$" : currency === "EUR" ? "€" : "£";
  return `${symbol}${value.toFixed(2)}`;
}

export default function PublicRafflePage() {
  const router = useRouter();
  const slug = typeof router.query.slug === "string" ? router.query.slug : "";

  const [raffle, setRaffle] = useState<PublicRaffle | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!router.isReady) return;
    if (!slug) {
      setLoading(false);
      setError("Missing raffle slug");
      return;
    }

    let active = true;

    async function load() {
      try {
        setLoading(true);
        setError("");

        const response = await fetch(
          `/api/public?slug=${encodeURIComponent(slug)}&tenantSlug=demo-a`
        );

        const raw = await response.text();
        const contentType = response.headers.get("content-type") || "";

        let json: ApiResponse | null = null;
        if (contentType.includes("application/json")) {
          try {
            json = JSON.parse(raw) as ApiResponse;
          } catch {
            json = null;
          }
        }

        if (!response.ok) {
          throw new Error(json?.error || raw || "Failed to load raffle");
        }

        if (!json?.item) {
          throw new Error("Raffle not found");
        }

        if (!active) return;
        setRaffle(json.item);
      } catch (err: any) {
        if (!active) return;
        setError(err?.message || "Failed to load raffle");
      } finally {
        if (active) setLoading(false);
      }
    }

    load();

    return () => {
      active = false;
    };
  }, [router.isReady, slug]);

  if (loading) {
    return (
      <div style={styles.page}>
        <div style={styles.container}>Loading raffle...</div>
      </div>
    );
  }

  if (error || !raffle) {
    return (
      <div style={styles.page}>
        <div style={styles.container}>
          <div style={styles.card}>
            <h1 style={styles.heading}>Raffle unavailable</h1>
            <p style={styles.errorText}>{error || "Raffle not found"}</p>
          </div>
        </div>
      </div>
    );
  }

  const activeOffers = raffle.offers.filter((offer) => offer.is_active);

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <div style={styles.card}>
          <h1 style={styles.heading}>{raffle.title}</h1>
          <p style={styles.description}>{raffle.description}</p>

          <div style={styles.metaGrid}>
            <div style={styles.metaCard}>
              <div style={styles.metaLabel}>Single ticket price</div>
              <div style={styles.metaValue}>
                {money(raffle.ticket_price, raffle.currency_code)}
              </div>
            </div>

            <div style={styles.metaCard}>
              <div style={styles.metaLabel}>Remaining tickets</div>
              <div style={styles.metaValue}>
                {raffle.remaining_tickets} / {raffle.total_tickets}
              </div>
            </div>

            <div style={styles.metaCard}>
              <div style={styles.metaLabel}>Status</div>
              <div style={styles.metaValue}>{raffle.status}</div>
            </div>
          </div>

          {activeOffers.length > 0 && (
            <div style={{ marginTop: 24 }}>
              <h2 style={styles.sectionHeading}>Offers</h2>
              <div style={styles.offerGrid}>
                {activeOffers.map((offer) => (
                  <div key={offer.id ?? `${offer.label}-${offer.sort_order}`} style={styles.offerCard}>
                    <div style={styles.offerTitle}>{offer.label}</div>
                    <div style={styles.offerSub}>{offer.tickets} tickets</div>
                    <div style={styles.offerPrice}>
                      {money(offer.price, raffle.currency_code)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {raffle.colours && raffle.colours.length > 0 && (
            <div style={{ marginTop: 24 }}>
              <h2 style={styles.sectionHeading}>Available colours</h2>
              <div style={styles.colourGrid}>
                {raffle.colours.map((colour) => (
                  <div key={`${colour.name}-${colour.hex}`} style={styles.colourChip}>
                    <span
                      style={{
                        ...styles.swatch,
                        backgroundColor: colour.hex,
                      }}
                    />
                    <span>{colour.name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    background: "#f3f4f6",
    padding: 24,
  },
  container: {
    maxWidth: 980,
    margin: "0 auto",
  },
  card: {
    background: "#ffffff",
    border: "1px solid #e5e7eb",
    borderRadius: 16,
    padding: 24,
  },
  heading: {
    margin: 0,
    marginBottom: 12,
    fontSize: 32,
  },
  description: {
    margin: 0,
    color: "#475569",
    lineHeight: 1.6,
  },
  errorText: {
    color: "#b91c1c",
    marginTop: 12,
  },
  metaGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: 16,
    marginTop: 24,
  },
  metaCard: {
    background: "#f9fafb",
    border: "1px solid #e5e7eb",
    borderRadius: 12,
    padding: 16,
  },
  metaLabel: {
    fontSize: 12,
    fontWeight: 700,
    color: "#64748b",
    textTransform: "uppercase",
    letterSpacing: "0.08em",
  },
  metaValue: {
    marginTop: 8,
    fontSize: 22,
    fontWeight: 700,
    color: "#111827",
  },
  sectionHeading: {
    margin: "0 0 16px",
    fontSize: 22,
  },
  offerGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: 16,
  },
  offerCard: {
    border: "1px solid #e5e7eb",
    borderRadius: 12,
    padding: 16,
    background: "#f9fafb",
  },
  offerTitle: {
    fontSize: 18,
    fontWeight: 700,
    color: "#111827",
  },
  offerSub: {
    marginTop: 8,
    color: "#475569",
  },
  offerPrice: {
    marginTop: 12,
    fontSize: 24,
    fontWeight: 800,
    color: "#111827",
  },
  colourGrid: {
    display: "flex",
    flexWrap: "wrap",
    gap: 12,
  },
  colourChip: {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    padding: "10px 12px",
    borderRadius: 999,
    border: "1px solid #e5e7eb",
    background: "#f9fafb",
  },
  swatch: {
    width: 16,
    height: 16,
    borderRadius: 999,
    display: "inline-block",
    border: "1px solid #d1d5db",
  },
};
