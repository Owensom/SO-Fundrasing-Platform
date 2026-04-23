export type NormalizedOffer = {
  id?: string;
  label: string;
  quantity: number;
  price_cents: number;
  is_active: boolean;
  sort_order: number;
};

type RawOffer = {
  id?: string;
  label?: string;
  quantity?: number;
  tickets?: number;
  price?: number;
  price_cents?: number;
  is_active?: boolean;
  isActive?: boolean;
  sort_order?: number;
  sortOrder?: number;
};

function toFiniteNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
}

export function normalizeOffers(input: unknown): NormalizedOffer[] {
  if (!Array.isArray(input)) return [];

  return input
    .map((item, index): NormalizedOffer | null => {
      if (!item || typeof item !== "object") return null;

      const raw = item as RawOffer;

      const label = typeof raw.label === "string" ? raw.label.trim() : "";

      const quantity = Math.floor(
        toFiniteNumber(raw.quantity ?? raw.tickets ?? 0)
      );

      let price_cents = 0;

      if (raw.price_cents !== undefined) {
        price_cents = Math.round(toFiniteNumber(raw.price_cents));
      } else if (raw.price !== undefined) {
        price_cents = Math.round(toFiniteNumber(raw.price) * 100);
      }

      const is_active = raw.is_active === true || raw.isActive === true;

      const sort_order = Math.floor(
        toFiniteNumber(raw.sort_order ?? raw.sortOrder ?? index)
      );

      if (!label) return null;
      if (!Number.isFinite(quantity) || quantity <= 0) return null;
      if (!Number.isFinite(price_cents) || price_cents <= 0) return null;

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

export type AppliedOffer = {
  id?: string;
  label: string;
  quantity: number;
  price_cents: number;
  count: number;
};

export type BestPriceResult = {
  quantity: number;
  subtotal_cents: number;
  base_total_cents: number;
  savings_cents: number;
  applied_offers: AppliedOffer[];
  single_tickets_charged: number;
};

export function getBestPriceForQuantity(params: {
  quantity: number;
  single_ticket_price_cents: number;
  offers: NormalizedOffer[];
}): BestPriceResult {
  const quantity = Math.max(0, Math.floor(params.quantity));
  const single_ticket_price_cents = Math.max(
    0,
    Math.floor(params.single_ticket_price_cents)
  );
  const offers = params.offers.filter((offer) => offer.is_active);

  const base_total_cents = quantity * single_ticket_price_cents;

  if (quantity <= 0 || single_ticket_price_cents <= 0) {
    return {
      quantity,
      subtotal_cents: 0,
      base_total_cents: 0,
      savings_cents: 0,
      applied_offers: [],
      single_tickets_charged: 0,
    };
  }

  const dp = new Array<number>(quantity + 1).fill(Infinity);
  const pick = new Array<
    | null
    | { type: "single" }
    | { type: "offer"; offer: NormalizedOffer }
  >(quantity + 1).fill(null);

  dp[0] = 0;

  for (let i = 1; i <= quantity; i += 1) {
    const singleCandidate = dp[i - 1] + single_ticket_price_cents;
    if (singleCandidate < dp[i]) {
      dp[i] = singleCandidate;
      pick[i] = { type: "single" };
    }

    for (const offer of offers) {
      if (i >= offer.quantity) {
        const offerCandidate = dp[i - offer.quantity] + offer.price_cents;
        if (offerCandidate < dp[i]) {
          dp[i] = offerCandidate;
          pick[i] = { type: "offer", offer };
        }
      }
    }
  }

  let cursor = quantity;
  let single_tickets_charged = 0;
  const appliedOfferMap = new Map<string, AppliedOffer>();

  while (cursor > 0) {
    const chosen = pick[cursor];

    if (!chosen) {
      single_tickets_charged += cursor;
      break;
    }

    if (chosen.type === "single") {
      single_tickets_charged += 1;
      cursor -= 1;
      continue;
    }

    const key =
      chosen.offer.id ||
      `${chosen.offer.label}__${chosen.offer.quantity}__${chosen.offer.price_cents}`;

    const existing = appliedOfferMap.get(key);

    if (existing) {
      existing.count += 1;
    } else {
      appliedOfferMap.set(key, {
        id: chosen.offer.id,
        label: chosen.offer.label,
        quantity: chosen.offer.quantity,
        price_cents: chosen.offer.price_cents,
        count: 1,
      });
    }

    cursor -= chosen.offer.quantity;
  }

  const applied_offers = Array.from(appliedOfferMap.values());
  const subtotal_cents = dp[quantity];
  const savings_cents = Math.max(0, base_total_cents - subtotal_cents);

  return {
    quantity,
    subtotal_cents,
    base_total_cents,
    savings_cents,
    applied_offers,
    single_tickets_charged,
  };
}
