import type { CSSProperties } from "react";

type EventPrize = {
  id?: string;
  position?: number;
  title?: string;
  name?: string;
  description?: string;
};

type EventWinner = {
  id: string;
  prize_id: string | null;
  prize_title: string;
  prize_position: number | null;
  table_number: string | null;
  row_label: string | null;
  seat_number: string | null;
  winner_name: string | null;
  winner_email: string | null;
  draw_scope: string;
  draw_settings: Record<string, unknown>;
  status: string;
  drawn_at: string;
};

function formatDateTime(value: string | null | undefined) {
  if (!value) return "Unknown";

  try {
    return new Intl.DateTimeFormat("en-GB", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value));
  } catch {
    return "Unknown";
  }
}

function prizeTitle(prize: EventPrize, index: number) {
  return String(prize.title || prize.name || `Prize ${index + 1}`).trim();
}

function prizePosition(prize: EventPrize, index: number) {
  const raw = Number(prize.position);
  if (Number.isFinite(raw) && raw > 0) return Math.floor(raw);
  return index + 1;
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
  const hasPrizes = prizes.length > 0;
  const isTables = eventType === "tables";

  return (
    <section id="winner-draw" style={styles.section}>
      <div style={styles.sectionHeader}>
        <p style={styles.sectionEyebrow}>Admin tools</p>
        <h2 style={styles.sectionTitle}>Winner Draw</h2>
        <p style={styles.sectionText}>
          Draw event prize winners from paid event entries only. This is
          events-only and does not affect raffles, squares, checkout, or public
          event pages.
        </p>
      </div>

      <div style={styles.drawGrid}>
        <form action={drawWinnerAction} style={styles.panel}>
          <input type="hidden" name="event_id" value={eventId} />

          <div>
            <h3 style={styles.panelTitle}>Draw a winner</h3>
            <p style={styles.sectionText}>
              Select a prize and draw from eligible paid event tickets/seats.
            </p>
          </div>

          {!hasPrizes ? (
            <div style={styles.warningBox}>
              Add prizes first in the Prizes section before drawing winners.
            </div>
          ) : (
            <>
              <label style={styles.field}>
                <span style={styles.label}>Prize</span>
                <select name="prize_key" required style={styles.input}>
                  <option value="">Choose prize</option>

                  {prizes.map((prize, index) => {
                    const title = prizeTitle(prize, index);
                    const position = prizePosition(prize, index);
                    const id = String(prize.id || `prize-${index + 1}`);

                    return (
                      <option
                        key={`${id}-${index}`}
                        value={JSON.stringify({
                          id,
                          title,
                          position,
                        })}
                      >
                        {position}. {title}
                      </option>
                    );
                  })}
                </select>
              </label>

              <div style={styles.twoCol}>
                <label style={styles.field}>
                  <span style={styles.label}>Draw scope</span>
                  <select name="draw_scope" defaultValue="all" style={styles.input}>
                    <option value="all">All eligible paid entries</option>
                    <option value="not_previous_winners">
                      Exclude previous winner emails
                    </option>
                  </select>
                </label>

                {isTables ? (
                  <label style={styles.field}>
                    <span style={styles.label}>Max winners per table</span>
                    <select
                      name="max_winners_per_table"
                      defaultValue="1"
                      style={styles.input}
                    >
                      <option value="1">1 winner per table</option>
                      <option value="2">2 winners per table</option>
                      <option value="3">3 winners per table</option>
                      <option value="0">Unlimited</option>
                    </select>
                  </label>
                ) : (
                  <input type="hidden" name="max_winners_per_table" value="0" />
                )}
              </div>

              <div style={styles.checkGrid}>
                <label style={styles.checkboxLabel}>
                  <input type="checkbox" name="include_vip" value="yes" defaultChecked />
                  Include VIP seats
                </label>

                <label style={styles.checkboxLabel}>
                  <input
                    type="checkbox"
                    name="include_complimentary"
                    value="yes"
                  />
                  Include complimentary seats
                </label>

                <label style={styles.checkboxLabel}>
                  <input type="checkbox" name="include_staff" value="yes" />
                  Include staff seats
                </label>

                <label style={styles.checkboxLabel}>
                  <input type="checkbox" name="include_sponsors" value="yes" />
                  Include sponsor seats
                </label>

                <label style={styles.checkboxLabel}>
                  <input type="checkbox" name="include_guests" value="yes" />
                  Include guest allocations
                </label>
              </div>

              <button type="submit" style={styles.primaryButton}>
                Draw winner
              </button>
            </>
          )}
        </form>

        <div style={styles.panel}>
          <div style={styles.panelHeader}>
            <div>
              <h3 style={styles.panelTitle}>Winner history</h3>
              <p style={styles.sectionText}>
                Winners are saved to this event for audit/history.
              </p>
            </div>

            {winners.length > 0 && (
              <form action={clearWinnersAction}>
                <input type="hidden" name="event_id" value={eventId} />
                <button type="submit" style={styles.dangerOutlineButton}>
                  Clear history
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
                      {winner.winner_email || "No email"}
                    </p>

                    <p style={styles.winnerMeta}>
                      {winner.table_number
                        ? `Table ${winner.table_number}`
                        : winner.row_label || winner.seat_number
                          ? `Row ${winner.row_label || "-"} Seat ${
                              winner.seat_number || "-"
                            }`
                          : "General admission"}
                    </p>

                    <p style={styles.winnerMeta}>
                      Drawn {formatDateTime(winner.drawn_at)}
                    </p>
                  </div>

                  <form action={deleteWinnerAction}>
                    <input type="hidden" name="event_id" value={eventId} />
                    <input type="hidden" name="winner_id" value={winner.id} />
                    <button type="submit" style={styles.dangerOutlineButton}>
                      Delete
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
  drawGrid: {
    display: "grid",
    gridTemplateColumns: "minmax(280px, 0.9fr) minmax(320px, 1.1fr)",
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
    minWidth: 0,
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
    gap: 12,
  },
  checkGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    gap: 8,
    padding: 12,
    borderRadius: 16,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
  },
  checkboxLabel: {
    display: "flex",
    gap: 8,
    alignItems: "center",
    color: "#334155",
    fontWeight: 900,
    fontSize: 13,
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
  dangerOutlineButton: {
    padding: "10px 14px",
    borderRadius: 999,
    border: "1px solid #fecaca",
    background: "#ffffff",
    color: "#b91c1c",
    fontWeight: 900,
    cursor: "pointer",
  },
  emptyBox: {
    padding: 16,
    borderRadius: 16,
    background: "#ffffff",
    border: "1px dashed #cbd5e1",
    color: "#64748b",
    fontWeight: 800,
  },
  warningBox: {
    padding: 16,
    borderRadius: 16,
    background: "#fffbeb",
    border: "1px solid #fde68a",
    color: "#92400e",
    fontWeight: 900,
  },
  winnerList: {
    display: "grid",
    gap: 10,
    maxHeight: 560,
    overflow: "auto",
    paddingRight: 4,
  },
  winnerCard: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "flex-start",
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
    letterSpacing: "0.05em",
  },
  winnerName: {
    margin: "5px 0 0",
    color: "#0f172a",
    fontSize: 17,
    fontWeight: 900,
  },
  winnerMeta: {
    margin: "4px 0 0",
    color: "#64748b",
    fontSize: 13,
    fontWeight: 800,
  },
};
