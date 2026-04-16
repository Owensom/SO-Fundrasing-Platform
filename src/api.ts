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
      raw || "API did not return JSON. It may be returning HTML instead."
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
  const result = await request<{ raffle: RaffleDetails }>(
    `/api/admin/raffle-details?id=${encodeURIComponent(id)}&tenantSlug=demo-a`,
  );

  if (!result.raffle) {
    throw new Error("Raffle not found");
  }

  return result.raffle;
}

export async function createRaffle(
  input: SaveRaffleInput,
): Promise<RaffleDetails> {
  const result = await request<{ raffle: RaffleDetails }>(`/api/admin/raffles`, {
    method: "POST",
    body: JSON.stringify(input),
  });

  if (!result.raffle) {
    throw new Error("Failed to create raffle");
  }

  return result.raffle;
}

export async function updateRaffle(
  id: string,
  input: SaveRaffleInput,
): Promise<RaffleDetails> {
  const result = await request<{ raffle: RaffleDetails }>(`/api/admin/raffles`, {
    method: "PUT",
    body: JSON.stringify({ id, ...input }),
  });

  if (!result.raffle) {
    throw new Error("Failed to update raffle");
  }

  return result.raffle;
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
  const result = await request<ApiEnvelope<RaffleDetails>>(
    `/api/public?slug=${encodeURIComponent(slug)}&tenantSlug=${encodeURIComponent(
      tenantSlug,
    )}`,
  );

  if (!result.item) {
    throw new Error("Raffle not found");
  }

  return result.item;
}
