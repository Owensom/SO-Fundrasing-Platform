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

  const [campaignLimitReached, setCampaignLimitReached] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);

      setCampaignLimitReached(
        params.get("error") === "campaign_limit",
      );
    }
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
            <Link
              href="/admin/billing"
              style={styles.primaryUpgradeButton}
            >
              View billing options
            </Link>

            <Link
              href="/admin/squares"
              style={styles.secondaryUpgradeButton}
            >
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
          label="Board layout"
          value={`${board.columns} × ${board.rows}`}
        />

        <SummaryCard
          label="Squares"
          value={Math.max(1, toInt(totalSquares, 100))}
        />

        <SummaryCard
          label="Projected revenue"
          value={formatPreviewMoney(totalRevenue, currency)}
        />

        <SummaryCard label="Prize count" value={publicPrizesCount} />

        <SummaryCard
          label="Skill question"
          value={hasQuestion ? "Enabled" : "Disabled"}
        />

        <SummaryCard
          label="Postal entry"
          value={hasPostalEntry ? "Configured" : "Not configured"}
        />
      </section>

      <section style={styles.readinessGrid}>
        <ReadinessCard eyebrow="Public experience" title="Launch readiness">
          <CheckItem done={title.trim().length > 0}>
            Squares title added
          </CheckItem>

          <CheckItem done={slug.trim().length > 0}>
            Public URL generated
          </CheckItem>

          <CheckItem done={description.trim().length > 0}>
            Public description added
          </CheckItem>

          <CheckItem done={drawAt.trim().length > 0}>
            Draw date configured
          </CheckItem>
        </ReadinessCard>

        <ReadinessCard eyebrow="Fundraising" title="Revenue overview">
          <PreviewLine
            label="Squares"
            value={Math.max(1, toInt(totalSquares, 100))}
          />

          <PreviewLine
            label="Price"
            value={formatPreviewMoney(pricePerSquare, currency)}
          />

          <PreviewLine
            label="Potential revenue"
            value={formatPreviewMoney(totalRevenue, currency)}
          />

          <PreviewLine label="Currency" value={currency} />
        </ReadinessCard>

        <ReadinessCard eyebrow="Compliance" title="Legal framework">
          <CheckItem done={hasQuestion}>
            Skill-based entry question configured
          </CheckItem>

          <CheckItem done={questionAnswer.trim().length > 0}>
            Correct answer configured
          </CheckItem>

          <CheckItem done={hasPostalEntry}>
            Free postal entry details added
          </CheckItem>

          <CheckItem done={freeEntryClosesAt.trim().length > 0}>
            Postal closing date added
          </CheckItem>
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
              customImagesAllowed={true}
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
                        updatePrize(
                          prize.id,
                          "is_public",
                          event.target.checked,
                        )
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
                        updatePrize(prize.id, "position", event.target.value)
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
                        updatePrize(prize.id, "title", event.target.value)
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
                      updatePrize(prize.id, "description", event.target.value)
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
        badge={hasQuestion ? "Configured" : "Not configured"}
        tone="legal"
      >
        <div style={styles.legalBody}>
          <div style={styles.twoColumn}>
            <Field label="Question">
              <input
                name="question_text"
                value={questionText}
                onChange={(event) => setQuestionText(event.target.value)}
                placeholder="e.g. What colour is a London taxi?"
                style={styles.input}
              />
            </Field>

            <Field label="Correct answer">
              <input
                name="question_answer"
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
        badge={hasPostalEntry ? "Configured" : "Not configured"}
        tone="legal"
      >
        <div style={styles.legalBody}>
          <Field label="Postal address">
            <textarea
              name="free_entry_address"
              value={freeEntryAddress}
              onChange={(event) => setFreeEntryAddress(event.target.value)}
              rows={3}
              placeholder="Postal entry address"
              style={styles.textarea}
            />
          </Field>

          <Field label="Instructions">
            <textarea
              name="free_entry_instructions"
              value={freeEntryInstructions}
              onChange={(event) => setFreeEntryInstructions(event.target.value)}
              rows={3}
              placeholder="Include name, email, game name, answer and preferred square number..."
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

          <div style={styles.complianceRow}>
            <CheckItem done={hasQuestion}>Skill question configured</CheckItem>

            <CheckItem done={hasPostalEntry}>
              Free entry details configured
            </CheckItem>
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

      <input type="hidden" name="image_url" value={imageUrl} />
      <input type="hidden" name="image_focus_x" value={imageFocusX} />
      <input type="hidden" name="image_focus_y" value={imageFocusY} />
      <input type="hidden" name="image_position" value="center" />
      <input type="hidden" name="prizes" value={prizesValue} />
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
    fontWeight: 700,
  },
  previewLineValue: {
    color: "#0f172a",
    fontWeight: 950,
    textAlign: "right",
    wordBreak: "break-word",
  },
  sectionCard: {
    borderRadius: 28,
    border: "1px solid #e2e8f0",
    overflow: "hidden",
    boxShadow: "0 10px 30px rgba(15,23,42,0.05)",
  },
  sectionSummary: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 16,
    padding: "22px 22px 20px",
    cursor: "pointer",
  },
  sectionSummaryText: {
    minWidth: 0,
  },
  sectionTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 16,
    padding: "22px 22px 0",
    flexWrap: "wrap",
  },
  sectionActions: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    flexWrap: "wrap",
  },
  sectionNumber: {
    color: "#2563eb",
    fontSize: 12,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
  },
  sectionTitle: {
    margin: "6px 0 0",
    color: "#0f172a",
    fontSize: 32,
    lineHeight: 1.02,
    letterSpacing: "-0.05em",
    overflowWrap: "anywhere",
  },
  sectionDescription: {
    margin: "10px 0 0",
    color: "#64748b",
    lineHeight: 1.6,
    maxWidth: 760,
    overflowWrap: "anywhere",
  },
  sectionBadge: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 38,
    padding: "8px 14px",
    borderRadius: 999,
    background: "#ffffff",
    border: "1px solid #dbeafe",
    color: "#1d4ed8",
    fontSize: 12,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    whiteSpace: "nowrap",
  },
  openButton: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 38,
    padding: "8px 14px",
    borderRadius: 999,
    background: "#0f172a",
    color: "#ffffff",
    fontSize: 12,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
  },
  sectionBody: {
    display: "grid",
    gap: 18,
    padding: 22,
  },
  twoColumn: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 16,
  },
  fourColumn: {
    display: "grid",
    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
    gap: 16,
  },
  field: {
    display: "grid",
    gap: 8,
    minWidth: 0,
  },
  label: {
    color: "#334155",
    fontSize: 13,
    fontWeight: 900,
  },
  input: {
    width: "100%",
    minHeight: 52,
    borderRadius: 16,
    border: "1px solid #cbd5e1",
    padding: "0 14px",
    background: "#ffffff",
    color: "#0f172a",
    fontSize: 15,
    outline: "none",
  },
  textarea: {
    width: "100%",
    borderRadius: 18,
    border: "1px solid #cbd5e1",
    padding: "14px",
    background: "#ffffff",
    color: "#0f172a",
    fontSize: 15,
    lineHeight: 1.55,
    resize: "vertical",
    outline: "none",
  },
  previewInfoCard: {
    display: "grid",
    alignContent: "center",
    gap: 6,
    padding: 18,
    borderRadius: 18,
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
  },
  previewInfoLabel: {
    color: "#64748b",
    fontSize: 12,
    fontWeight: 900,
    textTransform: "uppercase",
    letterSpacing: "0.06em",
  },
  previewInfoValue: {
    color: "#0f172a",
    fontSize: 18,
    fontWeight: 950,
    lineHeight: 1.2,
  },
  boardPreviewCard: {
    padding: 18,
    borderRadius: 24,
    background:
      "linear-gradient(135deg, #eff6ff 0%, #ffffff 52%, #f8fafc 100%)",
    border: "1px solid #bfdbfe",
  },
  boardPreviewTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
    flexWrap: "wrap",
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
