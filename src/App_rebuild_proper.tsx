
import React, { useMemo, useRef, useState } from 'react';
import {
  Database,
  Download,
  Grid3X3,
  Image as ImageIcon,
  Plus,
  Shuffle,
  Sparkles,
  Ticket,
  Trophy,
} from 'lucide-react';

type Section = 'squares' | 'tickets' | 'raffle';
type TicketMode = 'quantity' | 'seats' | 'tables';
type AdminTab = 'squares' | 'tickets' | 'raffle';
type Drafts = Record<string, string>;

type SquaresListing = {
  id: number;
  title: string;
  totalSquares: number;
  price: number;
  background: string;
  sold: number[];
  reserved: number[];
};

type TableConfig = {
  id: number;
  name: string;
  seats: number;
  sold: number;
};

type TicketListing = {
  id: number;
  title: string;
  eventName: string;
  venue: string;
  price: number;
  mode: TicketMode;
  background: string;
  rows: number;
  seatsPerRow: number;
  tables: TableConfig[];
};

type Rule = {
  id: number;
  qty: number;
  price: number;
};

type Batch = {
  id: number;
  color: string;
  count: number;
  sold: number[];
  price: number;
  rules: Rule[];
};

type RaffleListing = {
  id: number;
  title: string;
  prize: string;
  background: string;
  batches: Batch[];
};

type Choice = {
  id: number;
  color: string;
  qty: string;
};

type Order = {
  id: number;
  listing: string;
  buyer: string;
  email: string;
  lines: string[];
  total: number;
};

type AllocationRow = {
  id: number;
  color: string;
  qty: string;
  numbers: number[];
  valid: boolean;
};

const squareBg =
  'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?auto=format&fit=crop&w=1400&q=80';
const ticketBg =
  'https://images.unsplash.com/photo-1511578314322-379afb476865?auto=format&fit=crop&w=1400&q=80';
const raffleBg =
  'https://images.unsplash.com/photo-1517457373958-b7bdd4587205?auto=format&fit=crop&w=1400&q=80';

const squareSeed: SquaresListing[] = [
  {
    id: 1,
    title: 'Super Bowl Squares',
    totalSquares: 100,
    price: 10,
    background: squareBg,
    sold: [3, 8, 14],
    reserved: [5, 11],
  },
];

const ticketSeed: TicketListing[] = [
  {
    id: 1,
    title: 'Summer Gala Tickets',
    eventName: 'Summer Gala',
    venue: 'Town Hall',
    price: 35,
    mode: 'tables',
    background: ticketBg,
    rows: 6,
    seatsPerRow: 10,
    tables: [
      { id: 11, name: 'Table A', seats: 8, sold: 3 },
      { id: 12, name: 'Table B', seats: 10, sold: 6 },
    ],
  },
];

const raffleSeed: RaffleListing[] = [
  {
    id: 1,
    title: 'Charity Raffle',
    prize: 'Weekend getaway hamper',
    background: raffleBg,
    batches: [
      { id: 101, color: 'Pink', count: 300, sold: [1, 2, 7], price: 3, rules: [{ id: 1001, qty: 5, price: 10 }] },
      { id: 102, color: 'Yellow', count: 300, sold: [3, 8, 19], price: 3, rules: [{ id: 1002, qty: 5, price: 10 }] },
      { id: 103, color: 'Blue', count: 250, sold: [4, 9, 18], price: 3, rules: [{ id: 1003, qty: 5, price: 10 }] },
    ],
  },
];

function parsePositiveInt(v: string): number | undefined {
  const t = v.trim();
  if (!t) return undefined;
  const n = Number(t);
  if (!Number.isFinite(n) || n < 1) return undefined;
  return Math.floor(n);
}

function formatMoney(value: number): string {
  return `£${value.toFixed(2)}`;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function randomId(): number {
  return Date.now() + Math.floor(Math.random() * 10000);
}

function takeAvailableNumbers(batch: Batch, wanted: number, seed = 1): number[] {
  const available: number[] = [];
  const sold = new Set(batch.sold);
  for (let i = 1; i <= batch.count; i += 1) {
    if (!sold.has(i)) available.push(i);
  }
  let s = seed;
  const rand = () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
  for (let i = available.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    [available[i], available[j]] = [available[j], available[i]];
  }
  return available.slice(0, Math.min(wanted, available.length)).sort((a, b) => a - b);
}

function priceByBundles(priceEach: number, rules: Rule[], qty: number): number {
  const sorted = [...rules].filter((r) => r.qty > 0 && r.price > 0).sort((a, b) => b.qty - a.qty);
  let remaining = qty;
  let total = 0;
  for (const rule of sorted) {
    const bundles = Math.floor(remaining / rule.qty);
    if (bundles > 0) {
      total += bundles * rule.price;
      remaining -= bundles * rule.qty;
    }
  }
  return total + remaining * priceEach;
}

async function exportReceipt(title: string, buyer: string, email: string, lines: string[], total: number) {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF();
  doc.setFontSize(22);
  doc.text('Purchase Receipt', 20, 22);
  doc.setFontSize(14);
  doc.text(title, 20, 34);
  doc.text(`Name: ${buyer}`, 20, 48);
  doc.text(`Email: ${email}`, 20, 60);
  let y = 76;
  for (const line of lines) {
    if (y > 270) {
      doc.addPage();
      y = 20;
    }
    doc.text(line, 20, y);
    y += 10;
  }
  doc.text(`Total: ${formatMoney(total)}`, 20, y + 6);
  doc.save(`${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-receipt.pdf`);
}

function PremiumCard({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-[28px] border border-white/10 bg-white/[0.07] p-6 shadow-[0_20px_80px_rgba(2,6,23,0.45)] backdrop-blur-xl ${className}`}
    >
      {children}
    </div>
  );
}

function SectionChip({
  children,
  active,
  onClick,
  tone = 'default',
}: {
  children: React.ReactNode;
  active?: boolean;
  onClick?: () => void;
  tone?: 'default' | 'danger';
}) {
  const activeStyles =
    tone === 'danger'
      ? 'border-rose-300/45 bg-rose-400/12 text-rose-100'
      : 'border-sky-300/45 bg-white/12 text-white shadow-[0_12px_40px_rgba(56,189,248,0.18)]';
  const idleStyles =
    tone === 'danger'
      ? 'border-rose-400/20 bg-rose-400/10 text-rose-200 hover:bg-rose-400/15'
      : 'border-white/10 bg-white/[0.04] text-slate-300 hover:bg-white/[0.08]';
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-2xl border px-4 py-2.5 text-sm font-medium transition ${active ? activeStyles : idleStyles}`}
    >
      {children}
    </button>
  );
}

function TextField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium uppercase tracking-[0.14em] text-slate-400">{label}</label>
      <input
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-white shadow-inner outline-none transition focus:border-sky-300/40"
      />
    </div>
  );
}

function NumberField({
  label,
  value,
  onChange,
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  hint?: string;
}) {
  const invalid = value !== '' && parsePositiveInt(value) === undefined;
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium uppercase tracking-[0.14em] text-slate-400">{label}</label>
      <input
        value={value}
        type="number"
        min={1}
        onChange={(e) => onChange(e.target.value)}
        className={`w-full rounded-2xl border px-4 py-3 text-white shadow-inner outline-none transition ${
          invalid ? 'border-rose-400/50 bg-rose-950/20' : 'border-white/10 bg-slate-950/80 focus:border-sky-300/40'
        }`}
      />
      <div className="mt-1.5 text-[11px] text-slate-500">{hint ?? 'Blank allowed while editing, not for completion.'}</div>
    </div>
  );
}

function SummaryBox({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-[24px] border border-white/10 bg-slate-950/65 p-4 text-sm shadow-[0_14px_36px_rgba(2,6,23,0.22)] ${className}`}>
      {children}
    </div>
  );
}

function OrderPanel({ title, orders }: { title: string; orders: Order[] }) {
  return (
    <div className="space-y-3">
      <div className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-400">{title}</div>
      {orders.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-4 text-sm text-slate-400">No purchases recorded yet.</div>
      ) : (
        orders.map((order) => (
          <div key={order.id} className="rounded-3xl border border-white/10 bg-slate-950/55 p-4 shadow-[0_14px_36px_rgba(2,6,23,0.22)]">
            <div className="mb-1 text-xs uppercase tracking-[0.14em] text-slate-500">{order.listing}</div>
            <div className="mb-2 flex justify-between">
              <div className="font-semibold text-white">{order.buyer}</div>
              <div className="text-sm text-slate-200">{formatMoney(order.total)}</div>
            </div>
            <div className="mb-2 text-sm text-slate-300">{order.email}</div>
            <div className="grid gap-1 text-sm text-slate-300">
              {order.lines.map((line, idx) => (
                <div key={idx}>{line}</div>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}

function AdminPurchaseData({
  show,
  tab,
  setTab,
  squareOrders,
  ticketOrders,
  raffleOrders,
}: {
  show: boolean;
  tab: AdminTab;
  setTab: (t: AdminTab) => void;
  squareOrders: Order[];
  ticketOrders: Order[];
  raffleOrders: Order[];
}) {
  if (!show) return null;
  return (
    <PremiumCard>
      <div className="mb-4 flex items-center gap-2 text-lg font-semibold">
        <Database className="h-5 w-5 text-sky-300" />
        Admin purchase data
      </div>
      <div className="mb-4 grid grid-cols-3 gap-2">
        {(['squares', 'tickets', 'raffle'] as AdminTab[]).map((item) => (
          <SectionChip key={item} active={tab === item} onClick={() => setTab(item)}>
            {item}
          </SectionChip>
        ))}
      </div>
      {tab === 'squares' && <OrderPanel title="Squares orders" orders={squareOrders} />}
      {tab === 'tickets' && <OrderPanel title="Ticket orders" orders={ticketOrders} />}
      {tab === 'raffle' && <OrderPanel title="Raffle orders" orders={raffleOrders} />}
    </PremiumCard>
  );
}

export default function App() {
  const [section, setSection] = useState<Section>('squares');
  const [isAdminView, setIsAdminView] = useState(true);
  const [adminTab, setAdminTab] = useState<AdminTab>('raffle');

  const [buyerName, setBuyerName] = useState('Jamie Carter');
  const [buyerEmail, setBuyerEmail] = useState('jamie@example.com');

  const [squareListings, setSquareListings] = useState<SquaresListing[]>(squareSeed);
  const [ticketListings, setTicketListings] = useState<TicketListing[]>(ticketSeed);
  const [raffleListings, setRaffleListings] = useState<RaffleListing[]>(raffleSeed);

  const [activeSquareId, setActiveSquareId] = useState(squareSeed[0].id);
  const [activeTicketId, setActiveTicketId] = useState(ticketSeed[0].id);
  const [activeRaffleId, setActiveRaffleId] = useState(raffleSeed[0].id);

  const [selectedSquaresByListing, setSelectedSquaresByListing] = useState<Record<number, number[]>>({
    [squareSeed[0].id]: [1, 2, 12],
  });
  const [ticketQty, setTicketQty] = useState('2');
  const [selectedTableId, setSelectedTableId] = useState(ticketSeed[0].tables[0]?.id ?? 0);
  const [choicesByRaffle, setChoicesByRaffle] = useState<Record<number, Choice[]>>({
    [raffleSeed[0].id]: [
      { id: 1, color: 'Pink', qty: '2' },
      { id: 2, color: 'Blue', qty: '' },
    ],
  });

  const [drafts, setDrafts] = useState<Drafts>({});
  const [squareOrders, setSquareOrders] = useState<Order[]>([]);
  const [ticketOrders, setTicketOrders] = useState<Order[]>([]);
  const [raffleOrders, setRaffleOrders] = useState<Order[]>([]);
  const [winner, setWinner] = useState('');

  const imageRef = useRef<HTMLInputElement | null>(null);

  const activeSquare = squareListings.find((x) => x.id === activeSquareId) ?? squareListings[0];
  const activeTicket = ticketListings.find((x) => x.id === activeTicketId) ?? ticketListings[0];
  const activeRaffle = raffleListings.find((x) => x.id === activeRaffleId) ?? raffleListings[0];

  const selectedSquares = selectedSquaresByListing[activeSquare.id] ?? [];
  const selectedTable = activeTicket.tables.find((t) => t.id === selectedTableId) ?? activeTicket.tables[0];
  const ticketQuantity = parsePositiveInt(ticketQty) ?? 0;
  const raffleChoices = choicesByRaffle[activeRaffle.id] ?? [];

  const numericKeys = useMemo(() => {
    const keys: string[] = [];
    squareListings.forEach((s) => keys.push(`sq-price-${s.id}`, `sq-total-${s.id}`));
    ticketListings.forEach((t) => {
      keys.push(`tk-price-${t.id}`, `tk-rows-${t.id}`, `tk-seats-${t.id}`);
      t.tables.forEach((tb) => keys.push(`tb-seats-${tb.id}`));
    });
    raffleListings.forEach((r) => {
      r.batches.forEach((b) => {
        keys.push(`rf-count-${b.id}`, `rf-price-${b.id}`);
        b.rules.forEach((rule) => keys.push(`rule-qty-${rule.id}`, `rule-price-${rule.id}`));
      });
    });
    return keys;
  }, [squareListings, ticketListings, raffleListings]);

  const hasBlankNumbers = numericKeys.some((key) => drafts[key] === '');
  const getDraft = (key: string, fallback: number) => drafts[key] ?? String(fallback);

  const applyDraft = (key: string, value: string, onValid: (n: number) => void) => {
    setDrafts((curr) => ({ ...curr, [key]: value }));
    const parsed = parsePositiveInt(value);
    if (parsed !== undefined) onValid(parsed);
  };

  const raffleAllocation = useMemo<AllocationRow[]>(() => {
    const usedByColor = new Map<string, Set<number>>();
    return raffleChoices.map((choice, idx) => {
      const batch = activeRaffle.batches.find((b) => b.color === choice.color);
      const wanted = parsePositiveInt(choice.qty) ?? 0;
      if (!batch) {
        return { id: choice.id, color: choice.color, qty: choice.qty, numbers: [], valid: false };
      }
      const picked = takeAvailableNumbers(batch, wanted, activeRaffle.id * 100 + idx + 7);
      const used = usedByColor.get(choice.color) ?? new Set<number>();
      const filtered = picked.filter((n) => !used.has(n));
      filtered.forEach((n) => used.add(n));
      usedByColor.set(choice.color, used);
      return {
        id: choice.id,
        color: choice.color,
        qty: choice.qty,
        numbers: filtered,
        valid: choice.qty.trim() !== '' && wanted > 0 && filtered.length === wanted,
      };
    });
  }, [raffleChoices, activeRaffle]);

  const raffleTotalQty = raffleAllocation.reduce((sum, row) => sum + row.numbers.length, 0);
  const raffleRules = useMemo(() => {
    const byQty = new Map<number, number>();
    activeRaffle.batches.forEach((batch) => {
      batch.rules.forEach((rule) => {
        const current = byQty.get(rule.qty);
        if (current === undefined || rule.price < current) {
          byQty.set(rule.qty, rule.price);
        }
      });
    });
    return Array.from(byQty.entries()).map(([qty, price]) => ({ id: qty, qty, price }));
  }, [activeRaffle]);
  const raffleBasePrice = Math.min(...activeRaffle.batches.map((b) => b.price));
  const raffleTotal = priceByBundles(raffleBasePrice, raffleRules, raffleTotalQty);
  const raffleHasBlankQty = raffleChoices.some((c) => c.qty.trim() === '');
  const raffleHasInvalid = raffleAllocation.some((row) => !row.valid && row.qty.trim() !== '');
  const canRaffleBuy =
    !!buyerName.trim() &&
    !!buyerEmail.trim() &&
    raffleTotalQty > 0 &&
    !raffleHasBlankQty &&
    !raffleHasInvalid &&
    !hasBlankNumbers;

  const squaresTotal = selectedSquares.length * activeSquare.price;
  const tableAvailable = selectedTable ? Math.max(selectedTable.seats - selectedTable.sold, 0) : 0;
  const ticketTotal = ticketQuantity * activeTicket.price;

  function setBackgroundFromFile(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      const src = String(reader.result || '');
      if (section === 'squares') {
        setSquareListings((curr) => curr.map((x) => (x.id === activeSquare.id ? { ...x, background: src } : x)));
      } else if (section === 'tickets') {
        setTicketListings((curr) => curr.map((x) => (x.id === activeTicket.id ? { ...x, background: src } : x)));
      } else {
        setRaffleListings((curr) => curr.map((x) => (x.id === activeRaffle.id ? { ...x, background: src } : x)));
      }
    };
    reader.readAsDataURL(file);
  }

  function onUploadImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBackgroundFromFile(file);
  }

  function addSquareListing() {
    const id = randomId();
    setSquareListings((curr) => [
      ...curr,
      {
        id,
        title: `New Squares ${curr.length + 1}`,
        totalSquares: 100,
        price: 10,
        background: squareBg,
        sold: [],
        reserved: [],
      },
    ]);
    setSelectedSquaresByListing((curr) => ({ ...curr, [id]: [] }));
    setActiveSquareId(id);
  }

  function removeSquareListing(id: number) {
    setSquareListings((curr) => {
      if (curr.length <= 1) return curr;
      const next = curr.filter((x) => x.id !== id);
      if (activeSquareId === id && next[0]) setActiveSquareId(next[0].id);
      return next;
    });
    setSelectedSquaresByListing((curr) => {
      const next = { ...curr };
      delete next[id];
      return next;
    });
  }

  function toggleSquare(number: number) {
    if (activeSquare.sold.includes(number) || activeSquare.reserved.includes(number)) return;
    setSelectedSquaresByListing((curr) => {
      const existing = curr[activeSquare.id] ?? [];
      const next = existing.includes(number)
        ? existing.filter((x) => x !== number)
        : [...existing, number].sort((a, b) => a - b);
      return { ...curr, [activeSquare.id]: next };
    });
  }

  async function buySquares() {
    if (!buyerName.trim() || !buyerEmail.trim() || selectedSquares.length === 0 || hasBlankNumbers) return;
    const lines = [
      `Squares: ${selectedSquares.join(', ')}`,
      `Quantity: ${selectedSquares.length}`,
      `Price each: ${formatMoney(activeSquare.price)}`,
    ];
    setSquareOrders((curr) => [
      { id: randomId(), listing: activeSquare.title, buyer: buyerName, email: buyerEmail, lines, total: squaresTotal },
      ...curr,
    ]);
    await exportReceipt(activeSquare.title, buyerName, buyerEmail, lines, squaresTotal);
  }

  function addTicketListing() {
    const id = randomId();
    const tableId = id + 1;
    setTicketListings((curr) => [
      ...curr,
      {
        id,
        title: `New Event ${curr.length + 1}`,
        eventName: 'New Event',
        venue: 'Venue',
        price: 25,
        mode: 'tables',
        background: ticketBg,
        rows: 6,
        seatsPerRow: 10,
        tables: [{ id: tableId, name: 'Table A', seats: 8, sold: 0 }],
      },
    ]);
    setActiveTicketId(id);
    setSelectedTableId(tableId);
  }

  function removeTicketListing(id: number) {
    setTicketListings((curr) => {
      if (curr.length <= 1) return curr;
      const next = curr.filter((x) => x.id !== id);
      if (activeTicketId === id && next[0]) {
        setActiveTicketId(next[0].id);
        setSelectedTableId(next[0].tables[0]?.id ?? 0);
      }
      return next;
    });
  }

  function addTable() {
    const tableId = randomId();
    setTicketListings((curr) =>
      curr.map((listing) =>
        listing.id === activeTicket.id
          ? {
              ...listing,
              tables: [
                ...listing.tables,
                { id: tableId, name: `Table ${String.fromCharCode(65 + listing.tables.length)}`, seats: 8, sold: 0 },
              ],
            }
          : listing
      )
    );
  }

  async function buyTickets() {
    if (!buyerName.trim() || !buyerEmail.trim() || ticketQuantity <= 0 || hasBlankNumbers) return;
    if (activeTicket.mode === 'tables' && selectedTable && ticketQuantity > tableAvailable) return;
    const reference =
      activeTicket.mode === 'tables' && selectedTable
        ? selectedTable.name
        : activeTicket.mode === 'seats'
          ? 'Seat selection'
          : 'General admission';
    const lines = [
      `Event: ${activeTicket.eventName}`,
      `Mode: ${activeTicket.mode}`,
      `Reference: ${reference}`,
      `Quantity: ${ticketQuantity}`,
      `Price each: ${formatMoney(activeTicket.price)}`,
    ];
    setTicketOrders((curr) => [
      { id: randomId(), listing: activeTicket.title, buyer: buyerName, email: buyerEmail, lines, total: ticketTotal },
      ...curr,
    ]);
    await exportReceipt(activeTicket.title, buyerName, buyerEmail, lines, ticketTotal);
  }

  function addRaffleListing() {
    const id = randomId();
    setRaffleListings((curr) => [
      ...curr,
      {
        id,
        title: `New Raffle ${curr.length + 1}`,
        prize: 'Prize',
        background: raffleBg,
        batches: [{ id: id + 1, color: 'New colour', count: 100, sold: [], price: 3, rules: [{ id: id + 2, qty: 5, price: 10 }] }],
      },
    ]);
    setChoicesByRaffle((curr) => ({ ...curr, [id]: [{ id: id + 3, color: 'New colour', qty: '' }] }));
    setActiveRaffleId(id);
  }

  function removeRaffleListing(id: number) {
    setRaffleListings((curr) => {
      if (curr.length <= 1) return curr;
      const next = curr.filter((x) => x.id !== id);
      if (activeRaffleId === id && next[0]) setActiveRaffleId(next[0].id);
      return next;
    });
    setChoicesByRaffle((curr) => {
      const next = { ...curr };
      delete next[id];
      return next;
    });
  }

  function addBatch() {
    const id = randomId();
    setRaffleListings((curr) =>
      curr.map((listing) =>
        listing.id === activeRaffle.id
          ? {
              ...listing,
              batches: [
                ...listing.batches,
                { id, color: `New colour ${listing.batches.length + 1}`, count: 100, sold: [], price: 3, rules: [{ id: id + 1, qty: 5, price: 10 }] },
              ],
            }
          : listing
      )
    );
  }

  function addRule(batchId: number) {
    const ruleId = randomId();
    setRaffleListings((curr) =>
      curr.map((listing) =>
        listing.id === activeRaffle.id
          ? {
              ...listing,
              batches: listing.batches.map((batch) =>
                batch.id === batchId ? { ...batch, rules: [...batch.rules, { id: ruleId, qty: 5, price: 10 }] } : batch
              ),
            }
          : listing
      )
    );
  }

  function updateChoice(id: number, patch: Partial<Choice>) {
    setChoicesByRaffle((curr) => ({
      ...curr,
      [activeRaffle.id]: (curr[activeRaffle.id] ?? []).map((choice) => (choice.id === id ? { ...choice, ...patch } : choice)),
    }));
  }

  function addChoice() {
    setChoicesByRaffle((curr) => ({
      ...curr,
      [activeRaffle.id]: [...(curr[activeRaffle.id] ?? []), { id: randomId(), color: activeRaffle.batches[0]?.color ?? 'Pink', qty: '' }],
    }));
  }

  function removeChoice(id: number) {
    setChoicesByRaffle((curr) => ({
      ...curr,
      [activeRaffle.id]: (curr[activeRaffle.id] ?? []).filter((choice) => choice.id !== id),
    }));
  }

  async function buyRaffle() {
    if (!canRaffleBuy) return;
    const ticketLines = raffleAllocation.flatMap((row) => row.numbers.map((n) => `${row.color} #${n}`));
    setRaffleOrders((curr) => [
      { id: randomId(), listing: activeRaffle.title, buyer: buyerName, email: buyerEmail, lines: ticketLines, total: raffleTotal },
      ...curr,
    ]);
    setRaffleListings((curr) =>
      curr.map((listing) =>
        listing.id === activeRaffle.id
          ? {
              ...listing,
              batches: listing.batches.map((batch) => {
                const numbers = raffleAllocation.filter((row) => row.color === batch.color).flatMap((row) => row.numbers);
                return numbers.length ? { ...batch, sold: [...batch.sold, ...numbers].sort((a, b) => a - b) } : batch;
              }),
            }
          : listing
      )
    );
    await exportReceipt(activeRaffle.title, buyerName, buyerEmail, ticketLines, raffleTotal);
  }

  function drawWinner() {
    const pool = activeRaffle.batches.flatMap((batch) => batch.sold.map((n) => `${batch.color} #${n}`));
    if (!pool.length) return;
    setWinner(pool[Math.floor(Math.random() * pool.length)]);
  }

  const buyerSection = (
    <PremiumCard className="w-full">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-2xl font-semibold">Buyer</h2>
        <SectionChip onClick={() => imageRef.current?.click()}>
          <span className="inline-flex items-center gap-2">
            <ImageIcon className="h-4 w-4" />
            Background image
          </span>
        </SectionChip>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <TextField label="Buyer name" value={buyerName} onChange={setBuyerName} />
        <TextField label="Buyer email" value={buyerEmail} onChange={setBuyerEmail} />
      </div>
    </PremiumCard>
  );

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.14),_transparent_28%),radial-gradient(circle_at_right,_rgba(168,85,247,0.12),_transparent_22%),linear-gradient(180deg,_#020617_0%,_#0f172a_48%,_#020617_100%)] p-6 text-white">
      <div className="mx-auto max-w-7xl space-y-6">
        <input ref={imageRef} type="file" accept="image/*" className="hidden" onChange={onUploadImage} />

        <PremiumCard>
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.08] px-3 py-1 text-xs uppercase tracking-[0.2em] text-sky-200">
                <Sparkles className="h-3.5 w-3.5" />
                Premium fundraising suite
              </div>
              <h1 className="text-4xl font-semibold tracking-tight">SO Fundraising Platform</h1>
              <p className="mt-2 max-w-3xl text-slate-300">
                Stable rebuild with admin view toggle, full-width buyer area, squares up to 500, tickets with seats and tables, raffle bundles,
                buyer PDF receipts, and admin purchase data.
              </p>
            </div>
            <SectionChip active={isAdminView} onClick={() => setIsAdminView((v) => !v)}>
              {isAdminView ? 'Admin view on' : 'Admin view off'}
            </SectionChip>
          </div>
        </PremiumCard>

        {hasBlankNumbers && (
          <div className="rounded-3xl border border-rose-400/25 bg-rose-400/10 p-4 text-sm text-rose-100 shadow-[0_16px_50px_rgba(127,29,29,0.18)]">
            One or more number fields are blank. They can be blank while editing, but not for completion.
          </div>
        )}

        <div className="grid gap-3 md:grid-cols-3">
          {(['squares', 'tickets', 'raffle'] as Section[]).map((item) => (
            <SectionChip key={item} active={section === item} onClick={() => setSection(item)}>
              <span className="inline-flex items-center gap-2">
                {item === 'squares' ? <Grid3X3 className="h-4 w-4" /> : item === 'tickets' ? <Ticket className="h-4 w-4" /> : <Trophy className="h-4 w-4" />}
                {item[0].toUpperCase() + item.slice(1)}
              </span>
            </SectionChip>
          ))}
        </div>

        {buyerSection}

        {section === 'squares' && (
          <>
            {isAdminView && (
              <PremiumCard>
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <h2 className="text-2xl font-semibold">Admin: Squares setup</h2>
                  <div className="flex flex-wrap gap-2">
                    <SectionChip onClick={addSquareListing}>
                      <span className="inline-flex items-center gap-2">
                        <Plus className="h-4 w-4" />
                        Add squares game
                      </span>
                    </SectionChip>
                    <SectionChip tone="danger" onClick={() => removeSquareListing(activeSquare.id)}>
                      Remove current
                    </SectionChip>
                  </div>
                </div>

                <div className="mb-4 flex flex-wrap gap-2">
                  {squareListings.map((listing) => (
                    <SectionChip key={listing.id} active={activeSquareId === listing.id} onClick={() => setActiveSquareId(listing.id)}>
                      {listing.title}
                    </SectionChip>
                  ))}
                </div>

                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  <TextField
                    label="Game title"
                    value={activeSquare.title}
                    onChange={(v) =>
                      setSquareListings((curr) => curr.map((x) => (x.id === activeSquare.id ? { ...x, title: v } : x)))
                    }
                  />
                  <NumberField
                    label="Price per square"
                    value={getDraft(`sq-price-${activeSquare.id}`, activeSquare.price)}
                    onChange={(v) =>
                      applyDraft(`sq-price-${activeSquare.id}`, v, (n) =>
                        setSquareListings((curr) => curr.map((x) => (x.id === activeSquare.id ? { ...x, price: n } : x)))
                      )
                    }
                  />
                  <NumberField
                    label="Squares to sell"
                    value={getDraft(`sq-total-${activeSquare.id}`, activeSquare.totalSquares)}
                    hint="Blank allowed while editing, not for completion. Up to 500."
                    onChange={(v) =>
                      applyDraft(`sq-total-${activeSquare.id}`, v, (n) => {
                        const safeTotal = clamp(n, 1, 500);
                        setSquareListings((curr) =>
                          curr.map((x) =>
                            x.id === activeSquare.id
                              ? {
                                  ...x,
                                  totalSquares: safeTotal,
                                  sold: x.sold.filter((num) => num <= safeTotal),
                                  reserved: x.reserved.filter((num) => num <= safeTotal),
                                }
                              : x
                          )
                        );
                        setSelectedSquaresByListing((curr) => ({
                          ...curr,
                          [activeSquare.id]: (curr[activeSquare.id] ?? []).filter((num) => num <= safeTotal),
                        }));
                      })
                    }
                  />
                </div>
              </PremiumCard>
            )}

            <div
              className="overflow-hidden rounded-[28px] border border-white/10 shadow-[0_20px_80px_rgba(2,6,23,0.45)]"
              style={{ backgroundImage: `url(${activeSquare.background})`, backgroundSize: 'cover', backgroundPosition: 'center' }}
            >
              <div className="bg-slate-950/75 p-6 backdrop-blur-[2px]">
                <h2 className="text-2xl font-semibold">{activeSquare.title}</h2>
                <div className="mt-4 grid gap-2" style={{ gridTemplateColumns: 'repeat(10, minmax(0, 1fr))' }}>
                  {Array.from({ length: activeSquare.totalSquares }).map((_, idx) => {
                    const number = idx + 1;
                    const style = activeSquare.sold.includes(number)
                      ? 'border-rose-400/30 bg-rose-500/20 text-rose-100'
                      : activeSquare.reserved.includes(number)
                        ? 'border-amber-400/30 bg-amber-500/20 text-amber-100'
                        : selectedSquares.includes(number)
                          ? 'border-white bg-white text-slate-950 shadow-[0_8px_24px_rgba(255,255,255,0.18)]'
                          : 'border-white/15 bg-slate-900/70';
                    return (
                      <button
                        key={number}
                        type="button"
                        onClick={() => toggleSquare(number)}
                        disabled={activeSquare.sold.includes(number) || activeSquare.reserved.includes(number)}
                        className={`flex aspect-square items-center justify-center rounded-2xl border text-sm font-semibold transition ${style}`}
                      >
                        {number}
                      </button>
                    );
                  })}
                </div>
                <SummaryBox className="mt-4">
                  <div className="flex justify-between">
                    <span>Squares selected</span>
                    <span>{selectedSquares.length}</span>
                  </div>
                  <div className="mt-2 text-xs text-slate-400">Numbers: {selectedSquares.join(', ') || 'None yet'}</div>
                  <div className="mt-2 flex justify-between">
                    <span>Total</span>
                    <span>{formatMoney(squaresTotal)}</span>
                  </div>
                </SummaryBox>
                <button
                  type="button"
                  onClick={() => void buySquares()}
                  disabled={!buyerName.trim() || !buyerEmail.trim() || selectedSquares.length === 0 || hasBlankNumbers}
                  className="mt-4 w-full rounded-2xl bg-white px-4 py-3 font-semibold text-slate-950 shadow-[0_14px_36px_rgba(255,255,255,0.14)] transition hover:bg-slate-100 disabled:opacity-50"
                >
                  Pay for squares + export PDF
                </button>
              </div>
            </div>
          </>
        )}

        {section === 'tickets' && (
          <>
            {isAdminView && (
              <PremiumCard>
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <h2 className="text-2xl font-semibold">Admin: Event setup</h2>
                  <div className="flex flex-wrap gap-2">
                    <SectionChip onClick={addTicketListing}>
                      <span className="inline-flex items-center gap-2">
                        <Plus className="h-4 w-4" />
                        Add event
                      </span>
                    </SectionChip>
                    <SectionChip tone="danger" onClick={() => removeTicketListing(activeTicket.id)}>
                      Remove current
                    </SectionChip>
                  </div>
                </div>

                <div className="mb-4 flex flex-wrap gap-2">
                  {ticketListings.map((listing) => (
                    <SectionChip
                      key={listing.id}
                      active={activeTicketId === listing.id}
                      onClick={() => {
                        setActiveTicketId(listing.id);
                        setSelectedTableId(listing.tables[0]?.id ?? 0);
                      }}
                    >
                      {listing.title}
                    </SectionChip>
                  ))}
                </div>

                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  <TextField
                    label="Listing title"
                    value={activeTicket.title}
                    onChange={(v) =>
                      setTicketListings((curr) => curr.map((x) => (x.id === activeTicket.id ? { ...x, title: v } : x)))
                    }
                  />
                  <TextField
                    label="Event name"
                    value={activeTicket.eventName}
                    onChange={(v) =>
                      setTicketListings((curr) => curr.map((x) => (x.id === activeTicket.id ? { ...x, eventName: v } : x)))
                    }
                  />
                  <TextField
                    label="Venue"
                    value={activeTicket.venue}
                    onChange={(v) =>
                      setTicketListings((curr) => curr.map((x) => (x.id === activeTicket.id ? { ...x, venue: v } : x)))
                    }
                  />
                  <NumberField
                    label="Ticket price"
                    value={getDraft(`tk-price-${activeTicket.id}`, activeTicket.price)}
                    onChange={(v) =>
                      applyDraft(`tk-price-${activeTicket.id}`, v, (n) =>
                        setTicketListings((curr) => curr.map((x) => (x.id === activeTicket.id ? { ...x, price: n } : x)))
                      )
                    }
                  />
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  {(['quantity', 'seats', 'tables'] as TicketMode[]).map((mode) => (
                    <SectionChip
                      key={mode}
                      active={activeTicket.mode === mode}
                      onClick={() =>
                        setTicketListings((curr) => curr.map((x) => (x.id === activeTicket.id ? { ...x, mode } : x)))
                      }
                    >
                      {mode}
                    </SectionChip>
                  ))}
                </div>

                {activeTicket.mode === 'seats' && (
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <NumberField
                      label="Rows"
                      value={getDraft(`tk-rows-${activeTicket.id}`, activeTicket.rows)}
                      onChange={(v) =>
                        applyDraft(`tk-rows-${activeTicket.id}`, v, (n) =>
                          setTicketListings((curr) => curr.map((x) => (x.id === activeTicket.id ? { ...x, rows: n } : x)))
                        )
                      }
                    />
                    <NumberField
                      label="Seats per row"
                      value={getDraft(`tk-seats-${activeTicket.id}`, activeTicket.seatsPerRow)}
                      onChange={(v) =>
                        applyDraft(`tk-seats-${activeTicket.id}`, v, (n) =>
                          setTicketListings((curr) =>
                            curr.map((x) => (x.id === activeTicket.id ? { ...x, seatsPerRow: n } : x))
                          )
                        )
                      }
                    />
                  </div>
                )}

                {activeTicket.mode === 'tables' && (
                  <div className="mt-4 rounded-[24px] border border-white/10 bg-slate-950/60 p-4">
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                      <div className="font-semibold">Tables</div>
                      <SectionChip onClick={addTable}>
                        <span className="inline-flex items-center gap-2">
                          <Plus className="h-4 w-4" />
                          Add table
                        </span>
                      </SectionChip>
                    </div>
                    <div className="space-y-3">
                      {activeTicket.tables.map((tb) => (
                        <div key={tb.id} className="grid gap-3 rounded-2xl border border-white/10 bg-slate-950/70 p-3 md:grid-cols-[1fr_140px_140px]">
                          <TextField
                            label="Table name"
                            value={tb.name}
                            onChange={(v) =>
                              setTicketListings((curr) =>
                                curr.map((listing) =>
                                  listing.id === activeTicket.id
                                    ? {
                                        ...listing,
                                        tables: listing.tables.map((table) =>
                                          table.id === tb.id ? { ...table, name: v } : table
                                        ),
                                      }
                                    : listing
                                )
                              )
                            }
                          />
                          <NumberField
                            label="Seats"
                            value={getDraft(`tb-seats-${tb.id}`, tb.seats)}
                            onChange={(v) =>
                              applyDraft(`tb-seats-${tb.id}`, v, (n) =>
                                setTicketListings((curr) =>
                                  curr.map((listing) =>
                                    listing.id === activeTicket.id
                                      ? {
                                          ...listing,
                                          tables: listing.tables.map((table) =>
                                            table.id === tb.id ? { ...table, seats: n } : table
                                          ),
                                        }
                                      : listing
                                  )
                                )
                              )
                            }
                          />
                          <SummaryBox>
                            <div className="text-xs uppercase tracking-[0.14em] text-slate-500">Available seats</div>
                            <div className="mt-1 font-semibold text-white">{Math.max(tb.seats - tb.sold, 0)}</div>
                          </SummaryBox>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </PremiumCard>
            )}

            <div
              className="overflow-hidden rounded-[28px] border border-white/10 shadow-[0_20px_80px_rgba(2,6,23,0.45)]"
              style={{ backgroundImage: `url(${activeTicket.background})`, backgroundSize: 'cover', backgroundPosition: 'center' }}
            >
              <div className="bg-slate-950/75 p-6 backdrop-blur-[2px]">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h2 className="text-2xl font-semibold">{activeTicket.title}</h2>
                  <div className="text-slate-200">{formatMoney(activeTicket.price)} each</div>
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-3">
                  <SummaryBox>
                    <div className="text-xs uppercase tracking-[0.14em] text-slate-500">Event</div>
                    <div className="mt-1 font-semibold">{activeTicket.eventName}</div>
                  </SummaryBox>
                  <SummaryBox>
                    <div className="text-xs uppercase tracking-[0.14em] text-slate-500">Venue</div>
                    <div className="mt-1 font-semibold">{activeTicket.venue}</div>
                  </SummaryBox>
                  <SummaryBox>
                    <div className="text-xs uppercase tracking-[0.14em] text-slate-500">Mode</div>
                    <div className="mt-1 font-semibold">{activeTicket.mode}</div>
                  </SummaryBox>
                </div>

                {activeTicket.mode === 'tables' && (
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    {activeTicket.tables.map((tb) => (
                      <button
                        key={tb.id}
                        type="button"
                        onClick={() => setSelectedTableId(tb.id)}
                        className={`rounded-[22px] border p-4 text-left transition ${
                          selectedTableId === tb.id ? 'border-sky-300/45 bg-white/12' : 'border-white/10 bg-slate-950/55'
                        }`}
                      >
                        <div className="font-semibold">{tb.name}</div>
                        <div className="mt-1 text-sm text-slate-400">
                          {Math.max(tb.seats - tb.sold, 0)} available of {tb.seats}
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                {activeTicket.mode === 'seats' && (
                  <div className="mt-4 grid gap-2" style={{ gridTemplateColumns: `repeat(${activeTicket.seatsPerRow}, minmax(0, 1fr))` }}>
                    {Array.from({ length: activeTicket.rows * activeTicket.seatsPerRow }).map((_, idx) => (
                      <div key={idx} className="rounded-xl border border-white/10 bg-slate-950/60 p-2 text-center text-xs">
                        {String.fromCharCode(65 + Math.floor(idx / activeTicket.seatsPerRow))}
                        {(idx % activeTicket.seatsPerRow) + 1}
                      </div>
                    ))}
                  </div>
                )}

                <div className="mt-4">
                  <NumberField label="Quantity" value={ticketQty} onChange={setTicketQty} />
                </div>

                <SummaryBox className="mt-4">
                  <div className="flex justify-between">
                    <span>Quantity</span>
                    <span>{ticketQuantity || '—'}</span>
                  </div>
                  {activeTicket.mode === 'tables' && selectedTable && (
                    <>
                      <div className="mt-2 flex justify-between">
                        <span>Table</span>
                        <span>{selectedTable.name}</span>
                      </div>
                      <div className="mt-2 flex justify-between">
                        <span>Available seats</span>
                        <span>{tableAvailable}</span>
                      </div>
                    </>
                  )}
                  <div className="mt-2 flex justify-between">
                    <span>Total</span>
                    <span>{formatMoney(ticketTotal)}</span>
                  </div>
                </SummaryBox>

                <button
                  type="button"
                  onClick={() => void buyTickets()}
                  disabled={
                    !buyerName.trim() ||
                    !buyerEmail.trim() ||
                    ticketQuantity <= 0 ||
                    hasBlankNumbers ||
                    (activeTicket.mode === 'tables' && !!selectedTable && ticketQuantity > tableAvailable)
                  }
                  className="mt-4 w-full rounded-2xl bg-white px-4 py-3 font-semibold text-slate-950 shadow-[0_14px_36px_rgba(255,255,255,0.14)] transition hover:bg-slate-100 disabled:opacity-50"
                >
                  Pay for tickets + export PDF
                </button>
              </div>
            </div>
          </>
        )}

        {section === 'raffle' && (
          <>
            {isAdminView && (
              <PremiumCard>
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <h2 className="text-2xl font-semibold">Admin: Raffle setup</h2>
                  <div className="flex flex-wrap gap-2">
                    <SectionChip onClick={addRaffleListing}>
                      <span className="inline-flex items-center gap-2">
                        <Plus className="h-4 w-4" />
                        Add raffle
                      </span>
                    </SectionChip>
                    <SectionChip onClick={addBatch}>
                      <span className="inline-flex items-center gap-2">
                        <Plus className="h-4 w-4" />
                        Add colour
                      </span>
                    </SectionChip>
                    <SectionChip tone="danger" onClick={() => removeRaffleListing(activeRaffle.id)}>
                      Remove current
                    </SectionChip>
                  </div>
                </div>

                <div className="mb-4 flex flex-wrap gap-2">
                  {raffleListings.map((listing) => (
                    <SectionChip key={listing.id} active={activeRaffleId === listing.id} onClick={() => setActiveRaffleId(listing.id)}>
                      {listing.title}
                    </SectionChip>
                  ))}
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <TextField
                    label="Listing title"
                    value={activeRaffle.title}
                    onChange={(v) =>
                      setRaffleListings((curr) => curr.map((x) => (x.id === activeRaffle.id ? { ...x, title: v } : x)))
                    }
                  />
                  <TextField
                    label="Prize"
                    value={activeRaffle.prize}
                    onChange={(v) =>
                      setRaffleListings((curr) => curr.map((x) => (x.id === activeRaffle.id ? { ...x, prize: v } : x)))
                    }
                  />
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {activeRaffle.batches.map((batch) => (
                    <div key={batch.id} className="rounded-[24px] border border-white/10 bg-slate-950/60 p-4">
                      <div className="grid gap-3">
                        <TextField
                          label="Colour"
                          value={batch.color}
                          onChange={(v) =>
                            setRaffleListings((curr) =>
                              curr.map((listing) =>
                                listing.id === activeRaffle.id
                                  ? {
                                      ...listing,
                                      batches: listing.batches.map((b) => (b.id === batch.id ? { ...b, color: v } : b)),
                                    }
                                  : listing
                              )
                            )
                          }
                        />
                        <NumberField
                          label="Total tickets"
                          value={getDraft(`rf-count-${batch.id}`, batch.count)}
                          onChange={(v) =>
                            applyDraft(`rf-count-${batch.id}`, v, (n) =>
                              setRaffleListings((curr) =>
                                curr.map((listing) =>
                                  listing.id === activeRaffle.id
                                    ? {
                                        ...listing,
                                        batches: listing.batches.map((b) =>
                                          b.id === batch.id ? { ...b, count: clamp(n, 1, 5000) } : b
                                        ),
                                      }
                                    : listing
                                )
                              )
                            )
                          }
                        />
                        <NumberField
                          label="Single ticket price"
                          value={getDraft(`rf-price-${batch.id}`, batch.price)}
                          onChange={(v) =>
                            applyDraft(`rf-price-${batch.id}`, v, (n) =>
                              setRaffleListings((curr) =>
                                curr.map((listing) =>
                                  listing.id === activeRaffle.id
                                    ? {
                                        ...listing,
                                        batches: listing.batches.map((b) => (b.id === batch.id ? { ...b, price: n } : b)),
                                      }
                                    : listing
                                )
                              )
                            )
                          }
                        />
                        <SectionChip onClick={() => addRule(batch.id)}>Add offer</SectionChip>

                        {batch.rules.map((rule) => (
                          <div key={rule.id} className="grid gap-3 rounded-2xl border border-white/10 bg-slate-950/70 p-3 md:grid-cols-2">
                            <NumberField
                              label="Bundle qty"
                              value={getDraft(`rule-qty-${rule.id}`, rule.qty)}
                              onChange={(v) =>
                                applyDraft(`rule-qty-${rule.id}`, v, (n) =>
                                  setRaffleListings((curr) =>
                                    curr.map((listing) =>
                                      listing.id === activeRaffle.id
                                        ? {
                                            ...listing,
                                            batches: listing.batches.map((b) =>
                                              b.id === batch.id
                                                ? {
                                                    ...b,
                                                    rules: b.rules.map((r) => (r.id === rule.id ? { ...r, qty: n } : r)),
                                                  }
                                                : b
                                            ),
                                          }
                                        : listing
                                    )
                                  )
                                )
                              }
                            />
                            <NumberField
                              label="Bundle price"
                              value={getDraft(`rule-price-${rule.id}`, rule.price)}
                              onChange={(v) =>
                                applyDraft(`rule-price-${rule.id}`, v, (n) =>
                                  setRaffleListings((curr) =>
                                    curr.map((listing) =>
                                      listing.id === activeRaffle.id
                                        ? {
                                            ...listing,
                                            batches: listing.batches.map((b) =>
                                              b.id === batch.id
                                                ? {
                                                    ...b,
                                                    rules: b.rules.map((r) => (r.id === rule.id ? { ...r, price: n } : r)),
                                                  }
                                                : b
                                            ),
                                          }
                                        : listing
                                    )
                                  )
                                )
                              }
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </PremiumCard>
            )}

            <div
              className="overflow-hidden rounded-[28px] border border-white/10 shadow-[0_20px_80px_rgba(2,6,23,0.45)]"
              style={{ backgroundImage: `url(${activeRaffle.background})`, backgroundSize: 'cover', backgroundPosition: 'center' }}
            >
              <div className="bg-slate-950/75 p-6 backdrop-blur-[2px]">
                <h2 className="text-2xl font-semibold">{activeRaffle.title}</h2>
                <p className="mt-2 text-sm text-slate-300">Prize: {activeRaffle.prize}</p>

                <div className="mt-4 grid gap-3 md:grid-cols-3">
                  {activeRaffle.batches.map((batch) => (
                    <SummaryBox key={batch.id}>
                      <div className="font-semibold">{batch.color}</div>
                      <div className="mt-1 text-sm text-slate-400">
                        {batch.count - batch.sold.length} available of {batch.count}
                      </div>
                    </SummaryBox>
                  ))}
                </div>

                <div className="mt-4 space-y-4">
                  {raffleChoices.map((choice, idx) => (
                    <div
                      key={choice.id}
                      className="grid gap-3 rounded-[24px] border border-white/10 bg-slate-950/55 p-4 md:grid-cols-[1fr_120px_90px]"
                    >
                      <div>
                        <label className="mb-1.5 block text-xs font-medium uppercase tracking-[0.14em] text-slate-400">
                          Colour {idx + 1}
                        </label>
                        <select
                          value={choice.color}
                          onChange={(e) => updateChoice(choice.id, { color: e.target.value })}
                          className="w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-white"
                        >
                          {activeRaffle.batches.map((batch) => (
                            <option key={batch.id} value={batch.color}>
                              {batch.color}
                            </option>
                          ))}
                        </select>
                      </div>
                      <NumberField label="Count" value={choice.qty} onChange={(v) => updateChoice(choice.id, { qty: v })} />
                      <div className="flex items-end">
                        <button
                          type="button"
                          onClick={() => removeChoice(choice.id)}
                          className="w-full rounded-2xl border border-rose-400/30 bg-rose-400/10 px-3 py-3 text-sm text-rose-200 transition hover:bg-rose-400/15"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}

                  <SectionChip onClick={addChoice}>
                    <span className="inline-flex items-center gap-2">
                      <Plus className="h-4 w-4" />
                      Add colour
                    </span>
                  </SectionChip>

                  <SummaryBox>
                    <div className="flex justify-between">
                      <span>Total tickets</span>
                      <span>{raffleTotalQty || '—'}</span>
                    </div>
                    <div className="mt-2 text-xs text-slate-400">
                      Discounts apply across any combination of colours when the total ticket count reaches a bundle offer.
                    </div>
                    <div className="mt-2 flex justify-between">
                      <span>Total</span>
                      <span>{formatMoney(raffleTotal)}</span>
                    </div>
                  </SummaryBox>

                  <button
                    type="button"
                    onClick={() => void buyRaffle()}
                    disabled={!canRaffleBuy}
                    className="w-full rounded-2xl bg-white px-4 py-3 font-semibold text-slate-950 shadow-[0_14px_36px_rgba(255,255,255,0.14)] transition hover:bg-slate-100 disabled:opacity-50"
                  >
                    Complete purchase + export PDF
                  </button>

                  {raffleHasBlankQty && (
                    <div className="text-xs text-amber-300">Blank counts are allowed while editing, but not for checkout.</div>
                  )}
                  {raffleHasInvalid && (
                    <div className="text-xs text-rose-300">One or more colours exceed available tickets.</div>
                  )}
                </div>
              </div>
            </div>

            <PremiumCard>
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-semibold">Overall Raffle Draw</h2>
                <SectionChip onClick={drawWinner}>
                  <span className="inline-flex items-center gap-2">
                    <Shuffle className="h-4 w-4" />
                    Draw winner
                  </span>
                </SectionChip>
              </div>
              {winner ? (
                <div className="mt-4 rounded-[24px] border border-emerald-400/30 bg-emerald-400/10 p-4">
                  <div className="font-semibold">Winner</div>
                  <div className="mt-1">{winner}</div>
                </div>
              ) : (
                <div className="mt-4 text-sm text-slate-400">No winner drawn yet.</div>
              )}
            </PremiumCard>
          </>
        )}

        <PremiumCard>
          <div className="flex items-center gap-2 text-lg font-semibold">
            <Download className="h-5 w-5 text-sky-300" />
            Buyer PDF receipts
          </div>
          <p className="mt-2 text-sm text-slate-300">
            Every completed squares, tickets, and raffle purchase exports a buyer receipt PDF.
          </p>
        </PremiumCard>

        <AdminPurchaseData
          show={isAdminView}
          tab={adminTab}
          setTab={setAdminTab}
          squareOrders={squareOrders}
          ticketOrders={ticketOrders}
          raffleOrders={raffleOrders}
        />
      </div>
    </div>
  );
}
