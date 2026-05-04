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

function moneyFromCents(cents: number | null | undefined) {
  return (Number(cents || 0) / 100).toFixed(2);
}

function seatLabel(seat: Seat) {
  return `Row ${seat.row_label}, Seat ${seat.seat_number}`;
}

function groupLabel(seat: Seat) {
  const section = seat.section ? `${seat.section} · ` : "";
  return `${section}Row ${seat.row_label || "Unlabelled"}`;
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

export default function PublicReservedSeatSelector({
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
  const [buyerName, setBuyerName] = useState("");
  const [buyerEmail, setBuyerEmail] = useState("");
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [guestData, setGuestData] = useState<Record<string, GuestData>>({});
  const [checkoutError, setCheckoutError] = useState("");
  const [isCheckingOut, setIsCheckingOut] = useState(false);

  const selectedSeatIds = cartItems.map((item) => item.seatId);

  const groupedSeats = useMemo(() => {
    const rowSeats = seats.filter((seat) => !seat.table_number);
    const groups = new Map<string, Seat[]>();

    for (const seat of rowSeats) {
      const label = groupLabel(seat);
      const existing = groups.get(label) || [];
      existing.push(seat);
      groups.set(label, existing);
    }

    return Array.from(groups.entries()).map(([label, groupSeats]) => ({
      label,
      seats: groupSeats.sort(sortSeatNumber),
    }));
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
            <Legend color="#22c55e" label="Available" />
            <Legend color="#38bdf8" label="Selected" />
            <Legend color="#64748b" label="Unavailable" />
          </div>
        </div>

        <div style={styles.groups}>
          {groupedSeats.map((group) => {
            const availableCount = group.seats.filter(
              (seat) => seat.status === "available",
            ).length;

            return (
              <div key={group.label} style={styles.groupCard}>
                <div style={styles.groupHeader}>
                  <div>
                    <h4 style={styles.groupTitle}>{group.label}</h4>
                    <p style={styles.groupSub}>
                      {availableCount} available from {group.seats.length}
                    </p>
                  </div>
                </div>

                <div style={styles.seatGrid}>
                  {group.seats.map((seat) => {
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
                          ...styles.seatButton,
                          background: selected
                            ? "#38bdf8"
                            : unavailable
                              ? "#475569"
                              : "#22c55e",
                          color: selected ? "#082f49" : "#ffffff",
                          opacity: unavailable ? 0.45 : 1,
                          cursor: unavailable ? "not-allowed" : "pointer",
                          boxShadow: selected
                            ? "0 0 0 3px rgba(56,189,248,0.24)"
                            : "none",
                        }}
                      >
                        <span style={styles.seatNumber}>{seat.seat_number}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <aside style={styles.cart}>
        <BuyerDetailsFields
          buyerName={buyerName}
          buyerEmail={buyerEmail}
          onBuyerNameChange={setBuyerName}
          onBuyerEmailChange={setBuyerEmail}
          dark
        />

        <div style={styles.divider} />

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
          {isCheckingOut ? "Processing..." : "Continue to checkout"}
        </button>
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
  groups: {
    display: "grid",
    gap: 16,
  },
  groupCard: {
    padding: 16,
    borderRadius: 24,
    background: "rgba(255,255,255,0.055)",
    border: "1px solid rgba(255,255,255,0.1)",
  },
  groupHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "center",
    marginBottom: 14,
  },
  groupTitle: {
    margin: 0,
    color: "#ffffff",
    fontSize: 19,
    fontWeight: 950,
  },
  groupSub: {
    margin: "4px 0 0",
    color: "#94a3b8",
    fontSize: 13,
    fontWeight: 800,
  },
  seatGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(54px, 1fr))",
    gap: 10,
  },
  seatButton: {
    minHeight: 54,
    borderRadius: 16,
    border: "none",
    fontWeight: 950,
    transition: "transform 140ms ease, box-shadow 140ms ease",
  },
  seatNumber: {
    display: "block",
    fontSize: 15,
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
  divider: {
    height: 16,
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
