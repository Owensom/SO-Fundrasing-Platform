import React, { useMemo, useState } from "react";
import { createRaffle } from "../../api";

type OfferFormRow = {
  label: string;
  tickets: string;
  price: string;
  is_active: boolean;
};

type FormState = {
  title: string;
  description: string;
  slug: string;
  ticketPrice: string;
  maxTickets: string;
  imageUrl: string;
  offers: OfferFormRow[];
};

const INITIAL_STATE: FormState = {
  title: "",
  description: "",
  slug: "",
  ticketPrice: "5.00",
  maxTickets: "100",
  imageUrl: "",
  offers: [
    { label: "3 Tickets", tickets: "3", price: "10.00", is_active: true },
    { label: "10 Tickets", tickets: "10", price: "25.00", is_active: true },
  ],
};

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export default function AdminCreateRafflePage() {
  const [form, setForm] = useState<FormState>(INITIAL_STATE);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const resolvedSlug = useMemo(() => {
    return form.slug.trim() || slugify(form.title);
  }, [form.slug, form.title]);

  function updateField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function addOffer() {
    setForm((prev) => ({
      ...prev,
      offers: [
        ...prev.offers,
        { label: "", tickets: "1", price: "1.00", is_active: true },
      ],
    }));
  }

  function removeOffer(index: number) {
    setForm((prev) => ({
      ...prev,
      offers: prev.offers.filter((_, i) => i !== index),
    }));
  }

  function updateOffer<K extends keyof OfferFormRow>(
    index: number,
    key: K,
    value: OfferFormRow[K]
  ) {
    setForm((prev) => ({
      ...prev,
      offers: prev.offers.map((offer, i) =>
        i === index ? { ...offer, [key]: value } : offer
      ),
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSuccessMessage("");

    try {
      const ticketPrice = Number(form.ticketPrice);
      const maxTickets = Number(form.maxTickets);

      if (!form.title.trim()) {
        throw new Error("Title is required");
      }

      if (!resolvedSlug) {
        throw new Error("Slug is required");
      }

      if (!Number.isFinite(ticketPrice) || ticketPrice <= 0) {
        throw new Error("Single ticket price must be greater than 0");
      }

      if (!Number.isInteger(maxTickets) || maxTickets <= 0) {
        throw new Error("Max tickets must be greater than 0");
      }

      const offers = form.offers.map((offer, index) => {
        const tickets = Number(offer.tickets);
        const price = Number(offer.price);

        if (!Number.isInteger(tickets) || tickets <= 0) {
          throw new Error(`Offer ${index + 1}: tickets must be a whole number`);
        }

        if (!Number.isFinite(price) || price <= 0) {
          throw new Error(`Offer ${index + 1}: price must be greater than 0`);
        }

        return {
          label: offer.label.trim() || `${tickets} Tickets`,
          tickets,
          price,
          sort_order: index,
          is_active: offer.is_active,
        };
      });

      await createRaffle({
        title: form.title.trim(),
        slug: resolvedSlug,
        description: form.description.trim(),
        image_url: form.imageUrl.trim(),
        ticket_price: ticketPrice,
        max_tickets: maxTickets,
        is_active: true,
        available_colours: [],
        offers,
      });

      setSuccessMessage("Raffle created successfully.");
      setForm(INITIAL_STATE);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ padding: 24, maxWidth: 960, margin: "0 auto" }}>
      <h1>Create raffle</h1>

      <form onSubmit={handleSubmit} style={{ display: "grid", gap: 16 }}>
        <div>
          <label>Title</label>
          <input
            style={styles.input}
            value={form.title}
            onChange={(e) => updateField("title", e.target.value)}
            placeholder="Spring Cash Raffle"
          />
        </div>

        <div>
          <label>Slug</label>
          <input
            style={styles.input}
            value={form.slug}
            onChange={(e) => updateField("slug", e.target.value)}
            placeholder="spring-cash-raffle"
          />
          <div style={styles.helper}>Final slug: {resolvedSlug || "your-slug"}</div>
        </div>

        <div>
          <label>Description</label>
          <textarea
            style={styles.textarea}
            rows={4}
            value={form.description}
            onChange={(e) => updateField("description", e.target.value)}
          />
        </div>

        <div style={styles.grid2}>
          <div>
            <label>Single ticket price (£)</label>
            <input
              style={styles.input}
              type="number"
              min="0"
              step="0.01"
              value={form.ticketPrice}
              onChange={(e) => updateField("ticketPrice", e.target.value)}
            />
          </div>

          <div>
            <label>Max tickets</label>
            <input
              style={styles.input}
              type="number"
              min="1"
              step="1"
              value={form.maxTickets}
              onChange={(e) => updateField("maxTickets", e.target.value)}
            />
          </div>
        </div>

        <div>
          <label>Image URL</label>
          <input
            style={styles.input}
            value={form.imageUrl}
            onChange={(e) => updateField("imageUrl", e.target.value)}
            placeholder="https://..."
          />
        </div>

        <div style={styles.card}>
          <div style={styles.offerHeader}>
            <div>
              <div style={styles.sectionTitle}>Multiple ticket offers</div>
              <div style={styles.sectionDescription}>
                Add bundle prices like 3 tickets for £10 or 10 tickets for £25.
              </div>
            </div>

            <button type="button" onClick={addOffer} style={styles.secondaryButton}>
              + Add offer
            </button>
          </div>

          <div style={styles.offerList}>
            {form.offers.map((offer, index) => (
              <div key={index} style={styles.offerRow}>
                <div>
                  <label>Label</label>
                  <input
                    style={styles.input}
                    value={offer.label}
                    onChange={(e) => updateOffer(index, "label", e.target.value)}
                    placeholder="e.g. 10 Tickets"
                  />
                </div>

                <div>
                  <label>Tickets</label>
                  <input
                    style={styles.input}
                    type="number"
                    min="1"
                    step="1"
                    value={offer.tickets}
                    onChange={(e) => updateOffer(index, "tickets", e.target.value)}
                  />
                </div>

                <div>
                  <label>Price (£)</label>
                  <input
                    style={styles.input}
                    type="number"
                    min="0"
                    step="0.01"
                    value={offer.price}
                    onChange={(e) => updateOffer(index, "price", e.target.value)}
                  />
                </div>

                <label style={styles.checkboxLabel}>
                  <input
                    type="checkbox"
                    checked={offer.is_active}
                    onChange={(e) => updateOffer(index, "is_active", e.target.checked)}
                  />
                  Active
                </label>

                <button
                  type="button"
                  onClick={() => removeOffer(index)}
                  style={styles.removeButton}
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        </div>

        <div>
          <button type="submit" disabled={saving} style={styles.submitButton}>
            {saving ? "Saving..." : "Create raffle"}
          </button>
        </div>

        {error ? <div style={styles.error}>{error}</div> : null}
        {successMessage ? <div style={styles.success}>{successMessage}</div> : null}
      </form>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  grid2: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 16,
  },
  card: {
    background: "#fff",
    border: "1px solid #e5e7eb",
    borderRadius: 12,
    padding: 16,
  },
  input: {
    width: "100%",
    height: 42,
    borderRadius: 8,
    border: "1px solid #d1d5db",
    padding: "0 12px",
    fontSize: 14,
    boxSizing: "border-box",
  },
  textarea: {
    width: "100%",
    borderRadius: 8,
    border: "1px solid #d1d5db",
    padding: 12,
    fontSize: 14,
    boxSizing: "border-box",
  },
  helper: {
    marginTop: 4,
    color: "#6b7280",
    fontSize: 12,
  },
  offerHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 16,
    marginBottom: 12,
    flexWrap: "wrap",
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 700,
    color: "#111827",
  },
  sectionDescription: {
    color: "#6b7280",
    fontSize: 14,
    marginTop: 4,
  },
  offerList: {
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },
  offerRow: {
    border: "1px solid #e5e7eb",
    borderRadius: 10,
    padding: 12,
    display: "grid",
    gridTemplateColumns: "2fr 1fr 1fr auto auto",
    gap: 12,
    alignItems: "end",
  },
  checkboxLabel: {
    display: "flex",
    gap: 8,
    alignItems: "center",
    fontSize: 14,
    fontWeight: 600,
    whiteSpace: "nowrap",
  },
  secondaryButton: {
    height: 40,
    padding: "0 14px",
    borderRadius: 10,
    border: "1px solid #2563eb",
    background: "#eff6ff",
    color: "#2563eb",
    cursor: "pointer",
    fontWeight: 700,
  },
  removeButton: {
    height: 40,
    padding: "0 12px",
    borderRadius: 10,
    border: "1px solid #ef4444",
    background: "#fef2f2",
    color: "#b91c1c",
    cursor: "pointer",
    fontWeight: 700,
  },
  submitButton: {
    height: 44,
    padding: "0 16px",
    borderRadius: 10,
    border: "1px solid #2563eb",
    background: "#2563eb",
    color: "#fff",
    cursor: "pointer",
    fontWeight: 700,
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
