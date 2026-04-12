export type PublicRaffle = {
  id: string;
  tenantSlug: string;
  slug: string;
  title: string;
  description: string;
  imageUrl: string | null;
  ticketPrice: number;
  totalTickets: number;
  soldTickets: number;
  remainingTickets: number;
  isSoldOut: boolean;
  status: "draft" | "published" | "closed";
};

export type PaymentStatus = "pending" | "paid" | "failed" | "cancelled";

export type Purchase = {
  id: string;
  tenantSlug: string;
  raffleId: string;
  raffleSlug: string;
  customerName: string;
  customerEmail: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  paymentStatus: PaymentStatus;
  paidAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type PublicRaffleResponse = {
  raffle: PublicRaffle;
};

export type PurchaseResponse = {
  message: string;
  purchase: Purchase;
  raffle: PublicRaffle;
  payment: {
    provider: "mock";
    status: "pending";
    confirmUrl: string;
  };
};

export type ConfirmPurchaseResponse = {
  message: string;
  purchase: Purchase;
  raffle: PublicRaffle;
};

export type AdminRaffleListItem = PublicRaffle & {
  createdAt: string;
  updatedAt: string;
};

export type AdminRaffleListResponse = {
  raffles: AdminRaffleListItem[];
};

export type AdminRafflePurchasesResponse = {
  raffle: PublicRaffle & {
    createdAt: string;
    updatedAt: string;
  };
  purchases: Purchase[];
  summary: {
    soldTickets: number;
    remainingTickets: number;
    totalTickets: number;
    purchaseCount: number;
    paidPurchaseCount: number;
    pendingPurchaseCount: number;
  };
};
