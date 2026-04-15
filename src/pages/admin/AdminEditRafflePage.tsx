import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { createRaffle } from "../../api";

type OfferFormRow = {
  label: string;
  ticket_quantity: number;
  price_cents: number;
  sort_order: number;
  is_active: boolean;
};

type FormState = {
  tenantSlug: string;
  title: string;
  description: string;
  slug: string;
  status: "draft" | "published";
  currencyCode: string;
  ticketPrice: string;
  totalTickets: number;
  soldTickets: number;
  colourSelectionMode: string;
  numberSelectionMode: string;
  numberRangeStart: number;
  numberRangeEnd: number;
  colours: { name: string; hex: string }[];
  heroImageUrl: string;
  backgroundImageUrl: string;
};

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function poundsToCents(value: string | number) {
  const n = typeof value === "number" ? value : Number(value);
  return Math.round(n * 100);
}

function centsToPounds(cents: number) {
  return (cents / 100).toFixed(2);
}

const quickColours = [
  { name: "Red", hex: "#ef4444" },
  { name: "Blue", hex: "#3b82f6" },
  { name: "Green", hex: "#22c55e" },
  { name: "Yellow", hex: "#eab308" },
  { name: "Purple", hex: "#a855f7" },
  { name: "Pink", hex: "#ec4899" },
  { name: "Black", hex: "#111827" },
  { name: "White", hex: "#ffffff" },
];

export default function AdminCreateRafflePage() {
  const navigate = useNavigate();

  const [form, setForm] = useState<FormState>({
    tenantSlug: "default",
    title: "",
    description: "",
    slug: "",
    status: "published",
    currencyCode: "GBP",
    ticketPrice: "5.00",
    totalTickets: 100,
    soldTickets: 0,
    colourSelectionMode: "customer_or_auto",
    numberSelectionMode: "customer_or_auto",
    numberRangeStart: 1,
    numberRangeEnd: 200,
    colours: [],
    heroImageUrl: "",
    backgroundImageUrl: "",
  });

  const [offers, setOffers] = useState<OfferFormRow[]>([
    {
      label: "3 Tickets",
      ticket_quantity: 3,
      price_cents: 1000,
      sort_order: 0,
      is_active: true,
    },
    {
      label: "10 Tickets",
      ticket_quantity: 10,
      price_cents: 2500,
      sort_order: 1,
      is_active: true,
    },
  ]);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const resolvedSlug = useMemo(() => {
    return form.slug.trim() || slugify(form.title);
  }, [form.slug, form.title]);

  function updateForm<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function addColour(colour: { name: string; hex: string }) {
    setForm((prev) => {
      if (prev.colours.some((c) => c.name === colour.name && c.hex === colour.hex)) {
        return prev;
      }
      return { ...prev, colours: [...prev.colours, colour] };
    });
  }

  function removeColour(index: number) {
    setForm((prev) => ({
      ...prev,
      colours: prev.colours.filter((_, i) => i !== index),
    }));
  }

  function addOffer() {
    setOffers((prev) => [
      ...prev,
      {
        label: "",
        ticket_quantity: 1,
        price_cents: 100,
        sort_order: prev.length,
        is_active: true,
      },
    ]);
  }

  function removeOffer(index: number) {
    setOffers((prev) =>
      prev
        .filter((_, i) => i !== index)
        .map((offer, i) => ({ ...offer, sort_order: i }))
    );
  }

  function updateOffer<K extends keyof OfferFormRow>(
    index: number,
    key: K,
    value: OfferFormRow[K]
  ) {
    setOffers((prev) =>
      prev.map((offer, i) =>
        i === index ? { ...offer, [key]: value } : offer
      )
    );
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");

    try {
      const payload = {
        tenant_slug: form.tenantSlug.trim() || "default",
        title: form.title.trim(),
        slug: resolvedSlug,
        description: form.description.trim(),
        image_url: form.heroImageUrl.trim(),
        ticket_price_cents: poundsToCents(form.ticketPrice),
        total_tickets: Number(form.totalTickets),
        status: form.status,
        sold_tickets: Number(form.soldTickets),
        currency_code: form.currencyCode,
        background_image_url: form.backgroundImageUrl.trim(),
        colour_selection_mode: form.colourSelectionMode,
        number_selection_mode: form.numberSelectionMode,
        number_range_start: Number(form.numberRangeStart),
        number_range_end: Number(form.numberRangeEnd),
        colours: form.colours,
        offers: offers.map((offer, index) => ({
          label: offer.label.trim() || null,
          ticket_quantity: Number(offer.ticket_quantity),
          price_cents: Number(offer.price_cents),
          sort_order: index,
          is_active: Boolean(offer.is_active),
        })),
      };

      if (!payload.title) throw new Error("Title is required");
      if (!payload.slug) throw new Error("Slug is required");
      if (
        !Number.isInteger(payload.ticket_price_cents) ||
        payload.ticket_price_cents <= 0
      ) {
        throw new Error("Single ticket price must be greater than 0");
      }

      for (const offer of payload.offers) {
        if (!Number.isInteger(offer.ticket_quantity) || offer.ticket_quantity <= 0) {
          throw new Error("Offer ticket quantities must be whole numbers");
        }
        if (!Number.isInteger(offer.price_cents) || offer.price_cents <= 0) {
          throw new Error("Offer prices must be greater than 0");
        }
      }

      const seen = new Set<number>();
      for (const offer of payload.offers) {
        if (seen.has(offer.ticket_quantity)) {
          throw new Error(`Duplicate offer for ${offer.ticket_quantity} tickets`);
        }
        seen.add(offer.ticket_quantity);
      }

      const result = await createRaffle(payload as any);
      const createdSlug = result?.raffle?.slug || payload.slug;
      navigate(`/admin/raffles/${createdSlug}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create raffle");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main style={styles.page}>
      <div style={styles.container}>
        <h1 style={styles.pageTitle}>Edit raffle</h1>

        <form onSubmit={onSubmit} style={styles.form}>
          <div style={styles.card}>
            <label style={styles.label}>Title</label>
            <input
              style={styles.input}
              value={form.title}
              onChange={(e) => updateForm("title", e.target.value)}
            />
          </div>

          <div style={styles.card}>
            <label style={styles.label}>Description</label>
            <textarea
              style={styles.textarea}
              value={form.description}
              onChange={(e) => updateForm("description", e.target.value)}
            />
          </div>

          <div style={styles.grid2}>
            <div style={styles.card}>
              <label style={styles.label}>Slug</label>
              <input
                style={styles.input}
                value={form.slug}
                onChange={(e) => updateForm("slug", e.target.value)}
              />
              <div style={styles.helper}>Public URL: /raffles/{resolvedSlug || "your-raffle-slug"}</div>
            </div>

            <div style={styles.card}>
              <label style={styles.label}>Status</label>
              <select
                style={styles.input}
                value={form.status}
                onChange={(e) => updateForm("status", e.target.value as "draft" | "published")}
              >
                <option value="published">Published</option>
                <option value="draft">Draft</option>
              </select>
            </div>
          </div>

          <div style={styles.grid2}>
            <div style={styles.card}>
              <label style={styles.label}>Currency</label>
              <select
                style={styles.input}
                value={form.currencyCode}
                onChange={(e) => updateForm("currencyCode", e.target.value)}
              >
                <option value="GBP">£ GBP</option>
              </select>
            </div>

            <div style={styles.card}>
              <label style={styles.label}>Single ticket price (£)</label>
              <input
                style={styles.input}
                type="number"
                step="0.01"
                value={form.ticketPrice}
                onChange={(e) => updateForm("ticketPrice", e.target.value)}
              />
            </div>
          </div>

          <div style={styles.grid2}>
            <div style={styles.card}>
              <label style={styles.label}>Total tickets</label>
              <input
                style={styles.input}
                type="number"
                value={form.totalTickets}
                onChange={(e) => updateForm("totalTickets", Number(e.target.value))}
              />
            </div>

            <div style={styles.card}>
              <label style={styles.label}>Sold tickets</label>
              <input
                style={styles.input}
                type="number"
                value={form.soldTickets}
                onChange={(e) => updateForm("soldTickets", Number(e.target.value))}
              />
            </div>
          </div>

          <div style={styles.grid2}>
            <div style={styles.card}>
              <label style={styles.label}>Colour selection</label>
              <select
                style={styles.input}
                value={form.colourSelectionMode}
                onChange={(e) => updateForm("colourSelectionMode", e.target.value)}
              >
                <option value="customer_or_auto">Customer chooses or automatic</option>
                <option value="customer_only">Customer chooses only</option>
                <option value="auto_only">Automatic only</option>
              </select>
            </div>

            <div style={styles.card}>
              <label style={styles.label}>Number selection</label>
              <select
                style={styles.input}
                value={form.numberSelectionMode}
                onChange={(e) => updateForm("numberSelectionMode", e.target.value)}
              >
                <option value="customer_or_auto">Customer chooses or automatic</option>
                <option value="customer_only">Customer chooses only</option>
                <option value="auto_only">Automatic only</option>
              </select>
            </div>
          </div>

          <div style={styles.grid2}>
            <div style={styles.card}>
              <label style={styles.label}>Number range start</label>
              <input
                style={styles.input}
                type="number"
                value={form.numberRangeStart}
                onChange={(e) => updateForm("numberRangeStart", Number(e.target.value))}
              />
            </div>

            <div style={styles.card}>
              <label style={styles.label}>Number range end</label>
              <input
                style={styles.input}
                type="number"
                value={form.numberRangeEnd}
                onChange={(e) => updateForm("numberRangeEnd", Number(e.target.value))}
              />
            </div>
          </div>

          <div style={styles.card}>
            <div style={styles.sectionHeader}>
              <div>
                <div style={styles.sectionTitle}>Multiple ticket offers</div>
                <div style={styles.sectionSubtext}>
                  Add bundle pricing like 3 tickets for £10 or 10 tickets for £25.
                </div>
              </div>
              <button type="button" onClick={addOffer} style={styles.primarySmallButton}>
                + Add offer
              </button>
            </div>

            <div style={{ display: "grid", gap: 12 }}>
              {offers.map((offer, index) => (
                <div key={index} style={styles.offerRow}>
                  <div>
                    <label style={styles.label}>Label</label>
                    <input
                      style={styles.input}
                      value={offer.label}
                      onChange={(e) => updateOffer(index, "label", e.target.value)}
                      placeholder="e.g. 10 Tickets"
                    />
                  </div>

                  <div>
                    <label style={styles.label}>Tickets</label>
                    <input
                      style={styles.input}
                      type="number"
                      min={1}
                      value={offer.ticket_quantity}
                      onChange={(e) =>
                        updateOffer(index, "ticket_quantity", Number(e.target.value))
                      }
                    />
                  </div>

                  <div>
                    <label style={styles.label}>Bundle price (£)</label>
                    <input
                      style={styles.input}
                      type="number"
                      min={0}
                      step="0.01"
                      value={centsToPounds(offer.price_cents)}
                      onChange={(e) =>
                        updateOffer(index, "price_cents", poundsToCents(e.target.value))
                      }
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
                    style={styles.secondarySmallButton}
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div style={styles.card}>
            <div style={styles.sectionHeader}>
              <div>
                <div style={styles.sectionTitle}>Colours</div>
                <div style={styles.sectionSubtext}>
                  Add colour names and pick shades visually.
                </div>
              </div>
              <button type="button" style={styles.primarySmallButton}>
                + Add colour
              </button>
            </div>

            <div style={styles.quickAddLabel}>Quick add</div>
            <div style={styles.quickColourRow}>
              {quickColours.map((colour) => (
                <button
                  key={colour.name}
                  type="button"
                  onClick={() => addColour(colour)}
                  style={styles.quickColourButton}
                >
                  <span
                    style={{
                      ...styles.quickColourDot,
                      background: colour.hex,
                      border: colour.hex === "#ffffff" ? "1px solid #cbd5e1" : "none",
                    }}
                  />
                  {colour.name}
                </button>
              ))}
            </div>

            {form.colours.length === 0 ? (
              <div style={styles.helper}>No colours yet. Add one or use a preset.</div>
            ) : (
              <div style={styles.selectedColours}>
                {form.colours.map((colour, index) => (
                  <div key={`${colour.name}-${index}`} style={styles.selectedColourTag}>
                    <span
                      style={{
                        ...styles.quickColourDot,
                        background: colour.hex,
                        border: colour.hex === "#ffffff" ? "1px solid #cbd5e1" : "none",
                      }}
                    />
                    {colour.name}
                    <button
                      type="button"
                      onClick={() => removeColour(index)}
                      style={styles.removeColourButton}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={styles.grid2}>
            <div style={styles.card}>
              <label style={styles.label}>Hero image</label>
              <div style={styles.uploadBox}>
                {form.heroImageUrl ? "Image URL added" : "No image uploaded"}
              </div>
              <input
                style={styles.input}
                placeholder="Paste hero image URL"
                value={form.heroImageUrl}
                onChange={(e) => updateForm("heroImageUrl", e.target.value)}
              />
            </div>

            <div style={styles.card}>
              <label style={styles.label}>Background image</label>
              <div style={styles.uploadBox}>
                {form.backgroundImageUrl ? "Image URL added" : "No image uploaded"}
              </div>
              <input
                style={styles.input}
                placeholder="Paste background image URL"
                value={form.backgroundImageUrl}
                onChange={(e) => updateForm("backgroundImageUrl", e.target.value)}
              />
            </div>
          </div>

          {error ? <div style={styles.errorBox}>{error}</div> : null}

          <div style={styles.footerActions}>
            <button type="submit" style={styles.primaryButton} disabled={saving}>
              {saving ? "Saving..." : "Save changes"}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    background: "#f3f4f6",
    padding: "24px 16px 40px",
  },
  container: {
    maxWidth: 900,
    margin: "0 auto",
  },
  pageTitle: {
    fontSize: 22,
    fontWeight: 700,
    margin: "0 0 12px",
  },
  form: {
    display: "grid",
    gap: 16,
  },
  grid2: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 16,
  },
  card: {
    background: "#ffffff",
    border: "1px solid #d7dce5",
    borderRadius: 12,
    padding: 16,
  },
  label: {
    display: "block",
    fontSize: 12,
    fontWeight: 700,
    marginBottom: 8,
  },
  input: {
    width: "100%",
    boxSizing: "border-box",
    border: "1px solid #cbd5e1",
    borderRadius: 8,
    padding: "10px 12px",
    fontSize: 14,
    background: "#fff",
  },
  textarea: {
    width: "100%",
    minHeight: 120,
    boxSizing: "border-box",
    border: "1px solid #cbd5e1",
    borderRadius: 8,
    padding: "10px 12px",
    fontSize: 14,
    resize: "vertical",
    background: "#fff",
  },
  helper: {
    marginTop: 8,
    fontSize: 12,
    color: "#64748b",
  },
  sectionHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 700,
  },
  sectionSubtext: {
    marginTop: 4,
    fontSize: 12,
    color: "#64748b",
  },
  primarySmallButton: {
    border: "none",
    background: "#2563eb",
    color: "#fff",
    borderRadius: 8,
    padding: "8px 12px",
    fontSize: 12,
    fontWeight: 700,
    cursor: "pointer",
  },
  secondarySmallButton: {
    border: "1px solid #cbd5e1",
    background: "#fff",
    color: "#0f172a",
    borderRadius: 8,
    padding: "10px 12px",
    fontSize: 12,
    fontWeight: 700,
    cursor: "pointer",
  },
  offerRow: {
    display: "grid",
    gridTemplateColumns: "2fr 1fr 1fr auto auto",
    gap: 12,
    alignItems: "end",
    padding: 12,
    border: "1px solid #e5e7eb",
    borderRadius: 10,
  },
  checkboxLabel: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    paddingBottom: 10,
    fontSize: 14,
    fontWeight: 600,
  },
  quickAddLabel: {
    fontSize: 12,
    fontWeight: 700,
    marginBottom: 8,
  },
  quickColourRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 12,
  },
  quickColourButton: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    border: "1px solid #cbd5e1",
    background: "#fff",
    borderRadius: 999,
    padding: "6px 10px",
    fontSize: 12,
    cursor: "pointer",
  },
  quickColourDot: {
    width: 12,
    height: 12,
    borderRadius: 999,
    display: "inline-block",
  },
  selectedColours: {
    display: "flex",
    flexWrap: "wrap",
    gap: 8,
  },
  selectedColourTag: {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    border: "1px solid #cbd5e1",
    background: "#fff",
    borderRadius: 999,
    padding: "6px 10px",
    fontSize: 12,
  },
  removeColourButton: {
    border: "none",
    background: "transparent",
    cursor: "pointer",
    fontSize: 14,
    lineHeight: 1,
    padding: 0,
  },
  uploadBox: {
    height: 90,
    border: "1px dashed #cbd5e1",
    borderRadius: 8,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 12,
    color: "#94a3b8",
    marginBottom: 10,
  },
  errorBox: {
    border: "1px solid #fecaca",
    background: "#fef2f2",
   
