export type NormalizedOffer = {
  id?: string;
  label: string;
  price_cents: number;
  quantity: number;
  is_active: boolean;
  sort_order: number;
};

type RawOffer = {
  id?: string;
  label?: string;
  price?: number;
  price_cents?: number;
  quantity?: number;
  tickets?: number;
  isActive?: boolean;
  is_active?: boolean;
  sortOrder?: number;
  sort_order?: number;
};

export function normalizeOffers(input: unknown): NormalizedOffer[] {
  if (!Array.isArray(input)) return [];

  return input
    .map((item, index): NormalizedOffer | null => {
      if (!item || typeof item !== "object") return null;
      const raw = item as RawOffer;

      const quantity = Number(raw.quantity ?? raw.tickets ?? 0);
      const is_active = Boolean(raw.is_active ?? raw.isActive ?? false);
      const sort_order = Number(raw.sort_order ?? raw.sortOrder ?? index);

      let price_cents = 0;
      if (typeof raw.price_cents === "number" && Number.isFinite(raw.price_cents)) {
        price_cents = Math.round(raw.price_cents);
      } else if (typeof raw.price === "number" && Number.isFinite(raw.price)) {
        price_cents = Math.round(raw.price * 100);
      }

      const label = String(raw.label ?? "").trim();

      if (!label || quantity <= 0 || price_cents <= 0) return null;

      return {
        id: raw.id,
        label,
        quantity,
        price_cents,
        is_active,
        sort_order,
      };
    })
    .filter((offer): offer is NormalizedOffer => Boolean(offer))
    .sort((a, b) => a.sort_order - b.sort_order);
}

export type BestPriceBreakdown = {
  quantity: number;
  subtotal_cents: number;
  unit_price_cents: number;
  applied_offers: Array<{
    id?: string;
    label: string;
    quantity: number;
    price_cents: number;
    count: number;
  }>;
  remainder_tickets: number;
};

export function getBestPriceForQuantity(params: {
  quantity: number;
  single_ticket_price_cents: number;
  offers: NormalizedOffer[];
}): BestPriceBreakdown {
  const { quantity, single_ticket_price_cents } = params;
  const offers = params.offers.filter((o) => o.is_active);

  const q = Math.max(0, Math.floor(quantity));
  const single = Math.max(0, Math.floor(single_ticket_price_cents));

  if (q === 0) {
    return {
      quantity: 0,
      subtotal_cents: 0,
      unit_price_cents: single,
      applied_offers: [],
      remainder_tickets: 0,
    };
  }

  const dp = new Array<number>(q + 1).fill(Infinity);
  const choice = new Array<
    | null
    | {
        type: "single";
      }
    | {
        type: "offer";
        offer: NormalizedOffer;
      }
  >(q + 1).fill(null);

  dp[0] = 0;

  for (let i = 1; i <= q; i += 1) {
    if (dp[i - 1] + single < dp[i]) {
      dp[i] = dp[i - 1] + single;
      choice[i] = { type: "single" };
    }

    for (const offer of offers) {
      if (i >= offer.quantity && dp[i - offer.quantity] + offer.price_cents < dp[i]) {
        dp[i] = dp[i - offer.quantity] + offer.price_cents;
        choice[i] = { type: "offer", offer };
      }
    }
  }

  const offerCounts = new Map<string, { offer: NormalizedOffer; count: number }>();
  let cursor = q;
  let singles = 0;

  while (cursor > 0) {
    const picked = choice[cursor];
    if (!picked) {
      singles += cursor;
      break;
    }

    if (picked.type === "single") {
      singles += 1;
      cursor -= 1;
      continue;
    }

    const key = picked.offer.id ?? `${picked.offer.label}-${picked.offer.quantity}-${picked.offer.price_cents}`;
    const existing = offerCounts.get(key);
    if (existing) {
      existing.count += 1;
    } else {
      offerCounts.set(key, { offer: picked.offer, count: 1 });
    }
    cursor -= picked.offer.quantity;
  }

  const applied_offers = Array.from(offerCounts.values()).map(({ offer, count }) => ({
    id: offer.id,
    label: offer.label,
    quantity: offer.quantity,
    price_cents: offer.price_cents,
    count,
  }));

  return {
    quantity: q,
    subtotal_cents: dp[q],
    unit_price_cents: q > 0 ? Math.round(dp[q] / q) : single,
    applied_offers,
    remainder_tickets: singles,
  };
}
