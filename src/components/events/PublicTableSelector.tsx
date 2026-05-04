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
  return `Table ${seat.table_number}, Seat ${seat.seat_number}`;
}

function groupLabel(seat: Seat) {
  return `Table ${seat.table_number}`;
}

function sortSeatNumber(a: Seat, b: Seat) {
  return Number(a.seat_number) - Number(b.seat_number);
}

function getDefaultGuestData(): GuestData {
  return {
    guestName: "",
    dietaryRequirements: "",
    menuChoice: "",
    tableName: "",
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
  const [checkoutError, setCheckoutError] = useState("");
  const [isCheckingOut, setIsCheckingOut] = useState(false);

  const selectedSeatIds = cartItems.map((item) => item.seatId);

  const groupedSeats = useMemo(() => {
    const tableSeats = seats.filter((s) => s.table_number);
    const groups = new Map<string, Seat[]>();

    for (const seat of tableSeats) {
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
        ...getDefaultGuestData(),
        ...(current[seatId] || {}),
        ...patch,
      },
    }));
  }

  function toggleSeat(seat: Seat) {
    if (seat.status !== "available") return;

    setCartItems((current) => {
      const exists = current.find((i) => i.seatId === seat.id);

      if (exists) {
        return current.filter((i) => i.seatId !== seat.id);
      }

      const ticketTypeId = seat.ticket_type_id || ticketTypes[0]?.id || "";

      if (!ticketTypeId) return current;

      return [...current, { seatId: seat.id, ticketTypeId }];
    });
  }

  function selectTable(groupSeats: Seat[]) {
    setCartItems((current) => {
      const existingIds = new Set(current.map((i) => i.seatId));

      const additions = groupSeats
        .filter((s) => s.status === "available")
        .filter((s) => !existingIds.has(s.id))
        .map((s) => ({
          seatId: s.id,
          ticketTypeId: s.ticket_type_id || ticketTypes[0]?.id || "",
        }))
        .filter((i) => i.ticketTypeId);

      return [...current, ...additions];
    });
  }

  function removeSeat(seatId: string) {
    setCartItems((current) => current.filter((i) => i.seatId !== seatId));
  }

  async function startCheckout() {
    if (!buyerName.trim() || !buyerEmail.trim()) {
      setCheckoutError("Enter name and email.");
      return;
    }

    if (cartItems.length === 0) {
      setCheckoutError("Select at least one seat.");
      return;
    }

    setCheckoutError("");
    setIsCheckingOut(true);

    try {
      const res = await fetch("/api/events/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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
              dietaryRequirements: data.dietaryRequirements,
              menuChoice: data.menuChoice,
              tableName: data.tableName,
            };
          }),
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.url) throw new Error(data.error);

      window.location.href = data.url;
    } catch (e: any) {
      setCheckoutError(e.message || "Checkout failed");
      setIsCheckingOut(false);
    }
  }

  return (
    <div style={styles.shell}>
      <div style={styles.mapPanel}>
        <h3 style={styles.title}>Table layout</h3>

        {groupedSeats.map((group) => (
          <div key={group.label} style={styles.group}>
            <div style={styles.groupHeader}>
              <strong>{group.label}</strong>
              <button onClick={() => selectTable(group.seats)}>
                Select table
              </button>
            </div>

            <div style={styles.grid}>
              {group.seats.map((seat) => {
                const selected = selectedSeatIds.includes(seat.id);

                return (
                  <button
                    key={seat.id}
                    onClick={() => toggleSeat(seat)}
                    disabled={seat.status !== "available"}
                    style={{
                      ...styles.seat,
                      background: selected ? "#38bdf8" : "#22c55e",
                    }}
                  >
                    {seat.seat_number}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <aside style={styles.cart}>
        <BuyerDetailsFields
          buyerName={buyerName}
          buyerEmail={buyerEmail}
          onBuyerNameChange={setBuyerName}
          onBuyerEmailChange={setBuyerEmail}
          dark
        />

        <div style={{ marginTop: 16 }} />

        {cartSeats.map(({ seat, ticketType }) => (
          <div key={seat.id}>
            {seatLabel(seat)} — {currency}{" "}
            {moneyFromCents(ticketType.price)}
            <button onClick={() => removeSeat(seat.id)}>Remove</button>
          </div>
        ))}

        <div style={{ marginTop: 12 }}>
          <strong>
            Total: {currency} {moneyFromCents(total)}
          </strong>
        </div>

        {checkoutError && <div>{checkoutError}</div>}

        <button onClick={startCheckout}>
          {isCheckingOut ? "Processing..." : "Checkout"}
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
    padding: 16,
    background: "#020617",
    borderRadius: 20,
  },
  title: { color: "white" },
  group: { marginBottom: 20 },
  groupHeader: {
    display: "flex",
    justifyContent: "space-between",
    color: "white",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill,40px)",
    gap: 8,
    marginTop: 8,
  },
  seat: {
    height: 40,
    borderRadius: 8,
    color: "white",
    border: "none",
  },
  cart: {
    padding: 16,
    background: "#020617",
    borderRadius: 20,
    color: "white",
  },
};
