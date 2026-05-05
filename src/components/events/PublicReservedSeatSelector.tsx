"use client";

import { useMemo, useState, type CSSProperties } from "react";
import BuyerDetailsFields from "@/components/events/BuyerDetailsFields";

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

  if (status === "blocked") {
    return {
      minWidth: 32,
      width: 32,
      height: 32,
      borderRadius: 8,
      border: selected ? "1px solid #0284c7" : "1px solid #64748b",
      background: selected ? "#bae6fd" : "#334155",
      color: selected ? "#082f49" : "#e2e8f0",
      boxShadow: selected ? "0 0 0 3px rgba(14,165,233,0.35)" : "none",
      fontSize: 12,
      fontWeight: 900,
      cursor: "not-allowed",
      opacity: 0.9,
      padding: 0,
      boxSizing: "border-box",
    };
  }

  if (status === "sold") {
    return {
      minWidth: 32,
      width: 32,
      height: 32,
      borderRadius: 8,
      border: selected ? "1px solid #0284c7" : "1px solid #991b1b",
      background: selected ? "#bae6fd" : "#fecaca",
      color: selected ? "#082f49" : "#7f1d1d",
      boxShadow: selected ? "0 0 0 3px rgba(14,165,233,0.35)" : "none",
      fontSize: 12,
      fontWeight: 900,
      cursor: "not-allowed",
      opacity: 0.9,
      padding: 0,
      boxSizing: "border-box",
    };
  }

  if (status === "reserved") {
    return {
      minWidth: 32,
      width: 32,
      height: 32,
      borderRadius: 8,
      border: selected ? "1px solid #0284c7" : "1px solid #f59e0b",
      background: selected ? "#bae6fd" : "#fef3c7",
      color: selected ? "#082f49" : "#92400e",
      boxShadow: selected ? "0 0 0 3px rgba(14,165,233,0.35)" : "none",
      fontSize: 12,
      fontWeight: 900,
      cursor: "not-allowed",
      opacity: 0.9,
      padding: 0,
      boxSizing: "border-box",
    };
  }

  return {
    minWidth: 32,
    width: 32,
    height: 32,
    borderRadius: 8,
    border: selected ? "1px solid #0284c7" : "1px solid #cbd5e1",
    background: selected ? "#bae6fd" : colour.background,
    color: selected ? "#082f49" : colour.text,
    boxShadow: selected ? "0 0 0 3px rgba(14,165,233,0.35)" : "none",
    fontSize: 12,
    fontWeight: 900,
    cursor: "pointer",
    padding: 0,
    boxSizing: "border-box",
  };
}

export default function PublicReservedSeatSelector({
  eventId,
  seats,
  ticketTypes,
  currency,
  menuOptions = [],
  initialSeatingLayout = {},
}: {
  eventId: string;
  eventType?: string;
  seats: Seat[];
  ticketTypes: TicketType[];
  currency: string;
  menuOptions?: string[];
  initialSeatingLayout?: Record<string, number>;
}) {
  const [buyerName, setBuyerName] = useState("");
  const [buyerEmail, setBuyerEmail] = useState("");
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [guestData, setGuestData] = useState<Record<string, GuestData>>({});
  const [checkoutError, setCheckoutError] = useState("");
  const [isCheckingOut, setIsCheckingOut] = useState(false);

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

  const total = cartSeats.reduce(
    (sum, item) => sum + Number(item.ticketType.price || 0),
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
    <div style={styles.shell}>
      <div style={styles.mapPanel}>
        <div style={styles.mapHeader}>
          <div>
            <h3 style={styles.mapTitle}>Seat map</h3>
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

        <div style={styles.stage}>STAGE</div>

        <div style={styles.seatMapScroll}>
          {Object.entries(groupedSections)
            .sort(([a], [b]) => numericSort(a, b))
            .map(([section, sectionSeats]) => {
              const rows = groupBy(sectionSeats, (seat) => seat.row_label || "No row");

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
                      Math.floor((maxUnits - rowVisualUnits(currentRowSeats)) / 2),
                    );

                    const manualOffset = initialSeatingLayout[actualKey] || 0;
                    const totalOffset = Math.max(0, autoOffset + manualOffset);

                    return (
                      <div key={`${section}-${row}`} style={styles.rowLine}>
                        <div style={styles.rowButton}>Row {row}</div>

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
      </div>

      <aside style={styles.cart}>
        <div style={styles.cartGrid}>
          <div>
            <BuyerDetailsFields
              buyerName={buyerName}
              buyerEmail={buyerEmail}
              onBuyerNameChange={setBuyerName}
              onBuyerEmailChange={setBuyerEmail}
              dark
            />
          </div>

          <div>
            <div style={styles.cartTop}>
              <div>
                <p style={styles.cartEyebrow}>Booking summary</p>
                <h3 style={styles.cartTitle}>Your tickets</h3>
              </div>

              <div style={styles.countBadge}>{cartSeats.length}</div>
            </div>

            {cartSeats.length === 0 ? (
              <div style={styles.emptyBox}>
                <div style={styles.emptyIcon}>🎟️</div>
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
              <span>Total</span>
              <strong>
                {currency} {moneyFromCents(total)}
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
              {isCheckingOut ? "Processing..." : "Continue to checkout"}
            </button>
          </div>
        </div>
      </aside>
    </div>
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
    gridTemplateColumns: "minmax(0, 1fr)",
    gap: 24,
    alignItems: "start",
    width: "100%",
  },
  mapPanel: {
    padding: 20,
    borderRadius: 24,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    boxShadow: "0 2px 12px rgba(15,23,42,0.05)",
    width: "100%",
    boxSizing: "border-box",
  },
  mapHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: 16,
    alignItems: "flex-start",
    flexWrap: "wrap",
    marginBottom: 16,
  },
  mapTitle: {
    margin: 0,
    color: "#111827",
    fontSize: 26,
    fontWeight: 950,
    letterSpacing: "-0.03em",
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
    gap: 10,
    flexWrap: "wrap",
    color: "#334155",
    fontSize: 12,
    fontWeight: 900,
    alignItems: "center",
  },
  legendItem: {
    display: "inline-flex",
    gap: 6,
    alignItems: "center",
    whiteSpace: "nowrap",
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 999,
    border: "1px solid rgba(15,23,42,0.12)",
  },
  stage: {
    width: "100%",
    minWidth: 1080,
    padding: "10px 14px",
    marginBottom: 16,
    borderRadius: 14,
    background: "#111827",
    color: "#ffffff",
    textAlign: "center",
    fontWeight: 950,
    letterSpacing: "0.14em",
    fontSize: 12,
    boxSizing: "border-box",
  },
  seatMapScroll: {
    maxHeight: 620,
    overflow: "auto",
    padding: 14,
    borderRadius: 16,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
  },
  groupBlock: {
    display: "grid",
    gap: 10,
    minWidth: "max-content",
    marginBottom: 22,
  },
  groupTitle: {
    margin: 0,
    color: "#334155",
    fontSize: 13,
    fontWeight: 900,
    textTransform: "uppercase",
    letterSpacing: "0.06em",
  },
  rowLine: {
    display: "grid",
    gridTemplateColumns: "80px 1fr",
    gap: 10,
    alignItems: "center",
  },
  rowButton: {
    minHeight: 32,
    borderRadius: 10,
    border: "1px solid #cbd5e1",
    background: "#ffffff",
    color: "#0f172a",
    fontSize: 12,
    fontWeight: 900,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    whiteSpace: "nowrap",
  },
  seatLine: {
    display: "flex",
    alignItems: "center",
    gap: 4,
    flexWrap: "nowrap",
  },
  seatWrap: {
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
  },
  aisle: {
    width: 48,
    height: 28,
    borderRadius: 8,
    border: "1px dashed #f59e0b",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 9,
    fontWeight: 900,
    color: "#92400e",
    background: "#fef3c7",
    margin: "0 6px",
  },
  cart: {
    padding: 18,
    borderRadius: 28,
    border: "1px solid rgba(255,255,255,0.12)",
    background:
      "linear-gradient(180deg, rgba(15,23,42,0.98), rgba(2,6,23,0.98))",
    boxShadow: "0 24px 60px rgba(0,0,0,0.32)",
    width: "100%",
    boxSizing: "border-box",
  },
  cartGrid: {
    display: "grid",
    gridTemplateColumns: "minmax(280px, 360px) minmax(0, 1fr)",
    gap: 18,
    alignItems: "start",
  },
  cartTop: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "center",
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
    margin: "4px 0 0",
    color: "#ffffff",
    fontSize: 26,
    fontWeight: 950,
    letterSpacing: "-0.03em",
  },
  countBadge: {
    width: 42,
    height: 42,
    borderRadius: 999,
    background: "#facc15",
    color: "#111827",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 950,
    fontSize: 18,
    flex: "0 0 auto",
  },
  emptyBox: {
    padding: 22,
    borderRadius: 22,
    border: "1px dashed rgba(255,255,255,0.18)",
    background: "rgba(255,255,255,0.04)",
    textAlign: "center",
  },
  emptyIcon: {
    fontSize: 32,
  },
  emptyTitle: {
    margin: "8px 0 0",
    color: "#ffffff",
    fontWeight: 950,
  },
  emptyText: {
    margin: "4px 0 0",
    color: "#94a3b8",
    fontSize: 13,
    lineHeight: 1.4,
  },
  cartList: {
    display: "grid",
    gap: 13,
    maxHeight: "58vh",
    overflow: "auto",
    paddingRight: 4,
  },
  cartItem: {
    display: "grid",
    gap: 10,
    padding: 14,
    border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: 20,
    background: "rgba(255,255,255,0.055)",
  },
  cartItemHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: 10,
    alignItems: "flex-start",
  },
  cartSeatLabel: {
    margin: 0,
    color: "#ffffff",
    fontWeight: 950,
    fontSize: 15,
  },
  cartPrice: {
    margin: "3px 0 0",
    color: "#facc15",
    fontWeight: 950,
    fontSize: 13,
  },
  removeButton: {
    border: "1px solid rgba(248,113,113,0.35)",
    background: "rgba(127,29,29,0.25)",
    color: "#fecaca",
    borderRadius: 999,
    padding: "7px 10px",
    fontWeight: 900,
    cursor: "pointer",
  },
  field: {
    display: "grid",
    gap: 5,
  },
  label: {
    color: "#cbd5e1",
    fontSize: 12,
    fontWeight: 950,
  },
  input: {
    width: "100%",
    minHeight: 42,
    padding: "10px 11px",
    borderRadius: 13,
    border: "1px solid #cbd5e1",
    background: "#ffffff",
    color: "#0f172a",
    fontSize: 14,
    boxSizing: "border-box",
  },
  textarea: {
    width: "100%",
    padding: "10px 11px",
    borderRadius: 13,
    border: "1px solid #cbd5e1",
    background: "#ffffff",
    color: "#0f172a",
    fontSize: 14,
    resize: "vertical",
    boxSizing: "border-box",
  },
  totalBox: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    marginTop: 14,
    padding: 15,
    borderRadius: 18,
    background: "rgba(250,204,21,0.14)",
    color: "#fde68a",
    fontWeight: 950,
    fontSize: 18,
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
  errorBox: {
    marginTop: 10,
    padding: 12,
    borderRadius: 14,
    background: "#fee2e2",
    color: "#991b1b",
    fontWeight: 900,
  },
};
