"use client";

import Link from "next/link";
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

type SectionTone = "default" | "setup" | "media" | "prize" | "legal";

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
    const safeAmount = Number.isFinite(amount) ? amount.toFixed(2) : "0.00";
    return `${safeAmount} ${currency || "GBP"}`;
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

function getSectionToneStyle(tone: SectionTone): CSSProperties {
  if (tone === "setup") {
    return {
      background:
        "linear-gradient(135deg, #eff6ff 0%, #ffffff 48%, #f8fafc 100%)",
      borderColor: "#bfdbfe",
    };
  }

  if (tone === "media") {
    return {
      background:
        "linear-gradient(135deg, #f8fafc 0%, #ffffff 48%, #eef2ff 100%)",
      borderColor: "#c7d2fe",
    };
  }

  if (tone === "prize") {
    return {
      background:
        "linear-gradient(135deg, #fffbeb 0%, #ffffff 52%, #f8fafc 100%)",
      borderColor: "#fde68a",
    };
  }

  if (tone === "legal") {
    return {
      background:
        "linear-gradient(135deg, #f5f3ff 0%, #ffffff 52%, #eff6ff 100%)",
      borderColor: "#ddd6fe",
    };
  }

  return {
    background: "#ffffff",
    borderColor: "#e2e8f0",
  };
}

function prizeText(count: number) {
  return `${count} prize${count === 1 ? "" : "s"}`;
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
    <form
      className="new-squares-form"
      action="/api/admin/squares"
      method="post"
      style={styles.form}
    >
      <style>{responsiveStyles}</style>

      <input type="hidden" name="image_position" value="center" />
      <input type="hidden" name="prizes" value={prizesValue} />
      <input type="hidden" name="question" value={questionValue} />
      <input type="hidden" name="free_entry" value={freeEntryValue} />

      <section style={styles.topActions}>
        <Link href="/admin/squares" style={styles.backButton}>
          ← Back to squares
        </Link>

        <Link href="/admin" style={styles.dashboardButton}>
          Dashboard
        </Link>
      </section>

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

          <p style={styles.heroUseCase}>
            Perfect for football cards, race nights, finals, ceilidhs and live
            fundraising events.
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

            <HeroMetric
              label="Public prizes"
              value={prizeText(publicPrizesCount)}
            />
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

            <div style={styles.previewMetaGrid}>
              <span style={styles.previewMetaItem}>
                {formatPreviewMoney(price, currency)} each
              </span>

              <span style={styles.previewMetaItem}>{boardSize} squares</span>

              <span style={styles.previewMetaItem}>
                {formatDatePreview(drawAt)}
              </span>

              <span style={styles.previewMetaItem}>
                {prizeText(publicPrizesCount)}
              </span>
            </div>
          </div>
        </div>
      </section>
            <section style={styles.summaryGrid}>
        <SummaryCard
          label="Estimated revenue"
          value={formatPreviewMoney(estimatedTotal, currency)}
        />

        <SummaryCard label="Board size" value={`${boardSize} squares`} />

        <SummaryCard
          label="Draw status"
          value={drawAt ? "Scheduled" : "Not scheduled"}
        />

        <SummaryCard
          label="Legal readiness"
          value={hasLegalQuestion || hasFreeEntry ? "In progress" : "Not set"}
        />

        <SummaryCard label="Public prizes" value={prizeText(publicPrizesCount)} />
      </section>

      <section style={styles.readinessGrid}>
        <ReadinessCard eyebrow="Campaign readiness" title="Before publishing">
          <CheckItem done={Boolean(title.trim())}>Add campaign title</CheckItem>
          <CheckItem done={Boolean(slug.trim())}>Confirm public slug</CheckItem>
          <CheckItem done={Boolean(description.trim())}>Add description</CheckItem>
          <CheckItem done={boardSize > 0}>Set board size</CheckItem>
          <CheckItem done={price > 0}>Set price per square</CheckItem>
          <CheckItem done={publicPrizesCount > 0}>Add public prize</CheckItem>
        </ReadinessCard>

        <ReadinessCard
          eyebrow="Sales preview"
          title={formatPreviewMoney(estimatedTotal, currency)}
        >
          <PreviewLine label="Board" value={`${boardSize} squares`} />
          <PreviewLine
            label="Price"
            value={`${formatPreviewMoney(price, currency)} each`}
          />
          <PreviewLine
            label="Layout"
            value={`${boardShape.columns} × ${boardShape.rows}`}
          />
        </ReadinessCard>

        <ReadinessCard eyebrow="Compliance preview" title="Legal checks">
          <CheckItem done={hasLegalQuestion}>Skill question configured</CheckItem>
          <CheckItem done={hasFreeEntry}>Free postal entry configured</CheckItem>
          <CheckItem done={Boolean(drawAt)}>Draw date scheduled</CheckItem>
        </ReadinessCard>
      </section>

      <SectionCard
        number="01"
        title="Campaign details"
        description="Set the public title, URL, description and draw date."
        badge={drawAt ? "Draw scheduled" : undefined}
        tone="default"
      >
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
            rows={4}
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

          <div style={styles.drawPreviewField}>
            <div style={styles.label}>Draw preview</div>

            <div style={styles.drawPreviewInline}>
              <span style={styles.previewInfoValue}>
                {formatDatePreview(drawAt)}
              </span>
            </div>
          </div>
        </div>
      </SectionCard>

      <SectionCard
        number="02"
        title="Squares setup"
        description="Configure board size, square pricing, currency and publication status."
        badge={`${boardSize} squares • ${formatPreviewMoney(
          price,
          currency,
        )} each`}
        tone="setup"
      >
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

              <div style={styles.boardPreviewTitle}>
                {boardShape.columns} × {boardShape.rows}
              </div>
            </div>

            <div style={styles.boardPreviewBadge}>{boardSize} squares</div>
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
            {Array.from({ length: Math.min(boardSize, 50) }).map((_, index) => (
              <div key={index} style={styles.boardCell}>
                {index + 1}
              </div>
            ))}
          </div>

          <p style={styles.boardFootnote}>
            Showing first {Math.min(boardSize, 50)} squares as a preview. The
            public board will use the full {boardSize} squares.
          </p>
        </div>
      </SectionCard>

      <SectionCard
        number="03"
        title="Squares image"
        description="Upload a strong public image and choose the crop focus."
        badge={imageUrl ? "Image selected" : "Using default image"}
        tone="media"
      >
        <div style={styles.mediaBox}>
          <div style={styles.mediaControls}>
            <h3 style={styles.subTitle}>Squares image</h3>

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

          <div style={styles.previewBoxLarge}>
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
      </SectionCard>
            <SectionCard
        number="04"
        title="Prize settings"
        description="Add prizes and choose which ones appear publicly on the campaign page."
        badge={prizeText(publicPrizesCount)}
        tone="prize"
      >
        <div style={styles.prizeSectionShell}>
          <div style={styles.prizeSectionTop}>
            <div>
              <div style={styles.prizeSectionTitle}>Public prize list</div>

              <div style={styles.prizeSectionText}>
                These prizes can also be used later during winner draws.
              </div>
            </div>

            <button
              type="button"
              onClick={addPrize}
              style={styles.prizeAddButton}
            >
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
                        updatePrize(prize.id, {
                          title: event.target.value,
                        })
                      }
                      placeholder="1st Prize"
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
                    ...styles.removePrizeButton,
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
      </SectionCard>

      <SectionCard
        number="05"
        title="Entry question"
        description="Optional skill-based question for the public checkout flow."
        badge={hasLegalQuestion ? "Configured" : "Not configured"}
        tone="legal"
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
      </SectionCard>

      <SectionCard
        number="06"
        title="Free postal entry"
        description="Add no-purchase entry instructions shown on the public squares page."
        badge={hasFreeEntry ? "Configured" : "Not configured"}
        tone="legal"
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
      </SectionCard>

      <section style={styles.submitBar}>
        <div style={styles.submitText}>
          <div style={styles.submitEyebrow}>Ready to create?</div>

          <strong style={styles.submitTitle}>Create squares game</strong>

          <div style={styles.mutedSmall}>
            Save as draft first — you can review everything before publishing.
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

function ReadinessCard({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <div style={styles.readinessCard}>
      <div style={styles.readinessEyebrow}>{eyebrow}</div>
      <h3 style={styles.readinessTitle}>{title}</h3>
      <div style={styles.readinessBody}>{children}</div>
    </div>
  );
}

function PreviewLine({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div style={styles.previewLine}>
      <span style={styles.previewLineLabel}>{label}</span>
      <strong style={styles.previewLineValue}>{value}</strong>
    </div>
  );
}

function SectionCard({
  number,
  title,
  description,
  badge,
  tone = "default",
  children,
}: {
  number: string;
  title: string;
  description: string;
  badge?: string;
  tone?: SectionTone;
  children: ReactNode;
}) {
  const toneStyle = getSectionToneStyle(tone);

  if (number === "01") {
    return (
      <section style={{ ...styles.sectionCard, ...toneStyle }}>
        <div style={styles.sectionTop}>
          <div>
            <div style={styles.sectionNumber}>SECTION {number}</div>
            <h2 style={styles.sectionTitle}>{title}</h2>
            <p style={styles.sectionDescription}>{description}</p>
          </div>

          {badge ? <span style={styles.sectionBadge}>{badge}</span> : null}
        </div>

        <div style={styles.sectionBody}>{children}</div>
      </section>
    );
  }

  return (
    <details style={{ ...styles.sectionCard, ...toneStyle }}>
      <summary style={styles.sectionSummary}>
        <div style={styles.sectionSummaryText}>
          <div style={styles.sectionNumber}>SECTION {number}</div>
          <h2 style={styles.sectionTitle}>{title}</h2>
          <p style={styles.sectionDescription}>{description}</p>
        </div>

        <div style={styles.sectionActions}>
          {badge ? <span style={styles.sectionBadge}>{badge}</span> : null}
          <span style={styles.openButton}>OPEN</span>
        </div>
      </summary>

      <div style={styles.sectionBody}>{children}</div>
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

const responsiveStyles = `
  .new-squares-form,
  .new-squares-form * {
    box-sizing: border-box;
  }

  .new-squares-form {
    overflow-x: hidden;
  }

  @media (max-width: 760px) {
    .new-squares-form [style*="grid-template-columns"] {
      grid-template-columns: 1fr !important;
    }
  }
`;

const styles: Record<string, CSSProperties> = {
  drawPreviewField: {
    display: "grid",
    gap: 7,
    alignContent: "start",
  },

  drawPreviewInline: {
    minHeight: 48,
    display: "flex",
    alignItems: "center",
    padding: "12px 14px",
    borderRadius: 14,
    background: "#eff6ff",
    border: "1px solid #bfdbfe",
    color: "#1e3a8a",
    width: "100%",
    boxSizing: "border-box",
  },

  previewInfoValue: {
    color: "#1e3a8a",
    fontSize: 15,
    lineHeight: 1.25,
    fontWeight: 950,
  },

  form: {
    display: "grid",
    gap: 16,
    width: "100%",
    maxWidth: 1040,
    margin: "40px auto",
    padding: "0 16px 64px",
    boxSizing: "border-box",
  },

  topActions: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    flexWrap: "wrap",
  },

  backButton: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "12px 18px",
    borderRadius: 999,
    background: "#ffffff",
    color: "#0f172a",
    border: "1px solid #cbd5e1",
    textDecoration: "none",
    fontWeight: 950,
  },

  dashboardButton: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "12px 18px",
    borderRadius: 999,
    background: "#0f172a",
    color: "#ffffff",
    border: "1px solid #0f172a",
    textDecoration: "none",
    fontWeight: 950,
  },

  hero: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1.15fr) minmax(280px, 0.85fr)",
    gap: 20,
    alignItems: "stretch",
    padding: 24,
    borderRadius: 28,
    background:
      "radial-gradient(circle at top left, rgba(59,130,246,0.22), transparent 34%), linear-gradient(135deg, #020617 0%, #0f172a 54%, #172554 100%)",
    color: "#ffffff",
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
  },

  heroDescription: {
    margin: "14px 0 0",
    color: "#dbeafe",
    lineHeight: 1.65,
    maxWidth: 720,
    fontSize: 16,
  },
};
