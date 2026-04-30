"use client";

import { useMemo, useState } from "react";

type Ticket = {
  ticketNumber: number;
  colour: string | null;
};

export default function DramaticRaffleDraw({
  raffleId,
  soldTickets,
}: {
  raffleId: string;
  soldTickets: Ticket[];
}) {
  const [open, setOpen] = useState(false);
  const [prize, setPrize] = useState("1");
  const [display, setDisplay] = useState<number | null>(null);
  const [drawing, setDrawing] = useState(false);
  const [error, setError] = useState("");

  const numbers = useMemo(
    () => soldTickets.map((t) => t.ticketNumber),
    [soldTickets]
  );

  function startDraw() {
    if (!numbers.length) return;

    setDrawing(true);
    setError("");

    let i = 0;

    const interval = setInterval(() => {
      const n = numbers[Math.floor(Math.random() * numbers.length)];
      setDisplay(n);
      i++;
    }, 70);

    setTimeout(async () => {
      clearInterval(interval);

      const finalNumber =
        numbers[Math.floor(Math.random() * numbers.length)];

      setDisplay(finalNumber);

      try {
        const formData = new FormData();
        formData.append("prize_position", prize);
        formData.append("ticket_number", String(finalNumber));

        const res = await fetch(
          `/api/admin/raffles/${raffleId}/draw`,
          {
            method: "POST",
            body: formData,
          }
        );

        const data = await res.json();

        if (!data.ok) {
          throw new Error(data.error || "Draw failed");
        }

        setTimeout(() => window.location.reload(), 1500);
      } catch (err: any) {
        setError(err.message);
      }

      setDrawing(false);
    }, 2500);
  }

  return (
    <>
      <div style={{ padding: 16, border: "1px solid #e2e8f0", borderRadius: 12 }}>
        <h3>Dramatic draw</h3>
        <button onClick={() => setOpen(true)}>Open draw</button>
      </div>

      {open && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "#111827",
            color: "white",
            display: "grid",
            placeItems: "center",
            zIndex: 9999,
          }}
        >
          <button
            onClick={() => setOpen(false)}
            style={{ position: "absolute", top: 20, right: 20 }}
          >
            Close
          </button>

          <div style={{ textAlign: "center" }}>
            <h1>Raffle draw</h1>

            <input
              value={prize}
              onChange={(e) => setPrize(e.target.value)}
              style={{ marginBottom: 20 }}
            />

            <div style={{ fontSize: 80 }}>
              {display ? `#${display}` : "—"}
            </div>

            <button onClick={startDraw} disabled={drawing}>
              {drawing ? "Drawing..." : "Start draw"}
            </button>

            {error && <p style={{ color: "red" }}>{error}</p>}
          </div>
        </div>
      )}
    </>
  );
}
