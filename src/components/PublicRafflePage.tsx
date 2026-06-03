"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

const DEFAULT_RAFFLE_IMAGE = "/brand/so-default-raffles.png";

type Props = {
  slug: string;
};

type TicketSelection = {
  colour: string;
  number: number;
};

type TenantBranding = {
  displayName: string;
  tagline: string;
  logoUrl: string;
  logoMarkUrl: string;
  primaryColour: string;
  accentColour: string;
  footerText: string;
};

type RaffleColour = {
  id: string;
  name: string;
  hex?: string | null;
  sortOrder?: number;
};

type RaffleOffer = {
  id: string;
  label: string;
  quantity: number;
  price: number;
  isActive: boolean;
  sortOrder?: number;
};

type RafflePrize = {
  position: number;
  title: string;
  description: string;
  isPublic: boolean;
};

type RaffleWinner = {
  prizePosition: number;
  ticketNumber: number;
  colour: string | null;
  buyerName: string | null;
  drawnAt: string | null;
};

type FreeEntry = {
  address: string;
  instructions: string;
  closesAt: string;
};

type SafeRaffleStatus = "draft" | "published" | "closed" | "drawn";
type SafeRaffleSubtype = "standard" | "fifty_fifty";

type SafeRaffle = {
  id: string;
  slug: string;
  title: string;
  description: string;
  imageUrl: string;
  imagePosition: string;
  imageFocusX: number;
  imageFocusY: number;
  imageObjectPosition: string;
  tenantSlug: string;
  drawAt: string | null;
  startNumber: number;
  endNumber: number;
  currency: string;
  ticketPrice: number;
  status: SafeRaffleStatus;
  raffleSubtype: SafeRaffleSubtype;
  colours: RaffleColour[];
  offers: RaffleOffer[];
  prizes: RafflePrize[];
  reservedTickets: Array<{ colour: string; number: number }>;
  soldTickets: Array<{ colour: string; number: number }>;
  winnerTicketNumber: number | null;
  winnerColour: string | null;
  drawnAt: string | null;
  winners: RaffleWinner[];
  legalQuestion: string;
  legalAnswer: string;
  freeEntry: FreeEntry;
  branding: TenantBranding;
};

function makeTicketKey(colour: string, number: number) {
  return colour + "::" + number;
}

function getSafeAdminReturn(value: string | null) {
  if (!value) return "";

  try {
    const decoded = decodeURIComponent(value);
    return decoded.startsWith("/admin/raffles/") ? decoded : "";
  } catch {
    return value.startsWith("/admin/raffles/") ? value : "";
  }
}

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

const RAFFLE_COLOUR_SWATCHES: Record<string, string> = {
  red: "#ef4444",
  blue: "#1683f8",
  green: "#16a34a",
  yellow: "#facc15",
  orange: "#f97316",
  purple: "#8b5cf6",
  pink: "#ec4899",
  black: "#111827",
  white: "#ffffff",
  gold: "#f59e0b",
  silver: "#cbd5e1",
  grey: "#64748b",
  gray: "#64748b",
};

function getRaffleColourHex(colour: RaffleColour | string | null | undefined) {
  const rawHex =
    typeof colour === "object" && colour ? cleanText(colour.hex) : "";

  if (/^#[0-9A-F]{6}$/i.test(rawHex)) {
    return rawHex.toUpperCase();
  }

  const rawName =
    typeof colour === "string" ? colour : colour ? colour.name : "";

  const cleanName = cleanText(rawName);

  if (/^#[0-9A-F]{6}$/i.test(cleanName)) {
    return cleanName.toUpperCase();
  }

  return RAFFLE_COLOUR_SWATCHES[cleanName.toLowerCase()] || "#e5e7eb";
}

function getReadableTextColour(backgroundHex: string) {
  const clean = normaliseHexColour(backgroundHex, "#e5e7eb").replace("#", "");

  const red = parseInt(clean.slice(0, 2), 16);
  const green = parseInt(clean.slice(2, 4), 16);
  const blue = parseInt(clean.slice(4, 6), 16);

  const brightness = (red * 299 + green * 587 + blue * 114) / 1000;

  return brightness > 145 ? "#111827" : "#ffffff";
}

function colourButtonStyle({
  colour,
  selected,
  canReserve,
  primaryColour,
}: {
  colour: RaffleColour;
  selected: boolean;
  canReserve: boolean;
  primaryColour: string;
}): React.CSSProperties {
  const background = getRaffleColourHex(colour);
  const textColour = getReadableTextColour(background);
  const isLight = textColour === "#111827";

  return {
    ...styles.colourButton,
    background,
    color: textColour,
    border: selected
      ? `3px solid ${primaryColour}`
      : isLight
        ? "1px solid #cbd5e1"
        : "1px solid rgba(15,23,42,0.18)",
    boxShadow: selected
      ? `0 0 0 4px ${primaryColour}24, 0 12px 26px rgba(15,23,42,0.16)`
      : "0 8px 18px rgba(15,23,42,0.08)",
    opacity: canReserve ? 1 : 0.7,
    cursor: canReserve ? "pointer" : "not-allowed",
  };
}

function normaliseRaffleSubtype(value: unknown): SafeRaffleSubtype {
  const clean = String(value ?? "").trim().toLowerCase();

  if (clean === "fifty_fifty") return "fifty_fifty";

  return "standard";
}

function normaliseBranding(input: any): TenantBranding {
  const raw = input ?? {};

  return {
    displayName: cleanText(
      raw.displayName ?? raw.public_display_name ?? raw.publicDisplayName,
    ),
    tagline: cleanText(raw.tagline ?? raw.public_tagline ?? raw.publicTagline),
    logoUrl: cleanText(raw.logoUrl ?? raw.public_logo_url ?? raw.publicLogoUrl),
    logoMarkUrl: cleanText(
      raw.logoMarkUrl ?? raw.public_logo_mark_url ?? raw.publicLogoMarkUrl,
    ),
    primaryColour: normaliseHexColour(
      raw.primaryColour ?? raw.public_primary_colour ?? raw.publicPrimaryColour,
      "#2563EB",
    ),
    accentColour: normaliseHexColour(
      raw.accentColour ?? raw.public_accent_colour ?? raw.publicAccentColour,
      "#F59E0B",
    ),
    footerText: cleanText(
      raw.footerText ?? raw.public_footer_text ?? raw.publicFooterText,
    ),
  };
}

function formatCurrency(value: number, currency: string) {
  try {
    return new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency: currency || "GBP",
    }).format(Number.isFinite(value) ? value : 0);
  } catch {
    return (
      (currency || "GBP") +
      " " +
      (Number.isFinite(value) ? value : 0).toFixed(2)
    );
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

  return String(position) + suffix;
}

function normaliseFrontendStatus(rawStatus: unknown): SafeRaffleStatus {
  const status = String(rawStatus ?? "").trim().toLowerCase();

  if (status === "published") return "published";
  if (status === "drawn") return "drawn";
  if (status === "closed") return "closed";

  return "draft";
}

function normaliseImagePosition(value: unknown) {
  const clean = String(value ?? "").trim().toLowerCase();

  if (
    clean === "center" ||
    clean === "top" ||
    clean === "bottom" ||
    clean === "left" ||
    clean === "right"
  ) {
    return clean;
  }

  return "center";
}

function normaliseFocus(value: unknown, fallback = 50) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(0, Math.min(100, Math.round(parsed)));
}

function normaliseAnswer(value: string) {
  return String(value || "").trim().toLowerCase();
}

function toSafeRaffle(input: any): SafeRaffle {
  const raw = input ?? {};
  const config = raw.config_json ?? {};

  const colours = Array.isArray(raw.colours) ? raw.colours : [];
  const offers = Array.isArray(raw.offers) ? raw.offers : [];
  const prizes = Array.isArray(raw.prizes) ? raw.prizes : [];
  const reservedTickets = Array.isArray(raw.reservedTickets)
    ? raw.reservedTickets
    : [];
  const soldTickets = Array.isArray(raw.soldTickets)
    ? raw.soldTickets
    : [];
  const winners = Array.isArray(raw.winners) ? raw.winners : [];

  const startNumber = Number(raw.startNumber);
  const endNumber = Number(raw.endNumber);

  const rawWinnerTicketNumber =
    raw.winnerTicketNumber ?? raw.winner_ticket_number;

  const winnerTicketNumber = Number(rawWinnerTicketNumber);

  const imagePosition = normaliseImagePosition(
    raw.imagePosition ?? raw.image_position ?? config.image_position,
  );

  const imageFocusX = normaliseFocus(
    raw.imageFocusX ?? raw.image_focus_x ?? config.image_focus_x,
    50,
  );

  const imageFocusY = normaliseFocus(
    raw.imageFocusY ?? raw.image_focus_y ?? config.image_focus_y,
    50,
  );

  const imageObjectPosition =
    raw.imageFocusX != null ||
    raw.image_focus_x != null ||
    config.image_focus_x != null ||
    raw.imageFocusY != null ||
    raw.image_focus_y != null ||
    config.image_focus_y != null
      ? `${imageFocusX}% ${imageFocusY}%`
      : imagePosition;

  const question =
    raw.question ??
    raw.legalQuestion ??
    raw.entryQuestion ??
    config.question ??
    {};

  const legalQuestion =
    typeof question === "string"
      ? question
      : String(
          question?.text ??
            question?.question ??
            raw.legal_question ??
            raw.entry_question ??
            "",
        );

  const legalAnswer =
    typeof question === "object" && question
      ? String(
          question?.answer ??
            question?.correctAnswer ??
            question?.correct_answer ??
            raw.legal_answer ??
            raw.entry_answer ??
            "",
        )
      : String(raw.legal_answer ?? raw.entry_answer ?? "");

  const rawFreeEntry = raw.freeEntry ?? raw.free_entry ?? config.free_entry ?? {};

  return {
    id: String(raw.id ?? ""),
    slug: String(raw.slug ?? ""),
    title: String(raw.title ?? "Raffle"),
    description: String(raw.description ?? ""),
    imageUrl: String(raw.imageUrl ?? raw.image_url ?? ""),
    imagePosition,
    imageFocusX,
    imageFocusY,
    imageObjectPosition,
    tenantSlug: String(raw.tenantSlug ?? raw.tenant_slug ?? ""),
    drawAt: raw.drawAt ?? null,
    startNumber: Number.isFinite(startNumber) ? startNumber : 1,
    endNumber: Number.isFinite(endNumber) ? endNumber : 1,
    currency: String(raw.currency ?? "GBP"),
    ticketPrice: Number.isFinite(Number(raw.ticketPrice))
      ? Number(raw.ticketPrice)
      : 0,
    status: normaliseFrontendStatus(raw.status),
    raffleSubtype: normaliseRaffleSubtype(
      raw.raffleSubtype ?? raw.raffle_subtype ?? config.raffle_subtype,
    ),

    colours: colours.map((c: any, index: number) => ({
      id: String(c?.id ?? "colour-" + index),
      name: String(c?.name ?? c ?? "Colour " + (index + 1)),
      hex: c?.hex ? String(c.hex) : null,
      sortOrder: Number.isFinite(Number(c?.sortOrder))
        ? Number(c.sortOrder)
        : index,
    })),

    offers: offers.map((o: any, index: number) => ({
      id: String(o?.id ?? "offer-" + index),
      label: String(o?.label ?? "Offer " + (index + 1)),
      quantity: Number.isFinite(Number(o?.quantity)) ? Number(o.quantity) : 0,
      price: Number.isFinite(Number(o?.price)) ? Number(o.price) : 0,
      isActive: Boolean(o?.isActive ?? o?.is_active ?? true),
      sortOrder: Number.isFinite(Number(o?.sortOrder ?? o?.sort_order))
        ? Number(o?.sortOrder ?? o?.sort_order)
        : index,
    })),

    prizes: prizes
      .map((p: any, index: number) => ({
        position: Number.isFinite(Number(p?.position))
          ? Number(p.position)
          : index + 1,
        title: String(p?.title ?? ""),
        description: String(p?.description ?? ""),
        isPublic: p?.isPublic !== false,
      }))
      .filter((p: RafflePrize) => p.title.trim().length > 0 && p.isPublic)
      .sort((a: RafflePrize, b: RafflePrize) => a.position - b.position),

    reservedTickets: reservedTickets.map((t: any) => ({
      colour: String(t?.colour ?? ""),
      number: Number.isFinite(Number(t?.number)) ? Number(t.number) : 0,
    })),

    soldTickets: soldTickets.map((t: any) => ({
      colour: String(t?.colour ?? ""),
      number: Number.isFinite(Number(t?.number)) ? Number(t.number) : 0,
    })),

    winnerTicketNumber: Number.isFinite(winnerTicketNumber)
      ? winnerTicketNumber
      : null,

    winnerColour:
      raw.winnerColour ?? raw.winner_colour
        ? String(raw.winnerColour ?? raw.winner_colour)
        : null,

    drawnAt:
      raw.drawnAt ?? raw.drawn_at ? String(raw.drawnAt ?? raw.drawn_at) : null,

    winners: winners.map((winner: any) => ({
      prizePosition: Number(winner.prizePosition ?? winner.prize_position ?? 1),
      ticketNumber: Number(winner.ticketNumber ?? winner.ticket_number ?? 0),
      colour:
        winner.colour != null && String(winner.colour).trim()
          ? String(winner.colour)
          : null,
      buyerName:
        winner.buyerName ?? winner.buyer_name
          ? String(winner.buyerName ?? winner.buyer_name)
          : null,
      drawnAt:
        winner.drawnAt ?? winner.drawn_at
          ? String(winner.drawnAt ?? winner.drawn_at)
          : null,
    })),

    legalQuestion: legalQuestion.trim(),
    legalAnswer: legalAnswer.trim(),

    freeEntry: {
      address: String(rawFreeEntry?.address ?? "").trim(),
      instructions: String(rawFreeEntry?.instructions ?? "").trim(),
      closesAt: String(
        rawFreeEntry?.closesAt ?? rawFreeEntry?.closes_at ?? "",
      ).trim(),
    },

    branding: normaliseBranding(raw.branding ?? raw.tenantBranding ?? {}),
  };
}

function calculateBestPrice(
  quantity: number,
  ticketPrice: number,
  offers: RaffleOffer[],
) {
  const safeQuantity = Math.max(0, Math.floor(Number(quantity) || 0));

  const activeOffers = offers
    .filter((offer) => offer.isActive && offer.quantity > 0 && offer.price > 0)
    .sort((a, b) => {
      if ((a.sortOrder ?? 0) !== (b.sortOrder ?? 0)) {
        return (a.sortOrder ?? 0) - (b.sortOrder ?? 0);
      }

      return a.quantity - b.quantity;
    });

  const dp: Array<{
    total: number;
    appliedOffers: Array<{
      label: string;
      quantity: number;
      price: number;
      times: number;
    }>;
  }> = Array.from({ length: safeQuantity + 1 }, () => ({
    total: Number.POSITIVE_INFINITY,
    appliedOffers: [],
  }));

  dp[0] = { total: 0, appliedOffers: [] };

  for (let i = 1; i <= safeQuantity; i += 1) {
    dp[i] = {
      total: dp[i - 1].total + ticketPrice,
      appliedOffers: [...dp[i - 1].appliedOffers],
    };

    for (const offer of activeOffers) {
      if (i < offer.quantity) continue;

      const previous = dp[i - offer.quantity];
      const candidateTotal = previous.total + offer.price;

      if (candidateTotal < dp[i].total) {
        const existing = previous.appliedOffers.find(
          (item) => item.label === offer.label,
        );

        dp[i] = {
          total: candidateTotal,
          appliedOffers: existing
            ? previous.appliedOffers.map((item) =>
                item.label === offer.label
                  ? { ...item, times: item.times + 1 }
                  : item,
              )
            : [
                ...previous.appliedOffers,
                {
                  label: offer.label,
                  quantity: offer.quantity,
                  price: offer.price,
                  times: 1,
                },
              ],
        };
      }
    }
  }

  const total = Number.isFinite(dp[safeQuantity]?.total)
    ? dp[safeQuantity].total
    : 0;

  const standardTotal = safeQuantity * ticketPrice;
  const savings = Math.max(standardTotal - total, 0);

  return {
    quantity: safeQuantity,
    total,
    standardTotal,
    savings,
    appliedOffers: dp[safeQuantity]?.appliedOffers ?? [],
  };
}

function renderColourLabel(colour: RaffleColour) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        minWidth: 0,
      }}
    >
      <span
        aria-hidden="true"
        style={{
          width: 12,
          height: 12,
          borderRadius: 999,
          background: getRaffleColourHex(colour),
          border: "1px solid rgba(255,255,255,0.82)",
          boxShadow: "0 0 0 1px rgba(15,23,42,0.24)",
          display: "inline-block",
          flexShrink: 0,
        }}
      />
      <span>{colour.name}</span>
    </span>
  );
}

function colourSwatch(colourName: string | null, colours: RaffleColour[]) {
  if (!colourName) return null;

  const match = colours.find(
    (colour) => colour.name === colourName || colour.id === colourName,
  );

  return (
    <span
      aria-hidden="true"
      style={{
        width: 14,
        height: 14,
        borderRadius: 999,
        background: getRaffleColourHex(match || colourName),
        border: "1px solid #cbd5e1",
        boxShadow: "0 0 0 1px rgba(255,255,255,0.9)",
        display: "inline-block",
        flexShrink: 0,
      }}
    />
  );
}

function renderTicketSummary(ticket: TicketSelection, colours: RaffleColour[]) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        minWidth: 0,
      }}
    >
      {colourSwatch(ticket.colour, colours)}
      <span>
        {ticket.colour} #{ticket.number}
      </span>
    </span>
  );
}

function shuffleTickets(tickets: TicketSelection[]) {
  const shuffled = tickets.slice();

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    const current = shuffled[index];

    shuffled[index] = shuffled[swapIndex];
    shuffled[swapIndex] = current;
  }

  return shuffled;
}

function getStatusLabel(status: SafeRaffleStatus) {
  if (status === "published") return "Open now";
  if (status === "drawn") return "Drawn";
  if (status === "closed") return "Closed";
  return "Draft";
}

function statusPillStyle(status: SafeRaffleStatus): React.CSSProperties {
  if (status === "published") {
    return {
      background: "#dcfce7",
      color: "#166534",
      border: "1px solid #bbf7d0",
    };
  }

  if (status === "drawn") {
    return {
      background: "#dbeafe",
      color: "#1d4ed8",
      border: "1px solid #bfdbfe",
    };
  }

  if (status === "closed") {
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
    .public-raffle-page {
      background: linear-gradient(180deg, #020617 0px, #0f172a 620px, #f8fafc 620px, #f8fafc 100%) !important;
      overflow-x: hidden;
    }

    .public-raffle-hero {
      min-height: 620px !important;
      align-items: flex-end !important;
    }

    .public-raffle-hero-inner {
      padding: 18px 14px 34px !important;
    }

    .public-raffle-hero-nav {
      display: grid !important;
      grid-template-columns: 1fr !important;
      gap: 10px !important;
      margin-bottom: 18px !important;
    }

    .public-raffle-hero-nav a {
      width: 100% !important;
      justify-content: center !important;
      text-align: center !important;
      box-sizing: border-box !important;
    }

    .public-raffle-brand-strip {
      grid-template-columns: 56px minmax(0, 1fr) !important;
      gap: 12px !important;
      padding: 12px !important;
      border-radius: 20px !important;
      margin-bottom: 24px !important;
      max-width: 100% !important;
    }

    .public-raffle-brand-logo,
    .public-raffle-brand-fallback {
      width: 56px !important;
      height: 56px !important;
      border-radius: 16px !important;
    }

    .public-raffle-brand-name {
      font-size: 22px !important;
      letter-spacing: -0.05em !important;
    }

    .public-raffle-brand-tagline {
      font-size: 12px !important;
      line-height: 1.35 !important;
    }

    .public-raffle-badge-row {
      gap: 8px !important;
      margin-bottom: 18px !important;
    }

    .public-raffle-type-badge,
    .public-raffle-status-pill {
      font-size: 11px !important;
      padding: 7px 11px !important;
    }

    .public-raffle-hero-title {
      font-size: clamp(36px, 14vw, 56px) !important;
      line-height: 0.96 !important;
      letter-spacing: -0.055em !important;
      overflow-wrap: anywhere !important;
    }

    .public-raffle-hero-description {
      font-size: 15px !important;
      line-height: 1.55 !important;
      margin-top: 16px !important;
    }

    .public-raffle-hero-meta {
      grid-template-columns: 1fr 1fr !important;
      gap: 10px !important;
      margin-top: 22px !important;
    }

    .public-raffle-meta-card {
      padding: 13px !important;
      border-radius: 18px !important;
      min-width: 0 !important;
    }

    .public-raffle-meta-card strong {
      font-size: 14px !important;
      line-height: 1.25 !important;
      overflow-wrap: anywhere !important;
    }

    .public-raffle-hero-footer {
      margin-top: 18px !important;
      display: grid !important;
      grid-template-columns: 1fr !important;
      gap: 6px !important;
    }

    .public-raffle-content-wrap {
      margin-top: -34px !important;
      padding-bottom: 44px !important;
    }

    .public-raffle-container {
      padding: 0 12px !important;
      gap: 16px !important;
    }

    .public-raffle-heading {
      font-size: 26px !important;
      margin: 6px 0 8px !important;
    }

    .public-raffle-disclaimer,
    .public-raffle-buying-guide,
    .public-raffle-prizes,
    .public-raffle-winners,
    .public-raffle-quick-select,
    .public-raffle-fifty-fifty-panel,
    .public-raffle-total-box {
      border-radius: 22px !important;
      padding: 16px !important;
    }

    .public-raffle-fifty-fifty-stats,
    .public-raffle-guide-grid {
      grid-template-columns: 1fr !important;
      gap: 10px !important;
    }

    .public-raffle-prize-card {
      gap: 12px !important;
      padding: 14px !important;
      border-radius: 18px !important;
    }

    .public-raffle-prize-position {
      width: 54px !important;
      height: 54px !important;
      border-radius: 16px !important;
      font-size: 18px !important;
    }

    .public-raffle-prize-title {
      font-size: 18px !important;
    }

    .public-raffle-winner-card {
      display: grid !important;
      grid-template-columns: 1fr !important;
      gap: 12px !important;
    }

    .public-raffle-quick-controls {
      display: grid !important;
      grid-template-columns: 1fr !important;
      gap: 10px !important;
      align-items: stretch !important;
    }

    .public-raffle-quantity-input,
    .public-raffle-auto-button,
    .public-raffle-clear-button {
      width: 100% !important;
      box-sizing: border-box !important;
    }

    .public-raffle-offer-grid,
    .public-raffle-colour-row {
      display: grid !important;
      grid-template-columns: 1fr !important;
      gap: 10px !important;
    }

    .public-raffle-offer-pill,
    .public-raffle-colour-button {
      width: 100% !important;
      justify-content: center !important;
      box-sizing: border-box !important;
    }

    .public-raffle-number-grid {
      grid-template-columns: repeat(auto-fill, minmax(46px, 1fr)) !important;
      gap: 8px !important;
    }

    .public-raffle-number-button {
      height: 48px !important;
      border-radius: 14px !important;
      font-size: 14px !important;
      padding: 0 !important;
    }

    .public-raffle-basket-row {
      display: grid !important;
      grid-template-columns: 1fr !important;
      gap: 10px !important;
      align-items: stretch !important;
    }

    .public-raffle-remove-button {
      justify-self: start !important;
    }

    .public-raffle-cover-fees,
    .public-raffle-terms-box {
      display: grid !important;
      grid-template-columns: auto 1fr !important;
      gap: 10px !important;
    }

    .public-raffle-input,
    .public-raffle-primary-button {
      width: 100% !important;
      box-sizing: border-box !important;
    }

    .public-raffle-free-entry-address {
      overflow-x: auto !important;
      white-space: pre-wrap !important;
      word-break: break-word !important;
    }
  }

  @media (max-width: 430px) {
    .public-raffle-hero-meta {
      grid-template-columns: 1fr !important;
    }

    .public-raffle-hero {
      min-height: 700px !important;
    }

    .public-raffle-page {
      background: linear-gradient(180deg, #020617 0px, #0f172a 700px, #f8fafc 700px, #f8fafc 100%) !important;
    }
  }
`;

export default function PublicRafflePage({ slug }: Props) {
  const [raffle, setRaffle] = useState<SafeRaffle | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [selectedColour, setSelectedColour] = useState("");
  const [basket, setBasket] = useState<TicketSelection[]>([]);
  const [autoQuantity, setAutoQuantity] = useState(1);
  const [buyerName, setBuyerName] = useState("");
  const [buyerEmail, setBuyerEmail] = useState("");
  const [entryAnswer, setEntryAnswer] = useState("");
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [coverFees, setCoverFees] = useState(false);
  const [reservationMessage, setReservationMessage] = useState("");
  const [adminReturn, setAdminReturn] = useState("");
  const [showAllPrizes, setShowAllPrizes] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setAdminReturn(getSafeAdminReturn(params.get("adminReturn")));
  }, []);

  useEffect(() => {
    if (!slug) return;

    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        setError("");
        setReservationMessage("");

        const response = await fetch(
          "/api/raffles/" + encodeURIComponent(slug),
        );

        const parsed = await response.json();

        if (!response.ok) {
          throw new Error(parsed?.error || "Failed to load raffle");
        }

        const safe = toSafeRaffle(parsed?.raffle);

        if (!cancelled) {
          setRaffle(safe);
          setSelectedColour(safe.colours[0]?.name ?? "");
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load raffle");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [slug]);

  const availability = useMemo(() => {
    const sold = new Set<string>();
    const reserved = new Set<string>();

    if (!raffle) return { sold, reserved };

    for (const ticket of raffle.soldTickets) {
      sold.add(makeTicketKey(ticket.colour, ticket.number));
    }

    for (const ticket of raffle.reservedTickets) {
      reserved.add(makeTicketKey(ticket.colour, ticket.number));
    }

    return { sold, reserved };
  }, [raffle]);

  const basketKeys = useMemo(
    () =>
      new Set(
        basket.map((ticket) => makeTicketKey(ticket.colour, ticket.number)),
      ),
    [basket],
  );

  const visibleNumbers = useMemo(() => {
    if (!raffle) return [];

    if (
      !Number.isFinite(raffle.startNumber) ||
      !Number.isFinite(raffle.endNumber)
    ) {
      return [];
    }

    if (raffle.endNumber < raffle.startNumber) return [];

    const numbers: number[] = [];

    for (
      let number = raffle.startNumber;
      number <= raffle.endNumber;
      number += 1
    ) {
      numbers.push(number);
    }

    return numbers;
  }, [raffle]);

  const isPublished = raffle?.status === "published";
  const isClosed = raffle?.status === "closed";
  const isDrawn = raffle?.status === "drawn";
  const isDraft = raffle?.status === "draft";
  const isFiftyFifty = raffle?.raffleSubtype === "fifty_fifty";
  const canReserve = Boolean(raffle && isPublished);

  const pricing = useMemo(() => {
    if (!raffle) {
      return {
        quantity: 0,
        total: 0,
        standardTotal: 0,
        savings: 0,
        appliedOffers: [] as Array<{
          label: string;
          quantity: number;
          price: number;
          times: number;
        }>,
      };
    }

    return calculateBestPrice(
      basket.length,
      raffle.ticketPrice,
      isPublished ? raffle.offers : [],
    );
  }, [basket.length, raffle, isPublished]);

  const estimatedFee =
    pricing.total > 0 ? Math.round(pricing.total * 0.1 * 100) / 100 : 0;

  const displayTotal = coverFees ? pricing.total + estimatedFee : pricing.total;

  const hasSelectedTickets = basket.length > 0;
  const hasBuyerName = buyerName.trim().length > 0;
  const hasBuyerEmail = buyerEmail.trim().length > 0;
  const requiresEntryAnswer = Boolean(raffle?.legalQuestion);
  const hasEntryAnswer = !requiresEntryAnswer || entryAnswer.trim().length > 0;

  const checkoutReady =
    canReserve &&
    hasSelectedTickets &&
    hasBuyerName &&
    hasBuyerEmail &&
    hasEntryAnswer &&
    termsAccepted;

  const checkoutChecklist = [
    { label: "Choose at least one ticket", complete: hasSelectedTickets },
    { label: "Enter your name", complete: hasBuyerName },
    { label: "Enter your email", complete: hasBuyerEmail },
    ...(requiresEntryAnswer
      ? [{ label: "Answer the required entry question", complete: hasEntryAnswer }]
      : []),
    { label: "Accept the terms and privacy policy", complete: termsAccepted },
  ];
    const nextCheckoutHelp = !canReserve
    ? "This raffle is not currently open for checkout."
    : !hasSelectedTickets
      ? "Choose at least one ticket before checkout."
      : !hasBuyerName
        ? "Enter your name before checkout."
        : !hasBuyerEmail
          ? "Enter your email before checkout."
          : requiresEntryAnswer && !hasEntryAnswer
            ? "Answer the required entry question before checkout."
            : !termsAccepted
              ? "Accept the terms and privacy policy before checkout."
              : "Ready for secure checkout.";

  const availableCount = useMemo(() => {
    if (!raffle) return 0;

    let count = 0;

    for (const colour of raffle.colours) {
      for (const number of visibleNumbers) {
        const key = makeTicketKey(colour.name, number);

        if (!availability.sold.has(key) && !availability.reserved.has(key)) {
          count += 1;
        }
      }
    }

    return count;
  }, [raffle, visibleNumbers, availability]);

  const heroImageUrl = raffle?.imageUrl || DEFAULT_RAFFLE_IMAGE;
  const hasCustomHeroImage = Boolean(raffle?.imageUrl);
  const heroObjectFit = hasCustomHeroImage ? "cover" : "contain";
  const heroObjectPosition = hasCustomHeroImage
    ? raffle?.imageObjectPosition || "center"
    : "center";

  const branding = raffle?.branding || normaliseBranding({});
  const brandDisplayName = branding.displayName || raffle?.tenantSlug || "";
  const brandTagline = branding.tagline || "";
  const brandLogoSrc = branding.logoMarkUrl || branding.logoUrl;
  const primaryColour = branding.primaryColour || "#2563EB";
  const accentColour = branding.accentColour || "#F59E0B";

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
    background: `linear-gradient(135deg, ${accentColour} 0%, #f97316 60%, #ea580c 100%)`,
    boxShadow: `0 10px 24px ${accentColour}33`,
  };

  function toggleTicket(number: number) {
    if (!raffle || !selectedColour || !canReserve) return;

    const key = makeTicketKey(selectedColour, number);

    if (availability.sold.has(key) || availability.reserved.has(key)) return;

    setBasket((current) => {
      const exists = current.some(
        (ticket) => ticket.colour === selectedColour && ticket.number === number,
      );

      if (exists) {
        return current.filter(
          (ticket) =>
            !(ticket.colour === selectedColour && ticket.number === number),
        );
      }

      return [...current, { colour: selectedColour, number }].sort((a, b) => {
        if (a.colour !== b.colour) return a.colour.localeCompare(b.colour);
        return a.number - b.number;
      });
    });
  }

  function removeFromBasket(ticket: TicketSelection) {
    setBasket((current) =>
      current.filter(
        (item) =>
          !(item.colour === ticket.colour && item.number === ticket.number),
      ),
    );
  }

  function clearBasket() {
    setBasket([]);
    setError("");
    setReservationMessage("");
  }

  function autoSelectTicketQuantity(quantity: number) {
    if (!raffle || !canReserve) return;

    const requested = Math.max(1, Math.floor(Number(quantity) || 0));

    const existingBasketKeys = new Set(
      basket.map((ticket) => makeTicketKey(ticket.colour, ticket.number)),
    );

    const availableTickets: TicketSelection[] = [];

    const sortedColours = raffle.colours
      .slice()
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));

    for (const colour of sortedColours) {
      for (const number of visibleNumbers) {
        const key = makeTicketKey(colour.name, number);

        if (
          existingBasketKeys.has(key) ||
          availability.sold.has(key) ||
          availability.reserved.has(key)
        ) {
          continue;
        }

        availableTickets.push({
          colour: colour.name,
          number,
        });
      }
    }

    const randomTickets = shuffleTickets(availableTickets).slice(0, requested);

    const selected = [...basket, ...randomTickets];

    if (randomTickets.length < requested) {
      setBasket(
        selected.sort((a, b) => {
          if (a.colour !== b.colour) return a.colour.localeCompare(b.colour);
          return a.number - b.number;
        }),
      );

      const ticketLabel = selected.length === 1 ? "ticket" : "tickets";

      setError(
        "Only " +
          selected.length +
          " " +
          ticketLabel +
          " could be selected. Not enough tickets are available.",
      );

      return;
    }

    setBasket(
      selected.sort((a, b) => {
        if (a.colour !== b.colour) return a.colour.localeCompare(b.colour);
        return a.number - b.number;
      }),
    );

    setAutoQuantity(requested);
    setError("");
    setReservationMessage("");
  }

  function autoSelectTickets() {
    if (!autoQuantity || autoQuantity <= 0) {
      setError("Enter how many tickets you would like.");
      return;
    }

    autoSelectTicketQuantity(autoQuantity);
  }

  async function reserveTickets() {
    if (!raffle || !canReserve) return;

    try {
      setSaving(true);
      setError("");
      setReservationMessage("");

      if (!buyerName.trim()) {
        throw new Error("Please enter your name.");
      }

      if (!buyerEmail.trim()) {
        throw new Error("Please enter your email.");
      }

      if (basket.length === 0) {
        throw new Error("Please select at least one ticket.");
      }

      if (raffle.legalQuestion) {
        if (!entryAnswer.trim()) {
          throw new Error("Please answer the required entry question before checkout.");
        }

        if (
          raffle.legalAnswer &&
          normaliseAnswer(entryAnswer) !== normaliseAnswer(raffle.legalAnswer)
        ) {
          throw new Error("The entry question answer is not correct.");
        }
      }

      if (!termsAccepted) {
        throw new Error("Please accept the terms and privacy policy.");
      }

      const selectedTickets = basket.map((ticket) => ({
        ticket_number: ticket.number,
        colour: ticket.colour,
      }));

      const reserveResponse = await fetch(
        "/api/raffles/" + encodeURIComponent(raffle.slug) + "/reserve",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tenantSlug: raffle.tenantSlug,
            raffleId: raffle.id,
            raffleSlug: raffle.slug,
            slug: raffle.slug,
            buyerName: buyerName.trim(),
            buyerEmail: buyerEmail.trim(),
            customerName: buyerName.trim(),
            customerEmail: buyerEmail.trim(),
            quantity: basket.length,
            selectedTickets,
            tickets: selectedTickets,
            entryAnswer: entryAnswer.trim(),
            legalAnswer: entryAnswer.trim(),
            termsAccepted,
            coverFees,
          }),
        },
      );

      const reserveText = await reserveResponse.text();

      let reserveParsed: any = null;

      try {
        reserveParsed = JSON.parse(reserveText);
      } catch {
        throw new Error(
          "Reserve API did not return JSON: " + reserveText.slice(0, 120),
        );
      }

      if (!reserveResponse.ok) {
        throw new Error(reserveParsed?.error || "Reserve failed");
      }

      const reservationToken = String(
        reserveParsed?.reservationToken ??
          reserveParsed?.reservation_token ??
          reserveParsed?.token ??
          "",
      ).trim();

      if (!reservationToken) {
        throw new Error(
          "Reservation succeeded but no reservation token was returned.",
        );
      }

      setReservationMessage(
        reserveParsed?.expiresAt
          ? "Reserved until " + String(reserveParsed.expiresAt)
          : "Tickets reserved. Redirecting to checkout...",
      );

      const checkoutResponse = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "raffle",
          productType: "raffle",
          raffleId: raffle.id,
          raffleSlug: raffle.slug,
          slug: raffle.slug,
          reservationToken,
          reservation_token: reservationToken,
          coverFees,
          buyerName: buyerName.trim(),
          buyerEmail: buyerEmail.trim(),
          customerName: buyerName.trim(),
          customerEmail: buyerEmail.trim(),
          selectedTickets,
          tickets: selectedTickets,
          entryAnswer: entryAnswer.trim(),
          legalAnswer: entryAnswer.trim(),
          termsAccepted,
        }),
      });

      const checkoutText = await checkoutResponse.text();

      let checkoutParsed: any = null;

      try {
        checkoutParsed = JSON.parse(checkoutText);
      } catch {
        throw new Error(
          "Checkout API did not return JSON: " + checkoutText.slice(0, 120),
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
    } finally {
      setSaving(false);
    }
  }

  if (!slug) return <div style={styles.wrap}>Loading…</div>;
  if (loading) return <div style={styles.wrap}>Loading raffle…</div>;
  if (error && !raffle) return <div style={styles.wrap}>{error}</div>;
  if (!raffle) return <div style={styles.wrap}>Raffle not found.</div>;

  return (
    <div className="public-raffle-page" style={styles.page}>
      <style>{responsiveStyles}</style>

      <section className="public-raffle-hero" style={styles.hero}>
        <img
          src={heroImageUrl}
          alt={raffle.title}
          style={{
            ...styles.heroBackgroundImage,
            objectFit: heroObjectFit,
            objectPosition: heroObjectPosition,
            opacity: hasCustomHeroImage ? 1 : 0.72,
            background: hasCustomHeroImage
              ? "#0f172a"
              : "linear-gradient(135deg, #ffffff 0%, #f8fafc 52%, #eff6ff 100%)",
          }}
        />

        <div style={styles.heroOverlay} />

        <div className="public-raffle-hero-inner" style={styles.heroInner}>
          <nav className="public-raffle-hero-nav" style={styles.heroNav}>
            <Link href={"/c/" + raffle.tenantSlug} style={styles.heroBackLink}>
              ← Back to campaigns
            </Link>

            {adminReturn ? (
              <Link href={adminReturn} style={styles.heroAdminLink}>
                ← Back to admin raffle
              </Link>
            ) : null}
          </nav>

          {brandDisplayName || brandLogoSrc ? (
            <div
              className="public-raffle-brand-strip"
              style={{
                ...styles.brandStrip,
                borderColor: `${accentColour}66`,
              }}
            >
              {brandLogoSrc ? (
                <div
                  className="public-raffle-brand-logo"
                  style={styles.brandLogoWrap}
                >
                  <img
                    src={brandLogoSrc}
                    alt={brandDisplayName || raffle.tenantSlug}
                    style={styles.brandLogo}
                  />
                </div>
              ) : (
                <div
                  className="public-raffle-brand-fallback"
                  style={{
                    ...styles.brandFallback,
                    background: primaryColour,
                    borderColor: accentColour,
                  }}
                >
                  {(brandDisplayName || raffle.tenantSlug)
                    .slice(0, 2)
                    .toUpperCase()}
                </div>
              )}

              <div style={styles.brandCopy}>
                <p style={{ ...styles.brandKicker, color: accentColour }}>
                  Fundraising campaign
                </p>

                <h2
                  className="public-raffle-brand-name"
                  style={styles.brandName}
                >
                  {brandDisplayName || raffle.tenantSlug}
                </h2>

                {brandTagline ? (
                  <p
                    className="public-raffle-brand-tagline"
                    style={styles.brandTagline}
                  >
                    {brandTagline}
                  </p>
                ) : null}
              </div>
            </div>
          ) : null}

          <div className="public-raffle-badge-row" style={styles.badgeRow}>
            <span
              className="public-raffle-type-badge"
              style={{
                ...styles.typeBadge,
                borderColor: `${accentColour}88`,
              }}
            >
              {isFiftyFifty ? "50/50 raffle" : "Prize draw"}
            </span>

            <span
              className="public-raffle-status-pill"
              style={{
                ...styles.statusPill,
                ...statusPillStyle(raffle.status),
              }}
            >
              {getStatusLabel(raffle.status)}
            </span>
          </div>

          <h1 className="public-raffle-hero-title" style={styles.heroTitle}>
            {raffle.title}
          </h1>

          {raffle.description ? (
            <p
              className="public-raffle-hero-description"
              style={styles.heroDescription}
            >
              {raffle.description}
            </p>
          ) : null}

          <div className="public-raffle-hero-meta" style={styles.heroMeta}>
            <div className="public-raffle-meta-card" style={styles.metaCard}>
              <span style={styles.metaLabel}>Ticket price</span>
              <strong>
                {formatCurrency(raffle.ticketPrice, raffle.currency)}
              </strong>
            </div>

            <div className="public-raffle-meta-card" style={styles.metaCard}>
              <span style={styles.metaLabel}>Draw date</span>
              <strong>{formatDateTime(raffle.drawAt)}</strong>
            </div>

            <div className="public-raffle-meta-card" style={styles.metaCard}>
              <span style={styles.metaLabel}>
                {isFiftyFifty ? "Prize split" : "Ticket range"}
              </span>
              <strong>
                {isFiftyFifty
                  ? "50% / 50%"
                  : `${raffle.startNumber}–${raffle.endNumber}`}
              </strong>
            </div>

            <div className="public-raffle-meta-card" style={styles.metaCard}>
              <span style={styles.metaLabel}>Available now</span>
              <strong>{availableCount}</strong>
            </div>
          </div>

          <div className="public-raffle-hero-footer" style={styles.heroFooter}>
            <span>
              {isFiftyFifty
                ? "50% to the winner · 50% to the cause"
                : "Supporting the organiser"}
            </span>
            <strong>
              {basket.length > 0
                ? `${basket.length} selected`
                : "Choose tickets below"}
            </strong>
          </div>
        </div>
      </section>

      <main className="public-raffle-content-wrap" style={styles.contentWrap}>
        <div className="public-raffle-container" style={styles.container}>
          <div
            className="public-raffle-disclaimer"
            style={styles.disclaimerBox}
          >
            This campaign is run by the organiser. The platform provides software
            only and is not responsible for the operation of this draw. The
            organiser is responsible for ensuring compliance with all applicable
            laws.
          </div>

          {canReserve ? (
            <section
              className="public-raffle-buying-guide"
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

                  <h2 style={styles.guideTitle}>How to enter this raffle</h2>

                  <p style={styles.guideLead}>
                    Follow these steps in order. If this raffle has an entry
                    question, you must answer it before checkout opens.
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

              <div className="public-raffle-guide-grid" style={styles.guideGrid}>
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
                      Choose your tickets
                    </strong>
                    <p style={styles.guideStepText}>
                      Use quick buy or pick your colour and numbers manually.
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
                      background: requiresEntryAnswer
                        ? accentColour
                        : primaryColour,
                    }}
                  >
                    3
                  </span>

                  <div>
                    <strong style={styles.guideStepTitle}>
                      {requiresEntryAnswer
                        ? "Answer the required question"
                        : "Check the entry rules"}
                    </strong>
                    <p style={styles.guideStepText}>
                      {requiresEntryAnswer
                        ? "This raffle requires an answer before you can pay."
                        : "This raffle does not need an entry question answer."}
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
                    {isFiftyFifty ? (
            <section
              className="public-raffle-fifty-fifty-panel"
              style={{
                ...styles.fiftyFiftyPanel,
                borderColor: `${accentColour}88`,
              }}
            >
              <div style={styles.fiftyFiftyKicker}>50/50 raffle</div>

              <h2 style={styles.fiftyFiftyTitle}>
                Half the paid ticket pot goes to the winner.
              </h2>

              <p style={styles.fiftyFiftyText}>
                50% of all paid ticket sales goes to the winning ticket holder.
                The remaining 50% supports the cause.
              </p>

              <div
                className="public-raffle-fifty-fifty-stats"
                style={styles.fiftyFiftyPanelStats}
              >
                <div style={styles.fiftyFiftyPanelStat}>
                  <span>Winner share</span>
                  <strong>50%</strong>
                </div>

                <div style={styles.fiftyFiftyPanelStat}>
                  <span>Cause share</span>
                  <strong>50%</strong>
                </div>

                <div style={styles.fiftyFiftyPanelStat}>
                  <span>Prize type</span>
                  <strong>Cash pot</strong>
                </div>
              </div>
            </section>
          ) : null}

          {raffle.prizes.length > 0 && !isFiftyFifty ? (
            <section className="public-raffle-prizes" style={styles.prizesBox}>
              <div style={styles.prizesTitle}>Prizes</div>

              <div style={{ display: "grid", gap: 10 }}>
                {(showAllPrizes
                  ? raffle.prizes
                  : raffle.prizes.slice(0, 3)
                ).map((prize) => (
                  <div
                    key={String(prize.position) + "-" + prize.title}
                    className="public-raffle-prize-card"
                    style={styles.prizeCard}
                  >
                    <div
                      className="public-raffle-prize-position"
                      style={brandedPrizePositionStyle}
                    >
                      {ordinal(prize.position)}
                    </div>

                    <div style={styles.prizeContent}>
                      <div
                        className="public-raffle-prize-title"
                        style={styles.prizeTitle}
                      >
                        {prize.title}
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

              {raffle.prizes.length > 3 ? (
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
              className="public-raffle-winners"
              style={styles.winnersBox}
            >
              <div style={styles.winnersTitle}>Winning tickets</div>

              {raffle.winners.length > 0 ? (
                <div style={{ display: "grid", gap: 10 }}>
                  {raffle.winners.map((winner) => (
                    <div
                      key={
                        String(winner.prizePosition) +
                        "-" +
                        String(winner.ticketNumber) +
                        "-" +
                        String(winner.colour || "")
                      }
                      className="public-raffle-winner-card"
                      style={styles.winnerCard}
                    >
                      <div style={styles.winnerBlock}>
                        <div style={styles.winnerLabel}>Prize</div>
                        <div style={styles.winnerPrize}>
                          {isFiftyFifty
                            ? "50/50 pot"
                            : ordinal(winner.prizePosition)}
                        </div>
                      </div>

                      <div style={styles.winnerBlock}>
                        <div style={styles.winnerLabel}>Ticket</div>
                        <div style={styles.winnerTicket}>
                          {"#" + winner.ticketNumber}
                        </div>
                      </div>

                      <div style={styles.winnerBlock}>
                        <div style={styles.winnerLabel}>Colour</div>
                        <div style={styles.winnerColour}>
                          {colourSwatch(winner.colour, raffle.colours)}
                          <span>{winner.colour || "—"}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div
                  className="public-raffle-winner-card"
                  style={styles.winnerCard}
                >
                  <div style={styles.winnerBlock}>
                    <div style={styles.winnerLabel}>Prize</div>
                    <div style={styles.winnerPrize}>
                      {isFiftyFifty ? "50/50 pot" : "1st"}
                    </div>
                  </div>

                  <div style={styles.winnerBlock}>
                    <div style={styles.winnerLabel}>Ticket</div>
                    <div style={styles.winnerTicket}>
                      {raffle.winnerTicketNumber != null
                        ? "#" + raffle.winnerTicketNumber
                        : "—"}
                    </div>
                  </div>

                  <div style={styles.winnerBlock}>
                    <div style={styles.winnerLabel}>Colour</div>
                    <div style={styles.winnerColour}>
                      {colourSwatch(raffle.winnerColour, raffle.colours)}
                      <span>{raffle.winnerColour || "—"}</span>
                    </div>
                  </div>
                </div>
              )}

              <div style={{ marginTop: 10, color: "#166534", fontWeight: 700 }}>
                Drawn at:{" "}
                {formatDateTime(raffle.drawnAt || raffle.winners[0]?.drawnAt)}
              </div>
            </section>
          ) : null}

          {isClosed ? (
            <div style={styles.noticeDark}>
              This raffle is now closed. Reservations and payments are no longer
              available.
            </div>
          ) : null}

          {isDraft ? (
            <div style={styles.notice}>This raffle is not published yet.</div>
          ) : null}

          {canReserve ? (
            <section
              className="public-raffle-quick-select"
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
                  <h2 style={{ margin: 0 }}>Choose your tickets</h2>

                  <p style={{ margin: "6px 0 0", color: "#64748b" }}>
                    Choose how many tickets you would like and we’ll randomly
                    auto-select available numbers across colours.
                  </p>
                </div>
              </div>

              <div
                className="public-raffle-quick-controls"
                style={styles.quickControls}
              >
                <label style={{ display: "grid", gap: 6 }}>
                  <span
                    style={{ fontSize: 13, fontWeight: 700, color: "#475569" }}
                  >
                    Number of tickets
                  </span>

                  <input
                    className="public-raffle-quantity-input"
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
                  className="public-raffle-auto-button"
                  type="button"
                  onClick={autoSelectTickets}
                  style={brandedAutoButtonStyle}
                >
                  Auto select
                </button>

                <button
                  className="public-raffle-clear-button"
                  type="button"
                  onClick={clearBasket}
                  style={styles.clearButton}
                >
                  Clear basket
                </button>
              </div>
            </section>
          ) : null}

          {raffle.offers.length > 0 && canReserve && !isFiftyFifty ? (
            <section style={styles.offerBox}>
              <div style={{ fontWeight: 800, marginBottom: 8 }}>
                Available offers
              </div>

              <div className="public-raffle-offer-grid" style={styles.offerGrid}>
                {raffle.offers
                  .filter((offer) => offer.isActive)
                  .slice()
                  .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
                  .map((offer) => (
                    <button
                      key={offer.id}
                      className="public-raffle-offer-pill"
                      type="button"
                      onClick={() => autoSelectTicketQuantity(offer.quantity)}
                      style={styles.offerPill}
                    >
                      {offer.label} —{" "}
                      {formatCurrency(offer.price, raffle.currency)}
                    </button>
                  ))}
              </div>
            </section>
          ) : null}

          <h2 className="public-raffle-heading" style={styles.heading}>
            Choose colour
          </h2>

          <div className="public-raffle-colour-row" style={styles.colourRow}>
            {raffle.colours.length === 0 ? (
              <div style={styles.notice}>No colours configured.</div>
            ) : (
              raffle.colours.map((colour) => {
                const isSelectedColour = selectedColour === colour.name;

                return (
                  <button
                    key={colour.id}
                    className="public-raffle-colour-button"
                    type="button"
                    onClick={() => setSelectedColour(colour.name)}
                    disabled={!canReserve}
                    aria-pressed={isSelectedColour}
                    style={colourButtonStyle({
                      colour,
                      selected: isSelectedColour,
                      canReserve,
                      primaryColour,
                    })}
                  >
                    {renderColourLabel(colour)}
                  </button>
                );
              })
            )}
          </div>

          <h2 className="public-raffle-heading" style={styles.heading}>
            Choose numbers
          </h2>

          {selectedColour ? (
            <div className="public-raffle-number-grid" style={styles.numberGrid}>
              {visibleNumbers.map((number) => {
                const key = makeTicketKey(selectedColour, number);
                const isSold = availability.sold.has(key);
                const isReserved = availability.reserved.has(key);
                const isSelected = basketKeys.has(key);

                return (
                  <button
                    key={key}
                    className="public-raffle-number-button"
                    type="button"
                    onClick={() => toggleTicket(number)}
                    disabled={isSold || isReserved || !canReserve}
                    style={{
                      ...styles.numberButton,
                      background: isSelected
                        ? primaryColour
                        : isSold
                          ? "#111827"
                          : isReserved
                            ? "#f59e0b"
                            : "#ffffff",
                      color:
                        isSelected || isSold || isReserved
                          ? "#ffffff"
                          : "#111827",
                      opacity: canReserve ? 1 : 0.7,
                      cursor:
                        isSold || isReserved || !canReserve
                          ? "not-allowed"
                          : "pointer",
                    }}
                  >
                    {number}
                  </button>
                );
              })}
            </div>
          ) : (
            <div style={styles.notice}>
              Select a colour to view available numbers.
            </div>
          )}

          <h2 className="public-raffle-heading" style={styles.heading}>
            Basket
          </h2>

          {basket.length === 0 ? (
            <div style={styles.notice}>No tickets selected yet.</div>
          ) : (
            <div style={styles.basket}>
              {basket.map((ticket) => (
                <div
                  key={makeTicketKey(ticket.colour, ticket.number)}
                  className="public-raffle-basket-row"
                  style={styles.basketRow}
                >
                  {renderTicketSummary(ticket, raffle.colours)}

                  <button
                    className="public-raffle-remove-button"
                    type="button"
                    onClick={() => removeFromBasket(ticket)}
                    style={styles.removeButton}
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="public-raffle-total-box" style={styles.totalBox}>
            <div>Tickets: {pricing.quantity}</div>

            <div>
              Standard total:{" "}
              {formatCurrency(pricing.standardTotal, raffle.currency)}
            </div>

            <div>
              Ticket total: {formatCurrency(pricing.total, raffle.currency)}
            </div>

            {pricing.appliedOffers.length > 0 && !isFiftyFifty ? (
              <div style={{ color: "#166534" }}>
                Best value applied:{" "}
                {pricing.appliedOffers
                  .map((offer) => {
                    return (
                      offer.label +
                      (offer.times > 1 ? " × " + offer.times : "")
                    );
                  })
                  .join(", ")}
              </div>
            ) : null}

            {pricing.savings > 0 && !isFiftyFifty ? (
              <div style={{ color: "#166534" }}>
                You save {formatCurrency(pricing.savings, raffle.currency)}
              </div>
            ) : null}

            {isFiftyFifty && pricing.total > 0 ? (
              <div style={styles.fiftyFiftyTotalNote}>
                Estimated split:{" "}
                <strong>
                  {formatCurrency(pricing.total / 2, raffle.currency)}
                </strong>{" "}
                to the winner and{" "}
                <strong>
                  {formatCurrency(pricing.total / 2, raffle.currency)}
                </strong>{" "}
                to the cause from your selected tickets.
              </div>
            ) : null}

            <label
              className="public-raffle-cover-fees"
              style={styles.coverFeesBox}
            >
              <input
                type="checkbox"
                checked={coverFees}
                onChange={(event) => setCoverFees(event.target.checked)}
                disabled={!canReserve || basket.length === 0}
              />

              <span>
                <strong>I’d like to cover platform fees</strong>
                <br />
                <span style={{ color: "#64748b", fontSize: 13 }}>
                  Adds approximately{" "}
                  {formatCurrency(estimatedFee, raffle.currency)} so the
                  organiser receives the full ticket value.
                </span>
              </span>
            </label>

            <div>
              Total today: {formatCurrency(displayTotal, raffle.currency)}
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
                <h2 className="public-raffle-heading" style={styles.heading}>
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
                className="public-raffle-input"
                value={buyerName}
                onChange={(event) => setBuyerName(event.target.value)}
                placeholder="Your name"
                style={styles.input}
                disabled={!canReserve}
              />

              <input
                className="public-raffle-input"
                value={buyerEmail}
                onChange={(event) => setBuyerEmail(event.target.value)}
                placeholder="Your email"
                type="email"
                style={styles.input}
                disabled={!canReserve}
              />

              {raffle.legalQuestion ? (
                <div
                  className="public-raffle-legal-question"
                  style={{
                    ...styles.legalQuestionBox,
                    borderColor: `${accentColour}88`,
                  }}
                >
                  <div style={styles.legalQuestionHeader}>
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
                          ...styles.legalQuestionTitle,
                          color: "#92400e",
                        }}
                      >
                        Entry question needed before checkout
                      </div>

                      <p style={styles.legalQuestionHelp}>
                        You must answer this question before you can reserve and
                        pay for your tickets.
                      </p>
                    </div>
                  </div>

                  <div style={styles.legalQuestionText}>
                    {raffle.legalQuestion}
                  </div>

                  <input
                    className="public-raffle-input"
                    value={entryAnswer}
                    onChange={(event) => setEntryAnswer(event.target.value)}
                    placeholder="Type your answer here"
                    style={styles.input}
                    disabled={!canReserve}
                    aria-label="Entry question answer"
                  />
                </div>
              ) : null}
                            {raffle.freeEntry.address ? (
                <details
                  className="public-raffle-free-entry"
                  style={{
                    ...styles.freeEntryBox,
                    borderColor: `${primaryColour}55`,
                  }}
                >
                  <summary
                    style={{
                      ...styles.freeEntrySummary,
                      color: primaryColour,
                    }}
                  >
                    No purchase necessary — free postal entry available
                  </summary>

                  <div style={styles.freeEntryContent}>
                    <p style={styles.freeEntryText}>
                      To enter for free by post, send your full name, email
                      address, phone number, raffle/campaign name, answer to the
                      entry question, and preferred ticket number and colour if
                      applicable to:
                    </p>

                    <pre
                      className="public-raffle-free-entry-address"
                      style={styles.freeEntryAddress}
                    >
                      {raffle.freeEntry.address}
                    </pre>

                    {raffle.freeEntry.instructions ? (
                      <p style={styles.freeEntryText}>
                        {raffle.freeEntry.instructions}
                      </p>
                    ) : null}

                    {raffle.freeEntry.closesAt ? (
                      <p style={styles.freeEntryText}>
                        Postal entries must be received before{" "}
                        <strong>
                          {formatDateTime(raffle.freeEntry.closesAt)}
                        </strong>
                        .
                      </p>
                    ) : null}

                    <p style={styles.freeEntryText}>
                      Your email address is required so the organiser can contact
                      you if you win and include your entry in the automatic or
                      live draw. One entry per postcard/envelope. Paid and postal
                      entries have equal chance of winning.
                    </p>
                  </div>
                </details>
              ) : null}

              <label
                className="public-raffle-terms-box"
                style={styles.termsBox}
              >
                <input
                  type="checkbox"
                  checked={termsAccepted}
                  onChange={(event) => setTermsAccepted(event.target.checked)}
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
                className="public-raffle-primary-button"
                type="button"
                onClick={reserveTickets}
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

  heroAdminLink: {
    display: "inline-flex",
    alignItems: "center",
    padding: "12px 16px",
    borderRadius: 999,
    background: "#ffffff",
    color: "#0f172a",
    textDecoration: "none",
    fontWeight: 900,
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

  disclaimerBox: {
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

  fiftyFiftyPanel: {
    padding: 24,
    borderRadius: 28,
    background:
      "linear-gradient(135deg, #fffbeb 0%, #ffffff 48%, #eff6ff 100%)",
    border: "1px solid #fde68a",
    boxShadow: "0 10px 30px rgba(15,23,42,0.06)",
    display: "grid",
    gap: 12,
  },

  fiftyFiftyKicker: {
    justifySelf: "start",
    padding: "7px 11px",
    borderRadius: 999,
    background: "#fef3c7",
    color: "#92400e",
    border: "1px solid #facc15",
    fontSize: 12,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
  },

  fiftyFiftyTitle: {
    margin: 0,
    color: "#0f172a",
    fontSize: "clamp(24px, 5vw, 34px)",
    lineHeight: 1.05,
    letterSpacing: "-0.05em",
    fontWeight: 950,
  },

  fiftyFiftyText: {
    margin: 0,
    maxWidth: 760,
    color: "#475569",
    fontSize: 15,
    lineHeight: 1.7,
    fontWeight: 700,
  },

  fiftyFiftyPanelStats: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: 10,
    marginTop: 4,
  },

  fiftyFiftyPanelStat: {
    display: "grid",
    gap: 4,
    padding: 14,
    borderRadius: 18,
    background: "#ffffff",
    border: "1px solid #fde68a",
    color: "#92400e",
  },

  fiftyFiftyTotalNote: {
    padding: 14,
    borderRadius: 18,
    background: "#fffbeb",
    border: "1px solid #fde68a",
    color: "#92400e",
    lineHeight: 1.55,
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
      "linear-gradient(135deg, #f59e0b 0%, #f97316 50%, #ea580c 100%)",
    color: "#ffffff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 24,
    fontWeight: 950,
    flexShrink: 0,
    boxShadow: "0 10px 24px rgba(249,115,22,0.25)",
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

  winnerColour: {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    fontSize: 18,
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

  offerBox: {
    padding: 20,
    borderRadius: 24,
    background: "#ecfdf5",
    border: "1px solid #bbf7d0",
  },

  offerGrid: {
    display: "flex",
    flexWrap: "wrap",
    gap: 10,
  },

  offerPill: {
    padding: "10px 14px",
    borderRadius: 999,
    background: "#ffffff",
    border: "1px solid #bbf7d0",
    color: "#166534",
    fontWeight: 800,
    cursor: "pointer",
  },

  colourRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: 10,
  },

  colourButton: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 48,
    borderRadius: 999,
    padding: "12px 18px",
    fontWeight: 950,
    transition:
      "transform 160ms ease, box-shadow 160ms ease, border-color 160ms ease",
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

  legalQuestionBox: {
    padding: 20,
    borderRadius: 22,
    background: "#fffbeb",
    border: "1px solid #fde68a",
    display: "grid",
    gap: 12,
    boxShadow: "0 10px 24px rgba(245,158,11,0.08)",
  },

  legalQuestionHeader: {
    display: "flex",
    gap: 12,
    alignItems: "flex-start",
    flexWrap: "wrap",
  },

  legalQuestionTitle: {
    color: "#92400e",
    fontWeight: 950,
  },

  legalQuestionHelp: {
    margin: "4px 0 0",
    color: "#92400e",
    fontSize: 14,
    lineHeight: 1.55,
    fontWeight: 700,
  },

  legalQuestionText: {
    color: "#78350f",
    fontWeight: 850,
    lineHeight: 1.65,
    fontSize: 17,
  },

  freeEntryBox: {
    padding: 18,
    borderRadius: 22,
    background: "#eff6ff",
    border: "1px solid #bfdbfe",
  },

  freeEntrySummary: {
    cursor: "pointer",
    fontWeight: 900,
    color: "#1d4ed8",
  },

  freeEntryContent: {
    marginTop: 12,
  },

  freeEntryText: {
    lineHeight: 1.7,
    color: "#1e3a8a",
  },

  freeEntryAddress: {
    margin: "14px 0",
    padding: 14,
    borderRadius: 16,
    background: "#ffffff",
    border: "1px solid #bfdbfe",
    whiteSpace: "pre-wrap",
    fontFamily: "inherit",
    lineHeight: 1.6,
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
    border: "1px solid #fdba74",
    background: "#fff7ed",
    color: "#9a3412",
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
