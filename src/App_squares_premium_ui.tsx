import React, { useMemo, useState } from "react";

export default function App() {
  const [admin, setAdmin] = useState(true);
  const [total, setTotal] = useState(100);
  const [price, setPrice] = useState(10);
  const [title, setTitle] = useState("Super Bowl Squares");
  const [buyerName, setBuyerName] = useState("");
  const [buyerEmail, setBuyerEmail] = useState("");
  const [selected, setSelected] = useState<number[]>([]);
  const [sold, setSold] = useState<number[]>([3, 8, 14]);
  const [reserved] = useState<number[]>([5, 11]);

  const cappedTotal = Math.max(1, Math.min(500, total));
  const totalCost = selected.length * price;
  const canBuy = buyerName.trim() !== "" && buyerEmail.trim() !== "" && selected.length > 0;

  const visibleSelected = useMemo(() => selected.filter((n) => n <= cappedTotal), [selected, cappedTotal]);

  function toggleSquare(n: number) {
    if (sold.includes(n) || reserved.includes(n)) return;
    setSelected((curr) =>
      curr.includes(n) ? curr.filter((x) => x !== n) : [...curr, n].sort((a, b) => a - b)
    );
  }

  function buySquares() {
    if (!canBuy) return;
    setSold((curr) => [...curr, ...visibleSelected].sort((a, b) => a - b));
    setSelected([]);
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
      <div style={{ maxWidth: 1200, margin: "0 auto", display: "grid", gap: 20 }}>
        <section
          style={{
            border: "1px solid rgba(255,255,255,0.10)",
            background: "rgba(255,255,255,0.07)",
            backdropFilter: "blur(18px)",
            borderRadius: 28,
            padding: 24,
            boxShadow: "0 20px 80px rgba(2,6,23,0.45)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
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
                Premium fundraising suite
              </div>
              <h1 style={{ margin: 0, fontSize: 38, fontWeight: 700, letterSpacing: "-0.03em" }}>SO Fundraising Platform</h1>
              <p style={{ margin: "10px 0 0", color: "#cbd5e1", maxWidth: 720 }}>
                Premium Squares experience with full-width buyer view, clean admin controls, sold/reserved handling, and live totals.
              </p>
            </div>

            <button
              onClick={() => setAdmin((v) => !v)}
              style={{
                border: "1px solid rgba(125,211,252,0.35)",
                background: admin ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.04)",
                color: "white",
                borderRadius: 18,
                padding: "12px 18px",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Admin {admin ? "ON" : "OFF"}
            </button>
          </div>
        </section>

        {admin && (
          <section
            style={{
              border: "1px solid rgba(255,255,255,0.10)",
              background: "rgba(255,255,255,0.07)",
              backdropFilter: "blur(18px)",
              borderRadius: 28,
              padding: 24,
              boxShadow: "0 20px 80px rgba(2,6,23,0.45)",
            }}
          >
            <h2 style={{ marginTop: 0, marginBottom: 18, fontSize: 28 }}>Admin • Squares</h2>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                gap: 16,
              }}
            >
              <div>
                <label style={{ display: "block", marginBottom: 8, fontSize: 12, textTransform: "uppercase", letterSpacing: "0.14em", color: "#94a3b8" }}>
                  Game title
                </label>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "14px 16px",
                    borderRadius: 18,
                    border: "1px solid rgba(255,255,255,0.10)",
                    background: "rgba(2,6,23,0.70)",
                    color: "white",
                    boxSizing: "border-box",
                  }}
                />
              </div>

              <div>
                <label style={{ display: "block", marginBottom: 8, fontSize: 12, textTransform: "uppercase", letterSpacing: "0.14em", color: "#94a3b8" }}>
                  Squares to sell
                </label>
                <input
                  type="number"
                  min={1}
                  max={500}
                  value={total}
                  onChange={(e) => setTotal(Number(e.target.value || 1))}
                  style={{
                    width: "100%",
                    padding: "14px 16px",
                    borderRadius: 18,
                    border: "1px solid rgba(255,255,255,0.10)",
                    background: "rgba(2,6,23,0.70)",
                    color: "white",
                    boxSizing: "border-box",
                  }}
                />
                <div style={{ marginTop: 6, fontSize: 11, color: "#64748b" }}>Allowed range: 1 to 500</div>
              </div>

              <div>
                <label style={{ display: "block", marginBottom: 8, fontSize: 12, textTransform: "uppercase", letterSpacing: "0.14em", color: "#94a3b8" }}>
                  Price per square
                </label>
                <input
                  type="number"
                  min={1}
                  value={price}
                  onChange={(e) => setPrice(Number(e.target.value || 1))}
                  style={{
                    width: "100%",
                    padding: "14px 16px",
                    borderRadius: 18,
                    border: "1px solid rgba(255,255,255,0.10)",
                    background: "rgba(2,6,23,0.70)",
                    color: "white",
                    boxSizing: "border-box",
                  }}
                />
              </div>

              <div
                style={{
                  border: "1px solid rgba(255,255,255,0.10)",
                  background: "rgba(2,6,23,0.60)",
                  borderRadius: 18,
                  padding: 16,
                }}
              >
                <div style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: "0.14em", color: "#94a3b8" }}>Status</div>
                <div style={{ marginTop: 8, fontWeight: 700, fontSize: 18 }}>{cappedTotal} squares active</div>
                <div style={{ marginTop: 6, color: "#cbd5e1", fontSize: 14 }}>{sold.filter((n) => n <= cappedTotal).length} sold • {reserved.filter((n) => n <= cappedTotal).length} reserved</div>
              </div>
            </div>
          </section>
        )}

        <section
          style={{
            border: "1px solid rgba(255,255,255,0.10)",
            background: "rgba(255,255,255,0.07)",
            backdropFilter: "blur(18px)",
            borderRadius: 28,
            padding: 24,
            boxShadow: "0 20px 80px rgba(2,6,23,0.45)",
          }}
        >
          <h2 style={{ marginTop: 0, marginBottom: 8, fontSize: 30 }}>{title} • Buyer View</h2>
          <p style={{ marginTop: 0, marginBottom: 18, color: "#cbd5e1" }}>
            Choose your squares below. Sold squares are locked. Reserved squares are not available.
          </p>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: 16,
              marginBottom: 20,
            }}
          >
            <div>
              <label style={{ display: "block", marginBottom: 8, fontSize: 12, textTransform: "uppercase", letterSpacing: "0.14em", color: "#94a3b8" }}>
                Buyer name
              </label>
              <input
                value={buyerName}
                onChange={(e) => setBuyerName(e.target.value)}
                style={{
                  width: "100%",
                  padding: "14px 16px",
                  borderRadius: 18,
                  border: "1px solid rgba(255,255,255,0.10)",
                  background: "rgba(2,6,23,0.70)",
                  color: "white",
                  boxSizing: "border-box",
                }}
              />
            </div>

            <div>
              <label style={{ display: "block", marginBottom: 8, fontSize: 12, textTransform: "uppercase", letterSpacing: "0.14em", color: "#94a3b8" }}>
                Buyer email
              </label>
              <input
                value={buyerEmail}
                onChange={(e) => setBuyerEmail(e.target.value)}
                style={{
                  width: "100%",
                  padding: "14px 16px",
                  borderRadius: 18,
                  border: "1px solid rgba(255,255,255,0.10)",
                  background: "rgba(2,6,23,0.70)",
                  color: "white",
                  boxSizing: "border-box",
                }}
              />
            </div>

            <div
              style={{
                border: "1px solid rgba(255,255,255,0.10)",
                background: "rgba(2,6,23,0.60)",
                borderRadius: 18,
                padding: 16,
              }}
            >
              <div style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: "0.14em", color: "#94a3b8" }}>Summary</div>
              <div style={{ marginTop: 8, color: "#e2e8f0" }}>Selected: {visibleSelected.length}</div>
              <div style={{ marginTop: 6, color: "#e2e8f0" }}>Total: £{totalCost.toFixed(2)}</div>
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(10, minmax(0, 1fr))",
              gap: 8,
            }}
          >
            {Array.from({ length: cappedTotal }).map((_, i) => {
              const n = i + 1;
              const isSold = sold.includes(n);
              const isReserved = reserved.includes(n);
              const isSelected = visibleSelected.includes(n);

              const bg = isSold
                ? "rgba(244,63,94,0.22)"
                : isReserved
                ? "rgba(245,158,11,0.22)"
                : isSelected
                ? "white"
                : "rgba(15,23,42,0.72)";

              const color = isSelected ? "#020617" : "white";
              const border = isSold
                ? "1px solid rgba(251,113,133,0.35)"
                : isReserved
                ? "1px solid rgba(251,191,36,0.35)"
                : isSelected
                ? "1px solid white"
                : "1px solid rgba(255,255,255,0.15)";

              return (
                <button
                  key={n}
                  type="button"
                  onClick={() => toggleSquare(n)}
                  disabled={isSold || isReserved}
                  style={{
                    aspectRatio: "1 / 1",
                    borderRadius: 18,
                    border,
                    background: bg,
                    color,
                    fontWeight: 700,
                    cursor: isSold || isReserved ? "not-allowed" : "pointer",
                    opacity: isSold || isReserved ? 0.82 : 1,
                  }}
                >
                  {n}
                </button>
              );
            })}
          </div>

          <div
            style={{
              marginTop: 18,
              border: "1px solid rgba(255,255,255,0.10)",
              background: "rgba(2,6,23,0.60)",
              borderRadius: 20,
              padding: 16,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
              <div>
                <div style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: "0.14em", color: "#94a3b8" }}>
                  Selected numbers
                </div>
                <div style={{ marginTop: 8, color: "#e2e8f0" }}>
                  {visibleSelected.length ? visibleSelected.join(", ") : "None selected"}
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: "0.14em", color: "#94a3b8" }}>
                  Amount due
                </div>
                <div style={{ marginTop: 8, fontWeight: 700, fontSize: 22 }}>£{totalCost.toFixed(2)}</div>
              </div>
            </div>

            <button
              onClick={buySquares}
              disabled={!canBuy}
              style={{
                marginTop: 16,
                width: "100%",
                borderRadius: 18,
                padding: "14px 18px",
                background: canBuy ? "white" : "rgba(255,255,255,0.25)",
                color: canBuy ? "#020617" : "#cbd5e1",
                fontWeight: 700,
                border: "none",
                cursor: canBuy ? "pointer" : "not-allowed",
              }}
            >
              Buy Selected Squares
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
