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

export type PublicEventCheckoutAddOnPlayer = {
  name: string;
  email: string;
};

export type PublicEventCheckoutAddOnSelection = {
  type: PublicEventCheckoutAddOnType;
  quantity: number;
  buyerAnswer?: string;
  players?: PublicEventCheckoutAddOnPlayer[];
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

function shouldShowHigherOrLowerPlayers(addOn: PublicEventCheckoutAddOn) {
  return addOn.type === "higher_or_lower";
}

function normalisePlayerRows(input: {
  quantity: number;
  players?: PublicEventCheckoutAddOnPlayer[];
  buyerName?: string;
  buyerEmail?: string;
}) {
  const quantity = Math.max(0, Math.floor(Number(input.quantity || 0)));
  const existingPlayers = Array.isArray(input.players) ? input.players : [];

  return Array.from({ length: quantity }).map((_, index) => {
    const existing = existingPlayers[index];

    if (existing) {
      return {
        name: cleanText(existing.name),
        email: cleanText(existing.email),
      };
    }

    if (index === 0) {
      return {
  name: String(existing.name || ""),
  email: String(existing.email || ""),
};

    return {
      name: "",
      email: "",
    };
  });
}

export default function PublicEventCheckoutAddOnSelector({
  addOn,
  currency,
  quantity,
  disabled = false,
  buyerAnswer = "",
  buyerName = "",
  buyerEmail = "",
  players = [],
  onQuantityChange,
  onBuyerAnswerChange,
  onPlayersChange,
}: {
  addOn: PublicEventCheckoutAddOn;
  currency: string;
  quantity: number;
  disabled?: boolean;
  buyerAnswer?: string;
  buyerName?: string;
  buyerEmail?: string;
  players?: PublicEventCheckoutAddOnPlayer[];
  onQuantityChange: (quantity: number) => void;
  onBuyerAnswerChange?: (answer: string) => void;
  onPlayersChange?: (players: PublicEventCheckoutAddOnPlayer[]) => void;
}) {
  const safeQuantity = cleanQuantity(quantity, addOn.maxEntriesPerBooking);
  const maxEntriesPerBooking =
    Number(addOn.maxEntriesPerBooking || 0) > 0
      ? Math.floor(Number(addOn.maxEntriesPerBooking || 0))
      : null;

  const showAnswerField = shouldShowHigherOrLowerAnswer(addOn);
  const showPrizeRange = hasValidPrizeValueRange(addOn);
  const showPlayerRows =
    shouldShowHigherOrLowerPlayers(addOn) && safeQuantity > 0;

  const normalisedPlayers = normalisePlayerRows({
    quantity: safeQuantity,
    players,
    buyerName,
    buyerEmail,
  });

  function updateQuantity(nextQuantity: number) {
    const cleanNextQuantity = cleanQuantity(
      nextQuantity,
      addOn.maxEntriesPerBooking,
    );

    onQuantityChange(cleanNextQuantity);

    if (addOn.type === "higher_or_lower") {
      const nextPlayers = normalisePlayerRows({
        quantity: cleanNextQuantity,
        players: normalisedPlayers,
        buyerName,
        buyerEmail,
      });

      onPlayersChange?.(nextPlayers);
    }
  }

  function updatePlayer(
    index: number,
    patch: Partial<PublicEventCheckoutAddOnPlayer>,
  ) {
    const nextPlayers = normalisePlayerRows({
      quantity: safeQuantity,
      players: normalisedPlayers,
      buyerName,
      buyerEmail,
    }).map((player, currentIndex) =>
      currentIndex === index
        ? {
            ...player,
            ...patch,
          }
        : player,
    );

    onPlayersChange?.(nextPlayers);
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

      {showPlayerRows ? (
        <div style={styles.playersBox}>
          <div style={styles.playersHeader}>
            <span style={styles.playersLabel}>Player details</span>
            <span style={styles.playersCount}>
              {safeQuantity} player{safeQuantity === 1 ? "" : "s"}
            </span>
          </div>

          <p style={styles.playersHelp}>
            Add the name and email for each person playing Higher or Lower. If
            you are buying for several people, each player can receive their own
            game entry.
          </p>

          <div style={styles.playersList}>
            {normalisedPlayers.map((player, index) => (
              <div key={`higher-or-lower-player-${index}`} style={styles.playerRow}>
                <div style={styles.playerNumber}>Player {index + 1}</div>

                <label style={styles.playerField}>
                  <span style={styles.playerFieldLabel}>Name</span>
                  <input
                    value={player.name}
                    disabled={disabled}
                    onChange={(event) =>
                      updatePlayer(index, {
                        name: event.target.value,
                      })
                    }
                    placeholder={
                      index === 0 && cleanText(buyerName)
                        ? cleanText(buyerName)
                        : "Player name"
                    }
                    style={{
                      ...styles.playerInput,
                      opacity: disabled ? 0.6 : 1,
                    }}
                  />
                </label>

                <label style={styles.playerField}>
                  <span style={styles.playerFieldLabel}>Email</span>
                  <input
                    value={player.email}
                    disabled={disabled}
                    type="email"
                    onChange={(event) =>
                      updatePlayer(index, {
                        email: event.target.value,
                      })
                    }
                    placeholder={
                      index === 0 && cleanText(buyerEmail)
                        ? cleanText(buyerEmail)
                        : "player@example.com"
                    }
                    style={{
                      ...styles.playerInput,
                      opacity: disabled ? 0.6 : 1,
                    }}
                  />
                </label>
              </div>
            ))}
          </div>
        </div>
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

  playersBox: {
    display: "grid",
    gap: 10,
    padding: 13,
    borderRadius: 16,
    background: "rgba(15,23,42,0.38)",
    border: "1px solid rgba(250,204,21,0.22)",
    minWidth: 0,
  },

  playersHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: 10,
    flexWrap: "wrap",
    alignItems: "center",
  },

  playersLabel: {
    color: "#fef3c7",
    fontSize: 10,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
  },

  playersCount: {
    display: "inline-flex",
    width: "fit-content",
    padding: "5px 8px",
    borderRadius: 999,
    background: "rgba(250,204,21,0.14)",
    border: "1px solid rgba(250,204,21,0.22)",
    color: "#fde68a",
    fontSize: 11,
    fontWeight: 950,
  },

  playersHelp: {
    margin: 0,
    color: "#dbeafe",
    fontSize: 12,
    lineHeight: 1.45,
    fontWeight: 750,
    overflowWrap: "anywhere",
  },

  playersList: {
    display: "grid",
    gap: 10,
  },

  playerRow: {
    display: "grid",
    gap: 8,
    padding: 11,
    borderRadius: 14,
    background: "rgba(255,255,255,0.07)",
    border: "1px solid rgba(255,255,255,0.12)",
    minWidth: 0,
  },

  playerNumber: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: 950,
  },

  playerField: {
    display: "grid",
    gap: 5,
    minWidth: 0,
  },

  playerFieldLabel: {
    color: "#cbd5e1",
    fontSize: 11,
    fontWeight: 900,
  },

  playerInput: {
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
