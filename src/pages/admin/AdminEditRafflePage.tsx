import React, { useMemo, useState } from "react";
import { useRouter } from "next/router";
import { createRaffle } from "../../api";

type OfferFormRow = {
  label: string;
  ticket_quantity: number;
  price_cents: number;
  sort_order: number;
  is_active: boolean;
};

type ColourRow = {
  name: string;
  hex: string;
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

export default function AdminCreateRafflePage() {
  const router = useRouter();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [slug, setSlug] = useState("");
  const [status, setStatus] = useState("published");
  const [currencyCode, setCurrencyCode] = useState("GBP");
  const [ticketPrice, setTicketPrice] = useState("5.00");
  const [totalTickets, setTotalTickets] = useState(100);
  const [soldTickets, setSoldTickets] = useState(0);
  const [colourSelectionMode, setColourSelectionMode] = useState(
    "customer_or_automatic"
  );
  const [numberSelectionMode, setNumberSelectionMode] = useState(
    "customer_or_automatic"
  );
  const [numberRangeStart, setNumberRangeStart] = useState(1);
  const [numberRangeEnd, setNumberRangeEnd] = useState(200);
  const [heroImageUrl, setHeroImageUrl] = useState("");
  const [backgroundImageUrl, setBackgroundImageUrl] = useState("");
  const [tenantSlug] = useState("default");

  const [colours, setColours] = useState<ColourRow[]>([]);
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
  const [success, setSuccess] = useState("");

  const resolvedSlug = useMemo(() => {
    return slug.trim() || slugify(title);
  }, [slug, title]);

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
      prev.map((offer, i) => (i === index ? { ...offer, [key]: value } : offer))
    );
  }

  function addQuickColour(name: string, hex: string) {
    setColours((prev) => {
      if (prev.some((c) => c.name === name || c.hex === hex)) return prev;
      return [...prev, { name, hex }];
    });
  }

  function removeColour(index: number) {
    setColours((prev) => prev.filter((_, i) => i !== index));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const payload = {
        tenant_slug: tenantSlug,
        title: title.trim(),
        slug: resolvedSlug,
        description: description.trim(),
        image_url: heroImageUrl.trim() || null,
        ticket_price_cents: poundsToCents(ticketPrice),
        total_tickets: Number(totalTickets),
        status: status.trim(),
        sold_tickets: Number(soldTickets),
        currency_code: currencyCode,
        background_image_url: backgroundImageUrl.trim() || null,
        colour_selection_mode: colourSelectionMode,
        number_selection_mode: numberSelectionMode,
        number_range_start: Number(numberRangeStart),
        number_range_end: Number(numberRangeEnd),
        colours,
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

      if (
        !Number.isInteger(payload.total_tickets) ||
        payload.total_tickets <= 0
      ) {
        throw new Error("Total tickets must be greater than 0");
      }

      if (
        !Number.isInteger(payload.number_range_start) ||
        !Number.isInteger(payload.number_range_end) ||
        payload.number_range_start >= payload.number_range_end
      ) {
        throw new Error("Number range is invalid");
      }

      const seen = new Set<number>();
      for (const offer of payload.offers) {
        if (!Number.isInteger(offer.ticket_quantity) || offer.ticket_quantity <= 0) {
          throw new Error("Offer ticket quantities must be whole numbers");
        }
        if (!Number.isInteger(offer.price_cents) || offer.price_cents <= 0) {
          throw new Error("Offer prices must be greater than 0");
        }
        if (seen.has(offer.ticket_quantity)) {
          throw new Error(`Duplicate offer for ${offer.ticket_quantity} tickets`);
        }
        seen.add(offer.ticket_quantity);
      }

      const result = await createRaffle(payload as any);

      setSuccess("Raffle created");

      if (result?.raffle?.slug) {
        router.push(`/admin/raffles/${result.raffle.slug}`);
        return;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create raffle");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main style={styles.page}>
      <div style={styles.container}>
        <h1 style={styles.title}>Edit raffle</h1>

        <form onSubmit={onSubmit} style={styles.form}>
          <div style={styles.card}>
            <label style={styles.label}>Title</label>
            <input
              style={styles.input}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div style={styles.card}>
            <label style={styles.label}>Description</label>
            <textarea
              style={styles.textarea}
              rows={5}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div style={styles.grid2}>
            <div style={styles.card}>
              <label style={styles.label}>Slug</label>
              <input
                style={styles.input}
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder="your-raffle-slug"
              />
              <div style={styles.help}>Public URL: /raffles/{resolvedSlug || "your-raffle-slug"}</div>
            </div>

            <div style={styles.card}>
              <label style={styles.label}>Status</label>
              <select
                style={styles.select}
                value={status}
                onChange={(e) => setStatus(e.target.value)}
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
                style={styles.select}
                value={currencyCode}
                onChange={(e) => setCurrencyCode(e.target.value)}
              >
                <option value="GBP">£ GBP</option>
                <option value="USD">$ USD</option>
                <option value="EUR">€ EUR</option>
              </select>
            </div>

            <div style={styles.card}>
              <label style={styles.label}>Single ticket price (£)</label>
              <input
                style={styles.input}
                type="number"
                step="0.01"
                value={ticketPrice}
                onChange={(e) => setTicketPrice(e.target.value)}
              />
            </div>
          </div>

          <div style={styles.grid2}>
            <div style={styles.card}>
              <label style={styles.label}>Total tickets</label>
              <input
                style={styles.input}
                type="number"
                value={totalTickets}
                onChange={(e) => setTotalTickets(Number(e.target.value))}
              />
            </div>

            <div style={styles.card}>
              <label style={styles.label}>Sold tickets</label>
              <input
                style={styles.input}
                type="number"
                value={soldTickets}
                onChange={(e) => setSoldTickets(Number(e.target.value))}
              />
            </div>
          </div>

          <div style={styles.grid2}>
            <div style={styles.card}>
              <label style={styles.label}>Colour selection</label>
              <select
                style={styles.select}
                value={colourSelectionMode}
                onChange={(e) => setColourSelectionMode(e.target.value)}
              >
                <option value="customer_or_automatic">
                  Customer chooses or automatic
                </option>
                <option value="automatic_only">Automatic only</option>
              </select>
            </div>

            <div style={styles.card}>
              <label style={styles.label}>Number selection</label>
              <select
                style={styles.select}
                value={numberSelectionMode}
                onChange={(e) => setNumberSelectionMode(e.target.value)}
              >
                <option value="customer_or_automatic">
                  Customer chooses or automatic
                </option>
                <option value="automatic_only">Automatic only</option>
              </select>
            </div>
          </div>

          <div style={styles.grid2}>
            <div style={styles.card}>
              <label style={styles.label}>Number range start</label>
              <input
                style={styles.input}
                type="number"
                value={numberRangeStart}
                onChange={(e) => setNumberRangeStart(Number(e.target.value))}
              />
            </div>

            <div style={styles.card}>
              <label style={styles.label}>Number range end</label>
              <input
                style={styles.input}
                type="number"
                value={numberRangeEnd}
                onChange={(e) => setNumberRangeEnd(Number(e.target.value))}
              />
            </div>
          </div>

          <div style={styles.card}>
            <div style={styles.cardHeader}>
              <div>
                <div style={styles.sectionTitle}>Colours</div>
                <div style={styles.help}>Add colour names and pick shades visually.</div>
              </div>
              <button
                type="button"
                style={styles.secondaryButton}
                onClick={() => addQuickColour(`Colour ${colours.length + 1}`, "#000000")}
              >
                + Add colour
              </button>
            </div>

            <div style={styles.helpStrong}>Quick add</div>

            <div style={styles.chips}>
              <button type="button" style={styles.chip} onClick={() => addQuickColour("Red", "#ef4444")}>
                <span style={{ ...styles.dot, background: "#ef4444" }} /> Red
              </button>
              <button type="button" style={styles.chip} onClick={() => addQuickColour("Blue", "#3b82f6")}>
                <span style={{ ...styles.dot, background: "#3b82f6" }} /> Blue
              </button>
              <button type="button" style={styles.chip} onClick={() => addQuickColour("Green", "#22c55e")}>
                <span style={{ ...styles.dot, background: "#22c55e" }} /> Green
              </button>
              <button type="button" style={styles.chip} onClick={() => addQuickColour("Yellow", "#eab308")}>
                <span style={{ ...styles.dot, background: "#eab308" }} /> Yellow
              </button>
              <button type="button" style={styles.chip} onClick={() => addQuickColour("Purple", "#a855f7")}>
                <span style={{ ...styles.dot, background: "#a855f7" }} /> Purple
              </button>
              <button type="button" style={styles.chip} onClick={() => addQuickColour("Pink", "#ec4899")}>
                <span style={{ ...styles.dot, background: "#ec4899" }} /> Pink
              </button>
              <button type="button" style={styles.chip} onClick={() => addQuickColour("Black", "#111827")}>
                <span style={{ ...styles.dot, background: "#111827" }} /> Black
              </button>
              <button type="button" style={styles.chip} onClick={() => addQuickColour("White", "#ffffff")}>
                <span style={{ ...styles.dot, background: "#ffffff", border: "1px solid #cbd5e1" }} /> White
              </button>
            </div>

            {colours.length > 0 ? (
              <div style={styles.colourList}>
                {colours.map((colour, index) => (
                  <div key={`${colour.name}-${index}`} style={styles.colourRow}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ ...styles.dotLarge, background: colour.hex }} />
                      <div>
                        <div style={styles.colourName}>{colour.name}</div>
                        <div style={styles.help}>{colour.hex}</div>
                      </div>
                    </div>
                    <button
                      type="button"
                      style={styles.removeTextButton}
                      onClick={() => removeColour(index)}
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div style={styles.help}>No colours yet. Add one or use a preset.</div>
            )}
          </div>

          <div style={styles.card}>
            <div style={styles.cardHeader}>
              <div>
                <div style={styles.sectionTitle}>Multiple ticket offers</div>
                <div style={styles.help}>
                  Add bundle pricing like 3 tickets for £10 or 10 tickets for £25.
                </div>
              </div>
              <button type="button" style={styles.secondaryButton} onClick={addOffer}>
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
                    style={styles.secondaryButton}
                    onClick={() => removeOffer(index)}
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div style={styles.grid2}>
            <div style={styles.card}>
              <label style={styles.label}>Hero image</label>
              <div style={styles.uploadBox}>
                {heroImageUrl ? "Image URL added" : "No image uploaded"}
              </div>
              <input
                style={styles.input}
                value={heroImageUrl}
                onChange={(e) => setHeroImageUrl(e.target.value)}
                placeholder="Paste hero image URL"
              />
            </div>

            <div style={styles.card}>
              <label style={styles.label}>Background image</label>
              <div style={styles.uploadBox}>
                {backgroundImageUrl ? "Image URL added" : "No image uploaded"}
              </div>
              <input
                style={styles.input}
                value={backgroundImageUrl}
                onChange={(e) => setBackgroundImageUrl(e.target.value)}
                placeholder="Paste background image URL"
              />
            </div>
          </div>

          <div style={styles.actions}>
            <button type="submit" style={styles.primaryButton} disabled={saving}>
              {saving ? "Saving..." : "Save changes"}
            </button>
          </div>

          {success ? <div style={styles.success}>{success}</div> : null}
          {error ? <div style={styles.error}>{error}</div> : null}
        </form>
      </div>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    background: "#f3f4f6",
    padding: "24px 16px",
  },
  container: {
    maxWidth: 930,
    margin: "0 auto",
  },
  title: {
    margin: "0 0 12px",
    fontSize: 42,
    lineHeight: 1.1,
    fontWeight: 800,
    color: "#111827",
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
    borderRadius: 16,
    padding: 16,
  },
  cardHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 16,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 700,
    color: "#111827",
  },
  label: {
    display: "block",
    marginBottom: 8,
    fontSize: 14,
    fontWeight: 700,
    color: "#111827",
  },
  input: {
    width: "100%",
    height: 44,
    borderRadius: 10,
    border: "1px solid #cbd5e1",
    padding: "0 12px",
    fontSize: 14,
    background: "#ffffff",
    color: "#111827",
    boxSizing: "border-box",
  },
  textarea: {
    width: "100%",
    borderRadius: 10,
    border: "1px solid #cbd5e1",
    padding: 12,
    fontSize: 14,
    background: "#ffffff",
    color: "#111827",
    boxSizing: "border-box",
    resize: "vertical",
  },
  select: {
    width: "100%",
    height: 44,
    borderRadius: 10,
    border: "1px solid #cbd5e1",
    padding: "0 12px",
    fontSize: 14,
    background: "#ffffff",
    color: "#111827",
    boxSizing: "border-box",
  },
  help: {
    marginTop: 8,
    color: "#6b7280",
    fontSize: 12,
    lineHeight: 1.4,
  },
  helpStrong: {
    marginBottom: 8,
    color: "#111827",
    fontSize: 13,
    fontWeight: 700,
  },
  chips: {
    display: "flex",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 12,
  },
  chip: {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    border: "1px solid #d7dce5",
    background: "#ffffff",
    color: "#111827",
    borderRadius: 999,
    padding: "8px 12px",
    fontWeight: 600,
    cursor: "pointer",
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 999,
    display: "inline-block",
  },
  dotLarge: {
    width: 18,
    height: 18,
    borderRadius: 999,
    display: "inline-block",
    border: "1px solid #cbd5e1",
  },
  colourList: {
    display: "grid",
    gap: 10,
    marginTop: 8,
  },
  colourRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 10,
    borderRadius: 12,
    border: "1px solid #e5e7eb",
    background: "#f9fafb",
  },
  colourName: {
    fontWeight: 700,
    color: "#111827",
  },
  removeTextButton: {
    background: "transparent",
    border: "none",
    color: "#dc2626",
    fontWeight: 700,
    cursor: "pointer",
  },
  secondaryButton: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    border: "1px solid #cbd5e1",
    background: "#ffffff",
    color: "#111827",
    borderRadius: 10,
    padding: "10px 14px",
    fontWeight: 700,
    cursor: "pointer",
    whiteSpace: "nowrap",
  },
  offerRow: {
    display: "grid",
    gridTemplateColumns: "2fr 1fr 1fr auto auto",
    gap: 12,
    alignItems: "end",
    padding: 12,
    border: "1px solid #e5e7eb",
    borderRadius: 12,
    background: "#f9fafb",
  },
  checkboxLabel: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    fontWeight: 700,
    color: "#111827",
    paddingBottom: 10,
  },
  uploadBox: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 120,
    borderRadius: 12,
    border: "1px dashed #cbd5e1",
    background: "#f9fafb",
    color: "#6b7280",
    fontSize: 13,
    marginBottom: 10,
  },
  actions: {
    display: "flex",
    justifyContent: "flex-end",
  },
  primaryButton: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    border: "none",
    background: "#2563eb",
    color: "#ffffff",
    borderRadius: 10,
    padding: "12px 16px",
    fontWeight: 800,
    cursor: "pointer",
  },
  success: {
    border: "1px solid #86efac",
    background: "#f0fdf4",
    color: "#166534",
    borderRadius: 12,
    padding: 12,
  },
  error: {
    border: "1px solid #fca5a5",
    background: "#fef2f2",
    color: "#b91c1c",
    borderRadius: 12,
    padding: 12,
  },
};
