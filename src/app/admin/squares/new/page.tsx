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

const styles: Record<string, CSSProperties> = {
  form: {
    display: "grid",
    gap: 16,
    width: "100%",
    maxWidth: 1040,
    margin: "40px auto",
    padding: "0 16px 64px",
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
  placeholderImage: {
    width: "min(82%, 218px)",
    height: "min(82%, 218px)",
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
    marginBottom: 18,
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
    gap: 18,
    marginTop: 18,
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
    display: "grid",
    alignContent: "center",
    minHeight: 48,
    padding: "12px 13px",
    borderRadius: 16,
    background: "#eff6ff",
    border: "1px solid #bfdbfe",
    color: "#1e3a8a",
    fontSize: 14,
    fontWeight: 900,
  },
  previewInfoLabel: {
    color: "#2563eb",
    fontSize: 12,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    marginBottom: 2,
  },
  previewInfoValue: {
    color: "#1e3a8a",
    fontSize: 14,
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
  previewPlaceholderImage: {
    width: "min(82%, 205px)",
    height: "min(82%, 205px)",
    objectFit: "contain",
    display: "block",
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
