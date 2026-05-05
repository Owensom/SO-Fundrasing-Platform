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

type SeatCell =
  | {
      type: "seat";
      seat: Seat;
      key: string;
    }
  | {
      type: "aisle";
      key: string;
    };

function moneyFromCents(cents: number | null | undefined) {
  return (Number(cents || 0) / 100).toFixed(2);
}

function seatLabel(seat: Seat) {
  return `Row ${seat.row_label}, Seat ${seat.seat_number}`;
}

function rowSortValue(value: string | null) {
  const text = String(value || "");
  const number = Number(text);

  if (Number.isFinite(number)) return number;

  return text.toUpperCase().charCodeAt(0);
}

function sortSeatNumber(a: Seat, b: Seat) {
  const aNumber = Number(a.seat_number);
  const bNumber = Number(b.seat_number);

  if (Number.isFinite(aNumber) && Number.isFinite(bNumber)) {
    return aNumber - bNumber;
  }

  return String(a.seat_number || "").localeCompare(String(b.seat_number || ""));
}

function getDefaultGuestData(): GuestData {
  return {
    guestName: "",
    dietaryRequirements: "",
    menuChoice: "",
    tableName: "",
  };
}

function buildRowCells(rowSeats: Seat[]): SeatCell[] {
  const cells: SeatCell[] = [];

  for (const seat of rowSeats) {
    cells.push({
      type: "seat",
      seat,
      key: seat.id,
    });

    const seatNumber = Number(seat.seat_number);

    if (
      seat.aisle_after &&
      Number.isFinite(seatNumber) &&
      seatNumber === Number(seat.aisle_after)
    ) {
      cells.push({
        type: "aisle",
        key: `${seat.id}-aisle`,
      });
    }
  }

  return cells;
}

export default function PublicReservedSeatSelector({
  eventId,
  seats,
  ticketTypes,
  currency,
  menuOptions = [],
}: {
  eventId: string;
  eventType?: string;
  seats: Seat[];
  ticketTypes: TicketType[];
  currency: string;
  menuOptions?: string[];
}) {
  const [buyerName, setBuyerName] = useState("");
  const [buyerEmail, setBuyerEmail] = useState("");
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [guestData, setGuestData] = useState<Record<string, GuestData>>({});
  const [checkoutError, setCheckoutError] = useState("");
  const [isCheckingOut, setIsCheckingOut] = useState(false);

  const selectedSeatIds = cartItems.map((item) => item.seatId);

  const groupedRows = useMemo(() => {
    const rowSeats = seats.filter((seat) => seat.row_label && !seat.table_number);
    const groups = new Map<string, Seat[]>();

    for (const seat of rowSeats) {
      const section = seat.section || "Main";
      const row = seat.row_label || "Unlabelled";
      const key = `${section}|||${row}`;
      const existing = groups.get(key) || [];
      existing.push(seat);
      groups.set(key, existing);
    }

    return Array.from(groups.entries())
      .map(([key, groupSeats]) => {
        const [section, row] = key.split("|||");
        const sortedSeats = groupSeats.sort(sortSeatNumber);
        const cells = buildRowCells(sortedSeats);

        return {
          key,
          section,
          row,
          seats: sortedSeats,
          cells,
        };
      })
      .sort((a, b) => {
        const sectionCompare = a.section.localeCompare(b.section);
        if (sectionCompare !== 0) return sectionCompare;
        return rowSortValue(a.row) - rowSortValue(b.row);
      });
  }, [seats]);

  const maxCellCount = Math.max(
    1,
    ...groupedRows.map((group) => group.cells.length),
  );

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
            <Legend color="#bbf7d0" label="Available" />
            <Legend color="#60a5fa" label="Selected" />
            <Legend color="#cbd5e1" label="Unavailable" />
          </div>
        </div>

        <div style={styles.seatMapScroll}>
          <div style={styles.stage}>STAGE</div>

          <div style={styles.rows}>
            {groupedRows.map((group, index) => {
              const showSection =
                index === 0 || groupedRows[index - 1]?.section !== group.section;

              return (
                <div key={group.key}>
                  {showSection && (
                    <div style={styles.sectionLabel}>
                      {group.section.toUpperCase()}
                    </div>
                  )}

                  <div style={styles.rowLine}>
                    <div style={styles.rowLabel}>Row {group.row}</div>

                    <div
                      style={{
                        ...styles.rowSeatsGrid,
                        gridTemplateColumns: `repeat(${maxCellCount}, 42px)`,
                      }}
                    >
                      {group.cells.map((cell) => {
                        if (cell.type === "aisle") {
                          return (
                            <span key={cell.key} style={styles.aisle}>
                              Aisle
                            </span>
                          );
                        }

                        const seat = cell.seat;
                        const selected = selectedSeatIds.includes(seat.id);
                        const unavailable = seat.status !== "available";

                        return (
                          <button
                            key={cell.key}
                            type="button"
                            onClick={() => toggleSeat(seat)}
                            disabled={unavailable}
                            title={seatLabel(seat)}
                            style={{
                              ...styles.seatButton,
                              background: selected
                                ? "#60a5fa"
                                : unavailable
                                  ? "#e2e8f0"
                                  : "#dcfce7",
                              borderColor: selected
                                ? "#3b82f6"
                                : unavailable
                                  ? "#cbd5e1"
                                  : "#bbf7d0",
                              color: selected
                                ? "#ffffff"
                                : unavailable
                                  ? "#64748b"
                                  : "#14532d",
                              cursor: unavailable ? "not-allowed" : "pointer",
                              opacity: unavailable ? 0.7 : 1,
                            }}
                          >
                            {seat.seat_number}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
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
    borderRadius: 28,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    boxShadow: "0 18px 44px rgba(15,23,42,0.12)",
    width: "100%",
    maxWidth: "100%",
    boxSizing: "border-box",
    overflow: "hidden",
  },
  mapHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: 16,
    alignItems: "flex-start",
    flexWrap: "wrap",
    marginBottom: 18,
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
  seatMapScroll: {
    overflowX: "auto",
    overflowY: "hidden",
    padding: 16,
    borderRadius: 22,
    border: "1px solid #e2e8f0",
    background: "#f8fafc",
    width: "100%",
    maxWidth: "100%",
    boxSizing: "border-box",
  },
  stage: {
    width: "100%",
    minWidth: 1080,
    padding: "11px 14px",
    marginBottom: 18,
    borderRadius: 16,
    background: "#111827",
    color: "#ffffff",
    textAlign: "center",
    fontWeight: 950,
    letterSpacing: "0.16em",
    fontSize: 12,
    boxSizing: "border-box",
  },
  rows: {
    display: "grid",
    gap: 9,
    minWidth: 1080,
  },
  sectionLabel: {
    margin: "14px 0 8px",
    color: "#334155",
    fontSize: 13,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
  },
  rowLine: {
    display: "grid",
    gridTemplateColumns: "96px minmax(max-content, 1fr)",
    gap: 10,
    alignItems: "center",
  },
  rowLabel: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 38,
    padding: "0 10px",
    borderRadius: 12,
    background: "#ffffff",
    border: "1px solid #cbd5e1",
    color: "#111827",
    fontSize: 13,
    fontWeight: 950,
    whiteSpace: "nowrap",
    boxShadow: "0 1px 2px rgba(15,23,42,0.05)",
  },
  rowSeatsGrid: {
    display: "grid",
    gap: 7,
    alignItems: "center",
    justifyContent: "start",
    minHeight: 40,
  },
  seatButton: {
    width: 42,
    height: 38,
    borderRadius: 10,
    border: "1px solid",
    fontSize: 13,
    fontWeight: 950,
    boxShadow: "0 1px 3px rgba(15,23,42,0.08)",
    padding: 0,
  },
  aisle: {
    width: 42,
    height: 34,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    border: "1px dashed #f59e0b",
    background: "#fffbeb",
    color: "#92400e",
    fontSize: 9,
    fontWeight: 950,
    boxSizing: "border-box",
  },
  cart: {
    padding: 18,
    borderRadius: 28,
    border: "1px solid rgba(255,255,255,0.12)",
    background:
      "linear-gradient(180deg, rgba(15,23,42,0.98), rgba(2,6,23,0.98))",
    boxShadow: "0 24px 60px rgba(0,0,0,0.32)",
    width: "100%",
    maxWidth: "100%",
    boxSizing: "border-box",
  },
  cartGrid: {
    display: "grid",
    gridTemplateColumns: "minmax(260px, 360px) minmax(0, 1fr)",
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
