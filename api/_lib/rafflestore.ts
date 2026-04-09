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

export type Purchase = {
  id: string;
  raffleId: string;
  raffleSlug: string;
  tenantId: string;
  buyerName: string;
  buyerEmail: string;
  quantity: number;
  totalAmount: number;
  createdAt: string;
};

type Store = {
  raffles: Raffle[];
  purchases: Purchase[];
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
      purchases: [],
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

export function createPurchaseId(): string {
  return `purchase_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function getSoldTicketCount(raffleId: string): number {
  const store = getRaffleStore();
  return store.purchases
    .filter((purchase) => purchase.raffleId === raffleId)
    .reduce((sum, purchase) => sum + purchase.quantity, 0);
}
