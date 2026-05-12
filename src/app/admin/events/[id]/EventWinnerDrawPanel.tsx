"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";

type EventPrize = {
  id?: string;
  position?: number;
  title?: string;
  name?: string;
};

type EventWinner = {
  id: string;
  prize_id: string | null;
  prize_title: string;
  prize_position: number | null;
  draw_scope: string;
  table_number: string | null;
  row_label: string | null;
  seat_number: string | null;
  winner_name: string | null;
  winner_email: string | null;
  status: string;
  drawn_at: string;
  created_at: string;
};

type WinnerPayload = {
  id?: string;
  prize_id?: string | null;
  prize_title?: string | null;
  prize_position?: number | null;
  winner_name?: string | null;
  winner_email?: string | null;
  table_number?: string | null;
  row_label?: string | null;
  seat_number?: string | null;
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

function prizeTitle(prize: EventPrize) {
  return String(prize.title || prize.name || "").trim();
}

function prizePosition(prize: EventPrize, index: number) {
  const position = Number(prize.position);

  return Number.isFinite(position) && position > 0
    ? Math.floor(position)
    : index + 1;
}

function prizeId(prize: EventPrize, index: number) {
  return String(prize.id || `prize-${index + 1}`);
}

function prizePayload(prize: EventPrize, index: number) {
  return JSON.stringify({
    id: prizeId(prize, index),
    title: prizeTitle(prize),
    position: prizePosition(prize, index),
  });
}

function buildAllPrizesPayload(prizes: EventPrize[]) {
  return JSON.stringify(
    prizes
      .map((prize, index) => ({
        id: prizeId(prize, index),
        title: prizeTitle(prize),
        position: prizePosition(prize, index),
      }))
      .filter((prize) => prize.title),
  );
}

function formatWinnerSeat(winner: {
  table_number?: string | null;
  row_label?: string | null;
  seat_number?: string | null;
}) {
  if (winner.table_number) {
    return `Table ${winner.table_number}${
      winner.seat_number ? ` · Seat ${winner.seat_number}` : ""
    }`;
  }

  if (winner.row_label || winner.seat_number) {
    return `Row ${winner.row_label || "-"} · Seat ${winner.seat_number || "-"}`;
  }

  return "General admission";
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

function numberOrZero(value: string) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.max(0, Math.floor(number));
}

export default function EventWinnerDrawPanel({
  eventId,
  eventType,
  prizes,
  winners,
  deleteWinnerAction,
  clearWinnersAction,
}: {
  eventId: string;
  eventType: "general_admission" | "reserved_seating" | "tables";
  prizes: EventPrize[];
  winners: EventWinner[];
  drawWinnerAction?: (formData: FormData) => void | Promise<void>;
  deleteWinnerAction: (formData: FormData) => void | Promise<void>;
  clearWinnersAction: (formData: FormData) => void | Promise<void>;
}) {
  const formRef = useRef<HTMLFormElement | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
 const finishTimeoutRef = useRef<ReturnType<typeof window.setTimeout> | null>(
  null,
);
const reloadTimeoutRef = useRef<ReturnType<typeof window.setTimeout> | null>(
  null,
);

  const rollAudioRef = useRef<HTMLAudioElement | null>(null);
  const riserAudioRef = useRef<HTMLAudioElement | null>(null);
  const winnerAudioRef = useRef<HTMLAudioElement | null>(null);

  const [selectedPrizeKey, setSelectedPrizeKey] = useState("");
  const [drawMode, setDrawMode] = useState<"single" | "all_remaining">(
    "single",
  );
  const [autoFromPosition, setAutoFromPosition] = useState("");
  const [autoToPosition, setAutoToPosition] = useState("");
  const [drawOverlayOpen, setDrawOverlayOpen] = useState(false);
  const [drawing, setDrawing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [autoDrawing, setAutoDrawing] = useState(false);
  const [displayText, setDisplayText] = useState("—");
  const [displayPrize, setDisplayPrize] = useState("Ready");
  const [error, setError] = useState("");
  const [confetti, setConfetti] = useState<ConfettiPiece[]>([]);
  const [revealedWinner, setRevealedWinner] = useState<WinnerPayload | null>(
    null,
  );
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [soundMode, setSoundMode] = useState<SoundMode>("roll");

  const validPrizes = useMemo(
    () => prizes.filter((prize) => prizeTitle(prize)),
    [prizes],
  );

  const drawnPrizeIds = useMemo(
    () =>
      new Set(
        winners
          .filter((winner) => winner.status === "drawn")
          .map((winner) => String(winner.prize_id || "").trim())
          .filter(Boolean),
      ),
    [winners],
  );

  const remainingPrizes = useMemo(
    () =>
      validPrizes.filter(
        (prize, index) => !drawnPrizeIds.has(prizeId(prize, index)),
      ),
    [validPrizes, drawnPrizeIds],
  );

  const automatedRangePrizes = useMemo(() => {
    const from = numberOrZero(autoFromPosition);
    const to = numberOrZero(autoToPosition);

    return remainingPrizes.filter((prize) => {
      const index = validPrizes.findIndex((item) => item === prize);
      const position = prizePosition(prize, index);

      if (from > 0 && position < from) return false;
      if (to > 0 && position > to) return false;

      return true;
    });
  }, [autoFromPosition, autoToPosition, remainingPrizes, validPrizes]);

  const firstRemainingPrize = remainingPrizes[0];
  const firstRemainingIndex = firstRemainingPrize
    ? validPrizes.findIndex((prize) => prize === firstRemainingPrize)
    : -1;

  const defaultPrizeKey =
    firstRemainingPrize && firstRemainingIndex >= 0
      ? prizePayload(firstRemainingPrize, firstRemainingIndex)
      : "";

  const activePrizeKey = selectedPrizeKey || defaultPrizeKey;

  const selectedPrizeLabel = useMemo(() => {
    if (drawMode === "all_remaining") return "Automated prize range";

    const selectedIndex = validPrizes.findIndex(
      (prize, index) => prizePayload(prize, index) === activePrizeKey,
    );

    if (selectedIndex < 0) return "Selected prize";

    const prize = validPrizes[selectedIndex];

    return `${prizePosition(prize, selectedIndex)}. ${prizeTitle(prize)}`;
  }, [activePrizeKey, drawMode, validPrizes]);

  const latestWinner = winners[0] || null;
  const hasPrizes = validPrizes.length > 0;
  const hasRemainingPrizes = remainingPrizes.length > 0;
  const hasAutomatedRangePrizes = automatedRangePrizes.length > 0;

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

  function clearDrawTimers() {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    if (finishTimeoutRef.current) {
      window.clearTimeout(finishTimeoutRef.current);
      finishTimeoutRef.current = null;
    }

    if (reloadTimeoutRef.current) {
      window.clearTimeout(reloadTimeoutRef.current);
      reloadTimeoutRef.current = null;
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

  function closeDraw() {
    clearDrawTimers();
    stopRealAudio();
    setDrawOverlayOpen(false);
    setDrawing(false);
    setSaving(false);
    setConfetti([]);
  }

  function randomDisplayValue() {
    if (eventType === "tables") {
      return `T${Math.floor(Math.random() * 24) + 1} · S${
        Math.floor(Math.random() * 12) + 1
      }`;
    }

    if (eventType === "reserved_seating") {
      const row = String.fromCharCode(65 + Math.floor(Math.random() * 16));
      return `${row}${Math.floor(Math.random() * 40) + 1}`;
    }

    return `#${Math.floor(Math.random() * 9999) + 1}`;
  }

  function randomPrizeText() {
    if (drawMode === "all_remaining") {
      const prize =
        automatedRangePrizes[
          Math.floor(Math.random() * automatedRangePrizes.length)
        ];

      if (!prize) return "Automated prize range";

      const index = validPrizes.findIndex((item) => item === prize);
      return `${prizePosition(prize, index)}. ${prizeTitle(prize)}`;
    }

    return selectedPrizeLabel;
  }

  function buildDrawFormData(checkOnly = false) {
    const form = formRef.current;

    if (!form) {
      throw new Error("Draw form was not found.");
    }

    const formData = new FormData(form);
    formData.set("event_id", eventId);
    formData.set("draw_mode", drawMode);
    formData.set("all_prizes", buildAllPrizesPayload(validPrizes));
    formData.set("auto_from_position", autoFromPosition || "");
    formData.set("auto_to_position", autoToPosition || "");

    if (checkOnly) {
      formData.set("check_only", "yes");
    }

    return formData;
  }

  async function checkEligibility() {
    const formData = buildDrawFormData(true);

    const response = await fetch(`/api/admin/events/${eventId}/draw`, {
      method: "POST",
      body: formData,
    });

    const data = await response.json().catch(() => null);

    if (!response.ok || data?.ok === false) {
      throw new Error(data?.error || "Could not check eligible winners.");
    }

    const eligibleCount = Number(data?.eligibleCount || 0);

    if (!Number.isFinite(eligibleCount) || eligibleCount <= 0) {
      throw new Error("No eligible winner found for this draw.");
    }

    return eligibleCount;
  }

  function validateDraw() {
    if (!hasPrizes) {
      throw new Error("Add prizes in the Prizes section before running a draw.");
    }

    if (!hasRemainingPrizes) {
      throw new Error("There are no remaining prizes to draw.");
    }

    if (drawMode === "single" && !activePrizeKey) {
      throw new Error("Choose a prize before running the draw.");
    }

    if (drawMode === "all_remaining") {
      const from = numberOrZero(autoFromPosition);
      const to = numberOrZero(autoToPosition);

      if (from > 0 && to > 0 && from > to) {
        throw new Error("Automated prize range cannot start after it ends.");
      }

      if (!hasAutomatedRangePrizes) {
        throw new Error("No remaining prizes found in this automated range.");
      }
    }
  }

  async function saveWinnerFromApi() {
    const formData = buildDrawFormData(false);

    const response = await fetch(`/api/admin/events/${eventId}/draw`, {
      method: "POST",
      body: formData,
    });

    const data = await response.json().catch(() => null);

    if (!response.ok || data?.ok === false) {
      throw new Error(data?.error || "Draw failed.");
    }

    const winner =
      drawMode === "all_remaining"
        ? data?.winners?.[0] || null
        : data?.winner || null;

    if (!winner) {
      throw new Error("Draw completed but no winner was returned.");
    }

    return {
      id: winner?.id,
      prize_id: winner?.prize_id,
      prize_title: winner?.prize_title,
      prize_position: winner?.prize_position,
      winner_name: winner?.winner_name || "Winner",
      winner_email: winner?.winner_email || "",
      table_number: winner?.table_number || null,
      row_label: winner?.row_label || null,
      seat_number: winner?.seat_number || null,
    } satisfies WinnerPayload;
  }

  async function runAutomaticDraw() {
    if (drawing || saving || autoDrawing) return;

    try {
      setError("");
      setAutoDrawing(true);
      validateDraw();
      await checkEligibility();

      const winnerPayload = await saveWinnerFromApi();

      setRevealedWinner(winnerPayload);
      setDisplayText("WINNER");
      setDisplayPrize(
        winnerPayload.prize_position
          ? `${winnerPayload.prize_position}. ${
              winnerPayload.prize_title || "Prize"
            }`
          : winnerPayload.prize_title || selectedPrizeLabel,
      );
      setConfetti(makeConfetti());

      const audioCtx = await unlockAudio();
      const winnerStarted = await playRealSound("winner");

      if (!winnerStarted && audioCtx) {
        playWinnerFallback(audioCtx);
      }

      reloadTimeoutRef.current = window.setTimeout(() => {
        window.location.reload();
      }, 1600);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Draw failed.");
    } finally {
      setAutoDrawing(false);
    }
  }

  async function openDramaticDraw() {
    if (drawing || saving || autoDrawing) return;

    try {
      setError("");
      validateDraw();
      await checkEligibility();

      clearDrawTimers();
      stopRealAudio();

      setDrawOverlayOpen(true);
      setDrawing(false);
      setSaving(false);
      setRevealedWinner(null);
      setConfetti([]);
      setDisplayText("—");
      setDisplayPrize(selectedPrizeLabel);

      getAudioElements();
      await unlockAudio();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No eligible winner found.");
    }
  }

  async function runDramaticDraw() {
    if (drawing || saving || autoDrawing) return;

    try {
      setError("");
      validateDraw();
      await checkEligibility();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No eligible winner found.");
      return;
    }

    clearDrawTimers();
    stopRealAudio();

    setDrawing(true);
    setSaving(false);
    setRevealedWinner(null);
    setConfetti([]);
    setDisplayText("—");
    setDisplayPrize(selectedPrizeLabel);

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
      setDisplayText(randomDisplayValue());
      setDisplayPrize(randomPrizeText());

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
          setDisplayText(randomDisplayValue());
          setDisplayPrize(randomPrizeText());

          if (!introStarted && audioCtx) {
            playTickFallback(audioCtx);
          }

          ticks += 1;
        }, intervalMs);
      }
    }, intervalMs);

    finishTimeoutRef.current = window.setTimeout(async () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }

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

      setDrawing(false);
      setSaving(true);

      try {
        const winnerPayload = await saveWinnerFromApi();

        setRevealedWinner(winnerPayload);
        setDisplayText("WINNER");
        setDisplayPrize(
          winnerPayload.prize_position
            ? `${winnerPayload.prize_position}. ${
                winnerPayload.prize_title || "Prize"
              }`
            : winnerPayload.prize_title || selectedPrizeLabel,
        );
        setSaving(false);
        setConfetti(makeConfetti());

        const winnerStarted = await playRealSound("winner");

        if (!winnerStarted && audioCtx) {
          playWinnerFallback(audioCtx);
        }

        reloadTimeoutRef.current = window.setTimeout(() => {
          window.location.reload();
        }, 2600);
      } catch (err) {
        setSaving(false);
        setError(err instanceof Error ? err.message : "Draw failed.");
        setDisplayText("ERROR");
      }
    }, DRAW_DURATION_MS);
  }

  useEffect(() => {
    return () => {
      clearDrawTimers();
      stopRealAudio();
    };
  }, []);

  return (
    <section style={styles.section}>
      <div style={styles.sectionHeader}>
        <p style={styles.sectionEyebrow}>Draw centre</p>
        <h2 style={styles.sectionTitle}>Event Winner Draw</h2>
        <p style={styles.sectionText}>
          Draw winners from eligible paid event entries only. Use Classic Roll or
          Cinematic Riser for a full-screen live draw.
        </p>
      </div>

      <div style={styles.statsGrid}>
        <div style={styles.statBox}>
          <p style={styles.statLabel}>Prizes</p>
          <p style={styles.statValue}>{validPrizes.length}</p>
        </div>

        <div style={styles.statBox}>
          <p style={styles.statLabel}>Remaining</p>
          <p style={styles.statValue}>{remainingPrizes.length}</p>
        </div>

        <div style={styles.statBox}>
          <p style={styles.statLabel}>Automated range</p>
          <p style={styles.statValue}>{automatedRangePrizes.length}</p>
        </div>

        <div style={styles.statBox}>
          <p style={styles.statLabel}>Winners</p>
          <p style={styles.statValue}>{winners.length}</p>
        </div>
      </div>

      {latestWinner ? (
        <div style={styles.latestWinnerBox}>
          <p style={styles.latestWinnerLabel}>Latest winner</p>
          <h3 style={styles.latestWinnerName}>
            {latestWinner.winner_name || "Unnamed winner"}
          </h3>
          <p style={styles.latestWinnerMeta}>
            {latestWinner.prize_position ? `${latestWinner.prize_position}. ` : ""}
            {latestWinner.prize_title} · {formatWinnerSeat(latestWinner)}
          </p>
        </div>
      ) : null}

      {revealedWinner && !drawOverlayOpen ? (
        <div style={styles.latestWinnerBox}>
          <p style={styles.latestWinnerLabel}>New winner</p>
          <h3 style={styles.latestWinnerName}>
            {revealedWinner.winner_name || "Winner"}
          </h3>
          <p style={styles.latestWinnerMeta}>
            {revealedWinner.prize_position
              ? `${revealedWinner.prize_position}. `
              : ""}
            {revealedWinner.prize_title || "Prize"} ·{" "}
            {formatWinnerSeat(revealedWinner)}
          </p>
        </div>
      ) : null}

      <div style={styles.grid}>
        <form
          ref={formRef}
          action="#"
          onSubmit={(event) => {
            event.preventDefault();
            void openDramaticDraw();
          }}
          style={styles.panel}
        >
          <input type="hidden" name="event_id" value={eventId} />
          <input type="hidden" name="draw_mode" value={drawMode} />

          <div>
            <h3 style={styles.panelTitle}>Draw controls</h3>
            <p style={styles.sectionText}>
              Choose one prize, or draw all remaining prizes within a selected
              position range.
            </p>
          </div>

          {!hasPrizes ? (
            <div style={styles.emptyBox}>
              Add prizes in the Prizes section before running a draw.
            </div>
          ) : (
            <>
              <label style={styles.field}>
                <span style={styles.label}>Prize to draw</span>
                <select
                  name="prize_key"
                  value={activePrizeKey}
                  onChange={(event) => setSelectedPrizeKey(event.target.value)}
                  style={styles.input}
                  required={drawMode === "single"}
                  disabled={drawMode === "all_remaining"}
                >
                  <option value="">Choose a prize</option>
                  {validPrizes.map((prize, index) => {
                    const id = prizeId(prize, index);
                    const alreadyDrawn = drawnPrizeIds.has(id);

                    return (
                      <option
                        key={id}
                        value={prizePayload(prize, index)}
                        disabled={alreadyDrawn}
                      >
                        {prizePosition(prize, index)}. {prizeTitle(prize)}
                        {alreadyDrawn ? " — already drawn" : ""}
                      </option>
                    );
                  })}
                </select>
              </label>

              <label style={styles.field}>
                <span style={styles.label}>Draw type</span>
                <select
                  value={drawMode}
                  onChange={(event) =>
                    setDrawMode(event.target.value as "single" | "all_remaining")
                  }
                  style={styles.input}
                >
                  <option value="single">Draw selected prize</option>
                  <option value="all_remaining">Draw automated prize range</option>
                </select>
              </label>

              {drawMode === "all_remaining" && (
                <div style={styles.rangeBox}>
                  <div>
                    <h3 style={styles.panelTitle}>Automated prize range</h3>
                    <p style={styles.sectionText}>
                      Choose which prize positions should be drawn automatically.
                      Example: from 6 to 999 leaves prizes 1–5 for a live draw.
                    </p>
                  </div>

                  <div style={styles.twoCol}>
                    <label style={styles.field}>
                      <span style={styles.label}>Draw prizes from position</span>
                      <input
                        name="auto_from_position"
                        type="number"
                        min="1"
                        value={autoFromPosition}
                        onChange={(event) =>
                          setAutoFromPosition(event.target.value)
                        }
                        placeholder="6"
                        style={styles.input}
                      />
                    </label>

                    <label style={styles.field}>
                      <span style={styles.label}>Draw prizes to position</span>
                      <input
                        name="auto_to_position"
                        type="number"
                        min="1"
                        value={autoToPosition}
                        onChange={(event) => setAutoToPosition(event.target.value)}
                        placeholder="999"
                        style={styles.input}
                      />
                    </label>
                  </div>

                  <div style={styles.rangeSummary}>
                    {hasAutomatedRangePrizes
                      ? `${automatedRangePrizes.length} remaining prize${
                          automatedRangePrizes.length === 1 ? "" : "s"
                        } in this automated range.`
                      : "No remaining prizes in this automated range."}
                  </div>
                </div>
              )}

              <label style={styles.field}>
                <span style={styles.label}>Draw scope</span>
                <select
                  name="draw_scope"
                  defaultValue="not_previous_winners"
                  style={styles.input}
                >
                  <option value="not_previous_winners">
                    Exclude previous winner emails
                  </option>
                  <option value="all">Allow previous winner emails</option>
                </select>
              </label>

              {eventType === "tables" && (
                <label style={styles.field}>
                  <span style={styles.label}>Max winners per table</span>
                  <input
                    name="max_winners_per_table"
                    type="number"
                    min="1"
                    defaultValue="1"
                    style={styles.input}
                  />
                </label>
              )}

              <div style={styles.checkGrid}>
                <label style={styles.checkboxLabel}>
                  <input type="checkbox" name="include_vip" value="yes" />
                  Include VIP
                </label>

                <label style={styles.checkboxLabel}>
                  <input type="checkbox" name="include_complimentary" value="yes" />
                  Include complimentary
                </label>

                <label style={styles.checkboxLabel}>
                  <input type="checkbox" name="include_staff" value="yes" />
                  Include staff
                </label>

                <label style={styles.checkboxLabel}>
                  <input type="checkbox" name="include_sponsors" value="yes" />
                  Include sponsors
                </label>

                <label style={styles.checkboxLabel}>
                  <input type="checkbox" name="include_guests" value="yes" />
                  Include guests
                </label>
              </div>

              <div style={styles.soundModeRowLight}>
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
                    ...styles.soundModeLightButton,
                    background: soundMode === "roll" ? "#0f172a" : "#ffffff",
                    color: soundMode === "roll" ? "#ffffff" : "#0f172a",
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
                    ...styles.soundModeLightButton,
                    background: soundMode === "riser" ? "#0f172a" : "#ffffff",
                    color: soundMode === "riser" ? "#ffffff" : "#0f172a",
                  }}
                >
                  Cinematic Riser
                </button>
              </div>

              {error ? <div style={styles.errorBox}>{error}</div> : null}

              <div style={styles.drawButtonGrid}>
                <button
                  type="button"
                  onClick={() => void runAutomaticDraw()}
                  disabled={
                    !hasRemainingPrizes ||
                    drawing ||
                    saving ||
                    autoDrawing ||
                    (drawMode === "single" && !activePrizeKey) ||
                    (drawMode === "all_remaining" && !hasAutomatedRangePrizes)
                  }
                  style={{
                    ...styles.automaticButton,
                    opacity:
                      !hasRemainingPrizes ||
                      drawing ||
                      saving ||
                      autoDrawing ||
                      (drawMode === "single" && !activePrizeKey) ||
                      (drawMode === "all_remaining" && !hasAutomatedRangePrizes)
                        ? 0.45
                        : 1,
                  }}
                >
                  {autoDrawing ? "Drawing..." : "Automatic random draw"}
                </button>

                <button
                  type="submit"
                  disabled={
                    !hasRemainingPrizes ||
                    drawing ||
                    saving ||
                    autoDrawing ||
                    (drawMode === "single" && !activePrizeKey) ||
                    (drawMode === "all_remaining" && !hasAutomatedRangePrizes)
                  }
                  style={{
                    ...styles.primaryButton,
                    opacity:
                      !hasRemainingPrizes ||
                      drawing ||
                      saving ||
                      autoDrawing ||
                      (drawMode === "single" && !activePrizeKey) ||
                      (drawMode === "all_remaining" && !hasAutomatedRangePrizes)
                        ? 0.45
                        : 1,
                  }}
                >
                  Open dramatic draw
                </button>
              </div>
            </>
          )}
        </form>

        <div style={styles.panel}>
          <div style={styles.panelHeader}>
            <div>
              <h3 style={styles.panelTitle}>Winner history</h3>
              <p style={styles.sectionText}>
                Winners are stored against this event only.
              </p>
            </div>

            {winners.length > 0 && (
              <form action={clearWinnersAction}>
                <input type="hidden" name="event_id" value={eventId} />
                <button type="submit" style={styles.dangerOutlineButton}>
                  Clear winners
                </button>
              </form>
            )}
          </div>

          {winners.length === 0 ? (
            <div style={styles.emptyBox}>No winners drawn yet.</div>
          ) : (
            <div style={styles.winnerList}>
              {winners.map((winner) => (
                <div key={winner.id} style={styles.winnerCard}>
                  <div>
                    <p style={styles.winnerPrize}>
                      {winner.prize_position ? `${winner.prize_position}. ` : ""}
                      {winner.prize_title}
                    </p>
                    <p style={styles.winnerName}>
                      {winner.winner_name || "Unnamed winner"}
                    </p>
                    <p style={styles.winnerMeta}>
                      {winner.winner_email || "No email"} ·{" "}
                      {formatWinnerSeat(winner)}
                    </p>
                  </div>

                  <form action={deleteWinnerAction}>
                    <input type="hidden" name="event_id" value={eventId} />
                    <input type="hidden" name="winner_id" value={winner.id} />
                    <button type="submit" style={styles.dangerMiniButton}>
                      Remove
                    </button>
                  </form>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {drawOverlayOpen ? (
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

            <button
              type="button"
              onClick={closeDraw}
              disabled={saving}
              style={{
                ...styles.closeButton,
                opacity: saving ? 0.45 : 1,
                cursor: saving ? "not-allowed" : "pointer",
              }}
            >
              Close
            </button>
          </div>

          <div style={styles.stage}>
            <p style={styles.stageEyebrow}>SO Foundation Platform</p>
            <h1 style={styles.stageTitle}>Event Winner Draw</h1>

            <div style={styles.stageSubGrid}>
              <div style={styles.stageSubCard}>
                <span>Prize</span>
                <strong>{displayPrize}</strong>
              </div>

              <div style={styles.stageSubCard}>
                <span>Mode</span>
                <strong>{drawMode === "all_remaining" ? "Range" : "Single"}</strong>
              </div>

              <div style={styles.stageSubCard}>
                <span>Sound</span>
                <strong>{soundMode === "roll" ? "Roll" : "Riser"}</strong>
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

            <div
              style={{
                ...styles.ticketReveal,
                animation:
                  drawing || saving || revealedWinner
                    ? "glowPulse 900ms infinite"
                    : "",
              }}
            >
              <div style={styles.ticketRevealShimmer} />
              <div
                style={{
                  ...styles.ticketNumber,
                  animation: drawing ? "winnerPulse 160ms infinite" : "",
                }}
              >
                {displayText}
              </div>

              <div style={styles.ticketLabel}>
                {drawing
                  ? soundMode === "roll"
                    ? "Classic roll"
                    : "Cinematic riser"
                  : saving
                    ? "Saving winner"
                    : revealedWinner
                      ? "Winner saved"
                      : "Ready to draw"}
              </div>
            </div>

            <div style={styles.resultPanel}>
              {revealedWinner ? (
                <>
                  <div style={styles.colourBadge}>Winner</div>
                  <h2 style={styles.revealedWinnerName}>
                    {revealedWinner.winner_name || "Winner"}
                  </h2>

                  {revealedWinner.winner_email ? (
                    <p style={styles.revealedWinnerMeta}>
                      {revealedWinner.winner_email}
                    </p>
                  ) : null}

                  <p style={styles.revealedWinnerMeta}>
                    {formatWinnerSeat(revealedWinner)}
                  </p>
                </>
              ) : (
                <>
                  <div style={styles.colourBadgeMuted}>
                    {drawing ? "Selecting entry" : saving ? "Saving" : "Awaiting draw"}
                  </div>
                  <h2 style={styles.revealedWinnerName}>
                    {drawing ? "Drawing..." : saving ? "Saving winner..." : "Ready"}
                  </h2>
                </>
              )}
            </div>

            {error ? <p style={styles.overlayError}>{error}</p> : null}

            {!revealedWinner ? (
              <button
                type="button"
                onClick={() => void runDramaticDraw()}
                disabled={drawing || saving}
                style={{
                  ...styles.startButton,
                  opacity: drawing || saving ? 0.45 : 1,
                  cursor: drawing || saving ? "not-allowed" : "pointer",
                }}
              >
                {drawing ? "Drawing..." : saving ? "Saving..." : "Start draw"}
              </button>
            ) : null}

            <button
              type="button"
              onClick={closeDraw}
              disabled={saving}
              style={{
                ...styles.overlaySecondaryButton,
                opacity: saving ? 0.45 : 1,
                cursor: saving ? "not-allowed" : "pointer",
              }}
            >
              {saving ? "Saving..." : "Close"}
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}

const styles: Record<string, CSSProperties> = {
  section: {
    padding: 18,
    borderRadius: 22,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    boxShadow: "0 2px 12px rgba(15,23,42,0.04)",
    marginBottom: 16,
  },
  sectionHeader: { marginBottom: 16 },
  sectionEyebrow: {
    margin: "0 0 6px",
    color: "#2563eb",
    fontWeight: 900,
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
  },
  sectionTitle: {
    margin: 0,
    color: "#0f172a",
    fontSize: 24,
    letterSpacing: "-0.02em",
  },
  sectionText: {
    margin: "6px 0 0",
    color: "#64748b",
    fontSize: 14,
    lineHeight: 1.45,
  },
  statsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
    gap: 12,
    marginBottom: 16,
  },
  statBox: {
    padding: 15,
    borderRadius: 18,
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
  },
  statLabel: {
    margin: 0,
    color: "#64748b",
    fontSize: 12,
    fontWeight: 900,
  },
  statValue: {
    margin: "6px 0 0",
    color: "#0f172a",
    fontSize: 24,
    fontWeight: 900,
  },
  latestWinnerBox: {
    padding: 16,
    borderRadius: 18,
    background: "linear-gradient(135deg, #fffbeb, #ffffff)",
    border: "1px solid #fde68a",
    marginBottom: 16,
  },
  latestWinnerLabel: {
    margin: 0,
    color: "#92400e",
    fontSize: 12,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
  },
  latestWinnerName: {
    margin: "6px 0 0",
    color: "#0f172a",
    fontSize: 22,
    fontWeight: 950,
  },
  latestWinnerMeta: {
    margin: "4px 0 0",
    color: "#64748b",
    fontSize: 14,
    fontWeight: 800,
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "minmax(280px, 0.95fr) minmax(320px, 1.2fr)",
    gap: 16,
    alignItems: "start",
  },
  panel: {
    display: "grid",
    gap: 14,
    padding: 16,
    borderRadius: 18,
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
  },
  panelHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "center",
    flexWrap: "wrap",
  },
  panelTitle: {
    margin: 0,
    color: "#0f172a",
    fontSize: 18,
    fontWeight: 900,
  },
  field: {
    display: "grid",
    gap: 6,
  },
  label: {
    color: "#334155",
    fontSize: 13,
    fontWeight: 900,
  },
  input: {
    width: "100%",
    minHeight: 44,
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid #cbd5e1",
    background: "#ffffff",
    color: "#0f172a",
    fontSize: 15,
    boxSizing: "border-box",
  },
  twoCol: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    gap: 10,
  },
  rangeBox: {
    display: "grid",
    gap: 12,
    padding: 14,
    borderRadius: 18,
    background: "#ffffff",
    border: "1px solid #dbeafe",
  },
  rangeSummary: {
    padding: 12,
    borderRadius: 14,
    background: "#eff6ff",
    border: "1px solid #bfdbfe",
    color: "#1d4ed8",
    fontSize: 13,
    fontWeight: 900,
  },
  checkGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
    gap: 8,
  },
  checkboxLabel: {
    display: "flex",
    gap: 8,
    alignItems: "center",
    fontWeight: 900,
    color: "#334155",
    fontSize: 13,
  },
  soundModeRowLight: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
  },
  soundModeLightButton: {
    border: "1px solid #cbd5e1",
    borderRadius: 999,
    padding: "10px 14px",
    cursor: "pointer",
    fontWeight: 950,
  },
  drawButtonGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
    gap: 10,
  },
  primaryButton: {
    width: "100%",
    padding: "13px 18px",
    border: "none",
    borderRadius: 999,
    background: "#111827",
    color: "#ffffff",
    fontWeight: 900,
    cursor: "pointer",
  },
  automaticButton: {
    width: "100%",
    padding: "13px 18px",
    border: "none",
    borderRadius: 999,
    background: "#1683f8",
    color: "#ffffff",
    fontWeight: 900,
    cursor: "pointer",
  },
  dangerOutlineButton: {
    padding: "10px 14px",
    borderRadius: 999,
    border: "1px solid #fecaca",
    background: "#ffffff",
    color: "#b91c1c",
    fontWeight: 900,
    cursor: "pointer",
  },
  dangerMiniButton: {
    padding: "8px 11px",
    borderRadius: 999,
    border: "1px solid #fecaca",
    background: "#ffffff",
    color: "#b91c1c",
    fontWeight: 900,
    cursor: "pointer",
    fontSize: 12,
  },
  emptyBox: {
    padding: 16,
    borderRadius: 16,
    background: "#ffffff",
    border: "1px dashed #cbd5e1",
    color: "#64748b",
    fontWeight: 800,
  },
  errorBox: {
    padding: 12,
    borderRadius: 14,
    background: "#fee2e2",
    border: "1px solid #fecaca",
    color: "#991b1b",
    fontWeight: 900,
  },
  winnerList: {
    display: "grid",
    gap: 10,
    maxHeight: 520,
    overflow: "auto",
    paddingRight: 4,
  },
  winnerCard: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "center",
    padding: 12,
    borderRadius: 16,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
  },
  winnerPrize: {
    margin: 0,
    color: "#2563eb",
    fontSize: 12,
    fontWeight: 900,
    textTransform: "uppercase",
    letterSpacing: "0.06em",
  },
  winnerName: {
    margin: "5px 0 0",
    color: "#0f172a",
    fontSize: 18,
    fontWeight: 900,
  },
  winnerMeta: {
    margin: "4px 0 0",
    color: "#64748b",
    fontSize: 13,
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
    width: "min(900px, 100%)",
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
    maxWidth: 720,
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
    fontSize: "clamp(48px, 10vw, 96px)",
    lineHeight: 1,
    fontWeight: 950,
    letterSpacing: "-0.065em",
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
    minHeight: 108,
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
  revealedWinnerName: {
    margin: 0,
    color: "#ffffff",
    fontSize: "clamp(28px, 5vw, 44px)",
    fontWeight: 950,
    lineHeight: 1.05,
  },
  revealedWinnerMeta: {
    margin: "5px 0 0",
    color: "#d1d5db",
    fontSize: 16,
    fontWeight: 800,
  },
  overlayError: {
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
    background: "linear-gradient(135deg, #facc15, #f97316)",
    color: "#111827",
    boxShadow: "0 20px 42px rgba(249,115,22,0.38)",
  },
  overlaySecondaryButton: {
    marginTop: 12,
    border: "1px solid rgba(255,255,255,0.3)",
    background: "rgba(255,255,255,0.08)",
    color: "#ffffff",
    borderRadius: 999,
    padding: "12px 18px",
    fontWeight: 900,
  },
};
