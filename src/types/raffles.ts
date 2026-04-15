export type RaffleOffer = {
  id?: string;
  label?: string | null;
  ticket_quantity: number;
  price_cents: number;
  sort_order?: number;
  is_active?: boolean;
};

export type Raffle = {
  id: string;
  tenant_slug: string;
  slug: string;
  title: string;
  description: string;
  image_url?: string | null;
  ticket_price_cents: number;
  total_tickets: number;
  sold_tickets: number;
  status: string;
  created_at?: string;
  updated_at?: string;
  offers?: RaffleOffer[];
};

export type SaveRafflePayload = {
  tenant_slug: string;
  title: string;
  slug: string;
  description: string;
  image_url?: string | null;
  ticket_price_cents: number;
  total_tickets: number;
  status: string;
  offers: {
    label?: string | null;
    ticket_quantity: number;
    price_cents: number;
    sort_order: number;
    is_active: boolean;
  }[];
};
