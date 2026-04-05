import React from 'react';
import { Plus } from 'lucide-react';
import { SquaresListing } from '../types';
import { formatMoney } from '../utils';
import { NumberField, PremiumCard, SectionChip, SummaryBox, TextField } from './ui';

export function SquaresSection(props: {
  isAdminView: boolean;
  square: SquaresListing;
  squareListings: SquaresListing[];
  activeSquareId: number;
  selectedSquares: number[];
  hasBlankNumbers: boolean;
  buyerName: string;
  buyerEmail: string;
  getDraft: (key: string, fallback: number) => string;
  setActiveSquareId: (id: number) => void;
  addSquareListing: () => void;
  removeSquareListing: (id: number) => void;
  toggleSquare: (n: number) => void;
  buySquares: () => Promise<void>;
  setSquareListings: React.Dispatch<React.SetStateAction<SquaresListing[]>>;
  setSelectedSquaresByListing: React.Dispatch<React.SetStateAction<Record<number, number[]>>>;
  applyDraft: (key: string, value: string, onValid: (n: number) => void) => void;
}) {
  const {
    isAdminView,
    square,
    squareListings,
    activeSquareId,
    selectedSquares,
    hasBlankNumbers,
    buyerName,
    buyerEmail,
    getDraft,
    setActiveSquareId,
    addSquareListing,
    removeSquareListing,
    toggleSquare,
    buySquares,
    setSquareListings,
    setSelectedSquaresByListing,
    applyDraft,
  } = props;

  return (
    <>
      {isAdminView && (
        <PremiumCard>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-2xl font-semibold">Admin: Squares setup</h2>
            <div className="flex gap-2">
              <SectionChip onClick={addSquareListing}>
                <span className="inline-flex items-center gap-2"><Plus className="h-4 w-4" />Add squares game</span>
              </SectionChip>
              <SectionChip onClick={() => removeSquareListing(square.id)}>Remove current</SectionChip>
            </div>
          </div>
          <div className="mb-4 flex flex-wrap gap-2">
            {squareListings.map((l) => (
              <SectionChip key={l.id} active={activeSquareId === l.id} onClick={() => setActiveSquareId(l.id)}>
                {l.title}
              </SectionChip>
            ))}
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <TextField
              label="Game title"
              value={square.title}
              onChange={(v) => setSquareListings((curr) => curr.map((x) => (x.id === square.id ? { ...x, title: v } : x)))}
            />
            <NumberField
              label="Price per square"
              value={getDraft(`sq-price-${square.id}`, square.price)}
              onChange={(v) =>
                applyDraft(`sq-price-${square.id}`, v, (n) =>
                  setSquareListings((curr) => curr.map((x) => (x.id === square.id ? { ...x, price: n } : x))),
                )
              }
            />
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
                        : x,
                    ),
                  );
                  setSelectedSquaresByListing((curr) => ({
                    ...curr,
                    [square.id]: (curr[square.id] || []).filter((num) => num <= safeTotal),
                  }));
                })
              }
            />
          </div>
        </PremiumCard>
      )}

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
                <button
                  key={n}
                  type="button"
                  onClick={() => toggleSquare(n)}
                  disabled={square.sold.includes(n) || square.reserved.includes(n)}
                  className={`flex aspect-square items-center justify-center rounded-2xl border text-sm font-semibold transition ${style}`}
                >
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
          <button
            onClick={() => void buySquares()}
            disabled={!buyerName.trim() || !buyerEmail.trim() || selectedSquares.length === 0 || hasBlankNumbers}
            className="mt-4 w-full rounded-2xl bg-white px-4 py-3 font-semibold text-slate-950 shadow-[0_14px_36px_rgba(255,255,255,0.14)] transition hover:bg-slate-100 disabled:opacity-50"
          >
            Pay for squares + export PDF
          </button>
        </div>
      </div>
    </>
  );
}
