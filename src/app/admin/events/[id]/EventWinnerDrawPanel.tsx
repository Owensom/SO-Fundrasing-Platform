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

function playTick(audioCtx: AudioContext) {
  const now = audioCtx.currentTime;

  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();

  osc.type = "square";
  osc.frequency.setValueAtTime(1100, now);
  osc.frequency.exponentialRampToValueAtTime(320, now + 0.06);

  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.18, now + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.08);

  osc.connect(gain);
  gain.connect(audioCtx.destination);

  osc.start(now);
  osc.stop(now + 0.08);
}

function playWinner(audioCtx: AudioContext) {
  const now = audioCtx.currentTime;

  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();

  osc.type = "sawtooth";
  osc.frequency.setValueAtTime(240, now);
  osc.frequency.exponentialRampToValueAtTime(820, now + 0.7);

  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.22, now + 0.04);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 1);

  osc.connect(gain);
  gain.connect(audioCtx.destination);

  osc.start(now);
  osc.stop(now + 1);
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
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reloadTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [selectedPrizeKey, setSelectedPrizeKey] = useState("");
  const [drawMode, setDrawMode] = useState<"single" | "all_remaining">("single");
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

    if (reloadTimeoutRef.current) {
      clearTimeout(reloadTimeoutRef.current);
      reloadTimeoutRef.current = null;
    }
  }

  function closeDraw() {
    clearDrawTimers();
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

  function buildDrawFormData(checkOnly = false) {
    const form = formRef.current;

    if (!form) {
      throw new Error("Draw form was not found.");
    }

    const formData = new FormData(form);
    formData.set("event_id", eventId);
    formData.set("draw_mode", drawMode);
    formData.set("all_prizes", buildAllPrizesPayload(validPrizes));

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
      drawMode === "all_remaining" ? data?.winners?.[0] || null : data?.winner || null;

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
      if (audioCtx) playWinner(audioCtx);

      reloadTimeoutRef.current = setTimeout(() => {
        window.location.reload();
      }, 1600);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Draw failed.");
    } finally {
      setAutoDrawing(false);
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

    setDrawOverlayOpen(true);
    setDrawing(true);
    setSaving(false);
    setRevealedWinner(null);
    setConfetti([]);
    setDisplayText("—");
    setDisplayPrize(selectedPrizeLabel);

    const audioCtx = await unlockAudio();

    clearDrawTimers();

    timerRef.current = setInterval(() => {
      setDisplayText(randomDisplayValue());
      setDisplayPrize(randomPrizeText());

      if (audioCtx) playTick(audioCtx);
    }, 72);

    timeoutRef.current = setTimeout(async () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }

      setDrawing(false);
      setSaving(true);
      setDisplayText("SAVING");
      setDisplayPrize(selectedPrizeLabel);

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

        if (audioCtx) playWinner(audioCtx);

        reloadTimeoutRef.current = setTimeout(() => {
          window.location.reload();
        }, 2600);
      } catch (err) {
        setSaving(false);
        setError(err instanceof Error ? err.message : "Draw failed.");
        setDisplayText("ERROR");
      }
    }, 3200);
  }

  useEffect(() => {
    return () => {
      clearDrawTimers();
    };
  }, []);

  return (
    <section style={styles.section}>
      <div style={styles.sectionHeader}>
        <p style={styles.sectionEyebrow}>Winner draw</p>
        <h2 style={styles.sectionTitle}>Event Winner Draw</h2>
        <p style={styles.sectionText}>
          Draw winners from eligible paid event entries only. Use the quick
          automatic draw for admin work, or open the full dramatic draw for live
          announcements.
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
          <p style={styles.statValueSmall}>
            {eventType === "tables"
              ? "Tables"
              : eventType === "reserved_seating"
                ? "Reserved seating"
                : "General admission"}
          </p>
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
            void runDramaticDraw();
          }}
          style={styles.panel}
        >
          <input type="hidden" name="event_id" value={eventId} />
          <input type="hidden" name="draw_mode" value={drawMode} />

          <div>
            <h3 style={styles.panelTitle}>Draw controls</h3>
            <p style={styles.sectionText}>
              Select the prize, choose the scope, then run either a quick
              automatic draw or the full-screen dramatic draw.
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

              <div style={styles.drawButtonGrid}>
                <button
                  type="button"
                  onClick={() => void runAutomaticDraw()}
                  disabled={
                    !hasRemainingPrizes ||
                    drawing ||
                    saving ||
                    autoDrawing ||
                    (drawMode === "single" && !activePrizeKey)
                  }
                  style={{
                    ...styles.automaticButton,
                    opacity:
                      !hasRemainingPrizes ||
                      drawing ||
                      saving ||
                      autoDrawing ||
                      (drawMode === "single" && !activePrizeKey)
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
                    (drawMode === "single" && !activePrizeKey)
                  }
                  style={{
                    ...styles.primaryButton,
                    opacity:
                      !hasRemainingPrizes ||
                      drawing ||
                      saving ||
                      autoDrawing ||
                      (drawMode === "single" && !activePrizeKey)
                        ? 0.45
                        : 1,
                  }}
                >
                  {drawing
                    ? "Drawing..."
                    : saving
                      ? "Saving..."
                      : "Open dramatic draw"}
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
            disabled={saving}
            style={{
              ...styles.closeOverlayButton,
              opacity: saving ? 0.45 : 1,
              cursor: saving ? "not-allowed" : "pointer",
            }}
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

            {revealedWinner ? (
              <div style={styles.revealedWinnerCard}>
                <p style={styles.revealedWinnerLabel}>Winner</p>
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
              </div>
            ) : null}

            <p style={styles.overlaySubtext}>
              {drawing
                ? "Selecting from eligible event entries..."
                : saving
                  ? "Winner chosen — saving to event history..."
                  : revealedWinner
                    ? "Winner saved. Refreshing history..."
                    : "Ready."}
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
  revealedWinnerCard: {
    width: "min(520px, 100%)",
    margin: "0 auto 16px",
    padding: 18,
    borderRadius: 22,
    background: "rgba(255,255,255,0.1)",
    border: "1px solid rgba(250,204,21,0.4)",
    boxShadow: "0 18px 50px rgba(0,0,0,0.24)",
  },
  revealedWinnerLabel: {
    margin: 0,
    color: "#facc15",
    fontSize: 12,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.12em",
  },
  revealedWinnerName: {
    margin: "8px 0 0",
    color: "#ffffff",
    fontSize: "clamp(28px, 5vw, 44px)",
    fontWeight: 950,
    lineHeight: 1.05,
  },
  revealedWinnerMeta: {
    margin: "8px 0 0",
    color: "#d1d5db",
    fontSize: 16,
    fontWeight: 800,
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
