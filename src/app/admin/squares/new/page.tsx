"use client";

import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";

type PrizeRow = {
  id: string;
  position: string;
  title: string;
  description: string;
  is_public: boolean;
};

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

function toMoney(value: string, fallback: number) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export default function NewSquaresGamePage() {
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const [description, setDescription] = useState("");
  const [drawAt, setDrawAt] = useState("");

  const [imageUrl, setImageUrl] = useState("");
  const [imagePosition, setImagePosition] = useState("center");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");

  const [totalSquares, setTotalSquares] = useState("100");
  const [pricePerSquare, setPricePerSquare] = useState("2.00");
  const [currency, setCurrency] = useState("GBP");
  const [status, setStatus] = useState("draft");

  const [questionText, setQuestionText] = useState("");
  const [questionAnswer, setQuestionAnswer] = useState("");

  const [freeEntryAddress, setFreeEntryAddress] = useState("");
  const [freeEntryInstructions, setFreeEntryInstructions] = useState("");
  const [freeEntryClosesAt, setFreeEntryClosesAt] = useState("");

  const [prizes, setPrizes] = useState<PrizeRow[]>([
    makePrize("prize-1", "1", "1st Prize", ""),
  ]);

  useEffect(() => {
    if (!slugEdited) {
      setSlug(slugify(title));
    }
  }, [title, slugEdited]);

  const publicPrizesCount = useMemo(() => {
    return prizes.filter((prize) => prize.title.trim() && prize.is_public).length;
  }, [prizes]);

  const prizesValue = useMemo(() => {
    const clean = prizes
      .map((prize, index) => {
        const position = Number(prize.position);
        const cleanTitle = prize.title.trim();

        return {
          id: prize.id,
          position:
            Number.isFinite(position) && position > 0
              ? Math.floor(position)
              : index + 1,
          title: cleanTitle,
          name: cleanTitle,
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

  const freeEntryValue = useMemo(() => {
    const address = freeEntryAddress.trim();
    const instructions = freeEntryInstructions.trim();
    const closes_at = freeEntryClosesAt.trim();

    if (!address && !instructions && !closes_at) return "";

    return JSON.stringify({
      address,
      instructions,
      closes_at: closes_at ? new Date(closes_at).toISOString() : null,
    });
  }, [freeEntryAddress, freeEntryInstructions, freeEntryClosesAt]);

  const boardSize = Math.max(1, Math.min(500, toInt(totalSquares, 100)));
  const price = Math.max(0, toMoney(pricePerSquare, 0));
  const estimatedTotal = boardSize * price;

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
    <form action="/api/admin/squares" method="post" style={styles.form}>
      <input type="hidden" name="image_url" value={imageUrl} />
      <input type="hidden" name="image_position" value={imagePosition} />
      <input type="hidden" name="prizes" value={prizesValue} />
      <input type="hidden" name="question" value={questionValue} />
      <input type="hidden" name="free_entry" value={freeEntryValue} />

      <section style={styles.hero}>
        <div style={styles.heroContent}>
          <div style={styles.eyebrow}>Create squares</div>

          <div style={styles.heroTitleRow}>
            <h1 style={styles.heroTitle}>
              {title.trim() ? title : "Build a new squares game"}
            </h1>

            <div style={styles.statusPill}>{status}</div>
          </div>

          <p style={styles.heroSlug}>/s/{slug.trim() ? slug : "squares-slug"}</p>

          <p style={styles.heroDescription}>
            Set up the public details, image, pricing, board size, draw date,
            legal entry question, free postal entry and prize settings.
          </p>
        </div>

        <div style={styles.heroImageWrap}>
          {imageUrl ? (
            <img
              src={imageUrl}
              alt="Squares preview"
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                objectPosition: imagePosition,
                display: "block",
              }}
            />
          ) : (
            <div style={styles.heroImageEmpty}>🔲</div>
          )}
        </div>
      </section>

      <section style={styles.summaryGrid}>
        <SummaryCard label="Total squares" value={boardSize} />
        <SummaryCard label="Price / square" value={`${price.toFixed(2)} ${currency}`} />
        <SummaryCard label="Max sales" value={`${estimatedTotal.toFixed(2)} ${currency}`} />
        <SummaryCard label="Public prizes" value={publicPrizesCount} />
      </section>

      <section style={styles.section}>
        <div style={styles.sectionHeader}>
          <div>
            <h2 style={styles.sectionTitle}>Create squares game</h2>
            <p style={styles.sectionDescription}>
              Add the same details you can later edit from the squares editor.
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
                placeholder="Summer squares"
              />
            </Field>

            <Field label="Slug">
              <input
                name="slug"
                value={slug}
                onChange={(event) => {
                  setSlugEdited(true);
                  setSlug(slugify(event.target.value));
                }}
                style={styles.input}
                placeholder="summer-squares"
              />
            </Field>
          </div>

          <Field label="Description">
            <textarea
              name="description"
              rows={4}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              style={styles.textarea}
              placeholder="Describe the game, prize and draw details."
            />
          </Field>

          <div style={styles.mediaBox}>
            <div>
              <h3 style={styles.subTitle}>Squares image</h3>
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
                  alt="Squares preview"
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    objectPosition: imagePosition,
                    display: "block",
                  }}
                />
              ) : (
                <div style={styles.emptyPreview}>🔲</div>
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

          <section style={styles.innerPanel}>
            <div style={styles.innerHeader}>
              <div>
                <h3 style={styles.subTitle}>Squares setup</h3>
                <p style={styles.sectionDescription}>
                  Configure board size and pricing. Maximum board size is 500
                  squares.
                </p>
              </div>
            </div>

            <div style={styles.fourColumn}>
              <Field label="Number of squares">
                <input
                  name="total_squares"
                  type="number"
                  min={1}
                  max={500}
                  required
                  value={totalSquares}
                  onChange={(event) => setTotalSquares(event.target.value)}
                  style={styles.input}
                />
              </Field>

              <Field label="Price per square">
                <input
                  name="price_per_square"
                  type="number"
                  min={0}
                  step="0.01"
                  required
                  value={pricePerSquare}
                  onChange={(event) => setPricePerSquare(event.target.value)}
                  style={styles.input}
                />
              </Field>

              <Field label="Currency">
                <select
                  name="currency"
                  value={currency}
                  onChange={(event) => setCurrency(event.target.value)}
                  style={styles.input}
                >
                  <option value="GBP">GBP</option>
                  <option value="EUR">EUR</option>
                  <option value="USD">USD</option>
                </select>
              </Field>

              <Field label="Status">
                <select
                  name="status"
                  value={status}
                  onChange={(event) => setStatus(event.target.value)}
                  style={styles.input}
                >
                  <option value="draft">Draft</option>
                  <option value="published">Published</option>
                  <option value="closed">Closed</option>
                </select>
              </Field>
            </div>
          </section>

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
              The public squares page requires this answer before checkout when
              a question is set.
            </p>
          </section>

          <section style={styles.innerPanel}>
            <div style={styles.innerHeader}>
              <div>
                <h3 style={styles.subTitle}>Free postal entry</h3>
                <p style={styles.sectionDescription}>
                  Add no-purchase entry instructions shown on the public squares
                  page.
                </p>
              </div>
            </div>

            <Field label="Postal address">
              <textarea
                value={freeEntryAddress}
                onChange={(event) => setFreeEntryAddress(event.target.value)}
                rows={3}
                placeholder="Postal entry address"
                style={styles.textarea}
              />
            </Field>

            <Field label="Instructions">
              <textarea
                value={freeEntryInstructions}
                onChange={(event) => setFreeEntryInstructions(event.target.value)}
                rows={3}
                placeholder="Include name, email, game name, answer and preferred square number..."
                style={styles.textarea}
              />
            </Field>

            <Field label="Postal entry closes">
              <input
                type="datetime-local"
                value={freeEntryClosesAt}
                onChange={(event) => setFreeEntryClosesAt(event.target.value)}
                style={styles.input}
              />
            </Field>
          </section>

          <section style={styles.innerPanel}>
            <div style={styles.innerHeader}>
              <div>
                <h3 style={styles.subTitle}>Prize settings</h3>
                <p style={styles.sectionDescription}>
                  Choose which prizes are visible on the public squares page.
                </p>
              </div>

              <button type="button" onClick={addPrize} style={styles.lightButton}>
                + Add prize
              </button>
            </div>

            <div style={styles.prizeList}>
              {prizes.map((prize, index) => (
                <div key={prize.id} style={styles.prizeRow}>
                  <input type="hidden" name="prize_position" value={prize.position} />
                  <input type="hidden" name="prize_is_public" value={String(prize.is_public)} />

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
                        name="prize_title"
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
                      name="prize_description"
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
              <strong style={{ color: "#0f172a" }}>Create squares game</strong>
              <div style={styles.mutedSmall}>
                Save as draft first if you want to review before publishing.
              </div>
            </div>

            <button type="submit" style={styles.submitButton}>
              Create squares game
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
    maxWidth: 1040,
    margin: "40px auto",
    padding: "0 16px 48px",
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
  fourColumn: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
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
