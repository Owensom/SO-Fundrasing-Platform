"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Raffle = {
  id: string;
  slug: string;
  title: string;
  description?: string;
  imageUrl?: string;
  startNumber: number;
  endNumber: number;
};

type Props = {
  params: { slug: string; tenantSlug: string };
};

export default function PublicRafflePage({ params }: Props) {
  const { slug, tenantSlug } = params;
  const [raffle, setRaffle] = useState<Raffle | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError("");
      try {
        const res = await fetch(`/api/public/raffles/${slug}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || "Failed to load raffle");
        setRaffle(data.raffle ?? null);
      } catch (err: any) {
        setError(err.message || "Failed to load raffle");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [slug]);

  if (loading) return <div style={{ padding: 16 }}>Loading…</div>;
  if (error) return <div style={{ padding: 16, color: "red" }}>{error}</div>;
  if (!raffle) return <div style={{ padding: 16 }}>Raffle not found.</div>;

  return (
    <div style={{ maxWidth: 900, margin: "40px auto", padding: 16 }}>
      <Link href={`/c/${tenantSlug}`} style={{ display: "inline-block", marginBottom: 16, color: "#2563eb" }}>
        ← Back to all campaigns
      </Link>

      <h1>{raffle.title}</h1>
      {raffle.imageUrl && (
        <img
          src={raffle.imageUrl}
          alt={raffle.title}
          style={{ width: "100%", maxHeight: 360, objectFit: "cover", borderRadius: 16, marginBottom: 20 }}
        />
      )}
      {raffle.description && <p>{raffle.description}</p>}
      <div>Tickets: {raffle.startNumber} to {raffle.endNumber}</div>
    </div>
  );
}
