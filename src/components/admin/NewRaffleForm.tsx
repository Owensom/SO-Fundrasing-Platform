"use client";

import { useEffect, useMemo, useState } from "react";
import type { CSSProperties, ReactNode } from "react";

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

  const numbersPerColour = useMemo(() => {
    const start = toInt(startNumber, 1);
    const end = toInt(endNumber, 1);

    return end >= start ? end - start + 1 : 0;
  }, [startNumber, endNumber]);

  const totalTickets = useMemo(() => {
    return numbersPerColour * selectedColours.length;
  }, [numbersPerColour, selectedColours.length]);

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
        const title = prize.title.trim();

        return {
          id: prize.id,
          position:
            Number.isFinite(position) && position > 0
              ? Math.floor(position)
              : index + 1,
          title,
          name: title,
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

    return JSON.stringify({ text, answer });
  }, [questionText, questionAnswer]);

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
        <div style={styles.heroContent}>
          <div style={styles.eyebrow}>Create raffle</div>

          <div style={styles.heroTitleRow}>
            <h1 style={styles.heroTitle}>
              {title.trim() ? title : "Build a new raffle"}
            </h1>

            <div style={styles.statusPill}>Draft</div>
          </div>

          <p style={styles.heroSlug}>
            /r/{slug.trim() ? slug : "raffle-slug"}
          </p>

          <p style={styles.heroDescription}>
            Set up the public details, raffle image, pricing, ticket colours,
            offers, prizes and optional legal entry question.
          </p>
        </div>

        <div style={styles.heroImageWrap}>
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
            <div style={styles.heroImageEmpty}>🎟️</div>
          )}
        </div>
      </section>

      <section style={styles.summaryGrid}>
        <SummaryCard label="Total tickets" value={totalTickets} />
        <SummaryCard label="Numbers / colour" value={numbersPerColour} />
        <SummaryCard label="Colours" value={selectedColours.length} />
        <SummaryCard label="Offers" value={validOffersCount} />
        <SummaryCard label="Public prizes" value={publicPrizesCount} />
      </section>

      <section style={styles.section}>
        <div style={styles.sectionHeader}>
          <div>
            <h2 style={styles.sectionTitle}>Create raffle</h2>
            <p style={styles.sectionDescription}>
              Add the same details you can later edit from the raffle editor.
            </p>
          </div>
        </div>

        <div style={styles.formInner}>
          <div style={styles.twoColumn}>
            <Field label="Title">
              <input
                name="title"
                required
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                style={styles.input}
                placeholder="Spring Cash Raffle"
              />
            </Field>

            <Field label="Slug">
              <input
                name="slug"
                required
                value={slug}
                onChange={(event) => {
                  setSlugEdited(true);
                  setSlug(slugify(event.target.value));
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

          <div style={styles.mediaBox}>
            <div>
              <h3 style={styles.subTitle}>Raffle image</h3>
              <p style={styles.sectionDescription}>
                Upload or paste the public image, then choose the focus position.
              </p>

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
                  <span style={styles.mutedSmall}>No image uploaded yet</span>
                )}
              </div>

              <input
                value={imageUrl}
                onChange={(event) => setImageUrl(event.target.value)}
                style={styles.input}
                placeholder="Or paste image URL"
              />

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

          <div style={styles.twoColumn}>
            <Field label="Image focus">
              <select
                value={imagePosition}
                onChange={(event) => setImagePosition(event.target.value)}
                style={styles.input}
              >
                {IMAGE_POSITIONS.map((position) => (
                  <option key={position.value} value={position.value}>
                    {position.label}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Draw date">
              <input
                name="draw_at"
                type="datetime-local"
                value={drawAt}
                onChange={(event) => setDrawAt(event.target.value)}
                style={styles.input}
              />
            </Field>
          </div>

          <div style={styles.threeColumn}>
            <Field label="Ticket price">
              <input
                name="ticket_price"
                type="number"
                step="0.01"
                min={0}
                defaultValue="5"
                style={styles.input}
              />
            </Field>

            <Field label="Currency">
              <select name="currency" defaultValue="EUR" style={styles.input}>
                <option value="GBP">GBP</option>
                <option value="EUR">EUR</option>
                <option value="USD">USD</option>
              </select>
            </Field>

            <Field label="Status">
              <select name="status" defaultValue="draft" style={styles.input}>
                <option value="draft">Draft</option>
                <option value="published">Published</option>
                <option value="closed">Closed</option>
              </select>
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
                onChange={(event) => setStartNumber(event.target.value)}
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
                onChange={(event) => setEndNumber(event.target.value)}
                style={styles.input}
              />
            </Field>
          </div>

          <section style={styles.innerPanel}>
            <div style={styles.innerHeader}>
              <div>
                <h3 style={styles.subTitle}>Entry question (legal)</h3>
                <p style={styles.sectionDescription}>
                  Add a skill-based question for the public checkout flow.
                </p>
              </div>
            </div>

            <div style={styles.twoColumn}>
              <Field label="Question">
                <input
                  value={questionText}
                  onChange={(event) => setQuestionText(event.target.value)}
                  placeholder="e.g. What colour is a London taxi?"
                  style={styles.input}
                />
              </Field>

              <Field label="Correct answer">
                <input
                  value={questionAnswer}
                  onChange={(event) => setQuestionAnswer(event.target.value)}
                  placeholder="e.g. black"
                  style={styles.input}
                />
              </Field>
            </div>

            <p style={styles.helpText}>
              The public raffle page requires this answer before checkout when a
              question is set.
            </p>
          </section>

          <section style={styles.innerPanel}>
            <div style={styles.innerHeader}>
              <div>
                <h3 style={styles.subTitle}>Ticket colours</h3>
                <p style={styles.sectionDescription}>
                  Preset colour buttons plus optional custom colours.
                </p>
              </div>
            </div>

            <div style={styles.colourGrid}>
              {PRESET_COLOURS.map((colour) => {
                const active = selectedColours.includes(colour);

                return (
                  <button
                    key={colour}
                    type="button"
                    onClick={() => toggleColour(colour)}
                    style={{
                      ...styles.colourPill,
                      background: active ? "#1683f8" : "#e2e8f0",
                      color: active ? "#ffffff" : "#111827",
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
                onChange={(event) => setCustomColour(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    addCustomColour();
                  }
                }}
                style={{ ...styles.input, flex: 1 }}
                placeholder="Gold, Silver, #00ff00"
              />

              <button type="button" onClick={addCustomColour} style={styles.lightButton}>
                Add colour
              </button>
            </div>

            <p style={styles.helpText}>
              Selected: {selectedColours.length ? selectedColours.join(", ") : "None"}
            </p>
          </section>

          <section style={styles.innerPanel}>
            <div style={styles.innerHeader}>
              <div>
                <h3 style={styles.subTitle}>Offers</h3>
                <p style={styles.sectionDescription}>
                  Optional bundle pricing. Example: 3 tickets for 12.00.
                </p>
              </div>

              <button type="button" onClick={addOffer} style={styles.lightButton}>
                + Add offer
              </button>
            </div>

            <div style={styles.offerList}>
              {offers.map((offer, index) => (
                <div key={offer.id} style={styles.offerRow}>
                  <Field label="Label">
                    <input
                      value={offer.label}
                      onChange={(event) =>
                        updateOffer(offer.id, { label: event.target.value })
                      }
                      placeholder="3 for 12"
                      style={styles.input}
                    />
                  </Field>

                  <Field label="Number of tickets">
                    <input
                      value={offer.quantity}
                      onChange={(event) =>
                        updateOffer(offer.id, { quantity: event.target.value })
                      }
                      type="number"
                      min="1"
                      step="1"
                      placeholder="3"
                      style={styles.input}
                    />
                  </Field>

                  <Field label="Total offer price">
                    <input
                      value={offer.price}
                      onChange={(event) =>
                        updateOffer(offer.id, { price: event.target.value })
                      }
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="12.00"
                      style={styles.input}
                    />
                  </Field>

                  <label style={styles.checkboxLabel}>
                    <input
                      type="checkbox"
                      checked={offer.is_active}
                      onChange={(event) =>
                        updateOffer(offer.id, {
                          is_active: event.target.checked,
                        })
                      }
                    />
                    Use
                  </label>

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
                    Remove
                  </button>
                </div>
              ))}
            </div>

            <p style={styles.helpText}>
              Leave unused rows blank. Save the raffle to apply changes.
            </p>
          </section>

          <section style={styles.innerPanel}>
            <div style={styles.innerHeader}>
              <div>
                <h3 style={styles.subTitle}>Prize settings</h3>
                <p style={styles.sectionDescription}>
                  Choose which prizes are visible on the public raffle page.
                </p>
              </div>

              <button type="button" onClick={addPrize} style={styles.lightButton}>
                + Add prize
              </button>
            </div>

            <div style={styles.prizeList}>
              {prizes.map((prize, index) => (
                <div key={prize.id} style={styles.prizeRow}>
                  <div style={styles.rowHeader}>
                    <strong>Prize {index + 1}</strong>

                    <label style={styles.checkboxLabel}>
                      <input
                        type="checkbox"
                        checked={prize.is_public}
                        onChange={(event) =>
                          updatePrize(prize.id, {
                            is_public: event.target.checked,
                          })
                        }
                      />
                      Show publicly
                    </label>
                  </div>

                  <div style={styles.prizeGrid}>
                    <Field label="Position">
                      <input
                        value={prize.position}
                        onChange={(event) =>
                          updatePrize(prize.id, {
                            position: event.target.value,
                          })
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
                        onChange={(event) =>
                          updatePrize(prize.id, { title: event.target.value })
                        }
                        placeholder="Prize title"
                        style={styles.input}
                      />
                    </Field>
                  </div>

                  <Field label="Description optional">
                    <textarea
                      value={prize.description}
                      onChange={(event) =>
                        updatePrize(prize.id, {
                          description: event.target.value,
                        })
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
          </section>

          <section style={styles.submitBar}>
            <div>
              <strong style={{ color: "#0f172a" }}>Create raffle</strong>
              <div style={styles.mutedSmall}>
                Save as draft first if you want to review before publishing.
              </div>
            </div>

            <button type="submit" style={styles.submitButton}>
              Create raffle
            </button>
          </section>
        </div>
      </section>
    </form>
  );
}

function SummaryCard({
  label,
  value,
}: {
  label: string;
  value: ReactNode;
}) {
  return (
    <div style={styles.summaryCard}>
      <div style={styles.summaryLabel}>{label}</div>
      <div style={styles.summaryValue}>{value}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label style={styles.field}>
      <span style={styles.label}>{label}</span>
      {children}
    </label>
  );
}

const styles: Record<string, CSSProperties> = {
  form: {
    display: "grid",
    gap: 16,
    marginTop: 0,
  },
  hero: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) 260px",
    gap: 18,
    alignItems: "stretch",
    padding: 22,
    borderRadius: 24,
    background: "#0f172a",
    color: "#ffffff",
    marginBottom: 0,
  },
  heroContent: {
    minWidth: 0,
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
  heroTitleRow: {
    display: "flex",
    gap: 12,
    justifyContent: "space-between",
    alignItems: "flex-start",
    flexWrap: "wrap",
  },
  heroTitle: {
    margin: 0,
    fontSize: 34,
    lineHeight: 1.08,
    letterSpacing: "-0.04em",
    wordBreak: "break-word",
  },
  statusPill: {
    padding: "7px 11px",
    borderRadius: 999,
    border: "1px solid #e2e8f0",
    fontSize: 13,
    textTransform: "capitalize",
    fontWeight: 900,
    background: "#f8fafc",
    color: "#475569",
  },
  heroSlug: {
    margin: "8px 0 0",
    color: "#cbd5e1",
    fontSize: 14,
    fontWeight: 700,
    wordBreak: "break-word",
  },
  heroDescription: {
    margin: "12px 0 0",
    color: "#e2e8f0",
    lineHeight: 1.55,
    maxWidth: 720,
  },
  heroImageWrap: {
    borderRadius: 18,
    background: "#1e293b",
    border: "1px solid rgba(255,255,255,0.12)",
    overflow: "hidden",
    minHeight: 180,
  },
  heroImageEmpty: {
    height: "100%",
    minHeight: 180,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 46,
    color: "#94a3b8",
  },
  summaryGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
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
    fontSize: 22,
    fontWeight: 900,
    marginTop: 5,
    wordBreak: "break-word",
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
    gap: 12,
    alignItems: "flex-start",
    flexWrap: "wrap",
    marginBottom: 16,
  },
  sectionTitle: {
    margin: 0,
    color: "#0f172a",
    fontSize: 22,
    letterSpacing: "-0.02em",
  },
  sectionDescription: {
    margin: "5px 0 0",
    color: "#64748b",
    fontSize: 14,
    lineHeight: 1.45,
  },
  formInner: {
    display: "grid",
    gap: 14,
  },
  twoColumn: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
    gap: 12,
  },
  threeColumn: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
    gap: 12,
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
  mediaBox: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1.5fr) minmax(180px, 260px)",
    gap: 16,
    padding: 14,
    borderRadius: 18,
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
  },
  subTitle: {
    margin: 0,
    color: "#0f172a",
    fontSize: 18,
    letterSpacing: "-0.01em",
  },
  uploadRow: {
    display: "flex",
    gap: 12,
    alignItems: "center",
    flexWrap: "wrap",
    margin: "12px 0",
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
  previewBox: {
    height: 220,
    borderRadius: 18,
    border: "1px solid #e2e8f0",
    background: "#ffffff",
    overflow: "hidden",
  },
  emptyPreview: {
    height: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#94a3b8",
    fontSize: 42,
  },
  innerPanel: {
    display: "grid",
    gap: 14,
    padding: 16,
    borderRadius: 18,
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
  },
  innerHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "flex-start",
    flexWrap: "wrap",
  },
  colourGrid: {
    display: "flex",
    flexWrap: "wrap",
    gap: 10,
  },
  colourPill: {
    display: "inline-flex",
    alignItems: "center",
    padding: "10px 14px",
    borderRadius: 999,
    cursor: "pointer",
    fontWeight: 900,
    border: "none",
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
    whiteSpace: "nowrap",
  },
  offerList: {
    display: "grid",
    gap: 10,
  },
  offerRow: {
    display: "grid",
    gridTemplateColumns:
      "minmax(160px, 1.1fr) minmax(130px, 0.8fr) minmax(130px, 0.8fr) auto auto",
    gap: 10,
    alignItems: "end",
    padding: 12,
    border: "1px solid #e2e8f0",
    borderRadius: 14,
    background: "#ffffff",
  },
  checkboxLabel: {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    minHeight: 44,
    fontWeight: 900,
    color: "#334155",
    cursor: "pointer",
  },
  dangerButton: {
    width: "fit-content",
    padding: "10px 12px",
    borderRadius: 999,
    border: "1px solid #fecaca",
    background: "#ffffff",
    color: "#b91c1c",
    fontWeight: 900,
  },
  prizeList: {
    display: "grid",
    gap: 12,
  },
  prizeRow: {
    display: "grid",
    gap: 12,
    padding: 14,
    border: "1px solid #e2e8f0",
    borderRadius: 16,
    background: "#ffffff",
  },
  rowHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    flexWrap: "wrap",
    color: "#0f172a",
  },
  prizeGrid: {
    display: "grid",
    gridTemplateColumns: "110px minmax(0, 1fr)",
    gap: 12,
  },
  helpText: {
    color: "#64748b",
    fontSize: 13,
    margin: 0,
  },
  mutedSmall: {
    color: "#64748b",
    fontSize: 13,
    marginTop: 3,
  },
  errorBox: {
    padding: 12,
    borderRadius: 12,
    background: "#fef2f2",
    border: "1px solid #fecaca",
    color: "#991b1b",
    fontWeight: 700,
    marginTop: 12,
  },
  submitBar: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 14,
    flexWrap: "wrap",
    padding: 16,
    borderRadius: 18,
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
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
