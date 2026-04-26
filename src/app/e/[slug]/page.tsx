"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Event = {
  id: string;
  slug: string;
  title: string;
  description?: string;
  imageUrl?: string;
  date?: string;
};

type Props = {
  params: { slug: string; tenantSlug: string };
};

export default function PublicEventPage({ params }: Props) {
  const { slug, tenantSlug } = params;
  const [event, setEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError("");
      try {
        const res = await fetch(`/api/public/events/${slug}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || "Failed to load event");
        setEvent(data.event ?? null);
      } catch (err: any) {
        setError(err.message || "Failed to load event");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [slug]);

  if (loading) return <div style={{ padding: 16 }}>Loading…</div>;
  if (error) return <div style={{ padding: 16, color: "red" }}>{error}</div>;
  if (!event) return <div style={{ padding: 16 }}>Event not found.</div>;

  return (
    <div style={{ maxWidth: 900, margin: "40px auto", padding: 16 }}>
      <Link href={`/c/${tenantSlug}`} style={{ display: "inline-block", marginBottom: 16, color: "#2563eb" }}>
        ← Back to all campaigns
      </Link>

      <h1>{event.title}</h1>
      {event.imageUrl && (
        <img
          src={event.imageUrl}
          alt={event.title}
          style={{ width: "100%", maxHeight: 360, objectFit: "cover", borderRadius: 16, marginBottom: 20 }}
        />
      )}
      {event.description && <p>{event.description}</p>}
      {event.date && <div>Date: {new Date(event.date).toLocaleString()}</div>}
    </div>
  );
}
