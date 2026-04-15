import type { Raffle, SaveRafflePayload } from "./types/raffles";

export async function apiFetch<T = any>(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<T> {
  const res = await fetch(input, {
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
    ...init,
  });

  const contentType = res.headers.get("content-type") || "";
  const isJson = contentType.includes("application/json");
  const data = isJson ? await res.json() : await res.text();

  if (!res.ok) {
    const message =
      typeof data === "object" &&
      data !== null &&
      "error" in data &&
      typeof (data as { error?: unknown }).error === "string"
        ? (data as { error: string }).error
        : typeof data === "string"
        ? data
        : "Request failed";

    throw new Error(message);
  }

  return data as T;
}

export async function createRaffle(
  payload: SaveRafflePayload
): Promise<{ raffle: Raffle }> {
  return apiFetch<{ raffle: Raffle }>("/api/admin/raffles", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateRaffle(
  raffleId: string,
  payload: SaveRafflePayload
): Promise<{ raffle: Raffle }> {
  return apiFetch<{ raffle: Raffle }>(`/api/admin/raffles/${raffleId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function getAdminRaffleDetails(
  slug: string
): Promise<{ raffle: Raffle }> {
  return apiFetch<{ raffle: Raffle }>(
    `/api/admin/raffle-details?slug=${encodeURIComponent(slug)}`,
    { method: "GET" }
  );
}

export async function getPublicRaffleBySlug(
  slug: string
): Promise<{ raffle: Raffle }> {
  return apiFetch<{ raffle: Raffle }>(`/api/public/raffles/${slug}`, {
    method: "GET",
  });
}
