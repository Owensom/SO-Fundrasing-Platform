export type RaffleColor = "Red" | "Blue" | "Green" | "Yellow" | "Purple" | "Orange";

export type Tenant = {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
};

export type RaffleEvent = {
  id: string;
  tenantId: string;
  title: string;
  eventName: string;
  venue: string;
  price: number;
  startNumber: number;
  totalTickets: number;
  colors: RaffleColor[];
  soldByColor: Record<RaffleColor, number[]>;
  background?: string;
};

export const tenants: Tenant[] = [
  {
    id: "tenant-demo-a",
    name: "SO Fundraising Demo A",
    slug: "demo-a",
    isActive: true,
  },
  {
    id: "tenant-demo-b",
    name: "SO Fundraising Demo B",
    slug: "demo-b",
    isActive: true,
  },
];

export const raffleEvents: RaffleEvent[] = [
  {
    id: "raffle-1",
    tenantId: "tenant-demo-a",
    title: "Main Raffle",
    eventName: "Main Raffle",
    venue: "Club Hall",
    price: 2,
    startNumber: 1,
    totalTickets: 100,
    colors: ["Red", "Blue", "Green", "Yellow"],
    soldByColor: {
      Red: [1, 2, 8],
      Blue: [3, 10],
      Green: [5],
      Yellow: [],
      Purple: [],
      Orange: [],
    },
    background: "",
  },
  {
    id: "raffle-2",
    tenantId: "tenant-demo-b",
    title: "School Fair Raffle",
    eventName: "School Fair Raffle",
    venue: "Gym Hall",
    price: 1,
    startNumber: 100,
    totalTickets: 50,
    colors: ["Red", "Blue"],
    soldByColor: {
      Red: [],
      Blue: [],
      Green: [],
      Yellow: [],
      Purple: [],
      Orange: [],
    },
    background: "",
  },
];
