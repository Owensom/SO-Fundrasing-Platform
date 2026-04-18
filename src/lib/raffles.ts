export type RaffleStatus = "draft" | "published" | "completed";

export type RaffleColour = {
  id: string;
  name: string;
  hex: string;
  sortOrder?: number;
};

export type RaffleOffer = {
  id: string;
  label: string;
  quantity: number;
  price: number;
  sortOrder?: number;
  isActive?: boolean;
};

export type RaffleConfig = {
  startNumber: number;
  endNumber: number;
  colours: RaffleColour[];
  offers: RaffleOffer[];
  reserved?: unknown[];
  sold?: unknown[];
  colourCount?: number;
  numbersPerColour?: number;
};

export function normalizeStatus(value: unknown): RaffleStatus {
  if (value === "published") return "published";
  if (value === "completed") return "completed";
  return "draft";
}

export function parseConfig(input: unknown): RaffleConfig {
  const raw =
    typeof input === "string"
      ? safeJsonParse(input)
      : input && typeof input === "object"
        ? input
        : {};

  const obj = (raw ?? {}) as Record<string, unknown>;

  const startNumber = asInt(obj.startNumber, 1);
  const endNumber = asInt(obj.endNumber, startNumber);

  const colours = Array.isArray(obj.colours)
    ? obj.colours
        .map((item, index) => {
          const colour = item as Record<string, unknown>;
          const id = asString(colour.id, `colour-${index + 1}`);

          return {
            id,
            name: asString(colour.name, id),
            hex: asString(colour.hex, "#000000"),
            sortOrder: asOptionalInt(colour.sortOrder),
          };
        })
        .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
    : [];

  const offers = Array.isArray(obj.offers)
    ? obj.offers
        .map((item, index) => {
          const offer = item as Record<string, unknown>;

          return {
            id: asString(offer.id, `offer-${index + 1}`),
            label: asString(offer.label, `Offer ${index + 1}`),
            quantity: asInt(offer.quantity, 1),
            price: asNumber(offer.price, 0),
            sortOrder: asOptionalInt(offer.sortOrder),
            isActive:
              typeof offer.isActive === "boolean" ? offer.isActive : true,
          };
        })
        .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
    : [];

  return {
    startNumber,
    endNumber,
    colours,
    offers,
    reserved: Array.isArray(obj.reserved) ? obj.reserved : [],
    sold: Array.isArray(obj.sold) ? obj.sold : [],
    colourCount: asOptionalInt(obj.colourCount),
    numbersPerColour: asOptionalInt(obj.numbersPerColour),
  };
}

function safeJsonParse(input: string): unknown {
  try {
    return JSON.parse(input);
  } catch {
    return {};
  }
}

function asString(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() ? value : fallback;
}

function asInt(value: unknown, fallback: number): number {
  const n = Number(value);
  return Number.isInteger(n) ? n : fallback;
}

function asOptionalInt(value: unknown): number | undefined {
  const n = Number(value);
  return Number.isInteger(n) ? n : undefined;
}

function asNumber(value: unknown, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}
