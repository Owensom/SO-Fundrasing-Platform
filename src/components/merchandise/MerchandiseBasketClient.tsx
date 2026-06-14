"use client";

import type { CSSProperties, FormEvent } from "react";
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

type ValidatedBasketLine = {
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
    lines?: ValidatedBasketLine[];
  };
};

type PendingOrderResult = {
  ok?: boolean;
  error?: string;
  errors?: string[];
  message?: string;
  order?: {
    id: string;
    orderReference: string;
    status: string;
    subtotalCents: number;
    totalCents: number;
    currency: string;
    itemCount: number;
  };
};

type BuyerDetails = {
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  customerNote: string;
};

type LineFulfilmentDetails = {
  fulfilmentMethod: string;
  bookingReference: string;
  tableNumber: string;
  seatNumber: string;
  guestName: string;
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

function cleanText(value: unknown) {
  return String(value ?? "").trim();
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

function getLineKey(line: ValidatedBasketLine) {
  return `${line.productId}::${line.optionLabel || "__no_option__"}`;
}

function formatFulfilmentMethod(method: string) {
  if (method === "collect_stand") return "Collect from merchandise stand";
  if (method === "collect_table") return "Collect from table";
  if (method === "deliver_table") return "Deliver to table";
  if (method === "deliver_seat") return "Deliver to seat";
  if (method === "post_after_event") return "Post after event";
  if (method === "arrange_with_organiser") return "Arrange with organiser";

  return method;
}

function getInitialLineDetails(lines: ValidatedBasketLine[]) {
  const details: Record<string, LineFulfilmentDetails> = {};

  for (const line of lines) {
    const key = getLineKey(line);

    details[key] = {
      fulfilmentMethod: line.fulfilmentMethods[0] || "arrange_with_organiser",
      bookingReference: "",
      tableNumber: "",
      seatNumber: "",
      guestName: "",
    };
  }

  return details;
}

export default function MerchandiseBasketClient({
  tenantSlug,
  shopHref,
  primaryColour,
  primaryTextColour,
}: MerchandiseBasketClientProps) {
  const [items, setItems] = useState<BasketItem[]>([]);
  const [isValidating, setIsValidating] = useState(false);
  const [isCreatingOrder, setIsCreatingOrder] = useState(false);
  const [validationResult, setValidationResult] =
    useState<BasketValidationResult | null>(null);
  const [orderResult, setOrderResult] = useState<PendingOrderResult | null>(
    null,
  );

  const [buyerDetails, setBuyerDetails] = useState<BuyerDetails>({
    customerName: "",
    customerEmail: "",
    customerPhone: "",
    customerNote: "",
  });

  const [lineDetails, setLineDetails] = useState<
    Record<string, LineFulfilmentDetails>
  >({});

  const [detailsMessage, setDetailsMessage] = useState<{
    tone: "good" | "bad";
    text: string;
  } | null>(null);

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

  const validatedLines = validationResult?.ok
    ? validationResult.basket?.lines || []
    : [];

  const hasValidatedBasket = validationResult?.ok && validatedLines.length > 0;

  function resetOrderState() {
    setOrderResult(null);
    setDetailsMessage(null);
  }

  function updateItems(nextItems: BasketItem[]) {
    setItems(nextItems);
    setValidationResult(null);
    setLineDetails({});
    resetOrderState();
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

  function updateBuyerField(field: keyof BuyerDetails, value: string) {
    setBuyerDetails((current) => ({
      ...current,
      [field]: value,
    }));
    resetOrderState();
  }

  function updateLineField(
    lineKey: string,
    field: keyof LineFulfilmentDetails,
    value: string,
  ) {
    setLineDetails((current) => ({
      ...current,
      [lineKey]: {
        ...(current[lineKey] || {
          fulfilmentMethod: "arrange_with_organiser",
          bookingReference: "",
          tableNumber: "",
          seatNumber: "",
          guestName: "",
        }),
        [field]: value,
      },
    }));
    resetOrderState();
  }

  async function validateBasket() {
    setIsValidating(true);
    setValidationResult(null);
    setLineDetails({});
    setOrderResult(null);
    setDetailsMessage(null);

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

      if (json.ok && json.basket?.lines) {
        setLineDetails(getInitialLineDetails(json.basket.lines));
      }
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

  function getDetailsError() {
    const customerName = cleanText(buyerDetails.customerName);
    const customerEmail = cleanText(buyerDetails.customerEmail);

    if (!hasValidatedBasket) {
      return "Please validate your basket first.";
    }

    if (!customerName) {
      return "Please enter your name.";
    }

    if (!customerEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail)) {
      return "Please enter a valid email address.";
    }

    for (const line of validatedLines) {
      const key = getLineKey(line);
      const details = lineDetails[key];

      if (!details?.fulfilmentMethod) {
        return `Please choose fulfilment for ${line.title}.`;
      }

      if (
        line.fulfilmentMethods.length > 0 &&
        !line.fulfilmentMethods.includes(details.fulfilmentMethod)
      ) {
        return `Please choose a valid fulfilment option for ${line.title}.`;
      }

      if (
        line.requiredDetails.bookingReference &&
        !cleanText(details.bookingReference)
      ) {
        return `Please enter the booking reference for ${line.title}.`;
      }

      if (line.requiredDetails.tableNumber && !cleanText(details.tableNumber)) {
        return `Please enter the table number for ${line.title}.`;
      }

      if (line.requiredDetails.seatNumber && !cleanText(details.seatNumber)) {
        return `Please enter the seat number for ${line.title}.`;
      }

      if (line.requiredDetails.guestName && !cleanText(details.guestName)) {
        return `Please enter the guest name for ${line.title}.`;
      }
    }

    return "";
  }

  function checkDetailsReady(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const error = getDetailsError();

    if (error) {
      setDetailsMessage({
        tone: "bad",
        text: error,
      });
      return;
    }

    setDetailsMessage({
      tone: "good",
      text:
        "Buyer and fulfilment details are ready. You can now create a pending merchandise order.",
    });
  }

  async function createPendingOrder() {
    const error = getDetailsError();

    if (error) {
      setDetailsMessage({
        tone: "bad",
        text: error,
      });
      return;
    }

    setIsCreatingOrder(true);
    setOrderResult(null);

    try {
      const response = await fetch("/api/merchandise/orders/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          tenantSlug,
          items: getValidationPayloadItems(items),
          buyerDetails,
          lineDetails,
        }),
      });

      const json = (await response.json()) as PendingOrderResult;
      setOrderResult(json);

      if (json.ok) {
        setDetailsMessage({
          tone: "good",
          text:
            "Pending order created. Stripe checkout will be connected in the next controlled phase.",
        });
      } else {
        setDetailsMessage({
          tone: "bad",
          text:
            json.error ||
            "The pending merchandise order could not be created.",
        });
      }
    } catch {
      setOrderResult({
        ok: false,
        error:
          "We could not create the pending order. Please refresh the page and try again.",
      });

      setDetailsMessage({
        tone: "bad",
        text:
          "We could not create the pending order. Please refresh the page and try again.",
      });
    } finally {
      setIsCreatingOrder(false);
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
                tenant rules before we collect buyer details.
              </span>
            </div>
          )}

          <button
            type="button"
            onClick={validateBasket}
            disabled={isValidating || Boolean(orderResult?.ok)}
            style={{
              ...styles.validateButton,
              background: primaryColour,
              borderColor: primaryColour,
              color: primaryTextColour,
              opacity: isValidating || orderResult?.ok ? 0.72 : 1,
            }}
          >
            {isValidating ? "Validating basket..." : "Validate basket"}
          </button>

          <button type="button" disabled style={styles.disabledButton}>
            Stripe checkout not connected yet
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

      {hasValidatedBasket ? (
        <form
          className="basket-details-form"
          style={styles.detailsPanel}
          onSubmit={checkDetailsReady}
        >
          <div style={styles.detailsHeader}>
            <div>
              <p style={{ ...styles.kicker, color: primaryColour }}>
                Buyer and fulfilment
              </p>

              <h2 style={styles.detailsTitle}>Add checkout details</h2>

              <p style={styles.detailsIntro}>
                These details are used to create a pending merchandise order
                before Stripe checkout is connected.
              </p>
            </div>
          </div>

          <div className="details-grid" style={styles.detailsGrid}>
            <label style={styles.field}>
              <span style={styles.fieldLabel}>Your name</span>
              <input
                type="text"
                value={buyerDetails.customerName}
                onChange={(event) =>
                  updateBuyerField("customerName", event.target.value)
                }
                style={styles.input}
                autoComplete="name"
              />
            </label>

            <label style={styles.field}>
              <span style={styles.fieldLabel}>Email address</span>
              <input
                type="email"
                value={buyerDetails.customerEmail}
                onChange={(event) =>
                  updateBuyerField("customerEmail", event.target.value)
                }
                style={styles.input}
                autoComplete="email"
              />
            </label>

            <label style={styles.field}>
              <span style={styles.fieldLabel}>Phone optional</span>
              <input
                type="tel"
                value={buyerDetails.customerPhone}
                onChange={(event) =>
                  updateBuyerField("customerPhone", event.target.value)
                }
                style={styles.input}
                autoComplete="tel"
              />
            </label>
          </div>

          <div style={styles.fulfilmentLineList}>
            {validatedLines.map((line) => {
              const lineKey = getLineKey(line);
              const details = lineDetails[lineKey] || {
                fulfilmentMethod:
                  line.fulfilmentMethods[0] || "arrange_with_organiser",
                bookingReference: "",
                tableNumber: "",
                seatNumber: "",
                guestName: "",
              };

              const requiresAnyDetails =
                line.requiredDetails.bookingReference ||
                line.requiredDetails.tableNumber ||
                line.requiredDetails.seatNumber ||
                line.requiredDetails.guestName;

              return (
                <article key={lineKey} style={styles.fulfilmentLineCard}>
                  <div>
                    <h3 style={styles.fulfilmentLineTitle}>{line.title}</h3>

                    <p style={styles.fulfilmentLineMeta}>
                      {line.quantity} ×{" "}
                      {formatMoney(line.unitPriceCents, line.currency)}
                      {line.optionLabel ? ` · ${line.optionLabel}` : ""}
                    </p>
                  </div>

                  <label style={styles.field}>
                    <span style={styles.fieldLabel}>Fulfilment option</span>
                    <select
                      value={details.fulfilmentMethod}
                      onChange={(event) =>
                        updateLineField(
                          lineKey,
                          "fulfilmentMethod",
                          event.target.value,
                        )
                      }
                      style={styles.input}
                    >
                      {line.fulfilmentMethods.map((method) => (
                        <option key={method} value={method}>
                          {formatFulfilmentMethod(method)}
                        </option>
                      ))}
                    </select>
                  </label>

                  {requiresAnyDetails ? (
                    <div className="line-detail-grid" style={styles.lineDetailGrid}>
                      {line.requiredDetails.bookingReference ? (
                        <label style={styles.field}>
                          <span style={styles.fieldLabel}>
                            Booking reference
                          </span>
                          <input
                            type="text"
                            value={details.bookingReference}
                            onChange={(event) =>
                              updateLineField(
                                lineKey,
                                "bookingReference",
                                event.target.value,
                              )
                            }
                            style={styles.input}
                          />
                        </label>
                      ) : null}

                      {line.requiredDetails.tableNumber ? (
                        <label style={styles.field}>
                          <span style={styles.fieldLabel}>Table number</span>
                          <input
                            type="text"
                            value={details.tableNumber}
                            onChange={(event) =>
                              updateLineField(
                                lineKey,
                                "tableNumber",
                                event.target.value,
                              )
                            }
                            style={styles.input}
                          />
                        </label>
                      ) : null}

                      {line.requiredDetails.seatNumber ? (
                        <label style={styles.field}>
                          <span style={styles.fieldLabel}>Seat number</span>
                          <input
                            type="text"
                            value={details.seatNumber}
                            onChange={(event) =>
                              updateLineField(
                                lineKey,
                                "seatNumber",
                                event.target.value,
                              )
                            }
                            style={styles.input}
                          />
                        </label>
                      ) : null}

                      {line.requiredDetails.guestName ? (
                        <label style={styles.field}>
                          <span style={styles.fieldLabel}>Guest name</span>
                          <input
                            type="text"
                            value={details.guestName}
                            onChange={(event) =>
                              updateLineField(
                                lineKey,
                                "guestName",
                                event.target.value,
                              )
                            }
                            style={styles.input}
                          />
                        </label>
                      ) : null}
                    </div>
                  ) : (
                    <p style={styles.noExtraDetailsText}>
                      No extra event details are required for this item.
                    </p>
                  )}
                </article>
              );
            })}
          </div>

          <label style={styles.field}>
            <span style={styles.fieldLabel}>Note for organiser optional</span>
            <textarea
              value={buyerDetails.customerNote}
              onChange={(event) =>
                updateBuyerField("customerNote", event.target.value)
              }
              style={styles.textarea}
              rows={4}
              placeholder="Add any helpful collection, delivery or merchandise note."
            />
          </label>

          {detailsMessage ? (
            <div
              style={{
                ...styles.detailsMessage,
                ...(detailsMessage.tone === "good"
                  ? styles.detailsMessageGood
                  : styles.detailsMessageBad),
              }}
            >
              {detailsMessage.text}
            </div>
          ) : null}

          {orderResult ? (
            <div
              style={{
                ...styles.orderResultPanel,
                ...(orderResult.ok
                  ? styles.orderResultGood
                  : styles.orderResultBad),
              }}
            >
              <strong style={styles.orderResultTitle}>
                {orderResult.ok ? "Pending order created" : "Order not created"}
              </strong>

              <span style={styles.orderResultText}>
                {orderResult.ok
                  ? orderResult.message ||
                    "Pending merchandise order created."
                  : orderResult.error ||
                    "The pending merchandise order could not be created."}
              </span>

              {orderResult.ok && orderResult.order ? (
                <span style={styles.orderReference}>
                  Reference: {orderResult.order.orderReference}
                </span>
              ) : null}
            </div>
          ) : null}

          <div style={styles.detailsActions}>
            <button
              type="submit"
              style={{
                ...styles.secondaryActionButton,
                borderColor: primaryColour,
                color: primaryColour,
              }}
            >
              Check checkout details
            </button>

            <button
              type="button"
              onClick={createPendingOrder}
              disabled={isCreatingOrder || Boolean(orderResult?.ok)}
              style={{
                ...styles.validateButton,
                background: primaryColour,
                borderColor: primaryColour,
                color: primaryTextColour,
                opacity: isCreatingOrder || orderResult?.ok ? 0.72 : 1,
              }}
            >
              {isCreatingOrder
                ? "Creating pending order..."
                : orderResult?.ok
                  ? "Pending order created"
                  : "Create pending order"}
            </button>

            <button type="button" disabled style={styles.disabledButton}>
              Stripe checkout not connected yet
            </button>
          </div>
        </form>
      ) : null}
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

@media (max-width: 700px) {
  .merchandise-basket-client .details-grid,
  .merchandise-basket-client .line-detail-grid {
    grid-template-columns: 1fr !important;
  }
}

@media (max-width: 640px) {
  .merchandise-basket-client .basket-item {
    grid-template-columns: 1fr !important;
  }

  .merchandise-basket-client .basket-item-actions {
    align-items: stretch !important;
    justify-items: stretch !important;
  }
}
`;

const styles: Record<string, CSSProperties> = {
  wrapper: {
    display: "grid",
    gap: 16,
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

  secondaryActionButton: {
    width: "100%",
    minHeight: 48,
    padding: "11px 15px",
    borderRadius: 999,
    background: "#ffffff",
    border: "1px solid",
    fontWeight: 950,
    cursor: "pointer",
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

  detailsPanel: {
    display: "grid",
    gap: 14,
    padding: 18,
    borderRadius: 28,
    background: "#ffffff",
    border: "1px solid #dbeafe",
    boxShadow: "0 10px 30px rgba(22,131,248,0.06)",
  },

  detailsHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "flex-start",
    flexWrap: "wrap",
  },

  detailsTitle: {
    margin: "4px 0 0",
    color: "#0f172a",
    fontSize: 32,
    lineHeight: 1.05,
    letterSpacing: "-0.055em",
  },

  detailsIntro: {
    margin: "8px 0 0",
    color: "#64748b",
    lineHeight: 1.5,
    fontWeight: 760,
  },

  detailsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: 10,
  },

  field: {
    display: "grid",
    gap: 6,
  },

  fieldLabel: {
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

  textarea: {
    width: "100%",
    padding: "10px 12px",
    borderRadius: 14,
    border: "1px solid #cbd5e1",
    background: "#ffffff",
    color: "#0f172a",
    fontWeight: 760,
    lineHeight: 1.45,
    outline: "none",
    resize: "vertical",
  },

  fulfilmentLineList: {
    display: "grid",
    gap: 10,
  },

  fulfilmentLineCard: {
    display: "grid",
    gap: 11,
    padding: 14,
    borderRadius: 22,
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
  },

  fulfilmentLineTitle: {
    margin: 0,
    color: "#0f172a",
    fontSize: 20,
    lineHeight: 1.1,
    letterSpacing: "-0.035em",
  },

  fulfilmentLineMeta: {
    margin: "4px 0 0",
    color: "#64748b",
    fontSize: 13,
    lineHeight: 1.35,
    fontWeight: 780,
  },

  lineDetailGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 10,
  },

  noExtraDetailsText: {
    margin: 0,
    color: "#64748b",
    fontSize: 13,
    lineHeight: 1.45,
    fontWeight: 760,
  },

  detailsMessage: {
    padding: 13,
    borderRadius: 18,
    border: "1px solid",
    fontSize: 13,
    lineHeight: 1.45,
    fontWeight: 850,
  },

  detailsMessageGood: {
    background: "#f0fdf4",
    color: "#166534",
    borderColor: "#bbf7d0",
  },

  detailsMessageBad: {
    background: "#fef2f2",
    color: "#991b1b",
    borderColor: "#fecaca",
  },

  orderResultPanel: {
    display: "grid",
    gap: 5,
    padding: 13,
    borderRadius: 18,
    border: "1px solid",
    fontSize: 13,
    lineHeight: 1.45,
    fontWeight: 850,
  },

  orderResultGood: {
    background: "#f0fdf4",
    color: "#166534",
    borderColor: "#bbf7d0",
  },

  orderResultBad: {
    background: "#fef2f2",
    color: "#991b1b",
    borderColor: "#fecaca",
  },

  orderResultTitle: {
    color: "inherit",
    fontSize: 14,
    fontWeight: 950,
  },

  orderResultText: {
    color: "inherit",
  },

  orderReference: {
    display: "inline-flex",
    width: "fit-content",
    padding: "7px 10px",
    borderRadius: 999,
    background: "#ffffff",
    color: "#0f172a",
    border: "1px solid #bbf7d0",
    fontSize: 12,
    fontWeight: 950,
  },

  detailsActions: {
    display: "grid",
    gridTemplateColumns: "1fr",
    gap: 10,
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
