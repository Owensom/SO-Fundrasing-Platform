"use client";

import { useEffect, useMemo, useState } from "react";

type Props = {
  slug: string;
};

type RafflePrize = {
  position: number;
  title: string;
  description: string;
  isPublic: boolean;
};

type RaffleWinner = {
  prizePosition: number;
  ticketNumber: number;
  colour: string | null;
  buyerName: string | null;
  drawnAt: string | null;
};

type SafeRaffle = {
  id: string;
  slug: string;
  title: string;
  description: string;
  imageUrl: string;
  currency: string;
  ticketPrice: number;
  status: string;
  startNumber: number;
  endNumber: number;
  prizes: RafflePrize[];
  winners: RaffleWinner[];
};

function ordinal(n: number) {
  if (n % 10 === 1 && n % 100 !== 11) return `${n}st`;
  if (n % 10 === 2 && n % 100 !== 12) return `${n}nd`;
  if (n % 10 === 3 && n % 100 !== 13) return `${n}rd`;
  return `${n}th`;
}

function formatCurrency(value: number, currency: string) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency,
  }).format(value || 0);
}

function toSafeRaffle(raw: any): SafeRaffle {
  const prizes = Array.isArray(raw?.prizes) ? raw.prizes : [];
  const winners = Array.isArray(raw?.winners) ? raw.winners : [];

  return {
    id: String(raw?.id ?? ""),
    slug: String(raw?.slug ?? ""),
    title: String(raw?.title ?? ""),
    description: String(raw?.description ?? ""),
    imageUrl: String(raw?.imageUrl ?? ""),
    currency: String(raw?.currency ?? "GBP"),
    ticketPrice: Number(raw?.ticketPrice ?? 0),
    status: String(raw?.status ?? "draft"),
    startNumber: Number(raw?.startNumber ?? 1),
    endNumber: Number(raw?.endNumber ?? 1),

    prizes: prizes
      .map((p: any, i: number) => ({
        position: Number(p?.position ?? i + 1),
        title: String(p?.title ?? ""),
        description: String(p?.description ?? ""),
        isPublic: p?.isPublic !== false,
      }))
      .filter((p: RafflePrize) => p.title.trim().length > 0),

    winners: winners.map((w: any) => ({
      prizePosition: Number(w.prizePosition ?? w.prize_position ?? 1),
      ticketNumber: Number(w.ticketNumber ?? w.ticket_number ?? 0),
      colour: w.colour ?? null,
      buyerName: w.buyerName ?? w.buyer_name ?? null,
      drawnAt: w.drawnAt ?? w.drawn_at ?? null,
    })),
  };
}

export default function PublicRafflePage({ slug }: Props) {
  const [raffle, setRaffle] = useState<SafeRaffle | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const res = await fetch(`/api/raffles/${slug}`);
      const data = await res.json();
      setRaffle(toSafeRaffle(data?.raffle));
      setLoading(false);
    }
    load();
  }, [slug]);

  if (loading) return <div style={styles.wrap}>Loading…</div>;
  if (!raffle) return <div style={styles.wrap}>Not found</div>;

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <h1>{raffle.title}</h1>
        <p>{raffle.description}</p>

        <div style={styles.totalBox}>
          <div>Ticket price: {formatCurrency(raffle.ticketPrice, raffle.currency)}</div>
          <div>Range: {raffle.startNumber} to {raffle.endNumber}</div>
          <div>Status: {raffle.status}</div>
        </div>

        {/* PRIZES */}
        {raffle.prizes.length > 0 && (
          <section style={styles.prizesBox}>
            <div style={styles.prizesTitle}>Prizes</div>

            {raffle.prizes.map((prize) => (
              <div key={prize.position} style={styles.prizeCard}>
                <div style={styles.prizePosition}>
                  {ordinal(prize.position)}
                </div>

                <div>
                  <div style={styles.prizeTitle}>{prize.title}</div>
                  {prize.description && (
                    <div style={styles.prizeDescription}>
                      {prize.description}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </section>
        )}

        {/* WINNERS */}
        {raffle.winners.length > 0 && (
          <section style={styles.winnersBox}>
            <div style={styles.winnersTitle}>Winners</div>

            {raffle.winners.map((winner) => (
              <div key={winner.ticketNumber} style={styles.winnerCard}>
                <div>{ordinal(winner.prizePosition)}</div>
                <div>#{winner.ticketNumber}</div>
                <div>{winner.colour || "—"}</div>
              </div>
            ))}
          </section>
        )}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    padding: 24,
    background: "#f8fafc",
    minHeight: "100vh",
  },
  container: {
    maxWidth: 900,
    margin: "0 auto",
    background: "#fff",
    padding: 24,
    borderRadius: 16,
  },
  wrap: { padding: 24 },

  totalBox: {
    marginTop: 20,
    padding: 12,
    border: "1px solid #e2e8f0",
    borderRadius: 10,
  },

  prizesBox: {
    marginTop: 20,
    padding: 16,
    borderRadius: 12,
    background: "#fff7ed",
  },
  prizesTitle: {
    fontSize: 20,
    fontWeight: 800,
    marginBottom: 10,
  },
  prizeCard: {
    display: "grid",
    gridTemplateColumns: "80px 1fr",
    gap: 10,
    padding: 10,
    border: "1px solid #fed7aa",
    borderRadius: 10,
    marginBottom: 8,
  },
  prizePosition: {
    fontWeight: 800,
  },
  prizeTitle: {
    fontWeight: 700,
  },
  prizeDescription: {
    fontSize: 14,
    color: "#64748b",
  },

  winnersBox: {
    marginTop: 20,
    padding: 16,
    borderRadius: 12,
    background: "#ecfdf5",
  },
  winnersTitle: {
    fontSize: 20,
    fontWeight: 800,
    marginBottom: 10,
  },
  winnerCard: {
    display: "grid",
    gridTemplateColumns: "80px 1fr 1fr",
    gap: 10,
    padding: 10,
    border: "1px solid #bbf7d0",
    borderRadius: 10,
    marginBottom: 8,
  },
};
