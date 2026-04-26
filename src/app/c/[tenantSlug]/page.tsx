"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";

type Props = {
  slug: string;
  tenantSlug: string;
};

export default function PublicRafflePage({ slug, tenantSlug }: Props) {
  const router = useRouter();
  const [raffle, setRaffle] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!slug) return;

    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        setError("");

        const res = await fetch(`/api/raffles/${encodeURIComponent(slug)}`);
        const data = await res.json();

        if (!res.ok || !data.ok) {
          throw new Error(data?.error || "Failed to load raffle");
        }

        if (!cancelled) setRaffle(data.raffle);
      } catch (err: any) {
        if (!cancelled) setError(err?.message || "Failed to load raffle");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  if (loading) return <div style={{ padding: 24 }}>Loading raffle…</div>;
  if (error) return <div style={{ padding: 24 }}>Error: {error}</div>;
  if (!raffle) return <div style={{ padding: 24 }}>Raffle not found.</div>;

  return (
    <div style={{ maxWidth: 900, margin: "40px auto", padding: 16 }}>
      {/* Back button to campaign page */}
      <button
        onClick={() => router.push(`/c/${tenantSlug}`)}
        style={{
          marginBottom: 24,
          padding: "8px 16px",
          borderRadius: 8,
          border: "1px solid #cbd5e1",
          background: "#f8fafc",
          fontWeight: 700,
          cursor: "pointer",
        }}
      >
        ← Back to campaigns
      </button>

      {raffle.imageUrl ? (
        <img
          src={raffle.imageUrl}
          alt={raffle.title}
          style={{ width: "100%", height: 300, objectFit: "cover", borderRadius: 16, marginBottom: 20 }}
        />
      ) : null}

      <h1>{raffle.title}</h1>
      {raffle.description ? <p>{raffle.description}</p> : null}

      {/* Render prizes if available */}
      {raffle.prizes?.length > 0 && (
        <section style={{ marginTop: 20, padding: 16, border: "1px solid #fed7aa", borderRadius: 12, background: "#fff7ed" }}>
          <h2>Prizes</h2>
          <ul>
            {raffle.prizes.map((p: any, index: number) => (
              <li key={index}>
                {p.position}. {p.title} {p.description ? `– ${p.description}` : ""}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Reserved tickets, basket, or other purchase flow can go here */}
      {/* …existing raffle ticket selection and checkout logic… */}
    </div>
  );
}
