"use client";

import { FormEvent, useMemo, useState } from "react";

type FulfilmentChoice = {
  value: string;
  label: string;
  description?: string;
};

type MerchandiseCheckoutValidationFormProps = {
  tenantSlug: string;
  productSlug: string;
  productTitle: string;
  priceDisplay: string;
  sizeOptions: string[];
  fulfilmentChoices: FulfilmentChoice[];
  requireBookingReference: boolean;
  requireTableNumber: boolean;
  requireSeatNumber: boolean;
  requireGuestName: boolean;
  primaryColour: string;
  primaryTextColour: string;
};

type ValidationResult = {
  ok?: boolean;
  error?: string;
  message?: string;
  checkoutPreview?: {
    productTitle?: string;
    quantity?: number;
    optionLabel?: string | null;
    fulfilmentMethod?: string;
    customerName?: string;
    customerEmail?: string;
    subtotalCents?: number;
    currency?: string;
  };
};

function cleanText(value: unknown) {
  return String(value ?? "").trim();
}

function formatFulfilmentLabel(value: string, choices: FulfilmentChoice[]) {
  return choices.find((choice) => choice.value === value)?.label || value;
}

export default function MerchandiseCheckoutValidationForm({
  tenantSlug,
  productSlug,
  productTitle,
  priceDisplay,
  sizeOptions,
  fulfilmentChoices,
  requireBookingReference,
  requireTableNumber,
  requireSeatNumber,
  requireGuestName,
  primaryColour,
  primaryTextColour,
}: MerchandiseCheckoutValidationFormProps) {
  const [quantity, setQuantity] = useState("1");
  const [optionLabel, setOptionLabel] = useState(sizeOptions[0] || "");
  const [fulfilmentMethod, setFulfilmentMethod] = useState(
    fulfilmentChoices[0]?.value || "",
  );
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [bookingReference, setBookingReference] = useState("");
  const [tableNumber, setTableNumber] = useState("");
  const [seatNumber, setSeatNumber] = useState("");
  const [guestName, setGuestName] = useState("");
  const [customerNote, setCustomerNote] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<ValidationResult | null>(null);

  const selectedFulfilment = useMemo(
    () => fulfilmentChoices.find((choice) => choice.value === fulfilmentMethod),
    [fulfilmentChoices, fulfilmentMethod],
  );

  const hasRequiredEventDetails =
    requireBookingReference ||
    requireTableNumber ||
    requireSeatNumber ||
    requireGuestName;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setIsSubmitting(true);
    setResult(null);

    try {
      const response = await fetch("/api/merchandise/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          tenantSlug,
          productSlug,
          quantity: Number(quantity || 1),
          optionLabel: cleanText(optionLabel),
          fulfilmentMethod: cleanText(fulfilmentMethod),
          customerName: cleanText(customerName),
          customerEmail: cleanText(customerEmail),
          customerPhone: cleanText(customerPhone),
          bookingReference: cleanText(bookingReference),
          tableNumber: cleanText(tableNumber),
          seatNumber: cleanText(seatNumber),
          guestName: cleanText(guestName),
          customerNote: cleanText(customerNote),
        }),
      });

      const json = (await response.json()) as ValidationResult;
      setResult(json);
    } catch {
      setResult({
        ok: false,
        error:
          "We could not check those details. Please refresh the page and try again.",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="merchandise-checkout-form" onSubmit={handleSubmit}>
      <style>{responsiveStyles}</style>

      <div style={styles.formIntro}>
        <p style={{ ...styles.kicker, color: primaryColour }}>
          Checkout preview
        </p>

        <h2 style={styles.title}>Prepare your order</h2>

        <p style={styles.text}>
          This checks the details needed for merchandise checkout. Stripe payment
          is not connected yet, so no payment will be taken.
        </p>
      </div>

      <div style={styles.summaryCard}>
        <span style={styles.summaryLabel}>{productTitle}</span>
        <strong style={styles.summaryValue}>{priceDisplay}</strong>
      </div>

      <div className="checkout-field-grid" style={styles.fieldGrid}>
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
              <option value="">Choose an option</option>
              {sizeOptions.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </div>

      <fieldset style={styles.fieldset}>
        <legend style={styles.legend}>Fulfilment option</legend>

        <div style={styles.fulfilmentGrid}>
          {fulfilmentChoices.map((choice) => {
            const selected = fulfilmentMethod === choice.value;

            return (
              <label
                key={choice.value}
                style={{
                  ...styles.fulfilmentChoice,
                  ...(selected
                    ? {
                        borderColor: primaryColour,
                        boxShadow: `0 0 0 3px ${primaryColour}22`,
                      }
                    : null),
                }}
              >
                <input
                  type="radio"
                  name="fulfilmentMethod"
                  value={choice.value}
                  checked={selected}
                  onChange={(event) => setFulfilmentMethod(event.target.value)}
                  style={styles.radio}
                />

                <span style={styles.choiceCopy}>
                  <strong style={styles.choiceTitle}>{choice.label}</strong>

                  {choice.description ? (
                    <span style={styles.choiceText}>{choice.description}</span>
                  ) : null}
                </span>
              </label>
            );
          })}
        </div>

        {selectedFulfilment?.description ? (
          <p style={styles.helperText}>{selectedFulfilment.description}</p>
        ) : null}
      </fieldset>

      <div className="checkout-field-grid" style={styles.fieldGrid}>
        <label style={styles.field}>
          <span style={styles.label}>Your name</span>
          <input
            type="text"
            value={customerName}
            onChange={(event) => setCustomerName(event.target.value)}
            style={styles.input}
            autoComplete="name"
            required
          />
        </label>

        <label style={styles.field}>
          <span style={styles.label}>Email address</span>
          <input
            type="email"
            value={customerEmail}
            onChange={(event) => setCustomerEmail(event.target.value)}
            style={styles.input}
            autoComplete="email"
            required
          />
        </label>

        <label style={styles.field}>
          <span style={styles.label}>Phone number optional</span>
          <input
            type="tel"
            value={customerPhone}
            onChange={(event) => setCustomerPhone(event.target.value)}
            style={styles.input}
            autoComplete="tel"
          />
        </label>
      </div>

      {hasRequiredEventDetails ? (
        <div style={styles.eventDetailsPanel}>
          <p style={styles.eventDetailsTitle}>Event details</p>

          <p style={styles.helperText}>
            These details help the organiser match merchandise to your event
            booking, table, seat or guest.
          </p>

          <div className="checkout-field-grid" style={styles.fieldGrid}>
            {requireBookingReference ? (
              <label style={styles.field}>
                <span style={styles.label}>Booking reference</span>
                <input
                  type="text"
                  value={bookingReference}
                  onChange={(event) => setBookingReference(event.target.value)}
                  style={styles.input}
                  required
                />
              </label>
            ) : null}

            {requireTableNumber ? (
              <label style={styles.field}>
                <span style={styles.label}>Table number</span>
                <input
                  type="text"
                  value={tableNumber}
                  onChange={(event) => setTableNumber(event.target.value)}
                  style={styles.input}
                  required
                />
              </label>
            ) : null}

            {requireSeatNumber ? (
              <label style={styles.field}>
                <span style={styles.label}>Seat number</span>
                <input
                  type="text"
                  value={seatNumber}
                  onChange={(event) => setSeatNumber(event.target.value)}
                  style={styles.input}
                  required
                />
              </label>
            ) : null}

            {requireGuestName ? (
              <label style={styles.field}>
                <span style={styles.label}>Guest name</span>
                <input
                  type="text"
                  value={guestName}
                  onChange={(event) => setGuestName(event.target.value)}
                  style={styles.input}
                  required
                />
              </label>
            ) : null}
          </div>
        </div>
      ) : null}

      <label style={styles.field}>
        <span style={styles.label}>Note for organiser optional</span>
        <textarea
          value={customerNote}
          onChange={(event) => setCustomerNote(event.target.value)}
          style={styles.textarea}
          rows={4}
          placeholder="Add any helpful collection, delivery or merchandise note."
        />
      </label>

      {result ? (
        <div
          style={{
            ...styles.resultPanel,
            ...(result.ok ? styles.resultGood : styles.resultBad),
          }}
        >
          <strong style={styles.resultTitle}>
            {result.ok ? "Details validated" : "Please check this"}
          </strong>

          <p style={styles.resultText}>
            {result.ok
              ? result.message ||
                "These details are ready for the next checkout phase."
              : result.error || "Something needs to be corrected."}
          </p>

          {result.ok && result.checkoutPreview ? (
            <p style={styles.resultMeta}>
              {result.checkoutPreview.quantity} ×{" "}
              {result.checkoutPreview.productTitle}
              {result.checkoutPreview.optionLabel
                ? ` · ${result.checkoutPreview.optionLabel}`
                : ""}{" "}
              ·{" "}
              {formatFulfilmentLabel(
                result.checkoutPreview.fulfilmentMethod || "",
                fulfilmentChoices,
              )}
            </p>
          ) : null}
        </div>
      ) : null}

      <button
        type="submit"
        disabled={isSubmitting}
        style={{
          ...styles.submitButton,
          background: primaryColour,
          borderColor: primaryColour,
          color: primaryTextColour,
          opacity: isSubmitting ? 0.72 : 1,
        }}
      >
        {isSubmitting ? "Checking details..." : "Check checkout details"}
      </button>

      <p style={styles.bottomNote}>
        No payment will be taken. This is a validation step before Stripe
        checkout is connected.
      </p>
    </form>
  );
}

const responsiveStyles = `
.merchandise-checkout-form,
.merchandise-checkout-form * {
  box-sizing: border-box;
}

.merchandise-checkout-form {
  display: grid;
  gap: 12px;
  width: 100%;
}

.merchandise-checkout-form input,
.merchandise-checkout-form select,
.merchandise-checkout-form textarea,
.merchandise-checkout-form button {
  font: inherit;
}

@media (max-width: 680px) {
  .merchandise-checkout-form .checkout-field-grid {
    grid-template-columns: 1fr !important;
  }
}
`;

const styles: Record<string, React.CSSProperties> = {
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
    lineHeight: 1.5,
    fontWeight: 730,
  },

  summaryCard: {
    display: "grid",
    gap: 4,
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
    fontSize: 23,
    lineHeight: 1,
    fontWeight: 950,
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
    fontWeight: 800,
    outline: "none",
  },

  textarea: {
    width: "100%",
    padding: "10px 12px",
    borderRadius: 14,
    border: "1px solid #cbd5e1",
    background: "#ffffff",
    color: "#0f172a",
    fontWeight: 750,
    lineHeight: 1.45,
    resize: "vertical",
    outline: "none",
  },

  fieldset: {
    display: "grid",
    gap: 10,
    margin: 0,
    padding: 13,
    borderRadius: 18,
    border: "1px solid #dbeafe",
    background: "#f8fafc",
  },

  legend: {
    padding: "0 6px",
    color: "#0f172a",
    fontSize: 13,
    fontWeight: 950,
  },

  fulfilmentGrid: {
    display: "grid",
    gridTemplateColumns: "1fr",
    gap: 8,
  },

  fulfilmentChoice: {
    display: "flex",
    gap: 10,
    alignItems: "flex-start",
    padding: 11,
    borderRadius: 16,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    cursor: "pointer",
  },

  radio: {
    marginTop: 3,
    flexShrink: 0,
  },

  choiceCopy: {
    display: "grid",
    gap: 3,
  },

  choiceTitle: {
    color: "#0f172a",
    fontSize: 13,
    lineHeight: 1.25,
    fontWeight: 950,
  },

  choiceText: {
    color: "#64748b",
    fontSize: 12,
    lineHeight: 1.35,
    fontWeight: 720,
  },

  helperText: {
    margin: 0,
    color: "#64748b",
    fontSize: 12,
    lineHeight: 1.45,
    fontWeight: 730,
  },

  eventDetailsPanel: {
    display: "grid",
    gap: 10,
    padding: 13,
    borderRadius: 18,
    background: "#fffbeb",
    border: "1px solid #fde68a",
  },

  eventDetailsTitle: {
    margin: 0,
    color: "#92400e",
    fontSize: 14,
    fontWeight: 950,
  },

  resultPanel: {
    display: "grid",
    gap: 5,
    padding: 13,
    borderRadius: 18,
    border: "1px solid",
  },

  resultGood: {
    background: "#f0fdf4",
    borderColor: "#bbf7d0",
  },

  resultBad: {
    background: "#fef2f2",
    borderColor: "#fecaca",
  },

  resultTitle: {
    color: "#0f172a",
    fontSize: 14,
    fontWeight: 950,
  },

  resultText: {
    margin: 0,
    color: "#475569",
    lineHeight: 1.45,
    fontWeight: 730,
  },

  resultMeta: {
    margin: 0,
    color: "#0f172a",
    fontSize: 13,
    lineHeight: 1.4,
    fontWeight: 850,
  },

  submitButton: {
    width: "100%",
    minHeight: 48,
    padding: "11px 15px",
    borderRadius: 999,
    border: "1px solid",
    fontWeight: 950,
    cursor: "pointer",
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
