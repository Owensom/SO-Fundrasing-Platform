export type RaffleColour = {
  id: string;
  name: string;
  hex?: string | null;
  sortOrder?: number;
};

export type RaffleOffer = {
  id: string;
  label: string;
  quantity: number;
  price: number;
  isActive: boolean;
  sortOrder?: number;
};

export type TicketSelection = {
  colour: string;
  number: number;
};

export type TicketRef = TicketSelection;

export type ReservedOrSoldTicket = {
  colour: string;
  number: number;
};

export type Purchase = {
  id: string;
  raffleId: string;
  buyerName: string;
  buyerEmail: string;
  tickets: TicketSelection[];
  quantity: number;
  subtotal: number;
  discount: number;
  total: number;
  currency: string;
  status?: string;
  createdAt?: string;
};

export type Raffle = {
  id: string;
  slug: string;
  title: string;
  description?: string | null;
  imageUrl?: string | null;
  image_url?: string | null;
  startNumber: number;
  endNumber: number;
  currency: string;
  ticketPrice: number;
  colours: RaffleColour[];
  offers: RaffleOffer[];
  isActive?: boolean;
  is_active?: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export type RaffleDetails = Raffle & {
  reservedTickets: ReservedOrSoldTicket[];
  soldTickets: ReservedOrSoldTicket[];
};

export type PublicRaffle = RaffleDetails;

export type SaveRaffleInput = {
  slug: string;
  title: string;
  description?: string | null;
  imageUrl?: string | null;
  startNumber: number;
  endNumber: number;
  currency: string;
  ticketPrice: number;
  isActive?: boolean;
  colours: Array<{
    id?: string;
    name: string;
    hex?: string | null;
    sortOrder?: number;
  }>;
  offers: Array<{
    id?: string;
    label: string;
    quantity: number;
    price: number;
    isActive?: boolean;
    sortOrder?: number;
  }>;
};

export type PublicRaffleResponse = {
  ok: true;
  raffle: PublicRaffle;
};

export type ReserveTicketsRequest = {
  buyerName: string;
  buyerEmail: string;
  tickets: TicketSelection[];
};

export type ReserveTicketsResponse = {
  ok: true;
  reservationGroupId: string;
  expiresAt: string;
  checkoutDraft: {
    raffleId: string;
    raffleSlug: string;
    raffleTitle: string;
    buyerName: string;
    buyerEmail: string;
    tickets: TicketSelection[];
    quantity: number;
    currency: string;
    subtotal: number;
    discount: number;
    total: number;
    pricingBreakdown: {
      singlesCount: number;
      singlesTotal: number;
      appliedOffers: Array<{
        offerId: string;
        label: string;
        quantity: number;
        price: number;
        count: number;
      }>;
    };
  };
};
