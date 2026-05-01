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

function moneyFromCents(cents: number | null | undefined) {
  return (Number(cents || 0) / 100).toFixed(2);
}

function numericSort(a: string | null, b: string | null) {
  const an = Number(a);
  const bn = Number(b);
  if (Number.isFinite(an) && Number.isFinite(bn)) return an - bn;
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

function seatLabel(seat: Seat) {
  if (seat.table_number) {
    return `Table ${seat.table_number}, Seat ${seat.seat_number || "?"}`;
  }

  return `${seat.section ? `${seat.section} · ` : ""}Row ${
    seat.row_label || "?"
  }, Seat ${seat.seat_number || "?"}`;
}

function seatStyle(status: string, selected: boolean): CSSProperties {
  const base: CSSProperties = {
    minWidth: 34,
    height: 34,
    borderRadius: 8,
    border: "1px solid rgba(255,255,255,0.25)",
    fontSize: 12,
    fontWeight: 900,
    cursor: status === "available" ? "pointer" : "not-allowed",
  };

  if (selected) {
    return { ...base, background: "#7dd3fc", color: "#082f49" };
  }

  if (status === "sold") {
    return { ...base, background: "#fda4af", color: "#881337", opacity: 0.7 };
  }

  if (status === "reserved") {
    return { ...base, background: "#fcd34d", color: "#78350f", opacity: 0.8 };
  }

  if (status === "blocked") {
    return { ...base, background: "#475569", color: "#e2e8f0", opacity: 0.75 };
  }

  return { ...base, background: "#34d399", color: "#022c22" };
}

export default function PublicSeatSelector({
  eventType,
  seats,
  ticketTypes,
  currency,
}: {
  eventType: string;
  seats: Seat[];
  ticketTypes: TicketType[];
  currency: string;
}) {
  const [selectedSeatIds, setSelectedSeatIds] = useState<string[]>([]);

  const selectedSeats = useMemo(
    () => seats.filter((seat) => selectedSeatIds.includes(seat.id)),
    [seats, selectedSeatIds],
  );

  const total = selectedSeats.reduce((sum, seat) => {
    const ticketType = ticketTypes.find((item) => item.id === seat.ticket_type_id);
    return sum + Number(ticketType?.price || 0);
  }, 0);

  function toggleSeat(seat: Seat) {
    if (seat.status !== "available") return;

    setSelectedSeatIds((current) =>
      current.includes(seat.id)
        ? current.filter((id) => id !== seat.id)
        : [...current, seat.id],
    );
  }

  const rowSeats = seats.filter((seat) => seat.row_label && !seat.table_number);
  const tableSeats = seats.filter((seat) => seat.table_number);
  const renderSeats = eventType === "tables" ? tableSeats : rowSeats;

  if (renderSeats.length === 0) {
    return <div style={styles.empty}>No seats available.</div>;
  }

  return (
    <div style={styles.wrap}>
      <div style={styles.mapPanel}>
        {eventType === "tables" ? (
          <TableGrid
            seats={tableSeats}
            ticketTypes={ticketTypes}
            currency={currency}
            selectedSeatIds={selectedSeatIds}
            onToggleSeat={toggleSeat}
          />
        ) : (
          <RowGrid
            seats={rowSeats}
            ticketTypes={ticketTypes}
            currency={currency}
            selectedSeatIds={selectedSeatIds}
            onToggleSeat={toggleSeat}
          />
        )}

        <Legend />
      </div>

      <aside style={styles.cart}>
        <h3 style={styles.cartTitle}>Your seats</h3>

        {selectedSeats.length === 0 ? (
          <p style={styles.muted}>Select available seats from the map.</p>
        ) : (
          <div style={styles.selectedList}>
            {selectedSeats.map((seat) => {
              const ticketType = ticketTypes.find(
                (item) => item.id === seat.ticket_type_id,
              );

              return (
                <div key={seat.id} style={styles.selectedCard}>
                  <p style={styles.selectedTitle}>{seatLabel(seat)}</p>
                  <p style={styles.muted}>{ticketType?.name || "Standard ticket"}</p>
                  <p style={styles.price}>
                    {currency} {moneyFromCents(ticketType?.price || 0)}
                  </p>
                </div>
              );
            })}

            <div style={styles.total}>
              <span>Total</span>
              <strong>
                {currency} {moneyFromCents(total)}
              </strong>
            </div>
          </div>
        )}

        <button
          type="button"
          disabled={selectedSeats.length === 0}
          style={{
            ...styles.checkoutButton,
            opacity: selectedSeats.length === 0 ? 0.45 : 1,
          }}
        >
          Checkout next
        </button>
      </aside>
    </div>
  );
}

function RowGrid({
  seats,
  ticketTypes,
  currency,
  selectedSeatIds,
  onToggleSeat,
}: {
  seats: Seat[];
  ticketTypes: TicketType[];
  currency: string;
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
            const byRow = groupBy(sectionSeats, (seat) => seat.row_label || "Seats");

            return (
              <div key={section} style={styles.sectionBlock}>
                <div style={styles.sectionTitle}>{section}</div>

                {Object.entries(byRow)
                  .sort(([a], [b]) => numericSort(a, b))
                  .map(([rowLabel, rowSeats]) => {
                    const sortedSeats = rowSeats
                      .slice()
                      .sort((a, b) => numericSort(a.seat_number, b.seat_number));

                    return (
                      <div key={`${section}-${rowLabel}`} style={styles.rowLine}>
                        <div style={styles.rowLabel}>Row {rowLabel}</div>

                        <div style={styles.seatLine}>
                          {sortedSeats.map((seat) => {
                            const selected = selectedSeatIds.includes(seat.id);
                            const ticketType = ticketTypes.find(
                              (item) => item.id === seat.ticket_type_id,
                            );

                            return (
                              <span key={seat.id} style={styles.seatWrap}>
                                <button
                                  type="button"
                                  disabled={seat.status !== "available"}
                                  onClick={() => onToggleSeat(seat)}
                                  title={`${seatLabel(seat)} · ${
                                    ticketType?.name || "Standard"
                                  } · ${currency} ${moneyFromCents(
                                    ticketType?.price || 0,
                                  )}`}
                                  style={seatStyle(seat.status, selected)}
                                >
                                  {seat.seat_number}
                                </button>

                                {seat.aisle_after ? (
                                  <span style={styles.aisle}>AISLE</span>
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
  selectedSeatIds,
  onToggleSeat,
}: {
  seats: Seat[];
  ticketTypes: TicketType[];
  currency: string;
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

            <div style={styles.tableSeats}>
              {tableSeats
                .slice()
                .sort((a, b) => numericSort(a.seat_number, b.seat_number))
                .map((seat) => (
                  <button
                    key={seat.id}
                    type="button"
                    disabled={seat.status !== "available"}
                    onClick={() => onToggleSeat(seat)}
                    style={seatStyle(seat.status, selectedSeatIds.includes(seat.id))}
                  >
                    {seat.seat_number}
                  </button>
                ))}
            </div>
          </div>
        ))}
    </div>
  );
}

function Legend() {
  return (
    <div style={styles.legend}>
      <span>🟩 Available</span>
      <span>🟦 Selected</span>
      <span>🟨 Reserved</span>
      <span>🟥 Sold</span>
      <span>⬛ Blocked</span>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  wrap: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) 320px",
    gap: 24,
    alignItems: "start",
  },
  mapPanel: {
    maxHeight: 720,
    overflow: "auto",
    borderRadius: 24,
    background: "#0f172a",
    padding: 20,
    color: "#fff",
  },
  stage: {
    marginBottom: 24,
    borderRadius: 16,
    border: "1px solid rgba(255,255,255,0.15)",
    background: "#020617",
    padding: 14,
    textAlign: "center",
    fontSize: 12,
    fontWeight: 900,
    letterSpacing: "0.25em",
    color: "#94a3b8",
    textTransform: "uppercase",
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
    borderRadius: 14,
    background: "rgba(255,255,255,0.1)",
    padding: "8px 12px",
    fontSize: 13,
    fontWeight: 900,
    textTransform: "uppercase",
  },
  rowLine: {
    display: "grid",
    gridTemplateColumns: "72px 1fr",
    gap: 12,
    alignItems: "center",
  },
  rowLabel: {
    fontSize: 13,
    fontWeight: 900,
    color: "#cbd5e1",
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
    width: 92,
    height: 38,
    borderRadius: 12,
    border: "2px dashed #fcd34d",
    background: "rgba(252, 211, 77, 0.12)",
    color: "#fde68a",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 10,
    fontWeight: 900,
    letterSpacing: "0.12em",
    marginLeft: 10,
    marginRight: 10,
  },
  cart: {
    borderRadius: 24,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "#0f172a",
    padding: 20,
    color: "#fff",
  },
  cartTitle: {
    margin: 0,
    fontSize: 24,
    fontWeight: 900,
  },
  muted: {
    color: "#94a3b8",
    fontSize: 14,
  },
  selectedList: {
    display: "grid",
    gap: 12,
    marginTop: 16,
  },
  selectedCard: {
    borderRadius: 16,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "#020617",
    padding: 12,
  },
  selectedTitle: {
    margin: 0,
    fontWeight: 900,
  },
  price: {
    margin: "4px 0 0",
    color: "#fcd34d",
    fontWeight: 900,
  },
  total: {
    display: "flex",
    justifyContent: "space-between",
    borderTop: "1px solid rgba(255,255,255,0.12)",
    paddingTop: 14,
    marginTop: 8,
    fontSize: 18,
  },
  checkoutButton: {
    width: "100%",
    marginTop: 20,
    border: "none",
    borderRadius: 16,
    background: "#fcd34d",
    color: "#111827",
    padding: 16,
    fontWeight: 900,
    cursor: "pointer",
  },
  empty: {
    borderRadius: 24,
    border: "1px dashed rgba(255,255,255,0.2)",
    padding: 32,
    textAlign: "center",
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
  tableGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
    gap: 16,
  },
  tableCard: {
    borderRadius: 20,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "#020617",
    padding: 16,
  },
  tableTitle: {
    margin: "0 0 12px",
    fontSize: 18,
    fontWeight: 900,
  },
  tableSeats: {
    display: "flex",
    flexWrap: "wrap",
    gap: 8,
  },
};
