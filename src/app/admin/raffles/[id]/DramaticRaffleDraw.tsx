"use client";

import { useState } from "react";

type TicketOption = {
  ticketNumber: number;
  colour: string | null;
  buyerName?: string | null;
};

type Props = {
  raffleId: string;
  tickets: TicketOption[];
};

export default function DramaticRaffleDraw({
  raffleId,
  tickets,
}: Props) {
  const [isDrawing, setIsDrawing] = useState(false);
  const [selected, setSelected] = useState<TicketOption | null>(null);
  const [prizePosition, setPrizePosition] = useState(1);
  const [error, setError] = useState<string | null>(null);

  function playSound() {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "triangle";
    osc.frequency.setValueAtTime(200, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 1.2);

    gain.gain.setValueAtTime(0.001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.5, ctx.currentTime + 0.2);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 1.2);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 1.2);
  }

  function launchConfetti() {
    const duration = 2000;
    const end = Date.now() + duration;

    const interval = setInterval(() => {
      if (Date.now() > end) return clearInterval(interval);

      const confetti = document.createElement("div");
      confetti.style.position = "fixed";
      confetti.style.left = Math.random() * 100 + "%";
      confetti.style.top = "-10px";
      confetti.style.width = "8px";
      confetti.style.height = "8px";
      confetti.style.background = `hsl(${Math.random() * 360},100%,50%)`;
      confetti.style.zIndex = "9999";

      document.body.appendChild(confetti);

      const fall = setInterval(() => {
        const top = parseFloat(confetti.style.top);
        confetti.style.top = top + 5 + "px";

        if (top > window.innerHeight) {
          confetti.remove();
          clearInterval(fall);
        }
      }, 16);
    }, 30);
  }

  async function startDraw() {
    setError(null);
    setIsDrawing(true);

    playSound();

    let index = 0;

    const interval = setInterval(() => {
      setSelected(tickets[index % tickets.length]);
      index++;
    }, 80);

    setTimeout(async () => {
      clearInterval(interval);

      const winner =
        tickets[Math.floor(Math.random() * tickets.length)];

      setSelected(winner);

      try {
        const res = await fetch(
          `/api/admin/raffles/${raffleId}/draw`,
          {
            method: "POST",
            body: new URLSearchParams({
              prize_position: String(prizePosition),
              ticket_number: String(winner.ticketNumber),
            }),
          },
        );

        const data = await res.json();

        if (!data.ok) {
          throw new Error(data.error || "Draw failed");
        }

        launchConfetti();
      } catch (err: any) {
        setError(err.message);
      }

      setIsDrawing(false);
    }, 2500);
  }

  return (
    <div style={styles.card}>
      <h3 style={styles.title}>🎬 Dramatic draw</h3>

      <input
        type="number"
        value={prizePosition}
        onChange={(e) => setPrizePosition(Number(e.target.value))}
        style={styles.input}
        placeholder="Prize number"
      />

      <button onClick={startDraw} style={styles.button}>
        Start dramatic draw
      </button>

      {selected && (
        <div style={styles.result}>
          🎟️ #{selected.ticketNumber}
          <br />
          🎨 {selected.colour || "No colour"}
        </div>
      )}

      {error && <div style={styles.error}>{error}</div>}
    </div>
  );
}

const styles: any = {
  card: {
    padding: 16,
    borderRadius: 16,
    background: "#0f172a",
    color: "#fff",
  },
  title: {
    marginBottom: 12,
  },
  input: {
    width: "100%",
    padding: 10,
    marginBottom: 10,
    borderRadius: 8,
  },
  button: {
    width: "100%",
    padding: 12,
    borderRadius: 10,
    background: "#22c55e",
    color: "#fff",
    fontWeight: 700,
    border: "none",
    cursor: "pointer",
  },
  result: {
    marginTop: 12,
    fontSize: 18,
    fontWeight: 800,
  },
  error: {
    marginTop: 10,
    color: "#f87171",
  },
};
