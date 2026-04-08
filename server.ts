import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import { randomUUID } from "crypto";

dotenv.config();

const app = express();

app.use(express.json({ limit: "10mb" }));
app.use(cookieParser());

app.use(
  cors({
    origin: "http://localhost:5173",
    credentials: true,
  })
);

const PORT = Number(process.env.PORT || 4000);
const JWT_SECRET = process.env.JWT_SECRET || "change-this-secret";

type Role = "owner" | "admin" | "staff";
type TicketMode = "rows" | "tables";
type RaffleColor = "Red" | "Blue" | "Green" | "Yellow" | "Purple" | "Orange";

type Tenant = {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
  createdAt: string;
};

type User = {
  id: string;
  tenantId: string;
  email: string;
  passwordHash: string;
  role: Role;
  isActive: boolean;
  createdAt: string;
};

type SquareGame = {
  id: string;
  tenantId: string;
  title: string;
  total: number;
  price: number;
  background?: string;
  sold: number[];
  reserved: number[];
  createdAt: string;
  updatedAt: string;
};

type RaffleEvent = {
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

type TicketTable = {
  id: string;
  name: string;
  seats: number;
  sold: number;
};

type TicketEvent = {
  id: string;
  tenantId: string;
  title: string;
  eventName: string;
  venue: string;
  price: number;
  mode: TicketMode;
  rows: number;
  seatsPerRow: number;
  soldSeatIds: string[];
  tables: TicketTable[];
  background?: string;
  createdAt: string;
  updatedAt: string;
};

type Purchase = {
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

type AuthPayload = {
  userId: string;
  tenantId: string;
  role: Role;
  email: string;
};

const ALL_COLORS: RaffleColor[] = ["Red", "Blue", "Green", "Yellow", "Purple", "Orange"];

function nowIso() {
  return new Date().toISOString();
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

function uniqueTenantSlug(name: string) {
  const base = slugify(name) || "tenant";
  let slug = base;
  let counter = 2;

  while (tenants.some((t) => t.slug === slug)) {
    slug = `${base}-${counter}`;
    counter += 1;
  }

  return slug;
}

function buildInitialSold(): Record<RaffleColor, number[]> {
  return ALL_COLORS.reduce((acc, color) => {
    acc[color] = [];
    return acc;
  }, {} as Record<RaffleColor, number[]>);
}

function signAuthToken(payload: AuthPayload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "7d" });
}

function requireAuth(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) {
  const token = req.cookies.auth_token;

  if (!token) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as AuthPayload;
    (req as any).auth = decoded;
    next();
  } catch {
    return res.status(401).json({ error: "Invalid session" });
  }
}

function requireAdminOrOwner(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) {
  const auth = (req as any).auth as AuthPayload | undefined;

  if (!auth) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  if (auth.role !== "owner" && auth.role !== "admin") {
    return res.status(403).json({ error: "Forbidden" });
  }

  next();
}

// --------------------
// In-memory seed data
// --------------------

const tenantAId = randomUUID();
const tenantBId = randomUUID();

const tenants: Tenant[] = [
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

const DEMO_PASSWORD_HASH = bcrypt.hashSync("Password123!", 10);

const users: User[] = [
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
    tenantId: tenantAId,
    email: "admina@example.com",
    passwordHash: DEMO_PASSWORD_HASH,
    role: "admin",
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

let squareGames: SquareGame[] = [
  {
    id: randomUUID(),
    tenantId: tenantAId,
    title: "Super Bowl Squares",
    total: 100,
    price: 10,
    sold: [3, 8, 14],
    reserved: [5, 11],
    background: "",
    createdAt: nowIso(),
    updatedAt: nowIso(),
  },
  {
    id: randomUUID(),
    tenantId: tenantBId,
    title: "Private Club Squares",
    total: 64,
    price: 20,
    sold: [1, 2],
    reserved: [],
    background: "",
    createdAt: nowIso(),
    updatedAt: nowIso(),
  },
];

let raffleEvents: RaffleEvent[] = [
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
  {
    id: randomUUID(),
    tenantId: tenantBId,
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
    createdAt: nowIso(),
    updatedAt: nowIso(),
  },
];

let ticketEvents: TicketEvent[] = [
  {
    id: randomUUID(),
    tenantId: tenantAId,
    title: "Summer Gala",
    eventName: "Summer Gala",
    venue: "Town Hall",
    price: 35,
    mode: "rows",
    rows: 5,
    seatsPerRow: 10,
    soldSeatIds: ["A1", "A2", "B5"],
    tables: [],
    background: "",
    createdAt: nowIso(),
    updatedAt: nowIso(),
  },
  {
    id: randomUUID(),
    tenantId: tenantBId,
    title: "Charity Dinner",
    eventName: "Charity Dinner",
    venue: "Grand Hotel",
    price: 45,
    mode: "tables",
    rows: 0,
    seatsPerRow: 0,
    soldSeatIds: [],
    tables: [
      { id: randomUUID(), name: "Table A", seats: 8, sold: 3 },
      { id: randomUUID(), name: "Table B", seats: 10, sold: 5 },
    ],
    background: "",
    createdAt: nowIso(),
    updatedAt: nowIso(),
  },
];

let purchases: Purchase[] = [];

// --------------------
// Auth routes
// --------------------

app.post("/api/auth/register", async (req, res) => {
  const { email, password, tenantName } = req.body ?? {};

  if (!email || !password || !tenantName) {
    return res.status(400).json({ error: "Email, password and tenant name are required" });
  }

  const normalizedEmail = String(email).toLowerCase().trim();

  const exists = users.some((u) => u.email === normalizedEmail);
  if (exists) {
    return res.status(409).json({ error: "Email already exists" });
  }

  if (String(password).length < 8) {
    return res.status(400).json({ error: "Password must be at least 8 characters" });
  }

  const tenantId = randomUUID();
  const tenantSlug = uniqueTenantSlug(String(tenantName));

  const tenant: Tenant = {
    id: tenantId,
    name: String(tenantName).trim(),
    slug: tenantSlug,
    isActive: true,
    createdAt: nowIso(),
  };

  const passwordHash = await bcrypt.hash(String(password), 12);

  const user: User = {
    id: randomUUID(),
    tenantId,
    email: normalizedEmail,
    passwordHash,
    role: "owner",
    isActive: true,
    createdAt: nowIso(),
  };

  tenants.push(tenant);
  users.push(user);

  const token = signAuthToken({
    userId: user.id,
    tenantId: user.tenantId,
    role: user.role,
    email: user.email,
  });

  res.cookie("auth_token", token, {
    httpOnly: true,
    secure: false,
    sameSite: "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });

  return res.json({
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
      tenantId: user.tenantId,
    },
    tenant: {
      id: tenant.id,
      name: tenant.name,
      slug: tenant.slug,
    },
  });
});

app.post("/api/auth/login", async (req, res) => {
  const { email, password } = req.body ?? {};

  if (!email || !password) {
    return res.status(400).json({ error: "Email and password required" });
  }

  const user = users.find((u) => u.email.toLowerCase() === String(email).toLowerCase());

  if (!user || !user.isActive) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  const tenant = tenants.find((t) => t.id === user.tenantId);

  if (!tenant || !tenant.isActive) {
    return res.status(403).json({ error: "Tenant account is inactive" });
  }

  const ok = await bcrypt.compare(password, user.passwordHash);

  if (!ok) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  const token = signAuthToken({
    userId: user.id,
    tenantId: user.tenantId,
    role: user.role,
    email: user.email,
  });

  res.cookie("auth_token", token, {
    httpOnly: true,
    secure: false,
    sameSite: "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });

  return res.json({
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
      tenantId: user.tenantId,
    },
    tenant: {
      id: tenant.id,
      name: tenant.name,
      slug: tenant.slug,
    },
  });
});

app.get("/api/auth/me", requireAuth, (req, res) => {
  const auth = (req as any).auth as AuthPayload;
  const user = users.find((u) => u.id === auth.userId);
  const tenant = tenants.find((t) => t.id === auth.tenantId);

  if (!user || !tenant) {
    return res.status(404).json({ error: "User or tenant not found" });
  }

  res.json({
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
      tenantId: user.tenantId,
    },
    tenant: {
      id: tenant.id,
      name: tenant.name,
      slug: tenant.slug,
    },
  });
});

app.post("/api/auth/logout", (_req, res) => {
  res.clearCookie("auth_token");
  res.json({ ok: true });
});

// --------------------
// Tenant user management
// --------------------

app.post("/api/users", requireAuth, requireAdminOrOwner, async (req, res) => {
  const auth = (req as any).auth as AuthPayload;
  const { email, password, role } = req.body ?? {};

  if (!email || !password || !role) {
    return res.status(400).json({ error: "Email, password and role are required" });
  }

  if (!["owner", "admin", "staff"].includes(role)) {
    return res.status(400).json({ error: "Invalid role" });
  }

  const normalizedEmail = String(email).toLowerCase().trim();
  const exists = users.some((u) => u.email === normalizedEmail);

  if (exists) {
    return res.status(409).json({ error: "Email already exists" });
  }

  const passwordHash = await bcrypt.hash(String(password), 12);

  const newUser: User = {
    id: randomUUID(),
    tenantId: auth.tenantId,
    email: normalizedEmail,
    passwordHash,
    role,
    isActive: true,
    createdAt: nowIso(),
  };

  users.push(newUser);

  res.json({
    id: newUser.id,
    tenantId: newUser.tenantId,
    email: newUser.email,
    role: newUser.role,
    isActive: newUser.isActive,
  });
});

app.get("/api/users", requireAuth, requireAdminOrOwner, (req, res) => {
  const auth = (req as any).auth as AuthPayload;

  const tenantUsers = users
    .filter((u) => u.tenantId === auth.tenantId)
    .map((u) => ({
      id: u.id,
      tenantId: u.tenantId,
      email: u.email,
      role: u.role,
      isActive: u.isActive,
      createdAt: u.createdAt,
    }));

  res.json(tenantUsers);
});

// --------------------
// Squares admin routes
// --------------------

app.get("/api/squares", requireAuth, (req, res) => {
  const auth = (req as any).auth as AuthPayload;
  res.json(squareGames.filter((g) => g.tenantId === auth.tenantId));
});

app.post("/api/squares", requireAuth, requireAdminOrOwner, (req, res) => {
  const auth = (req as any).auth as AuthPayload;

  const item: SquareGame = {
    id: randomUUID(),
    tenantId: auth.tenantId,
    title: req.body.title ?? "New Squares Game",
    total: Number(req.body.total ?? 100),
    price: Number(req.body.price ?? 5),
    background: req.body.background ?? "",
    sold: Array.isArray(req.body.sold) ? req.body.sold : [],
    reserved: Array.isArray(req.body.reserved) ? req.body.reserved : [],
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };

  squareGames.push(item);
  res.json(item);
});

app.put("/api/squares/:id", requireAuth, requireAdminOrOwner, (req, res) => {
  const auth = (req as any).auth as AuthPayload;
  const id = req.params.id;

  const existing = squareGames.find((g) => g.id === id && g.tenantId === auth.tenantId);

  if (!existing) {
    return res.status(404).json({ error: "Squares game not found" });
  }

  const updated: SquareGame = {
    ...existing,
    ...req.body,
    id,
    tenantId: auth.tenantId,
    updatedAt: nowIso(),
  };

  squareGames = squareGames.map((g) => (g.id === id ? updated : g));
  res.json(updated);
});

app.delete("/api/squares/:id", requireAuth, requireAdminOrOwner, (req, res) => {
  const auth = (req as any).auth as AuthPayload;
  const id = req.params.id;

  const exists = squareGames.some((g) => g.id === id && g.tenantId === auth.tenantId);

  if (!exists) {
    return res.status(404).json({ error: "Squares game not found" });
  }

  squareGames = squareGames.filter((g) => !(g.id === id && g.tenantId === auth.tenantId));
  purchases = purchases.filter((p) => !(p.module === "squares" && p.itemId === id && p.tenantId === auth.tenantId));

  res.json({ ok: true });
});

// --------------------
// Raffles admin routes
// --------------------

app.get("/api/raffles", requireAuth, (req, res) => {
  const auth = (req as any).auth as AuthPayload;
  res.json(raffleEvents.filter((e) => e.tenantId === auth.tenantId));
});

app.post("/api/raffles", requireAuth, requireAdminOrOwner, (req, res) => {
  const auth = (req as any).auth as AuthPayload;

  const item: RaffleEvent = {
    id: randomUUID(),
    tenantId: auth.tenantId,
    title: req.body.title ?? "New Raffle",
    eventName: req.body.eventName ?? "New Raffle",
    venue: req.body.venue ?? "Venue",
    price: Number(req.body.price ?? 0),
    startNumber: Number(req.body.startNumber ?? 0),
    totalTickets: Number(req.body.totalTickets ?? 0),
    colors: Array.isArray(req.body.colors) ? req.body.colors : ["Red", "Blue"],
    soldByColor: req.body.soldByColor ?? buildInitialSold(),
    background: req.body.background ?? "",
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };

  raffleEvents.push(item);
  res.json(item);
});

app.put("/api/raffles/:id", requireAuth, requireAdminOrOwner, (req, res) => {
  const auth = (req as any).auth as AuthPayload;
  const id = req.params.id;

  const existing = raffleEvents.find((e) => e.id === id && e.tenantId === auth.tenantId);

  if (!existing) {
    return res.status(404).json({ error: "Raffle not found" });
  }

  const updated: RaffleEvent = {
    ...existing,
    ...req.body,
    id,
    tenantId: auth.tenantId,
    updatedAt: nowIso(),
  };

  raffleEvents = raffleEvents.map((e) => (e.id === id ? updated : e));
  res.json(updated);
});

app.delete("/api/raffles/:id", requireAuth, requireAdminOrOwner, (req, res) => {
  const auth = (req as any).auth as AuthPayload;
  const id = req.params.id;

  const exists = raffleEvents.some((e) => e.id === id && e.tenantId === auth.tenantId);

  if (!exists) {
    return res.status(404).json({ error: "Raffle not found" });
  }

  raffleEvents = raffleEvents.filter((e) => !(e.id === id && e.tenantId === auth.tenantId));
  purchases = purchases.filter((p) => !(p.module === "raffle" && p.itemId === id && p.tenantId === auth.tenantId));

  res.json({ ok: true });
});

// --------------------
// Tickets admin routes
// --------------------

app.get("/api/tickets", requireAuth, (req, res) => {
  const auth = (req as any).auth as AuthPayload;
  res.json(ticketEvents.filter((e) => e.tenantId === auth.tenantId));
});

app.post("/api/tickets", requireAuth, requireAdminOrOwner, (req, res) => {
  const auth = (req as any).auth as AuthPayload;

  const item: TicketEvent = {
    id: randomUUID(),
    tenantId: auth.tenantId,
    title: req.body.title ?? "New Event",
    eventName: req.body.eventName ?? "New Event",
    venue: req.body.venue ?? "Venue",
    price: Number(req.body.price ?? 0),
    mode: req.body.mode ?? "rows",
    rows: Number(req.body.rows ?? 0),
    seatsPerRow: Number(req.body.seatsPerRow ?? 0),
    soldSeatIds: Array.isArray(req.body.soldSeatIds) ? req.body.soldSeatIds : [],
    tables: Array.isArray(req.body.tables) ? req.body.tables : [],
    background: req.body.background ?? "",
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };

  ticketEvents.push(item);
  res.json(item);
});

app.put("/api/tickets/:id", requireAuth, requireAdminOrOwner, (req, res) => {
  const auth = (req as any).auth as AuthPayload;
  const id = req.params.id;

  const existing = ticketEvents.find((e) => e.id === id && e.tenantId === auth.tenantId);

  if (!existing) {
    return res.status(404).json({ error: "Ticket event not found" });
  }

  const updated: TicketEvent = {
    ...existing,
    ...req.body,
    id,
    tenantId: auth.tenantId,
    updatedAt: nowIso(),
  };

  ticketEvents = ticketEvents.map((e) => (e.id === id ? updated : e));
  res.json(updated);
});

app.delete("/api/tickets/:id", requireAuth, requireAdminOrOwner, (req, res) => {
  const auth = (req as any).auth as AuthPayload;
  const id = req.params.id;

  const exists = ticketEvents.some((e) => e.id === id && e.tenantId === auth.tenantId);

  if (!exists) {
    return res.status(404).json({ error: "Ticket event not found" });
  }

  ticketEvents = ticketEvents.filter((e) => !(e.id === id && e.tenantId === auth.tenantId));
  purchases = purchases.filter((p) => !(p.module === "tickets" && p.itemId === id && p.tenantId === auth.tenantId));

  res.json({ ok: true });
});

// --------------------
// Protected purchase routes
// --------------------

app.post("/api/squares/purchase", requireAuth, (req, res) => {
  const auth = (req as any).auth as AuthPayload;
  const { gameId, buyerName, buyerEmail, squares } = req.body ?? {};

  const game = squareGames.find((g) => g.id === gameId && g.tenantId === auth.tenantId);

  if (!game) {
    return res.status(404).json({ error: "Squares game not found" });
  }

  if (!buyerName || !buyerEmail || !Array.isArray(squares) || squares.length === 0) {
    return res.status(400).json({ error: "Invalid purchase request" });
  }

  const blocked = squares.some(
    (n: number) => game.sold.includes(n) || game.reserved.includes(n) || n < 1 || n > game.total
  );

  if (blocked) {
    return res.status(409).json({ error: "One or more squares are unavailable" });
  }

  game.sold = [...game.sold, ...squares].sort((a, b) => a - b);
  game.updatedAt = nowIso();

  const purchase: Purchase = {
    id: randomUUID(),
    tenantId: auth.tenantId,
    module: "squares",
    itemId: game.id,
    itemTitle: game.title,
    buyerName,
    buyerEmail,
    quantity: squares.length,
    subtotal: squares.length * game.price,
    total: squares.length * game.price,
    details: { squares },
    createdAt: nowIso(),
  };

  purchases.unshift(purchase);

  res.json({ purchase, game });
});

app.post("/api/raffles/purchase", requireAuth, (req, res) => {
  const auth = (req as any).auth as AuthPayload;
  const { eventId, buyerName, buyerEmail, selections, subtotal, total } = req.body ?? {};

  const event = raffleEvents.find((e) => e.id === eventId && e.tenantId === auth.tenantId);

  if (!event) {
    return res.status(404).json({ error: "Raffle not found" });
  }

  if (!buyerName || !buyerEmail || !selections || typeof selections !== "object") {
    return res.status(400).json({ error: "Invalid purchase request" });
  }

  for (const color of ALL_COLORS) {
    const picked = Array.isArray((selections as any)[color]) ? (selections as any)[color] : [];
    const sold = event.soldByColor[color] ?? [];

    const invalid = picked.some(
      (n: number) =>
        sold.includes(n) ||
        n < event.startNumber ||
        n >= event.startNumber + event.totalTickets
    );

    if (invalid) {
      return res.status(409).json({ error: `One or more ${color} tickets are unavailable` });
    }
  }

  for (const color of ALL_COLORS) {
    const picked = Array.isArray((selections as any)[color]) ? (selections as any)[color] : [];
    event.soldByColor[color] = [...(event.soldByColor[color] ?? []), ...picked].sort((a, b) => a - b);
  }

  event.updatedAt = nowIso();

  const quantity = ALL_COLORS.reduce((sum, color) => {
    const picked = Array.isArray((selections as any)[color]) ? (selections as any)[color] : [];
    return sum + picked.length;
  }, 0);

  const purchase: Purchase = {
    id: randomUUID(),
    tenantId: auth.tenantId,
    module: "raffle",
    itemId: event.id,
    itemTitle: event.title,
    buyerName,
    buyerEmail,
    quantity,
    subtotal: Number(subtotal ?? 0),
    total: Number(total ?? 0),
    details: { selections },
    createdAt: nowIso(),
  };

  purchases.unshift(purchase);

  res.json({ purchase, event });
});

app.post("/api/tickets/purchase", requireAuth, (req, res) => {
  const auth = (req as any).auth as AuthPayload;
  const { eventId, buyerName, buyerEmail, mode, seats, tableId, quantity } = req.body ?? {};

  const event = ticketEvents.find((e) => e.id === eventId && e.tenantId === auth.tenantId);

  if (!event) {
    return res.status(404).json({ error: "Ticket event not found" });
  }

  if (!buyerName || !buyerEmail) {
    return res.status(400).json({ error: "Buyer details required" });
  }

  if (mode === "rows") {
    if (!Array.isArray(seats) || seats.length === 0) {
      return res.status(400).json({ error: "No seats selected" });
    }

    const blocked = seats.some((seatId: string) => event.soldSeatIds.includes(seatId));

    if (blocked) {
      return res.status(409).json({ error: "One or more seats are unavailable" });
    }

    event.soldSeatIds = [...event.soldSeatIds, ...seats].sort();
    event.updatedAt = nowIso();

    const purchase: Purchase = {
      id: randomUUID(),
      tenantId: auth.tenantId,
      module: "tickets",
      itemId: event.id,
      itemTitle: event.title,
      buyerName,
      buyerEmail,
      quantity: seats.length,
      subtotal: seats.length * event.price,
      total: seats.length * event.price,
      details: { mode: "rows", seats },
      createdAt: nowIso(),
    };

    purchases.unshift(purchase);

    return res.json({ purchase, event });
  }

  if (mode === "tables") {
    const table = event.tables.find((t) => t.id === tableId);
    const qty = Number(quantity ?? 0);

    if (!table) {
      return res.status(404).json({ error: "Table not found" });
    }

    if (qty <= 0) {
      return res.status(400).json({ error: "Invalid quantity" });
    }

    const available = table.seats - table.sold;

    if (qty > available) {
      return res.status(409).json({ error: "Not enough seats available at this table" });
    }

    table.sold += qty;
    event.updatedAt = nowIso();

    const purchase: Purchase = {
      id: randomUUID(),
      tenantId: auth.tenantId,
      module: "tickets",
      itemId: event.id,
      itemTitle: event.title,
      buyerName,
      buyerEmail,
      quantity: qty,
      subtotal: qty * event.price,
      total: qty * event.price,
      details: { mode: "tables", tableId: table.id, tableName: table.name },
      createdAt: nowIso(),
    };

    purchases.unshift(purchase);

    return res.json({ purchase, event });
  }

  return res.status(400).json({ error: "Invalid ticket mode" });
});

// --------------------
// Public squares routes
// --------------------

app.get("/api/public/squares/:slug", (req, res) => {
  const tenant = tenants.find((t) => t.slug === req.params.slug && t.isActive);

  if (!tenant) {
    return res.status(404).json({ error: "Tenant not found" });
  }

  const games = squareGames.filter((g) => g.tenantId === tenant.id);

  return res.json({
    tenant: {
      id: tenant.id,
      name: tenant.name,
      slug: tenant.slug,
    },
    games,
  });
});

app.post("/api/public/squares/:slug/purchase", (req, res) => {
  const tenant = tenants.find((t) => t.slug === req.params.slug && t.isActive);

  if (!tenant) {
    return res.status(404).json({ error: "Tenant not found" });
  }

  const { gameId, buyerName, buyerEmail, squares } = req.body ?? {};

  const game = squareGames.find((g) => g.id === gameId && g.tenantId === tenant.id);

  if (!game) {
    return res.status(404).json({ error: "Squares game not found" });
  }

  if (!buyerName || !buyerEmail || !Array.isArray(squares) || squares.length === 0) {
    return res.status(400).json({ error: "Invalid purchase request" });
  }

  const blocked = squares.some(
    (n: number) => game.sold.includes(n) || game.reserved.includes(n) || n < 1 || n > game.total
  );

  if (blocked) {
    return res.status(409).json({ error: "One or more squares are unavailable" });
  }

  game.sold = [...game.sold, ...squares].sort((a, b) => a - b);
  game.updatedAt = nowIso();

  const purchase: Purchase = {
    id: randomUUID(),
    tenantId: tenant.id,
    module: "squares",
    itemId: game.id,
    itemTitle: game.title,
    buyerName,
    buyerEmail,
    quantity: squares.length,
    subtotal: squares.length * game.price,
    total: squares.length * game.price,
    details: { squares },
    createdAt: nowIso(),
  };

  purchases.unshift(purchase);

  return res.json({ purchase, game });
});

// --------------------
// Public raffle routes
// --------------------

app.get("/api/public/raffles/:slug", (req, res) => {
  const tenant = tenants.find((t) => t.slug === req.params.slug && t.isActive);

  if (!tenant) {
    return res.status(404).json({ error: "Tenant not found" });
  }

  const raffles = raffleEvents.filter((e) => e.tenantId === tenant.id);

  return res.json({
    tenant: {
      id: tenant.id,
      name: tenant.name,
      slug: tenant.slug,
    },
    raffles,
  });
});

app.post("/api/public/raffles/:slug/purchase", (req, res) => {
  const tenant = tenants.find((t) => t.slug === req.params.slug && t.isActive);

  if (!tenant) {
    return res.status(404).json({ error: "Tenant not found" });
  }

  const { eventId, buyerName, buyerEmail, selections, subtotal, total } = req.body ?? {};

  const event = raffleEvents.find((e) => e.id === eventId && e.tenantId === tenant.id);

  if (!event) {
    return res.status(404).json({ error: "Raffle not found" });
  }

  if (!buyerName || !buyerEmail || !selections || typeof selections !== "object") {
    return res.status(400).json({ error: "Invalid purchase request" });
  }

  for (const color of ALL_COLORS) {
    const picked = Array.isArray((selections as any)[color]) ? (selections as any)[color] : [];
    const sold = event.soldByColor[color] ?? [];

    const invalid = picked.some(
      (n: number) =>
        sold.includes(n) ||
        n < event.startNumber ||
        n >= event.startNumber + event.totalTickets
    );

    if (invalid) {
      return res.status(409).json({ error: `One or more ${color} tickets are unavailable` });
    }
  }

  for (const color of ALL_COLORS) {
    const picked = Array.isArray((selections as any)[color]) ? (selections as any)[color] : [];
    event.soldByColor[color] = [...(event.soldByColor[color] ?? []), ...picked].sort((a, b) => a - b);
  }

  event.updatedAt = nowIso();

  const quantity = ALL_COLORS.reduce((sum, color) => {
    const picked = Array.isArray((selections as any)[color]) ? (selections as any)[color] : [];
    return sum + picked.length;
  }, 0);

  const purchase: Purchase = {
    id: randomUUID(),
    tenantId: tenant.id,
    module: "raffle",
    itemId: event.id,
    itemTitle: event.title,
    buyerName,
    buyerEmail,
    quantity,
    subtotal: Number(subtotal ?? 0),
    total: Number(total ?? 0),
    details: { selections },
    createdAt: nowIso(),
  };

  purchases.unshift(purchase);

  return res.json({ purchase, event });
});

// --------------------
// Public ticket routes
// --------------------

app.get("/api/public/tickets/:slug", (req, res) => {
  const tenant = tenants.find((t) => t.slug === req.params.slug && t.isActive);

  if (!tenant) {
    return res.status(404).json({ error: "Tenant not found" });
  }

  const events = ticketEvents.filter((e) => e.tenantId === tenant.id);

  return res.json({
    tenant: {
      id: tenant.id,
      name: tenant.name,
      slug: tenant.slug,
    },
    events,
  });
});

app.post("/api/public/tickets/:slug/purchase", (req, res) => {
  const tenant = tenants.find((t) => t.slug === req.params.slug && t.isActive);

  if (!tenant) {
    return res.status(404).json({ error: "Tenant not found" });
  }

  const { eventId, buyerName, buyerEmail, mode, seats, tableId, quantity } = req.body ?? {};

  const event = ticketEvents.find((e) => e.id === eventId && e.tenantId === tenant.id);

  if (!event) {
    return res.status(404).json({ error: "Ticket event not found" });
  }

  if (!buyerName || !buyerEmail) {
    return res.status(400).json({ error: "Buyer details required" });
  }

  if (mode === "rows") {
    if (!Array.isArray(seats) || seats.length === 0) {
      return res.status(400).json({ error: "No seats selected" });
    }

    const blocked = seats.some((seatId: string) => event.soldSeatIds.includes(seatId));

    if (blocked) {
      return res.status(409).json({ error: "One or more seats are unavailable" });
    }

    event.soldSeatIds = [...event.soldSeatIds, ...seats].sort();
    event.updatedAt = nowIso();

    const purchase: Purchase = {
      id: randomUUID(),
      tenantId: tenant.id,
      module: "tickets",
      itemId: event.id,
      itemTitle: event.title,
      buyerName,
      buyerEmail,
      quantity: seats.length,
      subtotal: seats.length * event.price,
      total: seats.length * event.price,
      details: { mode: "rows", seats },
      createdAt: nowIso(),
    };

    purchases.unshift(purchase);

    return res.json({ purchase, event });
  }

  if (mode === "tables") {
    const table = event.tables.find((t) => t.id === tableId);
    const qty = Number(quantity ?? 0);

    if (!table) {
      return res.status(404).json({ error: "Table not found" });
    }

    if (qty <= 0) {
      return res.status(400).json({ error: "Invalid quantity" });
    }

    const available = table.seats - table.sold;

    if (qty > available) {
      return res.status(409).json({ error: "Not enough seats available at this table" });
    }

    table.sold += qty;
    event.updatedAt = nowIso();

    const purchase: Purchase = {
      id: randomUUID(),
      tenantId: tenant.id,
      module: "tickets",
      itemId: event.id,
      itemTitle: event.title,
      buyerName,
      buyerEmail,
      quantity: qty,
      subtotal: qty * event.price,
      total: qty * event.price,
      details: { mode: "tables", tableId: table.id, tableName: table.name },
      createdAt: nowIso(),
    };

    purchases.unshift(purchase);

    return res.json({ purchase, event });
  }

  return res.status(400).json({ error: "Invalid ticket mode" });
});

// --------------------
// Purchases list for current tenant
// --------------------

app.get("/api/purchases", requireAuth, requireAdminOrOwner, (req, res) => {
  const auth = (req as any).auth as AuthPayload;
  res.json(purchases.filter((p) => p.tenantId === auth.tenantId));
});

app.listen(PORT, () => {
  console.log(`Multi-tenant server running on http://localhost:${PORT}`);
});
