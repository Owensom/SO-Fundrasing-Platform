import bcrypt from "bcryptjs";
import { randomUUID } from "crypto";

export type Role = "owner" | "admin" | "staff";
export type TicketMode = "rows" | "tables";
export type RaffleColor = "Red" | "Blue" | "Green" | "Yellow" | "Purple" | "Orange";

export type Tenant = {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
  createdAt: string;
};

export type User = {
  id: string;
  tenantId: string;
  email: string;
  passwordHash: string;
  role: Role;
  isActive: boolean;
  createdAt: string;
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
  createdAt: string;
  updatedAt: string;
};

export type Purchase = {
  id: string;
  tenantId: string;
  module: "squares" | "raffle" | "tickets";
  itemId?: string;
  itemTitle: string;
  buyerName: string;
  buyerEmail: string;
  quantity: number;
  subtotal?: number;
  total: number;
  details: unknown;
  createdAt: string;
};

export const ALL_COLORS: RaffleColor[] = ["Red", "Blue", "Green", "Yellow", "Purple", "Orange"];

export function nowIso() {
  return new Date().toISOString();
}

export function buildInitialSold(): Record<RaffleColor, number[]> {
  return ALL_COLORS.reduce((acc, color) => {
    acc[color] = [];
    return acc;
  }, {} as Record<RaffleColor, number[]>);
}

export function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

const tenantAId = randomUUID();
const tenantBId = randomUUID();

const DEMO_PASSWORD_HASH = bcrypt.hashSync("Password123!", 10);

export const tenants: Tenant[] = [
  {
    id: tenantAId,
    name: "SO Fundraising Demo A",
    slug: "demo-a",
    isActive: true,
    createdAt: nowIso(),
  },
  {
    id: tenantBId,
    name: "SO Fundraising Demo B",
    slug: "demo-b",
    isActive: true,
    createdAt: nowIso(),
  },
];

export const users: User[] = [
  {
    id: randomUUID(),
    tenantId: tenantAId,
    email: "ownera@example.com",
    passwordHash: DEMO_PASSWORD_HASH,
    role: "owner",
    isActive: true,
    createdAt: nowIso(),
  },
  {
    id: randomUUID(),
    tenantId: tenantBId,
    email: "ownerb@example.com",
    passwordHash: DEMO_PASSWORD_HASH,
    role: "owner",
    isActive: true,
    createdAt: nowIso(),
  },
];

export let raffleEvents: RaffleEvent[] = [
  {
    id: randomUUID(),
    tenantId: tenantAId,
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
    createdAt: nowIso(),
    updatedAt: nowIso(),
  },
];

export let purchases: Purchase[] = [];
