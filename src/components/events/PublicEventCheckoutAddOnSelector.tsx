"use client";

import type { CSSProperties } from "react";

export type PublicEventCheckoutAddOnType = "heads_or_tails" | "higher_or_lower";

export type PublicEventCheckoutAddOn = {
  type: PublicEventCheckoutAddOnType;
  title: string;
  description?: string;
  entryPriceCents: number;
  maxEntriesPerBooking?: number | null;
};

export type PublicEventCheckoutAddOnSelection = {
  type: PublicEventCheckoutAddOnType;
  quantity: number;
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

export default function PublicEventCheckoutAddOnSelector({
  addOn,
  currency,
  quantity,
  disabled = false,
  onQuantityChange,
}: {
  addOn: PublicEventCheckoutAddOn;
  currency: string;
  quantity: number;
  disabled?: boolean;
  onQuantityChange: (quantity: number) => void;
}) {
  const safeQuantity = cleanQuantity(quantity, addOn.maxEntriesPerBooking);
  const maxEntriesPerBooking =
    Number(addOn.maxEntriesPerBooking || 0) > 0
      ? Math.floor(Number(addOn.maxEntriesPerBooking || 0))
      : null;

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

      <div style={styles.quantityRow}>
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
            opacity: disabled ? 0.6 : 1,
          }}
        />

        <button
          type="button"
          onClick={() => updateQuantity(safeQuantity + 1)}
          disabled={
            disabled ||
            (maxEntriesPerBooking !== null &&
              safeQuantity >= maxEntriesPerBooking)
          }
          style={{
            ...styles.quantityButton,
            opacity:
              disabled ||
              (maxEntriesPerBooking !== null &&
                safeQuantity >= maxEntriesPerBooking)
                ? 0.45
                : 1,
            cursor:
              disabled ||
              (maxEntriesPerBooking !== null &&
                safeQuantity >= maxEntriesPerBooking)
                ? "not-allowed"
                : "pointer",
          }}
        >
          +
        </button>
      </div>

      {disabled ? (
        <p style={styles.disabledNotice}>
          Add-on entries cannot be added when using a complimentary/VIP access
          code.
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
    background: "rgba(250,204,21,0.12)",
    border: "1px solid rgba(250,204,21,0.32)",
    color: "#ffffff",
  },

  header: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) auto",
    gap: 12,
    alignItems: "start",
  },

  copy: {
    minWidth: 0,
  },

  eyebrow: {
    margin: 0,
    color: "#facc15",
    fontSize: 11,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.12em",
  },

  title: {
    margin: "5px 0 0",
    color: "#ffffff",
    fontSize: 17,
    fontWeight: 950,
    letterSpacing: "-0.02em",
    overflowWrap: "anywhere",
  },

  description: {
    margin: "6px 0 0",
    color: "#cbd5e1",
    fontSize: 13,
    lineHeight: 1.42,
    fontWeight: 750,
    overflowWrap: "anywhere",
  },

  limitText: {
    margin: "6px 0 0",
    color: "#fde68a",
    fontSize: 12,
    lineHeight: 1.35,
    fontWeight: 850,
  },

  priceBox: {
    display: "grid",
    gap: 3,
    justifyItems: "end",
    padding: "8px 10px",
    borderRadius: 14,
    background: "rgba(255,255,255,0.08)",
    border: "1px solid rgba(255,255,255,0.12)",
    minWidth: 92,
  },

  priceLabel: {
    color: "#cbd5e1",
    fontSize: 10,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
  },

  priceValue: {
    color: "#fef3c7",
    fontSize: 15,
    fontWeight: 950,
    whiteSpace: "nowrap",
  },

  quantityRow: {
    display: "grid",
    gridTemplateColumns: "42px minmax(64px, 1fr) 42px",
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
    borderRadius: 13,
    border: "1px solid #cbd5e1",
    background: "#ffffff",
    color: "#0f172a",
    textAlign: "center",
    fontSize: 16,
    fontWeight: 950,
    boxSizing: "border-box",
  },

  disabledNotice: {
    margin: 0,
    color: "#fecaca",
    fontSize: 12,
    lineHeight: 1.35,
    fontWeight: 850,
  },
};
