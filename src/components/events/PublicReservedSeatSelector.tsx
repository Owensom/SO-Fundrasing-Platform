"use client";

import { useMemo, useState, type CSSProperties } from "react";
import BuyerDetailsFields from "@/components/events/BuyerDetailsFields";
import PublicEventCheckoutAddOnSelector, {
  type PublicEventCheckoutAddOn,
  type PublicEventCheckoutAddOnSelection,
} from "@/components/events/PublicEventCheckoutAddOnSelector";

type Seat = {
  id: string;
  ticket_type_id: string | null;
  section: string | null;
  row_label: string | null;
  seat_number: string | null;
  table_number: string | null;
  aisle_after: number | null;
  status: string;
};

type TicketType = {
  id: string;
  name: string;
  price: number;
};

type CartItem = {
  seatId: string;
  ticketTypeId: string;
};

type GuestData = {
  guestName: string;
  dietaryRequirements: string;
  menuChoice: string;
  tableName: string;
};

const TICKET_PLACEHOLDER_IMAGE = "/brand/so-ticket-placeholder.png";
const STRIPE_STANDARD_UK_PERCENT = 0.015;
const STRIPE_STANDARD_UK_FIXED_CENTS = 20;

const specialColours = [
  { background: "#facc15", text: "#422006" },
  { background: "#a78bfa", text: "#2e1065" },
  { background: "#fb7185", text: "#4c0519" },
  { background: "#60a5fa", text: "#082f49" },
  { background: "#fb923c", text: "#431407" },
];

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

function seatLabel(seat: Seat) {
  return `Row ${seat.row_label}, Seat ${seat.seat_number}`;
}

function numericSort(a: string | null, b: string | null) {
  const aNumber = Number(a);
  const bNumber = Number(b);

  if (Number.isFinite(aNumber) && Number.isFinite(bNumber)) {
    return aNumber - bNumber;
  }

  return String(a || "").localeCompare(String(b || ""));
}

function groupBy<T>(items: T[], getKey: (item: T) => string) {
  return items.reduce<Record<string, T[]>>((groups, item) => {
    const key = getKey(item);
    groups[key] = groups[key] || [];
    groups[key].push(item);
    return groups;
  }, {});
}

function rowKeyForSeat(seat: Seat) {
  return `${seat.section || ""}|${seat.row_label || ""}`;
}

function rowVisualUnits(rowSeats: Seat[]) {
  return rowSeats.length + rowSeats.filter((seat) => seat.aisle_after).length * 2;
}

function getDefaultGuestData(): GuestData {
  return {
    guestName: "",
    dietaryRequirements: "",
    menuChoice: "",
    tableName: "",
  };
}

function colourForTicketType(
  ticketType: TicketType | undefined,
  ticketTypes: TicketType[],
) {
  if (!ticketType) {
    return {
      background: "#dcfce7",
      text: "#14532d",
      label: "Normal public seat",
    };
  }

  const index = Math.max(
    0,
    ticketTypes.findIndex((item) => item.id === ticketType.id),
  );

  return {
    ...specialColours[index % specialColours.length],
    label: ticketType.name,
  };
}

function publicSeatStyle({
  selected,
  ticketType,
  ticketTypes,
  status,
}: {
  selected: boolean;
  ticketType: TicketType | undefined;
  ticketTypes: TicketType[];
  status: string;
}): CSSProperties {
  const colour = colourForTicketType(ticketType, ticketTypes);

  const base: CSSProperties = {
    minWidth: 36,
    width: 36,
    height: 36,
    borderRadius: 10,
    fontSize: 12,
    fontWeight: 900,
    padding: 0,
    boxSizing: "border-box",
  };

  if (status === "blocked") {
    return {
      ...base,
      border: selected ? "1px solid #0284c7" : "1px solid #64748b",
      background: selected ? "#bae6fd" : "#334155",
      color: selected ? "#082f49" : "#e2e8f0",
      boxShadow: selected ? "0 0 0 3px rgba(14,165,233,0.35)" : "none",
      cursor: "not-allowed",
      opacity: 0.9,
    };
  }

  if (status === "sold") {
    return {
      ...base,
      border: selected ? "1px solid #0284c7" : "1px solid #991b1b",
      background: selected ? "#bae6fd" : "#fecaca",
      color: selected ? "#082f49" : "#7f1d1d",
      boxShadow: selected ? "0 0 0 3px rgba(14,165,233,0.35)" : "none",
      cursor: "not-allowed",
      opacity: 0.9,
    };
  }

  if (status === "reserved") {
    return {
      ...base,
      border: selected ? "1px solid #0284c7" : "1px solid #f59e0b",
      background: selected ? "#bae6fd" : "#fef3c7",
      color: selected ? "#082f49" : "#92400e",
      boxShadow: selected ? "0 0 0 3px rgba(14,165,233,0.35)" : "none",
      cursor: "not-allowed",
      opacity: 0.9,
    };
  }

  return {
    ...base,
    border: selected ? "1px solid #0284c7" : "1px solid #cbd5e1",
    background: selected ? "#bae6fd" : colour.background,
    color: selected ? "#082f49" : colour.text,
    boxShadow: selected ? "0 0 0 3px rgba(14,165,233,0.35)" : "none",
    cursor: "pointer",
  };
}

export default function PublicReservedSeatSelector({
  eventId,
  seats,
  ticketTypes,
  currency,
  platformFeePercent = 0,
  menuOptions = [],
  initialSeatingLayout = {},
  checkoutAddOns = [],
}: {
  eventId: string;
  eventType?: string;
  seats: Seat[];
  ticketTypes: TicketType[];
  currency: string;
  platformFeePercent?: number;
  menuOptions?: string[];
  initialSeatingLayout?: Record<string, number>;
  checkoutAddOns?: PublicEventCheckoutAddOn[];
}) {
  const [buyerName, setBuyerName] = useState("");
  const [buyerEmail, setBuyerEmail] = useState("");
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [guestData, setGuestData] = useState<Record<string, GuestData>>({});
  const [addOnQuantities, setAddOnQuantities] = useState<Record<string, number>>(
    {},
  );
  const [addOnBuyerAnswers, setAddOnBuyerAnswers] = useState<
    Record<string, string>
  >({});
  const [coverFees, setCoverFees] = useState(false);
  const [accessCode, setAccessCode] = useState("");
  const [checkoutError, setCheckoutError] = useState("");
  const [isCheckingOut, setIsCheckingOut] = useState(false);

  const cleanedAccessCode = cleanAccessCode(accessCode);
  const hasAccessCode = cleanedAccessCode.length > 0;

  const selectedSeatIds = cartItems.map((item) => item.seatId);

  const rowSeats = useMemo(
    () => seats.filter((seat) => seat.row_label && !seat.table_number),
    [seats],
  );

  const groupedSections = useMemo(() => {
    return groupBy(rowSeats, (seat) => seat.section || "Main");
  }, [rowSeats]);

  const cartSeats = useMemo(() => {
    return cartItems
      .map((item) => {
        const seat = seats.find((currentSeat) => currentSeat.id === item.seatId);
        const ticketType = ticketTypes.find(
          (currentTicketType) => currentTicketType.id === item.ticketTypeId,
        );

        if (!seat || !ticketType) return null;

        return {
          seat,
          ticketType,
        };
      })
      .filter(Boolean) as { seat: Seat; ticketType: TicketType }[];
  }, [cartItems, seats, ticketTypes]);

  const safeAddOnQuantities = normaliseAddOnQuantities({
    checkoutAddOns,
    addOnQuantities,
    hasAccessCode,
  });

  const selectedAddOns: PublicEventCheckoutAddOnSelection[] = checkoutAddOns
    .map((addOn) => ({
      type: addOn.type,
      quantity: safeAddOnQuantities[addOn.type] || 0,
      buyerAnswer: cleanAnswer(addOnBuyerAnswers[addOn.type]),
    }))
    .filter((addOn) => addOn.quantity > 0);

  const ticketTotal = cartSeats.reduce(
    (sum, item) => sum + Number(item.ticketType.price || 0),
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

  const totalAddOnQuantity = selectedAddOns.reduce(
    (sum, addOn) => sum + addOn.quantity,
    0,
  );

  function updateGuestData(seatId: string, patch: Partial<GuestData>) {
    setGuestData((current) => ({
      ...current,
      [seatId]: {
        ...getDefaultGuestData(),
        ...(current[seatId] || {}),
        ...patch,
      },
    }));
  }

  function updateAddOnQuantity(
    addOn: PublicEventCheckoutAddOn,
    nextQuantity: number,
  ) {
    setAddOnQuantities((current) => ({
      ...current,
      [addOn.type]: normaliseAddOnQuantity(nextQuantity, addOn),
    }));
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

  function validateAddOnAnswers() {
    if (hasAccessCode) {
      return true;
    }

    for (const addOn of checkoutAddOns) {
      const quantity = safeAddOnQuantities[addOn.type] || 0;

      if (quantity <= 0 || !addOnNeedsBuyerAnswer(addOn)) {
        continue;
      }

      if (!cleanAnswer(addOnBuyerAnswers[addOn.type])) {
        setCheckoutError(
          "Please answer the Higher or Lower skill question before continuing.",
        );
        return false;
      }
    }

    return true;
  }

  function toggleSeat(seat: Seat) {
    if (seat.status !== "available") return;

    setCartItems((current) => {
      const exists = current.find((item) => item.seatId === seat.id);

      if (exists) {
        return current.filter((item) => item.seatId !== seat.id);
      }

      const ticketTypeId = seat.ticket_type_id || ticketTypes[0]?.id || "";

      if (!ticketTypeId) return current;

      return [...current, { seatId: seat.id, ticketTypeId }];
    });
  }

  function updateTicketType(seatId: string, ticketTypeId: string) {
    setCartItems((current) =>
      current.map((item) =>
        item.seatId === seatId ? { ...item, ticketTypeId } : item,
      ),
    );
  }

  function removeSeat(seatId: string) {
    setCartItems((current) => current.filter((item) => item.seatId !== seatId));
  }

  async function startCheckout() {
    if (isCheckingOut) return;

    if (!buyerName.trim() || !buyerEmail.trim()) {
      setCheckoutError("Please enter your name and email address.");
      return;
    }

    if (cartItems.length === 0) {
      setCheckoutError("Please select at least one seat.");
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
          items: cartItems.map((item) => {
            const data = guestData[item.seatId] || getDefaultGuestData();

            return {
              seatId: item.seatId,
              ticketTypeId: item.ticketTypeId,
              guestName: data.guestName,
              dietary: data.dietaryRequirements,
              dietaryRequirements: data.dietaryRequirements,
              menuChoice: data.menuChoice,
              tableName: data.tableName,
            };
          }),
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

  return (
    <>
      <style>
        {`
          @media (max-width: 980px) {
            .public-reserved-selector-shell {
              grid-template-columns: 1fr !important;
            }

            .public-reserved-selector-map-panel,
            .public-reserved-selector-cart {
              min-height: auto !important;
            }

            .public-reserved-selector-cart {
              position: static !important;
            }

            .public-reserved-selector-cart-grid {
              grid-template-columns: 1fr !important;
            }
          }

          @media (max-width: 620px) {
            .public-reserved-selector-map-panel,
            .public-reserved-selector-cart {
              padding: 12px !important;
              border-radius: 20px !important;
            }

            .public-reserved-selector-map-title,
            .public-reserved-selector-cart-title {
              font-size: 24px !important;
            }

            .public-reserved-selector-seat-scroll {
              padding: 10px !important;
              border-radius: 14px !important;
            }

            .public-reserved-selector-row-line {
              grid-template-columns: 58px 1fr !important;
              gap: 7px !important;
            }

            .public-reserved-selector-row-label {
              font-size: 10px !important;
              min-height: 34px !important;
            }

            .public-reserved-selector-stage {
              min-width: 620px !important;
            }
          }
        `}
      </style>

      <div className="public-reserved-selector-shell" style={styles.shell}>
        <div className="public-reserved-selector-map-panel" style={styles.mapPanel}>
          <div style={styles.mapHeader}>
            <div>
              <h3 className="public-reserved-selector-map-title" style={styles.mapTitle}>
                Seat map
              </h3>
              <p style={styles.mapText}>
                Choose your preferred seats from the layout below.
              </p>
            </div>

            <div style={styles.legend}>
              <Legend color="#dcfce7" label="Available" />
              <Legend color="#bae6fd" label="Selected" />
              <Legend color="#334155" label="Blocked" />
              <Legend color="#fef3c7" label="Reserved" />
              <Legend color="#fecaca" label="Sold" />
            </div>
          </div>

          <div style={styles.stageWrap}>
            <div className="public-reserved-selector-stage" style={styles.stage}>
              STAGE
            </div>
          </div>

          <div className="public-reserved-selector-seat-scroll" style={styles.seatMapScroll}>
            {Object.entries(groupedSections)
              .sort(([a], [b]) => numericSort(a, b))
              .map(([section, sectionSeats]) => {
                const rows = groupBy(
                  sectionSeats,
                  (seat) => seat.row_label || "No row",
                );

                const rowEntries = Object.entries(rows).sort(([a], [b]) =>
                  numericSort(a, b),
                );

                const maxUnits = Math.max(
                  1,
                  ...rowEntries.map(([, currentRowSeats]) =>
                    rowVisualUnits(currentRowSeats),
                  ),
                );

                return (
                  <div key={section} style={styles.groupBlock}>
                    <h4 style={styles.groupTitle}>{section}</h4>

                    {rowEntries.map(([row, currentRowSeats]) => {
                      const actualKey =
                        currentRowSeats.length > 0
                          ? rowKeyForSeat(currentRowSeats[0])
                          : `${section === "Main" ? "" : section}|${row}`;

                      const sortedRowSeats = currentRowSeats
                        .slice()
                        .sort((a, b) => numericSort(a.seat_number, b.seat_number));

                      const autoOffset = Math.max(
                        0,
                        Math.floor(
                          (maxUnits - rowVisualUnits(currentRowSeats)) / 2,
                        ),
                      );

                      const manualOffset = initialSeatingLayout[actualKey] || 0;
                      const totalOffset = Math.max(0, autoOffset + manualOffset);

                      return (
                        <div
                          key={`${section}-${row}`}
                          className="public-reserved-selector-row-line"
                          style={styles.rowLine}
                        >
                          <div
                            className="public-reserved-selector-row-label"
                            style={styles.rowButton}
                          >
                            Row {row}
                          </div>

                          <div
                            style={{
                              ...styles.seatLine,
                              paddingLeft: totalOffset * 42,
                            }}
                          >
                            {sortedRowSeats.map((seat) => {
                              const ticketType = ticketTypes.find(
                                (item) => item.id === seat.ticket_type_id,
                              );

                              const selected = selectedSeatIds.includes(seat.id);
                              const unavailable = seat.status !== "available";

                              return (
                                <span key={seat.id} style={styles.seatWrap}>
                                  <button
                                    type="button"
                                    onClick={() => toggleSeat(seat)}
                                    disabled={unavailable}
                                    title={
                                      seat.status === "blocked"
                                        ? `${seatLabel(seat)} — Blocked`
                                        : seat.status === "reserved"
                                          ? `${seatLabel(seat)} — Reserved`
                                          : seat.status === "sold"
                                            ? `${seatLabel(seat)} — Sold`
                                            : ticketType?.name
                                              ? `${seatLabel(seat)} — ${ticketType.name}`
                                              : seatLabel(seat)
                                    }
                                    style={publicSeatStyle({
                                      selected,
                                      ticketType,
                                      ticketTypes,
                                      status: seat.status,
                                    })}
                                  >
                                    {seat.seat_number}
                                  </button>

                                  {seat.aisle_after ? (
                                    <span style={styles.aisle}>Aisle</span>
                                  ) : null}
                                </span>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
          </div>

          <div style={styles.helperNotice}>
            <span style={styles.helperIcon}>ⓘ</span>
            On smaller screens, swipe across the seat map to view all seats.
          </div>
        </div>

        <aside className="public-reserved-selector-cart" style={styles.cart}>
          <div className="public-reserved-selector-cart-grid" style={styles.cartGrid}>
            <div>
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
                  Use this for VIP, sponsor, staff or complimentary bookings.
                  Codes are validated securely before booking.
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
                        disabled={hasAccessCode}
                        onQuantityChange={(nextQuantity) =>
                          updateAddOnQuantity(addOn, nextQuantity)
                        }
                        onBuyerAnswerChange={(answer) =>
                          updateAddOnBuyerAnswer(addOn, answer)
                        }
                      />
                    ))}
                  </div>
                </>
              ) : null}
            </div>

            <div>
              <div style={styles.cartTop}>
                <div>
                  <p style={styles.cartEyebrow}>Booking summary</p>
                  <h3 className="public-reserved-selector-cart-title" style={styles.cartTitle}>
                    Your tickets
                  </h3>
                </div>

                <div style={styles.countBadge}>{cartSeats.length}</div>
              </div>

              {cartSeats.length === 0 ? (
                <div style={styles.emptyBox}>
                  <img
                    src={TICKET_PLACEHOLDER_IMAGE}
                    alt="SO ticket"
                    style={styles.emptyTicketImage}
                  />

                  <p style={styles.emptyTitle}>Select seats to begin</p>
                  <p style={styles.emptyText}>
                    Your selected seats and guest details will appear here.
                  </p>
                </div>
              ) : (
                <div style={styles.cartList}>
                  {cartSeats.map(({ seat, ticketType }) => {
                    const data = guestData[seat.id] || getDefaultGuestData();
                    const availableTicketTypes = seat.ticket_type_id
                      ? ticketTypes.filter(
                          (currentTicketType) =>
                            currentTicketType.id === seat.ticket_type_id,
                        )
                      : ticketTypes;

                    return (
                      <div key={seat.id} style={styles.cartItem}>
                        <div style={styles.cartItemHeader}>
                          <div>
                            <p style={styles.cartSeatLabel}>{seatLabel(seat)}</p>
                            <p style={styles.cartPrice}>
                              {currency} {moneyFromCents(ticketType.price)}
                            </p>
                          </div>

                          <button
                            type="button"
                            onClick={() => removeSeat(seat.id)}
                            style={styles.removeButton}
                          >
                            Remove
                          </button>
                        </div>

                        <label style={styles.field}>
                          <span style={styles.label}>Ticket type</span>
                          <select
                            value={ticketType.id}
                            onChange={(event) =>
                              updateTicketType(seat.id, event.target.value)
                            }
                            disabled={Boolean(seat.ticket_type_id)}
                            style={styles.input}
                          >
                            {availableTicketTypes.map((currentTicketType) => (
                              <option
                                key={currentTicketType.id}
                                value={currentTicketType.id}
                              >
                                {currentTicketType.name} — {currency}{" "}
                                {moneyFromCents(currentTicketType.price)}
                              </option>
                            ))}
                          </select>
                        </label>

                        <label style={styles.field}>
                          <span style={styles.label}>Guest name</span>
                          <input
                            value={data.guestName}
                            onChange={(event) =>
                              updateGuestData(seat.id, {
                                guestName: event.target.value,
                              })
                            }
                            placeholder="Guest name"
                            style={styles.input}
                          />
                        </label>

                        <label style={styles.field}>
                          <span style={styles.label}>Dietary requirements</span>
                          <textarea
                            value={data.dietaryRequirements}
                            onChange={(event) =>
                              updateGuestData(seat.id, {
                                dietaryRequirements: event.target.value,
                              })
                            }
                            placeholder="None, vegetarian, gluten free, allergies..."
                            rows={2}
                            style={styles.textarea}
                          />
                        </label>

                        <label style={styles.field}>
                          <span style={styles.label}>Menu choice</span>
                          {menuOptions.length > 0 ? (
                            <select
                              value={data.menuChoice}
                              onChange={(event) =>
                                updateGuestData(seat.id, {
                                  menuChoice: event.target.value,
                                })
                              }
                              style={styles.input}
                            >
                              <option value="">Select menu option</option>
                              {menuOptions.map((option) => (
                                <option key={option} value={option}>
                                  {option}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <input
                              value={data.menuChoice}
                              onChange={(event) =>
                                updateGuestData(seat.id, {
                                  menuChoice: event.target.value,
                                })
                              }
                              placeholder="Optional menu choice"
                              style={styles.input}
                            />
                          )}
                        </label>
                      </div>
                    );
                  })}
                </div>
              )}

              <div style={styles.totalBox}>
                <span>
                  Ticket total
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

              {checkoutAddOns.map((addOn) => {
                const quantity = safeAddOnQuantities[addOn.type] || 0;

                if (quantity <= 0) {
                  return null;
                }

                return (
                  <div key={addOn.type} style={styles.addOnSummaryRow}>
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

              {hasAccessCode ? (
                <div style={styles.accessCodeNotice}>
                  <strong>Access code entered.</strong>
                  <span>
                    If valid, this booking will complete without Stripe payment.
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
                  hasAccessCode
                    ? styles.totalBoxComplimentary
                    : styles.totalBoxStrong
                }
              >
                <span>{hasAccessCode ? "Due after valid code" : "Total today"}</span>
                <strong>
                  {currency} {moneyFromCents(totalTodayCents)}
                </strong>
              </div>

              {checkoutError ? (
                <div style={styles.errorBox}>{checkoutError}</div>
              ) : null}

              <button
                type="button"
                onClick={startCheckout}
                disabled={cartSeats.length === 0 || isCheckingOut}
                style={{
                  ...styles.checkout,
                  opacity: cartSeats.length === 0 || isCheckingOut ? 0.55 : 1,
                  cursor:
                    cartSeats.length === 0 || isCheckingOut
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
            </div>
          </div>
        </aside>
      </div>
    </>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span style={styles.legendItem}>
      <span style={{ ...styles.legendDot, background: color }} />
      {label}
    </span>
  );
}

const styles: Record<string, CSSProperties> = {
  shell: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1.2fr) minmax(340px, 0.8fr)",
    gap: 18,
    alignItems: "start",
    width: "100%",
    minWidth: 0,
  },

  mapPanel: {
    padding: "clamp(14px, 4vw, 18px)",
    borderRadius: 24,
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    minWidth: 0,
    overflow: "hidden",
  },

  mapHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: 14,
    flexWrap: "wrap",
    alignItems: "flex-start",
    marginBottom: 14,
  },

  mapTitle: {
    margin: 0,
    color: "#111827",
    fontSize: "clamp(24px, 5vw, 30px)",
    lineHeight: 1.05,
    letterSpacing: "-0.045em",
    fontWeight: 950,
  },

  mapText: {
    margin: "6px 0 0",
    color: "#64748b",
    fontSize: 14,
    lineHeight: 1.45,
    fontWeight: 700,
  },

  legend: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "flex-end",
  },

  legendItem: {
    display: "inline-flex",
    gap: 6,
    alignItems: "center",
    padding: "7px 9px",
    borderRadius: 999,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    color: "#334155",
    fontSize: 12,
    fontWeight: 850,
    whiteSpace: "nowrap",
  },

  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 999,
    border: "1px solid rgba(15,23,42,0.14)",
  },

  stageWrap: {
    display: "flex",
    justifyContent: "center",
    margin: "12px 0 14px",
    minWidth: 0,
  },

  stage: {
    width: "min(100%, 620px)",
    minWidth: 320,
    padding: "10px 14px",
    borderRadius: "16px 16px 34px 34px",
    background:
      "linear-gradient(135deg, #0f172a 0%, #1e293b 58%, #020617 100%)",
    color: "#fef3c7",
    border: "1px solid rgba(250,204,21,0.28)",
    textAlign: "center",
    fontSize: 12,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.16em",
    boxShadow: "0 12px 28px rgba(15,23,42,0.16)",
  },

  seatMapScroll: {
    width: "100%",
    overflowX: "auto",
    overflowY: "hidden",
    padding: 14,
    borderRadius: 18,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.75)",
  },

  groupBlock: {
    display: "grid",
    gap: 10,
    minWidth: 620,
  },

  groupTitle: {
    margin: "8px 0 2px",
    color: "#334155",
    fontSize: 13,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
  },

  rowLine: {
    display: "grid",
    gridTemplateColumns: "76px 1fr",
    gap: 10,
    alignItems: "center",
    minWidth: 0,
  },

  rowButton: {
    minHeight: 36,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "7px 8px",
    borderRadius: 12,
    background: "#f1f5f9",
    color: "#334155",
    border: "1px solid #e2e8f0",
    fontSize: 11,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.04em",
    whiteSpace: "nowrap",
  },

  seatLine: {
    display: "flex",
    alignItems: "center",
    gap: 7,
    minHeight: 42,
    minWidth: 0,
  },

  seatWrap: {
    display: "inline-flex",
    alignItems: "center",
    gap: 7,
  },

  aisle: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: 64,
    height: 28,
    borderRadius: 999,
    background: "#f8fafc",
    color: "#94a3b8",
    border: "1px dashed #cbd5e1",
    fontSize: 10,
    fontWeight: 900,
    textTransform: "uppercase",
    letterSpacing: "0.06em",
  },

  helperNotice: {
    display: "flex",
    gap: 8,
    alignItems: "center",
    marginTop: 12,
    padding: 12,
    borderRadius: 16,
    background: "#eff6ff",
    color: "#1e3a8a",
    border: "1px solid #bfdbfe",
    fontSize: 13,
    lineHeight: 1.4,
    fontWeight: 800,
  },

  helperIcon: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: 22,
    height: 22,
    borderRadius: 999,
    background: "#dbeafe",
    color: "#1d4ed8",
    fontWeight: 950,
    flexShrink: 0,
  },

  cart: {
    position: "sticky",
    top: 18,
    padding: "clamp(14px, 4vw, 18px)",
    borderRadius: 24,
    background: "#111827",
    color: "#ffffff",
    boxShadow: "0 18px 45px rgba(15,23,42,0.24)",
    minWidth: 0,
  },

  cartGrid: {
    display: "grid",
    gap: 18,
    minWidth: 0,
  },

  cartTop: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 14,
  },

  cartEyebrow: {
    margin: 0,
    color: "#facc15",
    fontSize: 11,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.14em",
  },

  cartTitle: {
    margin: "5px 0 0",
    fontSize: "clamp(23px, 5vw, 28px)",
    lineHeight: 1.05,
    letterSpacing: "-0.045em",
    fontWeight: 950,
  },

  countBadge: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minWidth: 42,
    height: 42,
    borderRadius: 999,
    background: "rgba(250,204,21,0.16)",
    color: "#fde68a",
    border: "1px solid rgba(250,204,21,0.24)",
    fontWeight: 950,
  },

  summarySpacer: {
    height: 16,
  },

  addOnStack: {
    display: "grid",
    gap: 12,
  },

  emptyBox: {
    display: "grid",
    justifyItems: "center",
    gap: 8,
    padding: 18,
    borderRadius: 18,
    border: "1px dashed rgba(255,255,255,0.22)",
    background: "rgba(255,255,255,0.05)",
    textAlign: "center",
  },

  emptyTicketImage: {
    width: 78,
    height: 78,
    objectFit: "contain",
    opacity: 0.82,
  },

  emptyTitle: {
    margin: 0,
    color: "#ffffff",
    fontWeight: 950,
  },

  emptyText: {
    margin: 0,
    color: "#94a3b8",
    fontSize: 13,
    lineHeight: 1.45,
  },

  cartList: {
    display: "grid",
    gap: 12,
  },

  cartItem: {
    display: "grid",
    gap: 10,
    padding: 14,
    borderRadius: 18,
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.14)",
    minWidth: 0,
  },

  cartItemHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: 10,
    alignItems: "flex-start",
    flexWrap: "wrap",
  },

  cartSeatLabel: {
    margin: 0,
    color: "#ffffff",
    fontSize: 15,
    fontWeight: 950,
    lineHeight: 1.25,
  },

  cartPrice: {
    margin: "4px 0 0",
    color: "#fde68a",
    fontSize: 13,
    fontWeight: 950,
  },

  removeButton: {
    border: "1px solid rgba(254,202,202,0.28)",
    background: "rgba(254,202,202,0.1)",
    color: "#fecaca",
    borderRadius: 999,
    padding: "7px 10px",
    fontSize: 12,
    fontWeight: 950,
    cursor: "pointer",
  },

  field: {
    display: "grid",
    gap: 6,
    minWidth: 0,
  },

  label: {
    color: "#cbd5e1",
    fontSize: 12,
    fontWeight: 900,
  },

  input: {
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

  textarea: {
    width: "100%",
    padding: "10px 11px",
    borderRadius: 13,
    border: "1px solid #cbd5e1",
    background: "#ffffff",
    color: "#0f172a",
    fontSize: 15,
    resize: "vertical",
    boxSizing: "border-box",
    minWidth: 0,
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

  addOnSummaryRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    flexWrap: "wrap",
    marginTop: 8,
    padding: 12,
    borderRadius: 16,
    background: "rgba(255,255,255,0.06)",
    color: "#e2e8f0",
    border: "1px solid rgba(255,255,255,0.1)",
    fontSize: 13,
    fontWeight: 850,
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

  errorBox: {
    marginTop: 10,
    padding: 12,
    borderRadius: 14,
    background: "#fee2e2",
    color: "#991b1b",
    fontWeight: 900,
  },

  checkout: {
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
};
