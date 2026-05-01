"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";

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

const specialColours = [
  { background: "#facc15", text: "#422006" },
  { background: "#a78bfa", text: "#2e1065" },
  { background: "#fb7185", text: "#4c0519" },
  { background: "#60a5fa", text: "#082f49" },
  { background: "#fb923c", text: "#431407" },
];

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

function rowVisualUnits(rowSeats: Seat[]) {
  return rowSeats.length + rowSeats.filter((seat) => seat.aisle_after).length * 2;
}

function colourForTicketType(
  ticketType: TicketType | undefined,
  ticketTypes: TicketType[],
) {
  if (!ticketType) {
    return {
      background: "#dcfce7",
      text: "#14532d",
      label: "Normal public seat",
    };
  }

  const index = Math.max(
    0,
    ticketTypes.findIndex((item) => item.id === ticketType.id),
  );

  return {
    ...specialColours[index % specialColours.length],
    label: ticketType.name,
  };
}

function seatStyle({
  selected,
  ticketType,
  ticketTypes,
  status,
}: {
  selected: boolean;
  ticketType: TicketType | undefined;
  ticketTypes: TicketType[];
  status: string;
}): CSSProperties {
  const colour = colourForTicketType(ticketType, ticketTypes);

  if (status === "blocked") {
    return {
      minWidth: 32,
      height: 32,
      borderRadius: 8,
      border: selected ? "3px solid #0284c7" : "1px solid #64748b",
      background: selected ? "#bae6fd" : "#334155",
      color: selected ? "#082f49" : "#e2e8f0",
      fontSize: 12,
      fontWeight: 900,
      cursor: "pointer",
    };
  }

  return {
    minWidth: 32,
    height: 32,
    borderRadius: 8,
    border: selected ? "3px solid #0284c7" : "1px solid #cbd5e1",
    background: selected ? "#bae6fd" : colour.background,
    color: selected ? "#082f49" : colour.text,
    boxShadow: selected ? "0 0 0 3px rgba(14,165,233,0.25)" : "none",
    fontSize: 12,
    fontWeight: 900,
    cursor: "pointer",
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
  const [manualOffsets, setManualOffsets] = useState<Record<string, number>>({});

  const storageKey = `event-row-offsets-${eventId}`;

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(storageKey);
      if (saved) setManualOffsets(JSON.parse(saved));
    } catch {
      setManualOffsets({});
    }
  }, [storageKey]);

  useEffect(() => {
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(manualOffsets));
    } catch {
      // Ignore storage issues.
    }
  }, [manualOffsets, storageKey]);

  const normalSeats = useMemo(
    () => seats.filter((seat) => !seat.ticket_type_id),
    [seats],
  );

  const selectedRows = useMemo(
    () => Array.from(new Set(selectedRowKeys)),
    [selectedRowKeys],
  );

  function changeRowOffset(rowKey: string, amount: number) {
    setManualOffsets((current) => ({
      ...current,
      [rowKey]: Math.max(-20, Math.min(20, (current[rowKey] || 0) + amount)),
    }));
  }

  function resetRowOffsets() {
    setManualOffsets({});
  }

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

  function selectNormalSeats() {
    setSelectedSeatIds(normalSeats.map((seat) => seat.id));
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
            Leave normal seats green. Use row nudges to line up aisles when rows
            have different lengths.
          </p>
        </div>

        <div style={styles.toolbarButtons}>
          {mode === "rows" && (
            <button
              type="button"
              onClick={resetRowOffsets}
              style={styles.secondaryButton}
            >
              Reset row nudges
            </button>
          )}

          <button
            type="button"
            onClick={selectNormalSeats}
            disabled={normalSeats.length === 0}
            style={{
              ...styles.normalButton,
              opacity: normalSeats.length === 0 ? 0.45 : 1,
            }}
          >
            Select normal seats ({normalSeats.length})
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

      <div style={styles.legendBox}>
        <strong>Seat colours:</strong>

        <span style={styles.legendItem}>
          <span style={{ ...styles.legendDot, background: "#dcfce7" }} />
          Normal public seat — Standard/Concession
        </span>

        {ticketTypes.map((ticketType) => {
          const colour = colourForTicketType(ticketType, ticketTypes);

          return (
            <span key={ticketType.id} style={styles.legendItem}>
              <span style={{ ...styles.legendDot, background: colour.background }} />
              {ticketType.name} — {currency} {moneyFromCents(ticketType.price)}
            </span>
          );
        })}

        <span style={styles.legendItem}>
          <span style={{ ...styles.legendDot, background: "#334155" }} />
          Blocked
        </span>
      </div>

      <div style={styles.infoBox}>
        <strong>{normalSeats.length}</strong> normal public seats. Row nudges are
        saved in this browser for admin layout editing.
      </div>

      <div style={styles.actionPanel}>
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
            <option value="">Choose seat marking</option>
            <option value="__normal__">Normal public seat</option>
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
            Apply marking to selected seats
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
                            title={ticketType?.name || "Normal public seat"}
                            style={seatStyle({
                              selected: selectedSeatIds.includes(seat.id),
                              ticketType,
                              ticketTypes,
                              status: seat.status,
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

            const rowEntries = Object.entries(rows).sort(([a], [b]) =>
              numericSort(a, b),
            );

            const maxUnits = Math.max(
              1,
              ...rowEntries.map(([, rowSeats]) => rowVisualUnits(rowSeats)),
            );

            return (
              <div key={group} style={styles.groupBlock}>
                <h4 style={styles.groupTitle}>{group}</h4>

                {rowEntries.map(([row, rowSeats]) => {
                  const actualKey =
                    rowSeats.length > 0
                      ? rowKeyForSeat(rowSeats[0])
                      : `${group === "Main" ? "" : group}|${row}`;

                  const rowSelected = selectedRowKeys.includes(actualKey);
                  const sortedRowSeats = rowSeats
                    .slice()
                    .sort((a, b) => numericSort(a.seat_number, b.seat_number));

                  const autoOffset = Math.max(
                    0,
                    Math.floor((maxUnits - rowVisualUnits(rowSeats)) / 2),
                  );

                  const manualOffset = manualOffsets[actualKey] || 0;
                  const totalOffset = Math.max(0, autoOffset + manualOffset);

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

                      <div style={styles.rowNudgeControls}>
                        <button
                          type="button"
                          onClick={() => changeRowOffset(actualKey, -1)}
                          style={styles.nudgeButton}
                          title="Move row left"
                        >
                          ←
                        </button>
                        <span style={styles.offsetPill}>+{totalOffset}</span>
                        <button
                          type="button"
                          onClick={() => changeRowOffset(actualKey, 1)}
                          style={styles.nudgeButton}
                          title="Move row right"
                        >
                          →
                        </button>
                      </div>

                      <div
                        style={{
                          ...styles.seatLine,
                          paddingLeft: totalOffset * 42,
                        }}
                      >
                        {sortedRowSeats.map((seat) => {
                          const ticketType = ticketTypes.find(
                            (item) => item.id === seat.ticket_type_id,
                          );

                          return (
                            <span key={seat.id} style={styles.seatWrap}>
                              <button
                                type="button"
                                onClick={() => toggleSeat(seat.id)}
                                title={ticketType?.name || "Normal public seat"}
                                style={seatStyle({
                                  selected: selectedSeatIds.includes(seat.id),
                                  ticketType,
                                  ticketTypes,
                                  status: seat.status,
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

const styles: Record<string, CSSProperties> = {
  manager: { display: "grid", gap: 14 },
  toolbar: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "center",
    flexWrap: "wrap",
  },
  toolbarButtons: { display: "flex", gap: 8, flexWrap: "wrap" },
  title: { margin: 0, color: "#0f172a", fontSize: 20, fontWeight: 900 },
  text: { margin: "4px 0 0", color: "#64748b", fontSize: 14, lineHeight: 1.45 },
  legendBox: {
    display: "flex",
    flexWrap: "wrap",
    gap: 10,
    alignItems: "center",
    padding: 12,
    borderRadius: 16,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    color: "#0f172a",
    fontSize: 13,
    fontWeight: 800,
  },
  legendItem: { display: "inline-flex", alignItems: "center", gap: 6 },
  legendDot: {
    width: 14,
    height: 14,
    borderRadius: 999,
    border: "1px solid #94a3b8",
  },
  infoBox: {
    padding: 10,
    borderRadius: 12,
    background: "#eff6ff",
    border: "1px solid #bfdbfe",
    color: "#1e3a8a",
    fontSize: 13,
    fontWeight: 800,
  },
  actionPanel: {
    display: "grid",
    gap: 10,
    padding: 12,
    borderRadius: 16,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
  },
  summaryBox: { color: "#0f172a", fontSize: 14, fontWeight: 800 },
  actionForm: { display: "flex", gap: 8, flexWrap: "wrap" },
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
  normalButton: {
    minHeight: 40,
    borderRadius: 999,
    border: "1px solid #86efac",
    background: "#dcfce7",
    color: "#14532d",
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
    gridTemplateColumns: "80px 104px 1fr",
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
  rowNudgeControls: {
    display: "flex",
    alignItems: "center",
    gap: 4,
  },
  nudgeButton: {
    width: 30,
    height: 30,
    borderRadius: 999,
    border: "1px solid #cbd5e1",
    background: "#ffffff",
    color: "#0f172a",
    fontWeight: 900,
    cursor: "pointer",
  },
  offsetPill: {
    minWidth: 34,
    height: 26,
    borderRadius: 999,
    background: "#f1f5f9",
    border: "1px solid #e2e8f0",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#475569",
    fontSize: 11,
    fontWeight: 900,
  },
  seatLine: {
    display: "flex",
    alignItems: "center",
    gap: 4,
    flexWrap: "nowrap",
    transition: "padding-left 160ms ease",
  },
  seatLineWrap: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    flexWrap: "wrap",
  },
  seatWrap: { display: "inline-flex", alignItems: "center", gap: 4 },
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
};
