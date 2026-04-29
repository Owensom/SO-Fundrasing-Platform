"use client";

import type { CSSProperties } from "react";
import { useMemo, useState } from "react";

type SoldSquareOption = {
  squareNumber: number;
  customerName: string;
  customerEmail: string;
};

type Props = {
  gameId: string;
  soldSquareOptions: SoldSquareOption[];
};

function firstNameOnly(name?: string | null) {
  return name?.trim().split(/\s+/)[0] || "Winner";
}

export default function DramaticSquaresDraw({
  gameId,
  soldSquareOptions,
}: Props) {
  const [prizeNumber, setPrizeNumber] = useState("");
  const [selectedSquare, setSelectedSquare] = useState<SoldSquareOption | null>(
    null,
  );
  const [isRevealing, setIsRevealing] = useState(false);
  const [hasRevealed, setHasRevealed] = useState(false);

  const canDraw = soldSquareOptions.length > 0 && Number(prizeNumber) > 0;

  const displayName = useMemo(() => {
    if (!selectedSquare) return "Waiting...";
    return firstNameOnly(selectedSquare.customerName);
  }, [selectedSquare]);

  function startReveal() {
    if (!canDraw || isRevealing) return;

    setIsRevealing(true);
    setHasRevealed(false);

    let ticks = 0;
    const maxTicks = 36;

    const timer = window.setInterval(() => {
      const random =
        soldSquareOptions[Math.floor(Math.random() * soldSquareOptions.length)];

      setSelectedSquare(random);
      ticks += 1;

      if (ticks >= maxTicks) {
        window.clearInterval(timer);

        const finalWinner =
          soldSquareOptions[Math.floor(Math.random() * soldSquareOptions.length)];

        setSelectedSquare(finalWinner);
        setIsRevealing(false);
        setHasRevealed(true);
      }
    }, 90);
  }

  return (
    <div style={styles.panel}>
      <div>
        <h3 style={styles.title}>Dramatic live draw</h3>
        <p style={styles.description}>
          Enter the prize number, start the reveal, then save the final winner.
        </p>
      </div>

      <label style={styles.field}>
        <span style={styles.label}>Prize number</span>
        <input
          type="number"
          min={1}
          value={prizeNumber}
          onChange={(event) => {
            setPrizeNumber(event.target.value);
            setSelectedSquare(null);
            setHasRevealed(false);
          }}
          placeholder="1"
          style={styles.input}
        />
      </label>

      <div style={styles.stage}>
        <div style={styles.stageGlow} />

        <div style={styles.stageContent}>
          <div style={styles.stageEyebrow}>
            {isRevealing
              ? "Drawing..."
              : hasRevealed
                ? "Winner revealed"
                : "Ready to draw"}
          </div>

          <div style={styles.bigNumber}>
            {selectedSquare ? `#${selectedSquare.squareNumber}` : "?"}
          </div>

          <div style={styles.winnerName}>{displayName}</div>

          <div style={styles.prizeText}>
            Prize {Number(prizeNumber) > 0 ? prizeNumber : "—"}
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={startReveal}
        disabled={!canDraw || isRevealing}
        style={{
          ...styles.revealButton,
          opacity: !canDraw || isRevealing ? 0.55 : 1,
          cursor: !canDraw || isRevealing ? "not-allowed" : "pointer",
        }}
      >
        {isRevealing ? "Revealing..." : "Start dramatic reveal"}
      </button>

      <form
        action={`/api/admin/squares/${gameId}/draw/manual`}
        method="post"
        style={styles.saveForm}
      >
        <input type="hidden" name="prize_number" value={prizeNumber} />
        <input
          type="hidden"
          name="square_number"
          value={selectedSquare?.squareNumber ?? ""}
        />

        <button
          type="submit"
          disabled={!hasRevealed || !selectedSquare}
          style={{
            ...styles.saveButton,
            opacity: !hasRevealed || !selectedSquare ? 0.55 : 1,
            cursor: !hasRevealed || !selectedSquare ? "not-allowed" : "pointer",
          }}
        >
          Save revealed winner
        </button>
      </form>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  panel: {
    padding: 18,
    borderRadius: 22,
    background: "#020617",
    border: "1px solid #1e293b",
    display: "grid",
    gap: 14,
    color: "#ffffff",
    boxShadow: "0 22px 60px rgba(2,6,23,0.35)",
  },
  title: {
    margin: 0,
    color: "#ffffff",
    fontSize: 20,
    letterSpacing: "-0.02em",
  },
  description: {
    margin: "6px 0 0",
    color: "#cbd5e1",
    fontSize: 14,
    lineHeight: 1.45,
  },
  field: {
    display: "grid",
    gap: 6,
  },
  label: {
    color: "#e2e8f0",
    fontSize: 13,
    fontWeight: 900,
  },
  input: {
    width: "100%",
    minHeight: 46,
    padding: "10px 12px",
    borderRadius: 14,
    border: "1px solid #334155",
    background: "#0f172a",
    color: "#ffffff",
    fontSize: 16,
    boxSizing: "border-box",
  },
  stage: {
    position: "relative",
    minHeight: 260,
    borderRadius: 24,
    background:
      "radial-gradient(circle at top, #2563eb 0%, #0f172a 42%, #020617 100%)",
    overflow: "hidden",
    border: "1px solid rgba(255,255,255,0.16)",
  },
  stageGlow: {
    position: "absolute",
    inset: -80,
    background:
      "conic-gradient(from 180deg, rgba(59,130,246,0.4), rgba(34,197,94,0.35), rgba(249,115,22,0.35), rgba(59,130,246,0.4))",
    filter: "blur(44px)",
    opacity: 0.7,
  },
  stageContent: {
    position: "relative",
    minHeight: 260,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    textAlign: "center",
    padding: 24,
  },
  stageEyebrow: {
    fontSize: 13,
    fontWeight: 950,
    letterSpacing: "0.14em",
    textTransform: "uppercase",
    color: "#bfdbfe",
    marginBottom: 10,
  },
  bigNumber: {
    fontSize: 86,
    lineHeight: 1,
    fontWeight: 1000,
    letterSpacing: "-0.08em",
    textShadow: "0 12px 34px rgba(0,0,0,0.45)",
  },
  winnerName: {
    marginTop: 12,
    fontSize: 30,
    fontWeight: 950,
  },
  prizeText: {
    marginTop: 8,
    color: "#cbd5e1",
    fontWeight: 900,
  },
  revealButton: {
    padding: "14px 20px",
    border: "none",
    borderRadius: 999,
    background: "#f97316",
    color: "#ffffff",
    fontWeight: 950,
    fontSize: 15,
  },
  saveForm: {
    display: "grid",
  },
  saveButton: {
    padding: "14px 20px",
    border: "none",
    borderRadius: 999,
    background: "#22c55e",
    color: "#ffffff",
    fontWeight: 950,
    fontSize: 15,
  },
};
