import React ...
...
export default function RaffleSection() {
  if (!canBuy) return;

  const now = new Date().toLocaleString();

  appendLedger({
    id: String(Date.now()),
    module: "raffle",
    itemTitle: event.title,
    buyerName: buyerName.trim(),
    buyerEmail: buyerEmail.trim(),
    description: `${selectedColor}: ${selectedTickets.join(", ")}`,
    quantity: selectedTickets.length,
    total,
    createdAt: now,
  });

  setEvents((curr) =>
    curr.map((e) =>
      e.id === event.id
        ? {
            ...e,
            soldByColor: {
              ...e.soldByColor,
              [selectedColor]: [...(e.soldByColor[selectedColor] ?? []), ...selectedTickets].sort(
                (a, b) => a - b,
              ),
            },
          }
        : e,
    ),
  );

  setPurchases((curr) => [
    {
      id: Date.now(),
      eventId: event.id,
      eventTitle: event.title,
      buyerName: buyerName.trim(),
      buyerEmail: buyerEmail.trim(),
      color: selectedColor,
      tickets: [...selectedTickets],
      quantity: selectedTickets.length,
      total,
      createdAt: now,
    },
    ...curr,
  ]);

  setSelectedTicketsByEvent((curr) => ({ ...curr, [event.id]: [] }));

  downloadReceipt();
}
