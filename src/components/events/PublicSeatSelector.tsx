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

type GuestData = {
  guestName: string;
  dietaryRequirements: string;
  menuChoice: string;
  tableName: string;
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

function getDefaultGuestData(): GuestData {
  return {
    guestName: "",
    dietaryRequirements: "",
    menuChoice: "",
    tableName: "",
  };
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
  const [guestData, setGuestData] = useState<Record<string, GuestData>>({});
  const [checkoutError, setCheckoutError] = useState("");
  const [isCheckingOut, setIsCheckingOut] = useState(false);

  const isTables = eventType === "tables";

  const selectedSeatIds = cartItems.map((i) => i.seatId);

  const cartSeats = useMemo(() => {
    return cartItems
      .map((item) => {
        const seat = seats.find((s) => s.id === item.seatId);
        const ticketType = ticketTypes.find((t) => t.id === item.ticketTypeId);
        if (!seat || !ticketType) return null;
        return { seat, ticketType };
      })
      .filter(Boolean) as { seat: Seat; ticketType: TicketType }[];
  }, [cartItems, seats, ticketTypes]);

  const total = cartSeats.reduce(
    (sum, item) => sum + Number(item.ticketType.price || 0),
    0,
  );

  /* ================= ACTIONS ================= */

  function toggleSeat(seat: Seat) {
    if (seat.status !== "available") return;

    setCartItems((current) => {
      const exists = current.find((c) => c.seatId === seat.id);

      if (exists) {
        return current.filter((c) => c.seatId !== seat.id);
      }

      const ticketTypeId =
        seat.ticket_type_id || ticketTypes[0]?.id || "";

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

  async function startCheckout() {
    if (cartItems.length === 0 || isCheckingOut) return;

    setCheckoutError("");
    setIsCheckingOut(true);

    try {
      const res = await fetch("/api/events/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId,
          items: cartItems.map((item) => {
            const data = guestData[item.seatId] || getDefaultGuestData();

            return {
              seatId: item.seatId,
              ticketTypeId: item.ticketTypeId,
              guestName: data.guestName,
              dietary: data.dietaryRequirements,
              menuChoice: data.menuChoice,
              tableName: data.tableName,
            };
          }),
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.url) {
        throw new Error(data.error || "Checkout failed");
      }

      window.location.href = data.url;
    } catch (err) {
      setCheckoutError(
        err instanceof Error ? err.message : "Checkout failed",
      );
      setIsCheckingOut(false);
    }
  }

  /* ================= UI ================= */

  return (
    <div style={styles.wrapper}>
      {/* MAP */}
      <div style={styles.mapPanel}>
        <div style={styles.legend}>
          <Legend color="#34d399" label="Available" />
          <Legend color="#7dd3fc" label="Selected" />
          <Legend color="#64748b" label="Unavailable" />
        </div>

        <div style={styles.map}>
          {seats.map((seat) => {
            const selected = selectedSeatIds.includes(seat.id);
            const unavailable = seat.status !== "available";

            return (
              <button
                key={seat.id}
                onClick={() => toggleSeat(seat)}
                disabled={unavailable}
                style={{
                  ...styles.seat,
                  background: selected
                    ? "#7dd3fc"
                    : unavailable
                      ? "#64748b"
                      : "#34d399",
                  color: selected ? "#0f172a" : "#fff",
                  opacity: unavailable ? 0.4 : 1,
                }}
              >
                {seat.seat_number}
              </button>
            );
          })}
        </div>
      </div>

      {/* CART */}
      <aside style={styles.cart}>
        <h3 style={styles.cartTitle}>Your booking</h3>

        {cartSeats.length === 0 ? (
          <div style={styles.empty}>Select seats to begin</div>
        ) : (
          <>
            <div style={styles.cartList}>
              {cartSeats.map(({ seat, ticketType }) => {
                const data = guestData[seat.id] || getDefaultGuestData();

                const availableTicketTypes = seat.ticket_type_id
                  ? ticketTypes.filter((t) => t.id === seat.ticket_type_id)
                  : ticketTypes;

                return (
                  <div key={seat.id} style={styles.card}>
                    <strong>{seatLabel(seat)}</strong>

                    {isTables && (
                      <input
                        placeholder="Table name"
                        value={data.tableName}
                        onChange={(e) =>
                          updateGuestData(seat.id, {
                            tableName: e.target.value,
                          })
                        }
                        style={styles.input}
                      />
                    )}

                    <select
                      value={ticketType.id}
                      onChange={(e) =>
                        updateTicketType(seat.id, e.target.value)
                      }
                      style={styles.input}
                    >
                      {availableTicketTypes.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name} — {currency} {moneyFromCents(t.price)}
                        </option>
                      ))}
                    </select>

                    <input
                      placeholder="Guest name"
                      value={data.guestName}
                      onChange={(e) =>
                        updateGuestData(seat.id, {
                          guestName: e.target.value,
                        })
                      }
                      style={styles.input}
                    />

                    <textarea
                      placeholder="Dietary requirements"
                      value={data.dietaryRequirements}
                      onChange={(e) =>
                        updateGuestData(seat.id, {
                          dietaryRequirements: e.target.value,
                        })
                      }
                      style={styles.input}
                    />

                    {menuOptions.length > 0 && (
                      <select
                        value={data.menuChoice}
                        onChange={(e) =>
                          updateGuestData(seat.id, {
                            menuChoice: e.target.value,
                          })
                        }
                        style={styles.input}
                      >
                        <option value="">Select menu</option>
                        {menuOptions.map((opt) => (
                          <option key={opt}>{opt}</option>
                        ))}
                      </select>
                    )}
                  </div>
                );
              })}
            </div>

            <div style={styles.total}>
              <span>Total</span>
              <strong>
                {currency} {moneyFromCents(total)}
              </strong>
            </div>

            {checkoutError && <div style={styles.error}>{checkoutError}</div>}

            <button onClick={startCheckout} style={styles.checkout}>
              {isCheckingOut ? "Processing..." : "Checkout"}
            </button>
          </>
        )}
      </aside>
    </div>
  );
}

/* ================= UI HELPERS ================= */

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span style={{ display: "flex", gap: 6, alignItems: "center" }}>
      <span
        style={{
          width: 10,
          height: 10,
          borderRadius: 999,
          background: color,
        }}
      />
      {label}
    </span>
  );
}

/* ================= STYLES ================= */

const styles: Record<string, CSSProperties> = {
  wrapper: {
    display: "grid",
    gridTemplateColumns: "1fr 360px",
    gap: 20,
  },
  mapPanel: {
    padding: 16,
    borderRadius: 18,
    background: "#0f172a",
  },
  legend: {
    display: "flex",
    gap: 12,
    marginBottom: 10,
    fontSize: 12,
  },
  map: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(40px,1fr))",
    gap: 6,
  },
  seat: {
    height: 40,
    borderRadius: 8,
    border: "none",
    fontWeight: 900,
  },
  cart: {
    padding: 16,
    borderRadius: 18,
    background: "#0f172a",
  },
  cartTitle: {
    fontSize: 22,
    fontWeight: 900,
    marginBottom: 10,
  },
  empty: {
    color: "#94a3b8",
  },
  cartList: {
    display: "grid",
    gap: 10,
  },
  card: {
    padding: 10,
    borderRadius: 12,
    background: "#020617",
    display: "grid",
    gap: 6,
  },
  input: {
    padding: 8,
    borderRadius: 6,
    border: "1px solid #334155",
    background: "#fff",
  },
  total: {
    display: "flex",
    justifyContent: "space-between",
    marginTop: 10,
    fontWeight: 900,
  },
  checkout: {
    marginTop: 10,
    padding: 12,
    width: "100%",
    borderRadius: 999,
    background: "#1683f8",
    color: "#fff",
    border: "none",
    fontWeight: 900,
  },
  error: {
    color: "red",
    marginTop: 6,
  },
};
