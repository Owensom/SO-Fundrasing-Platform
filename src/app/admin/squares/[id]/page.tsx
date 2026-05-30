import type { CSSProperties, ReactNode } from "react";
import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { auth } from "@/auth";
import { getTenantSlugFromHeaders } from "@/lib/tenant";
import { getTenantSettings } from "@/lib/tenant-settings";
import { checkSubscriptionCapability } from "@/lib/subscription-capabilities";
import {
  getSquaresGameById,
  listSquaresSales,
  listSquaresWinners,
} from "../../../../../api/_lib/squares-repo";
import ImageFocusUploadField from "@/components/ImageFocusUploadField";
import SquaresPrizeSettings from "./SquaresPrizeSettings";
import DramaticSquaresDraw from "./DramaticSquaresDraw";

const DEFAULT_SQUARES_IMAGE = "/brand/so-default-squares.png";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type PageProps = {
  params: {
    id: string;
  };
  searchParams?: {
    error?: string;
  };
};

type Prize = {
  title?: string;
  name?: string;
  description?: string;
};

type SoldSquareOption = {
  squareNumber: number;
  customerName: string;
  customerEmail: string;
};

type ReadinessTone = "good" | "warning" | "neutral";

type ReadinessItem = {
  label: string;
  value: ReactNode;
  tone: ReadinessTone;
  detail: string;
};

function firstNameOnly(name?: string | null) {
  return name?.trim().split(/\s+/)[0] || "Winner";
}

function moneyFromCents(cents: number | null | undefined) {
  return (Number(cents || 0) / 100).toFixed(2);
}

function formatMoney(cents: number | null | undefined, currency: string) {
  try {
    return new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency: currency || "GBP",
    }).format(Number(cents || 0) / 100);
  } catch {
    return `${moneyFromCents(cents)} ${currency || "GBP"}`;
  }
}

function getDateParts(value: string | null | undefined) {
  if (!value) return null;

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return {
    day: String(date.getUTCDate()).padStart(2, "0"),
    month: String(date.getUTCMonth() + 1).padStart(2, "0"),
    year: String(date.getUTCFullYear()).padStart(4, "0"),
    hour: String(date.getUTCHours()).padStart(2, "0"),
    minute: String(date.getUTCMinutes()).padStart(2, "0"),
  };
}

function formatBritishDateInput(value: string | null | undefined) {
  const parts = getDateParts(value);

  if (!parts) return "";

  return `${parts.day}/${parts.month}/${parts.year}`;
}

function formatTimeInput(value: string | null | undefined) {
  const parts = getDateParts(value);

  if (!parts) return "";

  return `${parts.hour}:${parts.minute}`;
}

function formatDrawDate(value: string | null | undefined) {
  if (!value) return "Not set";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "Not set";

  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function getProgressPercent(sold: number, total: number) {
  if (!total || total <= 0) return 0;

  return Math.min(100, Math.max(0, Math.round((sold / total) * 100)));
}

function statusStyle(status: string): CSSProperties {
  if (status === "published") {
    return {
      background: "#dcfce7",
      color: "#166534",
      borderColor: "#bbf7d0",
    };
  }

  if (status === "drawn") {
    return {
      background: "#dbeafe",
      color: "#1d4ed8",
      borderColor: "#bfdbfe",
    };
  }

  if (status === "closed") {
    return {
      background: "#fff7ed",
      color: "#9a3412",
      borderColor: "#fed7aa",
    };
  }

  return {
    background: "#f1f5f9",
    color: "#475569",
    borderColor: "#e2e8f0",
  };
}

function readinessToneStyle(tone: ReadinessTone): CSSProperties {
  if (tone === "good") {
    return {
      background: "#ecfdf5",
      color: "#166534",
      borderColor: "#bbf7d0",
    };
  }

  if (tone === "warning") {
    return {
      background: "#fff7ed",
      color: "#9a3412",
      borderColor: "#fed7aa",
    };
  }

  return {
    background: "#f8fafc",
    color: "#475569",
    borderColor: "#e2e8f0",
  };
}

function isConfigured(value: unknown) {
  return String(value ?? "").trim().length > 0;
}

async function safeListSquaresWinners(gameId: string) {
  try {
    return await listSquaresWinners(gameId);
  } catch (error) {
    console.error("Admin squares winners failed:", error);
    return [];
  }
}

async function safeListSquaresSales(gameId: string) {
  try {
    return await listSquaresSales(gameId);
  } catch (error) {
    console.error("Admin squares sales failed:", error);
    return [];
  }
}

export default async function AdminSquaresEditPage({
  params,
  searchParams,
}: PageProps) {
  const session = await auth();

  if (!session?.user) {
    redirect("/admin/login");
  }

  const tenantSlug = await getTenantSlugFromHeaders();

  const sessionTenantSlugs = Array.isArray(session.user.tenantSlugs)
    ? session.user.tenantSlugs.map((value) => String(value))
    : [];

  if (!tenantSlug || !sessionTenantSlugs.includes(tenantSlug)) {
    redirect("/admin/login?error=tenant_access_denied");
  }

  const game = await getSquaresGameById(params.id);

  if (!game || game.tenant_slug !== tenantSlug) {
    notFound();
  }

  const tenantSettings = await getTenantSettings(tenantSlug);

  const customImagesCapability = checkSubscriptionCapability(
    tenantSettings,
    "custom_campaign_images",
  );

  const campaignLimitReached = searchParams?.error === "campaign_limit";
  const publicPreviewUnavailable =
    searchParams?.error === "public-preview-unavailable";
  const invalidDrawDateTime =
    searchParams?.error === "invalid_draw_datetime";
  const invalidPostalDateTime =
    searchParams?.error === "invalid_postal_datetime";

  const [winners, sales] = await Promise.all([
    safeListSquaresWinners(game.id),
    safeListSquaresSales(game.id),
  ]);

  const currency = game.currency || "GBP";
  const status = String(game.status || "draft");
  const publicSquaresStatus = status.trim().toLowerCase();
  const canViewPublicSquares = publicSquaresStatus === "published";

  const config = (game.config_json ?? {}) as any;
  const question = config.question ?? {};
  const freeEntry = config.free_entry ?? {};
  const hasCustomImage = Boolean(game.image_url);

  const imageFocusX = Number(config.image_focus_x ?? 50);
  const imageFocusY = Number(config.image_focus_y ?? 50);
  const imageObjectPosition = `${imageFocusX}% ${imageFocusY}%`;

  const savedPrizes = Array.isArray(config.prizes)
    ? (config.prizes as Prize[])
    : [];

  const soldSquareOptions: SoldSquareOption[] = sales
    .flatMap((sale: any) =>
      Array.isArray(sale.squares)
        ? sale.squares.map((squareNumber: number | string) => ({
            squareNumber: Number(squareNumber),
            customerName: String(sale.customer_name || "Supporter"),
            customerEmail: String(sale.customer_email || ""),
          }))
        : [],
    )
    .filter(
      (entry) =>
        Number.isInteger(entry.squareNumber) &&
        entry.squareNumber >= 1 &&
        entry.squareNumber <= Number(game.total_squares || 0),
    )
    .sort((a, b) => a.squareNumber - b.squareNumber);

  const drawnPrizeNumbers = winners
    .map((winner: any) => Number(winner.prize_number))
    .filter((number) => Number.isFinite(number) && number > 0);

  const drawnSquareNumbers = winners
    .map((winner: any) => Number(winner.square_number))
    .filter((number) => Number.isFinite(number) && number > 0);

  const soldSquares = soldSquareOptions.length;
  const totalSquares = Number(game.total_squares || 0);
  const remainingSquares = Math.max(totalSquares - soldSquares, 0);
  const progress = getProgressPercent(soldSquares, totalSquares);

  const legalQuestionTextConfigured = isConfigured(question.text);
  const legalQuestionAnswerConfigured = isConfigured(question.answer);
  const legalQuestionEnabled =
    legalQuestionTextConfigured && legalQuestionAnswerConfigured;
  const legalQuestionPartiallyConfigured =
    legalQuestionTextConfigured !== legalQuestionAnswerConfigured;

  const postalEntryAddressConfigured = isConfigured(freeEntry.address);
  const postalEntryInstructionsConfigured = isConfigured(freeEntry.instructions);
  const postalEntryClosingConfigured = isConfigured(freeEntry.closes_at);
  const postalEntryEnabled =
    postalEntryAddressConfigured && postalEntryInstructionsConfigured;
  const postalEntryPartiallyConfigured =
    postalEntryAddressConfigured !== postalEntryInstructionsConfigured;

  const prizesConfigured = savedPrizes.length > 0;
  const priceConfigured = Number(game.price_per_square_cents || 0) > 0;
  const boardConfigured = totalSquares > 0;
  const drawDateConfigured = isConfigured(game.draw_at);
  const publishedNeedsAttention =
    canViewPublicSquares &&
    (!priceConfigured ||
      !boardConfigured ||
      !drawDateConfigured ||
      !legalQuestionEnabled ||
      !postalEntryEnabled ||
      !prizesConfigured);

  const autoDrawFromPrize = Number(config.auto_draw_from_prize || 1);
  const autoDrawToPrize = Number(config.auto_draw_to_prize || 999);

  const readinessItems: ReadinessItem[] = [
    {
      label: "Public page",
      value: canViewPublicSquares ? "Published" : status || "Draft",
      tone: canViewPublicSquares ? "good" : "warning",
      detail: canViewPublicSquares
        ? publishedNeedsAttention
          ? "This squares game is public, but one or more launch checks need attention."
          : "Supporters can open the public squares page."
        : "Draft, closed and drawn squares games are not open for public entries.",
    },
    {
      label: "Squares",
      value:
        boardConfigured && priceConfigured
          ? `${totalSquares} squares`
          : "Needs setup",
      tone: boardConfigured && priceConfigured ? "good" : "warning",
      detail:
        boardConfigured && priceConfigured
          ? `${remainingSquares} squares remain available.`
          : !priceConfigured && !boardConfigured
            ? "Set the board size and price per square before selling."
            : !priceConfigured
              ? "Set a valid price per square before selling."
              : "Set a valid board size before selling.",
    },
    {
      label: "Draw",
      value: formatDrawDate(game.draw_at),
      tone: drawDateConfigured ? "good" : "warning",
      detail: drawDateConfigured
        ? "Draw date is set for this squares game."
        : canViewPublicSquares
          ? "This squares game is published without a draw date. Add one before sharing widely."
          : "Add a draw date before publishing or promoting the game.",
    },
    {
      label: "Legal question",
      value: legalQuestionEnabled
        ? "Configured"
        : legalQuestionPartiallyConfigured
          ? "Incomplete"
          : "Missing",
      tone: legalQuestionEnabled ? "good" : "warning",
      detail: legalQuestionEnabled
        ? "Public entrants must answer the skill question before checkout."
        : legalQuestionPartiallyConfigured
          ? "Complete both the entry question and correct answer before launch."
          : "Add the entry question and correct answer for compliance.",
    },
    {
      label: "Postal entry",
      value: postalEntryEnabled
        ? postalEntryClosingConfigured
          ? "Configured"
          : "Closing date missing"
        : postalEntryPartiallyConfigured
          ? "Incomplete"
          : "Missing",
      tone:
        postalEntryEnabled && postalEntryClosingConfigured ? "good" : "warning",
      detail:
        postalEntryEnabled && postalEntryClosingConfigured
          ? "Free postal entry details and closing date are available."
          : postalEntryEnabled
            ? "Free postal entry address and instructions are present. Add a postal closing date if required before launch."
            : postalEntryPartiallyConfigured
              ? "Complete both the free postal entry address and instructions."
              : "Add the free postal entry address and instructions.",
    },
    {
      label: "Prizes",
      value: prizesConfigured ? `${savedPrizes.length} prizes` : "No prizes",
      tone: prizesConfigured ? "good" : "warning",
      detail: prizesConfigured
        ? "Prize rows are configured for the draw."
        : canViewPublicSquares
          ? "This squares game is published without prize rows. Add prizes before promoting it."
          : "Add prize rows before promoting the squares game.",
    },
  ];

  const readinessReady =
    canViewPublicSquares &&
    boardConfigured &&
    priceConfigured &&
    drawDateConfigured &&
    legalQuestionEnabled &&
    postalEntryEnabled &&
    prizesConfigured;
    return (
    <main className="squares-admin-page" style={styles.page}>
      <style>{responsiveStyles}</style>

      <section className="squares-topbar" style={styles.topBar}>
        <Link href="/admin/squares" style={styles.backLink}>
          ← Back to squares
        </Link>

        <Link
          href={
            canViewPublicSquares
              ? `/s/${game.slug}?adminReturn=/admin/squares/${game.id}`
              : `/admin/squares/${game.id}?error=public-preview-unavailable`
          }
          target={canViewPublicSquares ? "_blank" : undefined}
          style={
            canViewPublicSquares
              ? styles.publicLink
              : styles.publicUnavailableLink
          }
        >
          {canViewPublicSquares ? "View campaign page" : "Preview unavailable"}
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
            Community plan. Keep this campaign as a draft, close an existing
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

      {publicPreviewUnavailable ? (
        <section style={styles.upgradeBanner}>
          <div style={styles.upgradeEyebrow}>Preview unavailable</div>

          <h1 style={styles.upgradeTitle}>
            This squares game is not public yet.
          </h1>

          <p style={styles.upgradeText}>
            Draft squares games are hidden from public campaign pages. Publish
            this game when you are ready for supporters to view and buy squares.
          </p>
        </section>
      ) : null}

      {invalidDrawDateTime || invalidPostalDateTime ? (
        <section style={styles.upgradeBanner}>
          <div style={styles.upgradeEyebrow}>Date format issue</div>

          <h1 style={styles.upgradeTitle}>
            {invalidDrawDateTime
              ? "Please check the draw date."
              : "Please check the postal closing date."}
          </h1>

          <p style={styles.upgradeText}>
            {invalidDrawDateTime
              ? "Draw date must use DD/MM/YYYY format, for example 31/10/2026. Draw time must use 24-hour HH:MM format, for example 19:00. You can also leave both fields blank while drafting."
              : "Postal closing date must use DD/MM/YYYY format, for example 31/10/2026. Postal closing time must use 24-hour HH:MM format, for example 18:00. You can also leave both fields blank."}
          </p>
        </section>
      ) : null}

      <section className="squares-hero" style={styles.hero}>
        <div style={styles.heroContent}>
          <div style={styles.eyebrow}>Squares editor</div>

          <div style={styles.heroTitleRow}>
            <h1 className="so-brand-heading" style={styles.heroTitle}>
              {game.title}
            </h1>

            <span style={{ ...styles.statusPill, ...statusStyle(status) }}>
              {status}
            </span>
          </div>

          <p style={styles.heroSlug}>/s/{game.slug}</p>

          {game.description ? (
            <p style={styles.heroDescription}>{game.description}</p>
          ) : (
            <p style={styles.heroDescriptionMuted}>No description added yet.</p>
          )}

          <div className="squares-hero-meta" style={styles.heroMetaGrid}>
            <HeroMeta label="Draw" value={formatDrawDate(game.draw_at)} />

            <HeroMeta
              label="Squares sold"
              value={`${soldSquares}/${totalSquares}`}
            />

            <HeroMeta label="Progress" value={`${progress}% sold`} />
          </div>
        </div>

        <div className="squares-hero-image" style={styles.heroImageWrap}>
          <img
            src={game.image_url || DEFAULT_SQUARES_IMAGE}
            alt={game.title || "SO Squares"}
            style={{
              ...styles.heroImage,
              objectFit: hasCustomImage ? "cover" : "contain",
              objectPosition: hasCustomImage ? imageObjectPosition : "center",
              padding: hasCustomImage ? 0 : 28,
              background: hasCustomImage
                ? "#1e293b"
                : "linear-gradient(135deg, #ffffff 0%, #f8fafc 55%, #eff6ff 100%)",
              boxSizing: "border-box",
            }}
          />
        </div>
      </section>

      <section className="squares-readiness-panel" style={styles.readinessPanel}>
        <div style={styles.readinessHeader}>
          <div>
            <div style={styles.readinessEyebrow}>Campaign readiness</div>

            <h2 style={styles.readinessTitle}>Squares readiness snapshot</h2>

            <p style={styles.readinessIntro}>
              A quick operational check before sharing the squares game, taking
              paid entries or running the draw. Published games with incomplete
              legal, postal, pricing, board or prize setup are highlighted here.
            </p>
          </div>

          <span
            style={{
              ...styles.readinessStatusPill,
              ...readinessToneStyle(readinessReady ? "good" : "warning"),
            }}
          >
            {readinessReady ? "Ready to sell" : "Needs attention"}
          </span>
        </div>

        <div className="squares-readiness-grid" style={styles.readinessGrid}>
          {readinessItems.map((item) => (
            <div
              key={item.label}
              className="squares-readiness-item"
              style={{
                ...styles.readinessItem,
                ...(item.tone === "good"
                  ? styles.readinessItemGood
                  : item.tone === "warning"
                    ? styles.readinessItemWarning
                    : styles.readinessItemNeutral),
              }}
            >
              <div
                style={{
                  ...styles.readinessToneDot,
                  ...readinessToneStyle(item.tone),
                }}
              />

              <div style={styles.readinessContent}>
                <span style={styles.readinessLabel}>{item.label}</span>

                <strong
                  className="squares-readiness-value"
                  style={styles.readinessValue}
                >
                  {item.value}
                </strong>

                <span
                  className="squares-readiness-detail"
                  style={styles.readinessDetail}
                >
                  {item.detail}
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="squares-summary-grid" style={styles.summaryGrid}>
        <SummaryCard
          label="Price"
          value={formatMoney(game.price_per_square_cents, currency)}
        />

        <SummaryCard label="Draw date" value={formatDrawDate(game.draw_at)} />

        <SummaryCard label="Total squares" value={totalSquares} />

        <SummaryCard label="Sold" value={soldSquares} />

        <SummaryCard label="Remaining" value={remainingSquares} />
      </section>

      <section style={styles.progressCard}>
        <div style={styles.progressHeader}>
          <div>
            <strong style={{ color: "#0f172a" }}>Sales progress</strong>

            <div style={styles.mutedSmall}>
              {soldSquares} sold from {totalSquares} squares
            </div>
          </div>

          <div style={styles.progressPercent}>{progress}%</div>
        </div>

        <div style={styles.progressTrack}>
          <div style={{ ...styles.progressFill, width: `${progress}%` }} />
        </div>
      </section>

      <form
        action={`/api/admin/squares/${game.id}`}
        method="post"
        style={styles.form}
      >
        <section style={styles.section}>
          <details open style={styles.adminDetails}>
            <summary className="squares-admin-summary" style={styles.adminSummary}>
              <div>
                <div style={styles.sectionEyebrow}>Section 1</div>

                <h2 className="so-brand-card-title" style={styles.sectionTitle}>
                  Edit squares game
                </h2>

                <p style={styles.sectionDescription}>
                  Update public details, image, pricing and draw settings.
                </p>
              </div>

              <div className="squares-summary-pills" style={styles.summaryPillRow}>
                <StatusMiniPill label="Legal" active={legalQuestionEnabled} />
                <StatusMiniPill label="Postal" active={postalEntryEnabled} />

                <StatusMiniPill
                  label="Custom images"
                  active={customImagesCapability.allowed}
                />

                <span style={styles.adminSummaryToggle}>Open / close</span>
              </div>
            </summary>

            <div style={styles.adminDetailsBody}>
              <section style={styles.innerPanel}>
                <div style={styles.innerHeader}>
                  <div>
                    <div style={styles.innerEyebrow}>Public overview</div>

                    <h3 style={styles.subTitle}>Campaign details</h3>

                    <p style={styles.sectionDescription}>
                      These details are shown on the public squares page.
                    </p>
                  </div>
                </div>

                <div className="squares-two-column" style={styles.twoColumnNoMargin}>
                  <Field label="Title">
                    <input
                      name="title"
                      defaultValue={game.title}
                      required
                      style={styles.input}
                    />
                  </Field>

                  <Field label="Slug">
                    <input
                      name="slug"
                      defaultValue={game.slug}
                      required
                      style={styles.input}
                    />
                  </Field>
                </div>

                <Field label="Description">
                  <textarea
                    name="description"
                    rows={3}
                    defaultValue={game.description ?? ""}
                    style={styles.textarea}
                  />
                </Field>

                <div className="squares-media-box" style={styles.mediaBox}>
                  <div style={styles.mediaControls}>
                    <h3 style={styles.subTitle}>Squares image</h3>

                    <p style={styles.sectionDescription}>
                      Upload or replace the public image for this squares game.
                    </p>

                    <ImageFocusUploadField
                      currentImageUrl={game.image_url || ""}
                      currentFocusX={imageFocusX}
                      currentFocusY={imageFocusY}
                      label="Squares image"
                      previewAlt={game.title}
                      subscriptionTier={tenantSettings?.subscription_tier}
                      customImagesAllowed={customImagesCapability.allowed}
                    />
                  </div>

                  <div className="squares-preview-box" style={styles.previewBox}>
                    <img
                      src={game.image_url || DEFAULT_SQUARES_IMAGE}
                      alt={game.title || "SO Squares"}
                      style={{
                        ...styles.previewImage,
                        objectFit: hasCustomImage ? "cover" : "contain",
                        objectPosition: hasCustomImage
                          ? imageObjectPosition
                          : "center",
                        padding: hasCustomImage ? 0 : 20,
                        background: hasCustomImage
                          ? "#ffffff"
                          : "linear-gradient(135deg, #ffffff 0%, #f8fafc 55%, #eff6ff 100%)",
                        boxSizing: "border-box",
                      }}
                    />
                  </div>
                </div>
              </section>
                            <CompactDetails
                eyebrow="Squares setup"
                title="Board, pricing & status"
                description="Configure board size, pricing, draw date and publication status."
                badge={`${totalSquares} squares • ${formatMoney(
                  game.price_per_square_cents,
                  currency,
                )}`}
              >
                <div className="squares-three-column" style={styles.threeColumn}>
                  <Field label="Draw date">
                    <input
                      name="draw_date"
                      type="text"
                      inputMode="numeric"
                      defaultValue={formatBritishDateInput(game.draw_at)}
                      placeholder="DD/MM/YYYY"
                      style={styles.input}
                    />
                  </Field>

                  <Field label="Draw time">
                    <input
                      name="draw_time"
                      type="text"
                      inputMode="numeric"
                      defaultValue={formatTimeInput(game.draw_at)}
                      placeholder="HH:MM"
                      style={styles.input}
                    />
                  </Field>

                  <Field label="Total squares">
                    <input
                      name="total_squares"
                      type="number"
                      min={1}
                      max={500}
                      defaultValue={game.total_squares}
                      required
                      style={styles.input}
                    />
                  </Field>

                  <Field label="Price per square">
                    <input
                      name="price_per_square"
                      type="number"
                      min={0}
                      step="0.01"
                      defaultValue={moneyFromCents(game.price_per_square_cents)}
                      required
                      style={styles.input}
                    />
                  </Field>

                  <Field label="Currency">
                    <select
                      name="currency"
                      defaultValue={currency}
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
                      defaultValue={status}
                      style={styles.input}
                    >
                      <option value="draft">Draft</option>
                      <option value="published">Published</option>
                      <option value="closed">Closed</option>
                      <option value="drawn">Drawn</option>
                    </select>
                  </Field>
                </div>
              </CompactDetails>

              <CompactDetails
                eyebrow="Compliance"
                title="Legal & postal entry"
                description="Add a skill-based question and the free postal entry route shown publicly."
                badge={
                  legalQuestionEnabled && postalEntryEnabled
                    ? "Configured"
                    : legalQuestionPartiallyConfigured ||
                        postalEntryPartiallyConfigured
                      ? "Incomplete"
                      : "Not configured"
                }
              >
                <div className="squares-two-column" style={styles.twoColumnNoMargin}>
                  <Field label="Entry question">
                    <input
                      name="question_text"
                      defaultValue={String(question.text ?? "")}
                      placeholder="e.g. What colour is a London taxi?"
                      style={styles.input}
                    />
                  </Field>

                  <Field label="Correct answer">
                    <input
                      name="question_answer"
                      defaultValue={String(question.answer ?? "")}
                      placeholder="e.g. black"
                      style={styles.input}
                    />
                  </Field>
                </div>

                <Field label="Postal address">
                  <textarea
                    name="free_entry_address"
                    rows={2}
                    defaultValue={String(freeEntry.address ?? "")}
                    placeholder="e.g. SO Foundation, 123 High Street, London, SW1A 1AA"
                    style={styles.textarea}
                  />
                </Field>

                <Field label="Postal instructions">
                  <textarea
                    name="free_entry_instructions"
                    rows={3}
                    defaultValue={String(freeEntry.instructions ?? "")}
                    placeholder="Include your full name, email address, game name, answer and preferred square number if applicable."
                    style={styles.textarea}
                  />
                </Field>

                <div className="squares-two-column" style={styles.twoColumnNoMargin}>
                  <Field label="Postal entry closing date">
                    <input
                      name="free_entry_closes_date"
                      type="text"
                      inputMode="numeric"
                      defaultValue={formatBritishDateInput(
                        freeEntry.closes_at,
                      )}
                      placeholder="DD/MM/YYYY"
                      style={styles.input}
                    />
                  </Field>

                  <Field label="Postal entry closing time">
                    <input
                      name="free_entry_closes_time"
                      type="text"
                      inputMode="numeric"
                      defaultValue={formatTimeInput(freeEntry.closes_at)}
                      placeholder="HH:MM"
                      style={styles.input}
                    />
                  </Field>
                </div>

                <p style={styles.helpText}>
                  Postal entries should include an email address so the entrant
                  can be contacted if they win and included in the draw.
                </p>
              </CompactDetails>

              <CompactDetails
                eyebrow="Draw system"
                title="Auto draw range"
                description="Choose which prize numbers the randomizer should draw."
                badge={`${autoDrawFromPrize} → ${autoDrawToPrize}`}
              >
                <div className="squares-two-column" style={styles.twoColumnNoMargin}>
                  <Field label="Auto draw from prize number">
                    <input
                      name="auto_draw_from_prize"
                      type="number"
                      min={1}
                      defaultValue={autoDrawFromPrize}
                      placeholder="6"
                      style={styles.input}
                    />
                  </Field>

                  <Field label="Auto draw to prize number">
                    <input
                      name="auto_draw_to_prize"
                      type="number"
                      min={1}
                      defaultValue={autoDrawToPrize}
                      placeholder="999"
                      style={styles.input}
                    />
                  </Field>
                </div>
              </CompactDetails>
            </div>
          </details>
        </section>

        <section style={styles.section}>
          <details open={!prizesConfigured} style={styles.adminDetails}>
            <summary className="squares-admin-summary" style={styles.adminSummary}>
              <div>
                <div style={styles.sectionEyebrow}>Section 2</div>

                <h2 className="so-brand-card-title" style={styles.sectionTitle}>
                  Prize management
                </h2>

                <p style={styles.sectionDescription}>
                  Manage prize names, descriptions and public visibility.
                </p>
              </div>

              <span style={styles.adminSummaryToggle}>Open / close</span>
            </summary>

            <div style={styles.adminDetailsBody}>
              <SquaresPrizeSettings initialPrizes={savedPrizes} />
            </div>
          </details>
        </section>

        <section style={styles.submitBar}>
          <div>
            <strong style={{ color: "#0f172a" }}>
              Save all squares settings
            </strong>

            <div style={styles.mutedSmall}>
              Use this after changing details, legal settings, prizes or draw
              ranges.
            </div>
          </div>

          <button type="submit" style={styles.submitButton}>
            Save squares
          </button>
        </section>
      </form>

      <section style={styles.section}>
        <details style={styles.adminDetails}>
          <summary className="squares-admin-summary" style={styles.adminSummary}>
            <div>
              <div style={styles.sectionEyebrow}>Section 3</div>

              <h2 className="so-brand-card-title" style={styles.sectionTitle}>
                Draw centre
              </h2>

              <p style={styles.sectionDescription}>
                View winners, auto draw remaining prizes, or open the dramatic
                live draw.
              </p>
            </div>

            <div className="squares-summary-pills" style={styles.summaryPillRow}>
              <span style={styles.neutralPill}>{winners.length} winners</span>

              <span style={styles.neutralPill}>
                {soldSquareOptions.length} eligible squares
              </span>

              <span style={styles.adminSummaryToggle}>Open / close</span>
            </div>
          </summary>

          <div style={styles.adminDetailsBody}>
            {winners.length ? (
              <div style={styles.winnerList}>
                {winners.map((winner: any) => (
                  <div key={winner.id} style={styles.winnerCard}>
                    <div style={styles.winnerPrizeIcon}>
                      {winner.prize_number}
                    </div>

                    <div>
                      <div style={styles.winnerLabel}>Prize</div>

                      <div style={styles.winnerValue}>
                        {winner.prize_title}
                      </div>
                    </div>

                    <div>
                      <div style={styles.winnerLabel}>Square</div>

                      <div style={styles.winnerValue}>
                        #{winner.square_number}
                      </div>
                    </div>

                    <div>
                      <div style={styles.winnerLabel}>Winner</div>

                      <div style={styles.winnerValue}>
                        {firstNameOnly(winner.customer_name)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={styles.noWinnersBox}>
                No winners have been drawn yet.
              </div>
            )}

            <details open style={styles.drawDetails}>
              <summary style={styles.drawSummary}>
                <div>
                  <h3 style={styles.subTitle}>Live draw tools</h3>

                  <p style={styles.sectionDescription}>
                    Automatic draw and full-screen dramatic draw controls.
                  </p>
                </div>

                <span style={styles.drawToggle}>Open / close</span>
              </summary>

              <div className="squares-draw-grid" style={styles.drawGrid}>
                <form
                  action={`/api/admin/squares/${game.id}/draw/auto`}
                  method="post"
                  style={styles.drawPanel}
                >
                  <h3 style={styles.subTitle}>Automatic random draw</h3>

                  <p style={styles.sectionDescription}>
                    Randomly draw remaining undrawn prizes using the saved auto
                    draw range.
                  </p>

                  <button type="submit" style={styles.drawButton}>
                    Auto draw remaining winners
                  </button>
                </form>

                <DramaticSquaresDraw
                  gameId={game.id}
                  soldSquareOptions={soldSquareOptions}
                  drawnPrizeNumbers={drawnPrizeNumbers}
                  drawnSquareNumbers={drawnSquareNumbers}
                />
              </div>
            </details>
          </div>
        </details>
      </section>
    </main>
  );
}

function CompactDetails({
  eyebrow,
  title,
  description,
  badge,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  badge: string;
  children: ReactNode;
}) {
  return (
    <details style={styles.compactDetails}>
      <summary style={styles.compactSummary}>
        <div style={styles.compactSummaryText}>
          <div style={styles.innerEyebrow}>{eyebrow}</div>

          <h3 style={styles.subTitle}>{title}</h3>

          <p style={styles.sectionDescription}>{description}</p>
        </div>

        <div style={styles.compactActions}>
          <span style={styles.compactBadge}>{badge}</span>
          <span style={styles.adminSummaryToggle}>Open</span>
        </div>
      </summary>

      <div style={styles.compactBody}>{children}</div>
    </details>
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

function HeroMeta({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div style={styles.heroMetaCard}>
      <div style={styles.heroMetaLabel}>{label}</div>
      <div style={styles.heroMetaValue}>{value}</div>
    </div>
  );
}

function StatusMiniPill({ label, active }: { label: string; active: boolean }) {
  return (
    <span
      style={{
        ...styles.statusMiniPill,
        background: active ? "#ecfdf5" : "#f8fafc",
        borderColor: active ? "#bbf7d0" : "#e2e8f0",
        color: active ? "#166534" : "#64748b",
      }}
    >
      {active ? "✓" : "•"} {label}
    </span>
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
  .squares-admin-page,
  .squares-admin-page * {
    box-sizing: border-box;
  }

  .squares-admin-page {
    overflow-x: hidden;
  }

  .squares-admin-page img,
  .squares-admin-page input,
  .squares-admin-page textarea,
  .squares-admin-page select,
  .squares-admin-page button {
    max-width: 100%;
  }

  @media (max-width: 900px) {
    .squares-hero {
      grid-template-columns: 1fr !important;
      min-height: auto !important;
    }

    .squares-hero-image {
      max-width: 240px !important;
      height: 240px !important;
    }

    .squares-summary-grid,
    .squares-readiness-grid,
    .squares-three-column,
    .squares-two-column,
    .squares-media-box,
    .squares-draw-grid {
      grid-template-columns: 1fr !important;
    }

    .squares-admin-summary {
      align-items: flex-start !important;
    }

    .squares-summary-pills {
      width: 100% !important;
      justify-content: flex-start !important;
    }
  }

  @media (max-width: 640px) {
    .squares-admin-page {
      padding: 18px 12px 44px !important;
    }

    .squares-topbar {
      display: grid !important;
      grid-template-columns: 1fr !important;
      gap: 10px !important;
    }

    .squares-topbar a {
      width: 100% !important;
      justify-content: center !important;
      text-align: center !important;
    }

    .squares-hero,
    .squares-readiness-panel {
      padding: 20px !important;
      border-radius: 24px !important;
    }

    .squares-hero-image {
      max-width: 220px !important;
      height: 220px !important;
    }

    .squares-hero h1 {
      font-size: clamp(32px, 11vw, 42px) !important;
      line-height: 1.02 !important;
    }

    .squares-hero-meta {
      grid-template-columns: 1fr !important;
    }

    .squares-preview-box {
      height: 190px !important;
    }

    .squares-admin-page button,
    .squares-admin-page a {
      min-height: 46px !important;
    }

    .squares-readiness-value,
    .squares-readiness-detail {
      overflow-wrap: anywhere !important;
      word-break: break-word !important;
    }
  }
`;

const styles: Record<string, CSSProperties> = {
  page: {
    width: "100%",
    maxWidth: 1180,
    margin: "0 auto",
    padding: "28px 16px 56px",
    background: "#f8fafc",
    minHeight: "100vh",
    overflowX: "hidden",
    boxSizing: "border-box",
  },
  topBar: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "center",
    marginBottom: 16,
    flexWrap: "wrap",
  },
  backLink: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 44,
    padding: "10px 14px",
    borderRadius: 999,
    background: "#ffffff",
    color: "#334155",
    border: "1px solid #cbd5e1",
    textDecoration: "none",
    fontWeight: 900,
  },
  publicLink: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 44,
    padding: "10px 14px",
    borderRadius: 999,
    background: "#ffffff",
    color: "#0f172a",
    border: "1px solid #cbd5e1",
    textDecoration: "none",
    fontWeight: 900,
    fontSize: 14,
  },
  publicUnavailableLink: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 44,
    padding: "10px 14px",
    borderRadius: 999,
    background: "#fff7ed",
    color: "#9a3412",
    border: "1px solid #fed7aa",
    textDecoration: "none",
    fontWeight: 950,
    fontSize: 14,
  },
  upgradeBanner: {
    padding: "clamp(18px, 4vw, 24px)",
    borderRadius: 26,
    background:
      "linear-gradient(135deg, #fff7ed 0%, #ffffff 48%, #eff6ff 100%)",
    border: "1px solid #fed7aa",
    boxShadow: "0 16px 38px rgba(15,23,42,0.08)",
    marginBottom: 16,
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
    gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 320px), 1fr))",
    gap: 20,
    alignItems: "center",
    padding: "clamp(20px, 5vw, 28px)",
    borderRadius: 28,
    background:
      "radial-gradient(circle at top left, rgba(22,131,248,0.26), transparent 32%), linear-gradient(135deg, #0f172a 0%, #111827 55%, #020617 100%)",
    color: "#ffffff",
    marginBottom: 16,
    minHeight: 330,
    boxShadow: "0 18px 42px rgba(15,23,42,0.16)",
    overflow: "hidden",
    minWidth: 0,
  },
  heroContent: {
    minWidth: 0,
  },
  eyebrow: {
    display: "inline-flex",
    padding: "6px 10px",
    borderRadius: 999,
    background: "rgba(255,255,255,0.12)",
    fontSize: 12,
    fontWeight: 950,
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
    minWidth: 0,
  },
  heroTitle: {
    margin: 0,
    fontSize: "clamp(34px, 8vw, 48px)",
    lineHeight: 1.03,
    letterSpacing: "-0.055em",
    overflowWrap: "anywhere",
    minWidth: 0,
  },
  statusPill: {
    padding: "8px 12px",
    borderRadius: 999,
    border: "1px solid",
    fontSize: 13,
    textTransform: "capitalize",
    fontWeight: 950,
    flexShrink: 0,
  },
  heroSlug: {
    margin: "9px 0 0",
    color: "#cbd5e1",
    fontSize: 14,
    fontWeight: 800,
    overflowWrap: "anywhere",
  },
  heroDescription: {
    margin: "14px 0 0",
    color: "#e2e8f0",
    lineHeight: 1.55,
    maxWidth: 760,
    overflowWrap: "anywhere",
  },
  heroDescriptionMuted: {
    margin: "14px 0 0",
    color: "#94a3b8",
    lineHeight: 1.55,
  },
  heroMetaGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 130px), 1fr))",
    gap: 10,
    marginTop: 22,
    maxWidth: 700,
  },
  heroMetaCard: {
    padding: "12px 14px",
    borderRadius: 16,
    background: "rgba(255,255,255,0.08)",
    border: "1px solid rgba(255,255,255,0.12)",
    minWidth: 0,
  },
  heroMetaLabel: {
    color: "#94a3b8",
    fontSize: 12,
    fontWeight: 900,
  },
  heroMetaValue: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: 950,
    marginTop: 4,
    overflowWrap: "anywhere",
  },
  heroImageWrap: {
    width: "100%",
    maxWidth: 280,
    height: 280,
    borderRadius: 22,
    background: "#1e293b",
    border: "1px solid rgba(255,255,255,0.14)",
    overflow: "hidden",
    alignSelf: "center",
    justifySelf: "center",
    boxShadow: "0 18px 36px rgba(0,0,0,0.22)",
  },
  heroImage: {
    width: "100%",
    height: "100%",
    maxHeight: 280,
    display: "block",
  },
  readinessPanel: {
    display: "grid",
    gap: 16,
    padding: 18,
    borderRadius: 24,
    background:
      "linear-gradient(135deg, #ffffff 0%, #f8fafc 56%, #eff6ff 100%)",
    border: "1px solid #dbeafe",
    boxShadow: "0 8px 28px rgba(15,23,42,0.055)",
    marginBottom: 16,
    minWidth: 0,
  },
  readinessHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: 14,
    alignItems: "flex-start",
    flexWrap: "wrap",
  },
  readinessEyebrow: {
    color: "#2563eb",
    fontSize: 12,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    marginBottom: 5,
  },
  readinessTitle: {
    margin: 0,
    color: "#0f172a",
    fontSize: "clamp(22px, 5vw, 28px)",
    letterSpacing: "-0.045em",
    lineHeight: 1.05,
    overflowWrap: "anywhere",
  },
  readinessIntro: {
    margin: "7px 0 0",
    color: "#64748b",
    fontSize: 14,
    lineHeight: 1.45,
    fontWeight: 750,
    maxWidth: 760,
  },
  readinessStatusPill: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: "fit-content",
    padding: "8px 12px",
    borderRadius: 999,
    border: "1px solid",
    fontSize: 12,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    whiteSpace: "nowrap",
  },
  readinessGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: 10,
  },
  readinessItem: {
    display: "grid",
    gridTemplateColumns: "auto minmax(0, 1fr)",
    gap: 10,
    alignItems: "start",
    padding: 13,
    borderRadius: 18,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    minWidth: 0,
    boxShadow: "0 8px 20px rgba(15,23,42,0.04)",
  },
  readinessItemGood: {
    background: "linear-gradient(135deg, #ecfdf5 0%, #ffffff 78%)",
    borderColor: "#bbf7d0",
    boxShadow: "0 10px 24px rgba(22,163,74,0.09)",
  },
  readinessItemWarning: {
    background: "linear-gradient(135deg, #fff7ed 0%, #ffffff 78%)",
    borderColor: "#fed7aa",
    boxShadow: "0 10px 24px rgba(234,88,12,0.09)",
  },
  readinessItemNeutral: {
    background: "linear-gradient(135deg, #f8fafc 0%, #ffffff 78%)",
    borderColor: "#e2e8f0",
    boxShadow: "0 8px 20px rgba(15,23,42,0.04)",
  },
  readinessToneDot: {
    width: 12,
    height: 12,
    borderRadius: 999,
    border: "1px solid",
    marginTop: 4,
  },
  readinessContent: {
    display: "grid",
    gap: 3,
    minWidth: 0,
  },
  readinessLabel: {
    color: "#64748b",
    fontSize: 12,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.06em",
  },
  readinessValue: {
    color: "#0f172a",
    fontSize: 16,
    fontWeight: 950,
    overflowWrap: "anywhere",
  },
  readinessDetail: {
    color: "#64748b",
    fontSize: 12,
    lineHeight: 1.35,
    fontWeight: 750,
    overflowWrap: "anywhere",
  },
    summaryGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 150px), 1fr))",
    gap: 12,
    marginBottom: 16,
  },
  summaryCard: {
    padding: 16,
    borderRadius: 20,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    boxShadow: "0 2px 12px rgba(15,23,42,0.04)",
    minWidth: 0,
  },
  summaryLabel: {
    color: "#64748b",
    fontSize: 12,
    fontWeight: 950,
  },
  summaryValue: {
    color: "#0f172a",
    fontSize: 22,
    fontWeight: 950,
    marginTop: 5,
    overflowWrap: "anywhere",
  },
  progressCard: {
    padding: 16,
    borderRadius: 22,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    boxShadow: "0 2px 12px rgba(15,23,42,0.04)",
    marginBottom: 16,
  },
  progressHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "center",
    marginBottom: 10,
    flexWrap: "wrap",
  },
  progressPercent: {
    color: "#166534",
    fontWeight: 950,
    fontSize: 18,
  },
  progressTrack: {
    height: 11,
    background: "#e2e8f0",
    borderRadius: 999,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    background: "linear-gradient(90deg, #16a34a, #22c55e)",
    borderRadius: 999,
  },
  form: {
    display: "grid",
    gap: 0,
    minWidth: 0,
  },
  section: {
    padding: "clamp(16px, 4vw, 18px)",
    borderRadius: 24,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    boxShadow: "0 2px 12px rgba(15,23,42,0.04)",
    marginBottom: 16,
    minWidth: 0,
    overflow: "hidden",
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
    fontSize: "clamp(22px, 5vw, 26px)",
    letterSpacing: "-0.035em",
    overflowWrap: "anywhere",
  },
  sectionDescription: {
    margin: "5px 0 0",
    color: "#64748b",
    fontSize: 14,
    lineHeight: 1.45,
    overflowWrap: "anywhere",
  },
  adminDetails: {
    display: "grid",
    gap: 0,
    minWidth: 0,
  },
  adminSummary: {
    display: "flex",
    justifyContent: "space-between",
    gap: 14,
    alignItems: "center",
    cursor: "pointer",
    listStyle: "none",
    flexWrap: "wrap",
    minWidth: 0,
  },
  adminSummaryToggle: {
    flexShrink: 0,
    padding: "8px 12px",
    borderRadius: 999,
    background: "#eff6ff",
    color: "#1d4ed8",
    border: "1px solid #bfdbfe",
    fontSize: 12,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.04em",
  },
  adminDetailsBody: {
    display: "grid",
    gap: 12,
    marginTop: 16,
    minWidth: 0,
  },
  summaryPillRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: 8,
    alignItems: "center",
  },
  statusMiniPill: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "8px 11px",
    borderRadius: 999,
    border: "1px solid",
    fontSize: 12,
    fontWeight: 950,
  },
  neutralPill: {
    display: "inline-flex",
    alignItems: "center",
    padding: "8px 11px",
    borderRadius: 999,
    background: "#f8fafc",
    color: "#334155",
    border: "1px solid #e2e8f0",
    fontSize: 12,
    fontWeight: 950,
  },
  innerPanel: {
    display: "grid",
    gap: 12,
    padding: 14,
    borderRadius: 20,
    background:
      "linear-gradient(135deg, #f8fafc 0%, #ffffff 52%, #eff6ff 100%)",
    border: "1px solid #e2e8f0",
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
  innerEyebrow: {
    color: "#2563eb",
    fontSize: 12,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    marginBottom: 5,
  },
  compactDetails: {
    borderRadius: 20,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    overflow: "hidden",
    minWidth: 0,
  },
  compactSummary: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "flex-start",
    cursor: "pointer",
    listStyle: "none",
    padding: 14,
    background:
      "linear-gradient(135deg, #f8fafc 0%, #ffffff 55%, #eff6ff 100%)",
    flexWrap: "wrap",
  },
  compactSummaryText: {
    minWidth: 0,
    flex: "1 1 260px",
  },
  compactActions: {
    display: "flex",
    gap: 8,
    alignItems: "center",
    justifyContent: "flex-end",
    flexWrap: "wrap",
  },
  compactBadge: {
    display: "inline-flex",
    alignItems: "center",
    padding: "8px 11px",
    borderRadius: 999,
    background: "#ffffff",
    color: "#334155",
    border: "1px solid #e2e8f0",
    fontSize: 12,
    fontWeight: 950,
    whiteSpace: "nowrap",
  },
  compactBody: {
    display: "grid",
    gap: 12,
    padding: 14,
    borderTop: "1px solid #e2e8f0",
    background: "#ffffff",
  },
  twoColumn: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 240px), 1fr))",
    gap: 12,
    marginBottom: 12,
  },
  twoColumnNoMargin: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 240px), 1fr))",
    gap: 12,
  },
  threeColumn: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 170px), 1fr))",
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
    fontWeight: 950,
  },
  input: {
    width: "100%",
    minHeight: 44,
    padding: "10px 12px",
    borderRadius: 13,
    border: "1px solid #cbd5e1",
    background: "#ffffff",
    color: "#0f172a",
    fontSize: 15,
    boxSizing: "border-box",
    minWidth: 0,
  },
  textarea: {
    width: "100%",
    padding: "10px 12px",
    borderRadius: 13,
    border: "1px solid #cbd5e1",
    background: "#ffffff",
    color: "#0f172a",
    fontSize: 15,
    resize: "vertical",
    boxSizing: "border-box",
    minWidth: 0,
  },
  mediaBox: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 260px), 1fr))",
    gap: 14,
    padding: 12,
    borderRadius: 18,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    minWidth: 0,
  },
  mediaControls: {
    minWidth: 0,
  },
  subTitle: {
    margin: 0,
    color: "#0f172a",
    fontSize: 18,
    letterSpacing: "-0.01em",
  },
  previewBox: {
    height: 180,
    borderRadius: 18,
    border: "1px solid #e2e8f0",
    background: "#ffffff",
    overflow: "hidden",
  },
  previewImage: {
    width: "100%",
    height: "100%",
    display: "block",
  },
  submitBar: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 14,
    flexWrap: "wrap",
    padding: 16,
    borderRadius: 20,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    marginBottom: 16,
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
    minHeight: 44,
  },
  mutedSmall: {
    color: "#64748b",
    fontSize: 13,
    marginTop: 3,
  },
  helpText: {
    color: "#64748b",
    fontSize: 13,
    margin: 0,
    overflowWrap: "anywhere",
  },
  winnerList: {
    display: "grid",
    gap: 10,
    marginBottom: 14,
  },
  winnerCard: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 140px), 1fr))",
    gap: 12,
    padding: 14,
    borderRadius: 18,
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    alignItems: "center",
    minWidth: 0,
  },
  winnerPrizeIcon: {
    width: 38,
    height: 38,
    borderRadius: 999,
    background: "#0f172a",
    color: "#ffffff",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 950,
  },
  winnerLabel: {
    color: "#64748b",
    fontSize: 12,
    fontWeight: 950,
    marginBottom: 4,
  },
  winnerValue: {
    color: "#0f172a",
    fontSize: 16,
    fontWeight: 950,
    overflowWrap: "anywhere",
  },
  noWinnersBox: {
    padding: 16,
    borderRadius: 16,
    background: "#f8fafc",
    border: "1px dashed #cbd5e1",
    color: "#64748b",
    fontWeight: 900,
    marginBottom: 14,
  },
  drawDetails: {
    padding: 0,
    borderRadius: 20,
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    overflow: "hidden",
    marginTop: 14,
  },
  drawSummary: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "center",
    cursor: "pointer",
    listStyle: "none",
    padding: 16,
    background: "#ffffff",
    borderBottom: "1px solid #e2e8f0",
    flexWrap: "wrap",
  },
  drawToggle: {
    flexShrink: 0,
    padding: "8px 12px",
    borderRadius: 999,
    background: "#eff6ff",
    color: "#1d4ed8",
    border: "1px solid #bfdbfe",
    fontSize: 12,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.04em",
  },
  drawGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 280px), 1fr))",
    gap: 14,
    padding: 16,
  },
  drawPanel: {
    padding: 16,
    borderRadius: 18,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    display: "grid",
    gap: 12,
    minWidth: 0,
  },
  drawButton: {
    padding: "13px 20px",
    border: "none",
    borderRadius: 999,
    background: "#16a34a",
    color: "#ffffff",
    fontWeight: 950,
    cursor: "pointer",
    minHeight: 44,
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
};
