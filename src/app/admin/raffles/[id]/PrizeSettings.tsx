"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

type Prize = {
  position: number;
  title: string;
  description?: string;
  isPublic?: boolean;
  is_public?: boolean;
};

type Props = {
  raffleId: string;
  initialPrizes: Prize[];
};

const EMPTY_PRIZE: Prize = {
  position: 1,
  title: "",
  description: "",
  isPublic: true,
};

function normalisePrizes(prizes: Prize[]) {
  return prizes
    .map((prize, index) => ({
      position: Number.isFinite(Number(prize.position))
        ? Math.max(1, Math.floor(Number(prize.position)))
        : index + 1,
      title: String(prize.title || "").trim(),
      description: String(prize.description || "").trim(),
      isPublic: prize.isPublic !== false && prize.is_public !== false,
    }))
    .filter((prize) => prize.title.length > 0)
    .sort((a, b) => a.position - b.position);
}

function getPrizeLabel(position: number) {
  if (position === 1) return "1st";
  if (position === 2) return "2nd";
  if (position === 3) return "3rd";
  return `${position}th`;
}

export default function PrizeSettings({ raffleId, initialPrizes }: Props) {
  const router = useRouter();

  const initialCleanPrizes = useMemo(() => {
    const clean = normalisePrizes(initialPrizes);
    return clean.length ? clean : [EMPTY_PRIZE];
  }, [initialPrizes]);

  const [prizes, setPrizes] = useState<Prize[]>(initialCleanPrizes);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const visibleCount = prizes.filter(
    (prize) => prize.isPublic !== false && prize.is_public !== false,
  ).length;

  const completedCount = prizes.filter((prize) =>
    String(prize.title || "").trim(),
  ).length;

  function updatePrize(index: number, patch: Partial<Prize>) {
    setMessage("");
    setError("");

    setPrizes((current) =>
      current.map((prize, i) => (i === index ? { ...prize, ...patch } : prize)),
    );
  }

  function addPrize() {
    setMessage("");
    setError("");

    setPrizes((current) => [
      ...current,
      {
        position: current.length + 1,
        title: "",
        description: "",
        isPublic: true,
      },
    ]);
  }

  function removePrize(index: number) {
    setMessage("");
    setError("");

    setPrizes((current) => {
      const next = current
        .filter((_, i) => i !== index)
        .map((prize, i) => ({
          ...prize,
          position: i + 1,
        }));

      return next.length ? next : [{ ...EMPTY_PRIZE }];
    });
  }

  function movePrize(index: number, direction: "up" | "down") {
    setMessage("");
    setError("");

    setPrizes((current) => {
      const targetIndex = direction === "up" ? index - 1 : index + 1;

      if (targetIndex < 0 || targetIndex >= current.length) return current;

      const next = [...current];
      const currentPrize = next[index];
      const targetPrize = next[targetIndex];

      next[index] = targetPrize;
      next[targetIndex] = currentPrize;

      return next.map((prize, i) => ({
        ...prize,
        position: i + 1,
      }));
    });
  }

  async function savePrizes() {
    try {
      setSaving(true);
      setMessage("");
      setError("");

      const cleanPrizes = normalisePrizes(prizes);

      const response = await fetch(`/api/admin/raffles/${raffleId}/prizes`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prizes: cleanPrizes,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data?.ok) {
        throw new Error(data?.error || "Failed to save prizes.");
      }

      setPrizes(data.prizes.length ? data.prizes : [{ ...EMPTY_PRIZE }]);

      setMessage("Prize settings saved.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save prizes.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section style={styles.shell}>
      <div style={styles.header}>
        <div>
          <div style={styles.eyebrow}>Prize settings</div>
          <h3 style={styles.title}>Public prize list</h3>
          <p style={styles.description}>
            Create the prizes shown on the public raffle page and used by the
            draw centre.
          </p>
        </div>

        <div style={styles.stats}>
          <div style={styles.statCard}>
            <span style={styles.statLabel}>Prizes</span>
            <strong style={styles.statValue}>{completedCount}</strong>
          </div>

          <div style={styles.statCard}>
            <span style={styles.statLabel}>Public</span>
            <strong style={styles.statValue}>{visibleCount}</strong>
          </div>
        </div>
      </div>

      <div style={styles.helpPanel}>
        <strong>Recommended setup</strong>
        <span>
          Put your headline prizes first. Use public visibility if you want the
          prize advertised, or hide a prize if it is for internal draw use only.
        </span>
      </div>

      <div style={styles.prizeList}>
        {prizes.map((prize, index) => {
          const isPublic = prize.isPublic !== false && prize.is_public !== false;
          const hasTitle = String(prize.title || "").trim().length > 0;

          return (
            <article
              key={`${index}-${prize.position}`}
              style={{
                ...styles.prizeCard,
                borderColor: hasTitle ? "#dbeafe" : "#e2e8f0",
                background: hasTitle
                  ? "linear-gradient(135deg, #ffffff 0%, #f8fbff 100%)"
                  : "#ffffff",
              }}
            >
              <div style={styles.prizeTopRow}>
                <div style={styles.positionBadge}>
                  <span style={styles.positionNumber}>
                    {getPrizeLabel(Number(prize.position || index + 1))}
                  </span>
                  <span style={styles.positionText}>Prize</span>
                </div>

                <div style={styles.prizeActions}>
                  <button
                    type="button"
                    onClick={() => movePrize(index, "up")}
                    disabled={index === 0}
                    style={{
                      ...styles.smallButton,
                      opacity: index === 0 ? 0.45 : 1,
                      cursor: index === 0 ? "not-allowed" : "pointer",
                    }}
                  >
                    ↑
                  </button>

                  <button
                    type="button"
                    onClick={() => movePrize(index, "down")}
                    disabled={index === prizes.length - 1}
                    style={{
                      ...styles.smallButton,
                      opacity: index === prizes.length - 1 ? 0.45 : 1,
                      cursor:
                        index === prizes.length - 1
                          ? "not-allowed"
                          : "pointer",
                    }}
                  >
                    ↓
                  </button>

                  <button
                    type="button"
                    onClick={() => removePrize(index)}
                    style={styles.removeButton}
                  >
                    Remove
                  </button>
                </div>
              </div>

              <div style={styles.grid}>
                <label style={styles.field}>
                  <span style={styles.label}>Position</span>
                  <input
                    type="number"
                    min={1}
                    value={prize.position}
                    onChange={(event) =>
                      updatePrize(index, {
                        position: Math.max(
                          1,
                          Math.floor(Number(event.target.value) || 1),
                        ),
                      })
                    }
                    style={styles.input}
                  />
                </label>

                <label style={{ ...styles.field, ...styles.titleField }}>
                  <span style={styles.label}>Prize title</span>
                  <input
                    value={prize.title}
                    onChange={(event) =>
                      updatePrize(index, { title: event.target.value })
                    }
                    placeholder="e.g. £500 cash, luxury hamper, weekend break"
                    style={styles.input}
                  />
                </label>
              </div>

              <label style={styles.field}>
                <span style={styles.label}>Description optional</span>
                <textarea
                  value={prize.description || ""}
                  onChange={(event) =>
                    updatePrize(index, { description: event.target.value })
                  }
                  placeholder="Optional extra detail shown publicly"
                  rows={3}
                  style={styles.textarea}
                />
              </label>

              <div style={styles.footerRow}>
                <label
                  style={{
                    ...styles.visibilityToggle,
                    background: isPublic ? "#ecfdf5" : "#f8fafc",
                    borderColor: isPublic ? "#bbf7d0" : "#e2e8f0",
                    color: isPublic ? "#166534" : "#64748b",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={isPublic}
                    onChange={(event) =>
                      updatePrize(index, { isPublic: event.target.checked })
                    }
                  />
                  {isPublic ? "Visible on public page" : "Hidden from public page"}
                </label>

                <div style={styles.previewText}>
                  {hasTitle ? prize.title : "Prize title not set yet"}
                </div>
              </div>
            </article>
          );
        })}
      </div>

      {message ? <div style={styles.successMessage}>{message}</div> : null}
      {error ? <div style={styles.errorMessage}>{error}</div> : null}

      <div style={styles.actionBar}>
        <button type="button" onClick={addPrize} style={styles.addButton}>
          Add prize
        </button>

        <button
          type="button"
          onClick={savePrizes}
          disabled={saving}
          style={{
            ...styles.saveButton,
            cursor: saving ? "not-allowed" : "pointer",
            opacity: saving ? 0.7 : 1,
          }}
        >
          {saving ? "Saving prizes..." : "Save prizes"}
        </button>
      </div>
    </section>
  );
}

const styles: Record<string, React.CSSProperties> = {
  shell: {
    display: "grid",
    gap: 16,
    padding: 18,
    border: "1px solid #e2e8f0",
    borderRadius: 22,
    background:
      "linear-gradient(135deg, #ffffff 0%, #f8fafc 55%, #eff6ff 100%)",
  },
  header: {
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
    maxWidth: 680,
  },
  stats: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
  },
  statCard: {
    minWidth: 88,
    padding: "10px 12px",
    borderRadius: 16,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    boxShadow: "0 2px 10px rgba(15,23,42,0.04)",
  },
  statLabel: {
    display: "block",
    color: "#64748b",
    fontSize: 12,
    fontWeight: 900,
  },
  statValue: {
    display: "block",
    color: "#0f172a",
    fontSize: 22,
    lineHeight: 1,
    marginTop: 5,
  },
  helpPanel: {
    display: "grid",
    gap: 4,
    padding: 14,
    borderRadius: 18,
    background: "#0f172a",
    color: "#ffffff",
    boxShadow: "0 12px 24px rgba(15,23,42,0.12)",
  },
  prizeList: {
    display: "grid",
    gap: 12,
  },
  prizeCard: {
    display: "grid",
    gap: 13,
    padding: 15,
    borderRadius: 20,
    border: "1px solid",
    boxShadow: "0 2px 12px rgba(15,23,42,0.04)",
  },
  prizeTopRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    flexWrap: "wrap",
  },
  positionBadge: {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    padding: "7px 10px",
    borderRadius: 999,
    background: "#0f172a",
    color: "#ffffff",
    fontWeight: 950,
  },
  positionNumber: {
    fontSize: 14,
  },
  positionText: {
    color: "#cbd5e1",
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
  },
  prizeActions: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },
  smallButton: {
    width: 38,
    height: 38,
    borderRadius: 12,
    border: "1px solid #cbd5e1",
    background: "#ffffff",
    color: "#0f172a",
    fontWeight: 950,
  },
  removeButton: {
    height: 38,
    padding: "0 12px",
    borderRadius: 12,
    border: "1px solid #fecaca",
    background: "#fff1f2",
    color: "#be123c",
    fontWeight: 900,
    cursor: "pointer",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "120px minmax(0, 1fr)",
    gap: 12,
  },
  titleField: {
    minWidth: 0,
  },
  field: {
    display: "grid",
    gap: 6,
  },
  label: {
    color: "#334155",
    fontSize: 13,
    fontWeight: 950,
  },
  input: {
    width: "100%",
    height: 44,
    borderRadius: 12,
    border: "1px solid #cbd5e1",
    padding: "0 12px",
    color: "#0f172a",
    background: "#ffffff",
    fontSize: 15,
    boxSizing: "border-box",
  },
  textarea: {
    width: "100%",
    minHeight: 78,
    borderRadius: 12,
    border: "1px solid #cbd5e1",
    padding: "10px 12px",
    color: "#0f172a",
    background: "#ffffff",
    fontSize: 15,
    resize: "vertical",
    boxSizing: "border-box",
  },
  footerRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    flexWrap: "wrap",
  },
  visibilityToggle: {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    padding: "9px 12px",
    borderRadius: 999,
    border: "1px solid",
    fontSize: 13,
    fontWeight: 950,
    cursor: "pointer",
  },
  previewText: {
    color: "#64748b",
    fontSize: 13,
    fontWeight: 800,
  },
  successMessage: {
    padding: "12px 14px",
    borderRadius: 14,
    background: "#ecfdf5",
    border: "1px solid #bbf7d0",
    color: "#166534",
    fontWeight: 900,
  },
  errorMessage: {
    padding: "12px 14px",
    borderRadius: 14,
    background: "#fef2f2",
    border: "1px solid #fecaca",
    color: "#b91c1c",
    fontWeight: 900,
  },
  actionBar: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
    flexWrap: "wrap",
    paddingTop: 4,
  },
  addButton: {
    padding: "12px 15px",
    borderRadius: 999,
    border: "1px solid #cbd5e1",
    background: "#ffffff",
    color: "#0f172a",
    fontWeight: 950,
    cursor: "pointer",
  },
  saveButton: {
    padding: "12px 18px",
    borderRadius: 999,
    border: "1px solid #16a34a",
    background: "#16a34a",
    color: "#ffffff",
    fontWeight: 950,
    boxShadow: "0 10px 20px rgba(22,163,74,0.22)",
  },
};
