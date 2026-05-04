"use client";

import { useMemo, useState, type CSSProperties } from "react";

/* ================= TYPES ================= */

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

/* ================= HELPERS ================= */

function moneyFromCents(cents: number | null | undefined) {
  return (Number(cents || 0) / 100).toFixed(2);
}

function seatLabel(seat: Seat) {
  if (seat.table_number) {
    return `Table ${seat.table_number}, Seat ${seat.seat_number}`;
  }
  return `Row ${seat.row_label}, Seat ${seat.seat_number}`;
}

/* ================= COMPONENT ================= */

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
  const [guestData, setGuestData] = useState<
    Record<string, { name: string; dietary: string; menu: string }>
  >({});
  const [checkoutError, setCheckoutError] = useState("");
  const [isCheckingOut, setIsCheckingOut] = useState(false);

  const selectedSeatIds = cartItems.map((item) => item.seatId);

  const cartSeats = useMemo(() => {
    return cartItems
      .map((item) => {
        const seat = seats.find((s) => s.id === item.seatId);
        const ticketType = ticketTypes.find(
          (t) => t.id === item.ticketTypeId,
        );
        if (!seat || !ticketType) return null;
        return { seat, ticketType };
      })
      .filter(Boolean) as { seat: Seat; ticketType: TicketType }[];
  }, [cartItems, seats, ticketTypes]);

  function toggleSeat(seat: Seat) {
    if (seat.status !== "available") return;

    setCartItems((current) => {
      const exists = current.find((c) => c.seatId === seat.id);

      if (exists) {
        return current.filter((c) => c.seatId !== seat.id);
      }

      const ticketTypeId =
        seat.ticket_type_id || ticketTypes[0]?.id || "";

      return [...current, { seatId: seat.id, ticketTypeId }];
    });
  }

  async function startCheckout() {
    if (cartItems.length === 0 || isCheckingOut) return;

    setCheckoutError("");
    setIsCheckingOut(true);

    try {
      const res = await fetch("/api/events/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          eventId,
          items: cartItems.map((item) => ({
            ...item,
            guestName: guestData[item.seatId]?.name,
            dietary: guestData[item.seatId]?.dietary,
            menuChoice: guestData[item.seatId]?.menu,
          })),
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.url) {
        throw new Error(data.error || "Checkout failed");
      }

      window.location.href = data.url;
    } catch (error) {
      setCheckoutError(
        error instanceof Error ? error.message : "Checkout failed",
      );
      setIsCheckingOut(false);
    }
  }

  /* ================= RENDER ================= */

  return (
    <div style={styles.shell}>
      <div style={styles.grid}>
        {/* ===== SEAT MAP ===== */}
        <div style={styles.map}>
          {seats.map((seat) => {
            const selected = selectedSeatIds.includes(seat.id);

            return (
              <button
                key={seat.id}
                type="button"
                onClick={() => toggleSeat(seat)}
                style={{
                  ...styles.seat,
                  background: selected ? "#7dd3fc" : "#34d399",
                  opacity: seat.status !== "available" ? 0.4 : 1,
                }}
              >
                {seat.seat_number}
              </button>
            );
          })}
        </div>

        {/* ===== CART ===== */}
        <aside style={styles.cart}>
          <h3>Your tickets</h3>

          {cartSeats.length === 0 ? (
            <p>No seats selected</p>
          ) : (
            <div style={styles.cartList}>
              {cartSeats.map(({ seat, ticketType }) => {
                const data = guestData[seat.id] || {
                  name: "",
                  dietary: "",
                  menu: "",
                };

                return (
                  <div key={seat.id} style={styles.cartItem}>
                    <strong>{seatLabel(seat)}</strong>

                    <p>
                      {ticketType.name} — {currency}{" "}
                      {moneyFromCents(ticketType.price)}
                    </p>

                    {/* ===== NEW FIELDS ===== */}
                    <div style={styles.inputGroup}>
                      <input
                        placeholder="Guest name"
                        value={data.name}
                        onChange={(e) =>
                          setGuestData({
                            ...guestData,
                            [seat.id]: {
                              ...data,
                              name: e.target.value,
                            },
                          })
                        }
                        style={styles.input}
                      />

                      <input
                        placeholder="Dietary requirements"
                        value={data.dietary}
                        onChange={(e) =>
                          setGuestData({
                            ...guestData,
                            [seat.id]: {
                              ...data,
                              dietary: e.target.value,
                            },
                          })
                        }
                        style={styles.input}
                      />

                      <select
                        value={data.menu}
                        onChange={(e) =>
                          setGuestData({
                            ...guestData,
                            [seat.id]: {
                              ...data,
                              menu: e.target.value,
                            },
                          })
                        }
                        style={styles.input}
                      >
                        <option value="">Select menu</option>
                        {menuOptions.map((opt) => (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {checkoutError && (
            <div style={styles.errorBox}>{checkoutError}</div>
          )}

          <button
            type="button"
            onClick={startCheckout}
            disabled={cartSeats.length === 0 || isCheckingOut}
            style={{
              ...styles.checkout,
              opacity: cartSeats.length === 0 || isCheckingOut ? 0.5 : 1,
            }}
          >
            {isCheckingOut ? "Processing..." : "Checkout"}
          </button>
        </aside>
      </div>
    </div>
  );
}

/* ================= STYLES ================= */

const styles: Record<string, CSSProperties> = {
  shell: { padding: 20 },
  grid: {
    display: "grid",
    gridTemplateColumns: "1fr 340px",
    gap: 20,
  },
  map: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(40px, 1fr))",
    gap: 6,
  },
  seat: {
    height: 40,
    borderRadius: 8,
    border: "none",
    fontWeight: 900,
    cursor: "pointer",
  },
  cart: {
    padding: 16,
    borderRadius: 12,
    border: "1px solid #e2e8f0",
  },
  cartList: {
    display: "grid",
    gap: 10,
  },
  cartItem: {
    padding: 10,
    border: "1px solid #e2e8f0",
    borderRadius: 10,
  },
  inputGroup: {
    display: "grid",
    gap: 6,
    marginTop: 8,
  },
  input: {
    padding: 8,
    borderRadius: 6,
    border: "1px solid #cbd5e1",
  },
  checkout: {
    marginTop: 14,
    width: "100%",
    padding: 12,
    borderRadius: 10,
    background: "#1683f8",
    color: "#fff",
    border: "none",
    fontWeight: 900,
    cursor: "pointer",
  },
  errorBox: {
    marginTop: 10,
    color: "#b91c1c",
    fontWeight: 800,
  },
};
