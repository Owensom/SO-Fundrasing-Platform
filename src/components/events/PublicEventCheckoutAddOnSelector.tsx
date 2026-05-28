"use client";

import type { CSSProperties } from "react";

export type PublicEventCheckoutAddOnType = "heads_or_tails" | "higher_or_lower";

export type PublicEventCheckoutAddOn = {
  type: PublicEventCheckoutAddOnType;
  title: string;
  description?: string;
  entryPriceCents: number;
  maxEntriesPerBooking?: number | null;
  legalQuestionEnabled?: boolean;
  legalQuestionText?: string;
  legalQuestionHelperText?: string;
  prizeValueRangeEnabled?: boolean;
  prizeValueRangeMinCents?: number;
  prizeValueRangeMaxCents?: number;
  prizeValueRangeNote?: string;
};

export type PublicEventCheckoutAddOnSelection = {
  type: PublicEventCheckoutAddOnType;
  quantity: number;
  buyerAnswer?: string;
};

function moneyFromCents(cents: number | null | undefined) {
  return (Number(cents || 0) / 100).toFixed(2);
}

function addOnFallbackTitle(type: PublicEventCheckoutAddOnType) {
  if (type === "higher_or_lower") return "Higher or Lower";
  return "Heads or Tails";
}

function addOnFallbackDescription(type: PublicEventCheckoutAddOnType) {
  if (type === "higher_or_lower") {
    return "Add Higher or Lower entries to your event booking.";
  }

  return "Add Heads or Tails entries to your event booking.";
}

function cleanQuantity(value: unknown, maxEntriesPerBooking?: number | null) {
  const number = Number(value || 0);

  if (!Number.isFinite(number)) {
    return 0;
  }

  const quantity = Math.max(0, Math.floor(number));
  const max = Number(maxEntriesPerBooking || 0);

  if (Number.isFinite(max) && max > 0) {
    return Math.min(quantity, Math.floor(max));
  }

  return quantity;
}

function cleanText(value: unknown) {
  return String(value || "").trim();
}

function hasValidPrizeValueRange(addOn: PublicEventCheckoutAddOn) {
  const min = Number(addOn.prizeValueRangeMinCents || 0);
  const max = Number(addOn.prizeValueRangeMaxCents || 0);

  return Boolean(
    addOn.type === "higher_or_lower" &&
      addOn.prizeValueRangeEnabled &&
      Number.isFinite(min) &&
      Number.isFinite(max) &&
      min > 0 &&
      max > 0 &&
      max >= min,
  );
}

function shouldShowHigherOrLowerAnswer(addOn: PublicEventCheckoutAddOn) {
  return Boolean(
    addOn.type === "higher_or_lower" &&
      addOn.legalQuestionEnabled &&
      cleanText(addOn.legalQuestionText),
  );
}

export default function PublicEventCheckoutAddOnSelector({
  addOn,
  currency,
  quantity,
  disabled = false,
  buyerAnswer = "",
  onQuantityChange,
  onBuyerAnswerChange,
}: {
  addOn: PublicEventCheckoutAddOn;
  currency: string;
  quantity: number;
  disabled?: boolean;
  buyerAnswer?: string;
  onQuantityChange: (quantity: number) => void;
  onBuyerAnswerChange?: (answer: string) => void;
}) {
  const safeQuantity = cleanQuantity(quantity, addOn.maxEntriesPerBooking);
  const maxEntriesPerBooking =
    Number(addOn.maxEntriesPerBooking || 0) > 0
      ? Math.floor(Number(addOn.maxEntriesPerBooking || 0))
      : null;

  const showAnswerField = shouldShowHigherOrLowerAnswer(addOn);
  const showPrizeRange = hasValidPrizeValueRange(addOn);

  function updateQuantity(nextQuantity: number) {
    onQuantityChange(cleanQuantity(nextQuantity, addOn.maxEntriesPerBooking));
  }

  return (
    <section style={styles.panel}>
      <div style={styles.header}>
        <div style={styles.copy}>
          <p style={styles.eyebrow}>Event-night add-on</p>

          <h4 style={styles.title}>
            {addOn.title || addOnFallbackTitle(addOn.type)}
          </h4>

          {addOn.description ? (
            <p style={styles.description}>{addOn.description}</p>
          ) : (
            <p style={styles.description}>
              {addOnFallbackDescription(addOn.type)}
            </p>
          )}

          {maxEntriesPerBooking ? (
            <p style={styles.limitText}>
              Maximum {maxEntriesPerBooking} per booking.
            </p>
          ) : null}
        </div>

        <div style={styles.priceBox}>
          <span style={styles.priceLabel}>Entry</span>
          <strong style={styles.priceValue}>
            {currency} {moneyFromCents(addOn.entryPriceCents)}
          </strong>
        </div>
      </div>

      {showPrizeRange ? (
        <div style={styles.rangeBox}>
          <span style={styles.rangeLabel}>Prize value range</span>
          <strong style={styles.rangeValue}>
            {currency} {moneyFromCents(addOn.prizeValueRangeMinCents)} –{" "}
            {currency} {moneyFromCents(addOn.prizeValueRangeMaxCents)}
          </strong>
          <span style={styles.rangeHelp}>
            {cleanText(addOn.prizeValueRangeNote) ||
              "Prize values are shown to help supporters make a judgement before entering."}
          </span>
        </div>
      ) : null}

      <div style={styles.controls}>
        <button
          type="button"
          onClick={() => updateQuantity(safeQuantity - 1)}
          disabled={disabled || safeQuantity <= 0}
          style={{
            ...styles.quantityButton,
            opacity: disabled || safeQuantity <= 0 ? 0.45 : 1,
            cursor: disabled || safeQuantity <= 0 ? "not-allowed" : "pointer",
          }}
        >
          −
        </button>

        <input
          type="number"
          min="0"
          max={maxEntriesPerBooking || undefined}
          value={safeQuantity}
          disabled={disabled}
          onChange={(event) => updateQuantity(Number(event.target.value))}
          style={{
            ...styles.quantityInput,
            opacity: disabled ? 0.55 : 1,
          }}
        />

        <button
          type="button"
          onClick={() => updateQuantity(safeQuantity + 1)}
          disabled={
            disabled ||
            Boolean(maxEntriesPerBooking && safeQuantity >= maxEntriesPerBooking)
          }
          style={{
            ...styles.quantityButton,
            opacity:
              disabled ||
              Boolean(maxEntriesPerBooking && safeQuantity >= maxEntriesPerBooking)
                ? 0.45
                : 1,
            cursor:
              disabled ||
              Boolean(maxEntriesPerBooking && safeQuantity >= maxEntriesPerBooking)
                ? "not-allowed"
                : "pointer",
          }}
        >
          +
        </button>
      </div>

      {showAnswerField ? (
        <label style={styles.answerBox}>
          <span style={styles.answerLabel}>Skill question</span>

          <strong style={styles.answerQuestion}>
            {cleanText(addOn.legalQuestionText)}
          </strong>

          {cleanText(addOn.legalQuestionHelperText) ? (
            <span style={styles.answerHelp}>
              {cleanText(addOn.legalQuestionHelperText)}
            </span>
          ) : (
            <span style={styles.answerHelp}>
              Your answer will be recorded with your Higher or Lower entry.
            </span>
          )}

          <input
            value={buyerAnswer}
            disabled={disabled || safeQuantity <= 0}
            onChange={(event) => onBuyerAnswerChange?.(event.target.value)}
            placeholder={
              safeQuantity > 0
                ? "Enter your answer"
                : "Choose entries before answering"
            }
            style={{
              ...styles.answerInput,
              opacity: disabled || safeQuantity <= 0 ? 0.6 : 1,
            }}
          />
        </label>
      ) : null}

      {disabled ? (
        <p style={styles.disabledText}>
          Add-ons are disabled when a VIP or complimentary access code is used.
        </p>
      ) : null}
    </section>
  );
}

const styles: Record<string, CSSProperties> = {
  panel: {
    display: "grid",
    gap: 12,
    padding: 14,
    borderRadius: 18,
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.14)",
    color: "#ffffff",
    minWidth: 0,
  },

  header: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) auto",
    gap: 12,
    alignItems: "start",
    minWidth: 0,
  },

  copy: {
    minWidth: 0,
  },

  eyebrow: {
    margin: "0 0 5px",
    color: "#facc15",
    fontSize: 11,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.11em",
  },

  title: {
    margin: 0,
    color: "#ffffff",
    fontSize: 18,
    lineHeight: 1.1,
    fontWeight: 950,
    letterSpacing: "-0.03em",
    overflowWrap: "anywhere",
  },

  description: {
    margin: "6px 0 0",
    color: "#cbd5e1",
    fontSize: 13,
    lineHeight: 1.45,
    fontWeight: 750,
    overflowWrap: "anywhere",
  },

  limitText: {
    margin: "7px 0 0",
    color: "#fde68a",
    fontSize: 12,
    lineHeight: 1.35,
    fontWeight: 850,
  },

  priceBox: {
    display: "grid",
    gap: 3,
    justifyItems: "end",
    alignContent: "start",
    padding: "9px 10px",
    borderRadius: 14,
    background: "rgba(250,204,21,0.14)",
    border: "1px solid rgba(250,204,21,0.2)",
    minWidth: 92,
  },

  priceLabel: {
    color: "#fde68a",
    fontSize: 10,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
  },

  priceValue: {
    color: "#ffffff",
    fontSize: 15,
    lineHeight: 1.1,
    fontWeight: 950,
    whiteSpace: "nowrap",
  },

  rangeBox: {
    display: "grid",
    gap: 4,
    padding: 12,
    borderRadius: 16,
    background: "rgba(250,204,21,0.12)",
    border: "1px solid rgba(250,204,21,0.2)",
    minWidth: 0,
  },

  rangeLabel: {
    color: "#fde68a",
    fontSize: 10,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
  },

  rangeValue: {
    color: "#ffffff",
    fontSize: 15,
    lineHeight: 1.25,
    fontWeight: 950,
    overflowWrap: "anywhere",
  },

  rangeHelp: {
    color: "#e2e8f0",
    fontSize: 12,
    lineHeight: 1.4,
    fontWeight: 750,
    overflowWrap: "anywhere",
  },

  controls: {
    display: "grid",
    gridTemplateColumns: "42px minmax(60px, 1fr) 42px",
    gap: 8,
    alignItems: "center",
  },

  quantityButton: {
    width: 42,
    height: 42,
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.22)",
    background: "rgba(255,255,255,0.1)",
    color: "#ffffff",
    fontSize: 22,
    fontWeight: 950,
  },

  quantityInput: {
    width: "100%",
    height: 42,
    borderRadius: 12,
    border: "1px solid #cbd5e1",
    background: "#ffffff",
    color: "#0f172a",
    textAlign: "center",
    fontSize: 16,
    fontWeight: 950,
    boxSizing: "border-box",
  },

  answerBox: {
    display: "grid",
    gap: 7,
    padding: 13,
    borderRadius: 16,
    background: "rgba(96,165,250,0.14)",
    border: "1px solid rgba(147,197,253,0.22)",
    minWidth: 0,
  },

  answerLabel: {
    color: "#bfdbfe",
    fontSize: 10,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
  },

  answerQuestion: {
    color: "#ffffff",
    fontSize: 14,
    lineHeight: 1.35,
    fontWeight: 950,
    overflowWrap: "anywhere",
  },

  answerHelp: {
    color: "#dbeafe",
    fontSize: 12,
    lineHeight: 1.4,
    fontWeight: 750,
    overflowWrap: "anywhere",
  },

  answerInput: {
    width: "100%",
    minHeight: 42,
    padding: "10px 11px",
    borderRadius: 13,
    border: "1px solid #cbd5e1",
    background: "#ffffff",
    color: "#0f172a",
    fontSize: 15,
    boxSizing: "border-box",
    minWidth: 0,
  },

  disabledText: {
    margin: 0,
    color: "#cbd5e1",
    fontSize: 12,
    lineHeight: 1.4,
    fontWeight: 750,
  },
};
