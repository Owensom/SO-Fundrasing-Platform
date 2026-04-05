import React from 'react';
import { Plus } from 'lucide-react';
import { TicketListing } from '../types';
import { formatMoney } from '../utils';
import { NumberField, PremiumCard, SectionChip, SummaryBox, TextField } from './ui';

export function TicketsSection(props: {
  isAdminView: boolean;
  ticket: TicketListing;
  ticketListings: TicketListing[];
  activeTicketId: number;
  selectedTableId: number;
  ticketQty: string;
  ticketQuantity: number;
  selectedTable?: TicketListing['tables'][number];
  hasBlankNumbers: boolean;
  buyerName: string;
  buyerEmail: string;
  getDraft: (key: string, fallback: number) => string;
  setActiveTicketId: (id: number) => void;
  setSelectedTableId: (id: number) => void;
  setTicketQty: (v: string) => void;
  addTicketListing: () => void;
  removeTicketListing: (id: number) => void;
  addTable: () => void;
  buyTickets: () => Promise<void>;
  setTicketListings: React.Dispatch<React.SetStateAction<TicketListing[]>>;
  applyDraft: (key: string, value: string, onValid: (n: number) => void) => void;
}) {
  const {
    isAdminView, ticket, ticketListings, activeTicketId, selectedTableId, ticketQty, ticketQuantity, selectedTable,
    hasBlankNumbers, buyerName, buyerEmail, getDraft, setActiveTicketId, setSelectedTableId, setTicketQty,
    addTicketListing, removeTicketListing, addTable, buyTickets, setTicketListings, applyDraft,
  } = props;
  const tableAvailable = selectedTable ? Math.max(selectedTable.seats - selectedTable.sold, 0) : 0;

  return (
    <>
      {isAdminView && (
        <PremiumCard>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-2xl font-semibold">Admin: Event setup</h2>
            <div className="flex gap-2">
              <SectionChip onClick={addTicketListing}><span className="inline-flex items-center gap-2"><Plus className="h-4 w-4" />Add event</span></SectionChip>
              <SectionChip onClick={() => removeTicketListing(ticket.id)}>Remove current</SectionChip>
            </div>
          </div>
          <div className="mb-4 flex flex-wrap gap-2">
            {ticketListings.map((l) => (
              <SectionChip key={l.id} active={activeTicketId === l.id} onClick={() => { setActiveTicketId(l.id); setSelectedTableId(l.tables[0]?.id ?? 0); }}>
                {l.title}
              </SectionChip>
            ))}
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <TextField label="Listing title" value={ticket.title} onChange={(v) => setTicketListings((curr) => curr.map((x) => x.id === ticket.id ? { ...x, title: v } : x))} />
            <TextField label="Event name" value={ticket.eventName} onChange={(v) => setTicketListings((curr) => curr.map((x) => x.id === ticket.id ? { ...x, eventName: v } : x))} />
            <TextField label="Venue" value={ticket.venue} onChange={(v) => setTicketListings((curr) => curr.map((x) => x.id === ticket.id ? { ...x, venue: v } : x))} />
            <NumberField label="Ticket price" value={getDraft(`tk-price-${ticket.id}`, ticket.price)} onChange={(v) => applyDraft(`tk-price-${ticket.id}`, v, (n) => setTicketListings((curr) => curr.map((x) => x.id === ticket.id ? { ...x, price: n } : x))))} />
          </div>
          <div className="mt-4 flex gap-2">
            {(['quantity', 'seats', 'tables'] as const).map((m) => (
              <SectionChip key={m} active={ticket.mode === m} onClick={() => setTicketListings((curr) => curr.map((x) => x.id === ticket.id ? { ...x, mode: m } : x))}>
                {m}
              </SectionChip>
            ))}
          </div>
          {ticket.mode === 'seats' && (
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <NumberField label="Rows" value={getDraft(`tk-rows-${ticket.id}`, ticket.rows)} onChange={(v) => applyDraft(`tk-rows-${ticket.id}`, v, (n) => setTicketListings((curr) => curr.map((x) => x.id === ticket.id ? { ...x, rows: n } : x))))} />
              <NumberField label="Seats per row" value={getDraft(`tk-seats-${ticket.id}`, ticket.seatsPerRow)} onChange={(v) => applyDraft(`tk-seats-${ticket.id}`, v, (n) => setTicketListings((curr) => curr.map((x) => x.id === ticket.id ? { ...x, seatsPerRow: n } : x))))} />
            </div>
          )}
          {ticket.mode === 'tables' && (
            <div className="mt-4 rounded-[24px] border border-white/10 bg-slate-950/60 p-4">
              <div className="mb-3 flex items-center justify-between">
                <div className="font-semibold">Tables</div>
                <SectionChip onClick={addTable}><span className="inline-flex items-center gap-2"><Plus className="h-4 w-4" />Add table</span></SectionChip>
              </div>
              <div className="space-y-3">
                {ticket.tables.map((tb) => (
                  <div key={tb.id} className="grid gap-3 rounded-2xl border border-white/10 bg-slate-950/70 p-3 md:grid-cols-[1fr_110px_110px]">
                    <TextField label="Table name" value={tb.name} onChange={(v) => setTicketListings((curr) => curr.map((x) => x.id === ticket.id ? { ...x, tables: x.tables.map((t) => t.id === tb.id ? { ...t, name: v } : t) } : x))} />
                    <NumberField label="Seats" value={getDraft(`tb-seats-${tb.id}`, tb.seats)} onChange={(v) => applyDraft(`tb-seats-${tb.id}`, v, (n) => setTicketListings((curr) => curr.map((x) => x.id === ticket.id ? { ...x, tables: x.tables.map((t) => t.id === tb.id ? { ...t, seats: n } : t) } : x))))} />
                    <div className="rounded-2xl border border-white/10 bg-slate-950/80 p-3.5">
                      <div className="text-xs uppercase tracking-[0.14em] text-slate-500">Available</div>
                      <div className="mt-1 font-semibold">{Math.max(tb.seats - tb.sold, 0)}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </PremiumCard>
      )}

      <div className="overflow-hidden rounded-[28px] border border-white/10 shadow-[0_20px_80px_rgba(2,6,23,0.45)]" style={{ backgroundImage: `url(${ticket.background})`, backgroundSize: 'cover', backgroundPosition: 'center' }}>
        <div className="bg-slate-950/75 p-6 backdrop-blur-[2px]">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-semibold">{ticket.title}</h2>
            <div className="text-slate-200">{formatMoney(ticket.price)} each</div>
          </div>
          {ticket.mode === 'tables' && (
            <div className="mt-4 grid gap-3 md:grid-cols-2">
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
          <div className="mt-4"><NumberField label="Quantity" value={ticketQty} onChange={setTicketQty} /></div>
          <SummaryBox className="mt-4">
            <div className="flex justify-between"><span>Quantity</span><span>{ticketQuantity || '—'}</span></div>
            {ticket.mode === 'tables' && selectedTable && <>
              <div className="mt-2 flex justify-between"><span>Table</span><span>{selectedTable.name}</span></div>
              <div className="mt-2 flex justify-between"><span>Available seats</span><span>{tableAvailable}</span></div>
            </>}
            <div className="mt-2 flex justify-between"><span>Total</span><span>{formatMoney(ticketQuantity * ticket.price)}</span></div>
          </SummaryBox>
          <button
            onClick={() => void buyTickets()}
            disabled={!buyerName.trim() || !buyerEmail.trim() || ticketQuantity <= 0 || hasBlankNumbers || (ticket.mode === 'tables' && selectedTable && ticketQuantity > tableAvailable)}
            className="mt-4 w-full rounded-2xl bg-white px-4 py-3 font-semibold text-slate-950 shadow-[0_14px_36px_rgba(255,255,255,0.14)] transition hover:bg-slate-100 disabled:opacity-50"
          >
            Pay for tickets + export PDF
          </button>
        </div>
      </div>
    </>
  );
}
