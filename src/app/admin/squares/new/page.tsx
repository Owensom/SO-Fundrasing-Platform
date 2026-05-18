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

type Props = {
  subscriptionTier?: string | null;
  customImagesAllowed?: boolean;
};

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

export default function NewSquaresGamePage({
  subscriptionTier,
  customImagesAllowed = false,
}: Props) {
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

type Props = {
  subscriptionTier?: string | null;
  customImagesAllowed?: boolean;
};

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

export default function NewSquaresGamePage({
  subscriptionTier,
  customImagesAllowed = false,
}: Props) {
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

          <div style={styles.previewInfoCard}>
            <div style={styles.previewInfoLabel}>Draw preview</div>

            <div style={styles.previewInfoValue}>
              {formatDatePreview(drawAt)}
            </div>
          </div>
        </div>
      </SectionCard>

      <SectionCard
        number="02"
        title="Squares setup"
        description="Configure board size, square pricing, currency and publication status."
        badge={`${Math.max(1, toInt(totalSquares, 100))} squares`}
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
                {board.columns} × {board.rows}
              </div>
            </div>

            <div style={styles.boardPreviewBadge}>
              {Math.max(1, toInt(totalSquares, 100))} squares
            </div>
          </div>

          <div
            style={{
              ...styles.boardGrid,
              gridTemplateColumns: `repeat(${Math.min(
                board.columns,
                10,
              )}, minmax(0, 1fr))`,
            }}
          >
            {Array.from({
              length: Math.min(Math.max(1, toInt(totalSquares, 100)), 50),
            }).map((_, index) => (
              <div key={index} style={styles.boardCell}>
                {index + 1}
              </div>
            ))}
          </div>

          <p style={styles.boardFootnote}>
            Showing first {Math.min(Math.max(1, toInt(totalSquares, 100)), 50)}{" "}
            squares as a preview. The public board will use the full{" "}
            {Math.max(1, toInt(totalSquares, 100))} squares.
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
              subscriptionTier={subscriptionTier}
              customImagesAllowed={customImagesAllowed}
              onImageUrlChange={setImageUrl}
              onFocusXChange={setImageFocusX}
              onFocusYChange={setImageFocusY}
            />
          </div>

          <div style={styles.previewBoxLarge}>
            <img
              src={previewImage}
              alt={title.trim() || "Squares preview"}
              style={{
                width: "100%",
                height: "100%",
                objectFit: imageUrl ? "cover" : "contain",
                objectPosition: `${imageFocusX}% ${imageFocusY}%`,
                display: "block",
                background:
                  "linear-gradient(135deg, #ffffff 0%, #f8fafc 55%, #eff6ff 100%)",
              }}
            />
          </div>
        </div>
      </SectionCard>
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

          <div style={styles.previewInfoCard}>
            <div style={styles.previewInfoLabel}>Draw preview</div>

            <div style={styles.previewInfoValue}>
              {formatDatePreview(drawAt)}
            </div>
          </div>
        </div>
      </SectionCard>

      <SectionCard
        number="02"
        title="Squares setup"
        description="Configure board size, square pricing, currency and publication status."
        badge={`${Math.max(1, toInt(totalSquares, 100))} squares`}
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
                {board.columns} × {board.rows}
              </div>
            </div>

            <div style={styles.boardPreviewBadge}>
              {Math.max(1, toInt(totalSquares, 100))} squares
            </div>
          </div>

          <div
            style={{
              ...styles.boardGrid,
              gridTemplateColumns: `repeat(${Math.min(
                board.columns,
                10,
              )}, minmax(0, 1fr))`,
            }}
          >
            {Array.from({
              length: Math.min(Math.max(1, toInt(totalSquares, 100)), 50),
            }).map((_, index) => (
              <div key={index} style={styles.boardCell}>
                {index + 1}
              </div>
            ))}
          </div>

          <p style={styles.boardFootnote}>
            Showing first {Math.min(Math.max(1, toInt(totalSquares, 100)), 50)}{" "}
            squares as a preview. The public board will use the full{" "}
            {Math.max(1, toInt(totalSquares, 100))} squares.
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
              subscriptionTier={subscriptionTier}
              customImagesAllowed={customImagesAllowed}
              onImageUrlChange={setImageUrl}
              onFocusXChange={setImageFocusX}
              onFocusYChange={setImageFocusY}
            />
          </div>

          <div style={styles.previewBoxLarge}>
            <img
              src={previewImage}
              alt={title.trim() || "Squares preview"}
              style={{
                width: "100%",
                height: "100%",
                objectFit: imageUrl ? "cover" : "contain",
                objectPosition: `${imageFocusX}% ${imageFocusY}%`,
                display: "block",
                background:
                  "linear-gradient(135deg, #ffffff 0%, #f8fafc 55%, #eff6ff 100%)",
              }}
            />
          </div>
        </div>
      </SectionCard>
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
  const isOverview = number === "01";

  if (isOverview) {
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

  .new-squares-form img,
  .new-squares-form input,
  .new-squares-form textarea,
  .new-squares-form select,
  .new-squares-form button {
    max-width: 100%;
  }

  .new-squares-form details > summary {
    list-style: none;
  }

  .new-squares-form details > summary::-webkit-details-marker {
    display: none;
  }

  .new-squares-form input[type="datetime-local"]::-webkit-date-and-time-value {
    text-align: left;
  }

  @media (max-width: 760px) {
    .new-squares-form {
      width: 100% !important;
      max-width: 100% !important;
      margin: 0 auto !important;
      padding: 18px 12px 44px !important;
    }

    .new-squares-form [style*="grid-template-columns"] {
      grid-template-columns: 1fr !important;
    }

    .new-squares-form section,
    .new-squares-form details,
    .new-squares-form div,
    .new-squares-form label {
      min-width: 0 !important;
      max-width: 100% !important;
    }

    .new-squares-form h1 {
      font-size: clamp(34px, 12vw, 46px) !important;
      line-height: 1.02 !important;
      letter-spacing: -0.055em !important;
      overflow-wrap: anywhere !important;
    }

    .new-squares-form h2 {
      font-size: clamp(28px, 9vw, 36px) !important;
      line-height: 1.05 !important;
      overflow-wrap: anywhere !important;
    }

    .new-squares-form p,
    .new-squares-form span,
    .new-squares-form strong {
      overflow-wrap: anywhere !important;
    }

    .new-squares-form [style*="height: 240px"],
    .new-squares-form [style*="height: 230px"] {
      height: auto !important;
      min-height: 190px !important;
      aspect-ratio: 16 / 10 !important;
    }

    .new-squares-form [style*="display: flex"] {
      flex-wrap: wrap !important;
    }

    .new-squares-form button,
    .new-squares-form a {
      min-height: 46px !important;
    }
  }

  @media (max-width: 520px) {
    .new-squares-form > div:first-child {
      display: grid !important;
      grid-template-columns: 1fr !important;
      gap: 10px !important;
    }

    .new-squares-form > div:first-child a {
      width: 100% !important;
      justify-content: center !important;
    }

    .new-squares-form section,
    .new-squares-form details {
      border-radius: 22px !important;
    }

    .new-squares-form input,
    .new-squares-form textarea,
    .new-squares-form select {
      font-size: 16px !important;
    }

    .new-squares-form button {
      width: 100% !important;
      justify-content: center !important;
    }
  }
`;

const styles: Record<string, CSSProperties> = {
  form: {
    display: "grid",
    gap: 16,
    width: "100%",
    maxWidth: 1040,
    margin: "40px auto",
    padding: "0 16px 64px",
    boxSizing: "border-box",
    overflowX: "hidden",
  },
  topBar: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    flexWrap: "wrap",
    marginBottom: 2,
  },
  backLink: {
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
    boxShadow: "0 8px 20px rgba(15,23,42,0.06)",
  },
  dashboardLink: {
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
    boxShadow: "0 10px 24px rgba(15,23,42,0.16)",
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
  heroUseCase: {
    margin: "12px 0 0",
    padding: "10px 12px",
    borderRadius: 16,
    background: "rgba(255,255,255,0.08)",
    border: "1px solid rgba(255,255,255,0.14)",
    color: "#bfdbfe",
    fontSize: 14,
    lineHeight: 1.45,
    fontWeight: 800,
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
    height: 240,
    borderRadius: 20,
    background: "#ffffff",
    border: "1px solid rgba(255,255,255,0.18)",
    overflow: "hidden",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
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
  previewMetaGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 8,
    marginTop: 12,
  },
  previewMetaItem: {
    padding: "8px 10px",
    borderRadius: 12,
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    color: "#334155",
    fontSize: 12,
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
    fontSize: 21,
    fontWeight: 950,
    marginTop: 5,
    wordBreak: "break-word",
  },
  readinessGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 260px), 1fr))",
    gap: 14,
  },
  readinessCard: {
    padding: 18,
    borderRadius: 22,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    boxShadow: "0 2px 12px rgba(15,23,42,0.04)",
  },
  readinessEyebrow: {
    margin: 0,
    color: "#2563eb",
    fontSize: 12,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
  },
  readinessTitle: {
    margin: "8px 0 0",
    color: "#0f172a",
    fontSize: 22,
    lineHeight: 1.1,
    letterSpacing: "-0.03em",
  },
  readinessBody: {
    display: "grid",
    gap: 10,
    marginTop: 14,
  },
  previewLine: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "center",
    color: "#334155",
    fontSize: 14,
  },
  previewLineLabel: {
    color: "#64748b",
    fontWeight: 800,
  },
  previewLineValue: {
    color: "#0f172a",
    fontWeight: 950,
    textAlign: "right",
  },
  sectionCard: {
    padding: "clamp(18px, 4vw, 22px)",
    borderRadius: 24,
    border: "1px solid #e2e8f0",
    boxShadow: "0 2px 12px rgba(15,23,42,0.04)",
    minWidth: 0,
    overflow: "hidden",
  },
  sectionTop: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "flex-start",
    flexWrap: "wrap",
    marginBottom: 16,
  },
  sectionSummary: {
    display: "flex",
    justifyContent: "space-between",
    gap: 14,
    alignItems: "flex-start",
    cursor: "pointer",
    listStyle: "none",
  },
  sectionSummaryText: {
    minWidth: 0,
  },
  sectionActions: {
    display: "flex",
    gap: 7,
    alignItems: "center",
    justifyContent: "flex-end",
    flexWrap: "wrap",
    flexShrink: 0,
  },
  sectionNumber: {
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
  sectionBadge: {
    padding: "7px 10px",
    borderRadius: 999,
    background: "#ffffff",
    color: "#334155",
    border: "1px solid #dbe3ef",
    fontSize: 11,
    fontWeight: 950,
    whiteSpace: "nowrap",
  },
  openButton: {
    padding: "7px 10px",
    borderRadius: 999,
    background: "#eff6ff",
    color: "#1d4ed8",
    border: "1px solid #bfdbfe",
    fontSize: 11,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.04em",
    flexShrink: 0,
    whiteSpace: "nowrap",
  },
  sectionBody: {
    display: "grid",
    gap: 14,
    marginTop: 14,
  },
  twoColumn: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 240px), 1fr))",
    gap: 14,
  },
  fourColumn: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 150px), 1fr))",
    gap: 14,
  },
  field: {
    display: "grid",
    gap: 7,
    minWidth: 0,
  },
  label: {
    color: "#334155",
    fontSize: 13,
    fontWeight: 900,
  },
  input: {
    width: "100%",
    minHeight: 48,
    padding: "12px 13px",
    borderRadius: 14,
    border: "1px solid #cbd5e1",
    background: "#ffffff",
    color: "#0f172a",
    fontSize: 16,
    boxSizing: "border-box",
    minWidth: 0,
  },
  textarea: {
    width: "100%",
    padding: "12px 13px",
    borderRadius: 14,
    border: "1px solid #cbd5e1",
    background: "#ffffff",
    color: "#0f172a",
    fontSize: 16,
    resize: "vertical",
    boxSizing: "border-box",
    minWidth: 0,
  },
  previewInfoCard: {
    width: "100%",
    minHeight: 48,
    display: "grid",
    alignContent: "center",
    padding: "8px 13px",
    borderRadius: 14,
    background: "#eff6ff",
    border: "1px solid #bfdbfe",
    color: "#1e3a8a",
    boxSizing: "border-box",
  },
  previewInfoLabel: {
    color: "#2563eb",
    fontSize: 11,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    lineHeight: 1.2,
    marginBottom: 2,
  },
  previewInfoValue: {
    color: "#1e3a8a",
    fontSize: 15,
    lineHeight: 1.25,
    fontWeight: 950,
  },
  boardPreviewCard: {
    padding: 16,
    borderRadius: 20,
    background: "#ffffff",
    border: "1px solid #dbeafe",
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
    color: "#2563eb",
    fontSize: 12,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
  },
  boardPreviewTitle: {
    marginTop: 4,
    color: "#0f172a",
    fontSize: 26,
    fontWeight: 950,
    letterSpacing: "-0.04em",
  },
  boardPreviewBadge: {
    padding: "8px 12px",
    borderRadius: 999,
    background: "#eff6ff",
    border: "1px solid #bfdbfe",
    color: "#1d4ed8",
    fontSize: 13,
    fontWeight: 950,
  },
  boardGrid: {
    display: "grid",
    gap: 7,
  },
  boardCell: {
    aspectRatio: "1 / 1",
    minHeight: 34,
    borderRadius: 11,
    background:
      "linear-gradient(135deg, #ffffff 0%, #f8fafc 50%, #eff6ff 100%)",
    border: "1px solid #dbeafe",
    color: "#1e3a8a",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 12,
    fontWeight: 950,
    boxShadow:
      "inset 0 1px 0 rgba(255,255,255,0.9), 0 6px 14px rgba(15,23,42,0.04)",
  },
  boardFootnote: {
    color: "#64748b",
    fontSize: 13,
    lineHeight: 1.5,
    margin: "12px 0 0",
  },
  mediaBox: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 260px), 1fr))",
    gap: 16,
    padding: 14,
    borderRadius: 20,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    minWidth: 0,
  },
  mediaControls: {
    minWidth: 0,
  },
  subTitle: {
    margin: "0 0 10px",
    color: "#0f172a",
    fontSize: 18,
    letterSpacing: "-0.01em",
  },
  previewBoxLarge: {
    height: 230,
    borderRadius: 18,
    border: "1px solid #e2e8f0",
    background: "#ffffff",
    overflow: "hidden",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  prizeSectionShell: {
    display: "grid",
    gap: 14,
    padding: "clamp(14px, 4vw, 16px)",
    borderRadius: 22,
    background: "#ffffff",
    border: "1px solid #fde68a",
    minWidth: 0,
    overflow: "hidden",
  },
  prizeSectionTop: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "flex-start",
    flexWrap: "wrap",
  },
  prizeSectionTitle: {
    color: "#0f172a",
    fontSize: 18,
    fontWeight: 950,
    letterSpacing: "-0.02em",
  },
  prizeSectionText: {
    marginTop: 4,
    color: "#64748b",
    fontSize: 14,
    lineHeight: 1.45,
  },
  prizeAddButton: {
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
    background:
      "linear-gradient(135deg, #fffbeb 0%, #ffffff 55%, #f8fafc 100%)",
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
  removePrizeButton: {
    width: "fit-content",
    padding: "10px 12px",
    borderRadius: 999,
    border: "1px solid #fecaca",
    background: "#ffffff",
    color: "#b91c1c",
    fontWeight: 900,
  },
  legalBody: {
    display: "grid",
    gap: 14,
  },
  complianceRow: {
    display: "grid",
    gap: 10,
    padding: 14,
    borderRadius: 18,
    background: "#ffffff",
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
    padding: 22,
    borderRadius: 24,
    background:
      "linear-gradient(135deg, #ffffff 0%, #f8fafc 55%, #eff6ff 100%)",
    border: "1px solid #dbeafe",
    marginTop: 18,
    boxShadow: "0 10px 30px rgba(15,23,42,0.05)",
  },
  submitText: {
    minWidth: 0,
    flex: "1 1 240px",
  },
  submitEyebrow: {
    color: "#2563eb",
    fontSize: 12,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    marginBottom: 6,
  },
  submitTitle: {
    display: "block",
    color: "#0f172a",
    fontSize: 22,
    fontWeight: 950,
    letterSpacing: "-0.03em",
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
