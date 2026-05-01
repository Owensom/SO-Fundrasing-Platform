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

function moneyFromCents(cents: number | null | undefined) {
  return (Number(cents || 0) / 100).toFixed(2);
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

function isConcession(ticketType: TicketType) {
  return ticketType.name.toLowerCase().includes("concession");
}

function isStandard(ticketType: TicketType) {
  return ticketType.name.toLowerCase().includes("standard");
}

function isComplimentary(ticketType: TicketType | undefined) {
  return Boolean(ticketType?.name.toLowerCase().includes("complimentary"));
}

function isVip(ticketType: TicketType | undefined) {
  return Boolean(ticketType?.name.toLowerCase().includes("vip"));
}

function seatLabel(seat: Seat) {
  if (seat.table_number) {
    return `Table ${seat.table_number}, Seat ${seat.seat_number || "?"}`;
  }

  return `${seat.section ? `${seat.section} · ` : ""}Row ${
    seat.row_label || "?"
  }, Seat ${seat.seat_number || "?"}`;
}

function seatColour({
  seat,
  ticketType,
  selected,
}: {
  seat: Seat;
  ticketType: TicketType | undefined;
  selected: boolean;
}): CSSProperties {
  const base: CSSProperties = {
    minWidth: 38,
    height: 38,
    padding: "0 8px",
    borderRadius: 10,
    border: selected ? "3px solid #38bdf8" : "1px solid rgba(255,255,255,0.25)",
    fontSize: 13,
    fontWeight: 900,
    cursor: "pointer",
    boxShadow: selected ? "0 0 0 4px rgba(56,189,248,0.25)" : "none",
  };

  if (seat.status === "sold") {
    return {
      ...base,
      background: "#fecaca",
      color: "#7f1d1d",
      cursor: "not-allowed",
      opacity: 0.7,
    };
  }

  if (seat.status === "reserved") {
    return {
      ...base,
      background: "#fde68a",
      color: "#78350f",
      cursor: "not-allowed",
      opacity: 0.8,
    };
  }

  if (seat.status === "blocked") {
    return {
      ...base,
      background: "#475569",
      color: "#e2e8f0",
      cursor: "not-allowed",
      opacity: 0.8,
    };
  }

  if (selected) {
    return {
      ...base,
      background: "#7dd3fc",
      color: "#082f49",
    };
  }

  if (isComplimentary(ticketType)) {
    return {
      ...base,
      background: "#e2e8f0",
      color: "#334155",
      cursor: "not-allowed",
      opacity: 0.75,
    };
  }

  if (isVip(ticketType)) {
    return {
      ...base,
      background: "#facc15",
      color: "#422006",
    };
  }

  return {
    ...base,
    background: "#34d399",
    color: "#022c22",
  };
}

export default function PublicSeatSelector({
  eventId,
  eventType,
  seats,
  ticketTypes,
  currency,
}: {
  eventId: string;
  eventType: string;
  seats: Seat[];
  ticketTypes: TicketType[];
  currency: string;
}) {
  const activeTicketTypes = ticketTypes;

  const standardTicket =
    activeTicketTypes.find(isStandard) ||
    activeTicketTypes.find((ticketType) => !isConcession(ticketType)) ||
    activeTicketTypes[0];

  const concessionTicket = activeTicketTypes.find(isConcession);

  const normalTicketOptions = [standardTicket, concessionTicket].filter(
    Boolean,
  ) as TicketType[];

  const [selectedNormalTicketTypeId, setSelectedNormalTicketTypeId] = useState(
    standardTicket?.id || "",
  );

  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [checkoutError, setCheckoutError] = useState("");
  const [isCheckingOut, setIsCheckingOut] = useState(false);

  const selectedSeatIds = cartItems.map((item) => item.seatId);

  const cartSeats = useMemo(
    () =>
      cartItems
        .map((item) => {
          const seat = seats.find((seatItem) => seatItem.id === item.seatId);
          const ticketType = activeTicketTypes.find(
            (ticketItem) => ticketItem.id === item.ticketTypeId,
          );

          if (!seat || !ticketType) return null;

          return {
            seat,
            ticketType,
          };
        })
        .filter(Boolean) as { seat: Seat; ticketType: TicketType }[],
    [cartItems, seats, activeTicketTypes],
  );

  const total = cartSeats.reduce(
    (sum, item) => sum + Number(item.ticketType.price || 0),
    0,
  );

  function ticketTypeForSeat(seat: Seat) {
    return activeTicketTypes.find(
      (ticketType) => ticketType.id === seat.ticket_type_id,
    );
  }

  function canSelectSeat(seat: Seat) {
    const fixedTicketType = ticketTypeForSeat(seat);

    if (seat.status !== "available") return false;
    if (isComplimentary(fixedTicketType)) return false;
    if (!seat.ticket_type_id && !selectedNormalTicketTypeId) return false;

    return true;
  }

  function toggleSeat(seat: Seat) {
    setCheckoutError("");

    if (!canSelectSeat(seat)) return;

    setCartItems((current) => {
      const alreadySelected = current.some((item) => item.seatId === seat.id);

      if (alreadySelected) {
        return current.filter((item) => item.seatId !== seat.id);
      }

      const fixedTicketType = ticketTypeForSeat(seat);
      const ticketTypeId = fixedTicketType?.id || selectedNormalTicketTypeId;

      if (!ticketTypeId) return current;

      return [
        ...current,
        {
          seatId: seat.id,
          ticketTypeId,
        },
      ];
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
          items: cartItems,
        }),
      });

      const payload = (await response.json()) as {
        url?: string;
        error?: string;
      };

      if (!response.ok || !payload.url) {
        throw new Error(payload.error || "Could not start checkout.");
      }

      window.location.href = payload.url;
    } catch (error) {
      setCheckoutError(
        error instanceof Error
          ? error.message
          : "Could not start checkout. Please try again.",
      );
      setIsCheckingOut(false);
    }
  }

  const rowSeats = seats.filter((seat) => seat.row_label && !seat.table_number);
  const tableSeats = seats.filter((seat) => seat.table_number);
  const renderSeats = eventType === "tables" ? tableSeats : rowSeats;

  if (renderSeats.length === 0) {
    return <div style={styles.empty}>No seats available.</div>;
  }

  return (
    <div style={styles.shell}>
      <div style={styles.topPanel}>
        <div>
          <p style={styles.eyebrow}>Choose your seats</p>
          <h3 style={styles.heading}>Seat map</h3>
          <p style={styles.helper}>
            Green seats are normal public seats. Choose Standard or Concession,
            then select your seats. VIP seats use their fixed VIP price.
          </p>
        </div>

        {normalTicketOptions.length > 0 && (
          <div style={styles.ticketPicker}>
            <p style={styles.pickerLabel}>Normal seat ticket</p>

            <div style={styles.ticketButtons}>
              {normalTicketOptions.map((ticketType) => {
                const selected = ticketType.id === selectedNormalTicketTypeId;

                return (
                  <button
                    key={ticketType.id}
                    type="button"
                    onClick={() => setSelectedNormalTicketTypeId(ticketType.id)}
                    style={{
                      ...styles.ticketButton,
                      ...(selected ? styles.ticketButtonSelected : {}),
                    }}
                  >
                    <strong>{ticketType.name}</strong>
                    <span>
                      {currency} {moneyFromCents(ticketType.price)}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <div style={styles.contentGrid}>
        <div style={styles.mapPanel}>
          {eventType === "tables" ? (
            <TableGrid
              seats={tableSeats}
              ticketTypes={activeTicketTypes}
              selectedSeatIds={selectedSeatIds}
              onToggleSeat={toggleSeat}
            />
          ) : (
            <RowGrid
              seats={rowSeats}
              ticketTypes={activeTicketTypes}
              selectedSeatIds={selectedSeatIds}
              onToggleSeat={toggleSeat}
            />
          )}

          <Legend />
        </div>
                <aside style={styles.cartPanel}>
          <p style={styles.eyebrow}>Checkout summary</p>
          <h3 style={styles.cartTitle}>Your tickets</h3>

          {cartSeats.length === 0 ? (
            <p style={styles.emptyCartText}>
              Select seats from the map to build your order.
            </p>
          ) : (
            <div style={styles.cartList}>
              {cartSeats.map(({ seat, ticketType }) => (
                <div key={seat.id} style={styles.cartItem}>
                  <p style={styles.cartSeat}>{seatLabel(seat)}</p>
                  <p style={styles.cartTicket}>{ticketType.name}</p>
                  <p style={styles.cartPrice}>
                    {currency} {moneyFromCents(ticketType.price)}
                  </p>
                </div>
              ))}

              <div style={styles.totalRow}>
                <span>Total</span>
                <strong>
                  {currency} {moneyFromCents(total)}
                </strong>
              </div>
            </div>
          )}

          {checkoutError ? (
            <div style={styles.errorBox}>{checkoutError}</div>
          ) : null}

          <button
            type="button"
            disabled={cartSeats.length === 0 || isCheckingOut}
            onClick={startCheckout}
            style={{
              ...styles.checkoutButton,
              opacity: cartSeats.length === 0 || isCheckingOut ? 0.45 : 1,
            }}
          >
            {isCheckingOut ? "Opening checkout..." : "Checkout securely"}
          </button>

          <p style={styles.checkoutNote}>
            Your selected seats are reserved when Stripe checkout opens.
          </p>
        </aside>
      </div>
    </div>
  );
}

function RowGrid({
  seats,
  ticketTypes,
  selectedSeatIds,
  onToggleSeat,
}: {
  seats: Seat[];
  ticketTypes: TicketType[];
  selectedSeatIds: string[];
  onToggleSeat: (seat: Seat) => void;
}) {
  const bySection = groupBy(seats, (seat) => seat.section || "Main");

  return (
    <div>
      <div style={styles.stage}>Stage / Front</div>

      <div style={styles.sectionStack}>
        {Object.entries(bySection)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([section, sectionSeats]) => {
            const byRow = groupBy(
              sectionSeats,
              (seat) => seat.row_label || "Seats",
            );

            return (
              <div key={section} style={styles.sectionBlock}>
                <div style={styles.sectionTitle}>{section}</div>

                {Object.entries(byRow)
                  .sort(([a], [b]) => numericSort(a, b))
                  .map(([rowLabel, rowSeats]) => {
                    const sortedSeats = rowSeats
                      .slice()
                      .sort((a, b) =>
                        numericSort(a.seat_number, b.seat_number),
                      );

                    return (
                      <div key={`${section}-${rowLabel}`} style={styles.rowLine}>
                        <div style={styles.rowLabel}>Row {rowLabel}</div>

                        <div style={styles.seatLine}>
                          {sortedSeats.map((seat) => {
                            const ticketType = ticketTypes.find(
                              (item) => item.id === seat.ticket_type_id,
                            );

                            const selected = selectedSeatIds.includes(seat.id);

                            return (
                              <span key={seat.id} style={styles.seatWrap}>
                                <button
                                  type="button"
                                  onClick={() => onToggleSeat(seat)}
                                  disabled={
                                    seat.status !== "available" ||
                                    isComplimentary(ticketType)
                                  }
                                  title={
                                    ticketType
                                      ? `${seatLabel(seat)} · ${ticketType.name}`
                                      : `${seatLabel(
                                          seat,
                                        )} · Normal public seat`
                                  }
                                  style={seatColour({
                                    seat,
                                    ticketType,
                                    selected,
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
  );
}

function TableGrid({
  seats,
  ticketTypes,
  selectedSeatIds,
  onToggleSeat,
}: {
  seats: Seat[];
  ticketTypes: TicketType[];
  selectedSeatIds: string[];
  onToggleSeat: (seat: Seat) => void;
}) {
  const byTable = groupBy(seats, (seat) => seat.table_number || "Table");

  return (
    <div style={styles.tableGrid}>
      {Object.entries(byTable)
        .sort(([a], [b]) => numericSort(a, b))
        .map(([tableNumber, tableSeats]) => (
          <div key={tableNumber} style={styles.tableCard}>
            <h3 style={styles.tableTitle}>Table {tableNumber}</h3>

            <div style={styles.tableSeatWrap}>
              {tableSeats
                .slice()
                .sort((a, b) => numericSort(a.seat_number, b.seat_number))
                .map((seat) => {
                  const ticketType = ticketTypes.find(
                    (item) => item.id === seat.ticket_type_id,
                  );

                  const selected = selectedSeatIds.includes(seat.id);

                  return (
                    <button
                      key={seat.id}
                      type="button"
                      onClick={() => onToggleSeat(seat)}
                      disabled={
                        seat.status !== "available" ||
                        isComplimentary(ticketType)
                      }
                      title={
                        ticketType
                          ? `${seatLabel(seat)} · ${ticketType.name}`
                          : `${seatLabel(seat)} · Normal public seat`
                      }
                      style={seatColour({
                        seat,
                        ticketType,
                        selected,
                      })}
                    >
                      {seat.seat_number}
                    </button>
                  );
                })}
            </div>
          </div>
        ))}
    </div>
  );
}

function Legend() {
  return (
    <div style={styles.legend}>
      <span style={styles.legendItem}>
        <span style={{ ...styles.legendDot, background: "#34d399" }} />
        Normal seat
      </span>
      <span style={styles.legendItem}>
        <span style={{ ...styles.legendDot, background: "#facc15" }} />
        VIP
      </span>
      <span style={styles.legendItem}>
        <span style={{ ...styles.legendDot, background: "#e2e8f0" }} />
        Complimentary
      </span>
      <span style={styles.legendItem}>
        <span style={{ ...styles.legendDot, background: "#475569" }} />
        Blocked
      </span>
      <span style={styles.legendItem}>
        <span style={{ ...styles.legendDot, background: "#7dd3fc" }} />
        Selected
      </span>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  shell: {
    display: "grid",
    gap: 18,
  },
  topPanel: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) minmax(260px, 380px)",
    gap: 18,
    alignItems: "start",
    padding: 18,
    borderRadius: 24,
    background:
      "linear-gradient(135deg, rgba(250,204,21,0.16), rgba(14,165,233,0.10))",
    border: "1px solid rgba(255,255,255,0.12)",
  },
  eyebrow: {
    margin: "0 0 6px",
    color: "#facc15",
    fontSize: 12,
    fontWeight: 900,
    textTransform: "uppercase",
    letterSpacing: "0.12em",
  },
  heading: {
    margin: 0,
    fontSize: 28,
    fontWeight: 900,
    color: "#ffffff",
    letterSpacing: "-0.03em",
  },
  helper: {
    margin: "8px 0 0",
    color: "#cbd5e1",
    fontSize: 14,
    lineHeight: 1.5,
  },
  ticketPicker: {
    padding: 14,
    borderRadius: 20,
    background: "rgba(15,23,42,0.82)",
    border: "1px solid rgba(255,255,255,0.12)",
  },
  pickerLabel: {
    margin: "0 0 10px",
    color: "#cbd5e1",
    fontSize: 12,
    fontWeight: 900,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
  },
  ticketButtons: {
    display: "grid",
    gap: 8,
  },
  ticketButton: {
    display: "flex",
    justifyContent: "space-between",
    gap: 10,
    alignItems: "center",
    minHeight: 46,
    borderRadius: 16,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(255,255,255,0.06)",
    color: "#ffffff",
    padding: "10px 12px",
    cursor: "pointer",
    fontWeight: 900,
  },
  ticketButtonSelected: {
    background: "#facc15",
    color: "#111827",
    border: "1px solid #facc15",
  },
  contentGrid: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) 340px",
    gap: 18,
    alignItems: "start",
  },
  mapPanel: {
    maxHeight: 740,
    overflow: "auto",
    borderRadius: 28,
    background: "#0f172a",
    border: "1px solid rgba(255,255,255,0.1)",
    padding: 18,
    color: "#ffffff",
    boxShadow: "0 24px 70px rgba(0,0,0,0.24)",
  },
  stage: {
    marginBottom: 24,
    borderRadius: 18,
    border: "1px solid rgba(255,255,255,0.16)",
    background: "#020617",
    padding: 14,
    textAlign: "center",
    color: "#94a3b8",
    fontSize: 12,
    fontWeight: 900,
    textTransform: "uppercase",
    letterSpacing: "0.28em",
  },
  sectionStack: {
    display: "grid",
    gap: 28,
    minWidth: "max-content",
  },
  sectionBlock: {
    display: "grid",
    gap: 12,
  },
  sectionTitle: {
    display: "inline-flex",
    width: "fit-content",
    borderRadius: 999,
    background: "rgba(255,255,255,0.1)",
    padding: "8px 12px",
    color: "#ffffff",
    fontSize: 12,
    fontWeight: 900,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
  },
  rowLine: {
    display: "grid",
    gridTemplateColumns: "72px 1fr",
    gap: 12,
    alignItems: "center",
  },
  rowLabel: {
    color: "#cbd5e1",
    fontSize: 13,
    fontWeight: 900,
    whiteSpace: "nowrap",
  },
  seatLine: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    flexWrap: "nowrap",
  },
  seatWrap: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
  },
  aisle: {
    width: 74,
    height: 34,
    borderRadius: 12,
    border: "1px dashed #facc15",
    background: "rgba(250,204,21,0.12)",
    color: "#fde68a",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 9,
    fontWeight: 900,
    textTransform: "uppercase",
    letterSpacing: "0.12em",
    margin: "0 8px",
  },
  cartPanel: {
    position: "sticky",
    top: 16,
    borderRadius: 28,
    background: "linear-gradient(180deg, #111827, #020617)",
    border: "1px solid rgba(255,255,255,0.12)",
    padding: 20,
    color: "#ffffff",
    boxShadow: "0 24px 70px rgba(0,0,0,0.24)",
  },
  cartTitle: {
    margin: 0,
    fontSize: 26,
    fontWeight: 900,
    letterSpacing: "-0.03em",
  },
  emptyCartText: {
    margin: "14px 0 0",
    color: "#94a3b8",
    fontSize: 14,
    lineHeight: 1.5,
  },
  cartList: {
    display: "grid",
    gap: 10,
    marginTop: 16,
  },
  cartItem: {
    padding: 12,
    borderRadius: 18,
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.1)",
  },
  cartSeat: {
    margin: 0,
    color: "#ffffff",
    fontSize: 14,
    fontWeight: 900,
  },
  cartTicket: {
    margin: "4px 0 0",
    color: "#cbd5e1",
    fontSize: 13,
    fontWeight: 800,
  },
  cartPrice: {
    margin: "6px 0 0",
    color: "#facc15",
    fontSize: 14,
    fontWeight: 900,
  },
  totalRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    borderTop: "1px solid rgba(255,255,255,0.14)",
    paddingTop: 14,
    marginTop: 6,
    fontSize: 20,
    fontWeight: 900,
  },
  errorBox: {
    marginTop: 14,
    padding: 12,
    borderRadius: 16,
    background: "rgba(239,68,68,0.16)",
    border: "1px solid rgba(248,113,113,0.45)",
    color: "#fecaca",
    fontSize: 13,
    fontWeight: 800,
    lineHeight: 1.45,
  },
  checkoutButton: {
    width: "100%",
    marginTop: 18,
    border: "none",
    borderRadius: 18,
    background: "#facc15",
    color: "#111827",
    padding: 16,
    fontSize: 15,
    fontWeight: 900,
    cursor: "pointer",
  },
  checkoutNote: {
    margin: "12px 0 0",
    color: "#64748b",
    fontSize: 12,
    lineHeight: 1.45,
  },
  empty: {
    padding: 28,
    borderRadius: 24,
    border: "1px dashed rgba(255,255,255,0.2)",
    color: "#cbd5e1",
    textAlign: "center",
    fontWeight: 900,
  },
  legend: {
    display: "flex",
    flexWrap: "wrap",
    gap: 12,
    marginTop: 24,
    color: "#cbd5e1",
    fontSize: 12,
    fontWeight: 800,
  },
  legendItem: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
  },
  legendDot: {
    width: 14,
    height: 14,
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.35)",
  },
  tableGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
    gap: 14,
  },
  tableCard: {
    padding: 14,
    borderRadius: 22,
    background: "#020617",
    border: "1px solid rgba(255,255,255,0.12)",
  },
  tableTitle: {
    margin: "0 0 12px",
    color: "#ffffff",
    fontSize: 18,
    fontWeight: 900,
  },
  tableSeatWrap: {
    display: "flex",
    flexWrap: "wrap",
    gap: 8,
  },
};
