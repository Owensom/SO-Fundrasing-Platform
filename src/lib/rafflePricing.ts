import type { RaffleOffer } from "../types/raffles";

export type AppliedOfferBreakdown = {
  offerId: string;
  label: string;
  quantity: number;
  price: number;
  count: number;
};

export type BestPriceResult = {
  quantity: number;
  subtotal: number;
  total: number;
  discount: number;
  singlesCount: number;
  singlesTotal: number;
  appliedOffers: AppliedOfferBreakdown[];
};

function toPennies(amount: number): number {
  return Math.round(amount * 100);
}

function fromPennies(amount: number): number {
  return Math.round(amount) / 100;
}

export function getBestPrice(
  quantity: number,
  ticketPrice: number,
  offers: RaffleOffer[],
): BestPriceResult {
  const safeQuantity = Math.max(0, Math.floor(quantity));
  const singlePennies = toPennies(ticketPrice);
  const subtotalPennies = safeQuantity * singlePennies;

  const activeOffers = offers
    .filter((offer) => offer.isActive && offer.quantity > 0 && offer.price > 0)
    .sort((a, b) => a.quantity - b.quantity || a.price - b.price);

  if (safeQuantity === 0) {
    return {
      quantity: 0,
      subtotal: 0,
      total: 0,
      discount: 0,
      singlesCount: 0,
      singlesTotal: 0,
      appliedOffers: [],
    };
  }

  const dp = new Array<number>(safeQuantity + 1).fill(Number.POSITIVE_INFINITY);
  const choice = new Array<
    | { type: "single" }
    | {
        type: "offer";
        offer: RaffleOffer;
      }
    | null
  >(safeQuantity + 1).fill(null);

  dp[0] = 0;

  for (let i = 1; i <= safeQuantity; i += 1) {
    const singleCost = dp[i - 1] + singlePennies;
    dp[i] = singleCost;
    choice[i] = { type: "single" };

    for (const offer of activeOffers) {
      if (i >= offer.quantity) {
        const offerCost = dp[i - offer.quantity] + toPennies(offer.price);
        if (offerCost < dp[i]) {
          dp[i] = offerCost;
          choice[i] = { type: "offer", offer };
        }
      }
    }
  }

  const appliedMap = new Map<string, AppliedOfferBreakdown>();
  let singlesCount = 0;
  let cursor = safeQuantity;

  while (cursor > 0) {
    const picked = choice[cursor];

    if (!picked) {
      singlesCount += 1;
      cursor -= 1;
      continue;
    }

    if (picked.type === "single") {
      singlesCount += 1;
      cursor -= 1;
      continue;
    }

    const existing = appliedMap.get(picked.offer.id);
    if (existing) {
      existing.count += 1;
    } else {
      appliedMap.set(picked.offer.id, {
        offerId: picked.offer.id,
        label: picked.offer.label,
        quantity: picked.offer.quantity,
        price: picked.offer.price,
        count: 1,
      });
    }

    cursor -= picked.offer.quantity;
  }

  const totalPennies = dp[safeQuantity];
  const singlesTotalPennies = singlesCount * singlePennies;
  const discountPennies = subtotalPennies - totalPennies;

  return {
    quantity: safeQuantity,
    subtotal: fromPennies(subtotalPennies),
    total: fromPennies(totalPennies),
    discount: fromPennies(discountPennies),
    singlesCount,
    singlesTotal: fromPennies(singlesTotalPennies),
    appliedOffers: Array.from(appliedMap.values()).sort(
      (a, b) => b.quantity - a.quantity || a.label.localeCompare(b.label),
    ),
  };
}
