"use client";

import { useMemo, useState, type CSSProperties } from "react";
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
    return "Empty row";
  }

  return prize.isRevealed ? "Revealed publicly" : "Hidden from reveal";
}

function revealProgressText(prizes: EventPrizeRevealPrize[]) {
  const total = prizes.length;
  const revealed = prizes.filter((prize) => prize.isRevealed).length;

  if (total === 0) {
    return "No prizes saved yet";
  }

  return `${revealed} of ${total} revealed`;
}

export default function HigherOrLowerPrizeRevealEditor({
  prizeRevealModeEnabled,
  prizeRevealRandomiseOrder,
  prizeRevealTitle,
  prizeRevealDescription,
  prizeRevealPrizes,
  maxPrizes,
  subscriptionTier,
  customImagesAllowed,
}: Props) {
  const safeMaxPrizes = Math.max(2, Math.floor(Number(maxPrizes || 8)));
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
      className="prizeRevealPanel"
      style={styles.prizeRevealPanel}
    >
      <summary className="prizeRevealSummary" style={styles.prizeRevealSummary}>
        <div>
          <div style={styles.prizeRevealEyebrow}>
            Higher or Lower prize reveal mode
          </div>

          <h3 style={styles.prizeRevealTitle}>Prize reveal controls</h3>

          <p style={styles.prizeRevealText}>
            Choose how many prizes this game should use, then complete one prize
            row for each reveal. The live game uses the saved prize list: Prize 1
            is the starting value, and each later prize becomes one Higher or
            Lower round.
          </p>
        </div>

        <div style={styles.prizeRevealSummaryActions}>
          <span style={styles.prizeRevealBadge}>{revealProgress}</span>
          <span style={styles.prizeRevealToggle}>Open / close</span>
        </div>
      </summary>

      <div style={styles.prizeRevealBody}>
        <div style={styles.revealControlNotice}>
          <strong>Game length</strong>
          <span>
            Two prizes create one playable round. Three prizes create two rounds.
            The maximum for this editor is {safeMaxPrizes} prizes.
          </span>
        </div>

        <div className="twoCol" style={styles.twoCol}>
          <Field label="Enable prize reveal mode">
            <select
              name="prize_reveal_mode_enabled"
              defaultValue={prizeRevealModeEnabled ? "true" : "false"}
              className="input"
              style={styles.input}
            >
              <option value="false">No, keep prize reveal mode off</option>
              <option value="true">Yes, show prize reveal preview</option>
            </select>
          </Field>

          <Field label="Reveal order">
            <select
              name="prize_reveal_randomise_order"
              defaultValue={prizeRevealRandomiseOrder ? "true" : "false"}
              className="input"
              style={styles.input}
            >
              <option value="false">Use the order below</option>
              <option value="true">Randomise once when live game is created</option>
            </select>
          </Field>
        </div>

        <div style={styles.gameLengthPanel}>
          <div>
            <div style={styles.gameLengthEyebrow}>Prizes / rounds</div>
            <h4 style={styles.gameLengthTitle}>Choose game length</h4>
            <p style={styles.gameLengthText}>
              The organiser decides how many prize reveals to set up here. The
              live game can then use the saved prize list, with the first prize
              acting as the starting revealed value.
            </p>
          </div>

          <div className="twoCol" style={styles.twoCol}>
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
              <div style={styles.gameLengthPreview}>
                {playableRounds} round{playableRounds === 1 ? "" : "s"}
              </div>
            </Field>
          </div>
        </div>

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

        <div style={styles.prizeRevealRows}>
          {visiblePrizeRows.map((prize, index) => (
            <details
              key={prize?.id || `new-reveal-prize-${index + 1}`}
              open={Boolean(prize?.title) || index < 2}
              style={styles.prizeRevealRow}
            >
              <summary
                className="prizeRevealRowHeader"
                style={styles.prizeRevealRowHeader}
              >
                <div>
                  <span style={styles.prizeRevealRowEyebrow}>
                    {index === 0
                      ? "Starting prize"
                      : `Round ${index} reveal prize`}
                  </span>

                  <strong style={styles.prizeRevealRowTitle}>
                    {prize?.title || "Empty prize row"}
                  </strong>

                  <p style={styles.prizeRevealRowHelp}>
                    {index === 0
                      ? "This is revealed first and sets the starting value."
                      : `Players guess whether this prize is higher or lower than prize ${index}.`}
                  </p>
                </div>

                <div style={styles.prizeRevealRowActions}>
                  <span
                    style={{
                      ...styles.prizeRevealRowStatus,
                      ...(prize?.isRevealed
                        ? styles.prizeRevealRowStatusRevealed
                        : styles.prizeRevealRowStatusHidden),
                    }}
                  >
                    {revealStatusLabel(prize)}
                  </span>

                  <span style={styles.prizeRevealToggle}>Open</span>
                </div>
              </summary>

              <div style={styles.prizeRevealRowBody}>
                <input
                  type="hidden"
                  name={`prize_reveal_prize_${index}_id`}
                  defaultValue={prize?.id || ""}
                />

                <div style={styles.revealControlBox}>
                  <div>
                    <strong style={styles.revealControlTitle}>
                      Public reveal status
                    </strong>

                    <p style={styles.revealControlText}>
                      This controls the public preview only. The live game keeps
                      its own fixed order once the game is created.
                    </p>
                  </div>

                  <Field label="Reveal status">
                    <select
                      name={`prize_reveal_prize_${index}_is_revealed`}
                      defaultValue={prize?.isRevealed ? "true" : "false"}
                      className="input"
                      style={styles.input}
                    >
                      <option value="false">Hidden — not revealed yet</option>
                      <option value="true">Revealed — show publicly</option>
                    </select>
                  </Field>
                </div>

                <div className="twoCol" style={styles.twoCol}>
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

                <div className="twoCol" style={styles.twoCol}>
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

                <div style={styles.prizeImageUploadShell}>
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={styles.field}>
      <span style={styles.label}>{label}</span>
      {children}
    </label>
  );
}

const styles: Record<string, CSSProperties> = {
  prizeRevealPanel: {
    display: "grid",
    gap: 0,
    padding: 16,
    borderRadius: 22,
    background:
      "radial-gradient(circle at top left, rgba(250,204,21,0.16), transparent 34%), linear-gradient(135deg, #fffbeb 0%, #ffffff 58%, #eff6ff 100%)",
    border: "1px solid #fde68a",
    boxShadow: "0 8px 22px rgba(15,23,42,0.05)",
    overflow: "hidden",
  },

  prizeRevealSummary: {
    display: "flex",
    justifyContent: "space-between",
    gap: 14,
    alignItems: "flex-start",
    flexWrap: "wrap",
    cursor: "pointer",
    listStyle: "none",
  },

  prizeRevealSummaryActions: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "flex-end",
  },

  prizeRevealBody: {
    display: "grid",
    gap: 14,
    marginTop: 16,
  },

  prizeRevealEyebrow: {
    color: "#92400e",
    fontSize: 12,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    marginBottom: 5,
  },

  prizeRevealTitle: {
    margin: 0,
    color: "#0f172a",
    fontSize: 24,
    lineHeight: 1.05,
    letterSpacing: "-0.04em",
  },

  prizeRevealText: {
    margin: "7px 0 0",
    color: "#64748b",
    fontSize: 13,
    lineHeight: 1.5,
    fontWeight: 750,
    maxWidth: 760,
  },

  prizeRevealBadge: {
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

  prizeRevealToggle: {
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

  revealControlNotice: {
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

  gameLengthPreview: {
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

  prizeRevealRows: {
    display: "grid",
    gap: 12,
  },

  prizeRevealRow: {
    display: "grid",
    gap: 0,
    padding: 14,
    borderRadius: 18,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    boxShadow: "0 2px 10px rgba(15,23,42,0.035)",
    overflow: "hidden",
  },

  prizeRevealRowHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "flex-start",
    flexWrap: "wrap",
    cursor: "pointer",
    listStyle: "none",
  },

  prizeRevealRowActions: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "flex-end",
  },

  prizeRevealRowBody: {
    display: "grid",
    gap: 12,
    marginTop: 14,
  },

  prizeRevealRowEyebrow: {
    display: "block",
    color: "#64748b",
    fontSize: 11,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    marginBottom: 4,
  },

  prizeRevealRowTitle: {
    display: "block",
    color: "#0f172a",
    fontSize: 17,
    fontWeight: 950,
    letterSpacing: "-0.03em",
  },

  prizeRevealRowHelp: {
    margin: "5px 0 0",
    color: "#64748b",
    fontSize: 12,
    lineHeight: 1.4,
    fontWeight: 750,
  },

  prizeRevealRowStatus: {
    display: "inline-flex",
    width: "fit-content",
    padding: "8px 12px",
    borderRadius: 999,
    border: "1px solid",
    fontSize: 12,
    fontWeight: 950,
  },

  prizeRevealRowStatusRevealed: {
    background: "#dcfce7",
    color: "#166534",
    borderColor: "#bbf7d0",
  },

  prizeRevealRowStatusHidden: {
    background: "#f8fafc",
    color: "#64748b",
    borderColor: "#cbd5e1",
  },

  revealControlBox: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) minmax(220px, 0.35fr)",
    gap: 12,
    alignItems: "center",
    padding: 14,
    borderRadius: 18,
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
  },

  revealControlTitle: {
    display: "block",
    color: "#0f172a",
    fontSize: 15,
    fontWeight: 950,
    marginBottom: 4,
  },

  revealControlText: {
    margin: 0,
    color: "#64748b",
    fontSize: 13,
    lineHeight: 1.45,
    fontWeight: 750,
  },

  prizeImageUploadShell: {
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
