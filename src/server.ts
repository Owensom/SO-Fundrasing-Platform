import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";

dotenv.config();

const app = express();

app.use(express.json({ limit: "10mb" }));
app.use(cookieParser());

app.use(
  cors({
    origin: "http://localhost:3000",
    credentials: true,
  })
);

const PORT = Number(process.env.PORT || 4000);
const JWT_SECRET = process.env.JWT_SECRET || "change-this-secret";
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@example.com";
const ADMIN_PASSWORD_HASH = process.env.ADMIN_PASSWORD_HASH || "";

type AdminJwtPayload = {
  email: string;
  role: "admin";
};

type SquareGame = {
  id: number;
  title: string;
  total: number;
  price: number;
  background?: string;
  sold: number[];
  reserved: number[];
};

type RaffleColor = "Red" | "Blue" | "Green" | "Yellow" | "Purple" | "Orange";

type RaffleEvent = {
  id: number;
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

type TicketMode = "rows" | "tables";

type TicketTable = {
  id: number;
  name: string;
  seats: number;
  sold: number;
};

type TicketEvent = {
  id: number;
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
};

type SquarePurchase = {
  id: number;
  gameId: number;
  gameTitle: string;
  buyerName: string;
  buyerEmail: string;
  squares: number[];
  total: number;
  createdAt: string;
};

type RafflePurchase = {
  id: number;
  eventId: number;
  eventTitle: string;
  buyerName: string;
  buyerEmail: string;
  selections: Record<RaffleColor, number[]>;
  quantity: number;
  subtotal: number;
  total: number;
  createdAt: string;
};

type TicketPurchase = {
  id: number;
  eventId: number;
  eventTitle: string;
  buyerName: string;
  buyerEmail: string;
  mode: TicketMode;
  seats: string[];
  tableName?: string;
  quantity: number;
  total: number;
  createdAt: string;
};

const ALL_COLORS: RaffleColor[] = ["Red", "Blue", "Green", "Yellow", "Purple", "Orange"];

function buildInitialSold(): Record<RaffleColor, number[]> {
  return ALL_COLORS.reduce((acc, color) => {
    acc[color] = [];
    return acc;
  }, {} as Record<RaffleColor, number[]>);
}

function nextId() {
  return Date.now() + Math.floor(Math.random() * 1000);
}

function signAdminToken(payload: AdminJwtPayload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "7d" });
}

function requireAdmin(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) {
  const token = req.cookies.admin_token;

  if (!token) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as AdminJwtPayload;

    if (decoded.role !== "admin") {
      return res.status(403).json({ error: "Forbidden" });
    }

    (req as any).admin = decoded;
    next();
  } catch {
    return res.status(401).json({ error: "Invalid session" });
  }
}

// --------------------
// In-memory data
// --------------------

let squares: SquareGame[] = [
  {
    id: 1,
    title: "Super Bowl Squares",
    total: 100,
    price: 10,
    sold: [3, 8, 14],
    reserved: [5, 11],
    background: "",
  },
  {
    id: 2,
    title: "World Cup Final Squares",
    total: 120,
    price: 5,
    sold: [1, 7, 23],
    reserved: [4, 15],
    background: "",
  },
];

let raffles: RaffleEvent[] = [
  {
    id: 1,
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
];

let tickets: TicketEvent[] = [
  {
    id: 1,
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
  },
  {
    id: 2,
    title: "Charity Dinner",
    eventName: "Charity Dinner",
    venue: "Grand Hotel",
    price: 45,
    mode: "tables",
    rows: 0,
    seatsPerRow: 0,
    soldSeatIds: [],
    tables: [
      { id: 21, name: "Table A", seats: 8, sold: 3 },
      { id: 22, name: "Table B", seats: 10, sold: 5 },
    ],
    background: "",
  },
];

let squarePurchases: SquarePurchase[] = [];
let rafflePurchases: RafflePurchase[] = [];
let ticketPurchases: TicketPurchase[] = [];

// --------------------
// Admin auth routes
// --------------------

app.post("/api/admin/login", async (req, res) => {
  const { email, password } = req.body ?? {};

  if (!email || !password) {
    return res.status(400).json({ error: "Email and password required" });
  }

  if (email !== ADMIN_EMAIL) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  const ok = await bcrypt.compare(password, ADMIN_PASSWORD_HASH);

  if (!ok) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  const token = signAdminToken({ email, role: "admin" });

  res.cookie("admin_token", token, {
    httpOnly: true,
    secure: false,
    sameSite: "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });

  return res.json({
    admin: {
      email,
      role: "admin",
    },
  });
});

app.get("/api/admin/me", requireAdmin, (req, res) => {
  const admin = (req as any).admin as AdminJwtPayload;

  res.json({
    admin: {
      email: admin.email,
      role: admin.role,
    },
  });
});

app.post("/api/admin/logout", (_req, res) => {
  res.clearCookie("admin_token");
  res.json({ ok: true });
});

// --------------------
// Public read routes
// --------------------

app.get("/api/squares", (_req, res) => {
  res.json(squares);
});

app.get("/api/raffles", (_req, res) => {
  res.json(raffles);
});

app.get("/api/tickets", (_req, res) => {
  res.json(tickets);
});

app.get("/api/square-purchases", requireAdmin, (_req, res) => {
  res.json(squarePurchases);
});

app.get("/api/raffle-purchases", requireAdmin, (_req, res) => {
  res.json(rafflePurchases);
});

app.get("/api/ticket-purchases", requireAdmin, (_req, res) => {
  res.json(ticketPurchases);
});

// --------------------
// Squares admin routes
// --------------------

app.post("/api/squares", requireAdmin, (req, res) => {
  const item: SquareGame = {
    id: nextId(),
    title: req.body.title ?? "New Squares Game",
    total: Number(req.body.total ?? 100),
    price: Number(req.body.price ?? 5),
    background: req.body.background ?? "",
    sold: Array.isArray(req.body.sold) ? req.body.sold : [],
    reserved: Array.isArray(req.body.reserved) ? req.body.reserved : [],
  };

  squares.push(item);
  res.json(item);
});

app.put("/api/squares/:id", requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  const existing = squares.find((g) => g.id === id);

  if (!existing) {
    return res.status(404).json({ error: "Squares game not found" });
  }

  const updated: SquareGame = {
    ...existing,
    ...req.body,
    id,
  };

  squares = squares.map((g) => (g.id === id ? updated : g));
  res.json(updated);
});

app.delete("/api/squares/:id", requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  const exists = squares.some((g) => g.id === id);

  if (!exists) {
    return res.status(404).json({ error: "Squares game not found" });
  }

  squares = squares.filter((g) => g.id !== id);
  squarePurchases = squarePurchases.filter((p) => p.gameId !== id);
  res.json({ ok: true });
});

// --------------------
// Raffle admin routes
// --------------------

app.post("/api/raffles", requireAdmin, (req, res) => {
  const item: RaffleEvent = {
    id: nextId(),
    title: req.body.title ?? "New Raffle",
    eventName: req.body.eventName ?? "New Raffle",
    venue: req.body.venue ?? "Venue",
    price: Number(req.body.price ?? 0),
    startNumber: Number(req.body.startNumber ?? 0),
    totalTickets: Number(req.body.totalTickets ?? 0),
    colors: Array.isArray(req.body.colors) ? req.body.colors : ["Red", "Blue"],
    soldByColor: req.body.soldByColor ?? buildInitialSold(),
    background: req.body.background ?? "",
  };

  raffles.push(item);
  res.json(item);
});

app.put("/api/raffles/:id", requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  const existing = raffles.find((e) => e.id === id);

  if (!existing) {
    return res.status(404).json({ error: "Raffle not found" });
  }

  const updated: RaffleEvent = {
    ...existing,
    ...req.body,
    id,
  };

  raffles = raffles.map((e) => (e.id === id ? updated : e));
  res.json(updated);
});

app.delete("/api/raffles/:id", requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  const exists = raffles.some((e) => e.id === id);

  if (!exists) {
    return res.status(404).json({ error: "Raffle not found" });
  }

  raffles = raffles.filter((e) => e.id !== id);
  rafflePurchases = rafflePurchases.filter((p) => p.eventId !== id);
  res.json({ ok: true });
});

// --------------------
// Tickets admin routes
// --------------------

app.post("/api/tickets", requireAdmin, (req, res) => {
  const item: TicketEvent = {
    id: nextId(),
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
  };

  tickets.push(item);
  res.json(item);
});

app.put("/api/tickets/:id", requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  const existing = tickets.find((e) => e.id === id);

  if (!existing) {
    return res.status(404).json({ error: "Ticket event not found" });
  }

  const updated: TicketEvent = {
    ...existing,
    ...req.body,
    id,
  };

  tickets = tickets.map((e) => (e.id === id ? updated : e));
  res.json(updated);
});

app.delete("/api/tickets/:id", requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  const exists = tickets.some((e) => e.id === id);

  if (!exists) {
    return res.status(404).json({ error: "Ticket event not found" });
  }

  tickets = tickets.filter((e) => e.id !== id);
  ticketPurchases = ticketPurchases.filter((p) => p.eventId !== id);
  res.json({ ok: true });
});

// --------------------
// Buyer purchase routes
// Optional now, but recommended
// --------------------

app.post("/api/squares/purchase", (req, res) => {
  const { gameId, buyerName, buyerEmail, squares: requestedSquares } = req.body ?? {};
  const game = squares.find((g) => g.id === Number(gameId));

  if (!game) {
    return res.status(404).json({ error: "Squares game not found" });
  }

  if (!buyerName || !buyerEmail || !Array.isArray(requestedSquares) || requestedSquares.length === 0) {
    return res.status(400).json({ error: "Invalid purchase request" });
  }

  const blocked = requestedSquares.some(
    (n: number) => game.sold.includes(n) || game.reserved.includes(n) || n < 1 || n > game.total
  );

  if (blocked) {
    return res.status(409).json({ error: "One or more squares are unavailable" });
  }

  const total = requestedSquares.length * game.price;
  const createdAt = new Date().toLocaleString();

  game.sold = [...game.sold, ...requestedSquares].sort((a, b) => a - b);

  const purchase: SquarePurchase = {
    id: nextId(),
    gameId: game.id,
    gameTitle: game.title,
    buyerName,
    buyerEmail,
    squares: [...requestedSquares].sort((a, b) => a - b),
    total,
    createdAt,
  };

  squarePurchases.unshift(purchase);

  res.json({
    purchase,
    game,
  });
});

app.post("/api/raffles/purchase", (req, res) => {
  const { eventId, buyerName, buyerEmail, selections, subtotal, total } = req.body ?? {};
  const event = raffles.find((e) => e.id === Number(eventId));

  if (!event) {
    return res.status(404).json({ error: "Raffle not found" });
  }

  if (!buyerName || !buyerEmail || !selections || typeof selections !== "object") {
    return res.status(400).json({ error: "Invalid purchase request" });
  }

  for (const color of ALL_COLORS) {
    const picked = Array.isArray(selections[color]) ? selections[color] : [];
    const sold = event.soldByColor[color] ?? [];

    const hasBlocked = picked.some(
      (n: number) => sold.includes(n) || n < event.startNumber || n >= event.startNumber + event.totalTickets
    );

    if (hasBlocked) {
      return res.status(409).json({ error: `One or more ${color} tickets are unavailable` });
    }
  }

  for (const color of ALL_COLORS) {
    const picked = Array.isArray(selections[color]) ? selections[color] : [];
    event.soldByColor[color] = [...(event.soldByColor[color] ?? []), ...picked].sort((a, b) => a - b);
  }

  const quantity = ALL_COLORS.reduce((sum, color) => {
    const picked = Array.isArray(selections[color]) ? selections[color] : [];
    return sum + picked.length;
  }, 0);

  const purchase: RafflePurchase = {
    id: nextId(),
    eventId: event.id,
    eventTitle: event.title,
    buyerName,
    buyerEmail,
    selections,
    quantity,
    subtotal: Number(subtotal ?? 0),
    total: Number(total ?? 0),
    createdAt: new Date().toLocaleString(),
  };

  rafflePurchases.unshift(purchase);

  res.json({
    purchase,
    event,
  });
});

app.post("/api/tickets/purchase", (req, res) => {
  const { eventId, buyerName, buyerEmail, mode, seats, tableId, quantity } = req.body ?? {};
  const event = tickets.find((e) => e.id === Number(eventId));

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

    const purchase: TicketPurchase = {
      id: nextId(),
      eventId: event.id,
      eventTitle: event.title,
      buyerName,
      buyerEmail,
      mode: "rows",
      seats,
      quantity: seats.length,
      total: seats.length * event.price,
      createdAt: new Date().toLocaleString(),
    };

    ticketPurchases.unshift(purchase);

    return res.json({
      purchase,
      event,
    });
  }

  if (mode === "tables") {
    const table = event.tables.find((t) => t.id === Number(tableId));
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

    const purchase: TicketPurchase = {
      id: nextId(),
      eventId: event.id,
      eventTitle: event.title,
      buyerName,
      buyerEmail,
      mode: "tables",
      seats: [],
      tableName: table.name,
      quantity: qty,
      total: qty * event.price,
      createdAt: new Date().toLocaleString(),
    };

    ticketPurchases.unshift(purchase);

    return res.json({
      purchase,
      event,
    });
  }

  return res.status(400).json({ error: "Invalid ticket mode" });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
