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
  return AudioContextClass ? new AudioContextClass() : null;
}

function playTick(audioCtx: AudioContext) {
  const now = audioCtx.currentTime;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();

  osc.type = "square";
  osc.frequency.setValueAtTime(1200, now);
  osc.frequency.exponentialRampToValueAtTime(320, now + 0.05);

  gain.gain.setValueAtTime(0.18, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.055);

  osc.connect(gain);
  gain.connect(audioCtx.destination);

  osc.start(now);
  osc.stop(now + 0.06);
}

function playRiser(audioCtx: AudioContext) {
  const now = audioCtx.currentTime;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();

  osc.type = "sawtooth";
  osc.frequency.setValueAtTime(80, now);
  osc.frequency.linearRampToValueAtTime(150, now + 0.22);

  gain.gain.setValueAtTime(0.035, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.24);

  osc.connect(gain);
  gain.connect(audioCtx.destination);

  osc.start(now);
  osc.stop(now + 0.25);
}

function playWinner(audioCtx: AudioContext) {
  const now = audioCtx.currentTime;
  const gain = audioCtx.createGain();

  gain.gain.setValueAtTime(0.28, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 1);

  const bass = audioCtx.createOscillator();
  bass.type = "triangle";
  bass.frequency.setValueAtTime(220, now);
  bass.frequency.exponentialRampToValueAtTime(60, now + 0.7);

  const shine = audioCtx.createOscillator();
  shine.type = "sine";
  shine.frequency.setValueAtTime(900, now);
  shine.frequency.exponentialRampToValueAtTime(1500, now + 0.4);

  bass.connect(gain);
  shine.connect(gain);
  gain.connect(audioCtx.destination);

  bass.start(now);
  shine.start(now + 0.08);

  bass.stop(now + 1);
  shine.stop(now + 0.55);
}

export default function DramaticSquaresDraw({
  gameId,
  soldSquareOptions,
}: DramaticSquaresDrawProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [prizeNumber, setPrizeNumber] = useState("1");
  const [displaySquare, setDisplaySquare] = useState<number | null>(null);
  const [winner, setWinner] = useState<SoldSquareOption | null>(null);
  const [drawing, setDrawing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [error, setError] = useState("");

  const audioCtxRef = useRef<AudioContext | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const soldNumbers = useMemo(
    () =>
      soldSquareOptions
        .map((item) => Number(item.squareNumber))
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

  function stopTimer() {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }

  async function startDraw() {
    const parsedPrizeNumber = Number(prizeNumber);

    if (!Number.isFinite(parsedPrizeNumber) || parsedPrizeNumber <= 0) {
      setError("Enter a valid prize number.");
      return;
    }

    if (!soldNumbers.length || drawing || saving) return;

    setError("");
    setWinner(null);
    setShowConfetti(false);
    setDrawing(true);

    const audioCtx = await unlockAudio();

    let ticks = 0;

    stopTimer();

    timerRef.current = setInterval(() => {
      const randomNumber =
        soldNumbers[Math.floor(Math.random() * soldNumbers.length)];

      setDisplaySquare(randomNumber);

      if (audioCtx) {
        playTick(audioCtx);
        if (ticks % 4 === 0) playRiser(audioCtx);
      }

      ticks += 1;
    }, 75);

    setTimeout(async () => {
      stopTimer();

      const winningSquareNumber =
        soldNumbers[Math.floor(Math.random() * soldNumbers.length)];

      const matchedWinner =
        soldSquareOptions.find(
          (item) => Number(item.squareNumber) === winningSquareNumber,
        ) || null;

      setDisplaySquare(winningSquareNumber);
      setWinner(matchedWinner);
      setDrawing(false);
      setSaving(true);

      if (audioCtx) playWinner(audioCtx);

      setShowConfetti(true);

      try {
        const formData = new FormData();
        formData.append("prize_number", String(parsedPrizeNumber));
        formData.append("square_number", String(winningSquareNumber));

        const response = await fetch(`/api/admin/squares/${gameId}/draw`, {
          method: "POST",
          body: formData,
        });

        const data = await response.json().catch(() => null);

        if (!response.ok || data?.ok === false) {
          throw new Error(data?.error || "Draw failed");
        }

        setTimeout(() => {
          window.location.reload();
        }, 1800);
      } catch (err) {
        setSaving(false);
        setError(err instanceof Error ? err.message : "Draw failed");
      }
    }, 3200);
  }

  return (
    <>
      <section
        style={{
          border: "1px solid #e5e7eb",
          borderRadius: 16,
          padding: 20,
          background: "white",
        }}
      >
        <h2 style={{ margin: "0 0 8px", fontSize: 22 }}>Dramatic draw</h2>

        <p style={{ margin: "0 0 16px", color: "#6b7280" }}>
          Open a full-screen winner draw with sound and confetti.
        </p>

        <button
          type="button"
          onClick={() => setIsOpen(true)}
          disabled={!soldNumbers.length}
          style={{
            border: 0,
            borderRadius: 12,
            padding: "12px 18px",
            fontWeight: 900,
            cursor: soldNumbers.length ? "pointer" : "not-allowed",
            background: soldNumbers.length ? "#111827" : "#9ca3af",
            color: "white",
          }}
        >
          Open full-screen draw
        </button>

        {!soldNumbers.length ? (
          <p style={{ margin: "12px 0 0", color: "#b91c1c" }}>
            No sold squares available yet.
          </p>
        ) : null}
      </section>

      {isOpen ? (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            background:
              "radial-gradient(circle at top, #374151, #111827 55%, #030712)",
            color: "white",
            display: "grid",
            placeItems: "center",
            padding: 24,
          }}
        >
          {showConfetti ? (
            <div
              style={{
                position: "absolute",
                inset: 0,
                pointerEvents: "none",
                overflow: "hidden",
                fontSize: 34,
              }}
            >
              {Array.from({ length: 42 }).map((_, index) => (
                <span
                  key={index}
                  style={{
                    position: "absolute",
                    left: `${(index * 23) % 100}%`,
                    top: `${(index * 17) % 100}%`,
                  }}
                >
                  🎉
                </span>
              ))}
            </div>
          ) : null}

          <button
            type="button"
            onClick={() => {
              stopTimer();
              setIsOpen(false);
              setDrawing(false);
            }}
            style={{
              position: "absolute",
              top: 18,
              right: 18,
              border: "1px solid rgba(255,255,255,0.3)",
              background: "rgba(255,255,255,0.08)",
              color: "white",
              borderRadius: 999,
              padding: "10px 14px",
              cursor: "pointer",
              fontWeight: 800,
            }}
          >
            Close
          </button>

          <div style={{ width: "min(760px, 100%)", textAlign: "center" }}>
            <p
              style={{
                margin: 0,
                color: "#facc15",
                fontSize: 14,
                fontWeight: 900,
                letterSpacing: "0.18em",
                textTransform: "uppercase",
              }}
            >
              Squares draw
            </p>

            <h1 style={{ margin: "12px 0 24px", fontSize: 44 }}>
              Pick a winner
            </h1>

            <label
              style={{
                display: "grid",
                gap: 8,
                margin: "0 auto 24px",
                maxWidth: 260,
                textAlign: "left",
                fontWeight: 800,
              }}
            >
              Prize number
              <input
                value={prizeNumber}
                onChange={(event) => setPrizeNumber(event.target.value)}
                disabled={drawing || saving}
                inputMode="numeric"
                style={{
                  borderRadius: 12,
                  border: "1px solid rgba(255,255,255,0.25)",
                  padding: "12px 14px",
                  fontSize: 18,
                  fontWeight: 900,
                }}
              />
            </label>

            <div
              style={{
                margin: "0 auto 22px",
                display: "grid",
                placeItems: "center",
                width: 280,
                height: 280,
                borderRadius: "50%",
                background:
                  "radial-gradient(circle, rgba(250,204,21,0.35), rgba(249,115,22,0.18), rgba(255,255,255,0.05))",
                border: "2px solid rgba(250,204,21,0.55)",
                boxShadow: drawing
                  ? "0 0 70px rgba(250,204,21,0.75)"
                  : "0 0 40px rgba(250,204,21,0.25)",
              }}
            >
              <div
                style={{
                  fontSize: 84,
                  fontWeight: 950,
                  letterSpacing: "-0.08em",
                  textShadow: "0 0 26px rgba(250,204,21,0.8)",
                }}
              >
                {displaySquare ? `#${displaySquare}` : "—"}
              </div>
            </div>

            <h2 style={{ margin: 0, fontSize: 30 }}>
              {drawing
                ? "Drawing..."
                : saving
                  ? "Saving winner..."
                  : winner
                    ? winner.customerName || "Winner"
                    : "Ready"}
            </h2>

            {winner?.customerEmail ? (
              <p style={{ margin: "8px 0 0", color: "#d1d5db" }}>
                {winner.customerEmail}
              </p>
            ) : null}

            {error ? (
              <p style={{ margin: "18px 0 0", color: "#fecaca" }}>{error}</p>
            ) : null}

            <button
              type="button"
              onClick={startDraw}
              disabled={drawing || saving || !soldNumbers.length}
              style={{
                marginTop: 28,
                border: 0,
                borderRadius: 16,
                padding: "16px 26px",
                fontSize: 18,
                fontWeight: 950,
                cursor:
                  drawing || saving || !soldNumbers.length
                    ? "not-allowed"
                    : "pointer",
                background:
                  drawing || saving || !soldNumbers.length
                    ? "#9ca3af"
                    : "linear-gradient(135deg, #facc15, #f97316)",
                color: "#111827",
              }}
            >
              {drawing ? "Drawing..." : saving ? "Saving..." : "Start draw"}
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}
