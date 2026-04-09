export type Raffle = {
  id: string;
  tenantId: string;
  title: string;
  slug: string;
  description: string;
  ticketPrice: number;
  maxTickets: number;
  isPublished: boolean;
  createdAt: string;
};

type Store = {
  raffles: Raffle[];
};

declare global {
  // eslint-disable-next-line no-var
  var __raffleStore: Store | undefined;
}

export function getRaffleStore(): Store {
  if (!globalThis.__raffleStore) {
    globalThis.__raffleStore = {
      raffles: [],
    };
  }

  return globalThis.__raffleStore;
}

export function normalizeSlug(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

export function createRaffleId() {
  return `raffle_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}
