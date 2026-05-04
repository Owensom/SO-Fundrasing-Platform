"use client";

import { useMemo, useState } from "react";
import type { CSSProperties, ReactNode } from "react";

type Props = {
  tenantSlug: string;
};

type PrizeRow = {
  id: string;
  position: string;
  title: string;
  description: string;
  is_public: boolean;
};

function safeId(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function makePrize(
  id: string,
  position = "1",
  title = "",
  description = "",
): PrizeRow {
  return {
    id,
    position,
    title,
    description,
    is_public: true,
  };
}

export default function NewEventForm({ tenantSlug }: Props) {
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");

  const [prizes, setPrizes] = useState<PrizeRow[]>([
    makePrize("prize-1", "1", "", ""),
  ]);

  const prizesValue = useMemo(() => {
    const clean = prizes
      .map((prize, index) => {
        const position = Number(prize.position);
        const prizeTitle = prize.title.trim();

        return {
          id: prize.id,
          position:
            Number.isFinite(position) && position > 0
              ? Math.floor(position)
              : index + 1,
          title: prizeTitle,
          name: prizeTitle,
          description: prize.description.trim(),
          isPublic: Boolean(prize.is_public),
          is_public: Boolean(prize.is_public),
          sortOrder: index,
          sort_order: index,
        };
      })
      .filter((prize) => prize.title);

    return JSON.stringify(clean);
  }, [prizes]);

  function updatePrize(id: string, patch: Partial<PrizeRow>) {
    setPrizes((current) =>
      current.map((prize) =>
        prize.id === id ? { ...prize, ...patch } : prize,
      ),
    );
  }

  function addPrize() {
    setPrizes((current) => [
      ...current,
      makePrize(safeId("prize"), String(current.length + 1)),
    ]);
  }

  function removePrize(id: string) {
    setPrizes((current) => current.filter((prize) => prize.id !== id));
  }

  return (
    <form action="/api/admin/events" method="post" style={styles.form}>
      <input type="hidden" name="tenantSlug" value={tenantSlug} />
      <input type="hidden" name="prizes" value={prizesValue} />

      <section style={styles.section}>
        <div style={styles.sectionHeader}>
          <div>
            <h2 style={styles.sectionTitle}>Create event</h2>
            <p style={styles.sectionDescription}>
              Add the event details and optional public prizes.
            </p>
          </div>
        </div>

        <div style={styles.formInner}>
          <Field label="Event title">
            <input
              name="title"
              placeholder="Event title"
              required
              value={title}
              onChange={(event) => {
                setTitle(event.target.value);
                setSlug(slugify(event.target.value));
              }}
              style={styles.input}
            />
          </Field>

          <Field label="Slug">
            <input
              name="slug"
              required
              value={slug}
              onChange={(event) => setSlug(slugify(event.target.value))}
              style={styles.input}
            />
          </Field>

          <Field label="Description">
            <textarea
              name="description"
              placeholder="Description"
              rows={4}
              style={styles.textarea}
            />
          </Field>

          <Field label="Start date">
            <input name="starts_at" type="datetime-local" style={styles.input} />
          </Field>

          <Field label="Event type">
            <select name="event_type" style={styles.input}>
              <option value="general_admission">General</option>
              <option value="reserved_seating">Seating</option>
              <option value="tables">Tables</option>
            </select>
          </Field>

          <Field label="Status">
            <select name="status" defaultValue="draft" style={styles.input}>
              <option value="draft">Draft</option>
              <option value="published">Published</option>
            </select>
          </Field>

          <section style={styles.innerPanel}>
            <div style={styles.innerHeader}>
              <div>
                <h3 style={styles.subTitle}>Prize settings</h3>
                <p style={styles.sectionDescription}>
                  Choose which prizes are visible on the public event page.
                </p>
              </div>

              <button type="button" onClick={addPrize} style={styles.lightButton}>
                + Add prize
              </button>
            </div>

            <div style={styles.prizeList}>
              {prizes.map((prize, index) => (
                <div key={prize.id} style={styles.prizeRow}>
                  <div style={styles.rowHeader}>
                    <strong>Prize {index + 1}</strong>

                    <label style={styles.checkboxLabel}>
                      <input
                        type="checkbox"
                        checked={prize.is_public}
                        onChange={(event) =>
                          updatePrize(prize.id, {
                            is_public: event.target.checked,
                          })
                        }
                      />
                      Show publicly
                    </label>
                  </div>

                  <div style={styles.prizeGrid}>
                    <Field label="Position">
                      <input
                        value={prize.position}
                        onChange={(event) =>
                          updatePrize(prize.id, {
                            position: event.target.value,
                          })
                        }
                        type="number"
                        min="1"
                        step="1"
                        style={styles.input}
                      />
                    </Field>

                    <Field label="Prize title">
                      <input
                        value={prize.title}
                        onChange={(event) =>
                          updatePrize(prize.id, { title: event.target.value })
                        }
                        placeholder="Prize title"
                        style={styles.input}
                      />
                    </Field>
                  </div>

                  <Field label="Description optional">
                    <textarea
                      value={prize.description}
                      onChange={(event) =>
                        updatePrize(prize.id, {
                          description: event.target.value,
                        })
                      }
                      rows={2}
                      style={styles.textarea}
                    />
                  </Field>

                  <button
                    type="button"
                    onClick={() => removePrize(prize.id)}
                    disabled={prizes.length <= 1}
                    style={{
                      ...styles.dangerButton,
                      cursor: prizes.length <= 1 ? "not-allowed" : "pointer",
                      opacity: prizes.length <= 1 ? 0.55 : 1,
                    }}
                  >
                    Remove prize
                  </button>
                </div>
              ))}
            </div>
          </section>

          <section style={styles.submitBar}>
            <div>
              <strong style={{ color: "#0f172a" }}>Create event</strong>
              <div style={styles.mutedSmall}>
                Save the event with any public prizes.
              </div>
            </div>

            <button type="submit" style={styles.submitButton}>
              Create event
            </button>
          </section>
        </div>
      </section>
    </form>
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
  form: {
    display: "grid",
    gap: 16,
  },
  section: {
    padding: 18,
    borderRadius: 22,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    boxShadow: "0 2px 12px rgba(15,23,42,0.04)",
  },
  sectionHeader: {
    marginBottom: 16,
  },
  sectionTitle: {
    margin: 0,
    color: "#0f172a",
    fontSize: 22,
    letterSpacing: "-0.02em",
  },
  sectionDescription: {
    margin: "5px 0 0",
    color: "#64748b",
    fontSize: 14,
    lineHeight: 1.45,
  },
  formInner: {
    display: "grid",
    gap: 14,
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
  textarea: {
    width: "100%",
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid #cbd5e1",
    background: "#ffffff",
    color: "#0f172a",
    fontSize: 15,
    resize: "vertical",
    boxSizing: "border-box",
  },
  innerPanel: {
    display: "grid",
    gap: 14,
    padding: 16,
    borderRadius: 18,
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
  },
  innerHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "flex-start",
    flexWrap: "wrap",
  },
  subTitle: {
    margin: 0,
    color: "#0f172a",
    fontSize: 18,
    letterSpacing: "-0.01em",
  },
  lightButton: {
    padding: "10px 14px",
    borderRadius: 999,
    border: "1px solid #cbd5e1",
    background: "#ffffff",
    color: "#0f172a",
    cursor: "pointer",
    fontWeight: 900,
    whiteSpace: "nowrap",
  },
  prizeList: {
    display: "grid",
    gap: 12,
  },
  prizeRow: {
    display: "grid",
    gap: 12,
    padding: 14,
    border: "1px solid #e2e8f0",
    borderRadius: 16,
    background: "#ffffff",
  },
  rowHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    flexWrap: "wrap",
    color: "#0f172a",
  },
  prizeGrid: {
    display: "grid",
    gridTemplateColumns: "110px minmax(0, 1fr)",
    gap: 12,
  },
  checkboxLabel: {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    minHeight: 44,
    fontWeight: 900,
    color: "#334155",
    cursor: "pointer",
  },
  dangerButton: {
    width: "fit-content",
    padding: "10px 12px",
    borderRadius: 999,
    border: "1px solid #fecaca",
    background: "#ffffff",
    color: "#b91c1c",
    fontWeight: 900,
  },
  submitBar: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 14,
    flexWrap: "wrap",
    padding: 16,
    borderRadius: 18,
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
  },
  mutedSmall: {
    color: "#64748b",
    fontSize: 13,
    marginTop: 3,
  },
  submitButton: {
    padding: "13px 20px",
    border: "none",
    borderRadius: 999,
    background: "#1683f8",
    color: "#ffffff",
    fontWeight: 900,
    cursor: "pointer",
    boxShadow: "0 10px 20px rgba(22,131,248,0.22)",
  },
};
