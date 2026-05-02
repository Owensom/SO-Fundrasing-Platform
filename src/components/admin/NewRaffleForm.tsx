"use client";

import { useEffect, useMemo, useState } from "react";

type Props = {
  tenantSlug: string;
};

type OfferRow = {
  id: string;
  label: string;
  price: string;
  quantity: string;
  is_active: boolean;
  sort_order: number;
};

type PrizeRow = {
  id: string;
  position: string;
  title: string;
  description: string;
  is_public: boolean;
};

const PRESET_COLOURS = [
  "Red",
  "Blue",
  "Green",
  "Yellow",
  "Orange",
  "Purple",
  "Pink",
  "Black",
  "White",
  "Gold",
  "Silver",
];

const IMAGE_POSITIONS = [
  { value: "center", label: "Center" },
  { value: "top", label: "Top" },
  { value: "bottom", label: "Bottom" },
  { value: "left", label: "Left" },
  { value: "right", label: "Right" },
];

function safeId(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function makeOffer(id: string, label = "", price = "", quantity = ""): OfferRow {
  return {
    id,
    label,
    price,
    quantity,
    is_active: true,
    sort_order: 0,
  };
}

function makePrize(
  id: string,
  position = "1",
  title = "",
  description = "",
): PrizeRow {
  return {
    id,
    position,
    title,
    description,
    is_public: true,
  };
}

function toInt(value: string, fallback: number) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.floor(n) : fallback;
}

export default function NewRaffleForm({ tenantSlug }: Props) {
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const [drawAt, setDrawAt] = useState("");

  const [imageUrl, setImageUrl] = useState("");
  const [imagePosition, setImagePosition] = useState("center");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");

  const [startNumber, setStartNumber] = useState("1");
  const [endNumber, setEndNumber] = useState("10");

  const [selectedColours, setSelectedColours] = useState<string[]>([
    "Red",
    "Blue",
  ]);
  const [customColour, setCustomColour] = useState("");

  const [questionText, setQuestionText] = useState("");
  const [questionAnswer, setQuestionAnswer] = useState("");

  const [offers, setOffers] = useState<OfferRow[]>([
    makeOffer("offer-1", "3 for 12", "12", "3"),
    makeOffer("offer-2", "5 for 18", "18", "5"),
  ]);

  const [prizes, setPrizes] = useState<PrizeRow[]>([
    makePrize("prize-1", "1", "", ""),
  ]);

  useEffect(() => {
    if (!slugEdited) {
      setSlug(slugify(title));
    }
  }, [title, slugEdited]);

  const coloursValue = useMemo(
    () => selectedColours.join(","),
    [selectedColours],
  );

  const offersValue = useMemo(() => {
    const clean = offers
      .map((offer, index) => ({
        id: offer.id,
        label: offer.label.trim(),
        price: Number(offer.price),
        quantity: Number(offer.quantity),
        tickets: Number(offer.quantity),
        is_active: Boolean(offer.is_active),
        sort_order: index,
      }))
      .filter(
        (offer) =>
          offer.label &&
          Number.isFinite(offer.price) &&
          offer.price > 0 &&
          Number.isFinite(offer.quantity) &&
          offer.quantity > 0,
      );

    return JSON.stringify(clean);
  }, [offers]);

  const prizesValue = useMemo(() => {
    const clean = prizes
      .map((prize, index) => {
        const position = Number(prize.position);

        return {
          id: prize.id,
          position:
            Number.isFinite(position) && position > 0
              ? Math.floor(position)
              : index + 1,
          title: prize.title.trim(),
          name: prize.title.trim(),
          description: prize.description.trim(),
          isPublic: Boolean(prize.is_public),
          is_public: Boolean(prize.is_public),
          sortOrder: index,
          sort_order: index,
        };
      })
      .filter((prize) => prize.title);

    return JSON.stringify(clean);
  }, [prizes]);

  const questionValue = useMemo(() => {
    const text = questionText.trim();
    const answer = questionAnswer.trim();

    if (!text || !answer) return "";

    return JSON.stringify({
      text,
      answer,
    });
  }, [questionText, questionAnswer]);

  const numbersPerColour = useMemo(() => {
    const start = toInt(startNumber, 1);
    const end = toInt(endNumber, 1);
    return end >= start ? end - start + 1 : 0;
  }, [startNumber, endNumber]);

  const totalTickets = useMemo(() => {
    return numbersPerColour * selectedColours.length;
  }, [numbersPerColour, selectedColours.length]);

  const validOffersCount = useMemo(() => {
    try {
      return JSON.parse(offersValue).length;
    } catch {
      return 0;
    }
  }, [offersValue]);

  const publicPrizesCount = useMemo(() => {
    return prizes.filter((prize) => prize.title.trim() && prize.is_public).length;
  }, [prizes]);

  function toggleColour(colour: string) {
    setSelectedColours((current) =>
      current.includes(colour)
        ? current.filter((item) => item !== colour)
        : [...current, colour],
    );
  }

  function addCustomColour() {
    const value = customColour.trim();
    if (!value) return;

    setSelectedColours((current) =>
      current.includes(value) ? current : [...current, value],
    );
    setCustomColour("");
  }

  function updateOffer(id: string, patch: Partial<OfferRow>) {
    setOffers((current) =>
      current.map((offer) =>
        offer.id === id ? { ...offer, ...patch } : offer,
      ),
    );
  }

  function addOffer() {
    setOffers((current) => [...current, makeOffer(safeId("offer"))]);
  }

  function removeOffer(id: string) {
    setOffers((current) => current.filter((offer) => offer.id !== id));
  }

  function updatePrize(id: string, patch: Partial<PrizeRow>) {
    setPrizes((current) =>
      current.map((prize) =>
        prize.id === id ? { ...prize, ...patch } : prize,
      ),
    );
  }

  function addPrize() {
    setPrizes((current) => [
      ...current,
      makePrize(safeId("prize"), String(current.length + 1)),
    ]);
  }

  function removePrize(id: string) {
    setPrizes((current) => current.filter((prize) => prize.id !== id));
  }

  async function handleImageUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setUploading(true);
      setUploadError("");

      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/admin/uploads", {
        method: "POST",
        body: formData,
      });

      const text = await response.text();

      let parsed: { ok?: boolean; url?: string; error?: string } | null = null;

      try {
        parsed = JSON.parse(text);
      } catch {
        throw new Error(`Upload API did not return JSON: ${text.slice(0, 120)}`);
      }

      if (!response.ok || !parsed?.ok) {
        throw new Error(parsed?.error || "Upload failed");
      }

      setImageUrl(String(parsed.url ?? ""));
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : "Upload failed");
    } finally {
      setUploading(false);
      event.target.value = "";
    }
  }

  return (
    <form action="/api/admin/raffles" method="post" style={styles.form}>
      <input type="hidden" name="tenantSlug" value={tenantSlug} />
      <input type="hidden" name="image_url" value={imageUrl} />
      <input type="hidden" name="image_position" value={imagePosition} />
      <input type="hidden" name="colours" value={coloursValue} />
      <input type="hidden" name="offers" value={offersValue} />
      <input type="hidden" name="prizes" value={prizesValue} />
      <input type="hidden" name="question" value={questionValue} />
      <input type="hidden" name="total_tickets" value={String(totalTickets)} />

      <section style={styles.hero}>
        <div>
          <div style={styles.eyebrow}>Create raffle</div>
          <h2 style={styles.heroTitle}>Build a new raffle</h2>
          <p style={styles.heroText}>
            Set the public details, ticket range, colours, offers, prizes and
            optional legal entry question.
          </p>
        </div>

        <div style={styles.tenantPill}>Tenant: {tenantSlug}</div>
      </section>

      <section style={styles.summaryGrid}>
        <SummaryCard label="Total tickets" value={totalTickets} />
        <SummaryCard label="Numbers / colour" value={numbersPerColour} />
        <SummaryCard label="Colours" value={selectedColours.length} />
        <SummaryCard label="Offers" value={validOffersCount} />
        <SummaryCard label="Public prizes" value={publicPrizesCount} />
      </section>

      <FormSection
        title="Public details"
        description="These details appear on the raffle page buyers see."
      >
        <div style={styles.twoColumn}>
          <Field label="Title">
            <input
              name="title"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              style={styles.input}
              placeholder="Spring Cash Raffle"
            />
          </Field>

          <Field label="Slug">
            <input
              name="slug"
              required
              value={slug}
              onChange={(e) => {
                setSlugEdited(true);
                setSlug(slugify(e.target.value));
              }}
              style={styles.input}
              placeholder="spring-cash-raffle"
            />
          </Field>
        </div>

        <Field label="Description">
          <textarea
            name="description"
            rows={4}
            style={styles.textarea}
            placeholder="Describe the raffle..."
          />
        </Field>

        <div style={styles.twoColumn}>
          <Field label="Draw date">
            <input
              name="draw_at"
              type="datetime-local"
              value={drawAt}
              onChange={(e) => setDrawAt(e.target.value)}
              style={styles.input}
            />
            <div style={styles.helpText}>
              Optional. This will be shown to buyers and in admin.
            </div>
          </Field>

          <Field label="Status">
            <select name="status" defaultValue="draft" style={styles.input}>
              <option value="draft">Draft</option>
              <option value="published">Published</option>
              <option value="closed">Closed</option>
            </select>
          </Field>
        </div>
      </FormSection>

      <FormSection
        title="Image"
        description="Upload a raffle image or paste an image URL."
      >
        <div style={styles.imageLayout}>
          <div style={styles.imageControls}>
            <div style={styles.uploadRow}>
              <label
                style={{
                  ...styles.uploadButton,
                  cursor: uploading ? "not-allowed" : "pointer",
                  opacity: uploading ? 0.7 : 1,
                }}
              >
                {uploading ? "Uploading..." : "Upload image"}
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  disabled={uploading}
                  style={{ display: "none" }}
                />
              </label>

              {imageUrl ? (
                <span style={styles.successText}>Image uploaded</span>
              ) : (
                <span style={styles.mutedText}>No image uploaded yet</span>
              )}
            </div>

            <input
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              style={styles.input}
              placeholder="Or paste image URL"
            />

            <Field label="Image focus">
              <select
                value={imagePosition}
                onChange={(e) => setImagePosition(e.target.value)}
                style={styles.input}
              >
                {IMAGE_POSITIONS.map((position) => (
                  <option key={position.value} value={position.value}>
                    {position.label}
                  </option>
                ))}
              </select>
            </Field>

            {uploadError ? <div style={styles.errorBox}>{uploadError}</div> : null}
          </div>

          <div style={styles.previewBox}>
            {imageUrl ? (
              <img
                src={imageUrl}
                alt="Raffle preview"
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  objectPosition: imagePosition,
                  display: "block",
                }}
              />
            ) : (
              <div style={styles.emptyPreview}>🎟️</div>
            )}
          </div>
        </div>
      </FormSection>

      <FormSection
        title="Tickets and pricing"
        description="Choose ticket price, number range and currency."
      >
        <div style={styles.threeColumn}>
          <Field label="Currency">
            <select name="currency" defaultValue="EUR" style={styles.input}>
              <option value="EUR">EUR</option>
              <option value="GBP">GBP</option>
              <option value="USD">USD</option>
            </select>
          </Field>

          <Field label="Single ticket price">
            <input
              name="ticket_price"
              type="number"
              min="0"
              step="0.01"
              defaultValue="5"
              style={styles.input}
            />
          </Field>

          <Field label="Total tickets">
            <input value={String(totalTickets)} readOnly style={styles.inputMuted} />
          </Field>
        </div>

        <div style={styles.twoColumn}>
          <Field label="Start number">
            <input
              name="startNumber"
              type="number"
              min="0"
              step="1"
              value={startNumber}
              onChange={(e) => setStartNumber(e.target.value)}
              style={styles.input}
            />
          </Field>

          <Field label="End number">
            <input
              name="endNumber"
              type="number"
              min="0"
              step="1"
              value={endNumber}
              onChange={(e) => setEndNumber(e.target.value)}
              style={styles.input}
            />
          </Field>
        </div>
      </FormSection>

      <FormSection
        title="Ticket colours"
        description="Buyers can choose from these colours. You can add custom colour names too."
      >
        <div style={styles.colourGrid}>
          {PRESET_COLOURS.map((colour) => {
            const active = selectedColours.includes(colour);

            return (
              <button
                key={colour}
                type="button"
                onClick={() => toggleColour(colour)}
                style={{
                  ...styles.colourButton,
                  background: active ? "#1683f8" : "#e2e8f0",
                  color: active ? "#fff" : "#111827",
                }}
              >
                {active ? "✓ " : ""}
                {colour}
              </button>
            );
          })}
        </div>

        <div style={styles.inlineControls}>
          <input
            value={customColour}
            onChange={(e) => setCustomColour(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addCustomColour();
              }
            }}
            style={{ ...styles.input, flex: 1 }}
            placeholder="Add custom colour"
          />
          <button type="button" onClick={addCustomColour} style={styles.lightButton}>
            Add colour
          </button>
        </div>

        <div style={styles.selectedBox}>
          <strong>Selected:</strong>{" "}
          {selectedColours.length ? selectedColours.join(", ") : "None"}
        </div>
      </FormSection>

      <FormSection
        title="Offers"
        description="Optional bundle pricing. Example: 3 tickets for 12."
        action={
          <button type="button" onClick={addOffer} style={styles.lightButton}>
            + Add offer
          </button>
        }
      >
        <div style={styles.cardList}>
          {offers.map((offer, index) => (
            <div key={offer.id} style={styles.offerCard}>
              <div style={styles.rowHeader}>
                <strong>Offer {index + 1}</strong>
                <label style={styles.checkboxLabel}>
                  <input
                    type="checkbox"
                    checked={offer.is_active}
                    onChange={(e) =>
                      updateOffer(offer.id, { is_active: e.target.checked })
                    }
                  />
                  Active
                </label>
              </div>

              <div style={styles.threeColumn}>
                <Field label="Label">
                  <input
                    value={offer.label}
                    onChange={(e) =>
                      updateOffer(offer.id, { label: e.target.value })
                    }
                    placeholder="3 for 12"
                    style={styles.input}
                  />
                </Field>

                <Field label="Price">
                  <input
                    value={offer.price}
                    onChange={(e) =>
                      updateOffer(offer.id, { price: e.target.value })
                    }
                    placeholder="12"
                    type="number"
                    min="0"
                    step="0.01"
                    style={styles.input}
                  />
                </Field>

                <Field label="Tickets">
                  <input
                    value={offer.quantity}
                    onChange={(e) =>
                      updateOffer(offer.id, { quantity: e.target.value })
                    }
                    placeholder="3"
                    type="number"
                    min="1"
                    step="1"
                    style={styles.input}
                  />
                </Field>
              </div>

              <button
                type="button"
                onClick={() => removeOffer(offer.id)}
                disabled={offers.length <= 1}
                style={{
                  ...styles.dangerButton,
                  cursor: offers.length <= 1 ? "not-allowed" : "pointer",
                  opacity: offers.length <= 1 ? 0.55 : 1,
                }}
              >
                Remove offer
              </button>
            </div>
          ))}
        </div>
      </FormSection>

      <FormSection
        title="Prize settings"
        description="Choose which prizes are visible on the public raffle page."
        action={
          <button type="button" onClick={addPrize} style={styles.lightButton}>
            + Add prize
          </button>
        }
      >
        <div style={styles.cardList}>
          {prizes.map((prize, index) => (
            <div key={prize.id} style={styles.prizeCard}>
              <div style={styles.rowHeader}>
                <strong>Prize {index + 1}</strong>
                <label style={styles.checkboxLabel}>
                  <input
                    type="checkbox"
                    checked={prize.is_public}
                    onChange={(e) =>
                      updatePrize(prize.id, { is_public: e.target.checked })
                    }
                  />
                  Show publicly
                </label>
              </div>

              <div style={styles.prizeGrid}>
                <Field label="Position">
                  <input
                    value={prize.position}
                    onChange={(e) =>
                      updatePrize(prize.id, { position: e.target.value })
                    }
                    type="number"
                    min="1"
                    step="1"
                    style={styles.input}
                  />
                </Field>

                <Field label="Prize title">
                  <input
                    value={prize.title}
                    onChange={(e) =>
                      updatePrize(prize.id, { title: e.target.value })
                    }
                    placeholder="Prize title"
                    style={styles.input}
                  />
                </Field>
              </div>

              <Field label="Description optional">
                <textarea
                  value={prize.description}
                  onChange={(e) =>
                    updatePrize(prize.id, { description: e.target.value })
                  }
                  rows={2}
                  style={styles.textarea}
                />
              </Field>

              <button
                type="button"
                onClick={() => removePrize(prize.id)}
                disabled={prizes.length <= 1}
                style={{
                  ...styles.dangerButton,
                  cursor: prizes.length <= 1 ? "not-allowed" : "pointer",
                  opacity: prizes.length <= 1 ? 0.55 : 1,
                }}
              >
                Remove prize
              </button>
            </div>
          ))}
        </div>
      </FormSection>

      <FormSection
        title="Legal entry question"
        description="Optional. Add a simple question buyers must answer correctly before reserving tickets."
      >
        <div style={styles.twoColumn}>
          <Field label="Question">
            <input
              value={questionText}
              onChange={(e) => setQuestionText(e.target.value)}
              style={styles.input}
              placeholder="e.g. What colour is the sky?"
            />
          </Field>

          <Field label="Correct answer">
            <input
              value={questionAnswer}
              onChange={(e) => setQuestionAnswer(e.target.value)}
              style={styles.input}
              placeholder="e.g. blue"
            />
          </Field>
        </div>

        <div style={styles.legalNote}>
          Leave both fields blank if this raffle does not need an entry question.
          If one is used, buyers must answer it correctly before tickets can be
          reserved.
        </div>
      </FormSection>

      <section style={styles.submitBar}>
        <div>
          <strong style={{ color: "#0f172a" }}>Ready to create?</strong>
          <div style={{ color: "#64748b", fontSize: 13, marginTop: 3 }}>
            Save as draft first if you want to review before publishing.
          </div>
        </div>

        <button type="submit" style={styles.submitButton}>
          Create raffle
        </button>
      </section>
    </form>
  );
}

function FormSection({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section style={styles.section}>
      <div style={styles.sectionHeader}>
        <div>
          <h3 style={styles.sectionTitle}>{title}</h3>
          {description ? <p style={styles.sectionDescription}>{description}</p> : null}
        </div>
        {action}
      </div>

      <div style={styles.sectionBody}>{children}</div>
    </section>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label style={styles.field}>
      <span style={styles.label}>{label}</span>
      {children}
    </label>
  );
}

function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <div style={styles.summaryCard}>
      <div style={styles.summaryLabel}>{label}</div>
      <div style={styles.summaryValue}>{value}</div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  form: {
    display: "grid",
    gap: 18,
    marginTop: 24,
    maxWidth: 1040,
  },
  hero: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 14,
    flexWrap: "wrap",
    padding: 22,
    borderRadius: 24,
    background: "#0f172a",
    color: "#ffffff",
  },
  eyebrow: {
    display: "inline-flex",
    padding: "5px 9px",
    borderRadius: 999,
    background: "rgba(255,255,255,0.12)",
    fontSize: 12,
    fontWeight: 900,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    marginBottom: 10,
  },
  heroTitle: {
    margin: 0,
    fontSize: 30,
    letterSpacing: "-0.04em",
    lineHeight: 1.08,
  },
  heroText: {
    margin: "10px 0 0",
    color: "#cbd5e1",
    maxWidth: 640,
    lineHeight: 1.55,
  },
  tenantPill: {
    padding: "8px 11px",
    borderRadius: 999,
    background: "rgba(255,255,255,0.12)",
    color: "#e2e8f0",
    fontSize: 13,
    fontWeight: 800,
  },
  summaryGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
    gap: 12,
  },
  summaryCard: {
    padding: 15,
    borderRadius: 18,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    boxShadow: "0 2px 12px rgba(15,23,42,0.04)",
  },
  summaryLabel: {
    color: "#64748b",
    fontSize: 12,
    fontWeight: 900,
  },
  summaryValue: {
    color: "#0f172a",
    fontSize: 26,
    fontWeight: 900,
    marginTop: 4,
  },
  section: {
    padding: 18,
    borderRadius: 22,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    boxShadow: "0 2px 12px rgba(15,23,42,0.04)",
  },
  sectionHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
    flexWrap: "wrap",
    marginBottom: 16,
  },
  sectionTitle: {
    margin: 0,
    color: "#0f172a",
    fontSize: 21,
    letterSpacing: "-0.02em",
  },
  sectionDescription: {
    margin: "5px 0 0",
    color: "#64748b",
    fontSize: 14,
    lineHeight: 1.45,
  },
  sectionBody: {
    display: "grid",
    gap: 14,
  },
  field: {
    display: "grid",
    gap: 6,
    minWidth: 0,
  },
  label: {
    color: "#334155",
    fontSize: 13,
    fontWeight: 900,
  },
  input: {
    width: "100%",
    minHeight: 44,
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid #cbd5e1",
    background: "#ffffff",
    color: "#0f172a",
    fontSize: 15,
    boxSizing: "border-box",
  },
  inputMuted: {
    width: "100%",
    minHeight: 44,
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid #e2e8f0",
    background: "#f8fafc",
    color: "#0f172a",
    fontSize: 15,
    fontWeight: 900,
    boxSizing: "border-box",
  },
  textarea: {
    width: "100%",
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid #cbd5e1",
    background: "#ffffff",
    color: "#0f172a",
    fontSize: 15,
    resize: "vertical",
    boxSizing: "border-box",
  },
  helpText: {
    color: "#64748b",
    fontSize: 13,
    lineHeight: 1.4,
  },
  twoColumn: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
    gap: 12,
  },
  threeColumn: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
    gap: 12,
  },
  imageLayout: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1.5fr) minmax(180px, 260px)",
    gap: 16,
    alignItems: "start",
  },
  imageControls: {
    display: "grid",
    gap: 12,
  },
  uploadRow: {
    display: "flex",
    gap: 12,
    alignItems: "center",
    flexWrap: "wrap",
  },
  uploadButton: {
    display: "inline-flex",
    padding: "11px 15px",
    borderRadius: 999,
    background: "#1683f8",
    color: "#ffffff",
    fontWeight: 900,
  },
  successText: {
    color: "#166534",
    fontWeight: 900,
    fontSize: 14,
  },
  mutedText: {
    color: "#64748b",
    fontSize: 14,
  },
  previewBox: {
    height: 220,
    borderRadius: 18,
    border: "1px solid #e2e8f0",
    background: "#f8fafc",
    overflow: "hidden",
  },
  emptyPreview: {
    height: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#94a3b8",
    fontSize: 44,
  },
  errorBox: {
    padding: 12,
    borderRadius: 12,
    background: "#fef2f2",
    border: "1px solid #fecaca",
    color: "#991b1b",
    fontWeight: 700,
  },
  colourGrid: {
    display: "flex",
    flexWrap: "wrap",
    gap: 10,
  },
  colourButton: {
    border: "none",
    borderRadius: 999,
    padding: "10px 14px",
    cursor: "pointer",
    fontWeight: 800,
  },
  inlineControls: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
  },
  lightButton: {
    padding: "10px 14px",
    borderRadius: 999,
    border: "1px solid #cbd5e1",
    background: "#ffffff",
    color: "#0f172a",
    cursor: "pointer",
    fontWeight: 900,
  },
  selectedBox: {
    color: "#475569",
    padding: 12,
    borderRadius: 12,
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    fontSize: 14,
  },
  legalNote: {
    color: "#475569",
    padding: 12,
    borderRadius: 12,
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    fontSize: 14,
    lineHeight: 1.45,
  },
  cardList: {
    display: "grid",
    gap: 12,
  },
  offerCard: {
    display: "grid",
    gap: 12,
    padding: 14,
    border: "1px solid #e2e8f0",
    borderRadius: 16,
    background: "#f8fafc",
  },
  prizeCard: {
    display: "grid",
    gap: 12,
    padding: 14,
    border: "1px solid #e2e8f0",
    borderRadius: 16,
    background: "#f8fafc",
  },
  rowHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    flexWrap: "wrap",
    color: "#0f172a",
  },
  checkboxLabel: {
    display: "inline-flex",
    alignItems: "center",
    gap: 7,
    fontWeight: 800,
    color: "#334155",
    fontSize: 14,
  },
  prizeGrid: {
    display: "grid",
    gridTemplateColumns: "110px minmax(0, 1fr)",
    gap: 12,
  },
  dangerButton: {
    width: "fit-content",
    padding: "9px 12px",
    borderRadius: 999,
    border: "1px solid #fecaca",
    background: "#ffffff",
    color: "#b91c1c",
    fontWeight: 900,
  },
  submitBar: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 14,
    flexWrap: "wrap",
    padding: 18,
    borderRadius: 22,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    boxShadow: "0 2px 12px rgba(15,23,42,0.04)",
  },
  submitButton: {
    padding: "13px 20px",
    border: "none",
    borderRadius: 999,
    background: "#1683f8",
    color: "#ffffff",
    fontWeight: 900,
    cursor: "pointer",
    boxShadow: "0 10px 20px rgba(22,131,248,0.22)",
  },
};
