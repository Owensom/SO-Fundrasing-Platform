"use client";

import { useMemo, useState, type CSSProperties } from "react";
import BuyerDetailsFields from "@/components/events/BuyerDetailsFields";
import PublicEventCheckoutAddOnSelector, {
  type PublicEventCheckoutAddOn,
  type PublicEventCheckoutAddOnPlayer,
  type PublicEventCheckoutAddOnSelection,
} from "@/components/events/PublicEventCheckoutAddOnSelector";

type TicketType = {
  id: string;
  name: string;
  description?: string | null;
  price: number;
};

const STRIPE_STANDARD_UK_PERCENT = 0.015;
const STRIPE_STANDARD_UK_FIXED_CENTS = 20;

function moneyFromCents(cents: number | null | undefined) {
  return (Number(cents || 0) / 100).toFixed(2);
}

function safePercent(value: unknown) {
  const number = Number(value);

  if (!Number.isFinite(number) || number < 0) {
    return 0;
  }

  return Math.min(100, number);
}

function cleanAccessCode(value: string) {
  return value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function cleanAnswer(value: unknown) {
  return String(value || "").trim();
}

function cleanPlayer(value: unknown) {
  return String(value || "").trim();
}

function livePlayerText(value: unknown) {
  return String(value || "");
}

function isValidEmail(value: unknown) {
  const email = cleanPlayer(value).toLowerCase();

  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function normalisePlayerRows(input: {
  quantity: number;
  players?: PublicEventCheckoutAddOnPlayer[];
  buyerName: string;
  buyerEmail: string;
}) {
  const quantity = Math.max(0, Math.floor(Number(input.quantity || 0)));
  const existingPlayers = Array.isArray(input.players) ? input.players : [];

  return Array.from({ length: quantity }).map((_, index) => {
    const existing = existingPlayers[index];

    if (existing) {
      return {
        name: livePlayerText(existing.name),
        email: livePlayerText(existing.email),
      };
    }

    if (index === 0) {
      return {
        name: livePlayerText(input.buyerName),
        email: livePlayerText(input.buyerEmail),
      };
    }

    return {
      name: "",
      email: "",
    };
  });
}

function calculatePlatformCommissionCents(
  subtotalCents: number,
  platformFeePercent: number,
) {
  const subtotal = Math.max(0, Math.round(Number(subtotalCents || 0)));
  const percent = safePercent(platformFeePercent);

  if (!subtotal || !percent) return 0;

  return Math.max(0, Math.ceil(subtotal * (percent / 100)));
}

function calculatePlatformFeeCents(
  subtotalCents: number,
  platformFeePercent: number,
) {
  const subtotal = Math.max(0, Math.round(Number(subtotalCents || 0)));

  if (!subtotal || subtotal <= 0) return 0;

  const platformCommissionCents = calculatePlatformCommissionCents(
    subtotal,
    platformFeePercent,
  );

  const grossTotalCents = Math.ceil(
    (subtotal + platformCommissionCents + STRIPE_STANDARD_UK_FIXED_CENTS) /
      (1 - STRIPE_STANDARD_UK_PERCENT),
  );

  return Math.max(0, grossTotalCents - subtotal);
}

function normaliseAddOnQuantity(
  quantity: number,
  addOn?: PublicEventCheckoutAddOn | null,
) {
  const cleanQuantity = Math.max(0, Math.floor(Number(quantity || 0)));
  const max = Number(addOn?.maxEntriesPerBooking || 0);

  if (Number.isFinite(max) && max > 0) {
    return Math.min(cleanQuantity, Math.floor(max));
  }

  return cleanQuantity;
}

function normaliseAddOnQuantities(input: {
  checkoutAddOns: PublicEventCheckoutAddOn[];
  addOnQuantities: Record<string, number>;
  hasAccessCode: boolean;
}) {
  if (input.hasAccessCode) {
    return {};
  }

  return Object.fromEntries(
    input.checkoutAddOns.map((addOn) => [
      addOn.type,
      normaliseAddOnQuantity(input.addOnQuantities[addOn.type] || 0, addOn),
    ]),
  );
}

function addOnNeedsBuyerAnswer(addOn: PublicEventCheckoutAddOn) {
  return Boolean(
    addOn.type === "higher_or_lower" &&
      addOn.legalQuestionEnabled &&
      cleanAnswer(addOn.legalQuestionText),
  );
}

export default function PublicGeneralAdmissionSelector({
  eventId,
  ticketTypes,
  currency,
  platformFeePercent = 0,
  checkoutAddOns = [],
}: {
  eventId: string;
  ticketTypes: TicketType[];
  currency: string;
  platformFeePercent?: number;
  checkoutAddOns?: PublicEventCheckoutAddOn[];
}) {
  const [buyerName, setBuyerName] = useState("");
  const [buyerEmail, setBuyerEmail] = useState("");
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [addOnQuantities, setAddOnQuantities] = useState<
    Record<string, number>
  >({});
  const [addOnBuyerAnswers, setAddOnBuyerAnswers] = useState<
    Record<string, string>
  >({});
  const [addOnPlayers, setAddOnPlayers] = useState<
    Record<string, PublicEventCheckoutAddOnPlayer[]>
  >({});
  const [coverFees, setCoverFees] = useState(false);
  const [accessCode, setAccessCode] = useState("");
  const [checkoutError, setCheckoutError] = useState("");
  const [isCheckingOut, setIsCheckingOut] = useState(false);

  const cleanedAccessCode = cleanAccessCode(accessCode);
  const hasAccessCode = cleanedAccessCode.length > 0;

  const selectedItems = useMemo(() => {
    return ticketTypes
      .map((ticketType) => ({
        ticketType,
        quantity: Math.max(
          0,
          Math.floor(Number(quantities[ticketType.id] || 0)),
        ),
      }))
      .filter((item) => item.quantity > 0);
  }, [ticketTypes, quantities]);

  const safeAddOnQuantities = normaliseAddOnQuantities({
    checkoutAddOns,
    addOnQuantities,
    hasAccessCode,
  });

  const selectedAddOns: PublicEventCheckoutAddOnSelection[] = checkoutAddOns
    .map((addOn) => {
      const quantity = safeAddOnQuantities[addOn.type] || 0;
      const players =
        addOn.type === "higher_or_lower"
          ? normalisePlayerRows({
              quantity,
              players: addOnPlayers[addOn.type],
              buyerName,
              buyerEmail,
            })
          : undefined;

      return {
        type: addOn.type,
        quantity,
        buyerAnswer: cleanAnswer(addOnBuyerAnswers[addOn.type]),
        ...(players ? { players } : {}),
      };
    })
    .filter((addOn) => addOn.quantity > 0);

  const ticketTotal = selectedItems.reduce(
    (sum, item) => sum + Number(item.ticketType.price || 0) * item.quantity,
    0,
  );

  const addOnTotal = checkoutAddOns.reduce(
    (sum, addOn) =>
      sum +
      Number(addOn.entryPriceCents || 0) *
        Number(safeAddOnQuantities[addOn.type] || 0),
    0,
  );

  const checkoutSubtotal = ticketTotal + addOnTotal;

  const estimatedCoverFeeCents = calculatePlatformFeeCents(
    checkoutSubtotal,
    platformFeePercent,
  );

  const platformFeeCents =
    coverFees && !hasAccessCode ? estimatedCoverFeeCents : 0;

  const totalTodayCents = hasAccessCode
    ? 0
    : checkoutSubtotal + platformFeeCents;

  const totalQuantity = selectedItems.reduce(
    (sum, item) => sum + item.quantity,
    0,
  );

  const totalAddOnQuantity = selectedAddOns.reduce(
    (sum, addOn) => sum + addOn.quantity,
    0,
  );

  function updateQuantity(ticketTypeId: string, nextQuantity: number) {
    setQuantities((current) => ({
      ...current,
      [ticketTypeId]: Math.max(0, Math.floor(Number(nextQuantity || 0))),
    }));
  }

  function updateAddOnQuantity(
    addOn: PublicEventCheckoutAddOn,
    nextQuantity: number,
  ) {
    const quantity = normaliseAddOnQuantity(nextQuantity, addOn);

    setAddOnQuantities((current) => ({
      ...current,
      [addOn.type]: quantity,
    }));

    if (addOn.type === "higher_or_lower") {
      setAddOnPlayers((current) => ({
        ...current,
        [addOn.type]: normalisePlayerRows({
          quantity,
          players: current[addOn.type],
          buyerName,
          buyerEmail,
        }),
      }));
    }
  }

  function updateAddOnBuyerAnswer(
    addOn: PublicEventCheckoutAddOn,
    answer: string,
  ) {
    setAddOnBuyerAnswers((current) => ({
      ...current,
      [addOn.type]: answer,
    }));
  }

  function updateAddOnPlayers(
    addOn: PublicEventCheckoutAddOn,
    players: PublicEventCheckoutAddOnPlayer[],
  ) {
    setAddOnPlayers((current) => ({
      ...current,
      [addOn.type]: normalisePlayerRows({
        quantity: safeAddOnQuantities[addOn.type] || 0,
        players,
        buyerName,
        buyerEmail,
      }),
    }));
  }

  function validateAddOnAnswers() {
    if (hasAccessCode) {
      return true;
    }

    for (const addOn of checkoutAddOns) {
      const quantity = safeAddOnQuantities[addOn.type] || 0;

      if (quantity <= 0) {
        continue;
      }

      if (
        addOnNeedsBuyerAnswer(addOn) &&
        !cleanAnswer(addOnBuyerAnswers[addOn.type])
      ) {
        setCheckoutError(
          "Please answer the Higher or Lower skill question before continuing.",
        );
        return false;
      }

      if (addOn.type === "higher_or_lower") {
        const players = normalisePlayerRows({
          quantity,
          players: addOnPlayers[addOn.type],
          buyerName,
          buyerEmail,
        });

        if (players.length !== quantity) {
          setCheckoutError(
            "Please add player details for every Higher or Lower entry.",
          );
          return false;
        }

        const missingPlayer = players.find(
          (player) => !cleanPlayer(player.name) || !cleanPlayer(player.email),
        );

        if (missingPlayer) {
          setCheckoutError(
            "Please enter a name and email for every Higher or Lower player.",
          );
          return false;
        }

        const invalidEmail = players.find(
          (player) => !isValidEmail(player.email),
        );

        if (invalidEmail) {
          setCheckoutError(
            "Please enter a valid email for every Higher or Lower player.",
          );
          return false;
        }
      }
    }

    return true;
  }

  async function startCheckout() {
    if (isCheckingOut) return;

    if (!buyerName.trim() || !buyerEmail.trim()) {
      setCheckoutError("Please enter your name and email address.");
      return;
    }

    if (selectedItems.length === 0) {
      setCheckoutError("Please choose at least one ticket.");
      return;
    }

    if (!validateAddOnAnswers()) {
      return;
    }

    setCheckoutError("");
    setIsCheckingOut(true);

    try {
      const response = await fetch("/api/events/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          eventId,
          buyerName,
          buyerEmail,
          coverFees: hasAccessCode ? false : coverFees,
          platformFeeCents,
          accessCode: cleanedAccessCode || null,
          addOns: selectedAddOns,
          items: selectedItems.map((item) => ({
            ticketTypeId: item.ticketType.id,
            quantity: item.quantity,
          })),
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.url) {
        throw new Error(data.error || "Checkout failed.");
      }

      window.location.href = data.url;
    } catch (error) {
      setCheckoutError(
        error instanceof Error ? error.message : "Checkout failed.",
      );
      setIsCheckingOut(false);
    }
  }

  if (ticketTypes.length === 0) {
    return (
      <div style={styles.emptyLarge}>
        <strong>No tickets available yet</strong>
        <p style={styles.muted}>Ticket options have not been released yet.</p>
      </div>
    );
  }

  return (
    <div style={styles.shell}>
      <section style={styles.ticketPanel}>
        <h3 style={styles.panelTitle}>Select tickets</h3>

        <div style={styles.ticketList}>
          {ticketTypes.map((ticketType) => {
            const quantity = Math.max(
              0,
              Math.floor(Number(quantities[ticketType.id] || 0)),
            );

            return (
              <div key={ticketType.id} style={styles.ticketRow}>
                <div style={styles.ticketInfo}>
                  <h4 style={styles.ticketName}>{ticketType.name}</h4>

                  {ticketType.description ? (
                    <p style={styles.ticketDescription}>
                      {ticketType.description}
                    </p>
                  ) : null}

                  <p style={styles.ticketPrice}>
                    {currency} {moneyFromCents(ticketType.price)}
                  </p>
                </div>

                <div style={styles.quantityControls}>
                  <button
                    type="button"
                    onClick={() => updateQuantity(ticketType.id, quantity - 1)}
                    style={styles.quantityButton}
                    disabled={quantity <= 0}
                  >
                    −
                  </button>

                  <input
                    type="number"
                    min="0"
                    value={quantity}
                    onChange={(event) =>
                      updateQuantity(ticketType.id, Number(event.target.value))
                    }
                    style={styles.quantityInput}
                  />

                  <button
                    type="button"
                    onClick={() => updateQuantity(ticketType.id, quantity + 1)}
                    style={styles.quantityButton}
                  >
                    +
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <aside style={styles.summaryPanel}>
        <BuyerDetailsFields
          buyerName={buyerName}
          buyerEmail={buyerEmail}
          onBuyerNameChange={setBuyerName}
          onBuyerEmailChange={setBuyerEmail}
          dark
        />

        <div style={styles.summarySpacer} />

        <label style={styles.accessCodeBox}>
          <span style={styles.accessCodeLabel}>VIP / complimentary code</span>
          <input
            value={accessCode}
            onChange={(event) => setAccessCode(event.target.value)}
            placeholder="Enter access code"
            style={styles.accessCodeInput}
          />
          <small style={styles.accessCodeHelp}>
            If you have been given a VIP, sponsor, staff or complimentary code,
            enter it here. Codes are checked securely before booking.
          </small>
        </label>

        {checkoutAddOns.length > 0 ? (
          <>
            <div style={styles.summarySpacer} />

            <div style={styles.addOnStack}>
              {checkoutAddOns.map((addOn) => (
                <PublicEventCheckoutAddOnSelector
                  key={addOn.type}
                  addOn={addOn}
                  currency={currency}
                  quantity={safeAddOnQuantities[addOn.type] || 0}
                  buyerAnswer={addOnBuyerAnswers[addOn.type] || ""}
                  buyerName={buyerName}
                  buyerEmail={buyerEmail}
                  players={addOnPlayers[addOn.type] || []}
                  disabled={hasAccessCode}
                  onQuantityChange={(nextQuantity) =>
                    updateAddOnQuantity(addOn, nextQuantity)
                  }
                  onBuyerAnswerChange={(answer) =>
                    updateAddOnBuyerAnswer(addOn, answer)
                  }
                  onPlayersChange={(players) =>
                    updateAddOnPlayers(addOn, players)
                  }
                />
              ))}
            </div>
          </>
        ) : null}

        <div style={styles.summarySpacer} />

        <p style={styles.eyebrow}>Booking summary</p>
        <h3 style={styles.summaryTitle}>Your tickets</h3>

        {selectedItems.length === 0 ? (
          <div style={styles.emptyBox}>
            <p style={styles.emptyTitle}>Choose tickets to begin</p>
            <p style={styles.emptyText}>
              Your selected ticket quantities will appear here.
            </p>
          </div>
        ) : (
          <div style={styles.summaryList}>
            {selectedItems.map((item) => (
              <div key={item.ticketType.id} style={styles.summaryRow}>
                <span>
                  {item.ticketType.name} × {item.quantity}
                </span>
                <strong>
                  {currency}{" "}
                  {moneyFromCents(
                    Number(item.ticketType.price || 0) * item.quantity,
                  )}
                </strong>
              </div>
            ))}

            {checkoutAddOns.map((addOn) => {
              const quantity = safeAddOnQuantities[addOn.type] || 0;

              if (quantity <= 0) {
                return null;
              }

              return (
                <div key={addOn.type} style={styles.summaryRow}>
                  <span>
                    {addOn.title || "Event add-on"} × {quantity}
                  </span>
                  <strong>
                    {currency}{" "}
                    {moneyFromCents(
                      Number(addOn.entryPriceCents || 0) * quantity,
                    )}
                  </strong>
                </div>
              );
            })}
          </div>
        )}

        <div style={styles.totalBox}>
          <span>
            {totalQuantity} ticket{totalQuantity === 1 ? "" : "s"}
            {totalAddOnQuantity > 0
              ? ` • ${totalAddOnQuantity} add-on entr${
                  totalAddOnQuantity === 1 ? "y" : "ies"
                }`
              : ""}
          </span>
          <strong>
            {currency} {moneyFromCents(checkoutSubtotal)}
          </strong>
        </div>

        {hasAccessCode ? (
          <div style={styles.accessCodeNotice}>
            <strong>Access code entered.</strong>
            <span>
              Your code will be validated when you continue. If valid, this
              booking will complete without Stripe payment.
            </span>
          </div>
        ) : (
          <label style={styles.feeBox}>
            <input
              type="checkbox"
              checked={coverFees}
              onChange={(event) => setCoverFees(event.target.checked)}
              disabled={checkoutSubtotal <= 0}
            />
            <span>
              <strong>I’d like to cover platform and payment costs</strong>
              <small style={styles.feeSmall}>
                Adds approximately {currency}{" "}
                {moneyFromCents(estimatedCoverFeeCents)} so the organiser
                receives the full ticket value.
              </small>
            </span>
          </label>
        )}

        <div
          style={
            hasAccessCode ? styles.totalBoxComplimentary : styles.totalBoxStrong
          }
        >
          <span>{hasAccessCode ? "Due after valid code" : "Total today"}</span>
          <strong>
            {currency} {moneyFromCents(totalTodayCents)}
          </strong>
        </div>

        {checkoutError ? <div style={styles.errorBox}>{checkoutError}</div> : null}

        <button
          type="button"
          onClick={startCheckout}
          disabled={selectedItems.length === 0 || isCheckingOut}
          style={{
            ...styles.checkoutButton,
            opacity: selectedItems.length === 0 || isCheckingOut ? 0.55 : 1,
            cursor:
              selectedItems.length === 0 || isCheckingOut
                ? "not-allowed"
                : "pointer",
          }}
        >
          {isCheckingOut
            ? "Processing..."
            : hasAccessCode
              ? "Validate code and book"
              : "Continue to checkout"}
        </button>
      </aside>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  shell: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 320px), 1fr))",
    gap: 18,
    alignItems: "start",
    width: "100%",
    minWidth: 0,
  },
  ticketPanel: {
    padding: "clamp(14px, 4vw, 18px)",
    borderRadius: 24,
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    minWidth: 0,
  },
  panelTitle: {
    margin: "0 0 14px",
    color: "#111827",
    fontSize: "clamp(21px, 5vw, 24px)",
    fontWeight: 950,
  },
  ticketList: {
    display: "grid",
    gap: 12,
  },
  ticketRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 14,
    flexWrap: "wrap",
    padding: "clamp(14px, 4vw, 16px)",
    borderRadius: 18,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    minWidth: 0,
  },
  ticketInfo: {
    flex: "1 1 220px",
    minWidth: 0,
  },
  ticketName: {
    margin: 0,
    color: "#111827",
    fontSize: 18,
    fontWeight: 950,
    lineHeight: 1.15,
    overflowWrap: "break-word",
  },
  ticketDescription: {
    margin: "5px 0 0",
    color: "#64748b",
    fontSize: 14,
    lineHeight: 1.45,
    overflowWrap: "break-word",
  },
  ticketPrice: {
    margin: "8px 0 0",
    color: "#9a3412",
    fontWeight: 950,
  },
  quantityControls: {
    display: "grid",
    gridTemplateColumns: "42px minmax(62px, 72px) 42px",
    alignItems: "center",
    gap: 8,
    flex: "0 0 auto",
  },
  quantityButton: {
    width: 42,
    height: 42,
    borderRadius: 999,
    border: "1px solid #cbd5e1",
    background: "#ffffff",
    color: "#111827",
    fontSize: 22,
    fontWeight: 950,
    cursor: "pointer",
  },
  quantityInput: {
    width: "100%",
    height: 42,
    borderRadius: 12,
    border: "1px solid #cbd5e1",
    textAlign: "center",
    fontSize: 16,
    fontWeight: 900,
    color: "#111827",
    background: "#ffffff",
    boxSizing: "border-box",
  },
  summaryPanel: {
    position: "sticky",
    top: 18,
    padding: "clamp(14px, 4vw, 18px)",
    borderRadius: 24,
    background: "#111827",
    color: "#ffffff",
    boxShadow: "0 18px 45px rgba(15,23,42,0.24)",
    minWidth: 0,
  },
  summarySpacer: {
    height: 16,
  },
  addOnStack: {
    display: "grid",
    gap: 12,
  },
  eyebrow: {
    margin: 0,
    color: "#facc15",
    fontSize: 11,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.14em",
  },
  summaryTitle: {
    margin: "5px 0 14px",
    fontSize: "clamp(23px, 5vw, 26px)",
    fontWeight: 950,
  },
  emptyBox: {
    padding: 18,
    borderRadius: 18,
    border: "1px dashed rgba(255,255,255,0.22)",
    background: "rgba(255,255,255,0.05)",
    textAlign: "center",
  },
  emptyTitle: {
    margin: 0,
    fontWeight: 950,
  },
  emptyText: {
    margin: "5px 0 0",
    color: "#94a3b8",
    fontSize: 13,
  },
  summaryList: {
    display: "grid",
    gap: 10,
  },
  summaryRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    flexWrap: "wrap",
    padding: 12,
    borderRadius: 14,
    background: "rgba(255,255,255,0.06)",
    fontWeight: 850,
  },
  totalBox: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    flexWrap: "wrap",
    marginTop: 14,
    padding: 15,
    borderRadius: 18,
    background: "rgba(250,204,21,0.14)",
    color: "#fde68a",
    fontWeight: 950,
    fontSize: 18,
  },
  totalBoxStrong: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    flexWrap: "wrap",
    marginTop: 10,
    padding: 15,
    borderRadius: 18,
    background: "rgba(34,197,94,0.16)",
    color: "#bbf7d0",
    fontWeight: 950,
    fontSize: 18,
    border: "1px solid rgba(187,247,208,0.18)",
  },
  totalBoxComplimentary: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    flexWrap: "wrap",
    marginTop: 10,
    padding: 15,
    borderRadius: 18,
    background: "rgba(96,165,250,0.18)",
    color: "#bfdbfe",
    fontWeight: 950,
    fontSize: 18,
    border: "1px solid rgba(147,197,253,0.22)",
  },
  feeBox: {
    display: "flex",
    gap: 10,
    alignItems: "flex-start",
    marginTop: 10,
    padding: 14,
    borderRadius: 18,
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.14)",
    color: "#ffffff",
    cursor: "pointer",
    lineHeight: 1.35,
  },
  feeSmall: {
    display: "block",
    marginTop: 4,
    color: "#cbd5e1",
    lineHeight: 1.4,
  },
  accessCodeBox: {
    display: "grid",
    gap: 7,
    padding: 14,
    borderRadius: 18,
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.14)",
  },
  accessCodeLabel: {
    color: "#facc15",
    fontSize: 12,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
  },
  accessCodeInput: {
    width: "100%",
    minHeight: 44,
    padding: "10px 12px",
    borderRadius: 13,
    border: "1px solid #cbd5e1",
    background: "#ffffff",
    color: "#0f172a",
    fontSize: 15,
    fontWeight: 850,
    boxSizing: "border-box",
    textTransform: "uppercase",
  },
  accessCodeHelp: {
    color: "#cbd5e1",
    lineHeight: 1.4,
    fontSize: 12,
    fontWeight: 750,
  },
  accessCodeNotice: {
    display: "grid",
    gap: 4,
    marginTop: 10,
    padding: 14,
    borderRadius: 18,
    background: "rgba(96,165,250,0.16)",
    border: "1px solid rgba(147,197,253,0.2)",
    color: "#dbeafe",
    fontSize: 13,
    lineHeight: 1.4,
    fontWeight: 800,
  },
  checkoutButton: {
    marginTop: 14,
    width: "100%",
    padding: 15,
    borderRadius: 999,
    background: "#1683f8",
    color: "#ffffff",
    border: "none",
    fontWeight: 950,
    fontSize: 15,
    boxShadow: "0 16px 30px rgba(22,131,248,0.25)",
  },
  errorBox: {
    marginTop: 10,
    padding: 12,
    borderRadius: 14,
    background: "#fee2e2",
    color: "#991b1b",
    fontWeight: 900,
  },
  emptyLarge: {
    padding: 26,
    borderRadius: 16,
    background: "#f8fafc",
    border: "1px dashed #cbd5e1",
    textAlign: "center",
    color: "#111827",
    fontSize: 18,
  },
  muted: {
    margin: "5px 0 0",
    color: "#64748b",
    fontSize: 14,
    lineHeight: 1.45,
  },
};
