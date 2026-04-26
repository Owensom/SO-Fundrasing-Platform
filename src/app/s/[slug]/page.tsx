"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type SquaresGame = {
  id: string;
  slug: string;
  title: string;
  description?: string;
  imageUrl?: string;
  size: number;
};

type Props = {
  params: { slug: string; tenantSlug: string };
};

export default function PublicSquaresPage({ params }: Props) {
  const { slug, tenantSlug } = params;
  const [game, setGame] = useState<SquaresGame | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError("");
      try {
        const res = await fetch(`/api/public/squares/${slug}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || "Failed to load squares game");
        setGame(data.game ?? null);
      } catch (err: any) {
        setError(err.message || "Failed to load squares game");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [slug]);

  if (loading) return <div style={{ padding: 16 }}>Loading…</div>;
  if (error) return <div style={{ padding: 16, color: "red" }}>{error}</div>;
  if (!game) return <div style={{ padding: 16 }}>Squares game not found.</div>;

  return (
    <div style={{ maxWidth: 900, margin: "40px auto", padding: 16 }}>
      <Link href={`/c/${tenantSlug}`} style={{ display: "inline-block", marginBottom: 16, color: "#2563eb" }}>
        ← Back to all campaigns
      </Link>

      <h1>{game.title}</h1>
      {game.imageUrl && (
        <img
          src={game.imageUrl}
          alt={game.title}
          style={{ width: "100%", maxHeight: 360, objectFit: "cover", borderRadius: 16, marginBottom: 20 }}
        />
      )}
      {game.description && <p>{game.description}</p>}
      <div>Grid size: {game.size} × {game.size}</div>
    </div>
  );
}
