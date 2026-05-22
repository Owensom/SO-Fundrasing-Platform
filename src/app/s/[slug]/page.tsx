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
    .public-squares-prizes,
    .public-squares-winners,
    .public-squares-quick-select,
    .public-squares-total-box {
      border-radius: 22px !important;
      padding: 16px !important;
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
        throw new Error("Please answer the entry question.");
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
