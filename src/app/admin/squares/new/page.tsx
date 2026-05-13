"use client";

import {
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import ImageFocusUploadField from "@/components/ImageFocusUploadField";

type PrizeRow = {
  id: string;
  position: string;
  title: string;
  description: string;
  is_public: boolean;
};

const DEFAULT_SQUARES_IMAGE = "/brand/so-default-squares.png";

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
  const number = Number(value);
  return Number.isFinite(number) ? Math.floor(number) : fallback;
}

function toMoney(value: string, fallback: number) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function formatPreviewMoney(value: number | string, currency: string) {
  const amount = Number(value || 0);

  try {
    return new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency: currency || "GBP",
    }).format(Number.isFinite(amount) ? amount : 0);
  } catch {
    return `${Number.isFinite(amount) ? amount.toFixed(2) : "0.00"} ${
      currency || "GBP"
    }`;
  }
}

function formatDatePreview(value: string) {
  if (!value) return "Date to be confirmed";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "Date to be confirmed";

  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function getBoardShape(total: number) {
  if (total <= 25) return { columns: 5, rows: Math.ceil(total / 5) };
  if (total <= 49) return { columns: 7, rows: Math.ceil(total / 7) };
  if (total <= 100) return { columns: 10, rows: Math.ceil(total / 10) };
  if (total <= 225) return { columns: 15, rows: Math.ceil(total / 15) };

  return { columns: 20, rows: Math.ceil(total / 20) };
}

export default function NewSquaresGamePage() {
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const [description, setDescription] = useState("");
  const [drawAt, setDrawAt] = useState("");

  const [imageUrl, setImageUrl] = useState("");
  const [imageFocusX, setImageFocusX] = useState(50);
  const [imageFocusY, setImageFocusY] = useState(50);

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
    return prizes.filter((prize) => prize.title.trim() && prize.is_public)
      .length;
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
  const boardShape = getBoardShape(boardSize);
  const hasLegalQuestion = Boolean(questionText.trim() && questionAnswer.trim());
  const hasFreeEntry = Boolean(
    freeEntryAddress.trim() ||
      freeEntryInstructions.trim() ||
      freeEntryClosesAt.trim(),
  );

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

  return (
    <form action="/api/admin/squares" method="post" style={styles.form}>
      <input type="hidden" name="image_position" value="center" />
      <input type="hidden" name="prizes" value={prizesValue} />
      <input type="hidden" name="question" value={questionValue} />
      <input type="hidden" name="free_entry" value={freeEntryValue} />

      <section style={styles.hero}>
        <div style={styles.heroContent}>
          <div style={styles.eyebrow}>Squares builder</div>

          <div style={styles.heroTitleRow}>
            <h1 style={styles.heroTitle}>
              {title.trim() ? title : "Build a premium squares game"}
            </h1>

            <div style={styles.statusPill}>{status || "draft"}</div>
          </div>

          <p style={styles.heroSlug}>/s/{slug.trim() ? slug : "squares-slug"}</p>

          <p style={styles.heroDescription}>
            Create the public campaign, configure the board, set pricing, add
            prizes and keep legal entry requirements in one polished setup flow.
          </p>

          <div style={styles.heroMetricGrid}>
            <HeroMetric label="Total squares" value={boardSize} />
            <HeroMetric
              label="Price / square"
              value={formatPreviewMoney(price, currency)}
            />
            <HeroMetric
              label="Max sales"
              value={formatPreviewMoney(estimatedTotal, currency)}
            />
            <HeroMetric label="Public prizes" value={publicPrizesCount} />
          </div>
        </div>

        <div style={styles.previewShell}>
          <div style={styles.previewBadge}>Public preview</div>

          <div style={styles.previewImageWrap}>
            {imageUrl ? (
              <img
                src={imageUrl}
                alt="Squares preview"
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  objectPosition: `${imageFocusX}% ${imageFocusY}%`,
                  display: "block",
                }}
              />
            ) : (
              <img
                src={DEFAULT_SQUARES_IMAGE}
                alt="Squares placeholder"
                style={styles.placeholderImage}
              />
            )}
          </div>

          <div style={styles.previewCardBody}>
            <div style={styles.previewTitle}>
              {title.trim() ? title : "Your squares game"}
            </div>

            <div style={styles.previewText}>
              {description.trim()
                ? description.trim().slice(0, 92)
                : "A short public summary of your squares game will appear here."}
              {description.trim().length > 92 ? "…" : ""}
            </div>

            <div style={styles.previewBottom}>
              <span>{formatPreviewMoney(price, currency)} each</span>
              <span>{boardSize} squares</span>
            </div>
          </div>
        </div>
      </section>

      <section style={styles.summaryGrid}>
        <SummaryCard label="Total squares" value={boardSize} />
        <SummaryCard
          label="Price / square"
          value={formatPreviewMoney(price, currency)}
        />
        <SummaryCard
          label="Max sales"
          value={formatPreviewMoney(estimatedTotal, currency)}
        />
        <SummaryCard
          label="Board shape"
          value={`${boardShape.columns} columns`}
        />
        <SummaryCard label="Public prizes" value={publicPrizesCount} />
      </section>
            <section style={styles.section}>
        <SectionHeader
          eyebrow="Section 1"
          title="Campaign details"
          description="Set the public title, URL, description and draw date."
        />

        <div style={styles.formInner}>
          <div style={styles.twoColumn}>
            <Field label="Squares game title">
              <input
                name="title"
                required
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                style={styles.input}
                placeholder="Summer fundraiser squares"
              />
            </Field>

            <Field label="Public URL slug">
              <input
                name="slug"
                required
                value={slug}
                onChange={(event) => {
                  setSlugEdited(true);
                  setSlug(slugify(event.target.value));
                }}
                style={styles.input}
                placeholder="summer-fundraiser-squares"
              />
            </Field>
          </div>

          <Field label="Public description">
            <textarea
              name="description"
              rows={5}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              style={styles.textarea}
              placeholder="Describe the game, prizes, event details and draw information."
            />
          </Field>

          <div style={styles.twoColumn}>
            <Field label="Draw date">
              <input
                name="draw_at"
                type="datetime-local"
                value={drawAt}
                onChange={(event) => setDrawAt(event.target.value)}
                style={styles.input}
              />
            </Field>

            <div style={styles.datePreview}>
              <span style={styles.datePreviewLabel}>Draw preview</span>
              <strong>{formatDatePreview(drawAt)}</strong>
            </div>
          </div>
        </div>
      </section>

      <CollapsedSection
        eyebrow="Section 2"
        title="Squares setup"
        description="Configure board size, square price, currency and publication status."
        summary={`${boardSize} squares · ${formatPreviewMoney(
          price,
          currency,
        )} each · ${status}`}
      >
        <div style={styles.formInner}>
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

          <div style={styles.boardPreviewCard}>
            <div style={styles.boardPreviewTop}>
              <div>
                <div style={styles.boardPreviewLabel}>Board preview</div>

                <div style={styles.boardPreviewValue}>
                  {boardShape.columns} × {boardShape.rows}
                </div>
              </div>

              <div style={styles.boardPreviewStats}>{boardSize} squares</div>
            </div>

            <div
              style={{
                ...styles.boardGrid,
                gridTemplateColumns: `repeat(${Math.min(
                  boardShape.columns,
                  10,
                )}, minmax(0, 1fr))`,
              }}
            >
              {Array.from({
                length: Math.min(boardSize, 50),
              }).map((_, index) => (
                <div key={index} style={styles.boardCell}>
                  {index + 1}
                </div>
              ))}
            </div>

            {boardSize > 50 ? (
              <p style={styles.helpText}>
                Showing first 50 squares as a preview. The public board will use
                the full {boardSize} squares.
              </p>
            ) : null}
          </div>
        </div>
      </CollapsedSection>

      <CollapsedSection
        eyebrow="Section 3"
        title="Squares image"
        description="Upload a strong public image and choose the crop focus."
        summary={imageUrl ? "Custom image selected" : "Using default image"}
      >
        <div style={styles.mediaBox}>
          <div style={styles.mediaControls}>
            <ImageFocusUploadField
              currentImageUrl={imageUrl}
              currentFocusX={imageFocusX}
              currentFocusY={imageFocusY}
              label="Squares image"
              previewAlt={title.trim() || "Squares preview"}
              onImageUrlChange={setImageUrl}
              onFocusXChange={setImageFocusX}
              onFocusYChange={setImageFocusY}
            />
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
                  objectPosition: `${imageFocusX}% ${imageFocusY}%`,
                  display: "block",
                }}
              />
            ) : (
              <img
                src={DEFAULT_SQUARES_IMAGE}
                alt="Squares placeholder"
                style={styles.previewPlaceholderImage}
              />
            )}
          </div>
        </div>
      </CollapsedSection>

      <CollapsedSection
        eyebrow="Section 4"
        title="Prize settings"
        description="Add prizes and choose which ones appear publicly on the campaign page."
        summary={`${publicPrizesCount} public prize${
          publicPrizesCount === 1 ? "" : "s"
        }`}
      >
        <div style={styles.prizePanel}>
          <div style={styles.innerHeader}>
            <div>
              <h3 style={styles.subTitle}>Public prize list</h3>

              <p style={styles.sectionDescription}>
                These prizes can also be used later during winner draws.
              </p>
            </div>

            <button type="button" onClick={addPrize} style={styles.goldButton}>
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
        </div>
      </CollapsedSection>
            <CollapsedSection
        eyebrow="Section 5"
        title="Entry question"
        description="Optional skill-based question for the public checkout flow."
        summary={hasLegalQuestion ? "Configured" : "Not configured"}
      >
        <div style={styles.legalBody}>
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
            The public squares page requires this answer before checkout when a
            question is set.
          </p>
        </div>
      </CollapsedSection>

      <CollapsedSection
        eyebrow="Section 6"
        title="Free postal entry"
        description="Add no-purchase entry instructions shown on the public squares page."
        summary={hasFreeEntry ? "Configured" : "Not configured"}
      >
        <div style={styles.legalBody}>
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

          <div style={styles.complianceRow}>
            <CheckItem done={hasLegalQuestion}>Skill question configured</CheckItem>
            <CheckItem done={hasFreeEntry}>Free entry details configured</CheckItem>
          </div>
        </div>
      </CollapsedSection>

      <section style={styles.submitBar}>
        <div style={styles.submitText}>
          <strong style={{ color: "#0f172a" }}>Create squares game</strong>

          <div style={styles.mutedSmall}>
            Save as draft first if you want to review before publishing.
          </div>
        </div>

        <button type="submit" style={styles.submitButton}>
          Create squares game
        </button>
      </section>
    </form>
  );
}

function HeroMetric({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div style={styles.heroMetric}>
      <div style={styles.heroMetricLabel}>{label}</div>
      <div style={styles.heroMetricValue}>{value}</div>
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div style={styles.summaryCard}>
      <div style={styles.summaryLabel}>{label}</div>
      <div style={styles.summaryValue}>{value}</div>
    </div>
  );
}

function SectionHeader({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div style={styles.sectionHeader}>
      <div>
        <div style={styles.sectionEyebrow}>{eyebrow}</div>
        <h2 style={styles.sectionTitle}>{title}</h2>
        <p style={styles.sectionDescription}>{description}</p>
      </div>
    </div>
  );
}

function CollapsedSection({
  eyebrow,
  title,
  description,
  summary,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  summary: string;
  children: ReactNode;
}) {
  return (
    <details style={styles.collapsedSection}>
      <summary style={styles.collapsedSummary}>
        <div style={styles.collapsedHeading}>
          <div style={styles.sectionEyebrow}>{eyebrow}</div>
          <h2 style={styles.sectionTitle}>{title}</h2>
          <p style={styles.sectionDescription}>{description}</p>
        </div>

        <div style={styles.collapsedControls}>
          <span style={styles.summaryPill}>{summary}</span>
          <span style={styles.legalToggle}>Open / close</span>
        </div>
      </summary>

      <div style={styles.collapsedBody}>{children}</div>
    </details>
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

function CheckItem({
  done,
  children,
}: {
  done: boolean;
  children: ReactNode;
}) {
  return (
    <div style={styles.checkItem}>
      <span
        style={{
          ...styles.checkIcon,
          background: done ? "#16a34a" : "#e2e8f0",
          color: done ? "#ffffff" : "#64748b",
        }}
      >
        {done ? "✓" : "•"}
      </span>

      <span>{children}</span>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  form: {
    display: "grid",
    gap: 16,
    width: "100%",
    maxWidth: 1040,
    margin: "40px auto",
    padding: "0 16px 48px",
    boxSizing: "border-box",
  },
  hero: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1.15fr) minmax(280px, 0.85fr)",
    gap: 20,
    alignItems: "stretch",
    padding: "clamp(20px, 4vw, 26px)",
    borderRadius: 28,
    background:
      "radial-gradient(circle at top left, rgba(59,130,246,0.22), transparent 34%), linear-gradient(135deg, #020617 0%, #0f172a 54%, #172554 100%)",
    color: "#ffffff",
    overflow: "hidden",
    boxShadow: "0 24px 60px rgba(15,23,42,0.18)",
  },
  heroContent: {
    minWidth: 0,
  },
  eyebrow: {
    display: "inline-flex",
    padding: "6px 10px",
    borderRadius: 999,
    background: "rgba(255,255,255,0.12)",
    color: "#bfdbfe",
    fontSize: 12,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.1em",
    marginBottom: 12,
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
    fontSize: "clamp(34px, 5vw, 48px)",
    lineHeight: 1.02,
    letterSpacing: "-0.06em",
    wordBreak: "break-word",
    overflowWrap: "anywhere",
    maxWidth: 680,
  },
  statusPill: {
    padding: "8px 12px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.22)",
    fontSize: 13,
    textTransform: "capitalize",
    fontWeight: 900,
    background: "rgba(255,255,255,0.1)",
    color: "#ffffff",
  },
  heroSlug: {
    margin: "10px 0 0",
    color: "#bfdbfe",
    fontSize: 14,
    fontWeight: 800,
    wordBreak: "break-word",
  },
  heroDescription: {
    margin: "14px 0 0",
    color: "#dbeafe",
    lineHeight: 1.65,
    maxWidth: 720,
    overflowWrap: "anywhere",
    fontSize: 16,
  },
  heroMetricGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
    gap: 10,
    marginTop: 22,
  },
  heroMetric: {
    padding: "13px 14px",
    borderRadius: 18,
    background: "rgba(255,255,255,0.09)",
    border: "1px solid rgba(255,255,255,0.16)",
  },
  heroMetricLabel: {
    color: "#bfdbfe",
    fontSize: 12,
    fontWeight: 900,
  },
  heroMetricValue: {
    marginTop: 4,
    color: "#ffffff",
    fontSize: 20,
    fontWeight: 950,
    letterSpacing: "-0.03em",
  },
  previewShell: {
    display: "grid",
    alignContent: "start",
    gap: 12,
    borderRadius: 24,
    padding: 14,
    background: "rgba(255,255,255,0.1)",
    border: "1px solid rgba(255,255,255,0.18)",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.08)",
  },
  previewBadge: {
    justifySelf: "start",
    padding: "6px 10px",
    borderRadius: 999,
    background: "#ffffff",
    color: "#0f172a",
    fontSize: 12,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
  },
  previewImageWrap: {
    height: 210,
    borderRadius: 20,
    background: "#ffffff",
    border: "1px solid rgba(255,255,255,0.18)",
    overflow: "hidden",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  placeholderImage: {
    width: "min(82%, 210px)",
    height: "min(82%, 210px)",
    objectFit: "contain",
    display: "block",
  },
  previewCardBody: {
    padding: 14,
    borderRadius: 18,
    background: "#ffffff",
    color: "#0f172a",
  },
  previewTitle: {
    fontSize: 18,
    fontWeight: 950,
    letterSpacing: "-0.03em",
  },
  previewText: {
    marginTop: 6,
    color: "#64748b",
    fontSize: 13,
    lineHeight: 1.45,
  },
  previewBottom: {
    display: "flex",
    justifyContent: "space-between",
    gap: 10,
    flexWrap: "wrap",
    marginTop: 12,
    color: "#0f172a",
    fontSize: 13,
    fontWeight: 900,
  },
  summaryGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 150px), 1fr))",
    gap: 12,
  },
  summaryCard: {
    padding: 15,
    borderRadius: 18,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    boxShadow: "0 2px 12px rgba(15,23,42,0.04)",
    minWidth: 0,
  },
  summaryLabel: {
    color: "#64748b",
    fontSize: 12,
    fontWeight: 900,
  },
  summaryValue: {
    color: "#0f172a",
    fontSize: 22,
    fontWeight: 950,
    marginTop: 5,
    wordBreak: "break-word",
  },
  section: {
    padding: "clamp(16px, 4vw, 20px)",
    borderRadius: 24,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    boxShadow: "0 2px 12px rgba(15,23,42,0.04)",
    minWidth: 0,
    overflow: "hidden",
  },
  collapsedSection: {
    padding: "clamp(16px, 4vw, 20px)",
    borderRadius: 24,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    boxShadow: "0 2px 12px rgba(15,23,42,0.04)",
    minWidth: 0,
    overflow: "hidden",
  },
  collapsedSummary: {
    display: "flex",
    justifyContent: "space-between",
    gap: 14,
    alignItems: "flex-start",
    cursor: "pointer",
    listStyle: "none",
  },
  collapsedHeading: {
    minWidth: 0,
  },
  collapsedControls: {
    display: "flex",
    gap: 8,
    alignItems: "center",
    justifyContent: "flex-end",
    flexWrap: "wrap",
    flexShrink: 0,
  },
  collapsedBody: {
    marginTop: 16,
  },
  summaryPill: {
    padding: "8px 12px",
    borderRadius: 999,
    background: "#f8fafc",
    color: "#334155",
    border: "1px solid #dbe3ef",
    fontSize: 12,
    fontWeight: 950,
    whiteSpace: "nowrap",
  },
  sectionHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "flex-start",
    flexWrap: "wrap",
    marginBottom: 16,
  },
  sectionEyebrow: {
    color: "#2563eb",
    fontSize: 12,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    marginBottom: 5,
  },
  sectionTitle: {
    margin: 0,
    color: "#0f172a",
    fontSize: 24,
    letterSpacing: "-0.03em",
  },
  sectionDescription: {
    margin: "5px 0 0",
    color: "#64748b",
    fontSize: 14,
    lineHeight: 1.45,
    overflowWrap: "anywhere",
  },
  formInner: {
    display: "grid",
    gap: 16,
  },
  twoColumn: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 240px), 1fr))",
    gap: 12,
  },
  fourColumn: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 150px), 1fr))",
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
    minHeight: 46,
    padding: "11px 12px",
    borderRadius: 13,
    border: "1px solid #cbd5e1",
    background: "#ffffff",
    color: "#0f172a",
    fontSize: 16,
    boxSizing: "border-box",
    minWidth: 0,
  },
  textarea: {
    width: "100%",
    padding: "11px 12px",
    borderRadius: 13,
    border: "1px solid #cbd5e1",
    background: "#ffffff",
    color: "#0f172a",
    fontSize: 16,
    resize: "vertical",
    boxSizing: "border-box",
    minWidth: 0,
  },
  datePreview: {
    display: "grid",
    alignContent: "center",
    minHeight: 46,
    padding: "11px 12px",
    borderRadius: 16,
    background: "#eff6ff",
    border: "1px solid #bfdbfe",
    color: "#1e3a8a",
    fontSize: 14,
    fontWeight: 900,
  },
  datePreviewLabel: {
    display: "block",
    color: "#2563eb",
    fontSize: 12,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    marginBottom: 2,
  },
  boardPreviewCard: {
    padding: 16,
    borderRadius: 20,
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
  },
  boardPreviewTop: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "flex-start",
    flexWrap: "wrap",
    marginBottom: 14,
  },
  boardPreviewLabel: {
    color: "#64748b",
    fontSize: 12,
    fontWeight: 900,
  },
  boardPreviewValue: {
    color: "#0f172a",
    fontSize: 22,
    fontWeight: 950,
    letterSpacing: "-0.03em",
    marginTop: 4,
  },
  boardPreviewStats: {
    padding: "8px 12px",
    borderRadius: 999,
    background: "#ffffff",
    border: "1px solid #dbe3ef",
    color: "#334155",
    fontSize: 13,
    fontWeight: 900,
  },
  boardGrid: {
    display: "grid",
    gap: 6,
  },
  boardCell: {
    aspectRatio: "1 / 1",
    minHeight: 28,
    borderRadius: 9,
    background: "#ffffff",
    border: "1px solid #dbe3ef",
    color: "#334155",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 12,
    fontWeight: 900,
  },
  mediaBox: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 260px), 1fr))",
    gap: 16,
    padding: 14,
    borderRadius: 20,
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    minWidth: 0,
  },
  mediaControls: {
    minWidth: 0,
  },
  previewBox: {
    height: 220,
    borderRadius: 18,
    border: "1px solid #e2e8f0",
    background: "#ffffff",
    overflow: "hidden",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  previewPlaceholderImage: {
    width: "min(82%, 200px)",
    height: "min(82%, 200px)",
    objectFit: "contain",
    display: "block",
  },
  prizePanel: {
    display: "grid",
    gap: 14,
    padding: "clamp(14px, 4vw, 16px)",
    borderRadius: 22,
    background:
      "linear-gradient(135deg, #fffbeb 0%, #ffffff 48%, #f8fafc 100%)",
    border: "1px solid #fde68a",
    minWidth: 0,
    overflow: "hidden",
  },
  innerHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "flex-start",
    flexWrap: "wrap",
  },
  subTitle: {
    margin: 0,
    color: "#0f172a",
    fontSize: 18,
    letterSpacing: "-0.01em",
  },
  goldButton: {
    padding: "10px 14px",
    borderRadius: 999,
    border: "1px solid #facc15",
    background: "#fef3c7",
    color: "#92400e",
    cursor: "pointer",
    fontWeight: 950,
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
    border: "1px solid #fde68a",
    borderRadius: 18,
    background: "#ffffff",
    minWidth: 0,
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
    gridTemplateColumns: "minmax(96px, 120px) minmax(0, 1fr)",
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
  legalToggle: {
    padding: "8px 12px",
    borderRadius: 999,
    background: "#eff6ff",
    color: "#1d4ed8",
    border: "1px solid #bfdbfe",
    fontSize: 12,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.04em",
    flexShrink: 0,
    whiteSpace: "nowrap",
  },
  legalBody: {
    display: "grid",
    gap: 12,
  },
  complianceRow: {
    display: "grid",
    gap: 10,
    padding: 14,
    borderRadius: 18,
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
  },
  checkItem: {
    display: "flex",
    gap: 9,
    alignItems: "center",
    color: "#334155",
    fontSize: 14,
    fontWeight: 800,
  },
  checkIcon: {
    width: 22,
    height: 22,
    borderRadius: 999,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 12,
    fontWeight: 950,
    flexShrink: 0,
  },
  helpText: {
    color: "#64748b",
    fontSize: 13,
    margin: 0,
    overflowWrap: "anywhere",
  },
  mutedSmall: {
    color: "#64748b",
    fontSize: 13,
    marginTop: 3,
  },
  submitBar: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 14,
    flexWrap: "wrap",
    padding: 16,
    borderRadius: 20,
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
  },
  submitText: {
    minWidth: 0,
    flex: "1 1 240px",
  },
  submitButton: {
    padding: "13px 20px",
    border: "none",
    borderRadius: 999,
    background: "#1683f8",
    color: "#ffffff",
    fontWeight: 950,
    cursor: "pointer",
    boxShadow: "0 10px 20px rgba(22,131,248,0.22)",
  },
};
