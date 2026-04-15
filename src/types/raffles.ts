export type RaffleOffer = {
  id: string;
  label: string;
  price: number;
  tickets: number;
  is_active: boolean;
  sort_order: number;
};

export type Raffle = {
  id: string;
  title: string;
  slug: string;
  description: string;
  image_url: string;
  draw_at: string | null;
  ticket_price: number | null;
  max_tickets: number | null;
  is_active: boolean;
  available_colours: string[];
  created_at: string;
};

export type RaffleDetails = Raffle & {
  offers: RaffleOffer[];
};

export type Purchase = {
  id: string;
  raffle_id: string;
  buyer_name: string;
  buyer_email: string;
  quantity: number;
  total_price: number;
  selected_colour: string | null;
  selected_numbers: number[];
  created_at: string;
};

export type SaveRaffleInput = {
  title: string;
  slug: string;
  description?: string;
  image_url?: string;
  draw_at?: string | null;
  ticket_price?: number | null;
  max_tickets?: number | null;
  is_active?: boolean;
  available_colours?: string[];
  offers?: Array<{
    label: string;
    price: number;
    tickets: number;
    is_active?: boolean;
    sort_order?: number;
  }>;
};
