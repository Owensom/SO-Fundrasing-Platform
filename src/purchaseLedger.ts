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

export function readLedger(): LedgerEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function appendLedger(entry: LedgerEntry) {
  if (typeof window === "undefined") return;
  const current = readLedger();
  window.localStorage.setItem(KEY, JSON.stringify([entry, ...current]));
}

export function clearLedger() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(KEY);
}
