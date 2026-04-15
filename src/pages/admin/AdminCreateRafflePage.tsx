import React, { useMemo, useState } from "react";
import ColourOptionsEditor, {
  ColourOption,
} from "../../../components/admin/ColourOptionsEditor";
import ImageUploadField from "../../../components/admin/ImageUploadField";

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
  status: "draft" | "published" | "archived";
  ticketPrice: string;
  totalTickets: string;
  soldTickets: string;
  heroImageUrl: string;
  backgroundImageUrl: string;
  currencyCode: "GBP" | "USD" | "EUR";
  colourSelectionMode: "manual" | "automatic" | "both";
  numberSelectionMode: "none" | "manual" | "automatic" | "both";
  numberRangeStart: string;
  numberRangeEnd: string;
  colours: ColourOption[];
  offers: OfferFormRow[];
};

const INITIAL_STATE: FormState = {
  title: "",
  description: "",
  slug: "",
  status: "published",
  ticketPrice: "5.00",
  totalTickets: "100",
  soldTickets: "0",
  heroImageUrl: "",
  backgroundImageUrl: "",
  currencyCode: "GBP",
  colourSelectionMode: "both",
  numberSelectionMode: "both",
  numberRangeStart: "1",
  numberRangeEnd: "200",
  colours: [],
  offers: [
    {
      label: "3 Tickets",
      tickets: "3",
      price: "10.00",
      is_active: true,
    },
    {
      label: "10 Tickets",
      tickets: "10",
      price: "25.00",
      is_active: true,
    },
  ],
};

function currencySymbol(code: string) {
  if (code === "USD") return "$";
  if (code === "EUR") return "€";
  return "£";
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function parseAvailableColours(colours: ColourOption[]) {
  return colours
    .filter((c) => c.name.trim())
    .map((c) => c.name.trim().toLowerCase());
}

export default function AdminCreateRafflePage() {
  const [form, setForm] = useState<FormState>(INITIAL_STATE);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const showColours = useMemo(
    () =>
      form.colourSelectionMode === "manual" ||
      form.colourSelectionMode === "both",
    [form.colourSelectionMode]
  );

  const showNumberRange = useMemo(
    () => form.numberSelectionMode !== "none",
    [form.numberSelectionMode]
  );

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
        {
          label: "",
          tickets: "1",
          price: "1.00",
          is_active: true,
        },
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
      const totalTickets = Number(form.totalTickets);
      const soldTickets = Number(form.soldTickets || 0);
      const numberRangeStart =
        form.numberSelectionMode === "none"
          ? null
          : Number(form.numberRangeStart);
      const numberRangeEnd =
        form.numberSelectionMode === "none"
          ? null
          : Number(form.numberRangeEnd);

      if (!form.title.trim()) {
        throw new Error("Title is required");
      }

      if (!resolvedSlug) {
        throw new Error("Slug is required");
      }

      if (!Number.isFinite(ticketPrice) || ticketPrice <= 0) {
        throw new Error("Single ticket price must be greater than 0");
      }

      if (!Number.isInteger(totalTickets) || totalTickets <= 0) {
        throw new Error("Total tickets must be greater than 0");
      }

      if (!Number.isInteger(soldTickets) || soldTickets < 0) {
        throw new Error("Sold tickets cannot be negative");
      }

      if (showNumberRange) {
        if (!Number.isInteger(numberRangeStart) || numberRangeStart! <= 0) {
          throw new Error("Number range start must be a whole number greater than 0");
        }

        if (!Number.isInteger(numberRangeEnd) || numberRangeEnd! <= 0) {
          throw new Error("Number range end must be a whole number greater than 0");
        }

        if (numberRangeEnd! < numberRangeStart!) {
          throw new Error("Number range end must be greater than or equal to start");
        }
      }

      const cleanedOffers = form.offers
        .map((offer, index) => {
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
            is_active: Boolean(offer.is_active),
          };
        });

      const seen = new Set<number>();
      for (const offer of cleanedOffers) {
        if (seen.has(offer.tickets)) {
          throw new Error(`Duplicate offer for ${offer.tickets} tickets`);
        }
        seen.add(offer.tickets);
      }

      const payload = {
        title: form.title.trim(),
        description: form.description.trim(),
        slug: resolvedSlug,
        image_url: form.heroImageUrl || form.backgroundImageUrl || "",
        ticket_price: ticketPrice,
        max_tickets: totalTickets,
        is_active: form.status === "published",
        draw_at: null,
        available_colours: showColours ? parseAvailableColours(form.colours) : [],
        offers: cleanedOffers,
      };

      const res = await fetch("/api/admin?resource=raffles", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify(payload),
      });

      const json = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(json?.error || "Failed to create raffle");
      }

      setSuccessMessage("Raffle created successfully.");
      setForm(INITIAL_STATE);
    } catch (err: any) {
      setError(err.message || "Something went wrong");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <h1 style={styles.heading}>Create raffle</h1>

        <form onSubmit={handleSubmit} style={styles.form}>
          <div style={styles.card}>
            <label style={styles.label}>Title</label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => updateField("title", e.target.value)}
              style={styles.input}
              placeholder="Spring Cash Raffle"
              required
            />
          </div>

          <div style={styles.card}>
            <label style={styles.label}>Description</label>
            <textarea
              value={form.description}
              onChange={(e) => updateField("description", e.target.value)}
              style={styles.textarea}
              rows={4}
              placeholder="Win a cash prize and support the charity."
            />
          </div>

          <div style={styles.grid2}>
            <div style={styles.card}>
              <label style={styles.label}>Slug</label>
              <input
                type="text"
                value={form.slug}
                onChange={(e) => updateField("slug", e.target.value)}
                style={styles.input}
                placeholder="spring-cash-raffle"
              />
              <div style={styles.helperText}>Public URL: /raffles/{resolvedSlug || "your-slug"}</div>
            </div>

            <div style={styles.card}>
              <label style={styles.label}>Status</label>
              <select
                value={form.status}
                onChange={(e) =>
                  updateField("status", e.target.value as FormState["status"])
                }
                style={styles.input}
              >
                <option value="draft">Draft</option>
                <option value="published">Published</option>
                <option value="archived">Archived</option>
              </select>
            </div>
          </div>

          <div style={styles.grid2}>
            <div style={styles.card}>
              <label style={styles.label}>Currency</label>
              <select
                value={form.currencyCode}
                onChange={(e) =>
                  updateField(
                    "currencyCode",
                    e.target.value as FormState["currencyCode"]
                  )
                }
                style={styles.input}
              >
                <option value="GBP">£ GBP</option>
                <option value="USD">$ USD</option>
                <option value="EUR">€ EUR</option>
              </select>
            </div>

            <div style={styles.card}>
              <label style={styles.label}>
                Single ticket price ({currencySymbol(form.currencyCode)})
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.ticketPrice}
                onChange={(e) => updateField("ticketPrice", e.target.value)}
                style={styles.input}
              />
            </div>
          </div>

          <div style={styles.grid2}>
            <div style={styles.card}>
              <label style={styles.label}>Total tickets</label>
              <input
                type="number"
                min="1"
                step="1"
                value={form.totalTickets}
                onChange={(e) => updateField("totalTickets", e.target.value)}
                style={styles.input}
              />
            </div>

            <div style={styles.card}>
              <label style={styles.label}>Sold tickets</label>
              <input
                type="number"
                min="0"
                step="1"
                value={form.soldTickets}
                onChange={(e) => updateField("soldTickets", e.target.value)}
                style={styles.input}
              />
            </div>
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
              {form.offers.length === 0 ? (
                <div style={styles.cardMuted}>
                  No offers added yet. Add one or more bundle offers here.
                </div>
              ) : (
                form.offers.map((offer, index) => (
                  <div key={index} style={styles.offerRow}>
                    <div>
                      <label style={styles.label}>Label</label>
                      <input
                        type="text"
                        value={offer.label}
                        onChange={(e) => updateOffer(index, "label", e.target.value)}
                        style={styles.input}
                        placeholder="e.g. 10 Tickets"
                      />
                    </div>

                    <div>
                      <label style={styles.label}>Tickets</label>
                      <input
                        type="number"
                        min="1"
                        step="1"
                        value={offer.tickets}
                        onChange={(e) => updateOffer(index, "tickets", e.target.value)}
                        style={styles.input}
                      />
                    </div>

                    <div>
                      <label style={styles.label}>
                        Price ({currencySymbol(form.currencyCode)})
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={offer.price}
                        onChange={(e) => updateOffer(index, "price", e.target.value)}
                        style={styles.input}
                      />
                    </div>

                    <label style={styles.checkboxLabel}>
                      <input
                        type="checkbox"
                        checked={offer.is_active}
                        onChange={(e) =>
                          updateOffer(index, "is_active", e.target.checked)
                        }
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
                ))
              )}
            </div>
          </div>

          <div style={styles.grid2}>
            <div style={styles.card}>
              <label style={styles.label}>Colour selection</label>
              <select
                value={form.colourSelectionMode}
                onChange={(e) =>
                  updateField(
                    "colourSelectionMode",
                    e.target.value as FormState["colourSelectionMode"]
                  )
                }
                style={styles.input}
              >
                <option value="manual">Customer chooses</option>
                <option value="automatic">Automatic</option>
                <option value="both">Customer chooses or automatic</option>
              </select>
            </div>

            <div style={styles.card}>
              <label style={styles.label}>Number selection</label>
              <select
                value={form.numberSelectionMode}
                onChange={(e) =>
                  updateField(
                    "numberSelectionMode",
                    e.target.value as FormState["numberSelectionMode"]
                  )
                }
                style={styles.input}
              >
                <option value="none">No numbers</option>
                <option value="manual">Customer chooses</option>
                <option value="automatic">Automatic</option>
                <option value="both">Customer chooses or automatic</option>
              </select>
            </div>
          </div>

          {showNumberRange ? (
            <div style={styles.grid2}>
              <div style={styles.card}>
                <label style={styles.label}>Number range start</label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={form.numberRangeStart}
                  onChange={(e) => updateField("numberRangeStart", e.target.value)}
                  style={styles.input}
                />
              </div>

              <div style={styles.card}>
                <label style={styles.label}>Number range end</label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={form.numberRangeEnd}
                  onChange={(e) => updateField("numberRangeEnd", e.target.value)}
                  style={styles.input}
                />
              </div>
            </div>
          ) : null}

          {showColours ? (
            <ColourOptionsEditor
              value={form.colours}
              onChange={(next) => updateField("colours", next)}
            />
          ) : (
            <div style={styles.cardMuted}>
              Colour selection is automatic only, so no manual colour list is required.
            </div>
          )}

          <div style={styles.grid2}>
            <div style={styles.card}>
              <ImageUploadField
                label="Hero image"
                value={form.heroImageUrl}
                onChange={(url) => updateField("heroImageUrl", url)}
              />
            </div>

            <div style={styles.card}>
              <ImageUploadField
                label="Background image"
                value={form.backgroundImageUrl}
                onChange={(url) => updateField("backgroundImageUrl", url)}
              />
            </div>
          </div>

          <div style={styles.actions}>
            <button type="submit" disabled={saving} style={styles.submitButton}>
              {saving ? "Saving..." : "Create raffle"}
            </button>
          </div>

          {error ? <div style={styles.error}>{error}</div> : null}
          {successMessage ? (
            <div style={styles.success}>{successMessage}</div>
          ) : null}
        </form>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    padding: 24,
    background: "#f3f4f6",
    minHeight: "100vh",
  },
  container: {
    maxWidth: 980,
    margin: "0 auto",
  },
  heading: {
    marginBottom: 20,
    fontSize: 28,
  },
  form: {
    display: "flex",
    flexDirection: "column",
    gap: 16,
  },
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
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },
  cardMuted: {
    background: "#f9fafb",
    border: "1px solid #e5e7eb",
    borderRadius: 12,
    padding: 16,
    color: "#6b7280",
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
  textarea: {
    borderRadius: 8,
    border: "1px solid #d1d5db",
    padding: 12,
    fontSize: 14,
    resize: "vertical",
  },
  helperText: {
    color: "#6b7280",
    fontSize: 12,
    marginTop: 4,
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
  actions: {
    display: "flex",
    justifyContent: "flex-end",
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
