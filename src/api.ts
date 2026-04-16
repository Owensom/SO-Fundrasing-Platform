import type {
  Purchase,
  Raffle,
  RaffleDetails,
  SaveRaffleInput,
} from "./types/raffles";

type ApiEnvelope<T> = {
  ok: boolean;
  item?: T;
  items?: T[];
  error?: string;
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
      raw || "API did not return JSON. It may be returning an HTML page instead."
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
  const result = await request<ApiEnvelope<Raffle>>(
    `/api/admin?resource=raffles`,
  );
  return result.items ?? [];
}

export async function getAdminRaffle(id: string): Promise<RaffleDetails> {
  const result = await request<ApiEnvelope<RaffleDetails>>(
    `/api/admin?resource=raffle&id=${encodeURIComponent(id)}`,
  );

  if (!result.item) {
    throw new Error("Raffle not found");
  }

  return result.item;
}

export async function createRaffle(
  input: SaveRaffleInput,
): Promise<RaffleDetails> {
  const result = await request<ApiEnvelope<RaffleDetails>>(
    `/api/admin?resource=raffles`,
    {
      method: "POST",
      body: JSON.stringify(input),
    },
  );

  if (!result.item) {
    throw new Error("Failed to create raffle");
  }

  return result.item;
}

export async function updateRaffle(
  id: string,
  input: SaveRaffleInput,
): Promise<RaffleDetails> {
  const result = await request<ApiEnvelope<RaffleDetails>>(
    `/api/admin?resource=raffle&id=${encodeURIComponent(id)}`,
    {
      method: "PUT",
      body: JSON.stringify(input),
    },
  );

  if (!result.item) {
    throw new Error("Failed to update raffle");
  }

  return result.item;
}

export async function getRafflePurchases(
  raffleId: string,
): Promise<Purchase[]> {
  const result = await request<ApiEnvelope<Purchase>>(
    `/api/admin?resource=purchases&raffleId=${encodeURIComponent(raffleId)}`,
  );
  return result.items ?? [];
}

export async function getPublicRaffleBySlug(
  slug: string,
): Promise<RaffleDetails> {
  const result = await request<ApiEnvelope<RaffleDetails>>(
    `/api/public?slug=${encodeURIComponent(slug)}`,
  );

  if (!result.item) {
    throw new Error("Raffle not found");
  }

  return result.item;
}
