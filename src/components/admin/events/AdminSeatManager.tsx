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

  seat_purpose: string | null;
  admin_label: string | null;
  admin_note: string | null;
  guest_name: string | null;
  guest_email: string | null;
  dietary_requirements: string | null;
  menu_choice: string | null;

  section: string | null;
  row_label: string | null;
  seat_number: string | null;
  table_number: string | null;
  aisle_after: number | null;
  status: string;
};

type SeatingLayoutValue = number | string | null | undefined;

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

function purposeLabel(value: string | null | undefined) {
  if (value === "vip") return "VIP";
  if (value === "complimentary") return "Complimentary";
  if (value === "staff") return "Staff";
  if (value === "sponsor") return "Sponsor";
  if (value === "guest") return "Guest";
  if (value === "blocked") return "Blocked allocation";
  if (value === "other") return "Other";
  return "Normal";
}

function seatLabel(seat: Seat) {
  if (seat.table_number) {
    return `Table ${seat.table_number} · Seat ${seat.seat_number || "-"}`;
  }

  return `Row ${seat.row_label || "-"} · Seat ${seat.seat_number || "-"}${
    seat.section ? ` · ${seat.section}` : ""
  }`;
}

function hasAllocationDetails(seat: Seat) {
  return Boolean(
    seat.seat_purpose ||
      seat.admin_label ||
      seat.admin_note ||
      seat.guest_name ||
      seat.guest_email ||
      seat.dietary_requirements ||
      seat.menu_choice ||
      seat.status === "blocked",
  );
}

function allocationSort(a: Seat, b: Seat) {
  if (a.table_number || b.table_number) {
    const tableCompare = numericSort(a.table_number, b.table_number);
    if (tableCompare !== 0) return tableCompare;
  }

  const sectionCompare = String(a.section || "").localeCompare(
    String(b.section || ""),
  );
  if (sectionCompare !== 0) return sectionCompare;

  const rowCompare = numericSort(a.row_label, b.row_label);
  if (rowCompare !== 0) return rowCompare;

  return numericSort(a.seat_number, b.seat_number);
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

function getRowOffsets(layout: Record<string, SeatingLayoutValue> | undefined) {
  return Object.fromEntries(
    Object.entries(layout || {})
      .filter(([key]) => key !== "tableShape" && key !== "table_shape")
      .map(([key, value]) => {
        const number = Number(value);
        if (!Number.isFinite(number)) return null;
        return [key, Math.max(-20, Math.min(20, Math.floor(number)))];
      })
      .filter(Boolean) as [string, number][],
  );
}

function cleanTableName(value: string | null | undefined) {
  return String(value || "").trim();
}

function displayTableTitle(
  tableNumber: string,
  tableNames: Record<string, string> | undefined,
) {
  const tableName = cleanTableName(tableNames?.[tableNumber]);

  if (tableName) {
    return `Table ${tableNumber} — ${tableName}`;
  }

  return `Table ${tableNumber}`;
}

function seatTitle(seat: Seat) {
  return [
    seatLabel(seat),
    purposeLabel(seat.seat_purpose),
    seat.admin_label || "",
    seat.guest_name || "",
    seat.status,
  ]
    .filter(Boolean)
    .join(" · ");
}

function seatStyle({
  selected,
  ticketType,
  ticketTypes,
  status,
  seatPurpose,
}: {
  selected: boolean;
  ticketType: TicketType | undefined;
  ticketTypes: TicketType[];
  status: string;
  seatPurpose: string | null;
}): CSSProperties {
  const colour = colourForTicketType(ticketType, ticketTypes);

  const base: CSSProperties = {
    width: 38,
    height: 38,
    borderRadius: 12,
    fontSize: 12,
    fontWeight: 900,
    cursor: "pointer",
    position: "relative",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  };

  if (status === "blocked") {
    return {
      ...base,
      border: selected ? "3px solid #0284c7" : "1px solid #64748b",
      background: selected ? "#bae6fd" : "#334155",
      color: selected ? "#082f49" : "#e2e8f0",
    };
  }

  if (status === "sold") {
    return {
      ...base,
      border: selected ? "3px solid #0284c7" : "1px solid #991b1b",
      background: selected ? "#bae6fd" : "#fecaca",
      color: selected ? "#082f49" : "#7f1d1d",
    };
  }

  if (status === "reserved") {
    return {
      ...base,
      border: selected ? "3px solid #0284c7" : "1px solid #f59e0b",
      background: selected ? "#bae6fd" : "#fef3c7",
      color: selected ? "#082f49" : "#92400e",
    };
  }

  if (seatPurpose === "vip") {
    return {
      ...base,
      border: selected ? "3px solid #0284c7" : "2px solid #7c3aed",
      background: selected ? "#bae6fd" : "#ede9fe",
      color: selected ? "#082f49" : "#4c1d95",
    };
  }

  if (seatPurpose === "complimentary") {
    return {
      ...base,
      border: selected ? "3px solid #0284c7" : "2px dashed #0f766e",
      background: selected ? "#bae6fd" : "#ccfbf1",
      color: selected ? "#082f49" : "#134e4a",
    };
  }

  if (
    seatPurpose === "staff" ||
    seatPurpose === "sponsor" ||
    seatPurpose === "guest" ||
    seatPurpose === "other"
  ) {
    return {
      ...base,
      border: selected ? "3px solid #0284c7" : "2px solid #0ea5e9",
      background: selected ? "#bae6fd" : "#e0f2fe",
      color: selected ? "#082f49" : "#075985",
    };
  }

  return {
    ...base,
    border: selected ? "3px solid #0284c7" : "1px solid #cbd5e1",
    background: selected ? "#bae6fd" : colour.background,
    color: selected ? "#082f49" : colour.text,
  };
}

export default function AdminSeatManager({
  eventId,
  seats,
  ticketTypes,
  currency,
  mode,
  applyTicketTypeAction,
  updateSelectedSeatsMetadataAction,
  updateSelectedSeatsStatusAction,
  updateSeatingLayoutAction,
  deleteSelectedSeatsAction,
  deleteSelectedRowsAction,
  initialSeatingLayout = {},
  tableNames = {},
}: {
  eventId: string;
  seats: Seat[];
  ticketTypes: TicketType[];
  currency: string;
  mode: "rows" | "tables";
  applyTicketTypeAction: (formData: FormData) => void | Promise<void>;
  updateSelectedSeatsMetadataAction: (formData: FormData) => void | Promise<void>;
  updateSelectedSeatsStatusAction: (formData: FormData) => void | Promise<void>;
  updateSeatingLayoutAction?: (formData: FormData) => void | Promise<void>;
  deleteSelectedSeatsAction: (formData: FormData) => void | Promise<void>;
  deleteSelectedRowsAction?: (formData: FormData) => void | Promise<void>;
  initialSeatingLayout?: Record<string, SeatingLayoutValue>;
  tableNames?: Record<string, string>;
}) {
  const [selectedSeatIds, setSelectedSeatIds] = useState<string[]>([]);
  const [selectedRowKeys, setSelectedRowKeys] = useState<string[]>([]);
  const [selectedTableNumber, setSelectedTableNumber] = useState<string>("");
  const [ticketTypeId, setTicketTypeId] = useState<string>("");

  const [seatPurpose, setSeatPurpose] = useState<string>("");
  const [adminLabel, setAdminLabel] = useState<string>("");
  const [adminNote, setAdminNote] = useState<string>("");
  const [guestName, setGuestName] = useState<string>("");
  const [guestEmail, setGuestEmail] = useState<string>("");
  const [dietaryRequirements, setDietaryRequirements] = useState<string>("");
  const [menuChoice, setMenuChoice] = useState<string>("");

  const [manualOffsets, setManualOffsets] = useState<Record<string, number>>(
    getRowOffsets(initialSeatingLayout),
  );

  const returnAnchor = mode === "tables" ? "table-seating" : "row-seating";

  const normalSeats = useMemo(
    () =>
      seats.filter(
        (seat) => !seat.ticket_type_id && seat.status === "available",
      ),
    [seats],
  );

  const blockedSeats = useMemo(
    () => seats.filter((seat) => seat.status === "blocked"),
    [seats],
  );

  const seatsWithDetails = useMemo(
    () =>
      seats
        .filter((seat) => hasAllocationDetails(seat))
        .sort(allocationSort),
    [seats],
  );

  const selectedRows = useMemo(
    () => Array.from(new Set(selectedRowKeys)),
    [selectedRowKeys],
  );

  const selectedSeats = useMemo(
    () => seats.filter((seat) => selectedSeatIds.includes(seat.id)),
    [seats, selectedSeatIds],
  );

  const rowSeatingLayoutPayload = useMemo(() => manualOffsets, [manualOffsets]);

  const tableGroups = useMemo(() => {
    if (mode !== "tables") return [];

    return Object.entries(groupBy(seats, (seat) => seat.table_number || "No table"))
      .sort(([a], [b]) => numericSort(a, b))
      .map(([tableNumber, tableSeats]) => [
        tableNumber,
        tableSeats.slice().sort((a, b) => numericSort(a.seat_number, b.seat_number)),
      ]) as [string, Seat[]][];
  }, [mode, seats]);

  const activeTableNumber =
    mode === "tables"
      ? tableGroups.some(([tableNumber]) => tableNumber === selectedTableNumber)
        ? selectedTableNumber
        : tableGroups[0]?.[0] || ""
      : "";

  const activeTableSeats =
    mode === "tables"
      ? tableGroups.find(([tableNumber]) => tableNumber === activeTableNumber)?.[1] ||
        []
      : [];

  const activeTableSoldCount = activeTableSeats.filter(
    (seat) => seat.status === "sold",
  ).length;

  const activeTableBlockedCount = activeTableSeats.filter(
    (seat) => seat.status === "blocked",
  ).length;

  const activeTableAvailableCount = activeTableSeats.filter(
    (seat) => seat.status === "available",
  ).length;

  const byPrimaryGroup = useMemo(
    () =>
      mode === "tables"
        ? {}
        : groupBy(seats, (seat) => seat.section || "Main"),
    [mode, seats],
  );

  useEffect(() => {
    setManualOffsets(getRowOffsets(initialSeatingLayout));
  }, [initialSeatingLayout]);

  useEffect(() => {
    if (mode !== "tables") return;

    if (tableGroups.length === 0) {
      setSelectedTableNumber("");
      return;
    }

    const stillExists = tableGroups.some(
      ([tableNumber]) => tableNumber === selectedTableNumber,
    );

    if (!selectedTableNumber || !stillExists) {
      setSelectedTableNumber(tableGroups[0][0]);
    }
  }, [mode, selectedTableNumber, tableGroups]);

  useEffect(() => {
    if (selectedSeats.length !== 1) return;

    const seat = selectedSeats[0];

    setSeatPurpose(seat.seat_purpose || "");
    setAdminLabel(seat.admin_label || "");
    setAdminNote(seat.admin_note || "");
    setGuestName(seat.guest_name || "");
    setGuestEmail(seat.guest_email || "");
    setDietaryRequirements(seat.dietary_requirements || "");
    setMenuChoice(seat.menu_choice || "");
  }, [selectedSeats]);

  function changeRowOffset(rowKey: string, amount: number) {
    setManualOffsets((current) => ({
      ...current,
      [rowKey]: Math.max(-20, Math.min(20, (current[rowKey] || 0) + amount)),
    }));
  }

  function resetRowOffsets() {
    setManualOffsets({});
  }

  function selectOnlySeat(seatId: string) {
    setSelectedSeatIds([seatId]);
    setSelectedRowKeys([]);

    window.setTimeout(() => {
      document.getElementById("individual-seat-editor")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 50);
  }

  function toggleSeat(seatId: string) {
    setSelectedRowKeys([]);
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

  function clearAllocationForm() {
    setSeatPurpose("");
    setAdminLabel("");
    setAdminNote("");
    setGuestName("");
    setGuestEmail("");
    setDietaryRequirements("");
    setMenuChoice("");
  }

  function selectNormalSeats() {
    setSelectedSeatIds(normalSeats.map((seat) => seat.id));
    setSelectedRowKeys([]);
  }

  function selectBlockedSeats() {
    setSelectedSeatIds(blockedSeats.map((seat) => seat.id));
    setSelectedRowKeys([]);
  }

  function changeSelectedTable(tableNumber: string) {
    setSelectedTableNumber(tableNumber);
    clearSelection();
  }

  function selectVisibleTableSeats() {
    setSelectedSeatIds((current) =>
      Array.from(new Set([...current, ...activeTableSeats.map((seat) => seat.id)])),
    );
    setSelectedRowKeys([]);
  }

  return (
    <div style={styles.manager}>
      <style>{responsiveStyles}</style>

      <div style={styles.toolbar}>
        <div>
          <h3 style={styles.title}>Seat manager</h3>
          <p style={styles.text}>
            Select seats, then save allocation details, apply ticket markings, or
            block/unblock seats.
          </p>
        </div>

        <div style={styles.toolbarButtons}>
          {mode === "rows" && (
            <>
              <button
                type="button"
                onClick={resetRowOffsets}
                style={styles.secondaryButton}
              >
                Reset row nudges
              </button>

              {updateSeatingLayoutAction && (
                <form action={updateSeatingLayoutAction}>
                  <input type="hidden" name="event_id" value={eventId} />
                  <input type="hidden" name="return_anchor" value={returnAnchor} />
                  <input
                    type="hidden"
                    name="seating_layout_json"
                    value={JSON.stringify(rowSeatingLayoutPayload)}
                  />

                  <button type="submit" style={styles.primaryButton}>
                    Save row layout
                  </button>
                </form>
              )}
            </>
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
            Select normal ({normalSeats.length})
          </button>

          <button
            type="button"
            onClick={selectBlockedSeats}
            disabled={blockedSeats.length === 0}
            style={{
              ...styles.blockOutlineButton,
              opacity: blockedSeats.length === 0 ? 0.45 : 1,
            }}
          >
            Select blocked ({blockedSeats.length})
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
          Normal public
        </span>

        {ticketTypes.map((ticketType) => {
          const colour = colourForTicketType(ticketType, ticketTypes);

          return (
            <span key={ticketType.id} style={styles.legendItem}>
              <span
                style={{ ...styles.legendDot, background: colour.background }}
              />
              {ticketType.name} — {currency} {moneyFromCents(ticketType.price)}
            </span>
          );
        })}

        <span style={styles.legendItem}>
          <span style={{ ...styles.legendDot, background: "#ede9fe" }} />
          VIP
        </span>

        <span style={styles.legendItem}>
          <span style={{ ...styles.legendDot, background: "#ccfbf1" }} />
          Complimentary
        </span>

        <span style={styles.legendItem}>
          <span style={{ ...styles.legendDot, background: "#334155" }} />
          Blocked
        </span>

        <span style={styles.legendItem}>
          <span style={{ ...styles.legendDot, background: "#fef3c7" }} />
          Reserved
        </span>

        <span style={styles.legendItem}>
          <span style={{ ...styles.legendDot, background: "#fecaca" }} />
          Sold
        </span>
      </div>

      <div style={styles.infoBox}>
        <strong>{selectedSeatIds.length}</strong> selected ·{" "}
        <strong>{normalSeats.length}</strong> normal public ·{" "}
        <strong>{blockedSeats.length}</strong> blocked ·{" "}
        <strong>
          {seats.filter((seat) => seat.seat_purpose === "vip").length}
        </strong>{" "}
        VIP ·{" "}
        <strong>
          {seats.filter((seat) => seat.seat_purpose === "complimentary").length}
        </strong>{" "}
        complimentary · <strong>{seatsWithDetails.length}</strong> saved
        allocations.
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

        <form
          id="individual-seat-editor"
          action={updateSelectedSeatsMetadataAction}
          style={styles.allocationForm}
        >
          <input type="hidden" name="event_id" value={eventId} />
          <input type="hidden" name="return_anchor" value={returnAnchor} />
          <input
            type="hidden"
            name="seat_ids"
            value={JSON.stringify(selectedSeatIds)}
          />

          <div style={styles.allocationHeader}>
            <div>
              <h4 style={styles.allocationTitle}>Guest / allocation details</h4>
              <p style={styles.text}>
                Select a seat, enter the allocation details, then save. Multiple
                selected seats receive the same details.
              </p>
            </div>

            <button
              type="button"
              onClick={clearAllocationForm}
              style={styles.secondaryButton}
            >
              Clear form
            </button>
          </div>

          {selectedSeats.length === 1 ? (
            <div style={styles.selectedSeatNotice}>
              Editing: <strong>{seatLabel(selectedSeats[0])}</strong>
            </div>
          ) : selectedSeats.length > 1 ? (
            <div style={styles.warningBox}>
              Multiple seats selected. Saving applies these details to all
              selected seats.
            </div>
          ) : (
            <div style={styles.emptyBox}>
              Select a seat to edit allocation details.
            </div>
          )}

          <div style={styles.twoCol}>
            <label style={styles.field}>
              <span style={styles.label}>Seat purpose</span>
              <select
                name="seat_purpose"
                value={seatPurpose}
                onChange={(event) => setSeatPurpose(event.target.value)}
                style={styles.input}
              >
                <option value="">Normal / no special purpose</option>
                <option value="vip">VIP</option>
                <option value="complimentary">Complimentary</option>
                <option value="staff">Staff</option>
                <option value="sponsor">Sponsor</option>
                <option value="guest">Guest</option>
                <option value="blocked">Blocked allocation</option>
                <option value="other">Other</option>
              </select>
            </label>

            <label style={styles.field}>
              <span style={styles.label}>Admin label</span>
              <input
                name="admin_label"
                value={adminLabel}
                onChange={(event) => setAdminLabel(event.target.value)}
                placeholder="VIP guest, sponsor hold, staff seat..."
                style={styles.input}
              />
            </label>
          </div>

          <div style={styles.twoCol}>
            <label style={styles.field}>
              <span style={styles.label}>Guest name</span>
              <input
                name="guest_name"
                value={guestName}
                onChange={(event) => setGuestName(event.target.value)}
                placeholder="Optional"
                style={styles.input}
              />
            </label>

            <label style={styles.field}>
              <span style={styles.label}>Guest email</span>
              <input
                name="guest_email"
                type="email"
                value={guestEmail}
                onChange={(event) => setGuestEmail(event.target.value)}
                placeholder="Optional"
                style={styles.input}
              />
            </label>
          </div>

          <div style={styles.twoCol}>
            <label style={styles.field}>
              <span style={styles.label}>Dietary requirements</span>
              <input
                name="dietary_requirements"
                value={dietaryRequirements}
                onChange={(event) => setDietaryRequirements(event.target.value)}
                placeholder="Optional"
                style={styles.input}
              />
            </label>

            <label style={styles.field}>
              <span style={styles.label}>Menu choice</span>
              <input
                name="menu_choice"
                value={menuChoice}
                onChange={(event) => setMenuChoice(event.target.value)}
                placeholder="Optional"
                style={styles.input}
              />
            </label>
          </div>

          <label style={styles.field}>
            <span style={styles.label}>Admin note</span>
            <textarea
              name="admin_note"
              value={adminNote}
              onChange={(event) => setAdminNote(event.target.value)}
              rows={3}
              placeholder="Internal note only."
              style={styles.textarea}
            />
          </label>

          <button
            type="submit"
            disabled={selectedSeatIds.length === 0}
            style={{
              ...styles.primaryButton,
              opacity: selectedSeatIds.length === 0 ? 0.45 : 1,
            }}
          >
            Save allocation details
          </button>
        </form>
      </div>

      <div className="admin-seat-bulk-panel" style={styles.bulkPanel}>
        <form
          action={applyTicketTypeAction}
          className="admin-seat-action-form"
          style={styles.actionForm}
        >
          <input type="hidden" name="event_id" value={eventId} />
          <input type="hidden" name="return_anchor" value={returnAnchor} />
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
            Apply marking
          </button>
        </form>

        <form
          action={updateSelectedSeatsStatusAction}
          className="admin-seat-action-form"
          style={styles.actionForm}
        >
          <input type="hidden" name="event_id" value={eventId} />
          <input type="hidden" name="return_anchor" value={returnAnchor} />
          <input
            type="hidden"
            name="seat_ids"
            value={JSON.stringify(selectedSeatIds)}
          />
          <input type="hidden" name="status" value="blocked" />

          <button
            type="submit"
            disabled={selectedSeatIds.length === 0}
            style={{
              ...styles.blockButton,
              opacity: selectedSeatIds.length === 0 ? 0.45 : 1,
            }}
          >
            Block selected
          </button>
        </form>

        <form
          action={updateSelectedSeatsStatusAction}
          className="admin-seat-action-form"
          style={styles.actionForm}
        >
          <input type="hidden" name="event_id" value={eventId} />
          <input type="hidden" name="return_anchor" value={returnAnchor} />
          <input
            type="hidden"
            name="seat_ids"
            value={JSON.stringify(selectedSeatIds)}
          />
          <input type="hidden" name="status" value="available" />

          <button
            type="submit"
            disabled={selectedSeatIds.length === 0}
            style={{
              ...styles.normalButton,
              opacity: selectedSeatIds.length === 0 ? 0.45 : 1,
            }}
          >
            Unblock selected
          </button>
        </form>

        <form
          action={deleteSelectedSeatsAction}
          className="admin-seat-action-form"
          style={styles.actionForm}
        >
          <input type="hidden" name="event_id" value={eventId} />
          <input type="hidden" name="return_anchor" value={returnAnchor} />
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
            Delete selected
          </button>
        </form>

        {mode === "rows" && deleteSelectedRowsAction && (
          <form
            action={deleteSelectedRowsAction}
            className="admin-seat-action-form"
            style={styles.actionForm}
          >
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
        {mode === "tables" ? (
          tableGroups.length === 0 ? (
            <div style={styles.emptyBox}>No table seats generated yet.</div>
          ) : (
            <div style={styles.tableModePanel}>
              <div style={styles.tableSelectorPanel}>
                <div
                  className="admin-seat-table-selector-header"
                  style={styles.tableSelectorHeader}
                >
                  <div>
                    <h4 style={styles.tableSelectorTitle}>Choose table</h4>
                    <p style={styles.text}>
                      Showing one table at a time to keep the layout compact.
                      Switching tables clears the current selection.
                    </p>
                  </div>

                  <label style={styles.tableSelectWrap}>
                    <span style={styles.label}>Current table</span>
                    <select
                      className="admin-seat-table-select"
                      value={activeTableNumber}
                      onChange={(event) =>
                        changeSelectedTable(event.target.value)
                      }
                      style={styles.tableSelect}
                    >
                      {tableGroups.map(([tableNumber, tableSeats]) => (
                        <option key={tableNumber} value={tableNumber}>
                          {displayTableTitle(tableNumber, tableNames)} ·{" "}
                          {tableSeats.length} seats
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <div style={styles.tableQuickNav}>
                  {tableGroups.map(([tableNumber]) => {
                    const active = tableNumber === activeTableNumber;

                    return (
                      <button
                        key={tableNumber}
                        type="button"
                        onClick={() => changeSelectedTable(tableNumber)}
                        style={{
                          ...styles.tableQuickButton,
                          ...(active ? styles.tableQuickButtonActive : {}),
                        }}
                      >
                        {tableNumber}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div style={styles.tableMetaGrid}>
                <div style={styles.tableMetaCard}>
                  <span style={styles.tableMetaLabel}>Seats</span>
                  <strong style={styles.tableMetaValue}>
                    {activeTableSeats.length}
                  </strong>
                </div>

                <div style={styles.tableMetaCard}>
                  <span style={styles.tableMetaLabel}>Available</span>
                  <strong style={styles.tableMetaValue}>
                    {activeTableAvailableCount}
                  </strong>
                </div>

                <div style={styles.tableMetaCard}>
                  <span style={styles.tableMetaLabel}>Sold</span>
                  <strong style={styles.tableMetaValue}>
                    {activeTableSoldCount}
                  </strong>
                </div>

                <div style={styles.tableMetaCard}>
                  <span style={styles.tableMetaLabel}>Blocked</span>
                  <strong style={styles.tableMetaValue}>
                    {activeTableBlockedCount}
                  </strong>
                </div>
              </div>

              <div style={styles.tableRowCard}>
                <div style={styles.tableRowHeader}>
                  <div>
                    <h4 style={styles.groupTitle}>
                      {displayTableTitle(activeTableNumber, tableNames)}
                    </h4>
                    <p style={styles.text}>
                      {activeTableSeats.length} seats. Click seats to select;
                      double-click to edit.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={selectVisibleTableSeats}
                    disabled={activeTableSeats.length === 0}
                    style={{
                      ...styles.secondaryButton,
                      opacity: activeTableSeats.length === 0 ? 0.45 : 1,
                    }}
                  >
                    Select table
                  </button>
                </div>

                <div style={styles.tableSeatLine}>
                  {activeTableSeats.map((seat) => {
                    const ticketType = ticketTypes.find(
                      (item) => item.id === seat.ticket_type_id,
                    );
                    const selected = selectedSeatIds.includes(seat.id);

                    return (
                      <button
                        key={seat.id}
                        type="button"
                        onClick={() => toggleSeat(seat.id)}
                        onDoubleClick={() => selectOnlySeat(seat.id)}
                        title={seatTitle(seat)}
                        style={seatStyle({
                          selected,
                          ticketType,
                          ticketTypes,
                          status: seat.status,
                          seatPurpose: seat.seat_purpose,
                        })}
                      >
                        {seat.seat_number}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )
        ) : (
          Object.entries(byPrimaryGroup)
            .sort(([a], [b]) => numericSort(a, b))
            .map(([group, groupSeats]) => {
              const rows = groupBy(
                groupSeats,
                (seat) => seat.row_label || "No row",
              );

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
                      .sort((a, b) =>
                        numericSort(a.seat_number, b.seat_number),
                      );

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

                            const selected = selectedSeatIds.includes(seat.id);

                            return (
                              <span key={seat.id} style={styles.seatWrap}>
                                <button
                                  type="button"
                                  onClick={() => toggleSeat(seat.id)}
                                  onDoubleClick={() => selectOnlySeat(seat.id)}
                                  title={seatTitle(seat)}
                                  style={seatStyle({
                                    selected,
                                    ticketType,
                                    ticketTypes,
                                    status: seat.status,
                                    seatPurpose: seat.seat_purpose,
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
            })
        )}
      </div>

      <div style={styles.savedAllocationsPanel}>
        <div style={styles.allocationHeader}>
          <div>
            <h4 style={styles.allocationTitle}>Saved allocation summary</h4>
            <p style={styles.text}>
              Seats with saved VIP, complimentary, blocked, guest, dietary,
              menu, label, or note details.
            </p>
          </div>
        </div>

        {seatsWithDetails.length === 0 ? (
          <div style={styles.emptyBox}>No saved allocation details yet.</div>
        ) : (
          <div style={styles.tableScroll}>
            <table style={styles.allocationTable}>
              <thead>
                <tr>
                  <th style={styles.th}>Seat</th>
                  <th style={styles.th}>Purpose</th>
                  <th style={styles.th}>Label</th>
                  <th style={styles.th}>Guest</th>
                  <th style={styles.th}>Email</th>
                  <th style={styles.th}>Dietary</th>
                  <th style={styles.th}>Menu</th>
                  <th style={styles.th}>Note</th>
                  <th style={styles.th}>Edit</th>
                </tr>
              </thead>

              <tbody>
                {seatsWithDetails.map((seat) => (
                  <tr key={seat.id}>
                    <td style={styles.tdStrong}>{seatLabel(seat)}</td>
                    <td style={styles.td}>{purposeLabel(seat.seat_purpose)}</td>
                    <td style={styles.td}>{seat.admin_label || "—"}</td>
                    <td style={styles.td}>{seat.guest_name || "—"}</td>
                    <td style={styles.td}>{seat.guest_email || "—"}</td>
                    <td style={styles.td}>
                      {seat.dietary_requirements || "—"}
                    </td>
                    <td style={styles.td}>{seat.menu_choice || "—"}</td>
                    <td style={styles.td}>{seat.admin_note || "—"}</td>
                    <td style={styles.td}>
                      <button
                        type="button"
                        onClick={() => selectOnlySeat(seat.id)}
                        style={styles.smallButton}
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

const responsiveStyles = `
@media (max-width: 680px) {
  .admin-seat-table-selector-header {
    grid-template-columns: 1fr !important;
  }

  .admin-seat-table-select,
  .admin-seat-action-form,
  .admin-seat-action-form select,
  .admin-seat-action-form button {
    width: 100% !important;
  }

  .admin-seat-bulk-panel {
    display: grid !important;
    grid-template-columns: 1fr !important;
  }
}
`;

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
    gap: 12,
    padding: 12,
    borderRadius: 16,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
  },

  bulkPanel: {
    display: "flex",
    flexWrap: "wrap",
    gap: 10,
    padding: 12,
    borderRadius: 16,
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
  },

  summaryBox: { color: "#0f172a", fontSize: 14, fontWeight: 800 },

  actionForm: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
    alignItems: "center",
  },

  allocationForm: {
    display: "grid",
    gap: 12,
    padding: 12,
    borderRadius: 16,
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
  },

  allocationHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "start",
    flexWrap: "wrap",
  },

  allocationTitle: {
    margin: 0,
    color: "#0f172a",
    fontSize: 16,
    fontWeight: 900,
  },

  selectedSeatNotice: {
    padding: 10,
    borderRadius: 12,
    background: "#dcfce7",
    border: "1px solid #86efac",
    color: "#14532d",
    fontSize: 13,
    fontWeight: 800,
  },

  warningBox: {
    padding: 10,
    borderRadius: 12,
    background: "#fef3c7",
    border: "1px solid #fcd34d",
    color: "#92400e",
    fontSize: 13,
    fontWeight: 800,
  },

  twoCol: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: 10,
  },

  field: {
    display: "grid",
    gap: 5,
    minWidth: 0,
  },

  label: {
    color: "#334155",
    fontSize: 12,
    fontWeight: 900,
  },

  input: {
    width: "100%",
    minHeight: 40,
    padding: "9px 10px",
    borderRadius: 12,
    border: "1px solid #cbd5e1",
    background: "#ffffff",
    color: "#0f172a",
    fontSize: 14,
    boxSizing: "border-box",
  },

  textarea: {
    width: "100%",
    padding: "9px 10px",
    borderRadius: 12,
    border: "1px solid #cbd5e1",
    background: "#ffffff",
    color: "#0f172a",
    fontSize: 14,
    resize: "vertical",
    boxSizing: "border-box",
  },

  select: {
    minHeight: 42,
    minWidth: 180,
    borderRadius: 12,
    border: "1px solid #cbd5e1",
    padding: "8px 10px",
    fontWeight: 800,
    background: "#ffffff",
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

  smallButton: {
    minHeight: 32,
    borderRadius: 999,
    border: "1px solid #cbd5e1",
    background: "#ffffff",
    color: "#0f172a",
    padding: "0 10px",
    fontWeight: 900,
    cursor: "pointer",
    fontSize: 12,
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

  blockButton: {
    minHeight: 42,
    border: "none",
    borderRadius: 999,
    background: "#334155",
    color: "#ffffff",
    padding: "0 14px",
    fontWeight: 900,
    cursor: "pointer",
  },

  blockOutlineButton: {
    minHeight: 40,
    borderRadius: 999,
    border: "1px solid #64748b",
    background: "#334155",
    color: "#ffffff",
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

  emptyBox: {
    padding: 16,
    borderRadius: 16,
    background: "#ffffff",
    border: "1px dashed #cbd5e1",
    color: "#64748b",
    fontWeight: 800,
  },

  mapPanel: {
    maxHeight: 640,
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

  tableModePanel: {
    display: "grid",
    gap: 12,
  },

  tableSelectorPanel: {
    display: "grid",
    gap: 12,
    padding: 14,
    borderRadius: 18,
    background:
      "linear-gradient(135deg, #f8fafc 0%, #ffffff 58%, #eff6ff 100%)",
    border: "1px solid #dbeafe",
  },

  tableSelectorHeader: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) minmax(220px, 0.36fr)",
    gap: 12,
    alignItems: "end",
  },

  tableSelectorTitle: {
    margin: 0,
    color: "#0f172a",
    fontSize: 18,
    fontWeight: 950,
    letterSpacing: "-0.025em",
  },

  tableSelectWrap: {
    display: "grid",
    gap: 6,
    minWidth: 0,
  },

  tableSelect: {
    width: "100%",
    minHeight: 42,
    borderRadius: 13,
    border: "1px solid #cbd5e1",
    background: "#ffffff",
    color: "#0f172a",
    padding: "9px 10px",
    fontWeight: 850,
    boxSizing: "border-box",
  },

  tableQuickNav: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
    alignItems: "center",
  },

  tableQuickButton: {
    minWidth: 42,
    minHeight: 36,
    padding: "0 12px",
    borderRadius: 999,
    border: "1px solid #cbd5e1",
    background: "#ffffff",
    color: "#334155",
    fontWeight: 900,
    cursor: "pointer",
  },

  tableQuickButtonActive: {
    borderColor: "#1683f8",
    background: "#1683f8",
    color: "#ffffff",
    boxShadow: "0 10px 20px rgba(22,131,248,0.16)",
  },

  tableMetaGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
    gap: 10,
  },

  tableMetaCard: {
    display: "grid",
    gap: 3,
    padding: 12,
    borderRadius: 16,
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
  },

  tableMetaLabel: {
    color: "#64748b",
    fontSize: 11,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.06em",
  },

  tableMetaValue: {
    color: "#0f172a",
    fontSize: 22,
    lineHeight: 1,
    fontWeight: 950,
  },

  tableRowCard: {
    display: "grid",
    gap: 12,
    padding: 14,
    borderRadius: 18,
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
  },

  tableRowHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "center",
    flexWrap: "wrap",
  },

  tableSeatLine: {
    display: "flex",
    gap: 6,
    flexWrap: "wrap",
    alignItems: "center",
    padding: 12,
    borderRadius: 16,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
  },

  savedAllocationsPanel: {
    display: "grid",
    gap: 12,
    padding: 12,
    borderRadius: 16,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
  },

  tableScroll: {
    overflow: "auto",
    borderRadius: 14,
    border: "1px solid #e2e8f0",
  },

  allocationTable: {
    width: "100%",
    minWidth: 920,
    borderCollapse: "collapse",
    background: "#ffffff",
  },

  th: {
    padding: "10px 12px",
    textAlign: "left",
    background: "#f8fafc",
    borderBottom: "1px solid #e2e8f0",
    color: "#334155",
    fontSize: 12,
    fontWeight: 900,
    whiteSpace: "nowrap",
  },

  td: {
    padding: "10px 12px",
    borderBottom: "1px solid #f1f5f9",
    color: "#334155",
    fontSize: 13,
    verticalAlign: "top",
  },

  tdStrong: {
    padding: "10px 12px",
    borderBottom: "1px solid #f1f5f9",
    color: "#0f172a",
    fontSize: 13,
    fontWeight: 900,
    whiteSpace: "nowrap",
    verticalAlign: "top",
  },
};
