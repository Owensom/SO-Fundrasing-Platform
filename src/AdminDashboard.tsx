import React, { useEffect, useMemo, useState } from "react";
import { LedgerEntry, clearLedger, readLedger } from "./purchaseLedger";

function money(n: number) {
  return `£${n.toFixed(2)}`;
}

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

function chipStyle(active = false): React.CSSProperties {
  return {
    border: active ? "1px solid rgba(125,211,252,0.35)" : "1px solid rgba(255,255,255,0.10)",
    background: active ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.04)",
    color: "white",
    borderRadius: 18,
    padding: "12px 18px",
    fontWeight: 600,
    cursor: "pointer",
  };
}

export default function AdminDashboard() {
  const [entries, setEntries] = useState<LedgerEntry[]>([]);

  useEffect(() => {
    setEntries(readLedger());
  }, []);

  const stats = useMemo(() => {
    const totals = {
      squares: { count: 0, revenue: 0 },
      tickets: { count: 0, revenue: 0 },
      raffle: { count: 0, revenue: 0 },
    };

    for (const entry of entries) {
      totals[entry.module].count += entry.quantity;
      totals[entry.module].revenue += entry.total;
    }

    return {
      totals,
      revenue: entries.reduce((sum, x) => sum + x.total, 0),
      purchases: entries.length,
    };
  }, [entries]);

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
      <div style={{ maxWidth: 1200, margin: "0 auto", display: "grid", gap: 20 }}>
        <section style={cardStyle()}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap", alignItems: "center" }}>
            <div>
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
                Global admin dashboard
              </div>
              <h1 style={{ margin: 0, fontSize: 38, fontWeight: 700, letterSpacing: "-0.03em" }}>
                Purchase Dashboard
              </h1>
              <p style={{ margin: "10px 0 0", color: "#cbd5e1", maxWidth: 760 }}>
                Combined view of Squares, Tickets, and Raffle purchases.
              </p>
            </div>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button onClick={() => setEntries(readLedger())} style={chipStyle(true)}>Refresh</button>
              <button
                onClick={() => {
                  clearLedger();
                  setEntries([]);
                }}
                style={chipStyle(false)}
              >
                Clear Ledger
              </button>
            </div>
          </div>
        </section>

        <section
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: 16,
          }}
        >
          <div style={cardStyle()}>
            <div style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: "0.14em", color: "#94a3b8" }}>Total revenue</div>
            <div style={{ marginTop: 8, fontWeight: 700, fontSize: 28 }}>{money(stats.revenue)}</div>
          </div>

          <div style={cardStyle()}>
            <div style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: "0.14em", color: "#94a3b8" }}>Purchases</div>
            <div style={{ marginTop: 8, fontWeight: 700, fontSize: 28 }}>{stats.purchases}</div>
          </div>

          <div style={cardStyle()}>
            <div style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: "0.14em", color: "#94a3b8" }}>Squares revenue</div>
            <div style={{ marginTop: 8, fontWeight: 700, fontSize: 28 }}>{money(stats.totals.squares.revenue)}</div>
          </div>

          <div style={cardStyle()}>
            <div style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: "0.14em", color: "#94a3b8" }}>Tickets revenue</div>
            <div style={{ marginTop: 8, fontWeight: 700, fontSize: 28 }}>{money(stats.totals.tickets.revenue)}</div>
          </div>

          <div style={cardStyle()}>
            <div style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: "0.14em", color: "#94a3b8" }}>Raffle revenue</div>
            <div style={{ marginTop: 8, fontWeight: 700, fontSize: 28 }}>{money(stats.totals.raffle.revenue)}</div>
          </div>
        </section>

        <section style={cardStyle()}>
          <h2 style={{ marginTop: 0, fontSize: 28 }}>Purchase ledger</h2>

          {entries.length === 0 ? (
            <div style={{ color: "#94a3b8" }}>No purchases in the global ledger yet. Wire each section to append purchases and they will appear here.</div>
          ) : (
            <div style={{ display: "grid", gap: 12 }}>
              {entries.map((entry) => (
                <div
                  key={entry.id}
                  style={{
                    border: "1px solid rgba(255,255,255,0.10)",
                    background: "rgba(2,6,23,0.55)",
                    borderRadius: 18,
                    padding: 16,
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                    <div>
                      <div style={{ fontWeight: 700 }}>{entry.itemTitle}</div>
                      <div style={{ marginTop: 6, color: "#cbd5e1" }}>{entry.buyerName} • {entry.buyerEmail}</div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontWeight: 700 }}>{money(entry.total)}</div>
                      <div style={{ marginTop: 6, color: "#94a3b8", fontSize: 12 }}>{entry.createdAt}</div>
                    </div>
                  </div>

                  <div style={{ marginTop: 8, color: "#e2e8f0" }}>
                    <span style={{ textTransform: "capitalize" }}>{entry.module}</span> • {entry.description}
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
