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

type NewSquaresGameFormProps = {
  subscriptionTier?: string | null;
  customImagesAllowed?: boolean;
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

function cleanDatePart(value: string) {
  return value.trim().replace(/[^\d-]/g, "").slice(0, 10);
}

function cleanTimePart(value: string) {
  return value.trim().replace(/[^\d:]/g, "").slice(0, 5);
}

function buildIsoFromDateTimeParts(dateValue: string, timeValue: string) {
  const date = cleanDatePart(dateValue);
  const time = cleanTimePart(timeValue);

  if (!date && !time) {
    return "";
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return "";
  }

  if (!/^\d{2}:\d{2}$/.test(time)) {
    return "";
  }

  const parsed = new Date(`${date}T${time}:00`);

  if (Number.isNaN(parsed.getTime())) {
    return "";
  }

  return parsed.toISOString();
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

export default function NewSquaresGameForm({
  subscriptionTier = "community",
  customImagesAllowed = false,
}: NewSquaresGameFormProps) {
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const [description, setDescription] = useState("");

  const [drawDate, setDrawDate] = useState("");
  const [drawTime, setDrawTime] = useState("");

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
  const [freeEntryCloseDate, setFreeEntryCloseDate] = useState("");
  const [freeEntryCloseTime, setFreeEntryCloseTime] = useState("");
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

  const drawAtValue = useMemo(() => {
    return buildIsoFromDateTimeParts(drawDate, drawTime);
  }, [drawDate, drawTime]);

  const freeEntryClosesAtValue = useMemo(() => {
    return buildIsoFromDateTimeParts(freeEntryCloseDate, freeEntryCloseTime);
  }, [freeEntryCloseDate, freeEntryCloseTime]);

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

    if (!address && !instructions && !freeEntryClosesAtValue) return "";

    return JSON.stringify({
      address,
      instructions,
      closes_at: freeEntryClosesAtValue || null,
    });
  }, [freeEntryAddress, freeEntryInstructions, freeEntryClosesAtValue]);

  const boardSize = Math.max(1, Math.min(500, toInt(totalSquares, 100)));
  const price = Math.max(0, toMoney(pricePerSquare, 0));
  const estimatedTotal = boardSize * price;
  const boardShape = getBoardShape(boardSize);
  const hasLegalQuestion = Boolean(questionText.trim() && questionAnswer.trim());
  const hasFreeEntry = Boolean(
    freeEntryAddress.trim() ||
      freeEntryInstructions.trim() ||
      freeEntryClosesAtValue,
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

      <input type="hidden" name="draw_at" value={drawAtValue} />
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
              Manage squares
            </Link>
          </div>
        </section>
      ) : null}

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
