"use client";

import { useMemo, useState, type CSSProperties } from "react";

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

function moneyFromCents(cents: number | null | undefined) {
  return (Number(cents || 0) / 100).toFixed(2);
}

function seatLabel(seat: Seat) {
  if (seat.table_number) {
    return `Table ${seat.table_number}, Seat ${seat.seat_number}`;
  }

  return `Row ${seat.row_label}, Seat ${seat.seat_number}`;
}

function getDefaultGuestData(): GuestData {
  return {
    guestName: "",
    dietaryRequirements: "",
    menuChoice: "",
    tableName: "",
  };
}

export default function PublicSeatSelector({
  eventId,
  eventType,
  seats,
  ticketTypes,
  currency,
  menuOptions = [],
}: {
  eventId: string;
  eventType: string;
  seats: Seat[];
  ticketTypes: TicketType[];
  currency: string;
  menuOptions?: string[];
}) {
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [guestData, setGuestData] = useState<Record<string, GuestData>>({});
  const [checkoutError, setCheckoutError] = useState("");
  const [isCheckingOut, setIsCheckingOut] = useState(false);

  const selectedSeatIds = cartItems.map((item) => item.seatId);
  const isTables = eventType === "tables";

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

  async function startCheckout() {
    if (cartItems.length === 0 || isCheckingOut) return;

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
          items: cartItems.map((item) => {
            const data = guestData[item.seatId] || getDefaultGuestData();

            return {
              seatId: item.seatId,
              ticketTypeId: item.ticketTypeId,
              guestName: data.guestName,
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
      <div style={styles.grid}>
        <div style={styles.mapPanel}>
          <div style={styles.legend}>
            <span style={styles.legendItem}>
              <span style={{ ...styles.legendDot, background: "#34d399" }} />
              Available
            </span>
            <span style={styles.legendItem}>
              <span style={{ ...styles.legendDot, background: "#7dd3fc" }} />
              Selected
            </span>
            <span style={styles.legendItem}>
              <span style={{ ...styles.legendDot, background: "#64748b" }} />
              Unavailable
            </span>
          </div>

          <div style={styles.map}>
            {seats.map((seat) => {
              const selected = selectedSeatIds.includes(seat.id);
              const unavailable = seat.status !== "available";

              return (
                <button
                  key={seat.id}
                  type="button"
                  onClick={() => toggleSeat(seat)}
                  disabled={unavailable}
                  title={seatLabel(seat)}
                  style={{
                    ...styles.seat,
                    background: selected
                      ? "#7dd3fc"
                      : unavailable
                        ? "#64748b"
                        : "#34d399",
                    color: selected ? "#0f172a" : "#ffffff",
                    opacity: unavailable ? 0.45 : 1,
                    cursor: unavailable ? "not-allowed" : "pointer",
                  }}
                >
                  {seat.seat_number}
                </button>
              );
            })}
          </div>
        </div>

        <aside style={styles.cart}>
          <h3 style={styles.cartTitle}>Your tickets</h3>

          {cartSeats.length === 0 ? (
            <div style={styles.emptyBox}>No seats selected.</div>
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
                    <strong style={styles.seatTitle}>{seatLabel(seat)}</strong>

                    {isTables && (
                      <label style={styles.field}>
                        <span style={styles.label}>Table name / host</span>
                        <input
                          value={data.tableName}
                          onChange={(event) =>
                            updateGuestData(seat.id, {
                              tableName: event.target.value,
                            })
                          }
                          placeholder="e.g. Smith family, Sponsor table"
                          style={styles.input}
                        />
                      </label>
                    )}

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

          {checkoutError ? <div style={styles.errorBox}>{checkoutError}</div> : null}

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
            {isCheckingOut ? "Processing..." : "Checkout"}
          </button>
        </aside>
      </div>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  shell: {
    width: "100%",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) minmax(300px, 380px)",
    gap: 20,
    alignItems: "start",
  },
  mapPanel: {
    padding: 16,
    borderRadius: 18,
    background: "#0f172a",
    border: "1px solid rgba(255,255,255,0.12)",
  },
  legend: {
    display: "flex",
    gap: 12,
    flexWrap: "wrap",
    marginBottom: 14,
    color: "#cbd5e1",
    fontSize: 13,
    fontWeight: 800,
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
  map: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(42px, 1fr))",
    gap: 7,
  },
  seat: {
    minHeight: 40,
    borderRadius: 10,
    border: "none",
    fontWeight: 900,
  },
  cart: {
    padding: 16,
    borderRadius: 18,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "#0f172a",
  },
  cartTitle: {
    margin: "0 0 12px",
    color: "#ffffff",
    fontSize: 22,
    fontWeight: 900,
  },
  emptyBox: {
    padding: 14,
    borderRadius: 14,
    border: "1px dashed rgba(255,255,255,0.18)",
    color: "#94a3b8",
    fontWeight: 800,
  },
  cartList: {
    display: "grid",
    gap: 12,
  },
  cartItem: {
    display: "grid",
    gap: 10,
    padding: 12,
    border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: 14,
    background: "rgba(255,255,255,0.04)",
  },
  seatTitle: {
    color: "#ffffff",
    fontSize: 15,
  },
  field: {
    display: "grid",
    gap: 5,
  },
  label: {
    color: "#cbd5e1",
    fontSize: 12,
    fontWeight: 900,
  },
  input: {
    width: "100%",
    minHeight: 40,
    padding: "9px 10px",
    borderRadius: 10,
    border: "1px solid #cbd5e1",
    background: "#ffffff",
    color: "#0f172a",
    fontSize: 14,
    boxSizing: "border-box",
  },
  textarea: {
    width: "100%",
    padding: "9px 10px",
    borderRadius: 10,
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
    padding: 12,
    borderRadius: 14,
    background: "rgba(250,204,21,0.12)",
    color: "#fde68a",
    fontWeight: 900,
  },
  checkout: {
    marginTop: 14,
    width: "100%",
    padding: 13,
    borderRadius: 999,
    background: "#1683f8",
    color: "#ffffff",
    border: "none",
    fontWeight: 900,
  },
  errorBox: {
    marginTop: 10,
    padding: 10,
    borderRadius: 12,
    background: "#fee2e2",
    color: "#991b1b",
    fontWeight: 900,
  },
};
