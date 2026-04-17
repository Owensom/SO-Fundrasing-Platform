export type TicketRef = {
  colour: string;
  number: number;
};

export type RaffleOffer = {
  id?: string;
  label: string;
  price: number;
  quantity: number;
};

export type Purchase = {
  id?: string | number;
  raffleId?: string | number;
  raffleTitle?: string;
  buyerName: string;
  buyerEmail: string;
  selectedTickets: TicketRef[];
  total: number;
  createdAt?: string;
};

export type Raffle = {
  id?: string | number;
  title: string;
  slug: string;
  description?: string;
  imageUrl?: string;

  startNumber: number;
  endNumber: number;

  numbersPerColour: number;
  colourCount: number;
  totalTickets: number;

  ticketPrice: number;
  offers: RaffleOffer[];
  colours: string[];

  sold: TicketRef[];
  reserved: TicketRef[];
};

export type RaffleDetails = Raffle & {
  purchases?: Purchase[];
};

export type SaveRaffleInput = {
  id?: string | number;
  title: string;
  slug: string;
  description?: string;
  imageUrl?: string;

  startNumber: number;
  endNumber: number;

  numbersPerColour: number;
  colourCount: number;
  totalTickets: number;

  ticketPrice: number;
  offers: RaffleOffer[];
  colours: string[];

  sold?: TicketRef[];
  reserved?: TicketRef[];
};

export type CreatePurchaseInput = {
  raffleId?: string | number;
  buyerName: string;
  buyerEmail: string;
  selectedTickets: TicketRef[];
  total: number;
};
