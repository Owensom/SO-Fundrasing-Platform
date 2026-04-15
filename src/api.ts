import type { Raffle, SaveRafflePayload } from "./types/raffles";

async function handleJson<T>(res: Response): Promise<T> {
  const data = await res.json();

  if (!res.ok) {
    throw new Error(data?.error || "Request failed");
  }

  return data;
}

export async function createRaffle(
  payload: SaveRafflePayload
): Promise<{ raffle: Raffle }> {
  const res = await fetch("/api/admin/raffles", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  return handleJson<{ raffle: Raffle }>(res);
}

export async function updateRaffle(
  raffleId: string,
  payload: SaveRafflePayload
): Promise<{ raffle: Raffle }> {
  const res = await fetch(`/api/admin/raffles/${raffleId}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  return handleJson<{ raffle: Raffle }>(res);
}

export async function getPublicRaffleBySlug(
  slug: string
): Promise<{ raffle: Raffle }> {
  const res = await fetch(`/api/public/raffles/${slug}`);

  return handleJson<{ raffle: Raffle }>(res);
}
