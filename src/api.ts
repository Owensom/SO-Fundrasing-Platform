import type {
  Purchase,
  Raffle,
  RaffleDetails,
  SaveRaffleInput,
} from "./types/raffles";

type ApiEnvelope<T> = {
  ok?: boolean;
  item?: T;
  items?: T[];
  error?: string;
  admin?: { email: string };
};

function toNumber(value: unknown, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function normalizeAdminRaffle(raw: any): RaffleDetails {
  const config =
    raw && typeof raw.config_json === "object" && raw.config_json
      ? raw.config_json
      : raw && typeof raw.config === "object" && raw.config
        ? raw.config
        : {};

  const offersSource = Array.isArray(config.offers)
    ? config.offers
    : Array.isArray(raw.offers)
      ? raw.offers
      : [];

  const coloursSource = Array.isArray(config.colours)
    ? config.colours
    : Array.isArray(raw.colours)
      ? raw.colours
      : [];

  const soldSource = Array.isArray(config.sold)
    ? config.sold
    : Array.isArray(raw.sold)
      ? raw.sold
      : [];

  const reservedSource = Array.isArray(config.reserved)
    ? config.reserved
    : Array.isArray(raw.reserved)
      ? raw.reserved
      : [];

  return {
    ...raw,
    imageUrl: raw.imageUrl ?? raw.image_url ?? "",
    image_url: raw.image_url ?? raw.imageUrl ?? "",
    ticketPrice: toNumber(raw.ticketPrice ?? raw.ticket_price, 0),
    ticket_price: toNumber(raw.ticket_price ?? raw.ticketPrice, 0),
    totalTickets: toNumber(raw.totalTickets ?? raw.total_tickets, 0),
    total_tickets: toNumber(raw.total_tickets ?? raw.totalTickets, 0),
    soldTickets: toNumber(raw.soldTickets ?? raw.sold_tickets, 0),
    sold_tickets: toNumber(raw.sold_tickets ?? raw.soldTickets, 0),
    remainingTickets: toNumber(raw.remainingTickets ?? raw.remaining_tickets, 0),
    remaining_tickets: toNumber(raw.remaining_tickets ?? raw.remainingTickets, 0),
    currency: raw.currency ?? "GBP",
    startNumber: toNumber(config.startNumber ?? raw.startNumber, 0),
    endNumber: toNumber(config.endNumber ?? raw.endNumber, 0),
    numbersPerColour: toNumber(
      config.numbersPerColour ?? raw.numbersPerColour,
      0,
    ),
    colourCount: toNumber(config.colourCount ?? raw.colourCount, 0),
    colours: coloursSource,
    sold: soldSource,
    reserved: reservedSource,
    offers: offersSource.map((offer: any, index: number) => ({
      id:
        typeof offer?.id === "string" && offer.id.trim()
          ? offer.id
          : `offer-${index}`,
      label: typeof offer?.label === "string" ? offer.label : "",
      price: toNumber(offer?.price, 0),
      quantity: toNumber(offer?.quantity ?? offer?.tickets, 0),
      tickets: toNumber(offer?.tickets ?? offer?.quantity, 0),
      is_active:
        typeof offer?.is_active === "boolean" ? offer.is_active : true,
      sort_order: toNumber(offer?.sort_order, index),
    })),
    config_json: config,
  };
}

export async function apiFetch<T = unknown>(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(input, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    ...init,
  });

  const raw = await response.text();
  const contentType = response.headers.get("content-type") || "";

  let data: ApiEnvelope<T> | T | null = null;

  if (contentType.includes("application/json")) {
    try {
      data = JSON.parse(raw) as ApiEnvelope<T> | T;
    } catch {
      data = null;
    }
  }

  if (!response.ok) {
    const errorMessage =
      data &&
      typeof data === "object" &&
      "error" in data &&
      typeof (data as { error?: unknown }).error === "string"
        ? (data as { error: string }).error
        : raw || "Request failed";

    throw new Error(errorMessage);
  }

  if (!contentType.includes("application/json")) {
    throw new Error(
      raw || "API did not return JSON. It may be returning HTML instead.",
    );
  }

  return data as T;
}

async function request<T>(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<T> {
  return apiFetch<T>(input, init);
}

export async function login(email: string, password: string): Promise<{
  ok: boolean;
  admin: { email: string };
}> {
  return request(`/api/auth?action=login`, {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export async function logout(): Promise<{ ok: boolean }> {
  return request(`/api/auth?action=logout`, {
    method: "POST",
  });
}

export async function getMe(): Promise<{
  ok: boolean;
  admin: { email: string };
}> {
  return request(`/api/auth?action=me`);
}

export async function listAdminRaffles(): Promise<Raffle[]> {
  const result = await request<{ raffles: Raffle[] }>(
    `/api/admin/raffles?tenantSlug=demo-a`,
  );
  return result.raffles ?? [];
}

export async function getAdminRaffle(id: string): Promise<RaffleDetails> {
  const safeId = String(id || "").trim();

  if (!safeId) {
    throw new Error("Raffle not found");
  }

  const result = await request<{ raffle: any }>(
    `/api/admin/raffle-details?id=${encodeURIComponent(safeId)}&tenantSlug=demo-a`,
  );

  if (!result.raffle) {
    throw new Error("Raffle not found");
  }

  return normalizeAdminRaffle(result.raffle);
}

export async function createRaffle(
  input: SaveRaffleInput,
): Promise<RaffleDetails> {
  const result = await request<{ raffle: any }>(`/api/admin/raffles`, {
    method: "POST",
    body: JSON.stringify(input),
  });

  if (!result.raffle) {
    throw new Error("Failed to create raffle");
  }

  return normalizeAdminRaffle(result.raffle);
}

export async function updateRaffle(
  id: string,
  input: SaveRaffleInput,
): Promise<RaffleDetails> {
  const result = await request<{ raffle: any }>(`/api/admin/raffles`, {
    method: "PUT",
    body: JSON.stringify({ id, ...input }),
  });

  if (!result.raffle) {
    throw new Error("Failed to update raffle");
  }

  return normalizeAdminRaffle(result.raffle);
}

export async function getRafflePurchases(
  raffleId: string,
): Promise<Purchase[]> {
  const result = await request<{
    items?: Purchase[];
    purchases?: Purchase[];
  }>(
    `/api/admin?resource=purchases&raffleId=${encodeURIComponent(raffleId)}`,
  );

  return result.purchases ?? result.items ?? [];
}

export async function getPublicRaffleBySlug(
  slug: string,
  tenantSlug = "demo-a",
): Promise<RaffleDetails> {
  const result = await request<ApiEnvelope<any>>(
    `/api/public?slug=${encodeURIComponent(slug)}&tenantSlug=${encodeURIComponent(
      tenantSlug,
    )}`,
  );

  if (!result.item) {
    throw new Error("Raffle not found");
  }

  return normalizeAdminRaffle(result.item);
}
