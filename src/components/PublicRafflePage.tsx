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
          <div>Range: {raffle.startNumber} - {raffle.endNumber}</div>
        </div>

        {/* PRIZES */}
        {raffle.prizes.length > 0 && (
          <section style={styles.prizesBox}>
            <div style={styles.prizesTitle}>Prizes</div>

            <div style={{ display: "grid", gap: 10 }}>
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
            </div>
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
    maxWidth: 800,
    margin: "0 auto",
    background: "#fff",
    padding: 24,
    borderRadius: 16,
  },
  wrap: {
    padding: 24,
  },
  totalBox: {
    marginTop: 20,
    padding: 12,
    border: "1px solid #e2e8f0",
    borderRadius: 10,
  },
  prizesBox: {
    marginTop: 24,
    padding: 18,
    borderRadius: 16,
    background: "#fff7ed",
    border: "1px solid #fed7aa",
  },
  prizesTitle: {
    fontSize: 22,
    fontWeight: 800,
    marginBottom: 12,
    color: "#9a3412",
  },
  prizeCard: {
    display: "grid",
    gridTemplateColumns: "80px 1fr",
    gap: 12,
    padding: 12,
    border: "1px solid #fed7aa",
    borderRadius: 12,
    background: "#fff",
  },
  prizePosition: {
    fontSize: 20,
    fontWeight: 800,
    color: "#c2410c",
  },
  prizeTitle: {
    fontSize: 16,
    fontWeight: 800,
  },
  prizeDescription: {
    fontSize: 14,
    color: "#64748b",
    marginTop: 4,
  },
};
