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

export type ReservedOrSoldTicket = {
  colour: string;
  number: number;
};

export type PublicRaffle = {
  id: string;
  slug: string;
  title: string;
  startNumber: number;
  endNumber: number;
  currency: string;
  ticketPrice: number;
  colours: RaffleColour[];
  offers: RaffleOffer[];
  reservedTickets: ReservedOrSoldTicket[];
  soldTickets: ReservedOrSoldTicket[];
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
