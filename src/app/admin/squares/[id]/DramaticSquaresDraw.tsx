"use client";

import { useMemo, useRef, useState, type CSSProperties } from "react";

type SoldSquareOption = {
  squareNumber?: number;
  square_number?: number;
  customerName?: string;
  customer_name?: string;
  customerEmail?: string;
  customer_email?: string;
};

type DramaticSquaresDrawProps = {
  gameId: string;
  soldSquareOptions: SoldSquareOption[];
  drawnPrizeNumbers?: number[];
  drawnSquareNumbers?: number[];
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
  drift: number;
};

type SoundMode = "roll" | "riser";

const DRAW_DURATION_MS = 3600;

const SOUND_PATHS = {
  roll: "/brand/draw-roll.wav",
  riser: "/brand/draw-riser.mp3",
  winner: "/brand/draw-winner.mp3",
};

function getSquareNumber(item: SoldSquareOption) {
  return Number(item.squareNumber ?? item.square_number);
}

function getCustomerName(item: SoldSquareOption | null) {
  return item?.customerName ?? item?.customer_name ?? "Winner";
}

function getCustomerEmail(item: SoldSquareOption | null) {
  return item?.customerEmail ?? item?.customer_email ?? "";
}

function createAudioContext() {
  if (typeof window === "undefined") return null;

  const AudioContextClass =
    window.AudioContext ||
    (
      window as unknown as {
        webkitAudioContext?: typeof AudioContext;
      }
    ).webkitAudioContext;

  return AudioContextClass ? new AudioContextClass() : null;
}

function playTickFallback(audioCtx: AudioContext) {
  const now = audioCtx.currentTime;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  const filter = audioCtx.createBiquadFilter();

  osc.type = "square";
  osc.frequency.setValueAtTime(1320, now);
  osc.frequency.exponentialRampToValueAtTime(380, now + 0.055);

  filter.type = "bandpass";
  filter.frequency.setValueAtTime(1320, now);
  filter.Q.setValueAtTime(8, now);

  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.14, now + 0.006);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.065);

  osc.connect(filter);
  filter.connect(gain);
  gain.connect(audioCtx.destination);

  osc.start(now);
  osc.stop(now + 0.075);
}

function playRiserFallback(audioCtx: AudioContext) {
  const now = audioCtx.currentTime;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  const filter = audioCtx.createBiquadFilter();

  osc.type = "sawtooth";
  osc.frequency.setValueAtTime(70, now);
  osc.frequency.linearRampToValueAtTime(165, now + 0.28);

  filter.type = "lowpass";
  filter.frequency.setValueAtTime(520, now);
  filter.frequency.linearRampToValueAtTime(1450, now + 0.28);

  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.045, now + 0.025);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.3);

  osc.connect(filter);
  filter.connect(gain);
  gain.connect(audioCtx.destination);

  osc.start(now);
  osc.stop(now + 0.32);
}

function playWinnerFallback(audioCtx: AudioContext) {
  const now = audioCtx.currentTime;

  const master = audioCtx.createGain();
  master.gain.setValueAtTime(0.0001, now);
  master.gain.exponentialRampToValueAtTime(0.28, now + 0.025);
  master.gain.exponentialRampToValueAtTime(0.0001, now + 1.2);
  master.connect(audioCtx.destination);

  const notes = [392, 494, 587, 784];

  notes.forEach((frequency, index) => {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    const start = now + index * 0.08;

    osc.type = "triangle";
    osc.frequency.setValueAtTime(frequency, start);

    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.12, start + 0.025);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.55);

    osc.connect(gain);
    gain.connect(master);

    osc.start(start);
    osc.stop(start + 0.6);
  });

  const impact = audioCtx.createOscillator();
  impact.type = "square";
  impact.frequency.setValueAtTime(110, now);
  impact.frequency.exponentialRampToValueAtTime(48, now + 0.75);
  impact.connect(master);
  impact.start(now);
  impact.stop(now + 0.95);
}

function makeConfetti(): ConfettiPiece[] {
  return Array.from({ length: 150 }).map((_, index) => ({
    id: index,
    left: Math.random() * 100,
    delay: Math.random() * 0.55,
    duration: 1.8 + Math.random() * 2,
    width: 7 + Math.random() * 9,
    height: 10 + Math.random() * 16,
    rotate: Math.random() * 360,
    hue: Math.random() * 360,
    drift: Math.random() * 260 - 130,
  }));
}

export default function DramaticSquaresDraw({
  gameId,
  soldSquareOptions,
  drawnPrizeNumbers = [],
  drawnSquareNumbers = [],
}: DramaticSquaresDrawProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [prizeNumber, setPrizeNumber] = useState("1");
  const [displaySquare, setDisplaySquare] = useState<number | null>(null);
  const [winner, setWinner] = useState<SoldSquareOption | null>(null);
  const [drawing, setDrawing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [confetti, setConfetti] = useState<ConfettiPiece[]>([]);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [soundMode, setSoundMode] = useState<SoundMode>("roll");

  const audioCtxRef = useRef<AudioContext | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const finishTimeoutRef = useRef<number | null>(null);

  const rollAudioRef = useRef<HTMLAudioElement | null>(null);
  const riserAudioRef = useRef<HTMLAudioElement | null>(null);
  const winnerAudioRef = useRef<HTMLAudioElement | null>(null);

  const soldNumbers = useMemo(
    () =>
      soldSquareOptions
        .map(getSquareNumber)
        .filter((number) => Number.isFinite(number) && number > 0)
        .filter((number) => !drawnSquareNumbers.includes(number)),
    [soldSquareOptions, drawnSquareNumbers],
  );

  const nextPrizeNumber = useMemo(() => {
    let position = 1;

    while (drawnPrizeNumbers.includes(position)) {
      position += 1;
    }

    return position;
  }, [drawnPrizeNumbers]);

  function getAudioContext() {
    if (typeof window === "undefined" || !soundEnabled) return null;

    if (!audioCtxRef.current) {
      audioCtxRef.current = createAudioContext();
    }

    return audioCtxRef.current;
  }

  function getAudioElements() {
    if (typeof window === "undefined") return null;

    if (!rollAudioRef.current) {
      rollAudioRef.current = new Audio(SOUND_PATHS.roll);
      rollAudioRef.current.preload = "auto";
      rollAudioRef.current.volume = 0.65;
      rollAudioRef.current.loop = true;
    }

    if (!riserAudioRef.current) {
      riserAudioRef.current = new Audio(SOUND_PATHS.riser);
      riserAudioRef.current.preload = "auto";
      riserAudioRef.current.volume = 1;
      riserAudioRef.current.loop = false;
    }

    if (!winnerAudioRef.current) {
      winnerAudioRef.current = new Audio(SOUND_PATHS.winner);
      winnerAudioRef.current.preload = "auto";
      winnerAudioRef.current.volume = 1;
      winnerAudioRef.current.loop = false;
    }

    return {
      roll: rollAudioRef.current,
      riser: riserAudioRef.current,
      winner: winnerAudioRef.current,
    };
  }

  async function unlockAudio() {
    const audioCtx = getAudioContext();
    const audio = getAudioElements();

    if (audioCtx?.state === "suspended") {
      await audioCtx.resume();
    }

    if (audio && soundEnabled) {
      await Promise.allSettled([
        audio.roll.load(),
        audio.riser.load(),
        audio.winner.load(),
      ]);
    }

    return audioCtx;
  }

  function clearAllTimers() {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    if (finishTimeoutRef.current) {
      window.clearTimeout(finishTimeoutRef.current);
      finishTimeoutRef.current = null;
    }
  }

  function stopRealAudio() {
    const audio = getAudioElements();
    if (!audio) return;

    [audio.roll, audio.riser, audio.winner].forEach((item) => {
      item.pause();
      item.currentTime = 0;
    });

    audio.roll.volume = 0.65;
    audio.riser.volume = 1;
    audio.winner.volume = 1;
  }

  async function playRealSound(kind: "roll" | "riser" | "winner") {
    if (!soundEnabled) return false;

    const audio = getAudioElements();
    if (!audio) return false;

    try {
      const sound = audio[kind];
      sound.pause();
      sound.currentTime = 0;
      await sound.play();
      return true;
    } catch {
      return false;
    }
  }

  function openDraw() {
    setIsOpen(true);
    setError("");
    setWinner(null);
    setDisplaySquare(null);
    setConfetti([]);
    setPrizeNumber(String(nextPrizeNumber));

    getAudioElements();
  }

  function closeDraw() {
    clearAllTimers();
    stopRealAudio();
    setIsOpen(false);
    setDrawing(false);
    setSaving(false);
  }

  async function startDraw() {
    const parsedPrizeNumber = Number(prizeNumber);

    if (!Number.isFinite(parsedPrizeNumber) || parsedPrizeNumber <= 0) {
      setError("Enter a valid prize number.");
      return;
    }

    if (drawnPrizeNumbers.includes(parsedPrizeNumber)) {
      setError(`Prize ${parsedPrizeNumber} has already been drawn.`);
      return;
    }

    if (!soldNumbers.length || drawing || saving) return;

    clearAllTimers();
    stopRealAudio();

    setError("");
    setWinner(null);
    setConfetti([]);
    setDrawing(true);
    setSaving(false);

    const audioCtx = await unlockAudio();
    const selectedSound = soundMode === "roll" ? "roll" : "riser";
    const introStarted = await playRealSound(selectedSound);

    if (!introStarted && audioCtx) {
      if (soundMode === "riser") {
        playRiserFallback(audioCtx);
      } else {
        playTickFallback(audioCtx);
      }
    }

    let ticks = 0;
    let intervalMs = 62;

    timerRef.current = setInterval(() => {
      const randomSquare = soldNumbers[Math.floor(Math.random() * soldNumbers.length)];

      setDisplaySquare(randomSquare);

      if (!introStarted && audioCtx) {
        playTickFallback(audioCtx);

        if (soundMode === "riser" && ticks % 5 === 0) {
          playRiserFallback(audioCtx);
        }
      }

      ticks += 1;

      if (ticks === 28) {
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }

        intervalMs = 115;

        timerRef.current = setInterval(() => {
          const randomSquare =
            soldNumbers[Math.floor(Math.random() * soldNumbers.length)];

          setDisplaySquare(randomSquare);

          if (!introStarted && audioCtx) {
            playTickFallback(audioCtx);
          }

          ticks += 1;
        }, intervalMs);
      }
    }, intervalMs);

    finishTimeoutRef.current = window.setTimeout(async () => {
      clearAllTimers();

      const audio = getAudioElements();

      if (audio?.roll) {
        audio.roll.pause();
        audio.roll.currentTime = 0;
        audio.roll.volume = 0.65;
      }

      if (audio?.riser) {
        audio.riser.pause();
        audio.riser.currentTime = 0;
        audio.riser.volume = 1;
      }

      const winningSquareNumber =
        soldNumbers[Math.floor(Math.random() * soldNumbers.length)];

      const matchedWinner =
        soldSquareOptions.find(
          (item) => getSquareNumber(item) === winningSquareNumber,
        ) || null;

      setDisplaySquare(winningSquareNumber);
      setWinner(matchedWinner);
      setDrawing(false);
      setSaving(true);

      const winnerStarted = await playRealSound("winner");

      if (!winnerStarted && audioCtx) {
        playWinnerFallback(audioCtx);
      }

      setConfetti(makeConfetti());

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

        setSaving(false);

        window.setTimeout(() => {
          window.location.reload();
        }, 1900);
      } catch (err) {
        setSaving(false);
        setError(err instanceof Error ? err.message : "Draw failed");
      }
    }, DRAW_DURATION_MS);
  }

  return (
    <>
      <section style={styles.launchCard}>
        <div style={styles.launchTop}>
          <div>
            <div style={styles.eyebrow}>Live event mode</div>
            <h2 style={styles.title}>Dramatic draw</h2>
            <p style={styles.description}>
              Choose Classic Roll or Cinematic Riser, then open a full-screen
              squares draw with winner reveal, saving and confetti.
            </p>
          </div>

          <div style={styles.ticketCount}>
            <strong>{soldNumbers.length}</strong>
            <span>eligible squares</span>
          </div>
        </div>

        <div style={styles.launchActions}>
          <button
            type="button"
            onClick={openDraw}
            disabled={!soldNumbers.length}
            style={{
              ...styles.primaryButton,
              cursor: soldNumbers.length ? "pointer" : "not-allowed",
              background: soldNumbers.length
                ? "linear-gradient(135deg, #0f172a, #1e293b)"
                : "#9ca3af",
            }}
          >
            Open full-screen draw
          </button>

          <span style={styles.miniNote}>Next available prize: #{nextPrizeNumber}</span>
        </div>

        {!soldNumbers.length ? (
          <p style={styles.warning}>
            No eligible sold squares available. Squares that have already won are excluded.
          </p>
        ) : null}
      </section>

      {isOpen ? (
        <div style={styles.overlay}>
          <style>{`
            @keyframes confettiFall {
              0% { transform: translate3d(0, -20vh, 0) rotate(0deg); opacity: 1; }
              100% { transform: translate3d(var(--drift), 115vh, 0) rotate(900deg); opacity: 0; }
            }

            @keyframes winnerPulse {
              0%, 100% { transform: scale(1); }
              50% { transform: scale(1.055); }
            }

            @keyframes glowPulse {
              0%, 100% { box-shadow: 0 0 42px rgba(250,204,21,0.28), inset 0 0 28px rgba(255,255,255,0.08); }
              50% { box-shadow: 0 0 95px rgba(250,204,21,0.92), inset 0 0 44px rgba(255,255,255,0.14); }
            }

            @keyframes slowSpin {
              from { transform: rotate(0deg); }
              to { transform: rotate(360deg); }
            }

            @keyframes shimmer {
              0% { transform: translateX(-120%); }
              100% { transform: translateX(120%); }
            }
          `}</style>

          <div style={styles.backgroundOrbOne} />
          <div style={styles.backgroundOrbTwo} />
          <div style={styles.ring} />

          {confetti.length ? (
            <div style={styles.confettiLayer}>
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
                      "--drift": `${piece.drift}px`,
                    } as CSSProperties
                  }
                />
              ))}
            </div>
          ) : null}

          <div style={styles.topControls}>
            <button
              type="button"
              onClick={() => {
                const next = !soundEnabled;
                setSoundEnabled(next);

                if (!next) {
                  stopRealAudio();
                }
              }}
              style={styles.secondaryControl}
            >
              {soundEnabled ? "Sound on" : "Sound off"}
            </button>

            <button type="button" onClick={closeDraw} style={styles.closeButton}>
              Close
            </button>
          </div>

          <div style={styles.stage}>
            <p style={styles.stageEyebrow}>SO Foundation Platform</p>
            <h1 style={styles.stageTitle}>Squares Winner Draw</h1>

            <div style={styles.stageSubGrid}>
              <div style={styles.stageSubCard}>
                <span>Prize</span>
                <strong>#{prizeNumber || nextPrizeNumber}</strong>
              </div>

              <div style={styles.stageSubCard}>
                <span>Eligible</span>
                <strong>{soldNumbers.length}</strong>
              </div>

              <div style={styles.stageSubCard}>
                <span>Already drawn</span>
                <strong>{drawnPrizeNumbers.length}</strong>
              </div>
            </div>

            <div style={styles.soundModeRow}>
              <button
                type="button"
                onClick={() => {
                  if (!drawing && !saving) {
                    stopRealAudio();
                    setSoundMode("roll");
                  }
                }}
                disabled={drawing || saving}
                style={{
                  ...styles.soundModeButton,
                  background:
                    soundMode === "roll"
                      ? "rgba(250,204,21,0.24)"
                      : "rgba(255,255,255,0.08)",
                  borderColor:
                    soundMode === "roll"
                      ? "rgba(250,204,21,0.78)"
                      : "rgba(255,255,255,0.14)",
                }}
              >
                Classic Roll
              </button>

              <button
                type="button"
                onClick={() => {
                  if (!drawing && !saving) {
                    stopRealAudio();
                    setSoundMode("riser");
                  }
                }}
                disabled={drawing || saving}
                style={{
                  ...styles.soundModeButton,
                  background:
                    soundMode === "riser"
                      ? "rgba(250,204,21,0.24)"
                      : "rgba(255,255,255,0.08)",
                  borderColor:
                    soundMode === "riser"
                      ? "rgba(250,204,21,0.78)"
                      : "rgba(255,255,255,0.14)",
                }}
              >
                Cinematic Riser
              </button>
            </div>

            <label style={styles.prizeInputWrap}>
              <span>Prize number</span>
              <input
                value={prizeNumber}
                onChange={(event) => setPrizeNumber(event.target.value)}
                disabled={drawing || saving}
                inputMode="numeric"
                style={styles.prizeInput}
              />
            </label>

            <div
              style={{
                ...styles.ticketReveal,
                animation: drawing || winner ? "glowPulse 900ms infinite" : "",
              }}
            >
              <div style={styles.ticketRevealShimmer} />
              <div
                style={{
                  ...styles.ticketNumber,
                  animation: drawing ? "winnerPulse 160ms infinite" : "",
                }}
              >
                {displaySquare ? `#${displaySquare}` : "—"}
              </div>

              <div style={styles.ticketLabel}>
                {drawing
                  ? soundMode === "roll"
                    ? "Classic roll"
                    : "Cinematic riser"
                  : winner
                    ? "Winning square"
                    : "Ready to draw"}
              </div>
            </div>

            <div style={styles.resultPanel}>
              {winner ? (
                <>
                  <div style={styles.colourBadge}>Winning square</div>
                  <h2 style={styles.winnerName}>{getCustomerName(winner)}</h2>

                  {getCustomerEmail(winner) ? (
                    <p style={styles.winnerEmail}>{getCustomerEmail(winner)}</p>
                  ) : null}
                </>
              ) : (
                <>
                  <div style={styles.colourBadgeMuted}>Awaiting draw</div>
                  <h2 style={styles.winnerName}>
                    {drawing ? "Drawing..." : saving ? "Saving winner..." : "Ready"}
                  </h2>
                </>
              )}
            </div>

            {error ? <p style={styles.error}>{error}</p> : null}

            <button
              type="button"
              onClick={startDraw}
              disabled={drawing || saving || !soldNumbers.length}
              style={{
                ...styles.startButton,
                cursor:
                  drawing || saving || !soldNumbers.length ? "not-allowed" : "pointer",
                background:
                  drawing || saving || !soldNumbers.length
                    ? "#9ca3af"
                    : "linear-gradient(135deg, #facc15, #f97316)",
                boxShadow:
                  drawing || saving || !soldNumbers.length
                    ? "none"
                    : "0 20px 42px rgba(249,115,22,0.38)",
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

const styles: Record<string, CSSProperties> = {
  launchCard: {
    border: "1px solid #e2e8f0",
    borderRadius: 18,
    padding: 18,
    background:
      "linear-gradient(135deg, #ffffff 0%, #f8fafc 55%, #eff6ff 100%)",
    display: "grid",
    gap: 14,
  },
  launchTop: {
    display: "flex",
    justifyContent: "space-between",
    gap: 14,
    alignItems: "flex-start",
    flexWrap: "wrap",
  },
  eyebrow: {
    display: "inline-flex",
    padding: "5px 9px",
    borderRadius: 999,
    background: "#eff6ff",
    color: "#1d4ed8",
    border: "1px solid #bfdbfe",
    fontSize: 11,
    fontWeight: 950,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    marginBottom: 8,
  },
  title: {
    margin: 0,
    color: "#0f172a",
    fontSize: 22,
    letterSpacing: "-0.03em",
  },
  description: {
    margin: "6px 0 0",
    color: "#64748b",
    fontSize: 14,
    lineHeight: 1.45,
    maxWidth: 620,
  },
  ticketCount: {
    minWidth: 104,
    padding: "12px 14px",
    borderRadius: 18,
    background: "#0f172a",
    color: "#ffffff",
    display: "grid",
    gap: 3,
    textAlign: "center",
  },
  launchActions: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    flexWrap: "wrap",
  },
  primaryButton: {
    border: 0,
    borderRadius: 999,
    padding: "13px 18px",
    fontWeight: 950,
    color: "#ffffff",
    boxShadow: "0 12px 24px rgba(15,23,42,0.18)",
  },
  miniNote: {
    color: "#64748b",
    fontSize: 13,
    fontWeight: 800,
  },
  warning: {
    margin: 0,
    color: "#b91c1c",
    fontWeight: 800,
  },
  overlay: {
    position: "fixed",
    inset: 0,
    zIndex: 9999,
    background:
      "radial-gradient(circle at top, #334155, #111827 52%, #020617)",
    color: "#ffffff",
    display: "grid",
    placeItems: "center",
    padding: 24,
    overflow: "hidden",
  },
  backgroundOrbOne: {
    position: "absolute",
    width: "52vw",
    height: "52vw",
    left: "-18vw",
    top: "-22vw",
    borderRadius: "50%",
    background: "rgba(22,131,248,0.22)",
    filter: "blur(10px)",
  },
  backgroundOrbTwo: {
    position: "absolute",
    width: "48vw",
    height: "48vw",
    right: "-18vw",
    bottom: "-18vw",
    borderRadius: "50%",
    background: "rgba(250,204,21,0.14)",
    filter: "blur(12px)",
  },
  ring: {
    position: "absolute",
    width: "min(760px, 82vw)",
    height: "min(760px, 82vw)",
    borderRadius: "50%",
    border: "1px solid rgba(255,255,255,0.08)",
    animation: "slowSpin 24s linear infinite",
  },
  confettiLayer: {
    position: "absolute",
    inset: 0,
    pointerEvents: "none",
    overflow: "hidden",
  },
  topControls: {
    position: "absolute",
    top: 18,
    right: 18,
    display: "flex",
    gap: 10,
    zIndex: 3,
  },
  secondaryControl: {
    border: "1px solid rgba(255,255,255,0.24)",
    background: "rgba(255,255,255,0.08)",
    color: "#ffffff",
    borderRadius: 999,
    padding: "10px 14px",
    cursor: "pointer",
    fontWeight: 900,
  },
  closeButton: {
    border: "1px solid rgba(255,255,255,0.3)",
    background: "rgba(255,255,255,0.12)",
    color: "#ffffff",
    borderRadius: 999,
    padding: "10px 14px",
    cursor: "pointer",
    fontWeight: 950,
  },
  stage: {
    width: "min(860px, 100%)",
    textAlign: "center",
    position: "relative",
    zIndex: 2,
  },
  stageEyebrow: {
    margin: 0,
    color: "#facc15",
    fontSize: 13,
    fontWeight: 950,
    letterSpacing: "0.2em",
    textTransform: "uppercase",
  },
  stageTitle: {
    margin: "12px 0 18px",
    fontSize: "clamp(36px, 6vw, 72px)",
    lineHeight: 0.95,
    letterSpacing: "-0.065em",
  },
  stageSubGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: 10,
    margin: "0 auto 18px",
    maxWidth: 560,
  },
  stageSubCard: {
    display: "grid",
    gap: 3,
    padding: "10px 12px",
    borderRadius: 16,
    background: "rgba(255,255,255,0.08)",
    border: "1px solid rgba(255,255,255,0.12)",
  },
  soundModeRow: {
    display: "flex",
    justifyContent: "center",
    gap: 10,
    flexWrap: "wrap",
    margin: "0 auto 18px",
  },
  soundModeButton: {
    border: "1px solid rgba(255,255,255,0.14)",
    color: "#ffffff",
    borderRadius: 999,
    padding: "10px 14px",
    cursor: "pointer",
    fontWeight: 950,
  },
  prizeInputWrap: {
    display: "grid",
    gap: 8,
    margin: "0 auto 22px",
    maxWidth: 260,
    textAlign: "left",
    fontWeight: 900,
  },
  prizeInput: {
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.25)",
    padding: "12px 14px",
    fontSize: 18,
    fontWeight: 950,
    color: "#0f172a",
  },
  ticketReveal: {
    position: "relative",
    margin: "0 auto 18px",
    display: "grid",
    placeItems: "center",
    width: "min(360px, 72vw)",
    height: "min(360px, 72vw)",
    borderRadius: "50%",
    background:
      "radial-gradient(circle, rgba(250,204,21,0.42), rgba(249,115,22,0.18), rgba(255,255,255,0.07))",
    border: "2px solid rgba(250,204,21,0.65)",
    overflow: "hidden",
  },
  ticketRevealShimmer: {
    position: "absolute",
    inset: 0,
    background:
      "linear-gradient(90deg, transparent, rgba(255,255,255,0.18), transparent)",
    animation: "shimmer 2s ease-in-out infinite",
  },
  ticketNumber: {
    position: "relative",
    fontSize: "clamp(76px, 15vw, 130px)",
    lineHeight: 1,
    fontWeight: 950,
    letterSpacing: "-0.085em",
    textShadow: "0 0 32px rgba(250,204,21,0.9)",
  },
  ticketLabel: {
    position: "absolute",
    bottom: 42,
    left: 0,
    right: 0,
    color: "#fde68a",
    fontSize: 13,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.14em",
  },
  resultPanel: {
    minHeight: 88,
    display: "grid",
    placeItems: "center",
    gap: 6,
  },
  colourBadge: {
    display: "inline-flex",
    padding: "7px 12px",
    borderRadius: 999,
    background: "#facc15",
    color: "#111827",
    fontWeight: 950,
  },
  colourBadgeMuted: {
    display: "inline-flex",
    padding: "7px 12px",
    borderRadius: 999,
    background: "rgba(255,255,255,0.1)",
    color: "#cbd5e1",
    fontWeight: 950,
  },
  winnerName: {
    margin: 0,
    fontSize: "clamp(28px, 4vw, 44px)",
    lineHeight: 1.05,
    letterSpacing: "-0.03em",
  },
  winnerEmail: {
    margin: 0,
    color: "#cbd5e1",
  },
  error: {
    margin: "14px auto 0",
    color: "#fecaca",
    maxWidth: 520,
    fontWeight: 900,
  },
  startButton: {
    marginTop: 24,
    border: 0,
    borderRadius: 18,
    padding: "17px 28px",
    fontSize: 18,
    fontWeight: 950,
    color: "#111827",
  },
};
