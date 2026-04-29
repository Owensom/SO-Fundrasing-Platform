"use client";

import { useMemo, useRef, useState } from "react";

type SoldSquareOption = {
  squareNumber: number;
  customerName: string;
  customerEmail?: string;
};

type DramaticSquaresDrawProps = {
  gameId: string;
  soldSquareOptions: SoldSquareOption[];
};

function createAudioContext() {
  const AudioContextClass =
    window.AudioContext || (window as any).webkitAudioContext;

  if (!AudioContextClass) return null;
  return new AudioContextClass();
}

function playTick(audioCtx: AudioContext) {
  const now = audioCtx.currentTime;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  const filter = audioCtx.createBiquadFilter();

  osc.type = "square";
  osc.frequency.setValueAtTime(1150, now);
  osc.frequency.exponentialRampToValueAtTime(420, now + 0.045);

  filter.type = "bandpass";
  filter.frequency.setValueAtTime(1300, now);
  filter.Q.setValueAtTime(7, now);

  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.16, now + 0.006);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.06);

  osc.connect(filter);
  filter.connect(gain);
  gain.connect(audioCtx.destination);

  osc.start(now);
  osc.stop(now + 0.07);
}

function playRiserPulse(audioCtx: AudioContext) {
  const now = audioCtx.currentTime;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  const filter = audioCtx.createBiquadFilter();

  osc.type = "sawtooth";
  osc.frequency.setValueAtTime(75, now);
  osc.frequency.linearRampToValueAtTime(135, now + 0.22);

  filter.type = "lowpass";
  filter.frequency.setValueAtTime(500, now);
  filter.frequency.linearRampToValueAtTime(1200, now + 0.22);

  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.035, now + 0.025);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.24);

  osc.connect(filter);
  filter.connect(gain);
  gain.connect(audioCtx.destination);

  osc.start(now);
  osc.stop(now + 0.26);
}

function playWinnerHit(audioCtx: AudioContext) {
  const now = audioCtx.currentTime;
  const master = audioCtx.createGain();

  master.gain.setValueAtTime(0.0001, now);
  master.gain.exponentialRampToValueAtTime(0.28, now + 0.025);
  master.gain.exponentialRampToValueAtTime(0.0001, now + 1.1);
  master.connect(audioCtx.destination);

  const bass = audioCtx.createOscillator();
  bass.type = "triangle";
  bass.frequency.setValueAtTime(190, now);
  bass.frequency.exponentialRampToValueAtTime(55, now + 0.75);
  bass.connect(master);
  bass.start(now);
  bass.stop(now + 1.1);

  const shine = audioCtx.createOscillator();
  shine.type = "square";
  shine.frequency.setValueAtTime(880, now);
  shine.frequency.exponentialRampToValueAtTime(330, now + 0.38);
  shine.connect(master);
  shine.start(now);
  shine.stop(now + 0.42);

  const sparkle = audioCtx.createOscillator();
  const sparkleGain = audioCtx.createGain();

  sparkle.type = "sine";
  sparkle.frequency.setValueAtTime(1320, now + 0.18);
  sparkle.frequency.exponentialRampToValueAtTime(1760, now + 0.48);

  sparkleGain.gain.setValueAtTime(0.0001, now + 0.18);
  sparkleGain.gain.exponentialRampToValueAtTime(0.09, now + 0.22);
  sparkleGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.55);

  sparkle.connect(sparkleGain);
  sparkleGain.connect(master);

  sparkle.start(now + 0.18);
  sparkle.stop(now + 0.58);
}

export default function DramaticSquaresDraw({
  gameId,
  soldSquareOptions,
}: DramaticSquaresDrawProps) {
  const [displaySquare, setDisplaySquare] = useState<number | null>(null);
  const [winner, setWinner] = useState<SoldSquareOption | null>(null);
  const [drawing, setDrawing] = useState(false);
  const [error, setError] = useState("");

  const audioCtxRef = useRef<AudioContext | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const soldNumbers = useMemo(
    () =>
      soldSquareOptions
        .map((square) => Number(square.squareNumber))
        .filter((number) => Number.isFinite(number) && number > 0),
    [soldSquareOptions],
  );

  function getAudioContext() {
    if (typeof window === "undefined") return null;

    if (!audioCtxRef.current) {
      audioCtxRef.current = createAudioContext();
    }

    return audioCtxRef.current;
  }

  async function unlockAudio() {
    const audioCtx = getAudioContext();

    if (audioCtx?.state === "suspended") {
      await audioCtx.resume();
    }

    return audioCtx;
  }

  function stopSpinner() {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }

  async function drawWinner() {
    if (!soldNumbers.length || drawing) return;

    setError("");
    setWinner(null);
    setDrawing(true);

    const audioCtx = await unlockAudio();

    let ticks = 0;

    stopSpinner();

    intervalRef.current = setInterval(() => {
      const randomNumber =
        soldNumbers[Math.floor(Math.random() * soldNumbers.length)];

      setDisplaySquare(randomNumber);

      if (audioCtx) {
        playTick(audioCtx);

        if (ticks % 3 === 0) {
          playRiserPulse(audioCtx);
        }
      }

      ticks += 1;
    }, 85);

    try {
      const response = await fetch(`/api/admin/squares/${gameId}/draw`, {
        method: "POST",
      });

      const data = await response.json().catch(() => null);

      if (!response.ok || !data?.ok) {
        throw new Error(data?.error || "Draw failed");
      }

      const winningSquareNumber = Number(
        data?.winner?.square_number ??
          data?.winner?.squareNumber ??
          data?.square_number ??
          data?.squareNumber,
      );

      const matchedWinner =
        soldSquareOptions.find(
          (square) => Number(square.squareNumber) === winningSquareNumber,
        ) || null;

      setTimeout(() => {
        stopSpinner();

        setDisplaySquare(winningSquareNumber || null);
        setWinner(matchedWinner);

        if (audioCtx) {
          playWinnerHit(audioCtx);
        }

        setDrawing(false);

        setTimeout(() => {
          window.location.reload();
        }, 900);
      }, 2400);
    } catch (err) {
      stopSpinner();
      setDrawing(false);
      setError(err instanceof Error ? err.message : "Draw failed");
    }
  }

  return (
    <section
      style={{
        border: "1px solid #e5e7eb",
        borderRadius: 18,
        padding: 24,
        background:
          "linear-gradient(135deg, rgba(17,24,39,0.98), rgba(55,65,81,0.96))",
        color: "white",
        boxShadow: "0 18px 45px rgba(0,0,0,0.22)",
      }}
    >
      <div style={{ display: "grid", gap: 18 }}>
        <div>
          <p
            style={{
              margin: 0,
              color: "#d1d5db",
              fontSize: 13,
              textTransform: "uppercase",
              letterSpacing: "0.12em",
              fontWeight: 800,
            }}
          >
            Dramatic draw
          </p>

          <h2 style={{ margin: "8px 0 0", fontSize: 26 }}>
            Squares winner draw
          </h2>
        </div>

        <div
          style={{
            display: "grid",
            placeItems: "center",
            minHeight: 190,
            borderRadius: 18,
            background:
              "radial-gradient(circle, rgba(250,204,21,0.24), rgba(255,255,255,0.06) 45%, rgba(0,0,0,0.18))",
            border: "1px solid rgba(255,255,255,0.14)",
          }}
        >
          <div style={{ textAlign: "center" }}>
            <div
              style={{
                fontSize: 72,
                lineHeight: 1,
                fontWeight: 950,
                letterSpacing: "-0.08em",
                textShadow: drawing
                  ? "0 0 26px rgba(250,204,21,0.9)"
                  : "0 0 18px rgba(255,255,255,0.25)",
                transform: drawing ? "scale(1.04)" : "scale(1)",
                transition: "transform 120ms ease, text-shadow 120ms ease",
              }}
            >
              {displaySquare ? `#${displaySquare}` : "—"}
            </div>

            <p
              style={{
                margin: "12px 0 0",
                color: "#e5e7eb",
                fontWeight: 800,
              }}
            >
              {drawing
                ? "Drawing..."
                : winner
                  ? winner.customerName || "Winner"
                  : "Ready to draw"}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={drawWinner}
          disabled={!soldNumbers.length || drawing}
          style={{
            width: "100%",
            border: 0,
            borderRadius: 14,
            padding: "14px 18px",
            cursor: !soldNumbers.length || drawing ? "not-allowed" : "pointer",
            background:
              !soldNumbers.length || drawing
                ? "#9ca3af"
                : "linear-gradient(135deg, #facc15, #f97316)",
            color: "#111827",
            fontSize: 16,
            fontWeight: 950,
            boxShadow:
              !soldNumbers.length || drawing
                ? "none"
                : "0 12px 28px rgba(249,115,22,0.34)",
          }}
        >
          {drawing ? "Drawing..." : "Start dramatic draw"}
        </button>

        {error ? (
          <p style={{ margin: 0, color: "#fecaca", fontSize: 14 }}>{error}</p>
        ) : null}

        {!soldNumbers.length ? (
          <p style={{ margin: 0, color: "#fecaca", fontSize: 14 }}>
            No sold squares available to draw from yet.
          </p>
        ) : (
          <p style={{ margin: 0, color: "#d1d5db", fontSize: 13 }}>
            Uses upgraded generated sound: spinner ticks, tension pulses, and a
            final winner hit.
          </p>
        )}
      </div>
    </section>
  );
}
