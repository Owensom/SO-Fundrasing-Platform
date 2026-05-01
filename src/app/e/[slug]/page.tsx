"use client";

import { useMemo, useState } from "react";

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

function seatLabel(seat: Seat) {
  if (seat.table_number) {
    return `Table ${seat.table_number}, Seat ${seat.seat_number || "?"}`;
  }

  if (seat.row_label) {
    return `${seat.section ? `${seat.section} · ` : ""}Row ${
      seat.row_label
    }, Seat ${seat.seat_number || "?"}`;
  }

  return `Seat ${seat.seat_number || "?"}`;
}

function seatClass(status: string, selected: boolean) {
  if (selected) {
    return "bg-sky-300 text-slate-950 ring-4 ring-sky-500/40";
  }

  if (status === "sold") {
    return "bg-rose-300 text-rose-950 opacity-70 cursor-not-allowed";
  }

  if (status === "reserved") {
    return "bg-amber-300 text-amber-950 opacity-80 cursor-not-allowed";
  }

  if (status === "blocked") {
    return "bg-slate-600 text-slate-200 opacity-70 cursor-not-allowed";
  }

  return "bg-emerald-400 text-slate-950 hover:bg-emerald-300";
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
    const ticketType = ticketTypes.find(
      (item) => item.id === seat.ticket_type_id,
    );

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
  const seatsToRender = eventType === "tables" ? tableSeats : rowSeats;

  if (seatsToRender.length === 0) {
    return (
      <div className="rounded-3xl border border-dashed border-white/15 p-8 text-center">
        <p className="text-lg font-black">No seats available</p>
        <p className="mt-2 text-sm text-slate-400">
          Seats may not have been released yet.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
      <div className="max-h-[720px] overflow-auto rounded-3xl bg-slate-900 p-5">
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

        <SeatLegend />
      </div>

      <aside className="rounded-3xl border border-white/10 bg-slate-900 p-5">
        <h3 className="text-2xl font-black">Your seats</h3>

        {selectedSeats.length === 0 ? (
          <p className="mt-3 text-sm text-slate-400">
            Select available seats from the map.
          </p>
        ) : (
          <div className="mt-4 space-y-3">
            {selectedSeats.map((seat) => {
              const ticketType = ticketTypes.find(
                (item) => item.id === seat.ticket_type_id,
              );

              return (
                <div
                  key={seat.id}
                  className="rounded-2xl border border-white/10 bg-slate-950 p-3"
                >
                  <p className="font-black">{seatLabel(seat)}</p>
                  <p className="mt-1 text-sm text-slate-400">
                    {ticketType?.name || "Standard ticket"}
                  </p>
                  <p className="mt-1 text-sm font-black text-amber-300">
                    {currency} {moneyFromCents(ticketType?.price || 0)}
                  </p>
                </div>
              );
            })}

            <div className="border-t border-white/10 pt-4">
              <p className="flex justify-between text-lg font-black">
                <span>Total</span>
                <span>
                  {currency} {moneyFromCents(total)}
                </span>
              </p>
            </div>
          </div>
        )}

        <button
          type="button"
          disabled={selectedSeats.length === 0}
          className="mt-5 w-full rounded-2xl bg-amber-300 px-5 py-4 text-sm font-black text-slate-950 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Checkout next
        </button>

        <p className="mt-3 text-xs leading-5 text-slate-500">
          Seat selection is active. Payment checkout will be connected in the
          next step.
        </p>
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
    <>
      <div className="mb-6 rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-center text-sm font-black uppercase tracking-[0.3em] text-slate-400">
        Stage / Front
      </div>

      <div className="min-w-max space-y-8">
        {Object.entries(bySection)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([section, sectionSeats]) => {
            const byRow = groupBy(
              sectionSeats,
              (seat) => seat.row_label || "Seats",
            );

            return (
              <div key={section} className="space-y-4">
                <div className="rounded-2xl bg-white/10 px-4 py-2 text-sm font-black uppercase tracking-wide text-white">
                  {section}
                </div>

                {Object.entries(byRow)
                  .sort(([a], [b]) => numericSort(a, b))
                  .map(([rowLabel, rowSeats]) => {
                    const sortedSeats = rowSeats
                      .slice()
                      .sort((a, b) =>
                        numericSort(a.seat_number, b.seat_number),
                      );

                    return (
                      <div
                        key={`${section}-${rowLabel}`}
                        className="grid grid-cols-[72px_1fr] items-center gap-3"
                      >
                        <div className="text-sm font-black text-slate-400">
                          Row {rowLabel}
                        </div>

                        <div className="flex items-center gap-2">
                          {sortedSeats.map((seat) => {
                            const selected = selectedSeatIds.includes(seat.id);
                            const ticketType = ticketTypes.find(
                              (item) => item.id === seat.ticket_type_id,
                            );

                            return (
                              <span
                                key={seat.id}
                                className="inline-flex items-center gap-2"
                              >
                                <button
                                  type="button"
                                  disabled={seat.status !== "available"}
                                  onClick={() => onToggleSeat(seat)}
                                  title={`${seatLabel(seat)}${
                                    ticketType
                                      ? ` · ${ticketType.name} · ${currency} ${moneyFromCents(
                                          ticketType.price,
                                        )}`
                                      : ""
                                  } · ${seat.status}`}
                                  className={`flex h-11 min-w-11 items-center justify-center rounded-xl px-3 text-sm font-black ${seatClass(
                                    seat.status,
                                    selected,
                                  )}`}
                                >
                                  {seat.seat_number}
                                </button>

                                {seat.aisle_after ? (
                                  <span className="mx-4 inline-flex h-12 w-24 shrink-0 items-center justify-center rounded-xl border-2 border-dashed border-amber-300/80 bg-amber-300/10 text-[10px] font-black uppercase tracking-widest text-amber-200">
                                    Aisle
                                  </span>
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
    </>
  );
}

function TableGrid({
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
  const byTable = groupBy(seats, (seat) => seat.table_number || "Table");

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {Object.entries(byTable)
        .sort(([a], [b]) => numericSort(a, b))
        .map(([tableNumber, tableSeats]) => (
          <div
            key={tableNumber}
            className="rounded-3xl border border-white/10 bg-slate-950 p-4"
          >
            <h3 className="text-lg font-black">Table {tableNumber}</h3>

            <div className="mt-4 flex flex-wrap gap-2">
              {tableSeats
                .slice()
                .sort((a, b) => numericSort(a.seat_number, b.seat_number))
                .map((seat) => {
                  const selected = selectedSeatIds.includes(seat.id);
                  const ticketType = ticketTypes.find(
                    (item) => item.id === seat.ticket_type_id,
                  );

                  return (
                    <button
                      key={seat.id}
                      type="button"
                      disabled={seat.status !== "available"}
                      onClick={() => onToggleSeat(seat)}
                      title={`${seatLabel(seat)}${
                        ticketType
                          ? ` · ${ticketType.name} · ${currency} ${moneyFromCents(
                              ticketType.price,
                            )}`
                          : ""
                      } · ${seat.status}`}
                      className={`flex h-11 min-w-11 items-center justify-center rounded-xl px-3 text-sm font-black ${seatClass(
                        seat.status,
                        selected,
                      )}`}
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

function SeatLegend() {
  return (
    <div className="mt-6 flex flex-wrap gap-3 text-xs font-bold text-slate-400">
      <span className="inline-flex items-center gap-2">
        <span className="h-3 w-3 rounded bg-emerald-400" />
        Available
      </span>
      <span className="inline-flex items-center gap-2">
        <span className="h-3 w-3 rounded bg-sky-300" />
        Selected
      </span>
      <span className="inline-flex items-center gap-2">
        <span className="h-3 w-3 rounded bg-amber-300" />
        Reserved
      </span>
      <span className="inline-flex items-center gap-2">
        <span className="h-3 w-3 rounded bg-rose-300" />
        Sold
      </span>
      <span className="inline-flex items-center gap-2">
        <span className="h-3 w-3 rounded bg-slate-600" />
        Blocked
      </span>
    </div>
  );
}
