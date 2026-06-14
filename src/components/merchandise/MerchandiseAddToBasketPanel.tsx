"use client";

import type { CSSProperties, FormEvent } from "react";
import { useState } from "react";

type BasketItem = {
  productId: string;
  productSlug: string;
  title: string;
  optionLabel: string | null;
  quantity: number;
  priceCents: number;
  currency: string;
  imageUrl: string | null;
  addedAt: string;
};

type MerchandiseAddToBasketPanelProps = {
  tenantSlug: string;
  productId: string;
  productSlug: string;
  productTitle: string;
  priceDisplay: string;
  priceCents: number;
  currency: string;
  imageUrl?: string | null;
  sizeOptions: string[];
  stockLabel: string;
  primaryColour: string;
  primaryTextColour: string;
};

function cleanText(value: unknown) {
  return String(value ?? "").trim();
}

function getBasketKey(tenantSlug: string) {
  return `so_merchandise_basket_${tenantSlug}`;
}

function readBasket(tenantSlug: string): BasketItem[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(getBasketKey(tenantSlug));
    const parsed = raw ? JSON.parse(raw) : [];

    if (!Array.isArray(parsed)) return [];

    return parsed.filter((item) => item && typeof item === "object");
  } catch {
    return [];
  }
}

function writeBasket(tenantSlug: string, items: BasketItem[]) {
  if (typeof window === "undefined") return;

  window.localStorage.setItem(getBasketKey(tenantSlug), JSON.stringify(items));
}

export default function MerchandiseAddToBasketPanel({
  tenantSlug,
  productId,
  productSlug,
  productTitle,
  priceDisplay,
  priceCents,
  currency,
  imageUrl,
  sizeOptions,
  stockLabel,
  primaryColour,
  primaryTextColour,
}: MerchandiseAddToBasketPanelProps) {
  const [quantity, setQuantity] = useState("1");
  const [optionLabel, setOptionLabel] = useState(sizeOptions[0] || "");
  const [message, setMessage] = useState("");

  function handleAddToBasket(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const parsedQuantity = Number(quantity);
    const safeQuantity =
      Number.isInteger(parsedQuantity) && parsedQuantity > 0
        ? Math.min(parsedQuantity, 20)
        : 1;

    if (sizeOptions.length > 0 && !cleanText(optionLabel)) {
      setMessage("Please choose a size or option.");
      return;
    }

    const existing = readBasket(tenantSlug);
    const selectedOption = cleanText(optionLabel) || null;

    const existingIndex = existing.findIndex(
      (item) =>
        item.productId === productId && item.optionLabel === selectedOption,
    );

    if (existingIndex >= 0) {
      const current = existing[existingIndex];
      existing[existingIndex] = {
        ...current,
        quantity: Math.min(Number(current.quantity || 0) + safeQuantity, 20),
        addedAt: new Date().toISOString(),
      };
    } else {
      existing.push({
        productId,
        productSlug,
        title: productTitle,
        optionLabel: selectedOption,
        quantity: safeQuantity,
        priceCents,
        currency,
        imageUrl: cleanText(imageUrl) || null,
        addedAt: new Date().toISOString(),
      });
    }

    writeBasket(tenantSlug, existing);

    setMessage(
      `${safeQuantity} × ${productTitle}${
        selectedOption ? ` (${selectedOption})` : ""
      } added to basket.`,
    );
  }

  return (
    <form className="merchandise-add-basket" onSubmit={handleAddToBasket}>
      <style>{responsiveStyles}</style>

      <div style={styles.formIntro}>
        <p style={{ ...styles.kicker, color: primaryColour }}>Basket</p>

        <h2 style={styles.title}>Add to basket</h2>

        <p style={styles.text}>
          Add this item now, then continue browsing before checkout is connected.
        </p>
      </div>

      <div style={styles.summaryCard}>
        <span style={styles.summaryLabel}>{productTitle}</span>
        <strong style={styles.summaryValue}>{priceDisplay}</strong>
        <span style={styles.stockText}>{stockLabel}</span>
      </div>

      <div className="basket-field-grid" style={styles.fieldGrid}>
        <label style={styles.field}>
          <span style={styles.label}>Quantity</span>
          <select
            value={quantity}
            onChange={(event) => setQuantity(event.target.value)}
            style={styles.input}
          >
            {Array.from({ length: 20 }, (_, index) => index + 1).map(
              (value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ),
            )}
          </select>
        </label>

        {sizeOptions.length ? (
          <label style={styles.field}>
            <span style={styles.label}>Size / option</span>
            <select
              value={optionLabel}
              onChange={(event) => setOptionLabel(event.target.value)}
              style={styles.input}
            >
              <option value="">Choose</option>
              {sizeOptions.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </div>

      <button
        type="submit"
        style={{
          ...styles.submitButton,
          background: primaryColour,
          borderColor: primaryColour,
          color: primaryTextColour,
        }}
      >
        Add to basket
      </button>

      {message ? <p style={styles.message}>{message}</p> : null}

      <p style={styles.bottomNote}>
        Basket review and Stripe checkout will be connected in the next phase.
      </p>
    </form>
  );
}

const responsiveStyles = `
.merchandise-add-basket,
.merchandise-add-basket * {
  box-sizing: border-box;
}

.merchandise-add-basket {
  display: grid;
  gap: 12px;
  width: 100%;
}

.merchandise-add-basket input,
.merchandise-add-basket select,
.merchandise-add-basket button {
  font: inherit;
}

@media (max-width: 680px) {
  .merchandise-add-basket .basket-field-grid {
    grid-template-columns: 1fr !important;
  }
}
`;

const styles: Record<string, CSSProperties> = {
  formIntro: {
    display: "grid",
    gap: 6,
  },

  kicker: {
    margin: 0,
    fontSize: 12,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
  },

  title: {
    margin: 0,
    color: "#0f172a",
    fontSize: 28,
    lineHeight: 1.08,
    letterSpacing: "-0.05em",
  },

  text: {
    margin: 0,
    color: "#475569",
    lineHeight: 1.45,
    fontWeight: 730,
  },

  summaryCard: {
    display: "grid",
    gap: 5,
    padding: 13,
    borderRadius: 18,
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
  },

  summaryLabel: {
    color: "#64748b",
    fontSize: 12,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.06em",
  },

  summaryValue: {
    color: "#0f172a",
    fontSize: 24,
    lineHeight: 1,
    fontWeight: 950,
  },

  stockText: {
    color: "#64748b",
    fontSize: 12,
    lineHeight: 1.35,
    fontWeight: 820,
  },

  fieldGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 10,
  },

  field: {
    display: "grid",
    gap: 6,
  },

  label: {
    color: "#475569",
    fontSize: 12,
    fontWeight: 950,
  },

  input: {
    width: "100%",
    minHeight: 46,
    padding: "10px 12px",
    borderRadius: 14,
    border: "1px solid #cbd5e1",
    background: "#ffffff",
    color: "#0f172a",
    fontWeight: 850,
    outline: "none",
  },

  submitButton: {
    width: "100%",
    minHeight: 48,
    padding: "11px 15px",
    borderRadius: 999,
    border: "1px solid",
    fontWeight: 950,
    cursor: "pointer",
    boxShadow: "0 12px 24px rgba(22,131,248,0.16)",
  },

  message: {
    margin: 0,
    padding: 12,
    borderRadius: 16,
    background: "#f0fdf4",
    color: "#166534",
    border: "1px solid #bbf7d0",
    fontSize: 13,
    lineHeight: 1.4,
    fontWeight: 850,
  },

  bottomNote: {
    margin: 0,
    color: "#64748b",
    fontSize: 12,
    lineHeight: 1.4,
    fontWeight: 730,
    textAlign: "center",
  },
};
