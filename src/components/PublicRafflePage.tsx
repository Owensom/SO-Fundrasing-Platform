"use client";

import { useEffect, useState } from "react";

type Props = {
  slug: string;
};

export default function PublicRafflePage({ slug }: Props) {
  const [message, setMessage] = useState("Loading...");
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setError("");
        setMessage("Loading...");

        const response = await fetch(`/api/raffles/${encodeURIComponent(slug)}`);
        const text = await response.text();

        let parsed: any = null;
        try {
          parsed = JSON.parse(text);
        } catch {
          throw new Error(`API did not return JSON: ${text.slice(0, 120)}`);
        }

        if (!response.ok) {
          throw new Error(parsed?.error || "Failed to load raffle");
        }

        if (!cancelled) {
          setMessage(`Loaded raffle: ${parsed?.raffle?.title || slug}`);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load raffle");
        }
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [slug]);

  if (error) {
    return (
      <div style={{ padding: 24, color: "#111111" }}>
        <h1>Public fetch failed</h1>
        <pre style={{ whiteSpace: "pre-wrap" }}>{error}</pre>
      </div>
    );
  }

  return (
    <div style={{ padding: 24, color: "#111111" }}>
      <h1>Public fetch works</h1>
      <p>{message}</p>
    </div>
  );
}
