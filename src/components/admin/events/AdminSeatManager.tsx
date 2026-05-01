"use client";

import { useMemo, useState, type CSSProperties } from "react";

type TicketType = {
  id: string;
  name: string;
  price: number;
};

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

function rowKeyForSeat(seat: Seat) {
  return `${seat.section || ""}|${seat.row_label || ""}`;
}

function seatStyle({
  selected,
  ticketType,
}: {
  selected: boolean;
  ticketType: TicketType | undefined;
}): CSSProperties {
  const base: CSSProperties = {
    minWidth: 32,
    height: 32,
    borderRadius: 8,
    border: selected ? "2px solid #0284c7" : "1px solid #cbd5e1",
    fontSize: 12,
    fontWeight: 900,
    cursor: "pointer",
    color: "#0f172a",
  };

  if (selected) {
    return {
      ...base,
      background: "#bae6fd",
      boxShadow: "0 0 0 3px rgba(14,165,233,0.25)",
    };
  }

  if (!ticketType) {
    return {
      ...base,
      background: "#f8fafc",
    };
  }

  if (ticketType.price >= 2000) {
    return {
      ...base,
      background: "#fde68a",
    };
  }

  if (ticketType.price >= 1000) {
    return {
      ...base,
      background: "#bbf7d0",
    };
  }

  if (ticketType.price > 0) {
    return {
      ...base,
      background: "#ddd6fe",
    };
  }

  return {
    ...base,
    background: "#e2e8f0",
  };
}

export default function AdminSeatManager({
  eventId,
  seats,
  ticketTypes,
  currency,
  mode,
  applyTicketTypeAction,
  deleteSelectedSeatsAction,
  deleteSelectedRowsAction,
}: {
  eventId: string;
  seats: Seat[];
  ticketTypes: TicketType[];
  currency: string;
  mode: "rows" | "tables";
  applyTicketTypeAction: (formData: FormData) => void | Promise<void>;
  deleteSelectedSeatsAction: (formData: FormData) => void | Promise<void>;
  deleteSelectedRowsAction?: (formData: FormData) => void | Promise<void>;
}) {
  const [selectedSeatIds, setSelectedSeatIds] = useState<string[]>([]);
  const [selectedRowKeys, setSelectedRowKeys] = useState<string[]>([]);
  const [ticketTypeId, setTicketTypeId] = useState<string>("");

  const unpricedSeats = useMemo(
    () => seats.filter((seat) => !seat.ticket_type_id),
    [seats],
  );

  const unpricedCount = unpricedSeats.length;

  const selectedSeats = useMemo(
    () => seats.filter((seat) => selectedSeatIds.includes(seat.id)),
    [seats, selectedSeatIds],
  );

  const selectedRows = useMemo(
    () => Array.from(new Set(selectedRowKeys)),
    [selectedRowKeys],
  );

  function toggleSeat(seatId: string) {
    setSelectedSeatIds((current) =>
      current.includes(seatId)
        ? current.filter((id) => id !== seatId)
        : [...current, seatId],
    );
  }

  function toggleRow(rowKey: string, rowSeats: Seat[]) {
    const alreadySelected = selectedRowKeys.includes(rowKey);
    const rowSeatIds = rowSeats.map((seat) => seat.id);

    if (alreadySelected) {
      setSelectedRowKeys((current) => current.filter((key) => key !== rowKey));
      setSelectedSeatIds((current) =>
        current.filter((id) => !rowSeatIds.includes(id)),
      );
      return;
    }

    setSelectedRowKeys((current) => [...current, rowKey]);
    setSelectedSeatIds((current) =>
      Array.from(new Set([...current, ...rowSeatIds])),
    );
  }

  function clearSelection() {
    setSelectedSeatIds([]);
    setSelectedRowKeys([]);
  }

  function selectUnpricedSeats() {
    setSelectedSeatIds(unpricedSeats.map((seat) => seat.id));
    setSelectedRowKeys([]);
  }

  const byPrimaryGroup =
    mode === "tables"
      ? groupBy(seats, (seat) => seat.table_number || "No table")
      : groupBy(seats, (seat) => seat.section || "Main");

  return (
    <div style={styles.manager}>
      <div style={styles.toolbar}>
        <div>
          <h3 style={styles.title}>Seat manager</h3>
          <p style={styles.text}>
            Select seats like a buyer, then apply a ticket type or delete them.
            {mode === "rows"
              ? " Click a row label to select the whole row."
              : ""}
          </p>
        </div>

        <div style={styles.toolbarButtons}>
          <button
            type="button"
            onClick={selectUnpricedSeats}
            disabled={unpricedCount === 0}
            style={{
              ...styles.warningButton,
              opacity: unpricedCount === 0 ? 0.45 : 1,
            }}
          >
            Select unpriced seats ({unpricedCount})
          </button>

          <button
            type="button"
            onClick={clearSelection}
            style={styles.secondaryButton}
          >
            Clear selection
          </button>
        </div>
      </div>

      <div style={styles.actionPanel}>
        {unpricedCount > 0 ? (
          <div style={styles.warningBox}>
            ⚠ {unpricedCount} seats have no pricing. Select them and apply a
            ticket type before publishing checkout.
          </div>
        ) : (
          <div style={styles.successBox}>All seats have pricing assigned.</div>
        )}

        <div style={styles.summaryBox}>
          <strong>{selectedSeatIds.length}</strong> selected seats
          {mode === "rows" && (
            <>
              {" "}
              · <strong>{selectedRows.length}</strong> selected rows
            </>
          )}
        </div>

        <form action={applyTicketTypeAction} style={styles.actionForm}>
          <input type="hidden" name="event_id" value={eventId} />
          <input
            type="hidden"
            name="seat_ids"
            value={JSON.stringify(selectedSeatIds)}
          />

          <select
            name="ticket_type_id"
            value={ticketTypeId}
            onChange={(event) => setTicketTypeId(event.target.value)}
            style={styles.select}
            required
          >
            <option value="">Choose ticket type</option>
            {ticketTypes.map((ticketType) => (
              <option key={ticketType.id} value={ticketType.id}>
                {ticketType.name} — {currency} {moneyFromCents(ticketType.price)}
              </option>
            ))}
          </select>

          <button
            type="submit"
            disabled={selectedSeatIds.length === 0 || !ticketTypeId}
            style={{
              ...styles.primaryButton,
              opacity: selectedSeatIds.length === 0 || !ticketTypeId ? 0.45 : 1,
            }}
          >
            Apply price to selected seats
          </button>
        </form>

        <form action={deleteSelectedSeatsAction} style={styles.actionForm}>
          <input type="hidden" name="event_id" value={eventId} />
          <input
            type="hidden"
            name="seat_ids"
            value={JSON.stringify(selectedSeatIds)}
          />

          <button
            type="submit"
            disabled={selectedSeatIds.length === 0}
            style={{
              ...styles.dangerButton,
              opacity: selectedSeatIds.length === 0 ? 0.45 : 1,
            }}
          >
            Delete selected seats
          </button>
        </form>

        {mode === "rows" && deleteSelectedRowsAction && (
          <form action={deleteSelectedRowsAction} style={styles.actionForm}>
            <input type="hidden" name="event_id" value={eventId} />
            <input
              type="hidden"
              name="row_keys"
              value={JSON.stringify(selectedRows)}
            />

            <button
              type="submit"
              disabled={selectedRows.length === 0}
              style={{
                ...styles.dangerButton,
                opacity: selectedRows.length === 0 ? 0.45 : 1,
              }}
            >
              Delete selected rows
            </button>
          </form>
        )}
      </div>

      <div style={styles.mapPanel}>
        {Object.entries(byPrimaryGroup)
          .sort(([a], [b]) => numericSort(a, b))
          .map(([group, groupSeats]) => {
            if (mode === "tables") {
              return (
                <div key={group} style={styles.tableCard}>
                  <h4 style={styles.groupTitle}>Table {group}</h4>

                  <div style={styles.seatLineWrap}>
                    {groupSeats
                      .slice()
                      .sort((a, b) => numericSort(a.seat_number, b.seat_number))
                      .map((seat) => {
                        const ticketType = ticketTypes.find(
                          (item) => item.id === seat.ticket_type_id,
                        );

                        return (
                          <button
                            key={seat.id}
                            type="button"
                            onClick={() => toggleSeat(seat.id)}
                            title={ticketType?.name || "No price assigned"}
                            style={seatStyle({
                              selected: selectedSeatIds.includes(seat.id),
                              ticketType,
                            })}
                          >
                            {seat.seat_number}
                          </button>
                        );
                      })}
                  </div>
                </div>
              );
            }

            const rows = groupBy(groupSeats, (seat) => seat.row_label || "No row");

            return (
              <div key={group} style={styles.groupBlock}>
                <h4 style={styles.groupTitle}>{group}</h4>

                {Object.entries(rows)
                  .sort(([a], [b]) => numericSort(a, b))
                  .map(([row, rowSeats]) => {
                    const actualKey =
                      rowSeats.length > 0
                        ? rowKeyForSeat(rowSeats[0])
                        : `${group === "Main" ? "" : group}|${row}`;

                    const rowSelected = selectedRowKeys.includes(actualKey);

                    return (
                      <div key={`${group}-${row}`} style={styles.rowLine}>
                        <button
                          type="button"
                          onClick={() => toggleRow(actualKey, rowSeats)}
                          style={{
                            ...styles.rowButton,
                            background: rowSelected ? "#bae6fd" : "#ffffff",
                          }}
                        >
                          Row {row}
                        </button>

                        <div style={styles.seatLine}>
                          {rowSeats
                            .slice()
                            .sort((a, b) =>
                              numericSort(a.seat_number, b.seat_number),
                            )
                            .map((seat) => {
                              const ticketType = ticketTypes.find(
                                (item) => item.id === seat.ticket_type_id,
                              );

                              return (
                                <span key={seat.id} style={styles.seatWrap}>
                                  <button
                                    type="button"
                                    onClick={() => toggleSeat(seat.id)}
                                    title={ticketType?.name || "No price assigned"}
                                    style={seatStyle({
                                      selected: selectedSeatIds.includes(seat.id),
                                      ticketType,
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

      <div style={styles.legend}>
        <span>Gold = VIP/high price</span>
        <span>Green = Standard</span>
        <span>Purple = Concession</span>
        <span>Grey = Complimentary/no price</span>
        <span>Blue outline = selected</span>
      </div>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  manager: {
    display: "grid",
    gap: 14,
  },
  toolbar: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "center",
    flexWrap: "wrap",
  },
  toolbarButtons: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
  },
  title: {
    margin: 0,
    color: "#0f172a",
    fontSize: 20,
    fontWeight: 900,
  },
  text: {
    margin: "4px 0 0",
    color: "#64748b",
    fontSize: 14,
    lineHeight: 1.45,
  },
  actionPanel: {
    display: "grid",
    gap: 10,
    padding: 12,
    borderRadius: 16,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
  },
  warningBox: {
    padding: 10,
    borderRadius: 12,
    background: "#fef2f2",
    border: "1px solid #fecaca",
    color: "#b91c1c",
    fontSize: 13,
    fontWeight: 900,
  },
  successBox: {
    padding: 10,
    borderRadius: 12,
    background: "#dcfce7",
    border: "1px solid #bbf7d0",
    color: "#166534",
    fontSize: 13,
    fontWeight: 900,
  },
  summaryBox: {
    color: "#0f172a",
    fontSize: 14,
    fontWeight: 800,
  },
  actionForm: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
  },
  select: {
    minHeight: 42,
    minWidth: 240,
    borderRadius: 12,
    border: "1px solid #cbd5e1",
    padding: "8px 10px",
    fontWeight: 800,
  },
  primaryButton: {
    minHeight: 42,
    border: "none",
    borderRadius: 999,
    background: "#1683f8",
    color: "#ffffff",
    padding: "0 14px",
    fontWeight: 900,
    cursor: "pointer",
  },
  secondaryButton: {
    minHeight: 40,
    borderRadius: 999,
    border: "1px solid #cbd5e1",
    background: "#ffffff",
    color: "#0f172a",
    padding: "0 14px",
    fontWeight: 900,
    cursor: "pointer",
  },
  warningButton: {
    minHeight: 40,
    borderRadius: 999,
    border: "1px solid #f59e0b",
    background: "#fef3c7",
    color: "#92400e",
    padding: "0 14px",
    fontWeight: 900,
    cursor: "pointer",
  },
  dangerButton: {
    minHeight: 42,
    border: "none",
    borderRadius: 999,
    background: "#ef4444",
    color: "#ffffff",
    padding: "0 14px",
    fontWeight: 900,
    cursor: "pointer",
  },
  mapPanel: {
    maxHeight: 620,
    overflow: "auto",
    padding: 14,
    borderRadius: 16,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
  },
  groupBlock: {
    display: "grid",
    gap: 10,
    minWidth: "max-content",
    marginBottom: 22,
  },
  groupTitle: {
    margin: 0,
    color: "#334155",
    fontSize: 13,
    fontWeight: 900,
    textTransform: "uppercase",
    letterSpacing: "0.06em",
  },
  rowLine: {
    display: "grid",
    gridTemplateColumns: "80px 1fr",
    gap: 10,
    alignItems: "center",
  },
  rowButton: {
    minHeight: 32,
    borderRadius: 10,
    border: "1px solid #cbd5e1",
    color: "#0f172a",
    fontSize: 12,
    fontWeight: 900,
    cursor: "pointer",
  },
  seatLine: {
    display: "flex",
    alignItems: "center",
    gap: 4,
    flexWrap: "nowrap",
  },
  seatLineWrap: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    flexWrap: "wrap",
  },
  seatWrap: {
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
  },
  aisle: {
    width: 48,
    height: 28,
    borderRadius: 8,
    border: "1px dashed #f59e0b",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 9,
    fontWeight: 900,
    color: "#92400e",
    background: "#fef3c7",
    margin: "0 6px",
  },
  tableCard: {
    padding: 12,
    borderRadius: 16,
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    marginBottom: 12,
  },
  legend: {
    display: "flex",
    flexWrap: "wrap",
    gap: 10,
    color: "#64748b",
    fontSize: 12,
    fontWeight: 800,
  },
};
