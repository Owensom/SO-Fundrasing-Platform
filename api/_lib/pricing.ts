type Offer = {
  label: string;
  quantity: number;
  price: number;
};

export function calculateOfferTotal(
  ticketCount: number,
  ticketPriceCents: number,
  offers: Offer[],
) {
  let remaining = ticketCount;
  let total = 0;

  const sorted = [...offers].sort(
    (a, b) => b.quantity - a.quantity
  );

  for (const offer of sorted) {
    while (remaining >= offer.quantity) {
      total += offer.price * 100; // convert to cents
      remaining -= offer.quantity;
    }
  }

  total += remaining * ticketPriceCents;

  return total;
}
