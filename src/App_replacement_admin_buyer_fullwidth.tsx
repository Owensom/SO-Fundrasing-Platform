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
  available: number;
  valid: boolean;
};

const squareBg =
  'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?auto=format&fit=crop&w=1400&q=80';
const ticketBg =
  'https://images.unsplash.com/photo-1511578314322-379afb476865?auto=format&fit=crop&w=1400&q=80';
const raffleBg =
  'https://images.unsplash.com/photo-1517457373958-b7bdd4587205?auto=format&fit=crop&w=1400&q=80';

const squaresSeed: SquaresListing[] = [
  { id: 1, title: 'Super Bowl Squares', totalSquares: 100, price: 10, background: squareBg, sold: [3, 8, 14], reserved: [5, 11] },
  { id: 2, title: 'World Cup Final Squares', totalSquares: 100, price: 5, background: squareBg, sold: [1, 7], reserved: [4, 15] },
];

const ticketsSeed: TicketListing[] = [
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
  {
    id: 2,
    title: 'Comedy Night',
    eventName: 'Comedy Night',
    venue: 'City Theatre',
    price: 20,
    mode: 'seats',
    background: ticketBg,
    rows: 5,
    seatsPerRow: 12,
    tables: [],
  },
];

const rafflesSeed: RaffleListing[] = [
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
  {
    id: 2,
    title: 'Christmas Draw',
    prize: 'Luxury food basket',
    background: raffleBg,
    batches: [
      { id: 201, color: 'Red', count: 200, sold: [2, 6], price: 2, rules: [{ id: 2001, qty: 5, price: 8 }] },
      { id: 202, color: 'Green', count: 200, sold: [1, 4], price: 2, rules: [{ id: 2002, qty: 5, price: 8 }] },
    ],
  },
];

function parsePositiveInt(v: string): number | undefined {
  const trimmed = v.trim();
  if (!trimmed) return undefined;
  const n = Number(trimmed);
  if (!Number.isFinite(n) || n < 1) return undefined;
  return Math.floor(n);
}

function formatMoney(value: number): string {
  return `£${value.toFixed(2)}`;
}

function availableNumbers(batch: Batch, extra: Set<number>): number[] {
  const taken = new Set([...batch.sold, ...extra]);
  const out: number[] = [];
  for (let i = 1; i <= batch.count; i += 1) if (!taken.has(i)) out.push(i);
  return out;
}

function seededPick(items: number[], count: number, seed: number): number[] {
  const arr = [...items];
  let s = seed || 1;
  const rand = () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr.slice(0, count).sort((a, b) => a - b);
}

function bundlePrice(batch: Batch | undefined, qty: number): number {
  if (!batch || qty <= 0) return 0;
  const rules = [...batch.rules].sort((a, b) => b.qty - a.qty);
  let remaining = qty;
  let total = 0;
  for (const rule of rules) {
    if (rule.qty < 1) continue;
    const bundles = Math.floor(remaining / rule.qty);
    if (bundles > 0) {
      total += bundles * rule.price;
      remaining -= bundles * rule.qty;
    }
  }
  return total + remaining * batch.price;
}

async function exportReceipt(title: string, buyer: string, email: string, lines: string[], total: number): Promise<void> {
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
    <div className={`rounded-[28px] border border-white/10 bg-white/[0.07] p-6 shadow-[0_20px_80px_rgba(2,6,23,0.45)] backdrop-blur-xl ${className}`}>
      {children}
    </div>
  );
}

function SectionChip({ active, onClick, children }: { active?: boolean; onClick?: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-2xl border px-4 py-2.5 text-sm font-medium transition ${
        active
          ? 'border-sky-300/45 bg-white/12 text-white shadow-[0_12px_40px_rgba(56,189,248,0.18)]'
          : 'border-white/10 bg-white/[0.04] text-slate-300 hover:bg-white/[0.08]'
      }`}
    >
      {children}
    </button>
  );
}

function TextField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium uppercase tracking-[0.14em] text-slate-400">{label}</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-white shadow-inner outline-none transition focus:border-sky-300/40"
      />
    </div>
  );
}

function NumberField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const invalid = value !== '' && parsePositiveInt(value) === undefined;
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium uppercase tracking-[0.14em] text-slate-400">{label}</label>
      <input
        type="number"
        min={1}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`w-full rounded-2xl border px-4 py-3 text-white shadow-inner outline-none transition ${
          invalid ? 'border-rose-400/50 bg-rose-950/20' : 'border-white/10 bg-slate-950/80 focus:border-sky-300/40'
        }`}
      />
      <div className="mt-1.5 text-[11px] text-slate-500">Blank allowed while editing, not for completion.</div>
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

function AdminDataPanel({
  tab,
  setTab,
  squareOrders,
  ticketOrders,
  raffleOrders,
}: {
  tab: AdminTab;
  setTab: (t: AdminTab) => void;
  squareOrders: Order[];
  ticketOrders: Order[];
  raffleOrders: Order[];
}) {
  const map = { squares: squareOrders, tickets: ticketOrders, raffle: raffleOrders };
  return (
    <div className="mt-6 border-t border-white/10 pt-6">
      <div className="mb-4 flex items-center gap-2 text-lg font-semibold">
        <Database className="h-5 w-5 text-sky-300" />
        Admin purchase data
      </div>
      <div className="mb-4 grid gap-2 md:grid-cols-3">
        {(['squares', 'tickets', 'raffle'] as AdminTab[]).map((t) => (
          <SectionChip key={t} active={tab === t} onClick={() => setTab(t)}>
            {t}
          </SectionChip>
        ))}
      </div>
      <div className="space-y-3">
        {map[tab].length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-4 text-sm text-slate-400">No purchases recorded yet.</div>
        ) : (
          map[tab].map((order) => (
            <div key={order.id} className="rounded-3xl border border-white/10 bg-slate-950/55 p-4 shadow-[0_14px_36px_rgba(2,6,23,0.22)]">
              <div className="mb-1 text-xs uppercase tracking-[0.14em] text-slate-500">{order.listing}</div>
              <div className="mb-2 flex justify-between">
                <div className="font-semibold text-white">{order.buyer}</div>
                <div className="text-sm text-slate-200">{formatMoney(order.total)}</div>
              </div>
              <div className="mb-2 text-sm text-slate-300">{order.email}</div>
              <div className="grid gap-1 text-sm text-slate-300">
                {order.lines.map((line, i) => (
                  <div key={i}>{line}</div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default function App() {
  const [section, setSection] = useState<Section>('squares');
  const [isAdminView, setIsAdminView] = useState(true);
  const [adminTab, setAdminTab] = useState<AdminTab>('raffle');
  const [buyerName, setBuyerName] = useState('Jamie Carter');
  const [buyerEmail, setBuyerEmail] = useState('jamie@example.com');
  const [squareListings, setSquareListings] = useState<SquaresListing[]>(squaresSeed);
  const [ticketListings, setTicketListings] = useState<TicketListing[]>(ticketsSeed);
  const [raffleListings, setRaffleListings] = useState<RaffleListing[]>(rafflesSeed);
  const [activeSquareId, setActiveSquareId] = useState(1);
  const [activeTicketId, setActiveTicketId] = useState(1);
  const [activeRaffleId, setActiveRaffleId] = useState(1);
  const [selectedSquaresByListing, setSelectedSquaresByListing] = useState<Record<number, number[]>>({ 1: [1, 2, 12], 2: [6, 18] });
  const [ticketQty, setTicketQty] = useState('2');
  const [selectedTableId, setSelectedTableId] = useState(11);
  const [choicesByRaffle, setChoicesByRaffle] = useState<Record<number, Choice[]>>({
    1: [
      { id: 1, color: 'Pink', qty: '2' },
      { id: 2, color: 'Blue', qty: '' },
    ],
    2: [{ id: 3, color: 'Red', qty: '3' }],
  });
  const [drafts, setDrafts] = useState<Drafts>({});
  const [squareOrders, setSquareOrders] = useState<Order[]>([]);
  const [ticketOrders, setTicketOrders] = useState<Order[]>([]);
  const [raffleOrders, setRaffleOrders] = useState<Order[]>([]);
  const [winner, setWinner] = useState('');
  const imageRef = useRef<HTMLInputElement | null>(null);

  const square = squareListings.find((x) => x.id === activeSquareId) ?? squareListings[0];
  const ticket = ticketListings.find((x) => x.id === activeTicketId) ?? ticketListings[0];
  const raffle = raffleListings.find((x) => x.id === activeRaffleId) ?? raffleListings[0];
  const selectedSquares = selectedSquaresByListing[square.id] ?? [];
  const selectedTable = ticket.tables.find((t) => t.id === selectedTableId) ?? ticket.tables[0];
  const ticketQuantity = parsePositiveInt(ticketQty) ?? 0;
  const raffleChoices = choicesByRaffle[raffle.id] ?? [];

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

  const hasBlankNumbers = numericKeys.some((k) => drafts[k] === '');
  const getDraft = (key: string, fallback: number) => drafts[key] ?? String(fallback);
  const applyDraft = (key: string, value: string, onValid: (n: number) => void) => {
    setDrafts((curr) => ({ ...curr, [key]: value }));
    const parsed = parsePositiveInt(value);
    if (parsed !== undefined) onValid(parsed);
  };

  const raffleAllocation: AllocationRow[] = useMemo(() => {
    const usedByColor = new Map<string, Set<number>>();
    return raffleChoices.map((choice, idx) => {
      const batch = raffle.batches.find((b) => b.color === choice.color);
      const wanted = parsePositiveInt(choice.qty) ?? 0;
      if (!batch) {
        return { id: choice.id, color: choice.color, qty: choice.qty, numbers: [], available: 0, valid: false };
      }
      const extra = usedByColor.get(choice.color) ?? new Set<number>();
      const avail = availableNumbers(batch, extra);
      const numbers = seededPick(avail, Math.min(wanted, avail.length), raffle.id * 100 + idx + 7);
      numbers.forEach((n) => extra.add(n));
      usedByColor.set(choice.color, extra);
      return {
        id: choice.id,
        color: choice.color,
        qty: choice.qty,
        numbers,
        available: avail.length,
        valid: choice.qty.trim() !== '' && wanted > 0 && wanted <= avail.length,
      };
    });
  }, [raffleChoices, raffle]);

  const raffleTotalQty = raffleAllocation.reduce((sum, row) => sum + row.numbers.length, 0);
  const raffleTotal = bundlePrice(raffle.batches[0], raffleTotalQty);
  const raffleHasBlankQty = raffleChoices.some((c) => c.qty.trim() === '');
  const raffleHasInvalid = raffleAllocation.some((a) => !a.valid && a.qty.trim() !== '');
  const canRaffleBuy = !!buyerName.trim() && !!buyerEmail.trim() && raffleTotalQty > 0 && !raffleHasBlankQty && !raffleHasInvalid && !hasBlankNumbers;

  function addSquareListing() {
    const id = Date.now();
    setSquareListings((curr) => [
      ...curr,
      { id, title: `New Squares ${curr.length + 1}`, totalSquares: 100, price: 10, background: squareBg, sold: [], reserved: [] },
    ]);
    setActiveSquareId(id);
  }

  function removeSquareListing(id: number) {
    setSquareListings((curr) => {
      if (curr.length <= 1) return curr;
      const next = curr.filter((x) => x.id !== id);
      if (activeSquareId === id && next.length) setActiveSquareId(next[0].id);
      return next;
    });
    setSelectedSquaresByListing((curr) => {
      const next = { ...curr };
      delete next[id];
      return next;
    });
  }

  function addTicketListing() {
    const id = Date.now();
    const tableId = id + 1;
    setTicketListings((curr) => [
      ...curr,
      { id, title: `New Event ${curr.length + 1}`, eventName: 'New Event', venue: 'Venue', price: 25, mode: 'tables', background: ticketBg, rows: 6, seatsPerRow: 10, tables: [{ id: tableId, name: 'Table A', seats: 8, sold: 0 }] },
    ]);
    setActiveTicketId(id);
    setSelectedTableId(tableId);
  }

  function removeTicketListing(id: number) {
    setTicketListings((curr) => {
      if (curr.length <= 1) return curr;
      const next = curr.filter((x) => x.id !== id);
      if (activeTicketId === id && next.length) {
        setActiveTicketId(next[0].id);
        setSelectedTableId(next[0].tables[0]?.id ?? 0);
      }
      return next;
    });
  }

  function addRaffleListing() {
    const id = Date.now();
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
    setActiveRaffleId(id);
    setChoicesByRaffle((curr) => ({ ...curr, [id]: [{ id: id + 3, color: 'New colour', qty: '' }] }));
  }

  function removeRaffleListing(id: number) {
    setRaffleListings((curr) => {
      if (curr.length <= 1) return curr;
      const next = curr.filter((x) => x.id !== id);
      if (activeRaffleId === id && next.length) setActiveRaffleId(next[0].id);
      return next;
    });
    setChoicesByRaffle((curr) => {
      const next = { ...curr };
      delete next[id];
      return next;
    });
  }

  function addTable() {
    const id = Date.now();
    setTicketListings((curr) => curr.map((x) => (x.id === ticket.id ? { ...x, tables: [...x.tables, { id, name: `Table ${String.fromCharCode(65 + x.tables.length)}`, seats: 8, sold: 0 }] } : x)));
  }

  function addBatch() {
    const id = Date.now();
    setRaffleListings((curr) => curr.map((x) => (x.id === raffle.id ? { ...x, batches: [...x.batches, { id, color: `New colour ${x.batches.length + 1}`, count: 100, sold: [], price: 3, rules: [{ id: id + 1, qty: 5, price: 10 }] }] } : x)));
  }

  function addRule(batchId: number) {
    const id = Date.now();
    setRaffleListings((curr) => curr.map((x) => (x.id === raffle.id ? { ...x, batches: x.batches.map((b) => (b.id === batchId ? { ...b, rules: [...b.rules, { id, qty: 5, price: 10 }] } : b)) } : x)));
  }

  function uploadImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const src = String(reader.result || '');
      if (section === 'squares') setSquareListings((curr) => curr.map((x) => (x.id === square.id ? { ...x, background: src } : x)));
      if (section === 'tickets') setTicketListings((curr) => curr.map((x) => (x.id === ticket.id ? { ...x, background: src } : x)));
      if (section === 'raffle') setRaffleListings((curr) => curr.map((x) => (x.id === raffle.id ? { ...x, background: src } : x)));
    };
    reader.readAsDataURL(file);
  }

  function toggleSquare(n: number) {
    if (square.sold.includes(n) || square.reserved.includes(n)) return;
    setSelectedSquaresByListing((curr) => {
      const existing = curr[square.id] ?? [];
      const next = existing.includes(n) ? existing.filter((x) => x !== n) : [...existing, n].sort((a, b) => a - b);
      return { ...curr, [square.id]: next };
    });
  }

  async function buySquares() {
    if (!buyerName.trim() || !buyerEmail.trim() || selectedSquares.length === 0 || hasBlankNumbers) return;
    const total = selectedSquares.length * square.price;
    const lines = [`Squares: ${selectedSquares.join(', ')}`, `Quantity: ${selectedSquares.length}`, `Price each: ${formatMoney(square.price)}`];
    setSquareOrders((curr) => [{ id: Date.now(), listing: square.title, buyer: buyerName, email: buyerEmail, lines, total }, ...curr]);
    await exportReceipt(square.title, buyerName, buyerEmail, lines, total);
  }

  async function buyTickets() {
    if (!buyerName.trim() || !buyerEmail.trim() || ticketQuantity <= 0 || hasBlankNumbers) return;
    if (ticket.mode === 'tables' && selectedTable && ticketQuantity > Math.max(selectedTable.seats - selectedTable.sold, 0)) return;
    const reference = ticket.mode === 'tables' && selectedTable ? selectedTable.name : ticket.mode === 'seats' ? 'Seat selection' : 'General admission';
    const total = ticketQuantity * ticket.price;
    const lines = [`Event: ${ticket.eventName}`, `Mode: ${ticket.mode}`, `Reference: ${reference}`, `Quantity: ${ticketQuantity}`, `Price each: ${formatMoney(ticket.price)}`];
    setTicketOrders((curr) => [{ id: Date.now(), listing: ticket.title, buyer: buyerName, email: buyerEmail, lines, total }, ...curr]);
    await exportReceipt(ticket.title, buyerName, buyerEmail, lines, total);
  }

  function updateChoice(id: number, patch: Partial<Choice>) {
    setChoicesByRaffle((curr) => ({ ...curr, [raffle.id]: (curr[raffle.id] ?? []).map((x) => (x.id === id ? { ...x, ...patch } : x)) }));
  }

  function addChoice() {
    setChoicesByRaffle((curr) => ({ ...curr, [raffle.id]: [...(curr[raffle.id] ?? []), { id: Date.now(), color: raffle.batches[0]?.color ?? 'Pink', qty: '' }] }));
  }

  function removeChoice(id: number) {
    setChoicesByRaffle((curr) => ({ ...curr, [raffle.id]: (curr[raffle.id] ?? []).filter((x) => x.id !== id) }));
  }

  async function buyRaffle() {
    if (!canRaffleBuy) return;
    const tickets = raffleAllocation.flatMap((row) => row.numbers.map((n) => `${row.color} #${n}`));
    setRaffleOrders((curr) => [{ id: Date.now(), listing: raffle.title, buyer: buyerName, email: buyerEmail, lines: tickets, total: raffleTotal }, ...curr]);
    setRaffleListings((curr) => curr.map((x) => (x.id === raffle.id ? { ...x, batches: x.batches.map((b) => {
      const nums = raffleAllocation.filter((a) => a.color === b.color).flatMap((a) => a.numbers);
      return nums.length ? { ...b, sold: [...b.sold, ...nums].sort((a, z) => a - z) } : b;
    }) } : x)));
    await exportReceipt(raffle.title, buyerName, buyerEmail, tickets, raffleTotal);
  }

  function drawWinner() {
    const pool = raffle.batches.flatMap((b) => b.sold.map((n) => `${b.color} #${n}`));
    if (!pool.length) return;
    setWinner(pool[Math.floor(Math.random() * pool.length)]);
  }

  const squaresTotal = selectedSquares.length * square.price;
  const ticketTotal = ticketQuantity * ticket.price;
  const tableAvailable = selectedTable ? Math.max(selectedTable.seats - selectedTable.sold, 0) : 0;

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.14),_transparent_28%),radial-gradient(circle_at_right,_rgba(168,85,247,0.12),_transparent_22%),linear-gradient(180deg,_#020617_0%,_#0f172a_48%,_#020617_100%)] p-6 text-white">
      <div className="mx-auto max-w-7xl space-y-6">
        <input ref={imageRef} type="file" accept="image/*" className="hidden" onChange={uploadImage} />

        <PremiumCard>
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.08] px-3 py-1 text-xs uppercase tracking-[0.2em] text-sky-200">
                <Sparkles className="h-3.5 w-3.5" />
                Premium fundraising suite
              </div>
              <h1 className="text-4xl font-semibold tracking-tight">SO Fundraising Platform</h1>
              <p className="mt-2 max-w-2xl text-slate-300">Admin tools are grouped into one complete section for each part of the app, and buyer view is now full width for a clearer real-customer preview.</p>
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
          {(['squares', 'tickets', 'raffle'] as Section[]).map((s) => (
            <SectionChip key={s} active={section === s} onClick={() => setSection(s)}>
              <span className="inline-flex items-center gap-2">
                {s === 'squares' ? <Grid3X3 className="h-4 w-4" /> : s === 'tickets' ? <Ticket className="h-4 w-4" /> : <Trophy className="h-4 w-4" />}
                {s[0].toUpperCase() + s.slice(1)}
              </span>
            </SectionChip>
          ))}
        </div>

        {isAdminView && (
          <PremiumCard>
            <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-2xl font-semibold">Admin: {section === 'squares' ? 'Squares setup' : section === 'tickets' ? 'Event setup' : 'Raffle setup'}</h2>
                <p className="mt-1 text-sm text-slate-400">All admin actions for this section are grouped here. Toggle admin view off to see the cleaner buyer view.</p>
              </div>
              <SectionChip onClick={() => imageRef.current?.click()}>
                <span className="inline-flex items-center gap-2"><ImageIcon className="h-4 w-4" />Background image</span>
              </SectionChip>
            </div>

            {section === 'squares' && (
              <>
                <div className="mb-4 flex flex-wrap gap-2">
                  <SectionChip onClick={addSquareListing}><span className="inline-flex items-center gap-2"><Plus className="h-4 w-4" />Add squares game</span></SectionChip>
                  <SectionChip onClick={() => removeSquareListing(square.id)}>Remove current</SectionChip>
                </div>
                <div className="mb-4 flex flex-wrap gap-2">
                  {squareListings.map((l) => (
                    <SectionChip key={l.id} active={activeSquareId === l.id} onClick={() => setActiveSquareId(l.id)}>{l.title}</SectionChip>
                  ))}
                </div>
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  <TextField label="Game title" value={square.title} onChange={(v) => setSquareListings((curr) => curr.map((x) => (x.id === square.id ? { ...x, title: v } : x)))} />
                  <NumberField label="Price per square" value={getDraft(`sq-price-${square.id}`, square.price)} onChange={(v) => applyDraft(`sq-price-${square.id}`, v, (n) => setSquareListings((curr) => curr.map((x) => (x.id === square.id ? { ...x, price: n } : x))))} />
                  <NumberField
                    label="Squares to sell"
                    value={getDraft(`sq-total-${square.id}`, square.totalSquares)}
                    onChange={(v) =>
                      applyDraft(`sq-total-${square.id}`, v, (n) => {
                        const safeTotal = Math.min(n, 500);
                        setSquareListings((curr) =>
                          curr.map((x) =>
                            x.id === square.id
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
                          [square.id]: (curr[square.id] || []).filter((num) => num <= safeTotal),
                        }));
                      })
                    }
                  />
                </div>
                <AdminDataPanel tab={adminTab} setTab={setAdminTab} squareOrders={squareOrders} ticketOrders={ticketOrders} raffleOrders={raffleOrders} />
              </>
            )}

            {section === 'tickets' && (
              <>
                <div className="mb-4 flex flex-wrap gap-2">
                  <SectionChip onClick={addTicketListing}><span className="inline-flex items-center gap-2"><Plus className="h-4 w-4" />Add event</span></SectionChip>
                  <SectionChip onClick={() => removeTicketListing(ticket.id)}>Remove current</SectionChip>
                  <SectionChip onClick={addTable}><span className="inline-flex items-center gap-2"><Plus className="h-4 w-4" />Add table</span></SectionChip>
                </div>
                <div className="mb-4 flex flex-wrap gap-2">
                  {ticketListings.map((l) => (
                    <SectionChip key={l.id} active={activeTicketId === l.id} onClick={() => { setActiveTicketId(l.id); setSelectedTableId(l.tables[0]?.id ?? 0); }}>{l.title}</SectionChip>
                  ))}
                </div>
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  <TextField label="Listing title" value={ticket.title} onChange={(v) => setTicketListings((curr) => curr.map((x) => (x.id === ticket.id ? { ...x, title: v } : x)))} />
                  <TextField label="Event name" value={ticket.eventName} onChange={(v) => setTicketListings((curr) => curr.map((x) => (x.id === ticket.id ? { ...x, eventName: v } : x)))} />
                  <TextField label="Venue" value={ticket.venue} onChange={(v) => setTicketListings((curr) => curr.map((x) => (x.id === ticket.id ? { ...x, venue: v } : x)))} />
                  <NumberField label="Ticket price" value={getDraft(`tk-price-${ticket.id}`, ticket.price)} onChange={(v) => applyDraft(`tk-price-${ticket.id}`, v, (n) => setTicketListings((curr) => curr.map((x) => (x.id === ticket.id ? { ...x, price: n } : x))))} />
                  <NumberField label="Rows" value={getDraft(`tk-rows-${ticket.id}`, ticket.rows)} onChange={(v) => applyDraft(`tk-rows-${ticket.id}`, v, (n) => setTicketListings((curr) => curr.map((x) => (x.id === ticket.id ? { ...x, rows: n } : x))))} />
                  <NumberField label="Seats per row" value={getDraft(`tk-seats-${ticket.id}`, ticket.seatsPerRow)} onChange={(v) => applyDraft(`tk-seats-${ticket.id}`, v, (n) => setTicketListings((curr) => curr.map((x) => (x.id === ticket.id ? { ...x, seatsPerRow: n } : x))))} />
                </div>
                <div className="mt-4 flex gap-2">
                  {(['quantity', 'seats', 'tables'] as TicketMode[]).map((m) => (
                    <SectionChip key={m} active={ticket.mode === m} onClick={() => setTicketListings((curr) => curr.map((x) => (x.id === ticket.id ? { ...x, mode: m } : x)))}>{m}</SectionChip>
                  ))}
                </div>
                {ticket.mode === 'tables' && (
                  <div className="mt-4 space-y-3">
                    {ticket.tables.map((tb) => (
                      <div key={tb.id} className="grid gap-3 rounded-2xl border border-white/10 bg-slate-950/70 p-3 md:grid-cols-[1fr_140px_140px]">
                        <TextField label="Table name" value={tb.name} onChange={(v) => setTicketListings((curr) => curr.map((x) => x.id === ticket.id ? { ...x, tables: x.tables.map((t) => (t.id === tb.id ? { ...t, name: v } : t)) } : x))} />
                        <NumberField label="Seats" value={getDraft(`tb-seats-${tb.id}`, tb.seats)} onChange={(v) => applyDraft(`tb-seats-${tb.id}`, v, (n) => setTicketListings((curr) => curr.map((x) => x.id === ticket.id ? { ...x, tables: x.tables.map((t) => (t.id === tb.id ? { ...t, seats: n } : t)) } : x))))} />
                        <SummaryBox>
                          <div className="text-xs uppercase tracking-[0.14em] text-slate-500">Available</div>
                          <div className="mt-1 font-semibold">{Math.max(tb.seats - tb.sold, 0)}</div>
                        </SummaryBox>
                      </div>
                    ))}
                  </div>
                )}
                <AdminDataPanel tab={adminTab} setTab={setAdminTab} squareOrders={squareOrders} ticketOrders={ticketOrders} raffleOrders={raffleOrders} />
              </>
            )}

            {section === 'raffle' && (
              <>
                <div className="mb-4 flex flex-wrap gap-2">
                  <SectionChip onClick={addRaffleListing}><span className="inline-flex items-center gap-2"><Plus className="h-4 w-4" />Add raffle</span></SectionChip>
                  <SectionChip onClick={addBatch}><span className="inline-flex items-center gap-2"><Plus className="h-4 w-4" />Add colour</span></SectionChip>
                  <SectionChip onClick={() => removeRaffleListing(raffle.id)}>Remove current</SectionChip>
                  <SectionChip onClick={drawWinner}><span className="inline-flex items-center gap-2"><Shuffle className="h-4 w-4" />Draw winner</span></SectionChip>
                </div>
                <div className="mb-4 flex flex-wrap gap-2">
                  {raffleListings.map((l) => (
                    <SectionChip key={l.id} active={activeRaffleId === l.id} onClick={() => setActiveRaffleId(l.id)}>{l.title}</SectionChip>
                  ))}
                </div>
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  <TextField label="Listing title" value={raffle.title} onChange={(v) => setRaffleListings((curr) => curr.map((x) => (x.id === raffle.id ? { ...x, title: v } : x)))} />
                  <TextField label="Prize" value={raffle.prize} onChange={(v) => setRaffleListings((curr) => curr.map((x) => (x.id === raffle.id ? { ...x, prize: v } : x)))} />
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {raffle.batches.map((b) => (
                    <div key={b.id} className="rounded-[24px] border border-white/10 bg-slate-950/60 p-4">
                      <div className="grid gap-3">
                        <TextField label="Colour" value={b.color} onChange={(v) => setRaffleListings((curr) => curr.map((x) => x.id === raffle.id ? { ...x, batches: x.batches.map((q) => (q.id === b.id ? { ...q, color: v } : q)) } : x))} />
                        <NumberField label="Total tickets" value={getDraft(`rf-count-${b.id}`, b.count)} onChange={(v) => applyDraft(`rf-count-${b.id}`, v, (n) => setRaffleListings((curr) => curr.map((x) => x.id === raffle.id ? { ...x, batches: x.batches.map((q) => (q.id === b.id ? { ...q, count: n } : q)) } : x))))} />
                        <NumberField label="Single ticket price" value={getDraft(`rf-price-${b.id}`, b.price)} onChange={(v) => applyDraft(`rf-price-${b.id}`, v, (n) => setRaffleListings((curr) => curr.map((x) => x.id === raffle.id ? { ...x, batches: x.batches.map((q) => (q.id === b.id ? { ...q, price: n } : q)) } : x))))} />
                        <SectionChip onClick={() => addRule(b.id)}>Add offer</SectionChip>
                        {b.rules.map((r) => (
                          <div key={r.id} className="grid gap-3 rounded-2xl border border-white/10 bg-slate-950/70 p-3 md:grid-cols-2">
                            <NumberField label="Bundle qty" value={getDraft(`rule-qty-${r.id}`, r.qty)} onChange={(v) => applyDraft(`rule-qty-${r.id}`, v, (n) => setRaffleListings((curr) => curr.map((x) => x.id === raffle.id ? { ...x, batches: x.batches.map((q) => q.id === b.id ? { ...q, rules: q.rules.map((z) => (z.id === r.id ? { ...z, qty: n } : z)) } : q) } : x))))} />
                            <NumberField label="Bundle price" value={getDraft(`rule-price-${r.id}`, r.price)} onChange={(v) => applyDraft(`rule-price-${r.id}`, v, (n) => setRaffleListings((curr) => curr.map((x) => x.id === raffle.id ? { ...x, batches: x.batches.map((q) => q.id === b.id ? { ...q, rules: q.rules.map((z) => (z.id === r.id ? { ...z, price: n } : z)) } : q) } : x))))} />
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
                {winner && (
                  <div className="mt-6 rounded-[24px] border border-emerald-400/30 bg-emerald-400/10 p-4">
                    <div className="font-semibold">Winner</div>
                    <div className="mt-1">{winner}</div>
                  </div>
                )}
                <AdminDataPanel tab={adminTab} setTab={setAdminTab} squareOrders={squareOrders} ticketOrders={ticketOrders} raffleOrders={raffleOrders} />
              </>
            )}
          </PremiumCard>
        )}

        <PremiumCard>
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-2xl font-semibold">Buyer details</h2>
              <p className="mt-1 text-sm text-slate-400">This section stays full width so you can see clearly what the buyer sees.</p>
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <TextField label="Buyer name" value={buyerName} onChange={setBuyerName} />
            <TextField label="Buyer email" value={buyerEmail} onChange={setBuyerEmail} />
          </div>
        </PremiumCard>

        {section === 'squares' && (
          <div className="overflow-hidden rounded-[28px] border border-white/10 shadow-[0_20px_80px_rgba(2,6,23,0.45)]" style={{ backgroundImage: `url(${square.background})`, backgroundSize: 'cover', backgroundPosition: 'center' }}>
            <div className="bg-slate-950/75 p-6 backdrop-blur-[2px]">
              <h2 className="text-2xl font-semibold">{square.title}</h2>
              <div className="mt-4 grid gap-2" style={{ gridTemplateColumns: 'repeat(10, minmax(0, 1fr))' }}>
                {Array.from({ length: square.totalSquares }).map((_, i) => {
                  const n = i + 1;
                  const style = square.sold.includes(n)
                    ? 'border-rose-400/30 bg-rose-500/20 text-rose-100'
                    : square.reserved.includes(n)
                      ? 'border-amber-400/30 bg-amber-500/20 text-amber-100'
                      : selectedSquares.includes(n)
                        ? 'border-white bg-white text-slate-950 shadow-[0_8px_24px_rgba(255,255,255,0.18)]'
                        : 'border-white/15 bg-slate-900/70';
                  return (
                    <button key={n} type="button" onClick={() => toggleSquare(n)} disabled={square.sold.includes(n) || square.reserved.includes(n)} className={`flex aspect-square items-center justify-center rounded-2xl border text-sm font-semibold transition ${style}`}>
                      {n}
                    </button>
                  );
                })}
              </div>
              <SummaryBox className="mt-4">
                <div className="flex justify-between"><span>Squares selected</span><span>{selectedSquares.length}</span></div>
                <div className="mt-2 text-xs text-slate-400">Numbers: {selectedSquares.join(', ')}</div>
                <div className="mt-2 flex justify-between"><span>Total</span><span>{formatMoney(selectedSquares.length * square.price)}</span></div>
              </SummaryBox>
              <button onClick={() => void buySquares()} disabled={!buyerName.trim() || !buyerEmail.trim() || selectedSquares.length === 0 || hasBlankNumbers} className="mt-4 w-full rounded-2xl bg-white px-4 py-3 font-semibold text-slate-950 shadow-[0_14px_36px_rgba(255,255,255,0.14)] transition hover:bg-slate-100 disabled:opacity-50">
                Pay for squares + export PDF
              </button>
            </div>
          </div>
        )}

        {section === 'tickets' && (
          <div className="overflow-hidden rounded-[28px] border border-white/10 shadow-[0_20px_80px_rgba(2,6,23,0.45)]" style={{ backgroundImage: `url(${ticket.background})`, backgroundSize: 'cover', backgroundPosition: 'center' }}>
            <div className="bg-slate-950/75 p-6 backdrop-blur-[2px]">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-semibold">{ticket.title}</h2>
                <div className="text-slate-200">{formatMoney(ticket.price)} each</div>
              </div>
              <div className="mt-3 grid gap-3 md:grid-cols-3">
                <SummaryBox><div className="text-xs uppercase tracking-[0.14em] text-slate-500">Event</div><div className="mt-1 font-semibold">{ticket.eventName}</div></SummaryBox>
                <SummaryBox><div className="text-xs uppercase tracking-[0.14em] text-slate-500">Venue</div><div className="mt-1 font-semibold">{ticket.venue}</div></SummaryBox>
                <SummaryBox><div className="text-xs uppercase tracking-[0.14em] text-slate-500">Mode</div><div className="mt-1 font-semibold">{ticket.mode}</div></SummaryBox>
              </div>
              {ticket.mode === 'tables' && (
                <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {ticket.tables.map((tb) => (
                    <button key={tb.id} onClick={() => setSelectedTableId(tb.id)} className={`rounded-[22px] border p-4 text-left transition ${selectedTableId === tb.id ? 'border-sky-300/45 bg-white/12' : 'border-white/10 bg-slate-950/55'}`}>
                      <div className="font-semibold">{tb.name}</div>
                      <div className="mt-1 text-sm text-slate-400">{Math.max(tb.seats - tb.sold, 0)} available of {tb.seats}</div>
                    </button>
                  ))}
                </div>
              )}
              {ticket.mode === 'seats' && (
                <div className="mt-4 grid gap-2" style={{ gridTemplateColumns: `repeat(${ticket.seatsPerRow}, minmax(0, 1fr))` }}>
                  {Array.from({ length: ticket.rows * ticket.seatsPerRow }).map((_, i) => (
                    <div key={i} className="rounded-xl border border-white/10 bg-slate-950/60 p-2 text-center text-xs">
                      {String.fromCharCode(65 + Math.floor(i / ticket.seatsPerRow))}{(i % ticket.seatsPerRow) + 1}
                    </div>
                  ))}
                </div>
              )}
              <div className="mt-4 max-w-sm">
                <NumberField label="Quantity" value={ticketQty} onChange={setTicketQty} />
              </div>
              <SummaryBox className="mt-4">
                <div className="flex justify-between"><span>Quantity</span><span>{ticketQuantity || '—'}</span></div>
                {ticket.mode === 'tables' && selectedTable && (
                  <>
                    <div className="mt-2 flex justify-between"><span>Table</span><span>{selectedTable.name}</span></div>
                    <div className="mt-2 flex justify-between"><span>Available seats</span><span>{tableAvailable}</span></div>
                  </>
                )}
                <div className="mt-2 flex justify-between"><span>Total</span><span>{formatMoney(ticketQuantity * ticket.price)}</span></div>
              </SummaryBox>
              <button onClick={() => void buyTickets()} disabled={!buyerName.trim() || !buyerEmail.trim() || ticketQuantity <= 0 || hasBlankNumbers || (ticket.mode === 'tables' && selectedTable && ticketQuantity > tableAvailable)} className="mt-4 w-full rounded-2xl bg-white px-4 py-3 font-semibold text-slate-950 shadow-[0_14px_36px_rgba(255,255,255,0.14)] transition hover:bg-slate-100 disabled:opacity-50">
                Pay for tickets + export PDF
              </button>
            </div>
          </div>
        )}

        {section === 'raffle' && (
          <div className="overflow-hidden rounded-[28px] border border-white/10 shadow-[0_20px_80px_rgba(2,6,23,0.45)]" style={{ backgroundImage: `url(${raffle.background})`, backgroundSize: 'cover', backgroundPosition: 'center' }}>
            <div className="bg-slate-950/75 p-6 backdrop-blur-[2px]">
              <h2 className="text-2xl font-semibold">{raffle.title}</h2>
              <p className="mt-2 text-sm text-slate-300">Prize: {raffle.prize}</p>
              <div className="mt-4 grid gap-3 md:grid-cols-3">
                {raffle.batches.map((b) => (
                  <SummaryBox key={b.id}><div className="font-semibold">{b.color}</div><div className="mt-1 text-sm text-slate-400">{b.count - b.sold.length} available of {b.count}</div></SummaryBox>
                ))}
              </div>
              <div className="mt-4 space-y-4">
                {raffleChoices.map((choice, i) => (
                  <div key={choice.id} className="grid gap-3 rounded-[24px] border border-white/10 bg-slate-950/55 p-4 md:grid-cols-[1fr_140px_100px]">
                    <div>
                      <label className="mb-1.5 block text-xs font-medium uppercase tracking-[0.14em] text-slate-400">Colour {i + 1}</label>
                      <select value={choice.color} onChange={(e) => updateChoice(choice.id, { color: e.target.value })} className="w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-white">
                        <option value="">Select</option>
                        {raffle.batches.map((b) => (
                          <option key={b.id} value={b.color}>{b.color}</option>
                        ))}
                      </select>
                    </div>
                    <NumberField label="Count" value={choice.qty} onChange={(v) => updateChoice(choice.id, { qty: v })} />
                    <div className="flex items-end">
                      <button onClick={() => removeChoice(choice.id)} className="w-full rounded-2xl border border-rose-400/30 bg-rose-400/10 px-3 py-3 text-sm text-rose-200 transition hover:bg-rose-400/15">Remove</button>
                    </div>
                  </div>
                ))}
                <SectionChip onClick={addChoice}><span className="inline-flex items-center gap-2"><Plus className="h-4 w-4" />Add colour</span></SectionChip>
                <SummaryBox>
                  <div className="flex justify-between"><span>Total tickets</span><span>{raffleTotalQty || '—'}</span></div>
                  <div className="mt-2 text-xs text-slate-400">Discounts apply across any combination of colours when the total ticket count reaches a bundle offer.</div>
                  <div className="mt-2 flex justify-between"><span>Total</span><span>{formatMoney(raffleTotal)}</span></div>
                </SummaryBox>
                <button onClick={() => void buyRaffle()} disabled={!canRaffleBuy} className="w-full rounded-2xl bg-white px-4 py-3 font-semibold text-slate-950 shadow-[0_14px_36px_rgba(255,255,255,0.14)] transition hover:bg-slate-100 disabled:opacity-50">
                  Complete purchase + export PDF
                </button>
                {raffleHasBlankQty && <div className="text-xs text-amber-300">Blank counts are allowed while editing, but not for checkout.</div>}
                {raffleHasInvalid && <div className="text-xs text-rose-300">One or more colours exceed available tickets.</div>}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
