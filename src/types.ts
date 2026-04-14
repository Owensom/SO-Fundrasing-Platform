export type AdminTab =
  | "overview"
  | "orders"
  | "raffles"
  | "campaigns"
  | "settings";

export type OrderStatus =
  | "pending"
  | "paid"
  | "failed"
  | "cancelled"
  | "refunded";

export type CurrencyCode = "GBP" | "USD" | "EUR";

export type Order = {
  id: string;
  fullName?: string;
  email?: string;
  amountTotalCents: number;
  currency?: CurrencyCode | string;
  status?: OrderStatus | string;
  createdAt?: string;
  updatedAt?: string;
};

export type Tenant = {
  id: string;
  slug: string;
  name?: string;
};

export type Campaign = {
  id: string;
  tenantId?: string;
  type?: string;
  slug?: string;
  title?: string;
  description?: string;
  status?: string;
  createdAt?: string;
  updatedAt?: string;
};

export type RaffleColour = {
  id?: string;
  name: string;
  hex: string;
  sortOrder?: number;
  isActive?: boolean;
};

export type RaffleOffer = {
  id?: string;
  name: string;
  priceCents: number;
  entryCount: number;
  sortOrder?: number;
  isActive?: boolean;
};

export type Raffle = {
  id: string;
  tenantSlug?: string;
  title: string;
  slug: string;
  description?: string;
  status?: string;
  colours?: RaffleColour[];
  offers?: RaffleOffer[];
};

export type AdminState = {
  activeTab?: AdminTab;
  orders?: Order[];
  campaigns?: Campaign[];
  raffles?: Raffle[];
};
