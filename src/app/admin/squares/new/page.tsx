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

  const [campaignLimitReached, setCampaignLimitReached] = useState(false);

  const [prizes, setPrizes] = useState<PrizeRow[]>([
    makePrize("prize-1", "1", "1st Prize", ""),
  ]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setCampaignLimitReached(params.get("error") === "campaign_limit");
  }, []);

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

  const board = useMemo(() => {
    const total = Math.max(1, toInt(totalSquares, 100));
    return getBoardShape(total);
  }, [totalSquares]);

  const totalRevenue = useMemo(() => {
    const total = Math.max(0, toInt(totalSquares, 0));
    const price = Math.max(0, toMoney(pricePerSquare, 0));

    return total * price;
  }, [totalSquares, pricePerSquare]);

  const heroDescription =
    description.trim() ||
    "Build a premium fundraising squares experience with live draw excitement, premium visuals and integrated checkout.";

  const previewImage = imageUrl || DEFAULT_SQUARES_IMAGE;

  const hasQuestion = questionText.trim().length > 0;
  const hasPostalEntry =
    freeEntryAddress.trim().length > 0 ||
    freeEntryInstructions.trim().length > 0;

  function addPrize() {
    setPrizes((current) => [
      ...current,
      makePrize(
        safeId("prize"),
        String(current.length + 1),
        `${current.length + 1}${current.length + 1 === 1 ? "st" : "th"} Prize`,
      ),
    ]);
  }

  function updatePrize(
    id: string,
    field: keyof PrizeRow,
    value: string | boolean,
  ) {
    setPrizes((current) =>
      current.map((prize) =>
        prize.id === id ? { ...prize, [field]: value } : prize,
      ),
    );
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

      <div style={styles.topBar}>
        <Link href="/admin/squares" style={styles.backLink}>
          ← Back to squares
        </Link>

        <Link href="/admin" style={styles.dashboardLink}>
          Dashboard
        </Link>
      </div>

      {campaignLimitReached ? (
        <section style={styles.upgradeBanner}>
          <div style={styles.upgradeEyebrow}>Plan limit reached</div>

          <h1 style={styles.upgradeTitle}>
            Community plans can publish up to 2 active campaigns.
          </h1>

          <p style={styles.upgradeText}>
            This squares campaign was not published because this tenant already
            has the maximum number of active published campaigns allowed on the
            Community plan. Save this campaign as a draft, close an existing
            campaign, or upgrade to Professional for unlimited active campaigns.
          </p>

          <div style={styles.upgradeActions}>
            <Link href="/admin/billing" style={styles.primaryUpgradeButton}>
              View billing options
            </Link>

            <Link href="/admin/squares" style={styles.secondaryUpgradeButton}>
              Manage campaigns
            </Link>
          </div>
        </section>
      ) : null}

      <section style={styles.hero}>
        <div style={styles.heroContent}>
          <div style={styles.eyebrow}>Squares builder</div>

          <div style={styles.heroTitleRow}>
            <h1 className="so-brand-heading" style={styles.heroTitle}>
              {title.trim() || "Create a premium squares experience"}
            </h1>

            <div style={styles.statusPill}>
              {status === "published" ? "Published" : "Draft"}
            </div>
          </div>

          <p style={styles.heroSlug}>
            {slug.trim() ? `/s/${slug}` : "/s/your-squares-page"}
          </p>

          <p style={styles.heroDescription}>{heroDescription}</p>

          <div style={styles.heroUseCase}>
            Perfect for sports clubs, schools, charities and gala fundraising
            nights with instant live excitement.
          </div>

          <div style={styles.heroMetricGrid}>
            <HeroMetric
              label="Squares"
              value={Math.max(1, toInt(totalSquares, 100))}
            />

            <HeroMetric
              label="Price"
              value={formatPreviewMoney(pricePerSquare, currency)}
            />

            <HeroMetric
              label="Revenue"
              value={formatPreviewMoney(totalRevenue, currency)}
            />

            <HeroMetric
              label="Prizes"
              value={prizeText(publicPrizesCount)}
            />
          </div>
        </div>

        <div style={styles.previewShell}>
          <div style={styles.previewBadge}>Live preview</div>

          <div style={styles.previewImageWrap}>
            <img
              src={previewImage}
              alt={title.trim() || "Squares preview"}
              style={{
                width: "100%",
                height: "100%",
                display: "block",
                objectFit: imageUrl ? "cover" : "contain",
                objectPosition: `${imageFocusX}% ${imageFocusY}%`,
                background:
                  "linear-gradient(135deg, #ffffff 0%, #f8fafc 55%, #eff6ff 100%)",
              }}
            />
          </div>

          <div style={styles.previewCardBody}>
            <div style={styles.previewTitle}>
              {title.trim() || "Premium fundraising squares"}
            </div>

            <div style={styles.previewText}>
              {description.trim() ||
                "Your public squares page preview updates live while you build."}
            </div>

            <div style={styles.previewMetaGrid}>
              <div style={styles.previewMetaItem}>
                {Math.max(1, toInt(totalSquares, 100))} squares
              </div>

              <div style={styles.previewMetaItem}>
                {formatPreviewMoney(pricePerSquare, currency)}
              </div>

              <div style={styles.previewMetaItem}>
                {formatDatePreview(drawAt)}
              </div>

              <div style={styles.previewMetaItem}>
                {publicPrizesCount} visible prizes
              </div>
            </div>
          </div>
        </div>
      </section>
            <section style={styles.summaryGrid}>
        <SummaryCard
          label="Projected revenue"
          value={formatPreviewMoney(totalRevenue, currency)}
        />

        <SummaryCard
          label="Board layout"
          value={`${board.columns} × ${board.rows}`}
        />

        <SummaryCard
          label="Public prizes"
          value={prizeText(publicPrizesCount)}
        />

        <SummaryCard
          label="Draw date"
          value={drawAt ? formatDatePreview(drawAt) : "Not scheduled"}
        />
      </section>

      <SectionCard
        number="01"
        title="Campaign details"
        description="Configure the public squares page title, slug, description and visual branding."
        tone="default"
        badge="Core setup"
      >
        <div style={styles.twoColumn}>
          <Field label="Squares title">
            <input
              name="title"
              required
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Friday Night Jackpot Squares"
              style={styles.input}
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
              placeholder="friday-night-jackpot"
              style={styles.input}
            />
          </Field>
        </div>

        <Field label="Description">
          <textarea
            name="description"
            rows={4}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Describe the fundraiser, event or game."
            style={styles.textarea}
          />
        </Field>

        <div style={styles.mediaBox}>
          <div style={styles.mediaControls}>
            <h3 style={styles.subTitle}>Squares image</h3>

            <p style={styles.helpText}>
              Upload a premium hero image to represent your fundraiser publicly.
            </p>

            <ImageFocusUploadField
              label="Squares image"
              currentImageUrl={imageUrl}
              currentFocusX={imageFocusX}
              currentFocusY={imageFocusY}
              previewAlt="Squares preview"
              onUploaded={(url) => setImageUrl(url)}
              onFocusChange={(x, y) => {
                setImageFocusX(x);
                setImageFocusY(y);
              }}
            />
          </div>

          <div style={styles.previewBoxLarge}>
            <img
              src={previewImage}
              alt="Squares preview"
              style={{
                width: "100%",
                height: "100%",
                display: "block",
                objectFit: imageUrl ? "cover" : "contain",
                objectPosition: `${imageFocusX}% ${imageFocusY}%`,
                background:
                  "linear-gradient(135deg, #ffffff 0%, #f8fafc 55%, #eff6ff 100%)",
              }}
            />
          </div>
        </div>

        <input type="hidden" name="image_url" value={imageUrl} />
        <input
          type="hidden"
          name="image_focus_x"
          value={String(imageFocusX)}
        />
        <input
          type="hidden"
          name="image_focus_y"
          value={String(imageFocusY)}
        />
      </SectionCard>

      <SectionCard
        number="02"
        title="Board setup"
        description="Configure square count, pricing, draw timing and publication status."
        tone="setup"
        badge={`${Math.max(1, toInt(totalSquares, 100))} squares`}
      >
        <div style={styles.fourColumn}>
          <Field label="Total squares">
            <input
              name="total_squares"
              type="number"
              min={1}
              max={500}
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
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
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
            </select>
          </Field>
        </div>
                <Field label="Draw date & time">
          <input
            name="draw_at"
            type="datetime-local"
            value={drawAt}
            onChange={(event) => setDrawAt(event.target.value)}
            style={styles.input}
          />
        </Field>

        <div style={styles.boardPreviewCard}>
          <div style={styles.boardPreviewTop}>
            <div>
              <div style={styles.boardPreviewLabel}>
                Squares board preview
              </div>

              <div style={styles.boardPreviewTitle}>
                {board.columns} × {board.rows} layout
              </div>
            </div>

            <div style={styles.boardPreviewBadge}>
              {Math.max(1, toInt(totalSquares, 100))} selectable squares
            </div>
          </div>

          <div
            style={{
              ...styles.boardGrid,
              gridTemplateColumns: `repeat(${board.columns}, minmax(0, 1fr))`,
            }}
          >
            {Array.from({
              length: Math.min(
                Math.max(1, toInt(totalSquares, 100)),
                120,
              ),
            }).map((_, index) => (
              <div key={index} style={styles.boardCell}>
                {index + 1}
              </div>
            ))}
          </div>

          <p style={styles.boardFootnote}>
            The public board automatically scales for mobile and desktop players.
          </p>
        </div>
      </SectionCard>

      <SectionCard
        number="03"
        title="Prize management"
        description="Create prize positions, descriptions and public visibility."
        tone="prize"
        badge={prizeText(publicPrizesCount)}
      >
        <div style={styles.prizeSectionShell}>
          <div style={styles.prizeSectionTop}>
            <div>
              <div style={styles.prizeSectionTitle}>
                Configure your prizes
              </div>

              <div style={styles.prizeSectionText}>
                Add premium prize descriptions to increase engagement and sales.
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
            {prizes.map((prize) => (
              <div key={prize.id} style={styles.prizeRow}>
                <div style={styles.rowHeader}>
                  <strong>
                    Prize {prize.position || "1"}
                  </strong>

                  {prizes.length > 1 ? (
                    <button
                      type="button"
                      onClick={() => removePrize(prize.id)}
                      style={styles.removePrizeButton}
                    >
                      Remove
                    </button>
                  ) : null}
                </div>

                <div style={styles.prizeGrid}>
                  <Field label="Position">
                    <input
                      value={prize.position}
                      onChange={(event) =>
                        updatePrize(
                          prize.id,
                          "position",
                          event.target.value,
                        )
                      }
                      style={styles.input}
                    />
                  </Field>

                  <Field label="Prize title">
                    <input
                      value={prize.title}
                      onChange={(event) =>
                        updatePrize(
                          prize.id,
                          "title",
                          event.target.value,
                        )
                      }
                      placeholder="1st Prize"
                      style={styles.input}
                    />
                  </Field>
                </div>

                <Field label="Prize description">
                  <textarea
                    rows={3}
                    value={prize.description}
                    onChange={(event) =>
                      updatePrize(
                        prize.id,
                        "description",
                        event.target.value,
                      )
                    }
                    placeholder="Describe the prize, experience or reward."
                    style={styles.textarea}
                  />
                </Field>

                <label style={styles.checkboxLabel}>
                  <input
                    type="checkbox"
                    checked={prize.is_public}
                    onChange={(event) =>
                      updatePrize(
                        prize.id,
                        "is_public",
                        event.target.checked,
                      )
                    }
                  />

                  Show publicly on the campaign page
                </label>
              </div>
            ))}
          </div>
        </div>

        <input type="hidden" name="prizes" value={prizesValue} />
      </SectionCard>
            <SectionCard
        number="04"
        title="Legal entry question"
        description="Add an optional skill-based question before checkout."
        tone="legal"
        badge={hasQuestion ? "Enabled" : "Optional"}
      >
        <div style={styles.twoColumn}>
          <Field label="Question">
            <input
              name="question_text"
              value={questionText}
              onChange={(event) => setQuestionText(event.target.value)}
              placeholder="Example: What colour is the sky on a clear day?"
              style={styles.input}
            />
          </Field>

          <Field label="Correct answer">
            <input
              name="question_answer"
              value={questionAnswer}
              onChange={(event) => setQuestionAnswer(event.target.value)}
              placeholder="Example: blue"
              style={styles.input}
            />
          </Field>
        </div>

        <input
          type="hidden"
          name="question"
          value={
            hasQuestion && questionAnswer.trim()
              ? JSON.stringify({
                  text: questionText.trim(),
                  answer: questionAnswer.trim(),
                })
              : ""
          }
        />
      </SectionCard>

      <SectionCard
        number="05"
        title="Free postal entry"
        description="Provide the no-purchase entry route shown on the public page."
        tone="legal"
        badge={hasPostalEntry ? "Configured" : "Optional"}
      >
        <Field label="Postal address">
          <textarea
            name="free_entry_address"
            rows={3}
            value={freeEntryAddress}
            onChange={(event) => setFreeEntryAddress(event.target.value)}
            placeholder="Postal entry address"
            style={styles.textarea}
          />
        </Field>

        <Field label="Postal instructions">
          <textarea
            name="free_entry_instructions"
            rows={3}
            value={freeEntryInstructions}
            onChange={(event) => setFreeEntryInstructions(event.target.value)}
            placeholder="Explain what entrants must include with postal entries."
            style={styles.textarea}
          />
        </Field>

        <Field label="Postal entry closes">
          <input
            name="free_entry_closes_at"
            type="datetime-local"
            value={freeEntryClosesAt}
            onChange={(event) => setFreeEntryClosesAt(event.target.value)}
            style={styles.input}
          />
        </Field>

        <input
          type="hidden"
          name="free_entry"
          value={
            hasPostalEntry || freeEntryClosesAt.trim()
              ? JSON.stringify({
                  address: freeEntryAddress.trim(),
                  instructions: freeEntryInstructions.trim(),
                  closes_at: freeEntryClosesAt
                    ? new Date(freeEntryClosesAt).toISOString()
                    : null,
                })
              : ""
          }
        />
      </SectionCard>

      <section style={styles.submitBar}>
        <div style={styles.submitText}>
          <div style={styles.submitEyebrow}>Ready to save?</div>

          <strong style={styles.submitTitle}>Create squares game</strong>

          <div style={styles.mutedSmall}>
            Drafts are always allowed. Publishing may be limited by your plan.
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

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label style={styles.field}>
      <span style={styles.label}>{label}</span>
      {children}
    </label>
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

    .new-squares-form section {
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
  upgradeBanner: {
    padding: "clamp(18px, 4vw, 24px)",
    borderRadius: 26,
    background:
      "linear-gradient(135deg, #fff7ed 0%, #ffffff 48%, #eff6ff 100%)",
    border: "1px solid #fed7aa",
    boxShadow: "0 16px 38px rgba(15,23,42,0.08)",
  },
  upgradeEyebrow: {
    display: "inline-flex",
    padding: "6px 10px",
    borderRadius: 999,
    background: "#ffedd5",
    color: "#9a3412",
    border: "1px solid #fed7aa",
    fontSize: 12,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    marginBottom: 10,
  },
  upgradeTitle: {
    margin: 0,
    color: "#0f172a",
    fontSize: "clamp(26px, 5vw, 34px)",
    lineHeight: 1.05,
    letterSpacing: "-0.045em",
  },
  upgradeText: {
    margin: "10px 0 0",
    color: "#475569",
    fontSize: 15,
    lineHeight: 1.6,
    maxWidth: 780,
  },
  upgradeActions: {
    display: "flex",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 16,
  },
  primaryUpgradeButton: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 46,
    padding: "12px 16px",
    borderRadius: 999,
    background: "#1683f8",
    color: "#ffffff",
    textDecoration: "none",
    fontWeight: 950,
    border: "1px solid #1683f8",
    boxShadow: "0 10px 22px rgba(22,131,248,0.22)",
  },
  secondaryUpgradeButton: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 46,
    padding: "12px 16px",
    borderRadius: 999,
    background: "#ffffff",
    color: "#0f172a",
    textDecoration: "none",
    fontWeight: 950,
    border: "1px solid #cbd5e1",
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
  helpText: {
    color: "#64748b",
    fontSize: 13,
    margin: 0,
    overflowWrap: "anywhere",
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
  },
  boardFootnote: {
    color: "#64748b",
    fontSize: 13,
    lineHeight: 1.5,
    margin: "12px 0 0",
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
  mutedSmall: {
    color: "#64748b",
    fontSize: 13,
    marginTop: 3,
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
