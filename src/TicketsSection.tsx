function buyTickets() {
  if (!canBuy) return;

  const now = new Date().toLocaleString();

  if (event.mode === "rows") {
    appendLedger({
      id: String(Date.now()),
      module: "tickets",
      itemTitle: event.title,
      buyerName: buyerName.trim(),
      buyerEmail: buyerEmail.trim(),
      description: `Seats: ${selectedSeats.join(", ")}`,
      quantity: selectedSeats.length,
      total,
      createdAt: now,
    });

    setPurchases((curr) => [
      {
        id: Date.now(),
        eventId: event.id,
        eventTitle: event.title,
        buyerName: buyerName.trim(),
        buyerEmail: buyerEmail.trim(),
        mode: "rows",
        seats: [...selectedSeats],
        quantity: selectedSeats.length,
        total,
        createdAt: now,
      },
      ...curr,
    ]);

    setEvents((curr) =>
      curr.map((e) =>
        e.id === event.id
          ? { ...e, soldSeatIds: [...e.soldSeatIds, ...selectedSeats].sort() }
          : e,
      ),
    );

    setSelectedSeatIdsByEvent((curr) => ({ ...curr, [event.id]: [] }));
  } else {
    appendLedger({
      id: String(Date.now()),
      module: "tickets",
      itemTitle: event.title,
      buyerName: buyerName.trim(),
      buyerEmail: buyerEmail.trim(),
      description: `Table: ${selectedTable?.name ?? "Unknown"} × ${quantity}`,
      quantity,
      total,
      createdAt: now,
    });

    setPurchases((curr) => [
      {
        id: Date.now(),
        eventId: event.id,
        eventTitle: event.title,
        buyerName: buyerName.trim(),
        buyerEmail: buyerEmail.trim(),
        mode: "tables",
        seats: [],
        tableName: selectedTable?.name,
        quantity,
        total,
        createdAt: now,
      },
      ...curr,
    ]);

    setEvents((curr) =>
      curr.map((e) =>
        e.id === event.id
          ? {
              ...e,
              tables: e.tables.map((t) =>
                t.id === selectedTableId ? { ...t, sold: t.sold + quantity } : t,
              ),
            }
          : e,
      ),
    );
  }

  const doc = buildReceipt();
  doc.save(`${event.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-receipt.pdf`);
}
