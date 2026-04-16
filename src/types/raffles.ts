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
