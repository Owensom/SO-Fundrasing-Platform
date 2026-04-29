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

function playTone(frequency: number, duration: number, volume = 0.08) {
  try {
    const AudioContextClass =
      window.AudioContext || (window as any).webkitAudioContext;

    const audioContext = new AudioContextClass();
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();

    oscillator.type = "sine";
    oscillator.frequency.value = frequency;

    gain.gain.value = volume;
    gain.gain.exponentialRampToValueAtTime(
      0.001,
      audioContext.currentTime + duration,
    );

    oscillator.connect(gain);
    gain.connect(audioContext.destination);

    oscillator.start();
    oscillator.stop(audioContext.currentTime + duration);

    oscillator.onended = () => {
      audioContext.close().catch(() => {});
    };
  } catch {
    // Browser blocked audio or unsupported device.
  }
}

function playCountdownBeep() {
  playTone(620, 0.12, 0.08);
}

function playRevealTick() {
  playTone(180 + Math.random() * 120, 0.045, 0.035);
}

function playWinnerChime() {
  playTone(523.25, 0.16, 0.09);
  window.setTimeout(() => playTone(659.25, 0.16, 0.09), 150);
  window.setTimeout(() => playTone(783.99, 0.28, 0.1), 310);
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
  const [countdown, setCountdown] = useState<number | null>(null);
  const [burst, setBurst] = useState(false);

  const canDraw = soldSquareOptions.length > 0 && Number(prizeNumber) > 0;

  const displayName = useMemo(() => {
    if (!selectedSquare) return "Waiting...";
    return firstNameOnly(selectedSquare.customerName);
  }, [selectedSquare]);

  function startReveal() {
    if (!canDraw || isRevealing) return;

    setSelectedSquare(null);
    setHasRevealed(false);
    setBurst(false);
    setCountdown(3);
    playCountdownBeep();

    let count = 3;

    const countdownTimer = window.setInterval(() => {
      count -= 1;

      if (count <= 0) {
        window.clearInterval(countdownTimer);
        setCountdown(null);
        runReveal();
      } else {
        setCountdown(count);
        playCountdownBeep();
      }
    }, 800);
  }

  function runReveal() {
    setIsRevealing(true);

    let ticks = 0;
    const maxTicks = 42;

    const timer = window.setInterval(() => {
      const random =
        soldSquareOptions[Math.floor(Math.random() * soldSquareOptions.length)];

      setSelectedSquare(random);
      playRevealTick();
      ticks += 1;

      if (ticks >= maxTicks) {
        window.clearInterval(timer);

        const finalWinner =
          soldSquareOptions[Math.floor(Math.random() * soldSquareOptions.length)];

        setSelectedSquare(finalWinner);
        setIsRevealing(false);
        setHasRevealed(true);
        setBurst(true);
        playWinnerChime();

        window.setTimeout(() => setBurst(false), 1800);
      }
    }, ticks < 22 ? 70 : 120);
  }

  return (
    <div style={styles.panel}>
      <div style={styles.header}>
        <div>
          <div style={styles.kicker}>Live winner experience</div>
          <h3 style={styles.title}>Dramatic live draw</h3>
          <p style={styles.description}>
            Enter the prize number, reveal the winner, then save the result.
          </p>
        </div>
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
            setBurst(false);
          }}
          placeholder="1"
          style={styles.input}
        />
      </label>

      <div style={styles.stage}>
        <div style={styles.stageGlow} />
        <div style={styles.spotlightLeft} />
        <div style={styles.spotlightRight} />

        {burst ? (
          <div style={styles.confettiLayer}>
            {Array.from({ length: 28 }).map((_, index) => (
              <span
                key={index}
                style={{
                  ...styles.confetti,
                  left: `${(index * 37) % 100}%`,
                  animationDelay: `${(index % 9) * 0.06}s`,
                }}
              />
            ))}
          </div>
        ) : null}

        <div style={styles.stageContent}>
          <div style={styles.stageEyebrow}>
            {countdown
              ? "Get ready"
              : isRevealing
                ? "Drawing now"
                : hasRevealed
                  ? "Winner revealed"
                  : "Ready to draw"}
          </div>

          {countdown ? (
            <div style={styles.countdown}>{countdown}</div>
          ) : (
            <>
              <div
                style={{
                  ...styles.bigNumber,
                  transform: isRevealing ? "scale(1.08)" : "scale(1)",
                }}
              >
                {selectedSquare ? `#${selectedSquare.squareNumber}` : "?"}
              </div>

              <div style={styles.winnerName}>{displayName}</div>

              <div style={styles.prizeText}>
                Prize {Number(prizeNumber) > 0 ? prizeNumber : "—"}
              </div>
            </>
          )}
        </div>
      </div>

      <button
        type="button"
        onClick={startReveal}
        disabled={!canDraw || isRevealing || countdown !== null}
        style={{
          ...styles.revealButton,
          opacity: !canDraw || isRevealing || countdown !== null ? 0.55 : 1,
          cursor:
            !canDraw || isRevealing || countdown !== null
              ? "not-allowed"
              : "pointer",
        }}
      >
        {countdown
          ? "Starting..."
          : isRevealing
            ? "Revealing..."
            : hasRevealed
              ? "Reveal again"
              : "Start dramatic reveal"}
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

      <style jsx>{`
        @keyframes fall {
          0% {
            transform: translateY(-40px) rotate(0deg);
            opacity: 1;
          }
          100% {
            transform: translateY(300px) rotate(540deg);
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  panel: {
    padding: 18,
    borderRadius: 24,
    background: "#020617",
    border: "1px solid #1e293b",
    display: "grid",
    gap: 14,
    color: "#ffffff",
    boxShadow: "0 24px 70px rgba(2,6,23,0.42)",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
  },
  kicker: {
    display: "inline-flex",
    padding: "5px 9px",
    borderRadius: 999,
    background: "rgba(249,115,22,0.16)",
    color: "#fed7aa",
    fontSize: 11,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.12em",
    marginBottom: 8,
  },
  title: {
    margin: 0,
    color: "#ffffff",
    fontSize: 22,
    letterSpacing: "-0.03em",
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
    minHeight: 330,
    borderRadius: 28,
    background:
      "radial-gradient(circle at top, #2563eb 0%, #0f172a 42%, #020617 100%)",
    overflow: "hidden",
    border: "1px solid rgba(255,255,255,0.16)",
  },
  stageGlow: {
    position: "absolute",
    inset: -90,
    background:
      "conic-gradient(from 180deg, rgba(59,130,246,0.46), rgba(34,197,94,0.36), rgba(249,115,22,0.4), rgba(168,85,247,0.35), rgba(59,130,246,0.46))",
    filter: "blur(48px)",
    opacity: 0.75,
  },
  spotlightLeft: {
    position: "absolute",
    left: -80,
    top: -20,
    width: 220,
    height: 420,
    background: "rgba(255,255,255,0.08)",
    transform: "rotate(24deg)",
    filter: "blur(8px)",
  },
  spotlightRight: {
    position: "absolute",
    right: -80,
    top: -20,
    width: 220,
    height: 420,
    background: "rgba(255,255,255,0.08)",
    transform: "rotate(-24deg)",
    filter: "blur(8px)",
  },
  stageContent: {
    position: "relative",
    minHeight: 330,
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
    letterSpacing: "0.16em",
    textTransform: "uppercase",
    color: "#bfdbfe",
    marginBottom: 12,
  },
  countdown: {
    fontSize: 120,
    lineHeight: 1,
    fontWeight: 1000,
    textShadow: "0 18px 42px rgba(0,0,0,0.5)",
  },
  bigNumber: {
    fontSize: 104,
    lineHeight: 1,
    fontWeight: 1000,
    letterSpacing: "-0.08em",
    transition: "transform 110ms ease",
    textShadow: "0 14px 38px rgba(0,0,0,0.5)",
  },
  winnerName: {
    marginTop: 12,
    fontSize: 36,
    fontWeight: 950,
    letterSpacing: "-0.04em",
  },
  prizeText: {
    marginTop: 8,
    color: "#cbd5e1",
    fontWeight: 900,
  },
  revealButton: {
    padding: "15px 22px",
    border: "none",
    borderRadius: 999,
    background: "#f97316",
    color: "#ffffff",
    fontWeight: 950,
    fontSize: 15,
    boxShadow: "0 14px 28px rgba(249,115,22,0.28)",
  },
  saveForm: {
    display: "grid",
  },
  saveButton: {
    padding: "15px 22px",
    border: "none",
    borderRadius: 999,
    background: "#22c55e",
    color: "#ffffff",
    fontWeight: 950,
    fontSize: 15,
    boxShadow: "0 14px 28px rgba(34,197,94,0.22)",
  },
  confettiLayer: {
    position: "absolute",
    inset: 0,
    pointerEvents: "none",
    overflow: "hidden",
    zIndex: 3,
  },
  confetti: {
    position: "absolute",
    top: -20,
    width: 9,
    height: 16,
    borderRadius: 3,
    background: "#facc15",
    animation: "fall 1.8s ease-out forwards",
  },
};
