import React from 'react';
import { Database } from 'lucide-react';
import { AdminTab, Order } from '../types';
import { formatMoney } from '../utils';
import { PremiumCard, SectionChip } from './ui';

export function AdminPanel({
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
  const map = { squares: squareOrders, tickets: ticketOrders, raffle: raffleOrders };
  return (
    <PremiumCard>
      <div className="mb-4 flex items-center gap-2 text-lg font-semibold">
        <Database className="h-5 w-5 text-sky-300" />
        Admin purchase data
      </div>
      <div className="mb-4 grid grid-cols-3 gap-2">
        {(['squares', 'tickets', 'raffle'] as AdminTab[]).map((t) => (
          <SectionChip key={t} active={tab === t} onClick={() => setTab(t)}>
            {t}
          </SectionChip>
        ))}
      </div>
      <div className="space-y-3">
        {map[tab].length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-4 text-sm text-slate-400">
            No purchases recorded yet.
          </div>
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
    </PremiumCard>
  );
}
