"use client";

import { useMemo, useState, type CSSProperties } from "react";

type Seat = {
  id: string;
  ticket_type_id: string | null;
  section: string | null;
  row_label: string | null;
  seat_number: string | null;
  table_number: string | null;
  table_name?: string | null; // ✅ admin-defined
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

function seatLabel(seat: Seat) {
  if (seat.table_name) {
    return `${seat.table_name} · Seat ${seat.seat_number}`;
  }
  return `Table ${seat.table_number}, Seat ${seat.seat_number}`;
}

function groupLabel(seat: Seat) {
  return (
    seat.table_name ||
    `Table ${seat.table_number || "Unassigned"}`
  );
}

function sortSeatNumber(a: Seat, b: Seat) {
  const aNum = Number(a.seat_number);
  const bNum = Number(b.seat_number);

  if (Number.isFinite(aNum) && Number.isFinite(bNum)) {
    return aNum - bNum;
  }

  return String(a.seat_number || "").localeCompare(
    String(b.seat_number || ""),
  );
}

function getDefaultGuest(): GuestData {
  return {
    guestName: "",
    dietaryRequirements: "",
    menuChoice: "",
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
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [guestData, setGuestData] = useState<Record<string, GuestData>>({});
  const [checkoutError, setCheckoutError] = useState("");
  const [isCheckingOut, setIsCheckingOut] = useState(false);

  const selectedSeatIds = cartItems.map((item) => item.seatId);

  const groupedSeats = useMemo(() => {
    const groups = new Map<string, Seat[]>();

    for (const seat of seats) {
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
        const seat = seats.find((s) => s.id === item.seatId);
        const ticketType = ticketTypes.find(
          (t) => t.id === item.ticketTypeId,
        );

        if (!seat || !ticketType) return null;

        return { seat, ticketType };
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

      const ticketTypeId =
        seat.ticket_type_id || ticketTypes[0]?.id || "";

      if (!ticketTypeId) return current;

      return [
        ...current,
        { seatId: seat.id, ticketTypeId },
      ];
    });
  }

  function updateTicketType(seatId: string, ticketTypeId: string) {
    setCartItems((current) =>
      current.map((item) =>
        item.seatId === seatId
          ? { ...item, ticketTypeId }
          : item,
      ),
    );
  }

  function removeSeat(seatId: string) {
    setCartItems((current) =>
      current.filter((item) => item.seatId !== seatId),
    );
  }

  function selectAvailableTable(groupSeats: Seat[]) {
    setCartItems((current) => {
      const existingIds = new Set(
        current.map((item) => item.seatId),
      );

      const additions = groupSeats
        .filter((seat) => seat.status === "available")
        .filter((seat) => !existingIds.has(seat.id))
        .map((seat) => ({
          seatId: seat.id,
          ticketTypeId:
            seat.ticket_type_id ||
            ticketTypes[0]?.id ||
            "",
        }))
        .filter((item) => item.ticketTypeId);

      return [...current, ...additions];
    });
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
            const data =
              guestData[item.seatId] || getDefaultGuest();

            return {
              seatId: item.seatId,
              ticketTypeId: item.ticketTypeId,
              guestName: data.guestName,
              dietary: data.dietaryRequirements,
              dietaryRequirements:
                data.dietaryRequirements,
              menuChoice: data.menuChoice,
            };
          }),
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.url) {
        throw new Error(
          data.error || "Checkout failed.",
        );
      }

      window.location.href = data.url;
    } catch (error) {
      setCheckoutError(
        error instanceof Error
          ? error.message
          : "Checkout failed.",
      );
      setIsCheckingOut(false);
    }
  }

  return (
    <div style={styles.shell}>
      <div style={styles.mapPanel}>
        {groupedSeats.map((group) => {
          const availableCount = group.seats.filter(
            (seat) => seat.status === "available",
          ).length;

          return (
            <div key={group.label} style={styles.groupCard}>
              <div style={styles.groupHeader}>
                <div>
                  <h4>{group.label}</h4>
                  <p>
                    {availableCount} available from{" "}
                    {group.seats.length}
                  </p>
                </div>

                {availableCount > 0 && (
                  <button
                    onClick={() =>
                      selectAvailableTable(group.seats)
                    }
                  >
                    Select table
                  </button>
                )}
              </div>

              <div style={styles.seatGrid}>
                {group.seats.map((seat) => {
                  const selected =
                    selectedSeatIds.includes(seat.id);
                  const unavailable =
                    seat.status !== "available";

                  return (
                    <button
                      key={seat.id}
                      disabled={unavailable}
                      onClick={() => toggleSeat(seat)}
                      style={{
                        ...styles.seatButton,
                        background: selected
                          ? "#38bdf8"
                          : unavailable
                          ? "#64748b"
                          : "#22c55e",
                        opacity: unavailable ? 0.4 : 1,
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

      <aside style={styles.cart}>
        <h3>Your tickets ({cartSeats.length})</h3>

        {cartSeats.map(({ seat, ticketType }) => {
          const data =
            guestData[seat.id] || getDefaultGuest();

          return (
            <div key={seat.id} style={styles.cartItem}>
              <strong>{seatLabel(seat)}</strong>

              <div>
                {currency}{" "}
                {moneyFromCents(ticketType.price)}
              </div>

              <input
                placeholder="Guest name"
                value={data.guestName}
                onChange={(e) =>
                  updateGuestData(seat.id, {
                    guestName: e.target.value,
                  })
                }
              />

              <textarea
                placeholder="Dietary requirements"
                value={data.dietaryRequirements}
                onChange={(e) =>
                  updateGuestData(seat.id, {
                    dietaryRequirements:
                      e.target.value,
                  })
                }
              />

              {menuOptions.length > 0 && (
                <select
                  value={data.menuChoice}
                  onChange={(e) =>
                    updateGuestData(seat.id, {
                      menuChoice: e.target.value,
                    })
                  }
                >
                  <option value="">
                    Select menu option
                  </option>
                  {menuOptions.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              )}

              <button
                onClick={() => removeSeat(seat.id)}
              >
                Remove
              </button>
            </div>
          );
        })}

        <div>
          Total: {currency} {moneyFromCents(total)}
        </div>

        {checkoutError && (
          <div>{checkoutError}</div>
        )}

        <button
          onClick={startCheckout}
          disabled={
            cartSeats.length === 0 || isCheckingOut
          }
        >
          {isCheckingOut
            ? "Processing..."
            : "Checkout"}
        </button>
      </aside>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  shell: {
    display: "grid",
    gridTemplateColumns: "1fr 350px",
    gap: 20,
  },
  mapPanel: {
    display: "grid",
    gap: 16,
  },
  groupCard: {
    padding: 16,
    border: "1px solid #e2e8f0",
    borderRadius: 12,
  },
  groupHeader: {
    display: "flex",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  seatGrid: {
    display: "grid",
    gridTemplateColumns:
      "repeat(auto-fill, minmax(40px, 1fr))",
    gap: 6,
  },
  seatButton: {
    height: 40,
    borderRadius: 6,
    border: "none",
    color: "#fff",
  },
  cart: {
    padding: 16,
    border: "1px solid #e2e8f0",
    borderRadius: 12,
  },
  cartItem: {
    display: "grid",
    gap: 6,
    marginBottom: 10,
  },
};
