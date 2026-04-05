import React, { useState } from 'react';
import { TicketListing } from '../types';
import { formatMoney } from '../utils';
import { PremiumCard, SummaryBox } from './ui';

export function TicketsSection({
  ticket,
  buyerName,
  buyerEmail,
  hasBlankNumbers,
  buyTickets,
}: {
  ticket: TicketListing;
  buyerName: string;
  buyerEmail: string;
  hasBlankNumbers: boolean;
  buyTickets: () => Promise<void>;
}) {
  const [selectedSeats, setSelectedSeats] = useState<string[]>([]);

  function toggleSeat(seat: string) {
    setSelectedSeats((curr) =>
      curr.includes(seat)
        ? curr.filter((s) => s !== seat)
        : [...curr, seat]
    );
  }

  const total = selectedSeats.length * ticket.price;

  return (
    <div>
      <PremiumCard>
        <h2 className="text-2xl font-semibold">{ticket.title}</h2>

        <div
          className="mt-4 grid gap-2"
          style={{
            gridTemplateColumns: `repeat(${ticket.seatsPerRow}, minmax(0, 1fr))`,
          }}
        >
          {Array.from({ length: ticket.rows * ticket.seatsPerRow }).map((_, i) => {
            const row = String.fromCharCode(65 + Math.floor(i / ticket.seatsPerRow));
            const num = (i % ticket.seatsPerRow) + 1;
            const seatId = `${row}${num}`;
            const selected = selectedSeats.includes(seatId);

            return (
              <button
                key={seatId}
                onClick={() => toggleSeat(seatId)}
                className={`rounded-xl border p-2 text-xs ${
                  selected
                    ? 'bg-white text-black'
                    : 'bg-slate-800 text-white'
                }`}
              >
                {seatId}
              </button>
            );
          })}
        </div>

        <SummaryBox className="mt-4">
          <div>Seats: {selectedSeats.join(', ') || 'None'}</div>
          <div>Total: {formatMoney(total)}</div>
        </SummaryBox>

        <button
          onClick={() => void buyTickets()}
          disabled={
            !buyerName.trim() ||
            !buyerEmail.trim() ||
            selectedSeats.length === 0 ||
            hasBlankNumbers
          }
          className="mt-4 w-full bg-white text-black p-3 rounded-xl"
        >
          Buy Seats
        </button>
      </PremiumCard>
    </div>
  );
}
