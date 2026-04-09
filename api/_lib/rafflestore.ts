export type RaffleStatus = "draft" | "published" | "closed";

export type Raffle = {
  id: string;
  tenantId: string;
  title: string;
  slug: string;
  description: string;
  ticketPrice: number;
  maxTickets: number;
  isPublished: boolean;
  status: RaffleStatus;
  endAt: string | null;
  createdAt: string;
  updatedAt: string;
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
    const now = new Date().toISOString();

    globalThis.__raffleStore = {
      raffles: [
        {
          id: "seed_demo_raffle",
          tenantId: "demo-a",
          title: "Demo Raffle",
          slug: "demo-raffle",
          description: "Demo raffle so your public page has data.",
          ticketPrice: 5,
          maxTickets: 100,
          isPublished: true,
          status: "published",
          endAt: null,
          createdAt: now,
          updatedAt: now,
        },
      ],
    };
  }

  return globalThis.__raffleStore;
}

export function normalizeSlug(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

export function createRaffleId(): string {
  return `raffle_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}
