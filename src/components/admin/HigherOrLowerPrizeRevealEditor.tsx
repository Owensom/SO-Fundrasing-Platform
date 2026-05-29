"use client";

import { useMemo, useState, type CSSProperties, type ReactNode } from "react";
import ImageFocusUploadField from "@/components/ImageFocusUploadField";
import type { EventPrizeRevealPrize } from "../../../api/_lib/events-repo";

type Props = {
  prizeRevealModeEnabled: boolean;
  prizeRevealRandomiseOrder: boolean;
  prizeRevealTitle: string;
  prizeRevealDescription: string;
  prizeRevealPrizes: EventPrizeRevealPrize[];
  maxPrizes: number;
  subscriptionTier: string;
  customImagesAllowed: boolean;
};

function cleanText(value: unknown) {
  return String(value || "").trim();
}

function moneyFromCents(cents: number | null | undefined) {
  return (Number(cents || 0) / 100).toFixed(2);
}

function clampPrizeCount(value: unknown, maxPrizes: number) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return 2;
  }

  return Math.max(2, Math.min(maxPrizes, Math.floor(number)));
}

function revealStatusLabel(prize: EventPrizeRevealPrize | null) {
  if (!prize?.title) {
    return "Empty";
  }

  return prize.isRevealed ? "Publicly revealed" : "Hidden";
}

function revealProgressText(prizes: EventPrizeRevealPrize[]) {
  const total = prizes.length;
  const revealed = prizes.filter((prize) => prize.isRevealed).length;

  if (total === 0) {
    return "No prizes saved";
  }

  return `${revealed} of ${total} public`;
}

export default function HigherOrLowerRevealEditor({
  prizeRevealModeEnabled,
  prizeRevealRandomiseOrder,
  prizeRevealTitle,
  prizeRevealDescription,
  prizeRevealPrizes,
  maxPrizes,
  subscriptionTier,
  customImagesAllowed,
}: Props) {
  const safeMaxPrizes = Math.max(2, Math.floor(Number(maxPrizes || 20)));
  const savedPrizeCount = Math.max(2, prizeRevealPrizes.length || 0);
  const defaultPrizeCount = Math.min(safeMaxPrizes, savedPrizeCount);

  const [prizeCount, setPrizeCount] = useState(defaultPrizeCount);

  const visiblePrizeRows = useMemo(() => {
    return Array.from(
      { length: prizeCount },
      (_, index) => prizeRevealPrizes[index] || null,
    );
  }, [prizeCount, prizeRevealPrizes]);

  const revealProgress = revealProgressText(prizeRevealPrizes);
  const playableRounds = Math.max(0, prizeCount - 1);

  return (
    <details
      open={Boolean(prizeRevealModeEnabled) || prizeRevealPrizes.length > 0}
      className="higher-lower-reveal-panel"
      style={styles.panel}
    >
      <summary className="higher-lower-reveal-summary" style={styles.summary}>
        <div style={styles.summaryCopy}>
          <div style={styles.eyebrow}>Higher or Lower prize chain</div>

          <h3 style={styles.title}>Prize setup and game length</h3>

          <p style={styles.text}>
            Choose how many prizes this game should use, then complete one row
            for each prize. Prize 1 becomes the starting value. Every prize after
            that creates one Higher or Lower round.
          </p>
        </div>

        <div style={styles.summaryActions}>
          <span style={styles.badge}>{revealProgress}</span>
          <span style={styles.toggle}>Open / close</span>
        </div>
      </summary>

      <div style={styles.body}>
        <div style={styles.notice}>
          <strong>How the live game uses this</strong>
          <span>
            The live game page reads these saved prizes. If randomise is on, it
            randomises once when the game is built, then stores that fixed order
            for the event-night game.
          </span>
        </div>

        <div className="higher-lower-reveal-two-col" style={styles.twoCol}>
          <Field label="Enable prize reveal preview">
            <select
              name="prize_reveal_mode_enabled"
              defaultValue={prizeRevealModeEnabled ? "true" : "false"}
              className="input"
              style={styles.input}
            >
              <option value="false">No, keep prize reveal preview off</option>
              <option value="true">Yes, enable prize reveal preview</option>
            </select>
          </Field>

          <Field label="Live game order">
            <select
              name="prize_reveal_randomise_order"
              defaultValue={prizeRevealRandomiseOrder ? "true" : "false"}
              className="input"
              style={styles.input}
            >
              <option value="false">Use the saved order below</option>
              <option value="true">Randomise once when live game is built</option>
            </select>
          </Field>
        </div>

        <section style={styles.gameLengthPanel}>
          <div>
            <div style={styles.gameLengthEyebrow}>Game length</div>
            <h4 style={styles.gameLengthTitle}>Choose prizes and rounds</h4>
            <p style={styles.gameLengthText}>
              Two prizes create one playable round. Three prizes create two
              rounds. You can set up to {safeMaxPrizes} prizes for longer event
              games.
            </p>
          </div>

          <div className="higher-lower-reveal-two-col" style={styles.twoCol}>
            <Field label="Number of prizes to set up">
              <select
                value={prizeCount}
                onChange={(event) =>
                  setPrizeCount(clampPrizeCount(event.target.value, safeMaxPrizes))
                }
                className="input"
                style={styles.input}
              >
                {Array.from({ length: safeMaxPrizes - 1 }, (_, index) => {
                  const count = index + 2;
                  const rounds = count - 1;

                  return (
                    <option key={count} value={count}>
                      {count} prizes — {rounds} round{rounds === 1 ? "" : "s"}
                    </option>
                  );
                })}
              </select>
            </Field>

            <Field label="Playable rounds from this setup">
              <div style={styles.roundPreview}>
                {playableRounds} round{playableRounds === 1 ? "" : "s"}
              </div>
            </Field>
          </div>
        </section>

        <Field label="Prize reveal title">
          <input
            name="prize_reveal_title"
            defaultValue={prizeRevealTitle || ""}
            placeholder="Higher or Lower Prize Reveal"
            className="input"
            style={styles.input}
          />
        </Field>

        <Field label="Prize reveal description">
          <textarea
            name="prize_reveal_description"
            rows={3}
            defaultValue={prizeRevealDescription || ""}
            placeholder="Add the prizes, reveal one at a time, and ask players whether the next value will be higher or lower."
            className="textarea"
            style={styles.textarea}
          />
        </Field>

        <input type="hidden" name="prize_reveal_prize_count" value={prizeCount} />

        <div style={styles.rows}>
          {visiblePrizeRows.map((prize, index) => (
            <details
              key={prize?.id || `new-reveal-prize-${index + 1}`}
              open={Boolean(prize?.title) || index < 2}
              style={styles.row}
            >
              <summary
                className="higher-lower-reveal-row-summary"
                style={styles.rowSummary}
              >
                <div style={styles.rowCopy}>
                  <span style={styles.rowEyebrow}>
                    {index === 0
                      ? "Starting prize"
                      : `Round ${index} reveal prize`}
                  </span>

                  <strong style={styles.rowTitle}>
                    {prize?.title || "Empty prize row"}
                  </strong>

                  <p style={styles.rowHelp}>
                    {index === 0
                      ? "This prize is revealed first and sets the starting value."
                      : `Players guess whether this prize is higher or lower than prize ${index}.`}
                  </p>
                </div>

                <div style={styles.rowActions}>
                  <span
                    style={{
                      ...styles.rowStatus,
                      ...(prize?.isRevealed
                        ? styles.rowStatusRevealed
                        : styles.rowStatusHidden),
                    }}
                  >
                    {revealStatusLabel(prize)}
                  </span>

                  <span style={styles.toggle}>Open</span>
                </div>
              </summary>

              <div style={styles.rowBody}>
                <input
                  type="hidden"
                  name={`prize_reveal_prize_${index}_id`}
                  defaultValue={prize?.id || ""}
                />

                <div style={styles.publicRevealBox}>
                  <div>
                    <strong style={styles.publicRevealTitle}>
                      Public preview status
                    </strong>

                    <p style={styles.publicRevealText}>
                      This controls the public preview only. The live game uses a
                      fixed prize order once it is built.
                    </p>
                  </div>

                  <Field label="Reveal status">
                    <select
                      name={`prize_reveal_prize_${index}_is_revealed`}
                      defaultValue={prize?.isRevealed ? "true" : "false"}
                      className="input"
                      style={styles.input}
                    >
                      <option value="false">Hidden from public preview</option>
                      <option value="true">Shown in public preview</option>
                    </select>
                  </Field>
                </div>

                <div className="higher-lower-reveal-two-col" style={styles.twoCol}>
                  <Field label="Prize name">
                    <input
                      name={`prize_reveal_prize_${index}_title`}
                      defaultValue={prize?.title || ""}
                      placeholder={
                        index === 0
                          ? "Starting prize name"
                          : "Next prize name"
                      }
                      className="input"
                      style={styles.input}
                    />
                  </Field>

                  <Field label="Sponsor / donor">
                    <input
                      name={`prize_reveal_prize_${index}_sponsor_name`}
                      defaultValue={prize?.sponsorName || ""}
                      placeholder="Business, donor or sponsor name"
                      className="input"
                      style={styles.input}
                    />
                  </Field>
                </div>

                <div className="higher-lower-reveal-two-col" style={styles.twoCol}>
                  <Field label="Estimated value">
                    <input
                      name={`prize_reveal_prize_${index}_estimated_value`}
                      type="number"
                      step="0.01"
                      min="0"
                      defaultValue={moneyFromCents(
                        prize?.estimatedValueCents || 0,
                      )}
                      className="input"
                      style={styles.input}
                    />
                  </Field>

                  <Field label="Reveal order">
                    <input
                      name={`prize_reveal_prize_${index}_reveal_order`}
                      type="number"
                      min="1"
                      defaultValue={prize?.revealOrder || index + 1}
                      className="input"
                      style={styles.input}
                    />
                  </Field>
                </div>

                <Field label="Prize description">
                  <textarea
                    name={`prize_reveal_prize_${index}_description`}
                    rows={2}
                    defaultValue={prize?.description || ""}
                    placeholder="Short description for this prize."
                    className="textarea"
                    style={styles.textarea}
                  />
                </Field>

                <div style={styles.imageUploadShell}>
                  <ImageFocusUploadField
                    currentImageUrl={cleanText(prize?.imageUrl)}
                    currentFocusX={50}
                    currentFocusY={50}
                    imageFieldName={`prize_reveal_prize_${index}_image_url`}
                    focusXFieldName={`prize_reveal_prize_${index}_image_focus_x`}
                    focusYFieldName={`prize_reveal_prize_${index}_image_focus_y`}
                    label={`Prize ${index + 1} image upload`}
                    previewAlt={prize?.title || `Prize ${index + 1}`}
                    subscriptionTier={subscriptionTier}
                    customImagesAllowed={customImagesAllowed}
                  />
                </div>
              </div>
            </details>
          ))}
        </div>
      </div>
    </details>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label style={styles.field}>
      <span style={styles.label}>{label}</span>
      {children}
    </label>
  );
}

const styles: Record<string, CSSProperties> = {
  panel: {
    display: "grid",
    gap: 0,
    padding: 16,
    borderRadius: 24,
    background:
      "radial-gradient(circle at top left, rgba(250,204,21,0.18), transparent 34%), linear-gradient(135deg, #fffbeb 0%, #ffffff 58%, #eff6ff 100%)",
    border: "1px solid #fde68a",
    boxShadow: "0 10px 26px rgba(15,23,42,0.06)",
    overflow: "hidden",
  },

  summary: {
    display: "flex",
    justifyContent: "space-between",
    gap: 14,
    alignItems: "flex-start",
    flexWrap: "wrap",
    cursor: "pointer",
    listStyle: "none",
  },

  summaryCopy: {
    minWidth: 0,
    flex: "1 1 420px",
  },

  summaryActions: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "flex-end",
  },

  body: {
    display: "grid",
    gap: 14,
    marginTop: 16,
  },

  eyebrow: {
    color: "#92400e",
    fontSize: 12,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    marginBottom: 5,
  },

  title: {
    margin: 0,
    color: "#0f172a",
    fontSize: 24,
    lineHeight: 1.05,
    letterSpacing: "-0.04em",
  },

  text: {
    margin: "7px 0 0",
    color: "#64748b",
    fontSize: 13,
    lineHeight: 1.5,
    fontWeight: 750,
    maxWidth: 780,
  },

  badge: {
    display: "inline-flex",
    width: "fit-content",
    padding: "8px 12px",
    borderRadius: 999,
    background: "#fef3c7",
    color: "#92400e",
    border: "1px solid #fde68a",
    fontSize: 12,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.04em",
  },

  toggle: {
    display: "inline-flex",
    width: "fit-content",
    padding: "8px 12px",
    borderRadius: 999,
    background: "#ffffff",
    color: "#334155",
    border: "1px solid #e2e8f0",
    fontSize: 12,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.04em",
    whiteSpace: "nowrap",
  },

  notice: {
    display: "grid",
    gap: 4,
    padding: 14,
    borderRadius: 18,
    background: "#eff6ff",
    border: "1px solid #bfdbfe",
    color: "#1e3a8a",
    fontSize: 13,
    lineHeight: 1.45,
    fontWeight: 850,
  },

  twoCol: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 12,
  },

  gameLengthPanel: {
    display: "grid",
    gap: 14,
    padding: 14,
    borderRadius: 18,
    background: "#ffffff",
    border: "1px solid #fde68a",
  },

  gameLengthEyebrow: {
    color: "#92400e",
    fontSize: 11,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    marginBottom: 5,
  },

  gameLengthTitle: {
    margin: 0,
    color: "#0f172a",
    fontSize: 18,
    lineHeight: 1.1,
    letterSpacing: "-0.035em",
  },

  gameLengthText: {
    margin: "7px 0 0",
    color: "#64748b",
    fontSize: 13,
    lineHeight: 1.5,
    fontWeight: 750,
  },

  roundPreview: {
    display: "flex",
    alignItems: "center",
    minHeight: 44,
    padding: "10px 12px",
    borderRadius: 13,
    border: "1px solid #cbd5e1",
    background: "#f8fafc",
    color: "#0f172a",
    fontSize: 15,
    fontWeight: 950,
    boxSizing: "border-box",
  },

  field: {
    display: "grid",
    gap: 6,
    minWidth: 0,
  },

  label: {
    color: "#334155",
    fontSize: 13,
    fontWeight: 950,
  },

  input: {
    width: "100%",
    minHeight: 44,
    padding: "10px 12px",
    borderRadius: 13,
    border: "1px solid #cbd5e1",
    background: "#ffffff",
    color: "#0f172a",
    fontSize: 15,
    boxSizing: "border-box",
    minWidth: 0,
  },

  textarea: {
    width: "100%",
    padding: "10px 12px",
    borderRadius: 13,
    border: "1px solid #cbd5e1",
    background: "#ffffff",
    color: "#0f172a",
    fontSize: 15,
    resize: "vertical",
    boxSizing: "border-box",
    minWidth: 0,
  },

  rows: {
    display: "grid",
    gap: 12,
  },

  row: {
    display: "grid",
    gap: 0,
    padding: 14,
    borderRadius: 18,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    boxShadow: "0 2px 10px rgba(15,23,42,0.035)",
    overflow: "hidden",
  },

  rowSummary: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "flex-start",
    flexWrap: "wrap",
    cursor: "pointer",
    listStyle: "none",
  },

  rowCopy: {
    minWidth: 0,
    flex: "1 1 360px",
  },

  rowActions: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "flex-end",
  },

  rowBody: {
    display: "grid",
    gap: 12,
    marginTop: 14,
  },

  rowEyebrow: {
    display: "block",
    color: "#64748b",
    fontSize: 11,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    marginBottom: 4,
  },

  rowTitle: {
    display: "block",
    color: "#0f172a",
    fontSize: 17,
    fontWeight: 950,
    letterSpacing: "-0.03em",
    overflowWrap: "anywhere",
  },

  rowHelp: {
    margin: "5px 0 0",
    color: "#64748b",
    fontSize: 12,
    lineHeight: 1.4,
    fontWeight: 750,
  },

  rowStatus: {
    display: "inline-flex",
    width: "fit-content",
    padding: "8px 12px",
    borderRadius: 999,
    border: "1px solid",
    fontSize: 12,
    fontWeight: 950,
  },

  rowStatusRevealed: {
    background: "#dcfce7",
    color: "#166534",
    borderColor: "#bbf7d0",
  },

  rowStatusHidden: {
    background: "#f8fafc",
    color: "#64748b",
    borderColor: "#cbd5e1",
  },

  publicRevealBox: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) minmax(220px, 0.35fr)",
    gap: 12,
    alignItems: "center",
    padding: 14,
    borderRadius: 18,
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
  },

  publicRevealTitle: {
    display: "block",
    color: "#0f172a",
    fontSize: 15,
    fontWeight: 950,
    marginBottom: 4,
  },

  publicRevealText: {
    margin: 0,
    color: "#64748b",
    fontSize: 13,
    lineHeight: 1.45,
    fontWeight: 750,
  },

  imageUploadShell: {
    display: "grid",
    gap: 8,
    padding: 14,
    borderRadius: 18,
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    minWidth: 0,
    overflow: "hidden",
  },
};
