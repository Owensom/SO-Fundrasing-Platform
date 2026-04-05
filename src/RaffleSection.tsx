import React from 'react';
import { Plus, Shuffle } from 'lucide-react';
import { Choice, RaffleListing } from '../types';
import { formatMoney } from '../utils';
import { NumberField, PremiumCard, SectionChip, SummaryBox, TextField } from './ui';

export function RaffleSection(props: {
  isAdminView: boolean;
  raffle: RaffleListing;
  raffleListings: RaffleListing[];
  activeRaffleId: number;
  raffleChoices: Choice[];
  raffleAllocation: Array<{ id: number; color: string; qty: string; numbers: number[]; available: number; valid: boolean }>;
  raffleTotalQty: number;
  raffleTotal: number;
  raffleHasBlankQty: boolean;
  raffleHasInvalid: boolean;
  canRaffleBuy: boolean;
  winner: string;
  getDraft: (key: string, fallback: number) => string;
  setActiveRaffleId: (id: number) => void;
  addRaffleListing: () => void;
  removeRaffleListing: (id: number) => void;
  addBatch: () => void;
  addRule: (batchId: number) => void;
  updateChoice: (id: number, patch: Partial<Choice>) => void;
  addChoice: () => void;
  removeChoice: (id: number) => void;
  buyRaffle: () => Promise<void>;
  drawWinner: () => void;
  setRaffleListings: React.Dispatch<React.SetStateAction<RaffleListing[]>>;
  applyDraft: (key: string, value: string, onValid: (n: number) => void) => void;
}) {
  const {
    isAdminView, raffle, raffleListings, activeRaffleId, raffleChoices, raffleTotalQty, raffleTotal,
    raffleHasBlankQty, raffleHasInvalid, canRaffleBuy, winner, getDraft, setActiveRaffleId,
    addRaffleListing, removeRaffleListing, addBatch, addRule, updateChoice, addChoice, removeChoice,
    buyRaffle, drawWinner, setRaffleListings, applyDraft,
  } = props;

  return (
    <>
      {isAdminView && (
        <PremiumCard>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-2xl font-semibold">Admin: Raffle setup</h2>
            <div className="flex gap-2">
              <SectionChip onClick={addRaffleListing}><span className="inline-flex items-center gap-2"><Plus className="h-4 w-4" />Add raffle</span></SectionChip>
              <SectionChip onClick={addBatch}><span className="inline-flex items-center gap-2"><Plus className="h-4 w-4" />Add colour</span></SectionChip>
              <SectionChip onClick={() => removeRaffleListing(raffle.id)}>Remove current</SectionChip>
            </div>
          </div>
          <div className="mb-4 flex flex-wrap gap-2">
            {raffleListings.map((l) => (
              <SectionChip key={l.id} active={activeRaffleId === l.id} onClick={() => setActiveRaffleId(l.id)}>
                {l.title}
              </SectionChip>
            ))}
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <TextField label="Listing title" value={raffle.title} onChange={(v) => setRaffleListings((curr) => curr.map((x) => x.id === raffle.id ? { ...x, title: v } : x))} />
            <TextField label="Prize" value={raffle.prize} onChange={(v) => setRaffleListings((curr) => curr.map((x) => x.id === raffle.id ? { ...x, prize: v } : x))} />
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {raffle.batches.map((b) => (
              <div key={b.id} className="rounded-[24px] border border-white/10 bg-slate-950/60 p-4">
                <div className="grid gap-3">
                  <TextField label="Colour" value={b.color} onChange={(v) => setRaffleListings((curr) => curr.map((x) => x.id === raffle.id ? { ...x, batches: x.batches.map((q) => q.id === b.id ? { ...q, color: v } : q) } : x))} />
                  <NumberField label="Total tickets" value={getDraft(`rf-count-${b.id}`, b.count)} onChange={(v) => applyDraft(`rf-count-${b.id}`, v, (n) => setRaffleListings((curr) => curr.map((x) => x.id === raffle.id ? { ...x, batches: x.batches.map((q) => q.id === b.id ? { ...q, count: n } : q) } : x))))} />
                  <NumberField label="Single ticket price" value={getDraft(`rf-price-${b.id}`, b.price)} onChange={(v) => applyDraft(`rf-price-${b.id}`, v, (n) => setRaffleListings((curr) => curr.map((x) => x.id === raffle.id ? { ...x, batches: x.batches.map((q) => q.id === b.id ? { ...q, price: n } : q) } : x))))} />
                  <SectionChip onClick={() => addRule(b.id)}>Add offer</SectionChip>
                  {b.rules.map((r) => (
                    <div key={r.id} className="grid gap-3 rounded-2xl border border-white/10 bg-slate-950/70 p-3 md:grid-cols-2">
                      <NumberField label="Bundle qty" value={getDraft(`rule-qty-${r.id}`, r.qty)} onChange={(v) => applyDraft(`rule-qty-${r.id}`, v, (n) => setRaffleListings((curr) => curr.map((x) => x.id === raffle.id ? { ...x, batches: x.batches.map((q) => q.id === b.id ? { ...q, rules: q.rules.map((z) => z.id === r.id ? { ...z, qty: n } : z) } : q) } : x))))} />
                      <NumberField label="Bundle price" value={getDraft(`rule-price-${r.id}`, r.price)} onChange={(v) => applyDraft(`rule-price-${r.id}`, v, (n) => setRaffleListings((curr) => curr.map((x) => x.id === raffle.id ? { ...x, batches: x.batches.map((q) => q.id === b.id ? { ...q, rules: q.rules.map((z) => z.id === r.id ? { ...z, price: n } : z) } : q) } : x))))} />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </PremiumCard>
      )}

      <div className="overflow-hidden rounded-[28px] border border-white/10 shadow-[0_20px_80px_rgba(2,6,23,0.45)]" style={{ backgroundImage: `url(${raffle.background})`, backgroundSize: 'cover', backgroundPosition: 'center' }}>
        <div className="bg-slate-950/75 p-6 backdrop-blur-[2px]">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-semibold">{raffle.title}</h2>
              <p className="mt-2 text-sm text-slate-300">Prize: {raffle.prize}</p>
            </div>
            <SectionChip onClick={drawWinner}><span className="inline-flex items-center gap-2"><Shuffle className="h-4 w-4" />Draw winner</span></SectionChip>
          </div>
          {winner && <div className="mt-4 rounded-[24px] border border-emerald-400/30 bg-emerald-400/10 p-4"><div className="font-semibold">Winner</div><div className="mt-1">{winner}</div></div>}
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            {raffle.batches.map((b) => (
              <div key={b.id} className="rounded-[24px] border border-white/10 bg-slate-950/55 p-4 shadow-[0_14px_36px_rgba(2,6,23,0.22)]">
                <div className="font-semibold">{b.color}</div>
                <div className="mt-1 text-sm text-slate-400">{b.count - b.sold.length} available of {b.count}</div>
              </div>
            ))}
          </div>
          <div className="mt-4 space-y-4">
            {raffleChoices.map((choice, i) => (
              <div key={choice.id} className="grid gap-3 rounded-[24px] border border-white/10 bg-slate-950/55 p-4 md:grid-cols-[1fr_120px_90px]">
                <div>
                  <label className="mb-1.5 block text-xs font-medium uppercase tracking-[0.14em] text-slate-400">Colour {i + 1}</label>
                  <select value={choice.color} onChange={(e) => updateChoice(choice.id, { color: e.target.value })} className="w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-white">
                    <option value="">Select</option>
                    {raffle.batches.map((b) => <option key={b.id} value={b.color}>{b.color}</option>)}
                  </select>
                </div>
                <NumberField label="Count" value={choice.qty} onChange={(v) => updateChoice(choice.id, { qty: v })} />
                <div className="flex items-end">
                  <button onClick={() => removeChoice(choice.id)} className="w-full rounded-2xl border border-rose-400/30 bg-rose-400/10 px-3 py-3 text-sm text-rose-200 transition hover:bg-rose-400/15">
                    Remove
                  </button>
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
    </>
  );
}
