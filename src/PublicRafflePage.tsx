import React, { useEffect, useState } from "react";

type RaffleColor = "Red" | "Blue" | "Green" | "Yellow" | "Purple" | "Orange";

type RaffleEvent = {
  id: string;
  tenantId: string;
  title: string;
  eventName: string;
  venue: string;
  price: number;
  startNumber: number;
  totalTickets: number;
  colors: RaffleColor[];
  soldByColor: Record<RaffleColor, number[]>;
  background?: string;
};

type Tenant = {
  id: string;
  name: string;
  slug: string;
};

type ApiResponse = {
  tenant: Tenant;
  raffles: RaffleEvent[];
};

function cardStyle(): React.CSSProperties {
  return {
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(255,255,255,0.07)",
    backdropFilter: "blur(18px)",
    WebkitBackdropFilter: "blur(18px)",
    borderRadius: 28,
    padding: 24,
    boxShadow: "0 20px 80px rgba(2,6,23,0.45)",
  };
}

function money(n: number) {
  return `£${Number.isFinite(n) ? n.toFixed(2) : "0.00"}`;
}

export default function PublicRafflePage() {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        setError("");

        const res = await fetch("/api/public/raffles/demo-a");
        const text = await res.text();

        let parsed: ApiResponse | null = null;

        try {
          parsed = JSON.parse(text);
        } catch {
          throw new Error(`Invalid JSON returned: ${text}`);
        }

        if (!res.ok) {
          throw new Error((parsed as any)?.error || `Request failed: ${res.status}`);
        }

        setData(parsed);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load raffle page");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: "#020617", color: "white", padding: 24 }}>
        Loading public raffle...
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ minHeight: "100vh", background: "#020617", color: "white", padding: 24 }}>
        <div style={{ color: "#fda4af" }}>{error}</div>
      </div>
    );
  }

  if (!data) {
    return (
      <div style={{ minHeight: "100vh", background: "#020617", color: "white", padding: 24 }}>
        No raffle data found.
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background:
          "radial-gradient(circle at top, rgba(56,189,248,0.16), transparent 28%), radial-gradient(circle at right, rgba(168,85,247,0.14), transparent 22%), linear-gradient(180deg, #020617 0%, #0f172a 48%, #020617 100%)",
        color: "white",
        fontFamily: "Inter, Arial, sans-serif",
        padding: 24,
      }}
    >
      <div style={{ maxWidth: 1100, margin: "0 auto", display: "grid", gap: 20 }}>
        <section style={cardStyle()}>
          <div
            style={{
              display: "inline-flex",
              gap: 8,
              alignItems: "center",
              border: "1px solid rgba(255,255,255,0.10)",
              background: "rgba(255,255,255,0.08)",
              borderRadius: 999,
              padding: "6px 12px",
              fontSize: 11,
              textTransform: "uppercase",
              letterSpacing: "0.18em",
              color: "#bae6fd",
              marginBottom: 10,
            }}
          >
            Public buyer page
          </div>

          <h1 style={{ margin: 0, fontSize: 38, fontWeight: 700, letterSpacing: "-0.03em" }}>
            {data.tenant.name}
          </h1>

          <p style={{ margin: "10px 0 0", color: "#cbd5e1" }}>
            This is the public raffle page for <strong>{data.tenant.slug}</strong>.
          </p>
        </section>

        <section style={cardStyle()}>
          <h2 style={{ marginTop: 0 }}>Available raffles</h2>

          {data.raffles.length === 0 ? (
            <div style={{ color: "#94a3b8" }}>No raffles available.</div>
          ) : (
            <div style={{ display: "grid", gap: 14 }}>
              {data.raffles.map((raffle) => (
                <div
                  key={raffle.id}
                  style={{
                    border: "1px solid rgba(255,255,255,0.10)",
                    background: "rgba(2,6,23,0.55)",
                    borderRadius: 18,
                    padding: 18,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 12,
                      flexWrap: "wrap",
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 22, fontWeight: 700 }}>{raffle.title}</div>
                      <div style={{ color: "#cbd5e1", marginTop: 6 }}>
                        {raffle.eventName} • {raffle.venue}
                      </div>
                    </div>

                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontWeight: 700, fontSize: 20 }}>{money(raffle.price)}</div>
                      <div style={{ color: "#94a3b8", fontSize: 12 }}>per ticket</div>
                    </div>
                  </div>

                  <div style={{ marginTop: 14, color: "#cbd5e1" }}>
                    Numbers: {raffle.startNumber} to {raffle.startNumber + raffle.totalTickets - 1}
                  </div>

                  <div style={{ marginTop: 8, color: "#cbd5e1" }}>
                    Colours: {raffle.colors.join(", ")}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
