import { FormEvent, useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import type {
  PublicRaffle,
  PublicRaffleResponse,
  PurchaseResponse,
} from "../types/raffles";

type PurchaseFormState = {
  name: string;
  email: string;
  quantity: number;
};

const initialFormState: PurchaseFormState = {
  name: "",
  email: "",
  quantity: 1,
};

export default function PublicRafflePage() {
  const { slug } = useParams<{ slug: string }>();

  const [raffle, setRaffle] = useState<PublicRaffle | null>(null);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);

  const [form, setForm] = useState<PurchaseFormState>(initialFormState);
  const [purchaseLoading, setPurchaseLoading] = useState(false);
  const [purchaseError, setPurchaseError] = useState<string | null>(null);
  const [purchaseSuccess, setPurchaseSuccess] = useState<string | null>(null);

  const totalPrice = useMemo(() => {
    if (!raffle) return 0;
    return raffle.ticketPrice * form.quantity;
  }, [raffle, form.quantity]);

  useEffect(() => {
    if (!slug) {
      setPageError("Missing raffle slug.");
      setLoading(false);
      return;
    }

    let isMounted = true;

    async function loadRaffle() {
      try {
        setLoading(true);
        setPageError(null);

        const response = await fetch(`/api/public/raffles/${slug}`, {
          headers: {
            "x-tenant-slug": "demo-a",
          },
        });

        const data = (await response.json()) as PublicRaffleResponse & {
          error?: string;
        };

        if (!response.ok) {
          throw new Error(data.error || "Failed to load raffle.");
        }

        if (!isMounted) return;

        setRaffle(data.raffle);
        setForm((current) => ({
          ...current,
          quantity:
            data.raffle.remainingTickets > 0
              ? Math.min(current.quantity, data.raffle.remainingTickets)
              : 1,
        }));
      } catch (error) {
        if (!isMounted) return;

        setPageError(
          error instanceof Error ? error.message : "Failed to load raffle."
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

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!slug || !raffle) return;

    setPurchaseLoading(true);
    setPurchaseError(null);
    setPurchaseSuccess(null);

    try {
      const response = await fetch(`/api/public/raffles/${slug}/purchase`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-tenant-slug": "demo-a",
        },
        body: JSON.stringify({
          name: form.name,
          email: form.email,
          quantity: form.quantity,
        }),
      });

      const data = (await response.json()) as PurchaseResponse & {
        error?: string;
      };

      if (!response.ok) {
        throw new Error(data.error || "Failed to complete purchase.");
      }

      setRaffle(data.raffle);
      setPurchaseSuccess(
        `Purchase complete. ${data.purchase.quantity} ticket(s) reserved for ${data.purchase.customerName}.`
      );
      setForm(initialFormState);
    } catch (error) {
      setPurchaseError(
        error instanceof Error ? error.message : "Failed to complete purchase."
      );
    } finally {
      setPurchaseLoading(false);
    }
  }

  if (loading) {
    return (
      <main style={styles.page}>
        <div style={styles.card}>Loading raffle...</div>
      </main>
    );
  }

  if (pageError || !raffle) {
    return (
      <main style={styles.page}>
        <div style={styles.card}>
          <h1 style={styles.title}>Raffle unavailable</h1>
          <p style={styles.errorText}>{pageError || "Raffle not found."}</p>
        </div>
      </main>
    );
  }

  const purchaseDisabled = raffle.isSoldOut || purchaseLoading;

  return (
    <main style={styles.page}>
      <div style={styles.layout}>
        <section style={styles.card}>
          <p style={styles.eyebrow}>Raffle</p>
          <h1 style={styles.title}>{raffle.title}</h1>
          <p style={styles.description}>{raffle.description}</p>

          {raffle.imageUrl ? (
            <img
              src={raffle.imageUrl}
              alt={raffle.title}
              style={styles.image}
            />
          ) : null}

          <div style={styles.statsGrid}>
            <Stat label="Ticket price" value={`$${raffle.ticketPrice.toFixed(2)}`} />
            <Stat label="Sold" value={String(raffle.soldTickets)} />
            <Stat label="Remaining" value={String(raffle.remainingTickets)} />
            <Stat
              label="Status"
              value={raffle.isSoldOut ? "sold out" : raffle.status}
            />
          </div>
        </section>

        <section style={styles.card}>
          <h2 style={styles.sectionTitle}>Buy tickets</h2>

          {purchaseSuccess ? (
            <div style={styles.successBox}>{purchaseSuccess}</div>
          ) : null}

          {purchaseError ? (
            <div style={styles.errorBox}>{purchaseError}</div>
          ) : null}

          {raffle.isSoldOut ? (
            <div style={styles.soldOutBox}>
              This raffle is sold out. Ticket sales are closed.
            </div>
          ) : null}

          <form onSubmit={handleSubmit} style={styles.form}>
            <label style={styles.label}>
              Name
              <input
                style={styles.input}
                type="text"
                value={form.name}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    name: event.target.value,
                  }))
                }
                placeholder="Jane Doe"
                required
                disabled={purchaseDisabled}
              />
            </label>

            <label style={styles.label}>
              Email
              <input
                style={styles.input}
                type="email"
                value={form.email}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    email: event.target.value,
                  }))
                }
                placeholder="jane@example.com"
                required
                disabled={purchaseDisabled}
              />
            </label>

            <label style={styles.label}>
              Quantity
              <input
                style={styles.input}
                type="number"
                min={1}
                max={Math.max(raffle.remainingTickets, 1)}
                value={form.quantity}
                onChange={(event) =>
                  setForm((current) => {
                    const raw = Number(event.target.value) || 1;
                    const next = Math.max(
                      1,
                      Math.min(raw, Math.max(raffle.remainingTickets, 1))
                    );

                    return {
                      ...current,
                      quantity: next,
                    };
                  })
                }
                required
                disabled={purchaseDisabled}
              />
            </label>

            <div style={styles.totalRow}>
              <span>Total</span>
              <strong>${totalPrice.toFixed(2)}</strong>
            </div>

            <button type="submit" style={styles.button} disabled={purchaseDisabled}>
              {purchaseLoading ? "Processing..." : "Buy tickets"}
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div style={styles.statCard}>
      <div style={styles.statLabel}>{label}</div>
      <div style={styles.statValue}>{value}</div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    padding: "32px 16px",
    background: "#f6f7fb",
  },
  layout: {
    maxWidth: 1100,
    margin: "0 auto",
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
    gap: 24,
  },
  card: {
    background: "#ffffff",
    borderRadius: 16,
    padding: 24,
    boxShadow: "0 8px 24px rgba(0, 0, 0, 0.06)",
  },
  eyebrow: {
    margin: 0,
    color: "#5b6475",
    fontSize: 14,
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
  },
  title: {
    margin: "8px 0 16px",
    fontSize: 32,
    lineHeight: 1.1,
  },
  sectionTitle: {
    marginTop: 0,
    marginBottom: 20,
    fontSize: 24,
  },
  description: {
    marginTop: 0,
    marginBottom: 20,
    color: "#334155",
    lineHeight: 1.6,
  },
  image: {
    width: "100%",
    borderRadius: 12,
    marginBottom: 20,
  },
  statsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 12,
  },
  statCard: {
    border: "1px solid #e5e7eb",
    borderRadius: 12,
    padding: 16,
  },
  statLabel: {
    fontSize: 13,
    color: "#64748b",
    marginBottom: 8,
  },
  statValue: {
    fontSize: 22,
    fontWeight: 700,
  },
  form: {
    display: "grid",
    gap: 16,
  },
  label: {
    display: "grid",
    gap: 8,
    fontWeight: 600,
  },
  input: {
    width: "100%",
    border: "1px solid #d0d7e2",
    borderRadius: 10,
    padding: "12px 14px",
    fontSize: 16,
  },
  totalRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    fontSize: 18,
    padding: "4px 0",
  },
  button: {
    border: 0,
    borderRadius: 10,
    padding: "14px 18px",
    fontSize: 16,
    fontWeight: 700,
    cursor: "pointer",
    background: "#111827",
    color: "#ffffff",
  },
  successBox: {
    marginBottom: 16,
    borderRadius: 10,
    padding: 12,
    background: "#ecfdf5",
    color: "#065f46",
  },
  errorBox: {
    marginBottom: 16,
    borderRadius: 10,
    padding: 12,
    background: "#fef2f2",
    color: "#991b1b",
  },
  soldOutBox: {
    marginBottom: 16,
    borderRadius: 10,
    padding: 12,
    background: "#fff7ed",
    color: "#9a3412",
  },
  errorText: {
    color: "#991b1b",
  },
};
