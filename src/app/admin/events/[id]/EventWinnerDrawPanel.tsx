"use client";

import { useMemo, useState, type CSSProperties } from "react";

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
    return `Table ${winner.table_number}${winner.seat_number ? ` · Seat ${winner.seat_number}` : ""}`;
  }

  if (winner.row_label || winner.seat_number) {
    return `Row ${winner.row_label || "-"} · Seat ${winner.seat_number || "-"}`;
  }

  return "General admission";
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

  const [selectedPrizeKey, setSelectedPrizeKey] = useState(
    firstRemainingPrize && firstRemainingIndex >= 0
      ? prizePayload(firstRemainingPrize, firstRemainingIndex)
      : "",
  );

  const hasPrizes = validPrizes.length > 0;
  const hasRemainingPrizes = remainingPrizes.length > 0;

  return (
    <section id="winner-draw" style={styles.section}>
      <div style={styles.sectionHeader}>
        <p style={styles.sectionEyebrow}>Winner draw</p>
        <h2 style={styles.sectionTitle}>Event Winner Draw</h2>
        <p style={styles.sectionText}>
          Draw winners from eligible paid event entries only. Already drawn
          tickets are excluded before the draw starts.
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

      <div style={styles.grid}>
        <form action={drawWinnerAction} style={styles.panel}>
          <input type="hidden" name="event_id" value={eventId} />

          <div>
            <h3 style={styles.panelTitle}>Draw controls</h3>
            <p style={styles.sectionText}>
              Use “Draw selected prize” for one prize. “Draw all remaining
              prizes” will be wired in the next server action step.
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
                  value={selectedPrizeKey}
                  onChange={(event) => setSelectedPrizeKey(event.target.value)}
                  style={styles.input}
                  required
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
                <span style={styles.label}>Draw scope</span>
                <select name="draw_scope" defaultValue="not_previous_winners" style={styles.input}>
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

              <div style={styles.buttonRow}>
                <button
                  type="submit"
                  name="draw_mode"
                  value="single"
                  disabled={!hasRemainingPrizes || !selectedPrizeKey}
                  style={{
                    ...styles.primaryButton,
                    opacity:
                      !hasRemainingPrizes || !selectedPrizeKey ? 0.45 : 1,
                  }}
                >
                  Draw selected prize
                </button>

                <button
                  type="submit"
                  name="draw_mode"
                  value="all_remaining"
                  disabled
                  style={{ ...styles.secondaryButton, opacity: 0.45 }}
                  title="Next step: server action wiring"
                >
                  Draw all remaining prizes
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
                      {winner.winner_email || "No email"} · {formatWinnerSeat(winner)}
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
    background: "#1683f8",
    color: "#ffffff",
    fontWeight: 900,
    cursor: "pointer",
  },
  secondaryButton: {
    width: "fit-content",
    padding: "13px 18px",
    borderRadius: 999,
    border: "1px solid #cbd5e1",
    background: "#ffffff",
    color: "#0f172a",
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
};
