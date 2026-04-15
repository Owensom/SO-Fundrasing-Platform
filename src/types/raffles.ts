export type RaffleOffer = {
  id?: string;
  label?: string | null;
  tickets: number;
  price: number | string;
  sort_order?: number;
  active?: boolean;
};

export type Raffle = {
  id: string;
  title: string;
  slug: string;
  description?: string | null;
  image_url?: string | null;
  primary_color?: string | null;
  secondary_color?: string | null;
  min_number?: number | null;
  max_number?: number | null;
  ticket_price: number | string;
  offers?: RaffleOffer[];
};

export type SaveRafflePayload = {
  title: string;
  slug: string;
  description?: string;
  image_url?: string;
  primary_color?: string;
  secondary_color?: string;
  min_number?: number;
  max_number?: number;
  ticket_price: number;
  offers: {
    label?: string | null;
    tickets: number;
    price: number;
    sort_order: number;
    active: boolean;
  }[];
};
