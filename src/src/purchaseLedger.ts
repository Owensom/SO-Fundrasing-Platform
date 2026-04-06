export type PurchaseModule = "squares" | "tickets" | "raffle";

export type LedgerEntry = {
  id: string;
  module: PurchaseModule;
  itemTitle: string;
  buyerName: string;
  buyerEmail: string;
  description: string;
  quantity: number;
  total: number;
  createdAt: string;
};

const KEY = "fundraising_purchase_ledger";

// Read all purchases
export function readLedger(): LedgerEntry[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

// Add a new purchase
export function appendLedger(entry: LedgerEntry) {
  if (typeof window === "undefined") return;

  const current = readLedger();
  localStorage.setItem(KEY, JSON.stringify([entry, ...current]));
}

// Clear everything (used in dashboard)
export function clearLedger() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(KEY);
}
