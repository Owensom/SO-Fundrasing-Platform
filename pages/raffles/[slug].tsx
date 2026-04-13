import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";

type ColourOption = {
  name: string;
  hex: string;
};

type Raffle = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  heroImageUrl: string | null;
  status: string;
  startsAt: string | null;
  endsAt: string | null;
  raffleConfig: {
    campaignId: string;
    singleTicketPriceCents: number;
    totalTickets: number;
    soldTickets: number;
    backgroundImageUrl: string | null;
    currencyCode: "GBP" | "USD" | "EUR";
    colourSelectionMode: "manual" | "automatic" | "both";
    numberSelectionMode: "none" | "manual" | "automatic" | "both";
    numberRangeStart: number | null;
    numberRangeEnd: number | null;
    colours: ColourOption[];
  };
};

type EntrySelectionState = {
  autoColour: boolean;
  colourName: string;
  autoNumber: boolean;
  number: string;
};

function formatMoney(cents: number, currencyCode: string) {
  const safeCents = Number.isFinite(cents) ? Number(cents) : 0;
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: currencyCode || "GBP",
  }).format(safeCents / 100);
}

function buildEmptyEntry(
  colourMode: "manual" | "automatic" | "both",
  numberMode: "none" | "manual" | "automatic" | "both"
): EntrySelectionState {
  return {
    autoColour: colourMode === "automatic",
    colourName: "",
    autoNumber: numberMode === "automatic" || numberMode === "none",
    number: "",
  };
}

export default function PublicRafflePage() {
  const router = useRouter();
  const slug = typeof router.query.slug === "string" ? router.query.slug : "";

  const [raffle, setRaffle] = useState<Raffle | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState<any>(null);

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [entries, setEntries] = useState<EntrySelectionState[]>([]);

  useEffect(() => {
    if (!router.isReady) return;
    if (!slug) {
      setLoading(false);
      return;
    }

    async function load() {
      setLoading(true);
      setError("");

      try {
        const res = await fetch(`/api/public/raffles?slug=${encodeURIComponent(slug)}`);
        const json = await res.json();

        if (!res.ok) {
          throw new Error(json?.error || "Failed to load raffle");
        }

        const loaded = json?.raffle;
        if (!loaded) {
          throw new Error("Raffle data missing");
        }

        setRaffle(loaded);

        const colourMode = loaded?.raffleConfig?.colourSelectionMode || "both";
        const numberMode = loaded?.raffleConfig?.numberSelectionMode || "none";

        setEntries([buildEmptyEntry(colourMode, numberMode)]);
      } catch (err: any) {
        setError(err.message || "Failed to load raffle");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [router.isReady, slug]);

  useEffect(() => {
    if (!raffle) return;

    const colourMode = raffle.raffleConfig?.colourSelectionMode || "both";
    const numberMode = raffle.raffleConfig?.numberSelectionMode || "none";

    setEntries((prev) => {
      const next = [...prev];

      while (next.length < quantity) {
        next.push(buildEmptyEntry(colourMode, numberMode));
      }

      while (next.length > quantity) {
        next.pop();
      }

      return next;
    });
  }, [quantity, raffle]);

  const config = raffle?.raffleConfig;

  const totalPrice = useMemo(() => {
    if (!config) return 0;
    return (config.singleTicketPriceCents || 0) * quantity;
  }, [config, quantity]);

  function updateEntry(index: number, patch: Partial<EntrySelectionState>) {
    setEntries((prev) =>
      prev.map((entry, i) => (i === index ? { ...entry, ...patch } : entry))
    );
  }

  function renderColourControls(entry: EntrySelectionState, index: number) {
    if (!config) return null;

    const mode = config.colourSelectionMode || "both";
    const colours = Array.isArray(config.colours) ? config.colours : [];

    if (mode === "automatic") {
      return <div style={styles.muted}>Colour will be chosen automatically.</div>;
    }

    if (mode === "manual") {
      return (
        <div style={styles.section}>
          <label style={styles.label}>Choose colour</label>
          <div style={styles.colourGrid}>
            {colours.map((colour) => {
              const active = entry.colourName === colour.name;
              return (
                <button
                  key={colour.name}
                  type="button"
                  onClick={() => updateEntry(index, { colourName: colour.name })}
                  style={{
                    ...styles.colourButton,
                    border: active ? "2px solid #2563eb" : "1px solid #d1d5db",
                  }}
                >
                  <span
                    style={{
                      ...styles.colourSwatch,
                      backgroundColor: colour.hex,
                    }}
                  />
                  <span>{colour.name}</span>
                </button>
              );
            })}
          </div>
        </div>
      );
    }

    return (
      <div style={styles.section}>
        <label style={styles.label}>Colour</label>
        <div style={styles.inlineOptions}>
          <label style={styles.radioLabel}>
            <input
              type="radio"
              checked={!entry.autoColour}
              onChange={() => updateEntry(index, { autoColour: false })}
            />
            Choose manually
          </label>
          <label style={styles.radioLabel}>
            <input
              type="radio"
              checked={entry.autoColour}
              onChange={() => updateEntry(index, { autoColour: true, colourName: "" })}
            />
            Auto pick
          </label>
        </div>

        {entry.autoColour ? (
          <div style={styles.muted}>Colour will be chosen automatically.</div>
        ) : (
          <div style={styles.colourGrid}>
            {colours.map((colour) => {
              const active = entry.colourName === colour.name;
              return (
                <button
                  key={colour.name}
                  type="button"
                  onClick={() => updateEntry(index, { colourName: colour.name })}
                  style={{
                    ...styles.colourButton,
                    border: active ? "2px solid #2563eb" : "1px solid #d1d5db",
                  }}
                >
                  <span
                    style={{
                      ...styles.colourSwatch,
                      backgroundColor: colour.hex,
                    }}
                  />
                  <span>{colour.name}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  function renderNumberControls(entry: EntrySelectionState, index: number) {
    if (!config) return null;

    const mode = config.numberSelectionMode || "none";
    const start = config.numberRangeStart;
    const end = config.numberRangeEnd;

    if (mode === "none") return null;

    if (mode === "automatic") {
      return <div style={styles.muted}>Number will be chosen automatically.</div>;
    }

    if (mode === "manual") {
      return (
        <div style={styles.section}>
          <label style={styles.label}>
            Choose number
            {start != null && end != null ? ` (${start} to ${end})` : ""}
          </label>
          <input
            type="number"
            min={start ?? undefined}
            max={end ?? undefined}
            step="1"
            value={entry.number}
            onChange={(e) => updateEntry(index, { number: e.target.value })}
            style={styles.input}
          />
        </div>
      );
    }

    return (
      <div style={styles.section}>
        <label style={styles.label}>Number</label>
        <div style={styles.inlineOptions}>
          <label style={styles.radioLabel}>
            <input
              type="radio"
              checked={!entry.autoNumber}
              onChange={() => updateEntry(index, { autoNumber: false })}
            />
            Choose manually
          </label>
          <label style={styles.radioLabel}>
            <input
              type="radio"
              checked={entry.autoNumber}
              onChange={() => updateEntry(index, { autoNumber: true, number: "" })}
            />
            Auto pick
          </label>
        </div>

        {entry.autoNumber ? (
          <div style={styles.muted}>Number will be chosen automatically.</div>
        ) : (
          <input
            type="number"
            min={start ?? undefined}
            max={end ?? undefined}
            step="1"
            value={entry.number}
            onChange={(e) => updateEntry(index, { number: e.target.value })}
            style={styles.input}
          />
        )}
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!raffle || !config) return;

    setSubmitting(true);
    setError("");
    setSuccess(null);

    try {
      const payload = {
        slug: raffle.slug,
        fullName,
        email,
        quantity,
        entrySelections: entries.map((entry) => ({
          autoColour: entry.autoColour,
          colourName: entry.colourName || null,
          autoNumber: entry.autoNumber,
          number: entry.number ? Number(entry.number) : null,
        })),
      };

      const res = await fetch("/api/public/raffles", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json?.error || "Failed to create purchase");
      }

      setSuccess(json);
    } catch (err: any) {
      setError(err.message || "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  if (!router.isReady || loading) {
    return <div style={styles.page}>Loading raffle...</div>;
  }

  if (!slug) {
    return <div style={styles.page}>Missing raffle slug.</div>;
  }

  if (error && !raffle) {
    return <div style={styles.page}>{error}</div>;
  }

  if (!raffle || !config) {
    return <div style={styles.page}>Raffle not found.</div>;
  }

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <div style={styles.hero}>
          <h1 style={styles.heading}>{raffle.title || raffle.slug}</h1>
          {raffle.description ? <p style={styles.description}>{raffle.description}</p> : null}

          <div style={styles.summaryRow}>
            <div style={styles.summaryCard}>
              <div style={styles.summaryLabel}>Ticket price</div>
              <div style={styles.summaryValue}>
                {formatMoney(config.singleTicketPriceCents || 0, config.currencyCode || "GBP")}
              </div>
            </div>

            <div style={styles.summaryCard}>
              <div style={styles.summaryLabel}>Total tickets</div>
              <div style={styles.summaryValue}>{config.totalTickets ?? 0}</div>
            </div>

            <div style={styles.summaryCard}>
              <div style={styles.summaryLabel}>Sold</div>
              <div style={styles.summaryValue}>{config.soldTickets ?? 0}</div>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} style={styles.form}>
          <div style={styles.card}>
            <label style={styles.label}>Your name</label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              style={styles.input}
              required
            />
          </div>

          <div style={styles.card}>
            <label style={styles.label}>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={styles.input}
              required
            />
          </div>

          <div style={styles.card}>
            <label style={styles.label}>How many entries?</label>
            <input
              type="number"
              min="1"
              step="1"
              value={quantity}
              onChange={(e) => setQuantity(Math.max(1, Number(e.target.value || 1)))}
              style={styles.input}
            />
          </div>

          {entries.map((entry, index) => (
            <div key={index} style={styles.entryCard}>
              <h3 style={styles.entryHeading}>Entry {index + 1}</h3>
              {renderColourControls(entry, index)}
              {renderNumberControls(entry, index)}
            </div>
          ))}

          <div style={styles.totalCard}>
            <div style={styles.totalLabel}>Total</div>
            <div style={styles.totalValue}>
              {formatMoney(totalPrice, config.currencyCode || "GBP")}
            </div>
          </div>

          <div style={styles.actions}>
            <button type="submit" disabled={submitting} style={styles.submitButton}>
              {submitting ? "Creating..." : "Continue"}
            </button>
          </div>

          {error ? <div style={styles.error}>{error}</div> : null}
          {success ? (
            <div style={styles.success}>
              Pending purchase created. Purchase ID: {success.purchaseId}
            </div>
          ) : null}
        </form>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    background: "#f8fafc",
    padding: 24,
  },
  container: {
    maxWidth: 900,
    margin: "0 auto",
    display: "flex",
    flexDirection: "column",
    gap: 16,
  },
  hero: {
    background: "#ffffff",
    border: "1px solid #e5e7eb",
    borderRadius: 16,
    padding: 24,
  },
  heading: {
    margin: 0,
    fontSize: 32,
  },
  description: {
    marginTop: 10,
    color: "#4b5563",
    fontSize: 16,
  },
  summaryRow: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: 12,
    marginTop: 18,
  },
  summaryCard: {
    border: "1px solid #e5e7eb",
    borderRadius: 12,
    padding: 16,
    background: "#f9fafb",
  },
  summaryLabel: {
    fontSize: 13,
    color: "#6b7280",
  },
  summaryValue: {
    marginTop: 6,
    fontSize: 20,
    fontWeight: 700,
  },
  form: {
    display: "flex",
    flexDirection: "column",
    gap: 16,
  },
  card: {
    background: "#fff",
    border: "1px solid #e5e7eb",
    borderRadius: 12,
    padding: 16,
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },
  entryCard: {
    background: "#fff",
    border: "1px solid #e5e7eb",
    borderRadius: 12,
    padding: 16,
    display: "flex",
    flexDirection: "column",
    gap: 14,
  },
  entryHeading: {
    margin: 0,
    fontSize: 20,
  },
  section: {
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },
  label: {
    fontWeight: 600,
    fontSize: 14,
  },
  input: {
    height: 42,
    borderRadius: 8,
    border: "1px solid #d1d5db",
    padding: "0 12px",
    fontSize: 14,
  },
  muted: {
    color: "#6b7280",
    fontSize: 14,
  },
  inlineOptions: {
    display: "flex",
    gap: 16,
    flexWrap: "wrap",
  },
  radioLabel: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    fontSize: 14,
  },
  colourGrid: {
    display: "flex",
    flexWrap: "wrap",
    gap: 10,
  },
  colourButton: {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    padding: "10px 12px",
    borderRadius: 999,
    background: "#fff",
    cursor: "pointer",
  },
  colourSwatch: {
    width: 18,
    height: 18,
    borderRadius: 999,
    display: "inline-block",
  },
  totalCard: {
    background: "#eff6ff",
    border: "1px solid #bfdbfe",
    borderRadius: 12,
    padding: 18,
  },
  totalLabel: {
    fontSize: 14,
    color: "#1d4ed8",
  },
  totalValue: {
    marginTop: 4,
    fontSize: 28,
    fontWeight: 800,
    color: "#1e3a8a",
  },
  actions: {
    display: "flex",
    justifyContent: "flex-end",
  },
  submitButton: {
    height: 46,
    padding: "0 18px",
    borderRadius: 10,
    border: "1px solid #2563eb",
    background: "#2563eb",
    color: "#fff",
    cursor: "pointer",
    fontWeight: 700,
    fontSize: 15,
  },
  error: {
    background: "#fef2f2",
    border: "1px solid #fecaca",
    color: "#b91c1c",
    padding: 12,
    borderRadius: 10,
  },
  success: {
    background: "#ecfdf5",
    border: "1px solid #a7f3d0",
    color: "#065f46",
    padding: 12,
    borderRadius: 10,
  },
};
