"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
} from "react";

type EventPrize = {
  id?: string;
  position?: number;
  title?: string;
  name?: string;
  description?: string;
  isPublic?: boolean;
  is_public?: boolean;
  sortOrder?: number;
  sort_order?: number;
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

function formatWinnerSeat(winner: EventWinner) {
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

function eventTypeLabel(eventType: string) {
  if (eventType === "tables") return "Tables";
  if (eventType === "reserved_seating") return "Reserved seating";
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
    drift: Math.random() * 240 - 120,
  }));
}

export default function EventWinnerDrawPanel({
  eventId,
  eventType,
  prizes,
  winners,
  drawWinnerAction,
  deleteWinnerAction,
  clearWinnersAction,
}: {
  eventId: string;
  eventType: "general_admission" | "reserved_seating" | "tables";
  prizes: EventPrize[];
  winners: EventWinner[];
  drawWinnerAction: (formData: FormData) => void | Promise<void>;
  deleteWinnerAction: (formData: FormData) => void | Promise<void>;
  clearWinnersAction: (formData: FormData) => void | Promise<void>;
}) {
  const formRef = useRef<HTMLFormElement | null>(null);
  const realSubmitButtonRef = useRef<HTMLButtonElement | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const submitTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const allowRealSubmitRef = useRef(false);

  const [selectedPrizeKey, setSelectedPrizeKey] = useState("");
  const [drawMode, setDrawMode] = useState<"single" | "all_remaining">("single");
  const [drawOverlayOpen, setDrawOverlayOpen] = useState(false);
  const [drawing, setDrawing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [displayText, setDisplayText] = useState("—");
  const [displayPrize, setDisplayPrize] = useState("Ready");
  const [error, setError] = useState("");
  const [confetti, setConfetti] = useState<ConfettiPiece[]>([]);

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
    if (drawMode === "all_remaining") return "All remaining prizes";

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

  function clearDrawTimers() {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    if (submitTimeoutRef.current) {
      clearTimeout(submitTimeoutRef.current);
      submitTimeoutRef.current = null;
    }
  }

  function closeDraw() {
    clearDrawTimers();
    allowRealSubmitRef.current = false;
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
        remainingPrizes[Math.floor(Math.random() * remainingPrizes.length)];

      if (!prize) return "All remaining prizes";

      const index = validPrizes.findIndex((item) => item === prize);
      return `${prizePosition(prize, index)}. ${prizeTitle(prize)}`;
    }

    return selectedPrizeLabel;
  }
    async function runDramaticDraw(event: FormEvent<HTMLFormElement>) {
    if (allowRealSubmitRef.current) {
      allowRealSubmitRef.current = false;
      return;
    }

    event.preventDefault();

    if (drawing || saving) return;

    if (!hasPrizes) {
      setError("Add prizes before running a draw.");
      return;
    }

    if (!hasRemainingPrizes) {
      setError("There are no remaining prizes to draw.");
      return;
    }

    if (drawMode === "single" && !activePrizeKey) {
      setError("Choose a prize before running the draw.");
      return;
    }

    setError("");
    setDrawOverlayOpen(true);
    setDrawing(true);
    setSaving(false);
    setConfetti([]);
    setDisplayText("—");
    setDisplayPrize(selectedPrizeLabel);

    const audioCtx = await unlockAudio();

    let ticks = 0;

    clearDrawTimers();

    timerRef.current = setInterval(() => {
      setDisplayText(randomDisplayValue());
      setDisplayPrize(randomPrizeText());

      if (audioCtx) {
        playTick(audioCtx);
        if (ticks % 4 === 0) playRiser(audioCtx);
      }

      ticks += 1;
    }, 72);

    timeoutRef.current = setTimeout(() => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }

      setDisplayText("WINNER");
      setDisplayPrize(selectedPrizeLabel);
      setDrawing(false);
      setSaving(true);
      setConfetti(makeConfetti());

      if (audioCtx) playWinner(audioCtx);

      submitTimeoutRef.current = setTimeout(() => {
        allowRealSubmitRef.current = true;
        realSubmitButtonRef.current?.click();
      }, 950);
    }, 3200);
  }

  useEffect(() => {
    return () => {
      clearDrawTimers();
      allowRealSubmitRef.current = false;
    };
  }, []);

  return (
    <section style={styles.section}>
      <div style={styles.sectionHeader}>
        <p style={styles.sectionEyebrow}>Winner draw</p>
        <h2 style={styles.sectionTitle}>Event Winner Draw</h2>
        <p style={styles.sectionText}>
          Draw winners from eligible paid event entries only. Already drawn
          prizes are excluded before the draw starts.
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
          <p style={styles.statLabel}>Winners</p>
          <p style={styles.statValue}>{winners.length}</p>
        </div>

        <div style={styles.statBox}>
          <p style={styles.statLabel}>Event type</p>
          <p style={styles.statValueSmall}>{eventTypeLabel(eventType)}</p>
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

      <div style={styles.grid}>
        <form
          ref={formRef}
          action={drawWinnerAction}
          onSubmit={runDramaticDraw}
          style={styles.panel}
        >
          <input type="hidden" name="event_id" value={eventId} />
          <input type="hidden" name="draw_mode" value={drawMode} />

          <button
            ref={realSubmitButtonRef}
            type="submit"
            style={{ display: "none" }}
            aria-hidden="true"
          >
            Save draw
          </button>

          <div>
            <h3 style={styles.panelTitle}>Dramatic draw controls</h3>
            <p style={styles.sectionText}>
              Opens a full-screen draw with suspense, sound, confetti, and then
              saves the verified winner to this event.
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
                  <option value="all_remaining">Draw all remaining prizes</option>
                </select>
              </label>

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

              {error ? <div style={styles.errorBox}>{error}</div> : null}

              <div style={styles.buttonRow}>
                <button
                  type="button"
                  onClick={() => formRef.current?.requestSubmit()}
                  disabled={
                    !hasRemainingPrizes ||
                    drawing ||
                    saving ||
                    (drawMode === "single" && !activePrizeKey)
                  }
                  style={{
                    ...styles.primaryButton,
                    opacity:
                      !hasRemainingPrizes ||
                      drawing ||
                      saving ||
                      (drawMode === "single" && !activePrizeKey)
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

          <button
            type="button"
            onClick={closeDraw}
            style={styles.closeOverlayButton}
          >
            Close
          </button>

          <div style={styles.overlayContent}>
            <p style={styles.overlayEyebrow}>Event prize draw</p>

            <h1 style={styles.overlayTitle}>
              {drawing ? "Drawing..." : saving ? "Saving winner..." : "Winner!"}
            </h1>

            <p style={styles.overlayPrize}>{displayPrize}</p>

            <div
              style={{
                ...styles.drawOrb,
                animation: drawing || saving ? "glowPulse 900ms infinite" : "",
              }}
            >
              <div
                style={{
                  ...styles.drawNumber,
                  animation: drawing ? "winnerPulse 180ms infinite" : "",
                }}
              >
                {displayText}
              </div>
            </div>

            <p style={styles.overlaySubtext}>
              {drawing
                ? "Selecting from eligible event entries..."
                : saving
                  ? "Winner chosen — saving to event history..."
                  : "Draw complete."}
            </p>

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
  statValueSmall: {
    margin: "6px 0 0",
    color: "#0f172a",
    fontSize: 18,
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
  buttonRow: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
  },
  primaryButton: {
    width: "fit-content",
    padding: "13px 18px",
    border: "none",
    borderRadius: 999,
    background: "#111827",
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
      "radial-gradient(circle at top, #374151, #111827 55%, #030712)",
    color: "#ffffff",
    display: "grid",
    placeItems: "center",
    padding: 24,
    overflow: "hidden",
  },
  confettiLayer: {
    position: "absolute",
    inset: 0,
    pointerEvents: "none",
    overflow: "hidden",
  },
  closeOverlayButton: {
    position: "absolute",
    top: 18,
    right: 18,
    border: "1px solid rgba(255,255,255,0.3)",
    background: "rgba(255,255,255,0.08)",
    color: "#ffffff",
    borderRadius: 999,
    padding: "10px 14px",
    cursor: "pointer",
    fontWeight: 800,
    zIndex: 2,
  },
  overlayContent: {
    width: "min(780px, 100%)",
    textAlign: "center",
    position: "relative",
    zIndex: 1,
  },
  overlayEyebrow: {
    margin: 0,
    color: "#facc15",
    fontSize: 14,
    fontWeight: 900,
    letterSpacing: "0.18em",
    textTransform: "uppercase",
  },
  overlayTitle: {
    margin: "12px 0 10px",
    fontSize: "clamp(34px, 6vw, 60px)",
    lineHeight: 1,
  },
  overlayPrize: {
    margin: "0 auto 24px",
    color: "#d1d5db",
    fontSize: "clamp(17px, 3vw, 24px)",
    fontWeight: 900,
  },
  drawOrb: {
    margin: "0 auto 22px",
    display: "grid",
    placeItems: "center",
    width: "min(360px, 74vw)",
    height: "min(360px, 74vw)",
    borderRadius: "50%",
    background:
      "radial-gradient(circle, rgba(250,204,21,0.38), rgba(249,115,22,0.2), rgba(255,255,255,0.06))",
    border: "2px solid rgba(250,204,21,0.6)",
  },
  drawNumber: {
    fontSize: "clamp(48px, 12vw, 96px)",
    lineHeight: 1,
    fontWeight: 950,
    letterSpacing: "-0.06em",
    textShadow: "0 0 28px rgba(250,204,21,0.85)",
  },
  overlaySubtext: {
    margin: "0 auto",
    color: "#d1d5db",
    fontSize: 16,
    fontWeight: 800,
  },
  overlaySecondaryButton: {
    marginTop: 28,
    border: "1px solid rgba(255,255,255,0.3)",
    background: "rgba(255,255,255,0.08)",
    color: "#ffffff",
    borderRadius: 999,
    padding: "12px 18px",
    fontWeight: 900,
  },
};
