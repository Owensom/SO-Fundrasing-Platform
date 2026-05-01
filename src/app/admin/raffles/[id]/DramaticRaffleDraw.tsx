"use client";

import { useMemo, useRef, useState } from "react";

type SoldTicketOption = {
  ticketNumber?: number;
  ticket_number?: number;
  colour?: string | null;
  buyerName?: string;
  buyer_name?: string;
  buyerEmail?: string;
  buyer_email?: string;
};

type Props = {
  raffleId: string;
  soldTickets: SoldTicketOption[];
};

type ConfettiPiece = {
  id: number;
  left: number;
  delay: number;
  duration: number;
  width: number;
  height: number;
  rotate: number;
  hue: number;
};

function getTicketNumber(item: SoldTicketOption) {
  return Number(item.ticketNumber ?? item.ticket_number);
}

function getTicketColour(item: SoldTicketOption) {
  return item.colour || "No colour";
}

function getBuyerName(item: SoldTicketOption | null) {
  return item?.buyerName ?? item?.buyer_name ?? "Winner";
}

function getBuyerEmail(item: SoldTicketOption | null) {
  return item?.buyerEmail ?? item?.buyer_email ?? "";
}

function createAudioContext() {
  const AudioContextClass =
    window.AudioContext || (window as any).webkitAudioContext;

  return AudioContextClass ? new AudioContextClass() : null;
}

function playTick(audioCtx: AudioContext) {
  const now = audioCtx.currentTime;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  const filter = audioCtx.createBiquadFilter();

  osc.type = "square";
  osc.frequency.setValueAtTime(1250, now);
  osc.frequency.exponentialRampToValueAtTime(360, now + 0.055);

  filter.type = "bandpass";
  filter.frequency.setValueAtTime(1300, now);
  filter.Q.setValueAtTime(8, now);

  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.18, now + 0.006);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.065);

  osc.connect(filter);
  filter.connect(gain);
  gain.connect(audioCtx.destination);

  osc.start(now);
  osc.stop(now + 0.075);
}

function playRiser(audioCtx: AudioContext) {
  const now = audioCtx.currentTime;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  const filter = audioCtx.createBiquadFilter();

  osc.type = "sawtooth";
  osc.frequency.setValueAtTime(72, now);
  osc.frequency.linearRampToValueAtTime(145, now + 0.26);

  filter.type = "lowpass";
  filter.frequency.setValueAtTime(520, now);
  filter.frequency.linearRampToValueAtTime(1250, now + 0.26);

  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.045, now + 0.025);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.28);

  osc.connect(filter);
  filter.connect(gain);
  gain.connect(audioCtx.destination);

  osc.start(now);
  osc.stop(now + 0.3);
}

function playWinner(audioCtx: AudioContext) {
  const now = audioCtx.currentTime;

  const master = audioCtx.createGain();
  master.gain.setValueAtTime(0.0001, now);
  master.gain.exponentialRampToValueAtTime(0.3, now + 0.025);
  master.gain.exponentialRampToValueAtTime(0.0001, now + 1.15);
  master.connect(audioCtx.destination);

  const bass = audioCtx.createOscillator();
  bass.type = "triangle";
  bass.frequency.setValueAtTime(210, now);
  bass.frequency.exponentialRampToValueAtTime(58, now + 0.75);
  bass.connect(master);
  bass.start(now);
  bass.stop(now + 1.1);

  const hit = audioCtx.createOscillator();
  hit.type = "square";
  hit.frequency.setValueAtTime(920, now);
  hit.frequency.exponentialRampToValueAtTime(300, now + 0.42);
  hit.connect(master);
  hit.start(now);
  hit.stop(now + 0.45);

  const sparkle = audioCtx.createOscillator();
  const sparkleGain = audioCtx.createGain();

  sparkle.type = "sine";
  sparkle.frequency.setValueAtTime(1320, now + 0.18);
  sparkle.frequency.exponentialRampToValueAtTime(1780, now + 0.55);

  sparkleGain.gain.setValueAtTime(0.0001, now + 0.18);
  sparkleGain.gain.exponentialRampToValueAtTime(0.09, now + 0.24);
  sparkleGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.62);

  sparkle.connect(sparkleGain);
  sparkleGain.connect(master);

  sparkle.start(now + 0.18);
  sparkle.stop(now + 0.65);
}

function makeConfetti(): ConfettiPiece[] {
  return Array.from({ length: 120 }).map((_, index) => ({
    id: index,
    left: Math.random() * 100,
    delay: Math.random() * 0.5,
    duration: 1.8 + Math.random() * 1.8,
    width: 7 + Math.random() * 8,
    height: 10 + Math.random() * 14,
    rotate: Math.random() * 360,
    hue: Math.random() * 360,
  }));
}

export default function DramaticRaffleDraw({ raffleId, soldTickets }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [prizePosition, setPrizePosition] = useState("1");
  const [displayTicket, setDisplayTicket] = useState<number | null>(null);
  const [winner, setWinner] = useState<SoldTicketOption | null>(null);
  const [drawing, setDrawing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [confetti, setConfetti] = useState<ConfettiPiece[]>([]);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const soldNumbers = useMemo(
    () =>
      soldTickets
        .map(getTicketNumber)
        .filter((number) => Number.isFinite(number) && number > 0),
    [soldTickets],
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

  function closeDraw() {
    stopTimer();
    setIsOpen(false);
    setDrawing(false);
    setSaving(false);
  }

  async function startDraw() {
    const parsedPrizePosition = Number(prizePosition);

    if (!Number.isFinite(parsedPrizePosition) || parsedPrizePosition <= 0) {
      setError("Enter a valid prize number.");
      return;
    }

    if (!soldNumbers.length || drawing || saving) return;

    setError("");
    setWinner(null);
    setConfetti([]);
    setDrawing(true);
    setSaving(false);

    const audioCtx = await unlockAudio();

    let ticks = 0;

    stopTimer();

    timerRef.current = setInterval(() => {
      const randomTicket =
        soldNumbers[Math.floor(Math.random() * soldNumbers.length)];

      setDisplayTicket(randomTicket);

      if (audioCtx) {
        playTick(audioCtx);
        if (ticks % 4 === 0) playRiser(audioCtx);
      }

      ticks += 1;
    }, 72);

    window.setTimeout(async () => {
      stopTimer();

      const winningTicketNumber =
        soldNumbers[Math.floor(Math.random() * soldNumbers.length)];

      const matchedWinner =
        soldTickets.find(
          (item) => getTicketNumber(item) === winningTicketNumber,
        ) || null;

      setDisplayTicket(winningTicketNumber);
      setWinner(matchedWinner);
      setDrawing(false);
      setSaving(true);

      if (audioCtx) playWinner(audioCtx);

      setConfetti(makeConfetti());

      try {
        const formData = new FormData();
        formData.append("prize_position", String(parsedPrizePosition));
        formData.append("ticket_number", String(winningTicketNumber));

        if (matchedWinner?.colour) {
          formData.append("colour", matchedWinner.colour);
        }

        const response = await fetch(`/api/admin/raffles/${raffleId}/draw`, {
          method: "POST",
          body: formData,
        });

        const data = await response.json().catch(() => null);

        if (!response.ok || data?.ok === false) {
          throw new Error(data?.error || "Draw failed");
        }

        setSaving(false);

        window.setTimeout(() => {
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
          Open a full-screen winner draw with sound, suspense, saving, and
          confetti.
        </p>

        <button
          type="button"
          onClick={() => {
            setIsOpen(true);
            setError("");
            setWinner(null);
            setDisplayTicket(null);
            setConfetti([]);
          }}
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
            No sold tickets available yet.
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
            overflow: "hidden",
          }}
        >
          <style>{`
            @keyframes confettiFall {
              0% {
                transform: translate3d(0, -20vh, 0) rotate(0deg);
                opacity: 1;
              }
              100% {
                transform: translate3d(var(--drift), 115vh, 0) rotate(900deg);
                opacity: 0;
              }
            }

            @keyframes winnerPulse {
              0%, 100% {
                transform: scale(1);
              }
              50% {
                transform: scale(1.06);
              }
            }

            @keyframes glowPulse {
              0%, 100% {
                box-shadow: 0 0 38px rgba(250,204,21,0.25);
              }
              50% {
                box-shadow: 0 0 85px rgba(250,204,21,0.85);
              }
            }
          `}</style>

          {confetti.length ? (
            <div
              style={{
                position: "absolute",
                inset: 0,
                pointerEvents: "none",
                overflow: "hidden",
              }}
            >
              {confetti.map((piece) => (
                <span
                  key={piece.id}
                  style={
                    {
                      position: "absolute",
                      top: "-12vh",
                      left: `${piece.left}%`,
                      width: piece.width,
                      height: piece.height,
                      borderRadius: 3,
                      background: `hsl(${piece.hue}, 92%, 58%)`,
                      transform: `rotate(${piece.rotate}deg)`,
                      animation: `confettiFall ${piece.duration}s linear ${piece.delay}s forwards`,
                      "--drift": `${Math.random() * 240 - 120}px`,
                    } as React.CSSProperties
                  }
                />
              ))}
            </div>
          ) : null}

          <button
            type="button"
            onClick={closeDraw}
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
              zIndex: 2,
            }}
          >
            Close
          </button>

          <div
            style={{
              width: "min(780px, 100%)",
              textAlign: "center",
              position: "relative",
              zIndex: 1,
            }}
          >
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
              Raffle draw
            </p>

            <h1
              style={{
                margin: "12px 0 24px",
                fontSize: "clamp(34px, 6vw, 60px)",
                lineHeight: 1,
              }}
            >
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
                value={prizePosition}
                onChange={(event) => setPrizePosition(event.target.value)}
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
                width: "min(320px, 70vw)",
                height: "min(320px, 70vw)",
                borderRadius: "50%",
                background:
                  "radial-gradient(circle, rgba(250,204,21,0.38), rgba(249,115,22,0.2), rgba(255,255,255,0.06))",
                border: "2px solid rgba(250,204,21,0.6)",
                animation: drawing || winner ? "glowPulse 900ms infinite" : "",
              }}
            >
              <div
                style={{
                  fontSize: "clamp(72px, 15vw, 118px)",
                  lineHeight: 1,
                  fontWeight: 950,
                  letterSpacing: "-0.08em",
                  textShadow: "0 0 28px rgba(250,204,21,0.85)",
                  animation: drawing ? "winnerPulse 180ms infinite" : "",
                }}
              >
                {displayTicket ? `#${displayTicket}` : "—"}
              </div>
            </div>

            {winner ? (
              <p
                style={{
                  margin: "0 0 10px",
                  color: "#facc15",
                  fontWeight: 900,
                  fontSize: 18,
                }}
              >
                {getTicketColour(winner)}
              </p>
            ) : null}

            <h2 style={{ margin: 0, fontSize: "clamp(26px, 4vw, 38px)" }}>
              {drawing
                ? "Drawing..."
                : saving
                  ? "Saving winner..."
                  : winner
                    ? getBuyerName(winner)
                    : "Ready"}
            </h2>

            {winner && getBuyerEmail(winner) ? (
              <p style={{ margin: "8px 0 0", color: "#d1d5db" }}>
                {getBuyerEmail(winner)}
              </p>
            ) : null}

            {error ? (
              <p
                style={{
                  margin: "18px auto 0",
                  color: "#fecaca",
                  maxWidth: 520,
                  fontWeight: 800,
                }}
              >
                {error}
              </p>
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
                boxShadow:
                  drawing || saving || !soldNumbers.length
                    ? "none"
                    : "0 18px 38px rgba(249,115,22,0.35)",
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
