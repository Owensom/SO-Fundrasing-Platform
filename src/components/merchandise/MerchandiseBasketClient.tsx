"use client";

import type { CSSProperties } from "react";
import { useEffect, useMemo, useState } from "react";

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

type MerchandiseBasketClientProps = {
  tenantSlug: string;
  shopHref: string;
  primaryColour: string;
  primaryTextColour: string;
};

type BasketValidationResult = {
  ok?: boolean;
  error?: string;
  errors?: string[];
  message?: string;
  basket?: {
    tenantSlug?: string;
    itemCount?: number;
    currency?: string;
    subtotalCents?: number;
    lines?: Array<{
      productId: string;
      productSlug: string;
      title: string;
      optionLabel: string | null;
      quantity: number;
      currency: string;
      unitPriceCents: number;
      lineTotalCents: number;
      remainingStock: number | null;
      eventLinked: boolean;
      linkedEventId: string | null;
      requiredDetails: {
        bookingReference: boolean;
        tableNumber: boolean;
        seatNumber: boolean;
        guestName: boolean;
      };
      fulfilmentMethods: string[];
    }>;
  };
};

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

function formatMoney(cents: number, currency = "GBP") {
  try {
    return new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency: currency || "GBP",
    }).format(Number(cents || 0) / 100);
  } catch {
    return `£${(Number(cents || 0) / 100).toFixed(2)}`;
  }
}

function getValidationPayloadItems(items: BasketItem[]) {
  return items.map((item) => ({
    productId: item.productId,
    productSlug: item.productSlug,
    optionLabel: item.optionLabel,
    quantity: item.quantity,
  }));
}

export default function MerchandiseBasketClient({
  tenantSlug,
  shopHref,
  primaryColour,
  primaryTextColour,
}: MerchandiseBasketClientProps) {
  const [items, setItems] = useState<BasketItem[]>([]);
  const [isValidating, setIsValidating] = useState(false);
  const [validationResult, setValidationResult] =
    useState<BasketValidationResult | null>(null);

  useEffect(() => {
    setItems(readBasket(tenantSlug));
  }, [tenantSlug]);

  const basketSummary = useMemo(() => {
    const quantity = items.reduce(
      (total, item) => total + Number(item.quantity || 0),
      0,
    );

    const subtotalCents = items.reduce(
      (total, item) =>
        total + Number(item.priceCents || 0) * Number(item.quantity || 0),
      0,
    );

    const currency = items[0]?.currency || "GBP";

    return {
      quantity,
      subtotalCents,
      currency,
    };
  }, [items]);

  function updateItems(nextItems: BasketItem[]) {
    setItems(nextItems);
    setValidationResult(null);
    writeBasket(tenantSlug, nextItems);
  }

  function updateQuantity(index: number, quantity: number) {
    const safeQuantity = Math.max(1, Math.min(quantity, 20));

    updateItems(
      items.map((item, itemIndex) =>
        itemIndex === index ? { ...item, quantity: safeQuantity } : item,
      ),
    );
  }

  function removeItem(index: number) {
    updateItems(items.filter((_, itemIndex) => itemIndex !== index));
  }

  function clearBasket() {
    updateItems([]);
  }

  async function validateBasket() {
    setIsValidating(true);
    setValidationResult(null);

    try {
      const response = await fetch("/api/merchandise/basket/validate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          tenantSlug,
          items: getValidationPayloadItems(items),
        }),
      });

      const json = (await response.json()) as BasketValidationResult;
      setValidationResult(json);
    } catch {
      setValidationResult({
        ok: false,
        error:
          "We could not validate the basket. Please refresh the page and try again.",
      });
    } finally {
      setIsValidating(false);
    }
  }

  if (items.length === 0) {
    return (
      <section style={styles.emptyPanel}>
        <div style={styles.emptyIcon}>🛍️</div>

        <h2 style={styles.emptyTitle}>Your basket is empty</h2>

        <p style={styles.emptyText}>
          Add merchandise items from the shop, then return here to review them
          together before checkout is connected.
        </p>

        <a
          href={shopHref}
          style={{
            ...styles.primaryButton,
            background: primaryColour,
            borderColor: primaryColour,
            color: primaryTextColour,
          }}
        >
          Continue shopping →
        </a>
      </section>
    );
  }

  return (
    <section className="merchandise-basket-client" style={styles.wrapper}>
      <style>{responsiveStyles}</style>

      <div className="basket-layout" style={styles.layout}>
        <div style={styles.itemsPanel}>
          <div style={styles.panelHeader}>
            <div>
              <p style={{ ...styles.kicker, color: primaryColour }}>
                Basket items
              </p>

              <h2 style={styles.sectionTitle}>
                {basketSummary.quantity}{" "}
                {basketSummary.quantity === 1 ? "item" : "items"}
              </h2>
            </div>

            <button type="button" onClick={clearBasket} style={styles.clearBtn}>
              Clear basket
            </button>
          </div>

          <div style={styles.itemList}>
            {items.map((item, index) => (
              <article
                key={`${item.productId}-${item.optionLabel || "none"}-${index}`}
                className="basket-item"
                style={styles.itemCard}
              >
                <a
                  href={`/m/${tenantSlug}/${encodeURIComponent(
                    item.productSlug,
                  )}`}
                  style={styles.itemImageWrap}
                >
                  {item.imageUrl ? (
                    <img
                      src={item.imageUrl}
                      alt=""
                      aria-hidden="true"
                      style={styles.itemImage}
                    />
                  ) : (
                    <span style={styles.itemFallback}>M</span>
                  )}
                </a>

                <div style={styles.itemCopy}>
                  <h3 style={styles.itemTitle}>{item.title}</h3>

                  {item.optionLabel ? (
                    <p style={styles.itemMeta}>Option: {item.optionLabel}</p>
                  ) : (
                    <p style={styles.itemMeta}>No option selected</p>
                  )}

                  <p style={styles.itemMeta}>
                    {formatMoney(item.priceCents, item.currency)} each
                  </p>
                </div>

                <div className="basket-item-actions" style={styles.itemActions}>
                  <label style={styles.qtyField}>
                    <span style={styles.qtyLabel}>Qty</span>
                    <select
                      value={String(item.quantity || 1)}
                      onChange={(event) =>
                        updateQuantity(index, Number(event.target.value))
                      }
                      style={styles.qtyInput}
                    >
                      {Array.from(
                        { length: 20 },
                        (_, itemIndex) => itemIndex + 1,
                      ).map((value) => (
                        <option key={value} value={value}>
                          {value}
                        </option>
                      ))}
                    </select>
                  </label>

                  <strong style={styles.lineTotal}>
                    {formatMoney(
                      Number(item.priceCents || 0) * Number(item.quantity || 0),
                      item.currency,
                    )}
                  </strong>

                  <button
                    type="button"
                    onClick={() => removeItem(index)}
                    style={styles.removeButton}
                  >
                    Remove
                  </button>
                </div>
              </article>
            ))}
          </div>
        </div>

        <aside style={styles.summaryPanel}>
          <p style={{ ...styles.kicker, color: primaryColour }}>
            Basket summary
          </p>

          <h2 style={styles.summaryTitle}>Review basket</h2>

          <div style={styles.summaryRows}>
            <div style={styles.summaryRow}>
              <span>Items</span>
              <strong>{basketSummary.quantity}</strong>
            </div>

            <div style={styles.summaryRow}>
              <span>Subtotal</span>
              <strong>
                {formatMoney(
                  basketSummary.subtotalCents,
                  basketSummary.currency,
                )}
              </strong>
            </div>
          </div>

          {validationResult ? (
            <div
              style={{
                ...styles.validationPanel,
                ...(validationResult.ok
                  ? styles.validationGood
                  : styles.validationBad),
              }}
            >
              <strong style={styles.validationTitle}>
                {validationResult.ok ? "Basket validated" : "Please check basket"}
              </strong>

              <span style={styles.validationText}>
                {validationResult.ok
                  ? validationResult.message ||
                    "Basket is valid and ready for the next checkout phase."
                  : validationResult.error || "Something needs to be corrected."}
              </span>

              {validationResult.ok && validationResult.basket ? (
                <span style={styles.validationMeta}>
                  Server subtotal:{" "}
                  {formatMoney(
                    validationResult.basket.subtotalCents || 0,
                    validationResult.basket.currency || basketSummary.currency,
                  )}
                </span>
              ) : null}
            </div>
          ) : (
            <div style={styles.checkoutNotice}>
              <strong>Validate before checkout</strong>
              <span>
                This checks live product status, stock, price, options and
                tenant rules before we connect Stripe.
              </span>
            </div>
          )}

          <button
            type="button"
            onClick={validateBasket}
            disabled={isValidating}
            style={{
              ...styles.validateButton,
              background: primaryColour,
              borderColor: primaryColour,
              color: primaryTextColour,
              opacity: isValidating ? 0.72 : 1,
            }}
          >
            {isValidating ? "Validating basket..." : "Validate basket"}
          </button>

          <button type="button" disabled style={styles.disabledButton}>
            Checkout not connected yet
          </button>

          <a
            href={shopHref}
            style={{
              ...styles.primaryButton,
              background: "#ffffff",
              borderColor: "#cbd5e1",
              color: "#0f172a",
            }}
          >
            Continue shopping →
          </a>
        </aside>
      </div>
    </section>
  );
}

const responsiveStyles = `
.merchandise-basket-client,
.merchandise-basket-client * {
  box-sizing: border-box;
}

@media (max-width: 900px) {
  .merchandise-basket-client .basket-layout {
    grid-template-columns: 1fr !important;
  }
}

@media (max-width: 640px) {
  .merchandise-basket-client .basket-item {
    grid-template-columns: 1fr !important;
  }

  .merchandise-basket-client .basket-item-actions {
    align-items: stretch !important;
  }
}
`;

const styles: Record<string, CSSProperties> = {
  wrapper: {
    width: "100%",
  },

  layout: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) minmax(280px, 0.42fr)",
    gap: 16,
  },

  itemsPanel: {
    display: "grid",
    gap: 14,
    padding: 18,
    borderRadius: 28,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    boxShadow: "0 10px 30px rgba(15,23,42,0.05)",
  },

  panelHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
    flexWrap: "wrap",
  },

  kicker: {
    margin: 0,
    fontSize: 12,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
  },

  sectionTitle: {
    margin: "4px 0 0",
    color: "#0f172a",
    fontSize: 30,
    lineHeight: 1.05,
    letterSpacing: "-0.05em",
  },

  clearBtn: {
    minHeight: 40,
    padding: "9px 12px",
    borderRadius: 999,
    background: "#ffffff",
    color: "#991b1b",
    border: "1px solid #fecaca",
    fontWeight: 950,
    cursor: "pointer",
  },

  itemList: {
    display: "grid",
    gap: 10,
  },

  itemCard: {
    display: "grid",
    gridTemplateColumns: "92px minmax(0, 1fr) auto",
    gap: 12,
    alignItems: "center",
    padding: 12,
    borderRadius: 22,
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
  },

  itemImageWrap: {
    display: "grid",
    placeItems: "center",
    width: 92,
    height: 92,
    borderRadius: 18,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    overflow: "hidden",
    textDecoration: "none",
  },

  itemImage: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
  },

  itemFallback: {
    color: "#0f172a",
    fontSize: 22,
    fontWeight: 950,
  },

  itemCopy: {
    display: "grid",
    gap: 4,
  },

  itemTitle: {
    margin: 0,
    color: "#0f172a",
    fontSize: 20,
    lineHeight: 1.1,
    letterSpacing: "-0.035em",
  },

  itemMeta: {
    margin: 0,
    color: "#64748b",
    fontSize: 13,
    lineHeight: 1.35,
    fontWeight: 760,
  },

  itemActions: {
    display: "grid",
    gap: 8,
    justifyItems: "end",
  },

  qtyField: {
    display: "grid",
    gap: 4,
  },

  qtyLabel: {
    color: "#64748b",
    fontSize: 11,
    fontWeight: 950,
  },

  qtyInput: {
    minHeight: 38,
    padding: "8px 10px",
    borderRadius: 12,
    border: "1px solid #cbd5e1",
    background: "#ffffff",
    color: "#0f172a",
    fontWeight: 900,
  },

  lineTotal: {
    color: "#0f172a",
    fontSize: 18,
    fontWeight: 950,
  },

  removeButton: {
    minHeight: 36,
    padding: "8px 11px",
    borderRadius: 999,
    background: "#ffffff",
    color: "#991b1b",
    border: "1px solid #fecaca",
    fontSize: 12,
    fontWeight: 950,
    cursor: "pointer",
  },

  summaryPanel: {
    display: "grid",
    gap: 13,
    alignContent: "start",
    padding: 18,
    borderRadius: 28,
    background:
      "linear-gradient(135deg, rgba(255,255,255,1), rgba(239,246,255,0.9))",
    border: "1px solid #bfdbfe",
    boxShadow: "0 10px 30px rgba(22,131,248,0.08)",
  },

  summaryTitle: {
    margin: 0,
    color: "#0f172a",
    fontSize: 28,
    lineHeight: 1.08,
    letterSpacing: "-0.05em",
  },

  summaryRows: {
    display: "grid",
    gap: 8,
    padding: 13,
    borderRadius: 18,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
  },

  summaryRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: 10,
    color: "#475569",
    fontWeight: 850,
  },

  checkoutNotice: {
    display: "grid",
    gap: 5,
    padding: 13,
    borderRadius: 18,
    background: "#fffbeb",
    color: "#92400e",
    border: "1px solid #fde68a",
    fontSize: 13,
    lineHeight: 1.4,
    fontWeight: 760,
  },

  validationPanel: {
    display: "grid",
    gap: 5,
    padding: 13,
    borderRadius: 18,
    border: "1px solid",
    fontSize: 13,
    lineHeight: 1.4,
    fontWeight: 760,
  },

  validationGood: {
    background: "#f0fdf4",
    color: "#166534",
    borderColor: "#bbf7d0",
  },

  validationBad: {
    background: "#fef2f2",
    color: "#991b1b",
    borderColor: "#fecaca",
  },

  validationTitle: {
    color: "inherit",
    fontSize: 14,
    fontWeight: 950,
  },

  validationText: {
    color: "inherit",
  },

  validationMeta: {
    color: "inherit",
    fontWeight: 950,
  },

  validateButton: {
    width: "100%",
    minHeight: 48,
    padding: "11px 15px",
    borderRadius: 999,
    border: "1px solid",
    fontWeight: 950,
    cursor: "pointer",
    boxShadow: "0 12px 24px rgba(22,131,248,0.16)",
  },

  disabledButton: {
    width: "100%",
    minHeight: 48,
    padding: "11px 15px",
    borderRadius: 999,
    background: "#e2e8f0",
    color: "#64748b",
    border: "1px solid #cbd5e1",
    fontWeight: 950,
    cursor: "not-allowed",
  },

  primaryButton: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    minHeight: 48,
    padding: "11px 15px",
    borderRadius: 999,
    border: "1px solid",
    textDecoration: "none",
    fontWeight: 950,
    textAlign: "center",
  },

  emptyPanel: {
    display: "grid",
    justifyItems: "center",
    gap: 12,
    width: "100%",
    padding: 28,
    borderRadius: 28,
    background: "#ffffff",
    border: "1px dashed #cbd5e1",
    textAlign: "center",
  },

  emptyIcon: {
    display: "grid",
    placeItems: "center",
    width: 58,
    height: 58,
    borderRadius: 20,
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    fontSize: 26,
  },

  emptyTitle: {
    margin: 0,
    color: "#0f172a",
    fontSize: 30,
    lineHeight: 1.05,
    letterSpacing: "-0.05em",
  },

  emptyText: {
    margin: 0,
    maxWidth: 560,
    color: "#64748b",
    lineHeight: 1.5,
    fontWeight: 760,
  },
};
