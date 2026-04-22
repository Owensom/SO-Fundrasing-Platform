export type CurrencyCode = "GBP" | "USD" | "EUR";

export type RaffleStatus = "draft" | "published" | "closed" | "drawn";

export type TicketSelection = {
  colour: string;
  number: number;
};

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

export type AppliedOfferBreakdown = {
  offerId: string;
  label: string;
  quantity: number;
  price: number;
  count: number;
};

export type BestPriceResult = {
  quantity: number;
  subtotal: number;
  total: number;
  discount: number;
  singlesCount: number;
  singlesTotal: number;
  appliedOffers: AppliedOfferBreakdown[];
};

export type Raffle = {
  id: string;
  tenant_slug: string;
  slug: string;
  title: string;
  description: string;
  image_url: string;
  currency: CurrencyCode;
  ticket_price: number;
  total_tickets: number;
  sold_tickets: number;
  remaining_tickets: number;
  status: RaffleStatus;
  config_json: {
    startNumber?: number;
    endNumber?: number;
    colours?: Array<string | { id?: string; name?: string; hex?: string | null; sortOrder?: number }>;
    offers?: Array<{
      id?: string;
      label?: string;
      price?: number;
      quantity?: number;
      tickets?: number;
      is_active?: boolean;
      sort_order?: number;
    }>;
    sold?: Array<{ colour: string; number: number }>;
    reserved?: Array<{ colour: string; number: number }>;
    [key: string]: unknown;
  };
  winner_ticket_number?: number | null;
  winner_colour?: string | null;
  winner_sale_id?: string | null;
  drawn_at?: string | null;
  drawn_by?: string | null;
  created_at: string;
  updated_at: string;
};

export type RaffleDetails = Raffle & {
  offers: Array<{
    id?: string;
    label: string;
    price: number;
    quantity: number;
    is_active: boolean;
    sort_order: number;
  }>;
};

export type SaveRaffleInput = {
  tenant_slug: string;
  title: string;
  slug: string;
  description?: string;
  image_url?: string;
  currency?: CurrencyCode;
  ticket_price?: number | null;
  total_tickets?: number | null;
  sold_tickets?: number | null;
  status?: RaffleStatus;
  startNumber?: number | null;
  endNumber?: number | null;
  numbersPerColour?: number | null;
  colourCount?: number | null;
  colours?: string[];
  offers?: Array<{
    id?: string;
    label: string;
    price: number;
    quantity?: number;
    tickets?: number;
    is_active?: boolean;
    sort_order?: number;
  }>;
  sold?: Array<{ colour: string; number: number }>;
  reserved?: Array<{ colour: string; number: number }>;
};

export type Purchase = {
  id: string;
  raffle_id: string;
  buyer_name: string;
  buyer_email: string;
  quantity: number;
  total_price: number;
  created_at: string;
};
