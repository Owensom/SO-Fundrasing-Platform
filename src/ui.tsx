import React from 'react';
import { parsePositiveInt } from '../utils';

export function PremiumCard({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-[28px] border border-white/10 bg-white/[0.07] p-6 shadow-[0_20px_80px_rgba(2,6,23,0.45)] backdrop-blur-xl ${className}`}>
      {children}
    </div>
  );
}

export function SectionChip({
  active,
  onClick,
  children,
}: {
  active?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
}) {
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

export function TextField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
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

export function NumberField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
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

export function SummaryBox({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-[24px] border border-white/10 bg-slate-950/65 p-4 text-sm shadow-[0_14px_36px_rgba(2,6,23,0.22)] ${className}`}>
      {children}
    </div>
  );
}
