// src/lib/types.ts
export type RaffleColour = {
  id: string;
  name: string;
  hex?: string | null;
  sortOrder?: number;
};

export type TicketSelection = {
  colour: string;
  number: number;
};

export type SafeRaffle = {
  id: string;
  slug: string;
  title: string;
  description: string;
  startNumber: number;
  endNumber: number;
  currency: string;
  ticketPrice: number;
  colours: RaffleColour[];
  soldTickets: TicketSelection[];
  reservedTickets: TicketSelection[];
};
