"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

const DEFAULT_SQUARES_IMAGE = "/brand/so-default-squares.png";

type Prize = {
  title?: string;
  name?: string;
  description?: string;
};

type Winner = {
  id: string;
  prize_title: string;
  square_number: number;
  customer_name?: string | null;
};

type EntryQuestion = {
  text?: string | null;
  answer?: string | null;
};

type FreeEntry = {
  address?: string | null;
  instructions?: string | null;
  closes_at?: string | null;
  closesAt?: string | null;
};

type TenantBranding = {
  displayName?: string | null;
  tagline?: string | null;
  logoUrl?: string | null;
  logoMarkUrl?: string | null;
  primaryColour?: string | null;
  accentColour?: string | null;
  footerText?: string | null;
  public_display_name?: string | null;
  public_tagline?: string | null;
  public_logo_url?: string | null;
  public_logo_mark_url?: string | null;
  public_primary_colour?: string | null;
  public_accent_colour?: string | null;
  public_footer_text?: string | null;
};

type SquaresGame = {
  id: string;
  tenantSlug: string;
  slug: string;
  title: string;
  description?: string;
  imageUrl?: string;
  imageFocusX?: number | null;
  imageFocusY?: number | null;
  image_focus_x?: number | null;
  image_focus_y?: number | null;
  drawAt?: string | null;
  status: string;
  currency: string;
  pricePerSquareCents: number;
  totalSquares: number;
  prizes: Prize[];
  soldSquares: number[];
  reservedSquares: number[];
  winners: Winner[];
  question?: EntryQuestion | null;
  freeEntry?: FreeEntry | null;
  branding?: TenantBranding | null;
};

type Props = {
  params: {
    slug: string;
  };
};

function cleanText(value: unknown) {
  return String(value ?? "").trim();
}

function normaliseHexColour(value: unknown, fallback: string) {
  const clean = cleanText(value).toUpperCase();

  if (/^#[0-9A-F]{6}$/.test(clean)) {
    return clean;
  }

  return fallback;
}

function normaliseBranding(input: TenantBranding | null | undefined) {
  const raw = input ?? {};

  return {
    displayName: cleanText(raw.displayName ?? raw.public_display_name),
    tagline: cleanText(raw.tagline ?? raw.public_tagline),
    logoUrl: cleanText(raw.logoUrl ?? raw.public_logo_url),
    logoMarkUrl: cleanText(raw.logoMarkUrl ?? raw.public_logo_mark_url),
    primaryColour: normaliseHexColour(
      raw.primaryColour ?? raw.public_primary_colour,
      "#2563EB",
    ),
    accentColour: normaliseHexColour(
      raw.accentColour ?? raw.public_accent_colour,
      "#F59E0B",
    ),
    footerText: cleanText(raw.footerText ?? raw.public_footer_text),
  };
}

function formatCurrencyFromCents(cents: number, currency: string) {
  const major = Number(cents || 0) / 100;

  try {
    return new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency: currency || "GBP",
    }).format(Number.isFinite(major) ? major : 0);
  } catch {
    return `${currency || "GBP"} ${(Number.isFinite(major) ? major : 0).toFixed(
      2,
    )}`;
  }
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "—";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "full",
    timeStyle: "short",
  }).format(date);
}

function ordinal(position: number) {
  const suffix =
    position % 10 === 1 && position % 100 !== 11
      ? "st"
      : position % 10 === 2 && position % 100 !== 12
        ? "nd"
        : position % 10 === 3 && position % 100 !== 13
          ? "rd"
          : "th";

  return `${position}${suffix}`;
}

function normaliseFocus(value: unknown, fallback = 50) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(0, Math.min(100, Math.round(parsed)));
}

function hasEntryQuestion(question: EntryQuestion | null | undefined) {
  return Boolean(
    String(question?.text ?? "").trim() && String(question?.answer ?? "").trim(),
  );
}

function hasFreeEntry(freeEntry: FreeEntry | null | undefined) {
  return Boolean(
    String(freeEntry?.address ?? "").trim() ||
      String(freeEntry?.instructions ?? "").trim() ||
      String(freeEntry?.closes_at ?? freeEntry?.closesAt ?? "").trim(),
  );
}

function getStatusLabel(status: string | null | undefined) {
  const clean = String(status || "draft").toLowerCase();

  if (clean === "published") return "Open now";
  if (clean === "drawn") return "Drawn";
  if (clean === "closed") return "Closed";
  return "Draft";
}

function getStatusStyle(status: string | null | undefined): React.CSSProperties {
  const clean = String(status || "draft").toLowerCase();

  if (clean === "published") {
    return {
      background: "#dcfce7",
      color: "#166534",
      border: "1px solid #bbf7d0",
    };
  }

  if (clean === "drawn") {
    return {
      background: "#dbeafe",
      color: "#1d4ed8",
      border: "1px solid #bfdbfe",
    };
  }

  if (clean === "closed") {
    return {
      background: "#fff7ed",
      color: "#9a3412",
      border: "1px solid #fed7aa",
    };
  }

  return {
    background: "#f1f5f9",
    color: "#475569",
    border: "1px solid #e2e8f0",
  };
}

const responsiveStyles = `
  @media (min-width: 900px) {
    .public-squares-hero-inner {
      max-width: 1180px !important;
      padding-bottom: 58px !important;
    }

    .public-squares-brand-strip {
      max-width: 680px !important;
      margin-bottom: 30px !important;
    }

    .public-squares-hero-title {
      max-width: 780px !important;
    }

    .public-squares-hero-meta {
      grid-template-columns: repeat(4, minmax(0, 1fr)) !important;
      max-width: 1040px !important;
    }

    .public-squares-content-wrap {
      margin-top: -44px !important;
    }

    .public-squares-container {
      max-width: 1080px !important;
      gap: 18px !important;
    }

    .public-squares-number-grid {
      grid-template-columns: repeat(auto-fill, minmax(54px, 1fr)) !important;
      gap: 10px !important;
    }

    .public-squares-number-button {
      height: 52px !important;
      border-radius: 15px !important;
    }
  }

  @media (max-width: 760px) {
    .public-squares-page {
      background: linear-gradient(180deg, #020617 0px, #0f172a 620px, #f8fafc 620px, #f8fafc 100%) !important;
      overflow-x: hidden;
    }

    .public-squares-hero {
      min-height: 620px !important;
      align-items: flex-end !important;
    }

    .public-squares-hero-inner {
      padding: 18px 14px 34px !important;
    }

    .public-squares-hero-nav {
      display: grid !important;
      grid-template-columns: 1fr !important;
      gap: 10px !important;
      margin-bottom: 18px !important;
    }

    .public-squares-hero-nav a {
      width: 100% !important;
      justify-content: center !important;
      text-align: center !important;
      box-sizing: border-box !important;
    }

    .public-squares-brand-strip {
      grid-template-columns: 56px minmax(0, 1fr) !important;
      gap: 12px !important;
      padding: 12px !important;
      border-radius: 20px !important;
      margin-bottom: 24px !important;
      max-width: 100% !important;
    }

    .public-squares-brand-logo,
    .public-squares-brand-fallback {
      width: 56px !important;
      height: 56px !important;
      border-radius: 16px !important;
    }

    .public-squares-brand-name {
      font-size: 22px !important;
      letter-spacing: -0.05em !important;
    }

    .public-squares-brand-tagline {
      font-size: 12px !important;
      line-height: 1.35 !important;
    }

    .public-squares-badge-row {
      gap: 8px !important;
      margin-bottom: 18px !important;
    }

    .public-squares-type-badge,
    .public-squares-status-pill {
      font-size: 11px !important;
      padding: 7px 11px !important;
    }

    .public-squares-hero-title {
      font-size: clamp(36px, 14vw, 56px) !important;
      line-height: 0.96 !important;
      letter-spacing: -0.055em !important;
      overflow-wrap: anywhere !important;
    }

    .public-squares-hero-description {
      font-size: 15px !important;
      line-height: 1.55 !important;
      margin-top: 16px !important;
    }

    .public-squares-hero-meta {
      grid-template-columns: 1fr 1fr !important;
      gap: 10px !important;
      margin-top: 22px !important;
    }

    .public-squares-meta-card {
      padding: 13px !important;
      border-radius: 18px !important;
      min-width: 0 !important;
    }

    .public-squares-meta-card strong {
      font-size: 14px !important;
      line-height: 1.25 !important;
      overflow-wrap: anywhere !important;
    }

    .public-squares-hero-footer {
      margin-top: 18px !important;
      display: grid !important;
      grid-template-columns: 1fr !important;
      gap: 6px !important;
    }

    .public-squares-content-wrap {
      margin-top: -34px !important;
      padding-bottom: 44px !important;
    }

    .public-squares-container {
      padding: 0 12px !important;
      gap: 16px !important;
    }

    .public-squares-heading {
      font-size: 26px !important;
      margin: 6px 0 8px !important;
    }

    .public-squares-legal-notice,
    .public-squares-buying-guide,
    .public-squares-prizes,
    .public-squares-winners,
    .public-squares-quick-select,
    .public-squares-total-box {
      border-radius: 22px !important;
      padding: 16px !important;
    }

    .public-squares-guide-grid {
      grid-template-columns: 1fr !important;
      gap: 10px !important;
    }

    .public-squares-prize-card {
      gap: 12px !important;
      padding: 14px !important;
      border-radius: 18px !important;
    }

    .public-squares-prize-position {
      width: 54px !important;
      height: 54px !important;
      border-radius: 16px !important;
      font-size: 18px !important;
    }

    .public-squares-prize-title {
      font-size: 18px !important;
    }

    .public-squares-winner-card {
      display: grid !important;
      grid-template-columns: 1fr !important;
      gap: 12px !important;
    }

    .public-squares-quick-controls {
      display: grid !important;
      grid-template-columns: 1fr !important;
      gap: 10px !important;
      align-items: stretch !important;
    }

    .public-squares-quantity-input,
    .public-squares-auto-button,
    .public-squares-clear-button {
      width: 100% !important;
      box-sizing: border-box !important;
    }

    .public-squares-number-grid {
      grid-template-columns: repeat(auto-fill, minmax(46px, 1fr)) !important;
      gap: 8px !important;
    }

    .public-squares-number-button {
      height: 48px !important;
      border-radius: 14px !important;
      font-size: 14px !important;
      padding: 0 !important;
    }

    .public-squares-basket-row {
      display: grid !important;
      grid-template-columns: 1fr !important;
      gap: 10px !important;
      align-items: stretch !important;
    }

    .public-squares-remove-button {
      justify-self: start !important;
    }

    .public-squares-cover-fees,
    .public-squares-terms-box {
      display: grid !important;
      grid-template-columns: auto 1fr !important;
      gap: 10px !important;
    }

    .public-squares-input,
    .public-squares-primary-button {
      width: 100% !important;
      box-sizing: border-box !important;
    }
  }

  @media (max-width: 430px) {
    .public-squares-hero-meta {
      grid-template-columns: 1fr !important;
    }

    .public-squares-hero {
      min-height: 700px !important;
    }

    .public-squares-page {
      background: linear-gradient(180deg, #020617 0px, #0f172a 700px, #f8fafc 700px, #f8fafc 100%) !important;
    }
  }
`;
export default function PublicSquaresPage({ params }: Props) {
  const { slug } = params;

  const [game, setGame] = useState<SquaresGame | null>(null);
  const [selectedSquares, setSelectedSquares] = useState<number[]>([]);
  const [autoQuantity, setAutoQuantity] = useState(1);
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [entryAnswer, setEntryAnswer] = useState("");
  const [coverFees, setCoverFees] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [showAllPrizes, setShowAllPrizes] = useState(false);
  const [showPostalDetails, setShowPostalDetails] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [reservationMessage, setReservationMessage] = useState("");

  async function loadGame() {
    try {
      setLoading(true);
      setError("");
      setReservationMessage("");

      const response = await fetch(
        `/api/public/squares/${encodeURIComponent(slug)}`,
        { cache: "no-store" },
      );

      const text = await response.text();

      let parsed: any = null;

      try {
        parsed = JSON.parse(text);
      } catch {
        throw new Error(`API did not return JSON: ${text.slice(0, 120)}`);
      }

      if (!response.ok) {
        throw new Error(parsed?.error || "Failed to load squares game");
      }

      setGame(parsed.game ?? null);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load squares game",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!slug) return;
    loadGame();
  }, [slug]);

  const unavailableSquares = useMemo(() => {
    const set = new Set<number>();

    for (const square of game?.soldSquares ?? []) {
      set.add(Number(square));
    }

    for (const square of game?.reservedSquares ?? []) {
      set.add(Number(square));
    }

    return set;
  }, [game]);

  const availableCount = useMemo(() => {
    if (!game) return 0;

    let count = 0;

    for (let number = 1; number <= game.totalSquares; number += 1) {
      if (!unavailableSquares.has(number)) count += 1;
    }

    return count;
  }, [game, unavailableSquares]);

  const isPublished = game?.status === "published";
  const isClosed = game?.status === "closed";
  const isDrawn = game?.status === "drawn";
  const isDraft = game?.status === "draft";
  const canReserve = Boolean(game && isPublished);
  const requiresQuestion = hasEntryQuestion(game?.question);
  const showFreeEntry = hasFreeEntry(game?.freeEntry);

  const imageFocusX = normaliseFocus(
    game?.imageFocusX ?? game?.image_focus_x,
    50,
  );

  const imageFocusY = normaliseFocus(
    game?.imageFocusY ?? game?.image_focus_y,
    50,
  );

  const imageObjectPosition = `${imageFocusX}% ${imageFocusY}%`;
  const hasCustomImage = Boolean(game?.imageUrl);
  const heroImageUrl = game?.imageUrl || DEFAULT_SQUARES_IMAGE;

  const branding = normaliseBranding(game?.branding);
  const brandDisplayName = branding.displayName || game?.tenantSlug || "";
  const brandTagline = branding.tagline || "";
  const brandLogoSrc = branding.logoMarkUrl || branding.logoUrl;
  const primaryColour = branding.primaryColour;
  const accentColour = branding.accentColour;

  const subtotalCents =
    selectedSquares.length * Number(game?.pricePerSquareCents || 0);
  const feeCents = coverFees ? Math.round(subtotalCents * 0.1) : 0;
  const totalCents = subtotalCents + feeCents;

  const hasSelectedSquares = selectedSquares.length > 0;
  const hasCustomerName = customerName.trim().length > 0;
  const hasCustomerEmail = customerEmail.trim().length > 0;
  const hasEntryAnswer = !requiresQuestion || entryAnswer.trim().length > 0;

  const checkoutReady =
    canReserve &&
    hasSelectedSquares &&
    hasCustomerName &&
    hasCustomerEmail &&
    hasEntryAnswer &&
    acceptedTerms;

  const checkoutChecklist = [
    { label: "Choose at least one square", complete: hasSelectedSquares },
    { label: "Enter your name", complete: hasCustomerName },
    { label: "Enter your email", complete: hasCustomerEmail },
    ...(requiresQuestion
      ? [{ label: "Answer the required entry question", complete: hasEntryAnswer }]
      : []),
    { label: "Accept the terms and privacy policy", complete: acceptedTerms },
  ];

  const nextCheckoutHelp = !canReserve
    ? "This squares game is not currently open for checkout."
    : !hasSelectedSquares
      ? "Choose at least one square before checkout."
      : !hasCustomerName
        ? "Enter your name before checkout."
        : !hasCustomerEmail
          ? "Enter your email before checkout."
          : requiresQuestion && !hasEntryAnswer
            ? "Answer the required entry question before checkout."
            : !acceptedTerms
              ? "Accept the terms and privacy policy before checkout."
              : "Ready for secure checkout.";

  const brandedPrimaryButtonStyle: React.CSSProperties = {
    ...styles.primaryButton,
    background: `linear-gradient(135deg, ${primaryColour} 0%, #1d4ed8 58%, #1e40af 100%)`,
    boxShadow: `0 14px 30px ${primaryColour}36`,
  };

  const brandedAutoButtonStyle: React.CSSProperties = {
    ...styles.autoButton,
    background: primaryColour,
  };

  const brandedPrizePositionStyle: React.CSSProperties = {
    ...styles.prizePosition,
    background: `linear-gradient(135deg, ${accentColour} 0%, #2563eb 62%, #1e40af 100%)`,
    boxShadow: `0 10px 24px ${accentColour}33`,
  };

  function toggleSquare(square: number) {
    if (!game || !canReserve) return;
    if (unavailableSquares.has(square)) return;

    setSelectedSquares((current) =>
      current.includes(square)
        ? current.filter((item) => item !== square)
        : [...current, square].sort((a, b) => a - b),
    );

    setError("");
    setReservationMessage("");
  }

  function clearBasket() {
    setSelectedSquares([]);
    setError("");
    setReservationMessage("");
  }

  async function autoSelectSquares(quantity: number) {
    if (!game || !canReserve) return;

    const requested = Math.max(1, Math.floor(Number(quantity) || 0));

    try {
      setSaving(true);
      setError("");
      setReservationMessage("");

      const response = await fetch(
        `/api/public/squares/${encodeURIComponent(slug)}/reserve`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            randomCount: requested,
            previewOnly: true,
          }),
        },
      );

      const text = await response.text();

      let parsed: any = null;

      try {
        parsed = JSON.parse(text);
      } catch {
        throw new Error(`Random API did not return JSON: ${text.slice(0, 120)}`);
      }

      if (!response.ok) {
        throw new Error(parsed?.error || "Random selection failed");
      }

      setSelectedSquares(Array.isArray(parsed.squares) ? parsed.squares : []);
      setAutoQuantity(requested);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Random selection failed");
    } finally {
      setSaving(false);
    }
  }

  async function reserveSquares() {
    if (!game || !canReserve) return;

    try {
      setSaving(true);
      setError("");
      setReservationMessage("");

      if (!customerName.trim()) {
        throw new Error("Please enter your name.");
      }

      if (!customerEmail.trim()) {
        throw new Error("Please enter your email.");
      }

      if (selectedSquares.length === 0) {
        throw new Error("Please select at least one square.");
      }

      if (requiresQuestion && !entryAnswer.trim()) {
        throw new Error("Please answer the required entry question before checkout.");
      }

      if (!acceptedTerms) {
        throw new Error(
          "Please confirm you have accepted the terms and privacy policy.",
        );
      }

      const reserveResponse = await fetch(
        `/api/public/squares/${encodeURIComponent(slug)}/reserve`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            squares: selectedSquares,
            customerName: customerName.trim(),
            customerEmail: customerEmail.trim(),
            entryAnswer: entryAnswer.trim(),
          }),
        },
      );

      const reserveText = await reserveResponse.text();

      let reserveParsed: any = null;

      try {
        reserveParsed = JSON.parse(reserveText);
      } catch {
        throw new Error(
          `Reserve API did not return JSON: ${reserveText.slice(0, 120)}`,
        );
      }

      if (!reserveResponse.ok) {
        throw new Error(reserveParsed?.error || "Reserve failed");
      }

      const reservationToken = String(
        reserveParsed?.reservationToken ?? "",
      ).trim();

      if (!reservationToken) {
        throw new Error(
          "Reservation succeeded but no reservation token was returned.",
        );
      }

      setReservationMessage("Squares reserved. Redirecting to checkout...");

      const checkoutResponse = await fetch("/api/stripe/checkout/squares", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gameId: game.id,
          reservationToken,
          coverFees,
        }),
      });

      const checkoutText = await checkoutResponse.text();

      let checkoutParsed: any = null;

      try {
        checkoutParsed = JSON.parse(checkoutText);
      } catch {
        throw new Error(
          `Checkout API did not return JSON: ${checkoutText.slice(0, 120)}`,
        );
      }

      if (!checkoutResponse.ok) {
        throw new Error(checkoutParsed?.error || "Checkout failed");
      }

      const checkoutUrl = String(
        checkoutParsed?.url ??
          checkoutParsed?.checkoutUrl ??
          checkoutParsed?.sessionUrl ??
          "",
      ).trim();

      if (!checkoutUrl) {
        throw new Error(
          "Checkout session created but no checkout URL was returned.",
        );
      }

      window.location.href = checkoutUrl;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reserve failed");
      await loadGame();
    } finally {
      setSaving(false);
    }
  }

  if (!slug) return <div style={styles.wrap}>Loading…</div>;
  if (loading) return <div style={styles.wrap}>Loading squares game…</div>;
  if (error && !game) return <div style={styles.wrap}>{error}</div>;
  if (!game) return <div style={styles.wrap}>Squares game not found.</div>;

  const visiblePrizes = showAllPrizes ? game.prizes : game.prizes.slice(0, 3);

  return (
    <div className="public-squares-page" style={styles.page}>
      <style>{responsiveStyles}</style>

      <section className="public-squares-hero" style={styles.hero}>
        <img
          src={heroImageUrl}
          alt={game.title}
          style={{
            ...styles.heroBackgroundImage,
            objectFit: hasCustomImage ? "cover" : "contain",
            objectPosition: hasCustomImage ? imageObjectPosition : "center",
            background: hasCustomImage
              ? "#0f172a"
              : "linear-gradient(135deg, #ffffff 0%, #f8fafc 52%, #eff6ff 100%)",
            padding: hasCustomImage ? 0 : 46,
            boxSizing: "border-box",
            opacity: hasCustomImage ? 1 : 0.78,
          }}
        />

        <div style={styles.heroOverlay} />

        <div className="public-squares-hero-inner" style={styles.heroInner}>
          <nav className="public-squares-hero-nav" style={styles.heroNav}>
            <Link href={`/c/${game.tenantSlug}`} style={styles.heroBackLink}>
              ← Back to campaigns
            </Link>
          </nav>

          {brandDisplayName || brandLogoSrc ? (
            <div
              className="public-squares-brand-strip"
              style={{
                ...styles.brandStrip,
                borderColor: `${accentColour}66`,
              }}
            >
              {brandLogoSrc ? (
                <div
                  className="public-squares-brand-logo"
                  style={styles.brandLogoWrap}
                >
                  <img
                    src={brandLogoSrc}
                    alt={brandDisplayName || game.tenantSlug}
                    style={styles.brandLogo}
                  />
                </div>
              ) : (
                <div
                  className="public-squares-brand-fallback"
                  style={{
                    ...styles.brandFallback,
                    background: primaryColour,
                    borderColor: accentColour,
                  }}
                >
                  {(brandDisplayName || game.tenantSlug)
                    .slice(0, 2)
                    .toUpperCase()}
                </div>
              )}

              <div style={styles.brandCopy}>
                <p style={{ ...styles.brandKicker, color: accentColour }}>
                  Fundraising campaign
                </p>

                <h2
                  className="public-squares-brand-name"
                  style={styles.brandName}
                >
                  {brandDisplayName || game.tenantSlug}
                </h2>

                {brandTagline ? (
                  <p
                    className="public-squares-brand-tagline"
                    style={styles.brandTagline}
                  >
                    {brandTagline}
                  </p>
                ) : null}
              </div>
            </div>
          ) : null}
                    <div className="public-squares-badge-row" style={styles.badgeRow}>
            <span
              className="public-squares-type-badge"
              style={{
                ...styles.typeBadge,
                borderColor: `${accentColour}88`,
              }}
            >
              Squares
            </span>

            <span
              className="public-squares-status-pill"
              style={{
                ...styles.statusPill,
                ...getStatusStyle(game.status),
              }}
            >
              {getStatusLabel(game.status)}
            </span>
          </div>

          <h1 className="public-squares-hero-title" style={styles.heroTitle}>
            {game.title}
          </h1>

          {game.description ? (
            <p
              className="public-squares-hero-description"
              style={styles.heroDescription}
            >
              {game.description}
            </p>
          ) : null}

          <div className="public-squares-hero-meta" style={styles.heroMeta}>
            <div className="public-squares-meta-card" style={styles.metaCard}>
              <span style={styles.metaLabel}>Square price</span>
              <strong>
                {formatCurrencyFromCents(
                  game.pricePerSquareCents,
                  game.currency,
                )}
              </strong>
            </div>

            <div className="public-squares-meta-card" style={styles.metaCard}>
              <span style={styles.metaLabel}>Draw date</span>
              <strong>{formatDateTime(game.drawAt)}</strong>
            </div>

            <div className="public-squares-meta-card" style={styles.metaCard}>
              <span style={styles.metaLabel}>Total squares</span>
              <strong>{game.totalSquares}</strong>
            </div>

            <div className="public-squares-meta-card" style={styles.metaCard}>
              <span style={styles.metaLabel}>Available now</span>
              <strong>{availableCount}</strong>
            </div>
          </div>

          <div className="public-squares-hero-footer" style={styles.heroFooter}>
            <span>Supporting the organiser</span>
            <strong>
              {selectedSquares.length > 0
                ? `${selectedSquares.length} selected`
                : "Choose squares below"}
            </strong>
          </div>
        </div>
      </section>

      <main className="public-squares-content-wrap" style={styles.contentWrap}>
        <div className="public-squares-container" style={styles.container}>
          <div
            className="public-squares-legal-notice"
            style={styles.legalNotice}
          >
            This campaign is run by the organiser. The platform provides
            software only and is not responsible for the operation of this draw.
            The organiser is responsible for ensuring compliance with all
            applicable laws.
          </div>

          {canReserve ? (
            <section
              className="public-squares-buying-guide"
              style={{
                ...styles.buyingGuide,
                borderColor: `${primaryColour}35`,
              }}
            >
              <div style={styles.buyingGuideHeader}>
                <div>
                  <p style={{ ...styles.guideKicker, color: primaryColour }}>
                    Start here
                  </p>

                  <h2 style={styles.guideTitle}>How to play squares</h2>

                  <p style={styles.guideLead}>
                    Follow these steps in order. If this squares game has an
                    entry question, you must answer it before checkout opens.
                  </p>
                </div>

                <div
                  style={{
                    ...styles.guideBadge,
                    background: `${primaryColour}12`,
                    borderColor: `${primaryColour}35`,
                    color: primaryColour,
                  }}
                >
                  Secure checkout at the end
                </div>
              </div>

              <div
                className="public-squares-guide-grid"
                style={styles.guideGrid}
              >
                <div style={styles.guideStepCard}>
                  <span
                    style={{
                      ...styles.guideStepNumber,
                      background: primaryColour,
                    }}
                  >
                    1
                  </span>

                  <div>
                    <strong style={styles.guideStepTitle}>
                      Choose your squares
                    </strong>
                    <p style={styles.guideStepText}>
                      Use quick buy or tap the square numbers you want.
                    </p>
                  </div>
                </div>

                <div style={styles.guideStepCard}>
                  <span
                    style={{
                      ...styles.guideStepNumber,
                      background: primaryColour,
                    }}
                  >
                    2
                  </span>

                  <div>
                    <strong style={styles.guideStepTitle}>
                      Add your details
                    </strong>
                    <p style={styles.guideStepText}>
                      Enter your name and email so the organiser can confirm
                      your entry.
                    </p>
                  </div>
                </div>

                <div style={styles.guideStepCard}>
                  <span
                    style={{
                      ...styles.guideStepNumber,
                      background: requiresQuestion
                        ? accentColour
                        : primaryColour,
                    }}
                  >
                    3
                  </span>

                  <div>
                    <strong style={styles.guideStepTitle}>
                      {requiresQuestion
                        ? "Answer the required question"
                        : "Check the entry rules"}
                    </strong>
                    <p style={styles.guideStepText}>
                      {requiresQuestion
                        ? "This squares game requires an answer before you can pay."
                        : "This squares game does not need an entry question answer."}
                    </p>
                  </div>
                </div>

                <div style={styles.guideStepCard}>
                  <span
                    style={{
                      ...styles.guideStepNumber,
                      background: primaryColour,
                    }}
                  >
                    4
                  </span>

                  <div>
                    <strong style={styles.guideStepTitle}>
                      Accept terms and pay
                    </strong>
                    <p style={styles.guideStepText}>
                      Review your basket, accept the terms, then continue to
                      secure checkout.
                    </p>
                  </div>
                </div>
              </div>
            </section>
          ) : null}

          {game.prizes.length > 0 ? (
            <section className="public-squares-prizes" style={styles.prizesBox}>
              <div style={styles.prizesTitle}>Prizes</div>

              <div style={{ display: "grid", gap: 10 }}>
                {visiblePrizes.map((prize, index) => (
                  <div
                    key={`${index}-${prize.title ?? prize.name}`}
                    className="public-squares-prize-card"
                    style={styles.prizeCard}
                  >
                    <div
                      className="public-squares-prize-position"
                      style={brandedPrizePositionStyle}
                    >
                      {ordinal(index + 1)}
                    </div>

                    <div style={styles.prizeContent}>
                      <div
                        className="public-squares-prize-title"
                        style={styles.prizeTitle}
                      >
                        {prize.title || prize.name || `Prize ${index + 1}`}
                      </div>

                      {prize.description ? (
                        <div style={styles.prizeDescription}>
                          {prize.description}
                        </div>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>

              {game.prizes.length > 3 ? (
                <button
                  type="button"
                  onClick={() => setShowAllPrizes((value) => !value)}
                  style={styles.showMoreButton}
                >
                  {showAllPrizes ? "Hide prizes" : "Show all prizes"}
                </button>
              ) : null}
            </section>
          ) : null}

          {isDrawn ? (
            <section
              className="public-squares-winners"
              style={styles.winnersBox}
            >
              <div style={styles.winnersTitle}>Winning squares</div>

              {game.winners.length > 0 ? (
                <div style={{ display: "grid", gap: 10 }}>
                  {game.winners.map((winner) => (
                    <div
                      key={winner.id}
                      className="public-squares-winner-card"
                      style={styles.winnerCard}
                    >
                      <div style={styles.winnerBlock}>
                        <div style={styles.winnerLabel}>Prize</div>
                        <div style={styles.winnerPrize}>
                          {winner.prize_title}
                        </div>
                      </div>

                      <div style={styles.winnerBlock}>
                        <div style={styles.winnerLabel}>Square</div>
                        <div style={styles.winnerTicket}>
                          #{winner.square_number}
                        </div>
                      </div>

                      <div style={styles.winnerBlock}>
                        <div style={styles.winnerLabel}>Winner</div>
                        <div style={styles.winnerName}>
                          {winner.customer_name || "Winner"}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={styles.notice}>
                  No winners have been published yet.
                </div>
              )}
            </section>
          ) : null}

          {isClosed ? (
            <div style={styles.noticeDark}>
              This squares game is now closed. Reservations and payments are no
              longer available.
            </div>
          ) : null}

          {isDraft ? (
            <div style={styles.notice}>
              This squares game is not published yet.
            </div>
          ) : null}

          {canReserve ? (
            <section
              className="public-squares-quick-select"
              style={styles.quickSelect}
            >
              <div style={styles.sectionIntroRow}>
                <span
                  style={{
                    ...styles.sectionStepBadge,
                    background: primaryColour,
                  }}
                >
                  Step 1
                </span>

                <div>
                  <h2 style={{ margin: 0 }}>Choose your squares</h2>
                  <p style={{ margin: "6px 0 0", color: "#64748b" }}>
                    Choose how many squares you would like and we’ll randomly
                    auto-select available numbers.
                  </p>
                </div>
              </div>

              <div
                className="public-squares-quick-controls"
                style={styles.quickControls}
              >
                <label style={{ display: "grid", gap: 6 }}>
                  <span style={styles.smallLabel}>Number of squares</span>

                  <input
                    className="public-squares-quantity-input"
                    type="number"
                    min={1}
                    max={availableCount || 1}
                    value={autoQuantity === 0 ? "" : autoQuantity}
                    onChange={(event) => {
                      const raw = event.target.value;

                      if (raw === "") {
                        setAutoQuantity(0);
                        return;
                      }

                      const parsed = Number(raw);
                      if (!Number.isFinite(parsed)) return;

                      setAutoQuantity(parsed);
                    }}
                    style={styles.quantityInput}
                  />
                </label>

                <button
                  className="public-squares-auto-button"
                  type="button"
                  onClick={() => autoSelectSquares(autoQuantity)}
                  style={brandedAutoButtonStyle}
                >
                  Auto select
                </button>

                <button
                  className="public-squares-clear-button"
                  type="button"
                  onClick={clearBasket}
                  style={styles.clearButton}
                >
                  Clear basket
                </button>
              </div>
            </section>
          ) : null}

          <h2 className="public-squares-heading" style={styles.heading}>
            Choose squares
          </h2>

          <div className="public-squares-number-grid" style={styles.numberGrid}>
            {Array.from({ length: game.totalSquares }, (_, index) => {
              const square = index + 1;
              const isUnavailable = unavailableSquares.has(square);
              const isSelected = selectedSquares.includes(square);

              return (
                <button
                  key={square}
                  className="public-squares-number-button"
                  type="button"
                  onClick={() => toggleSquare(square)}
                  disabled={isUnavailable || !canReserve}
                  style={{
                    ...styles.numberButton,
                    background: isSelected
                      ? primaryColour
                      : isUnavailable
                        ? "#111827"
                        : "#ffffff",
                    color: isSelected || isUnavailable ? "#ffffff" : "#111827",
                    opacity: canReserve ? 1 : 0.7,
                    cursor:
                      isUnavailable || !canReserve ? "not-allowed" : "pointer",
                  }}
                >
                  {square}
                </button>
              );
            })}
          </div>

          <h2 className="public-squares-heading" style={styles.heading}>
            Basket
          </h2>

          {selectedSquares.length === 0 ? (
            <div style={styles.notice}>No squares selected yet.</div>
          ) : (
            <div style={styles.basket}>
              {selectedSquares.map((square) => (
                <div
                  key={square}
                  className="public-squares-basket-row"
                  style={styles.basketRow}
                >
                  <span>Square #{square}</span>

                  <button
                    className="public-squares-remove-button"
                    type="button"
                    onClick={() =>
                      setSelectedSquares((current) =>
                        current.filter((item) => item !== square),
                      )
                    }
                    style={styles.removeButton}
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="public-squares-total-box" style={styles.totalBox}>
            <div>Squares: {selectedSquares.length}</div>

            <div>
              Square total:{" "}
              {formatCurrencyFromCents(subtotalCents, game.currency)}
            </div>

            <label
              className="public-squares-cover-fees"
              style={styles.coverFeesBox}
            >
              <input
                type="checkbox"
                checked={coverFees}
                onChange={(event) => setCoverFees(event.target.checked)}
                disabled={!canReserve || selectedSquares.length === 0}
              />

              <span>
                <strong>I’d like to cover platform fees</strong>
                <br />
                <span style={{ color: "#64748b", fontSize: 13 }}>
                  Adds approximately{" "}
                  {formatCurrencyFromCents(feeCents, game.currency)} so the
                  organiser receives the full square value.
                </span>
              </span>
            </label>

            <div>
              Total today: {formatCurrencyFromCents(totalCents, game.currency)}
            </div>
          </div>

          <section style={styles.checkoutSection}>
            <div style={styles.sectionIntroRow}>
              <span
                style={{
                  ...styles.sectionStepBadge,
                  background: primaryColour,
                }}
              >
                Step 2
              </span>

              <div>
                <h2 className="public-squares-heading" style={styles.heading}>
                  Your details
                </h2>

                <p style={styles.sectionHelpText}>
                  Add your details, answer the required entry question if shown,
                  then accept the terms before checkout.
                </p>
              </div>
            </div>

            <div style={styles.form}>
              <input
                className="public-squares-input"
                value={customerName}
                onChange={(event) => setCustomerName(event.target.value)}
                placeholder="Your name"
                style={styles.input}
                disabled={!canReserve}
              />

              <input
                className="public-squares-input"
                value={customerEmail}
                onChange={(event) => setCustomerEmail(event.target.value)}
                placeholder="Your email"
                type="email"
                style={styles.input}
                disabled={!canReserve}
              />

              {requiresQuestion ? (
                <section
                  style={{
                    ...styles.questionBox,
                    borderColor: `${accentColour}88`,
                  }}
                >
                  <div style={styles.questionHeader}>
                    <span
                      style={{
                        ...styles.sectionStepBadge,
                        background: accentColour,
                      }}
                    >
                      Required
                    </span>

                    <div>
                      <div
                        style={{
                          ...styles.questionLabel,
                          color: "#92400e",
                        }}
                      >
                        Entry question needed before checkout
                      </div>

                      <p style={styles.questionHelp}>
                        You must answer this question before you can reserve and
                        pay for your squares.
                      </p>
                    </div>
                  </div>

                  <div style={styles.questionText}>{game.question?.text}</div>

                  <input
                    className="public-squares-input"
                    value={entryAnswer}
                    onChange={(event) => setEntryAnswer(event.target.value)}
                    placeholder="Type your answer here"
                    style={styles.input}
                    disabled={!canReserve}
                    aria-label="Entry question answer"
                  />
                </section>
              ) : null}
                            {showFreeEntry ? (
                <section style={styles.postalMiniBox}>
                  <button
                    type="button"
                    onClick={() => setShowPostalDetails((value) => !value)}
                    style={{
                      ...styles.postalMiniButton,
                      color: primaryColour,
                      borderColor: `${primaryColour}55`,
                    }}
                  >
                    No purchase necessary — free postal entry available
                  </button>

                  {showPostalDetails ? (
                    <div style={styles.postalDetails}>
                      {game.freeEntry?.address ? (
                        <div style={styles.freeEntryBlock}>
                          <div style={styles.freeEntryLabel}>
                            Postal address
                          </div>
                          <div style={styles.freeEntryText}>
                            {game.freeEntry.address}
                          </div>
                        </div>
                      ) : null}

                      {game.freeEntry?.instructions ? (
                        <div style={styles.freeEntryBlock}>
                          <div style={styles.freeEntryLabel}>Instructions</div>
                          <div style={styles.freeEntryText}>
                            {game.freeEntry.instructions}
                          </div>
                        </div>
                      ) : null}

                      {game.freeEntry?.closes_at || game.freeEntry?.closesAt ? (
                        <div style={styles.freeEntryBlock}>
                          <div style={styles.freeEntryLabel}>
                            Postal entry closes
                          </div>

                          <div style={styles.freeEntryText}>
                            {formatDateTime(
                              game.freeEntry.closes_at ??
                                game.freeEntry.closesAt,
                            )}
                          </div>
                        </div>
                      ) : null}

                      <div style={styles.freeEntryNotice}>
                        Postal entries are included in the same draw as paid
                        entries. Please include your full name, email address,
                        this squares game name, your answer to the entry
                        question if one is shown, and your preferred square
                        number where applicable. One entry per
                        postcard/envelope.
                      </div>
                    </div>
                  ) : null}
                </section>
              ) : null}

              <label
                className="public-squares-terms-box"
                style={styles.termsBox}
              >
                <input
                  type="checkbox"
                  checked={acceptedTerms}
                  onChange={(event) => setAcceptedTerms(event.target.checked)}
                  disabled={!canReserve}
                />

                <span>
                  I confirm I have read and accept the{" "}
                  <Link
                    href="/terms"
                    style={{ ...styles.inlineLink, color: primaryColour }}
                  >
                    terms
                  </Link>{" "}
                  and{" "}
                  <Link
                    href="/privacy"
                    style={{ ...styles.inlineLink, color: primaryColour }}
                  >
                    privacy policy
                  </Link>
                  .
                </span>
              </label>

              <div style={styles.checkoutStatusBox}>
                <div style={styles.checkoutStatusHeader}>
                  <strong>Checkout checklist</strong>
                  <span
                    style={{
                      ...styles.checkoutStatusPill,
                      background: checkoutReady ? "#dcfce7" : "#fff7ed",
                      borderColor: checkoutReady ? "#bbf7d0" : "#fed7aa",
                      color: checkoutReady ? "#166534" : "#9a3412",
                    }}
                  >
                    {checkoutReady ? "Ready" : "Not ready yet"}
                  </span>
                </div>

                <div style={styles.checkoutChecklist}>
                  {checkoutChecklist.map((item) => (
                    <div key={item.label} style={styles.checkoutChecklistItem}>
                      <span
                        aria-hidden="true"
                        style={{
                          ...styles.checkoutDot,
                          background: item.complete ? "#16a34a" : "#f59e0b",
                        }}
                      >
                        {item.complete ? "✓" : "!"}
                      </span>

                      <span>{item.label}</span>
                    </div>
                  ))}
                </div>

                <p style={styles.checkoutHelpText}>{nextCheckoutHelp}</p>
              </div>

              <button
                className="public-squares-primary-button"
                type="button"
                onClick={reserveSquares}
                disabled={saving || !checkoutReady}
                style={{
                  ...brandedPrimaryButtonStyle,
                  opacity: saving || !checkoutReady ? 0.6 : 1,
                  cursor: saving || !checkoutReady ? "not-allowed" : "pointer",
                }}
              >
                {saving ? "Redirecting to checkout..." : "Reserve and pay"}
              </button>
            </div>
          </section>

          {reservationMessage ? (
            <div style={styles.success}>{reservationMessage}</div>
          ) : null}

          {error ? <div style={styles.error}>{error}</div> : null}

          {branding.footerText ? (
            <footer
              style={{
                ...styles.brandFooter,
                borderColor: `${accentColour}66`,
              }}
            >
              {branding.footerText}
            </footer>
          ) : null}
        </div>
      </main>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    background:
      "linear-gradient(180deg, #020617 0px, #0f172a 760px, #f8fafc 760px, #f8fafc 100%)",
  },

  hero: {
    position: "relative",
    minHeight: 760,
    overflow: "hidden",
    display: "flex",
    alignItems: "flex-end",
  },

  heroBackgroundImage: {
    position: "absolute",
    inset: 0,
    width: "100%",
    height: "100%",
    display: "block",
  },

  heroOverlay: {
    position: "absolute",
    inset: 0,
    background:
      "linear-gradient(180deg, rgba(2,6,23,0.20) 0%, rgba(2,6,23,0.42) 34%, rgba(2,6,23,0.84) 72%, rgba(2,6,23,0.97) 100%)",
  },

  heroInner: {
    position: "relative",
    zIndex: 2,
    width: "100%",
    maxWidth: 1240,
    margin: "0 auto",
    padding: "34px 20px 56px",
    color: "#ffffff",
  },

  heroNav: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    flexWrap: "wrap",
    marginBottom: 24,
  },

  heroBackLink: {
    display: "inline-flex",
    alignItems: "center",
    padding: "12px 16px",
    borderRadius: 999,
    background: "rgba(255,255,255,0.12)",
    border: "1px solid rgba(255,255,255,0.18)",
    color: "#ffffff",
    textDecoration: "none",
    fontWeight: 800,
    backdropFilter: "blur(12px)",
  },

  brandStrip: {
    display: "grid",
    gridTemplateColumns: "72px minmax(0, 1fr)",
    gap: 14,
    alignItems: "center",
    maxWidth: 720,
    marginBottom: 32,
    padding: 14,
    borderRadius: 24,
    background:
      "linear-gradient(135deg, rgba(15,23,42,0.58), rgba(15,23,42,0.30))",
    border: "1px solid rgba(255,255,255,0.20)",
    backdropFilter: "blur(16px)",
    boxShadow: "0 16px 38px rgba(0,0,0,0.20)",
  },

  brandLogoWrap: {
    width: 72,
    height: 72,
    borderRadius: 20,
    background: "rgba(255,255,255,0.96)",
    border: "1px solid rgba(255,255,255,0.30)",
    overflow: "hidden",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },

  brandLogo: {
    width: "100%",
    height: "100%",
    objectFit: "contain",
    padding: 7,
    display: "block",
  },

  brandFallback: {
    width: 72,
    height: 72,
    borderRadius: 20,
    border: "2px solid",
    color: "#ffffff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 22,
    fontWeight: 950,
    letterSpacing: "-0.05em",
  },

  brandCopy: {
    display: "grid",
    gap: 4,
    minWidth: 0,
  },

  brandKicker: {
    margin: 0,
    fontSize: 11,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.1em",
  },

  brandName: {
    margin: 0,
    color: "#ffffff",
    fontSize: 28,
    lineHeight: 0.98,
    letterSpacing: "-0.055em",
    fontWeight: 950,
    overflowWrap: "anywhere",
  },

  brandTagline: {
    margin: 0,
    color: "rgba(255,255,255,0.84)",
    fontSize: 13,
    lineHeight: 1.45,
    fontWeight: 750,
    overflowWrap: "anywhere",
  },

  badgeRow: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
    alignItems: "center",
    marginBottom: 20,
  },

  typeBadge: {
    display: "inline-flex",
    padding: "8px 14px",
    borderRadius: 999,
    background: "rgba(255,255,255,0.12)",
    border: "1px solid rgba(255,255,255,0.18)",
    color: "#ffffff",
    fontWeight: 900,
    fontSize: 13,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    backdropFilter: "blur(12px)",
  },

  statusPill: {
    display: "inline-flex",
    alignItems: "center",
    padding: "8px 14px",
    borderRadius: 999,
    fontWeight: 900,
    fontSize: 13,
    textTransform: "uppercase",
    letterSpacing: "0.06em",
  },

  heroTitle: {
    margin: 0,
    maxWidth: 860,
    fontSize: "clamp(44px, 8vw, 88px)",
    lineHeight: 0.92,
    letterSpacing: "-0.07em",
    fontWeight: 950,
    textShadow: "0 8px 32px rgba(0,0,0,0.45)",
  },

  heroDescription: {
    margin: "22px 0 0",
    maxWidth: 760,
    color: "rgba(255,255,255,0.84)",
    fontSize: 18,
    lineHeight: 1.68,
    textShadow: "0 4px 18px rgba(0,0,0,0.34)",
    fontWeight: 650,
  },

  heroMeta: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    gap: 14,
    marginTop: 32,
  },

  metaCard: {
    padding: 18,
    borderRadius: 24,
    background: "rgba(255,255,255,0.12)",
    border: "1px solid rgba(255,255,255,0.14)",
    backdropFilter: "blur(14px)",
    boxShadow: "0 10px 30px rgba(0,0,0,0.22)",
    display: "grid",
    gap: 8,
  },

  metaLabel: {
    color: "rgba(255,255,255,0.72)",
    fontSize: 12,
    fontWeight: 800,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
  },

  heroFooter: {
    marginTop: 22,
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    flexWrap: "wrap",
    color: "rgba(255,255,255,0.80)",
    fontWeight: 700,
  },

  contentWrap: {
    position: "relative",
    zIndex: 5,
    marginTop: -52,
    paddingBottom: 80,
  },

  container: {
    maxWidth: 1240,
    margin: "0 auto",
    padding: "0 20px",
    display: "grid",
    gap: 20,
  },

  wrap: {
    padding: 30,
    color: "#ffffff",
  },

  heading: {
    margin: "10px 0 14px",
    fontSize: "clamp(24px, 5vw, 34px)",
    lineHeight: 1,
    letterSpacing: "-0.05em",
    color: "#0f172a",
    fontWeight: 950,
  },

  legalNotice: {
    padding: 18,
    borderRadius: 24,
    background: "#fff7ed",
    border: "1px solid #fed7aa",
    color: "#9a3412",
    fontWeight: 700,
    lineHeight: 1.65,
    boxShadow: "0 8px 24px rgba(15,23,42,0.05)",
  },

  buyingGuide: {
    padding: 24,
    borderRadius: 28,
    background:
      "linear-gradient(135deg, #ffffff 0%, #f8fafc 48%, #eff6ff 100%)",
    border: "1px solid #dbeafe",
    boxShadow: "0 10px 30px rgba(15,23,42,0.06)",
    display: "grid",
    gap: 18,
  },

  buyingGuideHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: 16,
    alignItems: "flex-start",
    flexWrap: "wrap",
  },

  guideKicker: {
    margin: 0,
    fontSize: 12,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.1em",
  },

  guideTitle: {
    margin: "4px 0 0",
    color: "#0f172a",
    fontSize: "clamp(26px, 5vw, 38px)",
    lineHeight: 1,
    letterSpacing: "-0.055em",
    fontWeight: 950,
  },

  guideLead: {
    margin: "10px 0 0",
    maxWidth: 760,
    color: "#475569",
    fontSize: 15,
    lineHeight: 1.65,
    fontWeight: 700,
  },

  guideBadge: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "10px 14px",
    borderRadius: 999,
    border: "1px solid",
    fontSize: 12,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.06em",
  },

  guideGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
    gap: 12,
  },

  guideStepCard: {
    display: "grid",
    gridTemplateColumns: "42px minmax(0, 1fr)",
    gap: 12,
    alignItems: "flex-start",
    padding: 14,
    borderRadius: 20,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
  },

  guideStepNumber: {
    width: 42,
    height: 42,
    borderRadius: 14,
    color: "#ffffff",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 16,
    fontWeight: 950,
    boxShadow: "0 8px 18px rgba(15,23,42,0.12)",
  },

  guideStepTitle: {
    display: "block",
    color: "#0f172a",
    fontSize: 15,
    lineHeight: 1.25,
    fontWeight: 950,
  },

  guideStepText: {
    margin: "5px 0 0",
    color: "#64748b",
    fontSize: 13,
    lineHeight: 1.5,
    fontWeight: 700,
  },

  sectionIntroRow: {
    display: "flex",
    gap: 12,
    alignItems: "flex-start",
    flexWrap: "wrap",
  },

  sectionStepBadge: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 34,
    padding: "0 12px",
    borderRadius: 999,
    color: "#ffffff",
    fontSize: 12,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    whiteSpace: "nowrap",
    boxShadow: "0 8px 18px rgba(15,23,42,0.12)",
  },

  sectionHelpText: {
    margin: "-6px 0 4px",
    color: "#64748b",
    fontSize: 15,
    lineHeight: 1.65,
    fontWeight: 700,
  },

  checkoutSection: {
    display: "grid",
    gap: 14,
  },

  prizesBox: {
    padding: 24,
    borderRadius: 28,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    boxShadow: "0 10px 30px rgba(15,23,42,0.06)",
  },

  prizesTitle: {
    marginBottom: 16,
    fontSize: 28,
    color: "#0f172a",
    fontWeight: 950,
    letterSpacing: "-0.04em",
  },

  prizeCard: {
    display: "flex",
    gap: 18,
    padding: 18,
    borderRadius: 22,
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    alignItems: "flex-start",
  },

  prizePosition: {
    width: 72,
    height: 72,
    borderRadius: 20,
    background:
      "linear-gradient(135deg, #2563eb 0%, #1d4ed8 50%, #1e40af 100%)",
    color: "#ffffff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 24,
    fontWeight: 950,
    flexShrink: 0,
    boxShadow: "0 10px 24px rgba(37,99,235,0.25)",
  },

  prizeContent: {
    flex: 1,
    minWidth: 0,
  },

  prizeTitle: {
    fontSize: 22,
    fontWeight: 900,
    color: "#0f172a",
    lineHeight: 1.15,
  },

  prizeDescription: {
    marginTop: 8,
    color: "#64748b",
    lineHeight: 1.7,
  },

  winnersBox: {
    padding: 24,
    borderRadius: 28,
    background: "#ecfdf5",
    border: "1px solid #bbf7d0",
  },

  winnersTitle: {
    marginBottom: 16,
    fontSize: 28,
    color: "#065f46",
    fontWeight: 950,
    letterSpacing: "-0.04em",
  },

  winnerCard: {
    display: "flex",
    flexWrap: "wrap",
    gap: 18,
    padding: 18,
    borderRadius: 22,
    background: "#ffffff",
    border: "1px solid #bbf7d0",
  },

  winnerBlock: {
    display: "grid",
    gap: 6,
    minWidth: 150,
  },

  winnerLabel: {
    fontSize: 12,
    color: "#64748b",
    fontWeight: 800,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
  },

  winnerPrize: {
    fontSize: 24,
    fontWeight: 950,
    color: "#065f46",
  },

  winnerTicket: {
    fontSize: 24,
    fontWeight: 950,
    color: "#0f172a",
  },

  winnerName: {
    fontSize: 20,
    fontWeight: 900,
    color: "#0f172a",
  },

  quickSelect: {
    padding: 24,
    borderRadius: 28,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    display: "grid",
    gap: 18,
    boxShadow: "0 10px 30px rgba(15,23,42,0.06)",
  },

  quickControls: {
    display: "flex",
    flexWrap: "wrap",
    gap: 12,
    alignItems: "end",
  },

  smallLabel: {
    fontSize: 13,
    fontWeight: 800,
    color: "#475569",
  },

  quantityInput: {
    width: 140,
    height: 50,
    padding: "0 14px",
    borderRadius: 14,
    border: "1px solid #cbd5e1",
    fontSize: 16,
    fontWeight: 800,
  },

  autoButton: {
    height: 50,
    padding: "0 18px",
    borderRadius: 14,
    border: "none",
    background: "#2563eb",
    color: "#ffffff",
    fontWeight: 900,
    cursor: "pointer",
  },

  clearButton: {
    height: 50,
    padding: "0 18px",
    borderRadius: 14,
    border: "1px solid #cbd5e1",
    background: "#ffffff",
    color: "#334155",
    fontWeight: 800,
    cursor: "pointer",
  },

  numberGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(62px, 1fr))",
    gap: 10,
  },

  numberButton: {
    height: 56,
    borderRadius: 16,
    border: "1px solid #cbd5e1",
    fontWeight: 900,
    fontSize: 15,
  },

  basket: {
    display: "grid",
    gap: 10,
  },

  basketRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    padding: 16,
    border: "1px solid #e2e8f0",
    borderRadius: 18,
    background: "#ffffff",
    fontWeight: 800,
  },

  removeButton: {
    border: "none",
    background: "transparent",
    color: "#dc2626",
    fontWeight: 900,
    cursor: "pointer",
  },

  totalBox: {
    padding: 22,
    borderRadius: 28,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    display: "grid",
    gap: 10,
    fontWeight: 800,
    boxShadow: "0 10px 30px rgba(15,23,42,0.06)",
  },

  coverFeesBox: {
    display: "flex",
    gap: 12,
    alignItems: "flex-start",
    padding: 16,
    borderRadius: 18,
    border: "1px solid #e2e8f0",
    background: "#f8fafc",
  },

  form: {
    display: "grid",
    gap: 14,
  },

  input: {
    height: 52,
    padding: "0 14px",
    borderRadius: 16,
    border: "1px solid #cbd5e1",
    fontSize: 16,
  },

  questionBox: {
    padding: 20,
    borderRadius: 22,
    background: "#fffbeb",
    border: "1px solid #fde68a",
    display: "grid",
    gap: 12,
    boxShadow: "0 10px 24px rgba(245,158,11,0.08)",
  },

  questionHeader: {
    display: "flex",
    gap: 12,
    alignItems: "flex-start",
    flexWrap: "wrap",
  },

  questionLabel: {
    color: "#92400e",
    fontWeight: 950,
  },

  questionHelp: {
    margin: "4px 0 0",
    color: "#92400e",
    fontSize: 14,
    lineHeight: 1.55,
    fontWeight: 700,
  },

  questionText: {
    color: "#78350f",
    fontWeight: 850,
    lineHeight: 1.65,
    fontSize: 17,
  },

  postalMiniBox: {
    display: "grid",
    gap: 10,
  },

  postalMiniButton: {
    width: "100%",
    textAlign: "left",
    padding: 18,
    borderRadius: 22,
    background: "#eff6ff",
    border: "1px solid #bfdbfe",
    color: "#1d4ed8",
    fontWeight: 900,
    cursor: "pointer",
  },

  postalDetails: {
    padding: 18,
    borderRadius: 22,
    background: "#f0f9ff",
    border: "1px solid #bae6fd",
    display: "grid",
    gap: 12,
  },

  freeEntryBlock: {
    padding: 16,
    borderRadius: 18,
    background: "#ffffff",
    border: "1px solid #e0f2fe",
  },

  freeEntryLabel: {
    fontSize: 12,
    fontWeight: 900,
    color: "#0369a1",
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: "0.06em",
  },

  freeEntryText: {
    color: "#0f172a",
    lineHeight: 1.6,
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
  },

  freeEntryNotice: {
    padding: 16,
    borderRadius: 18,
    background: "#ffffff",
    border: "1px dashed #7dd3fc",
    color: "#475569",
    lineHeight: 1.6,
    fontSize: 14,
  },

  termsBox: {
    display: "flex",
    gap: 12,
    alignItems: "flex-start",
    padding: 16,
    borderRadius: 18,
    border: "1px solid #e2e8f0",
    background: "#ffffff",
    lineHeight: 1.6,
    fontWeight: 700,
  },

  checkoutStatusBox: {
    padding: 16,
    borderRadius: 20,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    display: "grid",
    gap: 12,
    boxShadow: "0 8px 22px rgba(15,23,42,0.04)",
  },

  checkoutStatusHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    flexWrap: "wrap",
    alignItems: "center",
    color: "#0f172a",
  },

  checkoutStatusPill: {
    display: "inline-flex",
    alignItems: "center",
    padding: "7px 11px",
    borderRadius: 999,
    border: "1px solid",
    fontSize: 12,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.06em",
  },

  checkoutChecklist: {
    display: "grid",
    gap: 8,
  },

  checkoutChecklistItem: {
    display: "flex",
    gap: 10,
    alignItems: "center",
    color: "#334155",
    fontWeight: 750,
    lineHeight: 1.45,
  },

  checkoutDot: {
    width: 24,
    height: 24,
    borderRadius: 999,
    color: "#ffffff",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 12,
    fontWeight: 950,
    flexShrink: 0,
  },

  checkoutHelpText: {
    margin: 0,
    color: "#64748b",
    fontSize: 14,
    lineHeight: 1.55,
    fontWeight: 750,
  },

  inlineLink: {
    color: "#2563eb",
    fontWeight: 900,
  },

  primaryButton: {
    height: 56,
    border: "none",
    borderRadius: 18,
    background:
      "linear-gradient(135deg, #2563eb 0%, #1d4ed8 50%, #1e40af 100%)",
    color: "#ffffff",
    fontWeight: 900,
    fontSize: 16,
    boxShadow: "0 14px 30px rgba(37,99,235,0.25)",
  },

  notice: {
    padding: 16,
    borderRadius: 18,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    color: "#475569",
    fontWeight: 700,
  },

  noticeDark: {
    padding: 18,
    borderRadius: 22,
    background: "#0f172a",
    border: "1px solid #1e293b",
    color: "#e2e8f0",
    fontWeight: 700,
  },

  success: {
    padding: 18,
    borderRadius: 22,
    background: "#ecfdf5",
    border: "1px solid #bbf7d0",
    color: "#166534",
    fontWeight: 800,
  },

  error: {
    padding: 18,
    borderRadius: 22,
    background: "#fef2f2",
    border: "1px solid #fecaca",
    color: "#991b1b",
    fontWeight: 800,
  },

  showMoreButton: {
    marginTop: 14,
    padding: "12px 16px",
    borderRadius: 14,
    border: "1px solid #cbd5e1",
    background: "#ffffff",
    color: "#0f172a",
    fontWeight: 900,
    cursor: "pointer",
  },

  brandFooter: {
    marginTop: 4,
    padding: 16,
    borderRadius: 22,
    background: "#ffffff",
    border: "1px solid",
    color: "#64748b",
    textAlign: "center",
    fontWeight: 800,
    lineHeight: 1.5,
  },
};
