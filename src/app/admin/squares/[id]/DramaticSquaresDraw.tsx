"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";

type SoldSquareOption = {
  squareNumber?: number;
  square_number?: number;
  customerName?: string;
  customer_name?: string;
  customerEmail?: string;
  customer_email?: string;
};

type PrizeOption = {
  position?: number;
  title?: string;
};

type DramaticSquaresDrawProps = {
  gameId: string;
  soldSquareOptions: SoldSquareOption[];
  prizes?: PrizeOption[];
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

type RecentDraw = {
  prizeNumber: number;
  prizeTitle: string;
  squareNumber: number;
  customerName: string;
  customerEmail: string;
};

type SoundMode = "roll" | "riser";

const DRAW_DURATION_MS = 3600;

const SOUND_PATHS = {
  roll: "/brand/draw-roll.wav",
  riser: "/brand/draw-riser.mp3",
  winner: "/brand/draw-winner.mp3",
};

function uniqueNumbers(values: number[]) {
  return Array.from(
    new Set(
      values
        .map((value) => Number(value))
        .filter((value) => Number.isFinite(value) && value > 0),
    ),
  );
}

function getSquareNumber(item: SoldSquareOption) {
  return Number(item.squareNumber ?? item.square_number);
}

function getCustomerName(item: SoldSquareOption | null) {
  return item?.customerName ?? item?.customer_name ?? "Winner";
}

function getCustomerEmail(item: SoldSquareOption | null) {
  return item?.customerEmail ?? item?.customer_email ?? "";
}

function ordinal(value: number) {
  const mod10 = value % 10;
  const mod100 = value % 100;

  if (mod10 === 1 && mod100 !== 11) return "st";
  if (mod10 === 2 && mod100 !== 12) return "nd";
  if (mod10 === 3 && mod100 !== 13) return "rd";

  return "th";
}

function getPrizeTitle(prizes: PrizeOption[], prizeNumber: number) {
  const matchingPrize = prizes.find(
    (prize, index) => Number(prize.position ?? index + 1) === prizeNumber,
  );

  return (
    String(matchingPrize?.title || "").trim() ||
    `${prizeNumber}${ordinal(prizeNumber)} Prize`
  );
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
  prizes = [],
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
  const [localDrawnPrizeNumbers, setLocalDrawnPrizeNumbers] = useState<number[]>(
    () => uniqueNumbers(drawnPrizeNumbers),
  );
  const [localDrawnSquareNumbers, setLocalDrawnSquareNumbers] =
    useState<number[]>(() => uniqueNumbers(drawnSquareNumbers));
  const [recentDraws, setRecentDraws] = useState<RecentDraw[]>([]);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const finishTimeoutRef = useRef<number | null>(null);

  const rollAudioRef = useRef<HTMLAudioElement | null>(null);
  const riserAudioRef = useRef<HTMLAudioElement | null>(null);
  const winnerAudioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    setLocalDrawnPrizeNumbers((current) =>
      uniqueNumbers([...current, ...drawnPrizeNumbers]),
    );
  }, [drawnPrizeNumbers]);

  useEffect(() => {
    setLocalDrawnSquareNumbers((current) =>
      uniqueNumbers([...current, ...drawnSquareNumbers]),
    );
  }, [drawnSquareNumbers]);

  const soldNumbers = useMemo(
    () =>
      soldSquareOptions
        .map(getSquareNumber)
        .filter(
          (number) =>
            Number.isFinite(number) &&
            number > 0 &&
            !localDrawnSquareNumbers.includes(number),
        ),
    [soldSquareOptions, localDrawnSquareNumbers],
  );

  const nextPrizeNumber = useMemo(() => {
    let position = 1;

    while (localDrawnPrizeNumbers.includes(position)) {
      position += 1;
    }

    return position;
  }, [localDrawnPrizeNumbers]);

  const currentPrizeTitle = useMemo(() => {
    const parsed = Number(prizeNumber || nextPrizeNumber);
    return getPrizeTitle(prizes, parsed);
  }, [prizes, prizeNumber, nextPrizeNumber]);

  const nextPrizeTitle = useMemo(
    () => getPrizeTitle(prizes, nextPrizeNumber),
    [prizes, nextPrizeNumber],
  );

  const selectedPrizeAlreadyDrawn = useMemo(() => {
    const parsed = Number(prizeNumber);
    return (
      Number.isFinite(parsed) &&
      parsed > 0 &&
      localDrawnPrizeNumbers.includes(parsed)
    );
  }, [localDrawnPrizeNumbers, prizeNumber]);

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

  async function saveDrawBeforeAnimation(
    parsedPrizeNumber: number,
    winningSquareNumber: number,
  ) {
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

    return data;
  }

  async function startDraw() {
    const parsedPrizeNumber = Number(prizeNumber);

    if (!Number.isFinite(parsedPrizeNumber) || parsedPrizeNumber <= 0) {
      setError("Enter a valid prize number.");
      return;
    }

    if (localDrawnPrizeNumbers.includes(parsedPrizeNumber)) {
      setError(`${currentPrizeTitle} has already been drawn.`);
      setPrizeNumber(String(nextPrizeNumber));
      return;
    }

    if (!soldNumbers.length || drawing || saving) {
      return;
    }

    clearAllTimers();
    stopRealAudio();

    setError("");
    setWinner(null);
    setConfetti([]);
    setDrawing(false);
    setSaving(true);

    const winningSquareNumber =
      soldNumbers[Math.floor(Math.random() * soldNumbers.length)];

    const matchedWinner =
      soldSquareOptions.find(
        (item) => getSquareNumber(item) === winningSquareNumber,
      ) || null;

    try {
      await saveDrawBeforeAnimation(parsedPrizeNumber, winningSquareNumber);
    } catch (err) {
      setSaving(false);
      setDrawing(false);

      const message = err instanceof Error ? err.message : "Draw failed";

      setError(message);

      if (message.toLowerCase().includes("already")) {
        setLocalDrawnPrizeNumbers((current) =>
          uniqueNumbers([...current, parsedPrizeNumber]),
        );
        setPrizeNumber(String(nextPrizeNumber));
      }

      return;
    }

    setSaving(false);
    setDrawing(true);

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
      const randomSquare =
        soldNumbers[Math.floor(Math.random() * soldNumbers.length)];

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

      setDisplaySquare(winningSquareNumber);
      setWinner(matchedWinner);
      setDrawing(false);
      setSaving(false);
      setConfetti(makeConfetti());

      setLocalDrawnPrizeNumbers((current) =>
        uniqueNumbers([...current, parsedPrizeNumber]),
      );
      setLocalDrawnSquareNumbers((current) =>
        uniqueNumbers([...current, winningSquareNumber]),
      );

      setRecentDraws((current) => [
        {
          prizeNumber: parsedPrizeNumber,
          prizeTitle: currentPrizeTitle,
          squareNumber: winningSquareNumber,
          customerName: getCustomerName(matchedWinner),
          customerEmail: getCustomerEmail(matchedWinner),
        },
        ...current,
      ]);

      setPrizeNumber(String(parsedPrizeNumber + 1));

     stopRealAudio();

const winnerStarted = await playRealSound("winner");

      if (!winnerStarted && audioCtx) {
        playWinnerFallback(audioCtx);
      }
    }, DRAW_DURATION_MS);
  }

  return (
    <>
      <style jsx global>{`
        @keyframes confettiFall {
          0% {
            transform: translate3d(0, -12vh, 0) rotate(0deg);
            opacity: 1;
          }
          100% {
            transform: translate3d(var(--drift), 112vh, 0) rotate(720deg);
            opacity: 0;
          }
        }

        @keyframes glowPulse {
          0%,
          100% {
            box-shadow: 0 0 24px rgba(250, 204, 21, 0.32);
            transform: scale(1);
          }
          50% {
            box-shadow: 0 0 64px rgba(250, 204, 21, 0.68);
            transform: scale(1.015);
          }
        }
      `}</style>

      <section style={styles.launchCard}>
        <div style={styles.launchTop}>
          <div>
            <div style={styles.eyebrow}>Live event mode</div>

            <h2 style={styles.title}>Dramatic draw</h2>

            <p style={styles.description}>
              Choose Classic Roll or Cinematic Riser, then open a full-screen
              squares draw with winner reveal, prize display, saving and
              confetti.
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

          <span style={styles.miniNote}>Next prize: {nextPrizeTitle}</span>
        </div>

        {!soldNumbers.length ? (
          <p style={styles.warning}>No eligible sold squares available.</p>
        ) : null}

        {recentDraws.length ? (
          <div style={styles.recentPanel}>
            <strong>Drawn in this live session</strong>
            {recentDraws.map((draw) => (
              <div
                key={`${draw.prizeNumber}-${draw.squareNumber}`}
                style={styles.recentItem}
              >
                <span>
                  {draw.prizeTitle}: square #{draw.squareNumber}
                </span>
                <span>{draw.customerName}</span>
              </div>
            ))}
          </div>
        ) : null}
      </section>

      {isOpen ? (
        <div style={styles.overlay}>
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
                      background: `hsl(${piece.hue},92%,58%)`,
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

            <div style={styles.prizeBanner}>
              <span style={styles.prizeBannerLabel}>Current prize</span>

              <strong style={styles.prizeBannerTitle}>
                {currentPrizeTitle}
              </strong>
            </div>

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
                <strong>{localDrawnPrizeNumbers.length}</strong>
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
                }}
              >
                Cinematic Riser
              </button>
            </div>

            <label style={styles.prizeInputWrap}>
              <span>Prize number</span>

              <input
                value={prizeNumber}
                onChange={(event) => {
                  setPrizeNumber(event.target.value);
                  setError("");
                }}
                disabled={drawing || saving}
                inputMode="numeric"
                style={{
                  ...styles.prizeInput,
                  borderColor: selectedPrizeAlreadyDrawn
                    ? "#fecaca"
                    : "rgba(255,255,255,0.25)",
                }}
              />
            </label>

            {selectedPrizeAlreadyDrawn ? (
              <p style={styles.alreadyDrawnNotice}>
                {currentPrizeTitle} has already been drawn. The next available
                prize is {nextPrizeTitle}.
              </p>
            ) : null}

            <div
              style={{
                ...styles.ticketReveal,
                animation: drawing || winner ? "glowPulse 900ms infinite" : "",
              }}
            >
              <div style={styles.ticketNumber}>
                {displaySquare ? `#${displaySquare}` : "—"}
              </div>

              <div style={styles.ticketLabel}>
                {drawing
                  ? "Drawing..."
                  : winner
                    ? currentPrizeTitle
                    : saving
                      ? "Checking draw..."
                      : "Ready to draw"}
              </div>
            </div>

            <div style={styles.resultPanel}>
              {winner ? (
                <>
                  <div style={styles.colourBadge}>{currentPrizeTitle}</div>

                  <h2 style={styles.winnerName}>{getCustomerName(winner)}</h2>

                  {getCustomerEmail(winner) ? (
                    <p style={styles.winnerEmail}>{getCustomerEmail(winner)}</p>
                  ) : null}
                </>
              ) : (
                <>
                  <div style={styles.colourBadgeMuted}>Awaiting draw</div>

                  <h2 style={styles.winnerName}>{currentPrizeTitle}</h2>
                </>
              )}
            </div>

            {recentDraws.length ? (
              <div style={styles.liveHistoryPanel}>
                <strong>Live draw results</strong>
                {recentDraws.slice(0, 5).map((draw) => (
                  <div
                    key={`live-${draw.prizeNumber}-${draw.squareNumber}`}
                    style={styles.liveHistoryItem}
                  >
                    <span>{draw.prizeTitle}</span>
                    <span>
                      #{draw.squareNumber} · {draw.customerName}
                    </span>
                  </div>
                ))}
              </div>
            ) : null}

            {error ? <p style={styles.error}>{error}</p> : null}

            <button
              type="button"
              onClick={startDraw}
              disabled={
                drawing || saving || !soldNumbers.length || selectedPrizeAlreadyDrawn
              }
              style={{
                ...styles.startButton,
                opacity:
                  drawing ||
                  saving ||
                  !soldNumbers.length ||
                  selectedPrizeAlreadyDrawn
                    ? 0.62
                    : 1,
                cursor:
                  drawing ||
                  saving ||
                  !soldNumbers.length ||
                  selectedPrizeAlreadyDrawn
                    ? "not-allowed"
                    : "pointer",
              }}
            >
              {drawing
                ? "Drawing..."
                : saving
                  ? "Checking..."
                  : selectedPrizeAlreadyDrawn
                    ? "Prize already drawn"
                    : `Draw ${currentPrizeTitle}`}
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
      "linear-gradient(135deg,#ffffff 0%,#f8fafc 55%,#eff6ff 100%)",
    display: "grid",
    gap: 14,
  },

  launchTop: {
    display: "flex",
    justifyContent: "space-between",
    gap: 14,
    flexWrap: "wrap",
  },

  eyebrow: {
    fontSize: 11,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    color: "#1d4ed8",
  },

  title: {
    margin: "8px 0",
    fontSize: 24,
    fontWeight: 950,
    color: "#0f172a",
  },

  description: {
    margin: 0,
    color: "#64748b",
    lineHeight: 1.5,
  },

  ticketCount: {
    textAlign: "center",
    display: "grid",
    gap: 2,
    color: "#0f172a",
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
    padding: "14px 18px",
    color: "#ffffff",
    fontWeight: 950,
  },

  miniNote: {
    color: "#64748b",
    fontWeight: 800,
  },

  warning: {
    margin: 0,
    color: "#b91c1c",
    fontWeight: 800,
  },

  recentPanel: {
    borderTop: "1px solid #e2e8f0",
    paddingTop: 12,
    display: "grid",
    gap: 8,
    color: "#0f172a",
  },

  recentItem: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    padding: "8px 10px",
    borderRadius: 12,
    background: "rgba(255,255,255,0.72)",
    color: "#334155",
    fontSize: 13,
    fontWeight: 800,
  },

  overlay: {
    position: "fixed",
    inset: 0,
    zIndex: 9999,
    background:
      "radial-gradient(circle at top,#334155,#111827 52%,#020617)",
    color: "#ffffff",
    display: "grid",
    placeItems: "center",
    overflow: "auto",
    padding: 24,
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
    width: "min(760px,82vw)",
    height: "min(760px,82vw)",
    borderRadius: "50%",
    border: "1px solid rgba(255,255,255,0.08)",
  },

  confettiLayer: {
    position: "absolute",
    inset: 0,
    pointerEvents: "none",
  },

  topControls: {
    position: "fixed",
    top: 18,
    right: 18,
    display: "flex",
    gap: 10,
    zIndex: 5,
  },

  secondaryControl: {
    border: "1px solid rgba(255,255,255,0.24)",
    background: "rgba(255,255,255,0.08)",
    color: "#ffffff",
    borderRadius: 999,
    padding: "10px 14px",
    fontWeight: 900,
  },

  closeButton: {
    border: "1px solid rgba(255,255,255,0.24)",
    background: "rgba(255,255,255,0.08)",
    color: "#ffffff",
    borderRadius: 999,
    padding: "10px 14px",
    fontWeight: 900,
  },

  stage: {
    width: "min(860px,100%)",
    textAlign: "center",
    position: "relative",
    zIndex: 2,
    paddingTop: 58,
    paddingBottom: 32,
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
    fontSize: "clamp(36px,6vw,72px)",
    lineHeight: 0.95,
    fontWeight: 950,
  },

  prizeBanner: {
    margin: "0 auto 20px",
    maxWidth: 620,
    padding: "16px 20px",
    borderRadius: 22,
    background:
      "linear-gradient(135deg, rgba(250,204,21,0.22), rgba(249,115,22,0.16))",
    border: "1px solid rgba(250,204,21,0.45)",
  },

  prizeBannerLabel: {
    display: "block",
    color: "#fde68a",
    fontSize: 12,
    fontWeight: 900,
    textTransform: "uppercase",
    letterSpacing: "0.14em",
    marginBottom: 6,
  },

  prizeBannerTitle: {
    display: "block",
    color: "#ffffff",
    fontSize: "clamp(24px,4vw,40px)",
    lineHeight: 1.05,
    fontWeight: 950,
  },

  stageSubGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3,minmax(0,1fr))",
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
    marginBottom: 18,
    flexWrap: "wrap",
  },

  soundModeButton: {
    border: "1px solid rgba(255,255,255,0.14)",
    color: "#ffffff",
    borderRadius: 999,
    padding: "10px 14px",
    fontWeight: 950,
  },

  prizeInputWrap: {
    display: "grid",
    gap: 8,
    margin: "0 auto 10px",
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

  alreadyDrawnNotice: {
    margin: "0 auto 16px",
    maxWidth: 560,
    color: "#fecaca",
    fontWeight: 900,
  },

  ticketReveal: {
    margin: "0 auto 18px",
    display: "grid",
    placeItems: "center",
    width: "min(360px,72vw)",
    height: "min(360px,72vw)",
    borderRadius: "50%",
    background:
      "radial-gradient(circle, rgba(250,204,21,0.42), rgba(249,115,22,0.18), rgba(255,255,255,0.07))",
    border: "2px solid rgba(250,204,21,0.65)",
  },

  ticketNumber: {
    fontSize: "clamp(76px,15vw,130px)",
    lineHeight: 1,
    fontWeight: 950,
  },

  ticketLabel: {
    marginTop: 12,
    color: "#fde68a",
    fontSize: 13,
    fontWeight: 950,
    textTransform: "uppercase",
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
    fontSize: "clamp(28px,4vw,44px)",
    lineHeight: 1.05,
    fontWeight: 950,
  },

  winnerEmail: {
    margin: 0,
    color: "#cbd5e1",
  },

  liveHistoryPanel: {
    margin: "18px auto 0",
    maxWidth: 560,
    display: "grid",
    gap: 8,
    padding: 12,
    borderRadius: 18,
    background: "rgba(255,255,255,0.08)",
    border: "1px solid rgba(255,255,255,0.12)",
    textAlign: "left",
  },

  liveHistoryItem: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    color: "#e2e8f0",
    fontSize: 13,
    fontWeight: 800,
  },

  error: {
    marginTop: 14,
    color: "#fecaca",
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
    background: "linear-gradient(135deg, #facc15, #f97316)",
  },
};
