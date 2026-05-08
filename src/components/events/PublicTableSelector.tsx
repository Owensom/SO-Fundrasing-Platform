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
  table_name?: string | null;
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
};

function moneyFromCents(cents: number | null | undefined) {
  return (Number(cents || 0) / 100).toFixed(2);
}

function calculatePlatformFeeCents(subtotalCents: number) {
  if (!subtotalCents || subtotalCents <= 0) return 0;
  return Math.max(0, Math.ceil(subtotalCents * 0.02 + 20));
}

function tableSortValue(value: string | null | undefined) {
  const number = Number(value);
  if (Number.isFinite(number)) return number;
  return Number.MAX_SAFE_INTEGER;
}

function seatLabel(seat: Seat) {
  const tableLabel = seat.table_name
    ? seat.table_name
    : `Table ${seat.table_number || "Unassigned"}`;

  return `${tableLabel}, Seat ${seat.seat_number || "?"}`;
}

function statusLabel(status: string) {
  if (status === "reserved") return "Reserved";
  if (status === "sold") return "Sold";
  if (status === "blocked") return "Blocked";
  return "Available";
}

function seatHoverLabel(
  seat: Seat,
  ticketType: TicketType | undefined,
  currency: string,
) {
  const priceLine = ticketType
    ? `${ticketType.name} — ${currency} ${moneyFromCents(ticketType.price)}`
    : "Ticket price unavailable";

  return `${seatLabel(seat)}
${priceLine}
Status: ${statusLabel(seat.status)}`;
}

function groupLabel(seat: Seat) {
  if (seat.table_name) return seat.table_name;
  return `Table ${seat.table_number || "Unassigned"}`;
}

function sortSeatNumber(a: Seat, b: Seat) {
  const aNumber = Number(a.seat_number);
  const bNumber = Number(b.seat_number);

  if (Number.isFinite(aNumber) && Number.isFinite(bNumber)) {
    return aNumber - bNumber;
  }

  return String(a.seat_number || "").localeCompare(String(b.seat_number || ""));
}

function getDefaultGuest(): GuestData {
  return {
    guestName: "",
    dietaryRequirements: "",
    menuChoice: "",
  };
}

function seatColours(status: string, selected: boolean) {
  if (selected) {
    return {
      background: "#2563eb",
      color: "#ffffff",
      border: "2px solid #93c5fd",
      opacity: 1,
      boxShadow: "0 12px 26px rgba(37,99,235,0.32)",
    };
  }

  if (status === "reserved") {
    return {
      background: "#f59e0b",
      color: "#451a03",
      border: "2px solid #fbbf24",
      opacity: 0.92,
      boxShadow: "0 10px 18px rgba(245,158,11,0.18)",
    };
  }

  if (status === "sold") {
    return {
      background: "#ef4444",
      color: "#ffffff",
      border: "2px solid #f87171",
      opacity: 0.92,
      boxShadow: "0 10px 18px rgba(239,68,68,0.18)",
    };
  }

  if (status === "blocked") {
    return {
      background: "#64748b",
      color: "#ffffff",
      border: "2px solid #94a3b8",
      opacity: 0.72,
      boxShadow: "none",
    };
  }

  return {
    background: "#16a34a",
    color: "#ffffff",
    border: "2px solid #86efac",
    opacity: 1,
    boxShadow: "0 10px 18px rgba(22,163,74,0.18)",
  };
}

function seatPosition(index: number, total: number) {
  const angle = -90 + (360 / Math.max(total, 1)) * index;
  const radians = (angle * Math.PI) / 180;
  const radius = 104;

  return {
    left: `calc(50% + ${Math.cos(radians) * radius}px)`,
    top: `calc(50% + ${Math.sin(radians) * radius}px)`,
  };
}

export default function PublicTableSelector({
  eventId,
  seats,
  ticketTypes,
  currency,
  menuOptions = [],
}: {
  eventId: string;
  seats: Seat[];
  ticketTypes: TicketType[];
  currency: string;
  menuOptions?: string[];
}) {
  const [buyerName, setBuyerName] = useState("");
  const [buyerEmail, setBuyerEmail] = useState("");
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [guestData, setGuestData] = useState<Record<string, GuestData>>({});
  const [coverFees, setCoverFees] = useState(false);
  const [checkoutError, setCheckoutError] = useState("");
  const [isCheckingOut, setIsCheckingOut] = useState(false);

  const selectedSeatIds = cartItems.map((item) => item.seatId);

  const groupedSeats = useMemo(() => {
    const groups = new Map<string, Seat[]>();

    for (const seat of seats.filter((seat) => seat.table_number)) {
      const label = groupLabel(seat);
      const existing = groups.get(label) || [];
      existing.push(seat);
      groups.set(label, existing);
    }

    return Array.from(groups.entries())
      .map(([label, groupSeats]) => ({
        label,
        tableNumber: groupSeats[0]?.table_number || "",
        seats: groupSeats.slice().sort(sortSeatNumber),
      }))
      .sort((a, b) => {
        const aNumber = tableSortValue(a.tableNumber);
        const bNumber = tableSortValue(b.tableNumber);

        if (aNumber !== bNumber) return aNumber - bNumber;
        return a.label.localeCompare(b.label);
      });
  }, [seats]);

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

  const ticketTotal = cartSeats.reduce(
    (sum, item) => sum + Number(item.ticketType.price || 0),
    0,
  );

  const platformFeeCents = coverFees
    ? calculatePlatformFeeCents(ticketTotal)
    : 0;

  const totalTodayCents = ticketTotal + platformFeeCents;
    function getSeatTicketType(seat: Seat) {
    const cartTicketTypeId = cartItems.find(
      (item) => item.seatId === seat.id,
    )?.ticketTypeId;

    const ticketTypeId =
      cartTicketTypeId || seat.ticket_type_id || ticketTypes[0]?.id;

    return ticketTypes.find((ticketType) => ticketType.id === ticketTypeId);
  }

  function updateGuestData(seatId: string, patch: Partial<GuestData>) {
    setGuestData((current) => ({
      ...current,
      [seatId]: {
        ...getDefaultGuest(),
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

  function selectAvailableTable(groupSeats: Seat[]) {
    setCartItems((current) => {
      const existingIds = new Set(current.map((item) => item.seatId));

      const additions = groupSeats
        .filter((seat) => seat.status === "available")
        .filter((seat) => !existingIds.has(seat.id))
        .map((seat) => ({
          seatId: seat.id,
          ticketTypeId: seat.ticket_type_id || ticketTypes[0]?.id || "",
        }))
        .filter((item) => item.ticketTypeId);

      return [...current, ...additions];
    });
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
          coverFees,
          platformFeeCents,
          items: cartItems.map((item) => {
            const data = guestData[item.seatId] || getDefaultGuest();

            return {
              seatId: item.seatId,
              ticketTypeId: item.ticketTypeId,
              guestName: data.guestName,
              dietary: data.dietaryRequirements,
              dietaryRequirements: data.dietaryRequirements,
              menuChoice: data.menuChoice,
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
          @media (max-width: 900px) {
            .public-table-selector-shell {
              grid-template-columns: 1fr !important;
            }

            .public-table-selector-cart {
              position: static !important;
            }

            .public-table-selector-cart-grid {
              grid-template-columns: 1fr !important;
            }

            .public-table-selector-table-grid {
              grid-template-columns: 1fr !important;
            }
          }
        `}
      </style>

      <div className="public-table-selector-shell" style={styles.shell}>
        <div style={styles.mapPanel}>
          <div style={styles.mapHeader}>
            <div>
              <h3 style={styles.mapTitle}>Table layout</h3>
              <p style={styles.mapText}>
                Choose individual table seats or select every available seat at a
                table.
              </p>
            </div>

            <div style={styles.legend}>
              <Legend color="#16a34a" label="Available" />
              <Legend color="#2563eb" label="Selected" />
              <Legend color="#f59e0b" label="Reserved" />
              <Legend color="#ef4444" label="Sold" />
              <Legend color="#64748b" label="Blocked" />
            </div>
          </div>

          {groupedSeats.length === 0 ? (
            <div style={styles.emptyMap}>
              No table seats are available for this event yet.
            </div>
          ) : (
            <div
              className="public-table-selector-table-grid"
              style={styles.tableGrid}
            >
              {groupedSeats.map((group) => {
                const availableCount = group.seats.filter(
                  (seat) => seat.status === "available",
                ).length;

                const selectedCount = group.seats.filter((seat) =>
                  selectedSeatIds.includes(seat.id),
                ).length;

                return (
                  <div
                    key={`${group.tableNumber}-${group.label}`}
                    style={styles.groupCard}
                  >
                    <div style={styles.groupHeader}>
                      <div>
                        <p style={styles.tableNumber}>
                          Table {group.tableNumber || "Unassigned"}
                        </p>
                        <h4 style={styles.groupTitle}>{group.label}</h4>
                        <p style={styles.groupSub}>
                          {availableCount} available from {group.seats.length}
                          {selectedCount > 0 ? ` · ${selectedCount} selected` : ""}
                        </p>
                      </div>

                      {availableCount > 0 && (
                        <button
                          type="button"
                          onClick={() => selectAvailableTable(group.seats)}
                          style={styles.selectTableButton}
                        >
                          Select table
                        </button>
                      )}
                    </div>
                                        <div style={styles.roundTableArea}>
                      <div style={styles.tablePlate}>
                        <span style={styles.tablePlateTop}>
                          Table {group.tableNumber || "—"}
                        </span>
                        <strong style={styles.tablePlateName}>{group.label}</strong>
                      </div>

                      {group.seats.map((seat, index) => {
                        const selected = selectedSeatIds.includes(seat.id);
                        const unavailable = seat.status !== "available";
                        const colours = seatColours(seat.status, selected);
                        const position = seatPosition(index, group.seats.length);

                        return (
                          <button
                            key={seat.id}
                            type="button"
                            disabled={unavailable}
                            onClick={() => toggleSeat(seat)}
                            title={seatHoverLabel(
                              seat,
                              getSeatTicketType(seat),
                              currency,
                            )}
                            style={{
                              ...styles.roundSeatButton,
                              ...position,
                              background: colours.background,
                              color: colours.color,
                              border: colours.border,
                              opacity: colours.opacity,
                              cursor: unavailable ? "not-allowed" : "pointer",
                              boxShadow: colours.boxShadow,
                            }}
                          >
                            {seat.seat_number}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <aside className="public-table-selector-cart" style={styles.cart}>
          <div className="public-table-selector-cart-grid" style={styles.cartGrid}>
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
                  <p style={styles.emptyTitle}>Select table seats to begin</p>
                  <p style={styles.emptyText}>
                    Your selected seats and guest details will appear here.
                  </p>
                </div>
              ) : (
                <div style={styles.cartList}>
                  {cartSeats.map(({ seat, ticketType }) => {
                    const data = guestData[seat.id] || getDefaultGuest();
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
                <span>Ticket total</span>
                <strong>
                  {currency} {moneyFromCents(ticketTotal)}
                </strong>
              </div>

              <label style={styles.feeBox}>
                <input
                  type="checkbox"
                  checked={coverFees}
                  onChange={(event) => setCoverFees(event.target.checked)}
                  disabled={ticketTotal <= 0}
                />
                <span>
                  <strong>I’d like to cover platform fees</strong>
                  <small>
                    Adds approximately {currency}{" "}
                    {moneyFromCents(calculatePlatformFeeCents(ticketTotal))} so
                    the organiser receives the full ticket value.
                  </small>
                </span>
              </label>

              <div style={styles.totalBoxStrong}>
                <span>Total today</span>
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
                {isCheckingOut ? "Processing..." : "Continue to checkout"}
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
    gridTemplateColumns: "minmax(0, 1fr) minmax(330px, 420px)",
    gap: 22,
    alignItems: "start",
  },
  mapPanel: {
    padding: 18,
    borderRadius: 28,
    background:
      "linear-gradient(180deg, rgba(15,23,42,0.98), rgba(2,6,23,0.98))",
    border: "1px solid rgba(255,255,255,0.12)",
    boxShadow: "0 24px 60px rgba(0,0,0,0.28)",
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
    color: "#ffffff",
    fontSize: 26,
    fontWeight: 950,
    letterSpacing: "-0.03em",
  },
  mapText: {
    margin: "6px 0 0",
    color: "#94a3b8",
    fontSize: 14,
    lineHeight: 1.45,
    fontWeight: 700,
  },
  legend: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
    color: "#cbd5e1",
    fontSize: 12,
    fontWeight: 900,
  },
  legendItem: {
    display: "inline-flex",
    gap: 6,
    alignItems: "center",
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 999,
  },
  emptyMap: {
    padding: 22,
    borderRadius: 20,
    border: "1px dashed rgba(255,255,255,0.18)",
    background: "rgba(255,255,255,0.04)",
    color: "#cbd5e1",
    fontWeight: 900,
    textAlign: "center",
  },
  tableGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
    gap: 18,
  },
  groupCard: {
    display: "grid",
    gap: 16,
    padding: 16,
    borderRadius: 24,
    background: "rgba(255,255,255,0.055)",
    border: "1px solid rgba(255,255,255,0.1)",
  },
  groupHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "flex-start",
  },
  tableNumber: {
    margin: "0 0 4px",
    color: "#facc15",
    fontSize: 11,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.12em",
  },
  groupTitle: {
    margin: 0,
    color: "#ffffff",
    fontSize: 19,
    fontWeight: 950,
    letterSpacing: "-0.02em",
  },
  groupSub: {
    margin: "5px 0 0",
    color: "#94a3b8",
    fontSize: 13,
    fontWeight: 800,
  },
  selectTableButton: {
    border: "none",
    borderRadius: 999,
    background: "#facc15",
    color: "#111827",
    padding: "10px 13px",
    fontWeight: 950,
    cursor: "pointer",
    whiteSpace: "nowrap",
  },
  roundTableArea: {
    position: "relative",
    width: 292,
    height: 292,
    margin: "0 auto",
    borderRadius: 999,
    background:
      "radial-gradient(circle, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.055) 42%, rgba(15,23,42,0.16) 43%, rgba(15,23,42,0.16) 100%)",
    border: "1px solid rgba(255,255,255,0.08)",
  },
  tablePlate: {
    position: "absolute",
    left: "50%",
    top: "50%",
    width: 142,
    height: 142,
    transform: "translate(-50%, -50%)",
    borderRadius: 999,
    background:
      "linear-gradient(180deg, rgba(255,255,255,0.98), rgba(226,232,240,0.92))",
    border: "1px solid rgba(255,255,255,0.8)",
    boxShadow: "0 18px 45px rgba(0,0,0,0.26)",
    color: "#0f172a",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    textAlign: "center",
    padding: 14,
  },
  tablePlateTop: {
    color: "#64748b",
    fontSize: 11,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.12em",
  },
  tablePlateName: {
    marginTop: 6,
    color: "#0f172a",
    fontSize: 18,
    fontWeight: 950,
    lineHeight: 1.15,
  },
  roundSeatButton: {
    position: "absolute",
    width: 42,
    height: 42,
    transform: "translate(-50%, -50%)",
    borderRadius: 999,
    fontSize: 13,
    fontWeight: 950,
    transition: "box-shadow 140ms ease, transform 140ms ease",
    zIndex: 2,
  },
  cart: {
    position: "sticky",
    top: 18,
    padding: 18,
    borderRadius: 28,
    border: "1px solid rgba(255,255,255,0.12)",
    background:
      "linear-gradient(180deg, rgba(15,23,42,0.98), rgba(2,6,23,0.98))",
    boxShadow: "0 24px 60px rgba(0,0,0,0.32)",
  },
  cartGrid: {
    display: "grid",
    gridTemplateColumns: "1fr",
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
    maxHeight: "48vh",
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
  totalBoxStrong: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    marginTop: 10,
    padding: 15,
    borderRadius: 18,
    background: "rgba(34,197,94,0.16)",
    color: "#bbf7d0",
    fontWeight: 950,
    fontSize: 18,
    border: "1px solid rgba(187,247,208,0.18)",
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
